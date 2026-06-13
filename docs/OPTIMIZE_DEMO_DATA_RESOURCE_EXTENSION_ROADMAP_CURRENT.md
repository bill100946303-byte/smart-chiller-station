# `/optimize-demo` 数据资源与拓展诊断路线图

更新时间：2026-06-13

## 1. 结论

140/B25 当前数据资源已经能支撑 `/optimize-demo` 做一批有工程价值的 **只读诊断 + shadow 验证 + 审批演示**。

但当前数据还不支持三类承诺：

- 不支持自动启停主机。
- 不支持真实 PLC 闭环下发。
- 不支持多机并联时拆分单台主机实时 COP。

可进入演示的拓展项应分三档：

| 档位 | 定义 | 适合进入 `/optimize-demo` 的方式 |
| --- | --- | --- |
| A档 | 现有实时点位 + 24h/历史趋势已经足够做第一版 | 作为 Advisor 卡片展示，给证据、blockers、warnings |
| B档 | 可做方向性判断，但缺关键闭环数据 | 只作为“疑似风险/待复核”，不得给执行承诺 |
| C档 | 当前数据不足，需要补点位或现场资料 | 只进入点位改造清单，不做诊断结论 |

第一阶段最值得继续扩展的是 **仪表数据偏移诊断**、**水力平衡诊断**、**低温差根因诊断**。这三项最容易体现 AI 优化的工程前提：先证明数据可信、系统水力状态可信，再谈节能建议。

当前实现状态：

