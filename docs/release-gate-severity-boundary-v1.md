# Release Gate Severity Boundary (v1) - Compatibility Stub

该文档名保留用于兼容任务单引用。

当前边界口径请以以下文档为准：
- `/Users/billchow/Documents/智慧冷冻站/docs/release-gate-reasons-mapping-v1.md`
- `/Users/billchow/Documents/智慧冷冻站/docs/release-strategy-default-vs-strict-v1.md`

快速边界：
- `reasons`：阻断信号，参与 `decision` 计算（尤其 strict 模式）。
- `advisories`：非阻断信号，不直接改变 `decision`。

兼容原则：
- reason/advisory key 只增不减，不删除既有 key。
