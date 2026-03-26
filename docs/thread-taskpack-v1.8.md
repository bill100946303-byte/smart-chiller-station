# 线程任务包 v1.8（主控下发）

## UI-Design（执行单）
### 目标
- 在不改 token、不改接口的前提下，完成“非降级态门槛”可视化证据页，解决当前“看得到异常，但无法一眼判断是否可签收”的问题。

### 输入
- `docs/ui-consistency-review-v1.7.md`
- `docs/ui-real-link-threshold-review-v1.5.md`
- `docs/ui-real-link-badge-spec-v1.6.md`
- `docs/ui-badge-state-v1.6.json`

### 任务
1. 新增 `UI 签收证据面板` 设计稿说明（文档层）：
   - 固定显示 `M1/M2/M3` 当前值、阈值、PASS/FAIL。
   - 固定显示“数据来源：后端判定”标识，不允许前端推断。
2. 复验三语（zh/en/vi）+ 两页（dashboard/system-overview）+ 两宽度（1366/820）；
3. 交付 8 张最小证据图（每页每语言至少 1 张，含 FAIL 场景）；
4. 文档中逐项写“可签收/不可签收 + 理由 + 图证路径”。

### 交付
- `docs/ui-acceptance-evidence-spec-v1.8.md`
- `docs/screenshots/ui-v18-*.png`

### 回报格式
- 已完成
- 未完成
- 阻塞
- 关键截图路径
- 最终结论（PASS/FAIL）

---

## Data-Model（执行单）
### 目标
- 将 `blocking=4` 的门禁缺口收敛为“可执行修复清单”，并给出 owner 级落地顺序。

### 输入
- `docs/non-degraded-readiness-checklist-v1.2.csv`
- `docs/field-display-consistency-report-v1.2.md`
- `docs/field-display-dictionary-v1.json`
- `docs/non-degraded-readiness-fields-v1.md`

### 任务
1. 对 4 个 blocking 项逐条生成“修复定义”：
   - 缺什么字段检查
   - 放在何处检查（legacy/bff/shell）
   - 通过条件/失败条件
2. 补齐一个“可机器执行”的最小化 CSV（新增列：`fix_rule_id, gate_location, test_case`）；
3. 对 core4 指标输出统一单位与比较约束卡片（面向 UI 文案与 BFF 校验共享）。

### 交付
- `docs/non-degraded-readiness-checklist-v1.3.csv`
- `docs/readiness-blocking-fix-spec-v1.3.md`

### 回报格式
- 已完成
- 未完成
- 阻塞
- blocking 是否清零（yes/no）
- 仍未清零项列表

---

## BFF-Contract（执行单）
### 目标
- 不改 schema 严格性的前提下，让 `real-link-ready probe` 从“统计”升级到“可直接判责”。

### 输入
- `apps/chiller-bff/scripts/check-contract.js`
- `apps/chiller-bff/openapi/examples/real-link-ready-probe-report.json`
- `docs/contract-probe-readme-v1.2.md`
- `docs/non-degraded-readiness-fields-v1.md`

### 任务
1. 扩展 probe 报告字段：
   - `ownerHint`（legacy/bff/shell）
   - `gateId`（映射 ND-xxx）
   - `actionHint`（一句话修复建议）
2. 增加 `--probe-json-only` 模式（仅输出 JSON，便于主控脚本消费）；
3. 保持以下边界不变：
   - 5 example 强校验仍为阻断门禁；
   - 漂移 warning 仍不阻断；
   - 不放宽 `bff-v1.yaml`。

### 交付
- 更新 `apps/chiller-bff/scripts/check-contract.js`
- 更新 `apps/chiller-bff/openapi/examples/real-link-ready-probe-report.json`
- 新增 `docs/contract-probe-owner-mapping-v1.3.md`

### 回报格式
- 改动文件路径
- `npm run check:contract` 结果
- probe 样例输出（摘要）
- 是否新增阻断（yes/no）

---

## HVAC-Rules（执行单）
### 目标
- 在不动阈值/逻辑的前提下，把 `station_cop 缺失` 与 `stale` 的运营文案做成“签收态可读模板”。

### 输入
- `docs/hvac-rule-copybook-v1.3.json`
- `docs/hvac-stale-mode-copy-v1.md`
- `docs/hvac-station-cop-missing-copy-v1.md`
- `docs/hvac-rule-evaluable-rate-copy-v1.md`

### 任务
1. 输出“签收态文案模板”：
   - `NOT_READY`（不可签收）
   - `READY_WITH_RISK`（可上线但有风险提示）
   - `READY`（可签收）
2. 每种模板提供 zh/en/vi 三语短文案（标题 + 一句话 + 下一步动作）；
3. 明确字段触发条件（引用 `ruleEvaluation/freshness/sourceStatus`）；
4. 保持兼容：不得删除 v1.3 已有 key。

### 交付
- `docs/hvac-signoff-copybook-v1.0.md`
- `docs/hvac-signoff-copybook-v1.0.json`

### 回报格式
- 已完成
- 未完成
- 阻塞
- 三种模板是否齐全（yes/no）
- JSON 解析是否通过