- BFF 已在 `operationalDiagnosticsAdvisor.summary.diagnosticReadinessMatrix` 输出 A/B/C 可行性矩阵。
- 前端 `/optimize-demo` 已新增“数据资源与诊断可行性”卡片，展示 `可做 V1 / 只能疑似判断 / 暂不能做`。
- 前端 `/optimize-demo` 已在“运行诊断 Advisor”中新增“仪表偏移 V1”详情，展示偏移候选、交叉校验、现场复核对象和“不判定仪表故障、不自动修正测点”边界。
- 前端 `/optimize-demo` 已新增“水力平衡 V1”详情，展示水力风险指示、现场复核对象和“不自动降泵、不直接判定末端阀门故障”边界。
- 前端 `/optimize-demo` 已新增“控制震荡 V1”详情，展示温差锯齿波、总功率 hunting、频率/启停事件缺口、现场复核对象和“不自动改 PID、不自动启停设备”边界。
- BFF 已新增 `fieldVerificationChecklist`，把 B/C 档缺口转成现场 P0/P1 只读复核任务；页面显示“现场复核清单”。
- 已新增 140 现场复核交付包导出：`check:optimize-demo-140-field-verification-package` 生成 JSON、Markdown、HTML，用于甲方/现场按 P0/P1 补点和资料。
- 已新增 140 现场采集包 readiness：`npm --prefix apps/chiller-bff run check:optimize-demo-140-field-collection-package`。该命令离线检查 `docs/field-data/optimize-demo-140/` 说明、模板、正式输入位置和安全边界，输出 `FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT/BLOCKED`；缺真实 CSV 只作为 warning，正式 CSV 疑似只复制模板表头时阻断，避免把模板误当现场证据。
- 现场复核交付包已额外输出 3 份控制震荡台账 CSV 模板：控制命令/反馈高频趋势、启停事件台账、控制参数台账。模板只用于现场回填和证据对齐，不自动改 PID、不自动启停设备、不写真实 PLC。
- 已新增控制震荡台账导入器：`npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers`。它把现场 SCADA/PLC 导出的 CSV 归一到标准台账，并输出 JSON/Markdown 报告和规范化 CSV；默认使用模板示例时状态为 `CONTROL_LEDGER_IMPORT_PARTIAL`，不得视为现场实测闭环证据。`/sites/140/optimize` 已只读接入该导入报告，页面显示“台账导入”状态和接受行数。
- 已新增 READY 路径自检：`npm --prefix apps/chiller-bff run check:optimize-demo-140-control-ledger-import`。该命令使用 `tmp/` 样例 CSV 验证导入器可达到 `CONTROL_LEDGER_IMPORT_READY`，但输出为 `ready-smoke`，不覆盖默认 latest，不作为现场证据。
- 已新增主机组合样本采集计划检查：`BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-chiller-sampling-plan`。该命令只读查询 append-only 样本接口，输出候选组合覆盖、30/100 条样本缺口和“采样计划 READY 不等于切换建议 READY”的边界，不调用 `POST /optimize`，不写入样本。
- 已新增现场 CSV 预检 gate：`npm --prefix apps/chiller-bff run check:optimize-demo-140-field-data-preflight`。该命令默认检查 `docs/field-data/optimize-demo-140/` 下三张现场 CSV，或读取 `OPTIMIZE_DEMO_*_INPUT_CSV` 环境变量；输出 `FIELD_DATA_PREFLIGHT_READY/PARTIAL/WAITING_FOR_INPUTS/BLOCKED`，且只写 field-preflight 隔离报告，不覆盖正式 latest。BFF 已把预检状态接入 `controlOscillation.current.ledgerEvidence.preflight`，页面显示“现场CSV预检”；预检 READY 只代表可以正式导入，不代表当前诊断证据 READY。
- 已补充 140 现场 CSV 投放说明：`docs/field-data/optimize-demo-140/README.md`。该说明固定三张文件名、最低字段、预检/promotion 命令和只读边界，现场未放入真实 CSV 前不应创建空占位文件。
- 已新增正式导入 promotion gate：`npm --prefix apps/chiller-bff run promote:optimize-demo-140-field-data-ledgers`。它只读取 preflight 报告里的三张现场 CSV 路径；预检未 READY 时输出 `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`，不覆盖正式 latest。预检 READY 后才调用正式导入器，把 `/optimize-demo` 当前证据从 `PARTIAL/template_sample` 推到现场 `READY/field_export`。BFF 已把 promotion 状态接入 `controlOscillation.current.ledgerEvidence.promotion`，页面显示“正式导入Gate”。
- 已新增传感器校准/安装位置台账预检：`npm --prefix apps/chiller-bff run check:optimize-demo-140-sensor-ledger-preflight`。该命令默认检查 `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv`，输出 `SENSOR_LEDGER_PREFLIGHT_READY/PARTIAL/WAITING_FOR_INPUTS/BLOCKED`，并把状态接入 `instrumentDataQuality.current.sensorLedgerEvidence`；页面显示“传感器台账”。该预检只提高仪表偏移 V1 的复核效率，不判定仪表故障、不自动修正测点、不写 PLC。
- 已新增传感器台账 READY 路径自检：`npm --prefix apps/chiller-bff run check:optimize-demo-140-sensor-ledger-ready-smoke`。该命令使用 `tmp/` 样例台账验证预检器可达到 `SENSOR_LEDGER_PREFLIGHT_READY`，输出 `ready-smoke` 报告，不覆盖正式 latest，不作为现场证据。
- 矩阵明确只读边界：不判定设备故障、不写 PLC、不做自动启停、不进入 `enforced`。
- 自动化验收已固化为 `check:optimize-demo-diagnostic-readiness`，并纳入 140 shadow suite；报告输出到 `docs/optimize-demo-diagnostic-readiness-latest.md`。
- 现场复核交付包验收已固化为 `check:optimize-demo-140-field-verification-package`；报告输出到 `docs/optimize-demo-140-field-verification-package-latest.md` 和 HTML 打印件。
- 登录态 UI 验收已固化为 `check:optimize-demo-diagnostic-ui-smoke`；报告输出到 `docs/optimize-demo-diagnostic-ui-smoke-latest.json`，只验证页面渲染和只读边界，不提交、批准、dispatch 或回退执行单。

## 2. 当前数据底座

140/B25 当前已具备的数据资源：

| 数据类别 | 当前可用内容 | 可支撑能力 |
| --- | --- | --- |
| 主机 | CH1-CH7 运行、故障、远程、功率、蒸发/冷凝侧温度、部分负荷/状态 | 当前运行组合、主机总功率、组合 COP 证据、组合样本积累 |
| 冷冻水泵 | 运行、频率反馈、功率、部分流量 | 低温差、大流量风险、泵频 shadow 建议 |
| 冷却水泵 | 运行、频率反馈、功率、部分流量 | 冷却侧温差、塔泵协同、泵频风险 |
| 冷却塔 | 风机功率/频率、塔侧流量、塔侧压力、阀位状态 | Approach、塔能力、配水风险 |
| 总管 | 冷冻水供回水温度/压力、冷却水供回水温度、湿球温度 | COP、温差、Approach、负荷工况分层 |
| 支路 | 支路供回水温度、回水流量、回水压力 | 水力平衡风险提示 |
| 旁通 | 冷冻旁通/压差调节阀开度反馈 | 低温差根因线索 |
| 历史趋势 | 24h `currentCop`、`totalPowerKw`、`chilledDeltaT`、`coolingDeltaT`、湿球趋势 | 稳态窗口、偏移趋势、低温差持续性 |
| 审批治理 | shadow 执行单、待审、批准、回退、历史记录 | 人工确认和审计演示 |

