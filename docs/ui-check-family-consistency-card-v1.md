# check-family-consistency 值班一屏卡 v1

用途：值班快速判断 `check-family` 与 `check-family-brief` 是否一致，避免“brief 看起来通过但 family 实际失败”。  
输入来源：
- `/Users/billchow/Documents/智慧冷冻站/docs/check-family-latest.json`
- `/Users/billchow/Documents/智慧冷冻站/docs/check-family-brief-latest.json`

## 强约束（必须）

- 只读后端结果，不允许前端推断。
- 一致性以 `check-family-consistency` 合同规则为准，不以页面观感替代。

## 一屏读取顺序

1. 读 `family.overall / passedCount / totalCount`
2. 读 `brief.overall / passedCount / totalCount / topFailedChecks`
3. 读一致性结论（一致 / 不一致）

## 两态动作

### 一致（family 与 brief 一致）

- 判定：关键字段一致（overall、passed/total、failedCount、topFailedChecks 来源合法）。
- 值班动作：按当前窗口继续发布确认，并同步一致性结论到群。

### 不一致（family 与 brief 不一致）

- 判定：任一关键字段不一致或 `topFailedChecks` 引用非法。
- 值班动作：**禁止发布**；先修复数据源或生成链路后，重跑一致性校验再判定。

## 三语标题与动作（值班口播）

### zh-CN
- 一致：`一致性状态：一致`；动作：`继续发布确认。`
- 不一致：`一致性状态：不一致`；动作：`禁止发布，先修复后重跑。`

### en-US
- Consistent: `Consistency: MATCHED`; action: `Proceed with release confirmation.`
- Inconsistent: `Consistency: MISMATCH`; action: `Do NOT release. Fix and rerun first.`

### vi-VN
- Nhat quan: `Trang thai nhat quan: KHOP`; hanh dong: `Tiep tuc xac nhan phat hanh.`
- Khong nhat quan: `Trang thai nhat quan: LECH`; hanh dong: `Cam phat hanh, sua roi chay lai.`

## 证据图（6 张：zh/en/vi * dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-consistency-v1-vi-system-overview.png`

## 值班可用性

是否可直接值班群使用：`yes`
