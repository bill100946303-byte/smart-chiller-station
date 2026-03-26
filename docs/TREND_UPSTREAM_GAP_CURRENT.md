# TREND_UPSTREAM_GAP_CURRENT

## 1. 目的

本文用于固定当前趋势页未达到正式签收条件的真实上游原因，避免后续把问题误判成前端展示问题或合同问题。

## 2. 当前结论

当前趋势页的历史挂起项已经进一步收敛并完成一轮 BFF 侧维护修复。

当前状态：

- `totalPowerKw` 有稳定连续序列
- `currentCop` 已形成连续 10 分钟序列
- `chilledDeltaT / coolingDeltaT` 已恢复为带时间戳的连续序列
- `trends.sourceStatus.overall = ok`

说明：

- 当前“温差序列 `points[].t = null`”这一具体问题已不再成立
- 该子问题已从“趋势挂起根因”转为“已修复并已完成页面回归验证”
- 当前下一步应进入：
  - `maintain`

## 3. 已确认不再是问题的部分

以下层面已经收口，不是当前阻塞来源：

- 前端页面接入
  - `TrendAnalysisPage.tsx` 已真实消费 `overview + trends`
- 合同层
  - `generatedAt` 已入主合同
  - `range` 已严格限制为 `24h / 7d / 30d`
- 演示口径
  - 页面已经能把 `series / stats / freshness / sourceStatus` 映射成可解释状态
  - 趋势页当前已具备演示条件

## 4. 上游实测证据

### 4.1 `getEnergyStatisticsCurve`

实测：

- `GET /zsqy/homepage/126lnoffice/getEnergyStatisticsCurve`
- 返回：`200 OK`

当前可稳定提供：

- `Chiller Total Power`
- `Cooling Tower Total Power`
- `Chilled Water Pump Total Power`
- `Condenser Water Pump Total Power`

其中真正被当前趋势页消费到连续有效点的，是：

- `totalPowerKw`

说明：

- 能源曲线源是通的
- 但它当前不直接提供 `currentCop / chilledDeltaT / coolingDeltaT` 的连续历史曲线

### 4.2 `getRunParamsCurve`

当前通过 BFF 侧运行态可见：

- `/bff/v1/sites/{siteId}/dashboard/trends?range=24h`
- `sourceStatus.sources[key=runParams]`
- 当前为：
  - `ok=true`
  - `status=200`
  - `message='OK; fallbackByTag=3/3'`

说明：

- 运行参数历史链已经不再表现为整体 `500`
- `runParams` 当前已稳定返回 `200`
- `fallbackByTag=3/3` 已命中全部关键指标
- 当前不再把“运行参数链整体不可用”视作正式阻塞

### 4.3 `getRunParamsCurveByTagName`

当前通过 BFF 返回结果可确认：

- `currentCop`
  - 已返回连续 10 分钟点
  - `points[].t` 正常
- `chilledDeltaT`
  - 已返回连续点
  - `points[].t` 正常
- `coolingDeltaT`
  - 已返回连续点
  - `points[].t` 正常

说明：

- 已确认：
  - legacy 原始 `getRunParamsCurveByTagName` 返回中，时间字段在 `name`
  - BFF `parseFlatPointRows(...)` 已支持读取 `row.name`
  - `loadTrendSeries(...)` 的序列选择逻辑已修正
- 当前温差序列已经不再表现为“有值但无时间”
- 当前 `currentCop / chilledDeltaT / coolingDeltaT` 在 BFF 输出中均已带出非空时间字段

补充确认：

- 旧前端编译产物中，单指标趋势页就是直接调用：
  - `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName`
- 说明我们当前选的 fallback 方向与旧系统原始做法一致，不是新壳自造路径
- 进一步实测：
  - `GET /zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?tagname=coldStationCop&title=冷站COP&date=2026-03-14`
  - `GET /zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?tagname=chilledWaterTemperatureDifference&title=冷冻水温差&date=2026-03-14`
  - 均为 `200 OK`，但仍未返回可用历史曲线点
- 更新后的直接实测：
  - `GET /zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?title=冷冻水温差&tagname=chilledWaterTemperatureDifference&date=2026-03-24`
  - `GET /zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?title=冷却水温差&tagname=chilledOutWaterTemperatureDifference&date=2026-03-24`
  - 返回的 `<data>` 中明确包含：
    - `<name>2026-03-24 23:50:00</name>`
    - `<value>...</value>`
- 当前问题不只是“少传了 date”
- 本轮最终定位为：
  - by-tag 原始返回中的时间字段已恢复
  - BFF 输出时间字段缺失是 `loadTrendSeries(...)` 序列选择逻辑导致
  - 该逻辑现已完成维护修复

### 4.4 `energyEfficiency`

实测：

- `GET /api/homeData/126lnoffice/energyEfficiency`
- 返回：`200 OK`

当前能稳定提供：

- `coldStationCop = 0.0`
- `chilledWaterTemperatureDifference = 0.2`
- `chilledOutWaterTemperatureDifference = 0.4`
- `totalPower = 0.3`

说明：

- 这是快照源，不是历史曲线源
- 它只能补当前值，不能补连续序列
- 因此最多支撑：
  - 页面摘要卡
  - 单点 fallback
  - 观察项展示
- 不能把它误当作多序列历史趋势来源

## 5. 当前 BFF 行为解释

当前 `dashboard/trends` 的真实行为是：

- `totalPowerKw`：来自 `getEnergyStatisticsCurve`，可形成连续序列
- `currentCop`：已形成连续 10 分钟序列
- `chilledDeltaT / coolingDeltaT`：已通过 by-tag fallback 恢复为带时间戳的连续序列

因此当前输出是合理的：

- 页面可演示
- 页面正式签收回归已通过
- 当前重点已从“补齐时间字段”转为“维护监控与防回归”

