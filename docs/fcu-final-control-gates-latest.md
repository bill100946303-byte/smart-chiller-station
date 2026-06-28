# FCU 最终控制总门禁

- 站点: 126lnoffice
- 结论: 仍被阻断
- 通过门禁: 0/8
- 真实写入副作用: 无
- 生成时间: 2026-06-20T04:31:52.386Z

## 门禁

| 门禁 | 状态 | 当前值 | 阻断 | 证据 |
|---|---|---|---|---|
| 数据质量 P0 | 阻断 | 8 台 P0 | 仍有通讯/温度/反馈硬阻断设备 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-quality-remediation-latest.json |
| 全量分批计划 | 阻断 | immediate=9, staged=12, blocked=8 | 仍有 blocked 或 staged 设备 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-all-device-dispatch-plan-latest.json |
| 现场执行包 | 阻断 | 8 台待处理 | 现场执行包仍有 P0 设备 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-execution-pack-latest.json |
| 现场 closeout | 阻断 | field_remediation_open | 现场消缺未关闭 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.json |
| 现场签字 | 阻断 | 0/8 | 现场签字未完成 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.json |
| Canary readiness | 阻断 | canary_blocked | Canary 总门禁阻断 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-readiness-latest.json |
| 最终完成 | 阻断 | final_control_incomplete | 首台/小批量/全量反馈未全部闭环 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-completion-latest.json |
| 最终 worklist | 阻断 | worklist_open | 最终投运清单仍有未完成动作 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-final-control-worklist-latest.json |

## 下一步

- P0 / authorization: 设置最终控制总确认短语 (FCU_FINAL_CONTROL_ROLLOUT_CONFIRM)
- P0 / authorization: 设置 BA 写入确认短语 (FCU_SMALL_BATCH_CONFIRM)
- P0 / environment: 关闭 BFF 只读总闸并重启 (READ_ONLY_MODE / CHILLER_READ_ONLY_MODE)
- P0 / preflight: 重跑上线前预检 (FCU go-live preflight)
- P0 / field_arm: 重跑现场 Arm-Check (WSJ01)
- P0 / canary: 执行首台 Canary 并确认反馈 (WSJ01)
- P0 / quality: 整改通讯报警、0°C/无效温度和写点缺失设备 (8 台 P0 FCU)
- P1 / setpoint_normalization: 分步拉回设定反馈越界 FCU (12 台 FCU)
