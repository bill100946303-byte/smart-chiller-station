# /optimize-demo 诊断可行性矩阵检查

- 结论：DIAGNOSTIC_READINESS_READY
- 站点：140
- BFF：http://127.0.0.1:8787
- 生成时间：2026-06-16T05:24:24.944Z
- 请求：load=1422kW, outdoor=22.9℃, mode=cooling

## 汇总

| 项 | 值 |
| --- | --- |
| Advisor 状态 | partial |
| 执行模式 | read_only |
| 矩阵总项 | 10 |
| 可做 V1 | 4 |
| 只能疑似判断 | 5 |
| 暂不能做/补点 | 1 |
| 控制边界 | read_only_or_shadow_only |
| 现场复核清单 | 4 P0 / 3 P1 |
| 复核清单边界 | read_only_point_verification_only |

## 矩阵项

| key | 档位 | 状态 | 可行性 | 模式 | 边界 |
| --- | --- | --- | --- | --- | --- |
| instrumentDataQuality | A | ready | can_do_v1 | read_only | 只能提示疑似偏移和复核对象，不判定设备故障，不自动修正测点。 |
| chilledHydraulicBalance | A/B | ready | can_do_v1 | read_only | 可做水力失衡风险提示，不能把实时支路差异外推为全天失衡或末端阀门故障。 |
| lowDeltaTRootCause | A/B | ready | can_do_v1 | read_only | 只支持根因排序和 shadow 验证建议，不能自动降泵。 |
| coolingTowerCapability | A | ready | can_do_v1 | shadow_review | 只生成 Approach shadow 证据，不承诺自动调塔或突破最低水温保护。 |
| chillerCombinationOptimization | A/B | partial | directional_review | shadow_review | 多机无单台冷冻水流量时只评价组合，不拆分单台主机实时 COP，不自动启停主机。 |
| chillerHealthDegradation | B | partial | directional_review | read_only | 只能输出健康风险线索；多机运行时不能做单机实时 COP 排名。 |
| pumpEfficiency | B/C | partial | directional_review | read_only | 不能输出水泵效率百分比或高置信节能结论。 |
| valveStiction | B/C | partial | directional_review | read_only | 只生成检修线索，不能直接判定阀门卡死。 |
| controlOscillation | B | partial | directional_review | read_only | 只能提示震荡风险，不自动改 PID，不自动启停设备。 |
| terminalComfortProtection | C | unavailable | point_gap | point_plan | 未闭合末端安全前，泵频建议只能 shadow/审阅，不允许 assisted 或 enforced。 |

## 现场复核清单

| key | 优先级 | 任务 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- |
| chiller-combination-sampling-plan | P0 | 制定主机组合样本采集计划 | CH4+CH5+CH7 等当前组合及候选组合 | 多机运行无单台冷冻水流量时仍只评价组合，不拆单台 COP，不自动启停主机。 |
| plc-pump-protection-mapping | P0 | 确认 PLC 泵频保护与回退点 | 冷冻泵频率目标点、回退点、最小流量、频率上下限、斜率限制 | 未完成前只允许 shadow 记录和人工复核，不允许 assisted/enforced。 |
| sensor-calibration-installation-ledger | P0 | 补传感器校准与安装位置台账 | 冷量表、总功率表、冷冻/冷却供回水温度、湿球温度 | 只用于提高诊断置信度，不自动修正测点、不替代现场校验。 |
| terminal-safety-signal-closure | P0 | 闭合末端安全信号 | 代表房间温度、末端阀位、末端压差、缺冷投诉/工单 | 只作为降泵前置保护证据；未闭合前不允许 assisted/enforced，不生成真实降泵命令。 |
| branch-hydraulic-history-window | P1 | 补支路水力历史趋势 | 支路流量、支路回水压力、支路供回水温度、旁通阀开度 | 没有末端阀位/室温时，不直接判定末端阀门故障。 |
| control-command-feedback-event-window | P1 | 补控制命令/反馈与启停事件台账 | 供水温设定/反馈、泵塔频率命令/反馈、旁通阀命令/反馈、主机/泵/塔启停事件 | 只用于复核控制震荡风险，不自动改 PID，不自动启停设备。 |
| tower-field-inspection-ledger | P1 | 补冷却塔现场巡检和长周期分摊 | 塔单元流量、风机频率/功率、阀门状态、填料/布水巡检 | 只作为塔能力诊断证据，不突破厂家/PLC 最低水温保护。 |

## 仪表偏移 V1

| 项 | 值 |
| --- | --- |
| 候选数 | 1 |
| 交叉校验 | 4 |
| 现场复核对象 | 1 |
| 传感器台账预检 | waiting / accepted=0 / missing=1 |
| 边界 | 仪表偏移 V1 只输出疑似候选和复核对象，不判定仪表故障，不自动修正测点。 |
| 台账边界 | 传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。 |

### 偏移候选

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
| no_strong_drift_candidate | normal | 暂无强偏移候选 | -- |  | 未触发候选不等于仪表已校准，只表示当前窗口未见强异常。 |

### 交叉校验

| key | 状态 | 数值 | 证据 | 复核对象 |
| --- | --- | --- | --- | --- |
| power_meter_closure | normal | 0% | 分项合计 1940.3 kW / 总功率 1940.3 kW | 冷站总电表、主机/泵/塔分项电表和计量口径 |
| cop_closure | insufficient | --% | 负荷来源 scenario；未声明为实测冷量，跳过 COP 闭合。 | 独立冷量表、总功率表和实时负荷来源 |
| wet_bulb_physical_boundary | normal | 2.7℃ | Tcws 28.3℃ / 湿球 25.6℃ | 湿球温度、冷却塔出水温度和安装位置 |
| trend_steady_state | normal | 11.7% | 冷站总功率 稳态窗口样本 20 个，波动 11.7%。 | 同负荷/相近湿球历史窗口 |

