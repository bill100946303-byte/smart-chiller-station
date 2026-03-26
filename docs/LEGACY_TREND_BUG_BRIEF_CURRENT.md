# LEGACY_TREND_BUG_BRIEF_CURRENT

## 1. 问题摘要

当前新壳趋势页 `/trend-analysis` 已经满足：

- 可联调：`yes`
- 可演示：`yes`

但仍未达到正式签收，唯一阻塞项是：

- `upstream_trend_quality`

该阻塞项已经收敛到 legacy 侧 10 分钟运行参数统计链。

## 2. 业务影响

当前真实影响范围：

- 新壳趋势页无法正式签收
- `currentCop` 只有单点
- `chilledDeltaT / coolingDeltaT` 无连续历史序列

当前未受影响的部分：

- 告警页
- 设备页
- 设备页二期
- release-command-center 主链

## 3. 当前已确认事实

### 3.1 正常链路

- `GET /zsqy/homepage/{siteId}/getEnergyStatisticsCurve`
  - `200 OK`
  - 可稳定提供能源曲线
- `GET /api/homeData/{siteId}/energyEfficiency`
  - `200 OK`
  - 可稳定提供快照值

### 3.2 异常链路

- `GET /zsqy/homepage/{siteId}/getRunParamsCurve`
  - 持续 `500`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName?...`
  - `200 OK`
  - 但关键指标无有效历史点

### 3.3 关键依赖

已确认：

- `getRunParamsCurveByTagName(...)`
  - 最终查询 `reportManageMapper.findByTenMinDataByTagNameAndTimeOrderDesc(...)`
- 它依赖：
  - `reg_value_ten_min_*`

## 4. 当前最高可信根因

日志与字节码证据共同指向：

- `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`

当前最高可信 bug 候选：

- `currentTaskObjList` 为空时
- 代码进入空集合日志分支
- 该分支又调用 `currentTaskObjList.size()`
- 导致 `NullPointerException`

这会进一步造成：

1. 10 分钟统计任务中断
2. `reg_value_ten_min_*` 产物不稳定
3. `getRunParamsCurve / getRunParamsCurveByTagName` 无法提供稳定历史曲线
4. 趋势页只能维持“可演示，不可签收”

## 5. 建议修复顺序

### P0

修 `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 空指针。

### P1

确认 `reg_value_ten_min_*` 恢复稳定写入。

### P2

复核：

- `getRunParamsCurve`
- `getRunParamsCurveByTagName`

是否恢复关键运行参数历史点。

## 6. 验证标准

视为 legacy 修复完成，至少需要同时满足：

1. `executeTaskTenMin` 不再抛空指针
2. `reg_value_ten_min_*` 连续写入恢复
3. `getRunParamsCurve` 恢复 `200`
4. `getRunParamsCurveByTagName` 对以下指标返回有效历史点：
   - `coldStationCop`
   - `chilledWaterTemperatureDifference`
   - `chilledOutWaterTemperatureDifference`

视为趋势页可重新进入正式签收复验，还需满足：

5. `/bff/v1/sites/{siteId}/dashboard/trends?range=24h`
   - 至少形成 `2` 条以上连续有效序列
6. `/trend-analysis`
   - final UI review 重跑通过

## 7. 当前主控建议

当前不建议：

- 继续改趋势页前端
- 在 BFF 里伪造历史曲线
- 用快照值拼接假趋势

当前建议：

1. 把本问题交给可编辑 legacy Java 源码的人处理
2. 按 `executeTaskTenMin -> reg_value_ten_min_* -> run params curve -> BFF -> 页面` 的顺序回归

## 8. 关联文档

- [TREND_UPSTREAM_GAP_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/TREND_UPSTREAM_GAP_CURRENT.md)
- [LEGACY_TREND_TASK_FIX_PLAN_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_TASK_FIX_PLAN_CURRENT.md)
- [LEGACY_TREND_TASK_HANDOFF_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_TASK_HANDOFF_CURRENT.md)
