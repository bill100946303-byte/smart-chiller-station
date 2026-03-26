# example_not_ready 单 advisory 复验 v1

用途：复验当系统只剩 `example_not_ready` 一条 advisory 时，值班卡片是否还应该继续显示 `review_required`，还是更适合收敛成“可发但有说明”。

## 复验输入

- `/Users/billchow/Documents/智慧冷冻站/docs/ui-runtime-enhanced-review-v1.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/ui-release-command-center-sync-card-v1.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/ui-release-command-center-latest-card-v1.md`

## 当前状态证据

- `release-command-center-latest.json`
  - `decision = GO`
  - `reasons = []`
  - `advisories = ["example_not_ready"]`
- `release-command-center-latest-check.json`
  - `decision = GO`
  - `consistencyOk = true`
  - `summaryClass = review_required`

结论：
- 当前已经不是“阻断态”。
- 当前也不是“字段缺口待排查”。
- 现在唯一剩余的是一条非阻断说明性 advisory：`example_not_ready`。

## 页面建议态

建议态：`ready_with_note`

不建议继续把页面主态写成：`review_required`

也不建议继续完全保持现状。

## 为什么推荐 `ready_with_note`

### 1. 主结论已经是 GO

- `decision=GO`
- `reasons=[]`
- `consistencyOk=true`

这说明发布主结论已经成立，页面主态继续展示成 `review_required`，会把“说明性 note”抬成“主风险”。

### 2. `example_not_ready` 更像注记，不像行动阻断

当前只剩 `example_not_ready`，没有字段缺口、没有 skippedRuleDetails、没有 source banner 失败汇总。  
因此它更适合作为：
- 次级说明
- 辅助注记
- 值班备注

而不应继续作为页面主态的第一层结论。

### 3. 对值班同学会有误导

如果继续显示 `review_required`，值班同学容易产生这三种误读：
- 误以为当前仍有运行风险
- 误以为仍要回到底层排障
- 误以为“不能直接发”

但当前真实口径更接近：
- `可以发`
- `有一条说明`
- `无需把该说明升级成故障或阻断`

## 建议话术

### 页面层

建议从：
- `需复核`

收敛为：
- `可发但有说明`
- `GO，附注 example_not_ready`
- `ready_with_note`

### 值班群播报

建议播报为：
- 中文：`当前 GO，可发；仅剩 example_not_ready 说明项，不构成阻断。`
- English: `Current state is GO and can proceed; only example_not_ready remains as a note, not a blocker.`
- Tiếng Việt: `Trang thai hien tai la GO va co the tiep tuc; chi con example_not_ready nhu mot ghi chu, khong phai chan phat hanh.`

## 是否会误导值班同学

会：`yes`

误导点：
- `review_required` 在当前态下会高估风险等级
- 页面会看起来比实际更“危险”
- 与页面健康态、Source Banner 正常态、规则跳过为空形成冲突

## 最终建议

- 页面建议态：`ready_with_note`
- 值班结论层可以保留 advisory 明细，但不要再把它升格为页面主状态
- 如果主控本轮不改 contract，至少应在值班卡片文案里明确：
  - `review_required` 此处仅因 `example_not_ready`
  - 不等于不可发
  - 不等于仍需排障

## 是否可直接值班群使用

是否可直接值班群使用：`yes`

理由：
- 这份卡片把当前唯一 advisory 的性质解释清楚了。
- 它能直接降低“把说明项误读成阻断项”的风险。
- 但前提是值班群转发时，应优先使用本页新结论，不再沿用旧的 `review_required` 简写。

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-example-ready-advisory-review-v1-vi-system-overview.png`
