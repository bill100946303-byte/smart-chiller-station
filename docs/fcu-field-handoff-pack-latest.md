# FCU 现场交接包

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 最终门禁未通过，本包只用于现场消缺和签核，不允许真实 BA/PLC 写入。
- 待处理 P0 FCU: 8
- 过期签核行: 1
- 现场签核: 0/8
- 下一步: 先清理过期签核行，生成 current-only 输入表。
- 控制写入副作用: 无

## 今日现场顺序

- restore_communication: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 通讯报警为 0，连续两次采样正常。
- restore_temperature: 4 台 (BGS03、BGS04、WSJ02、ZHYS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 温度在 5-45°C，0°C/越界温度消失。
- normalize_setpoint_feedback: 6 台 (BGS03、BGS04、GCBGQ03、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 设定反馈留空或在 10-32°C，并与现场面板一致。
- verify_write_mapping: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 写点映射核对完成，本包不产生写入。
- two_sample_validation: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 连续两次 BA 采样均正常。
- onsite_signoff: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 处理和复核签字完整，releaseDecision=release。
- rerun_closeout: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；负责人: BA/自控工程师 / 平台工程师 + BA工程师 / 现场值班 / 平台工程师；验收: 重跑证据链后 closeout/canary readiness 不再被现场 P0 卡住。

## 先清理的过期签核行

- FCU-P0-CWS CWS 财务室: not_in_current_work_orders

## 逐台交接

### BGS03 办公室03
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### BGS04 办公室04
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### BGS06 办公室06
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警
- 当前值: 温度 22°C，设定 24°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### GCBGQ03 工程办公区03
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、设定反馈越界
- 当前值: 温度 31°C，设定 19°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### QT02 前厅02
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警
- 当前值: 温度 26°C，设定 26°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### WSJ02 卫生间02
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### ZHYS 中会议室
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界
- 当前值: 温度 0°C，设定 0°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

### ZZBGS 周总
- 负责人: BA/自控工程师
- 阻断原因: 通讯报警、设定反馈越界
- 当前值: 温度 24°C，设定 35°C，通讯报警 true
- 今日动作: 先恢复通讯报警，再做温度和设定反馈复核。
- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt

## 回传文件

- 现场签核输入表: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv
- current-only 输入表: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-current-only-latest.csv
- 过期行清单: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-stale-rows-latest.csv

## 安全边界

- 本交接包不产生 BA/PLC 写入。
- releaseDecision=release 只是现场签核结果，不等于系统自动放行。
- 必须重跑质量整改、closeout、signoff、Canary readiness 和最终总门禁。
- 首台 Canary 反馈确认前，不允许小批量或全量下发。
