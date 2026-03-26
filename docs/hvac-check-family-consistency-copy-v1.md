# HVAC Check-Family Consistency 值班文案 v1

目标：提供 consistency 三态三语值班文案，用于“禁止误发”（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段（family/brief 双侧）：
- `overall`
- `passedCount`
- `totalCount`
- `failedCount`
- `topFailedChecks[]`

## 2) 状态优先级

1. `family_fail_brief_pass`
2. `family_pass_brief_fail`
3. `consistent_pass`

## 3) 三态文案

### A) consistent_pass

触发条件（字段级，全部满足）：
- `family.overall == "PASS"`
- `brief.overall == "PASS"`
- `family.passedCount == family.totalCount`
- `brief.passedCount == family.passedCount`
- `brief.totalCount == family.totalCount`
- `brief.failedCount == 0`
- `brief.topFailedChecks.length == 0`

mobileShort：
- zh：主句 `口径一致通过` / 副句 `可按流程播报` / 第一动作 `继续发布确认`
- en：Main `Consistency Pass` / Sub `Safe to report` / First action `Continue release confirmation`
- vi：Cau chinh `Nhat quan da dat` / Cau phu `Co the thong bao` / Buoc 1 `Tiep tuc xac nhan phat hanh`

full：
- zh：主句 `Consistency 状态：CONSISTENT_PASS`；副句 `family 与 brief 关键计数一致且均为通过态，可按标准节奏对外播报。`；第一动作 `先记录本轮一致性结果，再进入后续放行步骤。`
- en：Main `Consistency Status: CONSISTENT_PASS`; Sub `Family and brief are aligned on key counts and both pass, safe for standard external reporting.`; First action `Log this consistency result first, then continue release steps.`
- vi：Cau chinh `Trang thai Consistency: CONSISTENT_PASS`; Cau phu `Family va brief dong nhat ve chi so chinh va deu pass, co the thong bao theo quy trinh chuan.`; Buoc 1 `Ghi nhan ket qua nhat quan truoc, sau do tiep tuc buoc phat hanh.`

### B) family_pass_brief_fail

触发条件（字段级，全部满足）：
- `family.overall == "PASS"`
- `family.passedCount == family.totalCount`
- `brief.overall == "FAIL"`
- `brief.failedCount > 0`
- `brief.topFailedChecks.length > 0`

mobileShort：
- zh：主句 `简报误阻断` / 副句 `family已通过` / 第一动作 `暂停外发先复核`
- en：Main `Brief False Block` / Sub `Family already pass` / First action `Hold external send and review`
- vi：Cau chinh `Brief chan sai` / Cau phu `Family da pass` / Buoc 1 `Tam dung gui ngoai va ra soat`

full：
- zh：主句 `Consistency 状态：FAMILY_PASS_BRIEF_FAIL`；副句 `family 显示通过但 brief 显示失败，属于口径冲突，禁止按 brief 直接外发。`；第一动作 `先重跑 check-family 与 check-family-brief，再按最新一致结果决定播报。`
- en：Main `Consistency Status: FAMILY_PASS_BRIEF_FAIL`; Sub `Family passes while brief fails. This is a consistency conflict and must not be externally sent as final.`; First action `Rerun check-family and check-family-brief first, then decide by refreshed aligned results.`
- vi：Cau chinh `Trang thai Consistency: FAMILY_PASS_BRIEF_FAIL`; Cau phu `Family pass nhung brief fail. Day la xung dot nhat quan, khong duoc gui ra ngoai theo brief.`; Buoc 1 `Chay lai check-family va check-family-brief truoc, sau do moi quyet dinh theo ket qua dong nhat moi.`

### C) family_fail_brief_pass

触发条件（字段级，全部满足）：
- `family.overall == "FAIL"`
- `family.passedCount < family.totalCount`
- `brief.overall == "PASS"`
- `brief.failedCount == 0`
- `brief.topFailedChecks.length == 0`

mobileShort：
- zh：主句 `疑似误放行` / 副句 `family失败brief通过` / 第一动作 `立即禁止外发`
- en：Main `Possible False GO` / Sub `Family fail brief pass` / First action `Block external release now`
- vi：Cau chinh `Nghi ngo cho phep sai` / Cau phu `Family fail brief pass` / Buoc 1 `Chan phat hanh ra ngoai ngay`

full：
- zh：主句 `Consistency 状态：FAMILY_FAIL_BRIEF_PASS`；副句 `family 已失败但 brief 显示通过，存在误发高风险，必须立即阻断。`；第一动作 `立即停止对外放行口播，重跑双文件校验并修复 topFailedChecks 映射后再评估。`
- en：Main `Consistency Status: FAMILY_FAIL_BRIEF_PASS`; Sub `Family fails but brief shows pass. This is high-risk for false release and must be blocked immediately.`; First action `Stop external release messaging now, rerun dual checks, then reassess after topFailedChecks mapping is corrected.`
- vi：Cau chinh `Trang thai Consistency: FAMILY_FAIL_BRIEF_PASS`; Cau phu `Family that bai nhung brief bao pass. Rui ro phat hanh sai cao, phai chan ngay.`; Buoc 1 `Dung thong bao phat hanh ra ngoai ngay, chay lai kiem tra hai file va sua anh xa topFailedChecks truoc khi danh gia lai.`

## 4) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
