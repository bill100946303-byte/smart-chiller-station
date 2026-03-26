# GPT-5.4 融合建议评审稿 v1

## 结论

可以融合，而且建议融合。

但不能照抄原建议里的技术形态。

当前仓库的真实主轴是：

- `apps/chiller-bff`
- `apps/chiller-shell-v1`
- `scripts`
- `docs`
- legacy 旧接口承接

所以这次融合应理解为：

- 保留当前可运行主仓库
- 吸收 GPT-5.4 给出的“分层改造原则”
- 把建议改写成适配当前 Node/Web/BFF 架构的项目方案

不是：

- 新开 Python/FastAPI 主项目
- 新建一套平行目录强行替换现有 `apps/*`
- 一次性大迁移

## 哪些建议应直接吸收

以下建议方向正确，且适合当前项目：

1. 不推倒重来
2. 旧系统做内核，新系统做壳和扩展
3. 先统一接口，再升级页面
4. 旧页面与新页面并存，不做一次性替换
5. 线程分工清晰，避免多人/多线程同时改同批文件
6. 先做最小演示链路，再做重能力扩展

这些原则，和当前项目已经走出来的路径是一致的：

- 告警页：已签收
- 设备页：已签收
- 趋势页：可演示，待上游数据增强后再签收
- `release-command-center` 一整条值班/发布链已成型

## 哪些建议需要改写后使用

GPT-5.4 原建议里这些内容不能直接照搬：

### 1. `core/ api/ web/` 目录重组

这套目录对一个 Python 单体项目是合理的，但当前仓库已经稳定在：

- `apps/chiller-bff`
- `apps/chiller-shell-v1`

所以更合适的改写方式是：

- 在 `apps/chiller-bff/src/services` 里逐步沉淀统一服务入口
- 在 `apps/chiller-bff/src/adapters` 里继续隔离 legacy 来源
- 在 `apps/chiller-shell-v1/src/pages` 里继续做新页面迁移
- 在 `docs` 里补架构、字段、线程边界文档

也就是说：

- 不改成 `api/main.py`
- 不新造一个 `web/`
- 而是在现有 `apps/*` 内做分层收口

### 2. `FastAPI / optimize() / simulate() / assistant_query()`

这组接口思想是对的，但当前项目不应先变成一个新的优化平台。

更合理的改写是：

- 继续以现有 BFF 作为标准接口层
- 后续若确实存在“冷站优化引擎”或“策略计算入口”，再在 `chiller-bff` 内补统一 service

适合当前项目的话术应改成：

- `dashboard/overview`
- `dashboard/trends`
- `anomalies/summary`
- `anomalies/list`
- `devices/list`
- `devices/tree`
- `devices/{deviceId}`

后续如果新增“优化/仿真/助手”能力，再在现有 BFF 下扩展：

- `/bff/v1/sites/{siteId}/optimize`
- `/bff/v1/sites/{siteId}/simulate`
- `/bff/v1/sites/{siteId}/assistant/query`

### 3. 新建 `/station-demo`

这个思路值得保留，但当前仓库已经有更现实的替代物：

- `/dashboard`
- `/trend-analysis`
- `/alarms`
- `/devices`

所以当前阶段不必急着加一个新的 `station-demo` 路由。

更适合的做法是：

- 把已有新页面继续做深
- 等需要统一对外演示时，再考虑补一个总演示页

## 建议新增的 4 份项目文档

GPT-5.4 提到的文档方向是对的，建议吸收，但改成适配当前项目的名字。

建议新增：

1. `docs/ARCHITECTURE_CURRENT.md`
   - 当前仓库分层
   - `chiller-bff / chiller-shell-v1 / legacy / scripts / docs` 的边界
   - 哪些能力已经迁移完成
   - 哪些能力仍依赖 legacy

2. `docs/FIELD_MAPPING_CURRENT.md`
   - 当前 BFF 对外字段
   - legacy 原字段/上游来源
   - UI 展示名
   - 单位和空值策略

3. `docs/API_SURFACE_CURRENT.md`
   - 当前已纳管接口
   - 页面到接口映射
   - 哪些是已签收接口
   - 哪些仍是二期或观察态

4. `docs/THREAD_RULES_CURRENT.md`
   - 哪些线程只动页面
   - 哪些线程只动合同
   - 哪些线程只动字段/文案
   - 哪些目录禁止跨线程并改

## 建议开的新线程

可以开新线程，但建议不要开成“新架构重写线程”，而是开成“融合评审线程”。

建议先开这 2 条：

### 线程 1：融合改造评审线程

目标：

- 盘点当前仓库已有模块
- 标出哪些可保留
- 标出哪些适合继续抽象为统一服务
- 输出当前项目适配版融合方案

这个线程是战略层，不直接改业务代码。

### 线程 2：字段与接口边界线程

目标：

- 统一当前页面迁移线已经形成的字段口径
- 形成“legacy 来源 -> BFF 字段 -> UI 显示名”的固定映射
- 为后续 optimize/simulate/assistant 扩展预留一致命名

这个线程是中间层，不直接重构页面。

## 不建议现在做的事

1. 不建议新起一个平行项目目录来重写主系统
2. 不建议把当前仓库硬切成 Python/FastAPI 主体
3. 不建议现在就引入大规模“优化引擎平台化”改造
4. 不建议多个线程同时动 `apps/chiller-bff/src/routes` 和 `apps/chiller-shell-v1/src/pages`

## 当前最合理的融合顺序

1. 保持现有迁移成果不回退
   - 告警页保持已签收
   - 设备页保持已签收
   - 趋势页保持可演示状态

2. 先补“架构/字段/线程规则”文档

3. 再评估是否需要把部分能力抽成更统一的 service 层

4. 最后再讨论：
   - 优化引擎统一入口
   - AI 助手
   - 3D 场景外壳

## 主控建议

对于当前项目，最正确的吸收方式不是：

- “按 GPT-5.4 的话原样重构”

而是：

- “按 GPT-5.4 的分层原则，给现有仓库补治理文档和服务边界”

一句话：

当前项目应采用“治理式融合”，不是“重构式融合”。
