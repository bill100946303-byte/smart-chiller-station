# 140 现场控制台账 CSV 预检报告

生成时间：2026-06-12T20:22:42.826Z

结论：`FIELD_DATA_PREFLIGHT_READY`

边界：预检只校验现场 CSV 可读性、字段映射和证据边界；不自动改 PID，不自动启停设备，不写真实 PLC，不覆盖正式 latest 导入报告。

## 输入文件

| 表 | 环境变量 | 路径 | 状态 |
| --- | --- | --- | --- |
| 控制命令/反馈高频趋势 | `OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV` | `tmp/optimize-demo-140-control-ledger-ready-fixture/control-command-feedback-field-export.csv` | explicit_field_export |
| 设备启停事件台账 | `OPTIMIZE_DEMO_START_STOP_INPUT_CSV` | `tmp/optimize-demo-140-control-ledger-ready-fixture/start-stop-event-field-export.csv` | explicit_field_export |
| PID/死区/延时参数台账 | `OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV` | `tmp/optimize-demo-140-control-ledger-ready-fixture/control-parameter-field-export.csv` | explicit_field_export |

## 导入器预检

| 项目 | 结果 |
| --- | --- |
| importStatus | `CONTROL_LEDGER_IMPORT_READY` |
| importExitCode | 0 |
| acceptedRows | 9 |
| warnings | 0 |
| blockers | 0 |

## 正式导入命令

现场 CSV 预检达到 READY 后，再运行以下命令覆盖正式 latest 报告：

```bash
SITE_ID='140' OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/tmp/optimize-demo-140-control-ledger-ready-fixture/control-command-feedback-field-export.csv' OPTIMIZE_DEMO_START_STOP_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/tmp/optimize-demo-140-control-ledger-ready-fixture/start-stop-event-field-export.csv' OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV='/Users/billchow/Documents/智慧冷冻站/tmp/optimize-demo-140-control-ledger-ready-fixture/control-parameter-field-export.csv' npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers
```

## 口径

- `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS`：现场 CSV 尚未放入约定路径，或环境变量未指向真实文件。
- `FIELD_DATA_PREFLIGHT_READY`：三张现场 CSV 均可读取、字段可映射、导入器无 blocker/warning，可再执行正式导入。
- 本预检输出隔离到 field-preflight 文件，不更新 `/optimize-demo` 当前正式台账证据。

