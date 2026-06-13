# 140 /optimize-demo 甲方演示 readiness

- 结论：CLIENT_DEMO_READY_SHADOW_PENDING
- 站点：140
- BFF：http://127.0.0.1:8787
- 前端：http://127.0.0.1:3002
- 生成时间：2026-06-13T01:35:19.451Z

## 组件结果

| 项 | 结果 |
| --- | --- |
| 诊断 API gate | DIAGNOSTIC_READINESS_READY |
| 诊断 UI smoke | UI_DIAGNOSTIC_READINESS_READY |
| 现场复核交付包 | FIELD_VERIFICATION_PACKAGE_READY |
| 现场采集包 readiness | FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT |
| 正式现场 CSV 总预检 | FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS |
| 正式现场 CSV 导入 Gate | FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT |
| 140 shadow suite | GO_SHADOW_PENDING |
| 控制副作用 | NO_CONTROL_MUTATION |
| 诊断矩阵 | 4 可做 / 5 疑似 / 1 补点 |
| 现场复核任务 | 4 P0 / 3 P1 |
| 正式现场 CSV | 0 已投放 / 4 未投放 |
| 正式 CSV 预检输入 | 0/4 已投放 |
| 正式 CSV 可导入 | no |
| UI 无提交/审批/回退 | yes |
| UI 主机组合优化 | yes |
| UI 现场采集包/正式CSV | yes |
| UI 正式CSV缺口明细 | yes |

## 视觉证据

| 证据 | 状态 | 大小 | 最小要求 | 路径 |
| --- | --- | ---: | ---: | --- |
| clientDemoReadinessScreenshot | ok | 811147 | 51200 | output/playwright/optimize-demo-140-client-demo-readiness.png |

## 文档入口

| 文档 | 状态 | 路径 |
| --- | --- | --- |
| clientDemoAcceptance | ok | docs/OPTIMIZE_DEMO_140_CLIENT_DEMO_ACCEPTANCE_CURRENT.md |
| advisorStatus | ok | docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md |
| demoRoutes | ok | docs/DEMO_ROUTES_CURRENT.md |

## 阻断项

- 无

## 警告

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
- 最终冷却水出水温目标 30℃ 需分 3 步 shadow 验证，本次仅提交 29.2℃。
- assisted 前缺 approve/rollback 点位映射或 dispatchMode 未配置为 assisted。
- 当前草案仍存在部分降级或缺测信号，建议先稳住风险后再评审优化空间。
- 当前 BFF 未接入末端阀位、关键压差或室温；shadow 可评审，assisted 前必须由 PLC 提供等效保护状态。
- 当前 BFF 未接入泵实际频率；执行前必须由 PLC 完成频率上下限、斜率和最小流量保护。
- assisted 前必须确认 PLC 本地限幅、斜率、最小流量和联锁保护。
- 存在历史已批准 tower shadow 旧记录：opx-140-1780911209517-23t8ch

## 对外口径

- 通过时表示可演示 AI 优化建议、诊断矩阵、shadow 审批和人工审阅边界。
- 不表示可真实 PLC 下发，不表示可自动启停主机，不表示进入 enforced。
- 若本报告为 NO_CLIENT_DEMO，只能演示静态说明和 blockers/warnings，不做 shadow 审批演示。
