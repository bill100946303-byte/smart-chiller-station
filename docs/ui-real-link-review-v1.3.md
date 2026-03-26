# 真实链路态 UI 终验（v1.3）

验收范围：
- 页面：`/dashboard`、`/system-overview`
- 口径：`820px`、`3语言(zh-CN/en-US/vi-VN)`、`折叠/展开`
- 对比基线：`docs/ui-i18n-source-rule-review-v1.2.md`（v1.2 金样）

## 截图产物（12张）

- `docs/screenshots/i18n-v13-zh-CN-dashboard-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-zh-CN-dashboard-real-820-expanded.png`
- `docs/screenshots/i18n-v13-zh-CN-system-overview-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-zh-CN-system-overview-real-820-expanded.png`
- `docs/screenshots/i18n-v13-en-US-dashboard-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-en-US-dashboard-real-820-expanded.png`
- `docs/screenshots/i18n-v13-en-US-system-overview-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-en-US-system-overview-real-820-expanded.png`
- `docs/screenshots/i18n-v13-vi-VN-dashboard-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-vi-VN-dashboard-real-820-expanded.png`
- `docs/screenshots/i18n-v13-vi-VN-system-overview-real-820-collapsed.png`
- `docs/screenshots/i18n-v13-vi-VN-system-overview-real-820-expanded.png`

校验摘要（v1.3 批量采集）：
- 横向溢出：`0`
- toggle 点击高度 `<32px`：`0`
- 展开态残留“已折叠”提示：`0`

## 与 v1.2 差异清单（仅差异项）

1. `SystemOverview` 顶部来源状态异常比下降：
- v1.2：`8/9 异常`
- v1.3：`4/8 异常`

2. 来源条折叠计数下降（说明真实链路下异常来源项减少）：
- Dashboard：`+17 -> +11`
- SystemOverview：`+5 -> +4`

3. `Source Banner` 展开明细结构发生变化（mock 痕迹收敛）：
- v1.2：包含 mock 注入的未收录项（如 `mystery_source_key`、`metric.unknown_index_x`、`trendBaseline/trendQuality` 异常主导）。
- v1.3：以真实来源键为主；多数来源恢复“数据正常”，保留 4 个规则指标“字段缺失或无效”。

4. Dashboard 趋势区由“端点失败降级”转为“端点可达但序列为空”：
- v1.2（partial mock）：以端点失败为主的降级表现。
- v1.3（real）：文案落在“趋势数据已陈旧 + 未返回趋势序列”，范围文案仍保持 `Range/范围 24H`。

5. Rule Skip Diagnostics 条目结构变化：
- v1.2：含 mock 的未知规则兜底条目。
- v1.3：稳定为 3 条真实 skipped 规则，三语排版一致，无重叠和截断。

## 结论

**不通过**（目标为“非降级态”，当前仍存在降级信号）。

## 阻塞项

1. Recommendations 仍为 `partial`，导致 Source Banner 维持异常状态并触发规则诊断降级信息。
2. Trends 端点虽可达，但有效序列为空且 freshness 为 stale，无法达到“真实链路非降级”的趋势展示要求。
3. 在上述数据态未恢复前，v1.3 只能作为“真实链路降级态验收”结论，不能作为“非降级态终验通过”。
