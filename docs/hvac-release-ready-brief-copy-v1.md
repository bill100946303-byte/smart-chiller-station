# HVAC Release-Ready Brief 三语值班文案 v1

目标：提供 `ready / blocked / review_required` 三态简版值班文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `reasons[]`
- `advisories[]`

## 2) 优先级规则（必须）

匹配顺序固定为：
1. `blocked`
2. `review_required`
3. `ready`

## 3) 三态模板

### A) blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `reasons.length > 0`

mobileShort：
- zh
  - 主句：`发布受阻`
  - 副句：`存在阻断项`
  - firstAction：`先修复首个reason`
- en
  - Main: `Blocked`
  - Sub: `Blocking items exist`
  - firstAction: `Fix first reason`
- vi
  - Cau chinh: `Bi chan phat hanh`
  - Cau phu: `Ton tai muc chan`
  - firstAction: `Sua reason dau tien`

full：
- zh
  - 主句：`放行状态：BLOCKED`
  - 副句：`当前存在阻断信号，暂不允许放行。`
  - firstAction：`先按 reasons 第一项排障，再重跑发布判定。`
- en
  - Main: `Release Status: BLOCKED`
  - Sub: `Blocking signals are present, so release is not allowed now.`
  - firstAction: `Troubleshoot the first item in reasons, then rerun release decision.`
- vi
  - Cau chinh: `Trang thai phat hanh: BLOCKED`
  - Cau phu: `Dang co tin hieu chan, tam thoi khong duoc phat hanh.`
  - firstAction: `Xu ly muc dau trong reasons, sau do chay lai phan quyet phat hanh.`

### B) review_required

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length > 0`

mobileShort：
- zh
  - 主句：`可放行需复核`
  - 副句：`存在提示项`
  - firstAction：`先看advisories`
- en
  - Main: `Review Needed`
  - Sub: `Advisories present`
  - firstAction: `Review advisories`
- vi
  - Cau chinh: `Can ra soat`
  - Cau phu: `Co canh bao`
  - firstAction: `Xem advisories`

full：
- zh
  - 主句：`放行状态：REVIEW_REQUIRED`
  - 副句：`主结论为 GO，但有提示项，需人工复核后放行。`
  - firstAction：`先确认 advisories 的影响范围，再执行放行。`
- en
  - Main: `Release Status: REVIEW_REQUIRED`
  - Sub: `Decision is GO, but advisories require manual review before release.`
  - firstAction: `Confirm advisory impact first, then proceed with release.`
- vi
  - Cau chinh: `Trang thai phat hanh: REVIEW_REQUIRED`
  - Cau phu: `Decision la GO nhung co canh bao, can ra soat thu cong truoc khi phat hanh.`
  - firstAction: `Xac nhan anh huong cua advisories truoc, roi moi phat hanh.`

### C) ready

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- 不满足 `review_required`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length == 0`

mobileShort：
- zh
  - 主句：`可直接放行`
  - 副句：`门禁已清`
  - firstAction：`按窗口发布`
- en
  - Main: `Ready`
  - Sub: `Gates clear`
  - firstAction: `Release in window`
- vi
  - Cau chinh: `San sang phat hanh`
  - Cau phu: `Cong da sach`
  - firstAction: `Phat hanh theo cua so`

full：
- zh
  - 主句：`放行状态：READY`
  - 副句：`当前无阻断、无提示项，可按标准流程放行。`
  - firstAction：`先确认发布窗口，再按标准步骤执行。`
- en
  - Main: `Release Status: READY`
  - Sub: `No blockers or advisories now, ready for standard release flow.`
  - firstAction: `Confirm release window, then execute standard steps.`
- vi
  - Cau chinh: `Trang thai phat hanh: READY`
  - Cau phu: `Khong co blocker hay advisory, san sang theo quy trinh phat hanh chuan.`
  - firstAction: `Xac nhan cua so phat hanh, sau do thuc hien cac buoc chuan.`
