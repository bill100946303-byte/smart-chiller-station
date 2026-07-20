# 冷站数字孪生模型工程合同

## 权威设备源

| 类型 | 源 Blend | Blender Collection | 总览数量 |
|---|---|---|---:|
| 离心式冷水机组 | `apps/chiller-shell-v1/public/models/chiller/source/blender/chiller-centrifugal-generic-v1.blend` | `CHILLER_CENTRIFUGAL_GENERIC` | 7 |
| 横流冷却塔 | `apps/chiller-shell-v1/public/models/cooling-tower/source/blender/cooling-tower-crossflow-generic-v1.blend` | `COOLING_TOWER_CROSSFLOW_GENERIC` | 33个单风扇塔单元，6组 `[6,6,6,6,6,3]` |
| 水平中开泵 | `apps/chiller-shell-v1/public/models/pump/source/blender/pump-horizontal-split-case-generic-v1.blend` | `PUMP_HORIZONTAL_SPLIT_CASE_GENERIC` | 14（7冷冻泵+7冷却泵） |
| PLC控制柜 | `apps/chiller-shell-v1/public/models/plc-control-cabinet/source/blender/plc-control-cabinet-generic-v1.blend` | `PLC_CONTROL_CABINET_GENERIC` | 1 |
| 电磁阀 | `apps/chiller-shell-v1/public/models/solenoid-valve/source/blender/solenoid-valve-flanged-dn50-generic-v1.blend` | `SOLENOID_VALVE_GENERIC` | 4 |
| 压力表 | `apps/chiller-shell-v1/public/models/pressure-gauge/source/blender/pressure-gauge-radial-dn100-generic-v1.blend` | `PRESSURE_GAUGE_GENERIC` | 2 |
| 温度计 | `apps/chiller-shell-v1/public/models/temperature-gauge/source/blender/temperature-gauge-bimetal-dn100-generic-v1.blend` | `TEMPERATURE_GAUGE_GENERIC` | 2 |
| 集水器/分水器 | `apps/chiller-shell-v1/public/models/supply-return-manifold/source/blender/supply-return-manifold-four-branch-generic-v1.blend` | `SUPPLY_RETURN_MANIFOLD_GENERIC` | 2 |
| 冷却水自动加药机组 | `apps/chiller-shell-v1/public/models/cooling-water-dosing-skid/source/blender/cooling-water-automatic-dosing-skid-generic-v1.blend` | `COOLING_WATER_AUTOMATIC_DOSING_SKID_GENERIC` | 0（独立资产，尚未接入当前总览） |
| 定压补水机组 | `apps/chiller-shell-v1/public/models/pressurization-water-makeup-skid/source/blender/pressurization-water-makeup-skid-generic-v1.blend` | `PRESSURIZATION_WATER_MAKEUP_SKID_GENERIC` | 0（独立资产，尚未接入当前总览） |
| 湿式压差变送器 | `apps/chiller-shell-v1/public/models/differential-pressure-transmitter/source/blender/differential-pressure-transmitter-wet-wet-generic-v1.blend` | `DIFFERENTIAL_PRESSURE_TRANSMITTER_GENERIC` | 0（独立资产，尚未接入当前总览） |

清单真值为 `apps/chiller-shell-v1/public/models/model-manifest-v1.json`。总览必须记录其中实际实例化源文件的 SHA-256；组件修改后重新生成总览，不得复用旧哈希报告。尚未实例化到总览的独立资产只执行自身生成、GLB回导和最终资产清单审计，不得虚构总览源哈希或改动B25设备计数。

## 生成与校验入口

- 总览生成：`output/blender/generate_chilled_water_plant_overview_latest_v2.py`
- GLB回导：`output/blender/validate_chilled_water_plant_overview_latest_v2.py`
- LOD生成：`output/blender/generate_chilled_water_plant_overview_lod.py`
- 环绕渲染：`output/blender/render_chilled_water_plant_overview_latest_v2_orbit.py`
- 最终审计：`output/blender/audit_final_model_suite_v2.py`
- 冷却水自动加药机组生成：`output/blender/generate_cooling_water_automatic_dosing_skid_generic_v1.py`
- 冷却水自动加药机组GLB回导：`output/blender/validate_cooling_water_automatic_dosing_skid_generic_v1.py`
- 定压补水机组生成：`output/blender/generate_pressurization_water_makeup_skid_generic_v1.py`
- 定压补水机组GLB回导：`output/blender/validate_pressurization_water_makeup_skid_generic_v1.py`
- 湿式压差变送器生成：`output/blender/generate_differential_pressure_transmitter_generic_v1.py`
- 湿式压差变送器GLB回导：`output/blender/validate_differential_pressure_transmitter_generic_v1.py`

单设备使用同目录下对应的 `generate_*_generic_v1.py` 与 `validate_*_generic_v1.py`。设备模型发生变化时，先完成设备自身生成和回导，再运行总览完整流水线。

## 管路与接口约束

