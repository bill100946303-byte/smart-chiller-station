# HVAC Release Ops Overview Copy v1

目标：将 `release-ready / consistency / latest-source` 三类信号收敛为统一值班总卡片文案（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `exitCode`
- `reasons[]`
- `source`
- `consistencyOk`
- `generatedAt`

推荐可信 `source` 值（白名单）：
- `live`
- `latest_file`
- `sync_latest`
- `canonical`
- `release_ready_latest`

## 2) 状态优先级

1. `blocked`
2. `review_required`
3. `ready`

## 3) 三态文案

### A) ready

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- 不满足 `review_required`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `consistencyOk == true`
- `source` 在白名单内
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `放行总览就绪` / 副句 `主信号一致` / 第一动作 `按窗口执行发布`
- en：Main `Release Ops Ready` / Sub `Core signals aligned` / First action `Release in window`
- vi：Cau chinh `Tong quan phat hanh san sang` / Cau phu `Tin hieu chinh da dong nhat` / Buoc 1 `Phat hanh theo cua so`

full：
- zh：主句 `Release Ops 总卡片：READY`；副句 `主决策为 GO，来源可信，一致性正常，当前可按标准流程推进发布。`
- en：Main `Release Ops Overview: READY`; Sub `Core decision is GO, source is trusted, and consistency is healthy, so release can proceed by standard flow.`
- vi：Cau chinh `Tong quan Release Ops: READY`; Cau phu `Quyet dinh chinh la GO, nguon tin cay va tinh nhat quan binh thuong, co the tiep tuc theo quy trinh chuan.`

firstAction：
- zh：`先确认发布窗口，再执行正式放行并同步值班结论。`
- en：`Confirm release window first, then execute formal release and sync the duty conclusion.`
- vi：`Xac nhan cua so phat hanh truoc, sau do phat hanh chinh thuc va dong bo ket luan truc.`

sourceSubcopy：
- zh：`source 正常且 generatedAt 存在，来源链路可用于当前值班判断。`
- en：`Source is valid and generatedAt is present, so the source chain is usable for duty judgment.`
- vi：`Source hop le va generatedAt ton tai, nen co the dung chuoi nguon cho phan doan truc.`

consistencySubcopy：
- zh：`consistencyOk=true，release-ready 与 consistency 口径未见冲突。`
- en：`consistencyOk=true, so release-ready and consistency signals are not conflicting.`
- vi：`consistencyOk=true, nen release-ready va tin hieu consistency khong xung dot.`

### B) blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `exitCode == 1`
- `reasons.length > 0`
- `consistencyOk == false`

mobileShort：
- zh：主句 `放行总览阻断` / 副句 `禁止直接发布` / 第一动作 `先处理阻断项`
- en：Main `Release Ops Blocked` / Sub `Do not release now` / First action `Handle blocker first`
- vi：Cau chinh `Tong quan phat hanh bi chan` / Cau phu `Khong duoc phat hanh luc nay` / Buoc 1 `Xu ly blocker truoc`

full：
- zh：主句 `Release Ops 总卡片：BLOCKED`；副句 `当前存在阻断信号，或一致性未通过，必须先停发再复核。`
- en：Main `Release Ops Overview: BLOCKED`; Sub `There is a blocking signal or failed consistency, so release must be held before review.`
- vi：Cau chinh `Tong quan Release Ops: BLOCKED`; Cau phu `Dang co tin hieu chan hoac consistency that bai, can tam dung phat hanh truoc khi ra soat.`

firstAction：
- zh：`先处理首个 reason 或一致性冲突，再重跑 latest-check 与 consistency 校验。`
- en：`Resolve the first reason or consistency conflict first, then rerun latest-check and consistency validation.`
- vi：`Xu ly reason dau tien hoac xung dot consistency truoc, sau do chay lai latest-check va kiem tra consistency.`

sourceSubcopy：
- zh：`即使 source 正常，阻断信号仍优先；若 source 异常，待阻断项清零后再补复核。`
- en：`Even with a normal source, blockers still take priority; if source is abnormal, review it after blockers are cleared.`
- vi：`Ngay ca khi source binh thuong, blocker van uu tien; neu source bat thuong, hay ra soat sau khi da xu ly blocker.`

consistencySubcopy：
- zh：`consistencyOk=false 时按高风险处理，禁止依据单一卡片直接对外放行。`
- en：`When consistencyOk=false, treat it as high risk and do not release based on a single card.`
- vi：`Khi consistencyOk=false, can xem la rui ro cao va khong duoc phat hanh chi dua tren mot the duy nhat.`

### C) review_required

触发条件（字段级，全部满足）：
- 不满足 `blocked`
- `decision == "GO"`
- `exitCode == 0`
- `reasons.length == 0`
- `consistencyOk == true`
- `source` 缺失或不在白名单内，或 `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `放行总览待复核` / 副句 `来源或时间待确认` / 第一动作 `先核对source`
- en：Main `Release Ops Review` / Sub `Source or timestamp needs review` / First action `Verify source first`
- vi：Cau chinh `Tong quan phat hanh can ra soat` / Cau phu `Can xac nhan nguon hoac moc thoi gian` / Buoc 1 `Kiem tra source truoc`

full：
- zh：主句 `Release Ops 总卡片：REVIEW_REQUIRED`；副句 `主决策为 GO 且一致性正常，但来源字段或时间戳不足以支持直接发布，需人工复核。`
- en：Main `Release Ops Overview: REVIEW_REQUIRED`; Sub `Core decision is GO and consistency is fine, but source field or timestamp is not strong enough for direct release.` 
- vi：Cau chinh `Tong quan Release Ops: REVIEW_REQUIRED`; Cau phu `Quyet dinh chinh la GO va consistency binh thuong, nhung truong nguon hoac moc thoi gian chua du de phat hanh truc tiep.`

firstAction：
- zh：`先核对 source 与 generatedAt，再决定是否进入正式放行。`
- en：`Verify source and generatedAt first, then decide whether to enter formal release.`
- vi：`Kiem tra source va generatedAt truoc, sau do moi quyet dinh co vao buoc phat hanh chinh thuc hay khong.`

sourceSubcopy：
- zh：`source 异常或 generatedAt 缺失更像证据不足，不等于系统故障。`
- en：`Abnormal source or missing generatedAt usually means insufficient evidence, not necessarily a system fault.`
- vi：`Source bat thuong hoac thieu generatedAt thuong la do bang chung chua du, khong nhat thiet la loi he thong.`

consistencySubcopy：
- zh：`consistencyOk=true 仅表示口径一致，不能替代 source/generatedAt 的复核。`
- en：`consistencyOk=true only means the signals agree; it does not replace source/generatedAt review.`
- vi：`consistencyOk=true chi co nghia la cac tin hieu dong nhat; no khong the thay the viec ra soat source/generatedAt.`

## 4) 使用建议

- 前端按 `blocked > review_required > ready` 固定优先级命中。
- `sourceSubcopy` 与 `consistencySubcopy` 可作为总卡片的两条辅助解释，不要反向覆盖主状态。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
