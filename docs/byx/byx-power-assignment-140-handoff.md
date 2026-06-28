# 百益信电力回路归属确认交付说明

## 结论

- 站点：140
- 文件：`docs/byx/byx-power-assignment-140-latest.csv`
- 当前设备数：34 台
- 当前复核状态：31 台待业主确认，3 台需复核诊断
- 控制边界：只读采集，不接分合闸，不接场景执行，不反写 PLC

## 汇总

| 项目 | 数量 |
| --- | ---: |
| 百益信项目 | 2 |
| 设备总数 | 34 |
| 在线设备 | 34 |
| 诊断关注 | 3 |
| 已确认归属 | 0 |
| 待确认归属 | 34 |

## 用途分布

| 用途 | 设备数 |
| --- | ---: |
| 插座 | 16 |
| 照明 | 8 |
| 空调末端 | 4 |
| 后勤用电 | 3 |
| 弱电/IT | 2 |
| 备用/其他 | 1 |

## 现场需要填写的列

| 列名 | 是否必填 | 填写要求 |
| --- | --- | --- |
| 业主确认用途 | 必填 | 从系统建议用途中确认或改正，例如：照明、插座、空调末端、弱电/IT、后勤用电、备用/其他 |
| 业主确认系统 | 建议必填 | 例如：办公配电、照明系统、空调末端、弱电机柜 |
| 安装位置 | 必填 | 现场可识别的位置，例如：电话厅、过道、前台、会议室、厨房 |
| 配电箱/回路 | 建议必填 | 配电箱名称和回路编号，例如：AL-1/回路05 |
| 现场备注 | 选填 | 用于记录“设备名称不准”“疑似备用”“需二次核查”等信息 |

不要修改以下列：

- 百益信项目ID
- 设备ID
- 设备名称
- 在线状态
- 开关状态
- 控制边界

## 重点复核设备

CSV 中 `复核状态 = 需复核诊断` 的设备优先核对现场回路归属和实际负载类型。当前主要是功率因数偏低、温度、漏电流或电压等诊断项，先确认用途是否正确，不代表可以远程操作开关。

## 导入命令

现场回填后，保存为 CSV，再执行：

```bash
npm --prefix apps/chiller-bff run import:byx-power-assignments -- --input=/path/to/byx-power-assignment-140.csv --site-id=140 --merge
```

导入脚本只写本地 JSON 映射文件，不调用百益信控制接口、不调用 PLC、不执行场景。

## 验收命令

```bash
npm --prefix apps/chiller-bff run check:byx-power-assignments -- --site-id=140 --min-confirmed=1
```

通过标准：

- `ok=true`
- `confirmedDeviceCount >= 1`
- `unmatchedAssignmentCount = 0`
- 无 `assignment_file_missing`
- 无 `confirmed_coverage_too_low`

## 页面验收

打开：

```text
http://127.0.0.1:3001/power-monitoring?siteId=140
```

应看到：

- 百益信设备总数 34 台
- 归属确认数量大于 0
- 归属校验通过或阻断原因明确
- 页面仍显示只读边界：`/Api/OpenOrClose` 和 `/Api/Scene/Execute` 未接入运行端
