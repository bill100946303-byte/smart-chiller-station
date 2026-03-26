# Release Gate Reasons 映射口径 v1.0

## 1. 目标与边界
- 目标：定义 `release-gate` 的 `reasons[]` 与判定字段的一一映射，避免前后口径漂移。
- 依据：
  - `scripts/chiller_ctl.sh`（`release_gate_cmd`）
  - `docs/acceptance-snapshot-freshness-policy-v1.md`（30/60 分钟时效阈值）
- 边界：不改字段定义、不改 `null_strategy`、不改代码。

说明：输入中 `docs/release-gate-freshness-baseline-v1.md` 当前不存在；本版按脚本现状与 freshness policy 对齐。

## 2. 判定字段（release-gate --json）
- `contractOk`
- `canonicalExists`
- `canonicalOverallPass`
- `canonicalGeneratedAt`
- `canonicalAgeMin`
- `freshness`（`fresh|warn|stale|unknown`）
- `strictFreshness`
- `reasons[]`
- `decision`（`GO|NO-GO`）
- `exitCode`（`0|1`）

## 3. Reasons 字段级映射（1:1）

| reason | 来源字段 | 触发条件（字段级） | 对放行影响（yes/no） |
| --- | --- | --- | --- |
| `contract_not_ok` | `contractOk`（来自 `accept-contract` 命令退出码） | `contractOk=false` | yes |
| `canonical_missing` | `canonicalExists`（检查 `docs/v19.2-acceptance-report.json`） | `canonicalExists=false` | yes |
| `canonical_not_pass` | `canonicalOverallPass`（来自 canonical 的 `.overallPass`） | `canonicalExists=true` 且 `canonicalOverallPass=false` | yes |
| `freshness_not_fresh_strict` | `strictFreshness` + `freshness`（基于 `canonicalGeneratedAt` 与 `canonicalAgeMin` 计算） | `strictFreshness=true` 且 `freshness!=fresh` | yes |

补充口径（freshness）：
- `fresh`: `canonicalAgeMin < 30`
- `warn`: `30 <= canonicalAgeMin < 60`
- `stale`: `canonicalAgeMin >= 60`
- `unknown`: `generatedAt` 缺失/不可解析/时间异常

## 4. 与放行结论的关系
- 默认模式（未启用 `--strict-freshness`）：
  - `contract_not_ok` / `canonical_missing` / `canonical_not_pass` 会直接导致 `NO-GO`。
  - `freshness=warn|stale` 本身不直接阻断（仅作为状态输出），除非同时触发其他 reason。
- 严格时效模式（启用 `--strict-freshness`）：
  - 只要 `freshness!=fresh`，必触发 `freshness_not_fresh_strict` 并 `NO-GO`。

## 5. 组合示例（多原因叠加）

### 示例 A：`contract_not_ok + canonical_not_pass`
- 字段观测：
  - `contractOk=false`
  - `canonicalExists=true`
  - `canonicalOverallPass=false`
  - `strictFreshness=false`
- 输出：
  - `reasons=["contract_not_ok","canonical_not_pass"]`
  - `decision=NO-GO`

### 示例 B：`canonical_not_pass + freshness_not_fresh_strict`
- 字段观测：
  - `contractOk=true`
  - `canonicalExists=true`
  - `canonicalOverallPass=false`
  - `strictFreshness=true`
  - `freshness=stale`
- 输出：
  - `reasons=["canonical_not_pass","freshness_not_fresh_strict"]`
  - `decision=NO-GO`

## 6. 消费建议（防漂移）
1. 前端/脚本消费时先读字段，再解释 reason，不要只按字符串硬编码业务结论。
2. reason 扩展时必须先补“来源字段 + 触发条件 + 放行影响”三元定义，再上线消费。
3. `decision` 为最终放行位，`reasons[]` 为解释层；两者必须同时展示。
