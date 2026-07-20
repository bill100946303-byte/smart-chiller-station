# 本地主控联调 Runbook

## 目标

在不等待其它线程回传的前提下，主控快速判断当前阻塞点：

1. 旧后端 `8098` 是否可达  
2. BFF `8787` 是否可达  
3. 前端 dev 服务是否可达  
4. OpenAPI 合同是否保持可解析且示例与 schema 一致  

## 一键命令

### 统一控制入口（推荐）

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --json
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --strict-freshness
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --strict-freshness --json
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate-latest
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept --dry-run
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check 126lnoffice
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept-contract
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept
RUNTIME_REQUIRED=0 /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight
RUNTIME_REQUIRED=0 /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight --strict-freshness
```

说明：`chiller_ctl.sh` 是主控聚合入口，底层仍调用 `manage_3001_entry.sh / check_stack.sh / v19_2_acceptance.sh / release_preflight_v1_8.sh`。

### 参数优先级（统一规则）

三个脚本 `start_local_stack.sh` / `check_stack.sh` / `check_trigger_readiness.sh` 使用同一优先级：

1. 命令参数（仅 `SITE_ID`）  
2. 显式环境变量（如 `SITE_ID`、`TREND_RANGE`、`BFF_BASE_URL`）  
3. `apps/chiller-shell-v1/.env.local` 中的 `VITE_*`（如 `VITE_SITE_ID`、`VITE_TREND_RANGE`、`VITE_BFF_BASE_URL`）  
4. 脚本默认值  

### 1) 启动本地 BFF + 前端

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh
```

可选端口覆盖：

```bash
BFF_PORT=8787 FRONTEND_PORT=3001 /Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh
```

运行端前端端口自动回退（默认 `3001 3003 3004`，`3002` 固定保留给配置中心）：

```bash
FRONTEND_PORT=3001 FRONTEND_FALLBACK_PORTS="3001 3003 3004" /Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh
```

说明：当 `3001` 启动失败（如 `EADDRINUSE/EPERM`）时，脚本会自动尝试下一个候选端口。

`3002` 是 `apps/chiller-admin-v1` 的固定配置中心入口。运行端回退端口不得占用 `3002`，否则 3001 的“物理站房登记/能源对象接入”按钮会打开错误应用。配置中心按其 README 单独启动：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-admin-v1
npm run dev -- --host 127.0.0.1 --port 3002
```

可选前端站点与趋势范围覆盖（不改代码切站点）：

```bash
SITE_ID=126lnoffice TREND_RANGE=7d /Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh
```

可选前端 BFF 地址覆盖：

```bash
BFF_APP_BASE_URL=http://127.0.0.1:8787 /Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh
```

若 `apps/chiller-shell-v1/.env.local` 已设置 `VITE_SITE_ID`、`VITE_TREND_RANGE`、`VITE_BFF_BASE_URL`，启动脚本会自动读取，无需重复传参。

### 2) 执行联调检查

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/check_stack.sh 126lnoffice
```

也可通过环境变量指定站点（不传命令参数）：

```bash
SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/check_stack.sh
```

在“先启动再检查”一体化模式下执行（适合本机快速复核）：

```bash
AUTO_BOOT=1 SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/check_stack.sh
```

说明：`AUTO_BOOT=1` 会先调用 `start_local_stack.sh` 再做健康检查；若失败会自动打印 BFF/前端日志尾部。
`check_stack.sh` 还会校验前端 `Server` 响应头默认包含 `vite`（可用 `FRONTEND_EXPECT_SERVER=""` 关闭，或设置成自定义关键字）。

### 2.1) 触发待命线程判定

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/check_trigger_readiness.sh 126lnoffice
```

也可通过环境变量指定站点和趋势范围：

```bash
SITE_ID=126lnoffice TREND_RANGE=7d /Users/billchow/Documents/智慧冷冻站/scripts/check_trigger_readiness.sh
```

输出文件：

- `/tmp/chiller_trigger_report_<siteId>.json`
- `/tmp/chiller_trigger_state_<siteId>.json`（用于“两次连续满足”判定）

示例：

- `SITE_ID=126lnoffice` -> `/tmp/chiller_trigger_report_126lnoffice.json`
- `SITE_ID=custom_site_001` -> `/tmp/chiller_trigger_report_custom_site_001.json`

### 3) 停止本地服务

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/stop_local_stack.sh
```

## 常见结论解释

- `legacy health unreachable`：旧系统后端未启动或端口未通，优先排查 `8098`。
- `bff health unreachable`：BFF 未拉起，先看 `/tmp/chiller-bff-dev.log`。
- `frontend entry unreachable`：前端未拉起，先看 `/tmp/chiller-shell-dev.log`。
- `contract check passed` 但接口空值：说明合同无漂移，但上游数据源还未恢复。
- `triggerReady.hvacRules=false`：通常是 8098 未通，或未达到“两次连续有趋势+告警数据”。
- `triggerReady.uiDesign=false`：通常是 `trends.points` 为空或 P0 源状态仍为 failed。

## 日志位置

- BFF: `/tmp/chiller-bff-dev.log`
- 前端: `/tmp/chiller-shell-dev.log`
- 主控检查临时输出: `/tmp/chiller_probe.json`
