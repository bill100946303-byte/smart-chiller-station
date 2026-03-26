# HVAC Verify-Gates Brief-Check 三语文案 v1

目标：补 `brief-check` 结果播报三语文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `briefCheck.ok`
- `exitCode`
- `reasons[]`
- `advisories[]`

## 2) 三态与触发条件

### A) check_pass

触发条件（字段级，全部满足）：
- `briefCheck.ok == true`
- `exitCode == 0`
- `reasons.length == 0`
- `advisories` 为数组（长度不限）

mobileShort：
- zh
  - 主句：`Brief校验通过`
  - 副句：`结构可读`
  - 第一动作：`继续发布确认`
- en
  - Main: `Brief Check Pass`
  - Sub: `Structure is readable`
  - First action: `Continue release confirmation`
- vi
  - Cau chinh: `Brief check dat`
  - Cau phu: `Cau truc doc duoc`
  - Buoc 1: `Tiep tuc xac nhan phat hanh`

full：
- zh
  - 主句：`Brief-Check 状态：PASS`
  - 副句：`brief 结构校验已通过，当前可用于值班播报。`
  - 第一动作：`按值班流程继续执行 release-ready 播报。`
- en
  - Main: `Brief-Check Status: PASS`
  - Sub: `Brief structure validation passed and is ready for duty broadcast.`
  - First action: `Continue release-ready broadcast in standard duty flow.`
- vi
  - Cau chinh: `Trang thai Brief-Check: PASS`
  - Cau phu: `Da qua xac thuc cau truc brief, co the dung de phat thong tin truc.`
  - Buoc 1: `Tiep tuc phat thong bao release-ready theo quy trinh truc chuan.`

### B) check_fail

触发条件（字段级，任一满足）：
- `briefCheck.ok == false`
- `exitCode == 1`
- `reasons.length > 0`

mobileShort：
- zh
  - 主句：`Brief校验失败`
  - 副句：`存在校验错误`
  - 第一动作：`先处理首个reason`
- en
  - Main: `Brief Check Fail`
  - Sub: `Validation errors found`
  - First action: `Handle first reason`
- vi
  - Cau chinh: `Brief check that bai`
  - Cau phu: `Co loi xac thuc`
  - Buoc 1: `Xu ly reason dau tien`

full：
- zh
  - 主句：`Brief-Check 状态：FAIL`
  - 副句：`brief 校验未通过，当前结果不应直接用于放行播报。`
  - 第一动作：`先按 reasons 首项修复后，再重跑 brief-check。`
- en
  - Main: `Brief-Check Status: FAIL`
  - Sub: `Brief validation failed, so current result must not be used for release broadcast.`
  - First action: `Fix the first item in reasons, then rerun brief-check.`
- vi
  - Cau chinh: `Trang thai Brief-Check: FAIL`
  - Cau phu: `Xac thuc brief that bai, khong duoc dung ket qua hien tai de phat thong bao phat hanh.`
  - Buoc 1: `Sua muc dau trong reasons, sau do chay lai brief-check.`

### C) check_unknown

触发条件（字段级，任一满足）：
- `briefCheck.ok` 缺失或非布尔
- `exitCode` 缺失或不在 `{0,1}`
- `reasons` 缺失或非数组
- `advisories` 缺失或非数组
- `briefCheck.ok == true && exitCode == 1`
- `briefCheck.ok == false && exitCode == 0 && reasons.length == 0`

mobileShort：
- zh
  - 主句：`Brief状态未知`
  - 副句：`字段冲突/缺失`
  - 第一动作：`先重跑brief-check`
- en
  - Main: `Brief Unknown`
  - Sub: `Field conflict/missing`
  - First action: `Rerun brief-check`
- vi
  - Cau chinh: `Trang thai brief chua ro`
  - Cau phu: `Xung dot/thieu truong`
  - Buoc 1: `Chay lai brief-check`

full：
- zh
  - 主句：`Brief-Check 状态：UNKNOWN`
  - 副句：`字段缺失、类型异常或状态冲突，当前结论不可用于值班播报。`
  - 第一动作：`先重跑 release-ready-brief-check 并复核输出字段。`
- en
  - Main: `Brief-Check Status: UNKNOWN`
  - Sub: `Missing/invalid fields or state conflict detected; current result is not usable for duty broadcast.`
  - First action: `Rerun release-ready-brief-check and verify output fields.`
- vi
  - Cau chinh: `Trang thai Brief-Check: UNKNOWN`
  - Cau phu: `Phat hien thieu/sai truong hoac xung dot trang thai; ket qua hien tai khong dung duoc cho thong bao truc.`
  - Buoc 1: `Chay lai release-ready-brief-check va kiem tra lai cac truong dau ra.`
