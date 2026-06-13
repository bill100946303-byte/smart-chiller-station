# 140 传感器台账预检 READY 路径自检

生成时间：2026-06-12T21:36:15.604Z

结论：`SENSOR_LEDGER_PREFLIGHT_READY_SMOKE_READY`

边界：传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。

## 结果

| 项 | 值 |
| --- | --- |
| 预检状态 | SENSOR_LEDGER_PREFLIGHT_READY |
| 输入模式 | explicit_field_export |
| 接受行数 | 4 |
| 传感器类型数 | 4 |
| 点位数 | 4 |
| blockers | 0 |
| warnings | 0 |

## 输出

- 预检 JSON：`docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.json`
- 预检 Markdown：`docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.md`
- 规范化 CSV：`docs/optimize-demo-140-sensor-calibration-installation-ready-smoke-normalized-latest.csv`

## 注意

- 本自检使用 `tmp/` 下生成的样例 CSV，只验证传感器台账预检 READY 路径。
- 本自检不覆盖默认 `docs/optimize-demo-140-sensor-ledger-preflight-latest.json`，不能作为现场实测证据。
- 真实交付时必须用现场校准/安装位置台账重新运行 `check:optimize-demo-140-sensor-ledger-preflight`。

