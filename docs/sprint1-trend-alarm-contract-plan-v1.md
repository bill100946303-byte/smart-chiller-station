# Sprint1 趋势分析页 + 告警页 合同开工方案 v1

## 1. 范围与目标

Sprint1 只处理两页：

1. 趋势分析页
2. 告警页

目标不是把旧页面 100% 等价搬完，而是明确：

- 哪些接口可以直接复用当前 BFF
- 哪些接口必须新增
- 首版联调是否可行
- 哪一页最适合先开工

## 2. 总结结论

### 趋势分析页

- 可直接复用现有 BFF：`Yes`
- Sprint1 首版联调：`Yes`
- 是否必须新增接口：`No`

### 告警页

- 可直接复用现有 BFF 摘要接口：`Yes`
- Sprint1 首版联调：`Yes`，但前提是页面范围收敛到“摘要 + 最近告警”
- 是否必须新增接口：`Yes`
  - 至少新增 `anomalies/list`
  - `anomalies/{alarmId}` 可列为 Sprint1.5 / Sprint2

## 3. 趋势分析页开工方案

### 3.1 可直接复用接口

直接复用现有 BFF：

- `GET /bff/v1/sites/{siteId}/dashboard/trends`
- 可选辅助：`GET /bff/v1/sites/{siteId}/dashboard/overview`

对应旧来源已被 BFF 吸纳：

- `GET /zsqy/homepage/{dbName}/getEnergyStatisticsCurve`
- `GET /zsqy/homepage/{dbName}/getRunParamsCurve`
- 可选补充来源：`GET /zsqy/homepage/{dbName}/getEquipmentEnergyStatisticsCurve`

### 3.2 当前已能承接的页面能力

- 趋势主图
- 指标切换
- 24h / 7d / 30d 范围切换
- latest / min / max 摘要
- `sourceStatus` 与 `freshness` 提示

### 3.3 Sprint1 不必先做的内容

- 高级对比分析
- 多指标自由组合
- 导出
- 回放
- 跨图联动

### 3.4 联调判断

首版联调可行性：`Yes`

原因：

- OpenAPI 已有完整 contract
- example 已存在
- 数据结构已经是前端可直接绘图格式
- 这是当前最接近“直接渲染”的页面接口

### 3.5 开工建议

趋势分析页在 Sprint1 可以直接按“页面联调”而不是“接口补定义”开工。

建议顺序：

1. 先接 `dashboard/trends`
2. 再视页面需要补接 `dashboard/overview`
3. 暂不扩范围到 compare/export

## 4. 告警页开工方案

### 4.1 可直接复用接口

直接复用现有 BFF：

- `GET /bff/v1/sites/{siteId}/anomalies/summary`

可复用旧来源：

- `GET /{dbName}/getAllSubsystemInfo`
- `GET /zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`

### 4.2 当前已能承接的页面能力

- 告警总数卡片
- 最近告警列表（少量 recent items）
- 告警数据是否陈旧
- 诊断标记，例如 `staleAlarmFeed`

### 4.3 当前还缺什么接口

告警页若要从“摘要页”走到“可用页”，至少还缺：

- `GET /bff/v1/sites/{siteId}/anomalies/list`

建议字段：

- `items[]`
- `page/pageSize/total`
- `filters`
- `freshness`
- `sourceStatus`

若页面要做详情抽屉或详情页，还缺：

- `GET /bff/v1/sites/{siteId}/anomalies/{alarmId}`

但这条可以不是 Sprint1 必须项。

### 4.4 新接口建议来源

`anomalies/list` 第一版建议仍基于当前稳定来源做：

- 主来源：`/zsqy/qsAlarmlog/{dbName}/findNewAlarmLog`
- 辅助来源：`/{dbName}/getAllSubsystemInfo`

注意边界：

- 这更像“最近告警列表”而不是“完整历史告警中心”
- 如果业务要求全量分页、复杂筛选、告警详情，就需要继续确认更稳定的旧接口来源
- `findAlarmListHome` 当前不建议作为 Sprint1 强依赖

### 4.5 联调判断

首版联调可行性：`Yes`

但需明确是以下范围：

- `anomalies/summary` 直连页面头部
- 新增 `anomalies/list` 承接主列表
- 暂不承诺完整历史详情 / 工单联动

如果目标是“一步到位替代旧告警中心全部能力”，当前判断应是：`No`

### 4.6 开工建议

告警页在 Sprint1 适合按“两段式”开工：

1. 先接 `anomalies/summary`
2. 同步补 `anomalies/list` contract
3. 若时间不够，`detail` 延后

## 5. 页面对比

| 页面 | 直接复用接口 | 必须新增 | 首版联调可行性 |
| --- | --- | --- | --- |
| 趋势分析页 | `dashboard/trends`、可选 `dashboard/overview` | 无 | `Yes` |
| 告警页 | `anomalies/summary` | `anomalies/list`（必须），`anomalies/{alarmId}`（可后置） | `Yes`，但限 Sprint1 收敛范围 |

## 6. 哪一页适合先开工

建议先开工：`趋势分析页`

原因：

- 不需要先补新接口
- 当前 contract 最完整
- 联调闭环最短
- 最容易快速出一版可验收页面

第二个紧跟开工的页面：

- `告警页`

原因：

- 摘要已经有现成接口
- 只要补一个 `anomalies/list`，就能形成 Sprint1 可用页面

## 7. Sprint1 建议排期口径

推荐顺序：

1. 趋势分析页先开工，直接吃现有 BFF
2. 告警页同步冻结 `anomalies/list` contract
3. 告警 detail / 工单联动放后续 Sprint

一句话口径：

- `趋势页是直接联调项`
- `告警页是“summary 直复用 + list 新增”的半新增项`
