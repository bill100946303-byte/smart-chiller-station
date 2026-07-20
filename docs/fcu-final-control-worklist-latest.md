# FCU 最终控制投运清单

- 站点: 126lnoffice
- 结论: 仍需处理
- 首台 Canary: WSJ01
- 全量反馈: 0/29
- P0 动作: 11
- 生成时间: 2026-06-20T04:31:52.377Z

## 阶段

| 阶段 | 状态 | 证据 |
|---|---|---|
| 现场授权 | blocked | finalRollout.confirm/env |
| 写入环境 | blocked | health.readOnlyMode |
| 上线前预检 | blocked | goLivePreflight |
| 现场 Arm-Check | blocked | fieldArm |
| Canary 总门禁 | blocked | canary_blocked |
| 首台 Canary | blocked | WSJ01 |
| 小批量 | pending | 0 台 |
| 质量整改 | blocked | 8 台 P0 |
| 设定分步拉回 | blocked | 12 台 |
| 现场消缺关闭 | blocked | field_remediation_open |
| 签字输入 | blocked | 1 行旧工单 |
| 现场签字 | blocked | 0/8 |
| 全量反馈 | blocked | 0/29 |

## 动作清单

| 优先级 | 阶段 | 动作 | 对象 | 命令 | 验收 |
|---|---|---|---|---|---|
| P0 | authorization | 设置最终控制总确认短语 | FCU_FINAL_CONTROL_ROLLOUT_CONFIRM | `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE` | 最终编排报告 confirm.finalRolloutConfirmPresent=true |
| P0 | authorization | 设置 BA 写入确认短语 | FCU_SMALL_BATCH_CONFIRM | `export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE` | 最终编排报告 confirm.smallBatchConfirmPresent=true |
| P0 | environment | 关闭 BFF 只读总闸并重启 | READ_ONLY_MODE / CHILLER_READ_ONLY_MODE | `READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev` | /healthz readOnlyMode=false，且 Arm-Check backend_write_gate 通过 |
| P0 | preflight | 重跑上线前预检 | FCU go-live preflight | `npm --prefix apps/chiller-bff run check:fcu-go-live-preflight` | docs/fcu-go-live-preflight-latest.json verdict=go_live_ready |
| P0 | field_arm | 重跑现场 Arm-Check | WSJ01 | `npm --prefix apps/chiller-bff run check:fcu-field-arm` | docs/fcu-field-arm-check-latest.json verdict=field_arm_ready |
| P0 | canary | 执行首台 Canary 并确认反馈 | WSJ01 | `FCU_CANARY_DEVICE_CODE=WSJ01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch` | canary mode=confirmed_canary_dispatch 且 verification.recordStatus=feedback_confirmed |
| P0 | quality | 整改通讯报警、0°C/无效温度和写点缺失设备 | 8 台 P0 FCU | `npm --prefix apps/chiller-bff run check:fcu-quality-remediation` | communicationAlarm=0，zoneTemperatureC 在 5-45°C，启停/设定/风速写点映射通过，quality.status=ok，连续两次采样正常 |
| P1 | setpoint_normalization | 分步拉回设定反馈越界 FCU | 12 台 FCU | `npm --prefix apps/chiller-bff run plan:fcu-all-device-dispatch` | 全量分批计划 stagedSetpoint=0，或每台设备形成已审批的分步执行记录和反馈确认。 |
| P0 | field_closeout | 关闭 FCU 现场 P0 消缺后再进入 Canary | 8 台未关闭 | `npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout` | docs/fcu-field-remediation-closeout-latest.json verdict=field_remediation_ready_for_canary |
| P0 | signoff_input | 确认提升 current-only 现场签字输入并归档旧行 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv | `FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input` | fcu-field-remediation-signoff-promote-latest.json fileMutation=true，confirmMatched=true；随后重跑 check:fcu-field-remediation-signoff |
| P0 | field_signoff | 补齐 FCU 现场消缺签字和复核字段 | 0/8 行已完成 | `npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff` | fcu-field-remediation-signoff-latest.json summary.signoffComplete=true；随后重跑 closeout 和 Canary readiness |
| P0 | canary_readiness | 通过 FCU Canary 总门禁后再执行首台下发 | WSJ01 | `npm --prefix apps/chiller-bff run check:fcu-canary-readiness` | docs/fcu-canary-readiness-latest.json verdict=canary_ready 且 summary.canaryReady=true |

