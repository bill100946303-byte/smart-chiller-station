# Sprint1 `devices/list` 合同收口 closeout v1

- 当前实现与最终 contract 是否一致：`No`
- 是否还需要新增 `check-contract` 专门断言：`Yes`
- 是否还有剩余事项：`Yes`

唯一剩余事项：

- 按已拍板的 Sprint1 最终口径完成 `devices/list` 收口并纳入主门禁：补齐 `deviceRuntime` 可降级增强来源、让 `freshness` 对齐运行态增强语义、把 `usageType` 收到最终口径，并将 `/bff/v1/sites/{siteId}/devices/list` 加入 `check-contract` 覆盖范围
