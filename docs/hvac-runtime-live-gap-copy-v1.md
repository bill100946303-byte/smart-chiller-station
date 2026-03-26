# HVAC Runtime Live Gap Copy v1

目标：补“运行态已通但字段缺失”的三语值班文案，帮助值班/运营解释当前状态（仅文案层）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 字段口径（字段级）

仅使用以下字段：
- `decision`
- `summaryClass`
- `reasons[]`
- `advisories[]`
- `generatedAt`

字段缺口提示建议匹配的 advisory / reason key：
- `runtime_ready_unknown_optional`
- `example_not_ready`
- `field_missing_or_invalid`
- `release_ready_field_missing:*`

## 2) 状态优先级

1. `live_ok_blocked_field_gap`
2. `live_ok_partial_data`
3. `live_ok_review_required`

## 3) 三态文案

### A) live_ok_partial_data

触发条件（字段级，全部满足）：
- 不满足 `live_ok_blocked_field_gap`
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `generatedAt` 存在且非空
- `advisories[]` 命中任一字段缺口提示：
  - `runtime_ready_unknown_optional`
  - `example_not_ready`
  - `field_missing_or_invalid`

mobileShort：
- zh：主句 `运行已通数据不全` / 副句 `先解释再行动`
- en：Main `Live OK Partial Data` / Sub `Explain before action`
- vi：Cau chinh `Runtime da thong du lieu chua du` / Cau phu `Giai thich truoc khi hanh dong`

full：
- zh：主句 `运行态状态：LIVE_OK_PARTIAL_DATA`；副句 `运行链路已通，但当前仍有部分字段未补齐，结论可参考但不宜过度外推。`
- en：Main `Runtime Status: LIVE_OK_PARTIAL_DATA`; Sub `The runtime path is reachable, but some fields are still incomplete, so the result is referable but should not be over-interpreted.`
- vi：Cau chinh `Trang thai runtime: LIVE_OK_PARTIAL_DATA`; Cau phu `Duong runtime da thong, nhung mot so truong van chua day du, nen ket qua chi nen dung de tham khao va khong nen dien giai qua muc.`

firstAction：
- zh：`先记录 advisory 所指的缺口字段，再按当前窗口补采或补映射。`
- en：`Record the field gaps indicated by advisories first, then backfill sampling or mapping in the current window.`
- vi：`Ghi lai cac truong thieu duoc advisories chi ra truoc, sau do bo sung lay mau hoac anh xa trong cua so hien tai.`

### B) live_ok_review_required

触发条件（字段级，全部满足）：
- 不满足 `live_ok_blocked_field_gap`
- 不满足 `live_ok_partial_data`
- `decision == "GO"`
- `summaryClass == "review_required"`
- `reasons.length == 0`
- `advisories.length > 0` 或 `generatedAt` 缺失或为空

mobileShort：
- zh：主句 `运行已通待复核` / 副句 `字段证据待确认`
- en：Main `Live OK Review` / Sub `Field evidence needs review`
- vi：Cau chinh `Runtime da thong can ra soat` / Cau phu `Bang chung truong du lieu can xac nhan`

full：
- zh：主句 `运行态状态：LIVE_OK_REVIEW_REQUIRED`；副句 `运行态已通，但当前字段证据仍不足以支持直接对外发布，需要人工复核。`
- en：Main `Runtime Status: LIVE_OK_REVIEW_REQUIRED`; Sub `The runtime path is reachable, but field-level evidence is still not strong enough for direct external release, so manual review is required.`
- vi：Cau chinh `Trang thai runtime: LIVE_OK_REVIEW_REQUIRED`; Cau phu `Runtime da thong, nhung bang chung o muc truong du lieu van chua du de cong bo truc tiep, vi vay can ra soat thu cong.`

firstAction：
- zh：`先核对 advisories 与 generatedAt，再决定是继续补证据还是进入发布。`
- en：`Verify advisories and generatedAt first, then decide whether to collect more evidence or proceed to release.`
- vi：`Kiem tra advisories va generatedAt truoc, sau do moi quyet dinh se bo sung bang chung hay tiep tuc phat hanh.`

### C) live_ok_blocked_field_gap

触发条件（字段级，任一满足）：
- `decision == "NO-GO"`
- `summaryClass == "blocked"`
- `reasons.length > 0`

建议按字段缺口阻断优先匹配：
- `reasons[]` 命中 `field_missing_or_invalid`
- 或 `reasons[]` 命中 `release_ready_field_missing:*`

mobileShort：
- zh：主句 `运行已通但被阻断` / 副句 `字段缺口已升阻断`
- en：Main `Live OK But Blocked` / Sub `Field gap now blocks`
- vi：Cau chinh `Runtime da thong nhung bi chan` / Cau phu `Thieu truong da thanh blocker`

full：
- zh：主句 `运行态状态：LIVE_OK_BLOCKED_FIELD_GAP`；副句 `运行链路虽可达，但字段缺口已升级为阻断条件，当前不能按“已通”误判为可发布。`
- en：Main `Runtime Status: LIVE_OK_BLOCKED_FIELD_GAP`; Sub `The runtime path is reachable, but field gaps have escalated into blocking conditions, so reachability must not be mistaken for releasability.`
- vi：Cau chinh `Trang thai runtime: LIVE_OK_BLOCKED_FIELD_GAP`; Cau phu `Duong runtime van truy cap duoc, nhung thieu truong da tro thanh dieu kien chan, vi vay khong duoc nham kha nang truy cap voi kha nang phat hanh.`

firstAction：
- zh：`先处理 reasons 中的字段缺口，再重跑同步/最新检查确认阻断是否解除。`
- en：`Fix the field gaps reflected in reasons first, then rerun sync/latest checks to confirm whether the block is cleared.`
- vi：`Xu ly cac thieu truong duoc neu trong reasons truoc, sau do chay lai sync/latest check de xac nhan blocker da duoc go hay chua.`

## 4) 使用建议

- 若 `live_ok_blocked_field_gap` 命中，优先对外解释“运行态可达，但字段不足仍阻断”，不要只说“运行已通”。
- 若命中 `live_ok_partial_data`，适合解释为“已恢复到可观察态，但暂未恢复到完整态”。
- 若命中 `live_ok_review_required`，说明当前更像证据不足，而不是运行链路中断。

## 5) 边界声明

- 未改 `ruleId`。
- 未改阈值。
- 未改 evaluator / 判定逻辑。
