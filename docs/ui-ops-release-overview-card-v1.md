# Release Ops 值班总卡 v1

用途：把 `release-ready-consistency + check-family-consistency + release-ready-latest-check` 收成一张一屏总卡，帮助值班同学快速判断“能不能发、为什么、先做什么”。  
边界：本卡只定义读法，不改任何脚本逻辑。

## 核心约束

- 只读后端结果，不允许前端自行推断。
- 页面仅作为读取入口；最终判断以后端文件与检查结果为准。

## 一屏阅读顺序（必须）

1. `decision`
2. `consistency`
3. `latest/source`
4. `first action`

字段归属：
- `decision`：来自 `release-ready-latest-check` / `release-ready-consistency-latest`
- `consistency`：来自 `release-ready-consistency` 与 `check-family-consistency`
- `latest/source`：来自 `release-ready-latest` 与 `release-ready-latest-check`
- `first action`：按场景执行固定动作

## 三个值班场景

### 1) 可发

判定建议：
- `decision=GO`
- `exitCode=0`
- `release-ready consistency` 正常
- `check-family consistency` 一致
- `latest/source` 可读且来源可信

第一动作：
- `按发布窗口执行放行，并同步“可发 + 来源可信 + 一致性正常”。`

### 2) 不可发

判定建议（任一满足）：
- `decision=NO-GO`
- `exitCode!=0`
- `release-ready consistency` 失败
- `check-family consistency` 不一致

第一动作：
- `立即停发，先处理首个阻断原因或一致性冲突，修复后再重跑校验。`

### 3) 需复核

判定建议：
- `decision=GO`
- `consistency` 正常
- 但 `latest/source` 缺失、来源不可信、或时间戳不足以支撑直接放行

第一动作：
- `先核对 source 与 latest 时间，再决定是否进入正式放行。`

## 页面读法映射

- 顶部红框：`decision`
- 右侧绿/红框：`consistency`
- 中部黄/青框：`latest/source`
- 下方紫框：`first action`

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-release-overview-v1-vi-system-overview.png`

## 值班可用性

是否可直接值班群使用：`yes`
