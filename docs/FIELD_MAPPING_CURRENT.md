# FIELD_MAPPING_CURRENT

## 1. 适用范围

本文固定当前仓库已经形成的字段口径，覆盖：

- `dashboard/overview`
- `dashboard/trends`
- `anomalies/summary`
- `anomalies/list`
- `devices/list`
- `devices/tree`
- `devices/{deviceId}`

约束：

- 以 `apps/chiller-bff/openapi/bff-v1.yaml` 为当前对外合同准绳。
- 以 `apps/chiller-bff/openapi/examples/*` 为当前 payload 形状样例。
- 以 `apps/chiller-shell-v1/src/services/bffClient.ts` 与 `apps/chiller-shell-v1/src/i18n/zhCN.ts` 为当前 UI 消费字段和显示名准绳。
- 以 `docs/冷站系统2.0-数据建模-拓扑-v1.md` 为 legacy 数据建模来源准绳。
- 以 `docs/gpt54-fusion-review-v1.md`、`docs/v19.2-master-status.md` 为当前“可签收 / 可演示 / 观察态”背景。

说明：

- “legacy 来源字段”记录当前主来源或聚合来源，不承诺 legacy 内部实现永远不变。
- 个别字段在现有输入里只能定位到 legacy 接口/聚合层，无法落到单一原始 tag；这类字段会明确标注为“聚合”或“推定”。

## 2. 全局共识

### 2.1 共享外层字段

| legacy 来源 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 |
| --- | --- | --- | --- | --- |
| 站点主键/站点名聚合 | `site.siteId` / `site.siteName` | 站点标识 / 站点名 | - | 必填；UI 直接展示，不做前端推断 |
| BFF 聚合生成时间 | `generatedAt` | 生成时间 | ISO 时间 | 必填；仅作响应生成时刻，不替代业务 freshness |
| 上游最近时间戳聚合 | `freshness.latestTimestamp` | 数据新鲜度最近采样 | 时间 | 可为 `null`；UI 显示 `时间未知` 或页面级 stale/warn |
| BFF freshness 判定 | `freshness.stale` | 新鲜度状态 | - | `true/false`；页面按 `fresh/stale/warn` 落文案，不自行重算 |
| BFF freshness 诊断 | `freshness.ageHours` | 数据年龄 | 小时 | 可为 `null`；诊断用，不直接替代业务值 |
| 多来源聚合状态 | `sourceStatus.overall` | 来源状态 | - | 枚举 `ok/partial/failed`；页面按来源状态条统一展示 |
| 各上游来源明细 | `sourceStatus.sources[]` | 来源明细 | - | 允许 `message/error/rows/status` 局部为 `null`；默认只做诊断，不直接业务化 |

### 2.2 当前统一空值与回退规则

1. 数值字段允许 `null` 时，BFF 保留 `null`，UI 统一展示 `--`，禁止前端补 `0` 冒充真实值。
2. 状态字段若暂无稳定语义，优先返回 `unknown` 或文案占位，禁止前端按名称、计数或其他字段反推。
3. 页面可信度统一由 `freshness` 与 `sourceStatus` 判断，不由某个单字段单独承担。
4. `generatedAt` 只表示 BFF 响应生成时刻；设备、告警、趋势是否新鲜，以 `freshness` 为准。
5. 仍处观察态的字段，字段名已稳定，但语义解释不能超出本文备注列。

## 3. Dashboard Overview