当前关键缺口：

| 缺口 | 影响 |
| --- | --- |
| 多机运行时无单台冷冻水流量 | 只能评价组合 COP / 冷站 COP，不能拆单机 COP |
| 缺传感器校准记录和安装位置元数据 | 仪表偏移只能提示疑似，不能判定仪表故障 |
| 缺支路历史趋势和末端阀位/压差/室温 | 水力平衡只能做到站级趋势 + 实时支路线索 |
| 缺高频命令/反馈、PID 参数和精确启停事件 | 控制震荡只能做到小时级趋势风险提示，不能判定 PID 或频繁启停 |
| 缺泵曲线或单泵流量 | 水泵效率只能做异常提示，不能做高置信效率计算 |
| 缺真实 PLC 目标点、回退点和本地保护状态 | 只能 shadow，不允许 assisted/enforced |
| 组合历史样本不足 | 主机组合只能继续采样和方向性审阅 |

这些缺口现在会进入 `/optimize-demo` 的“现场复核清单”，以 P0/P1 任务形式展示：

| 优先级 | 任务 | 目的 | 边界 |
| --- | --- | --- | --- |
| P0 | 补传感器校准与安装位置台账 | 提高仪表偏移诊断置信度 | 不自动修正测点 |
| P0 | 闭合末端安全信号 | 支撑泵频 shadow 后续受控评审 | 未闭合前不允许 assisted/enforced |
| P0 | 确认 PLC 泵频保护与回退点 | 支撑泵频目标点、回退点和保护核对 | 不写真实 PLC |
| P0 | 制定主机组合样本采集计划 | 让组合 Advisor 从方向性变成可比较 | 不自动启停主机 |
| P1 | 补支路水力历史趋势 | 提升水力平衡诊断置信度 | 不直接判定末端阀门故障 |
| P1 | 补控制命令/反馈与启停事件台账 | 提升控制震荡诊断置信度 | 不自动改 PID，不自动启停设备 |
| P1 | 补冷却塔现场巡检和长周期分摊 | 支撑塔能力劣化复核 | 不突破最低水温保护 |

## 3. 拓展项可行性矩阵

| 拓展项 | 档位 | 当前能不能做 | 第一版可输出 | 当前主要缺口 | 演示边界 |
| --- | --- | --- | --- | --- | --- |
| 仪表数据偏移诊断 | A | 可以做 V1 | 实时闭合校验、24h 稳态窗口漂移、COP/功率/温差异常复核建议、偏移候选、交叉校验、现场复核对象、传感器台账预检状态 | 校准记录、安装位置、冗余仪表；当前预检等待现场 CSV | 只说“疑似偏移/建议复核”，不判定仪表坏，不自动修正测点 |
| 冷冻水水力平衡诊断 | A/B | 可以做 V1，但置信度中等 | 站级低温差持续性、支路流量/压力离散度、旁通风险、风险指示、现场复核对象 | 支路历史趋势、末端阀位、末端压差、室温 | 不自动降泵，不直接判定末端阀门故障 |
| 低温差根因诊断 | A/B | 可以做 V1 | 大流量小温差、旁通分流、支路分配不均、末端安全缺口排序 | 末端安全数据、支路历史趋势 | 只进入 shadow 降泵建议，不自动降泵 |
| 冷却塔能力诊断 | A | 可以做 V1 | 湿球、冷却水出水、Approach、塔风机频率/功率、塔侧流量一致性 | 塔单元长周期水量/风量、填料/布水现场状态 | 只做 Approach shadow，不承诺自动调塔 |
| 主机组合优化 | A/B | 可以做 V1，但样本仍不足 | 当前组合、组合容量、组合负荷率、组合 COP/冷站 COP、样本数和阻断项 | 组合历史样本、当前组合连续运行时长、人工切换结果 | 样本不足时只能 keep/continue sampling |
| 主机健康劣化诊断 | B | 可做方向性版本 | 同组合/同负荷下冷站 COP 漂移、异常功率提示 | 单机流量、厂家 COP 曲线、单机工况标签 | 多机不拆单机 COP |
| 水泵效率诊断 | B/C | 只能做 V0 | 频率/功率/压差异常、疑似偏离高效区 | 单泵流量、泵曲线、稳定压差、阀位状态 | 不能输出泵效率百分比结论 |
| 阀门卡滞/执行器诊断 | B/C | 视点位覆盖而定 | 命令/反馈不一致、开度长期饱和、动作后无响应提示 | 阀门命令值、反馈值、控制模式、动作历史 | 只生成检修线索 |
| 传感器 stale/通讯质量诊断 | A | 可以做 V1 | 数据新鲜度、缺测、长时间不变、异常跳变 | 点位采样周期和设备通讯拓扑 | 可作为所有 Advisor 的公共 blocker |
| 控制震荡诊断 | B | 已做 V1 方向性诊断 | 温差锯齿波、总功率 hunting、频率命令/反馈缺口、现场复核对象 | 高频历史、控制命令历史、PID参数 | 不自动改 PID |
| 频繁启停诊断 | B | 已做 V1 事件缺口提示 | 启停事件缺口、最小运行时间复核对象 | 精确启停事件、运行累计时长 | 不自动启停设备 |
| 负荷预测 | B | 可做 V0 | 短周期负荷趋势和高/中/低负荷分层 | 天气预报、日历、生产/营业计划、长历史 | 不作为控制直接前馈 |
| 节能量 M&V | B | 可做 shadow 版本 | 同负荷/湿球 band 对比 COP、kW/RT、总功率、告警 | 更长历史样本、可比工况标签 | 只用于 shadow 验证，不用于合同结算 |
| 末端舒适/缺冷风险诊断 | C | 当前不足 | 暂不输出正式诊断 | 房间温度、末端阀位、末端压差、投诉/工单 | 只列为点位改造建议 |
| 冷量表/热平衡审计 | B | 可做第一版 | 冷冻侧冷量、冷却侧热量、功率闭合偏差趋势 | 冷却侧可靠流量、仪表校准 | 只作为数据可信度证据 |
| 冷却水水质/结垢诊断 | C | 当前不足 | 暂不做 | 水质、电导率、补排水、换热端差长历史 | 需要现场巡检和水处理数据 |
| 制冷剂/压缩机深度健康 | C | 当前不足 | 暂不做 | 吸排气压力、油压、压缩机电流、厂家报警细码 | 不进入当前演示 |

