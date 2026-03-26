# release-ready-sync 值班操作卡 v1

用途：发布前先同步最新门禁结果，再校验，再读取只读结论，避免用旧文件误判。  
统一入口：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh`

## 固定流程（必须按顺序）

### 1) 先 `sync`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --json
```

目标（1句）：把 `release-ready`、`release-ready-check`、`release-ready-latest` 串行执行并刷新同步结果。  
通过标准（1句）：输出 JSON 存在且包含 `decision / exitCode / generatedAt`。  
失败第一步（1句）：先看 `reasons[0]`，按阻断原因处理后再重跑 `release-ready-sync`。

### 2) 再 `check`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check
```

目标（1句）：确认门禁判定与关键字段完整性。  
通过标准（1句）：`decision` 可读且 `exitCode` 与门禁结果一致。  
失败第一步（1句）：若字段缺失或门禁不一致，先停止放行并复核上游报告文件。

### 3) 最后 `latest`（只读播报）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest --json
```

目标（1句）：对值班群播报“本次同步后的最终只读结论”。  
通过标准（1句）：`generatedAt` 为本次同步窗口内时间。  
失败第一步（1句）：若时间戳过旧，回到第 1 步重新 `sync`，禁止直接口头放行。

## 三个标准动作（GO / NO-GO / UNKNOWN）

- GO：可发版；群内播报 `GO + generatedAt + advisories(如有)`。
- NO-GO：禁止发版；先处理第一条 `reason`，修复后重新执行 `sync -> check -> latest`。
- UNKNOWN：信息不足；视同阻断，先重跑 `release-ready-sync --json` 再判定。

## 页面读取点（sync 后）

说明：下方证据图均已用绿色框标出“sync 后读取点”，包含顶部角标、Source Banner 摘要位或同层可读状态位。  
约束：页面 PASS/FAIL 结论只读后端判定结果，不允许前端自行推断。

## 证据图（zh/en * dashboard/system-overview）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-ready-sync-v1-en-system-overview.png`

## 值班可用性

可直接值班群使用：`yes`
