# Example-Ready Semantics Map v1

## 1. 目标与结论
- 目标：把 `exampleReady / example_not_ready / runtimeReady / summaryClass` 的语义边界单独落表，明确它们到底属于“运行发布语义”还是“样例基线语义”。
- 结论先行：
  - `exampleReady`、`example_not_ready`：**样例基线语义**
  - `runtimeReady`、`summaryClass`：**运行发布语义**
  - `check:contract` / probe report：**承载层，不等于语义归属**

## 2. 判定原则
1. 看字段在当前实现里“服务谁”：
   - 服务 example/sample 健康性的，归 `example`
   - 服务 runtime release 判定与值班摘要的，归 `runtime`
2. 若字段只是通过 contract probe 被带出来，但本意是 example 或 runtime 信号，则 `semantic_layer` 仍按业务语义归属，不按文件来源归类。
3. `summaryClass` 是聚合摘要，不是底层探针字段；它属于运行发布摘要层。

## 3. 语义边界表

| field | current_source | semantic_layer | current_effect | recommended_effect | release_impact |
| --- | --- | --- | --- | --- | --- |
| `exampleReady` | `check:contract` 的 real-link-ready probe，落到 `real-link-ready-probe-report.json.exampleReady`，再进入 `release-ready-latest.checks.exampleReady` | `example` | 当前是样例基线信号；本身不直接进 `reasons`，但当值为 `false/null` 时会分别导出 `example_not_ready` / `example_ready_unknown` advisory。 | 保留为样例基线健康信号，只用于说明 example 是否进入 non-degraded；不要单独作为运行发布 blocking 条件。 | `warning` |
| `example_not_ready` | 由 [`chiller_ctl.sh`](/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh) 在 `exampleReady=false` 时派生，进入 `release-ready-latest.advisories[]`，再镜像到 command-center 家族 | `example` | 当前不会把 `decision` 打成 `NO-GO`，但会让 command-center 家族的 `summaryClass` 挂在 `review_required`。 | 保留为样例基线提醒，但建议从主运行发布摘要中解耦；更适合作为 example/baseline badge 或 secondary advisory，而不是长期主导 runtime `summaryClass`。 | `warning` |
| `runtimeReady` | 优先来自 `runtime-status --json.overall.runtimeChainOk`，缺失时回退 `real-link-ready-probe-report.json.runtimeReady`，最终落到 `release-ready-latest.checks.runtimeReady` | `runtime` | 当 `runtimeRequired=true` 且 `runtimeReady!=true` 时，会写入 `reasons=runtime_not_ready_required` 并导致 `NO-GO`；当 `runtimeRequired=false` 时，`false/null` 只形成 advisory。 | 继续作为运行发布语义字段；仅在显式 `runtimeRequired=true` / 严格场景下阻断，在默认放行策略下保持 advisory。 | `warning` |
| `summaryClass` | `release-command-center-latest.summaryClass` / `release-command-center-sync-latest.summaryClass`，由 `decision + advisories` 聚合派生 | `runtime` | 当前是运行发布摘要字段；当 `decision=GO` 但 `advisories` 含 `example_not_ready` 时，`summaryClass=review_required`。 | 保留为运行发布摘要总览；推荐只由 runtime release advisory / reasons 驱动，example-only baseline drift 不应长期单独把 `summaryClass` 挂在 `review_required`。 | `warning` |

## 4. 当前实现证据
1. `exampleReady` / `runtimeReady` 的原始定义在 [contract-probe-semantics-v1.9.md](/Users/billchow/Documents/智慧冷冻站/docs/contract-probe-semantics-v1.9.md)：
   - `exampleReady` 用于判断“样例是否处于非降级态”
   - `runtimeReady` 用于判断“运行态是否非降级可联调”
2. `release-ready` 的阻断规则在 [release-ready-contract-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/release-ready-contract-v1.md)：
   - 仅当 `runtimeRequired=true` 时，`runtimeReady=true` 才成为 GO 的必要条件
   - `checks.exampleReady` 只是输出字段，不是 GO 的硬前提
3. 当前 release 产物现态：
   - [release-ready-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/release-ready-latest.json)：`decision=GO`、`checks.runtimeReady=true`、`checks.exampleReady=false`、`advisories=["example_not_ready"]`
   - [release-command-center-sync-latest.json](/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json)：`decision=GO`、`summaryClass=review_required`

## 5. 推荐口径
1. `exampleReady` / `example_not_ready`：
- 放在 example baseline / contract regression 叙事里。
- 可以提示“样例基线尚未完全 ready”，但不应与 runtime release gate 混成一个层级。
2. `runtimeReady`：
- 保持 runtime release 语义。
- 默认策略下是 non-blocking 诊断；严格策略下可升级为 blocking。
3. `summaryClass`：
- 应代表“当前值班发布摘要”。
- 如果未来要让 runtime release 摘要更干净，可考虑把 `example_not_ready` 从主摘要分流到 secondary badge，而不是继续推高 `review_required`。

## 6. 与现有文档关系
- [runtime-enhanced-field-delta-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/runtime-enhanced-field-delta-v1.md) 负责说明运行态 core 字段恢复。
- [release-ops-unified-field-map-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/release-ops-unified-field-map-v1.md) 负责 release-ready 统一字段。
- [release-command-center-sync-field-map-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-field-map-v1.md) 负责 command-center-sync 聚合字段。
- 本文档只补“example/runtime/contract 三层语义归属”。

## 7. 统计与结论
- blocking 数量：`0`
- warning 数量：`4`
- 是否影响默认放行：`no`