## 4. 建议进入 `/optimize-demo` 的拓展顺序

| 优先级 | 拓展项 | 理由 | 第一版交付形态 |
| --- | --- | --- | --- |
| P0 | 仪表数据偏移诊断 | AI 优化的前提是数据可信，商业上容易解释 | 已强化 `instrumentDataQuality` 详情卡：疑似偏移点、证据、复核建议、`sensorLedgerEvidence` 台账预检状态 |
| P0 | 水力平衡诊断 | 低温差和泵耗通常是现场节能关键 | 已强化 `chilledHydraulicBalance`：站级趋势 + 支路实时离散度 + 旁通风险 + 风险指示 + 现场复核对象 |
| P0 | 低温差根因诊断 | 可直接支撑泵频 shadow 建议 | 强化 `lowDeltaTRootCause`：根因排序、可行动项、阻断项 |
| P1 | 控制震荡/频繁启停诊断 | 对稳定性和甲方信任很重要 | 已新增只读 Advisor：温差锯齿波、总功率 hunting、频率/启停事件缺口；已输出高频命令/反馈、启停事件和控制参数台账模板，并新增 CSV 导入器与 READY 路径自检；Advisor 已显示导入状态，下一步接真实 SCADA/PLC 导出文件 |
| P1 | 主机组合样本治理 | 主机组合优化要靠样本变强 | 已新增只读采样计划检查和 140 采样计划文档；下一步补候选组合自然运行/人工批准窗口 |
| P2 | 水泵效率诊断 | 价值高，但数据缺口较大 | 先做 V0 异常提示，不给效率结论 |
| P2 | 负荷预测 | 可增强演示，但不能支配控制 | 只做趋势预测和策略准备，不做直接下发 |

当前已落地的页面顺序建议：

1. 数据资源与诊断可行性：先告诉甲方“哪些能做、哪些只能疑似、哪些暂不能做”。
2. 现场复核清单：把 B/C 档缺口拆成 P0/P1 点位/资料补齐任务。
3. 运行诊断 Advisor：再展示仪表、水力、控制震荡、低温差、塔能力、主机样本证据。
4. 优化建议：主机组合、塔 Approach、泵频修正。
5. Shadow 验证与人工审阅：只记录验证窗口和审阅结论，不写真实 PLC。

## 5. 每个拓展项的建模边界

### 5.1 仪表数据偏移诊断

输入字段：

