# Source Banner 折叠交互验收（V1）

评审范围：`/dashboard`、`/system-overview`（`source banner` 的 `summary + detail + toggle`）  
评审方式：真实链路截图 + 交互/响应式实测  
结论：**不通过**

---

## 一、截图取证（主验收 8 张）

1. `docs/screenshots/source-banner-collapsible-dashboard-desktop-collapsed.png`
2. `docs/screenshots/source-banner-collapsible-dashboard-desktop-expanded.png`
3. `docs/screenshots/source-banner-collapsible-system-desktop-collapsed.png`
4. `docs/screenshots/source-banner-collapsible-system-desktop-expanded.png`
5. `docs/screenshots/source-banner-collapsible-dashboard-mobile-collapsed.png`
6. `docs/screenshots/source-banner-collapsible-dashboard-mobile-expanded.png`
7. `docs/screenshots/source-banner-collapsible-system-mobile-collapsed.png`
8. `docs/screenshots/source-banner-collapsible-system-mobile-expanded.png`

补充场景截图（异常态覆盖）：
- `docs/screenshots/source-banner-collapsible-extra-dashboard-desktop-ok.png`（全正常）
- `docs/screenshots/source-banner-collapsible-extra-dashboard-desktop-recdown.png`（recommendations 不可用）
- `docs/screenshots/source-banner-collapsible-extra-system-desktop-recdown.png`（recommendations 不可用）

---

## 二、检查项结果

### 1) 交互一致性

- 两页默认均为折叠态：**通过**。
- 来源条目超阈值时显示“展开来源状态（+N）”：**通过**（两页均出现）。
- 阈值内不显示按钮：**通过**（全正常/recommendations 不可用场景未出现 toggle）。
- 刷新后回到折叠态（非持久化）：**通过**。  
  实测结果：`initial_expand_button=True` -> 点击后 `after_click_has_collapse=True` -> 刷新后 `after_reload_has_expand=True`。

### 2) 文案与层级

- `summary` 主文案、`detail` 次级文案层级清楚：**通过**。
- 按钮文案两页一致（展开来源状态 / 收起来源状态）：**通过**。

### 3) 响应式与可点击性

- 900/820/768 宽度无横向滚动：**通过**。  
  实测：`/dashboard` 与 `/system-overview` 在 900/820/768 均为 `False`（无水平溢出）。
- 长文本换行可读性：**基本通过**（未出现断字异常）。
- 按钮点击热区：**不通过**。  
  实测 toggle 高度约 `26px`（desktop/mobile 一致），低于“最小 32px 建议”。

### 4) 异常态覆盖

- 全正常：**通过**（`source-banner-collapsible-extra-dashboard-desktop-ok.png`）。
- 部分失败（含 5xx + null status）：**通过**（主验收 8 张基于 partial 场景）。
- recommendations 不可用降级态：**通过**（两页补充截图已覆盖）。

---

## 三、阻塞项

### 阻塞 1：展开态不是“真实展开”

现象：  
点击“展开来源状态”后，`detail` 里仍出现“其余 N 个来源已折叠”文案（如 `其余 3 个来源已折叠`、`其余 1 个来源已折叠`）。

影响：  
用户进入“展开态”后仍无法看到完整来源明细，交互语义与预期不一致，排障信息不完整。

建议：  
`SourceStatusBanner` 仅负责 UI 折叠；上游传入的 `detailLines` 应为完整列表，不应提前在 `buildSourceStatusLines(..., limit)` 阶段截断。  
建议调整点：
- `apps/chiller-shell-v1/src/pages/DashboardPage.tsx`
- `apps/chiller-shell-v1/src/hooks/useRecommendationDiagnostics.ts`
- `apps/chiller-shell-v1/src/i18n/sourceStatusCN.ts`

### 阻塞 2：移动端点击热区偏小

现象：  
`.source-banner-toggle` 实测高度约 `26px`。

影响：  
820/768 宽度下触控点击容错较低，影响值班场景快速操作。

建议：  
在现有 token 体系内提高控件最小高度（建议 >= `32px`），可通过 `padding` / `line-height` / `min-height` 调整，避免新增临时色值。  
建议调整点：
- `apps/chiller-shell-v1/src/styles/global.css`

---

## 四、最终结论

本轮 **不通过**。  
核心原因是“展开态仍被二次折叠”导致信息不可完全展开；同时 toggle 热区高度不足，建议与阻塞 1 一并修复后复验。
