# 140 正式现场 CSV 预检报告

生成时间：2026-06-16T05:15:25.517Z

结论：`FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS`

边界：预检只校验 4 张正式现场 CSV 的可读性、字段映射和证据边界；不判定仪表故障，不自动修正测点，不自动改 PID，不自动启停设备，不写真实 PLC，不覆盖正式 latest 导入报告。

## 输入文件

| 表 | 环境变量 | 路径 | 状态 |
| --- | --- | --- | --- |
| 传感器校准/安装位置台账 | `OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV` | `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv` | missing |
| 控制命令/反馈高频趋势 | `OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV` | `docs/field-data/optimize-demo-140/control-command-feedback.csv` | missing |
| 设备启停事件台账 | `OPTIMIZE_DEMO_START_STOP_INPUT_CSV` | `docs/field-data/optimize-demo-140/start-stop-event.csv` | missing |
| PID/死区/延时参数台账 | `OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV` | `docs/field-data/optimize-demo-140/control-parameter.csv` | missing |

## 传感器台账预检

| 项目 | 结果 |
| --- | --- |
| sensorStatus | `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS` |
| sensorExitCode | 0 |
| acceptedRows | 0 |
| warnings | 0 |
| blockers | 1 |
| reportJson | `docs/optimize-demo-140-sensor-ledger-preflight-latest.json` |

## 控制台账导入器预检

| 项目 | 结果 |
| --- | --- |
| importStatus | `CONTROL_LEDGER_IMPORT_BLOCKED` |
| importExitCode | 0 |
| acceptedRows | 0 |
| warnings | 0 |
| blockers | 3 |

## 阻断项

- 传感器校准/安装位置台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 缺少现场 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv

## 正式导入命令

现场 CSV 预检达到 READY 后，再运行以下命令覆盖正式 latest 报告：

```bash
SITE_ID='140' OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv' OPTIMIZE_DEMO_START_STOP_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv' OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv' npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers
```

## 口径

- `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS`：4 张正式现场 CSV 尚未全部放入约定路径，或环境变量未指向真实文件。
- `FIELD_DATA_PREFLIGHT_READY`：传感器台账与 3 张控制台账均可读取、字段可映射、无 blocker/warning，可再执行正式导入。
- 本预检输出隔离到 field-preflight 文件，不更新 `/optimize-demo` 当前正式台账证据。

