# 140 控制震荡台账 READY 路径自检

生成时间：2026-06-12T20:21:04.067Z

结论：`CONTROL_LEDGER_IMPORT_READY_SMOKE_READY`

边界：导入器只做现场台账回填、字段规范化和证据校验，不自动改 PID，不自动启停设备，不写真实 PLC。

## 结果

| 项 | 值 |
| --- | --- |
| 导入状态 | CONTROL_LEDGER_IMPORT_READY |
| 输入模式 | field_export |
| 接受行数 | 9 |
| blockers | 0 |
| warnings | 0 |

## 输出

- 导入 JSON：`docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.json`
- 导入 Markdown：`docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.md`
- 命令/反馈规范化 CSV：`docs/optimize-demo-140-control-command-feedback-ready-smoke-latest.csv`
- 启停事件规范化 CSV：`docs/optimize-demo-140-start-stop-event-ready-smoke-latest.csv`
- 控制参数规范化 CSV：`docs/optimize-demo-140-control-parameter-ready-smoke-latest.csv`

## 注意

- 本自检使用 `tmp/` 下生成的样例 CSV，只验证导入器 READY 路径。
- 本自检不覆盖默认 `docs/optimize-demo-140-control-ledger-import-latest.json`，不能作为现场实测证据。
- 真实交付时必须用现场 SCADA/PLC 导出 CSV 重新运行导入器。

