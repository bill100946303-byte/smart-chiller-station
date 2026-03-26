# 冷站系统 2.0 UI 高保真规范 V1（冻结稿）

## 1. 适用范围与冻结边界

- 适用页面：`LoginPage`、`DashboardPage`、`SystemOverviewPage`
- 适用项目：`apps/chiller-shell-v1`
- 冻结目标：统一视觉语言，保证三页在同一套 token 和组件体系下实现
- 非目标：后端接口、数据库、能耗算法、告警规则模型

---

## 2. 视觉系统规范（Token 冻结）

本节默认以 `apps/chiller-shell-v1/src/styles/tokens.css` 为准。

### 2.1 颜色规范

#### 背景与面板

| 语义 | Token | 值 | 用途 |
|---|---|---|---|
| 根背景 | `--bg-0` | `#07111f` | 页面主背景 |
| 次背景 | `--bg-1` | `#0b1d33` | 容器层背景 |
| 高亮背景 | `--bg-2` | `#102844` | 悬停层/头部条 |
| 分割线 | `--line` | `#1d3b5a` | 卡片边线、分隔线 |
| 卡片渐变 | `--gradient-card` | `linear-gradient(145deg, rgba(31, 84, 121, 0.34), rgba(9, 29, 53, 0.52))` | 全站业务卡片底 |

#### 文本

| 语义 | Token | 值 | 用途 |
|---|---|---|---|
| 主文本 | `--text-1` | `#e8f2ff` | 标题、关键数值 |
| 次文本 | `--text-2` | `#99b5d4` | 辅助说明、描述文案 |

#### 强调色

| 语义 | Token | 值 | 用途 |
|---|---|---|---|
| 主强调 | `--accent` | `#37c8ff` | CTA、重点操作 |
| 次强调 | `--accent-2` | `#63e6ff` | 高亮描边、光效 |

#### 状态色

| 状态 | Token | 值 | 规则 |
|---|---|---|---|
| 正常 | `--ok` | `#37e6b7` | 运行正常、收益达标 |
| 预警 | `--warn` | `#ffb347` | 关注态、趋势异常 |
| 危险 | `--danger` | `#ff4d6d` | 故障、高危告警 |

### 2.2 字体规范

- 中文正文：`"IBM Plex Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
- 标题/数字强调：`"Space Grotesk", "IBM Plex Sans", sans-serif`
- 字号层级（冻结）：
  - 页面标题：`34px`（登录标题）/ `28px`（业务页主标题）
  - 卡片标题：`17px`
  - 核心 KPI 数字：`30px`
  - 正文：`14px`
  - 辅助说明：`12px`

### 2.3 间距与圆角规范

#### 间距（8pt 体系）

| Token | 值 |
|---|---|
| `--gap-1` | `8px` |
| `--gap-2` | `12px` |
| `--gap-3` | `16px` |
| `--gap-4` | `24px` |

#### 圆角与阴影

| Token | 值 | 用途 |
|---|---|---|
| `--radius-soft` | `12px` | 输入框、小组件 |
| `--radius-card` | `16px` | 主卡片 |
| `--shadow-1` | `0 12px 30px rgba(0, 0, 0, 0.32)` | 卡片阴影 |

### 2.4 卡片规范

- 统一使用 `SectionCard` 作为业务卡容器，禁止每页重复造卡片样式
- 卡片结构固定：
  1. `section-card-header`
  2. `section-action`（可选）
  3. `section-card-body`
- 边框：`1px solid rgba(99, 230, 255, 0.2)`
- 底色：`--gradient-card`
- 卡片内纵向间距：`--gap-3`

### 2.5 状态标签规范

- 统一使用 `StatusPill`
- tone 仅允许：`neutral`、`good`、`warn`、`danger`
- 文案规则：
  - `good`：`live`、`normal`、`healthy`
  - `warn`：`warning`、`stale data`、`degraded`
  - `danger`：`critical`、`offline`、`alarm`
  - `neutral`：`standby`、`aggregated`

### 2.6 图表规范

#### 图表类型限制（V1）

- 允许：折线图、柱状图、面积趋势图、拓扑流向图
- 禁止：3D 饼图、过度仪表盘、动画噪声特效

#### 图表颜色映射（冻结）

| 指标类型 | 颜色 |
|---|---|
| COP / 效率 | `#37e6b7` |
| 功率 / 负荷 | `#37c8ff` |
| 温差 / 流量 | `#63e6ff` |
| 收益 / 节能 | `#ffb347` |
| 风险 / 告警 | `#ff4d6d` |

