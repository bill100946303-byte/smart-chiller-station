# 140 控制震荡台账导入报告

生成时间：2026-06-12T20:09:11.424Z

结论：`CONTROL_LEDGER_IMPORT_PARTIAL`

边界：导入器只做现场台账回填、字段规范化和证据校验，不自动改 PID，不自动启停设备，不写真实 PLC。

## 汇总

| 项目 | 数值 |
| --- | ---: |
| 表数量 | 3 |
| 输入行数 | 8 |
| 接受行数 | 8 |
| blockers | 0 |
| warnings | 9 |

## 表级结果

| 表 | 输入模式 | 输入 | 输出 | 行数 | blockers | warnings |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 控制命令/反馈高频趋势 | template_sample | `docs/optimize-demo-140-control-command-feedback-template-latest.csv` | `docs/optimize-demo-140-control-command-feedback-normalized-latest.csv` | 3 | 0 | 1 |
| 设备启停事件台账 | template_sample | `docs/optimize-demo-140-start-stop-event-template-latest.csv` | `docs/optimize-demo-140-start-stop-event-normalized-latest.csv` | 2 | 0 | 1 |
| PID/死区/延时参数台账 | template_sample | `docs/optimize-demo-140-control-parameter-template-latest.csv` | `docs/optimize-demo-140-control-parameter-normalized-latest.csv` | 3 | 0 | 7 |

## 警告

- 控制命令/反馈高频趋势: 控制命令/反馈高频趋势 当前使用模板示例输入；现场交付时需替换为 SCADA/PLC 导出文件。
- 设备启停事件台账: 设备启停事件台账 当前使用模板示例输入；现场交付时需替换为 SCADA/PLC 导出文件。
- PID/死区/延时参数台账: 控制参数台账第 1 行未提供 rollbackValue；若未来调整参数，必须另走人工审批和回退确认。
- PID/死区/延时参数台账: 控制参数台账第 1 行未提供 approvedBy；当前只能作为现场资料回填，不能作为变更审批。
- PID/死区/延时参数台账: 控制参数台账第 2 行未提供 rollbackValue；若未来调整参数，必须另走人工审批和回退确认。
- PID/死区/延时参数台账: 控制参数台账第 2 行未提供 approvedBy；当前只能作为现场资料回填，不能作为变更审批。
- PID/死区/延时参数台账: 控制参数台账第 3 行未提供 rollbackValue；若未来调整参数，必须另走人工审批和回退确认。
- PID/死区/延时参数台账: 控制参数台账第 3 行未提供 approvedBy；当前只能作为现场资料回填，不能作为变更审批。
- PID/死区/延时参数台账: PID/死区/延时参数台账 当前使用模板示例输入；现场交付时需替换为 SCADA/PLC 导出文件。

## 使用口径

- 输入可以是现场 SCADA/PLC 导出的 CSV，也可以是按模板人工回填的 CSV。
- 导入器会按中文/英文表头别名归一到标准字段，并输出规范化 CSV。
- 当前报告只证明台账字段可读、可对齐、可复核；不证明 PID 参数正确，也不证明设备需要启停。
- 任何参数调整、启停策略或控制逻辑修改必须另走人工审批、PLC 本地保护和 shadow 验证。

