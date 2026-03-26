# HVAC Station COP 缺失运营文案模板 v1

目标：补充 `station_cop` 指标缺失场景下的 recommendations 运营文案。  
边界：不改阈值、不改 `ruleId`、不改 evaluator。

## 1) 输入字段与派生标记

输入字段（字段级）：
- `ruleEvaluation.rulesLoaded`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].metric`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
- `ruleEvaluation.skippedRuleIds[]`
- `overview.freshness.stale`
- `trends.freshness.stale`
- `anomalies.freshness.stale`

派生标记：
- `copMissing`：存在任意 `missingMetrics[*].metric === "station_cop"`
- `onlyCopMissing`：`copMissing === true` 且不存在 `missingMetrics[*].metric !== "station_cop"`
- `freshnessStale`：`[overview.freshness.stale, trends.freshness.stale, anomalies.freshness.stale].some(Boolean) === true`
- `copMissingCategoryTop`：在 `metric === "station_cop"` 的项中取最高频 `category`（`upstream_unreachable` / `field_missing_or_invalid` / `unknown`）

## 2) 场景判定（3个）

1. `S1_COP_ONLY_MISSING`：仅 `station_cop` 缺失  
2. `S2_COP_MISSING_WITH_STALE`：`station_cop` 缺失且数据陈旧  
3. `S3_COP_RECOVERED`：`station_cop` 恢复可评估

## 3) 三语文案模板

## S1_COP_ONLY_MISSING（仅缺失）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `onlyCopMissing === true`
- `freshnessStale === false`

模板：

```json
{
  "zh": {
    "mainHint": "COP指标缺失",
    "subHint": "当前仅 station_cop 无法评估，其他关键规则输入基本可用。",
    "action": "优先检查 COP 字段映射与采样值有效性，再复核建议卡结论。"
  },
  "en": {
    "mainHint": "COP Metric Missing",
    "subHint": "Only station_cop is not evaluable in the current window; other key rule inputs are mostly available.",
    "action": "Check COP field mapping and sample validity first, then re-validate recommendation conclusions."
  },
  "vi": {
    "mainHint": "Thieu chi so COP",
    "subHint": "Trong cua so hien tai chi station_cop khong danh gia duoc; cac dau vao quan trong khac van kha dung.",
    "action": "Uu tien kiem tra mapping truong COP va tinh hop le cua mau, sau do xac nhan lai ket luan khuyen nghi."
  }
}
```

## S2_COP_MISSING_WITH_STALE（缺失 + stale）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `onlyCopMissing === true`
- `freshnessStale === true`

模板：

```json
{
  "zh": {
    "mainHint": "COP缺失且数据陈旧",
    "subHint": "station_cop 当前不可评估，且 freshness 为 stale，建议可信度进一步下降。",
    "action": "先恢复数据链路时效，再修复 COP 字段映射/采样，最后回放规则。"
  },
  "en": {
    "mainHint": "COP Missing with Stale Data",
    "subHint": "station_cop is not evaluable and freshness is stale, which further reduces recommendation reliability.",
    "action": "Restore data freshness first, then fix COP mapping/sampling, and replay rule evaluation."
  },
  "vi": {
    "mainHint": "Thieu COP va du lieu cu",
    "subHint": "station_cop khong danh gia duoc va freshness dang stale, lam giam them do tin cay cua khuyen nghi.",
    "action": "Khoi phuc do moi du lieu truoc, sau do sua mapping/lay mau COP va chay lai danh gia rule."
  }
}
```

## S3_COP_RECOVERED（恢复）

触发条件（字段级）：
- `ruleEvaluation.rulesLoaded === true`
- `copMissing === false`
- `freshnessStale === false`

模板：

```json
{
  "zh": {
    "mainHint": "COP评估已恢复",
    "subHint": "station_cop 缺失已解除，当前可按常规口径解读相关建议。",
    "action": "继续监控 sourceStatus 与 skipped 明细，确认 COP 持续稳定可用。"
  },
  "en": {
    "mainHint": "COP Evaluation Restored",
    "subHint": "station_cop missing condition is cleared; related recommendations can be interpreted normally.",
    "action": "Keep monitoring sourceStatus and skipped details to ensure COP remains stable and available."
  },
  "vi": {
    "mainHint": "Da phuc hoi danh gia COP",
    "subHint": "Tinh trang thieu station_cop da duoc giai quyet; co the dien giai khuyen nghi lien quan theo cach thong thuong.",
    "action": "Tiep tuc theo doi sourceStatus va chi tiet skipped de dam bao COP on dinh va kha dung."
  }
}
```

## 4) 接入建议（前端）

- 该模板建议用于 recommendations 顶部运营提示位（banner/notice），与规则卡并行展示。
- 当命中 `S2_COP_MISSING_WITH_STALE`，优先级应高于 `S1_COP_ONLY_MISSING`。
- 可附带 `copMissingCategoryTop` 作为调试信息，不建议在默认视图直接展示原始错误文本。

## 5) 边界声明

- 未修改规则阈值。
- 未修改任何 `ruleId`。
- 未修改 evaluator 或规则判定逻辑。
