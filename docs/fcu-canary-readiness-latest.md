# FCU Canary Readiness

- 站点: 126lnoffice
- 首台 Canary: WSJ01
- 结论: 禁止 Canary
- 判定: canary_blocked
- 写入副作用: 无
- 生成时间: 2026-06-20T04:31:52.212Z

## 门禁

| 门禁 | 状态 | 证据 | 动作 |
|---|---|---|---|
| 现场工单签字完成 | 阻断 | 0/8 complete | 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff |
| 实时消缺关闭 | 阻断 | field_remediation_open remaining=8 | 重跑 check:fcu-field-remediation-closeout，必须 field_remediation_ready_for_canary |
| 现场 Arm-Check 通过 | 阻断 | field_arm_blocked first=WSJ01 | 重跑 check:fcu-field-arm，现场授权、窗口、确认短语和 readOnly 必须通过 |
| BA 写适配器通过 | 阻断 | ba_write_adapter_blocked blockers=3 | 重跑 check:fcu-ba-write-adapter-readiness，写点映射、确认短语和执行闸门必须通过 |
| 首台 Canary 执行包就绪 | 阻断 | canary_package_ready_with_open_gates device=WSJ01 | 重跑 build:fcu-canary-execution-package，确保 blockers 为空 |
| Readiness 检查无写入副作用 | 通过 | all referenced reports controlMutation=false |  |

## Readiness 作战表

- 可执行 Canary: 否
- 通过门禁: 1/6
- 第一阻断: 现场签字
- 第一责任: 现场/运维
- 第一动作: 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff

| 阶段 | 责任 | 状态 | 证据 | 来源 | 下一步 |
|---|---|---|---|---|---|
| 现场签字 | 现场/运维 | 阻断 | 0/8 complete | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-latest.json | 填写并复核 fcu-field-remediation-signoff-input-latest.csv 后重跑 check:fcu-field-remediation-signoff |
| 实时消缺 | 现场/平台 | 阻断 | field_remediation_open remaining=8 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-closeout-latest.json | 重跑 check:fcu-field-remediation-closeout，必须 field_remediation_ready_for_canary |
| 现场授权 | 现场/BA | 阻断 | field_arm_blocked first=WSJ01 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-arm-check-latest.json | 重跑 check:fcu-field-arm，现场授权、窗口、确认短语和 readOnly 必须通过 |
| BA写适配器 | BA/自控 | 阻断 | ba_write_adapter_blocked blockers=3 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-ba-write-adapter-readiness-latest.json | 重跑 check:fcu-ba-write-adapter-readiness，写点映射、确认短语和执行闸门必须通过 |
| Canary执行包 | 平台 | 阻断 | canary_package_ready_with_open_gates device=WSJ01 | /Users/billchow/Documents/智慧冷冻站/docs/fcu-canary-execution-package-latest.json | 重跑 build:fcu-canary-execution-package，确保 blockers 为空 |
| 安全边界 | 平台 | 通过 | all referenced reports controlMutation=false | -- | 保持当前证据，继续下一门禁。 |

## 安全边界

- readinessPlaybook 只拆解阻断和下一步动作，不放宽任何门禁。
- blockedGateCount 不为 0 时，禁止 execute:fcu-canary-dispatch。
- controlMutation 必须保持 false，dispatch 必须保持 false。
- Canary 只能在现场签字、实时消缺、现场授权、BA写适配器和执行包全部通过后进入。

- 下一步命令: `先处理 blockers；禁止执行 execute:fcu-canary-dispatch`
