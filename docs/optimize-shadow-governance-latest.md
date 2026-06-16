# Optimize Shadow Governance 检查

- 结论：NO_GO
- 站点：140
- 生成时间：2026-06-16T05:16:10.299Z
- BFF：http://127.0.0.1:8787

## 最新 Tower 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | opx-140-1781576068903-ag7ns3 |
| status | approved |
| approval | approved |
| target Tcws | 28.9℃ |
| guardrail | 30℃ |
| dispatch | present |
| timeline | created, approved, dispatched |

## 最新 Pump 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | opx-140-1781576075710-ny5tog |
| status | approved |
| approval | approved |
| CHWP trim | -1 Hz |
| CWP trim | 0 Hz |
| dispatch | present |
| timeline | created, approved |

## 阻断项

- tower 执行单状态不是 pending_approval：approved
- tower 审批状态不是 pending：approved
- tower 执行单已出现 dispatch 字段，不能作为未下发待审证据。
- tower timeline 已出现 approved，不再是纯待审单。
- tower timeline 已出现 dispatched，不再是纯待审单。
- tower 本次目标 Tcws 不是 28℃。
- pump 执行单状态不是 pending_approval：approved
- pump 审批状态不是 pending：approved
- pump 执行单已出现 dispatch 字段，不能作为未下发待审证据。
- pump timeline 已出现 approved，不再是纯待审单。

## 风险与提示

- tower actions 未显式写明“不写 PLC”。
- 存在历史已批准 tower shadow 旧记录：opx-140-1781493919710-zwt0ak

## 结论口径

- 该检查只读，只证明当前 shadow 演示治理状态。
- 若结论不是 GO_SHADOW_PENDING，不应继续做 UI 演示或人工审批。
- 本检查不批准、不写入、不回退任何执行单。