### 3.1 业务字段

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `126lnoffice.qstag.coldStationCop`；`zsqy_v1.energy_statistics_hour.type=12`；V1.8 允许 `homeData/energyEfficiency` 快照回退 | `energyCards.currentCop` | 当前 COP | 无量纲 | 缺失返回 `null`；禁止 `NaN/Infinity`；UI 显示 `--` | 字段名稳定；语义已接通，但趋势侧仍属观察项 |
| `126lnoffice.qstag.totalPower`；`zsqy_v1.energy_statistics_hour.type=2`；V1.8 允许快照回退 | `energyCards.totalPowerKw` | 总站功率 | kW | 缺失返回 `null`；可走快照回退；UI 显示 `--` | 当前核心主值 |
| 推定来自 legacy 能效摘要/负荷率聚合 | `energyCards.currentLoadRate` | 当前负荷率 | % | 缺失返回 `null`；UI 显示 `--` | 当前字段名已稳定，legacy 原字段仍待继续固化 |
| `126lnoffice.qstag.totalElectricity`；`electricEnergyOfCoolingStation`；`zsqy_v1.energy_statistics_day.type=34` | `energyCards.totalElectricityKwh` | 今日累计电量 | kWh | 缺失返回 `null`；UI 显示 `--` | 当前页面按累计值解释，不按瞬时功率解释 |
| 推定来自 rule engine / 能效评估聚合 | `energyCards.savingPotentialPct` | 节能潜力 | % | 缺失返回 `null`；UI 显示 `--` | 当前字段名稳定，值允许长期为空 |
| `126lnoffice.qstag.chilledWaterTemperatureDifference`；`zsqy_v1.energy_statistics_hour.type=3` | `energyCards.chilledDeltaT` | 冷冻水温差 | ℃ | 缺失返回 `null`；UI 显示 `--` | 定义为回水 - 供水 |
| `126lnoffice.qstag.chilledOutWaterTemperatureDifference`；`zsqy_v1.energy_statistics_hour.type=4` | `energyCards.coolingDeltaT` | 冷却水温差 | ℃ | 缺失返回 `null`；UI 显示 `--` | 定义为供水 - 回水 |
| `findNewAlarmLog` 最新告警总数聚合；可被 `anomalies/summary.counts.total` 覆盖 | `energyCards.activeAnomalyCount` | 当前异常数 | 项 | 缺失返回 `null`；Dashboard 优先取 `anomalies/summary.counts.total`，否则回退该字段 | 允许与告警摘要保持单一口径 |
| `drinfo/drtypeinfo` 设备资产聚合 | `deviceSummary.totalDevices` | 设备总数 | 项 | 必填；无值时视为上游失败，不由前端猜测 | 设备摘要主口径 |
| `drinfo/drtypeinfo` 类型聚合 | `deviceSummary.chillerCount` | 冷机数量 | 项 | 必填 | 同上 |
| `drinfo/drtypeinfo` 类型聚合 | `deviceSummary.chilledPumpCount` | 冷冻泵数量 | 项 | 必填 | 同上 |
| `drinfo/drtypeinfo` 类型聚合 | `deviceSummary.coolingPumpCount` | 冷却泵数量 | 项 | 必填 | 同上 |
| `drinfo/drtypeinfo` 类型聚合 | `deviceSummary.coolingTowerCount` | 冷却塔数量 | 项 | 必填 | 当前塔相关口径仍含 `CTF/CTE/CTHDE` 背景 |
| `qsAlarmlog` + severity 归一化聚合 | `alarmSummary.total` | 告警总数 | 项 | 必填 | Dashboard 实时状态区使用 |
| `qsAlarmlog` + severity 归一化聚合 | `alarmSummary.high` | 高等级告警 | 项 | 必填 | Dashboard 内部统计仍保留 `high/medium/low` 摘要层，不等同 anomalies 四档对外枚举 |
| `qsAlarmlog` + severity 归一化聚合 | `alarmSummary.medium` | 中等级告警 | 项 | 必填 | 同上 |
| `qsAlarmlog` + severity 归一化聚合 | `alarmSummary.low` | 低等级告警 | 项 | 必填 | 同上 |

### 3.2 当前未外放但已在建模文档定义的字段

以下字段已在数据建模文档里存在，但当前 `dashboard/overview` 未对外暴露，暂不进入 UI 合同：

- `running_device_count`
- `alarm_device_count`
- `station_cooling_capacity_kw`
- `station_heat_rejection_kw`
- `thermal_unbalance_rate_pct`

