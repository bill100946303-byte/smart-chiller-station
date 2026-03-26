# UI-v1.8 PASS 态一致性复验

复验目标：
- 基于当前 **PASS 实链路** 重拍金样（Dashboard / SystemOverview）。
- 覆盖 `zh-CN/en-US/vi-VN` + `1366/820` + `Source Banner 折叠/展开`。
- 验证并留证：**角标 PASS/FAIL 只读后端判定，不允许前端推断**。

输入：
- `docs/v1.8-signoff-decision.md`
- `docs/ui-consistency-review-v1.7.md`
- `docs/ui-badge-state-v1.8.json`

## 1) 实链路前置检查

- 结果：**通过**
- 依据：`AUTO_BOOT=1 SITE_ID=126lnoffice scripts/check_stack.sh`
- 关键输出：`Readiness: PASS`、`overview/trends/anomalies/recommendations=ok`、`ND failed: 0`

## 2) 820 与 1366 全量矩阵验收

矩阵：`3语言 × 2页面 × 2视口 × 折叠/展开 = 24`

逐项结论：**全部通过**
- 通过原因：
  - Source Banner 折叠态/展开态均可触发，展开后完整显示来源明细。
  - 页面角标三语均为 PASS 文案（`通过 / PASS / Đạt`），与后端状态文件一致。
  - Rule Skip Diagnostics 在两页均可读，视觉层级与 Source Banner、角标一致。
  - 1366 与 820 均未出现横向滚动或文字重叠（`hasHorizontalOverflow=false`）。

## 3) PASS/FAIL 只读后端判定证据

结论：**通过**

证据链：
1. 状态文件：`docs/ui-badge-state-v1.8.json` 当前 `global.pass=true`，三语文案为 PASS。
2. 页面网络请求：持续命中 `GET /ui-badge-state-v1.8.json => 200`。
3. 页面呈现：两页角标统一显示 PASS 文案，且与 Source Banner/规则诊断状态变化解耦（不由前端本地计算）。

约束声明：
- **前端仅消费后端状态文件中的 `pass + text`，不根据页面指标自行推断 PASS/FAIL。**

## 4) 关键截图（样例）

- `docs/screenshots/ui-v18-pass-zh-dashboard-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-zh-dashboard-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-zh-system-overview-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-dashboard-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-system-overview-820-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-dashboard-820-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-system-overview-1366-collapsed.png`

## 5) 全量截图清单（24）

- `docs/screenshots/ui-v18-pass-zh-dashboard-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-zh-dashboard-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-zh-dashboard-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-zh-dashboard-820-expanded.png`
- `docs/screenshots/ui-v18-pass-zh-system-overview-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-zh-system-overview-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-zh-system-overview-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-zh-system-overview-820-expanded.png`
- `docs/screenshots/ui-v18-pass-en-dashboard-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-dashboard-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-en-dashboard-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-dashboard-820-expanded.png`
- `docs/screenshots/ui-v18-pass-en-system-overview-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-system-overview-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-en-system-overview-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-en-system-overview-820-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-dashboard-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-vi-dashboard-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-dashboard-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-vi-dashboard-820-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-system-overview-1366-collapsed.png`
- `docs/screenshots/ui-v18-pass-vi-system-overview-1366-expanded.png`
- `docs/screenshots/ui-v18-pass-vi-system-overview-820-collapsed.png`
- `docs/screenshots/ui-v18-pass-vi-system-overview-820-expanded.png`

## 6) 最终结论

**PASS**。V1.8 PASS 态金样已完成，三语与双视口一致性通过，且“角标只读后端判定”约束满足。
