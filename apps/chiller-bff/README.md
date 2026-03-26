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

## Contract check

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
npm run check:contract
```

Validates OpenAPI examples (`overview/trends/anomalies/topology/recommendations`) against referenced response schemas.

## Environment variables

- `BFF_PORT` (default `8787`)
- `LEGACY_BASE_URL` (default `http://127.0.0.1:8098`)
- `DEFAULT_SITE_ID` (default `126lnoffice`)
- `STALE_THRESHOLD_HOURS` (default `24`)
- `FIELD_DICTIONARY_FILE` (default `../../docs/field-dictionary.json`)
- `HVAC_RULES_FILE` (default `../../docs/hvac-rules-v1.yaml`)

## OpenAPI

Contract draft:

- `openapi/bff-v1.yaml`
