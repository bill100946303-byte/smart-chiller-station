# UI Ops Entry Guide v1.1（运营发布版）

面向对象：运营与发布值班同学  
统一入口：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh`

发布流程建议：`status-json -> check -> verify-gates -> release-snapshot -> release-snapshot-index -> release-snapshot-diff -> release-ready -> release-ready-latest -> release-ready-check -> release-ready-sync-check -> release-ready-sync -> release-ready-sync-latest -> release-ready-brief -> release-ready-brief-check -> accept -> preflight`  
说明：`status-json` 提供机器可读总览（含 release gate）；`accept-contract` 是报告结构门禁，`accept` 是最终签收结果，二者不可互相替代。

---

## 1) `status`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status
```

适用场景（1句）：
- 需要快速确认 3001 入口模式与最近一次签收快照时使用。

禁用场景（1句）：
- 需要判断“当前实时链路是否健康”时不要只看 `status`，必须执行 `check`。

失败后第一步动作（1句）：
- 若出现 `acceptance report not found`，先执行 `accept` 生成报告，再回到 `status` 复核。

预期关键输出（2-3 条）：
- `ENTRY_MODE=shell`
- `stack.ok=true`
- `overallPass=true`

---

## 2) `status-json`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
```

实时门禁（推荐发布窗口使用）：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live
```

严格新鲜度预检（严格模式）：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live --strict-freshness
```

适用场景（1句）：
- 需要给值班机器人或外部脚本一次性读取“是否可放行 + 推荐动作”时使用。

禁用场景（1句）：
- 需要验证实时链路细节时不要只看 `status-json`，必须执行 `check`。

失败后第一步动作（1句）：
- 若 `error` 提示缺少 canonical 报告，先执行 `accept` 生成报告，再重跑 `status-json`。

预期关键输出（2-3 条）：
- `summary.releaseDecision=GO|NO-GO`
- `summary.overallPass=true|false`
- `summary.recommendedAction=...`
- `summary.releaseGateSource=live|latest_file`

---

## 3) `check`

命令：

```bash
SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check
```

适用场景（1句）：
- 发布前确认实时链路健康、readiness 归因与端点可用性时使用。

禁用场景（1句）：
- 仅需查看历史签收结论时不要反复执行 `check`，优先读 `status` 快照。

失败后第一步动作（1句）：
- 先看 `Attribution`（`upstream_interface`/`frontend_presentation`）并把失败归因分派给对应责任方。

预期关键输出（2-3 条）：
- `Readiness: PASS`
- `ND failed: 0`
- `sourceStatus overall => overview:ok trends:ok anomalies:ok recommendations:ok`

---

## 4) `accept-contract`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept-contract
```

适用场景（1句）：
- 需要确认验收报告 JSON 结构未漂移、可被主控稳定消费时使用。

禁用场景（1句）：
- 还没生成 `v19.2-acceptance-report.json` 时不要先跑该命令。

失败后第一步动作（1句）：
- 先执行 `accept` 生成最新报告，再重跑 `accept-contract` 看是否仍报结构错误。

预期关键输出（2-3 条）：
- `Acceptance report validation passed`
- 输出路径指向 `docs/v19.2-acceptance-report.json`
- 进程返回码为 0

---

## 5) `verify-gates`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates
```

机读输出：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
```

结构校验：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-check
```

等价别名：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest-check
```

自检：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-check --selftest
```

等价别名自检：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest-check --selftest
```

