# SourceStatus 中文状态条视觉验收（Dashboard + SystemOverview）

评审范围：`/dashboard`、`/system-overview`  
评审目标：验证数据源状态中文化后的语义一致性、视觉层级、响应式与异常态覆盖  
评审方式：真实页面截图验收（桌面 + 移动端）  
结论：**不通过（需修复 1 项严重问题后复验）**

---

## 截图取证（6 张）

1. `docs/screenshots/source-status-desktop-01-ok-dashboard.png`（桌面：正常）
2. `docs/screenshots/source-status-desktop-02-partial-dashboard.png`（桌面：部分失败）
3. `docs/screenshots/source-status-desktop-03-partial-system-overview.png`（桌面：系统总览）
4. `docs/screenshots/source-status-mobile-01-900-partial-dashboard.png`（900px：部分失败）
5. `docs/screenshots/source-status-mobile-02-820-allfail-dashboard.png`（820px：全部失败）
6. `docs/screenshots/source-status-mobile-03-768-allfail-system-overview.png`（768px：系统总览）

---

## 通过项

- `Dashboard` 顶部状态条已以中文短句为主文案（如“降级模式：总览、趋势不可用”），明细信息为次级展示。
- 规则诊断区两页风格一致，`ruleId / reason / metric / category / message` 信息层级稳定，未出现视觉抢占。
- 建议卡片风险标签已中文化（如“风险高风险中”），与卡片主体层级分离清晰。
- 900px / 820px / 768px 三档下未观察到水平滚动，诊断区无明显溢出或遮挡。
- 异常态覆盖完整：已观测到上游不可达、上游 5xx、字段缺失、unknown 兜底四类状态文案。

---

## 问题项

### 严重问题 1：SystemOverview 缺少顶部 Source Banner（跨页口径不一致）

现象：  
`/system-overview` 页面未显示顶部数据源状态条，仅有规则诊断区内的来源摘要。`/dashboard` 与 `/system-overview` 在首屏状态传达路径不一致。

影响：  
用户在系统总览页首屏无法快速判断“当前是正常/部分失败/全部失败”，需要下滚到诊断区才可获取状态，增加误判风险。

建议文案/样式：  
复用 `Dashboard` 现有 source banner 组件与 token，放置在 `system-overview` 页标题下方同层级位置；保持“主状态（中文短句）+ 来源摘要（次级行）”结构，不新增色值。

---

### 一般问题 1：失败来源摘要直接使用英文源 ID，可读性一般

现象：  
来源摘要中出现 `alarm-feed / cache / legacy` 等源 ID，技术可定位但业务阅读门槛偏高。

影响：  
非技术值班角色在故障场景下理解成本偏高，需二次映射“源 ID -> 业务来源”。

建议文案/样式：  
主展示采用中文别名（如“告警流/缓存/历史库”），英文 ID 置于括号次级信息（如“告警流（alarm-feed）”）；保持当前 warn/good token，不改色板。

---

### 一般问题 2：全部失败态下来源摘要层次可再强化

现象：  
`/dashboard` 820px 全部失败截图中，顶部状态条视觉上更接近单行主提示，来源摘要辨识度偏弱。

影响：  
“原因”与“受影响来源”分层不够稳定，小屏下排障路径不够直接。

建议文案/样式：  
保持两行固定结构：第一行仅主状态，第二行固定“来源摘要：...”；仅调整行距与字重（在现有 token 体系内），避免新增样式变量。

---

## 检查清单结论

1. 语义一致性：**部分通过**（Dashboard 合格；SystemOverview 缺顶部状态条）  
2. 视觉层级：**基本通过**（主次层级可识别，失败来源多时换行可接受）  
3. 响应式：**通过**（900/820/768 无横向滚动与明显断字异常）  
4. 异常态覆盖：**通过**（上游不可达/5xx/字段缺失/unknown 均有可见输出）

---

## 复验建议

- 先处理“SystemOverview 复用顶部 Source Banner”后再复验一次两页一致性。  
- 复验保留本次 6 张截图口径，新增 2 张对比图（修复前/修复后）即可闭环。
