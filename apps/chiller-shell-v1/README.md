# Chiller Shell V1

Standalone frontend shell for the legacy chiller station 2.0 upgrade.

Current scope:
- `/login`
- `/dashboard`
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

- `VITE_BFF_BASE_URL` (default `http://127.0.0.1:8787`)
- `VITE_SITE_ID` (default `126lnoffice`)
- `VITE_TREND_RANGE` (`24h` | `7d` | `30d`, default `24h`)

## Notes

- This shell is independent from the legacy built Vue bundle.
- Dashboard/System Overview are wired to BFF contracts with degraded-mode rendering when endpoints fail.
- Contract baseline is `apps/chiller-bff/openapi/bff-v1.yaml`.
