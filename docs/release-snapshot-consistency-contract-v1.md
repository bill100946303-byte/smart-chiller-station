# Release Snapshot Consistency Contract v1

## 1. 目标与边界
- 目标：校验 `release-snapshot-latest` 与 `release-snapshot-index` 最新条目的一致性。
- 边界：
  - 不改业务决策逻辑。
  - 不影响 `check:contract` 主门禁。

## 2. 执行命令
```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-consistency --json
```

## 3. 最小字段集（输出）
- `/decision` (string, `GO | NO-GO`)
- `/exitCode` (integer, `0 | 1`)
- `/reasons` (array of string)
- `/checks/latestExists` (boolean)
- `/checks/indexExists` (boolean)
- `/checks/indexHasEntries` (boolean)
- `/checks/decisionMatch` (boolean)
- `/checks/reasonsMatch` (boolean)
- `/checks/advisoriesMatch` (boolean)

## 4. 核心判定规则
- 当且仅当以下同时为 true 时，`decision=GO`：
  - `latestExists`
  - `indexExists`
  - `indexHasEntries`
  - `decisionMatch`
  - `reasonsMatch`
  - `advisoriesMatch`
- 任一项不满足则 `decision=NO-GO`，并输出对应 `reasons`。

## 5. 常见 reason key
- `latest_snapshot_missing`
- `latest_snapshot_invalid_json`
- `snapshot_index_missing`
- `snapshot_index_invalid_json`
- `snapshot_index_empty`
- `snapshot_index_latest_mismatch`