- 冷冻水进出水位于主机同一侧并水平成对布置；冷却水进出水位于另一侧并水平成对布置。
- 水泵主轴与进出水口中心线成90度；泵安装旋转角为 `-90°`，吸排口位于同一水平轴线。
- 只有连接该泵真实吸、排水口的工艺管允许进入水泵设备包络。无连接关系的工艺管、辅助管和控制管必须绕开泵轴、联轴器、电机和泵壳完整可见包络，管外表面净距不小于0.30 m；源 Blend 按真实Bezier中心线验算，GLB和LOD回导后按管道网格实体独立复算。
- 一组冷却塔包含多台风机单元时，组内单元沿世界 `X` 轴排列且共享同一 `Y` 坐标；不同塔组沿世界 `Y` 轴分组。当前B25布局为6组，风机单元数依次为 `[6,6,6,6,6,3]`；少于6台的组必须沿同一组中心X坐标对称布置，不得填充虚构设备。
- 七套“冷却泵—主机—冷冻泵”按设备号成套排序：`CH1/CWP1/CHWP1` 位于世界 `Y` 最大端，随后编号递增且 `Y` 严格递减，`CH7/CWP7/CHWP7` 位于世界 `Y` 最小端。默认正面斜视首屏必须显示为1号机排最上、7号机排最下；不得只用UI列表掩盖源模型行位颠倒。
- 集水器、分水器沿纵向同一行布置，设备分开，支管分别走独立平面走廊，禁止汇聚堆叠。
- 集水器/分水器端口以组件源 Blend 的绑定节点为权威：保留局部 `Y=-0.38/+0.38 m` 的真实设备偏移，通过实例根节点补偿使两台设备实际轴线位于同一纵向行；禁止在总览中把端口偏移归零。
- 拆分集水器/分水器原型时必须保留源模型坐标，不得再次以单台设备轴线重设原点；接口验收必须同时检查端点坐标、曲线端部切线和可见法兰面。主口按源模型水平轴向连接，8个支口沿 `+Z` 轴连接；端口到真实法兰面不超过5 mm，轴线夹角不超过2°，支口转向前的直管颈不短于0.30 m。
- 优化管路不得保留尖锐90度弯头；使用Bezier顺水曲线或135度转向。
- 设备侧接管保持原接口标高；只有进入干管过渡区后才允许抬升回水管。当前冷却水回水干管标高为1.30 m，冷冻水回水干管标高为1.33 m，供水干管分别保持0.80 m和0.83 m。
- 除声明的三通、汇流点或设备接口外，管道实体不得相交。按实际Bezier中心线最短距离减去两管半径计算净距；当前55组交叉风险对最小净距为0.02 m。
- 冷却塔均衡支管必须接触塔体接口表面，不允许可见净间隙。
- 软接、流量计、压力和温度测点必须吸附到实际曲线中心线，并按管线切向旋转直通附件。

## 冷却水自动加药机组约束

- 通用资产采用双药箱、双隔膜计量泵、双搅拌器、双标定柱、1套水质采样面板和1套PLC/HMI控制柜的撬装结构；A/B吸液和出药管必须全程独立，不得在撬内合并或交叉。
- 外部连接固定为6个工艺口和2个电缆口：冷却水采样入口、采样回水、A剂出口、B剂出口、稀释/冲洗水入口、公共排水、动力电缆和通信电缆。每个端口必须写明局部坐标、法向、规格和语义角色。
- 8个外部端口必须同时校验节点到可见接头端面误差和实体轴线夹角；端面误差≤0.005m、轴线夹角≤2°，源Blend与GLB回导均独立复算。
- 运行时至少保留药箱液位、计量泵状态/冲程、搅拌器状态/频率、电导率、pH、ORP、采样流量、自动模式和公共故障等只读绑定；初始证据状态为`UNBOUND`，禁止增加BA/PLC写入口。
- 内嵌4个实际可动部件动画：2个搅拌轴旋转和2个计量泵膜片杆往复；GLB回导必须保持4个动画对象和4条轨道。动画只用于资产示意或合格运行证据驱动，不得据此推断现场运行状态。
- 不建可识别的外置隔离阀、止回阀和Y型过滤器；三类禁用附件数量保持0。该资产未取得现场P&ID和设备样本前，只是通用工程构型，不得声明为B25现场几何真值。

## 定压补水机组约束

- 通用资产采用1只立式隔膜定压罐、2台立式多级补水泵（一用一备）、1套PLC/HMI控制柜、1只机械压力表、1只压力变送器和1套低水位保护的撬装结构；软化水箱或自来水源保持为外部边界，未取得现场P&ID前不得虚构水源配置。
- 两台补水泵的吸、排水口必须位于同一水平中心线并沿世界`Y`轴相反方向布置；公共吸水和排水干管沿世界`X`轴分开走管，定压罐底部支管使用平滑顺水曲线接入排水干管，禁止尖锐90度弯头、管线堆叠和非连接交叉。
- 外部连接固定为4个工艺口和2个电缆口：DN40补水入口、DN50定压补水至系统出口、DN25泄压排放预留口、DN25公共排水、动力电缆和通信电缆。模型只预留泄压排放接口，不建可识别的安全阀；现场泄压、防倒流和检修隔离必须以后续P&ID为准。
- 6个外部端口必须写明局部坐标、向外法向、规格和语义角色，并同时校验节点到可见接头端面误差和实体轴线夹角；端面误差≤0.005m、轴线夹角≤2°，源Blend与GLB回导均独立复算。
- 运行时至少保留系统压力、压力目标回读、吸排水压力、瞬时与累计补水量、定压罐压力/预充压力、低水位保护、自动模式、公共故障和A/B泵运行/故障/频率/电流/可用状态等30项只读绑定；当前模型为36项，全部按唯一`deviceId + tagName`读取并以`UNBOUND`安全起步。压力目标只允许作为PLC设定值回读，不得增加启停、复位、设压或频率写入口。
- 内嵌2个实际可动部件动画：A/B补水泵各1根真实驱动轴及非对称橙色指示片；静止电机外壳和联轴器防护件不得旋转。GLB回导必须保持2个动画对象和2条轨道。隔膜只预留运行时数据驱动节点，不制作循环压力动画。
- 资产包络目标约3.35×1.70×2.25m，三角面数30,000至120,000，GLB不超过6MiB；不建品牌Logo或可识别厂商铭牌，不建外置隔离阀、止回阀和Y型过滤器，三类禁用附件数量保持0。
- 该资产保持`standalone_asset_not_installed_in_current_overview`，不得改变B25的65个设备实例、54项核心绑定、132个2D/3D工艺端口、总览源哈希或动画计数。未取得现场P&ID和设备样本前，它只是通用工程构型，不得声明为B25现场几何真值。

