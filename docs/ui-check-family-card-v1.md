# check-family 一屏值班卡 v1

用途：基于 `docs/check-family-latest.json` 读取 check-family 汇总结论，用于值班播报与交接。  
适用页面：`/dashboard`、`/system-overview`（zh/en/vi）。

## 核心边界（必须）

- check-family 是**结构校验汇总**，不是实时业务健康全绿结论。
- 页面只做读取入口；最终结论只读后端文件，不允许前端推断。
- `check-family-latest.json` 缺失或字段缺失时，按 fail-closed 处理（视为 FAIL，暂停放行）。

## 一屏读取顺序

1. `overall`（PASS/FAIL/UNKNOWN）
2. `passedCount/totalCount`（通过占比）
3. `failedFamilies`（none 或失败家族列表）

## 三语标题 + 一句话动作（PASS/FAIL）

### zh-CN
- PASS 标题：`检查状态：PASS`
- PASS 动作：`继续值班放行确认，并同步 passed/total。`
- FAIL 标题：`检查状态：FAIL`
- FAIL 动作：`先处理首个失败家族后再重跑校验。`

### en-US
- PASS title: `Check Status: PASS`
- PASS action: `Proceed with duty release confirmation and report passed/total.`
- FAIL title: `Check Status: FAIL`
- FAIL action: `Fix the first failed family, then rerun checks.`

### vi-VN
- PASS tiêu đề: `Trang thai kiem tra: PASS`
- PASS hành động: `Tiep tuc xac nhan phat hanh va thong bao passed/total.`
- FAIL tiêu đề: `Trang thai kiem tra: FAIL`
- FAIL hành động: `Xu ly family loi dau tien roi chay lai kiem tra.`

## 图示口径（6 张）

- 绿框：PASS 态主结论读取位（overall）
- 红框：FAIL 态主结论读取位（overall）
- 黄框：`passedCount/totalCount` 读取位
- 青框：`failedFamilies` 读取位

## 证据图（zh/en/vi × dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-zh-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-zh-system-overview-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-en-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-en-system-overview-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-vi-dashboard-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-v1-vi-system-overview-fail.png`

## 值班可用性

是否可直接值班群使用：`yes`
