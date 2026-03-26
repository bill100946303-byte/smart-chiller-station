# HVAC Recommendations 可评估率文案模板 v1

目标：为 recommendations 增加“可评估率”说明文案。  
边界：不改阈值、不改规则逻辑，仅定义文案与触发条件。

## 1) 计算口径（字段级）

推荐前端统一计算：

- `totalEnabled = ruleEvaluation.totalEnabledRules`
- `skipped = ruleEvaluation.skippedRuleIds.length`
- `evaluable = totalEnabled - skipped`
- `evaluableRate = evaluable / totalEnabled`
- `evaluableRatePct = (evaluableRate * 100).toFixed(0)`

变量占位符（模板可直接替换）：

- `{evaluable}`、`{totalEnabled}`、`{skipped}`、`{evaluableRatePct}`
- `{topSkipCategory}`（从 `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category` 取最高频）

## 2) 触发条件（字段级）

判定优先级（从高到低）：
1. `DATA_STALE`
2. `HAS_SKIPPED`
3. `NO_SKIPPED`

### A. `HAS_SKIPPED`（当 skipped > 0）

触发条件：

- `ruleEvaluation.rulesLoaded === true`
- `ruleEvaluation.totalEnabledRules > 0`
- `Array.isArray(ruleEvaluation.skippedRuleIds) && ruleEvaluation.skippedRuleIds.length > 0`

### B. `NO_SKIPPED`（当 skipped = 0）

触发条件：

- `ruleEvaluation.rulesLoaded === true`
- `ruleEvaluation.totalEnabledRules > 0`
- `Array.isArray(ruleEvaluation.skippedRuleIds) && ruleEvaluation.skippedRuleIds.length === 0`

### C. `DATA_STALE`（当数据陈旧）

触发条件（任一满足）：

- `cards[*].ruleId === "stale-data-detection"`  
  或
- `ruleEvaluation.matchedRuleIds` 包含 `"stale-data-detection"`  
  或
- `cards[*].id === "rec-data-stale-01"`（兼容未透出 `ruleId` 的旧卡片）

说明：
- `DATA_STALE` 命中后，优先覆盖 `HAS_SKIPPED/NO_SKIPPED` 的主文案。

## 3) 三语模板

建议渲染字段：`title / reason / action`

### 模板：`HAS_SKIPPED`

```json
{
  "zh": {
    "title": "规则可评估率受限",
    "reason": "当前可评估 {evaluable}/{totalEnabled}（{evaluableRatePct}%），已跳过 {skipped} 条规则，主要原因：{topSkipCategory}。",
    "action": "先修复跳过原因后再解读建议卡，避免把链路问题当业务异常。"
  },
  "en": {
    "title": "Evaluable Rule Coverage Limited",
    "reason": "{evaluable}/{totalEnabled} rules are evaluable ({evaluableRatePct}%), with {skipped} skipped. Primary cause: {topSkipCategory}.",
    "action": "Resolve skip causes first, then interpret recommendation cards."
  },
  "vi": {
    "title": "Ty le quy tac danh gia bi han che",
    "reason": "Hien danh gia duoc {evaluable}/{totalEnabled} ({evaluableRatePct}%), da bo qua {skipped} quy tac. Nguyen nhan chinh: {topSkipCategory}.",
    "action": "Uu tien xu ly nguyen nhan bo qua truoc khi dien giai khuyen nghi."
  }
}
```

### 模板：`NO_SKIPPED`

```json
{
  "zh": {
    "title": "规则可评估率正常",
    "reason": "当前可评估 {evaluable}/{totalEnabled}（{evaluableRatePct}%），无规则跳过。",
    "action": "可直接结合风险等级与动作建议执行巡检或调优。"
  },
  "en": {
    "title": "Evaluable Rule Coverage Normal",
    "reason": "{evaluable}/{totalEnabled} rules are evaluable ({evaluableRatePct}%), with no skipped rules.",
    "action": "Proceed with actions based on risk and recommendation details."
  },
  "vi": {
    "title": "Ty le quy tac danh gia binh thuong",
    "reason": "Hien danh gia duoc {evaluable}/{totalEnabled} ({evaluableRatePct}%), khong co quy tac nao bi bo qua.",
    "action": "Co the thuc hien kiem tra/dieu chinh theo muc rui ro va khuyen nghi."
  }
}
```

### 模板：`DATA_STALE`

```json
{
  "zh": {
    "title": "数据陈旧，可评估率仅供参考",
    "reason": "检测到数据新鲜度异常（stale-data-detection）。当前可评估 {evaluable}/{totalEnabled}（{evaluableRatePct}%）可能高估真实可用性。",
    "action": "先恢复数据链路与时间戳同步，再执行高风险调参。"
  },
  "en": {
    "title": "Data Stale, Evaluable Rate is Advisory",
    "reason": "Data freshness issue detected (stale-data-detection). Current evaluable ratio {evaluable}/{totalEnabled} ({evaluableRatePct}%) may overstate reliability.",
    "action": "Restore data pipeline and timestamp alignment before high-risk tuning."
  },
  "vi": {
    "title": "Du lieu cu, ty le danh gia chi de tham khao",
    "reason": "Phat hien van de do moi du lieu (stale-data-detection). Ty le hien tai {evaluable}/{totalEnabled} ({evaluableRatePct}%) co the cao hon do tin cay thuc te.",
    "action": "Khoi phuc duong du lieu va dong bo timestamp truoc khi dieu chinh rui ro cao."
  }
}
```

## 4) 字段映射建议（前端）

- `topSkipCategory` 取值建议：
  - 来源：`ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
  - 映射优先级：`upstream_unreachable` > `field_missing_or_invalid` > `unknown`
- `category` 显示文案建议：
  - `upstream_unreachable` -> `上游不可达 / Upstream unreachable / Nguon khong truy cap duoc`
  - `field_missing_or_invalid` -> `字段缺失或无效 / Field missing or invalid / Thieu hoac sai truong du lieu`
  - `unknown` -> `未知 / Unknown / Khong xac dinh`

## 5) 合同与边界确认

- 依赖字段均来自现有 recommendations 合同：
  - `ruleEvaluation.totalEnabledRules`
  - `ruleEvaluation.skippedRuleIds`
  - `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
  - `ruleEvaluation.matchedRuleIds`
  - `cards[*].ruleId` / `cards[*].id`
- 未引入新阈值、未改规则触发逻辑、未改 ruleId。
