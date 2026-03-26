# Sprint2 设备页 Signoff Data v2

本次只回答：设备页二期数据面是否还阻断演示或正式签收。

## 结论

- 是否阻断演示（yes/no）：`no`
- 是否阻断正式签收（yes/no）：`no`
- 哪些 remaining partial 只是观察项：
  - `devices/list.items[].status`
    - 当前列表已稳定返回
    - 但 live 样本仍大量为 `unknown`
    - 属于状态语义观察项，不阻断演示或正式签收
  - `devices/list.items[].lastReportAt`
    - 当前仍为 `null`
    - 但列表级 `freshness` 已独立返回
    - 属于增强信息观察项，不阻断正式签收
  - `devices/tree.tree.*.status`
    - 当前树节点和点位节点都已有 `status`
    - 但 live 样本仍为 `unknown`
    - 属于树节点状态精细度观察项，不阻断签收
  - `devices/tree.tree.*.lastReportAt`
    - 当前仍为 `null`
    - 但树接口已返回独立 `freshness`
    - 属于树节点增强信息观察项，不阻断签收
  - `devices/{deviceId}.detail.deviceTypeCode`
    - 当前对 `15` 仍为空字符串
    - 但 `deviceTypeName=风机盘管`、`usageType=风机盘管`、`treeNodeType=device` 已足够支撑详情首屏和页面联动
    - 属于编码补全观察项，不阻断正式签收

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
  - 详情静态主字段已齐
  - `runStatusText=已停止`
  - `alarmStatusText=报警中`
  - `latestUpdateAt=2025-08-19T17:11:20.000Z`
  - `sourceStatus.overall=ok`
  - `deviceDetailRuntime.ok=true`

## 封账判断

- 设备页二期数据面可以正式封账。
