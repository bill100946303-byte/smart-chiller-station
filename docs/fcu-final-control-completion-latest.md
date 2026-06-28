# FCU 最终控制完成度检查

- 站点: 126lnoffice
- 范围: fcu_all_device_final_control
- 结论: 最终控制未完成
- verdict: final_control_incomplete
- 首台 Canary: WSJ01
- 反馈状态: --
- 控制写入副作用证据: 无
- 生成时间: 2026-06-20T04:31:52.303Z

## 阶段进度

| 阶段 | 状态 | 证据 |
|---|---|---|
| 首台 Canary | 未完成 | BGS01 / -- |
| 小批量 | 未完成 | 0 台 / feedbackConfirmed=false |
| 全量 FCU | 未完成 | 0/29 台 |

## 全量分批计划

- 总 FCU: 29
- 设备侧就绪: 9
- 可立即执行: 9
- 需分步调设定: 12
- 质量/通讯阻断: 8
- 波次数: 4
- 主要阻断: communication_alarm=8, invalid_temperature=8, temperature_quality_guard=8, setpoint_feedback_out_of_bounds=6, setpoint_feedback_valid=6

## 质量整改

- 需整改: 20
- P0: 8
- 可进入全量最终控制: 否
- 设备: BGS02, BGS03, BGS04, BGS06, CWS, DHYS, GCBGQ01, GCBGQ02, GCBGQ03, JDS, QT01, QT02, QTS, SYS, TNFBQ01, TNFBQ02, WSJ02, XZBGS, ZHYS, ZZBGS
- 原因: setpoint_feedback_out_of_bounds=18, communication_alarm=8, zero_temperature=4, invalid_temperature=4, temperature_quality_guard=4

## 检查项

| 检查 | 状态 | 说明 |
|---|---|---|
| BFF 服务在线 | 通过 | BFF /healthz 可读取。 |
| 后端写入总闸 | P0 | readOnlyMode=true 或无法确认。 |
| Arm-Check 报告存在 | 通过 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-arm-check-latest.json |
| 现场 Arm-Check ready | P0 | ok=false, verdict=field_arm_blocked |
| Canary 报告存在 | 通过 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-dispatch-latest.json |
| 首台 Canary 设备一致 | P0 | firstCanary=WSJ01, canaryDevice=BGS01 |
| 首台真实下发完成 | P0 | ok=false, mode=blocked_before_canary_dispatch, controlMutation=false |
| 首台反馈确认 | P0 | verification.recordStatus=-- |
| 首台未触发回退 | 通过 | 未发现 rollback 记录。 |
| 小批量反馈确认 | P0 | ok=false, mode=blocked_before_dispatch, devices=0, feedbackConfirmed=false |
| 全量白名单策略存在 | 通过 | ok=true, targetCount=29 |
| 全量 FCU 反馈确认 | P0 | confirmedDevices=0, targetDevices=29 |

## P0 阻断

- backend_write_gate: readOnlyMode=true 或无法确认。
- field_arm_ready: ok=false, verdict=field_arm_blocked
- canary_device_matches: firstCanary=WSJ01, canaryDevice=BGS01
- canary_dispatch_confirmed: ok=false, mode=blocked_before_canary_dispatch, controlMutation=false
- canary_feedback_confirmed: verification.recordStatus=--
- small_batch_confirmed: ok=false, mode=blocked_before_dispatch, devices=0, feedbackConfirmed=false
- all_device_feedback_confirmed: confirmedDevices=0, targetDevices=29

## 下一步

| 优先级 | 动作 | 命令 | 原因 |
|---|---|---|---|
| P0 | 关闭 BFF 只读总闸并重启 | `READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev` | 当前 /healthz readOnlyMode=true 时禁止真实写 BA。 |
| P0 | 重跑现场 Arm-Check | `npm --prefix apps/chiller-bff run check:fcu-field-arm` | 只有 field_arm_ready 才允许进入 Canary。 |
| P0 | 执行首台 Canary 并等待反馈确认 | `FCU_CANARY_DEVICE_CODE=WSJ01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch` | 最终控制最小完成口径要求首台真实下发并反馈确认。 |

## 边界

- 本检查器只读，不触发 BA/PLC 写入。
- 默认完成口径为全量 FCU：首台 Canary、小批量、全量白名单均真实下发且反馈确认。
