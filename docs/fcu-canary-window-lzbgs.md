# FCU LZBGS 单台投运窗口

- 站点: 126lnoffice
- 设备: LZBGS
- 模式: blocked_before_dispatch
- 结论: canary_window_blocked
- 反馈: --
- 写入副作用: 无
- 生成时间: 2026-06-18T03:46:36.551Z

## 阶段

| 阶段 | 状态 | exit | 产物 |
|---|---|---:|---|
| 生成单台执行包 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-lzbgs.json |
| BA 写适配器就绪自检 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-lzbgs.json |
| 单台反馈监视 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-feedback-monitor-lzbgs.json |
| 最终完成度检查 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-completion-latest.json |
| 刷新最终投运清单 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-worklist-latest.json |
| 执行 LZBGS 单台真实下发 | 跳过 | -- | BA readiness is not ok |

## 下一步

- P0 BFF 可访问: status=404, ok=undefined
- P0 后端写入总闸: readOnlyMode=undefined
  - `以 READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false 重启 BFF`
- P0 FCU 策略 enforced: enabled=true, mode=shadow
- P0 子系统写总闸: subsystemWriteEnabled=false, boundary=read_only
- P0 BA 写适配器已配置: dispatchAdapter=none
- P0 全局执行闸门: dispatchAllowed=false, blocked=mode_enforced/subsystem_write_enabled/dispatch_adapter_configured/whitelist_not_empty/site_authorization_approved/site_authorization_owner_recorded/site_authorization_window_configured/site_authorization_window_active/ba_write_confirm_armed/final_rollout_confirm_armed/backend_not_readonly
- P0 白名单包含首台 Canary: LZBGS in whitelist=false
- P0 Canary 当前快照质量: snapshot missing
