# FCU 现场开闸前投运包

- 站点: 126lnoffice
- 设备: LZBGS 刘总办公室
- 结论: field_arm_package_blocked
- 写控制副作用: 无
- 生成时间: 2026-06-18T03:43:20.262Z

## Canary 命令

- 写点: 设置温度 / LZBGS-508-40469
- 目标值: 25.5 °C
- 执行命令: `FCU_CANARY_DEVICE_CODE=LZBGS FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
- 回退命令: `如执行报告生成 recordId：npm --prefix apps/chiller-bff run rollback:fcu-small-batch-dispatch -- --record-id=<recordId>`

## 环境变量

- READ_ONLY_MODE=false
- CHILLER_READ_ONLY_MODE=false
- FCU_CANARY_DEVICE_CODE=LZBGS
- FCU_CANARY_COMMAND_KIND=setpoint
- FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE

## 开闸检查清单

- [ ] 现场授权真实 BA 写入 (authorization)
  - 负责人: 现场负责人
  - 证据: 甲方/运维明确授权单台 BGS01 试写，窗口内有人值守。
  - 动作: 人工签字确认后再设置确认短语。
  - 写控制: 否
- [ ] 关闭 BFF 只读总闸 (environment)
  - 负责人: 平台工程师
  - 证据: readOnlyMode=undefined
  - 动作: READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev
  - 写控制: 否
- [ ] 设置 BA 写入确认短语 (authorization)
  - 负责人: 平台工程师
  - 证据: FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
  - 动作: export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
  - 写控制: 否
- [x] 核对 Canary 写点映射 (mapping)
  - 负责人: 自控工程师
  - 证据: LZBGS-508-40469
  - 动作: 确认 BA 点表写点、反馈点和单位一致。
  - 写控制: 否
- [ ] 执行 LZBGS 单台 Canary (dispatch)
  - 负责人: 平台工程师 + 现场值班
  - 证据: waiting_for_canary_dispatch
  - 动作: FCU_CANARY_DEVICE_CODE=LZBGS FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch
  - 写控制: 是
- [ ] 60-120 秒内反馈校验 (feedback)
  - 负责人: 平台工程师
  - 证据: feedback missing
  - 动作: 执行 verify-feedback，确认 feedback_confirmed 后才允许扩批。
  - 写控制: 否
- [ ] 回退和锁定准备 (rollback)
  - 负责人: 平台工程师 + 现场值班
  - 证据: 反馈不一致、通讯报警、温度异常、投诉或本地抢控制即回退。
  - 动作: 如执行报告生成 recordId：npm --prefix apps/chiller-bff run rollback:fcu-small-batch-dispatch -- --record-id=<recordId>
  - 写控制: 否

## 当前阻断

- P0 上线前预检: go_live_blocked
  - 动作: npm --prefix apps/chiller-bff run check:fcu-go-live-preflight
- P0 现场 Arm-Check: field_arm_blocked
  - 动作: npm --prefix apps/chiller-bff run check:fcu-field-arm
- P0 BA 写入二次确认: requires FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
  - 动作: export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
- P0 BFF 写入总闸: requires /healthz readOnlyMode=false
  - 动作: READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev
- P0 全局真实下发闸门打开: execution_gate_open
- P0 真实写入确认短语: confirm_phrase_present
- P0 BFF 可访问: status=404, ok=undefined
- P0 FCU 策略 enforced: enabled=true, mode=shadow
- P0 子系统写总闸: subsystemWriteEnabled=false, boundary=read_only
- P0 BA 写适配器已配置: dispatchAdapter=none
- P0 白名单包含首台 Canary: LZBGS in whitelist=false
- P0 Canary 当前快照质量: snapshot missing
- P0 在 3002 配置中心批准现场授权: 现场未授权时，3001 只能生成建议和预演，不能进入真实 BA 写入。
  - 动作: 在 3002 配置中心批准现场授权
- P0 在 3002 补齐授权确认人、投运负责人和 BA 负责人: 最终控制必须能追溯现场授权、平台执行和 BA 写点责任人。
  - 动作: 在 3002 补齐授权确认人、投运负责人和 BA 负责人
- P0 在 3002 配置 FCU 真实写入授权窗口: 真实 BA 写入必须限定现场值守窗口，不能长期裸开。
  - 动作: 在 3002 配置 FCU 真实写入授权窗口
- P0 调整或等待 FCU 真实写入授权窗口生效: 真实 BA 写入只能在现场值守授权窗口内执行。
  - 动作: 调整或等待 FCU 真实写入授权窗口生效
- P0 设置最终控制总确认短语: 没有总确认时编排器不会调用 Canary/小批量/全量真实执行脚本。
  - 动作: 设置最终控制总确认短语
- P0 设置 BA 写入确认短语: 真实 BA 写入需要二次确认，防止误触发。
  - 动作: 设置 BA 写入确认短语
- P0 关闭 BFF 只读总闸并重启: 当前 readOnlyMode=true，后端禁止真实 BA 写入。
  - 动作: 关闭 BFF 只读总闸并重启
- P0 重跑上线前预检: 预检必须为 go_live_ready 才允许真实下发。
  - 动作: 重跑上线前预检
- P0 重跑现场 Arm-Check: 现场 Arm-Check 必须 ready，才能执行首台 Canary。
  - 动作: 重跑现场 Arm-Check
- P0 执行首台 Canary 并确认反馈: 最终控制必须先完成首台真实下发和反馈确认。
  - 动作: 执行首台 Canary 并确认反馈
- P0 关闭 FCU 现场 P0 消缺后再进入 Canary: 只有质量整改清零、全量分批计划无设备阻断后，才允许进入首台真实写入 Canary。
  - 动作: 关闭 FCU 现场 P0 消缺后再进入 Canary
- P0 确认提升 current-only 现场签字输入并归档旧行: 现场签字主输入仍包含 10 行旧工单，容易造成签字验收和 Canary 门禁反复跳变。
  - 动作: 确认提升 current-only 现场签字输入并归档旧行
- P0 通过 FCU Canary 总门禁后再执行首台下发: 首台 Canary 必须同时满足现场签字、实时 closeout、Arm-Check、BA 写适配器和执行包门禁，不能只看单个执行命令。
  - 动作: 通过 FCU Canary 总门禁后再执行首台下发

## 反馈验收

- record_status: feedback_confirmed
- completion_milestone: true
- control_mutation: true，仅在授权真实写入窗口内允许
- no_rollback: 无 rollback，阻断项为空

## 回退触发

- 60-120 秒内反馈未变更为 feedback_confirmed
- 反馈值与执行单目标不一致或 verify-feedback 返回 mismatch/failed
- 通讯报警、0°C/越界温度、就地/手动模式、本地锁定任一出现
- 现场人员报告投诉、禁控或面板抢控制
- 回退失败时进入 rollback_watch，禁止继续 Canary 或扩批

## 验收记录字段

- 现场授权人（必填）
- 投运开始时间（必填）
- 执行 recordId（必填）
- BA 写入返回（必填）
- 设定反馈/运行反馈（必填）
- verify-feedback 结果（必填）
- 是否触发回退（必填）
- 现场值班确认（必填）
