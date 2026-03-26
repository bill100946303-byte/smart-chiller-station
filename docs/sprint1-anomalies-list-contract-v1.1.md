# Sprint1 `anomalies/list` 合同 v1.1

## 1. 结论

本版以当前实现为准，对首版 contract 做一次收口。

结论：

- 当前实现与最终 contract 是否一致：`Yes`
- 是否建议把它正式纳入 OpenAPI 主合同：`Yes`

前提说明：

- 这里的“一致”指的是结构、query、`severity`、`freshness`、`sourceStatus` 的主合同口径已经可以稳定冻结
- 个别额外字段例如 `generatedAt` 不视为不一致，而是直接纳入最终 contract

## 2. `severity` 最终枚举

最终枚举建议：

- `high`
- `medium`
- `low`

理由：

- 当前实现里 `guessSeverity(...)` 最终只会归并成这 3 个值
- 现有 `anomalies/summary.latestEvents[].severity` 也是这个口径
- 前端列表页与摘要页可共用一套 severity 映射

结论：

- `severity` 最终枚举已经可以冻结为 `high|medium|low`

## 3. Query 参数最终集

最终集建议：

- `siteId`：path，必填
- `page`：query，可选，默认 `1`
- `pageSize`：query，可选，默认 `20`
- `severity`：query，可选，枚举 `high|medium|low`
- `state`：query，可选，`string`

为什么这样定：

- `page/pageSize` 当前已实现，且属于列表基础能力
- `severity` 当前已实现过滤，适合正式写进 contract
- `state` 当前也已实现过滤，但底层值域还未稳定，保留 `string` 更稳

结论：

- 这 5 个参数就是 `anomalies/list` 的最终 query 集

## 4. `items` 最小字段最终集

`items[]` 最小字段最终集建议：

- `id`
- `title`
- `severity`
- `state`
- `occurredAt`
- `source`
- `regId`
- `value`

字段口径说明：

- `id`：字符串
- `title`：字符串
- `severity`：`high|medium|low`
- `state`：`string|null`
- `occurredAt`：ISO datetime string 或 `null`
- `source`：字符串
- `regId`：`string|null`
- `value`：`string|null`

结论：

- 不再把 `regId` / `value` 视为“仅额外透出”
- 它们已经进入最终最小字段集

原因：

- 当前实现稳定返回这两个字段
- 告警页列表通常需要保留点位 / 值的最小可追踪信息
- 现在就纳入，比后面再升格更稳

## 5. 顶层字段最终集

顶层字段最终集建议：

- `site`
- `generatedAt`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

其中：

- `generatedAt` 从 “额外透出” 升格为正式字段

原因：

- 当前服务层稳定返回
- 对联调排障和页面数据时间说明都有价值
- 与现有 BFF 其他接口风格一致

## 6. `freshness` / `sourceStatus` 直透结论

结论：

- `freshness`：`Yes`
- `sourceStatus`：`Yes`

两者都应保留为最终 contract 正式字段。

### 6.1 `freshness`

最终保留原因：

- 告警数据天然存在“历史残留被误认成实时”的风险
- 页面必须知道当前列表是否陈旧

注意事项：

- 当前实现里，当 `items=[]` 时会回退到当前时间作为 `latestTimestamp`
- 这不影响 contract 冻结，但建议后续实现优化语义：
  - 更优先使用上游真实最新告警时间
  - 无数据且上游失败时，避免把 freshness 表达成“新鲜但空”

### 6.2 `sourceStatus`

最终保留原因：

- 告警列表上游失败不应直接导致整页失败
- 前端需要知道是“无数据”还是“来源失败”

当前最终口径：

- `sourceStatus` 至少包含 `latestAlarmLog` 这一条主来源
- 不强制要求 Sprint1 把 `subsystemSummary` 也挂进列表接口

## 7. Example 是否需要更新

结论：

- `Yes`

建议更新原因：

### 7.1 需要补上 `generatedAt`

当前实现已有：

- `generatedAt`

所以 example 若继续缺这个字段，会和最终 contract 不一致。

### 7.2 需要把 `regId` / `value` 视为正式字段

当前实现已稳定输出：

- `regId`
- `value`

example 应反映这一点。

### 7.3 需要体现 `state` 可空

当前实现中：

- `state` 可能为 `null`

example 最好覆盖两类情况：

- `state` 有值
- `state=null`

### 7.4 需要体现 `sourceStatus` 最小真实形态

当前列表接口的 `sourceStatus` 只有：

- `latestAlarmLog`

example 不应再暗示列表接口天然有更多来源。

## 8. 当前实现与最终 contract 的对齐判断

### 已对齐

- 路径：`/bff/v1/sites/{siteId}/anomalies/list`
- query：
  - `page`
  - `pageSize`
  - `severity`
  - `state`
- `severity` 三档枚举
- 分页结构：
  - `page`
  - `pageSize`
  - `total`
- `filters`
- `freshness`
- `sourceStatus`
- `items[]` 主要字段

### 不再视为差异

以下内容在 v1.1 中直接吸纳进最终 contract，因此不再算差异：

- `generatedAt`
- `regId`
- `value`

### 剩余说明项

以下属于实现语义优化项，不影响“当前实现与最终 contract 一致”的判断：

- `site.siteName` 当前仍可能 fallback 为 `siteId`
- `freshness.latestTimestamp` 在空列表失败态下仍可进一步优化
- `state` 仍是自由字符串/可空，未冻结枚举

## 9. 是否建议正式纳入 OpenAPI 主合同

结论：

- `Yes`

原因：

- 路由已稳定存在
- 服务层已稳定存在
- contract 主字段已经可冻结
- query 参数已经明确
- `freshness/sourceStatus` 口径已经明确

建议纳管方式：

1. 在 `bff-v1.yaml` 新增：
   - `GET /bff/v1/sites/{siteId}/anomalies/list`
2. 新增 schema：
   - `AnomaliesListResponse`
   - `AnomalyListItem`
   - 可复用现有 `Freshness` / `SourceStatus`
3. 补一个 example：
   - 覆盖至少一条 `state=null`
   - 覆盖 `sourceStatus.latestAlarmLog`
4. 之后再纳入 `check:contract`

## 10. 最终拍板

- 当前实现与最终 contract 是否一致：`Yes`
- 是否建议把它正式纳入 OpenAPI 主合同：`Yes`
