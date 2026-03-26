# status-json 运营读法指南 v1

适用对象：值班同学、运营同学、管理层同步。  
目标：用一套固定读法，快速判断“现在能不能放行、下一步该做什么”。

## status-json 三态读法

### 1) default（默认快照态）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
```

固定看这 3 个字段：
- `summary.releaseGateSource`
- `summary.releaseDecision`
- `summary.recommendedAction`

对应动作：
- 若 `releaseGateSource=latest_file` 且 `releaseDecision=GO`：可作为日常窗口参考结论。
- 若 `releaseGateSource=none` 或 `error` 非空：先执行 `accept`，再重看。
- 若 `releaseDecision=NO-GO`：停止放行，按 `recommendedAction` 处理。

### 2) live（实时门禁态）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live
```

固定看这 3 个字段：
- `summary.releaseGateSource`（应为 `live`）
- `releaseGateLive.decision`
- `summary.recommendedAction`

对应动作：
- 若 `releaseGateSource=live` 且 `releaseGateLive.decision=GO`：可进入发布确认流程。
- 若 `releaseGateLive.decision=NO-GO`：立即停发并转排障，不看历史 latest。
- 若 `releaseGateLive` 为空：退回 default 读法，并先补 `release-gate-latest`。

### 3) strict-live（严格时效实时态）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live --strict-freshness
```

固定看这 3 个字段：
- `releaseGateLive.strictFreshness`
- `releaseGateLive.decision`
- `releaseGateLive.reasons`

对应动作：
- 若 `strictFreshness=true` 且 `decision=NO-GO` 且含 `freshness_not_fresh_strict`：按严格门禁停发，先更新新鲜快照。
- 若 `strictFreshness=true` 且 `decision=GO`：可按严格门禁放行。
- 若 `strictFreshness` 不为 `true`：说明命令或环境参数异常，重跑 strict-live 命令复核。

## 一页版流程图（文字版）

1. 先看 `summary.releaseGateSource`  
`live`：使用实时门禁结果继续判断。  
`latest_file`：这是缓存门禁，仅作参考，必要时切到 `--live` 复核。  
`none`：缺少门禁来源，先执行 `accept` 或 `release-gate-latest`。

2. 再看 `decision`  
优先顺序：`releaseGateLive.decision`（若存在）> `summary.releaseDecision`。  
`GO`：进入发布确认。  
`NO-GO`：立即停发并转排障。

3. 最后看 `recommendedAction`  
严格按该字段执行下一步，不自行改写动作。  
若文案是 `do not release...`，视为硬停。  
若文案是 `release candidate is ready...`，可进入放行沟通。

## 常见误判（值班高频）

1. 把 `releaseGateSource=latest_file` 当作实时结论。  
正确做法：发布窗口优先看 `--live`，`latest_file` 仅是最近落盘结果。

2. 只看 `summary.releaseDecision`，忽略 `releaseGateLive.decision`。  
正确做法：live 模式下以 `releaseGateLive.decision` 为准。

3. strict-live 下看到 `overallPass=true` 就放行。  
正确做法：strict 模式必须以 `releaseGateLive.decision` 和 `reasons` 为准。

4. 忽略 `recommendedAction`，按经验手动跳步。  
正确做法：`recommendedAction` 是当前态的标准下一步，必须执行。

5. 看到 `advisories` 就误判为 NO-GO。  
正确做法：`advisories` 是提示项，阻断判定看 `decision/reasons`。

6. `error` 非空时仍继续走发布。  
正确做法：先补 canonical（执行 `accept`），再重跑 `status-json`。

## 值班口令（可直接贴群）

- 日常：先跑 `status-json` 看总览。  
- 发布窗口：必须跑 `status-json --live`。  
- 严格发布窗口：跑 `status-json --live --strict-freshness`，以 strict 结果为准。  