## 湿式压差变送器约束

- 通用资产采用湿-湿差压传感结构：1套压差变送器、1套双腔感压膜盒、1只带本地显示的电子表头和1套304不锈钢安装支架；默认名义量程0至160 kPa、最大静压1.6 MPa，仅作建模参数，不代表现场最终选型。
- 外部连接固定为2个过程口和1个电缆口：`PORT_PROCESS_HIGH`高压侧H、`PORT_PROCESS_LOW`低压侧L和`PORT_CABLE_POWER_SIGNAL`的M20×1.5合并24VDC+4–20mA/HART电缆口。H/L中心距固定为54 mm、Y/Z坐标一致，并同时使用凸起字母和红/蓝识别环，禁止只靠颜色区分。
- 3个外部端口必须写明局部坐标、向外法向、规格和语义角色；端口节点到真实可见接头端面误差≤0.005m、节点法向与接头实体轴线夹角≤2°，源Blend与GLB回导均独立复算。验证器还必须检查H/L位置、字母和识别环没有互换。
- 运行时固定保留16项只读绑定，包括压差、4–20mA输出、量程/阻尼回读、传感器温度、供电电压、设备健康、传感器/回路故障、超量程、维护需求及可选H/L单侧压力。所有节点按唯一`deviceId + tagName`读取并以`UNBOUND`安全起步；单侧压力缺失时保持`UNBOUND`，不得由压差反推。量程和阻尼只允许作为回读，不增加校零、设程、复位或其他写入端点。
- 该设备无正常连续运动机构，内嵌动画对象和轨道固定为0/0；本地显示值变化只能由Three.js只读运行时文本或设备检查器表达，不得制作假指针摆动、压力脉动或常亮闪烁灯冒充现场状态。
- 资产包络目标约0.270×0.160×0.300m，验收范围为X=0.24至0.30m、Y=0.14至0.18m、Z=0.27至0.33m；三角面数30,000至80,000，GLB不超过3MiB。
- 不建品牌Logo、隔离阀、止回阀、Y型过滤器、三阀组、五阀组、均压阀、外接引压管或可写操作件，所有禁用计数保持0。资产必须保持`standalone_asset_not_installed_in_current_overview`和`read_only_digital_twin_no_BA_or_PLC_write`，不得改变B25的65个设备实例、54项核心绑定、132个2D/3D工艺端口、63条总览动画轨道、总览源哈希或无BA/PLC写入边界。

## 当前验收合同

| 指标 | 要求 |
|---|---:|
| 正式模型清单条目 | 12 |
| Public GLB文件 | 14（含总览LOD0/LOD1/LOD2） |
| 权威源Blend文件 | 12 |
| 设备实例 | 65 |
| B25核心设备绑定 | 54（7主机+14水泵+33风机） |
| 2D/3D工艺端口 | 132 |
| 设备/端口主接口检查 | 140 |
| 干管/支管接口检查 | 151 |
| 冷却塔均衡接口检查 | 33 |
| 中心线吸附附件 | 126 |
| 接口容差 | ≤ 0.005 m |
| 集/分水器源端口检查 | 10 |
| 集/分水器端口轴线夹角 | ≤ 2° |
| 集/分水器支口直管颈检查 | 8 |
| 集/分水器支口最短直管颈 | ≥ 0.30 m |
| 集/分水器真实法兰面检查 | 10 |
| 集/分水器端口到法兰面误差 | ≤ 0.005 m |
| 管道实体净距检查 | 55 |
| 管道实体净距违规 | 0 |
| 独立管道最小实体净距 | ≥ 0.02 m |
| 非泵接管至泵轴/电机/泵壳包络检查 | 14（7条冷却回水+7条冷冻回水） |
| 非泵接管泵体包络违规 | 0 |
| 非泵接管至完整泵体包络最小净距 | ≥ 0.30 m |
| 工程附件根节点 | 143 |
| 拓扑边 | 118 |
| 外部边界端口 | 12 |
| 运行时动画目标 | 62 |
| 业务状态标记 | 54，LOD0/LOD1/LOD2一一对应且计数不变 |
| LOD五态形状徽标 | 54，LOD0/LOD1/LOD2始终可见，只允许缩放 |
| 主机常驻场景悬浮铭牌 | 0，禁止遮挡设备与动画 |
| 主机精简状态条 | 7，CH1至CH7固定顺序，仅常驻五态图形与设备号，完整状态和证据进入提示/可访问名称 |
| 3D选中详情卡 | 0，设备详情统一进入非模态右侧只读检查器 |
| 工艺数据锚点 | 7，按主管真实世界坐标投影；有限值无权威observedAt时标STALE，缺值标UNBOUND |
| 设备悬停参数 | 每次最多1项，只允许精确设备核心参数，不用组值或全站值回填 |
| 设备检查器 | 宽360px，运行概况/趋势/告警诊断/设备档案；控制标签数0，移动端为底部抽屉 |
| 选中设备详情卡 | 最多1张；点击模型空白处清除选择 |
| 主机行位顺序 | `CH1→CH7` 沿世界 `Y` 严格递减；默认首屏CH1最上、CH7最下 |
| 业务状态主视觉 | 设备底座灯带+四角定位框；悬浮圆圈不得作为唯一主表达 |
| hover射线检测 | 仅54个轻量状态标记代理，`requestAnimationFrame`每帧最多1次 |
| 状态筛选 | 仅降低未匹配设备亮度；五类计数、业务状态和证据保持不变 |
| 状态时长 | 无权威 `changedAt` 时固定为 `unavailable`，可见值为 `--` |
| 业务状态选择器 | 162（54运行+54显式故障+54远程） |
| 运行时唯一选择器 | 209（162业务状态+47频率） |
| 水泵旋转高对比标记 | 14（每根泵轴1个，位于静止防护罩外侧的数字孪生动画层并随轴转动） |
| 内嵌动画对象/轨道 | 63/63（33风机转子+14泵轴+8负荷侧中心线短光段+8四类主管中心线短光段） |
| 水流动画表现 | 16个贴近管外表面的Bezier中心线短光段；旧式套管圆环为0 |
| 隔离阀 | 0 |
| 止回阀 | 0 |
| Y型过滤器 | 0 |

