# HVAC Snapshot Diff 三语值班文案 v1

目标：为 snapshot diff 提供 `stable / risk_up / recovery` 三类值班文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

必需字段：
- `decisionChanged`（boolean）
- `added`（array<string>）
- `removed`（array<string>）

说明：
- `added/removed` 建议承载本轮新增/移除的阻断或提示 key（如 reason/advisory key）。
- 若 `added` 与 `removed` 同时非空，优先按 `risk_up` 处理（保守策略）。

## 2) 分类顺序（前端匹配优先级）

1. `risk_up`
2. `recovery`
3. `stable`

## 3) 三类文案

### A) stable（无变化）

触发条件（字段级）：
- `decisionChanged == false`
- `added.length == 0`
- `removed.length == 0`

mobileShort：
- zh
  - 主句：`状态稳定`
  - 副句：`本轮无变化`
  - 第一动作：`按常规巡检`
- en
  - Main: `Stable`
  - Sub: `No changes this run`
  - First action: `Keep routine checks`
- vi
  - Cau chinh: `On dinh`
  - Cau phu: `Lan nay khong doi`
  - Buoc 1: `Tiep tuc kiem tra dinh ky`

full：
- zh
  - 主句：`快照差异结论：STABLE`
  - 副句：`决策未变化，且无新增/移除项，当前状态连续稳定。`
  - 第一动作：`保持当前发布节奏，并继续按班次巡检。`
- en
  - Main: `Snapshot Diff: STABLE`
  - Sub: `Decision is unchanged with no added/removed items, indicating continuous stability.`
  - First action: `Keep current release cadence and continue shift-based checks.`
- vi
  - Cau chinh: `Ket luan diff snapshot: STABLE`
  - Cau phu: `Decision khong doi va khong co muc them/xoa, trang thai dang on dinh lien tuc.`
  - Buoc 1: `Giu nhip phat hanh hien tai va tiep tuc kiem tra theo ca.`

### B) risk_up（恶化）

触发条件（字段级）：
- `decisionChanged == true`
- `added.length > 0`

mobileShort：
- zh
  - 主句：`风险上升`
  - 副句：`出现新增项`
  - 第一动作：`先看新增key`
- en
  - Main: `Risk Up`
  - Sub: `New items added`
  - First action: `Check added keys first`
- vi
  - Cau chinh: `Rui ro tang`
  - Cau phu: `Co muc moi them`
  - Buoc 1: `Xem key moi truoc`

full：
- zh
  - 主句：`快照差异结论：RISK_UP`
  - 副句：`决策发生变化且存在新增项，风险较上一轮上升。`
  - 第一动作：`先按新增 key 逐条排障，再重跑快照确认是否回落。`
- en
  - Main: `Snapshot Diff: RISK_UP`
  - Sub: `Decision changed with added items, showing higher risk than previous run.`
  - First action: `Troubleshoot newly added keys first, then rerun snapshot to verify rollback.`
- vi
  - Cau chinh: `Ket luan diff snapshot: RISK_UP`
  - Cau phu: `Decision da doi va co muc moi them, rui ro cao hon lan truoc.`
  - Buoc 1: `Xu ly key moi truoc, sau do chay lai snapshot de xac nhan da giam rui ro.`

### C) recovery（恢复）

触发条件（字段级）：
- `decisionChanged == true`
- `added.length == 0`
- `removed.length > 0`

mobileShort：
- zh
  - 主句：`状态恢复`
  - 副句：`阻断项减少`
  - 第一动作：`先做live复核`
- en
  - Main: `Recovered`
  - Sub: `Blocking items reduced`
  - First action: `Run live recheck`
- vi
  - Cau chinh: `Da phuc hoi`
  - Cau phu: `Muc chan da giam`
  - Buoc 1: `Kiem tra live lai`

full：
- zh
  - 主句：`快照差异结论：RECOVERY`
  - 副句：`决策发生变化且仅有移除项，阻断信号较上一轮回落。`
  - 第一动作：`先执行 live 复核确认恢复持续，再恢复常规发布节奏。`
- en
  - Main: `Snapshot Diff: RECOVERY`
  - Sub: `Decision changed with removed-only items, indicating blocking signals are easing.`
  - First action: `Run live verification first, then return to normal release cadence if recovery persists.`
- vi
  - Cau chinh: `Ket luan diff snapshot: RECOVERY`
  - Cau phu: `Decision da doi va chi co muc bi loai bo, tin hieu chan dang giam.`
  - Buoc 1: `Kiem tra live truoc, neu phuc hoi on dinh thi quay lai nhip phat hanh thong thuong.`

## 4) 兜底规则

- 若 `decisionChanged == false` 且（`added.length > 0` 或 `removed.length > 0`）：
  - 建议按 `stable` 展示主结论，并在副区补充“存在非决策级变更”提示。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
