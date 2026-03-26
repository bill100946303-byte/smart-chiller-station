# HVAC Release Command Center Latest Copy v1

目标：为 `release-command-center-latest` 提供统一三语值班文案，强调“先看结论，再看变化，再行动”。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `summaryClass`
- `reasons[]`
- `advisories[]`
- `generatedAt`

## 2) 状态优先级

1. `risk_up_blocked`
2. `review_required`
3. `stable_ready`

## 3) 三态文案

### A) stable_ready

触发条件（字段级，全部满足）：
- 不满足 `risk_up_blocked`
- 不满足 `review_required`
- `decision == "GO"`
- `summaryClass == "ready"`
- `reasons.length == 0`
- `advisories.length == 0`
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `总控已就绪` / 副句 `先看结论可放行` / 第一动作 `按窗口执行发布`
- en：Main `Center Ready` / Sub `Conclusion says release` / First action `Release in window`
- vi：Cau chinh `Trung tam da san sang` / Cau phu `Ket luan cho phep phat hanh` / Buoc 1 `Phat hanh theo cua so`

full：
- zh：主句 `Command Center 状态：STABLE_READY`；副句 `当前主结论为 ready，阻断与提示项均为空，可按标准节奏推进。`
- en：Main `Command Center Status: STABLE_READY`; Sub `Current top-level conclusion is ready, with no blockers or advisories, so standard release flow can proceed.`
- vi：Cau chinh `Trang thai Command Center: STABLE_READY`; Cau phu `Ket luan tong la ready, khong co blocker hay advisory, co the tiep tuc theo quy trinh chuan.`

diffSubcopy：
- zh：`变化层按 stable 解读：先确认本轮无新增风险，再进入动作执行。`
- en：`Read the change layer as stable: confirm no new risk was introduced before taking action.`
- vi：`Doc lop thay doi la stable: xac nhan khong co rui ro moi truoc khi hanh dong.`

firstAction：
- zh：`先确认 generatedAt 为当前轮次，再执行正式放行并同步值班结论。`
- en：`Confirm generatedAt belongs to the current run first, then execute formal release and sync the duty conclusion.`
- vi：`Xac nhan generatedAt thuoc dung lan chay hien tai truoc, sau do phat hanh chinh thuc va dong bo ket luan truc.`

### B) risk_up_blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `summaryClass == "blocked"`
- `reasons.length > 0`

mobileShort：
- zh：主句 `总控阻断` / 副句 `先看结论禁发` / 第一动作 `先处理reason`
- en：Main `Center Blocked` / Sub `Conclusion says hold` / First action `Handle first reason`
- vi：Cau chinh `Trung tam bi chan` / Cau phu `Ket luan yeu cau tam dung` / Buoc 1 `Xu ly reason dau tien`

full：
- zh：主句 `Command Center 状态：RISK_UP_BLOCKED`；副句 `当前主结论为 blocked 或已出现阻断原因，值班上应按风险上升处理，禁止直接发布。`
- en：Main `Command Center Status: RISK_UP_BLOCKED`; Sub `Top-level conclusion is blocked or blocking reasons are present, so operators should treat this as risk-up and stop direct release.`
- vi：Cau chinh `Trang thai Command Center: RISK_UP_BLOCKED`; Cau phu `Ket luan tong la blocked hoac da co ly do chan, nen can xem day la rui ro tang va dung phat hanh truc tiep.`

diffSubcopy：
- zh：`变化层按 risk_up 解读：先看新增阻断，再决定修复顺序。`
- en：`Read the change layer as risk_up: review newly surfaced blockers before choosing the fix order.`
- vi：`Doc lop thay doi la risk_up: xem cac blocker moi xuat hien truoc khi chon thu tu sua loi.`

firstAction：
- zh：`先处理 reasons 首项，再重跑 release-command-center-latest 确认是否回落。`
- en：`Resolve the first item in reasons, then rerun release-command-center-latest to verify whether the risk has dropped.`
- vi：`Xu ly muc dau trong reasons, sau do chay lai release-command-center-latest de xac nhan rui ro da giam hay chua.`

### C) review_required

触发条件（字段级，全部满足）：
- 不满足 `risk_up_blocked`
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories.length > 0` 或 `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `总控待复核` / 副句 `先看结论再审变化` / 第一动作 `先看advisory`
- en：Main `Center Review` / Sub `Review before release` / First action `Check advisories first`
- vi：Cau chinh `Trung tam can ra soat` / Cau phu `Ra soat truoc khi phat hanh` / Buoc 1 `Xem advisories truoc`

full：
- zh：主句 `Command Center 状态：REVIEW_REQUIRED`；副句 `当前主结论为 GO，但仍有提示项或时间证据不足，需人工复核后再决定动作。`
- en：Main `Command Center Status: REVIEW_REQUIRED`; Sub `Top-level conclusion is GO, but advisories remain or time evidence is insufficient, so manual review is required before action.`
- vi：Cau chinh `Trang thai Command Center: REVIEW_REQUIRED`; Cau phu `Ket luan tong la GO nhung van con advisory hoac bang chung thoi gian chua du, can ra soat thu cong truoc khi hanh dong.`

diffSubcopy：
- zh：`变化层按 review 解读：先看变化提示，再决定是否继续发布。`
- en：`Read the change layer as review: inspect change hints first, then decide whether release should continue.`
- vi：`Doc lop thay doi theo huong review: xem cac goi y thay doi truoc, sau do moi quyet dinh co tiep tuc phat hanh hay khong.`

firstAction：
- zh：`先核对 advisories 与 generatedAt，再决定是否进入正式放行。`
- en：`Verify advisories and generatedAt first, then decide whether to enter formal release.`
- vi：`Kiem tra advisories va generatedAt truoc, sau do moi quyet dinh co vao buoc phat hanh chinh thuc hay khong.`

## 4) 使用建议

- 值班顺序固定为：先读 `summaryClass`，再读 `diffSubcopy`，最后执行 `firstAction`。
- `risk_up_blocked` 一旦命中，不要让 `review_required` 或 `stable_ready` 的子文案覆盖主结论。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
