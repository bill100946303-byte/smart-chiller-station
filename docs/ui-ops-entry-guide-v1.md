# UI Ops Entry Guide v1（status / check / accept）

面向对象：运营/非技术同学  
统一入口脚本：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh`

使用原则：按固定顺序执行 `status -> check -> accept`，不要跳步。

---

## Step 1：status（看当前快照）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status
```

预期关键输出（2-3 条）：
- `ENTRY_MODE=shell`
- `stack.ok=true`
- `overallPass=true`

异常时怎么看（1 条）：
- 若出现 `acceptance report not found`，先执行 `accept` 生成最新报告，再回看 `status`。

截图：
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-status-ok.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-status-abnormal.png`

---

## Step 2：check（看实时链路健康）

命令：

```bash
SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check
```

预期关键输出（2-3 条）：
- `Readiness: PASS`
- `ND failed: 0`
- `sourceStatus overall => overview:ok trends:ok anomalies:ok recommendations:ok`

异常时怎么看（1 条）：
- 若 `Readiness: FAIL`，先看 `Attribution`（`upstream_interface` 或 `frontend_presentation`）并按归因分派。

截图：
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-check-ok.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-check-abnormal.png`

---

## Step 3：accept（生成签收结论）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept
```

预期关键输出（2-3 条）：
- `overallPass=true`
- `report json` 已刷新
- `report md` 已刷新

异常时怎么看（1 条）：
- 若 `overallPass=false`，不得对外宣告通过，先回到 `check` 把 FAIL 项清零后重跑。

截图：
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-accept-ok.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-ops-v1-accept-abnormal.png`

---

## 操作结论（给运营同学）

- 能否直接照着执行：**yes**
- 建议口令：先 `status` 看快照，再 `check` 看实时，再 `accept` 出最终签收。
