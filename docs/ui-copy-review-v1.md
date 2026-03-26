# V1 中文文案统一验收（视觉与可读性）

评审范围：`/login`、`/dashboard`、`/system-overview`（含趋势区、规则诊断区、推荐卡片）  
评审方式：代码文案审阅 + 页面截图取证（桌面 + 820px）  
结论状态：**部分通过（存在需统一项）**

---

## A. 通过项（按页面）

### 1) 登录页 `/login`
- 主要标题、副标题、输入标签、按钮文案均已中文化，视觉层级清晰。
- 操作路径明确：`登录系统` 为单一主操作按钮，语气中性。
- 认证说明文案具备上下文，不影响主操作识别。

截图：  
[copy-review-login.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-login.png)

### 2) 驾驶舱 `/dashboard`
- 核心模块标题已中文化且语义稳定：`实时系统状态`、`负荷与功率趋势`、`AI 优化建议`、`规则跳过诊断`。
- 趋势空数据分支已显示范围文案（满足本轮回归重点）：`范围 24H/7D`。
- 数值单位在 KPI 卡片中紧邻主数值显示，`kW/kWh/%/项`整体可读。
- BFF 缩写保留合理，且在提示语中有上下文（数据来源/降级）。

截图：  
[copy-review-dashboard-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-desktop.png)

### 3) 系统总览 `/system-overview`
- 页面标题、拓扑区、节点详情区已中文化，结构与驾驶舱风格一致。
- 规则诊断区组件复用一致，视觉语言统一。
- 关键单位展示稳定：`kW`、`℃`、`台`。

截图：  
[copy-review-system-overview-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-system-overview-desktop.png)

### 4) 移动端 820px
- 主要模块未出现明显遮挡或断层；卡片流转与信息层级保持。
- 规则诊断区在窄屏下仍可读，未见整块溢出白屏。

截图：  
[copy-review-dashboard-mobile-820.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-mobile-820.png)

---

## B. 问题项（严重/一般）

### 严重

1. **规则跳过原因直接暴露英文码值，用户不可读**
- 表现：`MISSING-METRIC`、`missing_metrics` 直接显示在规则诊断项中。
- 影响范围：`/dashboard`、`/system-overview`、820px 移动端。
- 位置标注：
  - [copy-review-dashboard-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-desktop.png)（规则诊断区每条规则右上角标签）
  - [copy-review-system-overview-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-system-overview-desktop.png)（规则诊断区每条规则右上角标签）

2. **诊断详情包含后端英文技术错误串，语义不面向业务用户**
- 表现：如 `upstream_unreachable: Legacy request error: TypeError: fetch failed`。
- 影响范围：两页规则诊断区，尤其 820px 下信息噪声显著。
- 位置标注：
  - [copy-review-dashboard-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-desktop.png)（规则诊断区指标说明文本）
  - [copy-review-dashboard-mobile-820.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-mobile-820.png)（规则诊断区中下部明细行）

### 一般

1. **趋势区按钮与范围文案格式不完全一致**
- 表现：按钮使用 `近24小时/近7天`，图内使用 `范围 24H/7D`。
- 影响范围：`/dashboard` 趋势区一致性。
- 位置标注：
  - [copy-review-dashboard-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-desktop.png)（趋势区右上按钮 + 趋势区正文首行）

2. **单位写法存在局部格式不一致**
- 表现：`3Hz` 建议写为 `3 Hz`（数值与单位间保留空格）。
- 影响范围：`/system-overview` 节点详情区。
- 位置标注：
  - [copy-review-system-overview-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-system-overview-desktop.png)（当前节点详情 -> 建议动作）

3. **同义词并存可能造成口径抖动**
- 表现：同一页面内出现 `异常` 与 `告警` 并行（如“异常优先级看板”+“告警流”）。
- 影响范围：`/dashboard` 可读性与术语稳定性。
- 建议：统一主术语为“告警”（或“异常”二选一），另一词仅作为解释性附文。

4. **降级提示中端点名英文暴露**
- 表现：`recommendations 端点不可用。`
- 影响范围：推荐诊断降级态。
- 建议：中文主文案 + 英文端点名括注。

---

