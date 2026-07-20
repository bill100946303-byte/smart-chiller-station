# FCU 真实下发上线前预检

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 禁止真实下发
- verdict: go_live_blocked
- 控制写入副作用: 无
- 生成时间: 2026-06-20T04:31:49.789Z

## 范围

- 白名单: BGS01, BGS02, BGS03, BGS04, BGS05, BGS06, CWS, DHYS, DTT, GCBGQ01, GCBGQ02, GCBGQ03, JDS, LZBGS, QT01, QT02, QTS, SYS, TNFBQ01, TNFBQ02, WSJ01, WSJ02, XZBGS, YFBGQ01, YFBGQ02, YFBGQ03, YFBGQ04, ZHYS, ZZBGS
- 执行单设备: WSJ01, BGS01
- 预演 ready: WSJ01, BGS01
- 命令数: 4

## 检查项

| 检查 | 状态 | 说明 |
|---|---|---|
| BFF 服务可用 | 通过 | BFF healthz 正常。 |
| 策略进入 enforced | 通过 | FCU 策略已进入 enforced。 |
| BA 写适配器已配置 | 通过 | 当前适配器: legacy-scene-command |
| 白名单已配置 | 通过 | 当前白名单 29 台。 |
| 逐台控制页覆盖白名单 | 通过 | 逐台控制页 29 台，白名单 29 台，设备侧就绪 9 台。 |
| 上游重复设备行已折叠 | 通过 | 上游原始行 29，折叠重复 0。 |
| 执行单新鲜 | 通过 | 执行单距今 0 min，阈值 30 min。 |
| 执行单属于白名单子集 | 通过 | 计划设备: WSJ01, BGS01。 |
| 预演命令 ready | 通过 | 预演 ready 设备 2/2，命令 4 条。 |
| 全局真实下发闸门打开 | P0 | 全局投运闸门未打开：site_authorization_window_active / backend_not_readonly |
| 真实写入确认短语 | P0 | 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。 |

## 结论

- P0 execution_gate_open: 全局投运闸门未打开：site_authorization_window_active / backend_not_readonly
- P0 confirm_phrase_present: 必须设置 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE。
