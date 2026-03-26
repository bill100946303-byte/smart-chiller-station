# HVAC Signoff Copybook v1.1

目标：补齐 PASS 态话术（“系统已达非降级可运行”），并保持三档触发条件：`NOT_READY` / `READY_WITH_RISK` / `READY`。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 说明

- 本版沿用 v1.0 三档结构（状态名不变）。
- 输入中 `hvac-signoff-copybook-v1.0.json` 在当前目录未找到；本版根据 `v1.8-signoff-decision.md`、`ui-badge-state-v1.6.json` 与 `hvac-rule-copybook-v1.3.json` 进行兼容补齐。

## 2) 字段口径（触发条件）

核心字段：
- `sourceStatus.overall`
- `ruleEvaluation.rulesLoaded`
- `ruleEvaluation.matchedRuleIds[]`
- `ruleEvaluation.skippedRuleIds[]`
- `ruleEvaluation.skippedRuleDetails[*].missingMetrics[*].metric`
- `overview.freshness.stale`
- `trends.freshness.stale`
- `anomalies.freshness.stale`
- 可选 readiness 字段：`evidence.ndFailedCount`（存在时参与判定）

派生标记：
- `freshnessStale = any(overview|trends|anomalies.freshness.stale == true)`
- `staleRuleHit = matchedRuleIds includes "stale-data-detection" OR cards[*].ruleId == "stale-data-detection"`
- `copMissing = exists(missingMetrics.metric == "station_cop")`

## 3) 三档触发条件（保留）

## 3.1 `NOT_READY`

触发条件（任一满足）：
- `sourceStatus.overall != "ok"`
- `ruleEvaluation.rulesLoaded != true`
- `freshnessStale == true`
- `staleRuleHit == true`
- `evidence.ndFailedCount > 0`（若字段存在）

### 文案模板（zh/en/vi）
- zh
  - 标题：`未达非降级可运行`
  - 一句话：`当前仍有链路或数据质量阻塞，暂不满足签收条件。`
  - 下一步：`先修复上游/缺失指标并连续复测两次（间隔>=5分钟）。`
- en
  - Title: `Not Ready for Non-Degraded Run`
  - One-liner: `Blocking issues still exist in source connectivity or data quality, so signoff is not allowed yet.`
  - Next action: `Fix upstream/missing metrics and pass two consecutive checks (>=5 min apart).`
- vi
  - Tieu de: `Chua dat dieu kien van hanh phi suy giam`
  - Mot cau: `Van con diem nghen ve ket noi nguon hoac chat luong du lieu, chua du dieu kien ky nhan.`
  - Buoc tiep theo: `Sua nguon/thieu chi so va dat 2 lan kiem tra lien tiep (cach nhau >=5 phut).`

## 3.2 `READY_WITH_RISK`

触发条件（全部满足）：
- `sourceStatus.overall == "ok"`
- `ruleEvaluation.rulesLoaded == true`
- `freshnessStale == false`
- 且任一风险标记为真：
  - `ruleEvaluation.skippedRuleIds.length > 0`
  - `copMissing == true`
  - `staleRuleHit == true`（已恢复前后窗口）

### 文案模板（zh/en/vi）
- zh
  - 标题：`可运行（有风险提示）`
  - 一句话：`系统主链路可用，但仍有规则可评估性风险，建议按边界执行。`
  - 下一步：`先消除 skipped/COP 缺失，再恢复高风险调参节奏。`
- en
  - Title: `Runnable with Risk Notice`
  - One-liner: `Core pipeline is available, but rule evaluability risks remain and require bounded operations.`
  - Next action: `Clear skipped/COP-missing conditions before resuming high-risk tuning pace.`
- vi
  - Tieu de: `Co the van hanh (con canh bao rui ro)`
  - Mot cau: `Chuoi du lieu chinh da san sang, nhung van con rui ro ve kha nang danh gia rule.`
  - Buoc tiep theo: `Xu ly xong skipped/thieu COP truoc khi tro lai nhip dieu chinh rui ro cao.`

## 3.3 `READY`

触发条件（全部满足）：
- `sourceStatus.overall == "ok"`
- `ruleEvaluation.rulesLoaded == true`
- `ruleEvaluation.skippedRuleIds.length == 0`
- `freshnessStale == false`
- `staleRuleHit == false`
- `copMissing == false`
- `evidence.ndFailedCount == 0`（若字段存在）

### 文案模板（zh/en/vi）
- zh
  - 标题：`系统已达非降级可运行`
  - 一句话：`当前签收门槛已通过，可按非降级态口径稳定运行。`
  - 下一步：`冻结版本点并按常规巡检节奏持续监控。`
- en
  - Title: `System Reached Non-Degraded Runnable State`
  - One-liner: `Signoff gates are passed and the system can run under non-degraded criteria.`
  - Next action: `Freeze baseline and continue standard monitoring cadence.`
- vi
  - Tieu de: `He thong da dat trang thai van hanh phi suy giam`
  - Mot cau: `Cac cong ky nhan da dat, he thong co the van hanh on dinh theo tieu chi phi suy giam.`
  - Buoc tiep theo: `Dong bang moc phien ban va duy tri giam sat theo lich thuong le.`

## 4) 与 v1.3 文案协同

- `READY_WITH_RISK` 需联动：
  - `operationalModes.staleMode.*`
  - `operationalModes.stationCopMode.*`
- `NOT_READY` 优先级高于所有运营补充文案。
- `READY` 命中后展示 PASS 态主文案，不再突出风险提示。

## 5) 回滚点

- 当前：`hvac-signoff-copybook-v1.1@1.1.0`
- 回滚目标：`hvac-signoff-copybook-v1.0@1.0.x`（若后续补回 v1.0 正式文件）
- 回滚方式：前端切回 v1.0 文案文件，不影响规则引擎判定。
