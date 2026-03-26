# Sprint1 `anomalies/list` 合同收口 closeout v1

## 1. 结论

当前判断：

- 当前实现与主合同是否一致：`Yes`
- 当前 example 是否可作为正式 example：`Yes`
- 是否还缺 `check-contract` 级别专门断言：`Yes`
- `anomalies/list` 是否正式纳管完成：`No`

本次 closeout 的核心结论不是“接口还不稳定”，而是：

- 合同本身已经基本稳定
- OpenAPI 与 example 也已经具备正式保留条件
- 但主门禁尚未把它纳入长期回归保护，因此“正式纳管完成”还差最后一步

## 2. 当前实现与主合同是否一致

判断：`Yes`

依据如下：

### 2.1 Path 与 query 已对齐

`bff-v1.yaml` 已存在：

- `GET /bff/v1/sites/{siteId}/anomalies/list`

当前主合同中的 query 参数为：

- `page`
- `pageSize`
- `severity`
- `state`

这与当前实现一致。

### 2.2 Severity 已对齐最终口径

当前主合同与实现都使用最终 severity 枚举：

- `critical`
- `major`
- `minor`
- `normal`

说明：

- v1.1 的 `high|medium|low` 漂移已经被修正
- 这条接口的 severity 口径已可长期冻结

### 2.3 Response 主结构已对齐

当前 `AnomaliesListResponse` 已覆盖：

- `site`
- `generatedAt`
- `items`
- `page`
- `pageSize`
- `total`
- `filters`
- `freshness`
- `sourceStatus`

`AnomalyEvent` 也已覆盖：

- `id`
- `title`
- `severity`
- `state`
- `occurredAt`
- `source`
- `regId`
- `value`

这与当前服务层输出一致。

## 3. 当前 example 是否可作为正式 example

判断：`Yes`

当前 `openapi/examples/anomalies-list.json` 已满足正式 example 的基本要求：

- 使用最终 severity 四档口径
- 包含 `generatedAt`
- 包含分页字段：`page/pageSize/total`
- 包含 `filters`
- 包含 `freshness`
- 包含 `sourceStatus`
- `sourceStatus.sources[0].key` 为 `latestAlarmLog`

与主合同对照后，没有发现会阻止其作为正式 example 的结构性缺口。

需要说明的两点：

1. 该 example 当前是“可正式使用”的，不是临时占位样例。
2. 它仍然更偏“成功态 + 有数据”样例；如果后续希望增强覆盖，可以再补一个：
   - `state=null`
   - `sourceStatus.overall=failed|partial`
   但这不影响它已经具备正式 example 资格。

## 4. 是否还缺 `check-contract` 级别专门断言

判断：`Yes`

原因不是 schema 不完整，而是当前主门禁还没有真正纳管这条接口。

### 4.1 现状

当前 `scripts/check-contract.js` 的 `CONTRACT_PATHS` 仍只覆盖：

- `dashboard/overview`
- `dashboard/trends`
- `anomalies/summary`
- `system/topology`
- `recommendations`

其中不包含：

- `anomalies/list`

这意味着：

- 即使 `bff-v1.yaml` 里已经有 `anomalies/list`
- 即使 `anomalies-list.json` 已存在
- 现有 `npm run check:contract` 仍不会对这条接口做 example/schema 一致性校验

### 4.2 建议补的最小门禁

至少应补两层：

1. 主合同纳管：
   - 把 `/bff/v1/sites/{siteId}/anomalies/list` 加入 `CONTRACT_PATHS`
2. 列表专项断言：
   - `items[*].severity` 只能是 `critical|major|minor|normal`
   - `sourceStatus.sources[*].key` 至少覆盖 `latestAlarmLog`
   - `generatedAt` 必存在

是否一定要做很重的专项脚本：`No`

但至少要让现有 `check:contract` 真正覆盖这条 path，否则“主合同正式部分”还缺长期回归保护。

## 5. 最终拍板

拍板结论：

- `anomalies/list` 现在已经可以视为“主合同候选正式部分”，可以长期保留
- 但从纳管流程角度看，当前还不能算“正式纳管完成”

最终 yes/no：

- `anomalies/list` 是否正式纳管完成：`No`

收口条件只差一项：

- 把它纳入 `check-contract` 主门禁，并补上最小列表专项断言

完成这一步后，这条接口就可以从“合同已具备”升级为“正式纳管完成”。
