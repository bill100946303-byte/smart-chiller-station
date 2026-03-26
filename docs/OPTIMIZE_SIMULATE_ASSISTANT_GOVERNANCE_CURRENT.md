# OPTIMIZE_SIMULATE_ASSISTANT_GOVERNANCE_CURRENT

## 1. 目标

本文用于固定当前仓库对以下三类未来能力的治理边界：

- `/bff/v1/sites/{siteId}/optimize`
- `/bff/v1/sites/{siteId}/simulate`
- `/bff/v1/sites/{siteId}/assistant/query`

当前口径不是立即实现，而是：

- 先把命名、落点、线程边界、进入条件定死
- 避免后续为了“新能力”打散已经稳定的 `BFF + Shell + legacy` 主结构

## 2. 当前结论

当前建议：`预留治理，暂不实现`

理由：

- 当前已正式签收主线仍是：
  - 告警页
  - 设备页
  - 设备页二期
- 趋势页当前已转为：
  - `可演示`
  - `正式验收挂起`
- 当前项目更需要稳定字段语义、接口边界和治理规则，而不是立刻再引入高耦合能力

## 3. 三类能力的定位

### 3.1 `/optimize`

定位：

- 给出“当前工况下的优化建议”或“推荐运行组合”

不等同于：

- 直接控制设备
- 直接写 PLC
- 直接改现有 recommendations 页面逻辑

当前约束：

- 只能作为站点级计算或建议接口
- 输入必须显式，不允许偷偷依赖页面临时状态

### 3.2 `/simulate`

定位：

- 对给定输入工况、设备组合或控制参数做仿真/推演

不等同于：

- 真实控制下发
- 实时联机调度

当前约束：

- 必须与 `/optimize` 分开
- 不能把“推荐结果”和“仿真结果”混成同一个接口

### 3.3 `/assistant/query`

定位：

- 站点级问答/解释接口
- 将当前已稳定的数据面、规则面、状态面转成可读回答

不等同于：

- 任意聊天入口
- 无边界调用 legacy 全量数据

当前约束：

- 回答必须受 `siteId` 作用域约束
- 必须复用已有字段语义，不得临时创造另一套命名

## 4. 当前仓库中的推荐落点

### 4.1 BFF

推荐继续沿当前结构增量扩展：

- route：
  - `apps/chiller-bff/src/routes/v1.js`
- service：
  - `apps/chiller-bff/src/services/optimizeService.js`
  - `apps/chiller-bff/src/services/simulateService.js`
  - `apps/chiller-bff/src/services/assistantService.js`
- adapter：
  - 仅在确有 legacy 或外部数据源需要时新增，不提前造空 adapter

### 4.2 OpenAPI

统一落在：

- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/openapi/examples/*`

当前要求：

- 可以先写“预留合同文档”
- 暂不把这三条路径硬塞进主合同和 `check:contract`

### 4.3 Shell

如需未来演示页，只允许在现有 shell 内新增路由：

- `/optimize-demo`
- `/simulate-demo`
- `/assistant-demo`

不建议：

- 另开一个前端主项目
- 另开一个“实验性站点”壳层

## 5. 进入实现前必须满足的前提

### 5.1 `/optimize`

进入实现前至少要满足：

1. `FIELD_MAPPING_CURRENT.md` 持续稳定，无大范围字段漂移
2. 设备与趋势主数据可被稳定读取
3. recommendation/ruleEngine 的现有规则边界已明确

### 5.2 `/simulate`

进入实现前至少要满足：

1. `/optimize` 的输入输出边界已稳定
2. 仿真输入项已从页面字段中独立出来
3. 不再依赖模糊“当前页面状态”

### 5.3 `/assistant/query`

进入实现前至少要满足：

1. 字段口径与接口面不再靠口头维护
2. 线程治理已稳定执行
3. 能清楚回答“助手可引用哪些来源，不可引用哪些来源”

## 6. 明确不做的事

当前阶段明确不做：

- 不直接实现 `/optimize`
- 不直接实现 `/simulate`
- 不直接实现 `/assistant/query`
- 不为这三类能力新建平行 `api/` 或 `core/` 主项目
- 不为了“新架构”批量迁移现有 `services / routes / adapters`

## 7. 线程边界

如果未来进入实现，应按以下边界推进：

- `Data-Model`
  - 只定字段、单位、空值/回退策略
- `BFF-Contract`
  - 只定路径、schema、example、主门禁策略
- `UI-Design`
  - 只定页面/演示页信息架构
- `HVAC-Rules`
  - 只定值班口径、可解释文本、规则性说明
- `主控`
  - 决定是否从“预留治理”切换到“真实实现”
  - 决定哪些文件允许开始动

## 8. 当前主控建议

当前最合理的推进顺序是：

1. 继续维持预留治理，不进入实现
2. 若要开始做，先从 `/optimize` 开始
3. `/simulate` 放在 `/optimize` 之后
4. `/assistant/query` 放在字段与规则沉淀更稳后

一句话：

- 当前这三条能力已经“被允许存在”
- 但还没有“被允许直接开工实现”
