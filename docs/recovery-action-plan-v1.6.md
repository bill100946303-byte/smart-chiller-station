# 冷站系统 V1.6 恢复行动单（基于 v1.5 终验）

## 1) 当前结论
- 非降级态终验未通过。
- 本轮失败归因已确认：`上游接口`（非前端呈现问题）。
- 量化结果（当前）：
  - Dashboard: `M1=2/4`、`M2=0`、`M3=2/3`
  - SystemOverview: `M1=0/1`、`M2=0`、`M3=2/3`

## 2) 主责拆分（Owner）
- `legacy`：修复 `runParams` 500、恢复可用时序数据（主责）。
- `bff`：保持降级可观测、fallback 链路可解释、sourceStatus 稳定。
- `shell`：严格中文默认展示、状态提示与诊断区一致性。

## 3) 执行顺序（按优先级）
1. `legacy` 先修复 `/zsqy/homepage/{siteId}/getRunParamsCurve` 的 500。
2. `legacy` 确认可返回三条核心可评估信号：`chilled_delta_t_c`、`cooling_delta_t_c`、`station_cop`。
3. `bff` 复测 `node apps/chiller-bff/scripts/probe.js 126lnoffice`，确认 `skippedRuleIds` 不再含因缺指标导致的 skip。
4. `shell` 复拍 v1.5 的 6 张阈值图，执行 PASS/FAIL 重判。

## 4) 完成判据（Go/No-Go）
- Go 条件（全部满足）：
  - `M1` 达标（异常来源数不超阈值）
  - `M2=0`（无 stale）
  - `M3>=80%` 且 `non_empty_series>=2`
  - 连续两次采样（间隔 >= 5 分钟）均满足
- 任一不满足即 No-Go，继续保持“降级态可读性通过”但不宣称“非降级态通过”。

## 5) 最小复测命令
```bash
AUTO_BOOT=1 SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/check_stack.sh
node /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff/scripts/probe.js 126lnoffice
node /Users/billchow/Documents/智慧冷冻站/scripts/evaluate_non_degraded_readiness.mjs --input /tmp/chiller_probe.json --output /Users/billchow/Documents/智慧冷冻站/docs/non-degraded-readiness-report-v1.6.json
```

## 6) 备注
- 本行动单只做执行收口，不更改阈值、不更改规则逻辑、不更改字段定义。
