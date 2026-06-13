# Optimize Shadow Governance 检查

- 结论：GO_SHADOW_PENDING
- 站点：140
- 生成时间：2026-06-13T01:35:19.129Z
- BFF：http://127.0.0.1:8787

## 最新 Tower 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | opx-140-1781266624535-ju3qeb |
| status | pending_approval |
| approval | pending |
| target Tcws | 28℃ |
| guardrail | 30℃ |
| dispatch | none |
| timeline | created |

## 最新 Pump 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | opx-140-1781265213665-wso34v |
| status | pending_approval |
| approval | pending |
| CHWP trim | -1 Hz |
| CWP trim | 0 Hz |
| dispatch | none |
| timeline | created |

## 阻断项

- 无

## 风险与提示

- 存在历史已批准 tower shadow 旧记录：opx-140-1780911209517-23t8ch

## 结论口径

- 该检查只读，只证明当前 shadow 演示治理状态。
- 若结论不是 GO_SHADOW_PENDING，不应继续做 UI 演示或人工审批。
- 本检查不批准、不写入、不回退任何执行单。
