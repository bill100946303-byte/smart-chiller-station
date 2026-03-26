# 完整 3D 系统图合同草案 v1

## 1. 结论

当前新壳已经可以生成“主回路 3D 示意图”，但还不能生成“完整 3D 系统图”。

根因不是模型不足，而是 `system/topology` 只提供了类别级主链：

- `chiller`
- `chilledPump`
- `load`
- `coolingPump`
- `coolingTower`

这足够承接：

- 主回路示意
- 设备簇数量展示
- 冷冻侧 / 冷却侧聚焦

但不足以承接：

- 设备级完整连线
- 多台设备真实支路
- 阀门挂接关系
- 管线路径
- 楼层 / 区域 / 空间布局

因此建议新增统一合同：

- `GET /bff/v1/sites/{siteId}/system/diagram`

一句话拍板：

- `system/topology` 继续保留为骨架摘要接口
- `system/diagram` 作为完整系统图最小合同

## 2. 目标与范围

本合同只解决“完整 3D 系统图能不能生成”的最小问题，不扩展到控制下发、点位调参、动画脚本。

V1 范围固定为：

- 真实设备节点
- 真实连接边
- 主供回水与支路
- 阀门 / 负荷 / 汇流排等图元节点
- 布局提示
- 运行态摘要

V1 不包含：

- 精细 BIM 还原
- 机房真实测绘坐标
- 拖拽编排
- 复杂工艺动画
- 点位级交互编辑

## 3. 为什么现有 `system/topology` 不够

当前 `system/topology` 的问题很具体：

1. `nodes` 是系统类型节点，不是设备实例节点。
2. `downstream` 只表达主链，不表达多台设备并联关系。
3. 没有 `deviceIdRef`，前端无法把 3D 节点稳定绑定到真实设备。
4. 没有 `edges[]`，前端只能自己猜连线。
5. 没有 `positionHint`，前端只能规则布局，无法形成完整系统图。
6. 没有 `valve/header/load` 这类非设备图元的统一语义。

因此当前状态只能生成：

- `类别主回路图`

不能生成：

- `设备级完整系统图`

## 4. 建议接口

### 4.1 Endpoint

- `GET /bff/v1/sites/{siteId}/system/diagram`

### 4.2 Query

V1 建议最小 query：

- `layoutMode`
  - `auto | fixed`
- `scope`
  - `main_loop | full`

默认值建议：

- `layoutMode=auto`
- `scope=full`

### 4.3 顶层 response

顶层字段建议：

- `site`
- `generatedAt`
- `layoutMode`
- `scope`
- `sourceStatus`
- `freshness`
- `nodes`
- `edges`
- `groups`
- `stats`

## 5. `nodes[]` 字段建议

每个节点都必须可被前端稳定渲染与联动。

### 5.1 必填字段

- `id`
  - 系统图内部唯一 ID
- `nodeType`
  - `device | valve | header | load | sensor | virtual`
- `label`
  - 节点显示名
- `systemType`
  - 如 `chiller | chilledPump | coolingPump | coolingTower | load`
- `role`
  - 如 `main | branch | return | bypass | header`
- `group`
  - 节点所属分组，如 `chilled_loop_a`
- `positionHint`
  - 位置提示对象
- `statusSummary`
  - 当前运行态摘要

### 5.2 可选字段

- `deviceIdRef`
  - 真实设备 ID；非设备图元可为空
- `deviceIds`
  - 当一个节点代表一组设备时返回
- `modelCategory`
  - `chiller | pump | valve | coolingTower | load`
- `floor`
- `area`
- `rotationHint`
- `scaleHint`
- `metadata`

### 5.3 `positionHint`

V1 建议支持：

- `x`
- `y`
- `z`
- `anchor`
  - `left | center | right | top | bottom`

如果暂时没有真实坐标，也必须至少返回：

- `column`
- `row`
- `lane`

这样前端可以退回规则布局，而不是完全猜。

### 5.4 `statusSummary`

V1 建议最小字段：

- `runStatus`
  - `run | stop | unknown`
- `alarmStatus`
  - `normal | alarm | unknown`
- `degraded`
  - `boolean`
- `latestUpdateAt`

## 6. `edges[]` 字段建议

完整系统图必须由边驱动，不能只靠节点 `downstream` 猜。

### 6.1 必填字段

- `id`
- `from`
- `to`
- `edgeType`
  - `pipe | control | logical`
- `pipeClass`
  - `chilled_supply | chilled_return | cooling_supply | cooling_return | bypass`

### 6.2 可选字段

- `routeHint`
- `valveRefs`
- `label`
- `direction`
- `branchGroup`

### 6.3 `routeHint`

V1 最小支持：

- `points`
  - 折线控制点数组

前端规则：

- 若 `points` 存在，按指定折线走线
- 若 `points` 缺失，按节点位置自动布线

## 7. `groups[]` 与 `stats`

### 7.1 `groups[]`