读取 latest：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest
```

适用场景（1句）：
- 发布前希望一次性确认 7 项门禁（含 `release-ready-brief`）都通过时使用。

禁用场景（1句）：
- 仅查看运行态健康时不要只跑 `verify-gates`，该命令不替代 `check`。

失败后第一步动作（1句）：
- 根据失败段落（`check:acceptance-report` / `check:status-json` / `check:release-snapshot` / `check:release-snapshot-index` / `check:release-snapshot-diff` / `release-snapshot-consistency` / `check:release-ready-brief`）定位并修复，再重跑 `verify-gates`。

预期关键输出（2-3 条）：
- `Acceptance report validation passed`
- `Status-json contract validation passed for 3 modes`
- `Release snapshot validation passed`
- `Release snapshot index validation passed`
- `Release snapshot diff validation passed`
- `release-snapshot consistency`
- `Release-ready-brief validation passed`
- `[OK] verify-gates passed`
- `verify-gates --json` 返回 `overall/passedCount/totalCount/failedCount/failedGates/gates[]` 并同步写入 `docs/verify-gates-latest.json`

---

## 6) `accept`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept
```

适用场景（1句）：
- 需要产出本轮签收结果并刷新 `v19.2-acceptance-report.*` 时使用。

禁用场景（1句）：
- `check` 尚未完成或存在未确认 FAIL 项时不要直接对外使用 `accept` 结果。

失败后第一步动作（1句）：
- 若 `overallPass=false`，先回到 `check` 清零 FAIL/WARN 主因，再重新执行 `accept`。

预期关键输出（2-3 条）：
- `overallPass=true`
- `report json: .../docs/v19.2-acceptance-report.json`
- `report md: .../docs/v19.2-acceptance-report.md`

---

## 7) `release-snapshot`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot --runtime-required=0
```

严格时效快照：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot --strict-freshness --runtime-required=1
```

适用场景（1句）：
- 发布前需要“一条命令汇总 status-json + verify-gates + preflight 决策”时使用。

禁用场景（1句）：
- 需要定位具体链路故障根因时不要只看 snapshot，需回到 `check` 与 `preflight` 原始日志。

失败后第一步动作（1句）：
- 先看 `reasons`，再按 `advisories` 判断是阻断修复还是环境提示，修复后重跑 snapshot。

预期关键输出（2-3 条）：
- `decision=GO|NO-GO`
- `reasons=...`（阻断原因）
- `advisories=...`（非阻断提示）
- `releaseSnapshotArchiveJson=...`（本次归档 JSON）

---

## 8) `preflight`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight
```

可选（受限环境仅看静态门禁）：

```bash
RUNTIME_REQUIRED=0 /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight
```

适用场景（1句）：
- 发布窗口前做合同门禁、前端构建门禁与（可选）运行态门禁的总检时使用。

禁用场景（1句）：
- 临时调试单一页面文案/样式时不要把 `preflight` 当作替代页面验收的工具。

失败后第一步动作（1句）：
- 根据失败门禁定位（stack/contract/shell build）先修复对应环节，再整轮重跑 `preflight`。

预期关键输出（2-3 条）：
- `v1.8 release preflight done.`
- 生成 `docs/v1.8-release-preflight.json`
- `preflightPass=true`

---

## 9) `release-snapshot-index`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-index --limit=10
```

适用场景（1句）：
- 需要回看最近多次发布结论（GO/NO-GO）并做值班交接时使用。

禁用场景（1句）：
- 需要判断“本次是否可发版”时不要只看 index，必须结合本次 `release-snapshot`。

失败后第一步动作（1句）：
- 若 `unknown>0` 或解析失败，先检查对应归档 JSON 文件是否损坏，再重跑一次 `release-snapshot`。

预期关键输出（2-3 条）：
- `total=...`
- `go=... noGo=... unknown=...`
- `releaseSnapshotIndexLatestJson=...`

---

## 10) `release-snapshot-consistency`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-consistency
```

适用场景（1句）：
- 需要确认“本次 latest 快照”和“index 最新一条”语义一致时使用。

禁用场景（1句）：
- 只做历史统计浏览时无需单独跑 consistency。

失败后第一步动作（1句）：
- 若 mismatch，先重跑 `release-snapshot --runtime-required=0` 刷新 latest 与 index，再复验 consistency。

预期关键输出（2-3 条）：
- `decision=GO|NO-GO`
- `reasons=...`
- `releaseSnapshotConsistencyLatestJson=...`

---

## 11) `release-snapshot-diff`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-diff
```

