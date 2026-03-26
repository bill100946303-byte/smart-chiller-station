# Contract Probe Semantics v1.9

## 背景
- `check:contract` 以合同样例为输入，主门禁仍由 OpenAPI + 5 个主 example 的强校验决定。
- `real-link-ready` 为 non-blocking 探针，用于补充可观测性，不改变 pass/fail 规则。

## 语义拆分
- `exampleReady`
  - 含义：当前合同样例（`openapi/examples/*.json`）是否满足 real-link-ready 条件。
  - 用途：判断“样例是否处于非降级态”，用于回归演进对齐。
- `runtimeReady`
  - 含义：运行态接口探针（默认 `http://127.0.0.1:8787` + `SITE_ID`）是否满足 real-link-ready。
  - 用途：判断“运行态是否非降级可联调”。
  - 当运行态不可达时输出 `runtime-ready=unknown`，避免把“未探测到运行态”误读为失败。

## 报告字段（real-link-ready-probe-report.json）
- `exampleReady` / `exampleReadyLine`
- `runtimeReady` / `runtimeReadyLine`
- `baselineSampleReady`（`real-link-ready-sample.json` 基线样例健康性）
- `runtimeProbe`
  - `enabled` / `available`
  - `probeBaseUrl` / `siteId` / `timeoutMs`
  - `reasons`
  - `groupedFailures` / `groupedByEndpoint` / `summary`

## 兼容与边界
- 保留 `ready` 字段作为兼容别名，当前等价于 `exampleReady`。
- 不放宽 schema，不改业务计算逻辑，不改变主合同门禁。
