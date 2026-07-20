# 140 控制震荡台账导入报告

生成时间：2026-06-16T05:24:25.222Z

结论：`CONTROL_LEDGER_IMPORT_BLOCKED`

边界：导入器只做现场台账回填、字段规范化和证据校验，不自动改 PID，不自动启停设备，不写真实 PLC。

## 汇总

| 项目 | 数值 |
| --- | ---: |
| 表数量 | 3 |
| 输入行数 | 0 |
| 接受行数 | 0 |
| blockers | 3 |
| warnings | 0 |

## 表级结果

| 表 | 输入模式 | 输入 | 输出 | 行数 | blockers | warnings |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 控制命令/反馈高频趋势 | missing | `docs/field-data/optimize-demo-140/control-command-feedback.csv` | `docs/optimize-demo-140-control-command-feedback-field-preflight-normalized-latest.csv` | 0 | 1 | 0 |
| 设备启停事件台账 | missing | `docs/field-data/optimize-demo-140/start-stop-event.csv` | `docs/optimize-demo-140-start-stop-event-field-preflight-normalized-latest.csv` | 0 | 1 | 0 |
| PID/死区/延时参数台账 | missing | `docs/field-data/optimize-demo-140/control-parameter.csv` | `docs/optimize-demo-140-control-parameter-field-preflight-normalized-latest.csv` | 0 | 1 | 0 |

## 阻断项

- 控制命令/反馈高频趋势: 缺少输入文件：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-command-feedback.csv
- 设备启停事件台账: 缺少输入文件：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/start-stop-event.csv
- PID/死区/延时参数台账: 缺少输入文件：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/control-parameter.csv

## 使用口径

- 输入可以是现场 SCADA/PLC 导出的 CSV，也可以是按模板人工回填的 CSV。
- 导入器会按中文/英文表头别名归一到标准字段，并输出规范化 CSV。
- 当前报告只证明台账字段可读、可对齐、可复核；不证明 PID 参数正确，也不证明设备需要启停。
- 任何参数调整、启停策略或控制逻辑修改必须另走人工审批、PLC 本地保护和 shadow 验证。

