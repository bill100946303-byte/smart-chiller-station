# FCU 现场开闸前投运包

- 站点: 126lnoffice
- 设备: BGS01 办公室01
- 结论: field_arm_package_blocked
- 写控制副作用: 无
- 生成时间: 2026-06-18T08:44:37.955Z

## Canary 命令

- 写点: 设置温度 / BGS01-508-40133
- 目标值: 25.5 °C
- 执行命令: `FCU_CANARY_DEVICE_CODE=BGS01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
- 回退命令: `如执行报告生成 recordId：npm --prefix apps/chiller-bff run rollback:fcu-small-batch-dispatch -- --record-id=<recordId>`

## 环境变量

- READ_ONLY_MODE=false
- CHILLER_READ_ONLY_MODE=false
- FCU_CANARY_DEVICE_CODE=BGS01
- FCU_CANARY_COMMAND_KIND=setpoint
- FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE

## 开闸检查清单

- [ ] 现场授权真实 BA 写入 (authorization)
  - 负责人: 现场负责人
  - 证据: 甲方/运维明确授权单台 BGS01 试写，窗口内有人值守。
  - 动作: 人工签字确认后再设置确认短语。
  - 写控制: 否
- [x] 关闭 BFF 只读总闸 (environment)
  - 负责人: 平台工程师
  - 证据: readOnlyMode=false
  - 动作: READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev
  - 写控制: 否
- [x] 设置 BA 写入确认短语 (authorization)
  - 负责人: 平台工程师
  - 证据: FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
  - 动作: export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE
  - 写控制: 否
- [x] 核对 Canary 写点映射 (mapping)
  - 负责人: 自控工程师
  - 证据: BGS01-508-40133
  - 动作: 确认 BA 点表写点、反馈点和单位一致。
  - 写控制: 否
- [ ] 执行 BGS01 单台 Canary (dispatch)
  - 负责人: 平台工程师 + 现场值班
  - 证据: waiting_for_canary_dispatch
  - 动作: FCU_CANARY_DEVICE_CODE=BGS01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch
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
- P0 Canary 写点映射完整: point=--, tag=--, value=25.5
- P0 设置最终控制总确认短语: 没有总确认时编排器不会调用 Canary/小批量/全量真实执行脚本。
  - 动作: 设置最终控制总确认短语
- P0 设置 BA 写入确认短语: 真实 BA 写入需要二次确认，防止误触发。
  - 动作: 设置 BA 写入确认短语
- P0 执行首台 Canary 并确认反馈: 最终控制必须先完成首台真实下发和反馈确认。
  - 动作: 执行首台 Canary 并确认反馈
- P0 整改通讯报警、0°C/无效温度和写点缺失设备: P0 质量设备不能进入全量闭环。
  - 动作: 整改通讯报警、0°C/无效温度和写点缺失设备
- P0 关闭 FCU 现场 P0 消缺后再进入 Canary: 只有质量整改清零、全量分批计划无设备阻断后，才允许进入首台真实写入 Canary。
  - 动作: 关闭 FCU 现场 P0 消缺后再进入 Canary
- P0 补齐 FCU 现场消缺签字和复核字段: 现场签字未完成时，Canary 总门禁必须阻断，不能进入真实 BA 写入。
  - 动作: 补齐 FCU 现场消缺签字和复核字段
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
