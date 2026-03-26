# release-ready-latest-check 一屏值班卡 v1.1

用途：值班同学在一屏内完成 `release-ready-latest-check` 读法与群播报。  
适用页面：`/dashboard`、`/system-overview`（zh/en/vi）。

## 语义说明（与 v1 一致）

- `release-ready-check` 与 `release-ready-latest-check` 语义等价。
- 二者都用于合同结构校验，不改变业务阈值，不触发业务重算。

## 强约束（必须遵守）

- 只读后端判定，不允许前端推断。
- 页面显示仅作为读取入口，最终结论以后端输出字段为准（`decision / exitCode / source`）。

## Fail-Closed 醒目提示（字段缺失）

- 中文：字段缺失即 Fail-Closed；立即停止放行，先补齐后端输出，再重跑 `release-ready-latest-check`。
- English: Missing required fields means fail-closed; stop release immediately, restore backend output, then rerun `release-ready-latest-check`.
- Tiếng Việt: Thiếu trường bắt buộc thì fail-closed; dừng phát hành ngay, bổ sung dữ liệu backend rồi chạy lại `release-ready-latest-check`.

## 一屏读法（3 字段）

1. `decision`：先看最终决策（GO/NO-GO/UNKNOWN）
2. `exitCode`：再看退出码（0 通过，非 0 阻断）
3. `source`：最后看判定来源（后端来源口径）

图中标注颜色：
- 红框：`decision`
- 黄框：`exitCode`
- 青框：`source`

## 证据图（6 张，latest-check 口径）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v11-vi-system-overview.png`

## 值班口令（可直接复制发群）

1. `【值班播报】release-ready-latest-check=PASS，decision=GO，exitCode=0，source=backend。`
2. `【值班播报】release-ready-latest-check=FAIL，decision=NO-GO，exitCode!=0；已暂停放行并进入修复。`
3. `【值班播报】release-ready-latest-check=FAIL-CLOSED（字段缺失），按后端判定处理，禁止前端推断。`

## 结论字段

是否可直接值班群使用：`yes`