处理原则：

- 不提前塞入当前合同。
- 需要时由 BFF 新增稳定字段后再纳管。
- 禁止前端用现有计数字段拼接代替。

## 4. Dashboard Trends

### 4.1 趋势外层字段

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| UI 查询条件 | `range` | 时间范围 | - | 枚举 `24h/7d/30d`；非法值不入合同 | 页面范围切换唯一来源 |
| 趋势聚合时间序列 | `series[].metric` | 指标键 | - | 必填 | 当前稳定支持 `totalPowerKw/currentCop/chilledDeltaT/coolingDeltaT` |
| 趋势聚合展示名 | `series[].label` | 指标标题 | - | 必填 | UI 可本地化，但不改 `metric` |
| 时序点时间 | `series[].points[].t` | 采样时间 | ISO 时间 | 必填 | 趋势轴使用 |
| 时序点数值 | `series[].points[].v` | 采样值 | 随指标 | 允许 `null`；图表保留空点/空线，不补值 | 图表层可降级为空序列 |
| 统计聚合 | `stats[].metric/latest/min/max` | 最新/最小/最大 | 随指标 | 允许 `null`；UI 显示空统计，不补值 | 与图表同一指标键对齐 |

### 4.2 当前稳定指标映射

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `getEnergyStatisticsCurve` / `getEquipmentEnergyStatisticsCurve` 聚合总站功率 | `series[metric=totalPowerKw]` / `stats[metric=totalPowerKw]` | 总站功率 | kW | 缺失时该序列可为空；页面仍可展示其它序列 | 当前趋势主序列 |
| `station_cop` 主来源；V1.8 允许 overview 快照单点回退 | `series[metric=currentCop]` / `stats[metric=currentCop]` | 冷站 COP | 无量纲 | 缺失返回空序列或空统计；不补 `0`；overview 可单点回退 | 当前“字段已纳管、语义继续观察” |
| `chilled_delta_t_c` 主来源 | `series[metric=chilledDeltaT]` / `stats[metric=chilledDeltaT]` | 冷冻水温差 | ℃ | 允许空序列与空统计；UI 显示 noSeries/noStats | 当前可演示，不以空序列判失败 |
| `cooling_delta_t_c` 主来源 | `series[metric=coolingDeltaT]` / `stats[metric=coolingDeltaT]` | 冷却水温差 | ℃ | 同上 | 当前可演示，不以空序列判失败 |

## 5. Anomalies Summary

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `findNewAlarmLog` + `getAllSubsystemInfo` 聚合 | `counts.total` | 总告警数 | 项 | 必填 | 告警页正式签收口径 |
| legacy severity 映射 | `counts.critical` | 紧急告警 | 项 | 必填 | 对外 severity 已统一为四档 |
| legacy severity 映射 | `counts.major` | 严重告警 | 项 | 必填 | 同上 |
| legacy severity 映射 | `counts.minor` | 一般告警 | 项 | 必填 | 同上 |
| legacy severity 映射 | `counts.normal` | 正常告警 | 项 | 必填 | 同上 |
| `qsAlarmlog.id` | `latestEvents[].id` | 告警 ID | - | 缺失时仅允许 UI 临时 key，不允许详情跳转 | 当前已纳管稳定主键 |
| `qsAlarmlog` 标题/归一化标题 | `latestEvents[].title` | 告警事件 | - | 缺失显示 `告警事件` | 当前多数样例仍为通用标题 |
| `alarmLevel + 映射规则` | `latestEvents[].severity` | 告警等级 | - | 必填；枚举 `critical/major/minor/normal` | 已完成对外收口 |
| legacy state 原值 | `latestEvents[].state` | 原始状态码 | - | 允许 `null`；默认不直接业务化 | 保留诊断语义 |
| `qsAlarmlog.occurredAt` | `latestEvents[].occurredAt` | 发生时间 | 时间 | 允许 `null`；UI 显示 `时间未知` | 事件主时刻 |
| `qsAlarmlog` 来源描述 | `latestEvents[].source` | 来源 | - | 缺失显示 `未知来源` | 当前样例可能为 `Unknown` |
| `reg.drid/regid` 关联 | `latestEvents[].regId` | 点位/寄存器引用 | - | 允许 `null` | 用于诊断，不直接做 UI 主展示 |
| `qsAlarmlog.value` | `latestEvents[].value` | 原始值 | - | 允许 `null` | 诊断字段 |
| 告警链路诊断 | `diagnosisFlags.staleAlarmFeed` | 告警流陈旧 | - | 必填 | 仅作诊断 flag |
| 告警链路诊断 | `diagnosisFlags.missingHighSeverity` | 高等级缺失 | - | 必填 | 仅作诊断 flag |

