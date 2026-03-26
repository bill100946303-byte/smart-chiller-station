# 旧前端源码迁移对照 v1

## 1. 结论

仓库内已经收到一整套旧前端可开发源码，不是单纯发布产物。

可用源码目录：

- [legacy-src-full/web](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web)

技术栈判断：

- `Vue 2`
- `Vue CLI 3`
- `Element UI`
- `Vuex`
- `Vue Router`

核心入口：

- [package.json](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/package.json)
- [main.js](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/main.js)
- [App.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/App.vue)
- [front.js](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/router/modules/front.js)

一句话拍板：

- 后续页面迁移应以这套源码为准，不再只看旧截图和 `vue_dist`

## 2. 旧源码关键入口

### 2.1 前台路由总表

旧前台核心路由在：

- [front.js](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/router/modules/front.js)

和当前新壳迁移最相关的旧路由：

- `/alertrun`
- `/energy-test`
- `/consumption`
- `/dataDetails`
- `/systemhomepage`

### 2.2 旧首页 / 驾驶舱主入口

- [defaultpage.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/systemhomepage/defaultpage.vue)

这页实际是一个“大拼盘”：

- 顶部环境/KPI
- 中间 iframe 2D/3D 场景
- 左右运行面板
- 底部 2D/3D 切换与控制
- 弹窗和实时 websocket 联动

### 2.3 旧告警页主入口

- [alertrun/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue)

它不是单页，而是一个 tab 容器：

- 实时报警
- 报警记录
- 报警设置
- 设备台账
- 设备信息

### 2.4 旧趋势/能效入口

- [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue)

它也是 tab 容器：

- 能效日历
- 能效查询
- 能效对比
- 负荷比重
- 热不平衡率

补充一个和趋势密切相关的旧页：

- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)

这页更像：

- 查询条件
- 折线图
- 统计表
- 导出

### 2.5 旧设备信息入口

- [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue)

这页不是单纯“设备总览”，而是偏配置后台：

- 设备类型级联选择
- 设备实例选择
- 点位绑定
- 主机电流比配置
- 状态图上传

## 3. 新壳当前承接页

当前新壳路由在：

- [App.tsx](/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/src/App.tsx)

已承接页面：

- `/dashboard`
- `/system-overview`
- `/trend-analysis`
- `/alarms`
- `/devices`
- `/scene-control`

## 4. 迁移对照

| 旧源码入口 | 旧页面职责 | 新壳承接页 | 迁移建议 |
| --- | --- | --- | --- |
| [defaultpage.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/systemhomepage/defaultpage.vue) | 驾驶舱总入口、环境卡、左右运行面板、场景 iframe | `/dashboard` + `/system-overview` + `/scene-control` | 必须拆迁，不要整页平移 |
| [alertrun/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue) | 告警 tab 容器 | `/alarms` | 只迁实时报警/报警记录；设置与台账后置 |
| [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue) | 趋势/能效 tab 容器 | `/trend-analysis` | 只迁查询/对比/热不平衡率相关主体；日历和负荷比重后置 |
| [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue) | 查询 + 图表 + 统计表 + 导出 | `/trend-analysis` 或 `/system-overview` 二期模块 | 优先抽图表与表格结构，不直接复刻 |
| [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue) | 设备配置、图片上传、点位绑定 | `/devices` 二期后台能力 | 不应直接当用户侧设备总览迁移 |

## 5. 每页拍板

### 5.1 首页驾驶舱 / 系统总览 / 场景控制

旧页：

- [defaultpage.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/systemhomepage/defaultpage.vue)

建议保留：

- 顶部环境信息组织方式
- 左右运行信息栏位结构
- `2D / 3D` 切换心智
- 驾驶舱型信息层级

建议重做：

- 导航、壳层、视觉语言
- KPI 卡片与图表组件
- iframe 包装和降级提示
- websocket 直耦逻辑

明确不做：

- 旧页整页复刻
- 把大量旧 `Element UI` 拼盘直接嵌进新壳

拆迁方式：

- 顶部环境卡 -> `/dashboard`
- 运行概况与设备簇 -> `/system-overview`
- 旧 2D/3D iframe 与 3D 主回路图 -> `/scene-control`

### 5.2 告警页

旧页：

- [alertrun/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue)

建议保留：

- “实时 / 记录”双态心智
- Tab 内部模块拆分思路

建议重做：

- 页面壳层
- 告警列表
- 严重度筛选
- 分页与空态

暂不迁：

- 报警设置
- 设备台账
- 设备信息配置

结论：

- 旧告警页应拆成“用户侧告警页”和“后台配置页”两条线，不要继续混在同一个 tab 容器里。

### 5.3 趋势分析页

旧页：

- [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue)
- [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)

建议保留：

- 查询条件 -> 图表 -> 统计表 的结构
- 对比分析与热不平衡率的专题视角

建议重做：

- 页头摘要
- 范围切换
- 多序列折线图
- 图表状态态（empty/degraded/stale）

暂不迁：

- 老的 tab 容器
- 导出和多重查询表单的全部细节

结论：

- 旧趋势页源码价值很高，但应该拆成“查询组件 + 图表组件 + 统计表”三块迁入新壳，而不是把 tab 原样照搬。

### 5.4 设备总览页

旧页：

- [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue)

建议保留：

- 设备类型与实例两级筛选心智
- 点位绑定和状态图片配置的后台能力

建议重做：

- 用户侧设备列表
- 设备状态总览
- 设备树 / 详情区
- 3D 模型卡与主回路联动

暂不迁：

- 状态图上传
- 点位配置表
- 设备图片配置

结论：

- 这页更适合被定义为“设备资产配置后台”，而不是新壳 `/devices` 的直接来源。

## 6. 迁移优先级

### P0 直接支撑新壳

1. [defaultpage.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/systemhomepage/defaultpage.vue)
2. [alertrun/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue)
3. [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue)

### P1 作为二期补充

1. [consumption/newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue)
2. [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue)

## 7. 建议主控下一步

建议主控不要再下“泛迁移”任务，而是按下面 3 条开工：

1. 告警页：把 [alertrun/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue) 的 tab 与子页拆成模块清单，逐块迁到 `/alarms`
2. 趋势页：把 [energy-test/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/energy-test/index.vue) 和 [newin.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/consumption/newin.vue) 的查询/图表/表格拆出来，迁到 `/trend-analysis`
3. 设备页：把 [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue) 定义为后台配置来源，不再误当用户侧设备页

一句话建议：

- 现在可以从“看旧截图迁移”切换到“对照旧源码拆模块迁移”了。
