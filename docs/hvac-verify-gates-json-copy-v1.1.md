# HVAC Verify-Gates-JSON 三语播报文案 v1.1

目标：补 `verify-gates --json` 的三态值班文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `overall`
- `failedCount`
- `failedGates[]`

## 2) 三态文案

### A) all_pass

触发条件（字段级，全部满足）：
- `overall == "PASS"`
- `failedCount == 0`
- `failedGates.length == 0`

mobileShort：
- zh
  - 主句：`门禁全通过`
  - 副句：`失败项为0`
  - 第一动作：`进入放行确认`
- en
  - Main: `All Pass`
  - Sub: `Zero failed gates`
  - First action: `Start release confirmation`
- vi
  - Cau chinh: `Tat ca cong dat`
  - Cau phu: `Khong co gate loi`
  - Buoc 1: `Bat dau xac nhan phat hanh`

full：
- zh
  - 主句：`Verify-Gates 状态：ALL_PASS`
  - 副句：`总体为 PASS，且 failedGates 为空，可按标准流程推进。`
  - 第一动作：`按发布窗口执行下一步放行动作。`
- en
  - Main: `Verify-Gates Status: ALL_PASS`
  - Sub: `Overall is PASS with empty failedGates, ready to proceed by standard flow.`
  - First action: `Proceed to the next release step in the release window.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: ALL_PASS`
  - Cau phu: `Tong the la PASS va failedGates rong, co the tiep tuc theo quy trinh chuan.`
  - Buoc 1: `Tiep tuc buoc phat hanh tiep theo trong cua so phat hanh.`

### B) partial_fail

触发条件（字段级，全部满足）：
- `overall == "FAIL"`
- `failedCount > 0`
- 且满足任一：
  - `failedCount < 7`
  - `failedGates[]` 未覆盖以下全部 gate：
    - `acceptance-report`
    - `status-json`
    - `release-snapshot`
    - `release-snapshot-index`
    - `release-snapshot-diff`
    - `release-snapshot-consistency`
    - `release-ready-brief`

mobileShort：
- zh
  - 主句：`门禁部分失败`
  - 副句：`仅部分gate失败`
  - 第一动作：`先修失败gate`
- en
  - Main: `Partial Fail`
  - Sub: `Only some gates failed`
  - First action: `Fix failed gates first`
- vi
  - Cau chinh: `Cong loi mot phan`
  - Cau phu: `Chi mot so gate bi loi`
  - Buoc 1: `Sua gate loi truoc`

full：
- zh
  - 主句：`Verify-Gates 状态：PARTIAL_FAIL`
  - 副句：`总体为 FAIL，但失败 gate 非全量，属于部分失败。`
  - 第一动作：`优先处理 failedGates 首项，并按顺序清零失败列表后重跑。`
- en
  - Main: `Verify-Gates Status: PARTIAL_FAIL`
  - Sub: `Overall is FAIL, but not all gates failed, so this is a partial failure state.`
  - First action: `Fix the first failed gate, then clear failedGates one by one and rerun.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: PARTIAL_FAIL`
  - Cau phu: `Tong the la FAIL nhung khong phai tat ca gate deu loi, day la trang thai loi mot phan.`
  - Buoc 1: `Xu ly gate loi dau tien, giam failedGates tung muc roi chay lai.`

### C) all_fail

触发条件（字段级，全部满足）：
- `overall == "FAIL"`
- `failedCount == 7`
- `failedGates[]` 覆盖以下全部 gate：
  - `acceptance-report`
  - `status-json`
  - `release-snapshot`
  - `release-snapshot-index`
  - `release-snapshot-diff`
  - `release-snapshot-consistency`
  - `release-ready-brief`

mobileShort：
- zh
  - 主句：`门禁全失败`
  - 副句：`全部gate未通过`
  - 第一动作：`先停发并排障`
- en
  - Main: `All Fail`
  - Sub: `All gates failed`
  - First action: `Stop release and troubleshoot`
- vi
  - Cau chinh: `Tat ca cong loi`
  - Cau phu: `Tat ca gate deu that bai`
  - Buoc 1: `Dung phat hanh va xu ly su co`

full：
- zh
  - 主句：`Verify-Gates 状态：ALL_FAIL`
  - 副句：`总体为 FAIL，且 failedGates 覆盖全部 gate，当前不可放行。`
  - 第一动作：`立即停止放行，按 gate 顺序逐项恢复后再复测。`
- en
  - Main: `Verify-Gates Status: ALL_FAIL`
  - Sub: `Overall is FAIL and failedGates covers all gates, so release must be blocked now.`
  - First action: `Stop release immediately, recover gates one by one, then retest.`
- vi
  - Cau chinh: `Trang thai Verify-Gates: ALL_FAIL`
  - Cau phu: `Tong the la FAIL va failedGates bao phu tat ca gate, hien tai khong the phat hanh.`
  - Buoc 1: `Dung phat hanh ngay, khoi phuc tung gate roi kiem tra lai.`

## 3) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
