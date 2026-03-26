# UI-v19.3｜角标同步修复记录

时间：2026-03-12

## 1. 问题现象
- 页面已命中新壳，但顶部角标仍显示“非降级态：未通过”。
- 同时 `docs/ui-badge-state-v1.8.json` 已是 `global.pass=true`。

## 2. 根因
- `3001` 当前由 nginx 直接服务 `apps/chiller-shell-v1/dist`。
- 之前 `check_stack.sh` 只同步角标文件到 `public`，未同步到 `dist`，导致运行页面读取到旧文件。

## 3. 修复
- 更新脚本：`scripts/check_stack.sh` 的 `generate_badge_state()`，新增同步到：
  - `apps/chiller-shell-v1/dist/ui-badge-state-v1.8.json`
- 立即执行一次手动同步，确认 `http://127.0.0.1:3001/ui-badge-state-v1.8.json` 返回 `global.pass=true`。

## 4. 复核截图
- [live-3001-dashboard-shell-v19-pass-badge.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-dashboard-shell-v19-pass-badge.png)
- [live-3001-system-overview-shell-v19-pass-badge.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-system-overview-shell-v19-pass-badge.png)

## 5. 结论
- 入口：`3001` 新壳已稳定。
- 角标：已按后端文件同步显示“非降级态：通过”。
