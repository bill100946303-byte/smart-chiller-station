# Release Command Center Sync Regression v1

## 1. sync 命令结果

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run sync:release-command-center-sync
```

结果：`PASS`

日志摘要：

- 触发 `node scripts/sync-release-command-center-sync.js`
- 成功写入：`/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json`
- 日志：`Release-command-center-sync synced: /Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json`

当前同步后的链路摘要：

- `decision=GO`
- `summaryClass=review_required`
- `steps.releaseCommandCenterSync.ok=true`
- `steps.releaseCommandCenterCheck.ok=true`
- `steps.releaseCommandCenterLatestCheckSync.ok=true`
- `steps.releaseCommandCenterLatestCheck.ok=true`
- `firstAction=可以从 release-command-center-latest-check 开始做值班判定。`

## 2. latest-check 命令结果

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-command-center-latest-check
```

结果：`PASS`

日志摘要：

- 触发 `node scripts/check-release-command-center-latest-check.js`
- 成功校验：`/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest-check.json`
- 日志：`Release-command-center-latest-check validation passed: /Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest-check.json`

补充：

- `release-command-center-sync` 不直接替代 `latest-check`
- 它先保证 `release-command-center` 已同步，再驱动 `sync:release-command-center-latest-check` 与 `check:release-command-center-latest-check`
- 值班判定仍优先看 `release-command-center-latest-check.json`
- 补充自检：`RELEASE_COMMAND_CENTER_LATEST_CHECK_SELFTEST=1 npm run check:release-command-center-latest-check` 已通过，3/3 路径化错误命中

## 3. sync-check 与 selftest 结果

正常校验命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-command-center-sync
```

结果：`PASS`

日志摘要：

- 触发 `node scripts/check-release-command-center-sync.js`
- 成功校验：`/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json`
- 日志：`Release-command-center-sync validation passed: /Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json`

selftest 命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
RELEASE_COMMAND_CENTER_SYNC_SELFTEST=1 npm run check:release-command-center-sync
```

结果：`PASS`

3 条路径化错误：

- `/decision: must be string`
- `/summaryClass: must be one of "ready" | "blocked" | "review_required"`
- `/steps.releaseCommandCenterSync.ok: must be boolean`

日志摘要：

- `Release-command-center-sync self-check mode enabled`
- `Release-command-center-sync self-check passed: 3/3`

## 4. 串联关系说明

`release-command-center-sync` 是运维编排层，不是新的基础合同。它负责把 sync / latest / latest-check 串成一条可回归链：

1. 运行 `sync:release-command-center`
2. 运行 `check:release-command-center`
3. 运行 `sync:release-command-center-latest-check`
4. 运行 `check:release-command-center-latest-check`
5. 汇总上述步骤状态，输出 `release-command-center-sync-latest.json`

它与现有 release ops 家族的依赖边界如下：

- 依赖 `release-ready`
  - 通过 `release-command-center` 间接消费 `release-ready-latest`、`release-ready-latest-check`、`release-ready-consistency`
- 依赖 `check-family`
  - 通过 `release-command-center` 间接消费 `check-family-latest`、`check-family-brief-latest`
- 依赖 `latest-check`
  - `release-command-center-sync` 会强制跑一遍 `sync:release-command-center-latest-check` 和 `check:release-command-center-latest-check`

定位建议：

- `latest-check` 失败，优先看 `release-command-center-latest-check.json`
- `sync` 失败但 `latest-check` 通过，优先看 `release-command-center-sync-latest.json.steps`
- 上游 release-ready 或 family 异常，回到 `release-command-center-latest.json` 继续拆解原因

## 5. 与主合同边界

- 与 `check:contract` 解耦：`Yes`
- 影响 OpenAPI 主 schema：`No`

说明：

- 该链路只消费并重组 release ops latest 工件，不改 BFF 业务合同。
- 它属于运维/值班门禁补充，不替代 OpenAPI 主 schema，也不改变 `check:contract` 的通过条件。
