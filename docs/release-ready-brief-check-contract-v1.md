# Release Ready Brief Check Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check --selftest
```

脚本入口：

- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready-brief.js`

## 1. 目标

`release-ready-brief-check` 用于校验 brief 视图契约稳定性。校验输入默认来源：

- `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`

该检查仅做结构与类型断言，不触发新的发布计算流程。

## 2. 正常模式语义

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check
```

行为：

- 从 `release-ready-sync-latest.json` 生成 brief 视图（decision/exitCode/step* 等）。
- 执行字段类型与枚举校验。

stdout（通过时）：

- `Release-ready-brief validation passed: <path>`

退出码：

- `0`：校验通过。
- `1`：校验失败（含文件缺失、JSON 无效、字段类型/枚举不合法）。
- `2`：参数非法（如未知参数）。

## 3. `--selftest` 语义

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check --selftest
```

行为：

- 使用当前 brief 基线数据，注入 3 组内置负例并验证报错路径格式。
- 负例全部命中时输出 `Release-ready-brief self-check passed: 3/3`。

stdout（样例）：

- `Release-ready-brief self-check mode enabled`
- `selfcheck.missing-decision: /decision: must be string`
- `selfcheck.invalid-step-mode: /stepReleaseReadyMode: must be one of "read_latest" | "recompute" | "unknown"`
- `selfcheck.reasons-not-array: /reasons: must be array`
- `Release-ready-brief self-check passed: 3/3`

退出码：

- `0`：3 条负例均命中期望路径与格式。
- `1`：任一负例未命中路径或格式不符合要求。
- `2`：参数非法。

## 4. 错误格式规范

所有错误需符合统一格式：

- `<json_path>: <error_message>`

示例：

- `/decision: must be string`
- `/stepReleaseReadyMode: must be one of "read_latest" | "recompute" | "unknown"`

## 5. 三条负例路径样例

负例 A：缺失 `decision`

- 路径样例：`/decision: must be string`

负例 B：`stepReleaseReadyMode` 枚举非法

- 路径样例：`/stepReleaseReadyMode: must be one of "read_latest" | "recompute" | "unknown"`

负例 C：`reasons` 类型错误（非数组）

- 路径样例：`/reasons: must be array`

## 6. 与 `check:contract` / OpenAPI 的关系

- `release-ready-brief-check` 为独立校验入口，不属于 `check:contract` 主门禁链路。
- 不修改、不依赖 OpenAPI 主 schema。
- 对主合同门禁无副作用，仅补充运维摘要层的契约稳定性检查。
