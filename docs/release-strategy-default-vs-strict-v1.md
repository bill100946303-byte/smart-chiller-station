# Default / Strict 放行策略口径说明 v1.0

## 1. 目标与边界
- 目标：明确 `default` 与 `strict freshness` 两套放行策略的适用边界，避免同一快照被不同口径解读。
- 依据：`docs/acceptance-snapshot-freshness-policy-v1.md`、`docs/v1.8-release-preflight.json`
- 边界：不改字段定义、不改 `null_strategy`、不改业务字段。

说明：输入中的 `docs/release-gate-severity-boundary-v1.md` 当前不存在；本说明按现有 freshness policy 与 preflight 行为固化。

## 2. 两套策略定义

### 2.1 Default（默认策略）
- 判定入口：`scripts/chiller_ctl.sh release-gate`
- 核心口径：
1. 必须满足：`contractOk=true`、`canonicalExists=true`、`canonicalOverallPass=true`
2. freshness 为 `warn/stale` 时默认不直接阻断（仅告警/建议重跑）
- 对放行影响：`no`（在核心通过前提下，默认可放行）

### 2.2 Strict Freshness（严格时效策略）
- 判定入口：`scripts/chiller_ctl.sh release-gate --strict-freshness`
- 核心口径：
1. 继承 default 全部条件
2. 额外要求：`freshness=fresh`（快照年龄必须 `<30 分钟`）
3. 若 `freshness!=fresh`，触发 `freshness_not_fresh_strict` 并 `NO-GO`
- 对放行影响：`yes`（在临期/过期场景会阻断放行）

## 3. 何时用 Default
- 非生产窗口、开发联调、回归验证、日常巡检。
- 允许“先放行后重跑快照”的场景（需记录 warning）。
- 与当前 preflight 样本一致：`releaseGateOk=true` 且 advisory 可包含 `freshness_warn`。

## 4. 何时用 Strict
- 生产发布窗口、变更高风险时段、需审计可追溯的正式签收。
- 对快照时效有硬性要求的场景（例如发布审批前必须新鲜快照）。
- 当组织要求“无 freshness 警告签收”时，必须启用 strict。

## 5. 场景示例

### 示例 A（生产窗口）
- 场景：晚间生产发布，`canonicalAgeMin=42`，`overallPass=true`。
- default 结果：`GO`（但带 `freshness_warn`）。
- strict 结果：`NO-GO`（触发 `freshness_not_fresh_strict`）。
- 建议：采用 strict，先重跑 acceptance 再发布。

### 示例 B（非生产窗口）
- 场景：白天联调回归，`canonicalAgeMin=35`，`overallPass=true`。
- default 结果：`GO`（记录 warning，允许继续联调）。
- strict 结果：`NO-GO`。
- 建议：采用 default，不阻断测试节奏；收尾前补跑新鲜快照。

## 6. 结论
- default 适合“效率优先+可告警”的日常流程；
- strict 适合“审计优先+时效硬门禁”的生产签收流程；
- 两套策略并存时，发布窗口以 strict 为准，非生产窗口可用 default。
