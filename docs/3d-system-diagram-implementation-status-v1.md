# 3D 系统图实现状态 v1

## 当前结论

`/scene-control` 已落一版可运行的主回路 3D 系统图。

当前状态不是纯方案稿，已经进入“可演示、可联动、可继续接真实拓扑”的阶段。

## 已完成

### 1. 四类模型已接入

- 冷机：`/models/chiller/chiller-main-v1.glb`
- 泵：`/models/pump/pump-horizontal-v1.glb`
- 冷却塔：`/models/cooling-tower/cooling-tower-v1.glb`
- 阀门：`/models/valve/valve-check-v1.glb`

模型注册表：

- [modelRegistry.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/config/modelRegistry.ts)

### 2. 3D 系统图组件已落地

核心文件：

- [SystemDiagram3D.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/scene3d/SystemDiagram3D.tsx)
- [systemDiagramTypes.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/scene3d/systemDiagramTypes.ts)
- [systemDiagramLayout.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/scene3d/systemDiagramLayout.ts)
- [systemDiagramMock.ts](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/components/scene3d/systemDiagramMock.ts)

接入页面：

- [SceneControlPage.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/pages/SceneControlPage.tsx)

### 3. 已实现能力

- 真实数据优先，`mock` 兜底
- 主回路节点自动生成
- 按 `topology.nodes[].downstream` 生成主链
- 冷冻侧 / 冷却侧程序化管线
- `load` 节点可见
- 阀门按链路自动插入
- 冷机 / 冷冻泵 / 冷却泵 / 冷却塔按真实计数显示为设备簇
- 点击 3D 节点后联动右侧设备详情
- 图下摘要卡显示：
  - 系统类型
  - 实例数量
  - 主设备名称 + `deviceId`
  - 设备页跳转入口
- 已补充“当前读法”说明，避免误读阀门和设备簇

## 当前真实数据口径

当前直接消费：

- `GET /bff/v1/sites/{siteId}/system/topology`
- `GET /bff/v1/sites/{siteId}/devices/list`
- `GET /bff/v1/sites/{siteId}/devices/{deviceId}`

当前站点 `126lnoffice` 已确认：

- 冷机：`3`
- 冷冻泵：`3`
- 冷却泵：`3`
- 冷却塔：`4`
- 主链：`chiller -> chilledPump -> load -> coolingPump -> coolingTower`

## 当前边界

当前仍属于“主回路示意图”，不是完整机房数字孪生。

当前还没做：

- 真实阀门设备绑定
- 每一台设备的精确坐标
- 真实管线长度、弯头、标高
- 部件级运行态
- 楼层 / 机房全景还原
- 编辑器式拖拽布局

## 当前读法

- 设备簇表示该类设备的真实数量，不等于每台都已独立绑定详情
- 主设备代表当前该类的首个联动对象
- 阀门当前只是链路表达节点，不代表真实阀门台账已建完
- `load` 节点表示建筑负荷侧，不代表真实末端系统已建模

## 下一步建议

### P1

- 把阀门从示意节点升级成真实设备映射
- 给设备簇补“第 1 台 / 第 2 台 / 第 3 台”切换

### P1.1

- 引入真实 `devices/tree` 或专门的 3D 拓扑合同
- 让布局不再只靠规则模板

### P2

- 增加节点 hover 提示
- 增加“只看冷冻侧 / 只看冷却侧 / 全部”切换
- 增加 stale / alarm 的更明确视觉标记

## 拍板结论

当前 3D 系统图可定义为：

- `可演示`：是
- `可联动`：是
- `可替代 legacy 3D`：否

最合适的定位是：

**新壳自有主回路 3D 示意层，已可作为后续真实 3D 系统图的基座。**
