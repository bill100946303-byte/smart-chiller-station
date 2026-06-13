# GPT5.5 Pro 优化演示模块改进交接文件

## 1. 文件用途

本文件用于交给 GPT5.5 Pro 继续优化“高效能源站智慧平台”的 `/optimize-demo` 演示模块。

核心要求：

- 先理解当前平台真实架构，不推倒重来。
- 只在现有 `apps/chiller-bff + apps/chiller-shell-v1 + legacy 承接 + scripts/docs 治理` 主线内优化。
- 本轮唯一主对象是 `/optimize-demo` 优化演示模块，其他模块不动。
- 明确区分“治理态优化草案”和“真实优化引擎/真实控制下发”。
- 所有输出必须围绕中央空调冷站工程落地：稳定、安全、节能、可维护、可商业化。

## 1.1 本轮范围边界

本轮不是平台整体改版，也不是重新梳理所有页面。

唯一允许优化的业务对象：

- `/optimize-demo`
- `/bff/v1/sites/{siteId}/optimize`
- `/bff/v1/sites/{siteId}/optimize/executions`
- `/bff/v1/sites/{siteId}/optimize/tower-approach/executions`
- 与上述能力直接相关的文案、类型、局部样式、演示说明

其他模块只允许作为数据来源或上下文引用，不允许改动：

| 模块 | 本轮处理口径 |
| --- | --- |
| `/dashboard` | 不改页面、不改信息架构、不改接口消费 |
| `/login` | 不改 |
| `/alarms` | 不改 |
| `/devices` | 不改 |
| `/system-overview` | 不改 |
| `/scene-control` | 不改 |
| `/trend-analysis` | 不改 |
| `/projects` | 不改 |
| release/check-family/验收治理链 | 不改主流程，只可复用既有验收命令 |

若 GPT5.5 Pro 发现其他模块存在问题，只能记录为“后续观察项”，不得顺手修复。

## 2. 当前平台真实盘面

当前平台不是空白 demo，也不是适合重写的原型。它已经形成稳定主线：

| 层级 | 当前真实落点 | 作用 |
| --- | --- | --- |
| 前端 Shell | `apps/chiller-shell-v1` | React + Vite 新壳，承接已签收页面和演示页 |
| BFF | `apps/chiller-bff` | Node + Express 标准接口层，承接 legacy 数据、聚合服务、治理接口 |
| legacy | `legacy-src` / `legacy-src-full` / 8098 旧接口 | 旧系统数据、认证、2D/3D 静态资产来源 |
| 运维脚本 | `scripts`、`apps/chiller-bff/scripts` | 本地栈启动、合同校验、release/check-family、B25 smoke |
| 治理文档 | `docs` | 架构、字段、接口、签收、演示边界、运行态证据 |

已正式签收的演示主路径如下，仅作为平台上下文，不是本轮改造范围：

| 路由 | 状态 | 说明 |
| --- | --- | --- |
| `/dashboard` | 已签收 | 综合入口，聚合 overview / trends / anomalies / recommendations |
| `/login` | 已签收 | 真实 legacy 登录承接 |
| `/alarms` | 已签收 | 告警摘要与列表 |
| `/devices` | 已签收 | 设备列表、树、详情 |
| `/system-overview` | 已签收 | 系统骨架、现态摘要、规则诊断 |
| `/scene-control` | 已签收 | legacy 2D/3D 场景统一外壳 |
| `/trend-analysis` | 已签收 | 多序列趋势、stats、freshness/sourceStatus |
| `/optimize-demo` | 可演示，暂不正式签收 | 优化草案与执行治理链演示，不代表真实优化引擎已落地 |

## 3. Optimize Demo 当前能力边界

### 3.1 前端落点

- 页面：`apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- 样式：`apps/chiller-shell-v1/src/styles/global.css`
- DTO/请求封装：`apps/chiller-shell-v1/src/services/bffClient.ts`
- 路由：`/optimize-demo`

页面当前已经包含：

- 场景输入：`loadKw`、`outdoorTempC`、`mode=cooling`、`equipmentContext`
- 决策总览：门禁、总判断、主方案、阻塞项、执行前检查
- 动作台：主方案审批提交、接近度审批提交
- 基线现态：COP、总功率、冷冻/冷却温差、分项功率、告警数
- 历史对标：负荷区间、湿球匹配、样本数、参考 COP、当前差距
- 收益估算：目标 COP、目标功率、功率下降、机会等级、置信度
- 冷却塔接近度：当前/目标 Approach、目标 Tcws、边界 guardrails
- 执行中心：执行记录、审批、回退、刷新、历史
- 方案区：保守 / 平衡 / 效率优先方案、设备动作、准备度
- 证据区：命中规则、跳过规则、缺失指标

### 3.2 BFF 落点

- 主路由：`apps/chiller-bff/src/routes/v1.js`
- 草案服务：`apps/chiller-bff/src/services/optimizeService.js`
- 执行台服务：`apps/chiller-bff/src/services/optimizeExecutionService.js`
- 接近度调度适配器：`apps/chiller-bff/src/services/optimizeExecutionDispatchService.js`

关键接口：

| 方法 | 路径 | 当前状态 |
| --- | --- | --- |
| `POST` | `/bff/v1/sites/{siteId}/optimize` | 返回 `501 NOT_IMPLEMENTED`，但 `details` 是可演示的 context-backed draft |
| `GET` | `/bff/v1/sites/{siteId}/optimize/executions` | 查询方案/接近度执行记录 |
| `POST` | `/bff/v1/sites/{siteId}/optimize/executions` | 提交方案执行对象 |
| `POST` | `/bff/v1/sites/{siteId}/optimize/executions/{executionId}/approve` | 审批 |
| `POST` | `/bff/v1/sites/{siteId}/optimize/executions/{executionId}/rollback` | 回退 |
| `GET/POST` | `/bff/v1/sites/{siteId}/optimize/tower-approach/executions...` | 冷却塔接近度专用执行台 |

`POST /optimize` 当前输入：

```json
{
  "context": {
    "siteId": "126lnoffice"
  },
  "inputs": {
    "loadKw": 1200,
    "outdoorTempC": 32.5,
    "mode": "cooling",
    "equipmentContext": {
      "activeChillerIds": [],
      "activeChillerModels": []
    }
  }
}
```

`POST /optimize` 当前输出实际在错误体 `details` 内：

- `decision`
- `request`
- `recommendation`
- `gate`
- `baseline`
- `historyBenchmark`
- `benefitEstimate`
- `towerApproachAdvisor`
- `reviewReadiness`
- `executionFeedback`
- `schemes`
- `ruleEvidence`
- `freshness`
- `sourceStatus`
- `diagnostics`
- `executionHub`

必须保留当前口径：

- HTTP `501` 是设计口径，表示真实 optimize engine 尚未接入。
- `details` 是治理态草案，可演示输入、解释、证据、门禁、执行治理。
- 不能把当前 `systemCop / totalPowerKw / targetPowerKw` 说成真实优化求解结果。

## 4. 当前 Optimize 分层理解

| 层级 | 当前状态 | 可对外表达 | 不可越界表达 |
| --- | --- | --- | --- |
| L3 评审与草案 | 已落地 | 基于现态、规则、历史对标生成解释型草案 | 不是真实最优解 |
| L3.6 执行治理台 | 已落地 | SQLite 持久化、审批/回退、审计链 | 不等于 PLC 控制闭环 |
| L4 冷却塔接近度半自动 | phase 1/2 已落地，phase 3 未完成 | 接近度建议、执行前检查、治理态审批/调度适配器 | 不能说已完成真实现场下发 |
| L5 自适应全自动 | 未开始 | 远期方向 | 当前不做 |

当前 L4 真正阻塞点：

- 不是“补一个 URL”。
- 而是缺 `targetApproachC / targetTcwsC -> drTypeId / drId / tagName / msg` 的控制点位映射契约。
- 真实 legacy 控制接口当前可确认是 `GET /zsqy/qstag/{siteId}/doimplements`，需要设备级上下文。
- 现场必须先按 `docs/TOWER_APPROACH_CONTROL_MAPPING_TEMPLATE_CURRENT.md` 补映射，再进入 `shadow`，最后才评估 `enforced`。

## 5. 需要 GPT5.5 Pro 重点注意的风险

| 风险 | 当前表现 | 改进方向 |
| --- | --- | --- |
| Demo 被误解成真实优化 | `/optimize-demo` 内容很丰富，容易让甲方误以为已接真优化引擎 | 首屏继续明确“治理态草案 / 未下发 / 需审批” |
| 输入命名歧义 | BFF 字段叫 `outdoorTempC`，但 L4 接近度算法实际需要湿球温度 `Twb` | 后续建议做兼容式字段升级：新增 `outdoorWetBulbC`，保留旧字段兼容，UI 明确显示湿球/干球 |
| 估计值和可执行值混淆 | 页面同时展示历史估计、方案目标、接近度目标、执行对象 | 强化四类标签：观测值、估计值、建议目标、可提交审批目标 |
| 信息密度过高 | 首屏和下半区存在重复说明、重复按钮、工程说明较多 | 首屏压缩为“能不能推进 / 主方案 / 下一动作 / 硬阻塞” |
| 执行治理被误读为控制闭环 | 审批/回退/dispatch 回执存在，但真实点位映射未完成 | 执行台必须标注 dispatch mode：off / shadow / enforced，以及是否真实写入 |
| 文档时差 | 早期文档仍称 `/optimize` 未纳入主合同，后续阶段文档显示已纳管并 example 数为 16 | GPT5.5 Pro 改动前必须以当前 `bff-v1.yaml`、`package.json`、`STAGE_REPORT_CURRENT.md` 为准 |

## 6. 建议 GPT5.5 Pro 优化任务包

### 6.1 P0：只做演示表达优化，不改控制语义

目标：

- 让 `/optimize-demo` 首屏 10 秒内回答三个问题：
  1. 当前能不能推进？
  2. 当前主方案是什么？
  3. 下一步动作是什么？

建议改动：

| 项 | 建议 |
| --- | --- |
| 总判断 | 压成一个强状态条：`可评审 / 谨慎评审 / 禁止推进` |
| 主方案 | 只显示方案名、目标 COP、目标功率、准备度、主要风险 |
| 阻塞项 | 只列硬阻塞，检查项放次级 |
| 动作台 | 保留 1-2 个主动作，其他审批/回退保留在执行记录区 |
| 标签体系 | 每个关键数值加 `观测值 / 估计值 / 建议目标 / 审批目标` |
| 证据区 | 默认折叠，保留规则命中/跳过详情 |

允许改动文件：

- `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- `apps/chiller-shell-v1/src/styles/global.css` 中仅限 `.optimize-*` 相关选择器
- 必要时补 `apps/chiller-shell-v1/src/i18n/zhCN.ts`

禁止改动：

- 执行按钮门禁逻辑
- `data-execution-action`
- `data-scheme-key`
- `submitSchemeExecution / submitTowerApproachExecution / approveExecution / rollbackExecution`
- BFF 返回结构
- 其他已签收页面
- 全局布局、导航、认证、项目切换逻辑

验收：

- `npm --prefix apps/chiller-shell-v1 run build`
- 不出现视觉上可点、逻辑上不可点的错觉
- `readOnlyMode` 下执行类按钮必须保持不可用

### 6.2 P1：优化草案 v2 的工程可信度

目标：

- 让 `POST /optimize` 的 draft 更像“冷站节能工程评审包”，而不是说明文。

建议增强：

| 方向 | 建议 |
| --- | --- |
| 输入字段 | 引入 `outdoorWetBulbC`，兼容 `outdoorTempC`，响应中明确 `weatherBasis=wetBulb/dryBulb/fallback` |
| 目标函数 | 在 draft 中显式输出 `objective=P_chiller+P_chwp+P_cwp+P_tower` |
| 约束 | 输出 `constraints[]`：告警、freshness、热平衡、最低冷凝器进水温、最小塔频率、最小启停间隔 |
| 方案解释 | 每个 `scheme` 增加“推荐原因 / 不推荐原因 / 适用工况 / 禁止条件” |
| 设备动作 | 将冷机、冷冻泵、冷却泵、冷却塔分组，避免动作列表混杂 |
| 证据链 | 每个方案绑定 `evidenceRefs`，引用 overview、historyBenchmark、recommendations、executionFeedback |

允许改动文件：

- `apps/chiller-bff/src/services/optimizeService.js`
- `apps/chiller-shell-v1/src/services/bffClient.ts`
- `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- `docs/OPTIMIZE_*`

约束：

- `apps/chiller-shell-v1/src/services/bffClient.ts` 只允许补 optimize 相关 DTO 和请求方法。
- `apps/chiller-bff/src/routes/v1.js` 如需改动，只能改 optimize 路由段。
- 不得改 dashboard、alarm、device、trend、scene、login 相关 service、adapter、页面和 route 行为。

验收：

- `npm --prefix apps/chiller-bff test`
- `npm --prefix apps/chiller-bff run check:contract`
- `npm --prefix apps/chiller-bff run check:optimize-l3-smoke`
- `npm --prefix apps/chiller-shell-v1 run build`

### 6.3 P1：L4 接近度真实联调前置准备

目标：

- 不直接下发控制，而是把“策略目标到真实控制点位”的契约补齐。

建议产物：

1. `docs/TOWER_APPROACH_CONTROL_MAPPING_B25_DRAFT.md`
2. `docs/TOWER_APPROACH_SHADOW_DISPATCH_CHECKLIST.md`
3. `apps/chiller-bff/openapi/examples/tower-approach-control-mapping.json`

必须明确：

- 控制对象是 `targetTcwsC` 还是 `targetApproachC`
- 是否需要先由 `Twb + Approach_sp` 换算为 `Tcws_sp`
- 多塔并联时是统一设定、逐塔设定还是按塔负荷分配
- 回退目标是提交前现态、固定保底值还是人工模式
- legacy HTTP 200 是否代表真实执行成功

禁止：

- 在没有点位映射前把 dispatch mode 默认改成 `enforced`
- 让 UI 显示“已真实下发”
- 绕开 PLC/现场安全边界
- 借 L4 联调准备去重构场景页、设备页或 legacy 页面

### 6.4 P2：真实 optimize engine 技术设计

目标：

- 形成后续真实优化引擎的技术路线，但不立即替换当前 draft。

推荐设计：

| 模块 | 说明 |
| --- | --- |
| 输入标准化 | 站点现态、历史样本、天气、设备状态、运行约束 |
| 候选方案生成 | 保守 / 平衡 / 效率优先，多候选而不是单点建议 |
| 目标函数 | 最小化 `P_total = P_chiller + P_chwp + P_cwp + P_tower`，同时约束供冷能力和温差 |
| 约束求解 | 冷机最低冷凝器进水温、主机负荷率、泵最小频率、塔最小频率、启停延时 |
| 离线学习 | 历史高效工况分箱：负荷率、湿球、冷却水温、COP、分项功率 |
| 在线优化 | 规则门禁先行，AI/模型只给目标值，PLC 最终执行 |
| 验证 | A/B 对比、同工况对标、回采验证、异常回退 |

建议先输出设计文档，不直接改执行代码：

- `docs/OPTIMIZE_ENGINE_DESIGN_CURRENT.md`
- `docs/OPTIMIZE_ENGINE_ACCEPTANCE_CRITERIA_CURRENT.md`

边界：

- 真实 optimize engine 设计仍属于优化演示模块的下一阶段输入。
- 不以此为理由新增全站工作台、新 dashboard、新趋势页或新设备页。

## 7. GPT5.5 Pro 开工前必须读取的文件

按优先级读取：

1. `docs/STAGE_REPORT_CURRENT.md`
2. `docs/DEMO_ROUTES_CURRENT.md`
3. `docs/ARCHITECTURE_CURRENT.md`
4. `docs/API_SURFACE_CURRENT.md`
5. `docs/OPTIMIZE_DEMO_UI_THREAD_BRIEF_CURRENT.md`
6. `docs/OPTIMIZE_DRAFT_CLOSEOUT_CURRENT.md`
7. `docs/COOLING_TOWER_APPROACH_L4_PLAN_CURRENT.md`
8. `docs/TOWER_APPROACH_CONTROL_MAPPING_TEMPLATE_CURRENT.md`
9. `apps/chiller-bff/src/services/optimizeService.js`
10. `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
11. `apps/chiller-shell-v1/src/services/bffClient.ts`
12. `apps/chiller-bff/src/routes/v1.js`

## 8. 建议 GPT5.5 Pro 输出格式

GPT5.5 Pro 不应只给泛泛建议，应输出下面四类之一：

### A. UI 改进方案

必须包含：

- 当前首屏问题
- 新首屏信息层级
- 需要改的组件/函数/class
- 不改的门禁逻辑
- 验收截图/构建命令

### B. BFF draft v2 方案

必须包含：

- 输入字段升级策略
- response schema 差异
- 兼容旧字段方式
- 单测/合同/example 更新点
- 不接真实控制的声明

### C. L4 接近度联调准备方案

必须包含：

- 控制目标
- 输入变量
- 输出控制量
- 防震荡机制
- 异常保护逻辑
- PLC 可实现伪代码
- 点位映射表
- shadow/enforced 切换条件

### D. 真实优化引擎设计

必须包含：

- 算法目标函数
- 约束条件
- 输入数据字段
- 输出控制建议
- 在线优化逻辑
- 离线训练逻辑
- 数据质量要求
- 异常值处理
- 模型验证方法
- 节能量评估方法

## 9. 验收命令建议

视改动范围选择，不要无脑全跑：

```bash
npm --prefix apps/chiller-shell-v1 run build
npm --prefix apps/chiller-bff test
npm --prefix apps/chiller-bff run check:contract
npm --prefix apps/chiller-bff run check:optimize-l3-smoke
npm --prefix apps/chiller-bff run check:optimize-smoke-suite
```

本地运行栈：

```bash
./scripts/start_local_stack.sh
```

注意：

- 当前工作树可能有大量既有修改，不要重置。
- 如果 smoke 因本地端口、浏览器、沙盒网络失败，需区分环境限制和业务回归。
- `check:optimize-smoke-suite:controls:required` 在只读环境下失败是预期边界，不应误判。

## 10. 最终主控判断

GPT5.5 Pro 的最佳改进方向不是“把 `/optimize-demo` 包装成已完成的 AI 控制系统”，而是：

1. 把演示页表达做得更清楚、更像工程决策台。
2. 把草案输出做得更像冷站节能评审包。
3. 把接近度 L4 的真实联调缺口收敛到点位映射和 shadow 验证。
4. 把真实 optimize engine 作为下一阶段设计，不要越权进入自动控制。

一句话：

当前 `/optimize-demo` 应升级为“高可信优化评审与半自动治理演示台”，而不是伪装成“已完成真实闭环控制的 AI 优化引擎”。