## P0 质量设备

- BGS02 办公室02: setpoint_feedback_out_of_bounds
  - 复核设定反馈点 BGS02-506-40207，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- BGS03 办公室03: communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS03-502-40078 是否仍为 1。
- BGS04 办公室04: communication_alarm, zero_temperature, invalid_temperature, temperature_quality_guard, setpoint_feedback_out_of_bounds
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS04-502-40158 是否仍为 1。
- BGS06 办公室06: communication_alarm
  - 现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。
  - 核对通讯报警点 BGS06-502-40166 是否仍为 1。
- CWS 财务室: setpoint_feedback_out_of_bounds
  - 复核设定反馈点 CWS-506-40255，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- DHYS 大会议室: setpoint_feedback_out_of_bounds
  - 复核设定反馈点 DHYS-506-40607，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- GCBGQ01 工程办公区01: setpoint_feedback_out_of_bounds
  - 复核设定反馈点 GCBGQ01-506-40479，超出策略边界时禁止自动闭环，需人工确认后分步拉回。
- GCBGQ02 工程办公区02: setpoint_feedback_out_of_bounds
  - 复核设定反馈点 GCBGQ02-506-40495，超出策略边界时禁止自动闭环，需人工确认后分步拉回。

## 现场消缺作战表

- 首台 Canary: WSJ01
- Canary 是否被现场消缺阻断: 是
- 待处理设备: 8
- 推荐顺序:
  - 先处理 communication_alarm：恢复控制器供电、通讯线、地址、网关轮询和 BA 报警复位。
  - 再处理 zero_temperature / invalid_temperature：确认温度点不是 0°C、断线值或量程错误。
  - 再处理 setpoint_feedback_out_of_bounds：将设定反馈分步拉回 10-32°C 策略边界内。
  - 最后核对启停、设定、风速写点 writable=true，并连续两次采样正常。

| 阻断类别 | 设备 |
|---|---|
| communication_alarm | BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS |
| zero_temperature | BGS03、BGS04、WSJ02、ZHYS |
| invalid_temperature | BGS03、BGS04、WSJ02、ZHYS |
| temperature_quality_guard | BGS03、BGS04、WSJ02、ZHYS |
| setpoint_feedback_out_of_bounds | BGS03、BGS04、GCBGQ03、WSJ02、ZHYS、ZZBGS |

| 设备 | 当前阻断 | 待补字段 | 现场顺序 |
|---|---|---|---|
| BGS03 办公室03 | 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 温度点复核 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| BGS04 办公室04 | 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 温度点复核 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| BGS06 办公室06 | 通讯报警未恢复 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| GCBGQ03 工程办公区03 | 通讯报警未恢复、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| QT02 前厅02 | 通讯报警未恢复 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| WSJ02 卫生间02 | 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 温度点复核 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| ZHYS 中会议室 | 通讯报警未恢复、温度点为0°C、温度无效、温度质量门槛未通过、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 温度点复核 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |
| ZZBGS 周总 | 通讯报警未恢复、设定反馈越界 | handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout | 通讯恢复 -> 设定反馈拉回 -> 写点映射复核 -> 连续两次采样 -> 现场双人签核 |


## 首台 Canary 执行包

- 设备: WSJ01
- 状态: canary_package_ready_with_open_gates
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-latest.csv
## 现场消缺关闭

- 状态: field_remediation_open
- 可进入 Canary: 否
- 未关闭设备: 8
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.csv

## 现场消缺工单

- 工单数: 8
- 未关闭: 8
- 需要现场签字: 是
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-work-orders-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-work-orders-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-work-orders-latest.csv
- 现场填写 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv

## 现场消缺执行包