## 6. Anomalies List

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 同 `Anomalies Summary` 主来源 | `items[].id/title/severity/state/occurredAt/source/regId/value` | 告警列表行字段 | - | 与 summary 相同；允许分页下空列表 | 列表与 recent feed 共用同一四档 severity 口径 |
| BFF 分页聚合 | `page` / `pageSize` / `total` | 页码 / 每页条数 / 总数 | - | 必填；前端不自行估算总页数 | 当前页默认 `page=1`、`pageSize=20` |
| 查询过滤回显 | `filters.severity` | 告警等级筛选 | - | 可为 `null` | 枚举仍是四档 |
| 查询过滤回显 | `filters.state` | 原始状态筛选 | - | 可为 `null` | legacy 透传语义，仅作辅助筛选 |

## 7. Devices List

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `drinfo.drid` | `items[].deviceId` | 设备 ID | - | 必填；禁止前端用数组下标代替 | 当前稳定主键 |
| `drinfo.drcode` | `items[].deviceCode` | 设备编码 | - | 必填 | 如 `CH1`、`BGS01` |
| `drinfo.drname` | `items[].deviceName` | 设备名称 | - | 必填 | 列表主展示字段 |
| `drtypeinfo.drTypeCode/drtypename/typeYT` 归一化 | `items[].systemType` | 系统类型 | - | 必填；枚举 `chiller/chilledPump/coolingPump/coolingTower/other` | `other` 当前合法，仍属范围观察项 |
| `drinfo` 楼层信息 | `items[].floorName` | 楼层 | - | 必填；缺失显示 `未知` | 当前过滤字段之一 |
| `drinfo` 楼栋信息 | `items[].buildingName` | 楼栋 | - | 必填；缺失显示 `未知` | 当前列表展示字段 |
| `drinfo` 用途/类别 | `items[].usageType` | 用途分类 | - | 必填；缺失显示 `未知` | 首屏列表不强依赖，但已纳管 |
| `drinfo` 图标资源 | `items[].iconPath` | 图标 | - | 允许 `null`；UI 可退到无图标态 | 资源字段 |
| 设备运行态简化归一化 | `items[].status` | 在线状态 | - | 必填；当前允许 `unknown`；禁止前端拆成运行/报警双状态 | 当前字段名稳定、语义继续观察 |
| 设备最近上报时间 | `items[].lastReportAt` | 最近上报 | 时间 | 允许 `null`；页面显示 `时间未知`；不承担页面 freshness | 当前 live 常见为 `null` |
| 请求回显 | `filters.type` | 系统类型筛选 | - | 可为 `null` | 与 `systemType` 枚举一致 |
| 请求回显 | `filters.floor` | 楼层筛选 | - | 可为 `null` | 与 `floorName` 语义一致 |

