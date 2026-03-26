# UI-v19｜3001 切新壳首屏一致性验收

验收范围：
- `http://127.0.0.1:3001/dashboard`
- `http://127.0.0.1:3001/system-overview`
- 三语：`zh/en/vi`
- 图集：每语每页折叠/展开，共 12 张（`ui-v19-{lang}-{page}-3001-{collapsed|expanded}.png`）

## 1) 核心检查项

### A. 是否仍出现旧登录大图风格（应为否）
- 结果：**是（未通过）**
- 证据：12 组访问均被重定向至登录页：
  - `/dashboard#/login?redirect=%2F`
  - `/system-overview#/login?redirect=%2F`
- 页面内出现旧登录主文案：`高效能源站智慧平台`

### B. Source Banner 是否可见
- 结果：**否（未通过）**
- 原因：未进入新壳页面，停留在旧登录页，DOM 中无 `.source-banner`。

### C. 角标是否仍“只读后端判定”
- 结果：**不可验证（未通过）**
- 原因：未进入新壳页面，DOM 中无 `.readiness-badge-pill`，资源请求中无 `/ui-badge-state-v1.8.json` 命中（也无 `v1.6` 命中）。

## 2) 截图产物（12 张）

- `docs/screenshots/ui-v19-zh-dashboard-3001-collapsed.png`
- `docs/screenshots/ui-v19-zh-dashboard-3001-expanded.png`
- `docs/screenshots/ui-v19-zh-system-overview-3001-collapsed.png`
- `docs/screenshots/ui-v19-zh-system-overview-3001-expanded.png`
- `docs/screenshots/ui-v19-en-dashboard-3001-collapsed.png`
- `docs/screenshots/ui-v19-en-dashboard-3001-expanded.png`
- `docs/screenshots/ui-v19-en-system-overview-3001-collapsed.png`
- `docs/screenshots/ui-v19-en-system-overview-3001-expanded.png`
- `docs/screenshots/ui-v19-vi-dashboard-3001-collapsed.png`
- `docs/screenshots/ui-v19-vi-dashboard-3001-expanded.png`
- `docs/screenshots/ui-v19-vi-system-overview-3001-collapsed.png`
- `docs/screenshots/ui-v19-vi-system-overview-3001-expanded.png`

## 3) 结论

**FAIL**。3001 当前未切到新壳首屏，仍落旧登录页，导致 Source Banner 与角标后端只读链路均无法在页面层完成验收。
