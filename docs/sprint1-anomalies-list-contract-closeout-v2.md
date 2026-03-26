# Sprint1 `anomalies/list` 合同收口 closeout v2

## 1. 结论

基于当前最新主控代码与主合同状态，结论如下：

- 当前实现与主合同是否一致：`Yes`
- 当前 example 是否可正式保留：`Yes`
- 是否仍需要专门 `check-contract` 断言：`Yes`
- 是否正式纳管完成：`No`

本次 v2 的判断相比 v1 没有反转，原因也已经收敛为单一结论：

- `anomalies/list` 的 OpenAPI 与 example 已经具备长期保留条件
- 但它还没有进入当前 `check:contract` 的正式回归门禁

## 2. 当前实现与主合同是否一致

判断：`Yes`

依据：

- `bff-v1.yaml` 已存在 `GET /bff/v1/sites/{siteId}/anomalies/list`
- query 参数已冻结为：
  - `page`
  - `pageSize`
  - `severity`
  - `state`
- `AnomaliesListResponse` 已覆盖：
  - `site`
  - `generatedAt`
  - `items`
  - `page`
  - `pageSize`
  - `total`
  - `filters`
  - `freshness`
  - `sourceStatus`
- `AnomalyEvent` 已覆盖：
  - `id`
  - `title`
  - `severity`
  - `state`
  - `occurredAt`
  - `source`
  - `regId`
  - `value`
- `severity` 已统一为最终口径：
  - `critical`
  - `major`
  - `minor`
  - `normal`

结论：

- 运行时实现与主合同结构已对齐
- 当前不存在需要继续回退到 `high|medium|low` 的理由

## 3. 当前 example 是否可正式保留

判断：`Yes`

`openapi/examples/anomalies-list.json` 当前已经满足正式 example 的条件：

- 使用最终 severity 四档枚举
- 包含 `generatedAt`
- 包含分页字段：`page/pageSize/total`
- 包含 `filters`
- 包含 `freshness`
- 包含 `sourceStatus`
- `sourceStatus.sources[0].key` 为 `latestAlarmLog`

与 `anomalies-summary.json` 的当前口径也不存在冲突：

- summary 与 list 均已使用 `critical|major|minor|normal`
- `AnomalyEvent` 的共享字段没有再出现旧枚举漂移

因此：

- `anomalies-list.json` 可以作为正式 example 长期保留
- 当前不需要因为 example 结构问题而阻止纳管

## 4. 是否仍需要专门 `check-contract` 断言

判断：`Yes`

原因：

- 当前 `scripts/check-contract.js` 的 `CONTRACT_PATHS` 仍未包含 `/bff/v1/sites/{siteId}/anomalies/list`
- 这意味着现有 `npm run check:contract` 还不会对该 path 的 schema/example 做正式回归校验

因此，当前仍需要一条专门的合同门禁动作：

- 让 `check-contract` 正式覆盖 `anomalies/list`

这里的“专门断言”不要求再起一个重型独立脚本，但至少要满足：

- `anomalies/list` 被纳入现有 `CONTRACT_PATHS`
- 它的 example 会在 `check:contract` 中被校验
- 关键字段不会脱离主门禁保护

## 5. 是否正式纳管完成

判断：`No`

原因不再分散，当前只保留 1 个剩余事项：

### 唯一剩余事项

- 将 `/bff/v1/sites/{siteId}/anomalies/list` 正式纳入 `scripts/check-contract.js` 的主门禁覆盖范围

收口说明：

- 一旦这 1 条完成，`anomalies/list` 就可以正式宣布“纳管完成”
- 在此之前，它更准确的状态是：
  - 主合同已就位
  - 正式 example 已就位
  - 但回归门禁尚未闭环
