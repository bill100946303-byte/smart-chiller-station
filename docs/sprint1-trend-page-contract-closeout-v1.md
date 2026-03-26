# Sprint1 趋势分析页合同收口 closeout v1

## 1. 结论

本次对 `dashboard/trends` 的两处关键漂移做最终拍板：

- 当前实现与最终 contract 是否一致：`No`
- `generatedAt` 是否入主合同：`Yes`
- `range` 是否必须做运行时枚举校验：`Yes`
- 是否需要新增 `check-contract` 专门断言：`No`

收口后的最终口径是：

1. `generatedAt` 进入 `dashboard/trends` 主合同
2. `range` 继续保持 `24h|7d|30d`，并且运行时必须按该枚举严格校验

## 2. 为什么 `generatedAt` 要入主合同

判断：`Yes`

原因：

- 当前实现已经稳定返回 `generatedAt`
- BFF 其他核心接口也普遍保留 `generatedAt`
- 趋势页联调和排障场景需要知道这次聚合响应的生成时间
- 如果继续把它留在“运行时额外字段”，会形成长期 schema 漂移

因此最终口径应改为：

- `DashboardTrendsResponse.required` 增加 `generatedAt`
- `DashboardTrendsResponse.properties` 增加：
  - `generatedAt`
  - `type: string`
  - `format: date-time`
- `dashboard-trends.json` 同步补 `generatedAt`

结论：

- `generatedAt` 不应再被视为“可有可无的实现透出”
- 应正式进入主合同

## 3. 为什么 `range` 必须做运行时枚举校验

判断：`Yes`

原因：

- OpenAPI 已明确声明 `range` 只允许：
  - `24h`
  - `7d`
  - `30d`
- OpenAPI 也已为该接口定义 `400 BadRequestError`
- 当前 route/service 仍未执行这层校验
- 本地实际调用 `getDashboardTrends(..., "90d")`，当前仍会返回：
  - `range: "90d"`

这会导致两层问题：

1. 主合同和运行时行为不一致
2. 前端如果误发非法 range，当前不会被及时阻断，后续很难判断是参数问题还是上游问题

因此最终口径应改为：

- 运行时只接受 `24h|7d|30d`
- 非法 `range` 必须返回 `400`
- 不允许继续“原样透传未知 range”

## 4. 当前实现与最终 contract 是否一致

判断：`No`

原因只有两项：

### A. `generatedAt` 漂移

- 当前实现返回 `generatedAt`
- 当前主合同还未声明 `generatedAt`
- 当前 example 也未体现 `generatedAt`

### B. `range` 行为漂移

- 当前主合同要求枚举校验
- 当前运行时未执行枚举校验

除此之外，趋势页的主结构已经基本一致：

- path 已在主合同中
- `check-contract` 已覆盖该 path
- `series/stats/freshness/sourceStatus` 的主结构已稳定
- `sourceStatus` 至少包含 `energyCurve` 和 `runParams` 的门禁已存在

## 5. 是否需要新增 `check-contract` 专门断言

判断：`No`

原因：

- `dashboard/trends` 已在 `CONTRACT_PATHS`
- 当前 `check-contract` 已有趋势专项回归：
  - `range` example 枚举检查
  - `stats[*].metric` 与 `series[*].metric` 对齐检查
  - `sourceStatus.sources[*].key` 包含 `energyCurve/runParams`
  - `runParams=500` fallback 的非阻断探针

当前缺口不在“没有门禁”，而在：

- schema 尚未纳入 `generatedAt`
- 运行时尚未兑现 `range` 校验

因此这次不建议再新增单独的趋势专项断言文件，只需把合同和实现收齐。

## 6. 建议改代码的文件清单

建议改动如下：

- `apps/chiller-bff/openapi/bff-v1.yaml`
  - 给 `DashboardTrendsResponse` 增加 `generatedAt`
  - 将 `generatedAt` 加入 `required`
- `apps/chiller-bff/openapi/examples/dashboard-trends.json`
  - 增加 `generatedAt`
  - 建议顺手补齐 `coolingDeltaT`，让 example 更贴近运行时标准指标槽位
- `apps/chiller-bff/src/routes/v1.js`
  - 对 `range` 做运行时枚举校验
  - 非法值返回 `400`

本轮不建议改：

- `apps/chiller-bff/scripts/check-contract.js`
  - 当前无需新增趋势专项断言
  - 现有 schema/example 校验已足够承接 `generatedAt` 入合同后的变化

## 7. 预期影响

### 正向影响

- 消除 `dashboard/trends` 的主合同与运行时漂移
- 让 `generatedAt` 从“额外字段”升级为正式字段
- 让非法 `range` 在入口被快速阻断，符合 OpenAPI 语义
- 前端联调口径更清晰，不必猜测非法参数是否会被服务端接受

### 兼容性影响

- 对正常调用 `24h|7d|30d` 无破坏
- 对错误调用 `90d` 等非法值，会从“当前返回 200”改为“返回 400”
- 这属于合同收严，不属于破坏既有合法调用

## 8. 最终拍板

最终拍板如下：

- 当前实现与最终 contract 是否一致：`No`
- `generatedAt` 是否入主合同：`Yes`
- `range` 是否必须做运行时枚举校验：`Yes`

一句话收口：

- 趋势页 iteration1 已可联调，但若要把 `dashboard/trends` 作为长期稳定主合同，必须把 `generatedAt` 正式纳入 schema，并把 `range` 的枚举校验真正落到运行时。
