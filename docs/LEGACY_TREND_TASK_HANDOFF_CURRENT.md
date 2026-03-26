# LEGACY_TREND_TASK_HANDOFF_CURRENT

## 1. 交接目的

本文是给后续真正可以修改 legacy Java 源码的人使用的执行清单。

目标不是重复分析，而是让接手方直接知道：

- 先修哪里
- 修完怎么验
- 哪些结果算通过
- 哪些风险不能忽略

## 2. 当前已确认问题

### 问题标题

- `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 空指针导致运行参数历史曲线链路不稳定

### 影响范围

- `reg_value_ten_min_*`
- `getRunParamsCurve`
- `getRunParamsCurveByTagName`
- 新壳趋势页 `/trend-analysis`

### 当前对业务的影响

- 趋势页可演示
- 趋势页不可正式签收

## 3. 已有证据

### 3.1 日志证据

日志文件：

- `/Users/billchow/Documents/126lnoffice/ServerAndScript/logs/coldSite-service.log`

已确认内容：

- `EnergyStatisticsTask` 在“10分钟一次统计并记录数据”时抛：
  - `java.lang.NullPointerException`
- 堆栈指向：
  - `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`
- 异常前连续出现：
  - `regDataMap.isEmpty()`

### 3.2 字节码证据

已确认：

- `HomePageServiceImpl.getRunParamsCurveByTagName(...)`
  - 依赖 `ReportManageMapper.findByTenMinDataByTagNameAndTimeOrderDesc(...)`
- `getRunParamsCurveByTagName` 本质查询：
  - `reg_value_ten_min_*`

已确认高可信候选 bug：

- `executeTaskTenMin(...)` 中
  - 先判断 `CollectionUtils.isEmpty(currentTaskObjList)`
  - 再在空分支日志中调用 `currentTaskObjList.size()`
  - 若 `currentTaskObjList == null`，直接 `NullPointerException`

### 3.3 接口证据

当前运行态：

- `GET /zsqy/homepage/{siteId}/getEnergyStatisticsCurve`
  - `200`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurve`
  - `500`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName?...`
  - `200`
  - 但关键指标无有效历史点
- `GET /api/homeData/{siteId}/energyEfficiency`
  - `200`
  - 仅提供快照值

## 4. 修复优先顺序

### Step 1

修 `executeTaskTenMin(...)` 的空指针。

这是唯一 P0。

### Step 2

确认修完后 `reg_value_ten_min_*` 是否恢复稳定写入。

### Step 3

确认 `getRunParamsCurve` 是否从 `500` 恢复到 `200`。

### Step 4

确认 `getRunParamsCurveByTagName` 对以下指标有历史点：

- `coldStationCop`
- `chilledWaterTemperatureDifference`
- `chilledOutWaterTemperatureDifference`

### Step 5

最后才回到 BFF / 页面复验。

## 5. 源码修复建议

### 5.1 最小修法

在 `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 的 line 843 附近：

- 所有 `currentTaskObjList.size()` 前加显式空判断
- `null` 与 `empty list` 分支分开处理

最小目标：

- 即使取不到 `currentTaskObjList`
- 任务也不能抛异常中断

### 5.2 建议保护方式

建议把这一段改成类似：

```java
if (CollectionUtils.isEmpty(currentTaskObjList)) {
    int currentSize = currentTaskObjList == null ? 0 : currentTaskObjList.size();
    log.debug("...", currentTenDateTime, dbNameData, currentTenTableName, currentSize, qsTagList.size());
    return;
}
```

说明：

- 这里只是示意，不是最终源码补丁
- 真实修法应结合业务需要决定是 `return`、`continue`、还是走 fallback write

### 5.3 更稳的修法

除了补空判断，还建议：

- 对“无数据窗口”加显式业务策略
  - `skip write`
  - 或 `fallback write`
  - 或 `mark missing`
- 不要再让任务依赖隐式空对象继续流转

## 6. 数据验证清单

修复后至少查这几项：

### 6.1 表写入是否恢复

检查：

- `reg_value_ten_min_2026`

重点确认：

- 新时间窗口是否持续新增
- 不只是电量/功率 tag，关键运行参数 tag 也有值

重点 tag：

- `coldStationCop`
- `chilledWaterTemperatureDifference`
- `chilledOutWaterTemperatureDifference`

### 6.2 时间连续性

检查：

- 最近 24 小时是否具备连续时间点
- 是否仍存在大段时间窗完全无值

## 7. 接口验证清单

修复后按顺序验证：

### 7.1 legacy

- `/zsqy/homepage/{siteId}/getRunParamsCurve`
  - 预期：`200`
- `/zsqy/homepage/{siteId}/getRunParamsCurveByTagName?...`
  - 预期：关键指标有历史点

### 7.2 BFF

- `/bff/v1/sites/{siteId}/dashboard/trends?range=24h`
  - 预期：
    - 至少 2 条以上连续有效趋势序列
    - `sourceStatus.overall != partial`

### 7.3 页面

- `/trend-analysis`
  - 预期：
    - `currentCop` 不再只是单点
    - `chilledDeltaT / coolingDeltaT` 至少有 1 条补成连续曲线
    - 页面可进入正式签收复验

## 8. 回归清单

修复后不要只看趋势页。

还要回归：

- 首页快照：
  - `/api/homeData/{siteId}/energyEfficiency`
- recommendations：
  - 依赖 `station_cop / chilled_delta_t_c / cooling_delta_t_c`
- release-command-center 相关运行态判断

原因：

- 这些地方都共享同一批核心能效指标

## 9. 通过标准

### 视为“修复完成”

需要同时满足：

1. `executeTaskTenMin` 不再抛空指针
2. `reg_value_ten_min_*` 连续写入恢复
3. `getRunParamsCurve` 恢复 `200`
4. `getRunParamsCurveByTagName` 对关键指标返回有效历史点
5. BFF `dashboard/trends` 至少形成 2 条连续有效序列

### 视为“趋势页可签收”

还需再满足：

6. `/trend-analysis` 重跑 final UI review 后通过

## 10. 当前主控建议

交给 legacy 源码接手方时，建议直接按这个顺序执行：

1. 先修 `executeTaskTenMin`
2. 再查 `reg_value_ten_min_*`
3. 再查 `getRunParamsCurve / getRunParamsCurveByTagName`
4. 最后才回到 BFF 和页面

不要反过来先改新壳或 BFF 去兜底。
