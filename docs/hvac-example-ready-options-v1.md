# HVAC Example Ready Options v1

目标：为 `example_not_ready` 提供 3 套三语值班候选话术，供主控决定最终采用哪一种口径（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `summaryClass`
- `reasons[]`
- `advisories[]`
- `generatedAt`

## 2) 适用背景

三套候选话术基于同一现态场景整理：
- `decision == "GO"`
- `reasons.length == 0`
- `advisories[] contains "example_not_ready"`
- `generatedAt` 存在且非空

区别不在运行态事实，而在主控希望如何解释 `example_not_ready`：
- 继续保留为 `review_required`
- 降级为注记
- 从 runtime release 口径中移除

## 3) 三套候选话术

### A) keep_as_review_required

触发条件（字段级，全部满足）：
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories[] contains "example_not_ready"`
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `保留待复核` / 副句 `example仍提示`
- en：Main `Keep Review` / Sub `Example still advises`
- vi：Cau chinh `Giu o muc can ra soat` / Cau phu `Example van con nhac`

full：
- zh：主句 `候选口径：KEEP_AS_REVIEW_REQUIRED`；副句 `继续把 example_not_ready 视为非阻断但需复核的提示，整体口径仍保持 review_required。`
- en：Main `Candidate Policy: KEEP_AS_REVIEW_REQUIRED`; Sub `Continue treating example_not_ready as a non-blocking but review-required hint, so the overall wording remains review_required.`
- vi：Cau chinh `Chinh sach de xuat: KEEP_AS_REVIEW_REQUIRED`; Cau phu `Tiep tuc xem example_not_ready la mot nhac nho khong chan nhung can ra soat, vi vay cach noi tong the van la review_required.`

firstAction：
- zh：`先沿用 review_required 口径值班播报，同时备注仅剩 example_not_ready。`
- en：`Continue duty messaging with the review_required wording first, while noting that only example_not_ready remains.`
- vi：`Truoc mat tiep tuc thong bao truc theo cach noi review_required, dong thoi ghi chu rang chi con example_not_ready.`

### B) downgrade_to_note

触发条件（字段级，全部满足）：
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories[] contains "example_not_ready"`
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `降为注记` / 副句 `结论仍可推进`
- en：Main `Downgrade to Note` / Sub `Conclusion can proceed`
- vi：Cau chinh `Ha xuong muc ghi chu` / Cau phu `Ket luan van co the tiep tuc`

full：
- zh：主句 `候选口径：DOWNGRADE_TO_NOTE`；副句 `把 example_not_ready 从复核主结论降为补充注记，主结论仍以 GO/可推进为主。`
- en：Main `Candidate Policy: DOWNGRADE_TO_NOTE`; Sub `Downgrade example_not_ready from the main review conclusion to a supporting note, while keeping GO/proceed as the main message.`
- vi：Cau chinh `Chinh sach de xuat: DOWNGRADE_TO_NOTE`; Cau phu `Ha example_not_ready tu ket luan review chinh xuong thanh ghi chu bo sung, trong khi van giu GO/co the tiep tuc la thong diep chinh.`

firstAction：
- zh：`先用“可推进 + 附注 example_not_ready”方式播报，再观察是否还需保留 review_required 标签。`
- en：`Use “can proceed + example_not_ready note” first, then observe whether the review_required label still needs to stay.`
- vi：`Truoc mat thong bao theo cach “co the tiep tuc + ghi chu example_not_ready”, sau do quan sat xem co can giu nhan review_required hay khong.`

### C) remove_from_runtime_release

触发条件（字段级，全部满足）：
- `decision == "GO"`
- `reasons.length == 0`
- `advisories[] contains "example_not_ready"`
- `generatedAt` 存在且非空

说明：
- 此选项用于主控评估“是否不再把 example_not_ready 视作 runtime release 口径的一部分”。

mobileShort：
- zh：主句 `移出口径` / 副句 `runtime不再背此提示`
- en：Main `Remove from Runtime` / Sub `Runtime stops carrying it`
- vi：Cau chinh `Loai khoi runtime` / Cau phu `Runtime khong con mang nhac nay`

full：
- zh：主句 `候选口径：REMOVE_FROM_RUNTIME_RELEASE`；副句 `把 example_not_ready 从 runtime release 解释层移除，避免它继续把当前 GO 态表述成待复核。`
- en：Main `Candidate Policy: REMOVE_FROM_RUNTIME_RELEASE`; Sub `Remove example_not_ready from the runtime release interpretation layer so it no longer keeps the current GO state framed as review-required.`
- vi：Cau chinh `Chinh sach de xuat: REMOVE_FROM_RUNTIME_RELEASE`; Cau phu `Loai example_not_ready khoi lop dien giai runtime release de no khong tiep tuc khien trang thai GO hien tai bi dien giai thanh can ra soat.`

firstAction：
- zh：`若主控确认该提示已无运行态意义，可将其移出 runtime release 文案并改走注记或历史说明。`
- en：`If control confirms this hint no longer matters for runtime state, remove it from runtime release wording and move it to note/history only.`
- vi：`Neu chu tri xac nhan nhac nho nay khong con y nghia doi voi runtime hien tai, hay loai no khoi van ban runtime release va chuyen sang ghi chu hoac lich su.`

## 4) 使用建议

- 若主控希望最保守，选 `keep_as_review_required`。
- 若主控希望当前 GO 态更贴近现态，选 `downgrade_to_note`。
- 若主控确认 `example_not_ready` 已不再属于 runtime release 风险，选 `remove_from_runtime_release`。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
