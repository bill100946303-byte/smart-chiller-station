# BFF SourceStatus 合同消费指引 v1

## 1. 目标
- 前端主文案只依赖稳定字段：`key / ok / status / category`。
- 降低 `message / error` 自由文本对 UI 文案和国际化的一致性影响。

## 2. 适用接口
- `GET /bff/v1/sites/{siteId}/dashboard/overview`
- `GET /bff/v1/sites/{siteId}/dashboard/trends`
- `GET /bff/v1/sites/{siteId}/anomalies/summary`
- `GET /bff/v1/sites/{siteId}/recommendations`

## 3. 字段语义（前端必须遵循）
- `sourceStatus.sources[*].key`
  - 稳定来源键，作为来源名称的本地化映射主键。
  - `metric.*` 键遵循 `metric.<snake_case>`。
- `sourceStatus.sources[*].ok`
  - 数据源调用是否成功，主状态判断优先字段。
- `sourceStatus.sources[*].status`
  - `>=500`：上游服务失败（有 HTTP 状态码）。
  - `null`：上游不可达或无 HTTP 状态（超时、网络中断、解析失败等）。
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category`
  - 缺失指标的稳定分类键，作为 recommendations 中文主文案依据。

## 4. 前端渲染优先级
1. 主提示优先使用 `category`（recommendations）或 `key+ok+status`（sourceStatus）。
2. `message` 和 `error` 仅用于展开态/调试态明细，不作为主文案。
3. 默认视图禁止直接展示英文 `message`。

## 5. 推荐映射规则（示例）
- recommendations:
  - `upstream_unreachable` -> `上游不可达`
  - `field_missing_or_invalid` -> `字段缺失或无效`
  - `unknown` -> `数据异常（待确认）`
- sourceStatus:
  - `ok=true` -> `数据正常`
  - `ok=false && status>=500` -> `上游服务异常`
  - `ok=false && status==null` -> `上游不可达/无响应`
