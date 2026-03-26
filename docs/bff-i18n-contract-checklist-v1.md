# BFF i18n 合同检查清单 v1

## 1. 适用范围
- `sourceStatus.sources[*]` 的 `key/ok/status/message/error`
- `recommendations.ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
- `SourceEndpointStatus.key.pattern`

## 2. 新增 key 时必须同步
1. 更新 `check-contract.js`：
- 静态 key：加入 `ALLOWED_STATIC_SOURCE_KEYS`
- 新增受控指标 key：加入 `REQUIRED_METRIC_SOURCE_KEYS`（如适用）
2. 运行 `npm run check:contract` 并确认：
- `Source key drift warnings` 无意外新增
- `openapi/examples/source-key-scan-report.json` 已更新
3. 更新前端本地化映射：
- `key -> 中文来源名`
- 摘要状态文案继续仅依赖 `ok/status`
4. 在版本说明中记录新增 key 与兼容窗口计划。

## 3. 新增 category 时必须同步
1. 更新 OpenAPI 枚举：
- `SkippedRuleMissingMetric.category.enum`
2. 更新 `check-contract.js`：
- `ALLOWED_MISSING_METRIC_CATEGORIES`
3. 更新 recommendations 示例：
- 至少一条 `missingMetrics[*].category` 使用新值
4. 前端补齐 `category -> 中文提示` 映射。

## 4. 调整 key pattern 时必须同步
1. 更新 OpenAPI：
- `components.schemas.SourceEndpointStatus.properties.key.pattern`
2. 更新 `check-contract.js` 回归逻辑：
- `checkMetricPatternRegression`（若 `metric.*` 规则变化）
3. 检查扫描报告：
- `unknownStaticKeys/newMetricKeys` 是否出现异常突增。

## 5. 发布前门禁必查
- `npm run check:contract` 通过
- `I18N safety notices` 存在且无 i18n 结构化断言失败
- `Source key drift warnings` 明细已审阅并排期处理（若非空）

## 6. Real-Link-Ready 条件（非降级态）
- 基线示例：`apps/chiller-bff/openapi/examples/real-link-ready-sample.json`
- 判定条件：
  - `dashboardOverview/dashboardTrends/anomaliesSummary/recommendations` 四个模块 `sourceStatus.overall` 均为 `ok`
  - 四个模块 `sourceStatus.sources[*].ok` 均为 `true`（无失败来源）
  - `dashboardTrends.freshness.stale=false`
  - `dashboardTrends.series[*].points[*].v` 至少存在一个有效数值
  - `recommendations.ruleEvaluation.skippedRuleDetails` 不包含缺指标降级项（空数组为推荐状态）
- `check-contract` 输出 `Real-link-ready probe (non-blocking)`：
  - `READY`：当前示例达到非降级态
  - `NOT_READY`：仅提示原因，不阻断合同通过
