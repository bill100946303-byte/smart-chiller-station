# Source Banner 修复后复验（V1.1）

复验范围：`/dashboard`、`/system-overview`  
复验目标：确认“真实展开 + toggle 热区 >= 32px + 三语言可读性”是否达标  
复验结论：**通过**

---

## 1) 12 张截图（2 页 * 2 态 * 3 语言，820 宽度）

### 中文（zh-CN）
1. `docs/screenshots/source-banner-collapsible-v11-zh-dashboard-collapsed-820.png`
2. `docs/screenshots/source-banner-collapsible-v11-zh-dashboard-expanded-820.png`
3. `docs/screenshots/source-banner-collapsible-v11-zh-system-collapsed-820.png`
4. `docs/screenshots/source-banner-collapsible-v11-zh-system-expanded-820.png`

### English（en-US）
5. `docs/screenshots/source-banner-collapsible-v11-en-dashboard-collapsed-820.png`
6. `docs/screenshots/source-banner-collapsible-v11-en-dashboard-expanded-820.png`
7. `docs/screenshots/source-banner-collapsible-v11-en-system-collapsed-820.png`
8. `docs/screenshots/source-banner-collapsible-v11-en-system-expanded-820.png`

### Tiếng Việt（vi-VN）
9. `docs/screenshots/source-banner-collapsible-v11-vi-dashboard-collapsed-820.png`
10. `docs/screenshots/source-banner-collapsible-v11-vi-dashboard-expanded-820.png`
11. `docs/screenshots/source-banner-collapsible-v11-vi-system-collapsed-820.png`
12. `docs/screenshots/source-banner-collapsible-v11-vi-system-expanded-820.png`

---

## 2) 必测项结果

### 2.1 展开真实性

结果：**通过**

- 两页在部分失败场景下均可展开：
  - `/dashboard`: `展开来源状态（+5） -> 收起来源状态 -> 刷新后恢复展开来源状态（+5）`
  - `/system-overview`: `展开来源状态（+1） -> 收起来源状态 -> 刷新后恢复展开来源状态（+1）`
- 展开后明细中未检测到“其余 N 个来源已折叠 / sources folded / nguồn đã được thu gọn”等伪展开提示。
- 当前数据量下，展开态展示完整来源明细。

### 2.2 点击热区

结果：**通过**

- `.source-banner-toggle` 实测高度：
  - desktop（1440）：`/dashboard = 32px`，`/system-overview = 32px`
  - mobile（820）：`/dashboard = 32px`，`/system-overview = 32px`
- 达到 `>= 32px` 要求。

### 2.3 多语言可读性（中文 / English / Tiếng Việt）

结果：**通过**

- 三语言在两页的 summary/detail 可读，无裁切、无重叠。
- 900 / 820 / 768 宽度下无横向滚动（`scrollWidth > innerWidth` 全部为 `False`）。
- 长文案在 820/768 下换行自然，未见断字异常。

---

## 3) 状态场景覆盖（正常 / 部分失败 / 全失败）

### 正常（ok）
- `/dashboard`: `banner=true`，`toggle=true`，summary=`聚合数据已就绪`
- `/system-overview`: `banner=true`，`toggle=false`，summary=`来源状态：1/1 正常`

### 部分失败（partial）
- `/dashboard`: `banner=true`，`toggle=true`，展开后无伪折叠文案
- `/system-overview`: `banner=true`，`toggle=true`，展开后无伪折叠文案

### 全失败（all fail / BFF 不可达）
- `/dashboard`: `banner=true`，`toggle=false`，`overflow=false`
- `/system-overview`: `banner=true`，`toggle=false`，`overflow=false`

---

## 4) 最终结论

**通过**。  
本轮未发现阻塞项，满足“通过关口”要求。

阻塞项：**无**
