# release-ready-latest-check 值班卡 v1

用途：值班确认 latest 别名检查命令可直接替代常用检查命令，口径不变。  
适用页面：`/dashboard`、`/system-overview`（zh/en）。

## 语义对比（结论：等价）

- `release-ready-check`
  - 作用：执行 `check:release-ready` 合同校验。
- `release-ready-latest-check`
  - 作用：与 `release-ready-check` 同一实现入口，语义等价。

值班口径：两者只是在命令名上区分“latest”语义，检查内容一致，不改变判定标准。

## 推荐用法

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
```

可选自测：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check --selftest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check --selftest
```

## 页面读法

1. 先读顶部总状态位（是否可继续）
2. 再读摘要状态位（当前检查结果）
3. 最后读风险入口位（异常时回到 check 日志）

## 图示说明

- 金框：`release-ready-check` 读取位
- 紫框：`release-ready-latest-check` 读取位（等价）
- 红框：异常回查入口位

## 证据图（zh/en + dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-latest-check-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`
