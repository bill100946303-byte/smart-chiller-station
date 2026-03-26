# HVAC Stale Mode 运营文案策略 v1

目标：针对当前实际态（`stale-data-detection` 命中）提供 recommendations 运营文案模板。  
边界：不改阈值、不改 `ruleId`、不改 evaluator。

## 1) 输入字段与派生标记

### 1.1 输入字段（字段级）

- `ruleEvaluation.rulesLoaded`
- `ruleEvaluation.matchedRuleIds[]`
- `ruleEvaluation.skippedRuleIds[]`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
- `cards[*].ruleId`
- `cards[*].id`
- `overview.freshness.stale`
- `trends.freshness.stale`
- `anomalies.freshness.stale`

说明：
- recommendations 响应本身无 `freshness` 字段，需使用页面已加载的 `overview/trends/anomalies` freshness。

### 1.2 派生标记

- `staleRuleHit`:
  - `ruleEvaluation.matchedRuleIds` 包含 `"stale-data-detection"`  
  - 或 `cards[*].ruleId === "stale-data-detection"`  
  - 或 `cards[*].id === "rec-data-stale-01"`（兼容旧卡片）
- `hasSkipped`: `ruleEvaluation.skippedRuleIds.length > 0`
- `freshnessStale`: `[overview.freshness.stale, trends.freshness.stale, anomalies.freshness.stale].some(Boolean) === true`

## 2) 场景判定优先级

1. `S2_STALE_WITH_MISSING`：`staleRuleHit && hasSkipped && freshnessStale`
2. `S1_STALE_ONLY`：`staleRuleHit && !hasSkipped && freshnessStale`
3. `S3_STALE_RECOVERED`：`!staleRuleHit && !freshnessStale`

## 3) 三套文案模板（zh/en/vi）

## S1_STALE_ONLY：仅 stale 命中

触发条件（字段级）：

- `ruleEvaluation.rulesLoaded === true`
- `staleRuleHit === true`
- `hasSkipped === false`
- `freshnessStale === true`

模板：

```json
{
  "zh": {
    "title": "数据陈旧，建议谨慎执行",
    "reason": "检测到 stale-data-detection 命中，当前建议基于陈旧数据生成，实时性不足。",
    "action": "先确认数据链路与时间戳同步，再执行中高风险调参。"
  },
  "en": {
    "title": "Data Stale, Apply Recommendations Carefully",
    "reason": "stale-data-detection is matched; current recommendations are generated from stale data and may lag real conditions.",
    "action": "Verify data pipeline and timestamp alignment before medium/high-risk tuning."
  },
  "vi": {
    "title": "Du lieu cu, can than trong khi thuc hien",
    "reason": "Rule stale-data-detection da kich hoat; khuyen nghi hien tai dua tren du lieu cu va co the tre thuc te.",
    "action": "Kiem tra duong du lieu va dong bo timestamp truoc khi dieu chinh rui ro trung/cao."
  }
}
```

## S2_STALE_WITH_MISSING：stale + 规则缺指标

触发条件（字段级）：

- `ruleEvaluation.rulesLoaded === true`
- `staleRuleHit === true`
- `hasSkipped === true`
- `freshnessStale === true`
- 且存在：
  - `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category in ["upstream_unreachable", "field_missing_or_invalid", "unknown"]`

模板：

```json
{
  "zh": {
    "title": "数据陈旧且评估不完整",
    "reason": "stale-data-detection 命中，同时存在规则因缺指标被跳过，当前建议可信度下降。",
    "action": "先修复上游可达性/字段完整性，再回放规则并重新确认建议卡。"
  },
  "en": {
    "title": "Data Stale and Rule Evaluation Incomplete",
    "reason": "stale-data-detection is matched and some rules are skipped due to missing metrics, reducing recommendation reliability.",
    "action": "Restore upstream reachability/field integrity first, then replay rules and re-check recommendation cards."
  },
  "vi": {
    "title": "Du lieu cu va danh gia quy tac chua day du",
    "reason": "stale-data-detection da kich hoat va mot so rule bi bo qua do thieu chi so, lam giam do tin cay cua khuyen nghi.",
    "action": "Uu tien khoi phuc ket noi nguon/du lieu truong, sau do chay lai rule va xac nhan lai the khuyen nghi."
  }
}
```

## S3_STALE_RECOVERED：stale 解除后恢复正常

触发条件（字段级）：

- `ruleEvaluation.rulesLoaded === true`
- `staleRuleHit === false`
- `freshnessStale === false`
- 建议附加条件：`ruleEvaluation.skippedRuleIds.length === 0`（可选，用于“完全恢复”文案）

模板：

```json
{
  "zh": {
    "title": "数据已恢复实时，评估正常",
    "reason": "未检测到 stale-data-detection，且 freshness 已恢复，规则评估可按常规口径解读。",
    "action": "按风险等级执行建议，并持续监控可评估率与来源状态。"
  },
  "en": {
    "title": "Data Freshness Recovered, Evaluation Back to Normal",
    "reason": "stale-data-detection is no longer matched and freshness is restored, so recommendations can be interpreted normally.",
    "action": "Execute actions by risk level and keep monitoring evaluable rate/source status."
  },
  "vi": {
    "title": "Do tuoi du lieu da phuc hoi, danh gia tro lai binh thuong",
    "reason": "stale-data-detection khong con kich hoat va freshness da phuc hoi, co the dien giai khuyen nghi theo cach thong thuong.",
    "action": "Thuc hien theo muc rui ro va tiep tuc theo doi ty le danh gia/trang thai nguon."
  }
}
```

## 4) 接入建议（前端）

- 推荐在 recommendations 区域增加一个 `stale mode banner`，按上面优先级匹配文案。
- 当命中 `S2_STALE_WITH_MISSING` 时，文案级别应高于普通 `rule skip` 提示。
- 文案渲染顺序建议：
  1. stale mode 模板（本文件）
  2. rule skip 明细模板（`hvac-rule-ui-payload-v1`）
  3. 单卡片动作建议