当前工程附件组成：56个软接、56个温压探头、14个流量计、8个边界法兰、4个自动排气、4个低点排水和1个旁流水处理装置，共143个工程附件根节点。其中126个软接/温压探头/流量计必须通过真实中心线吸附检查。

若用户明确改变设备数量或附件范围，必须同时更新生成器、回导验证、最终审计、模型清单及本合同。不要通过删除检查或扩大容差让旧合同虚假通过。

## B25身份映射与权威边界

- 绑定合同真值路径为 `apps/chiller-shell-v1/public/models/plant-overview/bindings/b25-plant-overview-binding-v2.json`，必须有54项唯一核心映射：`chillers=7`、`chilledPumps=7`、`coolingPumps=7`、`coolingTowers=33`。`CHWP1..7` 到 `CHP1..7` 只允许在合同中显式声明别名；塔单元 `CT01..33` 必须逐项映射到B25 `CTFxx`。
- 合同必须保持 `authoritative=false`、`authority.identity=true`、`authority.telemetry=false`、`authority.geometryTopology=false`以及 `controlBoundary=visualization_only_no_ba_plc_write`。设备身份对应可作为只读真值；管网拓扑和管道路由未经B25现场P&ID/竣工图复核，仍是数字孪生演示几何，禁止对外声称权威。
- B25运行摘要只有请求 `generatedAt`而没有逐点权威 `observedAt`时，有限值标 `STALE/时效不可证`，空值标 `UNBOUND`，不得标 `LIVE`。可显式进入 `SHADOW` 展示模式，但它不是证据状态：只允许精确唯一点位的设备机械动画，收包TTL不超过30秒，水流保持暂停，不计入运行验收。冷却塔组状态由同组子风机 `any(running)` 和运行风机频率平均值只读派生；禁止用单个最后风机值覆盖整组。
- B25当前旧实时接口的数值型 `tagTime` 是存储周期配置，不是绝对采样时间。单点 `observedAt`、质量码和防重放三元组只能由服务端代码登记并已做现场绑定验收的 `evidenceProfileId` 解码；payload自报OPC UA、`timestampBasis`或`GOOD`均不构成信任。PLC/OPC UA `sourceTimestamp`默认只作为`changedAt`，BFF `generatedAt/fetchedAt` 只能作为 `receivedAt`。未登记profile时必须输出缺失权威证据并保持STALE。逐点合同和验收以 `docs/field-data/optimize-demo-140/B25_RUNTIME_POINT_EVIDENCE_CONTRACT.md` 为准。
- 点表审核码的 `SY-` 前缀与旧实时接口的设备前缀不相同，只允许按绑定合同把最前面的 `SY-` 精确替换为 `{runtimeId}-`，随后同时按 `deviceId + tagName` 唯一匹配。后缀、包含、中文名和列表顺序匹配全部禁用。B25正式机械动画合同为54项设备身份和101个运行/频率选择器；业务状态合同增加54个显式故障和54个远程选择器，共162个状态选择器、去重后209个运行时选择器。缺失或重复任一必需选择器即阻断对应设备状态和运行态验收。
- 设备LIVE动画逐点门禁：水泵轴和塔风机都要求该设备的运行反馈与频率反馈具备唯一映射、`GOOD`质量、健康来源和未过期权威时间；任一输入不合格不得进入LIVE。若仅缺权威时间/质量/重放证明，但合同身份和精确选择器有效、来源唯一健康非fallback、点未明确BAD、运行/频率合法且 `pointEvidence.receivedAt` 收包时间不超过30秒，可降级为 `SHADOW` 驱动该设备机械动画；证据仍为STALE。SHADOW泵/风机的运行位与频率点必须各自的 `receivedAt` 均精确等于同一顶层 `pointEvidence.receivedAt`；两点的 `bootId/scanCycleId` 任一出现时，四字段必须成对完整且分别精确相同，否则不得进入SHADOW。水流动画必须有对应权威流量点证据，不得因SHADOW、水泵运行或整站摘要成功而推断流动。派生值取参与点中最早的 `observedAt`。
- 每个LIVE点还必须有 `sourceSequence + scanCycleId + bootId` 防重放证据；跨轮询拒绝时间/序号倒退、同序号内容冲突和退役boot A→B→A复用。同一泵或风机的运行与频率必须来自同一boot和采集周期，频率单位必须为Hz。20秒点龄和未来2秒是不可放宽上限，未来偏差0表示严格不允许未来时间。运行反馈仅接受明确布尔或0/1，设备频率仅接受0至60 Hz，异常值不得先限幅再冒充有效证据；最终审计必须至少比较两个连续快照。
- LIVE绑定只能在对应证据合格时驱动可视化启停、转速和经独立验收的流动效果；SHADOW只允许泵轴和塔风机启停/调速，水流保持暂停；DEMO可显式播放资产示意但不改变证据。三种模式均不得增加BA/PLC写端点、阀门命令、变频给定或任何闭环执行链路。
- B25场景控制必须后端硬拒绝；`/scene/device-command` 不得出现在全局只读写白名单，底层 `submitSceneDeviceCommand` 还必须阻断包括FCU编排在内的所有B25调用入口且上游请求为0，前端2D/3D模式切换也不得解除B25控制阻断。

