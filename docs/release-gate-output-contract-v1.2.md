# Release-Gate Output Contract v1.2

## 1. 目标与边界
- 目标：在 `release-gate` 既有契约基础上补充 `reasons` 的机读定义。
- 边界：
  - 仅文档补充，不修改主 OpenAPI。
  - 不影响 `npm run check:contract` 现有门禁。

## 2. 适用命令
- `scripts/chiller_ctl.sh release-gate`
- `scripts/chiller_ctl.sh release-gate --json`
- `scripts/chiller_ctl.sh release-gate --strict-freshness`

## 3. 机读字段（v1.2）
最小字段集合（JSON 语义）：
- `contractOk` (boolean)
- `canonicalExists` (boolean)
- `canonicalOverallPass` (boolean)
- `reasons` (array)
- `decision` (`"GO"` | `"NO-GO"`)
- `exitCode` (number, `0` | `1`)

## 4. reasons 契约（新增）
- 类型：`array`
- item 类型：`snake_case` 字符串（正则建议：`^[a-z0-9]+(?:_[a-z0-9]+)*$`）
- 未命中原因时：必须返回空数组 `[]`

示例：
```json
{
  "contractOk": true,
  "canonicalExists": true,
  "canonicalOverallPass": false,
  "reasons": ["canonical_not_pass"],
  "decision": "NO-GO",
  "exitCode": 1
}
```

无原因示例：
```json
{
  "contractOk": true,
  "canonicalExists": true,
  "canonicalOverallPass": true,
  "reasons": [],
  "decision": "GO",
  "exitCode": 0
}
```

## 5. stdout 与 JSON 对齐规则
- `--json` 模式：`reasons` 使用数组（本契约主来源）。
- 文本模式：`reasons=<comma_separated_keys|none>`，仅用于人读；机读应优先 `--json`。

## 6. 兼容规则（必须）
- 新增 reason key 采用“只增不改”：
  - 允许新增新 key。
  - 既有 key 不重命名、不改语义。
  - 不删除历史 key。
- 消费端应按“未知 key 可显示、但不报错”处理，保证前后兼容。
