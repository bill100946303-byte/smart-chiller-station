# GLB 模型接入清单 v1

## 目标

为冷站系统新壳准备第一批可落地的 GLB 模型资产，优先服务以下场景：

- `/scene-control` 的新 3D 预览增强
- `/devices` 的设备详情首屏模型展示

当前不替换旧场景引擎，不直接重做旧 `iframe` 场景。首批只做模型清单、目录约定和下载标准。

## 当前结论

优先用“模块化设备模型”而不是“整机房大模型”。

原因：

- 当前新壳场景页仍是旧场景外壳，不适合直接塞超重整机房模型
- 设备页更适合单设备预览卡，而不是整场景漫游
- 模块化模型更利于后续高亮、染色、告警态和设备映射

## 第一批建议模型

### 1. 冷机主设备

- 名称：`Chiller 3D Model - Industrial Cooling Tower`
- 来源：[Fab](https://www.fab.com/listings/3fc9a92e-93ed-4054-90d5-5a3d4e67b2cd)
- 格式：页面显示支持 `fbx / gltf / glb / usdz`
- 面数：`6,799 polygons`
- 建议用途：
  - `/devices` 设备详情首屏主设备
  - `/scene-control` 新 3D 预览里的冷机块
- 本地命名建议：`chiller-main-v1.glb`

### 2. 冷却塔

- 名称：`Cooling Tower (Animated)`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/cooling-tower-animated-174ff3bcba98413997c0ec88e5c65e81)
- 许可：`CC Attribution`
- 面数：`7.6k triangles`
- 建议用途：
  - `/scene-control` 屋顶/系统区冷却塔展示
  - 趋势或系统总览页的设备示意
- 本地命名建议：`cooling-tower-v1.glb`

### 3. 泵

- 名称：`CENTRIFUGAL PUMP - HORIZONTAL END SUCTION`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/centrifugal-pump-horizontal-end-suction-dee0b9325925453eb20acfcbeb1add91)
- 许可：`CC Attribution`
- 面数：`59.9k triangles`
- 建议用途：
  - `/devices` 的冷冻泵/冷却泵详情展示
  - `/scene-control` 的局部设备预览
- 本地命名建议：`pump-horizontal-v1.glb`

### 4. 阀门

- 名称：`GATE-TYPE CHECK VALVE | VÁLVULA CHECK`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/gate-type-check-valve-valvula-check-3c78dcd6cd254004a90ba99922836d80)
- 许可：`CC Attribution`
- 面数：`7.8k triangles`
- 建议用途：
  - 设备页附属部件
  - 场景页管路节点补件
- 本地命名建议：`valve-check-v1.glb`

## 备选模型

### 阀门备选

- 名称：`Industrial Valve`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/industrial-valve-cf87681a7fb6484f8ff4bae1f25030e5)
- 许可：`CC Attribution`
- 面数：`26.1k triangles`
- 备注：更偏写实，适合近景单体，不适合大量铺设

### 泵备选

- 名称：`CENTRIFUGAL PUMP | BOMBA CENTRÍFUGA`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/centrifugal-pump-bomba-centrifuga-f80a59eca6f849f785a042db1fde2b85)
- 许可：`CC Attribution`
- 面数：`165.4k triangles`
- 备注：过重，只建议做近景展示

### 整机房参考

- 名称：`SPIE Ibexhouse Chiller Plantroom`
- 来源：[Sketchfab](https://sketchfab.com/3d-models/spie-ibexhouse-chiller-plantroom-e1465ed8070f4927b963e8e0c7fbda9d)
- 备注：只适合参考机房空间关系，不建议直接接入首版 Web 页面

## 本地目录约定

模型统一放在：

- `apps/chiller-shell-v1/public/models/chiller/`
- `apps/chiller-shell-v1/public/models/cooling-tower/`
- `apps/chiller-shell-v1/public/models/pump/`
- `apps/chiller-shell-v1/public/models/valve/`

推荐文件名：

- `chiller-main-v1.glb`
- `cooling-tower-v1.glb`
- `pump-horizontal-v1.glb`
- `valve-check-v1.glb`

## 压缩与验收标准

下载后统一执行以下验收：

- 单文件优先控制在 `20MB` 内
- 单模型优先控制在 `60k triangles` 内
- 纹理优先 `1K` 或 `2K`
- 方向统一为正向朝前
- pivot 尽量居中，底部贴地
- 材质不要依赖外链纹理

## 页面接入顺序

### 第一阶段

- `/devices`
  - 为设备详情区增加 `设备模型卡`
  - 优先接 `冷机` 和 `泵`

### 第二阶段

- `/scene-control`
  - 增加 `新 3D 预览实验区`
  - 暂时不替换旧 `iframe` 场景
  - 优先接 `冷却塔` 和 `阀门`

## 当前我已完成

- 已筛出首批 4 类推荐模型
- 已在前端建立 `public/models` 目录结构
- 已建立本地模型清单 `model-manifest-v1.json`

## 需要你介入的唯一环节

外部平台下载可能需要：

- 登录 Sketchfab / Fab
- 确认许可
- 手动下载原始包或 GLB

如果你愿意继续，我下一步会在你下载完文件后直接帮你：

1. 检查模型大小、面数和材质
2. 统一重命名并放入正确目录
3. 生成首版接入映射
4. 给 `/devices` 或 `/scene-control` 接入第一版模型展示
