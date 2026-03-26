# check 命令矩阵值班卡 v1

用途：一页看清发布链路所有 `check` 命令及 latest 别名，避免误用重算命令。  
结论：以下命令均为“只校验结构，不触发重算”。

## 命令矩阵

- `release-ready-check` / `release-ready-latest-check`
  - 校验对象：`release-ready` 合同结构
  - 说明：latest 为别名，语义等价
- `release-ready-sync-check` / `release-ready-sync-latest-check`
  - 校验对象：`release-ready-sync` 合同结构
  - 说明：latest 为别名，语义等价
- `release-ready-brief-check`
  - 校验对象：`release-ready-brief` 合同结构
  - 说明：用于摘要字段结构验收
- `verify-gates-check` / `verify-gates-latest-check`
  - 校验对象：`verify-gates` 合同结构
  - 说明：latest 为别名，语义等价

## 使用边界

- 可做：结构完整性校验、值班前口径确认、自测回归。
- 不可做：触发实时重算、替代 `release-ready`/`verify-gates --json` 的执行结果。

## 图示说明（zh/en）

- 红框：总状态读取位
- 黄框：`release-ready-check` 组读取位
- 青框：`release-ready-sync-check` 组读取位
- 绿框：`release-ready-brief-check` 读取位
- 紫框：`verify-gates-check` 组读取位

## 证据图（2 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-command-matrix-v1-zh.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-check-command-matrix-v1-en.png`

## 值班可用性

可直接值班群使用：`yes`
