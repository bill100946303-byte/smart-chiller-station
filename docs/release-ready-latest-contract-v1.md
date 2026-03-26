# Release-Ready Latest Contract v1

## 1. 目标与边界
- 目标：定义 `release-ready-latest` 场景的最小机读字段契约。
- 边界：
  - 不改 `check:contract`。
  - 不改 OpenAPI 主 schema。
  - 仅补文档说明。

## 2. 最小字段（latest 模式）
`latest` 输出最小字段集：
- `/decision`（string，`GO | NO-GO`）
- `/exitCode`（integer，`0 | 1`）
- `/reasons`（array of string）
- `/advisories`（array of string）
- `/generatedAt`（non-empty string，建议 ISO-8601）

## 3. 路径化报错规范
错误格式统一：
```text
<json_path>: <error_message>
```

示例：
```text
/exitCode: must be integer
```

## 4. 负例样例（2 条）

### 负例 A：字段缺失（missing）
输入（示意）：
```json
{
  "exitCode": 0,
  "reasons": [],
  "advisories": [],
  "generatedAt": "2026-03-12T08:52:47.644Z"
}
```
期望报错：
```text
/decision: must be string
```

### 负例 B：字段类型错误（type mismatch）
输入（示意）：
```json
{
  "decision": "GO",
  "exitCode": "0",
  "reasons": [],
  "advisories": [],
  "generatedAt": "2026-03-12T08:52:47.644Z"
}
```
期望报错：
```text
/exitCode: must be integer
```

## 5. 与 `check:release-ready` 的关系
- `latest` 是只读快照语义：读取既有 latest 结果用于展示/消费。
- `check:release-ready` 是结构校验门禁：校验 release-ready 输出字段与类型。
- 关系约束：`latest` 不触发新计算，不替代 `check:release-ready`；两者职责分离。
