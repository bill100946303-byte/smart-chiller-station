# 运行态增强复验 v1

用途：复验在 `redis` 补齐、core 字段回归后，值班卡片是否还在沿用旧的“字段缺口 / 需复核”口径，并给出本轮更新建议。

## 复验输入

- `/Users/billchow/Documents/智慧冷冻站/docs/ui-runtime-live-partial-card-v1.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/ui-release-command-center-sync-card-v1.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/ui-release-command-center-latest-card-v1.md`

## 本轮证据

### 1. 运行态字段已回归

从当前 BFF 输出复核：
- `metric.chilled_delta_t_c -> ok: value=0.2`
- `metric.cooling_delta_t_c -> ok: value=0.4`
- `metric.station_cop -> ok: value=0`
- `sourceStatus.overall = ok`

结论：
- 旧卡片里把这三项作为“字段缺口示例”的说法，已经不再准确。

### 2. 规则跳过口径已收敛

从当前 recommendations 输出复核：
- `ruleEvaluation.skippedRuleIds = []`
- `ruleEvaluation.skippedRuleDetails = []`

结论：
- 页面已不适合继续强调“先排字段，不要误判成服务挂了”作为主口径。
- 这句话在当前态会把“已恢复的字段缺口”误读成“仍在持续”。

### 3. 值班结论层仍保留 review_required

从当前 release command center latest-check 复核：
- `decision = GO`
- `consistencyOk = true`
- `summaryClass = review_required`
- `source = latest_file`

结论：
- `需复核` 仍然可以保留，但应明确这是值班结论层的 advisory 口径。
- 它不再等同于“字段仍缺口”。

## 复验结论

### 旧口径是否需要更新

需要更新：`yes`

原因：
- 旧卡片把 `chilled_delta_t_c / cooling_delta_t_c / station_cop` 作为缺口字段示例，已与当前运行态不符。
- 若继续沿用，会让值班同学误以为现在还是“字段没回来”，与真实状态冲突。

### 现在页面更适合显示什么

页面层更适合显示：`运行态增强`

原因：
- Source Banner 为健康态
- 规则跳过明细为空
- 核心字段已回归
- 页面本身更像“运行态增强后的健康展示”，而不是“字段缺口待排查”

补充边界：
- 如果要保留 `仍需复核`，应只放在 `release-command-center / latest-check` 这一类值班结论层。
- 复核原因应写成：`latest-check advisory`，不要再写成“字段缺口”。

## 建议文案切换

### 页面层

建议从：
- `运行态已打通 / 字段仍有缺口`

切换为：
- `运行态增强`
- `核心字段已回归，当前以健康态展示为主`

### 值班结论层

建议保留：
- `需复核`

但需改写解释为：
- `当前 latest-check 为 GO，但仍带 advisory，值班层建议复核，不代表字段缺口未恢复。`

## 是否可直接给值班群使用

是否可直接给值班群使用：`yes`

理由：
- 可以直接发这份新复验文档，因为它已把两层口径拆开：
  - 页面层：`运行态增强`
  - 值班结论层：`review_required` 来自 advisory，而不是字段缺口
- 但不建议继续单独转发旧的 `ui-runtime-live-partial-card-v1.md`，否则会误导当前状态。

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-enhanced-review-v1-vi-system-overview.png`
