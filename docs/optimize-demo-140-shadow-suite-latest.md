# 140 /optimize-demo Shadow Suite 总检查

- 结论：NO_GO
- 站点：140
- BFF：http://127.0.0.1:8787
- 生成时间：2026-06-16T05:16:10.616Z
- 控制边界：可刷新草案/采样证据；不批准、不 dispatch、不 rollback、不写真实 PLC

## 组件结论

| 组件 | 期望 | 当前 | 结果 | 报告 |
| --- | --- | --- | --- | --- |
| Advisor 合同 | ADVISOR_CONTRACT_READY | ADVISOR_CONTRACT_READY | 通过 | 本报告 |
| 诊断可行性矩阵 | DIAGNOSTIC_READINESS_READY | DIAGNOSTIC_READINESS_READY | 通过 | docs/optimize-demo-diagnostic-readiness-latest.md |
| 现场采集包 readiness | FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT | FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT | 通过 | docs/optimize-demo-140-field-collection-package-latest.md |
| 正式现场 CSV 总预检 | FIELD_DATA_PREFLIGHT_READY_OR_WAITING | FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS | 通过 | docs/optimize-demo-140-field-data-preflight-latest.md |
| 正式现场 CSV 导入 Gate | FIELD_DATA_PROMOTE_READY_OR_WAITING | FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT | 通过 | docs/optimize-demo-140-field-data-promote-latest.md |
| UI 边界文案 | UI_BOUNDARY_COPY_READY | UI_BOUNDARY_COPY_READY | 通过 | docs/optimize-demo-ui-boundary-copy-latest.md |
| 控制副作用防护 | NO_CONTROL_MUTATION | NO_CONTROL_MUTATION | 通过 | 本报告 |
| 冷却塔 Approach | GO_SHADOW | GO_SHADOW | 通过 | docs/b25-tower-approach-readiness-latest.md |
| 泵温差降频 | GO_SHADOW_ONLY | GO_SHADOW_ONLY | 通过 | docs/pump-delta-t-readiness-latest.md |
| Shadow 治理 | GO_SHADOW_PENDING | NO_GO | 阻断 | docs/optimize-shadow-governance-latest.md |

## 当前关键状态

| 项目 | 数值 |
| --- | --- |
| 塔侧 shadow | GO |
| 塔侧数据门禁 | READY (8/8) |
| 塔侧目标 Tcws | 29 ℃ |
| 塔侧当前 Approach | 3 ℃ |
| 塔侧最新执行单 | opx-140-1781576068903-ag7ns3 |
| 泵侧 shadow | GO |
| 泵侧 assisted | BLOCKED |
| 泵侧 Trim | CHWP -1 Hz / CWP 0 Hz |
| 泵侧最新执行单 | opx-140-1781576075710-ny5tog |
| 最新 tower dispatch | present |
| 最新 pump dispatch | present |
| 主机组合 Advisor | partial / read_only |
| 当前主机组合 | CH4 + CH5 + CH7 |
| 主机组合样本 | 111 |
| 运行诊断 Advisor | partial / read_only |
| 运行诊断项 | 6 |
| 点位字典 | 已应用 |
| 诊断可行性矩阵 | 4 可做 / 5 疑似 / 1 补点 |
| 诊断矩阵控制边界 | read_only_or_shadow_only |
| 现场采集包 | FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT |
| 正式现场 CSV | 0 已投放 / 4 未投放 |
| 正式 CSV 总预检 | FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS (0/4 已投放) |
| 正式导入 Gate | FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT |
| UI 必备边界文案 | 48 / 48 |
| suite 控制副作用 | NO_CONTROL_MUTATION |

## 阻断项

- tower 执行单状态不是 pending_approval：approved
- tower 审批状态不是 pending：approved
- tower 执行单已出现 dispatch 字段，不能作为未下发待审证据。
- tower timeline 已出现 approved，不再是纯待审单。
- tower timeline 已出现 dispatched，不再是纯待审单。
- tower 本次目标 Tcws 不是 28℃。
- pump 执行单状态不是 pending_approval：approved
- pump 审批状态不是 pending：approved
- pump 执行单已出现 dispatch 字段，不能作为未下发待审证据。
- pump timeline 已出现 approved，不再是纯待审单。
- shadow governance 未达到 GO_SHADOW_PENDING，不能进入人工审阅。

