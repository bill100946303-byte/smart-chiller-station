# 140 `/optimize-demo` Shadow 人工审阅清单

更新时间：2026-06-12

## 1. 当前结论

140/B25 最新 suite 为 `GO_SHADOW_PENDING`。当前适合进入 **人工审阅 + shadow 验证准备**，但不适合进入真实 PLC 下发、自动启停或 enforced 闭环。

最新一键检查口径：

| 检查项 | 当前结果 | 说明 |
| --- | --- | --- |
| Advisor 合同 | `ADVISOR_CONTRACT_READY` | 主机组合、运行诊断、塔、泵 Advisor 均保留边界 |
| UI 边界文案 | `UI_BOUNDARY_COPY_READY` | 页面可见 PLC 锁定、只读诊断、shadow、多机不拆单机 COP、人工审阅门禁、Shadow 验证记录、补录复核结果、Shadow 复核统计、Advisor 类型筛选、报告ID/校验码、非电子签名边界、审计 CSV 导出 |
| 控制副作用防护 | `NO_CONTROL_MUTATION` | suite 前后 tower/pump 执行单状态、审批、dispatch、timeline 未变化 |
| 冷却塔 Approach | `GO_SHADOW` | 塔侧数据门禁 `READY 8/8`，可人工审阅 tower shadow 待审单 |
| 泵温差降频 | `GO_SHADOW_ONLY` | 只能 shadow 审阅，不能 assisted |
| Shadow 治理 | `GO_SHADOW_PENDING` | 当前存在待审单，未 dispatch |

统一报告：

- `docs/optimize-demo-140-shadow-suite-latest.md`
- `docs/optimize-shadow-governance-latest.md`
- `docs/b25-tower-approach-readiness-latest.md`
- `docs/pump-delta-t-readiness-latest.md`

## 2. 人工审阅前必须先跑

```bash
BFF_BASE_URL=http://127.0.0.1:8799 SITE_ID=140 npm --prefix apps/chiller-bff run check:optimize-demo-140-shadow-suite
```

允许进入人工审阅的最低条件：

| 条件 | 必须结果 |
| --- | --- |
| 总结论 | `GO_SHADOW_PENDING` |
| Advisor 合同 | `ADVISOR_CONTRACT_READY` |
| UI 边界文案 | `UI_BOUNDARY_COPY_READY` |
| 控制副作用防护 | `NO_CONTROL_MUTATION` |
| tower | `GO_SHADOW` |
| pump | `GO_SHADOW_ONLY` |
| governance | `GO_SHADOW_PENDING` |
| 最新 tower dispatch | `none` |
| 最新 pump dispatch | `none` |

任何一项不满足，停止人工审阅，不做 approve。

## 3. 当前待审对象

注意：以下执行单用于人工审阅和 shadow 验证准备；suite 不会自动 approve、dispatch 或 rollback，真实 PLC 下发仍锁定。

### 3.1 冷却塔 Approach 待审单

| 项目 | 当前值 |
| --- | --- |
| executionId | `opx-140-1781266624535-ju3qeb` |
| 状态 | `pending_approval` |
| 审批 | `pending` |
| 本次目标 | `Tcws 28.0℃` |
| 最终边界 | `30.0℃`，分步 shadow |
| 回退目标 | `Tcws 27.5℃ / Approach 2.9℃` |
| dispatch | `none` |
| timeline | `created` |

人工审阅重点：

| 审阅项 | 通过条件 |
| --- | --- |
| 当前告警 | 无严重/紧急告警，无塔风机故障、传感器冻结、冷机保护告警 |
| 湿球与 Tcws | 湿球、冷却水出水、Approach 物理关系合理 |
| 最低冷凝器进水温 | 现场接受 30℃ 作为当前保守 shadow 边界 |
| 多步策略 | 只审阅本次 0.5℃ 以内小步，不一次跳到最终 30℃ |
| 节能验证 | 只按同负荷/相近湿球 band 比较 COP、kW/RT、总功率、冷机功率、塔风机功率、告警数 |

### 3.2 泵温差待审单

| 项目 | 当前值 |
| --- | --- |
| executionId | `opx-140-1781265213665-wso34v` |
| 状态 | `pending_approval` |
| 审批 | `pending` |
| 冷冻泵 trim | `-1Hz` |
| 冷却泵 trim | `0Hz` |
| 回退 | `0Hz / 0Hz` |
| assisted | `BLOCKED` |
| dispatch | `none` |
| timeline | `created` |

人工审阅重点：

| 审阅项 | 通过条件 |
| --- | --- |
| 低温差证据 | 低温差在稳态窗口内持续，不是瞬时扰动 |
| 末端安全 | 末端压差、末端阀位、室温或缺冷投诉至少一类安全信号闭合 |
| PLC 保护 | 泵频率限幅、斜率、最小流量、联锁保护已由 PLC 明确兜底 |
| 泵频反馈 | 有运行泵频反馈，能验证执行后是否达到目标 |
| 结论 | 当前仍为 `GO_SHADOW_ONLY`，不得进入 assisted |

## 4. 一票否决项

出现以下任一项，停止人工审阅，不 approve，不 dispatch：