用于区域折叠、楼层过滤、系统聚焦。

建议字段：

- `id`
- `label`
- `groupType`
  - `loop | floor | area | header`
- `nodeIds`

### 7.2 `stats`

建议字段：

- `totalNodes`
- `totalEdges`
- `deviceNodeCount`
- `virtualNodeCount`
- `degradedNodeCount`

## 8. 最小示例

```json
{
  "site": {
    "siteId": "126lnoffice",
    "siteName": "lnoffice"
  },
  "generatedAt": "2026-03-18T09:30:00+08:00",
  "layoutMode": "auto",
  "scope": "full",
  "freshness": {
    "state": "fresh"
  },
  "sourceStatus": {
    "ok": true
  },
  "nodes": [
    {
      "id": "device-ch-1",
      "nodeType": "device",
      "deviceIdRef": "2",
      "label": "1#冷水机",
      "systemType": "chiller",
      "role": "main",
      "group": "main_loop",
      "modelCategory": "chiller",
      "positionHint": { "x": 0, "y": 0, "z": 0 },
      "rotationHint": { "y": 0 },
      "statusSummary": {
        "runStatus": "run",
        "alarmStatus": "normal",
        "degraded": false,
        "latestUpdateAt": "2026-03-18T09:28:00+08:00"
      }
    },
    {
      "id": "valve-chilled-01",
      "nodeType": "valve",
      "label": "冷冻阀门",
      "systemType": "valve",
      "role": "main",
      "group": "chilled_supply",
      "modelCategory": "valve",
      "positionHint": { "x": 3, "y": 0, "z": 0 },
      "statusSummary": {
        "runStatus": "unknown",
        "alarmStatus": "unknown",
        "degraded": false,
        "latestUpdateAt": null
      }
    },
    {
      "id": "device-chp-1",
      "nodeType": "device",
      "deviceIdRef": "1",
      "label": "1#冷冻泵",
      "systemType": "chilledPump",
      "role": "main",
      "group": "main_loop",
      "modelCategory": "pump",
      "positionHint": { "x": 6, "y": 0, "z": 0 },
      "statusSummary": {
        "runStatus": "stop",
        "alarmStatus": "normal",
        "degraded": false,
        "latestUpdateAt": "2026-03-18T09:27:00+08:00"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "device-ch-1",
      "to": "valve-chilled-01",
      "edgeType": "pipe",
      "pipeClass": "chilled_supply"
    },
    {
      "id": "edge-2",
      "from": "valve-chilled-01",
      "to": "device-chp-1",
      "edgeType": "pipe",
      "pipeClass": "chilled_supply"
    }
  ],
  "groups": [
    {
      "id": "main_loop",
      "label": "主回路",
      "groupType": "loop",
      "nodeIds": ["device-ch-1", "valve-chilled-01", "device-chp-1"]
    }
  ],
  "stats": {
    "totalNodes": 3,
    "totalEdges": 2,
    "deviceNodeCount": 2,
    "virtualNodeCount": 0,
    "degradedNodeCount": 0
  }
}
```

## 9. 前端消费规则

前端消费规则建议固定：

1. 设备模型只根据 `modelCategory` 决定，不再猜设备类型。
2. 节点联动只根据 `deviceIdRef`，不再猜名称。
3. 连线只根据 `edges[]`，不再猜 `downstream`。
4. 若 `positionHint.x/y/z` 完整，则按固定位置摆放。
5. 若只有 `row/column/lane`，则按规则布局摆放。
6. 若 `valve/header/load` 无真实设备，则仍可渲染为语义图元。
7. `statusSummary` 只读后端字段，不允许前端推断运行/报警。

## 10. 降级策略

如果 `system/diagram` 暂未落地，前端降级顺序建议：

1. 优先读 `system/diagram`
2. 失败后退回 `system/topology + devices/list`
3. 再失败退回本地 `MAIN_LOOP_SYSTEM_DIAGRAM`

这样可以保证：

- 完整系统图可升级
- 当前主回路示意图不回退

## 11. 验收标准

`system/diagram` V1 达标，至少满足：

1. 能区分真实设备节点和示意图元节点。
2. 能表达至少一条完整冷冻回路和一条完整冷却回路。
3. 前端不需要再猜设备连接关系。
4. 节点点击后能稳定跳转到真实 `deviceId`。
5. 阀门、负荷、汇流排可作为独立图元渲染。
6. 没有真实坐标时，仍可通过 `positionHint` 退回规则布局。

## 12. 主控下一步建议

建议主控按这个顺序推进：

1. 先新增 `GET /bff/v1/sites/{siteId}/system/diagram`
2. 第一版先补 `nodes + edges + deviceIdRef + pipeClass + positionHint`
3. 前端优先接 `main_loop + full` 两种 scope
4. 阀门真实绑定放到第二轮，不阻塞首版完整系统图

一句话建议：

- 先把“设备级拓扑合同”补齐，完整 3D 系统图就能真正落地。