## 风险与提示

- 传感器校准/安装位置台账 尚未投放：docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 尚未投放：docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 尚未投放：docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 尚未投放：docs/field-data/optimize-demo-140/control-parameter.csv
- 传感器校准/安装位置台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv
- 现场 CSV 预检未 READY：FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS
- 传感器校准/安装位置台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv
- 历史样本置信度低，节能评估需 shadow 对比验证。
- 最终冷却水出水温目标 30℃ 需分 3 步 shadow 验证，本次仅提交 29℃。
- 当前活动告警 8 条，shadow 前需确认无严重告警、传感器冻结或塔风机反馈异常。
- assisted 前缺 approve/rollback 点位映射或 dispatchMode 未配置为 assisted。
- 当前草案仍存在部分降级或缺测信号，建议先稳住风险后再评审优化空间。
- 当前 BFF 未接入末端阀位、关键压差或室温；shadow 可评审，assisted 前必须由 PLC 提供等效保护状态。
- 当前 BFF 未接入泵实际频率；执行前必须由 PLC 完成频率上下限、斜率和最小流量保护。
- assisted 前必须确认 PLC 本地限幅、斜率、最小流量和联锁保护。
- tower actions 未显式写明“不写 PLC”。
- 存在历史已批准 tower shadow 旧记录：opx-140-1781493919710-zwt0ak

## 塔侧数据门禁缺口

| key | 状态 | 证据 | 恢复动作 |
| --- | --- | --- | --- |
| dashboard_overview | ready | http=200 / overall=ok | 先恢复 dashboard/overview 数据源；核对 siteId=140、databaseKey=140btwentyfive、projectKey=126lnoffice 与上游接口可用性。 |
| system_power | ready | totalPowerKw=1941.1 kW | 核对冷站总电表、主机/泵/塔功率汇总点和 Dashboard 能源卡片映射。 |
| cooling_load | ready | totalCoolingCapacity=12898.2 kW | 核对冷冻水总流量、供回水温差、冷量计算和额定冷量配置。 |
| tcws | ready | coolingReturnTemp=28.5℃ / signal=ok | 核对冷却塔出水、冷机冷凝器进水或冷却回水点位；确认物理位置和单位。 |
| wet_bulb_live | ready | outdoorWetBulbC=25.5℃ / signal=ok | 核对室外湿球点位、气象站通讯和湿球计算来源；缺失时 Approach 只能只读。 |
| wet_bulb_trend | ready | tag=SY-1-509-42048 / points=144 / overall=ok | 核对湿球趋势 tagname=SY-1-509-42048 是否正确，并确认历史曲线接口有 30-60min 对比样本。 |
| tower_fan_feedback | ready | coolingTowerPowerKw=59.5 kW | 核对塔风机运行反馈、频率反馈、功率或分组运行状态；无反馈时不做闭环目标。 |
| active_chillers | ready | advisor blocker not present | 核对 CH1-CH7 运行状态、机组启停信号和当前主机组合；缺失时不能判断最低冷凝水温边界。 |

## 子报告

- docs/b25-tower-approach-readiness-latest.md
- docs/pump-delta-t-readiness-latest.md
- docs/optimize-shadow-governance-latest.md
- docs/optimize-demo-diagnostic-readiness-latest.md
- docs/optimize-demo-140-field-collection-package-latest.md
- docs/optimize-demo-140-field-data-preflight-latest.md
- docs/optimize-demo-140-field-data-promote-latest.md
- docs/optimize-demo-ui-boundary-copy-latest.md

## 结论口径

- 该 suite 只证明 140 /optimize-demo 当前 shadow 演示链路状态。
- Advisor 合同检查会生成一次草案，可能刷新 append-only 主机组合采样证据；它不做控制动作。
- 控制副作用防护会对比 suite 前后 tower/pump 执行单状态、审批、dispatch 和 timeline；append-only 采样不纳入控制副作用。
- GO_SHADOW_PENDING 只表示可进入人工审阅，不表示可真实下发。
- 泵侧若仍为 GO_SHADOW_ONLY，必须继续锁定 assisted/enforced。
- 任何 approve、dispatch、rollback 都必须由人工另行确认，本检查不会执行这些动作。
