# check-family 新鲜度值班卡 v1

用途：在 check-family 一屏卡基础上增加“快照新鲜度”读取位（`fresh/warn/stale`）。  
适用页面：`/dashboard`、`/system-overview`（zh/en/vi）。

## 强约束（必须）

- 新鲜度只读后端字段，不允许前端推断。
- check-family 结论属于结构校验汇总，不等于实时业务健康全绿。
- 后端 freshness 字段缺失或非法时，按 fail-closed 处理（视为 `stale` + `FAIL`）。

## 一屏读取顺序

1. `overall`
2. `passedCount/totalCount`
3. `failedFamilies`
4. `freshness`（`fresh` / `warn` / `stale`）

## 三语文案（PASS/FAIL 两态）

### zh-CN
- PASS：`检查状态：PASS｜新鲜度：{freshness}`
- PASS 动作：`继续值班确认，附带新鲜度播报。`
- FAIL：`检查状态：FAIL｜新鲜度：{freshness}`
- FAIL 动作：`先处理失败家族，再重跑并确认 freshness 回升。`

### en-US
- PASS: `Check Status: PASS | Freshness: {freshness}`
- PASS action: `Proceed with duty confirmation and include freshness in report.`
- FAIL: `Check Status: FAIL | Freshness: {freshness}`
- FAIL action: `Fix failed families first, then rerun and verify freshness recovery.`

### vi-VN
- PASS: `Trang thai kiem tra: PASS | Do moi: {freshness}`
- PASS action: `Tiep tuc xac nhan truc va thong bao do moi.`
- FAIL: `Trang thai kiem tra: FAIL | Do moi: {freshness}`
- FAIL action: `Xu ly family loi truoc, sau do chay lai va xac nhan do moi da phuc hoi.`

## 图示口径

- 绿框：`fresh` 读取位
- 黄框：`warn` 读取位
- 红框：`stale` 读取位
- 其他既有框保持：overall / passedCount / failedFamilies

## 证据图（6 张，含 stale 示例）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-zh-dashboard-fresh-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-zh-system-overview-stale-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-en-dashboard-warn-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-en-system-overview-stale-fail.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-vi-dashboard-fresh-pass.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-family-freshness-v1-vi-system-overview-warn-fail.png`

## 值班可用性

是否可直接值班群使用：`yes`
