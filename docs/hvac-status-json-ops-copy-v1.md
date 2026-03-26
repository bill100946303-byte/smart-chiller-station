# HVAC status-json 推荐动作三语运维文案 v1

目标：为 `status-json` 的 `summary.recommendedAction` 提供动作层三语短文案。  
边界：不改 `ruleId`、不改阈值、不改 evaluator（仅文案层）。

## 1) 字段口径（字段级）

必需字段：
- `source`
- `summary.releaseDecision`
- `summary.recommendedAction`
- `summary.strictFreshnessPreview`
- `canonical.overallPass`

可选字段（strict 解释增强）：
- `releaseGateLive.reasons[]`
- `releaseGateLatest.reasons[]`

## 2) recommendedAction 三类典型场景

### A. RUN_ACCEPT_FIRST

原始动作特征：
- `summary.recommendedAction` 以 `run accept first:` 开头

触发条件（字段级）：
- `source == "missing"`
- `summary.recommendedAction startsWith "run accept first:"`

三语短文案：
- zh
  - 提示：`缺少验收快照，先补基础结果。`
  - 第一步动作：`先执行 scripts/chiller_ctl.sh accept 生成 canonical 报告。`
- en
  - Prompt: `Acceptance snapshot is missing; create baseline first.`
  - First step: `Run scripts/chiller_ctl.sh accept to generate the canonical report.`
- vi
  - Nhac: `Thieu snapshot nghiem thu; can tao baseline truoc.`
  - Buoc 1: `Chay scripts/chiller_ctl.sh accept de tao bao cao canonical.`

### B. DO_NOT_RELEASE

原始动作特征：
- `summary.recommendedAction` 包含 `do not release; inspect reasons/advisories and rerun acceptance`

触发条件（字段级）：
- `source == "canonical"`
- `summary.releaseDecision == "NO-GO"`
- `summary.recommendedAction contains "do not release;"`

三语短文案：
- zh
  - 提示：`当前为 NO-GO，禁止放行。`
  - 第一步动作：`先查看 reasons/advisories，完成修复后重跑 accept。`
- en
  - Prompt: `Current state is NO-GO; release is blocked.`
  - First step: `Check reasons/advisories first, then rerun accept after fixes.`
- vi
  - Nhac: `Trang thai hien tai la NO-GO; chan phat hanh.`
  - Buoc 1: `Kiem tra reasons/advisories truoc, sua xong roi chay lai accept.`

### C. RELEASE_CANDIDATE_READY

原始动作特征：
- `summary.recommendedAction` 包含 `release candidate is ready under default policy`

触发条件（字段级）：
- `source == "canonical"`
- `summary.releaseDecision == "GO"`
- `canonical.overallPass == true`
- `summary.recommendedAction contains "release candidate is ready under default policy"`

三语短文案：
- zh
  - 提示：`发布候选已就绪（默认门禁）。`
  - 第一步动作：`先按发布窗口走确认流程，再执行正式放行。`
- en
  - Prompt: `Release candidate is ready under default policy.`
  - First step: `Start release-window confirmation, then execute formal release.`
- vi
  - Nhac: `Ban release candidate da san sang theo chinh sach mac dinh.`
  - Buoc 1: `Bat dau xac nhan cua so phat hanh, sau do moi phat hanh chinh thuc.`

## 3) strictFreshnessPreview=true 专项提醒（NO-GO 解释）

场景 ID：`STRICT_FRESHNESS_PREVIEW_NOGO`

触发条件（字段级）：
- `summary.strictFreshnessPreview == true`
- `summary.releaseDecision == "NO-GO"`
- 且满足任一：
  - `releaseGateLive.reasons[] contains "freshness_not_fresh_strict"`
  - `releaseGateLatest.reasons[] contains "freshness_not_fresh_strict"`

三语提醒：
- zh
  - 提示：`严格时效预览触发 NO-GO：当前 freshness 非 fresh。`
  - 第一步动作：`先更新数据快照并重跑 status-json --live --strict-freshness。`
- en
  - Prompt: `Strict freshness preview triggered NO-GO: freshness is not fresh.`
  - First step: `Refresh data snapshot, then rerun status-json --live --strict-freshness.`
- vi
  - Nhac: `Preview strict freshness da kich hoat NO-GO: freshness khong phai fresh.`
  - Buoc 1: `Cap nhat snapshot du lieu, sau do chay lai status-json --live --strict-freshness.`

## 4) 接入顺序建议（前端）

1. 先按 `recommendedAction` 原文匹配三类模板。
2. 再叠加 strict 专项提醒（仅在 `strictFreshnessPreview=true && NO-GO` 时显示）。
3. 若都未命中，回退到 `summary.recommendedAction` 原文直出。

## 5) 边界声明

- 不改 `ruleId`。
- 不改阈值。
- 不改 evaluator / 判定逻辑。
