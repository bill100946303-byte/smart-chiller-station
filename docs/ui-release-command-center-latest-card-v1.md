# release-command-center 最终值班入口卡 v1

用途：作为值班入口，一屏回答三件事：`现在能不能发`、`和上次比有没有变化`、`先做什么`。  
入口说明：
- `3001` = 发布入口（值班/签收/放行判断）
- `5173` = 开发入口（联调/开发调试，不作为值班放行依据）

## 边界

- 这是值班入口，不替代底层门禁明细。
- 只读后端结果，不允许前端自行推断。
- 底层分歧或缺字段时，按最保守策略处理，并回到底层卡片或门禁日志复核。

## 一屏读法顺序

1. 当前 `decision`
2. `diff / 是否变化`
3. `firstAction`

补充读取位：
- `summaryClass`：决定当前属于 `ready / blocked / review_required`
- `source`：辅助判断来源是否可信

## 三个值班场景

### 1) 稳定可发

判定建议：
- `decision=GO`
- `summaryClass=ready`
- `diffClass in {stable,recovery}`
- `decisionChanged=false` 或变化方向为恢复

一句话建议：
- `按 3001 发布入口继续放行，并同步“稳定可发”。`

### 2) 风险升高

判定建议：
- `decision=NO-GO`
- 或 `summaryClass=blocked`
- 或 `diffClass in {risk_up,error}`
- 或 `decisionChanged=true` 且方向为 `GO -> NO-GO`

一句话建议：
- `立即停发，先处理首个阻断项，再回到底层门禁复跑。`

### 3) 需复核

判定建议：
- `decision=GO`
- `summaryClass=review_required`
- 或 `diffClass in {changed,insufficient_history}`
- 或 `source/generatedAt` 不足以支持直接放行

一句话建议：
- `先复核 source、latest 时间和 diff 变化，再决定是否进入正式发布。`

## 当前入口示例（基于 latest）

- `decision=GO`
- `summaryClass=review_required`
- `source=latest_file`
- `diffClass=recovery`
- `decisionChanged=true`

值班解读：
- 当前不是“直接阻断”，但也不是“稳定可发”。
- 先按“需复核”处理，再决定是否放行。

## 图示说明

- 顶部红框：当前 `decision`
- 右侧绿/红框：`consistency / summaryClass`
- 中部黄/青框：`latest / source`
- 下方色框：`diff / 是否变化`
- 底部紫框：`firstAction`

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-latest-v1-vi-system-overview.png`

## 值班可用性

是否可直接值班群使用：`yes`
