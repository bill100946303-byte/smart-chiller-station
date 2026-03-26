# Release Gate Reasons 三语告警短句 v1.2

目标：为 NO-GO 快速播报提供 reason 级三语短句（移动端优先）。  
边界：不改 `ruleId`、不改阈值、不改 evaluator；仅文案层。

说明：
- 输入文件 `hvac-release-gate-freshness-copy-v1.1.md` 在当前目录缺失。
- 本文基于 `hvac-release-gate-copy-v1.md` 与 `v19.2-master-status.md` 的字段口径生成。

## 字段口径（仅字段级）

- `contractOk`（可由 `contract.ok` 或 `gates.contractOk` 映射）
- `canonicalExists`
- `canonicalOverallPass`
- `strictFreshness`
- `freshness`（`fresh/warn/stale/unknown`）
- `mode`（`normal/dry-run`）
- `runtimeUnavailable`

## Reason 文案表（NO-GO 快速播报）

| reasonId | 字段级触发条件 | zh 短句 | en 短句 | vi 短句 |
| --- | --- | --- | --- | --- |
| `CONTRACT_GATE_FAILED` | `contractOk == false` | 合同门禁失败，禁止放行。 | Contract gate failed, release blocked. | Cong contract that bai, chan phat hanh. |
| `CANONICAL_REPORT_MISSING` | `canonicalExists == false` | 验收主报告缺失，禁止放行。 | Canonical acceptance report missing, release blocked. | Thieu bao cao nghiem thu chinh, chan phat hanh. |
| `ACCEPTANCE_NOT_PASS` | `canonicalOverallPass == false` | 验收未通过，禁止放行。 | Acceptance not passed, release blocked. | Nghiem thu chua dat, chan phat hanh. |
| `STRICT_FRESHNESS_WARN` | `strictFreshness == true && freshness == "warn"` | 时效预警（严格模式），暂停放行。 | Freshness warn in strict mode, hold release. | Canh bao do tuoi (strict), tam dung phat hanh. |
| `STRICT_FRESHNESS_STALE` | `strictFreshness == true && freshness == "stale"` | 数据陈旧（严格模式），禁止放行。 | Data stale in strict mode, release blocked. | Du lieu cu (strict), chan phat hanh. |
| `STRICT_FRESHNESS_UNKNOWN` | `strictFreshness == true && freshness == "unknown"` | 时效未知（严格模式），禁止放行。 | Freshness unknown in strict mode, release blocked. | Do tuoi khong xac dinh (strict), chan phat hanh. |
| `DRY_RUN_ONLY` | `mode == "dry-run"` | 本次为预演结果，不代表正式放行。 | Dry-run result only, not formal release approval. | Chi la ket qua dry-run, khong phai phe duyet chinh thuc. |
| `RUNTIME_UNAVAILABLE` | `runtimeUnavailable == true` | 运行环境不可达，当前结果仅供诊断。 | Runtime unavailable, result is diagnostic only. | Runtime khong truy cap duoc, ket qua chi de chan doan. |

## 使用顺序建议（防漂移）

1. 先播报主结论：`GO/NO-GO`。  
2. 若 `NO-GO`，再播报首个命中 `reasonId` 短句。  
3. 若 `mode == "dry-run"`，追加 `DRY_RUN_ONLY` 作为最后一条副句。  
