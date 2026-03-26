# UI v19.2 Badge Sync Review (3001)

- Review date: 2026-03-12
- Entry: `http://127.0.0.1:3001`
- Scope: `/dashboard`, `/system-overview`
- Matrix: `zh-CN` / `en-US` / `vi-VN`, collapsed + expanded

## 1) 新壳命中检查

结论：**是（命中新壳）**。

证据：
- 页面标题为 `Chiller Shell V1`，侧栏为壳层导航（Dashboard/System Overview）。
- 未出现旧登录大图容器（`.login-page__hero` 检查为 `false`）。
- 12 张截图均直接命中壳层页面而非旧登录首屏。

## 2) Source Banner 可见性

结论：**是（可见）**。

证据：
- `/dashboard` 与 `/system-overview` 在三语下均出现顶部 `source-banner`。
- 折叠态和展开态均可切换，按钮文案随语言变化正常（如“展开来源状态/Collapse Source Status/Thu gọn trạng thái nguồn”）。

## 3) 角标只读后端文件 + 文案一致性

结论：**是（只读后端文件且文案一致）**。

一致性核对：
- 后端状态文件：`/ui-badge-state-v1.8.json`
- 读取路径：
  - `apps/chiller-shell-v1/src/config/runtimeConfig.ts` -> `badgeStateUrl` 默认 `/ui-badge-state-v1.8.json`
  - `apps/chiller-shell-v1/src/services/bffClient.ts` -> `fetchUiBadgeState(url, { cache: \"no-store\" })`
  - `apps/chiller-shell-v1/src/components/common/ReadinessBadge.tsx` -> 仅按 `pass + text` 渲染，不做前端推断
- 网络证据：
  - 三语两页均命中 `http://127.0.0.1:3001/ui-badge-state-v1.8.json`
  - 未命中 `ui-badge-state-v1.6.json`

文案比对（页面角标 vs `ui-badge-state-v1.8.json`）：
- `zh-CN`: `非降级态：通过` ✅
- `en-US`: `Non-Degraded: PASS` ✅
- `vi-VN`: `Phi suy giảm: Đạt` ✅

## 4) 截图清单（v19.2）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-zh-dashboard-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-zh-dashboard-3001-expanded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-zh-system-overview-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-zh-system-overview-3001-expanded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-en-dashboard-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-en-dashboard-3001-expanded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-en-system-overview-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-en-system-overview-3001-expanded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-vi-dashboard-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-vi-dashboard-3001-expanded.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-vi-system-overview-3001-collapsed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-v19-2-vi-system-overview-3001-expanded.png`

## 最终结论

**PASS**。v19.2 在 `3001` 已命中新壳，Source Banner 可见，角标为“只读后端文件”并与 `ui-badge-state-v1.8.json` 三语文案一致。
