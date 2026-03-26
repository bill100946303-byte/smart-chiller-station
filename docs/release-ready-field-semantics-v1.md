# Release-Ready 字段语义表 v1

## 1. 目标与边界
- 目标：固化 `release-ready` 输出字段语义，避免脚本与前端消费时口径漂移。
- 边界：不改业务字段定义，仅定义字段含义、来源、阻断属性、缺失默认行为与放行影响。

## 2. 字段字典（最小覆盖）

| key | 含义 | 来源 | 是否阻断 | 字段缺失默认行为 | 放行影响 |
| --- | --- | --- | --- | --- | --- |
| `decision` | release-ready 最终放行结论（`GO/NO-GO`） | `docs/release-snapshot-latest.json` `decision`（命令：`chiller_ctl.sh release-snapshot`） | 是 | 缺失按 `NO-GO` 处理 | `NO-GO` 阻断；`GO` 可继续下一步 |
| `exitCode` | 与 `decision` 对齐的退出码（`0/1`） | `docs/release-snapshot-latest.json` `exitCode` | 是 | 缺失按 `1` 处理 | `1` 阻断；`0` 允许继续 |
| `reasons` | 阻断原因列表（空表示无阻断原因） | `docs/release-snapshot-latest.json` `reasons[]` | 是 | 缺失按 `["release_ready_field_missing:reasons"]` 处理 | 非空通常对应 `NO-GO`，用于归因 |
| `diffClass` | 本次与上次快照变化分类（`stable/risk_up/recovery/changed/insufficient_history/error`） | `docs/release-snapshot-diff-latest.json` `diffClass`（命令：`chiller_ctl.sh release-snapshot-diff`） | 否（解释层） | 缺失按 `error` 处理 | 作为趋势提示，不单独覆盖主决策 |
| `decisionChanged` | 本次与上次是否发生主结论变化 | `docs/release-snapshot-diff-latest.json` `decisionChanged` | 否（解释层） | 缺失按 `null` 处理 | 用于变更说明，不单独阻断 |
| `consistencyOk` | latest 与 index 最新条目是否一致 | 派生：`docs/release-snapshot-consistency-latest.json`，规则：`decision=="GO"` 且 `checks.*Match==true`（命令：`chiller_ctl.sh release-snapshot-consistency`） | 是 | 缺失按 `false` 处理 | `false` 阻断（快照链路不一致） |
| `verifyGatesOk` | 发布前门禁复核是否通过 | `docs/release-snapshot-latest.json` `checks.verifyGatesOk` | 是 | 缺失按 `false` 处理 | `false` 阻断（基础门禁失败） |

## 3. 字段判定边界
1. 主放行字段：`decision` + `exitCode` + `reasons`。
2. 一致性强制字段：`consistencyOk`（建议作为独立阻断位）。
3. 趋势解释字段：`diffClass`、`decisionChanged`（不单独阻断）。
4. 过程门禁字段：`verifyGatesOk`（基础阻断位）。

## 4. 缺失字段处理原则（Fail-Closed）
- 任何阻断字段缺失（`decision/exitCode/reasons/consistencyOk/verifyGatesOk`）均按最保守策略处理（默认阻断）。
- 非阻断字段缺失（`diffClass/decisionChanged`）按可解释降级处理（`error/null`），但不单独翻转主决策。

## 5. 建议聚合判定（参考）
`releaseReady=true` 建议条件：
1. `decision=="GO"`
2. `exitCode==0`
3. `len(reasons)==0`
4. `consistencyOk==true`
5. `verifyGatesOk==true`

任一不满足即 `releaseReady=false`。

## 6. 对当前默认放行影响
- 本文档为语义固化与消费约束，不修改现有脚本逻辑。
- 结论：对当前默认放行影响 `no`。
