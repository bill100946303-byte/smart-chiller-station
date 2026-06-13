# Chiller Shell V1

Standalone frontend shell for the legacy chiller station 2.0 upgrade.

Current scope:
- `/login`
- `/projects`
- `/dashboard`
- `/trend-analysis`
- `/cold-station-logs`
- `/operation-records`
- `/energy-analysis`
- `/energy-efficiency`
- `/energy-parameters`
- `/meter-readings`
- `/performance-report`
- `/report-records`
- `/knowledge-base`
- `/work-orders`
- `/operational-diagnostics`
- `/environment-conditions`
- `/alarms`
- `/devices`
- `/optimize-demo`
- `/scene-control`
- `/video-monitor`
- `/system-overview`

## Run

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1
npm install
npm run dev
```

Default dev URL:

`http://127.0.0.1:3001`

## Environment

Create local env from template:

```bash
cp .env.example .env.local
```

Supported variables:

- `VITE_BFF_BASE_URL` (default same-origin; in dev it is proxied to `http://127.0.0.1:8787` by Vite)
- `VITE_LEGACY_BASE_URL` (default `https://www.ssge.com.cn:8098`)
- `VITE_SITE_ID` (default `126lnoffice`)
- `VITE_TREND_RANGE` (`24h` | `7d` | `30d`, default `24h`)

## Verification

Run the full frontend gate before handoff:

```bash
npm run verify
```

This runs:

- `npm run check:source-status-dict`
- `npm run check:ui-copy`
- `npm run build`

`check:ui-copy` prevents visible UI copy from leaking implementation terms such as internal endpoints, legacy labels, raw paths, video URLs, mojibake, and old English control terms.

## Notes

- This shell is independent from the legacy built Vue bundle.
- Dashboard/System Overview are wired to BFF contracts with degraded-mode rendering when endpoints fail.
- Contract baseline is `apps/chiller-bff/openapi/bff-v1.yaml`.
