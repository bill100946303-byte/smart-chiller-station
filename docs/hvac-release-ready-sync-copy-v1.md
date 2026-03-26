# HVAC Release-Ready-Sync 三语运维口播 v1

目标：为同步态输出 `sync_ready / sync_blocked / sync_review` 三类三语值班文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `reasons[]`
- `advisories[]`

## 2) 优先级顺序（避免重叠）

1. `sync_blocked`
2. `sync_review`
3. `sync_ready`

## 3) 三类文案

### A) sync_blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `reasons.length > 0`

mobileShort：
- zh
  - 主句：`同步受阻`
  - 副句：`存在阻断项`
  - 第一步动作：`先处理首个reason`
- en
  - Main: `Sync Blocked`
  - Sub: `Blocking items exist`
  - First step: `Handle first reason`
- vi
  - Cau chinh: `Dong bo bi chan`
  - Cau phu: `Ton tai muc chan`
  - Buoc 1: `Xu ly reason dau tien`

full：
- zh
  - 主句：`同步状态：BLOCKED`
  - 副句：`当前同步结果存在阻断信号，暂不允许进入放行动作。`
  - 第一步动作：`先按 reasons 首项排障，再重跑同步检查。`
- en
  - Main: `Sync Status: BLOCKED`
  - Sub: `Current sync result has blocking signals, so release actions must stop.`
  - First step: `Troubleshoot the first item in reasons, then rerun sync checks.`
- vi
  - Cau chinh: `Trang thai dong bo: BLOCKED`
  - Cau phu: `Ket qua dong bo hien tai co tin hieu chan, tam thoi khong duoc thuc hien thao tac phat hanh.`
  - Buoc 1: `Xu ly muc dau trong reasons, sau do chay lai kiem tra dong bo.`

### B) sync_review

触发条件（字段级，全部满足）：
- 不满足 `sync_blocked`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length > 0`

mobileShort：
- zh
  - 主句：`同步需复核`
  - 副句：`存在提示项`
  - 第一步动作：`先看advisories`
- en
  - Main: `Sync Review`
  - Sub: `Advisories exist`
  - First step: `Review advisories first`
- vi
  - Cau chinh: `Dong bo can ra soat`
  - Cau phu: `Co muc canh bao`
  - Buoc 1: `Xem advisories truoc`

full：
- zh
  - 主句：`同步状态：REVIEW_REQUIRED`
  - 副句：`同步主结论为 GO，但仍有提示项，需人工复核后执行放行。`
  - 第一步动作：`先确认 advisories 影响范围，再继续发布确认。`
- en
  - Main: `Sync Status: REVIEW_REQUIRED`
  - Sub: `Sync decision is GO, but advisories remain and require manual review before release.`
  - First step: `Confirm advisory impact first, then continue release confirmation.`
- vi
  - Cau chinh: `Trang thai dong bo: REVIEW_REQUIRED`
  - Cau phu: `Quyet dinh dong bo la GO nhung van con canh bao, can ra soat thu cong truoc khi phat hanh.`
  - Buoc 1: `Xac nhan pham vi anh huong cua advisories truoc, roi moi tiep tuc xac nhan phat hanh.`

### C) sync_ready

触发条件（字段级，全部满足）：
- 不满足 `sync_blocked`
- 不满足 `sync_review`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length == 0`

mobileShort：
- zh
  - 主句：`同步已就绪`
  - 副句：`可执行放行`
  - 第一步动作：`按窗口发布`
- en
  - Main: `Sync Ready`
  - Sub: `Ready to release`
  - First step: `Release in window`
- vi
  - Cau chinh: `Dong bo da san sang`
  - Cau phu: `Co the phat hanh`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`同步状态：READY`
  - 副句：`同步结果无阻断且无提示项，可按标准流程执行放行。`
  - 第一步动作：`先做发布窗口确认，再按标准步骤放行。`
- en
  - Main: `Sync Status: READY`
  - Sub: `Sync result has no blockers or advisories and is ready for standard release flow.`
  - First step: `Run release-window confirmation first, then execute standard release steps.`
- vi
  - Cau chinh: `Trang thai dong bo: READY`
  - Cau phu: `Ket qua dong bo khong co blocker hay advisory, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do thuc hien cac buoc phat hanh chuan.`

## 4) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
