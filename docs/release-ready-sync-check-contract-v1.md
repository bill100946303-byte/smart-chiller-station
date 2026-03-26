# Release Ready Sync Check Contract v1

校验命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check
```

自检命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check --selftest
```

## 1. 校验对象

- 文件：`/Users/billchow/Documents/智慧冷冻站/docs/release-ready-sync-latest.json`
- 目标：保证 sync 结果可被值班页面与自动化脚本稳定消费

## 2. 最小字段

- 顶层：
  - `version` string
  - `generatedAt` string
  - `decision` enum(`GO|NO-GO`)
  - `exitCode` enum(`0|1`)
- `inputs`：
  - `strictFreshness` boolean
  - `runtimeRequired` boolean
  - `recompute` boolean
- `steps`：
  - `releaseReady.ok` boolean
  - `releaseReady.exitCode` integer
  - `releaseReady.mode` enum(`read_latest|recompute`)
  - `releaseReadyCheck.ok` boolean
  - `releaseReadyLatest.ok` boolean
- 子对象：
  - `releaseReady.decision/exitCode/reasons/advisories`
  - `releaseReadyLatest.decision/exitCode/reasons/advisories`

## 3. 负例自检

- 打开方式：`RELEASE_READY_SYNC_SELFTEST=1`
- 内置 3 条：
  1. `/steps` 缺失
  2. `/releaseReadyLatest.decision` 枚举错误
  3. `/steps.releaseReady.mode` 非法值

## 4. 错误格式

- 统一：`<json_path>: <error_message>`

## 5. 边界

- 不改 `check:contract`
- 不改 OpenAPI 主 schema
- 本校验属于独立门禁
