# B25 单点运行证据合同

## 结论

B25 当前 `/zsqy/reg/140btwentyfive/findAllByDrTypeId` 返回的 `tagTime=5` 是旧系统存储周期配置，不是绝对采样时间。`generatedAt`、BFF `fetchedAt`、HTTP 返回时间和页面刷新时间均不得转换为单点权威 `observedAt`。

本合同仅用于只读数字孪生、运行监测和 shadow 诊断，不增加 BA/PLC 写入。

## 权威时间产生位置

按以下优先级获取单点时间：

1. 现场数据源明确声明为“本次成功观测/采样”的带时区绝对时间；原样保存为 `observedAt`，不得由 BFF 重写。
2. 经现场验收且由服务端代码登记的 OPC UA DataValue 适配器所解码的 `serverTimestamp`；记录payload自报OPC UA不构成信任。
3. NTP/PTP 对时的边缘采集器成功完成该点或该寄存器块读取的时间。
4. 历史库逐点事件时间只作为历史证据；如果点龄超过实时门槛，不得驱动机械动画。

PLC/OPC UA `sourceTimestamp` 通常表达值或状态最后变化时间，应保存为 `changedAt`，不能在没有额外语义合同时直接当作 `observedAt`。否则恒定但持续正常采集的温度、频率或状态点会被误判为陈旧。

若上述时间均不存在，`observedAt` 必须为 `null`，状态保持 `STALE` 或 `UNBOUND`。

## 单点数据包

```json
{
  "pointKey": "CWP2-1-509-42008",
  "deviceId": "48",
  "deviceCode": "CWP2",
  "regId": "1703",
  "regName": "频率反馈",
  "tagName": "CWP2-1-509-42008",
  "semanticKey": "frequencyHz",
  "value": 29.7,
  "unit": "Hz",
  "observedAt": "2026-07-18T04:13:10.125Z",
  "changedAt": "2026-07-18T04:12:48.400Z",
  "receivedAt": "2026-07-18T04:13:10.180Z",
  "timestampBasis": "edge_poll_complete",
  "qualityCode": "GOOD",
  "sourceKey": "chillerStagingRuntime",
  "sourceSequence": 183921,
  "scanCycleId": "b25-edge-01:183921",
  "bootId": "20260718-001"
}
```

## 点表码与运行标签

B25点表中的审核码以 `SY-` 开头，旧实时接口实际返回的传输标签以设备 `runtimeId` 开头。两者只能使用已登记的精确别名规则：把点表码最前面的 `SY-` 替换为 `{runtimeId}-`，然后同时按 `deviceId + tagName` 精确且唯一匹配。禁止按中文名、后缀、包含关系或列表顺序猜测。

示例：`SY-1-509-42008 + runtimeId=CWP2` 只允许解析为 `CWP2-1-509-42008`。别名规则和54台设备的162个状态选择器（运行、故障、远程允许各54个）及47个频率选择器登记在 `b25-plant-overview-binding-v2.json`，总计209个精确只读选择器。

### 字段规则

| 字段 | 规则 |
|---|---|
| `pointKey` | 优先使用唯一 `tagName`；缺失时使用 `deviceId:regId`，禁止使用中文显示名作唯一键 |
| `observedAt` | UTC ISO 8601；代表单点最近一次被源或可信采集器确认的时间 |
| `changedAt` | UTC ISO 8601；代表值或质量最后变化时间，不单独证明当前采集链健康 |
| `receivedAt` | BFF/平台收到数据的时间，只用于链路延迟诊断 |
| `timestampBasis` | 仅允许登记的权威来源；缺失时使用 `missing_source_timestamp` |
| `qualityCode` | `GOOD`、`UNCERTAIN_*` 或 `BAD_*`；只有 `GOOD` 可进入 `LIVE` |
| `sourceSequence` | 单调递增；结合 `bootId` 防止重启后序号倒退或重复 |
| `scanCycleId` | 标识一次完整采集周期；新序号必须同时进入新的采集周期 |
| `bootId` | 标识采集器本次启动；重启后序号可归零，但新观测时间必须晚于重启前证据 |
| `semanticKey` | 受控值，包括 `running`、`frequencyHz`、`faultActive`、`flowM3h`、`powerKw`、`remoteEnabled` |