## B25设备业务状态合同

### 三层状态分离

- 设备业务状态为 `RUNNING/FAULT/STOPPED/STANDBY/UNKNOWN`；逐点证据为 `LIVE/SHADOW/STALE/UNBOUND`；动画模式为 `LIVE/SHADOW/DEMO/PAUSED`。三者必须由独立字段、DOM属性和可见文案表达，任何一层不得覆写或冒充另一层。
- `DEMO`只能改变资产示意动画；开关前后54台设备的业务状态和五类计数必须完全不变。SHADOW或DEMO均不得把根证据升级为LIVE；没有独立流量证据时水流保持暂停。
- LIVE、SHADOW、STALE、UNBOUND及五类业务状态均保持 `GET` only、`writeEndpoints=[]` 和 `visualization_only_no_ba_plc_write`；页面禁止出现设备控制、故障复位、远程切换或频率给定入口。

### 精确状态解析

状态解析只接受绑定合同登记的精确运行、显式故障和远程位，按下列优先级计算：

1. `faultActive === true` → `FAULT`。
2. `faultActive === false && running === true` → `RUNNING`。
3. `faultActive === false && running === false && remoteEnabled === true` → `STANDBY`。
4. `faultActive === false && running === false && remoteEnabled === false` → `STOPPED`。
5. 其余情况 → `UNKNOWN`。

- 显式故障优先于运行。机械动画保留独立的运行/频率证据门禁，但最终还必须满足业务状态为 `RUNNING`；故障位与运行位同时为1时显示故障并停止机械运行时动画。`DEMO`仍可独立播放资产示意，但不得改变故障业务状态或冒充现场运动。
- `FAULT`只允许来自精确唯一的显式设备故障位。通信失败、数据源降级、fallback、请求失败、运行位、频率、聚合状态或中文状态文本都不得推断故障。
- 运行、故障和远程位只接受原始布尔值、数值0/1或精确字符串`"0"/"1"`；禁止trim后接受`running`、`故障`、`启动`等语义文本，非法值必须进入 `UNKNOWN`。
- 任一必要点缺失或重复、质量BAD、来源异常、收包超时、值非法、身份不一致或规则冲突时均为 `UNKNOWN`；不得因为 `running=false` 就默认待机，也不得保留上一次绿色、红色或灰色状态伪装当前状态。
- 禁止读取 `runtimeSummary.groups` 作为业务状态真值；禁止后缀、模糊包含、中文名、设备数组顺序或功率/频率回退。54个设备各使用一组显式 `deviceId + runningTagName + faultTagName + remoteEnabledTagName`。
- SHADOW允许显示通过精确点位与30秒收包TTL门禁的业务状态，但标记必须同时显示 `SHADOW/时效不可证`。SHADOW故障只能解释为“显式故障信号已收到但现场时效不可证”，不能声称为已确认现场故障或审计PASS。

### 3D与DOM验收

