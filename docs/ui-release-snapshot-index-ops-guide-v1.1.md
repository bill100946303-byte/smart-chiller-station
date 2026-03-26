# release-snapshot-index 值班读法 v1.1

## 1) 先声明（必须）

- `release-snapshot-index` 是**历史统计视图**，用于看最近 N 次快照分布。
- 它**不等于本次放行结论**；本次放行请看 `release-snapshot-latest` 或 `status-json --live`。

## 2) 值班阅读顺序（固定）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-index --limit=10 --json
```

固定顺序：**先看 `summary.unknown`，再看 `summary.noGo`，最后看 `summary.go`**。

### 第一步：看 `summary.unknown`
- 含义：最近 N 次中“非 GO/NO-GO”的数量（通常是解析失败或异常快照）。
- 第一动作：若 `unknown > 0`，先抽查 `entries` 中对应记录并确认是否存在 `snapshot_parse_failed`。

### 第二步：看 `summary.noGo`
- 含义：最近 N 次中明确 NO-GO 的数量。
- 第一动作：若 `noGo > 0`，先定位最近一条 NO-GO 的 `reasons`，确认是否仍在持续。

### 第三步：看 `summary.go`
- 含义：最近 N 次中 GO 的数量。
- 第一动作：仅当 `unknown=0` 且 `noGo=0` 时，才把 `go` 视为稳定信号；否则 `go` 只作参考。

## 3) 三种状态卡样例文案

### A. UNKNOWN>0（优先最高）
- 卡片标题：`历史快照存在未知态（UNKNOWN）`
- 卡片主文案：`近 N 次中有 {unknown} 条未知快照，历史统计不稳定。`
- 卡片动作：`先排查未知条目（parse/结构异常），暂不据此给出放行建议。`

### B. UNKNOWN=0 且 NO-GO>0
- 卡片标题：`历史快照出现 NO-GO`
- 卡片主文案：`近 N 次中有 {noGo} 条 NO-GO，需要优先确认阻断原因是否已清除。`
- 卡片动作：`查看最近 NO-GO 的 reasons，并复跑 live 快照确认当前态。`

### C. UNKNOWN=0 且 NO-GO=0（全 GO）
- 卡片标题：`历史快照全为 GO`
- 卡片主文案：`近 N 次历史快照均为 GO，历史趋势稳定。`
- 卡片动作：`仍需以本次实时结论（status-json --live）作为最终放行依据。`

## 4) 值班口令（可直接复制）

- `index 先看 unknown，再看 noGo，再看 go。`
- `index 只看历史，不替代本次放行结论。`
- `最终结论必须回到 live 快照。`
