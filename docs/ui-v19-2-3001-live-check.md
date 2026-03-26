# UI-v19.2｜3001 实时复核（主控）

时间：2026-03-12 12:50（Asia/Shanghai）

## 结论
- 入口切换：**PASS**
- `3001` 已命中新壳（`Chiller Shell V1`），不再落旧登录页。

## 关键证据
1. 首页 HTML 为新壳构建产物（`/assets/index-*.js`、`<title>Chiller Shell V1</title>`）。
2. Dashboard 可见新壳侧栏、Source Banner、趋势卡片、规则诊断区。
3. SystemOverview 可见新壳拓扑卡片与 Source Banner。

## 页面截图
- [live-3001-dashboard-shell-v19-ready.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-dashboard-shell-v19-ready.png)
- [live-3001-system-overview-shell-v19-ready.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/live-3001-system-overview-shell-v19-ready.png)

## 备注
- 顶部“非降级态”角标仍显示未通过，属于运行态签收文件（`ui-badge-state-v1.8.json`）未刷新导致，不影响“入口已切到新壳”的判定。
