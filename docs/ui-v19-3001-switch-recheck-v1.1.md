# UI-v19｜3001 切换复核（主控 v1.1）

复核时间：2026-03-12 12:40（Asia/Shanghai）

## 1. 复核结论
- 结论：**PASS（入口切换维度）**
- 说明：`3001` 当前已切到新壳页面，不再落旧登录页。
- 附注：当前为降级态展示（BFF 不可达），但这不影响“入口已切换到新壳”的判定。

## 2. 关键证据
1. `curl http://127.0.0.1:3001/` 返回 `Chiller Shell V1` 的 `index.html`（非旧 `vue_dist` 登录页 HTML）。
2. `http://127.0.0.1:3001/dashboard` 可进入新壳驾驶舱（含侧边导航、Source Banner、规则诊断区）。
3. `http://127.0.0.1:3001/system-overview` 可进入新壳系统总览页（含 Source Banner 与拓扑卡片）。

## 3. 页面截图
- [live-3001-dashboard-shell-v19.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-dashboard-shell-v19.png)
- [live-3001-system-overview-shell-v19.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-system-overview-shell-v19.png)

## 4. 与 ui-v19 FAIL 结果的关系
- `ui-v19-3001-switch-review.md` 中的 FAIL 截图内容为“旧登录页”，与当前复核结果不一致，判定为**时间窗口差异**（验收发生在切换完成前）。
- 建议：以本复核版作为当前状态基线，并触发 UI 线程重跑 v19.1 验收集。

