# OPTIMIZE_DRAFT_REVIEW_CURRENT

## 1. 目标

本文固定当前 `/optimize` draft 返回的真实能力边界，避免后续把“解释型草案”误读成“真实优化结果”。

## 2. 当前 draft 能力

当前 `/optimize` 合法输入返回：

- HTTP：`501`
- code：`NOT_IMPLEMENTED`
- 但 `details` 已是 context-backed draft

当前 draft 的来源：

- `dashboard/overview`
- `anomalies/summary`
- `recommendations`

## 3. 当前 draft 已包含的字段

### 3.1 决策层

- `decision.summary`
- `decision.confidence=rule-based-draft`

### 3.2 请求回显

- `request.loadKw`
- `request.outdoorTempC`
- `request.mode`

### 3.3 建议层

- `recommendation.systemCop`
- `recommendation.totalPowerKw`
- `recommendation.steps`

说明：

- 这里的 `systemCop / totalPowerKw` 当前是站点现态快照，不是预测值。

### 3.4 诊断层

- `diagnostics`
- `freshness`
- `sourceStatus`
- `generatedAt`

## 4. 当前 draft 不能宣称的能力

当前 draft 不能宣称：

- 已完成真实优化求解
- 已完成设备组合搜索
- 已完成约束求解
- 已完成仿真验证
- 已具备正式执行能力

## 5. 当前 draft 最适合的用途

当前最适合：

1. 锁定输入合同
2. 锁定外层返回结构
3. 演示“未来 optimize 会如何解释结果”
4. 给后续 rule-based draft v2 留出口

## 6. 当前主控结论

- `/optimize`：`治理态 draft`
- `/optimize-demo`：`可演示`
- `/optimize` 正式签收：`no`

当前最合理的下一步不是接真优化，而是继续增强 draft 的解释能力。
