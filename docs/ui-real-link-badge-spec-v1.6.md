# 真实链路验收角标规范（v1.6）

适用范围：
- 页面：`/dashboard`、`/system-overview`
- 场景：真实链路量化验收结果展示
- 目标：统一“顶部验收角标”文案，不改代码实现，仅用于评审与后续落地对齐

## 1. 角标语义范围

角标仅表达“非降级态”是否达标：
- `通过`：满足 v1.4 阈值
- `未通过`：任一阈值未满足

## 2. 顶部角标文案规范（三语，各 2 套）

### zh-CN
- 套 A
- 通过：`非降级态：通过`
- 未通过：`非降级态：未通过`
- 套 B
- 通过：`真实链路：通过`
- 未通过：`真实链路：未通过`

### en-US
- 套 A
- 通过：`Non-Degraded: PASS`
- 未通过：`Non-Degraded: NOT PASS`
- 套 B
- 通过：`Real Link: PASS`
- 未通过：`Real Link: NOT PASS`

### vi-VN
- 套 A
- 通过：`Phi suy giảm: Đạt`
- 未通过：`Phi suy giảm: Chưa đạt`
- 套 B
- 通过：`Liên kết thực: Đạt`
- 未通过：`Liên kết thực: Chưa đạt`

## 3. 样例图（复用现有截图，不重拍）

- `docs/screenshots/real-v15-dashboard-metric-M1.png`
- `docs/screenshots/real-v15-dashboard-metric-M3.png`
- `docs/screenshots/real-v15-system-overview-metric-M1.png`
- `docs/screenshots/real-v15-system-overview-metric-M3.png`

## 4. 单行约束声明

**角标结论只读后端判定结果，不允许前端自行推断。**
