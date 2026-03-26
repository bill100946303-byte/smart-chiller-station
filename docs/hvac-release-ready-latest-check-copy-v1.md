# HVAC Release-Ready-Latest-Check 三语播报文案 v1

目标：补 `release-ready-latest-check` 三态播报文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `reasons[]`
- `advisories[]`

## 2) 三态文案

### A) check_ready

触发条件（字段级，全部满足）：
- 不满足 `check_blocked`
- 不满足 `check_review_required`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length == 0`

mobileShort：
- zh
  - 主句：`最新检查就绪`
  - 副句：`可直接放行`
  - 第一动作：`按窗口执行发布`
- en
  - Main: `Latest Check Ready`
  - Sub: `Ready to release`
  - First action: `Release in window`
- vi
  - Cau chinh: `Kiem tra moi da san sang`
  - Cau phu: `Co the phat hanh`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`Latest-Check 状态：CHECK_READY`
  - 副句：`主结论为 GO，且无 reasons/advisories，当前可按标准流程放行。`
  - 第一动作：`先确认发布窗口，再执行正式放行。`
- en
  - Main: `Latest-Check Status: CHECK_READY`
  - Sub: `Decision is GO with no reasons/advisories, ready for standard release flow.`
  - First action: `Confirm release window first, then execute formal release.`
- vi
  - Cau chinh: `Trang thai Latest-Check: CHECK_READY`
  - Cau phu: `Decision la GO va khong co reasons/advisories, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do phat hanh chinh thuc.`

### B) check_blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `reasons.length > 0`

mobileShort：
- zh
  - 主句：`最新检查受阻`
  - 副句：`存在阻断项`
  - 第一动作：`先处理首个reason`
- en
  - Main: `Latest Check Blocked`
  - Sub: `Blocking reasons detected`
  - First action: `Handle first reason`
- vi
  - Cau chinh: `Kiem tra moi bi chan`
  - Cau phu: `Phat hien ly do chan`
  - Buoc 1: `Xu ly reason dau tien`

full：
- zh
  - 主句：`Latest-Check 状态：CHECK_BLOCKED`
  - 副句：`当前检查存在阻断信号，暂不允许放行。`
  - 第一动作：`先修复 reasons 首项，再重跑 latest-check。`
- en
  - Main: `Latest-Check Status: CHECK_BLOCKED`
  - Sub: `Current check has blocking signals, so release is blocked now.`
  - First action: `Fix the first item in reasons, then rerun latest-check.`
- vi
  - Cau chinh: `Trang thai Latest-Check: CHECK_BLOCKED`
  - Cau phu: `Kiem tra hien tai co tin hieu chan, tam thoi khong duoc phat hanh.`
  - Buoc 1: `Sua muc dau trong reasons, sau do chay lai latest-check.`

### C) check_review_required

触发条件（字段级，全部满足）：
- 不满足 `check_blocked`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories.length > 0`

mobileShort：
- zh
  - 主句：`最新检查待复核`
  - 副句：`存在提示项`
  - 第一动作：`先看advisories`
- en
  - Main: `Latest Check Review`
  - Sub: `Advisories present`
  - First action: `Review advisories first`
- vi
  - Cau chinh: `Kiem tra moi can ra soat`
  - Cau phu: `Co advisories`
  - Buoc 1: `Xem advisories truoc`

full：
- zh
  - 主句：`Latest-Check 状态：CHECK_REVIEW_REQUIRED`
  - 副句：`主结论虽为 GO，但存在 advisories，需人工复核后再放行。`
  - 第一动作：`先确认 advisories 影响范围，再进入发布确认。`
- en
  - Main: `Latest-Check Status: CHECK_REVIEW_REQUIRED`
  - Sub: `Decision is GO but advisories remain, so manual review is required before release.`
  - First action: `Confirm advisory impact first, then proceed to release confirmation.`
- vi
  - Cau chinh: `Trang thai Latest-Check: CHECK_REVIEW_REQUIRED`
  - Cau phu: `Decision la GO nhung van co advisories, can ra soat thu cong truoc khi phat hanh.`
  - Buoc 1: `Xac nhan anh huong cua advisories truoc, roi moi vao buoc xac nhan phat hanh.`

## 3) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
