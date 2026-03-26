# Snapshot-Index 与 Snapshot-Latest 一致性规则 v1

## 1. 目标与边界
- 目标：定义 `release-snapshot-index-latest.json` 与 `release-snapshot-latest.json` 的一致性规则，重点保证 `entries[0]` 与 latest 快照关键字段同源。
- 边界：不改业务字段定义，仅固化审计规则与归因口径。

## 2. 同源定义（关键字段）
关键字段：`decision` / `reasons` / `advisories`  
“同源”定义为同时满足：
1. `index.entries[0].file == latest.artifacts.archiveJson`
2. `index.entries[0].decision == latest.decision`
3. `index.entries[0].reasons` 与 `latest.reasons` 归一化后相等（排序后比较）
4. `index.entries[0].advisories` 与 `latest.advisories` 归一化后相等（排序后比较）

说明：
- `entries[0]` 代表 index 当前视图中的最新归档条目（按 `generatedAt/mtime` 排序）。
- 归一化比较用于避免数组顺序导致的误报。

## 3. 一致性规则（可机检）

| 规则ID | 检查项 | 规则表达式 | 失败影响 |
| --- | --- | --- | --- |
| `IDX-C001` | latest 文件存在 | `exists(docs/release-snapshot-latest.json)` | advisory |
| `IDX-C002` | index 文件存在 | `exists(docs/release-snapshot-index-latest.json)` | advisory |
| `IDX-C003` | index 有首条记录 | `len(index.entries) >= 1` | advisory |
| `IDX-C004` | 首条来源文件一致 | `index.entries[0].file == latest.artifacts.archiveJson` | advisory |
| `IDX-C005` | decision 一致 | `index.entries[0].decision == latest.decision` | advisory |
| `IDX-C006` | reasons 一致 | `sort(index.entries[0].reasons) == sort(latest.reasons)` | advisory |
| `IDX-C007` | advisories 一致 | `sort(index.entries[0].advisories) == sort(latest.advisories)` | advisory |
| `IDX-C008` | generatedAt 一致 | `index.entries[0].generatedAt == latest.generatedAt` | info |

## 4. 不一致归因规则

### 4.1 文件时序（timing/order）
判定信号（满足任一）：
- `IDX-C004` 失败，且 `index.entries[0].generatedAt < latest.generatedAt`
- 刚生成 latest 但尚未刷新 index（例如未执行 `release-snapshot-index`）

归因结论：`file_timing_or_index_stale`

### 4.2 解析失败（parse failure）
判定信号：
- `index.entries[0].decision == "UNKNOWN"` 且 `index.entries[0].reasons` 包含 `snapshot_parse_failed`

归因结论：`snapshot_parse_failed`

### 4.3 手工改档（manual edit suspected）
判定信号（同时满足）：
- `IDX-C004` 通过（同一归档文件）
- `IDX-C005/006/007` 任一失败
- 不满足解析失败条件（非 `snapshot_parse_failed`）

归因结论：`manual_edit_or_out_of_band_mutation`

## 5. 处置建议
1. `file_timing_or_index_stale`：先执行 `scripts/chiller_ctl.sh release-snapshot-index --limit=20` 再复检。
2. `snapshot_parse_failed`：修复对应归档 JSON（或重跑 `release-snapshot` 生成新归档）。
3. `manual_edit_or_out_of_band_mutation`：核对归档文件变更记录，禁止手工改档，必要时重跑快照闭环。

## 6. 对默认放行影响
- 该一致性规则服务于“审计可追溯与历史视图正确性”。
- 默认放行仍以 `release-snapshot-latest` / `release-gate` 主链路为准。
- 结论：对当前默认放行影响为 `no`。
