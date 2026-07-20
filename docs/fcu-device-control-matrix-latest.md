# FCU 逐台控制矩阵

- 站点: 126lnoffice
- 楼层: build=1, floor=1
- 结论: 逐台控制页已具备
- 全局真实下发: 未允许
- 生成时间: 2026-06-20T04:31:48.229Z

## 汇总

- FCU 总数: 29
- 上游原始行: 29
- 重复折叠: 0
- 控制页可进入: 29
- 设备侧就绪: 9
- 单台阻断: 20
- 可真实下发: 0
- 通讯报警: 8
- 温度异常: 4

## 逐台清单

| 设备 | 温度 | 设定 | 质量 | 设备侧 | 真实下发 | 阻断原因 | 控制页 |
|---|---:|---:|---|---|---|---|---|
| 办公室01 BGS01 | 28.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS01) |
| 办公室02 BGS02 | 28.0°C | 16.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS02) |
| 办公室03 BGS03 | 0.0°C | 0.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS03) |
| 办公室04 BGS04 | 0.0°C | 0.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS04) |
| 办公室05 BGS05 | 29.0°C | 26.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS05) |
| 办公室06 BGS06 | 22.0°C | 24.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=BGS06) |
| 财务室 CWS | 28.0°C | 16.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=CWS) |
| 大会议室 DHYS | 29.0°C | 19.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=DHYS) |
| 电梯厅 DTT | 28.0°C | 27.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=DTT) |
| 工程办公区01 GCBGQ01 | 28.0°C | 10.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=GCBGQ01) |
| 工程办公区02 GCBGQ02 | 28.0°C | 10.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=GCBGQ02) |
| 工程办公区03 GCBGQ03 | 31.0°C | 19.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=GCBGQ03) |
| 接待室 JDS | 28.0°C | 15.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=JDS) |
| 刘总办公室 LZBGS | 29.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=LZBGS) |
| 前厅01 QT01 | 28.0°C | 16.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=QT01) |
| 前厅02 QT02 | 26.0°C | 26.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=QT02) |
| 洽谈室 QTS | 27.0°C | 21.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=QTS) |
| 实验室 SYS | 28.0°C | 19.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=SYS) |
| 头脑风暴区01 TNFBQ01 | 29.0°C | 21.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=TNFBQ01) |
| 头脑风暴区02 TNFBQ02 | 29.0°C | 10.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=TNFBQ02) |
| 卫生间01 WSJ01 | 27.0°C | 26.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=WSJ01) |
| 卫生间02 WSJ02 | 0.0°C | 0.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=WSJ02) |
| 行政办公室 XZBGS | 27.0°C | 18.0°C | ok | 阻断 | 禁止 | setpoint_feedback_valid / 全局投运闸门未开 / setpoint_feedback_out_of_bounds | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=XZBGS) |
| 研发办公区01 YFBGQ01 | 28.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=YFBGQ01) |
| 研发办公区02 YFBGQ02 | 28.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=YFBGQ02) |
| 研发办公区03 YFBGQ03 | 28.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=YFBGQ03) |
| 研发办公区04 YFBGQ04 | 28.0°C | 24.0°C | ok | 就绪 | 禁止 | 全局投运闸门未开 | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=YFBGQ04) |
| 中会议室 ZHYS | 0.0°C | 0.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=ZHYS) |
| 周总 ZZBGS | 24.0°C | 35.0°C | invalid | 阻断 | 禁止 | 通讯异常 / 温度无效 / setpoint_feedback_valid | [打开](http://127.0.0.1:3001/hvac-terminal?siteId=126lnoffice&view=device&deviceCode=ZZBGS) |
