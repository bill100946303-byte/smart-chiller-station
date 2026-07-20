# Chiller Admin V1

Independent admin frontend for the multi-project chiller system.

## Scope

- `/login`
- `/sites`
- `/sites/:siteId`
- `/sites/:siteId/subsystems`
- `/sites/:siteId/stations`
- `/sites/:siteId/source-config`
- `/sites/:siteId/runtime-config`
- `/sites/:siteId/members`
- `/audit-logs`

## Run

```bash
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-admin-v1
npm install
npm run dev
```

Default dev URL:

`http://127.0.0.1:3002`

## Environment

Create a local env file from the template:

```bash
cp .env.example .env.local
```

Supported variables:

- `VITE_ADMIN_API_BASE_URL` - admin API base URL, default `http://127.0.0.1:8787`
- `VITE_LEGACY_BASE_URL` - legacy auth base URL, default `http://127.0.0.1:8098`
- `VITE_ADMIN_APP_MODE` - runtime mode label source
- `VITE_ADMIN_APP_MODE_LABEL` - manual mode label override
- `VITE_ADMIN_READ_ONLY` - lock admin write operations in the UI
- `VITE_ADMIN_USE_MOCKS` - explicitly use local mock data; production API failures never silently fall back for authentication or physical-station writes
- `VITE_ADMIN_DEV_LOGIN` - local-only login fallback for real `/admin/v1` verification when BFF runs with `ADMIN_DEV_AUTH=1`
- `VITE_ADMIN_DEFAULT_SITE_ID` - fallback site selection for mock data
- `VITE_ADMIN_BOOTSTRAP_USER_IDS` - comma-separated bootstrap user ids
- `VITE_ADMIN_BOOTSTRAP_USERNAMES` - comma-separated bootstrap usernames

## Real API local verification

When verifying 3002 against the real `8787 /admin/v1` configuration store instead of local mocks:

```bash
# terminal 1
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-bff
ADMIN_DEV_AUTH=1 ADMIN_BOOTSTRAP_USERNAMES=admin npm run dev

# terminal 2
cd /Users/billchow/Documents/智慧冷冻站/apps/chiller-admin-v1
VITE_ADMIN_USE_MOCKS=false VITE_ADMIN_DEV_LOGIN=true npm run dev -- --host 127.0.0.1 --port 3002
```

Login with username `admin` and any password. The frontend receives a local demo token, but all admin data still comes from `/admin/v1`; no mock store is used.

## Energy station wording

- `enabled` means the subsystem capability is enabled in configuration, not that live field data is already connected.
- A subsystem with `sourceStatus=ok` can be shown as live-normal.
- A subsystem with `sourceStatus=waiting_points` must be shown as real-time data pending. It can have a complete point-role template, but it must not be counted as live-connected or shown with fake KPIs.
- A subsystem with `sourceStatus=demo_data` must be shown as demo data. It can show demo KPIs for `盛世绿能办公楼`, but it must not be counted as real field integration.
- B25 (`siteId=140`) is a cold-plant-only project. `盛世绿能办公楼` (`siteId=126lnoffice`) is the all-system demo project.

## Physical station registry safety

- `/sites/:siteId/stations` reads and writes `/admin/v1/sites/:siteId/stations` directly. In real mode it never converts a network, 404, or 5xx failure into mock data or a fake success.
- Write controls require current `/admin/v1/me.roles` evidence for `platform_admin` or the current site's `site_admin`, plus `/healthz.ok=true` and `/healthz.readOnlyMode=false`. Missing or stale evidence is read-only.
- The registry starts empty. It never creates a default chilled-water plant, compressed-air station, or boiler room.
- A published station identity becomes visible to the 3001 runtime list immediately. Published rows are locked in the UI until a versioned change workflow exists.
- Registration does not configure points, change PLC logic, dispatch commands, or prove that runtime data is already filtered by `stationId`.

## Notes

- Login still uses the legacy `/user/login` endpoint.
- The app always calls `/admin/v1/me` after login and stores the returned admin session.
- When the admin API is unavailable and `VITE_ADMIN_USE_MOCKS=true`, the UI falls back to a local mock store so the app remains usable offline.
