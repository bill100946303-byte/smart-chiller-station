# 旧页面迁移 UI 计划 v1

目标：基于旧系统现有页面与发布包结构，为新壳确定下一批页面迁移优先级，并给出页面壳层方案。  
本轮聚焦 4 页：

1. 告警页
2. 设备总览页
3. 趋势分析页
4. 2D/3D 场景控制页

## 依据

- 旧系统识别结论：`/Users/billchow/Documents/chiller-station-legacy/docs/system-findings.md`
- 旧前端为 Vue 发布包：`/Users/billchow/Documents/126lnoffice/web/vue_dist`
- 旧 2D/3D 为独立静态子应用：
  - `2d_dist/floor10|floor11`
  - `3d_build/floor10|floor11`
- 新系统视觉方向：高端控制台、工业科幻、风险可视、收益可视
- 新系统当前壳层已冻结三页：`Login / Dashboard / SystemOverview`

## 总体迁移原则

### 1. 先迁“高频操作页”，再迁“展示型深页面”

- 与值班、监控、诊断直接相关的页面优先
- 能复用新壳数据口径与组件体系的页面优先
- 仅承担展示或炫技作用、且独立资产较重的页面延后

### 2. 先统一页面壳层，再决定内部模块是否重做

- 页面标题、状态条、来源状态、操作区统一进入新壳
- 旧系统里杂糅的按钮区、搜索区、树表混排结构，不直接平移
- 先把“入口体验”统一，再逐步替换旧模块

### 3. 2D/3D 与常规业务页分轨处理

- 常规业务页：用新壳原生重做
- 2D/3D：先保留旧资产嵌入，后续再考虑原生替换

## 迁移优先级排序

### P1. 设备总览页

优先级理由：
- 与当前 `SystemOverview` 最接近，迁移阻力最低
- 设备树、设备状态、节点详情是值班高频入口
- 能直接承接“冷站能效操作系统”的运行态表达

### P2. 告警页

优先级理由：
- 是值班闭环里最刚需的操作页
- 可直接接入现有异常/规则诊断/风险标签体系
- 能补齐新壳现在“发现风险后如何展开处理”的缺口

### P3. 趋势分析页

优先级理由：
- 已有 `Dashboard` 趋势模块，可延展但不必马上独立成页
- 适合在 P1/P2 完成后，再做深度分析页
- 对外展示价值高，但值班刚需低于设备与告警

### P4. 2D/3D 场景控制页

优先级理由：
- 旧资产独立、技术栈异构（2D 为 meta2d，3D 为 React/WebGL）
- 迁移成本最高，且容易打断当前新壳一致性
- 更适合先接成“壳内嵌入页”，而不是马上重做

## 每页迁移方案

## 1) 告警页

### 保留什么

- 按风险等级排序的主列表
- 时间、来源、对象、等级、状态这些核心字段
- 与设备/节点联动跳转的能力

### 重做什么

- 顶部摘要区：改成 `告警总数 / 高危 / 未处理 / 近24h变化`
- 列表区：统一为新壳 `SectionCard + StatusPill + FilterBar`
- 详情侧栏：统一成抽屉或右侧详情面板，不再沿用旧式弹窗堆叠
- 与规则诊断联动：增加“是否由规则/来源状态触发”的解释位

### 暂不做什么

- 不先迁复杂报表导出
- 不先迁多层历史检索面板
- 不先迁旧系统里低频的批量管理动作

### 新壳布局建议（模块级）

1. `AlertOverviewHeader`
2. `AlertSummaryStrip`
3. `AlertFilterBar`
4. `AlertListPanel`
5. `AlertDetailDrawer`

## 2) 设备总览页

### 保留什么

- 设备树/分组结构
- 设备运行状态、在线离线、告警态
- 节点详情与设备基础指标

### 重做什么

- 左侧树 + 右侧详情的阅读结构
- 将旧系统“设备管理”中偏后台表单的部分剥离
- 强化拓扑、状态、风险和动作建议的联动关系
- 与 `SystemOverview` 统一命名和状态色口径

### 暂不做什么

- 不先迁配置管理、台账式编辑入口
- 不先迁过深的设备参数维护页
- 不先做复杂权限视图切换

### 新壳布局建议（模块级）

1. `DeviceOverviewHeader`
2. `DeviceTreePanel`
3. `DeviceStatusBoard`
4. `DeviceDetailPanel`
5. `DeviceRelatedAlerts`

## 3) 趋势分析页

### 保留什么

- 多指标趋势对比
- 时间范围切换
- 指标图例与基础统计

### 重做什么

- 从旧“能耗分析”逻辑里拆出“值班可读”的趋势页
- 将页面定位从“报表页”改成“诊断分析页”
- 图表与解释联动：图上波动 -> 下方原因/建议
- 统一到新壳图表规范，不保留旧式多面板拼贴感

### 暂不做什么

- 不先迁报表导出与打印态
- 不先迁所有历史维度
- 不先做多层嵌套筛选器

### 新壳布局建议（模块级）

1. `TrendAnalysisHeader`
2. `TrendRangeToolbar`
3. `TrendComparePanel`
4. `MetricInsightPanel`
5. `TrendRecommendationPanel`

## 4) 2D/3D 场景控制页

### 保留什么

- 旧 2D/3D 资产本体
- 楼层切换
- 节点点击/查看基础状态能力

### 重做什么

- 外层壳：统一新壳 Header、Badge、Source Banner、语言切换
- 新增“场景模式”容器页，而不是把旧资产裸露成独立入口
- 为 2D/3D 外层补状态摘要、楼层切换、退出/回到系统总览

### 暂不做什么

- 不立刻重写 2D/3D 引擎
- 不立刻把所有 3D 交互改成原生 React 组件
- 不在第一阶段做复杂控制台级联动

### 新壳布局建议（模块级）

1. `SceneControlHeader`
2. `SceneModeSwitcher`
3. `SceneStatusOverlay`
4. `SceneLegacyEmbedFrame`
5. `SceneDetailSidePanel`

## 是否继续嵌入旧 2D/3D 资产

建议：`继续嵌入，作为阶段性方案`

理由：
- 旧 2D 为独立 `meta2d` 静态应用，带本地 `data.json`
- 旧 3D 为独立 React/WebGL 打包产物
- 它们都更像“子应用资产”，不是可以轻量拆解进新壳的小组件
- 现在直接重写，成本高且会拖慢主业务页迁移

阶段建议：
- Phase 1：新壳包裹 + iframe/独立路由嵌入
- Phase 2：抽公共状态与节点选中逻辑
- Phase 3：再决定是否做原生替换

## 页面壳层统一建议

这 4 页进入新壳后，统一遵守：

1. 顶部固定 `PageTitle + ReadinessBadge + Source Banner`
2. 主体始终保持“左导航 + 中主内容 + 右详情/抽屉”的控制台结构
3. 状态统一用 `good / warn / danger / neutral`
4. 图表、树、列表都走现有 token，不引入旧系统高亮色混用

## 推荐的第一阶段迁移顺序

先迁 2 页：

1. `设备总览页`
2. `告警页`

原因：
- 两页都直接服务值班与日常操作
- 都能最大化复用当前 `SystemOverview / Dashboard / Rule Skip / Source Banner` 体系
- 做完这两页后，趋势分析与场景控制都有更稳定的壳层承接点

## 本轮证据图

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/page-migration-ui-plan-v1-legacy-shell-evidence.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/page-migration-ui-plan-v1-device-alarm-priority.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/page-migration-ui-plan-v1-trend-analysis-plan.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/page-migration-ui-plan-v1-scene-embed-plan.png`
