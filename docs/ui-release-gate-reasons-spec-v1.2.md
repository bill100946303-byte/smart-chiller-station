# Release Gate Reasons 展示规范 v1.2

目标：统一 `release-gate` 的 `reasons[]` 前端展示顺序与三语文案，让值班同学可在 3 秒内读懂 NO-GO 原因。  
边界：仅定义展示规范，不改 `scripts/chiller_ctl.sh` 判定逻辑。

## 1. 展示顺序规则（前端）

- 仅在 `decision=NO-GO` 且 `reasons.length > 0` 时展示原因列表。
- 列表排序规则：先按优先级（高 > 中 > 低），同优先级按固定顺序。
- 固定顺序（v1.2）：
  1. `contract_not_ok`
  2. `canonical_missing`
  3. `canonical_not_pass`
  4. `freshness_not_fresh_strict`
- 展示建议：第 1 条为主原因（主文案），其余为次级原因（可折叠）。

## 2. Reason Key 文案模板（zh/en/vi + 优先级）

### 2.1 `contract_not_ok`

- 优先级：高
- zh：`合同门禁未通过，当前发布结论为 NO-GO。`
- en：`Contract gate is not passed, current release decision is NO-GO.`
- vi：`Cổng hợp đồng chưa đạt, kết luận phát hành hiện tại là NO-GO.`

### 2.2 `canonical_missing`

- 优先级：高
- zh：`未找到 canonical 验收报告，当前发布结论为 NO-GO。`
- en：`Canonical acceptance report is missing, current release decision is NO-GO.`
- vi：`Không tìm thấy báo cáo nghiệm thu canonical, kết luận phát hành hiện tại là NO-GO.`

### 2.3 `canonical_not_pass`

- 优先级：高
- zh：`canonical 验收结果未通过，当前发布结论为 NO-GO。`
- en：`Canonical acceptance result is not passed, current release decision is NO-GO.`
- vi：`Kết quả nghiệm thu canonical chưa đạt, kết luận phát hành hiện tại là NO-GO.`

### 2.4 `freshness_not_fresh_strict`

- 优先级：中
- zh：`严格时效门禁未通过（非 fresh），当前发布结论为 NO-GO。`
- en：`Strict freshness gate is not passed (not fresh), current release decision is NO-GO.`
- vi：`Cổng độ mới nghiêm ngặt chưa đạt (không fresh), kết luận phát hành hiện tại là NO-GO.`

## 3. 兜底与兼容

- 未知 reason key（不在 v1.2 列表）：
  - 优先级：低
  - zh：`存在未识别的门禁原因（{reasonKey}），请联系主控复核。`
  - en：`Unrecognized gate reason exists ({reasonKey}), please contact control owner for review.`
  - vi：`Có lý do cổng chưa nhận diện ({reasonKey}), vui lòng liên hệ điều phối để rà soát.`

## 4. 值班群使用建议

- 对外播报只读三段：`decision` + 主原因（第 1 条）+ “是否已转派处理”。
- 如出现多条原因，不合并改写，不删除高优先级原因，避免口径漂移。
