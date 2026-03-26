# HVAC Release-Ready-Sync-Check 三语口播模板 v1

目标：为 `release-ready-sync` 校验态输出 `check_pass / check_fail / check_unknown` 三类三语口播。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

仅使用以下字段：
- `steps.releaseReady.ok`
- `steps.releaseReadyCheck.ok`
- `steps.releaseReadyLatest.ok`
- `decision`
- `exitCode`

## 2) 匹配顺序（建议）

1. `check_fail`
2. `check_unknown`
3. `check_pass`

## 3) 三类文案与触发条件

### A) check_pass

触发条件（字段级，全部满足）：
- `steps.releaseReady.ok == true`
- `steps.releaseReadyCheck.ok == true`
- `steps.releaseReadyLatest.ok == true`
- `decision == "GO"`
- `exitCode == 0`

mobileShort：
- zh
  - 主句：`校验通过`
  - 副句：`三步均成功`
  - 第一步动作：`按窗口继续放行`
- en
  - Main: `Check Pass`
  - Sub: `All three steps passed`
  - First step: `Proceed in release window`
- vi
  - Cau chinh: `Kiem tra dat`
  - Cau phu: `Ca 3 buoc deu thanh cong`
  - Buoc 1: `Tiep tuc trong cua so phat hanh`

full：
- zh
  - 主句：`同步校验状态：PASS`
  - 副句：`releaseReady / releaseReadyCheck / releaseReadyLatest 全部通过，当前可继续放行流程。`
  - 第一步动作：`先执行发布窗口确认，再按标准步骤发布。`
- en
  - Main: `Sync-Check Status: PASS`
  - Sub: `releaseReady, releaseReadyCheck, and releaseReadyLatest all passed, so release flow can continue.`
  - First step: `Run release-window confirmation first, then follow standard release steps.`
- vi
  - Cau chinh: `Trang thai sync-check: PASS`
  - Cau phu: `releaseReady, releaseReadyCheck va releaseReadyLatest deu dat, co the tiep tuc quy trinh phat hanh.`
  - Buoc 1: `Xac nhan cua so phat hanh truoc, sau do lam theo cac buoc phat hanh chuan.`

### B) check_fail

触发条件（字段级，任一满足）：
- `steps.releaseReady.ok == false`
- `steps.releaseReadyCheck.ok == false`
- `steps.releaseReadyLatest.ok == false`
- `decision == "NO-GO"`
- `exitCode == 1`

mobileShort：
- zh
  - 主句：`校验失败`
  - 副句：`至少一步失败`
  - 第一步动作：`先定位失败步骤`
- en
  - Main: `Check Fail`
  - Sub: `At least one step failed`
  - First step: `Locate failed step first`
- vi
  - Cau chinh: `Kiem tra that bai`
  - Cau phu: `It nhat mot buoc that bai`
  - Buoc 1: `Xac dinh buoc loi truoc`

full：
- zh
  - 主句：`同步校验状态：FAIL`
  - 副句：`至少一个步骤失败或主结论为 NO-GO，当前禁止放行。`
  - 第一步动作：`先处理失败步骤（steps.*.ok=false）对应问题，再重跑 sync-check。`
- en
  - Main: `Sync-Check Status: FAIL`
  - Sub: `At least one step failed or decision is NO-GO, so release must be blocked now.`
  - First step: `Fix the issue of the failed step (steps.*.ok=false), then rerun sync-check.`
- vi
  - Cau chinh: `Trang thai sync-check: FAIL`
  - Cau phu: `Co it nhat mot buoc loi hoac decision la NO-GO, tam thoi phai chan phat hanh.`
  - Buoc 1: `Xu ly loi o buoc that bai (steps.*.ok=false), sau do chay lai sync-check.`

### C) check_unknown

触发条件（字段级，任一满足）：
- `decision` 缺失或不在 `{"GO","NO-GO"}` 中
- `exitCode` 缺失或不在 `{0,1}` 中
- 任一 `steps.*.ok` 缺失或非布尔
- `decision == "GO" && exitCode == 1`
- `decision == "NO-GO" && exitCode == 0`
- `decision == "GO"` 但任一 `steps.*.ok == false`
- `decision == "NO-GO"` 且三项 `steps.*.ok == true` 且 `exitCode == 0`

mobileShort：
- zh
  - 主句：`校验状态未知`
  - 副句：`字段或状态冲突`
  - 第一步动作：`先重跑sync-check`
- en
  - Main: `Check Unknown`
  - Sub: `Field/state conflict`
  - First step: `Rerun sync-check first`
- vi
  - Cau chinh: `Kiem tra chua ro`
  - Cau phu: `Xung dot truong/trang thai`
  - Buoc 1: `Chay lai sync-check truoc`

full：
- zh
  - 主句：`同步校验状态：UNKNOWN`
  - 副句：`字段缺失、取值非法或步骤状态与决策不一致，当前结果不可直接用于放行。`
  - 第一步动作：`先重跑 release-ready-sync --json 生成完整结果，再重新判定。`
- en
  - Main: `Sync-Check Status: UNKNOWN`
  - Sub: `Missing/invalid fields or mismatch between step states and decision make this result unusable for release.`
  - First step: `Rerun release-ready-sync --json to regenerate a complete result, then re-evaluate.`
- vi
  - Cau chinh: `Trang thai sync-check: UNKNOWN`
  - Cau phu: `Thieu/sai truong hoac khong khop giua trang thai buoc va decision, ket qua nay khong the dung truc tiep de phat hanh.`
  - Buoc 1: `Chay lai release-ready-sync --json de tao ket qua day du, sau do danh gia lai.`

## 4) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
