# Check-Family 与 Brief 一致性字段映射 v1

## 1. 目标与边界
- 目标：沉淀 `family` 与 `brief` 的字段一致性映射，供巡检自动化直接消费。
- 输入：
  - `/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/check-family-brief-latest.json`
  - `/Users/billchow/Documents/智慧冷冻站/docs/check-family-consistency-contract-v1.md`
- 边界：仅文档，不改字段语义，不改 `null_strategy`，不改现有 check 逻辑。

## 2. 一致性映射表（自动化消费）

| family_path | brief_path | rule | requiredness | release_impact | missing_default_behavior | fail_open_or_closed |
| --- | --- | --- | --- | --- | --- | --- |
| `$.overall` | `$.overall` | `brief.overall == family.overall` | required | blocking | 任一字段缺失/非法时校验失败 | fail-closed |
| `$.passedCount` | `$.passedCount` | `brief.passedCount == family.passedCount` | required | blocking | 任一字段缺失/非法时校验失败 | fail-closed |
| `$.totalCount` | `$.totalCount` | `brief.totalCount == family.totalCount` | required | blocking | 任一字段缺失/非法时校验失败 | fail-closed |
| `$.totalCount,$.passedCount` | `$.failedCount` | `brief.failedCount == family.totalCount - family.passedCount` | required | blocking | 缺失时校验失败；不一致时报错 | fail-closed |
| `$.checks[*].script,$.checks[*].ok` | `$.topFailedChecks[*]` | `topFailedChecks` 每个值都必须引用 `family.checks` 中 `ok=false` 的 `script` | required | blocking | 缺失/非数组/成员非法时校验失败 | fail-closed |
| `$.overall` | `$.failedCount` | 当 `family.overall=PASS` 时，`brief.failedCount` 必须为 `0` | required | blocking | 字段缺失或不满足约束时报错 | fail-closed |
| `$.overall` | `$.topFailedChecks` | 当 `family.overall=PASS` 时，`brief.topFailedChecks` 必须为空数组 | required | blocking | 字段缺失或不满足约束时报错 | fail-closed |
| `$.checks` | `$.topFailedChecks` | `brief.topFailedChecks.length <= 3` | required | blocking | 缺失/超长时报错 | fail-closed |
| `$.checks[*].script` | `$.topFailedChecks[*]` | `topFailedChecks[*]` 必须为非空字符串 | required | blocking | 成员缺失/空字符串时报错 | fail-closed |
| `$.generatedAt` | `$.sourceGeneratedAt` | 建议一致：`brief.sourceGeneratedAt == family.generatedAt` | optional | advisory | 缺失时标记 warning，不阻断 | fail-open |
| `N/A` | `$.source` | 建议固定：`brief.source == "check-family-latest"` | optional | advisory | 缺失/非预期值标记 warning | fail-open |
| `N/A` | `$.sourcePath` | 建议固定：`brief.sourcePath` 指向 family latest 路径 | optional | advisory | 缺失/非预期值标记 warning | fail-open |

## 3. 分层说明
1. `blocking` 行对应当前 `check:check-family-consistency` 已实现的硬约束（contract_enforced）。
2. `advisory` 行用于补强 brief 溯源可观测性，便于排障与巡检（advisory_recommended）。

## 4. 证据路径
- 一致性校验脚本：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family-consistency.js`
- brief 生成脚本：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/sync-check-family-brief.js`
- 契约说明：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-consistency-contract-v1.md`

## 5. 统计与结论
- blocking 数量：`9`
- warning 数量：`3`
- 是否影响默认放行：`no`（仅文档沉淀）
