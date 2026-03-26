# release-command-center 最终值班流程卡 v1

用途：把 `release-command-center / latest-check / sync` 三层关系收成一个固定值班流程，回答三件事：先看什么、再跑什么、失败怎么回退。  
入口约束：`3001` 是发布入口，`5173` 是开发入口；页面结论与卡片文案只读后端结果，不允许前端自行推断。

## 固定顺序

1. `sync`
2. `latest-check`
3. `latest card`

说明：
- `sync` 负责刷新本轮最新聚合结果。
- `latest-check` 负责校验最新只读结果是否完整、可播报。
- `latest card` 负责页面值班入口展示，不替代底层门禁明细。

## Step 1. 先跑 `sync`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-sync --json
```

值班看点：
- 先看 `decision / exitCode / reasons`
- 再看 `steps.releaseCommandCenterSync.ok`
- 再看 `steps.releaseCommandCenterLatestCheck.ok`

通过标准：
- `decision=GO`
- `exitCode=0`
- `steps.*.ok=true`

失败回退：
- 先看 `reasons[0]` 或首个 `steps.*.ok=false`
- 修复后重新执行 `release-command-center-sync --json`
- 未重跑前，不允许只凭页面外观继续放行

## Step 2. 再看 `latest-check`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-latest-check
```

值班看点：
- `decision`
- `exitCode`
- `source`
- `consistencyOk`

通过标准：
- `decision` 可读
- `exitCode` 与放行状态一致
- `source=latest_file`
- `consistencyOk=true`

失败回退：
- 字段缺失或校验失败时，按 fail-closed 处理
- 先回看上游 latest 文件与 contract 输出
- 修复后重新执行 `sync -> latest-check`

## Step 3. 最后读 `latest card`

页面入口：
- `http://127.0.0.1:3001/dashboard`
- `http://127.0.0.1:3001/system-overview`

固定读法：
1. 先读当前 `decision`
2. 再读 `diff / 是否变化`
3. 最后读 `firstAction`

补充位：
- `summaryClass` 用来区分 `ready / blocked / review_required`
- `source` 用来判断当前读到的是只读 latest 结果，而不是前端临时状态

边界：
- `latest card` 是值班入口，不替代底层门禁明细
- 页面文案只做后端结果投影，不允许前端根据 UI 指标自行推断 PASS/FAIL

## 失败回退规则

### A. `sync` 失败

- 先看 `reasons`
- 再看 `steps.*.ok=false` 的具体步骤
- 修复后重跑 `release-command-center-sync --json`

### B. `latest-check` 失败

- 先停发
- 回看 latest 文件是否缺字段、路径是否正确、上游时间是否更新
- 修复后按 `sync -> latest-check` 重跑

### C. `latest card` 与 `latest-check` 读法不一致

- 以后端 `latest-check / latest.json` 为准
- 前端不得自行推断或覆盖结论
- 页面只允许展示后端已写入的 `decision / source / firstAction`

## 一句话值班动作

- 可发：`sync=PASS 且 latest-check=PASS，latest card 再确认 decision=GO 后执行放行。`
- 不可发：`任一步 FAIL 或 reasons 非空，立即停发并处理首个阻断项。`
- 需复核：`decision=GO 但 summaryClass=review_required 或 diff 显示有变化，先复核再决定。`

## 图示说明

- 蓝框：`Step 1 sync`
- 橙框：`Step 2 latest-check`
- 绿框：`Step 3 latest card`
- 红框：失败时优先看的阻断位

## 证据图（6 张）

- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-zh-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-zh-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-en-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-en-system-overview.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-vi-dashboard.png`
- `/Users/billchow/Documents/智慧冷冻站/docs/screenshots/ui-release-command-center-sync-v1-vi-system-overview.png`

## 值班可用性

是否可直接值班群使用：`yes`
