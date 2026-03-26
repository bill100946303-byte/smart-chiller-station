# Sprint2 设备页合同收口 closeout v1

- 当前实现与最终 contract 是否一致：`No`
- 是否还需要新增 `check-contract` 专门断言：`Yes`
- 是否还有剩余事项：`Yes`

唯一剩余事项：

- 统一 `devices/tree` / `devices/{deviceId}` 的失败态合同并纳入主门禁：当前 `devices/tree` 在上游失败时返回 `tree: null`，与主合同要求的非空 `tree` 不一致；需要先把失败态收口为稳定 contract，再用 `check-contract` 锁住该失败路径
