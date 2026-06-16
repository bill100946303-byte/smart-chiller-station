# /optimize-demo UI 边界文案检查

- 结论：UI_BOUNDARY_COPY_READY
- 源文件：apps/chiller-shell-v1/src/pages/OptimizeDemoPage.tsx
- 生成时间：2026-06-16T05:23:59.870Z

## 必须出现的边界文案

| key | 结果 | 命中文案 | 行号 |
| --- | --- | --- | --- |
| real_plc_locked | 通过 | 真实 PLC 下发锁定 | 4185 |
| shadow_only_execution | 通过 | 审批后只生成影子记录 | 4177 |
| no_multi_chiller_single_cop | 通过 | 不计算多机单台 COP | 4144 |
| no_new_plc_dispatch | 通过 | 不新增 PLC 下发能力 | 5832 |
| read_only_diagnostics | 通过 | 只读诊断 | 1924 |
| advisor_operational_scope | 通过 | 仪表、水力、控制震荡、低温差、冷却塔和主机样本只读诊断 | 5831 |
| instrument_drift_v1 | 通过 | 仪表偏移 V1 | 5887 |
| instrument_no_auto_correction | 通过 | 不自动修正测点 | 4056 |
| hydraulic_balance_v1 | 通过 | 水力平衡 V1 | 5999 |
| hydraulic_no_auto_pump_down | 通过 | 不自动降泵 | 4073 |
| hydraulic_no_terminal_fault | 通过 | 不直接判定末端阀门故障 | 4073 |
| control_oscillation_v1 | 通过 | 控制震荡 V1 | 6093 |
| control_no_auto_pid | 通过 | 不自动改 PID | 4090 |
| control_no_auto_start_stop | 通过 | 不自动启停设备 | 4090 |
| manual_review_gate | 通过 | 人工审阅门禁 | 5581 |
| shadow_suite_gate | 通过 | 140 shadow suite | 5588 |
| no_control_mutation_gate | 通过 | NO_CONTROL_MUTATION | 4000 |
| one_vote_stop_gate | 通过 | 一票否决 | 5615 |
| shadow_verification_record | 通过 | 影子验证记录 | 5623 |
| shadow_verification_window | 通过 | 30-60min 同负荷/湿球 band 对比 | 1860 |
| manual_recording_boundary | 通过 | 人工记录 | 4499 |
| no_fixed_savings_commitment | 通过 | 不作为固定节能承诺 | 1233 |
| append_only_shadow_record | 通过 | append-only 记录 | 4913 |
| manual_shadow_record_save | 通过 | 保存人工验证记录 | 4928 |
| shadow_review_append_only | 通过 | 补录复核结果 | 4913 |
| shadow_review_summary | 通过 | 影子复核统计 | 5006 |
| readonly_shadow_summary | 通过 | 只读统计摘要 | 5007 |
| advisor_type_filter | 通过 | Advisor 类型筛选 | 4957 |
| advisor_type_summary | 通过 | 按 Advisor 类型统计 | 5066 |
| execution_drilldown_filter | 通过 | 执行单 ID 下钻 | 4980 |
| execution_drilldown_boundary | 通过 | 按单个 shadow 执行单查看 | 4981 |
| single_shadow_review_summary | 通过 | 单次 shadow 复盘摘要 | 5020 |
| single_shadow_review_boundary | 通过 | 只做审计复盘 | 5022 |
| shadow_review_archive_checksum | 通过 | 报告ID/校验码 | 5022 |
| shadow_review_not_e_signature | 通过 | 不是电子签名 | 5022 |
| single_shadow_review_report_export | 通过 | 导出复盘报告 | 5037 |
| shadow_review_print_style | 通过 | A4 打印样式 | 5022 |
| shadow_review_print_page | 通过 | 打开打印版 | 5051 |
| shadow_review_signature_area | 通过 | 甲方/值班员签字确认区 | 5022 |
| advisor_type_split | 通过 | 主机组合 / 冷却塔 / 泵 Delta-T | 5067 |
| shadow_record_audit_export | 通过 | 导出审计 CSV | 4913 |
| diagnostic_readiness_matrix | 通过 | 数据资源与诊断可行性 | 5668 |
| directional_diagnostics_boundary | 通过 | 只能疑似判断 | 2129 |
| point_gap_plan | 通过 | 暂不能做 | 2132 |
| field_verification_checklist | 通过 | 现场复核清单 | 5737 |
| field_verification_readonly_boundary | 通过 | 只读点位/资料补齐 | 5738 |
| no_fault_diagnosis_commitment | 通过 | 不判定设备故障 | 5675 |
| client_demo_readiness_gate | 通过 | 甲方演示 readiness | 5551 |

## 禁止出现的承诺文案

| key | 结果 | 命中文案 | 行号 |
| --- | --- | --- | --- |
| automatic_start_stop | 通过 | -- | -- |
| real_plc_dispatch_enabled | 通过 | -- | -- |
| automatic_dispatch | 通过 | -- | -- |
| unattended_closed_loop | 通过 | -- | -- |
| enforced_enabled | 通过 | -- | -- |

## 阻断项

- 无

## 结论口径

- 本检查是静态 UI 文案检查，不登录、不审批、不 dispatch、不 rollback。
- 它证明源代码中保留了 shadow/read-only/PLC 锁定/多机不拆单机 COP 的可见文案边界。
- 真实页面渲染仍以浏览器 smoke 或人工截图复核为准。