权威 `timestampBasis` 白名单：

- `opcua_server_timestamp`
- `edge_poll_complete`
- `historian_event_time`
- `source_observed_at`

## BFF 合同

`GET /bff/v1/sites/{siteId}/runtime/summary` 保留现有数值摘要，并新增：

```json
{
  "pointEvidence": {
    "contractVersion": "runtime-point-evidence-v1",
    "sourceKey": "chillerStagingRuntime",
    "evidenceProfileId": null,
    "receivedAt": "2026-07-18T04:13:10.180Z",
    "points": [],
    "summary": {
      "totalPoints": 327,
      "authoritativeTimestampPoints": 0,
      "missingTimestampPoints": 327,
      "goodQualityPoints": 0,
      "replayProofPoints": 0,
      "missingReplayProofPoints": 327
    }
  },
  "freshnessPolicy": {
    "clientRefreshIntervalMs": 10000,
    "sourceExpectedIntervalMs": null,
    "liveMaxAgeMs": 20000,
    "maxFutureSkewMs": 2000
  }
}
```

BFF 必须透传权威时间。任何聚合值的有效 `observedAt` 取所有必要输入点中最早的时间，禁止用最新输入把旧输入“抬新”。`liveMaxAgeMs=20000` 和 `maxFutureSkewMs=2000` 是不可放宽上限；上游或站点配置只能收紧，不能调大，`maxFutureSkewMs=0` 表示严格禁止未来时间。

`pointEvidence.receivedAt` 仅表示平台最近一次收到运行摘要包。它可作为 `SHADOW` 链路活性门禁，最大允许30秒；它不是点位采样时间，不得复制、改名或折算成 `observedAt`，也不得用于提升 `LIVE` 覆盖率。

SHADOW泵轴/塔风机的运行位和频率反馈必须来自同一个收包快照：两点各自的 `receivedAt` 必须与同一顶层 `pointEvidence.receivedAt` 精确相等。两点的 `bootId/scanCycleId` 中只要有任一字段出现，运行点和频率点的四个字段就必须全部非空，且两点 `bootId` 精确相同、`scanCycleId` 精确相同；部分携带、跨包混用或任一不同均不得进入SHADOW。若四字段全部缺失，只能依赖同一 `receivedAt` 快照进入非权威SHADOW；LIVE仍必须无条件具备完整且相同的 `bootId + scanCycleId`。

B25状态补全只允许额外执行一次只读 `GET /zsqy/reg/140btwentyfive/findObject?pageCurrent=1&pageSize=5000`，把平铺寄存器按 `drId` 分组后，依据54台核心设备的精确设备码、精确寄存器名和逐设备逐语义的精确标签合同合并。全集请求失败、空数据、覆盖不足、重复选择器、设备码或标签漂移时，`chillerStagingRuntime`必须整体标记不健康且`fallback=false`，所有SHADOW状态与动画随即失效。该请求的完成时间只可写入`receivedAt`传输包络，仍不得生成单点`observedAt`。

`observedAt`、`qualityCode`和重放三元组不得由运行记录自证权威。只有服务端代码登记、与站点+适配器+接口+基址+项目键精确绑定并已完成现场验收的 evidence profile，才能解码这些字段。payload 内的 `sourceProtocol`、`timestampBasis`、`timestampRole`、`statusCode=0`或`qualityCode=GOOD` 均不能选择或绕过 profile。未登记 profile 时必须输出 `evidenceProfileId=null`、`observedAt=null`、`qualityCode=UNKNOWN/BAD`且重放三元组为null。当前代码仅登记解码器 `opcua-datavalue-v1`，B25尚未将它绑定到现场接口，因此不允许进入 `LIVE`。

## 3D 动画门禁

