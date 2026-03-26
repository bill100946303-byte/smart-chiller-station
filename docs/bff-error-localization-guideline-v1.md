# BFF 错误文案国际化指引 v1

## 1. 适用范围
- 接口：
  - `GET /bff/v1/sites/{siteId}/dashboard/overview`
  - `GET /bff/v1/sites/{siteId}/dashboard/trends`
  - `GET /bff/v1/sites/{siteId}/anomalies/summary`
  - `GET /bff/v1/sites/{siteId}/recommendations`
- 关注字段：
  - `sourceStatus.overall`
  - `sourceStatus.sources[*].key / ok / status / error / message`
  - `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].category / metric / message`

## 2. 前端文案处理优先级
1. 首选 `category`（recommendations 场景）做中文映射。
2. 其次用 `sourceStatus.sources[*].key` 做中文映射（overview/trends/anomalies/recommendations 通用）。
3. `message` 仅作附加明细，不作为主文案来源。

## 3. 映射建议

### 3.1 recommendations.ruleEvaluation.skippedRuleDetails[*].missingMetrics[*]
- `category=upstream_unreachable` -> `上游接口不可达`
- `category=field_missing_or_invalid` -> `关键字段缺失或无效`
- `category=unknown` -> `数据异常（待确认）`

说明：
- `category` 是主渲染依据，合同中为必填且白名单枚举。
- `message` 是可选字段，可能为空或缺省。

### 3.2 sourceStatus.sources[*]
- 优先按 `key` 映射中文来源名（如 `energy`, `runParams`, `latestAlarmLog`, `metric.station_cop`）。
- 状态建议：
  - `ok=true` -> `数据正常`
  - `ok=false && status>=500` -> `上游服务异常`
  - `ok=false && status==null` -> `上游不可用或解析失败`

## 4. 前端渲染规则（建议）
- 主提示文案：`category` 或 `key` 映射结果。
- 次级明细：仅在调试面板/展开态显示 `message` 或 `error`。
- 严禁默认直出英文 `message` 作为主提示。

## 5. 联调验收点
- 前端在 `message` 为空或缺省时仍可完整渲染中文提示。
- 前端仅依赖 `category` 即可渲染 recommendations 缺失指标提示。
- 前端仅依赖 `sourceStatus.sources[*].key + ok + status` 即可渲染 overview/trends/anomalies 数据源状态提示。
