# Sprint1 设备总览页合同包 v1

## 1. 结论

设备总览页 Sprint1 的收口结论如下：

- 可直接复用接口：
  - `GET /bff/v1/sites/{siteId}/dashboard/overview`
  - `GET /bff/v1/sites/{siteId}/system/topology`
- 必须新增接口：
  - `GET /bff/v1/sites/{siteId}/devices/list`
- 可后置接口：
  - `GET /bff/v1/sites/{siteId}/devices/tree`
  - `GET /bff/v1/sites/{siteId}/devices/{deviceId}`
- 是否需要新增 `devices/summary`：`No`
- 设备总览页 Sprint1 首版是否可联调：`Yes`
- 属于 P0 必须新增的接口：
  - `GET /bff/v1/sites/{siteId}/devices/list`

一句话拍板：

- 设备总览页 Sprint1 不是“零新增接口”页面
- 但也不需要一下子补齐 tree/detail/实时控制，首版只要补 `devices/list` 就能形成可联调页面

## 2. 可直接复用接口

### 2.1 `GET /bff/v1/sites/{siteId}/dashboard/overview`

设备页可直接复用的部分：

- `deviceSummary`
  - `totalDevices`
  - `chillerCount`
  - `chilledPumpCount`
  - `coolingPumpCount`
  - `coolingTowerCount`
- `energyCards`
  - 可作为设备页顶部 KPI 辅助信息
- `freshness`
- `sourceStatus`

设备页不应强依赖的部分：

- `alarmSummary`
  - 这更适合作为全站摘要，不是设备页主合同

承接结论：

- `dashboard/overview` 适合承接设备页顶部摘要区
- 不适合承接设备列表、树导航、设备详情

### 2.2 `GET /bff/v1/sites/{siteId}/system/topology`

设备页可直接复用的部分：

- `summary`
  - 设备规模摘要
- `groups`
  - 当前可用于楼层 / 类型 / 分组维度的基础骨架
- `nodes`
  - 当前固定 5 段流程链：
    - `chiller`
    - `chilledPump`
    - `load`
    - `coolingPump`
    - `coolingTower`
- `generatedAt`
- `sourceStatus`

承接结论：

- `system/topology` 适合承接“系统骨架区 / 设备关系骨架区”
- 不适合直接承接设备主列表

## 3. `system/topology` 能承接到什么程度

当前 `system/topology` 可以承接到：

- 设备页顶部下面的一块“系统骨架”区域
- 设备数量按主机/泵/塔的主链路聚合展示
- 基于 `drinfo/findObject` 的轻量设备分组信息
- 页面在上游失败时的降级态展示

当前不能承接到：

- 完整设备表格
- 设备树导航
- 按页分页
- 按关键字搜索
- 单设备实时状态卡
- 设备详情抽屉
- 点位级数据

原因很具体：

- 当前 `topologyService` 的 `nodes` 是固定流程骨架，不是真实设备节点全集
- 当前 `groups` 来自 `drinfo` 的轻量映射，仅有：
  - `id`
  - `name`
  - `type`
  - `floor`
- 它没有提供设备页主列表通常需要的：
  - `deviceCode`
  - `buildingName`
  - `iconPath`
  - `usageType`
  - `status`
  - `lastReportAt`
  - `page/pageSize/total`

因此最终判断：

- `system/topology` 可以承接“骨架版”
- 不能替代 `devices/list`

## 4. 必须新增接口

## 4.1 `GET /bff/v1/sites/{siteId}/devices/list`

这是设备总览页 Sprint1 的唯一 P0 新增接口。

### 为什么必须新增

因为当前现有接口都无法完整承接设备页主区域：

- `dashboard/overview`
  - 只有摘要
- `system/topology`
  - 只有骨架与轻量分组

设备总览页如果没有列表主区，页面会只剩：

- 顶部摘要
- 骨架链路

这还不能算“可用页”。

### 建议数据来源

P0 建议采用“双层来源”：

第一层，主来源：

- `/zsqy/drinfo/{dbName}/findObject?pageCurrent=1&pageSize=200`

用途：

- 提供稳定的设备静态主数据
- 设备名称、编码、类型、楼层、图标、usageType 等都从这里来

第二层，增强来源：

- `/api/device/{dbName}/data`

用途：

- 仅用于补运行态字段，例如在线状态 / 当前值 / 最近上报

Sprint1 策略：

- `drinfo` 是硬依赖
- `/api/device/data` 是可选增强
- 如果增强来源失败，列表仍要返回，只是运行态字段置空，并在 `sourceStatus` 中体现降级

这与当前输入依据是对齐的：

