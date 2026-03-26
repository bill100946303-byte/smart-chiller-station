# HVAC Check-Family 值班文案 v1.1

目标：提供 `ready / blocked / review_required` 三态三语值班文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `overall`
- `passedCount`
- `totalCount`
- `checks[].ok`

## 2) 状态优先级

1. `blocked`
2. `review_required`
3. `ready`

## 3) 三态文案

### A) ready

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- 不满足 `review_required`
- `overall == "PASS"`
- `totalCount > 0`
- `passedCount == totalCount`
- `all(checks[].ok == true)`

mobileShort：
- zh
  - 主句：`检查家族就绪`
  - 副句：`全项通过`
  - 第一动作：`按窗口推进发布`
- en
  - Main: `Check Family Ready`
  - Sub: `All checks passed`
  - First action: `Proceed in release window`
- vi
  - Cau chinh: `Nhom kiem tra da san sang`
  - Cau phu: `Tat ca muc deu dat`
  - Buoc 1: `Tiep tuc theo cua so phat hanh`

full：
- zh
  - 主句：`Check-Family 状态：READY`
  - 副句：`overall 为 PASS 且已通过数等于总数，当前可进入标准发布流程。`
  - 第一动作：`先确认放行窗口与操作人，再执行发布。`
- en
  - Main: `Check-Family Status: READY`
  - Sub: `Overall is PASS and passedCount equals totalCount, ready for standard release flow.`
  - First action: `Confirm release window and operator first, then execute release.`
- vi
  - Cau chinh: `Trang thai Check-Family: READY`
  - Cau phu: `Overall la PASS va passedCount bang totalCount, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Xac nhan cua so phat hanh va nguoi thao tac truoc, sau do phat hanh.`

### B) blocked

触发条件（字段级，任一满足）：
- `overall == "FAIL" && passedCount == 0 && totalCount > 0`
- `all(checks[].ok == false)`

mobileShort：
- zh
  - 主句：`检查家族阻断`
  - 副句：`关键项未通过`
  - 第一动作：`先修首个失败项`
- en
  - Main: `Check Family Blocked`
  - Sub: `Critical checks failed`
  - First action: `Fix first failed check`
- vi
  - Cau chinh: `Nhom kiem tra bi chan`
  - Cau phu: `Muc quan trong khong dat`
  - Buoc 1: `Sua muc loi dau tien`

full：
- zh
  - 主句：`Check-Family 状态：BLOCKED`
  - 副句：`当前为全量未通过态，发布应保持阻断。`
  - 第一动作：`先修复 checks 首个失败项，再重跑全套检查。`
- en
  - Main: `Check-Family Status: BLOCKED`
  - Sub: `Current state is full failure, release must remain blocked.`
  - First action: `Fix the first failed check in checks, then rerun full checks.`
- vi
  - Cau chinh: `Trang thai Check-Family: BLOCKED`
  - Cau phu: `Trang thai hien tai la that bai toan bo, can tiep tuc chan phat hanh.`
  - Buoc 1: `Sua muc loi dau tien trong checks, sau do chay lai toan bo kiem tra.`

### C) review_required

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- `totalCount > 0`
- `passedCount > 0`
- `passedCount < totalCount`
- `exists(checks[].ok == false)`

mobileShort：
- zh
  - 主句：`检查家族待复核`
  - 副句：`部分通过`
  - 第一动作：`先核对未通过项`
- en
  - Main: `Check Family Review`
  - Sub: `Partial pass detected`
  - First action: `Review failed checks first`
- vi
  - Cau chinh: `Nhom kiem tra can ra soat`
  - Cau phu: `Phat hien dat mot phan`
  - Buoc 1: `Ra soat cac muc chua dat truoc`

full：
- zh
  - 主句：`Check-Family 状态：REVIEW_REQUIRED`
  - 副句：`当前为部分通过态，不应解读为可直接发布。`
  - 第一动作：`先定位未通过检查项并补测，通过后再进入放行确认。`
- en
  - Main: `Check-Family Status: REVIEW_REQUIRED`
  - Sub: `This is a partial pass state and must not be treated as directly releasable.`
  - First action: `Locate failed checks and retest first, then move to release confirmation.`
- vi
  - Cau chinh: `Trang thai Check-Family: REVIEW_REQUIRED`
  - Cau phu: `Day la trang thai dat mot phan, khong duoc hieu la co the phat hanh ngay.`
  - Buoc 1: `Xac dinh muc chua dat va kiem tra bo sung truoc, sau do moi xac nhan phat hanh.`

## 4) “部分通过”提醒（防误读）

触发条件（字段级）：
- `totalCount > 0`
- `passedCount > 0`
- `passedCount < totalCount`

提醒文案：
- zh：`部分通过仅表示风险收敛中，不代表可直接发布。`
- en：`Partial pass means risk is being reduced, not that release is directly allowed.`
- vi：`Dat mot phan chi cho thay rui ro dang duoc giam, khong co nghia la duoc phat hanh ngay.`

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
