# release-ready-sync 值班异常态卡片 v1

用途：当 `release-ready-sync` 链路出现异常时，值班同学按固定顺序止损，避免误放行。  
入口命令：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh`

## 固定排查顺序

1. 先跑 `release-ready-sync --json`（拿最新聚合结论）
2. 再跑 `release-ready-check`（校验字段与门禁）
3. 最后读 `release-ready-latest --json`（只读播报）

## 异常类型与动作

### A) latest 缺失

判定信号：`release-ready-latest --json` 返回文件缺失、字段缺失或时间戳为空。  
值班第一动作（1句）：立即重跑 `release-ready-sync --json` 生成最新文件，并复读 `generatedAt`。  
禁止动作（1句）：禁止用历史群消息或旧截图代替 latest 结论直接放行。

### B) check 失败

判定信号：`release-ready-check` 返回非 0 或提示合同字段不一致。  
值班第一动作（1句）：先停止发版，并把第一条失败原因同步到值班群后转交对应责任人。  
禁止动作（1句）：禁止跳过 `check` 直接引用 `latest` 的旧结果做 GO 结论。

### C) sync = NO-GO

判定信号：`release-ready-sync --json` 或 `latest` 中 `decision=NO-GO`。  
值班第一动作（1句）：按 `reasons[0]` 先处理阻断项，修复后完整重跑 `sync -> check -> latest`。  
禁止动作（1句）：禁止前端依据页面观感或局部指标自行推断 PASS 覆盖后端 NO-GO。

## 页面读取约束

- 页面角标只读后端判定结果（`pass`/`decision`），前端不参与推断。
- 异常播报顺序固定：`decision/exitCode -> reasons/advisories -> generatedAt`。

## 证据图（zh/en * dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-error-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-error-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-error-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-error-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`
