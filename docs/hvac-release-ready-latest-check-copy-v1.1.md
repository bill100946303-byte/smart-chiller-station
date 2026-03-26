# HVAC Release-Ready-Latest-Check 三语播报文案 v1.1

目标：补 `latest-check` 三态播报文案，并加入 `source` 异常专项说明（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `reasons[]`
- `source`

推荐可信 `source` 值（白名单）：
- `live`
- `latest_file`
- `sync_latest`
- `canonical`
- `release_ready_latest`

## 2) 状态优先级

1. `blocked`
2. `review_required`
3. `ready`

## 3) 三态文案

### A) ready

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- 不满足 `review_required`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `source` 在白名单内

mobileShort：
- zh
  - 主句：`最新检查就绪`
  - 副句：`可按流程放行`
  - 第一动作：`按窗口执行发布`
- en
  - Main: `Latest Check Ready`
  - Sub: `Ready for release flow`
  - First action: `Release in window`
- vi
  - Cau chinh: `Kiem tra moi da san sang`
  - Cau phu: `San sang theo quy trinh phat hanh`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`Latest-Check 状态：READY`
  - 副句：`主结论为 GO，且无阻断项、来源可信，可进入标准放行流程。`
  - 第一动作：`先确认发布窗口，再执行正式放行。`
- en
  - Main: `Latest-Check Status: READY`
  - Sub: `Decision is GO with no blockers and trusted source, ready for standard release flow.`
  - First action: `Confirm release window first, then execute formal release.`
- vi
  - Cau chinh: `Trang thai Latest-Check: READY`
  - Cau phu: `Decision la GO, khong co blocker va nguon tin cay, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do phat hanh chinh thuc.`

### B) blocked

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
  - 主句：`Latest-Check 状态：BLOCKED`
  - 副句：`当前检查命中阻断条件，暂不允许放行。`
  - 第一动作：`先修复 reasons 首项，再重跑 latest-check。`
- en
  - Main: `Latest-Check Status: BLOCKED`
  - Sub: `Current check hits blocking conditions, so release is blocked now.`
  - First action: `Fix the first item in reasons, then rerun latest-check.`
- vi
  - Cau chinh: `Trang thai Latest-Check: BLOCKED`
  - Cau phu: `Kiem tra hien tai cham dieu kien chan, tam thoi khong duoc phat hanh.`
  - Buoc 1: `Sua muc dau trong reasons, sau do chay lai latest-check.`

### C) review_required

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `source` 缺失，或 `source` 不在白名单内

mobileShort：
- zh
  - 主句：`最新检查待复核`
  - 副句：`来源待确认`
  - 第一动作：`先核对source`
- en
  - Main: `Latest Check Review`
  - Sub: `Source needs confirmation`
  - First action: `Verify source first`
- vi
  - Cau chinh: `Kiem tra moi can ra soat`
  - Cau phu: `Can xac nhan nguon`
  - Buoc 1: `Kiem tra source truoc`

full：
- zh
  - 主句：`Latest-Check 状态：REVIEW_REQUIRED`
  - 副句：`主结论为 GO，但来源字段异常/未知，需人工复核后再放行。`
  - 第一动作：`先确认 source 与执行链路一致，再进入发布确认。`
- en
  - Main: `Latest-Check Status: REVIEW_REQUIRED`
  - Sub: `Decision is GO, but source is abnormal/unknown and requires manual review before release.`
  - First action: `Confirm source matches execution path first, then proceed to release confirmation.`
- vi
  - Cau chinh: `Trang thai Latest-Check: REVIEW_REQUIRED`
  - Cau phu: `Decision la GO nhung source bat thuong/khong ro, can ra soat thu cong truoc khi phat hanh.`
  - Buoc 1: `Xac nhan source khop voi duong thuc thi truoc, roi moi vao buoc xac nhan phat hanh.`

## 4) Source 异常专项文案（避免误读）

触发条件（字段级）：
- `decision == "GO" && exitCode == 0 && reasons.length == 0`
- 且 `source` 缺失或不在白名单

专项提示：
- zh：`source 异常表示“来源标识不完整/不一致”，不等于系统故障；请先核对链路来源。`
- en：`Source anomaly means source labeling is incomplete/inconsistent, not a system outage; verify pipeline source first.`
- vi：`Bat thuong source co nghia la nhan dang nguon chua day du/khong dong nhat, khong phai su co he thong; hay kiem tra nguon du lieu truoc.`

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
