# FCU 现场消缺工单包

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 工单数: 8
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:47.592Z

## 现场填写规则

- 处理后必须填写处理人、处理时间、通讯报警复检、温度复检、写点映射复检、连续两次采样、就地/手动/锁定状态、复核人。
- `releaseDecision=release` 不等于自动放行；必须重跑实时质量整改、全量分批计划和 closeout。
- 本包只用于现场整改和签字留痕，不产生任何 BA/PLC 写入。
- 现场填写文件: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv；刷新工单时不会覆盖已存在的现场填写文件。

## 现场处理顺序

- 先处理 communication_alarm：恢复控制器供电、通讯线、地址、网关轮询和 BA 报警复位。
- 再处理 zero_temperature / invalid_temperature：确认温度点不是 0°C、断线值或量程错误。
- 再处理 setpoint_feedback_out_of_bounds：将设定反馈分步拉回 10-32°C 策略边界内。
- 最后核对启停、设定、风速写点 writable=true，并连续两次采样正常。

## 按原因分组

- communication_alarm: 8 台 / BGS03, BGS04, BGS06, GCBGQ03, QT02, WSJ02, ZHYS, ZZBGS
- setpoint_feedback_out_of_bounds: 6 台 / BGS03, BGS04, GCBGQ03, WSJ02, ZHYS, ZZBGS
- invalid_temperature: 4 台 / BGS03, BGS04, WSJ02, ZHYS
- temperature_quality_guard: 4 台 / BGS03, BGS04, WSJ02, ZHYS
- zero_temperature: 4 台 / BGS03, BGS04, WSJ02, ZHYS

## 工单

### FCU-P0-BGS03 办公室03
- 负责人: BA/自控工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS03-502-40078 是否仍为 1。
  - 核对内置温度点 BGS03-506-40219，0°C 不允许进入闭环。
  - 补齐或修复区域温度点 BGS03-506-40219，缺温度时禁止进入闭环。
  - 复核设定反馈点 BGS03-506-40223，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度
- 复检字段: 通讯=必填：0，温度=必填：5-45，连续采样=必填：yes/no

### FCU-P0-BGS04 办公室04
- 负责人: BA/自控工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS04-502-40158 是否仍为 1。
  - 核对内置温度点 BGS04-506-40539，0°C 不允许进入闭环。
  - 补齐或修复区域温度点 BGS04-506-40539，缺温度时禁止进入闭环。
  - 复核设定反馈点 BGS04-506-40543，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度
- 复检字段: 通讯=必填：0，温度=必填：5-45，连续采样=必填：yes/no

### FCU-P0-BGS06 办公室06
- 负责人: BA/自控工程师
- 当前值: 温度 22°C，设定 24°C，通讯报警 true
- 原因: communication_alarm
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS06-502-40166 是否仍为 1。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定
- 复检字段: 通讯=必填：0，温度=可选，连续采样=必填：yes/no

### FCU-P0-GCBGQ03 工程办公区03
- 负责人: BA/自控工程师
- 当前值: 温度 31°C，设定 19°C，通讯报警 true
- 原因: communication_alarm；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 GCBGQ03-502-40150 是否仍为 1。
  - 复核设定反馈点 GCBGQ03-506-40511，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定
- 复检字段: 通讯=必填：0，温度=可选，连续采样=必填：yes/no

### FCU-P0-QT02 前厅02
- 负责人: BA/自控工程师
- 当前值: 温度 26°C，设定 26°C，通讯报警 true
- 原因: communication_alarm
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 QT02-502-40122 是否仍为 1。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定
- 复检字段: 通讯=必填：0，温度=可选，连续采样=必填：yes/no

### FCU-P0-WSJ02 卫生间02
- 负责人: BA/自控工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 WSJ02-502-40130 是否仍为 1。
  - 核对内置温度点 WSJ02-506-40427，0°C 不允许进入闭环。
  - 补齐或修复区域温度点 WSJ02-506-40427，缺温度时禁止进入闭环。
  - 复核设定反馈点 WSJ02-506-40431，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度
- 复检字段: 通讯=必填：0，温度=必填：5-45，连续采样=必填：yes/no

### FCU-P0-ZHYS 中会议室
- 负责人: BA/自控工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 ZHYS-502-40170 是否仍为 1。
  - 核对内置温度点 ZHYS-506-40587，0°C 不允许进入闭环。
  - 补齐或修复区域温度点 ZHYS-506-40587，缺温度时禁止进入闭环。
  - 复核设定反馈点 ZHYS-506-40591，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度
- 复检字段: 通讯=必填：0，温度=必填：5-45，连续采样=必填：yes/no

### FCU-P0-ZZBGS 周总
- 负责人: BA/自控工程师
- 当前值: 温度 24°C，设定 35°C，通讯报警 true
- 原因: communication_alarm；setpoint_feedback_out_of_bounds
- 现场动作:
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 ZZBGS-502-40082 是否仍为 1。
  - 复核设定反馈点 ZZBGS-506-40239，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定
- 复检字段: 通讯=必填：0，温度=可选，连续采样=必填：yes/no

