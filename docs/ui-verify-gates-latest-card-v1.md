# verify-gates-latest 只读值班卡 v1

用途：值班先读 latest 文件快速播报，再决定是否需要重跑门禁。  
适用页面：`/dashboard`、`/system-overview`（zh/en）。

## 模式边界（必须区分）

- latest 只读模式：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest --json
```

说明：只读取 `docs/verify-gates-latest.json`，不重算、不刷新门禁结果。

- verify-gates 重跑模式：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
```

说明：会执行全量门禁检查并覆盖写入 latest 文件，适合发布前复核。

## 值班固定读法

1. 先读 `overall`
2. 再读 `passed`（`passedCount/totalCount`）
3. 最后读 `failedGates`（`none` 或具体 gate 名）

## 两态说明

- `failedGates=none`：可按“当前门禁全通过”播报。
- `failedGates!=none`：先报第一条失败 gate，再执行对应修复动作，禁止口头放行。

## 证据图（zh/en + dashboard/system-overview，含 none/非none）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-latest-v1-zh-dashboard-none.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-latest-v1-zh-system-overview-failed.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-latest-v1-en-dashboard-none.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-latest-v1-en-system-overview-failed.png`

## 值班可用性

可直接值班群使用：`yes`
