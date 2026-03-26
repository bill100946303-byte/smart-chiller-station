# UI Badge v1.8 文件名一致性巡检

任务目标：
1. 巡检页面是否仍引用 `/ui-badge-state-v1.6.json`。  
2. 确认 Dashboard/SystemOverview 三语在 PASS 态读取 `v1.8` 状态文件。  
3. 提供 6 张“网络面板含请求 URL”证据图。

## A. 全量引用巡检结果

巡检范围：`apps/chiller-shell-v1`（页面运行时）

结果：**通过**
- 命中 `/ui-badge-state-v1.8.json`：
  - `apps/chiller-shell-v1/src/services/bffClient.ts`
  - `apps/chiller-shell-v1/src/config/runtimeConfig.ts`
- 未命中 `/ui-badge-state-v1.6.json`（页面运行时代码内无旧文件名残留）。

说明：
- 历史文档中仍有 `v1.6` 字样（如 `docs/ui-badge-live-binding-v1.6.md`），不影响页面运行时引用。

## B. PASS 态读取确认（三语 × 两页）

结果：**通过**
- `scripts/check_stack.sh` 当前输出：Readiness `PASS`，并已同步：
  - `docs/ui-badge-state-v1.8.json`
  - `apps/chiller-shell-v1/public/ui-badge-state-v1.8.json`
- 三语角标文案与 `v1.8` 状态文件一致：
  - zh-CN：`非降级态：通过`
  - en-US：`Non-Degraded: PASS`
  - vi-VN：`Phi suy giảm: Đạt`

## C. 网络 URL 证据图（6 张）

命名规则：`ui-v18-badge-consistency-{lang}-{page}.png`

- `docs/screenshots/ui-v18-badge-consistency-zh-dashboard.png`
- `docs/screenshots/ui-v18-badge-consistency-zh-system-overview.png`
- `docs/screenshots/ui-v18-badge-consistency-en-dashboard.png`
- `docs/screenshots/ui-v18-badge-consistency-en-system-overview.png`
- `docs/screenshots/ui-v18-badge-consistency-vi-dashboard.png`
- `docs/screenshots/ui-v18-badge-consistency-vi-system-overview.png`

证据面板内容：
- `GET /ui-badge-state-v1.8.json`
- `Status: 200 OK`
- `Locale / Page`
- `Rule: backend read-only pass/text`

## D. 结论

**PASS**。V1.8 文件名一致性通过，页面运行时已统一读取 `ui-badge-state-v1.8.json`，且三语 PASS 态角标与后端判定一致。