## 8. Devices Tree

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| legacy tree 根节点 | `tree.id` / `tree.label` | 根节点 ID / 名称 | - | `tree` 可整体为 `null`；UI 显示空树态 | 失败态必须稳定为合同定义 |
| legacy tree 层级归一化 | `tree.nodeType` / `children[].nodeType` | 节点类型 | - | 必填；枚举 `root/group/device/point` | 禁止前端按 children 有无猜类型 |
| legacy tree 父子关系 | `parentId` / `children[]` / `childCount` | 父节点 / 子节点 / 下级数 | 项 | `children` 必为数组；`childCount` 必填 | 树导航主结构 |
| `drinfo.drid` join tree | `deviceIdRef` | 设备引用 | - | 可为 `null`；point 节点允许复用设备引用 | 树到详情跳转键 |
| `drinfo.drcode` | `deviceCode` | 设备编码 | - | 可为 `null` | point/root/group 节点可为空 |
| `drinfo.drname` / 点位名 | `deviceName` / `label` | 设备名 / 节点名 | - | 可为 `null`；UI 退到 `label` | 设备与点位展示名分离 |
| `drinfo/drtypeinfo` 归一化 | `systemType` | 系统类型 | - | 可为 `null` | point/root/group 节点允许空 |
| `drinfo` 位置属性 | `floorName` / `buildingName` | 楼层 / 楼栋 | - | 可为 `null` | point 节点允许空 |
| 树节点状态简化 | `status` | 节点状态 | - | 必填；允许 `unknown` | 当前树状态已纳管但仍属观察项 |
| 树节点最近上报 | `lastReportAt` | 最近上报 | 时间 | 允许 `null` | 不替代整体 freshness |
| 查询回显 | `filters.build` / `filters.floor` | 楼栋过滤 / 楼层过滤 | - | 必填 | 当前默认 `1/1` |

## 9. Device Detail

| legacy 来源字段 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `drinfo.drid` | `detail.deviceId` | 设备 ID | - | 必填 | 详情主键 |
| `drinfo.drcode` | `detail.deviceCode` | 设备编码 | - | 必填 | 详情抬头副标题 |
| `drinfo.drname` | `detail.deviceName` | 设备名称 | - | 必填 | 详情抬头主标题 |
| `drtypeinfo.drTypeCode` | `detail.deviceTypeCode` | 设备类型编码 | - | 允许 `null`/空串；UI 不以此阻断详情展示 | 当前可观察但不阻断演示 |
| `drtypeinfo.drtypename` | `detail.deviceTypeName` | 设备类型 | - | 允许 `null`；UI 显示 `待补齐` 或退到列表 systemType | 当前详情首屏主类型字段 |
| `drinfo` 位置属性 | `detail.floorName` / `detail.buildingName` | 楼层 / 楼栋 | - | 必填；缺失显示 `未知` | 静态主数据 |
| `drinfo` 用途分类 | `detail.usageType` | 用途分类 | - | 必填；缺失显示 `未知` | 与列表同口径 |
| `drinfo` 图标资源 | `detail.iconPath` | 图标 | - | 允许 `null` | 资源字段 |
| `drinfo.typeYT` | `detail.isVirtual` | 虚拟设备 | - | 允许 `null`；UI 显示 `待补齐/是/否` | 详情已纳管 |
| `reg + qstag + subinfo` 运行态增强 | `detail.runStatusText` | 运行状态 | - | 允许 `null`；UI 显示 `待补齐`；禁止由列表 `status` 反推 | 当前已接通，可继续观察稳定性 |
| `reg + qstag + subinfo` 报警态增强 | `detail.alarmStatusText` | 告警状态 | - | 允许 `null`；UI 显示 `待补齐` | 当前已接通，可继续观察稳定性 |
| 设备关键点最近更新时间 | `detail.latestUpdateAt` | 最近上报 | 时间 | 允许 `null`；UI 显示 `时间未知/待补齐` | 设备级 freshness 下沉字段 |
| tree join | `detail.treeNodeType` | 树节点类型 | - | 允许 `null` | 详情定位树语义 |
| tree join | `detail.treeChildCount` | 下级节点数 | 项 | 允许 `null` | 详情结构字段 |
| runtime/tree 聚合 | `detail.pointCount` | 点位数量 | 项 | 允许 `null` | 详情结构字段 |

