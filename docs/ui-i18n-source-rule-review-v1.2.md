# 多语言 Source Banner 与规则诊断区终验（v1.2）

评审页面：`/dashboard`、`/system-overview`  
本轮目标：冻结 `Source Banner / RuleSkip / Trend` 三块 V1 视觉与文案呈现。

截图产物（12 张金样，命名规范 `i18n-v12-{lang}-{page}-{state}-{viewport}-{collapsed|expanded}.png`）：
- `docs/screenshots/i18n-v12-zh-CN-dashboard-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-zh-CN-dashboard-partial-820-expanded.png`
- `docs/screenshots/i18n-v12-zh-CN-system-overview-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-zh-CN-system-overview-partial-820-expanded.png`
- `docs/screenshots/i18n-v12-en-US-dashboard-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-en-US-dashboard-partial-820-expanded.png`
- `docs/screenshots/i18n-v12-en-US-system-overview-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-en-US-system-overview-partial-820-expanded.png`
- `docs/screenshots/i18n-v12-vi-VN-dashboard-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-vi-VN-dashboard-partial-820-expanded.png`
- `docs/screenshots/i18n-v12-vi-VN-system-overview-partial-820-collapsed.png`
- `docs/screenshots/i18n-v12-vi-VN-system-overview-partial-820-expanded.png`

自动校验摘要（来自 `/tmp/i18n_v12_gold_meta.json`）：
- 样本数：`12`
- 横向溢出：`0`
- toggle 点击区 <32px：`0`
- 折叠/展开按钮缺失：`0`

## A. 通过项

1. Source Banner 折叠/展开策略通过：
- 折叠态使用 shortLabel，展开态使用 fullLabel。
- 展开后可见完整来源明细，不存在“假展开”。

2. v1.2 unknown fallback 通过：
- unknown key：折叠态显示“未收录/Unmapped/Chưa ghi nhận”，展开态显示“未收录来源（rawKey）/Unmapped Source (rawKey)/Nguồn chưa ghi nhận (rawKey)”。
- unknown metric：折叠态回退到“规则指标 / Rule Agg / Tổng hợp luật”，展开态显示“规则指标：unknown_index_x / Rule Metric: unknown_index_x / Chỉ số luật: unknown_index_x”。

3. 多语言可读性通过（zh-CN / en-US / vi-VN）：
- summary 为主信息，detail 为次信息，层级稳定。
- 英文与越文 toggle 计数已使用半角括号：`(+N)`。

4. Rule Skip Diagnostics 与 Trend 呈现通过：
- Rule Skip 在三语下无截断/重叠/错位。
- Trend 空值分支保持 Range 文案可见（避免信息断层）。

5. 响应式通过（820 宽度）：
- Source Banner 与 Rule Skip 区域无横向滚动、无遮挡、无异常换行。

## B. 问题项（严重/一般）

本轮未发现阻塞问题。

## C. 建议修订（原文 -> 建议文案 -> 原因）

本轮无必须修订项。

## D. 最终结论（通过/不通过）

**通过**。

V1.2 终验口径下，`Source Banner / RuleSkip / Trend` 三块已满足可读性、一致性、响应式与降级态要求，可冻结进入 V1 实施基线。
