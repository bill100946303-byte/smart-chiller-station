# Verify Gates JSON Contract v1.1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
```

## 1. 目标

为 `verify-gates --json` 提供 v1.1 机读契约说明，在不破坏 v1 消费方的前提下支持字段演进。

- JSON 落盘路径：`/Users/billchow/Documents/智慧冷冻站/docs/verify-gates-latest.json`
- 独立校验入口：`npm run check:verify-gates`

## 2. 最小字段（v1 兼容基线）

v1 客户端至少依赖以下字段：

- `version`: string
- `generatedAt`: string
- `overall`: `"PASS" | "FAIL"`
- `passedCount`: integer
- `totalCount`: integer（当前 `7`）
- `gates`: array
- `gates[*].name`: string
- `gates[*].ok`: boolean
- `gates[*].exitCode`: integer

固定 gate 名称集合：

- `acceptance-report`
- `status-json`
- `release-snapshot`
- `release-snapshot-index`
- `release-snapshot-diff`
- `release-snapshot-consistency`
- `release-ready-brief`

## 3. stdout 与 latest 文件一致性约束

实现顺序保持不变：

1. 生成临时 JSON payload。
2. stdout 输出该 payload。
3. 同一 payload 落盘为 `verify-gates-latest.json`。

因此，命令执行到落盘阶段后，stdout 与 latest 文件应为同一份内容。

## 4. v1.1 新增字段兼容策略（只增不减）

- 规则：字段只新增，不删除、不改名、不改既有类型。
- v1 客户端：可忽略 v1.1 新增字段，只消费 v1 最小字段即可。
- v1.1 客户端：可消费新增字段，但不得要求 v1 不存在的字段作为硬依赖。
- 兼容边界：若未来确需破坏性调整，应升级主版本并提供迁移说明；v1.1 内不允许破坏性变更。

## 5. 错误格式规范

统一格式：

- `<json_path>: <error_message>`

## 6. 三条路径化错误样例

- `/overall: must be one of "PASS" | "FAIL"`
- `/gates[0].exitCode: must be integer`
- `/gates: missing gate "release-ready-brief"`

## 7. 边界声明

- 不改 OpenAPI 主 schema。
- 不改 `check:contract` 主断言。
- 本文档仅补充 verify-gates JSON 契约与兼容策略说明。
