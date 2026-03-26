# HVAC Release Command Center Sync Copy v1

目标：为 `release-command-center-sync` 提供统一三语值班文案，强调“先同步，再看结论，再行动”。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `summaryClass`
- `reasons[]`
- `advisories[]`
- `generatedAt`

## 2) 状态优先级

1. `blocked_after_sync`
2. `review_required_after_sync`
3. `ready_after_sync`

## 3) 三态文案

### A) ready_after_sync

触发条件（字段级，全部满足）：
- 不满足 `blocked_after_sync`
- 不满足 `review_required_after_sync`
- `decision == "GO"`
- `summaryClass == "ready"`
- `reasons.length == 0`
- `advisories.length == 0`
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `同步后可放行` / 副句 `先同步后看结论` / 第一步动作 `按窗口执行发布`
- en：Main `Ready After Sync` / Sub `Sync first, then trust result` / First action `Release in window`
- vi：Cau chinh `San sang sau dong bo` / Cau phu `Dong bo truoc roi xem ket luan` / Buoc 1 `Phat hanh theo cua so`

full：
- zh：主句 `Command Center Sync 状态：READY_AFTER_SYNC`；副句 `同步完成后主结论为 ready，当前无阻断或提示项，可按标准节奏推进。`
- en：Main `Command Center Sync Status: READY_AFTER_SYNC`; Sub `After sync, the top-level conclusion is ready with no blockers or advisories, so standard flow can proceed.`
- vi：Cau chinh `Trang thai Command Center Sync: READY_AFTER_SYNC`; Cau phu `Sau dong bo, ket luan tong la ready va khong co blocker hay advisory, co the tiep tuc theo quy trinh chuan.`

syncSubcopy：
- zh：`同步层已完成本轮汇总，当前值班口径可先以同步结果为准。`
- en：`The sync layer has completed this round of aggregation, so duty judgment can start from the synced result.`
- vi：`Lop dong bo da hoan tat tong hop cho lan nay, vi vay co the bat dau phan doan truc tu ket qua dong bo.`

latestSubcopy：
- zh：`latest 层无需额外纠偏，当前可直接沿结论进入动作执行。`
- en：`The latest layer does not need extra correction, so operators can move directly from conclusion to action.`
- vi：`Lop latest khong can hieu chinh them, nen co the chuyen truc tiep tu ket luan sang hanh dong.`

firstAction：
- zh：`先确认 generatedAt 属于当前同步轮次，再执行正式放行并同步值班结论。`
- en：`Confirm generatedAt belongs to the current sync run first, then execute formal release and sync the duty conclusion.`
- vi：`Xac nhan generatedAt thuoc lan dong bo hien tai truoc, sau do phat hanh chinh thuc va dong bo ket luan truc.`

### B) blocked_after_sync

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `summaryClass == "blocked"`
- `reasons.length > 0`

mobileShort：
- zh：主句 `同步后阻断` / 副句 `先停发再排障` / 第一步动作 `先处理reason`
- en：Main `Blocked After Sync` / Sub `Hold release first` / First action `Handle first reason`
- vi：Cau chinh `Bi chan sau dong bo` / Cau phu `Tam dung phat hanh truoc` / Buoc 1 `Xu ly reason dau tien`

full：
- zh：主句 `Command Center Sync 状态：BLOCKED_AFTER_SYNC`；副句 `同步完成后仍存在阻断结论或阻断原因，当前应停止直接发布。`
- en：Main `Command Center Sync Status: BLOCKED_AFTER_SYNC`; Sub `Even after sync, blocking conclusion or reasons remain, so direct release should stop now.`
- vi：Cau chinh `Trang thai Command Center Sync: BLOCKED_AFTER_SYNC`; Cau phu `Ngay ca sau dong bo van con ket luan chan hoac ly do chan, nen phai dung phat hanh truc tiep luc nay.`

syncSubcopy：
- zh：`同步并未消除阻断，说明问题已进入总汇总层，需按正式阻断处理。`
- en：`Sync did not clear the blocker, which means the issue has reached the aggregated layer and must be treated as a formal block.`
- vi：`Dong bo khong xoa duoc blocker, dieu nay cho thay van de da len den lop tong hop va phai duoc xu ly nhu mot chan chinh thuc.`

latestSubcopy：
- zh：`latest 层仍提示不可放行，不要跳过总卡片直接按单点结果放行。`
- en：`The latest layer still says release is not allowed, so do not bypass the overview card based on a single point result.`
- vi：`Lop latest van cho thay khong duoc phat hanh, vi vay khong duoc bo qua the tong quan chi vi mot ket qua don le.`

firstAction：
- zh：`先处理 reasons 首项，再重跑 release-command-center-sync 确认阻断是否解除。`
- en：`Resolve the first item in reasons, then rerun release-command-center-sync to confirm whether the block is cleared.`
- vi：`Xu ly muc dau trong reasons, sau do chay lai release-command-center-sync de xac nhan blocker da duoc go hay chua.`

### C) review_required_after_sync

触发条件（字段级，全部满足）：
- 不满足 `blocked_after_sync`
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories.length > 0` 或 `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `同步后待复核` / 副句 `先同步再看提示` / 第一步动作 `先看advisory`
- en：Main `Review After Sync` / Sub `Sync first, then review hints` / First action `Check advisories first`
- vi：Cau chinh `Can ra soat sau dong bo` / Cau phu `Dong bo truoc roi xem canh bao` / Buoc 1 `Xem advisories truoc`

full：
- zh：主句 `Command Center Sync 状态：REVIEW_REQUIRED_AFTER_SYNC`；副句 `同步完成后主结论虽为 GO，但仍有提示项或时间证据不足，需人工复核。`
- en：Main `Command Center Sync Status: REVIEW_REQUIRED_AFTER_SYNC`; Sub `After sync, the top-level conclusion is GO, but advisories remain or time evidence is insufficient, so manual review is needed.`
- vi：Cau chinh `Trang thai Command Center Sync: REVIEW_REQUIRED_AFTER_SYNC`; Cau phu `Sau dong bo, ket luan tong la GO nhung van con advisory hoac bang chung thoi gian chua du, can ra soat thu cong.`

syncSubcopy：
- zh：`同步链路已跑通，但当前更适合把它视为“已汇总待复核”，而不是直接放行。`
- en：`The sync chain has completed, but the safer interpretation is aggregated-for-review rather than directly releasable.`
- vi：`Chuoi dong bo da chay xong, nhung cach hieu an toan hon la da tong hop de ra soat, khong phai de phat hanh ngay.`

latestSubcopy：
- zh：`latest 层提示仍需人工确认，不要把 GO 误读成可立即发布。`
- en：`The latest layer still requires human confirmation, so do not read GO as immediate release.`
- vi：`Lop latest van yeu cau xac nhan thu cong, vi vay khong duoc hieu GO la co the phat hanh ngay.`

firstAction：
- zh：`先核对 advisories 与 generatedAt，再决定是否进入正式放行。`
- en：`Verify advisories and generatedAt first, then decide whether to enter formal release.`
- vi：`Kiem tra advisories va generatedAt truoc, sau do moi quyet dinh co vao buoc phat hanh chinh thuc hay khong.`

## 4) 使用建议

- 值班顺序固定为：先看同步是否完成，再读 `summaryClass`，最后执行 `firstAction`。
- `blocked_after_sync` 一旦命中，应覆盖其余两态，不要让 ready/review 文案稀释阻断结论。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
