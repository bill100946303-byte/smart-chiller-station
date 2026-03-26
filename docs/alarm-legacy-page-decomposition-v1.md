# 告警 legacy 页面拆解 v1

## 1. 结论

旧 `alertrun` 不是单一“告警页”，而是一个把用户侧告警查看、配置维护、台账管理混装在同一 tab 容器里的历史集合页。新壳 `/alarms` 不应整页照搬，而应只承接用户值班视角下的告警查看模块。

本轮结论：

- 应进入新壳 `/alarms`：`实时报警`、`报警记录`
- 可后置：`台账`
- 应下沉到后台配置：`报警设置`、`设备信息`
- 特别判断：`deviceinformation/index.vue` 不是用户设备页，而是后台配置页

## 2. 旧页结构证据

旧容器页 [index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/index.vue) 通过 `el-tabs` 混合承载 5 个标签：

- `realtime`：实时报警
- `record`：报警记录
- `settings`：报警设置
- `bill`：设备台账
- `deviceinformation`：设备信息

这说明 legacy 的“告警页”本质上是一个历史聚合入口，不等于新壳用户侧 `/alarms` 的页面边界。

## 3. 五类模块拆解

### 3.1 实时报警

源码：
- [realtime.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/realtime.vue)
- [components/realsearch.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/realsearch.vue)
- [components/table.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/table.vue)

职责判断：
- 典型用户侧监看页
- 以 `findAllTimeAlarm` 拉实时报警
- 支持按设备类型、报警等级筛选
- 20 秒自动刷新
- 只读表格 + 分页

迁移结论：
- 属于用户侧页面
- 应进入新壳 `/alarms`
- 在新壳中已被“摘要 + 最近告警流 + 实时列表 + freshness/sourceStatus”更现代地承接

### 3.2 报警记录

源码：
- [record.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/record.vue)
- [components/search.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/search.vue)
- [components/table.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/table.vue)

职责判断：
- 典型用户侧历史查询页
- 以 `findAllHisAlarm` 拉历史报警
- 支持时间范围、等级、设备类型筛选
- 支持导出 `报警记录.xls`

迁移结论：
- 属于用户侧页面
- 应进入新壳 `/alarms`
- 当前新壳真实列表页已承接其核心价值；导出能力可后续作为增强，不影响当前边界

### 3.3 报警设置

源码：
- [settings.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/settings.vue)
- [components/settingssearch.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/settingssearch.vue)
- [components/settingsDialog.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/settingsDialog.vue)

职责判断：
- 不是值班查看页，而是报警规则、阈值维护页
- 直接展示并编辑：
  - 点位名称
  - 当前值
  - 布尔变量
  - 报警等级
  - 高高报、低低报、高报、低报阈值与等级
- 提供“编辑”操作弹窗

迁移结论：
- 不属于用户侧页面
- 不应进入新壳 `/alarms`
- 应下沉到后台配置

原因：
- 这是规则和阈值维护，不是用户侧运行态告警消费
- 若继续放在 `/alarms`，会把“查看告警”和“改告警口径”混在一起，边界错误

### 3.4 台账

源码：
- [bill.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/bill.vue)
- [components/billtable.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/billtable.vue)
- [components/dialog.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/dialog.vue)
- [components/mydrawer.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/components/mydrawer.vue)

职责判断：
- 更像资产、台账管理页，不是告警消费页
- 直接支持：
  - 新增
  - 删除
  - 导入
  - 导出
  - 编辑
  - 查看详情抽屉
- 调用的也是台账类接口，不是 anomalies 视图接口

迁移结论：
- 不应作为 `/alarms` 首版承接内容
- 本轮建议后置
- 若后续要做，建议独立成“设备台账/资产台账”页面，而不是并入用户侧告警页

原因：
- 台账管理与告警查看的任务心智不同
- 当前新壳 `/alarms` 已签收，范围固定为告警摘要、最近流、真实列表与状态表达，加入台账会扩边界

### 3.5 设备信息

源码：
- [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue)
- [deviceinformation/tableBox.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/tableBox.vue)

职责判断：
- 明确是后台配置页，不是用户设备页
- 页面主要在做：
  - 设备类型选择
  - 设备实例选择
  - 点位位置、寄存器选择
  - `机组电流比` 绑定
  - 设备状态图片上传（运行、停止、报警）
  - 调 `drInfoSetting` 保存配置

特别判断：
- [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue) 不属于用户设备页
- 它属于“设备信息配置、展示资源配置”类后台页
- 不应误归到新壳 `/devices`
- 更不应误归到用户侧 `/alarms`

迁移结论：
- 不属于用户侧页面
- 应下沉到后台配置

## 4. 用户侧 vs 配置侧归类

### 4.1 用户侧页面

- 实时报警
- 报警记录

这两块的共同特征是：
- 只读消费为主
- 面向值班、运营
- 关注的是“发生了什么、什么时候发生、严重程度如何”

### 4.2 后置模块

- 台账

后置原因：
- 当前新壳 `/alarms` 已正式签收，边界已固定
- 台账属于管理维度，不是首版告警消费维度
- 如果未来要迁，建议独立成单独页面，而不是继续混在 `/alarms`

### 4.3 后台配置模块

- 报警设置
- 设备信息

共同特征：
- 都在改配置，不是在看运行态
- 都需要更高权限和更清晰的审计边界
- 不应放在用户值班入口里

## 5. `/alarms` 应承接的范围

结合当前新壳已签收状态 [MIGRATION_STAGE_CLOSEOUT_CURRENT.md](/Users/billchow/Documents/智慧冷冻站/docs/MIGRATION_STAGE_CLOSEOUT_CURRENT.md)，`/alarms` 应承接的 legacy 能力应收敛为：

- 实时报警的“当前告警查看”能力
- 报警记录的“历史报警查询”能力
- 面向值班的严重级别筛选
- freshness、degraded、sourceStatus 表达
- 最近告警流与真实列表联动

不应再向 `/alarms` 回灌：
- 阈值配置
- 点位规则配置
- 设备状态图片配置
- 台账增删改导入导出

## 6. 最终拍板

### 6.1 进入新壳 `/alarms`

- 实时报警
- 报警记录

### 6.2 后置

- 台账

### 6.3 下沉到后台配置

- 报警设置
- 设备信息

### 6.4 特别判断结果

- [deviceinformation/index.vue](/Users/billchow/Documents/智慧冷冻站/legacy-src-full/web/src/views/front/alertrun/deviceinformation/index.vue)
- 结论：后台配置页，不是用户设备页
