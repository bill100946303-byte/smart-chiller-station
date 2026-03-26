# Verify Gates JSON Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
```

## 1. 目标

为 `verify-gates --json` 提供机读契约，保证发布门禁聚合结果可被脚本稳定消费。

- JSON 落盘路径：`/Users/billchow/Documents/智慧冷冻站/docs/verify-gates-latest.json`
- 独立校验入口：`npm run check:verify-gates`

## 2. stdout JSON 最小字段

`--json` 模式最小字段如下：

- `version`: string（当前 `v1.0`）
- `generatedAt`: string（ISO 时间）
- `overall`: `"PASS" | "FAIL"`
- `passedCount`: integer
- `totalCount`: integer（当前固定 `7`）
- `gates`: array（长度应为 `7`）
- `gates[*].name`: string（固定门禁名集合）
- `gates[*].ok`: boolean
- `gates[*].exitCode`: integer

固定门禁名集合：

- `acceptance-report`
- `status-json`
- `release-snapshot`
- `release-snapshot-index`
- `release-snapshot-diff`
- `release-snapshot-consistency`
- `release-ready-brief`

## 3. stdout 与 latest 文件一致性约束

实现约束（`scripts/chiller_ctl.sh` 中 `verify_gates_cmd --json`）：

1. 先把完整 JSON 写入临时文件。
2. 再 `cat` 临时文件输出到 stdout。
3. 最后 `mv` 同一临时文件到 `docs/verify-gates-latest.json`。

因此：

- 在单次命令成功执行到落盘阶段时，stdout JSON 与 `docs/verify-gates-latest.json` 内容应一致（同一 payload）。
- 即使 `overall=FAIL`（命令退出码为 `1`），也会输出并写入该 FAIL payload，供后续排障使用。
- 若参数非法（如未知参数），返回 `2`，不产生该 JSON payload。

## 4. 错误格式规范

校验错误统一格式：

- `<json_path>: <error_message>`

示例：

- `/overall: must be one of "PASS" | "FAIL"`
- `/gates[0].exitCode: must be integer`

## 5. 三条负例路径样例

负例 A：缺失 `overall`

- 路径样例：`/overall: must be string`

负例 B：`gates[0].exitCode` 类型错误（字符串）

- 路径样例：`/gates[0].exitCode: must be integer`

负例 C：缺少 `release-ready-brief` gate

- 路径样例：`/gates: missing gate "release-ready-brief"`

## 6. 兼容边界

- 不改 OpenAPI 主 schema。
- 不改 `check:contract` 主断言。
- 本契约仅覆盖 `verify-gates --json` 机读输出与独立校验。
