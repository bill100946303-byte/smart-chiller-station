# Sprint1 趋势分析页数据包 v1

## 1. 目标与边界

- 目标：一次性把趋势分析页 iteration1 的字段、来源、成熟度和降级策略定清楚，给前后端直接联调。
- 范围固定：
  - 顶部摘要卡
  - 主趋势图
  - stats 区
  - freshness / sourceStatus
- 输入依据：
  - [sprint1-trend-alarm-data-ready-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-alarm-data-ready-v1.md)
  - [runtime-enhanced-field-delta-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md)
  - [field-display-dictionary-v1.json](/Users/billchow/Documents/智慧冷冻站/docs/field-display-dictionary-v1.json)
  - [dashboard-trends.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/dashboard-trends.json)
  - [dashboard-overview.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/dashboard-overview.json)
  - [TrendPanel.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/dashboard/TrendPanel.tsx)
  - [TrendAnalysisPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx)
  - [legacyEnergyAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyEnergyAdapter.js)

## 2. 总结论

趋势分析页 iteration1 当前可以直接联调。

原因：

- `dashboard/overview` 已能提供 4 张顶部摘要卡的主值。
- `dashboard/trends` 合同、example、前端消费页面和趋势组件已经对齐。
- 即使部分指标或序列不稳定，前端也已有 `noSeries` / `continuityHint` / `noStats` / `stale` / `degraded` 降级路径。

当前没有“硬阻断演示”的字段；剩余问题收敛为两个非阻断 partial：

- `station_cop` 语义仍需持续观察
- `cooling_delta_t_c` 的趋势序列 / stats 完整度仍未被 example 完整覆盖

## 3. iteration1 最小字段集合

### 3.1 顶部摘要卡

- `station_total_power_kw`
- `station_cop`
- `chilled_delta_t_c`
- `cooling_delta_t_c`

口径：

- 优先取 `dashboard/overview.energyCards.*`
- 缺失时可回退到 `dashboard/trends.stats[metric=*].latest`
- 若两侧都缺失，则显示 `--`，不伪造数值

### 3.2 主趋势图

- `trends.range`
- `trend_ts` = `dashboard/trends.series[].points[].t`
- `trend_value` = `dashboard/trends.series[].points[].v`
- `series[].metric`
- `series[].label`

最小可演示条件：

- 至少 1 条有效序列
- 至少 3 个连续有效点

说明：

- 这是 [TrendPanel.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/dashboard/TrendPanel.tsx) 的真实依赖。
- 不满足时不阻断 iteration1，而是进入 `noSeries` 或 `continuityHint`。

### 3.3 stats 区

- `stats[].metric`
- `stats[].latest`
- `stats[].min`
- `stats[].max`

说明：

- 当前 stats 区直接消费 `trends.stats`
- 若整组 stats 缺失，页面允许进入 `noStats`

### 3.4 freshness / sourceStatus

- `overview.freshness.latestTimestamp`
- `overview.freshness.stale`
- `overview.sourceStatus.overall`
- `overview.sourceStatus.sources[]`
- `trends.freshness.latestTimestamp`
- `trends.freshness.stale`
- `trends.sourceStatus.overall`
- `trends.sourceStatus.sources[]`

说明：

- 顶部 banner 依赖 overview + trends 的合并 `sourceStatus`
- 摘要卡 stale 判断依赖 overview + trends 的合并 freshness
- 主图 stale 提示依赖 trends freshness

## 4. 分区判断

### 4.1 顶部摘要卡

结论：`4/4 可接`

- `station_total_power_kw`：`ready`
- `station_cop`：`partial`
- `chilled_delta_t_c`：`ready`
- `cooling_delta_t_c`：`ready`

说明：

- `station_cop` 的 partial 不是结构缺失，而是 [runtime-enhanced-field-delta-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md) 已明确提醒 `currentCop=0` 需要语义复核。
- iteration1 可以直接联调，但建议在缺失或异常时展示 `-- / 待校验`。

### 4.2 主趋势图

结论：`可联调，可降级`

稳定项：

- `totalPowerKw`：`ready`
- `chilledDeltaT`：`ready`

观察项：

- `currentCop`：`partial`
- `coolingDeltaT`：`partial`

说明：

- [legacyEnergyAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyEnergyAdapter.js#L870) 到 [legacyEnergyAdapter.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/src/adapters/legacyEnergyAdapter.js#L885) 已固定组装 4 个 metric。
- 但 [dashboard-trends.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/openapi/examples/dashboard-trends.json) 当前只示例了 `totalPowerKw/currentCop/chilledDeltaT` 三条线，未给 `coolingDeltaT`。
- 因此 iteration1 可以先接受“3 线稳定 + 第 4 线可空”的联调状态。

### 4.3 stats 区

结论：`可联调，可单卡降级`

- `station_total_power_kw`：`ready`
- `station_cop`：`partial`
- `chilled_delta_t_c`：`ready`
- `cooling_delta_t_c`：`partial`

说明：

- 当前 stats 区没有前端本地派生回退；它直接消费 `trends.stats`
- 所以 `cooling_delta_t_c` stats 缺失时，建议 iteration1 先不渲染该卡，而不是阻断整页

### 4.4 freshness / sourceStatus

结论：`ready`

原因：

- overview example 和 trends example 都已经提供 `freshness` 与 `sourceStatus`
- [TrendAnalysisPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx) 已有完整 banner 和 degraded/stale 路径

## 5. 哪些字段可以先降级占位

- `station_cop`
  - 卡片：显示 `-- / 待校验`
  - 曲线：缺失时隐藏 COP 线
  - stats：缺失时显示 `--`
- `cooling_delta_t_c` 的 chart/stats
  - 曲线：未返回时先接受 3 线图
  - stats：缺失时不展示该卡
- `trend_ts` / `trend_value`
  - 若有效连续点不足 3，直接进入 `continuityHint`
  - 若 series 为空，直接进入 `noSeries`

## 6. 哪些字段阻断演示

当前没有硬阻断字段。

说明：

- 这不是说所有指标都已经完全稳定，而是 iteration1 已经具备完整的降级路径。
- 因此 partial 项会影响“展示完整度”，不会阻断“联调和演示”。

## 7. ready / partial / missing 统计

- `ready`：`18`
- `partial`：`5`
- `missing`：`0`

## 8. 拍板结论

- 趋势分析页 iteration1 是否可直接联调：`yes`

补一句落地判断：

- iteration1 可以按“4 卡 + 主图 + stats + freshness/sourceStatus”整页联调。
- 其中 `station_cop` 与 `cooling_delta_t_c` 趋势完整度属于非阻断观察项，不需要再等一轮字段确认才能开工。