设备动画进入 `LIVE` 必须同时满足：

```text
设备身份映射唯一
AND 必需点位映射唯一
AND value 有效
AND qualityCode = GOOD
AND evidenceProfileId 命中服务端代码登记白名单
AND sourceSequence、scanCycleId、bootId 完整且无倒退或冲突
AND timestampBasis 在权威白名单
AND 相关 sourceStatus.ok = true
AND observedAt 不晚于当前时间 + 2秒
AND 当前时间 - observedAt <= 20秒
```

- 水泵轴：运行反馈和频率反馈都必须满足；任一点不合格即暂停。
- 冷却塔风机：运行反馈和频率反馈都必须满足；任一点不合格即暂停。
- 同一泵或风机的运行反馈与频率反馈必须来自同一 `bootId + scanCycleId`；旧boot退役后不得A→B→A重用。
- 运行反馈只接受布尔值或明确的0/1枚举；频率反馈只接受0至60 Hz。超出范围不得靠限幅后进入 `LIVE`。
- 水流：必须有对应流量点或经单独验收的流动证据；不得仅根据整站接口成功或水泵运行推断。
- 明确故障位且故障证据新鲜时标 `FAULT`；通信失败不能冒充设备故障。
- DEMO 动画与 LIVE 动画必须分离，DEMO 不得改变证据状态。

## 设备运行四态合同

业务状态、证据等级和动画模式是三个独立维度。设备业务状态只允许按下表判定：

| 状态 | 必需的显式状态位 | 视觉语义 |
|---|---|---|
| `FAULT` | `faultActive=1` | 红色；故障优先于其他状态 |
| `RUNNING` | `faultActive=0 AND running=1` | 绿色；只有此状态允许机械运行时动画 |
| `STANDBY` | `faultActive=0 AND running=0 AND remoteEnabled=1` | 黄色；远程允许、等待联锁或调度 |
| `STOPPED` | `faultActive=0 AND running=0 AND remoteEnabled=0` | 灰色；明确停机且远程未允许 |
| `UNKNOWN` | 任一必要点缺失、重复、非法、BAD、来源异常或超时 | 蓝灰色；禁止猜测、禁止机械运行时动画 |

状态位只接受布尔值、数值`0/1`以及精确字符串`"0"/"1"`。不得对字符串做中文语义、宽松真值或空白修剪后判定。`FAULT`必须来自精确且唯一的显式故障位；通信告警、请求失败、缺点或旧值只能降级为`UNKNOWN`，不得伪造设备故障。DEMO可播放资产示意动画，但不得改变上述业务状态及其证据等级。

### 状态、告警和诊断分离

- 设备业务状态只回答“当前运行/故障/停机/待机/未知”，只由162个精确状态选择器计算。
- 告警生命周期回答“活动、已确认、已恢复未闭环、已闭环”。它必须由独立告警记录和确认/恢复/闭环证据驱动；显式故障位为1只能令业务状态进入`FAULT`，不能据此宣称告警已确认或已闭环。
- 诊断状态回答“状态与频率、流量、温差等运行证据是否矛盾”。诊断可形成独立提示徽标，但不得把RUNNING、STANDBY、STOPPED或UNKNOWN改写为FAULT，也不得替代显式故障位。
- 当前告警生命周期和诊断点位未绑定时，两者分别显示`UNBOUND`，不能从设备颜色、机械动画或通信状态猜测。

## 状态视觉与交互合同

