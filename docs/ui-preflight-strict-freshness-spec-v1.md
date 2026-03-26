# Preflight 严格时效态展示规范 v1.0

## 1) 目标与边界

- 目标：定义 preflight 中 `strict freshness` 门禁结果在页面/文档的统一展示方式。
- 边界：仅规范展示，不修改 `scripts/chiller_ctl.sh` 与判定逻辑。
- 数据源：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --json`。

## 2) 必备字段与展示要求

### `strictFreshness`
- 含义：是否启用严格时效门禁。
- 展示：固定显示为 `ON/OFF`（或 `true/false`），放在时效区首行。
- 判读：`true` 时，只有 `freshness=fresh` 才允许 GO；`false` 时按默认门禁判定。

### `freshness`
- 含义：canonical 报告时效状态（`fresh | warn | stale | unknown`）。
- 展示：紧跟 `strictFreshness`，建议显示为 `freshness: <state>`。
- 判读：`strictFreshness=true` 且 `freshness != fresh` 时，必须 NO-GO。

### `decision`
- 含义：最终放行结论（`GO | NO-GO`）。
- 展示：作为主结论单独一行，字体/颜色优先级高于其余字段。
- 判读：值班播报只读该字段，不做二次推断。

### `reasons` / `advisories`
- 含义：
  - `reasons`：阻断原因（会导致 NO-GO）。
  - `advisories`：提示信息（不单独阻断，可与 GO 共存）。
- 展示顺序：
  1. 先展示 `reasons`（若为空显示 `none`）。
  2. 后展示 `advisories`（若为空显示 `none`）。
- 判读：`reasons` 非空优先处理；`advisories` 仅提示风险，不替代决策字段。

## 3) 前端/文档展示顺序（固定）

1. `decision`
2. `strictFreshness`
3. `freshness`
4. `reasons`
5. `advisories`

## 4) 两种态示例（固定口径）

### 示例 A：`strict=false, decision=GO`

适用：默认模式，允许非 fresh 状态继续 GO（但保留提示）。

```json
{
  "strictFreshness": false,
  "freshness": "stale",
  "decision": "GO",
  "reasons": [],
  "advisories": ["runtime_unavailable_snapshot_present"]
}
```

展示文案建议：
- 决策：`GO`
- 时效模式：`strict freshness OFF`
- 时效状态：`stale（非阻断）`
- 阻断原因：`none`
- 风险提示：`runtime_unavailable_snapshot_present`

### 示例 B：`strict=true, decision=NO-GO（freshness 非 fresh）`

适用：严格模式，`freshness` 为 `warn/stale/unknown` 任一时阻断。

```json
{
  "strictFreshness": true,
  "freshness": "stale",
  "decision": "NO-GO",
  "reasons": ["freshness_not_fresh_strict"],
  "advisories": ["runtime_unavailable_snapshot_present"]
}
```

展示文案建议：
- 决策：`NO-GO`
- 时效模式：`strict freshness ON`
- 时效状态：`stale（阻断）`
- 阻断原因：`freshness_not_fresh_strict`
- 风险提示：`runtime_unavailable_snapshot_present`

## 5) 值班群使用规则

- 对外统一播报：`decision + 首条 reason + strictFreshness/freshness`。
- `advisories` 只作补充说明，不可替代 `reasons`。
- 严格模式下出现 `freshness_not_fresh_strict` 时，必须按 NO-GO 执行，不得人工改判。
