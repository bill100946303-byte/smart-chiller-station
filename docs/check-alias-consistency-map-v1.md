# Check 别名一致性表 v1

## 1. 目标与边界
- 目标：固化 check 主命令与 `latest-check` 别名的一致性，避免值班脚本误判命令语义。
- 覆盖范围：`release-ready` / `release-ready-sync` / `verify-gates` 三组。
- 边界：仅文档，不改字段语义，不改 `null_strategy`。

## 2. 映射表（主命令 -> latest 别名 -> 是否等价 -> 证据路径）

| 主命令 | latest 别名 | 是否等价 | 证据路径 | 说明 |
| --- | --- | --- | --- | --- |
| `release-ready-check` | `release-ready-latest-check` | yes | `scripts/chiller_ctl.sh:1923-1930`；`scripts/chiller_ctl.sh:1603-1617`；`apps/chiller-bff/package.json:16` | 两个入口都调用 `release_ready_check_cmd`，最终执行 `npm run check:release-ready` |
| `release-ready-sync-check` | `release-ready-sync-latest-check` | yes | `scripts/chiller_ctl.sh:1931-1937`；`scripts/chiller_ctl.sh:1619-1633`；`apps/chiller-bff/package.json:17` | 两个入口都调用 `release_ready_sync_check_cmd`，最终执行 `npm run check:release-ready-sync` |
| `verify-gates-check` | `verify-gates-latest-check` | yes | `scripts/chiller_ctl.sh:1974-1980`；`scripts/chiller_ctl.sh:434-448`；`apps/chiller-bff/package.json:19` | 两个入口都调用 `verify_gates_check_cmd`，最终执行 `npm run check:verify-gates` |

## 3. 等价判定规则
1. 分发函数相同（case 分支到同一 `*_check_cmd`）。
2. NPM 脚本名相同（`check:*` 一致）。
3. `--selftest` 语义一致（同一环境变量分支）。

## 4. 结论
- 三组 `latest-check` 都是主 check 命令别名，当前口径等价。
- 是否影响默认放行：`no`（本表仅做一致性固化，不改执行逻辑）。
