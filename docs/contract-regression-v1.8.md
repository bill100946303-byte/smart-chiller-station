# Contract Regression V1.8

## 目标
- 固化 `homeEnergy` 回退链路的合同侧回归探针，不调整主 schema 严格度。
- 保持 `check:contract` 的强门禁逻辑不变，probe 继续非阻断输出。
- 在 probe 报告中增加 `runtime-ready=true/false` 可读行，便于主控签收。

## 本次加固点
- 新增 non-blocking 探针：`HomeEnergy fallback probe`
- 触发条件：`/dashboard/overview` 的 `sourceStatus.sources[key=energy].message` 命中 `homeEnergyEfficiency`
- 触发后断言（非阻断）：
  - `energyCards.currentCop` 为 number
  - `energyCards.totalPowerKw` 为 number
  - `energyCards.chilledDeltaT` 为 number
  - `energyCards.coolingDeltaT` 为 number
- 报告新增：
  - `runtimeReady`（boolean）
  - `runtimeReadyLine`（`runtime-ready=true/false`）
  - `nonBlockingProbes.homeEnergyFallback`（applicable/ready/reasons/triggerMessage）

## 判定边界
- 仍由 5 个主 example 的 schema 校验决定 pass/fail。
- homeEnergy、runParams、station_cop、real-link-ready 均为 non-blocking probe，只输出诊断信息，不改变门禁判定规则。
