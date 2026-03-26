# Release Ready Latest Check Contract v1.1

命令入口（已分流）：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
```

两者调用不同脚本：

- `release-ready-check` -> `npm run check:release-ready`  
  脚本：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready.js`
- `release-ready-latest-check` -> `npm run check:release-ready-latest-check`  
  脚本：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready-latest-check.js`

## 1. 校验目标

- 优先读取：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.json`
- latest 缺失时回退读取：
  - `docs/release-snapshot-latest.json`
  - `docs/release-snapshot-diff-latest.json`
  - `docs/release-snapshot-consistency-latest.json`
- v1.1 增加强校验字段：
  - `generatedAt`（string）
  - `source`（`latest_file | fallback_from_latest_artifacts`）

## 2. 正常模式语义

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
```

stdout（通过）：

- `Release-ready-latest-check validation passed (source=latest_file|fallback)`

stdout/stderr（失败）：

- 头行：`Release-ready-latest-check validation failed:`
- 后续逐行错误（`- <json_path>: <error_message>`）

退出码：

- `0`：校验通过
- `1`：校验失败（结构/类型/枚举不合法或回退源不可用）
- `2`：CLI 参数非法（例如未知参数）

## 3. `--selftest` 语义

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check --selftest
```

行为：

- 通过 `RELEASE_READY_LATEST_CHECK_SELFTEST=1` 触发内置负例自检
- 逐条打印命中的路径化错误，再输出通过汇总

stdout（通过）：

- `Release-ready-latest-check self-check mode enabled`
- `selfcheck.<case>: <json_path>: <error_message>`
- `Release-ready-latest-check self-check passed: 3/3`

退出码：

- `0`：3 条自检负例全部命中预期路径
- `1`：任一负例未命中或格式不符合
- `2`：CLI 参数非法

## 4. 路径化错误样例

统一格式：

- `<json_path>: <error_message>`

样例：

- `/decision: must be string`
- `/generatedAt: must be string`
- `/source: must be "latest_file" | "fallback_from_latest_artifacts"`
- `/diffClass: must be one of "stable" | "changed" | "risk_up" | "recovery" | "insufficient_history" | "error"`
- `/exitCode: must be integer`

## 5. 与 `check:contract` / OpenAPI 的关系

- 与 `check:contract` 主门禁解耦（独立脚本、独立入口）。
- 不改 OpenAPI 主 schema。
- 本文档仅约束 release-ready latest 校验行为与输出语义。
