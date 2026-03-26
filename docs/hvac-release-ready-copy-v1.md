# HVAC Release-Ready 三语运维短文案 v1

目标：输出 `ready / blocked / review_required` 三类三语文案（`mobileShort + full`）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

主口径（release snapshot v1）：
- `decision`
- `reasons[]`
- `advisories[]`
- `checks.verifyGatesOk`
- `checks.preflightPass`
- `releaseGate.decision`（可选）
- `releaseGate.advisories[]`（可选）
- `statusSummary.strictFreshnessPreview`（可选）

兼容口径（legacy preflight）：
- `preflightPass`
- `releaseGate.decision`
- `releaseGate.reasons[]`
- `releaseGate.advisories[]`

## 2) 优先级规则（必须）

匹配顺序固定为：
1. `blocked`
2. `review_required`
3. `ready`

说明：出现冲突时，以更高优先级类覆盖低优先级类。

## 3) 三类文案与触发条件

### A) blocked

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `reasons.length > 0`
- `checks.verifyGatesOk == false`
- `checks.preflightPass == false`
- `releaseGate.decision == "NO-GO"`（若存在）
- `preflightPass == false`（legacy）

mobileShort：
- zh
  - 主句：`发布受阻`
  - 副句：`存在阻断条件`
  - 第一动作：`先修复首个阻断项`
- en
  - Main: `Blocked`
  - Sub: `Blocking conditions exist`
  - First action: `Fix the first blocker`
- vi
  - Cau chinh: `Bi chan phat hanh`
  - Cau phu: `Ton tai dieu kien chan`
  - Buoc 1: `Xu ly blocker dau tien`

full：
- zh
  - 主句：`放行状态：BLOCKED`
  - 副句：`当前存在阻断原因或关键门禁未通过，不能进入发布。`
  - 第一动作：`先处理首个 reason 并重跑 release-snapshot 复核。`
- en
  - Main: `Release Status: BLOCKED`
  - Sub: `Blocking reasons or failed critical gates are present, so release cannot proceed.`
  - First action: `Resolve the first reason and rerun release-snapshot for verification.`
- vi
  - Cau chinh: `Trang thai phat hanh: BLOCKED`
  - Cau phu: `Dang co ly do chan hoac cong quan trong chua dat, khong the tiep tuc phat hanh.`
  - Buoc 1: `Xu ly reason dau tien va chay lai release-snapshot de xac nhan.`

### B) review_required

触发条件（字段级）：
- 不满足 `blocked`
- 且满足全部：
  - `(decision == "GO" OR releaseGate.decision == "GO")`
  - `checks.verifyGatesOk == true`（若存在）
  - `checks.preflightPass == true`（若存在）
- 且满足任一：
  - `advisories.length > 0`
  - `releaseGate.advisories.length > 0`（若存在）
  - `statusSummary.strictFreshnessPreview == true`

mobileShort：
- zh
  - 主句：`可放行需复核`
  - 副句：`存在提示项`
  - 第一动作：`先复核提示再发布`
- en
  - Main: `Review Needed`
  - Sub: `Advisories present`
  - First action: `Review advisories first`
- vi
  - Cau chinh: `Can ra soat`
  - Cau phu: `Co muc canh bao`
  - Buoc 1: `Ra soat canh bao truoc`

full：
- zh
  - 主句：`放行状态：REVIEW_REQUIRED`
  - 副句：`主决策为 GO，但存在告警/提示项，需人工复核后放行。`
  - 第一动作：`先确认 advisories 的影响边界，再执行发布确认。`
- en
  - Main: `Release Status: REVIEW_REQUIRED`
  - Sub: `Core decision is GO, but advisories are present and require manual review before release.`
  - First action: `Confirm advisory impact boundaries first, then run release confirmation.`
- vi
  - Cau chinh: `Trang thai phat hanh: REVIEW_REQUIRED`
  - Cau phu: `Quyet dinh chinh la GO nhung co canh bao, can ra soat thu cong truoc khi phat hanh.`
  - Buoc 1: `Xac nhan pham vi anh huong cua advisories truoc, roi moi xac nhan phat hanh.`

### C) ready

触发条件（字段级）：
- 不满足 `blocked`
- 不满足 `review_required`
- 且满足全部：
  - `(decision == "GO" OR releaseGate.decision == "GO")`
  - `reasons.length == 0`（及 `releaseGate.reasons.length == 0` 若存在）
  - `advisories.length == 0`（及 `releaseGate.advisories.length == 0` 若存在）
  - `checks.verifyGatesOk == true`（若存在）
  - `checks.preflightPass == true`（若存在）

mobileShort：
- zh
  - 主句：`可直接放行`
  - 副句：`门禁与提示均清`
  - 第一动作：`按窗口执行发布`
- en
  - Main: `Ready`
  - Sub: `Gates and advisories clear`
  - First action: `Release in window`
- vi
  - Cau chinh: `San sang phat hanh`
  - Cau phu: `Cong va canh bao deu sach`
  - Buoc 1: `Phat hanh theo cua so`

full：
- zh
  - 主句：`放行状态：READY`
  - 副句：`当前门禁通过且无阻断/提示项，可进入标准放行流程。`
  - 第一动作：`按发布窗口执行并同步值班群结论。`
- en
  - Main: `Release Status: READY`
  - Sub: `All gates pass with no blockers/advisories, ready for standard release flow.`
  - First action: `Execute in release window and sync the decision to the duty channel.`
- vi
  - Cau chinh: `Trang thai phat hanh: READY`
  - Cau phu: `Tat ca cong da dat va khong co blocker/advisory, san sang cho quy trinh phat hanh chuan.`
  - Buoc 1: `Thuc hien theo cua so phat hanh va thong bao ket luan cho nhom truc.`

## 4) 前端接入建议

1. 按优先级 `blocked > review_required > ready` 做首个命中。
2. 移动端显示 `mobileShort`，展开态显示 `full`。
3. 若字段缺失导致三类都未命中，回退为 `review_required`（保守策略）。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
