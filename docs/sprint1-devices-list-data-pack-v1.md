# Sprint1 devices/list 数据包 v1

## 1. 目标与边界

- 目标：把 `devices/list` 首版字段一次性定清楚，供 BFF 和前端按同一份合同开工。
- 本次仅覆盖：
  - 列表行字段
  - 页面级 `freshness / sourceStatus`
- 不覆盖：
  - 设备详情页
  - 点位明细
  - 控制能力

## 2. 当前运行态事实

当前 live 证据：

- `GET /bff/v1/sites/126lnoffice/devices/list`
  - 当前返回：`404`
  - 返回体：`Cannot GET /bff/v1/sites/126lnoffice/devices/list`
- `GET /bff/v1/sites/126lnoffice/system/topology`
  - `200 OK`
  - 已返回 `groups[].id/name/type/floor`
  - 已返回 `sourceStatus.overall=ok`
- `GET /bff/v1/sites/126lnoffice/dashboard/overview`
  - `200 OK`
  - 已返回页面级 `freshness.latestTimestamp/stale`
  - 已返回 `sourceStatus.overall=ok`
- legacy 原始候选源：
  - `GET /zsqy/drinfo/126lnoffice/findObject?pageCurrent=1&pageSize=200`
  - 已确认可返回 `drid / drname / drcode / drtypename / typeYT / floorName / drUseState / model2dDataId`

补充判断：

- `system-findings.md` 虽记录旧接口 `GET /api/device/126lnoffice/data` 与 `.../tree` 可用，
- 但当前直接 probe 两条旧接口均返回 `400 Bad Request`，
- 因此 Sprint1 不把它们作为首选 source candidate，当前主候选仍是 `drinfo.findObject`。

## 3. 直接结论

当前 `devices/list` 还不能直接联调。

原因不是字段名没想清楚，而是三件事同时成立：

1. BFF 路由还不存在，当前是 `404`
2. 列表最小行字段虽然已有 legacy source candidate，但还没收敛成 BFF 合同
3. `onlineStatus / alarmStatus` 还没有稳定可复用的运行态聚合结果

## 4. devices/list 首版最小字段集合

建议首版最小可联调集合：

- 行字段
  - `id`
  - `deviceName`
  - `systemType`
  - `floor`
- 页面级
  - `freshness.latestTimestamp`
  - `freshness.stale`
  - `sourceStatus.overall`

说明：

- `deviceCode` 建议同一版合同里带上，但即使 UI 首版先不展示，也应由 BFF 一次性输出。
- `onlineStatus / alarmStatus / isVirtual` 本轮必须先收口字段名和来源，但可以晚于最小列表渲染落地。

## 5. 哪些字段可以后补

可后补字段：

- `deviceCode`
  - 建议首版合同输出，但 UI 不必首屏展示
- `onlineStatus`
  - 当前缺稳定来源，后补
- `alarmStatus`
  - 当前缺稳定来源，后补
- `isVirtual`
  - 来源已知，但可以晚于最小列表展示
- `sourceStatus.sources[key=devices]`
  - 展开态提示可后补，首版只保留 `overall`

## 6. 字段判断

### 6.1 ready

- `freshness.latestTimestamp`
- `freshness.stale`
- `sourceStatus.overall`
- `sourceStatus.sources[key=devices]`

原因：

- 当前可直接复用 `dashboard/overview` 与 `system/topology` 的页面级状态提示。

### 6.2 partial

- `id`
- `deviceCode`
- `deviceName`
- `systemType`
- `floor`
- `isVirtual`

原因：

- 这些字段的 legacy 原始来源已经明确；
- 但当前还没有 `devices/list` BFF 合同，且 `system/topology.groups[]` 只能算弱代理，不应直接当最终列表合同。

### 6.3 missing

- `onlineStatus`
- `alarmStatus`

原因：

- 当前仓内只定义了设备模型口径，没有现成的 BFF 输出；
- 直接拿 `drUseState` 充当 `onlineStatus` 会造成语义漂移；
- 直接拿页面告警数或名称匹配充当 `alarmStatus` 也不成立。

## 7. 当前 blockers

1. `/bff/v1/sites/{siteId}/devices/list` 路由尚未实现
2. `systemType` 当前虽可由 `drinfo.drtypename/drTypeCode` 归一化，但现有 `groups[].type` 仍混入办公室、参数设置、电量表等对象
3. `onlineStatus` 没有稳定来源，不能把 `drUseState` 当在线状态
4. `alarmStatus` 没有稳定来源，不能由前端猜

## 8. ready / partial / missing 统计

- `ready`：`4`
- `partial`：`6`
- `missing`：`2`

## 9. 拍板结论

- `devices/list` 首版是否可直接联调（yes/no）：`no`

补一句落地判断：

- 这版数据包已经足够让 BFF 一次性定合同并开工；
- 但在当前 runtime 里，`devices/list` 仍因路由缺失和状态字段未落地，不能算“直接联调完成”。
