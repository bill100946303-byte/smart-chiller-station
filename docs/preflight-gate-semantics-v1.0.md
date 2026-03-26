# Preflight Gate Semantics v1.0

## 1. 适用范围
- 对象：`docs/v1.8-release-preflight.json` 的 `gates` 字段判定语义。
- 目标：统一发布前门禁解释口径，避免 `runtimeRequired=0` 被误读为系统失败。
- 边界：不变更 `check:contract` 主门禁，不调整任何 schema 严格度。

## 2. gates 字段定义
- `gates.contractOk`
  - 含义：BFF 合同强校验是否通过（主门禁）。
- `gates.shellOk`
  - 含义：前端构建与产物检查是否通过（发布资产门禁）。
- `gates.stackOk`
  - 含义：本地/目标运行栈连通与健康检查是否通过（运行态门禁）。
- `gates.runtimeRequired`
  - 含义：本次 preflight 是否要求“运行态必须可用”。

## 3. 判定优先级（正式）
1. `contractOk` 优先级最高；`false` 直接判定 preflight 失败。
2. `shellOk` 次高；`false` 直接判定 preflight 失败。
3. `stackOk` 受 `runtimeRequired` 控制：
   - `runtimeRequired=true` 时，`stackOk=false` 判定 preflight 失败。
   - `runtimeRequired=false` 时，`stackOk=false` 仅记为运行态未就绪，不阻断 preflight。

可执行判定公式：

```text
preflightPass = contractOk && shellOk && (runtimeRequired ? stackOk : true)
```

## 4. runtimeRequired=0 解释模板（标准文案）
推荐在日志/签收单使用以下模板，避免误读：

```text
runtimeRequired=0：本次发布前检查采用“合同与构建优先”策略。
当前 stackOk=false 不作为阻断项；preflightPass 仅表示合同与发布资产可交付，不表示运行栈健康通过。
如需运行态放行，请切换 runtimeRequired=1 并以 stackOk=true 为准。
```

## 5. 与 v1.8 当前样本对齐
基于 `docs/v1.8-release-preflight.json`：
- `contractOk=true`
- `shellOk=true`
- `stackOk=false`
- `runtimeRequired=false`
- 结果：`preflightPass=true`（语义正确，不等价于“运行态通过”）。
