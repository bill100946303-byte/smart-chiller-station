# FCU 现场消缺执行包

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 待处理 P0 设备: 8
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:47.661Z

## 执行顺序

- restore_communication: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 通讯报警为 0，连续两次采样正常。
- restore_temperature: 4 台 (BGS03、BGS04、WSJ02、ZHYS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 温度在 5-45°C，0°C/越界温度消失。
- normalize_setpoint_feedback: 6 台 (BGS03、BGS04、GCBGQ03、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 设定反馈留空或在 10-32°C，并与现场面板一致。
- verify_write_mapping: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 写点映射核对完成，本包不产生写入。
- two_sample_validation: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 连续两次 BA 采样均正常。
- onsite_signoff: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 处理和复核签字完整，releaseDecision=release。
- rerun_closeout: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 重跑证据链后 closeout/canary readiness 不再被现场 P0 卡住。

## 按原因分组

- communication_alarm: BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS
- zero_temperature: BGS03、BGS04、WSJ02、ZHYS
- invalid_temperature: BGS03、BGS04、WSJ02、ZHYS
- temperature_quality_guard: BGS03、BGS04、WSJ02、ZHYS
- setpoint_feedback_out_of_bounds: BGS03、BGS04、GCBGQ03、WSJ02、ZHYS、ZZBGS

## 逐台执行

### BGS03 办公室03
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 阻断原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对区域温度点位来源、量程和绑定房间，修复 0°C 异常值。
  - 核对温度点位量程、数据类型、缩放系数和上位机映射。
  - 确认温度质量标记恢复，异常温度不再参与闭环判断。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - zoneTemperatureAfterC 在 5-45°C，且不再为 0。
  - zoneTemperatureAfterC 在 5-45°C。
  - 连续两次采样温度有效，qualityStatus 不再为 invalid。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - 0°C 原始点恢复为有效温度
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=必填：5-45，设定反馈=必填：10-32，写点=yes，连续采样=yes，就地锁定=none

### BGS04 办公室04
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 阻断原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对区域温度点位来源、量程和绑定房间，修复 0°C 异常值。
  - 核对温度点位量程、数据类型、缩放系数和上位机映射。
  - 确认温度质量标记恢复，异常温度不再参与闭环判断。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - zoneTemperatureAfterC 在 5-45°C，且不再为 0。
  - zoneTemperatureAfterC 在 5-45°C。
  - 连续两次采样温度有效，qualityStatus 不再为 invalid。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - 0°C 原始点恢复为有效温度
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=必填：5-45，设定反馈=必填：10-32，写点=yes，连续采样=yes，就地锁定=none

### BGS06 办公室06
- 负责人: BA/自控工程师 / 现场值班 / 平台工程师
- 当前值: 温度 22°C，设定 24°C，通讯报警 true
- 阻断原因: communication_alarm
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=可选，设定反馈=可选，写点=yes，连续采样=yes，就地锁定=none

### GCBGQ03 工程办公区03
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 31°C，设定 19°C，通讯报警 true
- 阻断原因: communication_alarm；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=可选，设定反馈=可选，写点=yes，连续采样=yes，就地锁定=none

### QT02 前厅02
- 负责人: BA/自控工程师 / 现场值班 / 平台工程师
- 当前值: 温度 26°C，设定 26°C，通讯报警 true
- 阻断原因: communication_alarm
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=可选，设定反馈=可选，写点=yes，连续采样=yes，就地锁定=none

### WSJ02 卫生间02
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 阻断原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对区域温度点位来源、量程和绑定房间，修复 0°C 异常值。
  - 核对温度点位量程、数据类型、缩放系数和上位机映射。
  - 确认温度质量标记恢复，异常温度不再参与闭环判断。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - zoneTemperatureAfterC 在 5-45°C，且不再为 0。
  - zoneTemperatureAfterC 在 5-45°C。
  - 连续两次采样温度有效，qualityStatus 不再为 invalid。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - 0°C 原始点恢复为有效温度
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=必填：5-45，设定反馈=必填：10-32，写点=yes，连续采样=yes，就地锁定=none

### ZHYS 中会议室
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 阻断原因: communication_alarm；zero_temperature；invalid_temperature；temperature_quality_guard；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对区域温度点位来源、量程和绑定房间，修复 0°C 异常值。
  - 核对温度点位量程、数据类型、缩放系数和上位机映射。
  - 确认温度质量标记恢复，异常温度不再参与闭环判断。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - zoneTemperatureAfterC 在 5-45°C，且不再为 0。
  - zoneTemperatureAfterC 在 5-45°C。
  - 连续两次采样温度有效，qualityStatus 不再为 invalid。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - 0°C 原始点恢复为有效温度
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=必填：5-45，设定反馈=必填：10-32，写点=yes，连续采样=yes，就地锁定=none

### ZZBGS 周总
- 负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师
- 当前值: 温度 24°C，设定 35°C，通讯报警 true
- 阻断原因: communication_alarm；setpoint_feedback_out_of_bounds
- 现场动作:
  - 复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。
  - 核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。
  - 逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。
  - 连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。
  - 补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。
  - 重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。
- 放行口径:
  - communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。
  - setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。
  - communicationAlarm=0
  - zoneTemperatureC 在 5-45°C
  - setpointFeedbackC 在策略允许范围内
  - 启停、设定、风速写点均已映射且 writable=true
  - quality.status=ok
  - 连续两次采样保持正常
  - 未处于本地手动/禁控/回退锁定
  - writePointMappingChecked=yes
  - twoSampleNormal=yes
  - localManualLockout=none
  - releaseDecision=release
  - 重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。
- 签字字段: 通讯=必填：0，温度=可选，设定反馈=必填：10-32，写点=yes，连续采样=yes，就地锁定=none

## 边界

- 本执行包只指导现场消缺、复检和签字，不下发 BA/PLC。
- 即使全部签字完成，也必须重跑质量整改、全量分批计划、closeout、Canary readiness。
- 首台 Canary 反馈确认前，不允许扩大到小批量或全量。
