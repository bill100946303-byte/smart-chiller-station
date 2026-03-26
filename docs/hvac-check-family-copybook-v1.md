# HVAC Check Family Copybook v1

目标：统一 `release-ready / sync / brief / verify-gates` 四类 check 的三语主句模板（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 统一主句模板（适用于四类 check）

### `check_pass`
- zh
  - `mobileShort.main`: `检查通过`
  - `full.main`: `检查状态：PASS`
- en
  - `mobileShort.main`: `Check Pass`
  - `full.main`: `Check Status: PASS`
- vi
  - `mobileShort.main`: `Kiem tra dat`
  - `full.main`: `Trang thai kiem tra: PASS`

### `check_fail`
- zh
  - `mobileShort.main`: `检查失败`
  - `full.main`: `检查状态：FAIL`
- en
  - `mobileShort.main`: `Check Fail`
  - `full.main`: `Check Status: FAIL`
- vi
  - `mobileShort.main`: `Kiem tra that bai`
  - `full.main`: `Trang thai kiem tra: FAIL`

### `check_unknown`
- zh
  - `mobileShort.main`: `检查未知`
  - `full.main`: `检查状态：UNKNOWN`
- en
  - `mobileShort.main`: `Check Unknown`
  - `full.main`: `Check Status: UNKNOWN`
- vi
  - `mobileShort.main`: `Kiem tra chua ro`
  - `full.main`: `Trang thai kiem tra: UNKNOWN`

## 2) 家族映射（字段级触发 + 第一动作）

### A) `release-ready-check`

字段（示例来源：release-ready-latest）：
- `decision`
- `exitCode`
- `reasons[]`
- `advisories[]`

状态映射：
- `check_pass`
  - 条件：`decision=="GO" && exitCode==0 && reasons.length==0`
  - 第一步动作：
    - zh：`按窗口继续发布确认`
    - en：`Continue release confirmation in window`
    - vi：`Tiep tuc xac nhan phat hanh theo cua so`
- `check_fail`
  - 条件：`decision=="NO-GO" || exitCode==1 || reasons.length>0`
  - 第一步动作：
    - zh：`先处理首个 reason 后重跑`
    - en：`Fix first reason then rerun`
    - vi：`Xu ly reason dau tien roi chay lai`
- `check_unknown`
  - 条件：`decision 缺失/非法 或 exitCode 缺失/非法`
  - 第一步动作：
    - zh：`先重跑 release-ready-check`
    - en：`Rerun release-ready-check first`
    - vi：`Chay lai release-ready-check truoc`

### B) `sync-check`

字段（示例来源：release-ready-sync-latest）：
- `decision`
- `exitCode`
- `steps.releaseReady.ok`
- `steps.releaseReadyCheck.ok`
- `steps.releaseReadyLatest.ok`

状态映射：
- `check_pass`
  - 条件：`decision=="GO" && exitCode==0 && steps.*.ok 全为 true`
  - 第一步动作：
    - zh：`按窗口继续同步放行`
    - en：`Proceed with sync release in window`
    - vi：`Tiep tuc dong bo phat hanh theo cua so`
- `check_fail`
  - 条件：`decision=="NO-GO" || exitCode==1 || 任一 steps.*.ok==false`
  - 第一步动作：
    - zh：`先修复失败步骤再重跑`
    - en：`Fix failed step then rerun`
    - vi：`Sua buoc loi roi chay lai`
- `check_unknown`
  - 条件：`decision/exitCode 缺失或与 steps.*.ok 冲突`
  - 第一步动作：
    - zh：`先重跑 sync-check 并核对步骤位`
    - en：`Rerun sync-check and verify step flags`
    - vi：`Chay lai sync-check va doi chieu trang thai buoc`

### C) `brief-check`

字段（brief 投影）：
- `briefCheck.ok`
- `exitCode`
- `reasons[]`
- `advisories[]`

状态映射：
- `check_pass`
  - 条件：`briefCheck.ok==true && exitCode==0 && reasons.length==0`
  - 第一步动作：
    - zh：`继续值班播报`
    - en：`Continue duty broadcast`
    - vi：`Tiep tuc thong bao truc`
- `check_fail`
  - 条件：`briefCheck.ok==false || exitCode==1 || reasons.length>0`
  - 第一步动作：
    - zh：`先修复结构错误再重跑`
    - en：`Fix structure errors then rerun`
    - vi：`Sua loi cau truc roi chay lai`
- `check_unknown`
  - 条件：`briefCheck.ok/exitCode/reasons/advisories 缺失或冲突`
  - 第一步动作：
    - zh：`先重跑 brief-check 并复核字段`
    - en：`Rerun brief-check and verify fields`
    - vi：`Chay lai brief-check va kiem tra truong`

### D) `verify-gates-check`

字段（示例来源：verify-gates --json）：
- `overall`
- `passedCount`
- `totalCount`
- `gates[].ok`

状态映射：
- `check_pass`
  - 条件：`overall=="PASS" && passedCount==totalCount && all(gates[].ok==true)`
  - 第一步动作：
    - zh：`继续发布门禁流程`
    - en：`Continue gate-driven release flow`
    - vi：`Tiep tuc quy trinh phat hanh theo gate`
- `check_fail`
  - 条件：`overall=="FAIL" && exists(gates[].ok==false)`
  - 第一步动作：
    - zh：`先处理失败 gate 后重跑`
    - en：`Fix failed gates then rerun`
    - vi：`Xu ly gate loi roi chay lai`
- `check_unknown`
  - 条件：`overall/passedCount/totalCount/gates[].ok 缺失或取值异常`
  - 第一步动作：
    - zh：`先重跑 verify-gates --json`
    - en：`Rerun verify-gates --json first`
    - vi：`Chay lai verify-gates --json truoc`

## 3) 使用建议

- 前端先按家族选择字段，再按 `check_fail > check_unknown > check_pass` 优先级命中状态。
- 主句统一走本文件模板，子句与第一动作按家族状态填充，避免跨页面口径漂移。
