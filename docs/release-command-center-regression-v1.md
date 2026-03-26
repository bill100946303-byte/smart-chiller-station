# Release Command Center Regression v1

## 1. sync 命令结果

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run sync:release-command-center
```

结果：`PASS`

日志摘要：

- 触发 `node scripts/sync-release-command-center.js`
- 成功写入：`/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest.json`
- 日志：`Release-command-center synced: /Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest.json`

当前同步后的聚合结论摘要：

- `decision=GO`
- `summaryClass=review_required`
- `reasons=[]`
- `advisories=[example_not_ready, runtime_ready_unknown_optional]`

## 2. check 命令结果

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:release-command-center
```

结果：`PASS`

日志摘要：

- 触发 `node scripts/check-release-command-center.js`
- 成功校验：`/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest.json`
- 日志：`Release-command-center validation passed: /Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest.json`

## 3. selftest 结果

命令：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
RELEASE_COMMAND_CENTER_SELFTEST=1 npm run check:release-command-center
```

结果：`PASS`

3 条路径化错误：

- `/decision: must be string`
- `/summaryClass: must be one of "ready" | "blocked" | "review_required"`
- `/gates.releaseReadyLatestCheck.ok: must be boolean`

日志摘要：

- `Release-command-center self-check mode enabled`
- `Release-command-center self-check passed: 3/3`

## 4. 依赖关系说明

`release-command-center` 不是新的基础门禁，而是对现有 release ops 产物的再聚合。当前依赖链如下：

1. `sync:check-family`
2. `sync:release-ready-consistency`
3. `sync:release-ready-latest-check`
4. `check:release-ready-latest-check`
5. `check:release-ready-consistency`
6. 读取 latest 工件：
   - `release-ready-latest.json`
   - `release-ready-latest-check.json`
   - `release-ready-consistency-latest.json`
   - `check-family-latest.json`
   - `check-family-brief-latest.json`

定位原则：

- `release-ready` 异常，先看 `releaseReadyLatest` / `releaseReadyLatestCheck`
- family 异常，先看 `checkFamilyLatest` / `checkFamilyBriefLatest`
- 聚合冲突，先看 `releaseReadyConsistency`

## 5. 与主合同边界

- 与 `check:contract` 解耦：`Yes`
- 影响 OpenAPI 主 schema：`No`

说明：

- 该层只消费已有 latest 工件并输出运维总览，不放宽、不修改 BFF OpenAPI 主合同。
- 它也不替代 `release-ready` 主判定，只负责把 release-ready 与 check-family 的结果聚合给值班和 CI 读取。
