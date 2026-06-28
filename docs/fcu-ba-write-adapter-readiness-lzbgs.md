# FCU BA 写适配器就绪自检

- 站点: 126lnoffice
- BFF: http://127.0.0.1:61942
- 目标 FCU: LZBGS
- 结论: ba_write_adapter_blocked
- 控制写入副作用: 无，只读自检
- 生成时间: 2026-06-18T03:46:35.772Z

## 检查项

| 检查 | 状态 | 级别 | 证据 | 动作 |
|---|---|---|---|---|
| BFF 可访问 | 未通过 | P0 | status=404, ok=undefined | -- |
| 后端写入总闸 | 未通过 | P0 | readOnlyMode=undefined | 以 READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false 重启 BFF |
| FCU 策略 enforced | 未通过 | P0 | enabled=true, mode=shadow | -- |
| 子系统写总闸 | 未通过 | P0 | subsystemWriteEnabled=false, boundary=read_only | -- |
| BA 写适配器已配置 | 未通过 | P0 | dispatchAdapter=none | -- |
| 全局执行闸门 | 未通过 | P0 | dispatchAllowed=false, blocked=mode_enforced/subsystem_write_enabled/dispatch_adapter_configured/whitelist_not_empty/site_authorization_approved/site_authorization_owner_recorded/site_authorization_window_configured/site_authorization_window_active/ba_write_confirm_armed/final_rollout_confirm_armed/backend_not_readonly | -- |
| 白名单包含首台 Canary | 未通过 | P0 | LZBGS in whitelist=false | -- |
| Canary 写点映射完整 | 通过 | P0 | point=设置温度, tag=LZBGS-508-40469, value=25.5 | -- |
| Canary 当前快照质量 | 未通过 | P0 | snapshot missing | -- |
| BA 写入确认短语 | 未通过 | P0 | FCU_SMALL_BATCH_CONFIRM=missing | export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE |
| 最终控制总确认短语 | 未通过 | P1 | FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=missing | export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE |

## 执行边界

- 本脚本不调用 control-cycle dispatch，不写 BA，不写 PLC。
- 只有本报告 ok=true 后，才允许进入 LZBGS 单台真实写入窗口。
- 即使本报告通过，真实写入仍必须由现场授权短语、后端写总闸、单台反馈校验共同约束。
