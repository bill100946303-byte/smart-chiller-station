# 140 现场采集包 readiness

生成时间：2026-06-16T05:15:25.278Z

结论：`FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT`

## 1. 文档与模板

| 项 | 状态 | 路径 |
| --- | --- | --- |
| field-data-readme | ok | `docs/field-data/optimize-demo-140/README.md` |
| chiller-combination-field-collection | ok | `docs/field-data/optimize-demo-140/CHILLER_COMBINATION_FIELD_COLLECTION.md` |
| chiller-sampling-plan | ok | `docs/OPTIMIZE_DEMO_140_CHILLER_SAMPLING_PLAN_CURRENT.md` |
| advisor-status | ok | `docs/OPTIMIZE_DEMO_ADVISOR_STATUS_CURRENT.md` |
| sensorLedger | ok | `docs/field-data/optimize-demo-140/templates/sensor-calibration-installation.template.csv` |
| controlCommandFeedback | ok | `docs/field-data/optimize-demo-140/templates/control-command-feedback.template.csv` |
| startStopEvent | ok | `docs/field-data/optimize-demo-140/templates/start-stop-event.template.csv` |
| controlParameter | ok | `docs/field-data/optimize-demo-140/templates/control-parameter.template.csv` |
| chillerCombinationSamplingLog | ok | `docs/field-data/optimize-demo-140/templates/chiller-combination-sampling-log.template.csv` |

## 2. 正式现场输入状态

| 输入 | 状态 | 行数 | 路径 |
| --- | --- | ---: | --- |
| 传感器校准/安装位置台账 | `missing` | 0 | `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv` |
| 控制命令/反馈高频趋势 | `missing` | 0 | `docs/field-data/optimize-demo-140/control-command-feedback.csv` |
| 设备启停事件台账 | `missing` | 0 | `docs/field-data/optimize-demo-140/start-stop-event.csv` |
| PID/死区/延时参数台账 | `missing` | 0 | `docs/field-data/optimize-demo-140/control-parameter.csv` |

## 3. Latest 报告引用

| 报告 | 结论 | 关键状态 | 路径 |
| --- | --- | --- | --- |
| 传感器台账预检 | `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS` | blockers=1 | `docs/optimize-demo-140-sensor-ledger-preflight-latest.json` |
| 主机组合采样计划 | `CHILLER_SAMPLING_PLAN_READY_TO_COLLECT` | baseline_high_confidence_only / total=115 | `docs/optimize-demo-140-chiller-sampling-plan-latest.json` |
| 诊断 readiness | `DIAGNOSTIC_READINESS_READY` | 4 ready / 5 directional / 1 point-gap | `docs/optimize-demo-diagnostic-readiness-latest.json` |
| 甲方演示 readiness | `CLIENT_DEMO_READY_SHADOW_PENDING` | -- | `docs/optimize-demo-140-client-demo-readiness-latest.json` |

## 4. Blockers / Warnings

Blockers:
- 无。

Warnings:
- 传感器校准/安装位置台账 尚未投放：docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 尚未投放：docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 尚未投放：docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 尚未投放：docs/field-data/optimize-demo-140/control-parameter.csv

## 5. 边界

- 不写真实 PLC
- 不自动启停主机
- 不自动修正测点
- 不拆单台主机 COP
- 不把单一组合样本高置信解释为切换节能结论
- 模板本身不作为现场证据

本检查只验证现场采集包是否可发给现场和是否存在误投放风险；不写 PLC、不创建 shadow 单、不判断真实节能。