## 水力平衡 V1

| 项 | 值 |
| --- | --- |
| 风险指示 | 5 |
| 现场复核对象 | 3 |
| active 风险 | 2 |
| 证据缺口 | 1 |
| 边界 | 水力平衡 V1 只输出水力失衡风险排序、低温差持续性和现场复核对象；不自动降泵，不直接判定末端阀门故障。 |

### 水力风险指示

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
| persistent_low_delta_t | active | 低温差持续性 | 100% | 站级冷冻水温差趋势和负荷稳态窗口 | 只说明低温差持续性，不自动降泵。 |
| branch_flow_imbalance | active | 支路流量离散 | 38.1ratio | 支路流量、支路供回水温度和末端区域映射 | 实时支路差异只作为水力风险线索，不能外推为全天水力失衡。 |
| branch_pressure_spread | watch | 支路压差离散 | 11kPa | 远近端支路压差、总管压差和压差控制点 | 只提示远近端压差分布需复核，不自动改压差设定。 |
| bypass_short_circuit | normal | 旁通分流 | 0% | 冷冻旁通阀命令、反馈和趋势 | 只提示旁通分流风险，不直接判定阀门卡滞。 |
| terminal_safety_gap | gap | 末端安全缺口 | -- | 代表末端安全信号 | 末端安全信号未闭合前，不允许 assisted/enforced，不自动降泵。 |

### 水力现场复核对象

| key | 优先级 | 任务 | 触发原因 | 边界 |
| --- | --- | --- | --- | --- |
| branch-hydraulic-history-window | P0 | 补支路水力历史趋势 | 实时支路流量最大/最小比 38.1。；实时支路压力差范围 11 kPa。 | 不把单次实时差异外推为全天失衡，不直接判定末端阀门故障。 |
| pump-delta-t-shadow-safety-review | P0 | 复核低温差降泵 shadow 前置条件 | 稳态窗口内低温差占比 100%，说明低温差不是瞬时扰动。 | 只允许 shadow 审阅，不自动降泵，不写 PLC。 |
| terminal-safety-signal-closure | P0 | 闭合末端安全信号 | 缺末端阀位、室温和末端压差趋势，不能确认水力调整或降泵后末端仍安全。 | 末端安全信号未闭合前，不允许 assisted/enforced，不自动降泵。 |

## 控制震荡 V1

| 项 | 值 |
| --- | --- |
| 风险指示 | 5 |
| 现场复核对象 | 3 |
| active 风险 | 2 |
| 观察项 | 1 |
| 证据缺口 | 2 |
| 台账导入 | partial / template_sample / accepted=8 |
| 现场CSV预检 | waiting / missing=4 / accepted=0 |
| 正式导入Gate | waiting / accepted=0 |
| 边界 | 控制震荡 V1 只输出温差锯齿波、总功率 hunting、频率/启停事件缺口和现场复核对象；不自动改 PID，不自动启停设备。 |

### 控制震荡风险指示

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
| chilled_delta_t_sawtooth | active | 冷冻水温差锯齿波 | 11次 | 冷冻水温差、冷冻泵频率和供水温控制回路 | 只提示温差锯齿波风险，不自动改 PID、不自动降泵。 |
| cooling_delta_t_sawtooth | watch | 冷却水温差锯齿波 | 7次 | 冷却水温差、冷却泵和冷却塔控制回路 | 只提示冷却侧震荡风险，不自动改塔风机或冷却泵控制参数。 |
| station_power_hunting | active | 冷站总功率 hunting | 100次 | 冷站功率 hunting 与设备状态切换 | 只提示功率 hunting 风险，不自动切换设备组合。 |
| frequency_command_feedback_gap | gap | 泵塔频率命令/反馈缺口 | -- | 泵塔频率命令/反馈高频趋势 | 缺命令/反馈闭合前，不判定 PID 参数错误，不自动改 PID。 |
| start_stop_event_gap | gap | 频繁启停事件缺口 | -- | 设备启停事件台账和防频繁启停参数 | 只提示启停事件缺口，不自动启停设备，不自动修改加减机延时。 |

### 控制震荡现场复核对象

| key | 优先级 | 任务 | 触发原因 | 边界 |
| --- | --- | --- | --- | --- |
| control-command-feedback-history-window | P0 | 补控制命令/反馈高频趋势 | 温差或功率趋势存在锯齿波/hunting 线索。 | 只用于复核控制震荡风险，不自动改 PID，不自动写 PLC。 |
| pid-deadband-delay-parameter-ledger | P1 | 补 PID、死区和延时参数台账 | 判断控制震荡需要知道 PID、死区、斜率限制和启停延时配置。 | 台账只用于人工调参评审，不自动改 PID、不自动改延时。 |
| start-stop-event-ledger | P1 | 补设备启停事件与最小运行时间台账 | 缺精确启停事件时不能判断频繁启停。 | 只输出防频繁启停风险，不自动启停设备。 |

## 边界说明

- A档可进入 /optimize-demo 作为 V1 只读诊断或 shadow 证据。
- B档只能输出疑似风险、待复核和样本治理建议。
- C档只进入点位改造清单，不能输出正式诊断结论。
- 所有项均不新增真实 PLC 下发、自动启停或 enforced 能力。

## 阻断项

- 无

## 警告

- 无

## 结论口径

- 本检查只读取 /optimize 建议响应，不创建、审批、dispatch 或 rollback 执行单。
- A档可做 V1；B档只能输出疑似风险和复核建议；C档只进入补点清单。
- 不证明真实 PLC 已接入，不开放 assisted/enforced，不承诺固定节能。
