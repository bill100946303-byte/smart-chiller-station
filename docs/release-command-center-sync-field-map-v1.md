# Release-Command-Center-Sync 字段映射 v1

## 1. 目标与边界
- 目标：把 `release-command-center-sync` 输出字段与 `release-command-center-latest`、`release-command-center-latest-check` 的血缘关系收成统一表，供自动巡检和运营文档复用。
- 输入依据：
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest-field-map-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-ops-unified-field-map-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest-check-contract-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-contract-v1.md`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/sync-release-command-center-sync.js`
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-release-command-center-sync.js`
- 边界：
  - 仅固化字段血缘、缺失默认行为、fail-open/fail-closed 口径。
  - `release-command-center-sync` 顶层字段不是 `latest` / `latest-check` 的简单镜像，其中 `decision/reasons/advisories/summaryClass/firstAction` 都会叠加 sync/check 运行时结果。
  - 本表只收“可追溯到 latest / latest-check 的字段”；`steps.*` 和 `artifacts.*` 属于运行态链路字段，不纳入本次统一表。

## 2. 统一口径
1. 顶层 `$.decision / $.summaryClass / $.exitCode / $.reasons[] / $.advisories[] / $.firstAction` 属于 sync 聚合派生层。
2. `$.releaseCommandCenter.*` 是 `release-command-center-latest.json` 的 direct mirror。
3. `$.releaseCommandCenterLatestCheck.*` 是 `release-command-center-latest-check.json` 的 direct mirror。
4. 若某字段不来自 latest / latest-check，而是 sync 脚本常量或运行时写入，则 upstream path 记为 `N/A`，并在说明里明确其来源。

## 3. 字段总表

| sync 字段 | latest 路径 | latest-check 路径 | 含义 | 放行影响 | 缺失默认行为 | fail-open/closed | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `$.decision` | `semantic_base: $.reasons[]` | `N/A` | Sync 链总决策位；由 top-level `reasons` 是否为空决定，而 `reasons` 以 command-center latest 为基底再并入 sync/check 失败原因。 | blocking | 缺失或非法按 `NO-GO` + `exitCode=1` | fail-closed | 还依赖 sync/check 命令执行状态 |
| `$.summaryClass` | `semantic_base: $.decision + $.advisories[]` | `N/A` | Sync 链摘要态；由 top-level `decision` 和 `advisories` 派生为 `ready/blocked/review_required`。 | advisory | 缺失按 `review_required` + 人工复核 | fail-open | `sync_chain_review_required` 会把结果抬到 review_required |
| `$.exitCode` | `semantic_base: $.decision` | `N/A` | Sync 链退出码；由 top-level `decision` 派生，`GO=0`、`NO-GO=1`。 | blocking | 缺失或非法按 `1` | fail-closed | 非 upstream 直传字段 |
| `$.reasons[]` | `$.reasons[]` | `N/A` | Sync 链阻断原因集合；以 command-center latest `reasons` 为基底，再并入 sync/check 失败原因。 | blocking | 缺失按阻断原因不可追溯处理，并回落到 `decision=NO-GO` | fail-closed | enriched union |
| `$.advisories[]` | `$.advisories[]` | `N/A` | Sync 链提示项集合；以 command-center latest `advisories` 为基底，链路任一步失败时再补 `sync_chain_review_required`。 | advisory | 缺失按 `[]` | fail-open | enriched union |
| `$.firstAction` | `semantic_base: $.decision` | `N/A` | Sync 链首动作建议；由 top-level `decision`、sync 链状态、latest-check 校验状态组合生成。 | info | 缺失回退为人工复核提示 | fail-open | 依赖 `syncOk` 和 `latestCheckOk` 运行态 |
| `$.source` | `N/A` | `N/A` | Sync 输出来源标识，固定为 `sync_chain`，表示该文件是一次性同步链聚合结果。 | blocking | source 缺失按结果不可追溯处理 | fail-closed | 常量字段，不继承 latest / latest-check |
| `$.generatedAt` | `N/A` | `N/A` | Sync 输出生成时间；反映本次同步链结果写盘时刻。 | advisory | 缺失按未知同步新鲜度处理 | fail-open | 审计与时效字段 |
| `$.releaseCommandCenter.decision` | `$.decision` | `N/A` | 直接镜像 command-center latest `decision`，保留上游 latest 原始决策。 | blocking | 缺失按 `NO-GO` | fail-closed | direct mirror |
| `$.releaseCommandCenter.summaryClass` | `$.summaryClass` | `N/A` | 直接镜像 command-center latest `summaryClass`。 | advisory | 缺失按 `review_required` | fail-open | direct mirror |
| `$.releaseCommandCenter.exitCode` | `$.exitCode` | `N/A` | 直接镜像 command-center latest `exitCode`。 | blocking | 缺失按 `1` | fail-closed | direct mirror |
| `$.releaseCommandCenter.generatedAt` | `$.generatedAt` | `N/A` | 直接镜像 command-center latest `generatedAt`。 | advisory | 缺失按上游 latest 时效未知处理 | fail-open | direct mirror |
| `$.releaseCommandCenter.reasons[]` | `$.reasons[]` | `N/A` | 直接镜像 command-center latest `reasons[]`。 | blocking | 缺失按阻断原因不可追溯处理 | fail-closed | direct mirror |
| `$.releaseCommandCenter.advisories[]` | `$.advisories[]` | `N/A` | 直接镜像 command-center latest `advisories[]`。 | advisory | 缺失按 `[]` | fail-open | direct mirror |
| `$.releaseCommandCenterLatestCheck.decision` | `N/A` | `$.decision` | 直接镜像 command-center latest-check `decision`。 | blocking | 缺失按 `NO-GO` | fail-closed | direct mirror |
| `$.releaseCommandCenterLatestCheck.summaryClass` | `N/A` | `$.summaryClass` | 直接镜像 command-center latest-check `summaryClass`。 | advisory | 缺失按 `review_required` | fail-open | direct mirror |
| `$.releaseCommandCenterLatestCheck.exitCode` | `N/A` | `$.exitCode` | 直接镜像 command-center latest-check `exitCode`。 | blocking | 缺失按 `1` | fail-closed | direct mirror |
| `$.releaseCommandCenterLatestCheck.generatedAt` | `N/A` | `$.generatedAt` | 直接镜像 command-center latest-check `generatedAt`。 | advisory | 缺失按上游 latest-check 时效未知处理 | fail-open | direct mirror |
| `$.releaseCommandCenterLatestCheck.consistencyOk` | `N/A` | `$.consistencyOk` | 直接镜像 command-center latest-check `consistencyOk`，表示投影层关键一致性门禁是否通过。 | blocking | 缺失按 `false` | fail-closed | direct mirror |

## 4. 判定边界
1. 不要把 sync 顶层 `decision` 误读成 `releaseCommandCenterLatestCheck.decision` 的直传。当前实现里，sync 顶层决策主要看的是聚合后的 `reasons`，而不是 latest-check payload 自身的 decision。
2. `$.source` 与 `$.generatedAt` 都是 sync 文件自有字段：
   - `source` 固定为 `sync_chain`
   - `generatedAt` 为 sync 脚本写盘时间
3. 若需要回看上游原始快照值，应优先读取：
   - `$.releaseCommandCenter.*`
   - `$.releaseCommandCenterLatestCheck.*`

## 5. 统计与结论
- blocking 数量：`10`
- warning 数量：`8`
- 是否影响默认放行：`no`

说明：
- 上述 `warning` 统计按 `release_impact=advisory` 计数，`info` 项不计入 warning。
- 本文档只固化消费口径，不改现有 `release-command-center-sync` 执行与放行逻辑。
