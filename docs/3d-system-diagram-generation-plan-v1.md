# 3D 系统图生成方案 v1

## 目标

基于新壳已接入的四类设备模型，生成一版可演示的冷站主回路 3D 系统图。

本方案的目标不是重做旧 2D / 3D 子应用，而是在新壳内先落一版“可自动拼装、可绑定设备、可承接运行态”的 3D 示意图能力。

## 当前基础

当前已接入并可直接用于 3D 系统图的模型资产：

- 冷机：`/models/chiller/chiller-main-v1.glb`
- 冷冻泵 / 冷却泵：`/models/pump/pump-horizontal-v1.glb`
- 冷却塔：`/models/cooling-tower/cooling-tower-v1.glb`
- 阀门：`/models/valve/valve-check-v1.glb`

当前模型清单见：

- [model-manifest-v1.json](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/public/models/model-manifest-v1.json)

## V1 定位

V1 只做“主回路 3D 示意图”，不做机房全景，不做节点级控制，不做复杂拖拽编辑。

V1 输出的是：

- 一张可自动生成的冷站主回路 3D 图
- 可展示设备类别、连接关系、基础运行态
- 可在 `/scene-control` 中作为新壳自有 3D 图层存在

V1 不做：

- 精确还原真实机房土建与设备摆位
- 全站所有点位、所有支路、所有阀门明细
- 复杂动画、碰撞、路径编辑器
- 直接替代 legacy iframe 场景

## V1 图面范围

优先生成这 6 类对象：

1. 冷机
2. 冷冻泵
3. 冷却泵
4. 冷却塔
5. 主阀门
6. 主回路管线

推荐先只做一张“单站主回路图”，最小拓扑为：

```text
冷却塔 -> 冷却泵 -> 冷机 -> 冷冻泵 -> 负荷侧
```

其中：

- 冷却侧与冷冻侧分两条主回路
- 阀门先只放在关键连接点
- 负荷侧先用“负荷端占位块”表示，不必先接真实末端系统

## 生成方式

### 1. 设备层

按 `systemType / usageType / deviceTypeName` 映射到模型类别：

- `冷机` -> `chiller`
- `冷冻泵` / `冷却泵` -> `pump`
- `冷却塔` -> `cooling-tower`
- `阀门类` -> `valve`

前端生成时读取统一模型注册表：

- [modelRegistry.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/config/modelRegistry.ts)

### 2. 布局层

V1 不要求后端先给真实三维坐标，先采用“规则布局”自动摆位。

推荐布局规则：

- 冷机居中，作为主设备
- 冷冻泵布在冷机一侧，横向排布
- 冷却泵布在冷机另一侧，横向排布
- 冷却塔布在上方或后方，成组排布
- 阀门自动插入主回路关键折点或连接端

V1 采用二维平面 + 高度分层即可：

- `x`: 设备组左右排布
- `z`: 前后分区
- `y`: 仅做轻微高度区分，不追求真实标高

### 3. 拓扑层

3D 系统图不是靠模型自动推断，而是靠一份拓扑数据驱动。

V1 建议先定义一份前端可读 JSON：

```json
{
  "nodes": [
    { "id": "chiller-01", "type": "chiller", "label": "冷机 01" },
    { "id": "pump-chw-01", "type": "pump", "label": "冷冻泵 01", "role": "chilled" },
    { "id": "pump-cw-01", "type": "pump", "label": "冷却泵 01", "role": "cooling" },
    { "id": "tower-01", "type": "cooling-tower", "label": "冷却塔 01" },
    { "id": "valve-01", "type": "valve", "label": "主阀门 01" }
  ],
  "edges": [
    { "from": "tower-01", "to": "pump-cw-01", "kind": "cooling-water" },
    { "from": "pump-cw-01", "to": "chiller-01", "kind": "cooling-water" },
    { "from": "chiller-01", "to": "pump-chw-01", "kind": "chilled-water" }
  ]
}
```