适用场景（1句）：
- 需要判断“本次发布状态相较上一次是稳定、恶化还是恢复”时使用。

禁用场景（1句）：
- 快照历史不足（仅 1 条）时不要过度解读 diff 结果，需先积累历史样本。

失败后第一步动作（1句）：
- 若返回 `error` 或 `insufficient_history`，先检查 index 文件与归档是否完整，再补跑一次 snapshot。

预期关键输出（2-3 条）：
- `diffClass=stable|risk_up|recovery|changed|insufficient_history|error`
- `decisionChanged=true|false`
- `reasonsAdded/advisoriesAdded=...`

---

## 12) `release-ready`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --runtime-required=0
```

严格实时门禁：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --strict-freshness --runtime-required=1
```

适用场景（1句）：
- 需要“一条命令”拿到发布决策（GO/NO-GO）并聚合 `verify-gates + snapshot + consistency + diff` 时使用。

禁用场景（1句）：
- 需要排查具体失败根因时不要只看 `release-ready`，应回到对应原子命令逐项定位。

失败后第一步动作（1句）：
- 先按 `reasons` 定位阻断项，再看 `advisories` 评估环境风险，修复后重跑 `release-ready`。

预期关键输出（2-3 条）：
- `decision=GO|NO-GO`
- `reasons=...`（阻断）
- `advisories=...`（提示）
- `checks.snapshotDecision / consistencyDecision / diffClass`

---

## 13) `release-ready-check`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check
```

等价别名：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
```

自检模式：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check --selftest
```

等价别名自检：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check --selftest
```

适用场景（1句）：
- 需要快速验证 `release-ready-latest.json` 字段契约是否可被主控稳定消费时使用。

禁用场景（1句）：
- 不要把 `release-ready-check` 当作发布判定本身，它只校验结构，不产出新判定。

失败后第一步动作（1句）：
- 先执行 `release-ready --runtime-required=0 --json` 刷新 latest，再重跑 `release-ready-check`。

预期关键输出（2-3 条）：
- `Release-ready validation passed`
- `source=latest_file|fallback`
- 自检模式输出 3 条路径化错误并返回 PASS（3/3）

---

## 14) `release-ready-latest`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest
```

JSON 输出：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest --json
```

适用场景（1句）：
- 需要只读查看“上一次 release-ready 结果”并用于值班播报时使用。

禁用场景（1句）：
- 不要把 `release-ready-latest` 当作实时重算命令，它只读取现有 latest 文件。

失败后第一步动作（1句）：
- 若提示 latest 文件不存在，先执行 `release-ready --runtime-required=0 --json` 生成最新产物。

预期关键输出（2-3 条）：
- `decision=GO|NO-GO`
- `exitCode=0|1`
- `generatedAt=...`
- `reasons/advisories=...`

---

## 15) `release-ready-sync`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0
```

重算模式（需要刷新 release-ready 结果时）：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --recompute --runtime-required=0
```

JSON 输出：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json
```

适用场景（1句）：
- 需要“一次执行”完成 release-ready 校验 + latest 读取联动（默认读 latest，按需 `--recompute` 重算）时使用。

禁用场景（1句）：
- 不要把 sync 当成深度排障工具，失败时仍需回到 `release-ready` 与 `release-ready-check` 分项定位。

失败后第一步动作（1句）：
- 看 `steps.releaseReady / steps.releaseReadyCheck / steps.releaseReadyLatest` 哪一步失败，再对应该命令重跑。

预期关键输出（2-3 条）：
- `decision=GO|NO-GO`
- `step.releaseReady=true|false`
- `step.releaseReady.mode=read_latest|recompute`
- `step.releaseReadyCheck=true|false`
- `step.releaseReadyLatest=true|false`

---

## 16) `release-ready-sync-check`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check
```

等价别名：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest-check
```

自检模式：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check --selftest
```

