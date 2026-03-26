# LEGACY_TREND_REGRESSION_CHECKLIST_CURRENT

## 1. 目的

本文用于在 legacy 修复 `executeTaskTenMin(...)` 后，按统一顺序回归趋势链，避免只看单个接口就误判“问题已解决”。

## 2. 使用前提

适用场景：

- legacy Java 源码侧已提交并部署趋势统计链修复
- 需要验证这次修复是否足以推动 `/trend-analysis` 重新进入正式签收复验

不适用场景：

- 尚未修复 `EnergyStatisticsServiceImpl.executeTaskTenMin(...)`
- 尚未恢复 10 分钟统计产物写入

## 3. 回归顺序

必须严格按以下顺序执行：

1. 任务层
2. 数据层
3. legacy 接口层
4. BFF 层
5. 页面层

不要跳过中间层直接看页面。

## 4. 回归清单

### 4.1 任务层

检查项：

- `EnergyStatisticsTask` 不再报 `NullPointerException`
- 不再出现：
  - `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`
- 不再持续出现异常前的失败闭环：
  - `regDataMap.isEmpty()`

通过标准：

- 最近至少 1 个统计周期内无同类异常

### 4.2 数据层

检查项：

- `reg_value_ten_min_*` 最近时间窗口恢复写入
- 至少以下指标存在连续时间点：
  - `coldStationCop`
  - `chilledWaterTemperatureDifference`
  - `chilledOutWaterTemperatureDifference`

通过标准：

- 最近 24 小时内能看到连续新增，而不是仅单点补写

### 4.3 legacy 接口层

检查项：

- `GET /zsqy/homepage/{siteId}/getRunParamsCurve`
  - 从 `500` 恢复为 `200`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName?...`
  - 对关键指标返回有效历史点，而不是空数组

通过标准：

- `getRunParamsCurve`：`200`
- `getRunParamsCurveByTagName`：
  - `coldStationCop`
  - `chilledWaterTemperatureDifference`
  - `chilledOutWaterTemperatureDifference`
  均能返回可用历史点

### 4.4 BFF 层

检查项：

- `GET /bff/v1/sites/{siteId}/dashboard/trends?range=24h`
- `GET /bff/v1/sites/{siteId}/dashboard/trends?range=7d`

通过标准：

- 至少 `2` 条以上连续有效趋势序列
- `trends.sourceStatus.overall` 不再长期为 `partial`
- `currentCop / chilledDeltaT / coolingDeltaT` 中至少新增 `1` 条连续有效序列

### 4.5 页面层

检查项：

- 打开 `/trend-analysis`
- 切换：
  - `24h`
  - `7d`
- 切换指标：
  - `totalPowerKw`
  - `currentCop`
  - `chilledDeltaT`
  - `coolingDeltaT`

通过标准：

- 页面不再把关键指标长期显示为空态
- final UI review 可重新进入通过判定

## 5. 补充回归项

修复完成后，顺手复核：

- `/api/homeData/{siteId}/energyEfficiency`
- `/bff/v1/sites/{siteId}/recommendations`
- `release-command-center` 中涉及 `station_cop / chilled_delta_t_c / cooling_delta_t_c` 的观察口径

说明：

- 这些共享同一批核心能效指标
- 虽然当前不阻断主线，但值得确认没有被修复动作带偏

## 6. 最终判定

### 视为 legacy 修复完成

需要同时满足：

1. 任务层通过
2. 数据层通过
3. legacy 接口层通过
4. BFF 层通过

### 视为趋势页可重新申请签收

还需再满足：

5. 页面层通过

## 7. 当前主控建议

legacy 修复后，建议按本文清单执行一次完整回归，再回到本仓库重跑：

- `dashboard/trends`
- `/trend-analysis`
- final UI review / signoff

不要只凭 `getRunParamsCurve=200` 就直接宣布趋势页可签收。
