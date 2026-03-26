# Sprint2 设备页 Signoff Data v1

本次只回答：设备页二期是否还有字段问题阻断演示或正式签收。

## 结论

- 是否还有阻断演示的字段问题：`没有`
- 是否还有阻断正式签收的字段问题：`有`
- 哪些 partial 只是观察项：
  - `devices/list.items[].status`
    - 当前已稳定返回
    - 但 live 样本仍大量为 `unknown`
    - 对二期演示只算状态观察项，不阻断页面展示
  - `devices/list.items[].lastReportAt`
    - 当前仍为 `null`
    - 但列表级 `freshness` 已独立返回
    - 不阻断二期演示
  - `devices/tree.tree.*.status`
    - 当前树节点和点位节点都已有 `status`
    - 但 live 样本仍为 `unknown`
    - 不阻断树导航和树展开演示
  - `devices/tree.tree.*.lastReportAt`
    - 当前仍为 `null`
    - 但树接口已返回独立 `freshness`
    - 不阻断树视图演示
  - `devices/{deviceId}.detail.deviceTypeCode`
    - 当前对 `15` 返回空字符串
    - 但 `deviceTypeName=风机盘管`、`usageType=风机盘管` 已足够支撑详情首屏展示
    - 对演示只算观察项

## 阻断正式签收的问题

以下字段问题仍阻断“正式签收”：

1. `devices/{deviceId}.detail.runStatusText`
   - 当前返回 `null`
   - 说明详情运行态还未真正落地
2. `devices/{deviceId}.detail.alarmStatusText`
   - 当前返回 `null`
   - 说明详情报警态还未真正落地
3. `devices/{deviceId}.detail.latestUpdateAt`
   - 当前返回 `null`
   - 详情 freshness 还不能下沉到设备级
4. `devices/{deviceId}.sourceStatus.sources[key=deviceDetailRuntime]`
   - 当前 `ok=false`
   - endpoint=`/api/device/126lnoffice/device/data?deviceId=15&build=1&floor=1&mock=false`
   - `status=400`
   - 表明详情运行态增强来源仍未打通

## 判断依据

- `GET /bff/v1/sites/126lnoffice/dashboard/overview`
  - `deviceSummary` 四类计数齐全
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- `GET /bff/v1/sites/126lnoffice/system/topology`
  - `summary/groups/nodes` 齐全
  - `sourceStatus.overall=ok`
- `GET /bff/v1/sites/126lnoffice/devices/list?page=1&pageSize=12`
  - 当前返回 `200`
  - 列表主字段已齐：`deviceId/deviceCode/deviceName/systemType/floorName/isVirtual/status`
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- `GET /bff/v1/sites/126lnoffice/devices/tree?build=1&floor=1`
  - 当前返回 `200`
  - 树根、设备节点、点位节点结构已齐
  - `nodeType/deviceIdRef/childCount/children` 已齐
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- `GET /bff/v1/sites/126lnoffice/devices/15?build=1&floor=1`
  - 当前返回 `200`
  - 详情静态主字段已齐：`deviceId/deviceCode/deviceName/deviceTypeName/floorName/buildingName/isVirtual`
  - 但 `runStatusText/alarmStatusText/latestUpdateAt` 仍为 `null`
  - `sourceStatus.overall=partial`
  - `deviceDetailRuntime` 当前仍 `400`

## 封账判断

- 设备页二期在“演示”维度已经可以封账。
- 设备页二期在“正式签收”维度还不能封账，必须先补通详情运行态增强链路。
