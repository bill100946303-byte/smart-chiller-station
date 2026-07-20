# FCU 现场开闸 Arm-Check

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 禁止现场真实下发
- verdict: field_arm_blocked
- 控制写入副作用: 无
- 首台 Canary: WSJ01
- 生成时间: 2026-06-20T04:31:50.150Z

## 当前范围

- 策略: enforced / legacy-scene-command / 白名单 29 台
- 设备侧就绪: 9/29
- Canary 队列: 2 台
- 预检: go_live_blocked

## 检查项

| 检查 | 状态 | 说明 |
|---|---|---|
| BFF 服务在线 | 通过 | BFF healthz 正常。 |
| 后端写入总闸 | P0 | 当前 /healthz 显示 readOnlyMode=true。 |
| FCU 策略 enforced | 通过 | enabled=true, mode=enforced |
| BA 写适配器 | 通过 | dispatchAdapter=legacy-scene-command |
| 白名单覆盖 | 通过 | 白名单 29 台。 |
| 设备侧就绪 | 通过 | 设备侧就绪 9/29 台。 |
| 全局投运闸门 | P0 | 未打开：site_authorization_window_active / backend_not_readonly |
| 真实写入确认短语 | P0 | 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。 |
| Canary 队列 ready | 通过 | 队列 2 台，首台 WSJ01。 |
| 逐台反馈规则 | 通过 | 已要求反馈通过后进入下一台。 |
| 预检报告新鲜 | 通过 | 预检报告距今 0 min。 |
| Canary 队列新鲜 | 通过 | 队列报告距今 0 min。 |
| Runbook 新鲜 | P1 | Runbook 距今 2485 min。 |

## P0 阻断

- backend_write_gate: 当前 /healthz 显示 readOnlyMode=true。
- execution_gate_open: 未打开：site_authorization_window_active / backend_not_readonly
- confirm_phrase_present: 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。

## 风险提示

- runbook_recent: Runbook 距今 2485 min。

## 下一步命令

| 优先级 | 动作 | 对象 | 命令/处理 | 原因 |
|---|---|---|---|---|
| P0 | 关闭后端只读总闸并重启 BFF | READ_ONLY_MODE / CHILLER_READ_ONLY_MODE | `READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev` | 当前 /healthz 显示 readOnlyMode=true，真实下发会被后端阻断。 |
| P0 | 设置真实写入确认短语 | FCU_SMALL_BATCH_CONFIRM | `export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE` | 防止误触发真实 BA 写入。 |
| P1 | 重跑 Arm-Check | WSJ01 | `npm --prefix apps/chiller-bff run check:fcu-field-arm` | 只允许先执行首台 Canary；反馈通过后再扩大。 |
| P0 | 反馈校验与失败回退 | control-record verify-feedback / rollback | -- | 真实下发后必须在 60-120 秒内校验反馈；不一致时锁定设备并回退。 |

- 当前不允许执行真实下发命令。
