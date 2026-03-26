# Dry-run 操作提示卡片 v1.0

适用对象：运营值班 / 发布协作同学  
入口脚本：`/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh`

固定流程（必须按顺序）：
1. `accept --dry-run`
2. `status-json`
3. `accept`（正式）

---

## 第一步：`accept --dry-run`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept --dry-run
```

目标（一句）：
- 先做一次预演签收，提前暴露链路和门禁问题，避免直接正式写入带来误判。

风险（一句）：
- 若当前脚本未对 `--dry-run` 做硬隔离，可能仍触发正式报告写入，存在误覆盖风险。

通过标准（一句）：
- 仅当输出明确为“dry-run 预演且不落正式签收”时判定通过，否则立即停止并转主控确认。

---

## 第二步：查看 `status-json`

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
```

目标（一句）：
- 用结构化 JSON 快速确认当前签收来源、canonical 快照与 runtime-unavailable 诊断快照状态。

风险（一句）：
- 若跳过本步，容易把旧快照或受限环境诊断文件误当作本轮正式结果。

通过标准（一句）：
- JSON 可正常返回且 `canonical` 字段可读、无 `error` 字段时判定通过。

---

## 第三步：`accept`（正式）

命令：

```bash
/Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept
```

目标（一句）：
- 在完成预演与状态确认后，生成本轮正式签收结论与产物文件。

风险（一句）：
- 若在上游异常或门禁未清零时执行正式签收，会把 FAIL 结果固化到正式报告。

通过标准（一句）：
- 输出包含 `overallPass=true` 且报告路径为 `docs/v19.2-acceptance-report.json` 时判定通过。

---

## 判停规则（防误操作）

- 任一步未达通过标准，禁止进入下一步。
- 第一步若无法证明“dry-run 不落正式结果”，本轮流程立即判停并由主控确认后再继续。
- 只有第三步通过标准满足，才允许对外宣告“本轮验收通过”。
