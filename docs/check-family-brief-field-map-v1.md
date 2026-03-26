# Check-Family-Brief 字段映射 v1

## 1. 目标与边界
- 目标：建立 `check-family-brief` 消费字段映射，供值班摘要与前端折叠态统一使用。
- 数据来源：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- 边界：仅文档，不改字段语义，不改 `null_strategy`，不新增业务字段。

## 2. 三列表（brief 字段 -> 来源字段路径 -> 放行影响）

| brief 字段 | 来源字段路径/派生逻辑 | 放行影响（blocking/advisory/info） | requiredness | 缺失默认行为 | fail-open/closed | 是否影响默认放行 |
| --- | --- | --- | --- | --- | --- | --- |
| `generatedAt` | `$.generatedAt` | advisory | required | 缺失时置 `"unknown"` 并将 `freshness.state="unknown"` | fail-open | no |
| `overall` | `$.overall` | blocking | required | 缺失时置 `FAIL` | fail-closed | yes |
| `passedCount` | `$.passedCount` | blocking | required | 缺失时置 `0` | fail-closed | yes |
| `totalCount` | `$.totalCount` | blocking | required | 缺失时置 `0`（并视为不可放行） | fail-closed | yes |
| `freshness.state` | 派生：由 `generatedAt` 计算 `ageMinutes` 后按阈值映射（`fresh<30`，`warn=30~59`，`stale>=60`，否则 `unknown`） | advisory（default）；blocking（strict） | required | 缺失时置 `unknown` | fail-open（default）；strict fail-closed | no（default） |
| `failedCount` | 派生：`count($.checks[] | select(.ok != true))` | advisory | required | 缺失时按派生重算；无法重算则 `0` | fail-open | no |
| `topFailedChecks[]` | 派生：`$.checks[] | select(.ok != true) | .script`，按原顺序取前 `N=3` | advisory | optional | 缺失时置 `[]` | fail-open | no |

## 3. 最小字段覆盖核对
已覆盖最小字段：
- `generatedAt`
- `overall`
- `passedCount`
- `totalCount`
- `freshness.state`
- `failedCount`
- `topFailedChecks[]`

## 4. 派生规则补充
1. `failedCount` 与 `topFailedChecks[]` 均以 `checks[].ok` 为唯一判定源，不直接读取任何文案字段。
2. `topFailedChecks[]` 推荐用于折叠态提示，不替代完整失败清单。
3. `freshness.state` 与既有时效口径对齐（`warn=30`、`stale=60`），避免与 release-gate 判断漂移。

## 5. 证据路径
- 数据源：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- 主校验：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family.js`
- 新鲜度校验：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family-freshness.js`
- 时效阈值基线：`/Users/billchow/Documents/智慧冷冻站/docs/acceptance-snapshot-freshness-policy-v1.md`

## 6. 统计与结论
- blocking数：`3`
- warning数：`4`
- 是否影响默认放行：`no`
