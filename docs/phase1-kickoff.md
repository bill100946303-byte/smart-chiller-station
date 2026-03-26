# Chiller 2.0 Phase-1 Kickoff

## Frozen Decisions

- New UI shell is a standalone app at:
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1`
- Legacy packaged Vue output remains reference-only.
- V1 page scope is fixed:
  - `login`
  - `dashboard`
  - `system-overview`
- BFF P0 contracts are fixed:
  - `GET /bff/v1/sites/{siteId}/dashboard/overview`
  - `GET /bff/v1/sites/{siteId}/dashboard/trends`
  - `GET /bff/v1/sites/{siteId}/anomalies/summary`

## Data Caveats (must be explicit in V1)

- `totalElectricity` is cumulative energy, not realtime power.
- Cooling tower is a composed logical asset:
  - `CTF + CTE + CTHDE`
- `totalCoolingCapacity` and `instantaneousHeatDissipation` may be stale or zero for long windows.

## Delivery Order

1. Shell UI (done): login, dashboard, system-overview skeleton.
2. BFF OpenAPI + DTO schema.
3. Legacy adapters:
   - `legacyEnergyAdapter`
   - `legacyAlarmAdapter`
   - `legacyDeviceAdapter`
4. Wire dashboard with real aggregated data.
5. Wire anomalies and freshness state.
6. Add topology static graph from normalized device groups.

## Current Status

- Shell scaffold compiles successfully with `npm run build`.
- UI style tokens and base component primitives are in place.
- BFF scaffold is now available at:
  - `/Users/billchow/Documents/智慧冷冻站/apps/chiller-bff`
- P0 aggregate services are implemented:
  - `dashboard/overview`
  - `dashboard/trends`
  - `anomalies/summary`
- Because legacy backend is currently offline in this runtime, BFF responses fall back to explicit `sourceStatus` errors and `stale` freshness flags, which is expected.

## Master Control Scripts

- Start local stack:
  - `/Users/billchow/Documents/智慧冷冻站/scripts/start_local_stack.sh`
- Check end-to-end status:
  - `/Users/billchow/Documents/智慧冷冻站/scripts/check_stack.sh 126lnoffice`
- Stop local stack:
  - `/Users/billchow/Documents/智慧冷冻站/scripts/stop_local_stack.sh`
