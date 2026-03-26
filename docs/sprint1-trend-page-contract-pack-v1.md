# Sprint1 趋势分析页合同包 v1

## 1. 结论

本次以趋势分析页 iteration1 为范围，当前判断如下：

- 当前趋势页直接复用接口：`dashboard/trends`
- 顶部摘要是否复用 `overview`：`Yes`，但仅建议作为可选辅助接口
- 当前实现与主合同是否一致：`No`
- 是否需要新增 `check-contract` 专门断言：`No`
- 趋势分析页 iteration1 接口是否可联调：`Yes`

不一致的核心原因只有两类：

1. 运行时 `dashboard/trends` 返回了 `generatedAt`，但主合同和 example 还未把它正式纳入
2. 主合同声明 `range` 只能是 `24h|7d|30d`，且存在 `400 Invalid range` 错误响应；但当前实现未校验该枚举，传入 `90d` 仍会原样返回

## 2. 当前趋势页直接复用接口清单

Iteration1 直接复用如下接口：

- `GET /bff/v1/sites/{siteId}/dashboard/trends`

可选辅助接口：

- `GET /bff/v1/sites/{siteId}/dashboard/overview`

对应关系：

- `dashboard/trends`
  - 用于趋势主图、指标切换、趋势摘要
  - 是趋势页 iteration1 的主接口
- `dashboard/overview`
  - 用于页面顶部 KPI 摘要卡
  - 不是趋势图渲染的硬依赖

## 3. 顶部摘要是否复用 `overview`

结论：`Yes`

建议方式：

- 趋势页顶部摘要可以复用 `dashboard/overview.energyCards`
- 若需要设备规模概览，也可以复用 `dashboard/overview.deviceSummary`

但要明确两个边界：

1. `overview` 只是趋势页顶部辅助接口，不应阻塞 `dashboard/trends` 的主联调
2. `overview.alarmSummary` 当前仍是 `high|medium|low` 口径，不应作为趋势页主逻辑的告警等级基线

因此 iteration1 的推荐接法是：

- 主体图表先接 `dashboard/trends`
- 顶部卡片按页面需要补接 `dashboard/overview`
- 不把 `overview.alarmSummary` 作为趋势页 contract 收口的一部分

## 4. Range / Query 参数最终集

Iteration1 最终参数集建议冻结为：

- `siteId`
  - 位置：path
  - 必填：`Yes`
- `range`
  - 位置：query
  - 必填：`No`
  - 枚举：`24h|7d|30d`
  - 默认值：`24h`

Iteration1 不纳入：

- `metric`
- `compare`
- `startTime`
- `endTime`
- `granularity`

实现现状说明：

- OpenAPI 已把 `range` 定义成 `24h|7d|30d`
- 当前 route/service 仍未真正做枚举校验
- 本地直接调用 `getDashboardTrends(config, "126lnoffice", "90d")`，当前仍返回：
  - `range: "90d"`

结论：

- `range` 的 contract 已冻结
- 但运行时校验尚未完全跟上合同

## 5. `series / stats / freshness / sourceStatus` 最小 Contract

### 5.1 顶层最小结构

趋势页 iteration1 最小 contract 为：

- `site`
- `range`
- `series`
- `stats`
- `freshness`
- `sourceStatus`

当前运行时还会额外返回：

- `generatedAt`

本版把它视为“运行时额外字段”，尚未纳入 iteration1 最小 contract。

### 5.2 `series[]`

`series[]` 的最小结构：

- `metric`
- `label`
- `points`

`points[]` 的最小结构：

- `t`
- `v`

Iteration1 推荐稳定指标集：

- `totalPowerKw`
- `currentCop`
- `chilledDeltaT`
- `coolingDeltaT`

说明：

- 当前运行时实际会稳定产出以上 4 个 metric 槽位
- 但当前主合同和默认 example 还没有把“必须出现这 4 个 metric”写成硬约束

### 5.3 `stats[]`

`stats[]` 的最小结构：