换句话说，当前这条问题链已经从“疑似 upstream 缺口”进一步坐实为：

- `loadTrendSeries(...)` 的序列选择策略缺陷
- 现已在 BFF 维护修复中纠正

## 5.1 运行参数历史曲线的真实依赖链

通过对 legacy jar 的 class 签名与字节码检查，已确认：

- `HomePageController.getRunParamsCurveByTagName(appName, tagname, title, ?, date)`
  - 实际会先把中文标题映射成固定 tag：
    - `冷冻水温差 -> chilledWaterTemperatureDifference`
    - `冷却水温差 -> chilledOutWaterTemperatureDifference`
    - 其他若干首页参数同理
- 随后 controller 调用：
  - `HomePageService.getRunParamsCurveByTagName(appName, parsedTagName, Integer, date)`
- `HomePageServiceImpl.getRunParamsCurveByTagName(...)` 内部并不是实时查首页快照，而是直接调用：
  - `reportManageMapper.findByTenMinDataByTagNameAndTimeOrderDesc(...)`

这意味着：

- `getRunParamsCurveByTagName` 的数据源，本质上依赖 `10分钟统计产物`
- 也就是依赖：
  - `reg_value_ten_min_*`
  - 或与之等价的 10 分钟统计结果表

因此当前趋势缺口的逻辑链已经明确：

1. 10 分钟统计任务异常
2. 运行参数历史产物不稳定
3. `getRunParamsCurve / getRunParamsCurveByTagName` 拿不到有效曲线
4. 趋势页只能靠快照值和单点 fallback 演示

## 5.2 进一步根因线索：10 分钟统计任务异常

日志已确认：

- `coldSite-service.log` 中存在：
  - `EnergyStatisticsTask`
  - `进行10分钟一次统计并记录数据发生异常`
  - `java.lang.NullPointerException`
  - 堆栈落在：
    - `com.hrxy.serviceImpl.EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`

异常前的直接线索：

- 日志连续出现：
  - `regDataMap.isEmpty()`
- 同时查询窗口命中：
  - `126lnoffice_data.tagdata_20260311`
  - 对 `2026-03-11 21:20:00` / `21:30:00` 的直接查询结果为 `0`
- 随后任务退回“查询 preTwentyDateTime 之前最近一次值”

当前推断：

- `getRunParamsCurve` 依赖的运行参数历史产物，很可能和这条 10 分钟统计任务直接相关
- 该任务当前存在空指针，导致运行参数历史曲线长期不完整或无法稳定生成

说明：

- 这是根据真实日志作出的工程推断，不是代码级最终定论
- 但它已经足以解释：
  - 为什么 `getRunParamsCurve` 持续 `500`
  - 为什么 `getRunParamsCurveByTagName` 即使 `200` 也可能拿不到有效历史点

## 5.3 更具体的空指针触发候选

通过对 legacy jar 中 `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 的字节码和行号表检查，已经把空指针候选收窄到一个非常具体的位置：

- 方法末段存在如下逻辑分支：
  - 先判断 `currentTaskObjList` 是否为空：
    - `CollectionUtils.isEmpty(currentTaskObjList)`
  - 如果为空，则进入日志分支
  - 该日志分支又直接调用：
    - `currentTaskObjList.size()`

而 `LineNumberTable` 显示：

- 这段日志分支正对应：
  - `EnergyStatisticsServiceImpl.java:843`

这与日志里的异常栈完全对上：

- `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`

因此当前最强的工程判断是：

- 当 `currentTaskObjList == null` 或未正常构造时
- 代码先通过“空集合判断”进入 fallback 分支
- 又在日志里调用 `currentTaskObjList.size()`
- 从而直接触发 `NullPointerException`

说明：

- 这是基于字节码与行号表的高可信根因候选
- 还不是源码级最终修复结论，但已经足够指导下一步处理

## 5.4 这对趋势页意味着什么

如果上述候选成立，那么当前趋势页缺口链路就非常清楚：

1. `executeTaskTenMin` 历史问题曾导致运行参数链不稳定
2. by-tag 原始链恢复后，时间字段已经出现在 `name`
3. BFF `loadTrendSeries(...)` 曾错误保留时间字段缺失的 `runParams` 温差序列
4. 本轮已完成最小维护修复，使 by-tag fallback 真正生效

## 6. 当前维护重点

趋势页当前已完成签收回归，后续只需要维持以下闭环：

1. 保持 `getRunParamsCurve` 及其回退链继续稳定返回
2. 保持 `currentCop / chilledDeltaT / coolingDeltaT` 的时间字段不回退
3. 如再次异常，按趋势回归清单重新复核

## 7. 推荐下一步

### 方案 A：维持当前签收结果

优先级：最高

动作：

- 对 `/bff/v1/sites/{siteId}/dashboard/trends?range=24h` 做例行抽检
- 对 `/trend-analysis` 页面做必要时的维护性回归
- 覆盖：
  - `24h`
  - `7d`
  - 默认全部指标
  - 多序列趋势图
  - stats / freshness / sourceStatus

适用场景：

- 当前目标是守住已签收结果，不让趋势页回退

### 方案 B：保留历史 upstream 复盘材料

优先级：次高

动作：

- 将 `executeTaskTenMin`、`reg_value_ten_min_*`、`getRunParamsCurve*` 的历史问题保留为复盘材料
- 不再把它们继续作为当前页面阻塞项

适用场景：

- 用于后续 legacy 侧复盘或防回归，不作为当前页面签收前置

## 8. 当前主控建议

当前更合理的做法是：

- 不再继续扩趋势页实现
- 当前直接进入：
  - `maintain`
- 历史 upstream 复盘材料保留，但不再作为当前页面阻塞项
