# Contract Runtime Health v19.2

## 执行信息
- 时间：2026-03-12
- 目录：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff`
- 命令：
  - `npm run check:contract`
  - `node scripts/probe.js 126lnoffice`

## 合同与探针摘要
- 合同门禁：`PASS`（`Contract validation passed for 5 examples using bff-v1.yaml`）
- `example-ready`：`false`
- `runtime-ready`：`unknown`
- `drift warning`：`none`（`Source key drift warnings: none`）
- `recommendations.sourceStatus.overall`：`partial`（来自 `node scripts/probe.js 126lnoffice` 输出）

## 关键日志（5行）
1. `Contract validation passed for 5 examples using bff-v1.yaml`
2. `Real-link-ready probe (non-blocking): NOT_READY`
3. `example-ready=false`
4. `runtime-ready=unknown`
5. `Source key drift warnings: none`

## 说明
- 本次 `node scripts/probe.js 126lnoffice` 可执行并返回聚合结果；在当前环境下，运行态链路未达成 non-degraded（`runtime-ready=unknown`），但不影响合同主门禁通过结论。
