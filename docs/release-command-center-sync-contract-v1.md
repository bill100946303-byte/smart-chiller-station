# release-command-center-sync contract v1

## Purpose
- `release-command-center-sync` is the one-shot sync chain for release duty.
- It runs command-center sync, validates command-center latest, syncs latest-check, and validates latest-check.
- It is the recommended top-level operator entry when a fresh latest state is needed.

## Commands
- `./scripts/chiller_ctl.sh release-command-center-sync`
- `./scripts/chiller_ctl.sh release-command-center-sync --json`
- `./scripts/chiller_ctl.sh release-command-center-sync-latest`
- `./scripts/chiller_ctl.sh release-command-center-sync-latest --json`
- `./scripts/chiller_ctl.sh release-command-center-sync-check`
- `./scripts/chiller_ctl.sh release-command-center-sync-check --selftest`

## Output file
- `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-sync-latest.json`

## Required fields
- `version`
- `generatedAt`
- `source`
- `decision`
- `summaryClass`
- `exitCode`
- `reasons`
- `advisories`
- `firstAction`
- `steps`
- `releaseCommandCenter`
- `releaseCommandCenterLatestCheck`
- `artifacts`

## Step semantics
- `steps.releaseCommandCenterSync`
- `steps.releaseCommandCenterCheck`
- `steps.releaseCommandCenterLatestCheckSync`
- `steps.releaseCommandCenterLatestCheck`

Each step must expose:
- `ok`
- `exitCode`

## Decision semantics
- `decision=GO` requires `exitCode=0`
- `decision=NO-GO` requires `exitCode=1`
- `summaryClass=blocked` requires `decision=NO-GO`
- `summaryClass=ready` requires `decision=GO`

## Validation
- npm script:
  - `npm run check:release-command-center-sync`
- selftest:
  - `RELEASE_COMMAND_CENTER_SYNC_SELFTEST=1 npm run check:release-command-center-sync`
- error format:
  - `<json_path>: <error_message>`

## Boundary
- does not affect `check:contract`
- does not affect OpenAPI main schema
- composes only existing release-command-center latest artifacts
