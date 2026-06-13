# Optimize Demo UI Thread Brief

## 目标

本线程只负责 `OptimizeDemoPage` 的前端信息架构、视觉层级、交互密度和可读性优化。

不负责：
- AI 策略逻辑
- draft 数据结构
- execution / approval / rollback API 契约
- 站点运行时映射
- source-status 聚合逻辑

一句话边界：
- UI 线程可以重排、精简、强化表达
- UI 线程不能改“能不能执行”的判定规则，也不能改按钮背后的执行语义

## 当前现状

当前页面已经完成第一轮结构重排，首屏变成了：

1. 总判断
2. 主推荐方案
3. 阻塞项
4. 动作台

代码落点：
- 页面主文件：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- 样式：
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/styles/global.css`

关键位置：
- 决策模型与主方案筛选：
  - `pickPrimaryScheme`
  - `buildDecisionState`
  - `collectDecisionReasons`
  - `collectDecisionBlockers`
- 首屏“决策总览”：
  - `OptimizeDemoPage.tsx` 中 `SectionCard title="决策总览"`
- 新布局 class：
  - `.optimize-decision-layout`
  - `.optimize-decision-main`
  - `.optimize-decision-side`
  - `.optimize-decision-banner`

## UI 线程要解决的问题

当前首屏虽然已经完成结构收口，但还存在典型的“工程页味道太重”的问题：

1. 文本密度偏高
- 首屏解释语句偏多，读者需要停下来消化

2. 卡片权重还不够分明
- “总判断”
- “主方案”
- “阻塞项”
- “动作台”
  这四块的视觉主次还不够明确

3. 估计值与可执行值区分还不够强
- 页面虽然有 `estimateBadge`
- 但“估计目标”和“可提交审批目标”仍然容易被误读成同一层级

4. 首屏和下半区还有轻微重复
- 动作台在首屏
- 执行中心里也保留了一组同类按钮
- 语义上已经统一，视觉上仍可继续压缩

## UI 线程允许做的事

1. 优化首屏信息架构的视觉层级
- 强化“总判断”卡的主视觉
- 压缩辅助说明文字
- 让主方案和阻塞项更容易扫读

2. 精简首屏文案呈现
- 把长句改成短句
- 把多行解释改成标签、摘要、二级说明
- 减少首屏段落式文本

3. 优化动作台视觉表达
- 强化“当前可执行动作”
- 弱化“当前不可执行动作”
- 让只读态、待审批态、已批准态更直观

4. 处理重复信息
- 可以在不改变行为的前提下弱化下半区重复按钮
- 可以把执行中心更偏向“历史与回退边界”

5. 优化卡片与网格响应式
- 桌面端更清晰
- 窄屏下避免信息挤压和过长按钮列

## UI 线程禁止做的事

1. 不要改按钮门禁规则

必须保留的行为约束：
- `readOnlyMode` 时不能让执行按钮可用
- `towerApproachExecutionReady !== true` 时不能让 approach 提交可用
- `pendingExecution` / `approvedExecution` / `pendingTowerApproachExecution` / `approvedTowerApproachExecution` 的判断语义不能变
- `scheme.status === "blocked"` 时方案提交仍必须禁用

2. 不要改执行函数的调用对象

不能改这些函数的语义：
- `submitSchemeExecution`
- `submitTowerApproachExecution`
- `approveExecution`
- `rollbackExecution`
- `reloadExecutions`

3. 不要删 `data-*` 定位属性

这些属性需保留：
- `data-execution-action`
- `data-scheme-key`

4. 不要改 BFF 返回结构，不要前端自造状态

不能把 UI 判断改成新的一套本地规则去覆盖：
- `gate`
- `reviewReadiness`
- `executionHub`
- `towerApproachAdvisor`
- `schemes[*].readiness`

## 建议的 UI 交付顺序

1. 第一轮
- 只做视觉和排版优化
- 不改交互路径
- 不删区块

2. 第二轮
- 压缩下半区重复按钮
- 把执行中心收敛成“状态 + 历史 + 回退边界”

3. 第三轮
- 补更清晰的风险表达
- 明确区分：
  - 观测值
  - 估计值
  - 建议目标
  - 可提交审批目标

## 推荐改造点

### A. 总判断卡
- 更大标题
- 更短摘要
- 只保留最多 2 行解释
- 把状态 pill 收到右上角或标题附近

### B. 主方案卡
- 把核心指标压成 2 到 4 个最关键数字
- 弱化长段策略说明
- 把“主方案摘要”改成更像“推荐理由”

### C. 阻塞项卡
- 优先显示真正阻断项
- 缺失信号和 checkpoint 分层显示
- 避免长列表直接堆满

### D. 动作台
- 主按钮 1 到 2 个
- 次按钮折叠或降权
- 对不可点击按钮给出简短原因，不要只灰掉

## 验收标准

UI 线程完成后，至少满足：

1. 首屏 10 秒内能回答三个问题
- 当前能不能推进
- 当前主方案是什么
- 当前先做哪个动作

2. 首屏按钮与实际门禁一致
- 不出现视觉上可点、逻辑上不可点的错觉

3. 首屏文字量显著下降
- 不再像“说明文档页”

4. 不破坏现有执行治理链
- 方案提交
- approach 提交
- 审批
- 回退
- 刷新
  这些动作仍按当前逻辑工作

5. `npm run build` 必须通过

## 交接建议

UI 线程开始前，先通读：
- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/styles/global.css`

优先关注：
- `buildDecisionState`
- `pickPrimaryScheme`
- 首屏 `SectionCard title="决策总览"`
- 下半区 `sectionExecutionHub`
- 方案区 `sectionSchemes`

如果 UI 线程要进一步拆组件，建议只拆展示组件，不要先动数据推导层。
