# FCU 现场消缺签字校验

- 站点: 126lnoffice
- 工单数: 8
- 签字完成: 否
- 完成行: 0/9
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:47.722Z

## 关键边界

- 本校验只确认现场工单填写完整性。
- 即使全部签字完成，也必须重跑实时质量整改、全量分批计划和 closeout，不能凭 CSV 直接进入 BA 写入。

## 现场放行预检

- 现场签字候选: 0/8
- 现场仍阻断: 8
- Canary 仍阻断: 8
- 下一步: 补齐所有 onsiteReleaseReady=false 的现场签字字段；重跑 check:fcu-field-remediation-signoff；重跑 check:fcu-field-remediation-closeout；重跑 check:fcu-canary-readiness；重跑 check:fcu-final-control-gates

- 忽略旧工单行: 1

## 未通过记录

### FCU-P0-BGS03 办公室03

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-BGS04 办公室04

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-BGS06 办公室06

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-GCBGQ03 工程办公区03

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-QT02 前厅02

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-WSJ02 卫生间02

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-ZHYS 中会议室

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

### FCU-P0-ZZBGS 周总

- 问题: handledBy_missing；handledAt_missing；reviewedBy_missing；reviewedAt_missing；releaseDecision_not_release；communicationAlarmAfter_not_0；zoneTemperatureAfterC_out_of_range；writePointMappingChecked_not_yes；twoSampleNormal_not_yes；localManualLockout_not_none
- handledBy: 应填 现场处理人姓名；填写实际处理人，不能用空值或系统默认值。
- handledAt: 应填 现场处理完成时间，建议 ISO 时间；填写处理完成时间，例如 2026-06-18T10:00:00+08:00。
- reviewedBy: 应填 复核人姓名；填写复核人，建议由非处理人或现场负责人复核。
- reviewedAt: 应填 复核完成时间，建议 ISO 时间；填写复核完成时间。
- releaseDecision: 应填 release；只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。
- communicationAlarmAfter: 应填 0；复检 BA 通讯报警点，确认报警复位后填写 0。
- zoneTemperatureAfterC: 应填 5-45；填写现场复检后的区域温度，0°C 或越界值必须先修复点位。
- writePointMappingChecked: 应填 yes；逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。
- twoSampleNormal: 应填 yes；连续两次采样通讯、温度、反馈均正常后填写 yes。
- localManualLockout: 应填 none；确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。

