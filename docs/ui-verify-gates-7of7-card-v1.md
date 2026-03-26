# verify-gates=7/7 值班界面读法卡 v1

用途：在页面值班视角下，统一 `release-ready-brief` 与 `release-ready-brief-check` 的读取顺序。  
适用页面：`/dashboard`、`/system-overview`（zh/en）。

## 关键口径（必须一致）

- `verify-gates` 从 `6/6` 升级到 `7/7`，只代表门禁覆盖扩大。
- 该变化不代表业务阈值变化，不改变 GO/NO-GO 的业务判定标准。

## 读法顺序（值班固定动作）

1. 先读 `release-ready-brief`（摘要）

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief --json
```

看点：`decision / exitCode / latestGeneratedAt`，用于快速播报当前结论。

2. 再读 `release-ready-brief-check`（契约校验）

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check
```

看点：brief 契约是否 PASS；若 FAIL，摘要不可直接作为放行依据。

## 图示说明

- 黄色框：`release-ready-brief` 页面读取点（摘要优先位）
- 绿色框：`release-ready-brief-check` 复核读取点（契约复核位）

## 证据图（zh/en + dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-7of7-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-7of7-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-7of7-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-verify-gates-7of7-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`
