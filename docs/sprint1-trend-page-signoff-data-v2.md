# Sprint1 趋势分析页 Signoff Data v2

本次只回答：趋势分析页 iteration1 还有没有字段问题阻断演示。

## 结论

- 是否还有阻断演示的字段问题：`没有`
- 哪些 partial 只是观察项：
  - `station_cop`
    - 当前 runtime `overview.energyCards.currentCop=0`
    - `trends.series[metric=currentCop]` 仅 1 个点，`stats.latest=0`
    - 已接通但仍属语义观察项，不阻断演示
  - `chilled_delta_t_c` 趋势序列 / stats
    - 当前 runtime `overview.energyCards.chilledDeltaT=0.2`
    - 但 `trends.series[metric=chilledDeltaT].points=[]`，`stats.latest/min/max=null`
    - 属于图表层可降级项，不阻断演示
  - `cooling_delta_t_c` 趋势序列 / stats
    - 当前 runtime `overview.energyCards.coolingDeltaT=0.4`
    - 但 `trends.series[metric=coolingDeltaT].points=[]`，`stats.latest/min/max=null`
    - 属于图表层可降级项，不阻断演示
- 是否阻断趋势页演示（yes/no）：`no`

## 依据

- [sprint1-trend-page-data-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-data-pack-v1.md) 已将上述 partial 定义为 iteration1 观察项，不是硬阻断。
- 当前 runtime `dashboard/overview` 已返回 4 张摘要卡主值：
  - `totalPowerKw=0.3`
  - `currentCop=0`
  - `chilledDeltaT=0.2`
  - `coolingDeltaT=0.4`
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- 当前 runtime `dashboard/trends` 已返回：
  - `totalPowerKw` 多点有效，可支撑主趋势图演示
  - `currentCop` 有单点，可保留为观察项
  - `chilledDeltaT` / `coolingDeltaT` 序列为空，stats 为空
  - `freshness.stale=false`
  - `sourceStatus.overall=partial`，但已明确是可降级状态，不要求前端猜值

## 封账判断

- 趋势页数据面可以封账。
