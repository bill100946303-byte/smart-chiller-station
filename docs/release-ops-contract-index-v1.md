# Release Ops Contract Index v1

## 1. 范围

本文把 release ops 相关的门禁家族收口到一张清单里，覆盖：

- `release-ready`
- `release-ready-latest-check`
- `release-ready-consistency`
- `check-family`
- `check-family-brief`
- `check-family-consistency`

目标是让值班与 CI 都能快速回答 5 个问题：

- 该命令怎么跑
- 它读哪些文件
- 它会产出哪些文件
- 它是否影响默认放行
- 它是否会碰 `check:contract` / OpenAPI 主 schema

## 2. 总原则

- 这些门禁都与 `check:contract` 主链路解耦。
- 这些门禁都不修改 OpenAPI 主 schema。
- 真正直接影响默认放行的，只有 `release-ready` 这条主决策链；其余均为校验、收口或值班摘要门禁。

## 3. 家族清单

### 3.1 `release-ready`

命令清单：

- `npm run check:release-ready`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --runtime-required=0 --json`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check --selftest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest`

输入文件：

- `docs/release-ready-latest.json`
- fallback:
- `docs/release-snapshot-latest.json`
- `docs/release-snapshot-diff-latest.json`
- `docs/release-snapshot-consistency-latest.json`

输出文件：

- `docs/release-ready-latest.json`
- `docs/release-ready-latest.md`
- `npm run check:release-ready` 仅输出 stdout/stderr，不写新文件

是否影响默认放行：

- `Yes`
- 说明：`release-ready` 产出默认的 GO/NO-GO 决策工件；`check:release-ready` 仅校验，不单独改判定

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- 触发：
- `RELEASE_READY_SELFTEST=1 npm run check:release-ready`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check --selftest`

### 3.2 `release-ready-latest-check`

命令清单：

- `npm run check:release-ready-latest-check`
- `npm run sync:release-ready-latest-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check --selftest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check-sync`

输入文件：

- 优先：`docs/release-ready-latest-check.json`
- 次级：`docs/release-ready-latest.json`
- fallback:
- `docs/release-snapshot-latest.json`
- `docs/release-snapshot-diff-latest.json`
- `docs/release-snapshot-consistency-latest.json`

输出文件：

- `docs/release-ready-latest-check.json`（由 `sync:release-ready-latest-check` 生成）
- `npm run check:release-ready-latest-check` 仅输出 stdout/stderr

是否影响默认放行：

- `No`
- 说明：它是 latest 校验门禁，不是默认放行决策源

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- 触发：
- `RELEASE_READY_LATEST_CHECK_SELFTEST=1 npm run check:release-ready-latest-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check --selftest`

### 3.3 `release-ready-consistency`

命令清单：

- `npm run sync:release-ready-consistency`
- `npm run check:release-ready-consistency`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-latest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check --selftest`

输入文件：

- `docs/release-ready-latest.json`
- `docs/check-family-latest.json`
- `docs/check-family-brief-latest.json`

输出文件：

- `docs/release-ready-consistency-latest.json`
- `npm run check:release-ready-consistency` 仅输出 stdout/stderr

是否影响默认放行：

- `No`
- 说明：这是 release ops 收口门禁，便于值班总览，不替代默认 release-ready 判定

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- 触发：
- `RELEASE_READY_CONSISTENCY_SELFTEST=1 npm run check:release-ready-consistency`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check --selftest`

### 3.4 `check-family`

命令清单：

- `npm run sync:check-family`
- `npm run check:check-family`
- `npm run check:check-family-freshness`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-latest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-check --selftest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-freshness-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-freshness-check --selftest`

输入文件：

- `docs/check-family-latest.json`
- freshness 额外读取：`MAX_AGE_MIN`（默认 `60`）

输出文件：

- `docs/check-family-latest.json`（由 `sync:check-family` 生成/刷新）
- 其余 check 仅输出 stdout/stderr

是否影响默认放行：

- `No`
- 说明：这是 release ops 运维门禁总表，不直接改默认 release GO/NO-GO

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- `check:check-family`:
- `CHECK_FAMILY_SELFTEST=1 npm run check:check-family`
- `check:check-family-freshness`:
- `CHECK_FAMILY_FRESHNESS_SELFTEST=1 npm run check:check-family-freshness`

### 3.5 `check-family-brief`

命令清单：

- `npm run sync:check-family-brief`
- `npm run check:check-family-brief`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-latest`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-check --selftest`

输入文件：

- `docs/check-family-latest.json`

输出文件：

- `docs/check-family-brief-latest.json`（由 `sync:check-family-brief` 生成/刷新）
- `npm run check:check-family-brief` 仅输出 stdout/stderr

是否影响默认放行：

- `No`

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- `CHECK_FAMILY_BRIEF_SELFTEST=1 npm run check:check-family-brief`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-check --selftest`

### 3.6 `check-family-consistency`

命令清单：

- `npm run check:check-family-consistency`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-consistency-check`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-consistency-check --selftest`

输入文件：

- `docs/check-family-latest.json`
- `docs/check-family-brief-latest.json`

输出文件：

- 无独立 latest 文件
- `npm run check:check-family-consistency` 仅输出 stdout/stderr

是否影响默认放行：

- `No`

是否影响 `check:contract` / OpenAPI：

- `No / No`

selftest 是否存在：

- `Yes`
- `CHECK_FAMILY_CONSISTENCY_SELFTEST=1 npm run check:check-family-consistency`
- `/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-consistency-check --selftest`

## 4. 本次实跑结果摘要

实跑命令：

1. `npm run check:release-ready`
2. `npm run check:release-ready-latest-check`
3. `npm run check:release-ready-consistency`
4. `npm run check:check-family`
5. `npm run check:check-family-consistency`

结果：

- `npm run check:release-ready` => `PASS`
  - 摘要：`Release-ready validation passed (source=latest_file)`
- `npm run check:release-ready-latest-check` => `PASS`
  - 摘要：`Release-ready-latest-check validation passed (source=latest_check_file)`
- `npm run check:release-ready-consistency` => `PASS`
  - 摘要：`Release-ready-consistency validation passed: docs/release-ready-consistency-latest.json`
- `npm run check:check-family` => `PASS`
  - 摘要：`Check-family validation passed: docs/check-family-latest.json`
- `npm run check:check-family-consistency` => `PASS`
  - 摘要：`Check-family-consistency validation passed: docs/check-family-latest.json <=> docs/check-family-brief-latest.json`

## 5. 结论

- 本索引内命令全部与 `check:contract` 解耦。
- 本索引内命令全部不修改 OpenAPI 主 schema。
- 默认放行主链仍以 `release-ready` 为准；其余命令主要承担 latest 校验、family 汇总、一致性校验和运维值班收口职责。
