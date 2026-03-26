# release-command-center contract v1

## Purpose
- `release-command-center` is the top-level release summary for operators.
- It aggregates existing outputs only and does not replace `check:contract` or change business rules.
- It is intended to answer three questions in one place: can we release, why, and what should we do first.

## Commands
- `./scripts/chiller_ctl.sh release-command-center`
- `./scripts/chiller_ctl.sh release-command-center --json`
- `./scripts/chiller_ctl.sh release-command-center-latest`
- `./scripts/chiller_ctl.sh release-command-center-check`
- `./scripts/chiller_ctl.sh release-command-center-check --selftest`

## Output file
- JSON latest:
  - `/Users/billchow/Documents/智慧冷冻站/docs/release-command-center-latest.json`

## Required fields
- `version`: string
- `generatedAt`: string
- `source`: string, current value `aggregated_latest`
- `decision`: `GO | NO-GO`
- `summaryClass`: `ready | blocked | review_required`
- `exitCode`: `0 | 1`
- `reasons`: snake_case string array
- `advisories`: snake_case string array
- `firstAction`: string
- `gates`: object
- `releaseReadyLatest`: object
- `releaseReadyLatestCheck`: object
- `releaseReadyConsistency`: object
- `checkFamilyLatest`: object
- `checkFamilyBriefLatest`: object
- `artifacts`: object

## Gate semantics
- `decision=GO` requires `exitCode=0` and `reasons=[]`.
- `decision=NO-GO` requires `exitCode=1`.
- `summaryClass=blocked` requires `decision=NO-GO`.
- `summaryClass=ready` requires `decision=GO` and `advisories=[]`.
- `summaryClass=review_required` is allowed only when `decision=GO` and at least one advisory exists.

## Validation
- npm script:
  - `npm run check:release-command-center`
- selftest:
  - `RELEASE_COMMAND_CENTER_SELFTEST=1 npm run check:release-command-center`
- error format:
  - `<json_path>: <error_message>`

## Compatibility boundary
- does not modify `check:contract`
- does not modify OpenAPI main schema
- only composes latest artifacts from:
  - `release-ready-latest.json`
  - `release-ready-latest-check.json`
  - `release-ready-consistency-latest.json`
  - `check-family-latest.json`
  - `check-family-brief-latest.json`
