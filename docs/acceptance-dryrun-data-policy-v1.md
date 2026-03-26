# Acceptance Dry-Run 数据消费策略 v1.0

## 1. 目的与边界
- 目的：定义 `dry-run` 输出与 `canonical / unavailable` 快照之间的消费关系，避免验收方误读。
- 边界：仅定义数据消费优先级与判定口径，不改字段定义、不改 `null_strategy`、不改代码逻辑。

## 2. 快照类型定义

### 2.1 Canonical（主签收快照）
- 文件：`docs/v19.2-acceptance-report.json`
- 用途：唯一放行依据（sign-off source of truth）。
- 说明：由 `scripts/v19_2_acceptance.sh` 正常写入；若检测到 `runtimeUnavailable=true` 且已有历史 canonical，脚本会优先保留 canonical。

### 2.2 Unavailable（不可达现场快照）
- 文件：`docs/v19.2-acceptance-report.unavailable.json`（存在时）
- 用途：记录“运行时不可达”的现场证据，不用于直接放行。
- 说明：用于排障归因（端口/上游不可达），不替代 canonical。

### 2.3 Dry-Run（演练/预检快照）
- 当前约定路径：`/tmp/v19.2-acceptance-dry-run.json`（脚本变量已预留）。
- 用途：流程演练、参数预检、回归自测。
- 说明：dry-run 结果不进入正式签收链路。

## 3. 放行与冲突判定

### 3.1 dry-run 是否可用于放行
- 结论：**no**。
- 理由：
1. dry-run 面向演练与预检，不保证与签收时刻同一运行态。
2. dry-run 不具备 canonical 的“发布时点冻结”语义。
3. 出现冲突时，必须以 canonical 为准，避免将临时态误判为签收态。

### 3.2 冲突优先级（高 -> 低）
1. `canonical`（`v19.2-acceptance-report.json`）
2. `unavailable`（仅作不可达证据）
3. `dry-run`（仅作预检参考）

判定规则：
- 若 canonical 与 dry-run 冲突：以 canonical 为准。
- 若 unavailable 与 canonical 并存：canonical 仍为放行依据，unavailable 用于说明当次不可达现场。
- 若仅有 dry-run、缺 canonical：判定“不可签收”，需补跑正式验收生成 canonical。

## 4. 两个示例

### 示例 A：dry-run PASS + canonical PASS
- 观测：
  - dry-run: `overallPass=true`
  - canonical: `overallPass=true`
- 结论：可放行（依据 canonical）；dry-run 仅作为前置一致性参考。

### 示例 B：dry-run FAIL + canonical PASS
- 观测：
  - dry-run: `overallPass=false`（例如某次演练时上游瞬断）
  - canonical: `overallPass=true`
- 结论：仍可放行（依据 canonical）；dry-run FAIL 归入巡检/排障记录，不回滚签收结论。

## 5. 消费方最小执行建议
1. 先读取 `docs/v19.2-acceptance-report.json` 并判定 `overallPass`。
2. 若存在 `docs/v19.2-acceptance-report.unavailable.json`，仅用于补充不可达证据链。
3. dry-run 文件仅用于预检看板，不得驱动放行开关。

## 6. 版本备注
- v1.0 基于 `scripts/v19_2_acceptance.sh` 当前行为与现有快照文件定义。
- 若后续脚本启用 dry-run 专用写入分支，本策略仍维持“dry-run 不参与直接放行”原则。
