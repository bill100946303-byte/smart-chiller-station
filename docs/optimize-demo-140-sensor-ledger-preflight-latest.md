# 140 传感器校准/安装位置台账预检报告

生成时间：2026-06-13T01:35:06.973Z

结论：`SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS`

边界：传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。

## 输入文件

| 表 | 环境变量 | 路径 | 状态 |
| --- | --- | --- | --- |
| 传感器校准/安装位置台账 | `OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV` | `docs/field-data/optimize-demo-140/sensor-calibration-installation.csv` | missing |

## 预检摘要

| 项目 | 结果 |
| --- | --- |
| totalRows | 0 |
| acceptedRows | 0 |
| expiredCalibrationCount | 0 |
| missingRangeCount | 0 |
| warnings | 0 |
| blockers | 1 |

## 阻断项

- 缺少传感器校准/安装位置台账 CSV：/Users/billchow/Documents/智慧冷冻站/docs/field-data/optimize-demo-140/sensor-calibration-installation.csv

## 口径

- `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS`：现场台账尚未放入约定路径，或环境变量未指向真实文件。
- `SENSOR_LEDGER_PREFLIGHT_READY`：台账可读、字段可映射、无 blocker/warning，可作为仪表偏移 V1 的复核证据。
- `SENSOR_LEDGER_PREFLIGHT_PARTIAL`：台账可读但存在校准过期、缺量程或覆盖不足，只能提高部分复核效率。
- 本预检不判定仪表故障，不自动修正测点，不写真实 PLC。

