# B25 冷却塔 Approach Shadow 前置检查

- 结论：GO_SHADOW
- 只读建议：READY
- Shadow 前置：GO
- 站点：140 / 140btwentyfive / 126lnoffice
- 生成时间：2026-06-16T05:25:01.460Z

## 关键现态

| 项目 | 数值 |
| --- | --- |
| COP | 6.60 |
| 总功率 | 1940.3 kW |
| 当前负荷 | 12979.5 kW |
| 负荷率 | 51.3% |
| 冷却水回水 | 28.3℃ |
| 冷却水温差 | 4.7℃ |
| Tcws（冷却回水/塔出水） | 28.3℃ |
| 湿球温度 | 25.6℃ |
| 推算 Approach | 2.7℃ |
| AI 目标 Approach | 3.2℃ |
| AI 目标 Tcws | 28.8℃ |
| 热平衡偏差 | 11.1% |

## 阻断项

- 无

## 风险与提示

- 历史样本置信度低，节能评估需 shadow 对比验证。
- 最终冷却水出水温目标 30℃ 需分 4 步 shadow 验证，本次仅提交 28.8℃。
- 当前活动告警 8 条，shadow 前需确认无严重告警、传感器冻结或塔风机反馈异常。

## 需要人工介入

- 复核当前活动告警等级；存在严重告警、传感器冻结、塔风机反馈异常时禁止下发。

## 数据门禁缺口

- 结论：READY
- 通过项：8/8

| key | 状态 | 证据 | 恢复动作 |
| --- | --- | --- | --- |
| dashboard_overview | ready | http=200 / overall=ok | 先恢复 dashboard/overview 数据源；核对 siteId=140、databaseKey=140btwentyfive、projectKey=126lnoffice 与上游接口可用性。 |
| system_power | ready | totalPowerKw=1940.3 kW | 核对冷站总电表、主机/泵/塔功率汇总点和 Dashboard 能源卡片映射。 |
| cooling_load | ready | totalCoolingCapacity=12979.5 kW | 核对冷冻水总流量、供回水温差、冷量计算和额定冷量配置。 |
| tcws | ready | coolingReturnTemp=28.3℃ / signal=ok | 核对冷却塔出水、冷机冷凝器进水或冷却回水点位；确认物理位置和单位。 |
| wet_bulb_live | ready | outdoorWetBulbC=25.6℃ / signal=ok | 核对室外湿球点位、气象站通讯和湿球计算来源；缺失时 Approach 只能只读。 |
| wet_bulb_trend | ready | tag=SY-1-509-42048 / points=144 / overall=ok | 核对湿球趋势 tagname=SY-1-509-42048 是否正确，并确认历史曲线接口有 30-60min 对比样本。 |
| tower_fan_feedback | ready | coolingTowerPowerKw=59.5 kW | 核对塔风机运行反馈、频率反馈、功率或分组运行状态；无反馈时不做闭环目标。 |
| active_chillers | ready | advisor blocker not present | 核对 CH1-CH7 运行状态、机组启停信号和当前主机组合；缺失时不能判断最低冷凝水温边界。 |

## 数据源证据

- dashboard overall：ok
- advice overall：ok
- 湿球趋势点数：144
- 执行单列表：ok，total=7

## 下一步

- 保留 read_only 与 shadow 双轨观察，先不要打开 enforced。
- 按同负荷/相近湿球工况对比 COP、kW/RT、总功率、冷机功率、塔风机功率和告警次数。
- shadow 至少覆盖高/中/低负荷样本后，再评审 assisted。

