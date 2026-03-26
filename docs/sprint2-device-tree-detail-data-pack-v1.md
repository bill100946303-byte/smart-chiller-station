# Sprint2 设备树与详情字段包 v1

## 1. 目标与边界

- 目标：一次性把 `devices/tree` 与 `devices/{deviceId}` 首版字段边界定清楚，避免后面继续多轮字段确认。
- 本次仅做字段与来源 readiness 判断，不改代码、不改字段定义。

## 2. 当前运行态事实

### 2.1 BFF 当前状态

- `GET /bff/v1/sites/126lnoffice/devices/tree`
  - 当前返回：`404`
  - 返回体：`Cannot GET /bff/v1/sites/126lnoffice/devices/tree`
- `GET /bff/v1/sites/126lnoffice/devices/2`
  - 当前返回：`404`
  - 返回体：`Cannot GET /bff/v1/sites/126lnoffice/devices/2`

### 2.2 legacy 当前可取证状态

- `GET /api/device/126lnoffice/data/tree?build=1&floor=1&mock=false`
  - 当前返回：`200`
  - 已返回真实树结构：`[{ id, name, children[] }]`
  - 叶子节点内已能看到：
    - 设备节点 `id/name`
    - 点位节点 `id/name`
- `GET /api/device/126lnoffice/device/data`
  - 当前 probe 仍返回：`400 Bad Request`
  - 说明详情来源路径已知，但 query 形态仍未稳定确认

### 2.3 其他可复用来源

- `GET /bff/v1/sites/126lnoffice/devices/list?page=1&pageSize=5`
  - 已可返回静态主数据：
    - `deviceId`
    - `deviceCode`
    - `deviceName`
    - `systemType`
    - `floorName`
    - `status`
    - `lastReportAt`
- `GET /zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200`
  - 已确认能返回：
    - `drid`
    - `drcode`
    - `drname`
    - `drtypename`
    - `typeYT`
    - `drUseState`
    - `floorName`
    - `buildname`
    - `pointX/Y/Z`
    - `model2dDataId`

## 3. 直接结论

- `devices/tree`：当前还不能直接联调
- `devices/{deviceId}`：当前还不能直接联调

根因不是字段完全没定义，而是：

1. 两条 BFF 路由当前都未实现
2. `tree` 已有真实旧树来源，但未做 BFF 归一化
3. `detail` 的静态主数据来源明确，但运行状态 / 报警状态 / freshness 仍缺稳定详情合同

## 4. tree 节点最小字段

建议 `devices/tree` 最小节点字段：

- `nodeId`
- `nodeName`
- `nodeType`
- `children`
- `deviceIdRef`

说明：

- legacy `data/tree` 当前只稳定提供 `id/name/children`
- `nodeType`、`deviceIdRef` 需要 BFF 结合树层级和 `drinfo` 做归一化
- Sprint2 不建议直接把旧树原样透给前端，因为旧树里设备节点和点位节点混在一起，前端很难直接消费

## 5. detail 首屏最小字段

建议 `devices/{deviceId}` 首屏最小字段：

- `deviceId`
- `deviceCode`
- `deviceName`
- `deviceTypeCode`
- `deviceTypeName`
- `floorName`
- `buildingName`
- `isVirtual`
- `runStatusText`
- `alarmStatusText`
- `latestUpdateAt`

说明：

- 静态身份字段可优先从 `devices/list + drinfo.findObject` 组合得到
- 运行 / 报警状态仍应来自设备点位态或旧详情接口，不能直接拿 `drUseState` 代替

## 6. 运行状态 / 报警状态 / 虚拟设备标记

### 6.1 `runStatusText`

- 目标语义：设备当前运行 / 停止
- 推荐来源：
  - `reg + qstag + subinfo`
  - 或旧接口 `/api/device/{dbName}/device/data`
- 当前判断：`missing`

原因：

- 仓内设备模型口径已定义
- 但当前没有稳定 live 详情返回可直接复用

### 6.2 `alarmStatusText`

- 目标语义：设备正常 / 报警 / 故障
- 推荐来源：
  - `reg(reg_DrShowType in 2/3 or Isalarm=1) + qstag + subinfo`
  - 或旧接口 `/api/device/{dbName}/device/data`
- 当前判断：`missing`

### 6.3 `isVirtual`

- 目标语义：实体 / 虚拟设备标记
- 推荐来源：
  - `drinfo.typeYT`
- 当前判断：`partial`

原因：

- 原始字段已知
- 但 `detail` 路由还没实现，当前只能算来源明确，未形成目标合同

## 7. freshness / sourceStatus

### 7.1 `devices/tree`

- `sourceStatus`
  - 判断：`partial`
  - 原因：legacy `data/tree` 已 200，可明确来源可达；但 BFF 还没有树接口和统一包装
- `freshness`
  - 判断：`missing`
  - 原因：legacy 树返回没有稳定时间戳，当前也没有 BFF freshness 包装

### 7.2 `devices/{deviceId}`

- `sourceStatus`
  - 判断：`missing`
  - 原因：当前既没有 BFF detail 路由，也没拿到稳定旧详情返回
- `freshness`
  - 判断：`missing`
  - 原因：缺少详情运行态时间戳来源

## 8. ready / partial / missing 统计

- `ready`：`0`
- `partial`：`17`
- `missing`：`8`

## 9. 拍板结论

- tree 是否可直接联调（yes/no）：`no`
- detail 是否可直接联调（yes/no）：`no`

补一句落地判断：

- `tree` 已经有足够强的旧来源可供 BFF 开工，但在树接口未落地前还不能算直接联调。
- `detail` 当前更偏“字段口径已定、运行态来源待接”的设计态，还不适合直接拉前端联调。
