# V1.8 发布后首周周报巡检模板 v1.0

用途：将 `warning-open` 项拆分为“每日巡检 + 周报巡检”双层执行，供机器人或人工打卡。  
边界：仅数据治理层，不改业务字段定义、不改 `null_strategy`。

基线来源：
- `docs/readiness-warning-roadmap-v1.8.csv`
- `docs/readiness-baseline-freeze-v1.8.md`（未提供 `v1.8.1`，本周按 `v1.8` 执行）
- `docs/readiness-week1-daily-checks-v1.0.csv`

---

## 1. warning-open 双层拆分结果

- 每日巡检（4 项）：`W-001/W-002/W-003/W-007`
- 周报巡检（4 项）：`W-004/W-005/W-006/W-008`

---

## 2. 周报巡检项（owner / 阈值 / 告警动作）

| weekly_check_id | source_warning_id | metric | dimension | owner | 周阈值 | 告警动作 |
| --- | --- | --- | --- | --- | --- | --- |
| WKR-001 | W-004 | `station_total_power_kw` | `unit_consistency` | `bff` | 一周内单位不一致事件 `>0` 即告警 | 建立 readiness unit gate；未完成前在周报标记“持续风险”并抄送 BFF owner |
| WKR-002 | W-005 | `chilled_delta_t_c` | `unit_consistency` | `bff` | 一周内单位不一致事件 `>0` 即告警 | 建立 `℃/degC` 一致性校验；发生异常时要求 24h 内给修复计划 |
| WKR-003 | W-006 | `cooling_delta_t_c` | `unit_consistency` | `bff` | 一周内单位不一致事件 `>0` 即告警 | 建立 `℃/degC` 一致性校验；异常周不得关闭该 warning |
| WKR-004 | W-008 | `core_4_metrics` | `i18n_completeness` | `shell` | 三语缺失项计数 `>0` 即告警 | 建立 core4 三语回归钩子；缺失项当周必须补齐并回归截图 |

---

## 3. 每日巡检汇总（周报引用）

数据源：`docs/readiness-week1-daily-checks-v1.0.csv` 打卡结果。

| daily_check_id | 对应 warning | owner | 本周 pass 天数 | 本周 warn/fail 天数 | 是否触发周级告警 |
| --- | --- | --- | --- | --- | --- |
| D-001 | W-001 | shell |  |  |  |
| D-002 | W-002 | shell |  |  |  |
| D-003 | W-003 | shell |  |  |  |
| D-004 | W-007 | bff |  |  |  |

周级告警判定建议：
- 任一每日项出现 `warn/fail >= 2 天` -> 周级告警（需在下周一前提交修复动作）。

---

## 4. 周报输出模板（可直接填报）

### 4.1 本周摘要
- 周期：`YYYY-MM-DD ~ YYYY-MM-DD`
- warning-open 总量：`8`（基线）
- 每日层异常项：`{count}`
- 周报层异常项：`{count}`
- 是否影响当前放行：`no`（默认；若出现 blocking 漂移则改为 `yes`）

### 4.2 异常明细
| 项目 | owner | 触发次数 | 主要原因 | 已执行动作 | 下周计划 |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

### 4.3 结论
- 结论：`继续放行 / 保留观察 / 升级风险`
- 主控建议：`一句话`

---

## 5. 执行注意

1. 本模板仅管理 warning-open，不改放行 baseline 的 blocking 结论。  
2. 若发现 core4 证据路径断裂（例如 `/tmp/chiller_probe.json` 缺关键路径），需立即升级为 blocking 复核。  
3. 周报层问题处理优先级：`P1（比较约束） > P2（单位与三语完整性）`。
