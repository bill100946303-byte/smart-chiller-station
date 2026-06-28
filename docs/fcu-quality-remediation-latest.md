# FCU 质量阻断整改清单

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 真实写入副作用: 无
- 结论: 存在质量阻断，不能全量最终控制
- 生成时间: 2026-06-20T04:31:47.179Z

## 汇总

- FCU 总数: 29
- 需整改: 20
- P0: 8
- 通讯报警: 8
- 0°C: 4
- 无效温度: 4
- 原因分布: setpoint_feedback_out_of_bounds=18, communication_alarm=8, zero_temperature=4, invalid_temperature=4, temperature_quality_guard=4

## 设备清单

| 优先级 | 设备 | 名称 | 温度 | 设定 | 通讯报警 | 原因 | 关键点位 |
|---|---|---|---:|---:|---|---|---|
| P1 | BGS02 | 办公室02 | 28 | 16 | 否 | setpoint_feedback_out_of_bounds | BGS02-502-40074 / BGS02-506-40203 / BGS02-506-40207 |
| P0 | BGS03 | 办公室03 | 0 | 0 | 是 | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds | BGS03-502-40078 / BGS03-506-40219 / BGS03-506-40223 |
| P0 | BGS04 | 办公室04 | 0 | 0 | 是 | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds | BGS04-502-40158 / BGS04-506-40539 / BGS04-506-40543 |
| P0 | BGS06 | 办公室06 | 22 | 24 | 是 | communication_alarm | BGS06-502-40166 / BGS06-506-40571 / BGS06-506-40575 |
| P1 | CWS | 财务室 | 28 | 16 | 否 | setpoint_feedback_out_of_bounds | CWS-502-40086 / CWS-506-40251 / CWS-506-40255 |
| P1 | DHYS | 大会议室 | 29 | 19 | 否 | setpoint_feedback_out_of_bounds | DHYS-502-40174 / DHYS-506-40603 / DHYS-506-40607 |
| P1 | GCBGQ01 | 工程办公区01 | 28 | 10 | 否 | setpoint_feedback_out_of_bounds | GCBGQ01-502-40142 / GCBGQ01-506-40475 / GCBGQ01-506-40479 |
| P1 | GCBGQ02 | 工程办公区02 | 28 | 10 | 否 | setpoint_feedback_out_of_bounds | GCBGQ02-502-40146 / GCBGQ02-506-40491 / GCBGQ02-506-40495 |
| P0 | GCBGQ03 | 工程办公区03 | 31 | 19 | 是 | communication_alarm, setpoint_feedback_out_of_bounds | GCBGQ03-502-40150 / GCBGQ03-506-40507 / GCBGQ03-506-40511 |
| P1 | JDS | 接待室 | 28 | 15 | 否 | setpoint_feedback_out_of_bounds | JDS-502-40178 / JDS-506-40619 / JDS-506-40623 |
| P1 | QT01 | 前厅01 | 28 | 16 | 否 | setpoint_feedback_out_of_bounds | QT01-502-40118 / QT01-506-40379 / QT01-506-40383 |
| P0 | QT02 | 前厅02 | 26 | 26 | 是 | communication_alarm | QT02-502-40122 / QT02-506-40395 / QT02-506-40399 |
| P1 | QTS | 洽谈室 | 27 | 21 | 否 | setpoint_feedback_out_of_bounds | QTS-502-40138 / QTS-506-40459 / QTS-506-40463 |
| P1 | SYS | 实验室 | 28 | 19 | 否 | setpoint_feedback_out_of_bounds | SYS-502-40090 / SYS-506-40267 / SYS-506-40271 |
| P1 | TNFBQ01 | 头脑风暴区01 | 29 | 21 | 否 | setpoint_feedback_out_of_bounds | TNFBQ01-502-40110 / TNFBQ01-506-40347 / TNFBQ01-506-40351 |
| P1 | TNFBQ02 | 头脑风暴区02 | 29 | 10 | 否 | setpoint_feedback_out_of_bounds | TNFBQ02-502-40114 / TNFBQ02-506-40363 / TNFBQ02-506-40367 |
| P0 | WSJ02 | 卫生间02 | 0 | 0 | 是 | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds | WSJ02-502-40130 / WSJ02-506-40427 / WSJ02-506-40431 |
| P1 | XZBGS | 行政办公室 | 27 | 18 | 否 | setpoint_feedback_out_of_bounds | XZBGS-502-40066 / XZBGS-506-40171 / XZBGS-506-40175 |
| P0 | ZHYS | 中会议室 | 0 | 0 | 是 | communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds | ZHYS-502-40170 / ZHYS-506-40587 / ZHYS-506-40591 |
| P0 | ZZBGS | 周总 | 24 | 35 | 是 | communication_alarm, setpoint_feedback_out_of_bounds | ZZBGS-502-40082 / ZZBGS-506-40235 / ZZBGS-506-40239 |

## 现场动作

### BGS02 办公室02
- 复核设定反馈点 BGS02-506-40207，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

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

### CWS 财务室
- 复核设定反馈点 CWS-506-40255，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### DHYS 大会议室
- 复核设定反馈点 DHYS-506-40607，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### GCBGQ01 工程办公区01
- 复核设定反馈点 GCBGQ01-506-40479，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### GCBGQ02 工程办公区02
- 复核设定反馈点 GCBGQ02-506-40495，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### GCBGQ03 工程办公区03
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 GCBGQ03-502-40150 是否仍为 1。
- 复核设定反馈点 GCBGQ03-506-40511，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### JDS 接待室
- 复核设定反馈点 JDS-506-40623，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### QT01 前厅01
- 复核设定反馈点 QT01-506-40383，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### QT02 前厅02
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 QT02-502-40122 是否仍为 1。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### QTS 洽谈室
- 复核设定反馈点 QTS-506-40463，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### SYS 实验室
- 复核设定反馈点 SYS-506-40271，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### TNFBQ01 头脑风暴区01
- 复核设定反馈点 TNFBQ01-506-40351，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### TNFBQ02 头脑风暴区02
- 复核设定反馈点 TNFBQ02-506-40367，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

### WSJ02 卫生间02
- 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
- 核对通讯报警点 WSJ02-502-40130 是否仍为 1。
- 核对内置温度点 WSJ02-506-40427，0°C 不允许进入闭环。
- 补齐或修复区域温度点 WSJ02-506-40427，缺温度时禁止进入闭环。
- 复核设定反馈点 WSJ02-506-40431，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度。

### XZBGS 行政办公室
- 复核设定反馈点 XZBGS-506-40175，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定。

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

