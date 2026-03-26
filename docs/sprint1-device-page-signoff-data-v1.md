# Sprint1 设备页 Signoff Data v1

本次只回答：设备页还有没有字段问题阻断演示。

## 结论

- 是否还有阻断演示的字段问题：`没有`
- 哪些 partial 只是观察项：
  - `topology.groups[].type` / `devices/list.items[].systemType`
    - 当前已可用于粗分组和列表展示
    - 但 live 数据仍混有办公室、参数设置、电量表等 `other` 对象
    - 属于“设备范围语义仍需继续收敛”，不阻断当前 Sprint1 演示
  - `devices/list.items[].status`
    - 当前接口已返回单字段 `status`
    - 但 live 样本为 `unknown`，且它不等价于独立的 `onlineStatus + alarmStatus`
    - 属于“状态语义观察项”，不阻断当前 Sprint1 演示
  - `devices/list.items[].lastReportAt`
    - 当前 live 为 `null`
    - 不能单独承担设备在线 freshness 判断
    - 但页面级 `freshness` 已由 `devices/list.freshness` 和 `overview.freshness` 提供，不阻断演示
  - `isVirtual`
    - 当前 `devices/list` 还没有显式返回
    - 但首版页面演示不要求虚拟/实体标签强展示
    - 属于“可后补字段”，不阻断演示
  - `topology.generatedAt`
    - 当前只能当作接口响应时间
    - 不能替代真实 freshness
    - 页面级 freshness 已有独立字段，不阻断演示
- 是否阻断设备页演示（yes/no）：`no`

## 判断依据

- `/bff/v1/sites/126lnoffice/dashboard/overview`
  - 当前 live 返回 `deviceSummary.totalDevices=59`
  - 四类设备数已齐
  - `freshness.stale=false`
  - `sourceStatus.overall=ok`
- `/bff/v1/sites/126lnoffice/system/topology`
  - 当前 live 返回 `summary/groups/nodes`
  - `groups.length=59`
  - `nodes.length=5`
  - `sourceStatus.overall=ok`
- `/bff/v1/sites/126lnoffice/devices/list?page=1&pageSize=5`
  - 当前 live 已从上轮 `404` 收敛为 `200`
  - 已返回 `items/page/pageSize/total/filters/freshness/sourceStatus`
  - 已返回列表最小主干字段：`deviceId/deviceCode/deviceName/systemType/floorName/status`

## 封账判断

- 只要设备页演示范围仍维持当前 Sprint1 边界: `摘要卡 + 拓扑骨架 + 简化设备列表 + freshness/sourceStatus`，当前没有字段问题阻断演示。
- 设备页数据面可以封账。
