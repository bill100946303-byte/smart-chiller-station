# verify-gates --json 值班读法卡 v1.1

用途：突出失败项可读性，避免只看总状态漏掉具体失败门禁。  
适用：`/dashboard`、`/system-overview`（zh/en）。

## 固定展示顺序（必须）

1. `overall`（先看总状态：`PASS`/`FAIL`）
2. `passed/failed`（再看通过数与失败数：`passedCount/totalCount`）
3. `failedGates`（最后看失败门禁清单：`gates[].name where ok=false`）

## text / json 边界（沿用 v1）

- text：值班播报与人工复核（快速读失败段落）
- json：自动化采集与群机器人（稳定读取结构化字段）

## failedGates 两种样例读法

- `failedGates=none`：可按 PASS 流程播报，但仍需附 `passedCount/totalCount`。
- `failedGates!=none`：先报第一条失败 gate，再给出“暂停放行 + 对应修复动作”。

## 图示口径

- 红框：`overall`
- 黄框：`passed/failed`
- 第三框：`failedGates`（绿色=`none`；红色=`!=none`）

## 证据图（4 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v11-zh-dashboard-none.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v11-zh-system-overview-failed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v11-en-dashboard-none.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v11-en-system-overview-failed.png`

## 值班可用性

可直接值班群使用：`yes`
