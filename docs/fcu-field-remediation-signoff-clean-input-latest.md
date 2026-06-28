# FCU 现场签字输入清理包

- 站点: 126lnoffice
- 当前工单: 8
- 当前有效行: 8
- 旧行: 1
- 补生成缺失行: 0
- 真实写入副作用: 无
- 生成时间: 2026-06-18T11:06:25.122Z

## 使用边界

- 本脚本不覆盖原始现场填写文件，只输出 current-only 和 stale-rows 两份派生 CSV。
- current-only 文件用于现场继续填写当前工单；stale-rows 文件只用于归档审计。
- 清理旧行不等于放行，仍需重跑签字校验、实时 closeout 和 Canary 总门禁。

- 当前有效 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-current-only-latest.csv
- 旧行归档 CSV: /Users/billchow/Documents/智慧冷冻站/docs/fcu-field-remediation-signoff-stale-rows-latest.csv

## 旧行

- FCU-P0-CWS CWS 财务室: not_in_current_work_orders
