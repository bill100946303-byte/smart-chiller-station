# 当前线程规则

## 目的

本文档用于固定当前智慧冷冻站项目的多线程协作边界，避免：

- 多线程同时改同一批核心文件
- 文档结论跑在代码前面或代码已更新而文档未同步
- 页面线程直接越权改合同
- 合同线程直接越权改页面逻辑

当前项目已经不是探索态，规则目标是：

- 保持主线稳定
- 降低文件冲突
- 让主控收口更快

## 总原则

1. 不推倒重来
2. 线程按“主题边界”分工，不按“谁能改就谁改”分工
3. 页面、合同、字段、文案可以并行评审，但主控统一收口
4. 对外 contract、路由、运行脚本、总状态文档默认由主控线程最终落地
5. 线程产物优先是文档、字段包、评审结论；主控再决定是否落代码

## 线程分类

### 1. UI-Design 线程

职责：

- 页面结构方案
- 真实页面复验
- 截图与可演示/可签收判断
- 桌面端/移动端状态落点说明

允许修改：

- `docs/ui-*.md`
- `docs/sprint*-*ui*.md`
- `docs/screenshots/*`

默认不直接修改：

- `apps/chiller-shell-v1/src/pages/*`
- `apps/chiller-shell-v1/src/styles/*`
- `apps/chiller-bff/*`

说明：

- UI 线程给“能否开发/能否演示/能否签收”的判断
- 真正页面代码默认由主控落

### 2. Data-Model 线程

职责：

- 字段包
- 字段 ready/partial/missing 判断
- legacy 字段到 BFF 字段的映射
- 观察项与阻断项区分

允许修改：

- `docs/*field*.md`
- `docs/*field*.csv`
- `docs/*data-pack*.md`
- `docs/*data-pack*.csv`

默认不直接修改：

- `apps/chiller-bff/src/routes/*`
- `apps/chiller-bff/src/services/*`
- `apps/chiller-shell-v1/src/services/*`

说明：

- Data-Model 线程可以定义字段边界
- 不能直接把“字段建议”改成最终 contract

### 3. BFF-Contract 线程

职责：

- contract 草案
- example 结构建议
- regression / closeout / signoff 文档
- query 参数、schema、纳管结论

允许修改：

- `docs/*contract*.md`
- `docs/*regression*.md`
- `docs/*closeout*.md`

默认不直接修改：

- `apps/chiller-bff/src/routes/v1.js`
- `apps/chiller-bff/src/services/*`
- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/scripts/check-contract.js`

说明：

- BFF-Contract 线程负责定义“应该是什么”
- 主控负责把它变成真实 contract 和门禁

### 4. HVAC-Rules / Copy 线程

职责：

- 三语文案
- 值班口径
- 演示/签收话术
- 页面状态说明

允许修改：

- `docs/hvac-*.md`
- `docs/hvac-*.json`
- `docs/sprint*-*copy*.md`
- `docs/sprint*-*copy*.json`
- `docs/*demo-decision*.md`

默认不直接修改：

- `apps/chiller-shell-v1/src/i18n/*`
- `apps/chiller-shell-v1/src/pages/*`
- `apps/chiller-bff/*`

说明：

- 文案线程负责“怎么讲”
- 主控负责把最终词落到代码

## 主控线程职责

主控线程负责：

- 业务代码最终落地
- 路由和 service 改动
- OpenAPI 主合同改动
- example 纳入
- `check-contract` / 运行链 / build / runtime 复验
- `docs/v19.2-master-status.md` 最终记账
- 冲突结论裁定

以下文件默认只由主控线程最终收口：

- `apps/chiller-bff/src/routes/v1.js`
- `apps/chiller-bff/src/services/*`
- `apps/chiller-bff/src/adapters/*`
- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/openapi/examples/*`
- `apps/chiller-bff/scripts/check-contract.js`
- `apps/chiller-shell-v1/src/pages/*`
- `apps/chiller-shell-v1/src/services/auth.ts`
- `apps/chiller-shell-v1/src/services/bffClient.ts`
- `apps/chiller-shell-v1/src/i18n/*`
- `apps/chiller-shell-v1/src/styles/global.css`
- `docs/v19.2-master-status.md`
- `docs/*SIGNOFF_DECISION_CURRENT.md`

## 禁止并发修改区

以下区域不允许多个线程同时并改：

### A. BFF 路由/合同区

- `apps/chiller-bff/src/routes/v1.js`
- `apps/chiller-bff/openapi/bff-v1.yaml`
- `apps/chiller-bff/scripts/check-contract.js`

原因：

- 这里一改就会影响全局 contract 和门禁

### B. 页面核心区

- `apps/chiller-shell-v1/src/pages/AlarmPage.tsx`
- `apps/chiller-shell-v1/src/pages/TrendAnalysisPage.tsx`
- `apps/chiller-shell-v1/src/pages/DeviceOverviewPage.tsx`
- `apps/chiller-shell-v1/src/pages/SceneControlPage.tsx`
- `apps/chiller-shell-v1/src/pages/SystemOverviewPage.tsx`
- `apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx`
- `apps/chiller-shell-v1/src/App.tsx`
- `apps/chiller-shell-v1/src/layout/AppShell.tsx`

原因：

- 页面主线经常连续迭代
- 多线程并改最容易造成 UI 评审结论过时

### D. 认证与签收口径区

- `apps/chiller-shell-v1/src/services/auth.ts`
- `docs/LOGIN_SIGNOFF_DECISION_CURRENT.md`
- `docs/DASHBOARD_SIGNOFF_DECISION_CURRENT.md`
- `docs/SYSTEM_OVERVIEW_SIGNOFF_DECISION_CURRENT.md`

原因：

- 认证入口与签收文档会直接影响对外口径
- 不允许文档线程直接改成与主控实跑冲突的结论

### C. 总状态区

- `docs/v19.2-master-status.md`

原因：

- 这是唯一主控账本
- 不允许线程直接并改

## 推荐工作方式

### 评审线程输出什么

线程优先输出：

- 评审文档
- 字段包
- contract 草案
- 文案 JSON
- signoff / demo 结论

不优先输出：

- 大范围业务代码
- 主合同主门禁改动

### 主控如何接线程结果

主控顺序应为：

1. 读线程回执
2. 判断哪些可签收
3. 只改必要代码
4. 实跑 build / contract / runtime
5. 回写总状态

### 冲突处理原则

如果线程文档与主控真实运行态冲突：

- 以主控实跑结果为准
- 线程文档重跑，不倒逼代码回退

典型冲突包括：

- 文档仍写 `404`，但接口已 `200`
- 文档仍写 `no demo`，但真实页面已可用
- 文档仍写 `未纳入主门禁`，但 `check:contract` 已覆盖

## Worktree / 并行建议

当前项目适合：

- 文档线程并行
- 主控代码线串行收口

推荐：

- UI / Data / Contract / Copy 可并行出评审结论
- 主控统一落代码

不推荐：

- 多个线程同时直接改 `pages + openapi + routes`

## 当前治理是否可以直接执行

结论：

- 可以

理由：

- 当前项目已经形成稳定主线和收口习惯
- 只需要把这些口头规则固化成文档
- 后续融合治理和新增页面都可以直接按这份执行

补充说明：

- 当前规则已覆盖最新主线：`login / system-overview / scene-control / optimize-demo`
- 后续如新增 `simulate` 或 `assistant/query`，应先补本文再开实现线程