- 待处理设备: 8
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-execution-pack-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-execution-pack-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-execution-pack-latest.csv
- restore_communication: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；验收: 通讯报警为 0，连续两次采样正常。
- restore_temperature: 4 台 (BGS03、BGS04、WSJ02、ZHYS)；验收: 温度在 5-45°C，0°C/越界温度消失。
- normalize_setpoint_feedback: 6 台 (BGS03、BGS04、GCBGQ03、WSJ02、ZHYS、ZZBGS)；验收: 设定反馈留空或在 10-32°C，并与现场面板一致。
- verify_write_mapping: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；验收: 写点映射核对完成，本包不产生写入。
- two_sample_validation: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；验收: 连续两次 BA 采样均正常。
- onsite_signoff: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；验收: 处理和复核签字完整，releaseDecision=release。
- rerun_closeout: 8 台 (BGS03、BGS04、BGS06、GCBGQ03、QT02、WSJ02、ZHYS、ZZBGS)；验收: 重跑证据链后 closeout/canary readiness 不再被现场 P0 卡住。

## 现场交接包

- 待处理 P0: 8
- 过期签核行: 1
- 现场签核: 0/8
- 下一步: 先清理过期签核行，生成 current-only 输入表。
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-handoff-pack-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-handoff-pack-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-handoff-pack-latest.csv
- current-only CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-current-only-latest.csv
- BGS03 办公室03: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。
- BGS04 办公室04: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。
- BGS06 办公室06: 通讯报警；先恢复通讯报警，再做温度和设定反馈复核。
- GCBGQ03 工程办公区03: 通讯报警、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。
- QT02 前厅02: 通讯报警；先恢复通讯报警，再做温度和设定反馈复核。
- WSJ02 卫生间02: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。
- ZHYS 中会议室: 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。
- ZZBGS 周总: 通讯报警、设定反馈越界；先恢复通讯报警，再做温度和设定反馈复核。

## 现场回填模板

- 待回填设备: 8
- 通讯阻断: 8
- 温度阻断: 4
- 设定反馈阻断: 6
- 可参考草稿设备: 4
- 温度可参考: 4
- 设定反馈可参考: 3
- 现场签核: 0/8
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-return-template-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-return-template-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-return-template-latest.csv
- BGS03 办公室03: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- BGS04 办公室04: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- BGS06 办公室06: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
  - 复核草稿: zoneTemperatureAfterC:22；setpointFeedbackAfterC:24
- GCBGQ03 工程办公区03: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
  - 复核草稿: zoneTemperatureAfterC:31；setpointFeedbackAfterC:19
- QT02 前厅02: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
  - 复核草稿: zoneTemperatureAfterC:26；setpointFeedbackAfterC:26
- WSJ02 卫生间02: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- ZHYS 中会议室: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
- ZZBGS 周总: 待补字段 handledBy、handledAt、reviewedBy、reviewedAt、releaseDecision、communicationAlarmAfter、zoneTemperatureAfterC、writePointMappingChecked、twoSampleNormal、localManualLockout
  - 复核草稿: zoneTemperatureAfterC:24

## 现场签字校验

- 签字完成: 否
- 完成行: 0/8
- 仍需实时 closeout: 是
- 现场放行预检: 0 ready / 8 blocked；Canary 仍阻断 8 台
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.csv
- 逐台放行矩阵 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest-release-matrix.csv
- 输入 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv

## 现场签字输入清理包

- 当前有效行: 8
- 旧行: 1
- 补生成缺失行: 0
- 当前有效 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-current-only-latest.csv
- 旧行归档 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-stale-rows-latest.csv
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-clean-input-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-clean-input-latest.md

## 现场签字输入提升

- 模式: dry_run
- 已确认: 否
- 文件写入: 否
- 当前有效行: 8
- 旧行: 1
- 目标输入 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv
- 备份 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest-backup-20260618110625.csv
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-promote-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-promote-latest.md

## Canary 总门禁