等价别名自检：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest-check --selftest
```

适用场景（1句）：
- 需要确认 `release-ready-sync-latest.json` 契约结构可用时使用。

禁用场景（1句）：
- 不要用该命令替代放行判断，它只做结构校验，不产出新决策。

失败后第一步动作（1句）：
- 先执行 `release-ready-sync --runtime-required=0 --json` 刷新 latest，再重跑本命令。

预期关键输出（2-3 条）：
- `Release-ready-sync validation passed`
- 自检输出 3 条路径化错误并返回 PASS（3/3）

---

## 17) `release-ready-brief`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief
```

JSON 输出：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief --json
```

适用场景（1句）：
- 需要值班群快速播报“当前放行摘要”时使用。

禁用场景（1句）：
- 不要把 brief 当作重算命令，数据来源于最新 sync 产物。

失败后第一步动作（1句）：
- 若提示 sync latest 缺失，先执行 `release-ready-sync --runtime-required=0 --json` 生成后再读 brief。

预期关键输出（2-3 条）：
- `decision/exitCode`
- `step.releaseReady.* / step.releaseReadyCheck.ok / step.releaseReadyLatest.ok`
- `latest.generatedAt / latest.decision`

---

## 18) `release-ready-brief-check`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check
```

自检：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check --selftest
```

适用场景（1句）：
- 需要确认值班 brief 输出字段结构稳定可读时使用。

禁用场景（1句）：
- 不要把该命令当放行判断，它只验证 brief 结构，不生成新决策。

失败后第一步动作（1句）：
- 先执行 `release-ready-sync --runtime-required=0 --json` 刷新 latest，再重跑本命令。

预期关键输出（2-3 条）：
- `Release-ready-brief validation passed`
- 自检输出 3 条路径化错误并返回 PASS（3/3）

---

## 19) `release-ready-sync-latest`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest
```

JSON 输出：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest --json
```

适用场景（1句）：
- 需要只读查看最近一次 sync 联动结果（不重算）时使用。

禁用场景（1句）：
- 不要把 latest 当重算命令，文件缺失时应先执行 `release-ready-sync --runtime-required=0 --json`。

失败后第一步动作（1句）：
- 若提示 latest 缺失，先执行 sync 生成文件，再回读 latest。

预期关键输出（2-3 条）：
- `decision/exitCode/generatedAt`
- `step.releaseReady.* / step.releaseReadyCheck.ok / step.releaseReadyLatest.ok`
- `latest.decision / latest.generatedAt`

---

## 常见误区（运营必读）

1. 只看 `status` 就宣布通过。  
正确做法：`status` 只是快照，发布结论必须结合 `check + accept`。

2. `accept-contract` 通过就等于系统通过。  
正确做法：`accept-contract` 只校验报告结构，不代表运行态健康。

3. `accept` 失败后重复执行不看原因。  
正确做法：先在 `check` 定位 FAIL 归因，再回跑 `accept`。

4. 忽略 `SITE_ID`，跨站点复用同一结论。  
正确做法：对目标站点显式传 `SITE_ID` 执行 `check`。

5. 在受限环境误把 `RUNTIME_REQUIRED=0` 结果当作生产通过。  
正确做法：该模式仅用于受限场景排查，不替代正式 runtime 门禁。

6. 把 `preflight` 当成 UI 视觉验收。  
正确做法：`preflight` 是发布门禁汇总，视觉一致性仍需看 UI 验收文档与截图。

7. 看到 `overallPass=true` 但忽略生成时间。  
正确做法：确认 `generatedAt` 为本轮时间窗口内，避免误读旧报告。

8. 把历史归档里的 GO 当作本次 GO。  
正确做法：先看本次 `release-snapshot-latest.json`，再用 index 做历史对照。

9. latest 与 index 不一致仍继续放行。  
正确做法：先过 `release-snapshot-consistency`，一致后再执行最终放行。

10. 不看 diff 就直接判断“今天和昨天一样”。  
正确做法：先看 `release-snapshot-diff` 的 `diffClass` 与 `reasonsAdded`。

---

## 运营执行结论

- 该版本可作为运营发布流程标准页直接使用。