- 每个LOD都为相同54个核心设备生成独立运行时状态标记；切换LOD后设备ID、业务状态、证据层和五类计数不得漂移或串色。五类计数之和必须始终等于54。
- 七台主机不显示常驻场景悬浮状态铭牌，3D画布也不显示选中详情卡；统一使用通用灯带、角框、五态形状徽标、本体轻着色和按 `CH1..CH7` 排序的精简固定状态条。状态条只常驻五态图形与设备号，完整业务状态及 `LIVE/SHADOW/STALE/UNBOUND` 证据进入提示和可访问名称。点击设备后打开宽360px的非模态只读右侧检查器，模型画布缩窄并重新拟合；移动端改为底部抽屉。检查器只能包含运行概况、趋势、告警诊断和设备档案，控制标签固定为0；点击模型空白、关闭按钮或ESC清除选择。所有表达从同一 `RuntimeEquipmentStateDecision` 读取，禁止用动画是否转动推断主机状态。
- 状态主表达使用贴近设备底部包络的灯带与四角定位框；悬浮圆圈只能保留为选中设备的定位辅助，不得承载全部状态语义。状态层由Three.js独立生成，不得烘焙进源Blend/GLB，也不得直接永久修改共享GLB PBR材质。推荐：运行绿 `#36E08B`、故障红 `#FF4D5A`、待机琥珀 `#F5B942`、停机灰 `#718096`、未知灰蓝。
- 设备本体允许叠加 `pbr-preserving-selective-light-tint-v1` 运行时轻着色，但必须克隆Three.js材质并保留源PBR颜色、金属度、粗糙度、贴图和法线；不得写回Blend/GLB或直接修改共享材质。仅着色主机涂装筒体、水泵蓝色泵壳/电机外壳和冷却塔FRP面板；排除管道、法兰、软接、仪表、橡胶、联轴器罩、转轴和风机转子。54台设备逐台独立着色，33个塔风机单元不得按塔组整组串色。建议混色强度：RUNNING/STANDBY约10%、FAULT约22%、STOPPED约16%并降低饱和度、UNKNOWN约7%；仅FAULT边框与弱自发光慢速脉动。状态筛选只降低未匹配设备涂装外壳亮度，不得改变五类计数、证据层或机械动画门禁。根节点暴露本体着色版本、54项计数/一致性、材质槽数、作用范围、运行时副本和仅故障脉动合同。
- 五类状态必须同时提供稳定形状标识：RUNNING=`running-play`，使用连续灯带与运行箭形；FAULT=`fault-alert`，使用双层角框与警示三角；STANDBY=`standby-pause`，使用分段灯带与暂停双线；STOPPED=`stopped-square`，使用细灰灯带与方形；UNKNOWN=`unknown-question`，使用虚线角框与问号。SHADOW进一步使用空心、分段或虚线结构；不能只靠颜色或透明度区分。只有FAULT状态层允许慢速脉动，其他四类状态层保持静止。
- 状态筛选是只读视觉过滤器：只把未匹配设备降亮，不能隐藏设备、改变54项身份、五类计数、设备状态、证据层或动画门禁；清除筛选必须恢复原亮度。上一异常/下一异常按稳定设备ID顺序导航FAULT与UNKNOWN，并允许以后并列展示独立诊断，但不得生成告警确认、故障复位或任何控制调用。
- LOD只做语义缩放。LOD0/LOD1/LOD2都必须让54台设备的五态非颜色形状徽标始终存在且可见；可缩放徽标、缩短灯带、调整线宽并隐藏非选中文字，但不得聚合设备、删减状态映射、隐藏RUNNING/STANDBY/STOPPED字形或改变计数。
- 设备业务状态、告警生命周期和诊断结果是三类独立事实。业务状态只来自162个精确状态选择器；告警确认、恢复、闭环必须有独立告警证据；运行位与频率、流量等矛盾只能形成诊断徽标，不能改写业务状态或冒充设备故障。没有对应数据时，告警和诊断分别为 `UNBOUND`，不得从颜色或运行位猜测。
- 当前B25没有权威状态变更时间，右侧只读检查器的状态持续只能显示`--`和“无权威 changedAt”。根节点必须暴露 `data-selected-equipment-status-duration="unavailable"` 与 `data-selected-equipment-status-duration-basis="missing-authoritative-changed-at"`；禁止从页面会话时间、`receivedAt`、`generatedAt`、刷新时间或当前时间推算持续时长，也不得把这些时间冒充 `observedAt` 或 `changedAt`。
- 根节点至少暴露 `data-equipment-status-contract="operational-state-v1"`、`data-equipment-status-visual="base-lightband-corner-frame-v1"`、`data-equipment-status-marker-count="54"`、五类计数、`data-equipment-counts-invariant="PASS/FAIL"`、当前筛选与匹配数、异常导航、LOD语义缩放合同、`data-selected-equipment-status` 和 `data-selected-equipment-status-evidence`。每台设备状态清单暴露 `data-equipment-id`、`data-equipment-operational-state`、`data-equipment-state-evidence`、`data-equipment-state-authority`、`data-equipment-state-reason`、`data-equipment-status-shape`、`data-equipment-filter-match`、独立告警状态和独立诊断状态。
- 默认3D首屏采用参考图验收的前斜俯视方向和HUD感知紧凑拟合：相机方向向量固定为 `[18,25,34]`，俯视角约33°，投影呈塔群左置、七套主机与水泵居中、集分水器和负荷支管右置。按每个可见网格真实局部包围盒角点投影，不使用包含大量空白的整站轴对齐包围盒虚拟角点；宽屏默认HUD压缩为两行，初始距离系数为0.89、视觉中心按画布高度自适应上移60–96px，相对上一版放大约3.9%，为底部设备和状态栏保留安全区；中等宽高比上移约12px，移动端保持保守距离且不做纵向偏移。完整设备、外接管和状态标记不得裁切或被默认HUD遮挡，LOD1下七套主机行位接近屏幕纵向排列且泵轴/塔风机动画可辨。根节点暴露 `data-camera-default-view="tower-left-chiller-center-manifold-right-v5"`、`data-camera-default-direction="18,25,34"`、`data-camera-fit="reference-angle-bottom-safe-obb-fit-v6"`、`data-camera-fit-geometry="visible-mesh-obb-corners"`、`data-camera-overlay-layout="compact-two-row-v1"`、`data-chiller-status-count="7"` 与 `data-chiller-row-order-contract="CH1-top-CH7-bottom"`。
- `pointermove` 悬停检测只对54个轻量状态标记代理射线拾取，且通过 `requestAnimationFrame` 每帧最多执行一次；禁止在鼠标移动路径对完整高面数GLB根节点递归射线检测。悬停卡每次只显示该设备1项核心参数，参数按唯一 `deviceId + tagName` 读取并独立标注证据；点击选中可保留独立、非高频的精确几何拾取。
- 3D默认只显示7个工艺数据锚点：冷冻供水温度、冷冻回水温度、冷冻干管压差、冷却供水温度、冷却回水温度、室外湿球、冷却塔Approach。锚点使用主管真实世界坐标随相机投影，不得固定在屏幕角落冒充管线锚定；每项独立显示STALE或UNBOUND，不得用页面刷新时间升级LIVE。
- 设备参数必须来自54项合同身份和唯一 `deviceId + tagName`；主机负荷/功率、泵与风机频率/功率/流量缺少精确点时显示`--/UNBOUND`，禁止用同组数组、全站平均值或站级汇总回填单台设备。
- 业务状态或设备信息交互修改必须同步 `PlantOverview3D.tsx`、`PlantOverview3D.css`、`SceneControlPage.tsx`、`SceneControlExtracted.css`、两个前端合同检查、B25绑定合同、点位证据合同和真实浏览器验收。浏览器验收至少核对54个标记、54项本体着色目标及129个涂装材质槽、0个常驻主机浮牌、0张3D选中详情卡、7项精简主机状态条、7个工艺锚点、悬停单值、最多1个非模态只读侧栏、0个控制标签、模型缩窄后重拟合、空白/ESC清除、CH1最上/CH7最下、五类计数总和、五种形状、SHADOW空心/分段、仅FAULT脉动、筛选前后计数不变、异常导航、选中设备状态/证据/时长不可用、LOD0/1/2全54五态徽标与逐台本体着色可见、hover仅代理射线且每帧节流、DEMO前后计数、水流暂停、控制台零错误和BA/PLC上游写请求0次。

