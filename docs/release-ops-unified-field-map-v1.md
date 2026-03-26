# Release-Ops 统一字段对照表 v1

## 1. 目标与边界
- 目标：把 `release-ready`、`release-ready-latest-check`、`check-family-consistency` 三条链路的共同语义字段抽成统一对照表，供自动化与运营文档复用。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-field-semantics-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest-check-field-map-v1.1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/check-family-consistency-field-map-v1.md`
- 边界：仅文档，不改字段定义，不改 `null_strategy`，不改现有校验逻辑。

## 2. 统一口径说明
1. `semantic_key` 代表运营侧统一语义，不要求三条链路都使用同名字段。
2. 某链路没有原生字段时：
- 若存在明确语义对应，标注为“semantic analog”。
- 若当前确实未暴露该字段，标注 `N/A`，不强行补造。
3. `release_impact`、`missing_default_behavior`、`fail_open_or_closed` 采用统一运营口径：
- blocking：默认放行链路需要保守处理。
- warning：用于解释、时效或趋势说明，不单独翻转默认放行。

## 3. 最小公共字段

| semantic_key | release_ready_path | latest_check_path | family_consistency_path | release_impact | missing_default_behavior | fail_open_or_closed | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decision` | `$.decision` | `$.decision` | `$.overall <-> $.overall`（semantic analog） | blocking | 缺失时按失败结论处理或直接校验失败 | fail-closed | `family-consistency` 用 `PASS/FAIL` 承载“总决策”语义 |
| `exitCode` | `$.exitCode` | `$.exitCode` | `N/A` | blocking | 缺失时按 `1` 或校验失败处理 | fail-closed | `family-consistency` 当前无独立 `exitCode` 字段 |
| `reasons` | `$.reasons[]` | `$.reasons[]` | `$.topFailedChecks[*]`（semantic analog） | blocking | 缺失时按阻断原因不可用处理 | fail-closed | `family-consistency` 以失败脚本列表表达主因 |
| `source` | `N/A`（`release-ready-field-semantics-v1` 未显式列出） | `check_context.loaded.source` / `$.source` 语义 | `$.source` | blocking | 缺失 source 时按不可追溯处理 | fail-closed | 统一建议 source 缺失不放行 |
| `consistencyOk` | `$.consistencyOk` | `$.consistencyOk` | `N/A`（链路本身即一致性门禁） | blocking | 缺失时按 `false` 或未通过处理 | fail-closed | `family-consistency` 以整条 check 结果替代单字段 |
| `generatedAt` | `N/A`（v1 语义文档未显式列出） | `$.generatedAt` | `$.generatedAt <-> $.sourceGeneratedAt` | warning | 缺失时按 `"unknown"` 或 freshness unknown 处理 | fail-open | 用于时效解释，不单独翻转默认放行 |

## 4. 扩展公共字段

| semantic_key | release_ready_path | latest_check_path | family_consistency_path | release_impact | missing_default_behavior | fail_open_or_closed | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `diffClass` | `$.diffClass` | `$.diffClass` | `N/A` | warning | 缺失时按 `error` 解释 | fail-open | 趋势说明字段 |
| `decisionChanged` | `$.decisionChanged` | `$.decisionChanged` | `N/A` | warning | 缺失时按 `null` 处理 | fail-open | 变更说明字段 |
| `verifyGatesOk` | `$.verifyGatesOk` | `$.verifyGatesOk` | `N/A` | blocking | 缺失时按 `false` 或未通过处理 | fail-closed | 发布前门禁通过位 |

## 5. 覆盖差异说明
1. `release-ready-field-semantics-v1` 当前未显式列出 `source` 与 `generatedAt`，统一表中保留为缺口位，供后续文档补齐。
2. `check-family-consistency` 更偏“规则一致性门禁”，因此对 `decision/source/reasons` 主要提供语义对应，而非同名字段。
3. 对自动化来说：
- 精确字段优先读同名 path。
- 遇到 `semantic analog` 时，只能用于运营解释或跨文档复用，不应替代底层合同校验。

## 6. 统计与结论
- blocking 数量：`6`
- warning 数量：`3`
- 是否影响默认放行：`no`
