# 运行态已打通 / 字段仍有缺口 值班卡 v1

用途：提醒值班同学区分两件事:  
- 运行链路已通  
- 数据仍非全绿

这张卡只定义读法，不改任何脚本逻辑，也不替代底层门禁明细。

## 先看什么

1. 页面是否正常打开，且 `Source Banner` 可见  
2. 顶部是否仍能读到运行态来源信息，而不是整页白屏  
3. KPI / 趋势 / 规则诊断里是否出现缺字段导致的占位、跳过或不完整数据

## 当前值班结论

### 1) 运行链路已通

判定信号：
- 页面可正常渲染
- `Source Banner` 有来源摘要
- 不是整页不可达，也不是纯服务挂起态

值班解释：
- 这代表运行链路已经打通，前端和上游不是完全断开。

### 2) 数据非全绿

判定信号：
- 部分 KPI 仍为占位值或缺省值
- `Rule Skip Diagnostics` 出现字段缺失/无效提示
- 趋势或推荐区存在部分数据不完整

值班解释：
- 这不是“服务挂了”，而是“字段仍有缺口”。
- 当前不能把页面可打开直接等同于“数据全绿”。

## 字段缺口示例

- `chilled_delta_t_c`
- `cooling_delta_t_c`
- `station_cop`

这些字段一旦缺失，常见表现包括：
- 规则被跳过
- KPI 无法完整计算
- 趋势或推荐信息降级

## 第一动作

固定动作：
- 先排字段，不要误判成服务挂了。

回退顺序：
1. 先看 `Rule Skip Diagnostics` 或来源摘要里是否提示缺字段
2. 再核对字段名是否属于数据缺口，而不是接口整体不可达
3. 字段补齐后再重看页面，不要直接升级为服务故障

## 一句话播报模板

- 中文：`运行链路已通，但数据未全绿；先排字段缺口，不按服务挂起处理。`
- English: `Runtime is live, but data is not fully green; check field gaps first, do not treat it as service down.`
- Tiếng Việt: `Luong runtime da thong, nhung du lieu chua xanh hoan toan; uu tien kiem tra truong thieu, khong quy thanh sap dich vu.`

## 图示说明

- 绿色框：运行链路已通
- 黄色提示：当前并非全绿
- 红色框：字段缺口样例与缺口区域
- 蓝色提示：第一动作

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-runtime-live-partial-v1-vi-system-overview.png`

## 值班可用性

是否可直接值班群使用：`yes`
