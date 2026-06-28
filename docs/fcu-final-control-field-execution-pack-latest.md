# FCU 最终控制现场执行包

- 站点: 126lnoffice
- 结论: 最终放行前仍阻断
- 设备: 0/8 台可进 Canary
- 签核: 0/8
- 核对清单: 0/4
- 第一阻断: 现场签核
- 下一步: 全部当前工单 release 后重跑 signoff。
- 控制写入副作用: 无

## 最终放行前核对清单

- 现场签核: 阻断；0/8；全部当前工单 release 后重跑 signoff。
- 实时 closeout: 阻断；P0 8 台；关闭 P0 消缺并重跑 closeout。
- Canary readiness: 阻断；canary_blocked；填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff
- 最终总门禁: 阻断；0/8；最终总门禁未全绿前禁止真实 BA 写入。

## 逐台现场执行队列

### 1. BGS03 办公室03
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 2. BGS04 办公室04
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 3. BGS06 办公室06
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 4. GCBGQ03 工程办公区03
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 5. QT02 前厅02
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 6. WSJ02 卫生间02
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 7. ZHYS 中会议室
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

### 8. ZZBGS 周总
- 状态: 待现场签核
- 负责人: BA/自控工程师
- 阻断/缺项: handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- 现场动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 放行标准: communicationAlarm=0；zoneTemperatureC 在 5-45°C；setpointFeedbackC 在策略允许范围内

## 安全边界

- 本现场执行包只用于最终控制投运前的现场签核和证据核对。
- 本脚本不调用 control-cycle、control-command、Canary dispatch 或任何 BA/PLC 写入接口。
- deviceQueue 中 canEnterCanary=true 也不等于允许真实下发。
- 必须由 3001 单台确认、后端总闸、审计和反馈回退共同放行。
