# check-family-brief 值班卡 v1

用途：基于 `docs/check-family-brief-latest.json` 输出一屏简报，供值班快速播报。  
适用页面：`/dashboard`、`/system-overview`（zh/en/vi）。

## 显示范围（仅 4 项）

- `overall`
- `passed/total`
- `freshnessState`
- `topFailedChecks`（最多 3 个）

## 强约束（必须）

- brief 只读后端结果，不允许前端推断。
- `topFailedChecks` 超过 3 项时仅展示前 3 项，剩余不在一屏展开。
- `check-family-brief-latest.json` 缺失或字段缺失时，按 fail-closed 处理：视为 `FAIL`，停止放行。

## 两态读法

- PASS（无失败）：
  - `overall=PASS`
  - `topFailedChecks=none`
- FAIL（有失败）：
  - `overall=FAIL`
  - `topFailedChecks!=none`（播报第一项后进入修复）

## 三语标题与动作（PASS/FAIL）

### zh-CN
- PASS 标题：`检查简报：PASS`
- PASS 动作：`继续值班确认，并同步 passed/total 与 freshnessState。`
- FAIL 标题：`检查简报：FAIL`
- FAIL 动作：`先处理 topFailedChecks 第一项，再重跑 brief。`

### en-US
- PASS title: `Check Brief: PASS`
- PASS action: `Proceed and report passed/total with freshnessState.`
- FAIL title: `Check Brief: FAIL`
- FAIL action: `Fix the first item in topFailedChecks, then rerun brief.`

### vi-VN
- PASS tiêu đề: `Tom tat kiem tra: PASS`
- PASS hành động: `Tiep tuc xac nhan va thong bao passed/total cung freshnessState.`
- FAIL tiêu đề: `Tom tat kiem tra: FAIL`
- FAIL hành động: `Xu ly muc dau trong topFailedChecks roi chay lai brief.`

## 图示说明

- 绿/红框：`overall`（PASS/FAIL）
- 黄框：`passed/total`
- 青框：`freshnessState`
- 紫框：`topFailedChecks`（最多 3 项）

## 证据图（6 张，覆盖 PASS + FAIL）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-zh-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-zh-system-overview-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-en-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-en-system-overview-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-vi-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-brief-v1-vi-system-overview-fail.png`

## 值班可用性

是否可直接值班群使用：`yes`
