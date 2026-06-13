# 140 现场控制台账正式导入 Gate

生成时间：2026-06-12T20:39:09.501Z

结论：`FIELD_DATA_PROMOTE_READY`

边界：promotion 只在现场 CSV 预检 READY 后执行正式台账导入；不自动改 PID，不自动启停设备，不写真实 PLC。

## 输入

预检报告：`docs/optimize-demo-140-field-data-preflight-ready-smoke-latest.json`

| 表 | 路径 | 预检模式 | 存在 |
| --- | --- | --- | --- |
| 控制命令/反馈高频趋势 | `tmp/optimize-demo-140-control-ledger-ready-fixture/control-command-feedback-field-export.csv` | explicit_field_export | yes |
| 设备启停事件台账 | `tmp/optimize-demo-140-control-ledger-ready-fixture/start-stop-event-field-export.csv` | explicit_field_export | yes |
| PID/死区/延时参数台账 | `tmp/optimize-demo-140-control-ledger-ready-fixture/control-parameter-field-export.csv` | explicit_field_export | yes |

## 正式导入结果

| 项目 | 结果 |
| --- | --- |
| importStatus | `CONTROL_LEDGER_IMPORT_READY` |
| acceptedRows | 9 |
| warnings | 0 |
| blockers | 0 |
| importJson | `docs/optimize-demo-140-control-ledger-promote-ready-smoke-import-latest.json` |

## 口径

- `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`：尚未通过现场 CSV 预检，不执行正式导入。
- `FIELD_DATA_PROMOTE_READY`：已按预检输入执行正式导入，`/optimize-demo` 可读取正式 latest 证据。
- 本命令只写台账报告和规范化 CSV，不创建执行单，不审批，不 dispatch，不写 PLC。

