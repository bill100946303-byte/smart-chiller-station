# Release Ready Latest Check Contract v1.1

命令入口：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-ready-latest-check
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check-sync
```

脚本文件：

- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-ready-latest-check.js`

## 1. 校验目标与 source 语义

加载顺序：

1. `docs/release-ready-latest-check.json`（可由 `RELEASE_READY_LATEST_CHECK_PATH` 覆盖）
2. `docs/release-ready-latest.json`（可由 `RELEASE_READY_PATH` 覆盖）
3. fallback：`docs/release-snapshot-latest.json` + `docs/release-snapshot-diff-latest.json` + `docs/release-snapshot-consistency-latest.json`

通过时输出：

- `Release-ready-latest-check validation passed (source=latest_check_file|latest_file|fallback)`

说明：

- 仅当 `release-ready-latest-check.json` 文件不存在时才进入第 2/3 级。
- 若 `release-ready-latest-check.json` 存在但格式非法，直接失败（fail-closed）。
- 推荐先执行 `release-ready-latest-check-sync` 再执行 `release-ready-latest-check`，确保值班读取同一口径产物。

## 2. 最小字段与类型

最小字段集：

- `/decision`: string，枚举 `GO | NO-GO`
- `/diffClass`: string，枚举 `stable | changed | risk_up | recovery | insufficient_history | error`
- `/exitCode`: integer，枚举 `0 | 1`
- `/reasons`: string[]
- `/advisories`: string[]
- `/verifyGatesOk`: boolean | null（必须存在）
- `/consistencyOk`: boolean | null（必须存在）

可选字段（存在时需合法）：

- `/hasPrevious`: boolean | null
- `/decisionChanged`: boolean | null

## 3. 错误格式

统一格式：

- `<json_path>: <error_message>`

示例：

- `/decision: must be string`
- `/diffClass: must be one of "stable" | "changed" | "risk_up" | "recovery" | "insufficient_history" | "error"`
- `/verifyGatesOk: must exist`

## 4. SELFTEST 语义（3 条负例）

触发方式：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
RELEASE_READY_LATEST_CHECK_SELFTEST=1 npm run check:release-ready-latest-check
```

内置负例：

1. 缺失 `decision`
2. `diffClass` 枚举非法
3. 缺失 `verifyGatesOk`

通过标准：

- 输出 `Release-ready-latest-check self-check passed: 3/3`
- 每条负例都命中路径化错误格式

## 5. 退出码

- `0`：校验通过 / 自检 3/3 通过
- `1`：校验失败 / 自检失败

## 6. 边界声明

- 不改 `check:contract` 主断言
- 不改 OpenAPI 主 schema
- 本脚本为独立门禁，不影响主合同判定链路
