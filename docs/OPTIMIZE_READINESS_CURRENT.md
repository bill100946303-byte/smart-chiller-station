# OPTIMIZE_READINESS_CURRENT

## 1. 目标

本文用于判断当前仓库是否适合进入 `/optimize` 的开工前阶段。

这里的“开工前阶段”特指：

- 固定输入输出边界
- 固定复用底座
- 固定实现顺序

不等同于：

- 立即实现真实优化引擎
- 立即做控制下发
- 立即把 recommendation 页面改造成 optimize 页面

## 2. 当前结论

当前结论：`可进入 Sprint0 治理准备，不进入真实实现`

原因：

- 字段口径、接口面、线程治理都已完成治理层固化
- 已有 BFF service 里已经存在一批可复用底座
- 但当前还没有“显式优化输入 -> 显式优化输出”的稳定合同
- 也还没有独立于 recommendations 的优化入口

## 3. 当前已具备的可复用底座

### 3.1 规则与建议底座

当前仓库已存在：

- `apps/chiller-bff/src/services/recommendationService.js`
- `apps/chiller-bff/src/services/ruleEngineService.js`

当前可复用的部分：

- 规则读取
- 指标袋构建
- 基于阈值的规则评估
- 建议卡生成

当前不能直接拿来当 `/optimize` 的部分：

- recommendations 更偏“规则诊断与建议卡”
- 不是“显式输入驱动的优化计算入口”
- 它当前依赖 overview/anomaly/ruleMetrics 的组合上下文，而不是独立 optimize request

### 3.2 通用语义底座

当前仓库已存在：

- `fieldPolicyService.js`
- `freshness.js`
- `sourceStatusService.js`

这些可作为 `/optimize` 的统一外层结构基础：

- 空值策略
- 生成时间
- 来源状态
- 数据质量诊断

### 3.3 页面与接口底座

当前已稳定的来源能力：

- `dashboard/overview`
- `dashboard/trends`
- `recommendations`
- `devices/list/tree/detail`

这意味着未来 `/optimize` 若要解释“为什么给出这条建议”，已经有现成数据面可引用。

## 4. 当前真正缺什么

### 4.1 缺显式输入合同

当前 recommendation/ruleEngine 主要吃的是：

- 页面聚合后的现态
- 规则指标袋

但 `/optimize` 真正需要的是显式输入，例如：

- `loadKw`
- `outdoorTempC`
- `mode`
- `constraints`

当前仓库里这层输入合同还没存在。

### 4.2 缺“优化结果”合同

当前 recommendation 输出的是：

- cards
- ruleEvaluation

这不等于 optimize 需要的结果，例如：

- 推荐方案摘要
- 候选设备组合
- 预测系统 COP
- 预测总功率
- 解释与风险

### 4.3 缺独立演示入口

当前 shell 中没有：

- `/optimize-demo`

所以即使先做了 BFF 内部 service，也没有一个稳定的最小承接页。

### 4.4 缺明确的数据前提边界

`/optimize` 未来如果要做真计算，至少需要明确：

- 哪些输入来自手填
- 哪些输入来自实时运行态
- 哪些输入来自历史统计
- 缺失时是报错、降级还是禁止求解

当前这套边界还没被写死。

## 5. 当前不该做的事

当前不建议：

- 直接在 `recommendationService` 里塞一个“假 optimize”
- 直接返回 recommendations cards 充当 optimize 结果
- 先做 `/assistant/query` 来反推 optimize 结构
- 在真实 optimize engine 未接入前，用临时拼装的历史或推荐数据去伪造优化输出

## 6. 推荐进入顺序

### Step 1

先完成 `/optimize` 最小合同文档。

### Step 2

再完成 `/optimize` 输入字段映射与空值策略文档。

### Step 3

再决定是否创建：

- `apps/chiller-bff/src/services/optimizeService.js`

但初版只允许返回：

- `NOT_IMPLEMENTED`
- 或静态 contract example

### Step 4

最后才考虑：

- `/optimize-demo`

## 7. 当前主控建议

当前最合理的推进方式是：

1. 进入 `/optimize` 的治理准备阶段
2. 不直接进入真实接口实现
3. 先把输入输出边界和复用底座固定住

一句话：

- `/optimize` 现在可以准备
- 但还不应该直接开写“真优化接口”
