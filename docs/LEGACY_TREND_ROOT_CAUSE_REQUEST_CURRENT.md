# LEGACY_TREND_ROOT_CAUSE_REQUEST_CURRENT

## 1. 事项归类

- 类型：治理文档更新项
- 当前动作：`regression-after-fix`
- 后续动作：
  - 回归期：`monitor`
  - 回归通过后：`maintain`

## 2. 当前主控结论

`/trend-analysis` 当前定位固定为：

- 已可联调
- 已可演示
- 已完成回归并正式签收

历史阻塞项：

- `legacy upstream trend quality`

说明：

- 本调度单用于保留之前的 upstream 根因分析要求
- 当前“温差序列 `points[].t = null`”这一具体阻塞已经在 BFF 维护修复中关闭
- 修复后实测：
  - `currentCop / chilledDeltaT / coolingDeltaT` 均已带出非空时间字段
  - `/trend-analysis` 已进入真实页面回归阶段
- 因此本文件当前不再作为页面签收的阻塞项，而是保留为历史复盘和防回归依据

## 3. 对 legacy 侧的执行要求

如 legacy 侧仍需补交分析，请按“趋势统计链历史根因分析”处理，而不是按当前页面 bug 处理。

目标：

1. 完成趋势统计链根因分析
2. 提交正式《趋势统计链根因分析报告》
3. 报告可作为历史复盘材料，但当前不再阻塞趋势页回归

## 4. 报告名称与交付要求

报告名称固定为：

- 《趋势统计链根因分析报告》

建议文档路径：

- `docs/LEGACY_TREND_ROOT_CAUSE_REPORT_CURRENT.md`

交付前提：

- 必须以真实运行态取证为基础
- 必须覆盖 shell → BFF → legacy → adapter 四段
- 必须形成“问题首次出现位置 + 根因归类 + 修复点 + 回归标准”的闭环

## 5. 报告必须包含的内容

### 5.1 固定复现样例

至少固定以下复现集：

- 站点：`126lnoffice`
- 范围：`24h`
- 关键指标：
  - `totalPowerKw`
  - `currentCop`
  - `chilledDeltaT`
  - `coolingDeltaT`

复现时建议记录：

- 请求 URL
- 请求时间
- 返回状态码
- 返回 payload 是否有连续点
- 返回 payload 是否存在：
  - 历史上的 `points[].t = null`
  - 当前修复后是否已恢复为非空时间字段

### 5.2 四段取证

必须按以下链路逐段取证：

1. shell
   - `/trend-analysis` 当前页面表现
   - 页面是否只是诚实降级，不得误判为页面 bug
2. BFF
   - `/bff/v1/sites/{siteId}/dashboard/trends`
   - `freshness`
   - `sourceStatus`
   - 各指标序列与 stats
   - 特别记录：
     - `currentCop` 是否已有连续时间点
     - `chilledDeltaT / coolingDeltaT` 是否已恢复非空时间字段
     - `loadTrendSeries(...)` 修复后是否正确优先选择带时间戳的序列
3. legacy
   - `getEnergyStatisticsCurve`
   - `getRunParamsCurve`
   - `getRunParamsCurveByTagName`
   - `energyEfficiency`
   - 特别记录：
     - `getRunParamsCurveByTagName` 原始 `<data>` 是否已带 `<name>时间</name>`
4. adapter / service
   - 当前 adapter 是否只是忠实承接 upstream
   - 明确“不允许把上游缺口伪装成 BFF 正常输出”

### 5.3 问题首次出现位置

必须给出：

- 首次明确失败的位置
- 所在层级
- 对应日志、接口或代码位置

优先关注已知候选：

- `EnergyStatisticsServiceImpl.executeTaskTenMin(EnergyStatisticsServiceImpl.java:843)`

### 5.4 根因归类

必须从以下类别中明确归类，可多选，但必须给主因：

- 时间窗口问题
- 聚合任务问题
- 点位数据问题
- 缓存问题
- contract / 查询参数问题

要求：

- 必须区分“现象”和“主因”
- 必须说明为什么不是前端主因、不是 BFF 主因

### 5.5 修复点与回归验证标准

必须给出：

- 预计修复点
- 修复前置条件
- 风险面
- 回归验证标准

回归标准至少覆盖：

1. `executeTaskTenMin` 不再抛空指针
2. `reg_value_ten_min_*` 恢复连续写入
3. `getRunParamsCurve` 及其回退链稳定返回 `200`
4. `getRunParamsCurveByTagName` 对关键指标返回有效历史点
5. `currentCop / chilledDeltaT / coolingDeltaT`
   - 不仅要有值
   - 还必须带出非空时间字段
6. 必须明确历史主因：
   - 温差序列时间字段缺失究竟来自 upstream 结构不完整
   - 还是来自 `loadTrendSeries(...)` 在已有同名 metric 时未切到带时间戳的 by-tag fallback
7. `/bff/v1/sites/{siteId}/dashboard/trends?range=24h`
   - 至少形成 `3` 条以上带时间戳的连续有效序列
8. `chilledDeltaT / coolingDeltaT`
   - 不再出现 `points[].t = null`
9. `/trend-analysis`
   - 重新进入正式签收复验

## 6. 当前冻结边界

在当前维护期内，仍明确冻结：

- 不启动趋势相关新开发
- 不改 shell 趋势页结构
- 不做新的趋势能力扩项
- 不启动 optimize / simulate / assistant 相关联动开发

当前策略更新为：

- 维持 `/trend-analysis` 为已签收页面
- 历史 root cause 报告如继续提交，只作为复盘和防回归材料

## 7. 当前允许的工作

当前仅允许：

- legacy 趋势统计链根因分析
- 证据补充
- 报告提交
- 修复后按既有回归清单执行回归

对应动作建议：

- 当前：`maintain`
- 历史复盘期：`monitor`
- 如出现回退：`regression-after-fix`

## 8. 关联文档

- [TREND_UPSTREAM_GAP_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/TREND_UPSTREAM_GAP_CURRENT.md)
- [LEGACY_TREND_TASK_FIX_PLAN_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_TASK_FIX_PLAN_CURRENT.md)
- [LEGACY_TREND_TASK_HANDOFF_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_TASK_HANDOFF_CURRENT.md)
- [LEGACY_TREND_BUG_BRIEF_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_BUG_BRIEF_CURRENT.md)
- [LEGACY_TREND_REGRESSION_CHECKLIST_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/LEGACY_TREND_REGRESSION_CHECKLIST_CURRENT.md)
- [sprint1-trend-page-signoff-decision-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/sprint1-trend-page-signoff-decision-v1.md)