- 状态: canary_blocked
- 可执行 Canary: 否
- 阻断项: 5
- 首台: WSJ01
- Readiness 作战表: 1 ready / 5 blocked
- 第一阻断: 现场签字 / 现场/运维
- 第一动作: 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff

| 阶段 | 责任 | 状态 | 证据 | 下一步 |
|---|---|---|---|---|
| 现场签字 | 现场/运维 | 阻断 | 0/8 complete | 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff |
| 实时消缺 | 现场/平台 | 阻断 | field_remediation_open remaining=8 | 重跑 check:fcu-field-remediation-closeout，必须 field_remediation_ready_for_canary |
| 现场授权 | 现场/BA | 阻断 | field_arm_blocked first=WSJ01 | 重跑 check:fcu-field-arm，现场授权、窗口、确认短语和 readOnly 必须通过 |
| BA写适配器 | BA/自控 | 阻断 | ba_write_adapter_blocked blockers=3 | 重跑 check:fcu-ba-write-adapter-readiness，写点映射、确认短语和执行闸门必须通过 |
| Canary执行包 | 平台 | 阻断 | canary_package_ready_with_open_gates device=WSJ01 | 重跑 build:fcu-canary-execution-package，确保 blockers 为空 |
| 安全边界 | 平台 | 通过 | all referenced reports controlMutation=false | 保持当前证据，继续下一门禁。 |
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-readiness-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-readiness-latest.md

## 最终控制现场执行包

- 状态: blocked
- 设备队列: 8/8 未放行
- Canary 就绪设备: 0
- 现场签核: 0/8
- 最终核对清单: 0/4
- 第一阻断: 现场签核
- 下一步: 全部当前工单 release 后重跑 signoff。
- 写入副作用: 无
- 真实下发: 无
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-field-execution-pack-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-field-execution-pack-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-field-execution-pack-latest.csv

| 放行项 | 状态 | 细节 | 下一步 |
|---|---|---|---|
| 现场签核 | 阻断 | 0/8 | 全部当前工单 release 后重跑 signoff。 |
| 实时 closeout | 阻断 | P0 8 台 | 关闭 P0 消缺并重跑 closeout。 |
| Canary readiness | 阻断 | canary_blocked | 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff |
| 最终总门禁 | 阻断 | 0/8 | 最终总门禁未全绿前禁止真实 BA 写入。 |

| 顺序 | 设备 | Canary | 阻断 | 今日动作 |
|---|---|---|---|---|
| 1 | BGS03 办公室03 | 阻断 | 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 2 | BGS04 办公室04 | 阻断 | 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 3 | BGS06 办公室06 | 阻断 | 通讯报警 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 4 | GCBGQ03 工程办公区03 | 阻断 | 通讯报警、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 5 | QT02 前厅02 | 阻断 | 通讯报警 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 6 | WSJ02 卫生间02 | 阻断 | 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 7 | ZHYS 中会议室 | 阻断 | 通讯报警、0°C异常、温度无效、温度质量门槛、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |
| 8 | ZZBGS 周总 | 阻断 | 通讯报警、设定反馈越界 | 先恢复通讯报警，再做温度和设定反馈复核。 |


## BA 写适配器自检包

- 设备: WSJ01
- 状态: ba_write_adapter_blocked
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-latest.csv

## 首台 Canary 反馈监视

- 设备: BGS01
- 状态: waiting_for_canary_dispatch
- 反馈: --
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-feedback-monitor-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-feedback-monitor-latest.md
- CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-feedback-monitor-latest.csv

## 首台 Canary 投运窗口

- 设备: BGS01
- 状态: canary_window_blocked
- 模式: blocked_before_dispatch
- 写入副作用: 无
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-window-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-window-latest.md

## 现场授权准备

- 状态: ready
- 已写配置中心: 是
- Dry-run: 否
- 授权窗口生效: 否
- 写入副作用: 无
- JSON: /Users/billchow/Documents/智慧冷冻站/docs/fcu-site-authorization-latest.json
- Markdown: /Users/billchow/Documents/智慧冷冻站/docs/fcu-site-authorization-latest.md
