# HVAC Badge Sync 文案 v1

目标：补“入口已切成功但角标待同步”三语运维文案。  
触发条件字段限制：仅使用 `preflightPass` / `readiness.nonDegradedReady` / `badge.globalPass`。

## 1) ENTRY_OK_BADGE_PENDING

触发条件（全部满足）：
- `preflightPass == true`
- `readiness.nonDegradedReady == true`
- `badge.globalPass == false`

三语短文案：
- zh
  - `shortTitle`: `入口已切，角标待同步`
  - `shortReason`: `运行条件已满足，角标状态尚未刷新`
  - `shortAction`: `等待角标同步并复查页面状态`
- en
  - `shortTitle`: `Entry Switched, Badge Pending`
  - `shortReason`: `Runtime is ready, but badge state is not synced yet`
  - `shortAction`: `Wait for badge sync and recheck page status`
- vi
  - `shortTitle`: `Da chuyen cong vao, badge chua dong bo`
  - `shortReason`: `Dieu kien van hanh da dat, nhung badge chua cap nhat`
  - `shortAction`: `Cho dong bo badge roi kiem tra lai trang thai`

## 2) ENTRY_OK_BADGE_READY

触发条件（全部满足）：
- `preflightPass == true`
- `readiness.nonDegradedReady == true`
- `badge.globalPass == true`

三语短文案：
- zh
  - `shortTitle`: `入口与角标均就绪`
  - `shortReason`: `入口切换与角标状态一致，当前可按通过态运行`
  - `shortAction`: `保持例行巡检并记录签收时间`
- en
  - `shortTitle`: `Entry and Badge Ready`
  - `shortReason`: `Entry switch and badge status are aligned in PASS state`
  - `shortAction`: `Keep routine checks and log signoff time`
- vi
  - `shortTitle`: `Cong vao va badge da san sang`
  - `shortReason`: `Trang thai cong vao va badge da dong nhat o muc PASS`
  - `shortAction`: `Duy tri kiem tra dinh ky va ghi lai thoi diem`

## 3) ENTRY_OK_RUNTIME_NOT_READY

触发条件（全部满足）：
- `preflightPass == true`
- `readiness.nonDegradedReady == false`
- `badge.globalPass == true`

三语短文案：
- zh
  - `shortTitle`: `入口可用但运行未就绪`
  - `shortReason`: `角标显示通过，但运行态门槛尚未满足`
  - `shortAction`: `以运行门槛为准，先修复后再签收`
- en
  - `shortTitle`: `Entry OK, Runtime Not Ready`
  - `shortReason`: `Badge shows PASS, but runtime readiness is not met`
  - `shortAction`: `Follow runtime gate, fix issues before signoff`
- vi
  - `shortTitle`: `Cong vao on nhung runtime chua san sang`
  - `shortReason`: `Badge dang PASS nhung nguong runtime van chua dat`
  - `shortAction`: `Uu tien nguong runtime, sua xong moi ky nhan`

## 4) 边界声明

- 本文案仅用于“入口与角标同步状态”提示。
- 不改 `ruleId`、不改阈值、不改 evaluator。
