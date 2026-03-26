# 发布前一键快照解读指南 v1

适用对象：值班群、运营同学、管理层同步。  
快照入口：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
```

发布窗口建议：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live
```

## 三态展示文案（GO / NO-GO / UNKNOWN）

说明：三态优先使用 `summary` 字段判读，禁止人工改写结论。

### 1) GO

建议展示文案：
- `发布快照结论：GO`

看哪 3 个字段：
- `summary.releaseGateSource`
- `summary.releaseDecision`
- `summary.recommendedAction`

判定特征：
- `summary.releaseDecision == "GO"`

第一动作：
- 按 `summary.recommendedAction` 执行发布确认（默认文案通常是 `release candidate is ready under default policy`）。

### 2) NO-GO

建议展示文案：
- `发布快照结论：NO-GO`

看哪 3 个字段：
- `summary.releaseGateSource`
- `summary.releaseDecision`
- `summary.recommendedAction`

判定特征：
- `summary.releaseDecision == "NO-GO"`

第一动作：
- 立即停发，并按 `summary.recommendedAction` 回到排障流程（通常先复跑 `status-json --live` / `check` / `accept`）。

### 3) UNKNOWN

建议展示文案：
- `发布快照结论：UNKNOWN（信息不足，暂不放行）`

看哪 3 个字段：
- `source`
- `summary.releaseGateSource`
- `error`

判定特征（任一满足）：
- `source == "missing"`  
- `summary.releaseGateSource == "none"`  
- `error != null`

第一动作：
- 先补 canonical 快照（执行 `accept`），再重跑 `status-json`（发布窗口建议直接 `--live`）。

## 值班一页流程（文字版）

1. 先看 `summary.releaseGateSource`。  
`live`：实时结果，可直接作为当前判定源。  
`latest_file`：最近落盘结果，仅作参考。  
`none`：信息不足，进入 UNKNOWN 处理。

2. 再看 `summary.releaseDecision`。  
`GO`：走发布确认。  
`NO-GO`：立即停发并转排障。

3. 最后看 `summary.recommendedAction`。  
把这句当“第一动作”，不要凭经验跳步骤。

## 常见误读（至少 6 条）

1. 把 `preflightPass=true` 等同于 runtime 全绿。  
正确：`preflightPass` 是预检总门禁，不替代 `status-json --live` 的实时判定。

2. 把 `releaseGateSource=latest_file` 当成实时结果。  
正确：发布窗口应优先看 `--live`，`latest_file` 只是缓存快照。

3. 只看 `canonical.overallPass=true` 就直接放行。  
正确：最终看 `summary.releaseDecision`，不是单字段放行。

4. 忽略 `recommendedAction`，直接按经验操作。  
正确：第一动作必须按 `summary.recommendedAction` 执行。

5. 看到 `advisories` 就当成硬阻断。  
正确：阻断结论看 `releaseDecision`/`reasons`，`advisories` 是提示。

6. `error` 非空仍继续走发布流程。  
正确：这是 UNKNOWN，先补快照（`accept`）再重跑。

## 结论口径（可直接发群）

- `GO`：可进入发布确认。  
- `NO-GO`：立即停发并转排障。  
- `UNKNOWN`：信息不足，先补快照再判定。  
