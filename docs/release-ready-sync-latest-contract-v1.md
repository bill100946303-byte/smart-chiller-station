# Release Ready Sync Latest Contract v1

命令入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest --json
```

## 1. 目标

`release-ready-sync-latest` 是只读查看入口，用于读取：

- `/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`

它不触发重算、不触发新探针、不改写业务状态。

## 2. 文本模式字段契约

默认（无 `--json`）输出为 `key=value` 文本，最小字段：

- `releaseReadySyncLatestJson`
- `decision`
- `exitCode`
- `generatedAt`
- `step.releaseReady.ok`
- `step.releaseReady.mode`
- `step.releaseReadyCheck.ok`
- `step.releaseReadyLatest.ok`
- `latest.decision`
- `latest.generatedAt`

缺字段时使用兜底值（`NO-GO` / `1` / `unknown` / `false`），保证值班可读性。

## 3. `--json` 字段契约

`--json` 模式直接输出原始 latest 文件内容（`cat`），最小可消费字段：

- `version`: string
- `generatedAt`: string
- `decision`: `"GO" | "NO-GO"`
- `exitCode`: `0 | 1`
- `inputs.strictFreshness`: boolean
- `inputs.runtimeRequired`: boolean
- `inputs.recompute`: boolean
- `steps.releaseReady.ok`: boolean
- `steps.releaseReady.mode`: `"read_latest" | "recompute"`
- `steps.releaseReadyCheck.ok`: boolean
- `steps.releaseReadyLatest.ok`: boolean
- `releaseReady`: object | null
- `releaseReadyLatest`: object | null

## 4. 失败与退出码语义

- 文件缺失：返回 `1`，并提示先执行 `release-ready-sync --runtime-required=0 --json`。
- 参数非法（未知参数）：返回 `2`。
- 正常读取成功：返回 `0`。

## 5. 路径化错误格式与样例

统一格式：

- `<json_path>: <error_message>`

样例（供 `check:release-ready-sync` / 诊断脚本使用）：

- `/releaseReadySync: file missing: /Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`
- `/steps.releaseReady.ok: must be boolean`
- `/releaseReadyLatest.decision: must be one of "GO" | "NO-GO"`

## 6. 与 `check:contract` / OpenAPI 的关系

- 与 `check:contract` 主门禁解耦。
- 不修改、不依赖 OpenAPI 主 schema。
- 该文档仅约束 release-ready 运维产物读取契约，不改变 BFF 主合同断言。
