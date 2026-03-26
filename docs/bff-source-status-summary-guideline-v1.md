# BFF SourceStatus 摘要渲染指引 v1（合同侧）

## 1. 目标
- 前端在折叠摘要态只依赖稳定结构化字段：`key / ok / status / category`。
- 展开明细态再使用 `message / error`，避免英文自由文本污染主文案。

## 2. 摘要算法建议

### 2.1 abnormalCount 口径
- 输入：`sourceStatus.sources[]`
- 计算：
  - `abnormalCount = count(source.ok === false)`
  - `totalCount = sources.length`
- 展示建议：
  - `abnormalCount = 0` -> `全部数据源正常`
  - `abnormalCount > 0` -> `异常数据源 {abnormalCount}/{totalCount}`

### 2.2 warn 判定优先级（高到低）
1. 存在 `ok=false && status>=500`：判定 `warn=error`（上游服务失败）
2. 否则存在 `ok=false && status==null`：判定 `warn=warning`（上游不可达/无状态）
3. 否则 `warn=normal`

说明：
- recommendations 页可并入 `category` 判定：
  - `upstream_unreachable` 优先归入 `warning/error`（视业务偏好）
  - `field_missing_or_invalid` 建议至少 `warning`
  - `unknown` 建议 `warning`

### 2.3 key 缺省兜底
- 合同内 `key` 为必填；若收到非合同漂移数据（`key` 缺省），摘要标签兜底使用 `endpoint`。
- 同时建议上报一次“合同漂移”监控事件，便于后端修复。

## 3. message/error 展示边界
- 折叠摘要态：
  - 不直接展示 `message/error` 原文。
  - 只展示本地化结果（由 `key/ok/status/category` 映射）。
- 展开明细态：
  - 可展示 `message/error` 原文作为诊断附加信息。
  - 若原文过长，建议截断并支持复制完整文本。

## 4. 兼容性约束（门禁）
- 允许 `sources=[]`（无数据源参与场景）。
- `source item` 存在时必须满足：
  - `ok` 为 boolean
  - `status` 为 number 或 null
- 需保留“key 缺省 + endpoint 兜底”独立示例，防止摘要逻辑回退。
