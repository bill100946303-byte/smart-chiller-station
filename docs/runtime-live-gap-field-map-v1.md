# Runtime Live Gap Field Map v1

## 1. 目标与边界
- 目标：把“接口已打通、sourceStatus key 已存在，但运行态字段仍缺失”的 3 个核心字段单独收成一张 live gap 表，供巡检和排障复用。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/metric-availability-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-field-map-v1.md`
- 运行态观测依据：
  - `curl -fsS http://127.0.0.1:8787/bff/v1/sites/126lnoffice/dashboard/overview`
  - `curl -fsS http://127.0.0.1:8787/bff/v1/sites/126lnoffice/recommendations`
  - 观测时间：`2026-03-12T21:15:09Z`

## 2. “已打通但字段缺失”的判定标准
同时满足以下条件时，纳入本表：
1. 上游 endpoint 可达，当前返回 `HTTP 200`。
2. BFF 已暴露对应 `sourceStatus` key。
3. 运行态值路径仍为 `null` 或 `sourceStatus.ok=false`。
4. 缺失分类为 `field_missing_or_invalid`，而不是 `upstream_unreachable`。

## 3. 运行态缺口字段表

| 字段 | source_endpoint | expected_fields | current_status | release_impact | suggested_owner | next_check |
| --- | --- | --- | --- | --- | --- | --- |
| `chilled_delta_t_c` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `chilledWaterTemperatureDifference`；回退读卡片 `title=冷冻水温差 -> tagValue` | endpoint 已通，但字段仍缺。`2026-03-12T21:15:09Z` 观测：`dashboard/overview.energyCards.chilledDeltaT=null`；`recommendations.sourceStatus[key=metric.chilled_delta_t_c].ok=false`，分类 `field_missing_or_invalid`。 | warning | `legacy` | 复查 `overview.energyCards.chilledDeltaT != null`；复查 `recommendations.sourceStatus[key=metric.chilled_delta_t_c].ok == true`；确认 `skippedRuleDetails` 不再出现 `metric=chilled_delta_t_c`。 |
| `cooling_delta_t_c` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `chilledOutWaterTemperatureDifference`；回退读卡片 `title=冷却水温差 -> tagValue` | endpoint 已通，但字段仍缺。`2026-03-12T21:15:09Z` 观测：`dashboard/overview.energyCards.coolingDeltaT=null`；`recommendations.sourceStatus[key=metric.cooling_delta_t_c].ok=false`，分类 `field_missing_or_invalid`。 | warning | `legacy` | 复查 `overview.energyCards.coolingDeltaT != null`；复查 `recommendations.sourceStatus[key=metric.cooling_delta_t_c].ok == true`；确认 `skippedRuleDetails` 不再出现 `metric=cooling_delta_t_c`。 |
| `station_cop` | `/zsqy/homepage/{siteId}/getEquipmentEnergyStatisticsCurve` | `coldStationCop` / `cop`；回退读卡片 `title contains COP -> tagValue` | endpoint 已通，但字段仍缺。`2026-03-12T21:15:09Z` 观测：`dashboard/overview.energyCards.currentCop=null`；`recommendations.sourceStatus[key=metric.station_cop].ok=false`，分类 `field_missing_or_invalid`。同时 overview `energy` source message 显示 `homeEnergyEfficiency` 与 `runParamsByTag.currentCop` 回退行数均为 `0`。 | warning | `legacy` | 复查 `overview.energyCards.currentCop` 为有限值且 `>0`；复查 `recommendations.sourceStatus[key=metric.station_cop].ok == true`；确认 `skippedRuleDetails` 不再出现 `metric=station_cop`。 |

## 4. 口径说明
1. 这 3 项当前都属于“endpoint 已通，但字段值未到位”的 live gap，不再归类为 `upstream_unreachable`。
2. 当前缺口主要影响：
   - `recommendations.ruleEvaluation.skippedRuleIds`
   - KPI 卡片值缺失（`chilledDeltaT` / `coolingDeltaT` / `currentCop`）
3. 当前缺口不直接进入 `release-command-center-sync` 的 blocking 链：
   - `release-command-center-sync` 只消费 release artifact 链路；
   - 因此本表统一标记为 `release_impact=warning`。

## 5. 与现有文档关系
- `metric-availability-v1.md` 负责定义“应该从哪里取、缺失如何分类”。
- 本文档负责补“当前运行态已经出现了什么 live gap”。
- `release-command-center-sync-field-map-v1.md` 用于说明这些 gap 不直接翻转默认放行，但会降低运行态建议质量。

## 6. 统计与结论
- blocking 数量：`0`
- warning 数量：`3`
- 是否影响默认放行：`no`
