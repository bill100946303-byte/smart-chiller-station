# 发布快照字段血缘表 v1

## 1. 目标与边界
- 目标：固化“快照字段 -> 来源文件/命令 -> 决策影响（blocking/advisory/info）”映射，避免发布判定口径漂移。
- 覆盖对象：`docs/v1.8-release-preflight.json` 与 `docs/release-gate-latest.json`。
- 边界：不改字段定义、不改 `null_strategy`、不新增业务字段。

## 2. 字段血缘主表（最小覆盖）

| 快照字段 | 来源文件 | 来源命令/步骤 | 生成逻辑（字段级） | 决策影响 |
| --- | --- | --- | --- | --- |
| `gates.contractOk` | `docs/v1.8-release-preflight.json` | `scripts/release_preflight_v1_8.sh` -> `npm run check:contract` | 合同门禁命令成功为 `true`，失败为 `false` | `blocking` |
| `gates.statusJsonOk` | `docs/v1.8-release-preflight.json` | `scripts/release_preflight_v1_8.sh` -> `npm run check:status-json` | status-json 合同门禁成功为 `true`，失败为 `false` | `blocking` |
| `gates.shellOk` | `docs/v1.8-release-preflight.json` | `scripts/release_preflight_v1_8.sh` -> `npm run build`（shell） | 构建成功为 `true`，失败为 `false` | `blocking` |
| `gates.releaseGateOk` | `docs/v1.8-release-preflight.json` | `scripts/release_preflight_v1_8.sh` -> `scripts/chiller_ctl.sh release-gate-latest` | release-gate 同步步骤退出码成功为 `true`，失败为 `false` | `blocking` |
| `preflightPass` | `docs/v1.8-release-preflight.json` | `scripts/release_preflight_v1_8.sh`（Node 汇总） | `contractOk && statusJsonOk && shellOk && releaseGateOk && (runtimeRequired ? stackOk : true)` | `blocking` |
| `releaseGate.decision` | `docs/v1.8-release-preflight.json`（透传）<- `docs/release-gate-latest.json` | `scripts/chiller_ctl.sh release-gate-latest` -> `release_gate_cmd --json` | `GO/NO-GO` 最终决策位 | `blocking` |
| `releaseGate.reasons[]` | `docs/v1.8-release-preflight.json`（透传）<- `docs/release-gate-latest.json` | `scripts/chiller_ctl.sh release-gate` | 阻断原因集合（如 `canonical_missing`、`canonical_not_pass`） | `blocking`（解释层） |
| `releaseGate.advisories[]` | `docs/v1.8-release-preflight.json`（透传）<- `docs/release-gate-latest.json` | `scripts/chiller_ctl.sh release-gate` | 非阻断提示集合（如 `runtime_unavailable_snapshot_present`、`freshness_warn`） | `advisory` |

说明：
- `releaseGate.*` 在 preflight 报告中为透传值，源头为 `docs/release-gate-latest.json`。
- `decision` 是阻断结论，`reasons` 为阻断归因，`advisories` 为非阻断提示。

## 3. 字段缺失默认行为（缺文件场景）

| 缺失对象 | 默认行为 | 结果落点 | 决策影响 |
| --- | --- | --- | --- |
| 缺 `canonical`（`docs/v19.2-acceptance-report.json`） | `release-gate` 触发 `reasons+=canonical_missing`，`decision=NO-GO`；`release-gate-latest` 返回非 0 | preflight 中 `gates.releaseGateOk=false`，`releaseGate.reasons` 含 `canonical_missing`（若文件写入成功） | `blocking` |
| 缺 `release-gate-latest`（`docs/release-gate-latest.json`） | preflight 会先执行 `release-gate-latest` 重新生成；若生成失败则 `releaseGateOk=false` 且 `releaseGate` 可能为 `null` | `gates.releaseGateOk=false`，`preflightPass=false` | `blocking` |
| 缺 preflight 报告（`docs/v1.8-release-preflight.json`） | 视为“无可签收快照”，需重跑 preflight 生成报告 | 无法确认 `preflightPass` / `gates.*` | `blocking` |

## 4. 审计使用建议
1. 自动化放行优先检查：`preflightPass` -> `gates.releaseGateOk` -> `releaseGate.decision`。
2. `reasons[]` 用于阻断归因，`advisories[]` 用于风险提示，不应单独阻断默认放行。
3. 缺失任一关键快照文件（canonical / release-gate-latest / preflight）按阻断处理，先补产物再判定。

## 5. 当前默认放行影响结论
- 本文档仅固化字段血缘与缺失行为，不改变现有脚本逻辑。
- 对当前默认放行结论影响：`no`。
