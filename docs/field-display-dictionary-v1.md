# Field Display Dictionary v1（前端展示层）

目的：提供前端可直接消费的“显示层字段映射”，避免直接暴露技术字段名。  
约束：不新增业务字段，不改变 `field-dictionary v1.0.1+` 的字段语义、单位和 `null_strategy`。

## 1. 覆盖范围

- 覆盖区域：KPI 区、趋势区、异常区、规则诊断区
- 覆盖字段数：35（均来自 `field-dictionary.json` 既有字段）

## 2. 字段显示映射（zh/en/vi）

| fieldKey | 区域 | displayName（zh / en / vi） | unitDisplay（zh / en / vi） | shortHint（zh / en / vi） | semanticNote | compareConstraint |
| --- | --- | --- | --- | --- | --- | --- |
| `station_total_power_kw` | KPI | 冷站总功率 / Station Total Power / Tong cong suat tram | kW / kW / kW | 当前总电功率 / Real-time station power / Cong suat tuc thoi | 冷站实时总功率，主口径来自 totalPower；缺失时可走回退链路，仅用于连续性。 | 仅在时间窗、采样频率、缺失策略一致时可比；需同时披露主口径命中率与回退占比。 |
| `station_total_energy_kwh` | KPI | 冷站累计电能 / Station Total Energy / Dien nang tich luy tram | kWh / kWh / kWh | 累计量 非实时 / Cumulative, not instant / Luy ke, khong tuc thoi | 累计电能字段，历史别名 totalElectricity 易误读为实时电量，展示时必须标注“累计”。 | 不可直接比较绝对值；需转同时间窗增量并确认表计复位策略一致。 |
| `station_cooling_capacity_kw` | KPI | 冷站总冷量 / Station Cooling Capacity / Tong cong suat lanh tram | kW / kW / kW | 当前制冷输出 / Current cooling output / Cong suat lanh hien tai | 冷站实时总冷量；现场长期为 0 时按口径返回 null，不做 0 值误导。 | 比较前需确认两站均非长期空值，并统一缺失过滤规则。 |
| `station_heat_rejection_kw` | KPI | 冷站散热量 / Station Heat Rejection / Cong suat thai nhiet tram | kW / kW / kW | 当前散热能力 / Current heat rejection / Kha nang thai nhiet | 冷站瞬时散热量，来源可为测点或派生计算。 | 跨站点比较要求散热量计算口径一致，且采样粒度一致。 |
| `station_cop` | KPI | 冷站COP / Station COP / COP tram lanh | - / - / - | 能效比 越高越优 / Efficiency ratio / Ty so hieu suat | COP=冷量/功率；分母<=0 或非有限值返回 null，禁止 Infinity/NaN。 | 仅比较同时间窗且均剔除无效点后的统计值（如 P50/P90）。 |
| `chilled_delta_t_c` | KPI | 冷冻水温差 / Chilled Water Delta-T / Chenh nhiet nuoc lanh | ℃ / degC / degC | 回水减供水 / Return minus supply / Hoi tru cap | 定义为冷冻回水温度-冷冻供水温度。 | 需确保两站采用同一定义与同采样频率，且缺失处理一致。 |
| `cooling_delta_t_c` | KPI | 冷却水温差 / Cooling Water Delta-T / Chenh nhiet nuoc giai nhiet | ℃ / degC / degC | 供水减回水 / Supply minus return / Cap tru hoi | 定义为冷却供水温度-冷却回水温度。 | 需统一温差方向定义、采样频率和缺失策略后再比较。 |
| `wet_bulb_temp_c` | KPI | 湿球温度 / Wet Bulb Temperature / Nhiet do bau uot | ℃ / degC / degC | 环境边界条件 / Ambient boundary / Dieu kien moi truong | 环境基础量，影响冷却侧性能解释。 | 跨站对比需同时给出湿球温度，否则能效结论可能失真。 |
| `outdoor_temp_c` | KPI | 室外温度 / Outdoor Temperature / Nhiet do ngoai troi | ℃ / degC / degC | 室外干球温度 / Outdoor dry bulb / Nhiet do kho ben ngoai | 环境基础量，常与湿度/湿球温度联合解释。 | 对比时需保证同时间窗环境工况可比。 |
| `outdoor_humidity_pct` | KPI | 室外湿度 / Outdoor Humidity / Do am ngoai troi | % / % / % | 相对湿度 / Relative humidity / Do am tuong doi | 环境基础量，用于露点/湿球相关解释。 | 跨站比较需保证湿度采样频率和时间对齐一致。 |
| `running_device_count` | KPI | 运行设备数 / Running Device Count / So thiet bi dang chay | 台 / units / thiet bi | 当前运行台数 / Devices currently on / So thiet bi dang bat | 规则统计字段，按运行点位状态聚合。 | 需统一设备纳入范围和运行状态判定阈值。 |
| `total_devices` | KPI | 设备总数 / Total Devices / Tong so thiet bi | 台 / units / thiet bi | 设备台账规模 / Asset inventory size / Quy mo danh muc thiet bi | 设备清单计数，不代表在线/运行状态。 | 仅在设备建模边界一致时可比较（含虚拟设备纳入规则）。 |
| `chiller_power_kw` | 趋势 | 冷机总功率 / Chiller Power / Tong cong suat chiller | kW / kW / kW | 冷机群功率 / Chiller group power / Cong suat cum chiller | 冷机群实时总功率。 | 比较前需统一冷机纳入范围和采样粒度。 |
| `chilled_pump_power_kw` | 趋势 | 冷冻泵总功率 / CHW Pump Power / Tong cong suat bom nuoc lanh | kW / kW / kW | 冷冻泵群功率 / CHW pump group power / Cong suat bom nuoc lanh | 冷冻泵群实时总功率。 | 跨站比较需统一泵组边界及变频泵纳入规则。 |
| `cooling_pump_power_kw` | 趋势 | 冷却泵总功率 / CW Pump Power / Tong cong suat bom giai nhiet | kW / kW / kW | 冷却泵群功率 / CW pump group power / Cong suat bom giai nhiet | 冷却泵群实时总功率。 | 需统一泵组建模边界与缺失处理规则。 |
| `cooling_tower_power_kw` | 趋势 | 冷却塔组合功率 / Cooling Tower Composite Power / Cong suat tong hop thap giai nhiet | kW / kW / kW | 塔侧组合口径 / Composite tower metric / Chi so tong hop thap | 当前按 CTF+CTE+CTHDE 组合聚合，不等同单一物理塔体功率。 | 仅在两站均采用相同组合建模规则时可比较。 |
| `trend_ts` | 趋势 | 趋势时间点 / Trend Timestamp / Moc thoi gian xu huong | - / - / - | 序列时间轴 / Series time axis / Truc thoi gian chuoi | 趋势点时间字段，非法时间点按口径丢弃。 | 跨站比较必须时区一致、边界对齐一致。 |
| `trend_value` | 趋势 | 趋势点值 / Trend Point Value / Gia tri diem xu huong | 随指标 / metric-based / theo chi so | 需绑定具体指标 / Bind with metric key / Can gan voi key chi so | 通用趋势值容器，脱离 metric key 单独展示会丢失语义。 | 仅在同一 metric key、同一聚合方式下可比较。 |
| `trend_min` | 趋势 | 趋势最小值 / Trend Minimum / Gia tri nho nhat xu huong | 随指标 / metric-based / theo chi so | 序列最小统计 / Series minimum stat / Thong ke min chuoi | 对趋势点过滤 null 后的最小值统计。 | 必须保证同窗口、同采样、同缺失过滤后再比较。 |
| `trend_max` | 趋势 | 趋势最大值 / Trend Maximum / Gia tri lon nhat xu huong | 随指标 / metric-based / theo chi so | 序列最大统计 / Series maximum stat / Thong ke max chuoi | 对趋势点过滤 null 后的最大值统计。 | 仅在同一 metric key 与同聚合口径下可比较。 |
| `alarm_critical_count` | 异常 | 紧急告警数 / Critical Alarm Count / So bao dong nghiem trong | 条 / items / muc | 最高风险告警 / Highest risk alarms / Bao dong muc cao nhat | 基于告警等级映射后的 critical 计数。 | 需统一 severity 映射规则及统计时间窗。 |
| `alarm_major_count` | 异常 | 严重告警数 / Major Alarm Count / So bao dong muc major | 条 / items / muc | 高风险告警 / High risk alarms / Bao dong rui ro cao | 基于告警等级映射后的 major 计数。 | 比较前需对齐等级映射和去重规则。 |
| `alarm_minor_count` | 异常 | 一般告警数 / Minor Alarm Count / So bao dong muc minor | 条 / items / muc | 中低风险告警 / Medium/low alarms / Bao dong trung thap | 基于告警等级映射后的 minor 计数。 | 需统一统计周期与告警分级映射后再比较。 |
| `latest_alarm_time` | 异常 | 最近告警时间 / Latest Alarm Time / Thoi gian bao dong moi nhat | - / - / - | 最近一次触发 / Most recent trigger / Lan kich hoat gan nhat | 最近一条告警的时间戳，缺失时返回 null。 | 比较需统一时区和时间格式；不用于能效高低结论。 |
| `anomaly_severity` | 异常 | 异常等级 / Anomaly Severity / Muc do bat thuong | - / - / - | critical/major/minor / critical/major/minor / critical/major/minor | 异常等级枚举，默认可降级为 minor。 | 仅在 severity 枚举与映射一致时可横向比较。 |
| `anomaly_state` | 异常 | 异常状态 / Anomaly State / Trang thai bat thuong | - / - / - | 0恢复 1进行中 / 0 closed, 1 active / 0 ket thuc, 1 dang mo | 原始状态码，0=恢复，1=进行中（沿用旧系统约定）。 | 跨站比较前需先映射到统一文本状态后再统计。 |
| `has_recent_alarms` | 异常 | 近期异常标记 / Recent Alarm Flag / Co bao dong gan day | - / - / - | 窗口内是否有告警 / Alarm exists in window / Co bao dong trong cua so | 按阈值窗口（如 24h）计算的布尔标记。 | 必须统一阈值窗口长度与时区后才可比较。 |
| `max_chilled_pump_freq_hz` | 规则诊断 | 冷冻泵最大频率(60m) / Max CHW Pump Freq (60m) / Tan so max bom nuoc lanh (60m) | Hz / Hz / Hz | 近60分最大频率 / 60m max frequency / Tan so lon nhat 60 phut | 规则引擎基础量，60 分钟窗口最大值；缺失按口径回填 0。 | 需统一窗口长度、采样频率和回填策略。 |
| `chiller_start_stop_count_60m` | 规则诊断 | 冷机启停次数(60m) / Chiller Start/Stop Count (60m) / So lan bat/tat chiller (60m) | 次 / times / lan | 近60分启停次数 / 60m start/stop count / So lan bat/tat 60 phut | 由 0/1 状态切换计数得出。 | 需统一状态判定阈值和计数窗口。 |
| `chilled_pump_start_stop_count_60m` | 规则诊断 | 冷冻泵启停次数(60m) / CHW Pump Start/Stop Count (60m) / So lan bat/tat bom nuoc lanh (60m) | 次 / times / lan | 泵组启停频度 / Pump switching frequency / Tan suat bat/tat bom | 冷冻泵 60 分钟窗口启停计数。 | 跨站比较需统一泵状态定义和窗口长度。 |
| `cooling_pump_start_stop_count_60m` | 规则诊断 | 冷却泵启停次数(60m) / CW Pump Start/Stop Count (60m) / So lan bat/tat bom giai nhiet (60m) | 次 / times / lan | 冷却泵启停频度 / CW pump switching / Tan suat bat/tat bom CW | 冷却泵 60 分钟窗口启停计数。 | 需统一窗口、阈值、缺失回填策略。 |
| `thermal_unbalance_rate_pct` | 规则诊断 | 热不平衡率 / Thermal Unbalance Rate / Ty le mat can bang nhiet | % / % / % | 系统负荷平衡度 / Load balance indicator / Chi so can bang tai | 分母<=0 返回 null；用于识别系统热力分配异常。 | 必须统一计算公式与有效点过滤规则。 |
| `alarm_data_stale` | 规则诊断 | 告警数据陈旧 / Alarm Data Stale / Du lieu bao dong cu | - / - / - | 告警源是否过期 / Alarm source freshness / Do tuoi nguon bao dong | 布尔可用性标记，true 表示告警数据超陈旧阈值。 | 仅在陈旧阈值定义一致时可横向比较。 |
| `work_order_linked` | 规则诊断 | 关联工单 / Work Order Linked / Da lien ket lenh cong viec | - / - / - | 异常是否挂单 / Has linked ticket / Da gan phieu xu ly | 可选来源字段，首期允许降级 false。 | 比较时需保证工单系统接入状态一致。 |
| `alarm_device_count` | 规则诊断 | 报警设备数 / Alarm Device Count / So thiet bi dang bao dong | 台 / units / thiet bi | 当前报警台数 / Devices in alarm / So thiet bi bao dong | 按设备告警状态聚合计数。 | 需统一设备筛选范围和告警判定标准。 |

