# Release-Command-Center-Latest 字段映射 v1

## 1. 目标与边界
- 目标：把 `release-command-center-latest`、`release-ready-latest`、`release-snapshot-diff` 三条链路串成一张可审计字段总表，供后续自动化巡检和运营文档复用。
- 依据：
  - `docs/release-ops-unified-field-map-v1.md`
  - `docs/release-ready-latest-field-map-v1.md`
  - `docs/release-snapshot-diff-field-lineage-v1.md`
  - `docs/release-command-center-latest.json`
  - `apps/chiller-bff/scripts/sync-release-command-center.js`
  - `apps/chiller-bff/scripts/check-release-command-center.js`
- 边界：
  - 仅固化字段血缘与缺失默认行为，不改业务字段定义。
  - `release-snapshot-diff` 在当前实现里不是 `release-command-center` 的直接输入；本表中的 diff 路径用于变化解释，不代表直接取值。
  - `summaryClass`、`firstAction` 还依赖 `release-ready-consistency`、`check-family-latest`、`check-family-brief-latest`，这些额外依赖统一写在备注列，不挤进本次两条 upstream 列。

## 2. 字段总表

| center 字段 | upstream release-ready 路径 | upstream snapshot-diff 路径 | 含义 | 放行影响 | 缺失默认行为 | fail-open/closed | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `$.decision` | `semantic_base: $.decision + $.reasons[]` | `semantic_analog: $.diff.current_decision` | Command-center 主决策位；实际由聚合后的 `reasons` 是否为空决定，不直接镜像 `release-ready-latest.decision`。 | blocking | 缺失或非法按 `NO-GO` + `exitCode=1` | fail-closed | 还依赖 `release-ready-consistency` 与 `check-family` 门禁结果 |
| `$.summaryClass` | `semantic_base: $.decision + $.advisories[]` | `semantic_analog: $.diff.current_decision + $.diff.advisories_added[]` | 操作层摘要态；`blocked/review_required/ready` 由中心 `decision` 和 `advisories` 派生。 | advisory | 缺失按 `review_required` + 人工复核 | fail-open | 最终还依赖 `check-family` 新鲜度提示 |
| `$.exitCode` | `semantic_base: $.exitCode + $.decision` | `N/A` | Command-center 退出码；由中心 `decision` 派生，`GO=0`、`NO-GO=1`。 | blocking | 缺失或非法按 `1` | fail-closed | 不是 `release-ready-latest.exitCode` 的简单直传 |
| `$.reasons[]` | `$.reasons[]` | `semantic_analog: $.diff.reasons_added[] / $.diff.reasons_removed[]` | 中心阻断原因集合；以 `release-ready-latest.reasons` 为基底，再并入 sync/check-family/consistency 失败原因。 | blocking | 缺失按阻断原因不可追溯处理，并回落到 `decision=NO-GO` | fail-closed | enriched union，不是 direct mirror |
| `$.advisories[]` | `$.advisories[]` | `semantic_analog: $.diff.advisories_added[] / $.diff.advisories_removed[]` | 中心提示项集合；以 `release-ready-latest.advisories` 为基底，再并入 `check-family` 的 freshness 提示。 | advisory | 缺失按 `[]` | fail-open | freshness advisory 来自 `check-family-brief`，不是 diff 直接输入 |
| `$.firstAction` | `semantic_base: $.decision` | `N/A` | 给操作员的首个动作建议；由中心 `decision`、sync/check 状态和 `freshnessState` 组合生成。 | info | 缺失回退为人工复核提示 | fail-open | 还依赖 `syncCheckFamily` / `releaseReadyLatestCheck` / `releaseReadyConsistency` / `checkFamilyBriefLatest.freshnessState` |
| `$.generatedAt` | `N/A (center generated at sync time; compare with $.generatedAt)` | `semantic_analog: $.diff.generated_at_delta_sec` | 中心快照生成时间，不是 `release-ready-latest.generatedAt` 的直传。 | advisory | 缺失按未知时效时间戳处理 | fail-open | 用于新鲜度与审计追踪，不直接翻转放行位 |
| `$.releaseReadyLatest.decision` | `$.decision` | `semantic_analog: $.diff.current_decision` | 直接镜像 `release-ready-latest.decision`，便于 command-center 就地展示上游原始判定。 | blocking | 缺失按 `NO-GO` | fail-closed | direct mirror |
| `$.releaseReadyLatest.exitCode` | `$.exitCode` | `N/A` | 直接镜像 `release-ready-latest.exitCode`。 | blocking | 缺失按 `1` | fail-closed | direct mirror |
| `$.releaseReadyLatest.generatedAt` | `$.generatedAt` | `semantic_analog: $.diff.generated_at_delta_sec` | 直接镜像 `release-ready-latest.generatedAt`，供操作端判断上游快照时效。 | advisory | 缺失按上游时效未知处理 | fail-open | direct mirror |
| `$.releaseReadyLatest.reasons[]` | `$.reasons[]` | `semantic_analog: $.diff.reasons_added[] / $.diff.reasons_removed[]` | 直接镜像 `release-ready-latest.reasons[]`，与中心 top-level enriched reasons 分层保留。 | blocking | 缺失按阻断原因不可追溯处理 | fail-closed | upstream 原始阻断层 |
| `$.releaseReadyLatest.advisories[]` | `$.advisories[]` | `semantic_analog: $.diff.advisories_added[] / $.diff.advisories_removed[]` | 直接镜像 `release-ready-latest.advisories[]`，不并入中心 freshness 衍生提示。 | advisory | 缺失按 `[]` | fail-open | upstream 原始提示层 |
| `$.releaseReadyLatest.consistencyOk` | `$.consistencyOk` | `N/A` | 直接镜像 `release-ready-latest.consistencyOk`。 | blocking | 缺失按 `false` | fail-closed | direct mirror |
| `$.releaseReadyLatest.verifyGatesOk` | `$.verifyGatesOk` | `N/A` | 直接镜像 `release-ready-latest.verifyGatesOk`。 | blocking | 缺失按 `false` | fail-closed | direct mirror |

## 3. 关键判定边界
1. `release-command-center` 的 top-level `decision/reasons/advisories/summaryClass/firstAction` 属于聚合派生层，不能被误认为是 `release-ready-latest` 的逐字段镜像。
2. `release-snapshot-diff` 当前只承担“变化解释层”职责，不承担 command-center 的直接输入职责；因此本表里的 diff 路径统一视为 `semantic_analog`。
3. 真正的 direct mirror 只出现在 `$.releaseReadyLatest.*` 这一组嵌套字段里，这组字段可用于回看 command-center 在生成时所引用的上游快照值。

## 4. 统计与结论
- blocking 条目数：`8`
- warning 条目数：`5`
- 是否影响默认放行：`no`

说明：
- 上述 `warning` 统计按 `release_impact=advisory` 计数，`info` 项不计入 warning。
- 本文档为血缘与消费口径固化，不改现有默认放行链路。