#### 视觉细节

- 网格线：`1px` 虚线，透明度 `0.18`
- 折线宽度：`2px`
- 数据点：`4px`
- Tooltip 背景：深色半透，边框用 `--line`

---

## 3. 三页模块级布局说明

## 3.1 登录页（`LoginPage`）

### 布局结构

1. 背景层 `LoginBackdrop`
2. 中央登录卡 `LoginCard`
3. 表单区 `LoginFormPanel`

### 尺寸与栅格

- 画布：`min-height: 100vh`
- 登录卡宽度：`min(460px, 94vw)`
- 卡片内边距：`32px`
- 表单项间距：`14px`
- 按钮高度：`48px`

### 必备模块

- 品牌短标语（Eyebrow）
- 系统主标题
- 用户名/密码输入
- 主操作按钮（`Enter Command Deck`）
- 版本提示/集成状态提示

## 3.2 首页驾驶舱（`DashboardPage`）

### 布局结构

1. `KpiStrip`（6 个 KPI 卡）
2. `RealtimeSystemStatusCard`
3. `LoadAndPowerTrendCard`
4. `AiRecommendationBoard`
5. `AnomalyPriorityBoard`

### 尺寸与栅格（桌面 1440 基准）

- 页面外边距：`20px`
- 模块间距：`16px`
- KPI 栅格：`repeat(6, minmax(0, 1fr))`
- 系统摘要卡栅格：`repeat(4, minmax(0, 1fr))`
- 推荐列表：`repeat(3, minmax(0, 1fr))`

### 信息分区规则

- 左上优先展示效率与功率
- 中间展示趋势与状态
- 右下展示异常和建议动作
- 风险信息必须在首屏出现

## 3.3 系统总览页（`SystemOverviewPage`）

### 布局结构

1. `SystemOverviewHeader`
2. `CoolingTopologyCard`
3. `NodeDetailCard`

### 尺寸与栅格

- 主布局：`grid-template-columns: 1.2fr 1fr`
- 模块间距：`16px`
- 拓扑节点间距：`10px`
- 详情信息栅格：`repeat(2, minmax(0, 1fr))`

### 业务表达规则

- 左侧偏“系统全局态势”
- 右侧偏“当前选中节点细节”
- 节点状态必须可视化（`StatusPill`），禁止只用文本描述

### 响应式断点（冻结）

- `<=1180px`：KPI 6 列降为 3 列，推荐卡改 1 列
- `<=900px`：系统总览改单列，侧边栏改顶部
- `<=640px`：KPI 2 列，详情卡单列，TopBar 纵向

---

## 4. 组件命名建议（前端可直接实现）

沿用现有 PascalCase 命名与目录层级。

### 4.1 Common 组件（`src/components/common`）

- `SectionCard`
- `StatCard`
- `StatusPill`
- `PanelHeader`
- `MetricValue`
- `TrendLegend`

### 4.2 登录页组件（`src/components/login`）

- `LoginBackdrop`
- `LoginCard`
- `LoginFormPanel`
- `LoginField`
- `LoginPrimaryAction`

### 4.3 驾驶舱组件（`src/components/dashboard`）

- `KpiStrip`
- `KpiStatCard`（可基于 `StatCard` 扩展）
- `RealtimeSystemSummary`
- `PowerTrendPanel`
- `RecommendationBoard`
- `AnomalyPriorityBoard`

### 4.4 系统总览组件（`src/components/system`）

- `SystemOverviewHeader`
- `CoolingTopologyPanel`
- `TopologyNodeCard`
- `FlowLink`
- `NodeDetailPanel`
- `RiskSummaryPanel`

### 4.5 页面装配建议（`src/pages`）

- `LoginPage`：仅装配登录模块，不混入业务数据图表
- `DashboardPage`：只组织驾驶舱模块，不写复杂样式细节
- `SystemOverviewPage`：只组织总览模块，节点详情独立组件化

---

## 5. 交付验收清单（V1 冻结）

- 三页均仅使用冻结 token，不新增临时色值
- `StatusPill` 四态完整覆盖
- 卡片结构统一（Header + Body）
- 三页响应式断点行为一致
- 驾驶舱与系统总览首屏都包含风险信息
- 组件命名与目录符合本规范

> 结论：本稿可作为 `chiller-shell-v1` 的 UI V1 实施规范，主控可按此冻结视觉系统并安排前端分工开发。
