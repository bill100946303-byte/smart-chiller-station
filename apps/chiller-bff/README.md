# Chiller BFF

Backend-for-frontend service for Chiller 2.0 shell.

## Scope

P0 routes:

- `GET /bff/v1/sites/{siteId}/dashboard/overview`
- `GET /bff/v1/sites/{siteId}/dashboard/trends`
- `GET /bff/v1/sites/{siteId}/anomalies/summary`

Additional routes staged in the same service:

- `GET /bff/v1/sites/{siteId}/system/topology`
- `GET /bff/v1/sites/{siteId}/recommendations`

## Run

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm install
npm run dev
```

Default URL:

- `http://127.0.0.1:8787`

## Quick probe without running HTTP server

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
node scripts/probe.js 126lnoffice
```

This command executes P0 aggregation services directly and prints JSON.
It now also evaluates HVAC rule cards from `docs/hvac-rules-v1.yaml`.

## Energy station demo profile

B25 and the all-system demo are intentionally separate:

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run admin:ensure-energy-demo-subsystems:b25-cold-only
npm run admin:ensure-energy-demo-subsystems:office-all-systems-demo
```

- `b25-cold-only` keeps `siteId=140` as a cold-plant-only project. Power, compressed air, boiler room, and HVAC terminal are `not_configured`, have no KPI participation, and have no runtime Advisor input.
- `office-all-systems-demo` creates/updates `siteId=126lnoffice` as `盛世绿能办公楼`. Cold plant, power monitoring, compressed air, boiler room, and HVAC terminal are enabled with `sourceStatus=demo_data`.
- Both profiles write only configuration-center data in `adminDbFile`; all control boundaries stay `read_only` with `writeEnabled=false`. The office profile is explicit demo data, not real PLC/gateway telemetry.

For local 3002 verification without a legacy login server, start BFF with explicit development auth:

```bash
ADMIN_DEV_AUTH=1 ADMIN_BOOTSTRAP_USERNAMES=admin npm run dev
```

`ADMIN_DEV_AUTH` is off by default and is accepted only in local/test/development modes. It allows local demo tokens such as `mock-token-admin` to call `/admin/v1`, then the bootstrap username grants the local admin session platform access.

## Contract check

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:contract
```

Validates OpenAPI examples (`overview/trends/anomalies/topology/recommendations`) against referenced response schemas.

## Environment variables

- `BFF_PORT` (default `8787`)
- `LEGACY_BASE_URL` (default `https://www.ssge.com.cn:8098`)
- `DEFAULT_SITE_ID` (default `126lnoffice`)
- `STALE_THRESHOLD_HOURS` (default `24`)
- `ADMIN_DEV_AUTH` (default `false`, local/test/development only)
- `ADMIN_DEV_AUTH_TOKEN` (optional exact local dev token)
- `BYX_POWER_BASE_URL` (百益信接口域名，不带结尾 `/`)
- `BYX_POWER_APP` (百益信颁发的 `byx-app`)
- `BYX_POWER_PUBLIC_KEY` (百益信颁发的 RSA 公钥，可带 PEM 头尾或单行 base64)
- `BYX_POWER_LOGIN_ID` (百益信用户编号 `loginid`)
- `BYX_POWER_TIMEOUT_MS` (default `3000`)
- `BYX_POWER_HISTORY_DIR` (default `apps/chiller-bff/.local/byx-power-history`，百益信分项趋势本地快照目录)
- `BYX_POWER_ASSIGNMENT_FILE` (default `apps/chiller-bff/.local/byx-power-assignments.json`，百益信回路归属确认映射)
- `FIELD_DICTIONARY_FILE` (default `../../docs/field-dictionary.json`)
- `HVAC_RULES_FILE` (default `../../docs/hvac-rules-v1.yaml`)

百益信电力监控为只读接入，运行端使用：

- `GET /bff/v1/sites/{siteId}/power-monitoring/byx`
- `GET /bff/v1/sites/{siteId}/power-monitoring/byx/assignment.csv`
- `GET /bff/v1/sites/{siteId}/power-monitoring/byx/assignment-check`
- `GET /bff/v1/sites/{siteId}/power-monitoring/byx/history`
- `POST /bff/v1/sites/{siteId}/power-monitoring/byx/history/snapshots`

当前只调用 `/Api/Project/List` 获取项目和设备实时电参。`/Api/OpenOrClose` 分合闸接口不接入运行端，避免误触发现场开关控制。
`assignment.csv` 由实时只读数据生成，用于现场确认设备用途、安装位置、配电箱/回路和诊断复核，不会写入 PLC 或百益信控制接口。
`history/snapshots` 会读取当前百益信只读电参并写入 BFF 本地 JSONL 趋势快照，只用于报表和诊断，不会调用百益信控制接口。

现场确认后的回路归属可以写入 `BYX_POWER_ASSIGNMENT_FILE`，BFF 会在读取 `/Api/Project/List` 后叠加确认结果，并用确认用途参与分项汇总。示例：

```json
{
  "version": 1,
  "assignments": [
    {
      "siteId": "140",
      "projectId": "P240823001",
      "deviceId": "559C240907154653",
      "category": "backup",
      "system": "办公配电",
      "location": "电话厅",
      "panel": "AL-1/备用回路",
      "status": "confirmed",
      "note": "业主已确认备用回路"
    }
  ]
}
```

支持 `category` 使用英文枚举或中文标签：`chiller_plant/冷站动力`、`hvac_terminal/空调末端`、`lighting/照明`、`outlet/插座`、`logistics/后勤用电`、`weak_current/弱电/IT`、`backup/备用/其他`、`other/未归类`。

如果现场直接回填 `assignment.csv`，可用本地导入脚本生成映射文件：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run build:byx-power-assignment-handoff -- --site-id=140 --output-dir=../../docs/byx
npm run check:byx-power-assignment-handoff -- --site-id=140 --output-dir=../../docs/byx
```

该生成命令只读取 `/Api/Project/List`，并输出现场回路归属确认 CSV、Markdown 填写说明和 summary JSON。所有输出都会保留 `read_only_no_open_close_no_scene_execute` 边界。
校验命令不会访问百益信或任何控制接口，只检查三件套文件是否存在、数量是否一致、Markdown 是否保留只读边界说明，以及 CSV 是否所有行都是只读边界；失败时返回非 0，不应发给现场。

现场回填 CSV 后，可用本地导入脚本生成映射文件：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run import:byx-power-assignments -- --input=/path/to/byx-power-assignment-140.csv --site-id=140
```

默认只导入已填写“业主确认用途/系统/安装位置/配电箱/现场备注”的行；加 `--merge` 可保留现有 JSON 中未出现在本次 CSV 的旧确认项。该脚本只写本地 JSON，不调用百益信控制接口、PLC 或场景执行。

导入后用只读检查命令验收映射覆盖情况：

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:byx-power-assignments -- --site-id=140 --min-confirmed=1
```

检查命令和 `assignment-check` 接口只读取 `/Api/Project/List` 和本地 JSON，输出 `deviceCount / confirmedDeviceCount / unmatchedAssignmentCount / blockingItems`。当确认文件缺失、没有达到最小确认数量，或存在已过期设备行时会返回 `ok=false`，CLI 返回非 0，用于阻止把错误分项口径带入报表。

## OpenAPI

Contract draft:

- `openapi/bff-v1.yaml`
