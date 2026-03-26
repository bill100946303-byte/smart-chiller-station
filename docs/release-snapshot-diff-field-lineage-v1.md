# Snapshot Diff 字段血缘与判定边界 v1

## 1. 目标与边界
- 目标：定义 `snapshot diff` 的字段血缘与判定边界，统一脚本侧消费口径。
- 来源：`docs/release-snapshot-index-latest.json` 的 `entries[0]`（当前）与 `entries[1]`（上一条）。
- 边界：不改业务字段定义；diff 仅用于历史变化判读，不替代 `release-snapshot-latest` 主放行位。

## 2. Diff 字段血缘表

| diff 字段 | 来源（current / previous） | 含义 | 放行影响 |
| --- | --- | --- | --- |
| `diff.current_file` | `entries[0].fileName` | 当前快照文件名 | info |
| `diff.previous_file` | `entries[1].fileName` | 上一条快照文件名 | info |
| `diff.has_previous` | `entries.length >= 2` | 是否具备可比历史样本 | advisory |
| `diff.current_decision` | `entries[0].decision` | 当前快照决策位（`GO/NO-GO/UNKNOWN`） | blocking（当 `NO-GO/UNKNOWN`） |
| `diff.previous_decision` | `entries[1].decision` | 上一条快照决策位 | info |
| `diff.decision_transition` | `entries[1].decision -> entries[0].decision` | 决策变化方向（如 `GO->NO-GO`） | advisory（趋势） |
| `diff.decision_changed` | `entries[0].decision != entries[1].decision` | 决策是否变化 | advisory |
| `diff.reasons_added` | `set(entries[0].reasons) - set(entries[1].reasons)` | 新增阻断原因 | advisory（若当前 `NO-GO` 则随主决策阻断） |
| `diff.reasons_removed` | `set(entries[1].reasons) - set(entries[0].reasons)` | 消失的阻断原因 | info |
| `diff.advisories_added` | `set(entries[0].advisories) - set(entries[1].advisories)` | 新增提示项 | advisory |
| `diff.advisories_removed` | `set(entries[1].advisories) - set(entries[0].advisories)` | 消失的提示项 | info |
| `diff.strict_freshness_changed` | `entries[0].strictFreshness != entries[1].strictFreshness` | strict freshness 策略是否变化 | advisory |
| `diff.runtime_required_changed` | `entries[0].runtimeRequired != entries[1].runtimeRequired` | runtimeRequired 是否变化 | advisory |
| `diff.generated_at_delta_sec` | `ts(entries[0].generatedAt)-ts(entries[1].generatedAt)` | 两次快照间隔秒数 | info |

## 3. 判定边界（v1）

1. 主放行位仍由当前快照决定：`diff.current_decision`（即 `entries[0].decision`）。
2. diff 字段只做变化解释：
   - `reasons/advisories` 增减、策略变化、时间间隔均不单独覆盖主放行位。
3. 若 `entries[0].decision in ["NO-GO","UNKNOWN"]`，即使 diff 显示“改善趋势”，仍按 blocking 处理。

## 4. 无上一次快照默认行为（`insufficient_history`）

触发条件：
- `entries.length < 2` 或 `entries[1]` 缺失。

默认行为：
1. `diff.has_previous=false`
2. `diff.status="insufficient_history"`
3. `diff.reasons_added/reasons_removed/advisories_added/advisories_removed` 置空数组
4. `diff.generated_at_delta_sec=null`
5. 决策处理：
   - 若 `entries[0].decision=="GO"`：diff 侧输出 advisory（不阻断）
   - 若 `entries[0].decision!="GO"`：仍按当前快照主决策阻断

## 5. 脚本消费建议
1. 优先判 `entries[0]` 是否存在；不存在直接失败（index 数据不可用）。
2. 再判 `has_previous`；无历史时输出 `insufficient_history`，不要当解析失败。
3. diff 输出建议结构：
   - `currentDecision / previousDecision / decisionTransition`
   - `reasonsAdded / reasonsRemoved`
   - `advisoriesAdded / advisoriesRemoved`
   - `status`（`ok|insufficient_history|index_invalid`）

## 6. 对默认放行影响
- 本文档为 diff 解释层规范，不改变现有 `release-snapshot-latest` 默认放行链路。
- 结论：对当前默认放行影响 `no`。
