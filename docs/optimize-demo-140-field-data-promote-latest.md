# 140 现场控制台账正式导入 Gate

生成时间：2026-06-13T01:35:07.107Z

结论：`FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`

边界：promotion 只在现场 CSV 预检 READY 后执行正式台账导入；不自动改 PID，不自动启停设备，不写真实 PLC。

## 输入

预检报告：`docs/optimize-demo-140-field-data-preflight-latest.json`

| 表 | 路径 | 用途 | 预检模式 | 存在 |
| --- | --- | --- | --- | --- |
| 传感器校准/安装位置台账 | `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv` | preflight-only | missing | no |
| 控制命令/反馈高频趋势 | `docs/field-data/optimize-demo-140/control-command-feedback.csv` | control-ledger-import | missing | no |
| 设备启停事件台账 | `docs/field-data/optimize-demo-140/start-stop-event.csv` | control-ledger-import | missing | no |
| PID/死区/延时参数台账 | `docs/field-data/optimize-demo-140/control-parameter.csv` | control-ledger-import | missing | no |

## 正式导入结果

| 项目 | 结果 |
| --- | --- |
| importStatus | `CONTROL_LEDGER_IMPORT_NOT_RUN` |
| acceptedRows | 0 |
| warnings | 0 |
| blockers | 0 |
| importJson | `docs/optimize-demo-140-control-ledger-import-latest.json` |

## 阻断项

- 现场 CSV 预检未 READY：FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS
- 传感器校准/安装位置台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/sensor-calibration-installation.csv
- 控制命令/反馈高频趋势 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账 文件不存在：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv

## 口径

- `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`：尚未通过现场 CSV 预检，不执行正式导入。
- `FIELD_DATA_PROMOTE_READY`：已按预检输入执行正式导入，`/optimize-demo` 可读取正式 latest 证据。
- 本命令只写台账报告和规范化 CSV，不创建执行单，不审批，不 dispatch，不写 PLC。

