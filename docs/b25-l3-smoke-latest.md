# B25 L3 Smoke 验收清单（最新）

- 验收时间（UTC）：2026-04-01T20:52:15.829Z
- 验收时间（Asia/Shanghai）：2026-04-02 04:52:15
- 站点：`btwentyfive`
- 环境：`BFF http://127.0.0.1:8787`、`APP http://127.0.0.1:3006`

## Checklist

- [x] `dashboard/overview` 可返回 `200`，并存在可用核心数值（非全空）
- [x] `POST /bff/v1/sites/btwentyfive/optimize` 仍返回 `501 NOT_IMPLEMENTED`
- [x] `optimize.details.schemes.length === 3`
- [x] Dashboard 页面可正常渲染“值班判断板 / 效率表现”
- [x] Dashboard 卡片值非全 `--`
- [x] Dashboard 固定展示“首页数据来源（实时/快照+时间）”可观测字段
- [x] Optimize Demo 页面可提交成功，且渲染 3 个方案卡
- [x] Optimize Demo 可见“历史对标 / 草案收益 / 草案边界提示”
- [x] 本轮 B25 空白卡修复（runtime key 优先）已生效

## 关键观测

- API 观测：`currentCop=0`、`totalPowerKw=0.3`、`sourceOverall=ok`
- UI 抽样值：`7.90 / 9.75 / 65.41 / 165.85 / 151.33 / 7430.1kW / 969.4kW / 3.2/4.6°C`
- Optimize Demo：`schemeCardCount=3`、`readinessCount=3`

## 结论

- 当前 B25 链路已达到“可发布（治理态草案）”标准：
- Dashboard 不再出现全局 `--` 空白态；
- Optimize Demo 保持 `501 + context-backed draft` 边界并可完整评审三方案。
- 残余风险可控：实时来源短时抖动时将触发“最近可用快照回退”，不会导致首页整体失明。
