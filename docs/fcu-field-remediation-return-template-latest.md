# FCU 最终控制现场回填模板

- 站点: 126lnoffice
- 待回填设备: 8
- 通讯阻断: 8
- 温度阻断: 4
- 设定反馈阻断: 6
- 可参考草稿设备: 4
- 温度可参考: 4
- 设定反馈可参考: 3
- 签核进度: 0/8
- 真实写入副作用: 无

## 现场填写顺序

1. 先恢复所有 communication_alarm。
2. 再处理 0°C、无效温度和温度质量门槛。
3. 再把设定反馈拉回 10-32°C。
4. 最后核对写点、连续两次采样、手动锁定和 release。

## 逐台设备

### BGS03 办公室03
- 当前异常: 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界
- 当前值: 通讯报警=true，温度=0，设定=0
- 复核草稿: 无
- 草稿不可自动填: communicationAlarmAfter；zoneTemperatureAfterC；setpointFeedbackAfterC
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=必填：5-45；setpointFeedbackAfterC=必填：10-32；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度

### BGS04 办公室04
- 当前异常: 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界
- 当前值: 通讯报警=true，温度=0，设定=0
- 复核草稿: 无
- 草稿不可自动填: communicationAlarmAfter；zoneTemperatureAfterC；setpointFeedbackAfterC
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=必填：5-45；setpointFeedbackAfterC=必填：10-32；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度

### BGS06 办公室06
- 当前异常: 通讯报警未恢复
- 当前值: 通讯报警=true，温度=22，设定=24
- 复核草稿: zoneTemperatureAfterC=22；setpointFeedbackAfterC=24
- 草稿不可自动填: communicationAlarmAfter
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=可选；setpointFeedbackAfterC=可选；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定

### GCBGQ03 工程办公区03
- 当前异常: 通讯报警未恢复、设定反馈越界
- 当前值: 通讯报警=true，温度=31，设定=19
- 复核草稿: zoneTemperatureAfterC=31；setpointFeedbackAfterC=19
- 草稿不可自动填: communicationAlarmAfter
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=可选；setpointFeedbackAfterC=可选；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定

### QT02 前厅02
- 当前异常: 通讯报警未恢复
- 当前值: 通讯报警=true，温度=26，设定=26
- 复核草稿: zoneTemperatureAfterC=26；setpointFeedbackAfterC=26
- 草稿不可自动填: communicationAlarmAfter
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=可选；setpointFeedbackAfterC=可选；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定

### WSJ02 卫生间02
- 当前异常: 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界
- 当前值: 通讯报警=true，温度=0，设定=0
- 复核草稿: 无
- 草稿不可自动填: communicationAlarmAfter；zoneTemperatureAfterC；setpointFeedbackAfterC
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=必填：5-45；setpointFeedbackAfterC=必填：10-32；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度

### ZHYS 中会议室
- 当前异常: 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界
- 当前值: 通讯报警=true，温度=0，设定=0
- 复核草稿: 无
- 草稿不可自动填: communicationAlarmAfter；zoneTemperatureAfterC；setpointFeedbackAfterC
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=必填：5-45；setpointFeedbackAfterC=必填：10-32；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定；0°C 原始点恢复为有效温度

### ZZBGS 周总
- 当前异常: 通讯报警未恢复、设定反馈越界
- 当前值: 通讯报警=true，温度=24，设定=35
- 复核草稿: zoneTemperatureAfterC=24
- 草稿不可自动填: communicationAlarmAfter；setpointFeedbackAfterC
- 必填项: workOrderId=；deviceCode=；deviceName=；handledBy=必填：现场处理人；handledAt=必填：ISO时间；communicationAlarmAfter=必填：0；zoneTemperatureAfterC=可选；setpointFeedbackAfterC=必填：10-32；writePointMappingChecked=必填：yes/no；twoSampleNormal=必填：yes/no；localManualLockout=必填：none/manual/lockout；releaseDecision=必填：hold/recheck/release；reviewedBy=必填：复核人；reviewedAt=必填：ISO时间；notes=
- 验收: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内；启停、设定、风速写点均已映射且 writable=true；quality.status=ok；连续两次采样保持正常；未处于本地手动/禁控/回退锁定

## 回填后必须重跑

- `npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff`
- `npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout`
- `npm --prefix apps/chiller-bff run build:fcu-final-control-worklist`
- `npm --prefix apps/chiller-bff run build:fcu-final-control-runbook`
- `npm --prefix apps/chiller-bff run check:fcu-final-control-evidence-consistency`

## 安全边界

- 本模板只用于现场回填和复核，不产生 BA/PLC 写入。
- reviewDraft 只给现场复核参考，不自动写入 signoff 输入表。
- release 只是现场放行意见，不等于系统允许真实下发。
- 所有设备仍必须通过实时 closeout、Canary readiness 和最终总门禁。
