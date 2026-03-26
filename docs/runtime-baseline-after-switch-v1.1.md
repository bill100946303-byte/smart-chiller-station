# Runtime Baseline After Switch v1.1

## 1. 目标与边界
- 目标：固化“入口切换完成后”的统一运行基线，作为联调与发布后巡检判定依据。
- 边界：仅定义运行时入口与签收依据，不修改业务字段定义、单位、`null_strategy` 与规则口径。

## 2. 端口基线（切换后）
| 层级 | 服务 | 端口 | 基线入口 |
| --- | --- | ---: | --- |
| Frontend | new shell | 3001 | `http://127.0.0.1:3001/` |
| BFF | chiller-bff | 8787 | `http://127.0.0.1:8787/` |
| Legacy | legacy backend | 8098 | `http://127.0.0.1:8098/` |
| 2D/3D | 2D/3D 场景服务 | 4000 | `http://127.0.0.1:4000/` |

## 3. 当前入口（签收口径）
- 当前前端入口：`new shell`（3001）。
- 数据聚合入口：`chiller-bff`（8787）。
- 依赖上游入口：`legacy`（8098）与 `2D/3D`（4000）。

## 4. 签收字段来源（文档级）
- 字段语义与展示层：`docs/field-display-dictionary-v1.json`。
- 可用性与错误分类：`docs/metric-availability-v1.md`、`docs/metric-availability-field-mapping-v1.md`。
- 放行清单与运行证据：`docs/non-degraded-readiness-checklist-v1.3.csv`、`docs/readiness-baseline-freeze-v1.8.md`。

## 5. 独立判定维度
明确以下两个维度相互独立，必须分别验收：
- 维度 A：入口成功（runtime switch success）。
- 维度 B：非降级通过（non-degraded readiness pass）。

### 5.1 判定规则（v1.1）
1. 入口成功：
`new shell` 3001 可访问，且 BFF 8787 可返回站点页面主数据；否则判定“入口未成功”。
2. 非降级通过：
以 `non-degraded-readiness-checklist-v1.3.csv` 为准，P0 必选项通过且无 blocking；否则判定“非降级未通过”。
3. 组合结论：
仅当规则 1 与规则 2 同时满足，才可标记“切换完成且可放行”；任一不满足均不得用另一维度替代。
