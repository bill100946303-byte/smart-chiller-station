# LEGACY_TREND_TASK_FIX_PLAN_CURRENT

## 1. 目的

本文用于把当前趋势页未签收的 legacy 根因，收敛成一份可执行的修复方案。

当前目标不是继续改前端，而是明确：

- 要修哪条 legacy 任务链
- 为什么修它
- 修完后要验证什么
- 如果暂时不能修，项目应保持什么结论

## 2. 当前问题定义

当前趋势页状态已经固定为：

- 可联调：`yes`
- 可演示：`yes`
- 正式签收：`no`

唯一阻塞项：

- `upstream_trend_quality`

进一步收窄后的 legacy 根因链：

1. `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 存在空指针风险
2. `reg_value_ten_min_*` 产物不稳定
3. `getRunParamsCurve` 持续 `500`
4. `getRunParamsCurveByTagName` 对关键指标查不到有效历史曲线
5. `currentCop / chilledDeltaT / coolingDeltaT` 无法形成稳定连续序列

## 3. 已确认事实

### 3.1 已通的链路

- `GET /zsqy/homepage/{siteId}/getEnergyStatisticsCurve`
  - `200 OK`
  - 能稳定提供能源曲线
- `GET /api/homeData/{siteId}/energyEfficiency`
  - `200 OK`
  - 能稳定提供快照值

### 3.2 已失败或失效的链路

- `GET /zsqy/homepage/{siteId}/getRunParamsCurve`
  - 持续 `500`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName`
  - `200 OK`
  - 但关键指标无有效历史点

### 3.3 已确认的实现依赖

通过 legacy jar 检查已确认：

- `getRunParamsCurveByTagName(...)`
  - 最终查询 `reportManageMapper.findByTenMinDataByTagNameAndTimeOrderDesc(...)`
- 它依赖的就是：
  - `reg_value_ten_min_*`

### 3.4 已确认的异常点

日志与字节码共同指向：

- `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`
- 极强候选根因：
  - `currentTaskObjList` 为空
  - 空分支日志又调用 `currentTaskObjList.size()`
  - 触发 `NullPointerException`

## 4. 修复优先级

### P0：修 `executeTaskTenMin` 空指针

这是当前最优先修复项。

原因：

- 它直接影响 10 分钟统计产物
- 它直接影响运行参数历史曲线
- 它直接影响趋势页是否能从“演示”推进到“签收”

### P1：核对 `getRunParamsCurveByTagName` 的真实查询前提

修完 P0 后仍要确认：

- 是否还依赖额外参数
- 是否对某些 tagName 有特殊来源表
- 是否受模板/项目模型配置影响

### P2：检查 `reg_value_ten_min_*` 的补数策略

目标不是立刻全量重算，而是确认：

- 当某个 10 分钟窗口缺数据时
- 旧系统是否本来就允许：
  - 继承上一值
  - 标记缺失
  - 跳过写入

## 5. 推荐修复动作

### 动作 1：修空日志分支

建议优先检查 `EnergyStatisticsServiceImpl.executeTaskTenMin(...)` 中 line 843 附近逻辑：

- 将所有 `currentTaskObjList.size()` 调用前置空判断
- 对 `null` 与 `empty list` 分开处理

最低要求：

- 空分支不再抛异常
- 即使当次窗口数据不完整，也能稳定返回、记录、跳过或降级

### 动作 2：补“无数据窗口”的安全策略

从日志看，任务里已经有几层 fallback：

- Redis 缓存
- preTen 数据
- preTwenty 数据
- 历史数据库最近一次值

当前建议：

- 不要让 fallback 最终回到“空对象继续参与后续逻辑”
- 对真正缺失窗口，明确走：
  - `skip write`
  - 或 `write fallback value`
  - 或 `mark missing but continue`

不要让任务直接中断。

### 动作 3：修完后再看 `getRunParamsCurve`

不要先改 BFF。

应先验证：

- `executeTaskTenMin` 修复后
- `reg_value_ten_min_*` 是否开始稳定新增
- 然后再看：
  - `getRunParamsCurve`
  - `getRunParamsCurveByTagName`
  是否自然恢复

## 6. 验证步骤

修复后至少验证以下链路：

### 6.1 任务层

- 观察 legacy 日志
- 确认不再出现：
  - `EnergyStatisticsTask ... NullPointerException`
  - `executeTaskTenMin(...:843)`

### 6.2 数据层

- 检查 `reg_value_ten_min_*` 是否在新时间窗口稳定写入
- 至少确认关键 tag：
  - `coldStationCop`
  - `chilledWaterTemperatureDifference`
  - `chilledOutWaterTemperatureDifference`

### 6.3 接口层

- `GET /zsqy/homepage/{siteId}/getRunParamsCurve`
  - 期待从 `500` 变为 `200`
- `GET /zsqy/homepage/{siteId}/getRunParamsCurveByTagName?...`
  - 期待返回有效历史点

### 6.4 BFF 层

- `GET /bff/v1/sites/{siteId}/dashboard/trends?range=24h`
  - 期待：
    - 至少 `2` 条以上连续有效趋势序列
    - `trends.sourceStatus.overall != partial`

### 6.5 页面层

- `/trend-analysis`
  - 期待从：
    - `可演示 / 不签收`
  - 推进到：
    - `可正式签收`

## 7. 风险与边界

### 7.1 当前无法直接在本仓库完成修复

当前限制：

- 我们手上是 legacy fat jar 和运行日志
- 没有可直接编辑编译的 Java 源码仓库

这意味着：

- 当前能做的是：
  - 根因收窄
  - 修复方案设计
  - 影响面界定
- 当前不能在本仓库里直接提交 Java 源码修复

### 7.2 不建议的做法

当前不建议：

- 继续通过 BFF 伪造多序列趋势
- 用首页快照拼出假历史曲线
- 为了签收强行在前端制造插值曲线

原因：

- 这会把趋势页从“真实演示页”变成“假数据演示页”

## 8. 当前建议结论

当前最合理的主控路径是：

1. 维持趋势页当前结论：
   - `可演示`
   - `暂不正式签收`
2. 若后续继续推进趋势页签收：
   - 直接追 legacy `executeTaskTenMin` 修复
3. 在拿到可编辑的 legacy 源码前：
   - 不再继续改趋势页前端
   - 不再继续在 BFF 层做伪趋势补偿
