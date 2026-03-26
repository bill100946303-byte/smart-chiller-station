# Verify Gates Latest Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest --json
```

## 1. 目标

`verify-gates-latest` 是只读查看入口，读取：

- `/Users/billchow/Documents/智慧冷冻站/docs/verify-gates-latest.json`

不触发 gate 重算，不触发新探针，不改写业务结果。

## 2. 文本模式与 `--json` 契约差异

文本模式（默认）：

- 输出 `key=value` 摘要行，最小字段：
- `verifyGatesLatestJson`
- `overall`
- `passed`（`passedCount/totalCount`）
- `generatedAt`
- `failedGates`（逗号拼接，空时 `none`）

`--json` 模式：

- 直接输出 latest 原始 JSON（`cat` 文件），不做结构投影。
- 最小可消费字段参考 `verify-gates --json` 契约：`version/generatedAt/overall/passedCount/totalCount/gates[]`。

## 3. 退出码与失败语义

- `0`：读取成功（文本或 JSON）。
- `1`：latest 文件缺失（提示先执行 `verify-gates --json`）。
- `2`：参数非法（未知参数）。

## 4. 错误格式与路径化样例

路径化报错统一格式：

- `<json_path>: <error_message>`

示例（来自 `check:verify-gates`/相关校验链路）：

- `/verifyGates: file missing: /Users/billchow/Documents/智慧冷冻站/docs/verify-gates-latest.json`
- `/overall: must be one of "PASS" | "FAIL"`
- `/gates[0].exitCode: must be integer`

## 5. 与 `check:contract` / OpenAPI 的关系

- 与 `check:contract` 主门禁解耦。
- 不改 OpenAPI 主 schema。
- 本文档仅定义 verify-gates latest 只读消费契约。
