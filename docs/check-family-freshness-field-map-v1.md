# Check-Family 新鲜度字段映射 v1

## 1. 目标与边界
- 目标：固化 `check-family` 的 freshness 字段口径，避免值班与脚本对“新鲜/陈旧”判读不一致。
- 数据对象：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- 边界：仅文档，不改字段语义，不改 `null_strategy`，不改现有校验实现。

## 2. 字段映射（三列表 + requiredness）

| freshness 字段 | 来源字段路径/派生逻辑 | 放行影响（blocking/advisory/info） | requiredness | 缺失默认行为 | fail-open/closed | 是否影响默认放行 |
| --- | --- | --- | --- | --- | --- | --- |
| `generatedAt` | `$.generatedAt` | advisory | required | 缺失或不可解析时置 `state="unknown"`、`ageMinutes=null` | fail-open（default）；strict 可升级 fail-closed | no |
| `ageMinutes` | 派生：`now_utc - $.generatedAt`（分钟） | advisory | required | 无法计算时置 `null` 并联动 `state="unknown"` | fail-open | no |
| `state` | 派生：`ageMinutes` + 阈值（`fresh` `<30`；`warn` `30~59`；`stale` `>=60`；`unknown`） | advisory（default）；blocking（strict） | required | 缺失时置 `"unknown"` | fail-open（default）；strict fail-closed | no（default） |
| `maxAgeMin` | 固定阈值：`60`（口径来源：`acceptance-snapshot-freshness-policy-v1.md`） | info | required | 缺失时回退 `60` | fail-open | no |

## 3. 最小字段覆盖核对
已覆盖最小字段：
- `generatedAt`
- `ageMinutes`
- `state`
- `maxAgeMin`

## 4. 口径说明
1. `check-family-latest.json` 当前仅原生提供 `generatedAt`，其余 freshness 字段为消费层派生字段。
2. 阈值采用统一基线：`warn=30min`、`stale=60min`（与 release-gate 时效口径一致）。
3. 默认放行模式下，freshness 作为风险提示；在 strict 模式可升级为阻断条件（`state!=fresh`）。

## 5. 证据路径
- `check-family` 合同：`/Users/billchow/Documents/智慧冷冻站/docs/check-family-contract-v1.md`
- `check-family` 校验脚本：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-check-family.js`
- 时效阈值策略：`/Users/billchow/Documents/智慧冷冻站/docs/acceptance-snapshot-freshness-policy-v1.md`

## 6. 统计与结论
- blocking 数：`0`（按 default 口径统计）
- warning 数：`3`
- 是否影响默认放行：`no`