## 10. 当前稳定性判断

### 10.1 已足够稳定的部分

- 字段名稳定：`overview/trends/anomalies/devices` 当前对外字段名已形成统一 BFF 合同。
- 四档告警 severity 稳定：`critical/major/minor/normal`。
- 设备主键体系稳定：`deviceId/deviceCode`、`tree.deviceIdRef`、`detail.deviceId` 已能互相对齐。
- 页面可信度判定稳定：统一走 `freshness + sourceStatus`。

### 10.2 仍需继续观察但不阻断当前治理文档的部分

- `energyCards.currentLoadRate`
- `energyCards.savingPotentialPct`
- `trends.currentCop` 的长期语义稳定性
- `devices/list.status` 与 `devices/tree.status` 的在线语义
- `devices/list.lastReportAt` 的实际可用度
- `detail.deviceTypeCode` 的完整性

结论：

- 当前字段口径已足够作为“渐进融合阶段”的统一引用基线。
- 观察项继续保留在备注列，不影响当前文档生效。

## 11. 扩展字段附录

以下字段当前不属于核心页面迁移主合同，但已经进入治理态或正式入口态，适合纳入扩展附录统一维护。

### 11.1 Login 会话字段

| legacy 来源字段 | Shell 会话字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `/user/login` 返回 `user.username` | `auth.username` | 当前用户 | - | 必填；缺失则视为登录失败 | 当前顶栏展示字段 |
| `/user/login` 返回 `token` | `auth.token` | 认证令牌 | - | 必填；只用于本地 session 持有，不直接展示 | 当前保存在 `chiller-shell-auth-v1` |
| shell 登录时间 | `auth.loginAt` | 登录时间 | ISO 时间 | 必填 | 本地生成，不来自 legacy |

### 11.2 Optimize Draft 字段

| 聚合/规则来源 | BFF 对外字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| draft 聚合说明 | `decision.summary` | 草案摘要 | - | 必填；未实现阶段也需返回解释型摘要 | 当前 `/optimize-demo` 主展示字段 |
| 规则评估稳定度 | `decision.confidence` | 草案置信度 | - | 必填；枚举由 draft service 控制 | 当前为治理态置信度，不代表真实优化精度 |
| rule-based draft steps | `recommendation.steps[]` | 建议步骤 | - | 可为空数组；前端不补造动作 | 仅用于草案演示 |
| 上下文诊断聚合 | `diagnostics` | 诊断摘要 | - | 允许局部为空；不阻断 demo | 当前依赖 overview/anomalies/recommendations 聚合 |

### 11.3 场景页复用设备上下文字段

| legacy/BFF 来源字段 | Shell 复用字段 | UI 显示名 | 单位 | 空值/回退策略 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `devices/list.items[].deviceId` | `sceneContext.deviceId` | 设备 ID | - | 可为空；无设备时不渲染联动入口 | 场景页到设备页深链接键 |
| `devices/list.items[].floorName` | `sceneContext.floorName` | 楼层 | - | 必填；缺失退回当前场景楼层 | 用于场景页同楼层设备侧栏 |
| `devices/{deviceId}.detail.runStatusText` | `sceneContext.runStatusText` | 运行状态 | - | 允许 `null`；UI 显示 `待补齐` | 当前场景页只做上下文展示，不下发控制 |
| `devices/{deviceId}.detail.alarmStatusText` | `sceneContext.alarmStatusText` | 告警状态 | - | 允许 `null`；UI 显示 `待补齐` | 同上 |

## 12. 当前唯一事实源说明

当前字段口径相关结论，统一按以下优先级引用：

1. 核心对外字段：本文
2. 对外接口与 schema：`docs/API_SURFACE_CURRENT.md` 与 `apps/chiller-bff/openapi/bff-v1.yaml`
3. 页面状态：`docs/MIGRATION_STAGE_CLOSEOUT_CURRENT.md`
4. 运行态变更过程：`docs/v19.2-master-status.md`
