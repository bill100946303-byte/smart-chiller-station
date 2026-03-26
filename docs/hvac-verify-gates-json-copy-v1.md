# HVAC Verify-Gates-JSON 三语值班文案 v1

目标：为 `verify-gates --json` 输出提供三态值班播报文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `overall`
- `passedCount`
- `totalCount`
- `gates[].ok`

## 2) 三态与触发条件

### A) all_pass

触发条件（字段级，全部满足）：
- `overall == "PASS"`
- `passedCount == totalCount`
- `passedCount > 0`
- `all(gates[].ok == true)`

mobileShort：
- zh
  - 主句：`门禁全通过`
  - 副句：`全部校验成功`
  - 第一动作：`进入放行确认`
- en
  - Main: `All Pass`
  - Sub: `All checks succeeded`
  - First action: `Start release confirmation`
- vi
  - Cau chinh: `Tat ca cong dat`
  - Cau phu: `Moi kiem tra deu thanh cong`
  - Buoc 1: `Bat dau xac nhan phat hanh`

full：
- zh
  - 主句：`Verify-Gates 状态：ALL_PASS`
  - 副句：`门禁总结果为 PASS，且所有 gate 均通过。`
  - 第一动作：`按发布窗口执行下一步放行流程。`
- en
  - Main: `Verify-Gates Status: ALL_PASS`
  - Sub: `Overall result is PASS and every gate is passed.`
  - First action: `Proceed to the next release step in the release window.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: ALL_PASS`
  - Cau phu: `Ket qua tong la PASS va moi gate deu dat.`
  - Buoc 1: `Tiep tuc buoc phat hanh tiep theo trong cua so phat hanh.`

### B) partial_fail

触发条件（字段级，全部满足）：
- `overall == "FAIL"`
- `passedCount > 0`
- `passedCount < totalCount`
- `exists(gates[].ok == false)`
- `exists(gates[].ok == true)`

mobileShort：
- zh
  - 主句：`门禁部分失败`
  - 副句：`通过与失败并存`
  - 第一动作：`先修失败gate`
- en
  - Main: `Partial Fail`
  - Sub: `Passed and failed mixed`
  - First action: `Fix failed gates first`
- vi
  - Cau chinh: `Cong loi mot phan`
  - Cau phu: `Vua dat vua loi`
  - Buoc 1: `Sua gate loi truoc`

full：
- zh
  - 主句：`Verify-Gates 状态：PARTIAL_FAIL`
  - 副句：`总结果为 FAIL，当前存在部分 gate 通过、部分 gate 失败。`
  - 第一动作：先定位 `gates[].ok=false` 的项并修复，再重跑 verify-gates。
- en
  - Main: `Verify-Gates Status: PARTIAL_FAIL`
  - Sub: `Overall is FAIL with a mix of passed and failed gates.`
  - First action: `Fix items where gates[].ok=false, then rerun verify-gates.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: PARTIAL_FAIL`
  - Cau phu: `Tong the la FAIL, co gate dat va gate loi dong thoi.`
  - Buoc 1: `Xu ly cac muc gates[].ok=false truoc, sau do chay lai verify-gates.`

### C) all_fail

触发条件（字段级，全部满足）：
- `overall == "FAIL"`
- `passedCount == 0`
- `totalCount > 0`
- `all(gates[].ok == false)`

mobileShort：
- zh
  - 主句：`门禁全失败`
  - 副句：`暂无可放行条件`
  - 第一动作：`先停发并排障`
- en
  - Main: `All Fail`
  - Sub: `No release condition met`
  - First action: `Stop release and troubleshoot`
- vi
  - Cau chinh: `Tat ca cong loi`
  - Cau phu: `Chua dat dieu kien phat hanh`
  - Buoc 1: `Dung phat hanh va xu ly su co`

full：
- zh
  - 主句：`Verify-Gates 状态：ALL_FAIL`
  - 副句：`总结果为 FAIL，且所有 gate 均未通过。`
  - 第一动作：`立即停止放行，按 gate 顺序逐项恢复后再重跑。`
- en
  - Main: `Verify-Gates Status: ALL_FAIL`
  - Sub: `Overall is FAIL and all gates are failing.`
  - First action: `Stop release immediately and recover gates one by one before rerun.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: ALL_FAIL`
  - Cau phu: `Tong the la FAIL va tat ca gate deu loi.`
  - Buoc 1: `Dung phat hanh ngay, khoi phuc tung gate roi chay lai.`

## 3) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
