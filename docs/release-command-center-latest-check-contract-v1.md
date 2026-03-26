# release-command-center-latest-check contract v1

## Purpose
- `release-command-center-latest-check` is the stable projection layer for the command-center latest snapshot.
- It is intended for UI and operator consumption when they need a compact, validated latest view.
- It does not change `check:contract` and does not modify OpenAPI main schema.

## Commands
- `./scripts/chiller_ctl.sh release-command-center-latest-check-sync`
- `./scripts/chiller_ctl.sh release-command-center-latest-check-sync --json`
- `./scripts/chiller_ctl.sh release-command-center-latest-check`
- `./scripts/chiller_ctl.sh release-command-center-latest-check --selftest`

## Output file
- `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest-check.json`

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
- `consistencyOk`
- `upstreamGeneratedAt`
- `upstreamPath`

## Semantics
- `source` is fixed to `latest_file`
- `decision` is the final release summary state from command-center latest
- `summaryClass` is one of:
  - `ready`
  - `blocked`
  - `review_required`
- `consistencyOk` is `true` only when:
  - `releaseReadyConsistencyPayload.ok=true`
  - `checkFamily.ok=true`
  - `checkFamilyBrief.ok=true`

## Validation
- npm script:
  - `npm run check:release-command-center-latest-check`
- selftest:
  - `RELEASE_COMMAND_CENTER_LATEST_CHECK_SELFTEST=1 npm run check:release-command-center-latest-check`
- error format:
  - `<json_path>: <error_message>`

## Boundary
- does not affect `check:contract`
- does not affect OpenAPI main schema
- is derived only from:
  - `docs/release-command-center-latest.json`