- `metric`
- `latest`
- `min`
- `max`

约束：

- `stats[*].metric` 应与 `series[*].metric` 对齐
- 当前 `check-contract` 已有这一层回归检查

### 5.4 `freshness`

`freshness` 的最小结构：

- `latestTimestamp`
- `stale`
- `ageHours`

语义：

- 前端可直接用来判断趋势数据是否陈旧
- 即使运行态上游失败，也应继续保留该结构

### 5.5 `sourceStatus`

`sourceStatus` 的最小结构：

- `overall`
- `sources`

`sources[]` 的最小结构：

- `key`
- `endpoint`
- `ok`
- `status`
- `message`
- `error`
- `rows`

Iteration1 至少要求包含的 source key：

- `energyCurve`
- `runParams`

当前 contract 侧已经通过 `check-contract` 锁住这两个 key 必须存在。

## 6. 当前实现 / 主合同 / Example / 运行态 是否一致

结论：`No`

### 6.1 已一致的部分

- `dashboard/trends` 已在 OpenAPI 主合同中
- `dashboard-trends.json` 已作为正式 example 存在
- `check-contract` 已覆盖该 path
- 趋势主结构 `site/range/series/stats/freshness/sourceStatus` 在实现、合同、example 三侧都存在
- `sourceStatus` 的关键 source key 约束已进入主门禁

### 6.2 未完全一致的部分

#### A. `generatedAt`

- 当前运行时会返回 `generatedAt`
- 当前 `DashboardTrendsResponse` schema 未声明它
- 当前 `dashboard-trends.json` 也未体现它

这意味着：

- 运行态与主合同 / example 之间存在“额外字段漂移”

#### B. `range` 枚举校验

- OpenAPI 声明只允许 `24h|7d|30d`
- OpenAPI 还定义了 `400 Invalid range`
- 当前 route/service 未执行这层校验
- 本地调用传入 `90d`，当前实现仍会返回 `range: "90d"`

这意味着：

- 运行态行为尚未完全兑现主合同的参数语义

#### C. 默认 example 与运行时指标基线

- 当前运行时会固定产出 `totalPowerKw/currentCop/chilledDeltaT/coolingDeltaT` 四个指标槽位
- 当前默认 `dashboard-trends.json` 只示例了前三个指标，未包含 `coolingDeltaT`

这不构成 schema 级错误，但说明：

- 默认 example 还没有完整表达运行时的标准指标基线

## 7. 是否需要新增 `check-contract` 专门断言

结论：`No`

原因：

- `dashboard/trends` 已在 `CONTRACT_PATHS`
- 当前 `check-contract` 已有 `runTrendsRegressions(...)`
- 当前已覆盖的趋势专项门禁包括：
  - `range` 必须为 `24h|7d|30d`
  - `stats[*].metric` 必须覆盖 `series[*].metric`
  - `sourceStatus.sources[*].key` 必须包含 `energyCurve` 和 `runParams`
  - `runParams=500` 的 fallback baseline probe

因此：

- 当前缺口主要是实现层与 example 表达层
- 不是“趋势页完全没有专项门禁”

补充建议：

- 若后续决定把 `generatedAt` 升格为正式字段，届时同步更新 schema/example 即可
- 若后续要把 4 个趋势 metric 固定为正式 contract，再补对应断言更合适

## 8. 最终拍板

拍板结论：

- 趋势分析页 iteration1 接口是否可联调：`Yes`

联调前提：

- 主图直接使用 `GET /bff/v1/sites/{siteId}/dashboard/trends`
- 顶部摘要按需复用 `GET /bff/v1/sites/{siteId}/dashboard/overview`
- 前端 `range` 先按 `24h|7d|30d` 固定选项发起请求，不依赖服务端当前的无效值拦截

一句话收口：

- 趋势页 iteration1 已经具备联调条件
- 但要承认当前仍存在“运行时比主合同多一个 `generatedAt`，且 `range` 校验尚未落地”的实现漂移
