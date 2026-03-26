# verify-gates --json 值班读法卡 v1

用途：统一值班“人工播报”和“自动化采集”两种读取模式。  
适用页面：`/dashboard`、`/system-overview`（zh/en）。

## text 与 json 使用边界

- text 模式（值班播报）：`./scripts/chiller_ctl.sh verify-gates`
- json 模式（自动化采集）：`./scripts/chiller_ctl.sh verify-gates --json`

边界说明：
- text 用于人在群里快速读结果与失败段落。
- json 用于脚本稳定抓取，不用于替代页面人工复核。

## 值班固定读取项（json）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
```

必读 3 项：
- `overall`：总状态（`PASS`/`FAIL`）
- `passedCount`：通过门禁数（当前总数为 `7`）
- `failed gate`：从 `gates[]` 中筛选 `ok=false` 的 `name`

建议提取（值班脚本）：

```bash
jq -r '.overall, (.passedCount|tostring) + "/" + (.totalCount|tostring)' docs/verify-gates-latest.json
jq -r '[.gates[] | select(.ok==false) | .name] | if length==0 then "none" else join(", ") end' docs/verify-gates-latest.json
```

## 页面读法映射（4 张图同口径）

- 红框：`overall` 对应的页面总状态读取位（先读）
- 黄框：`passedCount` 对应的聚合状态读取位（再读）
- 青框：`failed gate` 对应的故障入口读取位（最后读）

## 证据图（zh/en + dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-json-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`