1. 三维主表达为设备底部包络附近的状态灯带和四角定位框；悬浮圆圈只允许作为选中定位辅助，不得作为全部54台设备的唯一状态表达。
2. RUNNING=`running-play`，使用连续绿灯带与运行箭形；FAULT=`fault-alert`，使用红色双层角框与警示三角；STANDBY=`standby-pause`，使用琥珀色分段灯带与暂停双线；STOPPED=`stopped-square`，使用灰色细灯带与方形；UNKNOWN=`unknown-question`，使用灰蓝虚线角框与问号。颜色和形状必须同时存在。
3. SHADOW使用空心、分段或虚线几何并显示“时效不可证”，不能只降低透明度。只有FAULT允许慢速脉动；RUNNING、STANDBY、STOPPED和UNKNOWN状态层保持静止，设备本体机械动画另按运行证据门禁执行。
4. 状态筛选只能降低不匹配设备的亮度，不得隐藏设备、改变设备状态、五类计数、54项身份、证据层或动画。筛选前后五类计数必须逐项相同，匹配数另行披露。
5. “上一异常/下一异常”仅作只读导航，按稳定设备ID顺序在FAULT与UNKNOWN之间循环；独立诊断以后可并列进入导航，但不得产生告警确认、故障复位、远程切换或频率设定。
6. LOD0/LOD1/LOD2只做语义缩放。远景可隐藏非选中文字和调整线宽，但54项一一映射的五态非颜色形状徽标必须全部始终可见，只允许缩放；禁止在LOD1/LOD2隐藏RUNNING、STANDBY或STOPPED字形，SHADOW样式和五类计数也必须保持一致。
7. 当前数据没有权威状态变更时间，因此状态持续时长必须显示`--`。页面暴露 `data-selected-equipment-status-duration="unavailable"` 和 `data-selected-equipment-status-duration-basis="missing-authoritative-changed-at"`，右侧只读检查器显示“无权威 changedAt”。禁止用页面会话开始、`receivedAt`、`generatedAt`、刷新时间或当前时间推算状态持续时长；这些时间也不能冒充`observedAt`或`changedAt`。
8. 根节点暴露 `data-equipment-status-visual="base-lightband-corner-frame-v1"`、筛选值与匹配数、`data-equipment-counts-invariant="PASS/FAIL"`、异常导航和LOD语义缩放合同；每台设备清单暴露形状语义、筛选匹配、独立告警状态和独立诊断状态。所有交互继续保持GET-only和`visualization_only_no_ba_plc_write`。
9. `pointermove` 的hover拾取只能射线检测54个轻量状态标记代理，不得递归检测完整高面数模型；连续鼠标移动必须通过 `requestAnimationFrame` 合并，每个浏览器帧最多执行一次代理射线。
10. 七台主机按 `CH1..CH7` 使用精简状态表达：场景内常驻主机悬浮状态铭牌和3D选中详情卡数量固定为0；保留设备本体轻着色、底座灯带/角框和五态形状徽标；固定状态条仅常驻五态图形与设备号，完整业务状态及独立证据层进入提示和可访问名称。点击设备打开宽360px的非模态只读侧栏，模型区域缩窄并重新拟合；移动端改为底部抽屉。侧栏只有运行概况、趋势、告警诊断和设备档案，控制标签数为0；点击模型空白、关闭按钮或ESC清除选择。所有表达均从同一精确业务状态决策读取，不得用主机本体是否存在旋转动画来推断运行状态。默认3D首屏采用 `tower-left-chiller-center-manifold-right-v5` 与 `reference-angle-bottom-safe-obb-fit-v6`，相机方向向量固定为 `[18,25,34]`：宽屏俯视角约33°，默认HUD压缩为两行安全布局，初始距离系数为0.89、视觉中心按画布高度自适应上移60–96px，使模型较上一版放大约3.9%，塔群位于左侧、七套主机与水泵位于中部、集分水器及负荷支管位于右侧，并为底部设备和状态栏保留安全区；中等宽高比上移12px，移动端采用保守无裁切距离且不做纵向偏移。源模型行位必须为CH1最上、CH7最下，完整设备、外接管和运行状态标记不得被初始相机裁切或被默认HUD/侧栏遮挡。
11. 设备本体状态色使用Three.js运行时材质副本，合同为 `pbr-preserving-selective-light-tint-v1`。只允许轻度混色主机涂装筒体、水泵蓝色泵壳/电机外壳和冷却塔FRP面板；管道、法兰、软接、仪表、橡胶、联轴器罩、转轴和风机转子保持源PBR材质。54台设备必须逐台独立着色，冷却塔按33个风机单元分别显示，禁止用整塔组颜色覆盖单风机故障。运行/待机约10%混色、故障约22%、停机约16%并降饱和、未知约7%；只有故障边框与弱自发光允许慢速脉动。状态筛选只降低不匹配设备涂装外壳亮度，不修改状态、计数、证据或机械动画门禁。不得烘焙进Blend/GLB，不得永久修改共享材质。
12. 3D默认只显示7个随主管真实世界坐标投影的工艺锚点：冷冻供水温度、冷冻回水温度、冷冻干管压差、冷却供水温度、冷却回水温度、室外湿球、冷却塔Approach。有限值缺少权威逐点`observedAt`时标`STALE/SHADOW·时效不可证`，缺值标`UNBOUND`；禁止用站房摘要生成时间升级LIVE。
13. 设备悬停每次最多显示1项核心参数，点击侧栏可显示主机负荷/功率或泵、风机频率/功率/流量。每项必须来自合同设备身份和唯一 `deviceId + tagName`，并独立标注`LIVE/SHADOW/STALE/UNBOUND`；缺点显示`--/UNBOUND`，禁止用 `runtimeSummary.groups`、同组平均或全站汇总回填单台设备。
14. B25“运行监控-冷冻站”的二维场景固定加载 `/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg`，表现为 `physical-scada-2.5d`。静态SVG源文件仍以64个`UNBOUND/--`点位安全起步，交互页面由本地 `PlantOverview2D` 运行态组件加载同一54项身份合同，并与3D共用 `resolvePlantOverviewRuntimeSnapshot`：设备业务五态、参数值、证据等级、机械动画均只接受精确唯一的 `deviceId + tagName`；不得用 `runtimeSummary.groups`、同组平均、页面顶部摘要、模糊名称或数组顺序回填。二维水流继续只标记为`schematic`工艺示意，不得由泵状态推断流量或冒充LIVE。二维场景继续保持`visualization_only_no_ba_plc_write`，切换2D/3D不得解除后端硬阻断。

