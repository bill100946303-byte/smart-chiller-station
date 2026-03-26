# Example Ready Contract Decision v1

## 1. 结论

建议结论：`移出运行态`

更具体地说：

- `example_not_ready` 应保留在合同/样例探针语境里
- 不建议继续进入 `release-command-center` 的运行态结论
- 不建议继续通过它影响 `summaryClass`

原因很直接：

- `exampleReady` 的来源是合同样例探针，不是 live runtime
- `release-command-center` 的定位是值班/发布运行态总览
- 让“样例未 ready”长期把运行态总览维持在 `review_required`，会混淆“合同治理问题”和“运行态风险”

## 2. `exampleReady` 当前来源

当前来源链路是：

1. `apps/chiller-bff/scripts/check-contract.js`
2. 读取 / 写出：
   - `apps/chiller-bff/openapi/examples/real-link-ready-probe-report.json`
3. 关键字段：
   - `exampleReady`
   - `runtimeReady`

当前语义依据见：

- [contract-probe-semantics-v1.9.md](/Users/billchow/Documents/智慧冷冻站/docs/contract-probe-semantics-v1.9.md)

现有定义已经很明确：

- `exampleReady`
  - 含义：合同样例是否满足 `real-link-ready`
- `runtimeReady`
  - 含义：运行态接口是否满足 `real-link-ready`

因此，`exampleReady` 本质上属于：

- `contract/example health`

而不是：

- `runtime/operator health`

## 3. 为什么会出现在 advisory 中

当前进入 advisory 的路径是：

1. [check-contract.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/check-contract.js)
   - 产出 `real-link-ready-probe-report.json`
   - 其中 `exampleReady=false`
2. [chiller_ctl.sh](/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh)
   - 读取 `runtime_probe_path`
   - 当 `example_ready=false` 时，追加：
   - `advisories+=("example_not_ready")`
3. `release-ready-latest.json`
   - 落出 `advisories=["example_not_ready"]`
4. [sync-release-command-center.js](/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/sync-release-command-center.js)
   - 直接透传 `releaseReadyLatest.advisories`
5. `release-command-center-latest.json`
   - 继续保留 `example_not_ready`

所以它不是 `release-command-center` 自己新增的，而是：

- `release-ready` 从合同探针透传过来的 advisory

## 4. 它是否应继续影响 `summaryClass`

不建议继续影响。

理由：

### 4.1 语义不一致

`summaryClass` 在 `release-command-center` 中是运行态值班摘要：

- `ready`
- `review_required`
- `blocked`

而 `example_not_ready` 指向的是：

- example 文件仍是降级态
- 合同样例尚未达到 real-link-ready

这不是运行态问题，也不是发布链路实时风险。

### 4.2 已有更合适的承载位置

`exampleReady` 已经有独立承载位置：

- `real-link-ready-probe-report.json.exampleReady`
- `release-ready-latest.json.checks.exampleReady`

这两个位置已经足够让主控、合同线程、数据模型线程追踪样例健康性。

没有必要再让它继续污染：

- `release-command-center.summaryClass`
- `release-command-center-sync.summaryClass`

### 4.3 当前运行态已证明可放行

当前现态已经是：

- `release-ready-latest.decision=GO`
- `release-ready-latest.checks.runtimeReady=true`
- `release-command-center.decision=GO`
- `release-command-center-sync.decision=GO`

在这个前提下，如果仍因 `example_not_ready` 把聚合摘要压在 `review_required`，会让值班侧误以为：

- 运行态还有未解除风险

但实际上剩余的是：

- 合同样例治理待收口

## 5. 建议结论

建议：`移出运行态`

建议落地方式：

1. `example_not_ready` 不再进入 `release-command-center` / `release-command-center-sync` 的运行态 advisory
2. `summaryClass` 不再受 `example_not_ready` 影响
3. `exampleReady` 继续保留在以下位置：
   - `check:contract` 输出
   - `real-link-ready-probe-report.json`
   - `release-ready-latest.checks.exampleReady`
4. 若仍希望保留可见性，建议改为：
   - 合同健康报告项
   - 或 docs / nightly regression 提示

## 6. 备选方案对比

### 方案 A：保留

含义：

- 继续让 `example_not_ready` 留在 advisory 中
- 继续让 `summaryClass=review_required`

问题：

- 语义混合
- 值班误读成本高
- 运行态已经 `GO` 时，摘要仍不干净

### 方案 B：降级

含义：

- 仍保留在 release 产物中
- 但降为 info，不再影响 `summaryClass`

优点：

- 可见性还在

问题：

- 仍把 contract/example 信息放在 runtime 顶层聚合里
- 语义还是不够干净

### 方案 C：移出运行态

含义：

- 从 `release-command-center` 家族移除
- 只留在 contract/probe 相关产物

优点：

- 语义最清晰
- 值班视角和合同治理视角彻底分层
- 最符合当前 `exampleReady` 的实际来源

综合建议：

- 选 `方案 C：移出运行态`

## 7. 对当前合同与门禁的影响

- 是否影响 `check:contract`：`No`
- 是否影响 OpenAPI 主 schema：`No`

说明：

- `exampleReady` 仍由 `check:contract` 非阻断探针维护
- 本建议只涉及 release ops 聚合层对 advisory 的消费边界
- 不改 OpenAPI，不放宽主合同，不改变 `check:contract` 的通过条件
