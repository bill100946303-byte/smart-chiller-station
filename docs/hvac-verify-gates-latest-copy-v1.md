# HVAC Verify-Gates-Latest 三语播报文案 v1

目标：补 `verify-gates-latest` 三态值班播报文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `overall`
- `failedCount`
- `failedGates[]`
- `generatedAt`

## 2) 三态文案

### A) latest_ok

触发条件（字段级，全部满足）：
- `overall == "PASS"`
- `failedCount == 0`
- `failedGates.length == 0`
- `generatedAt` 存在且非空
- `generatedAt != "unknown"`

mobileShort：
- zh
  - 主句：`最新门禁正常`
  - 副句：`失败项为0`
  - 第一动作：`进入放行确认`
- en
  - Main: `Latest OK`
  - Sub: `Zero failed gates`
  - First action: `Start release confirmation`
- vi
  - Cau chinh: `Cong moi nhat binh thuong`
  - Cau phu: `So gate loi bang 0`
  - Buoc 1: `Bat dau xac nhan phat hanh`

full：
- zh
  - 主句：`Verify-Gates-Latest 状态：LATEST_OK`
  - 副句：`最新门禁整体为 PASS，且 failedGates 为空，可继续发布流程。`
  - 第一动作：`按发布窗口推进下一步放行动作。`
- en
  - Main: `Verify-Gates-Latest Status: LATEST_OK`
  - Sub: `Latest gate result is PASS with empty failedGates, ready to continue release flow.`
  - First action: `Proceed to the next release action in the release window.`
- vi
  - Cau chinh: `Trang thai Verify-Gates-Latest: LATEST_OK`
  - Cau phu: `Ket qua gate moi nhat la PASS va failedGates rong, co the tiep tuc quy trinh phat hanh.`
  - Buoc 1: `Tiep tuc buoc phat hanh tiep theo trong cua so phat hanh.`

### B) latest_warn

触发条件（字段级，全部满足）：
- 不满足 `latest_fail`
- 且满足任一：
  - `generatedAt` 缺失或为空
  - `generatedAt == "unknown"`
  - `overall` 不在 `{"PASS","FAIL"}`

mobileShort：
- zh
  - 主句：`最新门禁告警`
  - 副句：`时间或状态待核`
  - 第一动作：`先刷新latest`
- en
  - Main: `Latest Warn`
  - Sub: `Time/state needs review`
  - First action: `Refresh latest first`
- vi
  - Cau chinh: `Canh bao gate moi`
  - Cau phu: `Can xem lai thoi gian/trang thai`
  - Buoc 1: `Lam moi latest truoc`

full：
- zh
  - 主句：`Verify-Gates-Latest 状态：LATEST_WARN`
  - 副句：`当前无明确失败项，但 `generatedAt` 或 `overall` 存在可疑值，需复核。`
  - 第一动作：`先重跑 verify-gates --json 刷新 latest，再做放行判断。`
- en
  - Main: `Verify-Gates-Latest Status: LATEST_WARN`
  - Sub: `No explicit gate failure, but generatedAt or overall is suspicious and needs review.`
  - First action: `Rerun verify-gates --json to refresh latest before release judgment.`
- vi
  - Cau chinh: `Trang thai Verify-Gates-Latest: LATEST_WARN`
  - Cau phu: `Khong co loi gate ro rang, nhung generatedAt hoac overall dang nghi ngo va can ra soat.`
  - Buoc 1: `Chay lai verify-gates --json de lam moi latest truoc khi phan quyet phat hanh.`

### C) latest_fail

触发条件（字段级，任一满足）：
- `overall == "FAIL"`
- `failedCount > 0`
- `failedGates.length > 0`

mobileShort：
- zh
  - 主句：`最新门禁失败`
  - 副句：`存在失败gate`
  - 第一动作：`先修复failedGates`
- en
  - Main: `Latest Fail`
  - Sub: `Failed gates detected`
  - First action: `Fix failedGates first`
- vi
  - Cau chinh: `Gate moi nhat that bai`
  - Cau phu: `Phat hien gate loi`
  - Buoc 1: `Sua failedGates truoc`

full：
- zh
  - 主句：`Verify-Gates-Latest 状态：LATEST_FAIL`
  - 副句：`最新门禁存在失败项，当前不可放行。`
  - 第一动作：`优先处理 failedGates 首项，清零失败后再重跑。`
- en
  - Main: `Verify-Gates-Latest Status: LATEST_FAIL`
  - Sub: `Latest gate result contains failures, so release is blocked now.`
  - First action: `Fix the first item in failedGates and rerun after failures are cleared.`
- vi
  - Cau chinh: `Trang thai Verify-Gates-Latest: LATEST_FAIL`
  - Cau phu: `Ket qua gate moi nhat co loi, hien tai khong the phat hanh.`
  - Buoc 1: `Xu ly muc dau trong failedGates va chay lai sau khi da xoa loi.`

## 3) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