| 类别 | 一票否决条件 |
| --- | --- |
| 系统安全 | 有紧急/高等级告警、冷机保护、泵保护、塔风机异常 |
| 数据质量 | 关键数据 stale、湿球/Tcws/温差物理关系不可信、总功率/冷量明显异常 |
| 治理状态 | suite 不是 `GO_SHADOW_PENDING`，或 `NO_CONTROL_MUTATION` 失败 |
| 执行状态 | 最新待审单已经出现 `approved`、`dispatched`、`rolled_back` 或 dispatch 记录 |
| 主机组合 | 样本不足却声称换机节能，或出现多机单台 COP 排名 |
| 泵侧 | 末端安全、泵频反馈、PLC 本地保护未闭合却要求 assisted |
| 塔侧 | 要求绕过 30℃最低冷凝器进水温边界，或一次性跳过多步验证 |
| 权限 | 审批人、值班人、现场责任人不明确 |

## 5. 人工审阅步骤

1. 运行 `check:optimize-demo-140-shadow-suite`，确认所有 gate 通过。
2. 打开 `/optimize-demo?siteId=140`，只查看，不点击 approve/dispatch/rollback。
3. 对照 tower 待审单，确认目标、guardrail、rollback 与报告一致。
4. 对照 pump 待审单，确认 assisted 仍 blocked，不能解释为真实降泵。
5. 查看 blockers/warnings，不允许隐藏或口头忽略。
6. 对照 `数据资源与诊断可行性`，确认页面显示 `4 可做 / 5 疑似 / 1 补点`，并显示 `现场复核清单` 的 `4 P0 / 2 P1`；该清单只用于点位/资料补齐，不触发审批、dispatch 或 PLC 写入。
7. 对照页面 `Shadow 验证记录`，确认观察窗口为 30-60min 同负荷/湿球 band，指标包含冷站COP、组合COP、kW/RT、总功率、主机功率和告警数；观察结束后可把 pending 记录补录为 improved/neutral/regressed/invalid，补录会新增记录并保留原始 sourceRecordId，不改变执行单状态。
8. 需要留档时使用“导出审计 CSV”，该操作只读，不改变执行单状态。
9. 对照 `Shadow 复核统计`，确认统计只汇总 append-only 记录，不作为固定节能承诺，不改变执行单状态。
10. 对照 `Advisor 类型筛选` 和 `按 Advisor 类型统计`，确认主机组合、冷却塔、泵 Delta-T 可分开查看，筛选只影响统计和列表，不改变执行单。
11. 对照 `执行单 ID 下钻`，确认可按单个 shadow 执行单查看观察记录、复核结果和导出内容；该筛选只影响统计和列表，不改变执行单。
12. 对照 `单次 shadow 复盘摘要`，确认复盘状态、Advisor 类型、记录范围、关键指标、报告校验、导出范围和控制副作用均为只读审计口径，不作为节能结算依据；报告ID/校验码只用于核对页面、Markdown 和打印版一致，不是电子签名；需要交付时使用“导出复盘报告”生成 Markdown 附件，或使用“打开打印版”直接打印/另存 PDF。
13. 若只做演示，停留在待审状态即可，不需要 approve。
14. 若现场决定做 shadow approve，必须由现场负责人和值班人员共同确认，并记录时间、工况、告警、负荷、湿球。

## 6. Shadow 验证记录模板

| 字段 | 记录要求 |
| --- | --- |
| 验证对象 | tower / pump |
| executionId | 使用待审单原始 ID |
| 审阅人 | 现场负责人 + 值班人员 |
| 开始时间 | 绝对时间 |
| 当前负荷 | kW / RT |
| 湿球 | ℃ |
| 当前组合 | 主机组合、泵、塔运行数量 |
| 目标值 | Tcws 或泵频 trim |
| 回退目标 | 提交前稳定值或 0Hz trim |
| 观察窗口 | 30-60min |
| 指标 | stationCop、comboCop、kW/RT、总功率、主机功率、泵功率、塔功率、告警数 |
| 判定 | improved / neutral / regressed / invalid |
| 无效原因 | 负荷偏离、湿球偏离、告警新增、人工干预、数据 stale |

## 7. 对外说明口径

可以说：

- 当前是 AI 优化建议和 shadow 审批演示。
- 当前数据已能支撑仪表、水力、低温差、冷却塔和主机组合样本的只读诊断。
- 主机组合当前只做组合 COP / 冷站 COP，不拆多机单台 COP。
- 泵侧当前只到 `GO_SHADOW_ONLY`，assisted 仍被安全条件锁定。
- suite 证明本次检查没有审批、dispatch、rollback 控制副作用。

不能说：

- 已实现自动启停主机。
- 已实现真实 PLC 自动下发。
- 已进入 enforced 闭环。
- 已能给出单台主机实时 COP 排名。
- 当前样本已经证明切换主机组合一定节能。
- 泵降频可以直接下发到现场。

## 8. 下一步

| 优先级 | 动作 |
| --- | --- |
| P0 | 继续积累 `CH4+CH5+CH7` 等主机组合 append-only 样本 |
| P0 | 现场确认 30℃最低冷凝器进水温边界 |
| P1 | 补泵频真实点名、回退点、泵频反馈和 PLC 本地保护状态 |
| P1 | 补末端压差/阀位/室温或缺冷投诉数据源 |
| P1 | 给仪表偏移诊断补校准台账和安装位置元数据 |
| P1 | 按现场复核清单补支路水力历史趋势和冷却塔巡检/长周期分摊 |
