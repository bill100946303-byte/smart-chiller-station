# BFF 任务包｜完整 3D 系统图合同 v1

## 1. 任务目标

新增接口：

- `GET /bff/v1/sites/{siteId}/system/diagram`

用于给新壳 `/scene-control` 提供“完整 3D 系统图”最小合同。

当前前端状态：

- 已支持 `system/diagram` 优先消费
- 当前真实链路下该接口返回 `404`
- 页面会自动回退到：
  - `system/topology + devices/list`
  - 再退回本地主回路 mock

一句话目标：

- 把当前“主回路示意图”推进为“完整系统图合同已接通”

## 2. 输入文档

- [system-diagram-contract-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/system-diagram-contract-v1.md)
- [system-diagram-contract-sample-v1.json](/Users/billchow/Documents/智慧冷冻站/docs/system-diagram-contract-sample-v1.json)
- [3d-system-diagram-implementation-status-v1.md](/Users/billchow/Documents/智慧冷冻站/docs/3d-system-diagram-implementation-status-v1.md)

## 3. 输出要求

### 3.1 必须新增

- `GET /bff/v1/sites/{siteId}/system/diagram`

### 3.2 必须返回

顶层：

- `site`
- `generatedAt`
- `layoutMode`
- `scope`
- `freshness`
- `sourceStatus`
- `nodes`
- `edges`
- `groups`
- `stats`

`nodes[]` 最小字段：

- `id`
- `nodeType`
- `label`
- `systemType`
- `role`
- `group`
- `deviceIdRef`
- `deviceIds`
- `modelCategory`
- `positionHint`
- `rotationHint`
- `statusSummary`

`edges[]` 最小字段：

- `id`
- `from`
- `to`
- `edgeType`
- `pipeClass`
- `routeHint.points`

## 4. 第一版收口边界

第一版只要求覆盖：

- 冷机
- 冷冻泵
- 冷却泵
- 冷却塔
- 冷冻阀门
- 冷却阀门
- 建筑负荷节点

第一版不要求：

- 真实阀门设备 ID 全量绑定
- 全楼层完整空间坐标
- 所有支路完整还原
- 控制点 / 传感器点单独出图

一句话边界：

- 先把“设备级主回路完整合同”补齐，不追求一步到位变成 BIM

## 5. 数据来源建议

建议优先组合：

- `system/topology`
  - 提供主链和分组骨架
- `devices/list`
  - 提供真实设备实例、名称、deviceId、systemType
- `devices/{deviceId}`
  - 提供运行态摘要
- 现有资产/布局映射表
  - 提供 `positionHint / rotationHint`

如果暂时没有真实坐标：

- 后端先返回规则布局锚点
  - `column`
  - `row`
  - `lane`

不要把“没有真实坐标”当作接口不上线的理由。

## 6. V1 最小示例口径

主链至少要形成：

- `冷机 -> 冷冻阀门 -> 冷冻泵 -> 建筑负荷 -> 冷机`
- `冷机 -> 冷却阀门 -> 冷却泵 -> 冷却塔 -> 冷机`

实例数量至少和当前真实口径一致：

- 冷机：`3`
- 冷冻泵：`3`
- 冷却泵：`3`
- 冷却塔：`4`

## 7. 前端联调验收标准

接口联通后，前端验收以这 5 条为准：

1. `/scene-control` 不再显示“运行态骨架回退”，而是显示“完整系统图合同”
2. 3D 图节点点击后能稳定联动到真实 `deviceId`
3. 冷冻侧 / 冷却侧过滤仍正常
4. 设备簇数量与后端返回 `deviceIds` 一致
5. 没有真实阀门设备时，阀门仍可作为语义图元正常显示

## 8. 回归建议

建议新增最小回归：

- `curl /bff/v1/sites/126lnoffice/system/diagram?layoutMode=auto&scope=full`
- 断言：
  - `nodes.length > 0`
  - `edges.length > 0`
  - 至少存在一个 `deviceIdRef`
  - 至少存在 `pipeClass=chilled_supply`
  - 至少存在 `pipeClass=cooling_supply`

## 9. 交付物

主控/BFF 线程回传至少应包含：

- 修改文件路径
- 接口示例响应
- 回归命令或日志
- 是否已从 `404` 变为 `200`

## 10. 拍板建议

优先级：`P0`

原因：

- 当前前端、模型、3D 示意图、联动链路都已准备好
- 现在阻塞完整系统图落地的唯一主路径就是 `system/diagram`

一句话拍板：

- 下一步不要继续扩前端花活，先把 `system/diagram` 做出来。
