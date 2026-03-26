# 验收三档文案与角标状态映射表 v1.1

目标：将 `hvac-acceptance-ops-copy-v1` 与 badge 状态做 1:1 映射，避免对外口径漂移。  
边界：不改 `ruleId`、不改阈值、不改 evaluator。

## 1) 映射口径（字段级）

输入字段：
- `overallPass`
- `readiness.nonDegradedReady`
- `badge.globalPass`

标准化 badge 档位（用于对外口径）：
- `BADGE_READY`
- `BADGE_PENDING`
- `BADGE_BLOCKED`

优先级（防冲突）：
1. `ACCEPT_READY`
2. `ACCEPT_READY_WITH_RISK`
3. `ACCEPT_NOT_READY`

## 2) 1:1 映射表

| acceptance 档位 | badge 档位 | zh 主句 | en 主句 | vi 主句 | 是否允许外发 |
| --- | --- | --- | --- | --- | --- |
| `ACCEPT_READY` | `BADGE_READY` | 验收已通过，非降级可运行。 | Acceptance passed, non-degraded ready. | Nghiem thu da dat, san sang phi suy giam. | yes |
| `ACCEPT_READY_WITH_RISK` | `BADGE_PENDING` | 可发布但有风险，先对齐角标与运行信号。 | Publish with risk; align badge and runtime signals first. | Co the phat hanh nhung co rui ro; can dong bo badge va runtime truoc. | no |
| `ACCEPT_NOT_READY` | `BADGE_BLOCKED` | 验收未通过，禁止对外发布。 | Acceptance not ready; external release is blocked. | Nghiem thu chua dat; khong duoc cong bo ra ngoai. | no |

## 3) 档位判定（字段级）

### `ACCEPT_READY` -> `BADGE_READY`
- `overallPass == true`
- `readiness.nonDegradedReady == true`
- `badge.globalPass == true`

### `ACCEPT_READY_WITH_RISK` -> `BADGE_PENDING`
- `overallPass == true`
- 且以下任一：
  - `readiness.nonDegradedReady == false`
  - `badge.globalPass == false`

### `ACCEPT_NOT_READY` -> `BADGE_BLOCKED`
- `overallPass == false`

说明：
- 若 `overallPass == false`，统一归 `ACCEPT_NOT_READY`，避免“角标通过但验收失败”的外发口径冲突。

## 4) 禁止外发（典型触发条件，字段级）

1. `overallPass == false`  
结果：必须标记 `ACCEPT_NOT_READY`，禁止外发。

2. `overallPass == true && readiness.nonDegradedReady == false`  
结果：标记 `ACCEPT_READY_WITH_RISK`，禁止外发（仅内部灰度观察）。

3. `overallPass == true && readiness.nonDegradedReady == true && badge.globalPass == false`  
结果：标记 `ACCEPT_READY_WITH_RISK`，禁止外发（角标待同步）。
