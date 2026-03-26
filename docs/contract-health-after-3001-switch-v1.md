# Contract Health After 3001 Switch v1

## 执行命令
- 目录：`/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff`
- 命令：`npm run check:contract`

## 命令日志摘要
- 结果：`Contract validation passed for 5 examples using bff-v1.yaml`
- 说明：主合同门禁通过，3001 切换未影响 `check:contract` 阻断判定。
- 非阻断探针状态：
  - `Real-link-ready probe (non-blocking): NOT_READY`
  - `Real-link-ready runtime probe (non-blocking): UNAVAILABLE`
  - 运行态探针请求 `http://127.0.0.1:8787` 四个端点均 `fetch failed`（不影响合同门禁通过）。

## 当前关键值
- `example-ready=false`
- `runtime-ready=unknown`
- `drift warning`: `none`（日志为 `Source key drift warnings: none`）

## 结论
- 合同门禁：`PASS`
- 运行态探针：`unknown / unavailable`（仅非阻断观测信号）