## 三态展示合同

| 模式 | 证据状态 | 设备机械动画 | 水流动画 | 可否作为运行验收 | 控制权限 |
|---|---|---|---|---|---|
| `LIVE` | `LIVE` | 仅由权威逐点证据启停和调速 | 仅在另有权威瞬时流量证据时允许 | 可以，但必须通过完整双快照审计 | 无，只读 |
| `SHADOW` | 仍为 `STALE` | 可按精确唯一的旧接口运行/频率值启停和调速 | 禁止，保持暂停 | 不可以 | 无，只读 |
| `DEMO` | 保持原 `LIVE/STALE/UNBOUND` | 显式播放资产示意 | 可播放示意水流 | 不可以 | 无，只读 |

`SHADOW` 只在以下条件同时满足时启用：54项身份合同有效；按 `deviceId + tagName` 精确唯一匹配；`pointKey=tagName` 且全局唯一；来源唯一、健康、非fallback；运行值合法；泵/风机频率为0至60且单位严格为 `Hz`；点质量未明确标记为 `BAD`；最近运行摘要收包时间不超过30秒；泵/风机运行位与频率各自 `receivedAt` 精确等于同一顶层收包快照，且可选防重放身份要么两点全缺失、要么 `bootId + scanCycleId` 成对完整并分别精确相同。任一设备缺点只暂停该设备；来源异常或收包超时则全部暂停SHADOW。

SHADOW不得使用模糊名称、数组顺序或聚合组值，不得推断流量、COP或控制状态。SHADOW可按精确唯一的显式运行、故障和远程允许位显示设备四态，但必须标注“时效不可证”；故障位缺失或通信失败仍只能显示`UNKNOWN`。SHADOW动画数量、运行状态和视觉效果均不得计入 `LIVE` 覆盖率或使审计状态变为 `PASS`。

## 验收