## 3. 不可业务化直出字段与替代表达

| 字段 | 风险级别 | 不建议直出原因 | 前端替代表达建议 |
| --- | --- | --- | --- |
| `legacy.totalElectricity` | P0 | 名称易被理解为实时电量，实际语义为累计电能。 | 统一展示 `station_total_energy_kwh`，文案强制含“累计”。 |
| `cooling_tower_power_kw` | P0 | 组合口径（CTF+CTE+CTHDE），不等同单塔体功率。 | 展示“冷却塔组合功率”，并在 tooltip 补组合成员说明。 |
| `trend_value` | P1 | 通用容器字段，脱离 metric key 语义不完整。 | 只展示“指标名 + 值”，不单独命名业务指标。 |
| `trend_min` | P1 | 未绑定指标类型时无法判断单位与业务意义。 | 标题必须附具体指标名（例：冷站COP最小值）。 |
| `trend_max` | P1 | 未绑定指标类型时无法判断单位与业务意义。 | 标题必须附具体指标名（例：冷站COP最大值）。 |
| `anomaly_state` | P1 | 原始值为 0/1 状态码，直接显示可读性差。 | 映射后展示“已恢复/进行中”，禁显数字码。 |
| `alarm_data_stale` | P1 | 属于数据可用性状态，不代表业务风险强度。 | 作为“数据新鲜度”徽标展示，不与告警数混排。 |

## 4. 前端接入建议

- 折叠卡片：`displayName.zh` + 当前值 + `shortHint.zh`。
- 多语言切换：同一 `fieldKey` 下仅替换 `displayName/unitDisplay/shortHint`，不改变数值和口径。
- 跨站点横向比较：先校验 `compareConstraint`，未满足时只展示“不可直接比较”提示，不输出优劣结论。
