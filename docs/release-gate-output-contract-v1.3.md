# Release Gate Output Contract (v1.3) - Compatibility Stub

该文档名保留用于兼容任务单引用。

当前可执行契约来源：
- `/Users/billchow/Documents/智慧冷冻站/docs/release-gate-output-contract-v1.2.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/preflight-release-gate-contract-v1.md`

当前输出要点（来自脚本实际行为）：
- `decision` / `exitCode`
- `reasons[]`（阻断）
- `advisories[]`（非阻断）
- `freshness` / `strictFreshness`

兼容性规则：
- 字段与 key 采用“只增不减”策略，保持旧消费者可持续读取。