## C. 建议改文案（原文 -> 建议文案 -> 原因）

| 原文 | 建议文案 | 原因 |
|---|---|---|
| `recommendations 端点不可用。` | `建议端点不可用（recommendations）。` | 中文主语优先，英文保留为技术定位。 |
| `BFF 不可用（recommendations）` | `BFF 不可用（建议）。` | 降低英文噪声，保留业务可读性。 |
| `MISSING-METRIC` / `missing_metrics` | `指标缺失` | 用户可理解的业务语义。 |
| `upstream_unreachable: ... fetch failed` | `上游服务不可达，请检查数据链路。` | 避免把技术栈错误直接暴露给业务用户。 |
| `规则引擎不可用：{error}` | `规则引擎不可用（{error}）。当前展示降级信息。` | 满足“原因 + 当前状态”。 |
| `范围 24H` / `范围 7D` | `范围：近24小时` / `范围：近7天` | 与按钮文案风格一致，减少双口径。 |
| `总站功率` | `全站功率` | 术语更自然，避免“总站”歧义。 |
| `当前异常数` + `告警流` | 统一为 `当前告警数` + `告警流` | 页面内术语统一，减少认知切换。 |
| `建议动作`（详情区） | `建议操作` | 与“查看建议”形成操作语气统一。 |
| `风机频率上调 3Hz` | `风机频率上调 3 Hz` | 数值与单位排版一致。 |
| `BFF 未返回趋势序列。` | `BFF 未返回趋势数据。当前展示降级状态。` | 加入当前状态说明，满足降级提示规范。 |
| `没有跳过规则，所有启用规则均已评估。` | `未发现跳过规则，所有启用规则已完成评估。` | 语句更简洁、执行感更强。 |

---

## D. 最终术语表（建议版，24 条）

| 术语场景 | 标准写法 | 备注 |
|---|---|---|
| 数据聚合服务 | BFF | 保留英文缩写。 |
| BFF 不可达 | BFF 不可用 | 用于网络/服务不可达。 |
| 规则执行结果 | 规则评估 | 总称。 |
| 规则未执行 | 规则跳过 | 与“规则评估”配套。 |
| 跳过原因（缺数据） | 指标缺失 | 面向业务用户。 |
| 跳过原因（服务问题） | 上游不可达 | 面向业务用户。 |
| 字段问题 | 字段缺失/无效 | 明确数据质量问题。 |
| 趋势模块 | 负荷与功率趋势 | 页面标题固定。 |
| 趋势范围按钮 | 近24小时 / 近7天 / 近30天 | 优先中文相对时间。 |
| 趋势范围正文 | 范围：近24小时（等） | 与按钮同口径。 |
| 降级状态 | 降级模式 | 用于全局/模块提示。 |
| 降级说明模板 | 原因 + 当前状态 | 例如“端点不可用，当前展示降级信息”。 |
| 告警总数 | 当前告警数 | 建议统一“告警”。 |
| 告警来源 | 告警流 | 与“异常”二选一统一。 |
| 优化建议模块 | AI 优化建议 | 可保留 AI。 |
| 建议操作按钮 | 查看建议 | 操作文案统一。 |
| 风险等级 | 高 / 中 / 低 / 未知 | 不混用 High/Medium/Low。 |
| 设备状态 | 运行中 / 稳定 / 告警 | 三态统一。 |
| 功率单位 | kW | 与数值紧邻。 |
| 电量单位 | kWh | 与数值紧邻。 |
| 温度单位 | ℃ | 与数值紧邻。 |
| 比率单位 | % | 与数值紧邻。 |
| 数量单位 | 项 / 台 | 场景化使用。 |
| 频率单位 | Hz（如 3 Hz） | 数值与单位空格分隔。 |

---

### 附：问题截图清单（最多 6 张）
- [copy-review-dashboard-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-desktop.png)
- [copy-review-system-overview-desktop.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-system-overview-desktop.png)
- [copy-review-dashboard-mobile-820.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-mobile-820.png)
- [copy-review-login.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-login.png)
- [copy-review-dashboard-custom-site.png](/Users/billchow/Documents/智慧冷冻站/docs/screenshots/copy-review-dashboard-custom-site.png)
