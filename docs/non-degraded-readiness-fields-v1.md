# 非降级态判定字段清单 v1

目标：定义“非降级态（non-degraded）”判定所需的 P0 字段，供主控脚本与人工验收统一使用。  
边界：不改字段定义，不改 `null_strategy`，不新增业务字段。

## 1. 判定对象与输入

- 判定对象：`overview`、`trends`、`anomalies`、`recommendations` 四个 BFF 聚合响应。
- 输入建议：`apps/chiller-bff/scripts/probe.js <siteId>` 输出 JSON。
- 非降级态判定口径：所有 `blocking` 字段均 `pass` 才可判定为 `PASS`。

## 2. P0 判定字段清单（必有/可空/阈值）

说明：

- “必有”=字段路径必须存在（可为 `null` 的字段在“可空”列说明）。
- “可空”=该字段允许 `null`；允许 `null` 不等于该条判定一定 pass。
- “阈值”用于非降级态 pass/fail 的定量边界。

| ID | 模块 | 字段路径 | 必有 | 可空 | 阈值/枚举 | Pass 规则 | Fail 规则 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ND-001 | sourceStatus | `overview.sourceStatus.overall` | 是 | 否 | `ok/partial/failed` | 值为 `ok` | 缺失，或值为 `partial/failed` |
| ND-002 | sourceStatus | `trends.sourceStatus.overall` | 是 | 否 | `ok/partial/failed` | 值为 `ok` | 缺失，或值为 `partial/failed` |
| ND-003 | sourceStatus | `anomalies.sourceStatus.overall` | 是 | 否 | `ok/partial/failed` | 值为 `ok` | 缺失，或值为 `partial/failed` |
| ND-004 | sourceStatus | `recommendations.sourceStatus.overall` | 是 | 否 | `ok/partial/failed` | 值为 `ok` | 缺失，或值为 `partial/failed` |
| ND-005 | sourceStatus | `*.sourceStatus.sources`（四接口） | 是 | 否 | `length >= 1` | 四接口 `sources.length >= 1` | 任一接口 `sources` 缺失或空数组 |
| ND-006 | sourceStatus | `*.sourceStatus.sources[*].key` | 是 | 否 | 非空字符串 | 全部 source 行 `key` 非空 | 任一 source 行 key 缺失/空串 |
| ND-007 | sourceStatus | `recommendations.sourceStatus.sources[*].key` 必含集合 | 是 | 否 | 必含：`rules`,`dashboardOverview`,`anomalySummary`,`ruleMetrics`,`metric.chilled_delta_t_c`,`metric.cooling_delta_t_c`,`metric.station_cop`,`metric.station_total_power_kw` | 上述 key 全部出现 | 缺任一 key |
| ND-008 | sourceStatus | `recommendations.sourceStatus.sources[*].ok`（针对 ND-007 key） | 是 | 否 | `true/false` | ND-007 对应 key 的 `ok` 全为 `true` | 任一为 `false` |
| ND-009 | sourceStatus | `recommendations.sourceStatus.sources[*].status`（针对 ND-007 key） | 是 | 是 | 允许 `null`（如本地文件源）或 2xx | 对应 key 若 `status` 非空则 `<500`；且不存在 `ok=false && status>=500` | 出现 `ok=false && status>=500` 或 `ok=false && status=null` |
| ND-010 | freshness | `overview.freshness.latestTimestamp` | 是 | 否 | ISO8601 | 非空且可解析时间 | 缺失、为空或不可解析 |
| ND-011 | freshness | `trends.freshness.latestTimestamp` | 是 | 否 | ISO8601 | 非空且可解析时间 | 缺失、为空或不可解析 |
| ND-012 | freshness | `anomalies.freshness.latestTimestamp` | 是 | 否 | ISO8601 | 非空且可解析时间 | 缺失、为空或不可解析 |
| ND-013 | freshness | `overview.freshness.stale` | 是 | 否 | `true/false` | `false` | `true` |
| ND-014 | freshness | `trends.freshness.stale` | 是 | 否 | `true/false` | `false` | `true` |
| ND-015 | freshness | `anomalies.freshness.stale` | 是 | 否 | `true/false` | `false` | `true` |
| ND-016 | freshness | `overview.freshness.ageHours` | 是 | 否 | `<=24`（与 `STALE_THRESHOLD_HOURS` 默认一致） | 数值且 `0 <= ageHours <= 24` | `null`、非数值、或 `>24` |
| ND-017 | freshness | `trends.freshness.ageHours` | 是 | 否 | `<=24` | 数值且 `0 <= ageHours <= 24` | `null`、非数值、或 `>24` |
| ND-018 | freshness | `anomalies.freshness.ageHours` | 是 | 否 | `<=24` | 数值且 `0 <= ageHours <= 24` | `null`、非数值、或 `>24` |
| ND-019 | trends.series | `trends.series` | 是 | 否 | `length >= 3` | 至少包含 3 条序列 | 缺失或 `<3` |
| ND-020 | trends.series | `trends.series[*].metric` 必含集合 | 是 | 否 | 必含：`totalPowerKw`,`currentCop`,`chilledDeltaT` | 三个 metric 全部出现 | 缺任一 metric |
| ND-021 | trends.series | `trends.series[metric].points`（针对 ND-020） | 是 | 否 | `length >= 1` | 三个目标序列都至少 1 个点 | 任一目标序列点数为 0 |
| ND-022 | trends.series | `trends.series[*].points[*].t` | 是 | 否 | ISO8601 | 全部时间点可解析 | 任一时间点不可解析 |
| ND-023 | trends.series | `trends.series[*].points[*].v` | 是 | 是 | 数值或 `null` | 每条目标序列至少 1 个有限数值点 | 目标序列全为 `null/NaN/Infinity` |
| ND-024 | ruleEvaluation | `recommendations.ruleEvaluation.rulesLoaded` | 是 | 否 | `true/false` | `true` | `false` |
| ND-025 | ruleEvaluation | `recommendations.ruleEvaluation.error` | 是 | 是 | 必须为 `null` | `null` | 非空字符串 |
| ND-026 | ruleEvaluation | `recommendations.ruleEvaluation.totalEnabledRules` | 是 | 否 | `>=1` | 整数且 `>=1` | 缺失、非整数或 `<1` |
| ND-027 | ruleEvaluation | `recommendations.ruleEvaluation.skippedRuleIds` | 是 | 否 | `length == 0` | 空数组 | 非空数组 |
| ND-028 | ruleEvaluation | `recommendations.ruleEvaluation.skippedRuleDetails` | 是 | 否 | `length == 0` | 空数组 | 非空数组 |
| ND-029 | ruleEvaluation | `recommendations.ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category` | 否（仅当 ND-028 fail 时） | 否 | 允许枚举：`upstream_unreachable`,`field_missing_or_invalid`,`unknown` | 仅用于归因，不参与反向放行 | 出现即说明已降级（对应 ND-028 fail） |

## 3. 判定输出建议

建议输出结构：

```json
{
  "nonDegradedReady": false,
  "blockingFailedIds": ["ND-002", "ND-014", "ND-021", "ND-027"],
  "reasons": [
    "trends.sourceStatus.overall != ok",
    "trends.freshness.stale = true",
    "trends.series 目标序列存在空 points",
    "ruleEvaluation 仍有 skippedRuleIds"
  ]
}
```

判定规则：

1. `blockingFailedIds.length == 0` -> `nonDegradedReady=true`
2. 否则 `nonDegradedReady=false`

## 4. 与现有文档口径对齐

- `sourceStatus` 判定与 `docs/bff-source-status-contract-guideline-v1.md` 一致（`key/ok/status` 优先）。
- `freshness` 阈值与 `Freshness` 合同和 `STALE_THRESHOLD_HOURS` 默认值一致（24h）。
- `trends.series` 判定与 `apps/chiller-bff/src/adapters/legacyEnergyAdapter.js` 当前输出的 3 条核心序列一致。
- `ruleEvaluation` 判定与 `docs/metric-availability-v1.md`、`docs/metric-availability-field-mapping-v1.md` 的缺失分类语义一致。
