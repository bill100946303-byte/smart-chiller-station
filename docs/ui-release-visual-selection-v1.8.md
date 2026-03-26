# V1.8 发布视图选型建议（运行态受限标识）

目标对齐：
- 在不改业务逻辑前提下，为 PASS 金样补充“运行态受限环境”说明图。
- 确保三语提示语义是“环境限制”，不是“系统回退”。
- 给出对外发布与内部排障的截图选型边界。

## 1) 验收依据

- `docs/ui-consistency-review-v1.8.md`：PASS 金样已完成。
- `docs/v1.8-release-checklist.md`：允许受限环境使用运行态可选模式（`RUNTIME_REQUIRED=0`）。
- `docs/v1.8-release-preflight.json`：`runtimeRequired=false`、`preflightPass=true`，符合“受限环境说明”场景。

## 2) 三语文案验收（受限标识）

结论：**通过**

文案（叠加在截图右下角，避免遮挡主信息层）：
- zh-CN：
  - `运行态受限环境（截图）`
  - `仅用于发布说明，不代表系统回退`
- en-US：
  - `Runtime-limited environment (capture)`
  - `For release notes only, not system fallback`
- vi-VN：
  - `Môi trường chạy bị giới hạn (ảnh chụp)`
  - `Chỉ dùng mô tả phát hành, không phải fallback hệ thống`

评估：
- 三语均明确“环境限制”归因，不指向系统降级或业务回退。
- 文案长度在当前版式下可读，无断句误导。

## 3) 截图选型建议

### 对外发布（客户/管理层材料）
- 使用：`ui-v18-pass-*.png`（纯净 PASS 金样）
- 不使用：带“运行态受限”说明或网络证据面板的截图
- 原因：对外材料应聚焦产品能力与稳定态表现，避免引入环境噪音

### 内部排障/发布记录
- 使用：`ui-v18-release-selection-*.png`（本次新增）
- 可联合：`ui-v18-badge-consistency-*.png`（请求 URL 证据）
- 原因：保留运行环境约束信息，便于复现与审计

## 4) 本次产物（6 张）

- `docs/screenshots/ui-v18-release-selection-zh-dashboard-runtime-limited.png`
- `docs/screenshots/ui-v18-release-selection-zh-system-overview-runtime-limited.png`
- `docs/screenshots/ui-v18-release-selection-en-dashboard-runtime-limited.png`
- `docs/screenshots/ui-v18-release-selection-en-system-overview-runtime-limited.png`
- `docs/screenshots/ui-v18-release-selection-vi-dashboard-runtime-limited.png`
- `docs/screenshots/ui-v18-release-selection-vi-system-overview-runtime-limited.png`

## 5) 结论

**PASS**：运行态受限标识方案可用，不影响主页面信息层，且三语语义不误导。发布时建议外部与内部截图分轨使用。
