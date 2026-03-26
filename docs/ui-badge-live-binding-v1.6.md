# UI Badge Live Binding Review v1.6.1

范围：
- 页面：`/dashboard`、`/system-overview`
- 状态文件：`docs/ui-badge-state-v1.6.json`
- 目标：将“后端判定角标”接入页面顶部并确认三语可读性（820 宽度）

## 1. 绑定路径（代码）

- 状态文件读取入口：`apps/chiller-shell-v1/src/services/bffClient.ts`
  - `fetchUiBadgeState()` 读取 `VITE_UI_BADGE_STATE_URL`（默认 `/ui-badge-state-v1.6.json`）
- 运行时配置：`apps/chiller-shell-v1/src/config/runtimeConfig.ts`
  - `badgeStateUrl` 统一管理
- 角标组件：`apps/chiller-shell-v1/src/components/common/ReadinessBadge.tsx`
  - `pageKey` 仅接受 `dashboard | systemOverview`
  - 仅消费 `pass` 与 `text[locale]`（zh/en/vi）
- 页面挂载：
  - `apps/chiller-shell-v1/src/pages/DashboardPage.tsx`
  - `apps/chiller-shell-v1/src/pages/SystemOverviewPage.tsx`
- 运行态静态文件：
  - `apps/chiller-shell-v1/public/ui-badge-state-v1.6.json`

## 2. 约束条款（验收）

- 前端角标状态只接受后端下发 `pass` 布尔值，不根据 KPI、趋势或诊断内容自行推断通过/失败。
- 角标文案只读取后端状态文件 `text` 字段对应语言值（`zh-CN/en-US/vi-VN`）。

## 3. 三语 820 宽度截图

- `docs/screenshots/ui-badge-live-v16-zh-dashboard.png`
- `docs/screenshots/ui-badge-live-v16-zh-system-overview.png`
- `docs/screenshots/ui-badge-live-v16-en-dashboard.png`
- `docs/screenshots/ui-badge-live-v16-en-system-overview.png`
- `docs/screenshots/ui-badge-live-v16-vi-dashboard.png`
- `docs/screenshots/ui-badge-live-v16-vi-system-overview.png`

## 4. 可读性检查结论（820）

- 中文/英文/越南文角标均在单行或自然换行内显示，无错位和溢出。
- 两页顶部角标视觉样式一致（同一 `status-pill` 体系）。
