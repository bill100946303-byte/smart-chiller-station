# Sprint1 趋势分析页 Signoff Data v1

本次只判断：趋势分析页 iteration1 还有没有阻断演示的字段问题。

## 结论

- 还有没有阻断演示的字段问题：`没有`
- 哪些 partial 只是观察项：
  - `station_cop`
    - 当前 runtime `overview.energyCards.currentCop=0`
    - `trends.series[metric=currentCop]` 仅 1 个点，`stats.latest=0`
    - 属于“值已接通但语义仍需观察”，不阻断演示
  - `chilled_delta_t_c` 趋势序列 / stats
    - 当前 runtime `overview.energyCards.chilledDeltaT=0.2`
    - 但 `trends.series[metric=chilledDeltaT].points=[]`，`stats.latest/min/max=null`
    - 属于“图表层可降级为空线/空统计”，不阻断演示
  - `cooling_delta_t_c` 趋势序列 / stats
    - 当前 runtime `overview.energyCards.coolingDeltaT=0.4`
    - 但 `trends.series[metric=coolingDeltaT].points=[]`，`stats.latest/min/max=null`
    - 属于“图表层可降级为空线/空统计”，不阻断演示
- 是否阻断趋势页演示（yes/no）：`no`

## 判断依据

- [sprint1-trend-page-data-pack-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-data-pack-v1.md) 已将 `station_cop` 和温差趋势完整度定义为 partial 观察项，不属于 iteration1 硬阻断。
- 当前 runtime `dashboard/overview` 已返回摘要卡主值：
  - `totalPowerKw=0.3`
  - `currentCop=0`
  - `chilledDeltaT=0.2`
  - `coolingDeltaT=0.4`
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- 当前 runtime `dashboard/trends` 已返回：
  - `totalPowerKw` 多点有效，可支撑主趋势图演示
  - `currentCop` 有单点，可作为观察项
  - `chilledDeltaT` / `coolingDeltaT` 序列为空，stats 为空
  - `freshness.stale=false`
  - `sourceStatus.overall=partial`
- 当前前端口径允许 `degraded / noSeries / noStats` 降级，不需要前端猜值。

## 封账判断

- 趋势页数据面可以封账，不阻断演示。