1. 数值连续不变两分钟时，成功采集的 `observedAt` 和序号仍持续前进。
2. 断开上游后不再刷新 `observedAt`，权威LIVE在20秒内失效；若只读摘要链仍健康可降级为SHADOW，摘要收包超过30秒后所有SHADOW机械动画必须暂停。
3. 冻结单点只影响其对应设备或派生量，不得把整站误判为新鲜或故障。
4. 时间倒退、未来时间、重复序号、映射冲突均不得进入 `LIVE`。
5. 所有实际驱动动画的点位，已登记 evidence profile、权威时间、质量和唯一映射覆盖率必须为 100%。
6. 至少连续取两个快照验证同boot序号、采集周期和时间单调性；单快照审计不得宣布PASS。
7. 新链路保持 GET/只读，不增加变频给定、阀门命令或任何 BA/PLC 写端点。
8. B25 `/scene/device-command` 必须由后端硬拒绝，底层写服务也必须在调用上游前阻断所有B25别名；不能只依赖3D按钮禁用，切换2D/3D或关闭全局只读模式都不得绕过。
9. LOD0/LOD1/LOD2都必须有54项底座灯带/四角框状态映射，五种业务状态同时具备颜色和始终可见的形状徽标，LOD只能缩放徽标；SHADOW为空心、分段或虚线，只有FAULT状态层发生脉动。
10. 逐一切换运行、故障、待机、停机和未知筛选，未匹配设备只降亮且仍可见，五类计数逐项保持不变；异常导航按稳定设备ID循环，不执行任何告警或设备控制动作。
11. 选中设备必须在非模态只读侧栏显示独立业务状态、逐项参数证据、告警、诊断及状态持续时长。没有权威`changedAt`时持续时长固定为`--/unavailable`，不得从页面或传输时间起算；侧栏不得提供启停、复位、频率设定或任何写入口。
12. 连续触发 `pointermove` 时，每帧最多一次hover射线且目标集合仅含54个轻量状态代理；性能跟踪不得出现对完整GLB根节点的高频递归相交。
13. SHADOW泵/风机运行位与频率必须通过同一 `pointEvidence.receivedAt` 收包快照门禁；任一 `bootId/scanCycleId` 出现后必须成对完整且相同，LIVE则始终强制这两项完整相同。
14. 真实浏览器验收必须读取7个工艺锚点、悬停单值、最多1个侧栏、0个控制标签和侧栏打开后的模型重拟合；空白点击和ESC都必须关闭侧栏，且控制台不得产生BA/PLC写请求。
15. 切换到二维场景后，浏览器必须确认渲染源为本地 `physical-scada-2.5d` SVG，画布完整显示7台主机、14台水泵、6组33台风机、上下分离的集分水器和4个闭环负荷；组件根证据为`runtime-read-only-exact`、绑定方式为`exact-deviceid-tagname-read-only`、流向证据保持`schematic`。逐类核对RUNNING/FAULT/STANDBY/STOPPED/UNKNOWN颜色与非颜色符号，54个设备参数标签显示精确值或`--`及各自证据等级；点击设备打开与3D相同的只读参数侧栏。SHADOW必须显示“时效不可证”，控制台无错误且没有任何BA/PLC写请求。

## 2026-07-18 当前审计真值

审计报告 `b25-runtime-point-evidence-audit-latest.json` 当前为 `BLOCKED_UPSTREAM_POINT_EVIDENCE`。两次快照、来源唯一且健康非fallback、327个 `pointKey`唯一性/标签同一性、Hz单位和209个精确选择器覆盖均通过：运行54/54、故障54/54、远程允许54/54、频率47/47，缺失或歧义0。B25 `evidenceProfileId=null`，327个点中权威时间0个、`GOOD`质量0个、重放证明0个，独立瞬时流量证据仍未绑定，因此正式证据状态必须保持 `STALE`、LIVE覆盖为0且水流动画继续阻断。当前精确旧接口值只允许形成标注“时效不可证”的SHADOW业务四态和RUNNING设备机械动画；不得改变顶层阻断结论，也不得开放任何BA/PLC写入。