- 总功率、主机功率、泵功率、塔功率
- 冷站 COP、总冷量
- 冷冻供回水温度、冷却供回水温度
- 冷冻水温差、冷却水温差
- 湿球温度
- 24h 趋势窗口

可输出：

- 温差长期异常偏小/偏大
- COP 在稳态窗口内异常漂移
- 总功率与分项功率闭合偏差
- 冷却水温度低于湿球等物理不可能提示
- 建议复核的仪表清单

不可输出：

- “某个传感器已经坏了”
- “该仪表偏移 X 度且可直接修正”
- 未经校验的自动补偿值

### 5.2 水力平衡诊断

输入字段：

- 冷冻总管供回水温度、压差
- 冷冻水泵频率、功率、流量
- 支路流量、支路回水压力、支路供回水温度
- 旁通阀开度
- 24h 冷冻水温差和总功率趋势

可输出：

- 站级低温差是否持续
- 支路流量最大/最小比是否偏高
- 旁通阀是否存在分流风险
- 是否满足降泵 shadow 的前置条件
- 水力风险指示：低温差持续性、支路流量离散、支路压差离散、旁通分流、末端安全缺口
- 现场复核对象：末端安全信号、支路历史趋势、旁通阀命令/反馈、泵频 shadow 前置条件

不可输出：

- 没有末端阀位/室温时直接判定末端过流
- 没有支路历史趋势时外推全天水力失衡
- 没有 PLC 保护时直接给真实降泵命令
- 不能把风险指示当成故障数量或真实控制许可

### 5.3 主机组合优化

输入字段：

- 当前运行组合
- 组合额定容量
- 系统冷量、组合负荷率
- 主机总功率、冷站总功率
- 湿球温度、冷冻水供水温度
- 告警数、数据新鲜度
- append-only 组合历史样本

可输出：

- 当前组合和组合负荷率
- 组合 COP / 冷站 COP
- 历史同工况组合候选排序
- 样本置信度
- shadow 对比验证方案

不可输出：

- 多机运行时单台主机实时 COP 排名
- 样本不足时承诺切换节能
- 自动启停主机

## 6. 140 站点下一步数据补齐清单

| 优先级 | 数据/点位 | 用途 | 没有它时的限制 |
| --- | --- | --- | --- |
| P0 | 当前组合连续运行时间 | 主机组合防频繁切换 | 组合 Advisor 只能继续采样 |
| P0 | 末端压差/阀位/室温至少一类安全信号 | 泵频 shadow 到 assisted 的前置 | 泵降频只能 shadow，不可 assisted |
| P0 | PLC 本地最小流量、频率限幅、斜率保护状态 | 执行安全边界 | 不允许真实下发 |
| P0 | 传感器校准/安装位置台账 | 仪表偏移诊断置信度；当前已支持 `sensor-calibration-installation.csv` 预检 | 只能疑似复核；预检 READY 也不自动修正测点 |
| P1 | 支路历史趋势 | 水力平衡置信度 | 只能实时快照，不外推全天 |
| P1 | 主机组合历史样本 | 主机组合排序 | 样本不足只能 keep |
| P1 | 人工 shadow 切换记录 | 节能验证 | 不能证明推荐组合更优 |
| P1 | 塔单元长周期流量/频率/功率 | 塔能力排序 | 只能站级 Approach |
| P2 | 单泵流量或泵曲线 | 水泵效率诊断 | 不能算单泵效率 |
| P2 | 房间温度/投诉/工单联动 | 舒适性保护 | 无法自动识别缺冷风险 |

## 7. 产品化建议

`/optimize-demo` 后续不建议一次性堆很多卡片，建议按“数据可信 -> 水力状态 -> 优化建议 -> shadow 验证”的顺序组织：

1. 数据可信度：仪表偏移、stale、物理边界、功率闭合。
2. 系统状态：水力平衡、低温差、塔能力、控制震荡。
3. 优化建议：主机组合、塔 Approach、泵频修正。
4. 治理闭环：blockers、warnings、shadow 单、人工审批、回退目标。

这条路径更容易卖给甲方：不是“AI 直接控制设备”，而是“AI 先把数据、风险和节能机会讲清楚，再用 shadow 验证证明有效”。

## 8. 当前不应做的事

- 不应把 `B25_AI_*` 影子点包装成真实 PLC 点。
- 不应把样本不足的主机组合建议包装成节能结论。
- 不应在无末端安全信号时开放泵频 assisted。
- 不应在缺厂家/现场保护边界时突破最低冷凝器进水温。
- 不应把多机组合 COP 拆成单机 COP。
- 不应为演示效果隐藏 blockers/warnings。
