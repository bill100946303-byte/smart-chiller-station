# FCU 全量最终控制分批计划

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 目标设定: 25.5°C
- 单次设定偏移保护: 2°C
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:47.458Z

## 汇总

- 总 FCU: 29
- 设备侧就绪: 9
- 可立即执行: 9
- 需分步调设定: 12
- 质量/通讯阻断: 8
- 当前可全量完成: 否

## 波次

| 波次 | 台数 | 设备 | 目的 |
|---|---:|---|---|
| 首台 Canary | 1 | BGS01 | 先验证真实写入、反馈校验和回退链路。 |
| 可立即小批量 1 | 8 | BGS05, DTT, LZBGS, WSJ01, YFBGQ01, YFBGQ02, YFBGQ03, YFBGQ04 | 设定偏移在保护范围内，可在 Canary 反馈确认后分批执行。 |
| 分步调设定 1 | 9 | BGS02, CWS, DHYS, GCBGQ01, GCBGQ02, JDS, QT01, QTS, SYS | 当前设定与目标偏差超过单次保护限，需要先按 0.5-2.0°C 分步拉回。 |
| 分步调设定 2 | 3 | TNFBQ01, TNFBQ02, XZBGS | 当前设定与目标偏差超过单次保护限，需要先按 0.5-2.0°C 分步拉回。 |

## 阻断设备

| 设备 | 名称 | 温度 | 设定 | 原因 |
|---|---|---:|---:|---|
| BGS03 | 办公室03 | 0 | 0 | communication_alarm, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds, setpoint_feedback_valid |
| BGS04 | 办公室04 | 0 | 0 | communication_alarm, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds, setpoint_feedback_valid |
| BGS06 | 办公室06 | 22 | 24 | communication_alarm, invalid_temperature, temperature_quality_guard |
| GCBGQ03 | 工程办公区03 | 31 | 19 | communication_alarm, invalid_temperature, setpoint_feedback_out_of_bounds, temperature_quality_guard, setpoint_feedback_valid |
| QT02 | 前厅02 | 26 | 26 | communication_alarm, invalid_temperature, temperature_quality_guard |
| WSJ02 | 卫生间02 | 0 | 0 | communication_alarm, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds, setpoint_feedback_valid |
| ZHYS | 中会议室 | 0 | 0 | communication_alarm, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds, setpoint_feedback_valid |
| ZZBGS | 周总 | 24 | 35 | communication_alarm, invalid_temperature, setpoint_feedback_out_of_bounds, temperature_quality_guard, setpoint_feedback_valid |

## 下一步

- P0 打开后端只读/全局投运闸门后重跑 Arm-Check: backend_not_readonly / executionGate。当前阻断：site_authorization_window_active / backend_not_readonly
- P0 先执行首台 Canary: BGS01。首台反馈确认后再进入小批量。
- P0 整改通讯/温度质量阻断设备: 8 台。通讯报警、0°C、越界温度设备不能进入自动闭环。
- P1 对大偏差设定值设备执行分步拉回: 12 台。避免一次性把 10-19°C 等异常设定拉到目标值。