## 水流动画与运行时合同

### Blender、GLB和LOD

- 从目标管道对象读取真实Bezier样条，按弧长采样位置和切线；禁止用控制点折线代替实际曲线。
- 水流对象使用局部X轴为长度方向的短圆角光段。位置为中心线采样点加管外表面偏移，旋转由局部X轴对齐当前切线；关键帧同时写入位置和四元数旋转。
- 使用1至25帧和线性插值形成24帧循环。负荷侧供回水各4个短光段，四类主管各2个短光段，共16个。
- 每个短光段必须记录：`flow_visual_style=surface_centerline_light_segment`、`centerline_sampled=true`、`attached_pipe_id`、`pipe_surface_offset_m`、`runtime_flow_binding`、`runtime_direction_binding`、`runtime_active_binding`。
- 禁止重新引入环绕管道的Torus、套管圆环或手镯状光环。源生成、GLB回导、LOD1、LOD2和环绕渲染报告都必须满足 `flow_surface_segments=16`、`flow_ring_objects=0`，并继续满足动画对象/轨道63/63（33风机+14泵轴+16水流）。

### Three.js运行时

- 在 `SystemDiagram3D.tsx` 使用带 `RepeatWrapping` 的透明箭头纹理覆盖管道，并通过 `texture.offset.x` 连续滚动；不要使用漂浮球体脉冲或离散锥体箭头。
- `SystemDiagramEdge` 暴露可选字段 `flowM3h`、`flowDirection`、`flowActive`。流速绝对值控制滚动速度，显式方向或负流量控制滚动方向，停流状态停止纹理位移并降低亮度。
- 没有实时流量证据时允许保留示意滚动，但必须在页面保持“未接入/示意”边界，不得据此判断设备运行或现场流量。
- 更新前端水流合同后运行 `npm run verify`。使用已有登录态的真实浏览器打开 `/auto-twin`、切换“三维场景”，检查WebGL持续更新和控制台无错误；浏览器视觉证据不能由TypeScript构建或静态合同检查替代。

### 2D SVG水力图

