# HVAC 验收结果三档运营话术 v1.0

目标：将 `v19.2` 验收结果映射为三档运营可发布话术。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 输入字段（仅字段级）

- `overallPass`（布尔）
- `readiness.nonDegradedReady`（布尔）
- `badge.globalPass`（布尔）

## 2) 三档映射规则

## ACCEPT_READY

触发条件（全部满足）：
- `overallPass == true`
- `readiness.nonDegradedReady == true`
- `badge.globalPass == true`

三语短句（移动端优先）：
- zh
  - `shortTitle`: `验收已通过`
  - `shortReason`: `非降级就绪且角标通过`
  - `shortAction`: `发布并按例行节奏巡检`
- en
  - `shortTitle`: `Acceptance Passed`
  - `shortReason`: `Non-degraded ready and badge is PASS`
  - `shortAction`: `Release and keep routine monitoring`
- vi
  - `shortTitle`: `Nghiem thu da dat`
  - `shortReason`: `San sang phi suy giam va badge PASS`
  - `shortAction`: `Phat hanh va giam sat dinh ky`

## ACCEPT_READY_WITH_RISK

触发条件（字段不一致，任一满足）：
- `overallPass == true` 且 `readiness.nonDegradedReady == false`
- `overallPass == true` 且 `badge.globalPass == false`
- `overallPass == false` 且 `readiness.nonDegradedReady == true` 且 `badge.globalPass == true`

三语短句（移动端优先）：
- zh
  - `shortTitle`: `可发布但有风险`
  - `shortReason`: `验收与就绪信号不一致`
  - `shortAction`: `先对齐信号再全量发布`
- en
  - `shortTitle`: `Publish with Risk`
  - `shortReason`: `Acceptance and readiness signals are inconsistent`
  - `shortAction`: `Align signals before full rollout`
- vi
  - `shortTitle`: `Co the phat hanh nhung co rui ro`
  - `shortReason`: `Tin hieu nghiem thu va san sang chua dong nhat`
  - `shortAction`: `Dong bo tin hieu truoc khi mo rong`

## ACCEPT_NOT_READY

触发条件（任一满足）：
- `overallPass == false` 且 `readiness.nonDegradedReady == false`
- `overallPass == false` 且 `badge.globalPass == false`
- `overallPass == false` 且 `readiness.nonDegradedReady == false` 且 `badge.globalPass == true`

三语短句（移动端优先）：
- zh
  - `shortTitle`: `验收未通过`
  - `shortReason`: `非降级门槛未达成`
  - `shortAction`: `修复后重跑验收流程`
- en
  - `shortTitle`: `Acceptance Not Ready`
  - `shortReason`: `Non-degraded gates are not met`
  - `shortAction`: `Fix issues and rerun acceptance`
- vi
  - `shortTitle`: `Nghiem thu chua dat`
  - `shortReason`: `Nguong phi suy giam chua dat`
  - `shortAction`: `Sua loi va chay lai nghiem thu`

## 3) 决策顺序（避免冲突）

推荐前端按以下顺序判断：
1. `ACCEPT_READY`
2. `ACCEPT_READY_WITH_RISK`
3. `ACCEPT_NOT_READY`

说明：
- 当状态冲突时优先归入 `ACCEPT_READY_WITH_RISK`，避免把不一致信号误判为完全通过或完全失败。

## 4) v19.2 当前样例映射

`v19.2-acceptance-report.json` 当前值：
- `overallPass=true`
- `readiness.nonDegradedReady=true`
- `badge.globalPass=true`

映射结果：
- `ACCEPT_READY`
