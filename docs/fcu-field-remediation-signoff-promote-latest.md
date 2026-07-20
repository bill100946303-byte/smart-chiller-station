# FCU 现场签字输入提升报告

- 模式: dry_run
- 确认短语匹配: 否
- 当前有效行: 8
- 旧行: 1
- 文件写入: 否
- BA/PLC 写入副作用: 无
- 生成时间: 2026-06-18T11:06:25.186Z

## 文件

- 当前有效 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-current-only-latest.csv
- 旧行归档 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-stale-rows-latest.csv
- 目标输入 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest.csv
- 备份 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-input-latest-backup-20260618110625.csv

## 边界

- 本脚本只处理现场签字 CSV 文件，不产生 BA/PLC 写入。
- 提升后仍需重跑签字校验、实时 closeout 和 Canary 总门禁。
- 若要真实替换主输入，需设置 FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT
