# 发布门禁可视卡片 v1.0

用途：给运营/管理层快速判断当前是否可放行（GO/NO-GO）。  
数据来源：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json` 的 `canonical` 字段。

## 一键查看命令

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
```

## 固定展示字段（Release Gate）

### 1) contract gate

- 当前值：`true`（来自 `canonical.contract.ok`）
- 红黄绿标准（1句）：绿=合同门禁为 `true` 且 `accept-contract` 可通过；黄=合同门禁字段缺失或需人工复核；红=合同门禁为 `false` 或 `accept-contract` 失败。

### 2) canonical overallPass

- 当前值：`true`（来自 `canonical.overallPass`）
- 红黄绿标准（1句）：绿=`canonical.overallPass=true`；黄=字段存在但与现场观测冲突需复验；红=`canonical.overallPass=false`。

### 3) canonical generatedAt

- 当前值：`2026-03-12T06:06:46Z`（来自 `canonical.generatedAt`）
- 红黄绿标准（1句）：绿=生成时间在最近 2 小时内；黄=超过 2 小时但不超过 24 小时；红=超过 24 小时或时间字段缺失/非法。

### 4) decision（GO/NO-GO）

- 当前值：`GO`
- 红黄绿标准（1句）：绿=仅当 `contract gate=绿` 且 `canonical overallPass=绿` 且 `generatedAt` 非红时为 `GO`；黄=任一字段为黄时为“待复核（暂不放行）”；红=任一关键字段为红时为 `NO-GO`。

## 当前门禁结论（本卡片生成时）

- contract gate：绿
- canonical overallPass：绿
- canonical generatedAt：绿
- decision：**GO**

## 给非技术同学的使用口令

- 先执行 `status-json`，只看 `canonical`。
- 4 个字段按红黄绿判断，出现黄/红一律先停，不做对外放行。
