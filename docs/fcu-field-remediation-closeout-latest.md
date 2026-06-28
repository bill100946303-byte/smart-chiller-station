# FCU 现场消缺关闭检查

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 现场消缺未关闭
- 判定: field_remediation_open
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:47.528Z

## 汇总

- P0 设备: 8
- 计划阻断: 8
- 已规划设备: 21
- 首台 Canary: BGS01
- 证据不完整: 否

## Canary 前置项

- 关闭所有 P0 现场消缺项
- 全量分批计划 blocked=0 且存在 plannedDeviceCount

## 未关闭设备

| 优先级 | 设备 | 名称 | 状态 | 温度 | 通讯报警 | 原因 |
|---|---|---|---|---:|---|---|
| P0 | BGS03 | 办公室03 | blocked | 0 | true | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds |
| P0 | BGS04 | 办公室04 | blocked | 0 | true | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds |
| P0 | BGS06 | 办公室06 | blocked | 22 | true | communication_alarm |
| P0 | GCBGQ03 | 工程办公区03 | blocked | 31 | true | communication_alarm, setpoint_feedback_out_of_bounds |
| P0 | QT02 | 前厅02 | blocked | 26 | true | communication_alarm |
| P0 | WSJ02 | 卫生间02 | blocked | 0 | true | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds |
| P0 | ZHYS | 中会议室 | blocked | 0 | true | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds |
| P0 | ZZBGS | 周总 | blocked | 24 | true | communication_alarm, setpoint_feedback_out_of_bounds |

## 现场动作

### BGS03 办公室03
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 BGS03-502-40078 是否仍为 1。
- 核对内置温度点 BGS03-506-40219，0°C 不允许进入闭环。
- 补齐或修复区域温度点 BGS03-506-40219，缺温度时禁止进入闭环。
- 复核设定反馈点 BGS03-506-40223，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度。

### BGS04 办公室04
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 BGS04-502-40158 是否仍为 1。
- 核对内置温度点 BGS04-506-40539，0°C 不允许进入闭环。
- 补齐或修复区域温度点 BGS04-506-40539，缺温度时禁止进入闭环。
- 复核设定反馈点 BGS04-506-40543，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度。

### BGS06 办公室06
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 BGS06-502-40166 是否仍为 1。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### GCBGQ03 工程办公区03
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 GCBGQ03-502-40150 是否仍为 1。
- 复核设定反馈点 GCBGQ03-506-40511，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### QT02 前厅02
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 QT02-502-40122 是否仍为 1。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### WSJ02 卫生间02
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 WSJ02-502-40130 是否仍为 1。
- 核对内置温度点 WSJ02-506-40427，0°C 不允许进入闭环。
- 补齐或修复区域温度点 WSJ02-506-40427，缺温度时禁止进入闭环。
- 复核设定反馈点 WSJ02-506-40431，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度。

### ZHYS 中会议室
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 ZHYS-502-40170 是否仍为 1。
- 核对内置温度点 ZHYS-506-40587，0°C 不允许进入闭环。
- 补齐或修复区域温度点 ZHYS-506-40587，缺温度时禁止进入闭环。
- 复核设定反馈点 ZHYS-506-40591，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度。

### ZZBGS 周总
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 ZZBGS-502-40082 是否仍为 1。
- 复核设定反馈点 ZZBGS-506-40239，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

