# HVAC Check-Family-Brief 值班文案 v1

目标：提供 `ready / blocked / review_required` 三态三语文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `overall`
- `failedCount`
- `freshness.state`
- `topFailedChecks[]`

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
- `failedCount == 0`
- `freshness.state == "fresh"`
- `topFailedChecks.length == 0`

mobileShort：
- zh：主句 `简报可放行` / 副句 `检查与时效正常` / 第一动作 `按窗口执行发布`
- en：Main `Brief Ready` / Sub `Checks and freshness normal` / First action `Release in window`
- vi：Cau chinh `Brief san sang` / Cau phu `Kiem tra va do tuoi binh thuong` / Buoc 1 `Phat hanh theo cua so`

full：
- zh：主句 `Check-Family-Brief 状态：READY`；副句 `总体通过且无失败项，freshness 为 fresh，可按标准流程推进。`；第一动作 `先确认发布窗口，再执行放行。`
- en：Main `Check-Family-Brief Status: READY`; Sub `Overall passed with zero failures and freshness is fresh, ready for standard flow.`; First action `Confirm release window first, then execute release.`
- vi：Cau chinh `Trang thai Check-Family-Brief: READY`; Cau phu `Tong the dat, khong co muc loi va freshness la fresh, co the theo quy trinh chuan.`; Buoc 1 `Xac nhan cua so phat hanh truoc, sau do phat hanh.`

### B) blocked

触发条件（字段级，全部满足）：
- `overall == "FAIL"`
- `failedCount > 0`
- `freshness.state != "stale"`
- `topFailedChecks.length > 0`

mobileShort：
- zh：主句 `简报阻断` / 副句 `存在失败检查` / 第一动作 `先修首个失败项`
- en：Main `Brief Blocked` / Sub `Failed checks present` / First action `Fix first failed check`
- vi：Cau chinh `Brief bi chan` / Cau phu `Co muc kiem tra that bai` / Buoc 1 `Sua muc loi dau tien`

full：
- zh：主句 `Check-Family-Brief 状态：BLOCKED`；副句 `当前存在明确失败项，发布应保持阻断。`；第一动作 `优先处理 topFailedChecks 首项，修复后重跑 check-family。`
- en：Main `Check-Family-Brief Status: BLOCKED`; Sub `There are explicit failed checks, so release must remain blocked.`; First action `Fix the first item in topFailedChecks, then rerun check-family.`
- vi：Cau chinh `Trang thai Check-Family-Brief: BLOCKED`; Cau phu `Dang co muc that bai ro rang, can tiep tuc chan phat hanh.`; Buoc 1 `Xu ly muc dau trong topFailedChecks, sau do chay lai check-family.`

### C) review_required

触发条件（字段级，任一满足）：
- `freshness.state == "stale"`
- `overall == "PASS" && failedCount == 0 && freshness.state == "warn"`
- `overall == "FAIL" && failedCount > 0 && topFailedChecks.length == 0`

mobileShort：
- zh：主句 `简报待复核` / 副句 `时效或摘要需确认` / 第一动作 `先重跑check-family`
- en：Main `Brief Review` / Sub `Freshness or summary needs review` / First action `Rerun check-family first`
- vi：Cau chinh `Brief can ra soat` / Cau phu `Can xac nhan do tuoi hoac tom tat` / Buoc 1 `Chay lai check-family truoc`

full：
- zh：主句 `Check-Family-Brief 状态：REVIEW_REQUIRED`；副句 `当前结果需复核后再判定发布，尤其 stale 场景不应直接放行或拦截。`；第一动作 `先重跑 check-family，刷新后再依据最新结果决定是否发布。`
- en：Main `Check-Family-Brief Status: REVIEW_REQUIRED`; Sub `Current result needs manual review before release decision, especially in stale scenarios.`; First action `Rerun check-family first, then decide release using refreshed output.`
- vi：Cau chinh `Trang thai Check-Family-Brief: REVIEW_REQUIRED`; Cau phu `Can ra soat thu cong truoc khi quyet dinh phat hanh, dac biet voi truong hop stale.`; Buoc 1 `Chay lai check-family truoc, sau do moi quyet dinh phat hanh theo ket qua moi.`

## 4) Stale 专项提醒（防误读）

触发条件（字段级）：
- `freshness.state == "stale"`

提醒文案：
- zh：`freshness=stale 表示结果时效不足，不等于系统故障；先重跑 check-family，再决定是否发布。`
- en：`freshness=stale means stale evidence, not necessarily a system fault; rerun check-family first, then decide release.`
- vi：`freshness=stale co nghia la bang chung da cu, khong dong nghia loi he thong; hay chay lai check-family truoc, roi moi quyet dinh phat hanh.`

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
