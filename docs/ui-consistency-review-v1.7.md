# UI-v1.7 实链路状态一致性复验

复验范围：
- 页面：`/dashboard`、`/system-overview`
- 区块：`Source Banner` + `页面角标` + `规则诊断区`
- 语言：`zh-CN / en-US / vi-VN`
- 视口：`820`（折叠/展开）与 `1366`（正常/部分失败）

输入对照：
- `docs/ui-real-link-badge-spec-v1.6.md`
- `docs/ui-badge-state-v1.6.json`
- `docs/source-status-key-dictionary-v1.2.json`
- `docs/hvac-rule-copybook-v1.2-i18n.json`

## 1) 820 口径（3语言 × 2页面 × 折叠/展开）

结论：**通过**

原因：
- 两页在三语下均能触发 `Source Banner` 折叠/展开。
- `source-banner-toggle` 展开态真实展示完整来源明细，折叠态展示 shortLabel 聚合。
- 820 下未发现横向滚动（复验脚本均返回 `hasHorizontalOverflow=false`）。
- 角标文案与语言一致：`非降级态：未通过 / Non-Degraded: NOT PASS / Phi suy giảm: Chưa đạt`。

截图：
- `docs/screenshots/ui-v17-zh-dashboard-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-zh-dashboard-partial-820-expanded.png`
- `docs/screenshots/ui-v17-zh-system-overview-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-zh-system-overview-partial-820-expanded.png`
- `docs/screenshots/ui-v17-en-dashboard-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-en-dashboard-partial-820-expanded.png`
- `docs/screenshots/ui-v17-en-system-overview-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-en-system-overview-partial-820-expanded.png`
- `docs/screenshots/ui-v17-vi-dashboard-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-vi-dashboard-partial-820-expanded.png`
- `docs/screenshots/ui-v17-vi-system-overview-partial-820-collapsed.png`
- `docs/screenshots/ui-v17-vi-system-overview-partial-820-expanded.png`

## 2) 1366 口径（2页面 × 正常/部分失败）

### Dashboard
- 正常：**通过**
  - 原因：Source Banner 主文案为“聚合数据已就绪”，角标仍为“非降级态：未通过”，规则诊断区可读，层级正常。
  - 截图：`docs/screenshots/ui-v17-zh-dashboard-normal-1366-collapsed.png`
- 部分失败：**通过**
  - 原因：切 `SITE_ID=custom_site_001` 后，Source Banner 转为“数据已加载，但存在陈旧信号”，规则诊断与来源异常显著增加，角标维持后端判定值。
  - 截图：`docs/screenshots/ui-v17-zh-dashboard-partial-1366-collapsed.png`

### SystemOverview
- 正常：**不通过**
  - 原因：默认站点仍为 `来源状态：1/8 异常`（`metric.station_cop` 缺失），无法形成严格“全正常”样例。
  - 截图：`docs/screenshots/ui-v17-zh-system-overview-normal-1366-collapsed.png`
- 部分失败：**通过**
  - 原因：`custom_site_001` 场景为 `来源状态：5/8 异常`，与规则诊断区异常量级一致，视觉层级清晰。
  - 截图：`docs/screenshots/ui-v17-zh-system-overview-partial-1366-collapsed.png`

## 3) “PASS/FAIL 只读后端”页面证据

结论：**通过**

证据：
- 浏览器网络请求中持续命中：`GET /ui-badge-state-v1.6.json => 200`。
- 同一页面在“较正常”与“部分失败”两态下，Source Banner 与规则诊断会变化，但角标仍跟随后端状态文件（当前均为 `pass=false`）。
- 典型对照图：
  - `docs/screenshots/ui-v17-zh-dashboard-normal-1366-collapsed.png`
  - `docs/screenshots/ui-v17-zh-dashboard-partial-1366-collapsed.png`

## 4) 阻塞与归因

- 阻塞项：`SystemOverview-1366-正常态` 无法达到“全正常”。
- 归因：**上游接口数据口径**（`recommendations.sourceStatus` 长期 `partial`，默认站点存在 `metric.station_cop` 缺失）。
- 前端侧结论：未发现“前端自行推断 PASS/FAIL”行为。

## 5) 总结

整体结论：**FAIL（单项阻塞）**  
通过项：820 全量折叠/展开一致性、三语可读性、角标后端只读约束。  
未通过项：`SystemOverview` 在 1366 “正常态”样例受上游数据限制未满足。
