# v1.4 量化阈值可视化复验（v1.5）

复验目标：
- 仅看真实链路量化阈值，不评审降级文案“好看程度”。
- 页面：`/dashboard`、`/system-overview`
- 指标：`M1 degraded endpoints`、`M2 stale flag`、`M3 series non-empty rate`

---

## 1) 顶部“验收角标规范”评审建议（文档建议，不改代码）

建议在两页顶部统一使用“验收角标（review badge）”规范：

1. 位置规范
- 固定在页面右上安全区（距右 `12-16px`，距上 `12-16px`），不遮挡主导航与主操作。

2. 信息结构
- 第一行：`版本 + 页面名`（例：`v1.5 Threshold Review · dashboard`）。
- 第二行：`指标编号 + 指标名`（M1/M2/M3）。
- 第三行：`Current` 当前值。
- 第四行：`Threshold` 阈值。
- 第五行：`PASS/FAIL` 结果。

3. 判定表达
- 只允许二元结果：`PASS` / `FAIL`。
- 禁止在角标中加入解释性段落，解释应留在评审文档。

4. 视觉一致性
- 两页角标尺寸、排版、对齐方式一致。
- PASS/FAIL 仅作为状态色提示，不改变原页面 token 体系。

---

## 2) 当前值 vs 阈值 vs 结论

数据基线：`/tmp/chiller_probe_v15.json`

### Dashboard

| 指标 | 当前值 | 阈值 | 结论 |
| --- | --- | --- | --- |
| M1 Degraded Endpoints | `4/4` | `<= 0/4` | `FAIL` |
| M2 Stale Flag | `1` | `== 0` | `FAIL` |
| M3 Series Non-Empty Rate | `0/3 (0.0%)` | `>= 80.0% 且 non_empty>=2` | `FAIL` |

失败归因：
- M1：`上游接口`
- M2：`上游接口`
- M3：`上游接口`

### SystemOverview

| 指标 | 当前值 | 阈值 | 结论 |
| --- | --- | --- | --- |
| M1 Degraded Endpoints | `1/1` | `<= 0/1` | `FAIL` |
| M2 Stale Flag（链路代理） | `1` | `== 0` | `FAIL` |
| M3 Series Non-Empty Rate（链路代理） | `0/3 (0.0%)` | `>= 80.0%` | `FAIL` |

失败归因：
- M1：`上游接口`
- M2：`上游接口`
- M3：`上游接口`

---

## 3) 复拍截图（6张）

Dashboard：
- `docs/screenshots/real-v15-dashboard-metric-M1.png`
- `docs/screenshots/real-v15-dashboard-metric-M2.png`
- `docs/screenshots/real-v15-dashboard-metric-M3.png`

SystemOverview：
- `docs/screenshots/real-v15-system-overview-metric-M1.png`
- `docs/screenshots/real-v15-system-overview-metric-M2.png`
- `docs/screenshots/real-v15-system-overview-metric-M3.png`

---

## 4) 总结（PASS/FAIL）

- 页面级结论：`Dashboard = FAIL`，`SystemOverview = FAIL`
- 总结论：`FAIL`
- 失败主因分类：`上游接口`（非前端呈现）

说明：
- 本轮未发现“阈值失败由前端呈现导致”的证据；失败由上游链路返回状态（failed/partial、stale、空序列）直接触发。
