# FCU 首台 Canary 反馈监视

- 站点: 126lnoffice
- 设备: BGS01
- 记录: --
- 结论: waiting_for_canary_dispatch
- 控制写入副作用: 无，只读监视报告
- 生成时间: 2026-06-18T01:41:39.004Z

## 检查项

| 检查 | 状态 | 证据 |
|---|---|---|
| Canary 执行报告 | 未通过 | ENOENT: no such file or directory, open '/Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-dispatch-bgs01.json' |
| 执行记录 ID | 未通过 | missing |
| 真实下发已确认 | 未通过 | controlMutation=undefined |
| 反馈已确认 | 未通过 | missing |
| 未触发回退 | 通过 | none |

## 下一步

- P0 执行 BGS01 单台真实下发: 尚未形成 confirmed_canary_dispatch。
  - `FCU_CANARY_DEVICE_CODE=BGS01 FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
