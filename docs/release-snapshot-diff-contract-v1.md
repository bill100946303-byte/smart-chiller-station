# Release Snapshot Diff Contract v1

## 1. 目标与边界
- 目标：提供“当前快照 vs 上一次快照”的结构化差异输出。
- 边界：
  - 不改变发布放行逻辑。
  - 仅用于运营对比与变化提示，不替代 `release-snapshot` 主结论。

## 2. 执行命令
```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-diff --json
```

## 3. 最小字段集
- `/diffClass` (string)
  - 枚举：`stable | risk_up | recovery | changed | insufficient_history | error`
- `/hasPrevious` (boolean)
- `/decisionChanged` (boolean | null)
- `/reasonsAdded` (array of string)
- `/reasonsRemoved` (array of string)
- `/advisoriesAdded` (array of string)
- `/advisoriesRemoved` (array of string)
- `/reasons` (array of string)
- `/current/decision` (string, optional)
- `/previous/decision` (string, optional)

## 4. 判定语义
- `risk_up`：从 `GO -> NO-GO`
- `recovery`：从 `NO-GO -> GO`
- `stable`：决策未变且关键集合未出现风险提升
- `insufficient_history`：没有上一条可对比快照
- `error`：索引缺失/损坏等结构问题

## 5. 常见 reason key
- `snapshot_index_missing`
- `snapshot_index_invalid_json`
- `snapshot_index_empty`
