# release-ready-latest 值班读卡 v1（只读态）

用途：值班群快速读取“上一份 release-ready 结果”，不触发重算。  
只读命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest --json
```

## 固定读取顺序（必须）

### 1) 先看 `decision / exitCode`

- 主结论：`decision`（`GO | NO-GO | UNKNOWN`）
- 机器结论：`exitCode`（`0` 通常对应 GO，`1` 对应 NO-GO/异常）
- 规则：值班播报先报这两个字段，不先讨论细节。

### 2) 再看 `reasons / advisories`

- `reasons`：阻断原因（决定是否停发）
- `advisories`：提示项（不单独阻断，但要同步风险）
- 规则：`reasons` 非空优先处理第一条；`advisories` 作为补充说明。

### 3) 再看 `generatedAt` + 数据时效提醒

- 读取 `generatedAt`，确认是否为本班次时间窗口内结果。
- 时效提醒（只读建议）：
  - 若时间过旧或无法确认，先复跑 `release-ready --runtime-required=0 --json` 刷新 latest。
  - 若需严格时效判定，复跑 `status-json --live --strict-freshness` 复核实时门禁。

## 三个标准动作（GO / NO-GO / UNKNOWN）

- GO：`按发布窗口推进，并在群内同步“GO + generatedAt + 关键 advisory（若有）”。`
- NO-GO：`立即停发，先处理第一条 reason，修复后重跑 release-ready 再汇报。`
- UNKNOWN：`视为信息不足，先刷新 latest（release-ready --runtime-required=0 --json）后再判定。`

## 证据图（zh/en * dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-v1-en-system-overview.png`

## 口径约束

- `release-ready-latest` 是只读结果，不等于实时重算。
- 实时放行争议以 `status-json --live` / `release-ready` 当次结果为准。
