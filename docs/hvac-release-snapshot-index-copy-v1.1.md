# HVAC Snapshot-Index 三语值班提示文案 v1.1

目标：为 `release-snapshot-index` 提供 `history_ok / history_mixed / history_unknown` 三类值班文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

必需字段（来自 `release-snapshot-index-latest.json`）：
- `summary.go`
- `summary.noGo`
- `summary.unknown`
- `summary.shown`

分类判定顺序（避免重叠）：
1. 先判 `history_unknown`
2. 再判 `history_mixed`
3. 最后判 `history_ok`

## 2) 三类文案

### A) history_ok

触发条件（字段级）：
- `summary.shown > 0`
- `summary.go > 0`
- `summary.noGo == 0`
- `summary.unknown == 0`

mobileShort：
- zh
  - 主句：`历史稳定可放行`
  - 副句：`近次快照全GO`
  - 第一动作：`按窗口发布`
- en
  - Main: `History Stable`
  - Sub: `Recent snapshots are GO`
  - First action: `Release in window`
- vi
  - Cau chinh: `Lich su on dinh`
  - Cau phu: `Snapshot gan day deu GO`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`历史快照结论：OK`
  - 副句：`当前展示窗口内无 NO-GO/UNKNOWN，历史放行信号稳定。`
  - 第一动作：`执行本次 live 复核后，按标准发布流程推进。`
- en
  - Main: `Snapshot History: OK`
  - Sub: `No NO-GO/UNKNOWN in the current window and release signals are stable.`
  - First action: `Run live verification for this round, then proceed with normal release flow.`
- vi
  - Cau chinh: `Ket luan lich su snapshot: OK`
  - Cau phu: `Trong cua so hien tai khong co NO-GO/UNKNOWN, tin hieu phat hanh on dinh.`
  - Buoc 1: `Kiem tra live cho dot nay, sau do theo quy trinh phat hanh thong thuong.`

### B) history_mixed

触发条件（字段级）：
- `summary.shown > 0`
- `summary.unknown == 0`
- `summary.go > 0`
- `summary.noGo > 0`

mobileShort：
- zh
  - 主句：`历史结论混合`
  - 副句：`GO与NO-GO并存`
  - 第一动作：`先看最近NO-GO`
- en
  - Main: `Mixed History`
  - Sub: `GO and NO-GO coexist`
  - First action: `Check latest NO-GO`
- vi
  - Cau chinh: `Lich su hon hop`
  - Cau phu: `GO va NO-GO dong thoi`
  - Buoc 1: `Xem NO-GO moi nhat`

full：
- zh
  - 主句：`历史快照结论：MIXED`
  - 副句：`当前窗口同时存在 GO 与 NO-GO，发布风险不连续。`
  - 第一动作：`先定位最近一次 NO-GO 的 reason，再决定是否进入发布窗口。`
- en
  - Main: `Snapshot History: MIXED`
  - Sub: `Both GO and NO-GO appear in the current window, indicating inconsistent release risk.`
  - First action: `Locate reasons of the latest NO-GO first, then decide whether to enter release window.`
- vi
  - Cau chinh: `Ket luan lich su snapshot: MIXED`
  - Cau phu: `Trong cua so hien tai co ca GO va NO-GO, rui ro phat hanh khong lien tuc.`
  - Buoc 1: `Xac dinh reason cua NO-GO gan nhat truoc, roi moi quyet dinh vao cua so phat hanh.`

### C) history_unknown

触发条件（字段级，任一满足）：
- `summary.shown == 0`
- `summary.unknown > 0`

mobileShort：
- zh
  - 主句：`历史状态未知`
  - 副句：`含未知或无样本`
  - 第一动作：`先补采快照`
- en
  - Main: `History Unknown`
  - Sub: `Unknown or no samples`
  - First action: `Collect snapshots first`
- vi
  - Cau chinh: `Lich su chua ro`
  - Cau phu: `Co unknown hoac khong co mau`
  - Buoc 1: `Lay them snapshot truoc`

full：
- zh
  - 主句：`历史快照结论：UNKNOWN`
  - 副句：`当前窗口存在未知快照或样本不足，历史趋势不可直接用于放行。`
  - 第一动作：`先补齐有效快照（建议至少3条）并重算 index。`
- en
  - Main: `Snapshot History: UNKNOWN`
  - Sub: `Unknown snapshots or insufficient samples exist, so trend cannot be used directly for release.`
  - First action: `Collect enough valid snapshots (recommended >=3) and recompute the index.`
- vi
  - Cau chinh: `Ket luan lich su snapshot: UNKNOWN`
  - Cau phu: `Co snapshot unknown hoac thieu mau, xu huong khong the dung truc tiep de quyet dinh phat hanh.`
  - Buoc 1: `Bo sung du snapshot hop le (de xuat >=3) roi tinh lai index.`

## 3) 前端映射建议

1. 按“unknown > mixed > ok”顺序匹配分类。
2. 移动端优先显示 `mobileShort` 三行。
3. 值班展开态显示 `full` 三行并保留第一动作。

## 4) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
