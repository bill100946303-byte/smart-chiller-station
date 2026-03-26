# Sprint1 设备总览页数据包 v1

## 1. 目标与边界

- 目标：一次性把设备总览页首版字段、来源、成熟度和占位策略定清楚，供前后端直接联调。
- 本次固定范围：
  - 顶部摘要字段
  - 设备分组字段
  - 设备计数字段
  - 简化设备列表 / 树骨架字段
  - freshness / sourceStatus
- 不包含：
  - 完整设备详情页
  - 点位级详情
  - 设备控制能力
  - 2D/3D 工艺流边配置

## 2. 当前运行态证据

本次判断以 `2026-03-13` live runtime 为准：

- `/bff/v1/sites/126lnoffice/dashboard/overview`
  - `deviceSummary.totalDevices=59`
  - `deviceSummary.chillerCount=3`
  - `deviceSummary.chilledPumpCount=3`
  - `deviceSummary.coolingPumpCount=3`
  - `deviceSummary.coolingTowerCount=4`
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- `/bff/v1/sites/126lnoffice/system/topology`
  - `summary.totalDevices=59`
  - `summary.chillerCount=3`
  - `summary.chilledPumpCount=3`
  - `summary.coolingPumpCount=3`
  - `summary.coolingTowerCount=4`
  - `groups.length=59`
  - `nodes.length=5`
  - `sourceStatus.overall=ok`

## 3. 直接结论

设备总览页首版可以直接联调。

前提是 scope 严格收敛为：

- 摘要卡只直出已存在字段
- 设备树只使用 `topology.nodes[]`
- 设备列表只做 skeleton，不宣称“真实运行设备清单”
- `running_device_count`、`alarm_device_count`、`is_virtual`、设备运行/报警状态一律先占位，不做前端猜值

说明：

- CSV 里的 `blocking` 按“是否阻断 Sprint1 固定 scope 联调”判断。
- 下文 `Top5 Blockers` 指的是“阻断完整替代旧设备页”的缺口，不等于阻断本次首版。

## 4. 分区判断

### 4.1 顶部摘要字段

可直接联调：

- `total_devices`
- `chiller_count`
- `chilled_pump_count`
- `cooling_pump_count`
- `cooling_tower_count`

先占位：

- `running_device_count`
- `alarm_device_count`

说明：

- 这两个字段已在 [冷站系统2.0-数据建模-拓扑-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/冷站系统2.0-数据建模-拓扑-v1.md) 定义，但当前 BFF 还没有落到 `dashboard/overview` 或 `system/topology`。
- 禁止用 `overview.alarmSummary.total` 代替 `alarm_device_count`。
- 禁止用四类设备数相加或 `groups[]` 长度代替 `running_device_count`。

### 4.2 设备分组字段

可直接联调：

- `topology.groups[].id`
- `topology.groups[].name`
- `topology.groups[].floor`

观察项：

- `topology.groups[].type`

说明：

- 当前 `type` 仅能支撑粗分组。
- 它还不能可靠地区分“实体设备 / 虚拟电表 / 其他对象”，因为 live `groups[]` 里仍混有办公室、参数设置、总电量等对象。

### 4.3 设备计数字段

可直接联调：

- `deviceSummary.chillerCount`
- `deviceSummary.chilledPumpCount`
- `deviceSummary.coolingPumpCount`
- `deviceSummary.coolingTowerCount`

说明：

- 这些字段在 `dashboard/overview.deviceSummary` 与 `system/topology.summary` 双侧都已存在，适合做首版卡片和分组计数。
- 首版优先读 `dashboard/overview.deviceSummary.*`，`system/topology.summary.*` 只作为兜底和交叉校验。

### 4.4 简化设备列表 / 树骨架字段

可直接联调：

- `topology.nodes[].id`
- `topology.nodes[].label`
- `topology.nodes[].count`
- `topology.nodes[].downstream`
- `topology.groups[].id`
- `topology.groups[].name`

先占位：

- `is_virtual`
- `run_status_text`
- `alarm_status_text`

说明：

- 当前可以做“树骨架 + 粗清单”。
- 当前还不能做“真实设备列表 + 运行态/报警态标签”，因为缺少实体/虚拟边界和设备状态字段。
- 如果前端要先落列表，只能明确写成“设备骨架清单”或“资产分组清单”，不能写成“运行设备列表”。

### 4.5 freshness / sourceStatus

可直接联调：

- `overview.freshness.latestTimestamp`
- `overview.freshness.stale`
- `overview.sourceStatus.overall`
- `topology.sourceStatus.overall`
- `topology.sourceStatus.sources[key=devices]`

观察项：

- `topology.generatedAt`

说明：

- `system/topology` 当前没有独立 `freshness` 对象，只有 `generatedAt`。
- 首版页面 freshness 统一以 `dashboard/overview.freshness` 为准。
- `topology.generatedAt` 只能作为“接口响应时间”显示，不能当作真实数据 freshness。

## 5. Top5 Blockers

以下 5 项会阻断“完整替代旧设备页”，但不阻断本次 Sprint1 首版联调：

1. `running_device_count`
   - 当前未暴露到 BFF
2. `alarm_device_count`
   - 当前未暴露到 BFF
3. `is_virtual`
   - 当前设备骨架无法稳定区分实体设备和虚拟/计量对象
4. `run_status_text`
   - 当前设备列表无法稳定挂运行态标签
5. `alarm_status_text`
   - 当前设备列表无法稳定挂报警态标签

## 6. ready / partial / missing 统计

- `ready`：`17`
- `partial`：`2`
- `missing`：`5`

## 7. 拍板结论

- 设备总览页首版是否可直接联调（yes/no）：`yes`

补一句落地判断：

- 设备总览页 Sprint1 可以先按“摘要卡 + 四类设备计数 + 树骨架 + sourceStatus/freshness”开工。
- 设备列表中的实体/虚拟区分和运行/报警状态必须继续占位，不能由前端猜。