- `bff-aggregation-design.md` 仍不建议一期强依赖 `/api/device/...`
- `system-findings.md` 又已确认它们在当前本地环境能返回数据

因此最稳妥的结论是：

- 可用，但不应直接升级为 Sprint1 首版的唯一硬依赖

### 建议最小 query

Sprint1 最小 query 建议：

- `page`
- `pageSize`
- `type`
- `floor`

不建议 Sprint1 首版强上：

- `keyword`
- `status`
- `sort`
- `building`

### 建议最小 response

顶层建议：

- `site`
- `generatedAt`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

`items[]` 最小字段建议：

- `deviceId`
- `deviceCode`
- `deviceName`
- `systemType`
- `floorName`
- `buildingName`
- `usageType`
- `iconPath`
- `status`
- `lastReportAt`

字段语义建议：

- `status`
  - `online|offline|unknown`
  - 如果运行态来源失败，可返回 `unknown`
- `lastReportAt`
  - 若无稳定运行态时间戳，可为 `null`

### 为什么不是 `devices/summary`

因为当前页面首版缺的不是“再来一份设备汇总”，而是“主列表”。

现有可用摘要已经有两层：

- `dashboard/overview.deviceSummary`
- `system/topology.summary`

如果再加一个 `devices/summary`，会产生第三份重复摘要口径，收益低于成本。

所以本次拍板：

- `devices/summary`：`No`
- `devices/list`：`Yes`

## 5. 可后置接口

### 5.1 `GET /bff/v1/sites/{siteId}/devices/tree`

建议后置到 Sprint1.5 / Sprint2。

适用场景：

- 左侧设备树导航
- 楼层 / 系统桶的树形钻取
- 与旧页面设备树交互对齐

建议来源：

- `/api/device/{dbName}/data/tree`
- 结合 `drinfo/findObject` 做字段补齐

为什么后置：

- 设备页 Sprint1 首版不一定必须有树导航
- 当前 `system/topology.groups` 已可先承担轻量分组 / 过滤骨架

### 5.2 `GET /bff/v1/sites/{siteId}/devices/{deviceId}`

建议后置到 Sprint2。

适用场景：

- 设备详情抽屉
- 单设备详情页
- 运行参数详情 / 最近告警 / 相关建议联动

为什么后置：

- 首版重点是“可浏览”和“可筛选”
- 不是“完整设备详情中心”

## 6. `freshness / sourceStatus` 是否直透

结论：

- `dashboard/overview`：`freshness + sourceStatus` 继续直透
- `system/topology`：`sourceStatus` 继续直透；Sprint1 不强制增加 `freshness`
- `devices/list`：`freshness + sourceStatus` 都应直透

原因：

### `dashboard/overview`

- 已有现成字段
- 顶部摘要需要告诉前端当前设备/能耗/告警摘要是否陈旧

### `system/topology`

- 当前主要基于 `drinfo` 静态清单
- `sourceStatus` 比 `freshness` 更关键
- Sprint1 不建议为了对齐而强塞一个低价值 freshness

### `devices/list`

- 这是设备页主区域
- 既要让前端知道“列表本身有没有拿到”
- 也要让前端知道“运行态增强字段是不是陈旧 / 缺失 / 降级”

因此 `devices/list` 必须输出：

- `freshness`
- `sourceStatus`

这样前端才能做到：

- 正常渲染
- 折叠摘要提示
- 展开明细定位失败来源

## 7. Sprint1 首版联调口径

设备总览页 Sprint1 首版联调范围建议收敛为：

1. 顶部摘要区
   - 直接复用 `dashboard/overview`
2. 系统骨架区
   - 直接复用 `system/topology`
3. 主列表区
   - 新增 `devices/list`

不纳入 Sprint1 首版承诺：

- 完整设备树
- 详情抽屉
- 点位级实时数据
- 控制指令

## 8. 最终拍板

最终拍板如下：

- 设备总览页 Sprint1 首版是否可联调：`Yes`
- P0 必须新增接口：
  - `GET /bff/v1/sites/{siteId}/devices/list`

直接复用接口清单：

- `GET /bff/v1/sites/{siteId}/dashboard/overview`
- `GET /bff/v1/sites/{siteId}/system/topology`

必须新增接口清单：

- `GET /bff/v1/sites/{siteId}/devices/list`

可后置接口清单：

- `GET /bff/v1/sites/{siteId}/devices/tree`
- `GET /bff/v1/sites/{siteId}/devices/{deviceId}`

最终口径：

- Sprint1 不新增 `devices/summary`
- Sprint1 只补 `devices/list`
- `system/topology` 继续承担“骨架”，不承担“设备主列表”
