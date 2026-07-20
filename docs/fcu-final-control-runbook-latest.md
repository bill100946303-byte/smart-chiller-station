# FCU 最终控制现场执行 Runbook

- 站点: 126lnoffice
- 结论: 最终总门禁未通过，禁止真实 BA/PLC 写入。
- 最终门禁: 0/8 通过，阻断 8
- Canary readiness: blocked
- 现场签核: 0/8 完成
- 过期签核行: 1 行，必须先清理后再让现场填写
- 控制写入副作用: 无
- 生成时间: 2026-06-18T11:06:25.453Z

## 当前阻断

- 数据质量 P0 / 8 台 P0: 仍有通讯/温度/反馈硬阻断设备
- 全量分批计划 / immediate=9, staged=12, blocked=8: 仍有 blocked 或 staged 设备
- 现场执行包 / 8 台待处理: 现场执行包仍有 P0 设备
- 现场 closeout / field_remediation_open: 现场消缺未关闭
- 现场签字 / 0/8: 现场签字未完成
- Canary readiness / canary_blocked: Canary 总门禁阻断
- 最终完成 / final_control_incomplete: 首台/小批量/全量反馈未全部闭环
- 最终 worklist / worklist_open: 最终投运清单仍有未完成动作

## 过期签核行

- 以下行不在当前现场工单内，不能继续让现场填写；先执行清理命令生成 current-only 输入表。
- FCU-P0-CWS CWS 财务室: not_in_current_work_orders

清理命令:

`npm --prefix apps/chiller-bff run build:fcu-field-remediation-signoff-clean-input && FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input`

## 未签核 FCU

- BGS03 办公室03: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- BGS04 办公室04: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- BGS06 办公室06: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- GCBGQ03 工程办公区03: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- QT02 前厅02: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- WSJ02 卫生间02: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- ZHYS 中会议室: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout
- ZZBGS 周总: signoff_incomplete；缺字段 handledBy, handledAt, reviewedBy, reviewedAt, releaseDecision, communicationAlarmAfter, zoneTemperatureAfterC, writePointMappingChecked, twoSampleNormal, localManualLockout

## 下一步动作

- [P0] 整改通讯报警、0°C/无效温度和写点缺失设备：8 台 P0 FCU
  - 命令: `npm --prefix apps/chiller-bff run check:fcu-quality-remediation`
  - 验收: communicationAlarm=0，zoneTemperatureC 在 5-45°C，启停/设定/风速写点映射通过，quality.status=ok，连续两次采样正常
- [P1] 分步拉回设定反馈越界 FCU：12 台 FCU
  - 命令: `npm --prefix apps/chiller-bff run plan:fcu-all-device-dispatch`
  - 验收: 全量分批计划 stagedSetpoint=0，或每台设备形成已审批的分步执行记录和反馈确认。
- [P0] 执行首台 Canary 并确认反馈：BGS01
  - 命令: `FCU_CANARY_DEVICE_CODE=BGS01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
  - 验收: canary mode=confirmed_canary_dispatch 且 verification.recordStatus=feedback_confirmed
- [P0] 设置最终控制总确认短语：FCU_FINAL_CONTROL_ROLLOUT_CONFIRM
  - 命令: `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE`
  - 验收: 最终编排报告 confirm.finalRolloutConfirmPresent=true
- [P0] 重跑现场 Arm-Check：BGS01
  - 命令: `npm --prefix apps/chiller-bff run check:fcu-field-arm`
  - 验收: docs/fcu-field-arm-check-latest.json verdict=field_arm_ready
- [P0] 关闭 BFF 只读总闸并重启：READ_ONLY_MODE / CHILLER_READ_ONLY_MODE
  - 命令: `READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev`
  - 验收: /healthz readOnlyMode=false，且 Arm-Check backend_write_gate 通过
- [P0] 重跑上线前预检：FCU go-live preflight
  - 命令: `npm --prefix apps/chiller-bff run check:fcu-go-live-preflight`
  - 验收: docs/fcu-go-live-preflight-latest.json verdict=go_live_ready
- [P0] 设置 BA 写入确认短语：FCU_SMALL_BATCH_CONFIRM
  - 命令: `export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE`
  - 验收: 最终编排报告 confirm.smallBatchConfirmPresent=true

## 安全执行顺序

### 刷新数据质量与现场消缺证据

`npm --prefix apps/chiller-bff run check:fcu-quality-remediation && npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout`

### 清理过期签核行并复核

`npm --prefix apps/chiller-bff run build:fcu-field-remediation-signoff-clean-input && FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input && npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff`

### 刷新 Canary readiness 与最终总门禁

`npm --prefix apps/chiller-bff run check:fcu-canary-readiness && FCU_FINAL_CONTROL_GATES_REFRESH=false npm --prefix apps/chiller-bff run check:fcu-final-control-gates`

### 最终总门禁全部通过后，才允许执行真实写入编排

`FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-final-control-rollout`

- 会请求真实 BA 写入；必须最终总门禁通过且现场授权后执行。

## 证据文件

- finalGates: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-gates-latest.json
- finalWorklist: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-worklist-latest.json
- signoff: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.json
- signoffClean: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-clean-input-latest.json
- closeout: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.json
- canaryReadiness: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-readiness-latest.json
- allDevicePlan: ok / /Users/billchow/Documents/智慧冷冻站/docs/fcu-all-device-dispatch-plan-latest.json
- finalCompletion: blocked/missing / /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-completion-latest.json
