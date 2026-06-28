# FCU 首台 Canary 执行包

- 站点: 126lnoffice
- 首台: 刘总办公室 LZBGS
- 结论: canary_package_ready_with_open_gates
- 控制写入副作用: 无，当前仅生成执行包
- 生成时间: 2026-06-18T03:46:35.678Z

## 执行命令

```bash
FCU_CANARY_DEVICE_CODE=LZBGS FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch
```

## 前置条件

| 条件 | 状态 | 证据 | 处理动作 |
|---|---|---|---|
| 上线前预检 | 未满足 | go_live_blocked | npm --prefix apps/chiller-bff run check:fcu-go-live-preflight |
| 现场 Arm-Check | 未满足 | field_arm_blocked | npm --prefix apps/chiller-bff run check:fcu-field-arm |
| Canary 队列 | 通过 | target=LZBGS, first=BGS01 devices=2 | npm --prefix apps/chiller-bff run build:fcu-canary-queue |
| 首台数据质量 | 通过 | not_in_p0_quality_list | 如为 P0，先按 docs/fcu-quality-remediation-latest.csv 完成现场整改。 |
| BA 写入二次确认 | 未满足 | requires FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE | export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE |
| BFF 写入总闸 | 未满足 | requires /healthz readOnlyMode=false | READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev |

## 反馈验收

| 检查项 | 期望 |
|---|---|
| 执行报告 verification.recordStatus | feedback_confirmed |
| docs/fcu-final-control-completion-latest.json milestones.canary.ok | true |
| Canary 执行报告 controlMutation | true，仅在授权真实写入窗口内允许 |
| 执行报告 rollback / blockers | 无 rollback，阻断项为空 |

## 回退触发

- 60-120 秒内反馈未变更为 feedback_confirmed
- 反馈值与执行单目标不一致或 verify-feedback 返回 mismatch/failed
- 通讯报警、0°C/越界温度、就地/手动模式、本地锁定任一出现
- 现场人员报告投诉、禁控或面板抢控制
- 回退失败时进入 rollback_watch，禁止继续 Canary 或扩批

## 最终验收

- LZBGS 单台真实写入执行报告 mode=confirmed_canary_dispatch
- verification.recordStatus=feedback_confirmed
- 最终完成度检查 canary.ok=true 且 canary.feedbackStatus=feedback_confirmed
- 无通讯报警、无 0°C/越界温度、无本地手动抢控制
- 审计记录包含 actor、recordId、deviceCode、command、dispatchReceipt、feedback verification