### 4. 管线层

V1 管线不需要建模文件，直接前端程序生成：

- 直线段：圆柱体或挤出线段
- 拐点：90 度折线
- 颜色分层：
  - 冷冻水：冷蓝
  - 冷却水：青蓝/灰蓝
  - 风险/告警：局部高亮

阀门先挂在边上，而不是先做精确法兰匹配。

### 5. 运行态层

V1 运行态只绑定到设备级，不先下钻部件级。

推荐最小绑定字段：

- `deviceId`
- `runStatusText`
- `alarmStatusText`
- `latestUpdateAt`
- `sourceStatus`

展示规则：

- 在线：正常亮度
- 离线：去饱和或灰化
- 告警：描边 / 色环 / 顶部徽标
- 数据陈旧：整设备加 `stale` 标识

## 数据来源建议

V1 优先复用现有 BFF，不新增复杂合同。

建议组合：

- `overview`
  - 提供站点摘要与设备总量
- `topology`
  - 提供系统分组、设备树或最小设备结构
- `devices/list`
  - 提供真实设备清单
- `devices/tree`
  - 提供设备树和关联结构
- `devices/:id`
  - 提供设备详情与运行态

如果后端暂时不给“系统图拓扑 JSON”，V1 可以先在前端做一个站点级生成适配层：

- 从 `devices/list + topology` 生成最小主回路节点
- 缺失设备时用占位节点补齐

## 前端实现建议

推荐新增一个独立的场景生成器，而不是把逻辑全部塞进现有页面组件。

建议新增：

- `src/components/scene3d/SystemDiagram3D.tsx`
- `src/components/scene3d/SystemDiagramNode.tsx`
- `src/components/scene3d/SystemDiagramEdge.tsx`
- `src/components/scene3d/systemDiagramLayout.ts`
- `src/components/scene3d/systemDiagramTypes.ts`

建议接入位置：

- 第一阶段：挂到 [SceneControlPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/SceneControlPage.tsx) 的右侧实验区
- 第二阶段：支持在 `/devices` 里点击设备后高亮对应节点

## V1 页面表现

V1 页面上建议包含：

- 3D 系统图区
- 图例：冷机 / 泵 / 冷却塔 / 阀门 / 冷冻水 / 冷却水
- 设备列表联动区
- 运行态摘要区

交互先只做：

- 旋转 / 缩放 / 平移
- 点击设备高亮
- 悬浮显示设备名称和状态
- 一键切换“冷冻侧 / 冷却侧 / 全部”

## 生成流程

```text
设备清单 + 拓扑数据
        ->
设备类别映射
        ->
规则布局计算
        ->
加载 GLB 模型
        ->
生成程序化管线
        ->
绑定运行态
        ->
输出新壳 3D 系统图
```

## V1 验收标准

达到以下条件即可认为 V1 可演示：

1. 能自动生成一张主回路 3D 图
2. 冷机 / 泵 / 冷却塔 / 阀门四类模型都能上图
3. 设备与 `deviceId` 有稳定绑定
4. 至少支持在线 / 离线 / 告警 / stale 四类展示
5. 页面在桌面端可稳定渲染，不依赖 legacy 场景成功加载

## 当前缺口

当前已具备：

- 模型资产
- 模型注册表
- 基础页面壳层
- 设备详情和列表来源

当前仍缺：

- 一份最小系统图拓扑数据结构
- 一份规则布局函数
- 管线程序生成层
- 设备节点与运行态绑定层

## 建议下一步

1. 新增 `systemDiagramTypes + layout + mock topology` 三件套
2. 在 `/scene-control` 右侧先生成一张固定主回路 3D 示意图
3. 再把固定示意图替换为“按真实 devices/topology 自动拼装”

## 拍板建议

可以直接进入开发。

原因：

- 四类模型资产已经齐备
- 新壳已有可承接页面
- V1 方案不依赖先还原真实机房，只需要最小拓扑和规则布局
