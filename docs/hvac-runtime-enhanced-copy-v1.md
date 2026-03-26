# HVAC Runtime Enhanced Copy v1

目标：提供“运行态增强后”的三语值班文案，避免继续沿用“字段缺口严重”的旧说法（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `summaryClass`
- `reasons[]`
- `advisories[]`
- `generatedAt`

说明：
- 当前未发现现成的 `hvac-runtime-redis-enhanced-copy-v1.json`，本版基于现有运行态与 sync 文案口径整理。

## 2) 状态优先级

1. `runtime_enhanced_blocked`
2. `runtime_enhanced_review_required`
3. `runtime_enhanced_ready`

## 3) 三态文案

### A) runtime_enhanced_ready

触发条件（字段级，全部满足）：
- 不满足 `runtime_enhanced_blocked`
- 不满足 `runtime_enhanced_review_required`
- `decision == "GO"`
- `summaryClass == "ready"`
- `reasons.length == 0`
- `advisories.length == 0`
- `generatedAt` 存在且非空

mobileShort：
- zh：主句 `运行增强已就绪` / 副句 `按增强口径放行`
- en：Main `Enhanced Runtime Ready` / Sub `Use enhanced release view`
- vi：Cau chinh `Runtime tang cuong da san sang` / Cau phu `Dung goc nhin tang cuong de phat hanh`

full：
- zh：主句 `运行态状态：RUNTIME_ENHANCED_READY`；副句 `运行态增强后，当前结论已达到可执行口径，无需继续沿用字段缺口严重的旧描述。`
- en：Main `Runtime Status: RUNTIME_ENHANCED_READY`; Sub `With runtime enhancement in place, the current conclusion is actionable and no longer needs the old severe field-gap wording.`
- vi：Cau chinh `Trang thai runtime: RUNTIME_ENHANCED_READY`; Cau phu `Sau khi runtime duoc tang cuong, ket luan hien tai da du de hanh dong va khong can tiep tuc dung cach noi cu ve thieu truong nghiem trong.`

firstAction：
- zh：`先确认 generatedAt 属于当前轮次，再按增强后口径执行发布或播报。`
- en：`Confirm generatedAt belongs to the current run first, then execute release or duty messaging with the enhanced wording.`
- vi：`Xac nhan generatedAt thuoc lan chay hien tai truoc, sau do phat hanh hoac thong bao truc theo cach noi sau tang cuong.`

### B) runtime_enhanced_review_required

触发条件（字段级，全部满足）：
- 不满足 `runtime_enhanced_blocked`
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories.length > 0` 或 `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `运行增强待复核` / 副句 `已改善仍需确认`
- en：Main `Enhanced Runtime Review` / Sub `Improved but confirm first`
- vi：Cau chinh `Runtime tang cuong can ra soat` / Cau phu `Da cai thien nhung can xac nhan`

full：
- zh：主句 `运行态状态：RUNTIME_ENHANCED_REVIEW_REQUIRED`；副句 `运行态已增强，当前更适合解释为证据待补齐，而不是字段缺口严重。`
- en：Main `Runtime Status: RUNTIME_ENHANCED_REVIEW_REQUIRED`; Sub `The runtime path has been enhanced, so the better explanation is evidence still being completed, not severe field gaps.`
- vi：Cau chinh `Trang thai runtime: RUNTIME_ENHANCED_REVIEW_REQUIRED`; Cau phu `Runtime da duoc tang cuong, vi vay cach dien giai phu hop hon la bang chung van dang duoc bo sung, khong phai thieu truong nghiem trong.`

firstAction：
- zh：`先核对 advisories 与 generatedAt，再决定是继续补证据还是进入正式放行。`
- en：`Verify advisories and generatedAt first, then decide whether to collect more evidence or proceed to formal release.`
- vi：`Kiem tra advisories va generatedAt truoc, sau do moi quyet dinh se bo sung bang chung hay vao buoc phat hanh chinh thuc.`

### C) runtime_enhanced_blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `summaryClass == "blocked"`
- `reasons.length > 0`

mobileShort：
- zh：主句 `运行增强仍阻断` / 副句 `先按原因排障`
- en：Main `Enhanced Runtime Blocked` / Sub `Fix reasons first`
- vi：Cau chinh `Runtime tang cuong van bi chan` / Cau phu `Xu ly ly do truoc`

full：
- zh：主句 `运行态状态：RUNTIME_ENHANCED_BLOCKED`；副句 `即使运行态已增强，当前仍有明确阻断条件，应按具体原因处理，而不是笼统归因于字段缺口严重。`
- en：Main `Runtime Status: RUNTIME_ENHANCED_BLOCKED`; Sub `Even with runtime enhancement, explicit blockers remain and should be handled by concrete reasons rather than vague severe field-gap wording.`
- vi：Cau chinh `Trang thai runtime: RUNTIME_ENHANCED_BLOCKED`; Cau phu `Ngay ca khi runtime da duoc tang cuong, van con blocker ro rang va can xu ly theo ly do cu the thay vi quy chung la thieu truong nghiem trong.`

firstAction：
- zh：`先处理 reasons 首项，再重跑运行态同步/最新检查确认阻断是否解除。`
- en：`Resolve the first item in reasons, then rerun runtime sync/latest checks to confirm whether the block is cleared.`
- vi：`Xu ly muc dau trong reasons, sau do chay lai dong bo/kiem tra moi nhat cua runtime de xac nhan blocker da duoc go hay chua.`

## 4) 使用建议

- `runtime_enhanced_ready` 与 `runtime_enhanced_review_required` 都应避免继续使用“字段缺口严重”表述。
- 仅当命中 `runtime_enhanced_blocked` 时，才强调当前仍有明确阻断原因，但也应优先说具体 reason，而不是泛化为严重缺口。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