- 交互式2D与3D必须调用 `systemDiagramFlow.ts` 中同一流量状态解析器，统一处理 `flowM3h`、`flowDirection`、`flowActive`；禁止复制一套含义不同的2D判断逻辑。独立静态SVG交付不执行运行时控制，只输出只读点位绑定和证据状态合同。
- B25“运行监控-冷冻站”的2D场景入口固定使用本地 `/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg`，优先级高于项目接口返回的旧远程2D URL。静态SVG源以全`UNBOUND`安全起步；交互页面由本地运行态组件注入精确只读状态和参数，并与3D共用设备运行态解析器。组件必须披露 `physical-scada-2.5d`、`runtime-read-only-exact`、`exact-deviceid-tagname-read-only`、`schematic` 与 `read-only-no-ba-plc-write`；1920×1080画布按完整范围等比居中拟合，不能套用2500×920远程裁切预设。
- 2D设备业务五态、主机负荷、泵/塔风机频率和机械动画只允许从合同内精确唯一的 `deviceId + tagName` 读取；禁止使用 `runtimeSummary.groups`、同组平均、顶部摘要、模糊名称或数组顺序回填。设备本体和参数标签必须同时呈现颜色与`▶/▲!/Ⅱ/■/?`符号，SHADOW采用虚线并显示“时效不可证”。点击设备复用3D只读检查器，控制标签固定为0。二维水流仍需独立瞬时流量证据；没有该证据时保持`schematic`，不得从泵的业务状态推断。
- 每段管线由静态彩色基线和沿同一SVG路径移动的短光段组成。短光段使用归一化 `pathLength`，动画周期随流量变化；反向流使用反向动画，停流使用暂停动画和低亮度。
- 正向流在管段终点显示箭头，反向流在管段起点显示箭头。管段必须输出 `data-flow-evidence`、`data-flow-direction`、`data-flow-active`，以区分实时驱动、示意流向和停流状态。
- 没有实时流量字段时允许显示较稀疏的示意短光段，但页面必须继续显示数据未接入边界。2D示意动画不得被解释为设备正在运行。
- 二维机房总览按拓扑角色合并同类设备卡片并汇总实例数，重复的角色到角色管段只显示一条；卡片必须保存成员节点ID映射，使外部选中任一真实设备时仍能高亮对应设备组并打开真实设备明细。不得通过逐台小偏移叠卡，也不得为了清爽删除真实节点或篡改节点总数。
- 与正式3D总览一一对应的独立2D交付使用1920×1080 SVG，根节点写入主机、两类水泵、塔组、每组风机、负荷和工艺端口数量。冷却塔组内多台风机沿X轴排列；集水器和分水器位于同一纵向轴线并上下分开。SVG保留示意水流与风机动画，并明确标注未绑定实时流量；同时交付同尺寸静态PNG预览。
- 独立2D交付使用 `physical-scada-2.5d` 表现：主机、水泵、冷却塔从正式源 Blend 后台重渲染为透明RGBA、正交相机、统一灯光的专用PNG，SVG使用 `xMidYMid meet` 嵌入。每个设备图必须记录源Blend SHA-256、透明PNG SHA-256和渲染报告SHA-256；禁止使用带黑色摄影棚背景的旧预览、裁切式 `slice`、卡通图或未经登记的网络素材。
- 现场SCADA参考布局采用塔组左置、七套“冷却泵—主机—冷冻泵”纵向对齐、冷冻水干管及集分水器居右、负荷支路最右的阅读顺序。参考图只定义信息层级和工艺方向，正式2D数量仍服从本合同。温度、压力、流量、频率、负荷率等字段在无实时证据时必须按B25只读证据四态输出；无有限值显示 `--`/“未接入”，有值但时效不可证显示 `STALE`，不得复制参考图中的运行数值。
- 当前独立2D总览必须登记132个 Blender 源工艺端口：7台主机×4口、14台水泵×2口、33个塔单元×2口、集分水器10口；同时登记122条工艺流向边。锚点包含源端口ID、语义角色、源坐标、法向、DN和安装投影方式；所有工艺边端点到锚点最大误差≤1px。水泵二维安装态吸排口同一水平中心线，主机两对源端口高程差≤0.005m。
- 分水器主入口在顶部、01至04支口从上到下；集水器01至04支口从上到下、主出口在底部。同编号支口连接同一个唯一负荷节点；4个负荷各有一条 `DISTRIBUTOR→LOAD` 供水边和一条 `LOAD→COLLECTOR` 回水边。重复负荷ID、未闭环负荷、未引用端口和端点断口均阻断PASS。
- 供回水支管使用独立走廊，禁止堆叠。未登记的供回水交叉及回水独立通道之间的裸交叉必须为0；平面拓扑无法避免时使用带断口的SCADA非连接桥，并记录跨越ID、上下管段ID、坐标和 `data-connected=false`。当前布局登记20处非连接桥，其余交叉为0。
- 点位证据使用 `LIVE/STALE/FAULT/UNBOUND`：LIVE要求有限值、相关源健康和可信现场时间；STALE表示已有值但时效不可证或超时；FAULT只接受显式故障位；UNBOUND表示无值或无权威映射。链路降级不得冒充设备故障。当前静态交付64个点位均为只读UNBOUND、值和观测时间均为null；若前端只读摘要有值但缺权威观测时间，只能转为STALE。
- PNG必须由当前SVG直接渲染，来源证明同时记录SVG和PNG SHA-256、1920×1080尺寸与渲染器；验证器必须拒绝旧PNG配新SVG。
- UI合同必须检查2D共用解析器、正反向箭头、归一化路径、速度变量、反向动画和停流暂停。完成后运行 `npm run verify`，并在真实浏览器的“二维水力图”视图检查四种管色、流向运动、节点可读性和控制台错误。

### 视觉验收

- 对预览图和环绕帧 `000`、`006`、`012`、`018` 检查同一短光段随时间沿管向位移。
- 确认短光段贴近管顶、长度方向与局部管线切线一致，弯管处没有明显切角、穿管、漂浮或偏离中心线。
- 确认四类主管均能读出流向，同时不过度发光遮挡设备、标签和接口。

## 交付与性能目标

- 源 Blend：`apps/chiller-shell-v1/public/models/plant-overview/source/blender/chilled-water-plant-overview-latest-v2.blend`
- LOD0 GLB：`apps/chiller-shell-v1/public/models/plant-overview/chilled-water-plant-overview-latest-v2.glb`
- LOD1/LOD2：同目录 `lod/` 子目录。
- 预览：`output/blender/chilled-water-plant-overview-latest-v2-preview.png`
- GIF：`output/blender/chilled-water-plant-overview-latest-v2-orbit.gif`
- 2D可动SVG：`apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg`
- 2D静态预览：`output/blender/chilled-water-plant-overview-latest-v2-2d.png`
- 2D点位合同：`apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2-point-bindings.json`
- 2D端口合同：`apps/chiller-shell-v1/public/models/plant-overview/2d/chilled-water-plant-overview-latest-v2-port-anchors.json`
- 2D透明组件渲染报告：`output/blender/2d-physical-assets/scada-component-render-report.json`
- 2D PNG来源证明：`output/blender/chilled-water-plant-overview-latest-v2-2d-provenance.json`
- 2D最终验证：`output/blender/chilled-water-plant-overview-latest-v2-2d-validation.json`
- 最终真值：`output/blender/final-model-suite-audit-v2.json`

LOD目标：LOD0为240万至320万三角面且不超过9 MiB，LOD1为60万至90万且不超过5 MiB，LOD2为25万至40万且不超过4 MiB。GIF固定为960×540、24帧、2 fps循环播放，时长约12秒。

内嵌动画必须使用1至25帧构成24帧无缝循环，GLB和LOD导出均启用动画；水泵轴必须带橙色非对称高对比指示片，指示片位于静止联轴器防护罩外侧的数字孪生动画层，安全防护罩本体不得旋转。环绕GIF渲染第1至24帧时必须逐帧更新场景，使设备动画和相机环绕同时生效。Blender动画采样保持8 fps，GIF交付编码按2 fps播放，使当前交付速度再降低一半。水流动画的详细实现和验收以“水流动画与运行时合同”为准。

最终模型不得包含品牌Logo、`.blend1`、未登记GLB或带同步副本后缀的源模型/环绕帧。
