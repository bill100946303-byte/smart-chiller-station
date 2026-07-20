# FCU 最终控制编排结果

- 站点: 126lnoffice
- 模式: blocked_or_dry_run
- 结论: 最终控制未完成
- 控制写入副作用: 无
- 生成时间: 2026-06-18T08:53:08.266Z

## 阶段

| 阶段 | 状态 | exit | 产物 |
|---|---|---:|---|
| 生成小批量预演执行单 | 通过 | 0 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-small-batch-dispatch-plan-latest.json |
| 生成全量分批计划 | 通过 | 0 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-all-device-dispatch-plan-latest.json |
| 上线前预检 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-go-live-preflight-latest.json |
| 生成首台 Canary 队列 | 通过 | 0 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-queue-latest.json |
| 生成最终控制 Runbook | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-runbook-latest.json |
| 现场 Arm-Check | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-arm-check-latest.json |
| 生成首台 Canary 执行包 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-latest.json |
| BA 写适配器自检 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-latest.json |
| Canary 总门禁 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-readiness-latest.json |
| 最终控制总门禁 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-gates-latest.json |
| 最终控制完成度检查 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-completion-latest.json |
| 生成最终控制投运清单 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-worklist-latest.json |
| 执行首台 Canary | 跳过 | -- | missing FCU_FINAL_CONTROL_ROLLOUT_CONFIRM |
| 执行小批量 | 跳过 | -- | missing FCU_FINAL_CONTROL_ROLLOUT_CONFIRM |
| 执行全量波次 | 跳过 | -- | missing FCU_FINAL_CONTROL_ROLLOUT_CONFIRM |

## 阻断项

- final_rollout_confirm_missing: 必须设置 FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE 才允许调用真实 Canary/小批量执行脚本。
- small_batch_confirm_missing: 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。
- goLivePreflight_failed: phase exit=2
- fieldArm_failed: phase exit=2
- canaryReadiness_failed: phase exit=2
- finalGates_failed: phase exit=2
- finalCompletion_failed: phase exit=2

## 下一步

- P0 现场授权最终控制总确认: 没有该总确认时编排脚本不会调用真实下发阶段。
  - `export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE`
- P0 设置 BA 写入确认短语: 执行脚本二次确认真实写入。
  - `export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE`
- P0 后端写入总闸: readOnlyMode=true 或无法确认。
- P0 现场 Arm-Check ready: ok=false, verdict=field_arm_blocked
- P0 首台真实下发完成: ok=false, mode=blocked_before_canary_dispatch, controlMutation=false
- P0 首台反馈确认: verification.recordStatus=--
- P0 小批量反馈确认: ok=false, mode=blocked_before_dispatch, devices=0, feedbackConfirmed=false
- P0 全量 FCU 反馈确认: confirmedDevices=0, targetDevices=29
