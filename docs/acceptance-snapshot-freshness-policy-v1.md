# Canonical 快照时效策略 v1.0

## 1. 目标与边界
- 目标：定义 `canonical` 验收快照过期判定，避免使用陈旧快照进行放行。
- 输入基线：`docs/v19.2-acceptance-report.json`、`docs/acceptance-dryrun-data-policy-v1.md`、`docs/readiness-baseline-freeze-v1.8.md`
- 边界：不改字段定义、不改 `null_strategy`、不改业务口径。

## 2. 判定对象
- 唯一判定对象：`docs/v19.2-acceptance-report.json`（canonical）。
- 时间字段：`generatedAt`（UTC）。
- 参考时间：当前放行审批时刻（本地时区换算后计算快照年龄）。

## 3. 推荐阈值（v1.0）

### 3.1 新鲜（Fresh）
- 条件：快照年龄 `<= 30 分钟`
- 动作：可直接用于放行判定（前提：`overallPass=true` 且 readiness 条件满足）
- 放行影响：`no`

### 3.2 临期（Aging）
- 条件：快照年龄 `> 30 且 <= 60 分钟`
- 动作：允许“带警告使用”，同时触发“建议重跑 acceptance”
- 放行影响：`no`（但需在签收记录注明“临期快照”）

### 3.3 过期（Expired）
- 条件：快照年龄 `> 60 分钟`
- 动作：必须重跑 `v19_2_acceptance.sh` 生成新 canonical；旧快照仅作参考归档
- 放行影响：`yes`（阻断当前放行）

## 4. 异常时间场景（补充规则）
- `generatedAt` 缺失、不可解析、或晚于当前时间超过 5 分钟（时钟漂移）：按“过期”处理。
- 若 canonical 与 unavailable 同时存在，时效判定仍只看 canonical；unavailable 只做不可达证据。
- dry-run 不参与时效放行判定（遵循 `acceptance-dryrun-data-policy-v1.md`）。

## 5. 超时后动作清单
1. 超过 30 分钟：标记 warning，建议重跑 acceptance。
2. 超过 60 分钟：立即重跑 acceptance，更新 canonical 后再做放行决策。
3. 重跑失败且仅有 unavailable 快照：判定“不可放行”，进入运行时排障流程。

## 6. 两个示例

### 示例 A（新鲜）
- 场景：`generatedAt=2026-03-12T06:06:46Z`，审批时刻为 `2026-03-12 14:25:00 +08:00`，年龄约 18 分钟。
- 判定：新鲜（<=30 分钟）。
- 处理：可直接按 canonical 判定放行。

### 示例 B（过期）
- 场景：`generatedAt=2026-03-12T04:30:00Z`，审批时刻为 `2026-03-12 14:25:00 +08:00`，年龄约 115 分钟。
- 判定：过期（>60 分钟）。
- 处理：必须重跑 acceptance；重跑前不得以旧 canonical 放行。

## 7. 结论
- v1.0 采用 `30/60` 双阈值：30 分钟内新鲜，30-60 分钟临期告警，超过 60 分钟阻断放行并强制重跑。
