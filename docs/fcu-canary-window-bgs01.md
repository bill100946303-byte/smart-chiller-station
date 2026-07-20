# FCU BGS01 单台投运窗口

- 站点: 126lnoffice
- 设备: BGS01
- 模式: blocked_before_dispatch
- 结论: canary_window_blocked
- 反馈: --
- 写入副作用: 无
- 生成时间: 2026-06-17T22:32:53.491Z

## 阶段

| 阶段 | 状态 | exit | 产物 |
|---|---|---:|---|
| 生成单台执行包 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-bgs01.json |
| BA 写适配器就绪自检 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-bgs01.json |
| 单台反馈监视 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-feedback-monitor-bgs01.json |
| 最终完成度检查 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-completion-latest.json |
| 刷新最终投运清单 | 未通过 | 2 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-worklist-latest.json |
| 执行 BGS01 单台真实下发 | 跳过 | -- | BA readiness is not ok |

## 下一步

- P0 后端写入总闸: readOnlyMode=true
  - `以 READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false 重启 BFF`
- P0 全局执行闸门: dispatchAllowed=false, blocked=backend_not_readonly
- P0 BA 写入确认短语: FCU_SMALL_BATCH_CONFIRM=missing
  - `export FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE`
- P0 执行 BGS01 单台真实下发: 反馈监视仍在等待 canary dispatch。
  - `FCU_CANARY_DEVICE_CODE=BGS01 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-window`
