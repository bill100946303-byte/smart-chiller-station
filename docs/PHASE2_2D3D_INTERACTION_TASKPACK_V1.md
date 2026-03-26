# PHASE2_2D3D_INTERACTION_TASKPACK_V1

## 1. 任务定位

本任务包用于启动 Phase 2 的第一条主线：

- `2D/3D` 深交互增强

当前定位：

- 只增强已签收 `/scene-control`
- 只增强 `/scene-control` 与 `/devices` 的现有联动
- 不触碰 legacy `4000` 下 2D/3D 场景本体

## 2. 当前已确认基础

当前 `/scene-control` 已具备：

- `mode=2d|3d`、`floor=10|11` URL 承接
- 2D/3D、10/11 楼、四场景快速切换
- 同楼层设备侧栏
- 右侧设备详情首屏
- `SystemDiagram3D` 壳内语义系统图
- 场景页到设备页深链接

当前可复用接口：

- `/bff/v1/sites/{siteId}/devices/list`
- `/bff/v1/sites/{siteId}/devices/{deviceId}`
- `/bff/v1/sites/{siteId}/system/topology`
- `/bff/v1/sites/{siteId}/system/diagram`

## 3. 第一批只做的 3 件事

### 3.1 scene-control 深链接补齐

目标：

- `/scene-control` 支持持久化：
  - `mode`
  - `floor`
  - `deviceId`
  - `nodeId`

要求：

- 当前选中的设备或系统图节点必须写回 URL
- 链接可分享、可回放

### 3.2 三方统一选中态

目标：

- 打通以下三方的统一选中逻辑：
  - `SystemDiagram3D` 节点
  - 同楼层设备侧栏
  - 右侧设备详情

要求：

- 任一处选中，都能同步到另外两处
- 统一以当前 `deviceId` 为主选择态
- 如节点没有设备映射，不强行联动

### 3.3 设备页回场景页保留上下文

目标：

- 从 `/devices` 返回 `/scene-control` 时，保留：
  - `floor`
  - `mode`
  - `deviceId`

要求：

- 不再只回到 `mode=2d&floor=...`
- 需要回到当前设备对应的场景上下文

## 4. 当前明确不做项

- 不改 legacy iframe 内部节点事件
- 不改 `4000` 下旧 2D/3D 资源结构
- 不做节点级控制下发
- 不做新的场景分析页
- 不做多站点通用化改造
- 不启动 `/simulate`
- 不启动 `/assistant/query`
- 不启动正式 optimize engine

## 5. 风险点

### 5.1 legacy 场景本体不可触碰

当前深交互第一批必须建立在新壳层，不得把任务扩成：

- 改 iframe 内脚本
- 改旧 2D/3D 资产结构
- 替换 legacy 场景资源

### 5.2 双图源漂移

当前并存两类图面：

- legacy iframe 场景
- 壳内 `SystemDiagram3D`

第一批只允许把 `SystemDiagram3D` 作为语义联动层，不承诺与 iframe 内每个节点完全一致。

### 5.3 楼层映射仍有硬编码

当前仍存在：

- `10 -> 10楼 / floor=1`
- `11 -> 11楼 / floor=2`

第一批允许沿用，但不得继续扩散到更多页面。

## 6. 推荐实施顺序

### Step 1

先补 `/scene-control` 的 `deviceId` / `nodeId` URL 持久化。

### Step 2

再打通：

- `SystemDiagram3D`
- 设备侧栏
- 详情区

的统一选中态。

### Step 3

最后补：

- `/devices -> /scene-control`

的上下文回跳保留。

## 7. 验收口径

第一批完成后，至少满足：

1. `/scene-control?mode=3d&floor=11&deviceId=...` 可直接恢复选中设备状态
2. 点击 `SystemDiagram3D` 节点后，设备侧栏与详情区同步切换
3. 从 `/devices` 返回 `/scene-control` 时，当前设备上下文不丢失
4. 不破坏当前 `/scene-control`、`/devices` 已签收状态

## 8. 当前结论

本任务包只定义：

- 最小 Phase 2 第一批交付

不扩成：

- 场景重写
- 控制平台
- 新业务域

## 9. 当前进展

截至 `2026-03-24`，第一批已完成并验证：

- `/scene-control` 已持久化 `mode / floor / deviceId / nodeId`
- `SystemDiagram3D`、设备侧栏、详情区已建立统一选中态
- `/scene-control -> /devices -> 返回场景页` 已能保留 `mode + floor + deviceId + nodeId` 上下文

当前仍明确不做：

- legacy `4000` 引擎内节点控制
- 控制下发
- 旧场景资产结构改造
