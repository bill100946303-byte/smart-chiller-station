# Source Key 漂移与字典一致性门禁 v1

## 1. 目标
- 在不放宽现有 schema 的前提下，定义可执行的 source key 一致性门禁。
- 确保前端本地化映射对 `sourceStatus.sources[*].key` 的依赖可持续、可追踪、可回归。

## 2. 校验对象（必须同时参与）
- 合同：`apps/chiller-bff/openapi/bff-v1.yaml`
- 示例：`apps/chiller-bff/openapi/examples/*.json`（含 recommendations 及漂移场景示例）
- 字典：`docs/source-status-key-dictionary-v1.2.json`

## 3. 校验规则

### 3.1 结构与模式（schema 对齐）
- 从 `bff-v1.yaml` 读取 `components.schemas.SourceEndpointStatus.properties.key.pattern`。
- 示例中的每个 `sourceStatus.sources[*].key` 必须匹配 pattern，否则 `fail`。

### 3.2 静态 key 字典一致性
- 识别规则：不以 `metric.` 开头的 key 视为静态 key。
- 每个静态 key 必须能在 `source-status-key-dictionary-v1.2.json` 的映射区命中（建议以 `labels` 为准，必要时结合 canonical/alias 归并）。
- 未命中字典映射：`fail`（会导致前端中文映射缺失）。

### 3.3 metric key 漂移
- 识别规则：匹配 `^metric\.[a-z0-9_]+$`。
- 新增 `metric.*`（不在基线集合）仅记 `warning`，不直接 `fail`。
- 同时输出“前端映射待补”提示，并进入发布排期。

### 3.4 recommendations 联动
- recommendations 示例中的 `sourceStatus.sources[*].key` 同样参与上述规则。
- recommendations 若出现新 `metric.*`，按 `warning` 处理；静态 key 缺映射仍为 `fail`。

## 4. 结果输出格式（统一）
- 所有校验输出使用：
- `<json_path>: <error_message>`

示例：
- `/bff/v1/sites/{siteId}/dashboard/overview.sourceStatus.sources[2].key: value "energy-curve" does not match pattern ^(metric\\.[a-z0-9_]+|[A-Za-z][A-Za-z0-9._-]*)$`
- `/bff/v1/sites/{siteId}/anomalies/summary.sourceStatus.sources[1].key: static key "latestAlarmLogV2" missing mapping in docs/source-status-key-dictionary-v1.2.json`
- `/bff/v1/sites/{siteId}/recommendations.sourceStatus.sources[6].key: [warning] new metric key "metric.station_flow_ratio" requires i18n mapping update`

## 5. Warning / Fail 边界（收口定义）
- `warning`
- 新增 `metric.*` key（pattern 合法，但不在基线）。
- `fail`
- 静态 key 缺失字典映射。
- key 不匹配 schema pattern。
- 字典文件不可解析或关键映射区缺失。

## 6. 版本治理要求
- key 重命名/删除：必须在版本说明中显式标注，并给出兼容窗口。
- 新增 key：必须同步更新字典、示例、门禁基线与前端映射任务。
- 调整 key pattern：必须同步更新门禁规则与回归样例。
