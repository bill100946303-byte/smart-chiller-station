#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
ENTRY_SCRIPT="${ROOT_DIR}/scripts/manage_3001_entry.sh"
STACK_SCRIPT="${ROOT_DIR}/scripts/check_stack.sh"
START_LOCAL_STACK_SCRIPT="${ROOT_DIR}/scripts/start_local_stack.sh"
STOP_LOCAL_STACK_SCRIPT="${ROOT_DIR}/scripts/stop_local_stack.sh"
LEGACY_BACKEND_SCRIPT="/Users/billchow/Documents/chiller-station-legacy/scripts/start_backend_local.sh"
ACCEPT_SCRIPT="${ROOT_DIR}/scripts/v19_2_acceptance.sh"
PREFLIGHT_SCRIPT="${ROOT_DIR}/scripts/release_preflight_v1_8.sh"
REPORT_JSON="${ROOT_DIR}/docs/v19.2-acceptance-report.json"
REPORT_UNAVAILABLE_JSON="${ROOT_DIR}/docs/v19.2-acceptance-report.unavailable.json"
RELEASE_GATE_LATEST_JSON="${ROOT_DIR}/docs/release-gate-latest.json"
RELEASE_GATE_LATEST_MD="${ROOT_DIR}/docs/release-gate-latest.md"
RELEASE_SNAPSHOT_LATEST_JSON="${ROOT_DIR}/docs/release-snapshot-latest.json"
RELEASE_SNAPSHOT_LATEST_MD="${ROOT_DIR}/docs/release-snapshot-latest.md"
RELEASE_SNAPSHOT_ARCHIVE_DIR="${ROOT_DIR}/docs/release-snapshots"
RELEASE_SNAPSHOT_INDEX_LATEST_JSON="${ROOT_DIR}/docs/release-snapshot-index-latest.json"
RELEASE_SNAPSHOT_INDEX_LATEST_MD="${ROOT_DIR}/docs/release-snapshot-index-latest.md"
RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON="${ROOT_DIR}/docs/release-snapshot-consistency-latest.json"
RELEASE_SNAPSHOT_CONSISTENCY_LATEST_MD="${ROOT_DIR}/docs/release-snapshot-consistency-latest.md"
RELEASE_SNAPSHOT_DIFF_LATEST_JSON="${ROOT_DIR}/docs/release-snapshot-diff-latest.json"
RELEASE_SNAPSHOT_DIFF_LATEST_MD="${ROOT_DIR}/docs/release-snapshot-diff-latest.md"
RELEASE_READY_LATEST_JSON="${ROOT_DIR}/docs/release-ready-latest.json"
RELEASE_READY_LATEST_MD="${ROOT_DIR}/docs/release-ready-latest.md"
RELEASE_READY_CONSISTENCY_LATEST_JSON="${ROOT_DIR}/docs/release-ready-consistency-latest.json"
RELEASE_READY_SYNC_LATEST_JSON="${ROOT_DIR}/docs/release-ready-sync-latest.json"
RELEASE_READY_VERIFY_LOG="${ROOT_DIR}/docs/release-ready-verify-gates.log"
RELEASE_COMMAND_CENTER_LATEST_JSON="${ROOT_DIR}/docs/release-command-center-latest.json"
RELEASE_COMMAND_CENTER_LATEST_CHECK_JSON="${ROOT_DIR}/docs/release-command-center-latest-check.json"
RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON="${ROOT_DIR}/docs/release-command-center-sync-latest.json"
VERIFY_GATES_LATEST_JSON="${ROOT_DIR}/docs/verify-gates-latest.json"
CHECK_FAMILY_LATEST_JSON="${ROOT_DIR}/docs/check-family-latest.json"
CHECK_FAMILY_BRIEF_LATEST_JSON="${ROOT_DIR}/docs/check-family-brief-latest.json"
FRESH_WARN_MIN="${FRESH_WARN_MIN:-30}"
FRESH_STALE_MIN="${FRESH_STALE_MIN:-60}"

usage() {
  cat <<'EOF'
统一控制入口（V19.2）

Usage:
  chiller_ctl.sh status
  chiller_ctl.sh runtime-start
  chiller_ctl.sh runtime-stop
  chiller_ctl.sh runtime-status [--json]
  chiller_ctl.sh status-json [--live] [--strict-freshness]
  chiller_ctl.sh release-gate [--strict-freshness] [--json]
  chiller_ctl.sh release-gate-latest [--strict-freshness]
  chiller_ctl.sh release-snapshot [--strict-freshness] [--runtime-required=0|1] [--json]
  chiller_ctl.sh release-snapshot-index [--limit=N] [--json]
  chiller_ctl.sh release-snapshot-consistency [--json] [--no-refresh-index]
  chiller_ctl.sh release-snapshot-diff [--json] [--no-refresh-index]
  chiller_ctl.sh release-ready [--strict-freshness] [--runtime-required=0|1] [--json]
  chiller_ctl.sh release-command-center [--json]
  chiller_ctl.sh release-command-center-sync [--json]
  chiller_ctl.sh release-command-center-sync-latest [--json]
  chiller_ctl.sh release-command-center-sync-check [--selftest]
  chiller_ctl.sh release-command-center-latest [--json]
  chiller_ctl.sh release-command-center-check [--selftest]
  chiller_ctl.sh release-command-center-latest-check [--selftest]
  chiller_ctl.sh release-command-center-latest-check-sync [--json]
  chiller_ctl.sh release-ready-consistency-sync [--json]
  chiller_ctl.sh release-ready-consistency-latest [--json]
  chiller_ctl.sh release-ready-consistency-check [--selftest]
  chiller_ctl.sh release-ready-latest [--json]
  chiller_ctl.sh release-ready-check [--selftest]
  chiller_ctl.sh release-ready-latest-check [--selftest]
  chiller_ctl.sh release-ready-latest-check-sync [--json]
  chiller_ctl.sh release-ready-sync-check [--selftest]
  chiller_ctl.sh release-ready-sync-latest-check [--selftest]
  chiller_ctl.sh release-ready-sync [--recompute] [--strict-freshness] [--runtime-required=0|1] [--json]
  chiller_ctl.sh release-ready-sync-latest [--json]
  chiller_ctl.sh release-ready-brief [--json]
  chiller_ctl.sh release-ready-brief-check [--selftest]
  chiller_ctl.sh check [SITE_ID]
  chiller_ctl.sh accept [--dry-run]
  chiller_ctl.sh accept-contract
  chiller_ctl.sh verify-gates [--json]
  chiller_ctl.sh verify-gates-latest [--json]
  chiller_ctl.sh verify-gates-check [--selftest]
  chiller_ctl.sh verify-gates-latest-check [--selftest]
  chiller_ctl.sh check-family [--json]
  chiller_ctl.sh check-family-latest [--json]
  chiller_ctl.sh check-family-check [--selftest]
  chiller_ctl.sh check-family-brief [--json]
  chiller_ctl.sh check-family-brief-latest [--json]
  chiller_ctl.sh check-family-brief-check [--selftest]
  chiller_ctl.sh check-family-consistency-check [--selftest]
  chiller_ctl.sh check-family-freshness-check [--max-age-min=N] [--selftest]
  chiller_ctl.sh preflight [--strict-freshness]
  chiller_ctl.sh switch-shell
  chiller_ctl.sh switch-legacy

Examples:
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh runtime-start
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh runtime-stop
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh runtime-status
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh status-json --live --strict-freshness
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate --strict-freshness
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-gate-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot --runtime-required=0
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot --strict-freshness --runtime-required=1
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-index --limit=10
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-consistency
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-snapshot-diff
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready --runtime-required=0
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-sync
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-sync --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-sync-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-latest-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-command-center-latest-check-sync
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-sync --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-consistency-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-latest-check-sync
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync --recompute --runtime-required=0
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-sync-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh release-ready-brief-check
  SITE_ID=126lnoffice /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept --dry-run
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh accept-contract
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh verify-gates-latest-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief --json
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-latest
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-brief-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-consistency-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-freshness-check
  /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh check-family-freshness-check --max-age-min=60
  RUNTIME_REQUIRED=0 /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight
  RUNTIME_REQUIRED=0 /Users/billchow/Documents/智慧冷冻站/scripts/chiller_ctl.sh preflight --strict-freshness
EOF
}

status_json_cmd() {
  local live_mode strict_mode gate_live_rc
  local canonical_exists unavailable_exists gate_exists
  local canonical_src unavailable_src gate_src gate_live_src
  local canonical_tmp unavailable_tmp gate_tmp

  live_mode="false"
  strict_mode="false"
  gate_live_rc=0
  canonical_exists="false"
  unavailable_exists="false"
  gate_exists="false"
  canonical_tmp=""
  unavailable_tmp=""
  gate_tmp=""

  while [ $# -gt 0 ]; do
    case "${1}" in
      --live)
        live_mode="true"
        ;;
      --strict-freshness)
        strict_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown status-json arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ -f "${REPORT_JSON}" ]; then
    canonical_exists="true"
    canonical_src="${REPORT_JSON}"
  else
    canonical_tmp="$(mktemp)"
    printf 'null\n' >"${canonical_tmp}"
    canonical_src="${canonical_tmp}"
  fi

  if [ -f "${REPORT_UNAVAILABLE_JSON}" ]; then
    unavailable_exists="true"
    unavailable_src="${REPORT_UNAVAILABLE_JSON}"
  else
    unavailable_tmp="$(mktemp)"
    printf 'null\n' >"${unavailable_tmp}"
    unavailable_src="${unavailable_tmp}"
  fi

  if [ -f "${RELEASE_GATE_LATEST_JSON}" ]; then
    gate_exists="true"
    gate_src="${RELEASE_GATE_LATEST_JSON}"
  else
    gate_tmp="$(mktemp)"
    printf 'null\n' >"${gate_tmp}"
    gate_src="${gate_tmp}"
  fi

  gate_live_src="$(mktemp)"
  printf 'null\n' >"${gate_live_src}"
  if [ "${live_mode}" = "true" ]; then
    set +e
    if [ "${strict_mode}" = "true" ]; then
      release_gate_cmd --strict-freshness --json >"${gate_live_src}"
    else
      release_gate_cmd --json >"${gate_live_src}"
    fi
    gate_live_rc=$?
    set -e
  fi

  jq -n \
    --arg rootDir "${ROOT_DIR}" \
    --arg reportPath "${REPORT_JSON}" \
    --arg unavailablePath "${REPORT_UNAVAILABLE_JSON}" \
    --arg gatePath "${RELEASE_GATE_LATEST_JSON}" \
    --arg canonicalExists "${canonical_exists}" \
    --arg unavailableExists "${unavailable_exists}" \
    --arg gateExists "${gate_exists}" \
    --arg liveMode "${live_mode}" \
    --arg strictMode "${strict_mode}" \
    --argjson gateLiveRc "${gate_live_rc}" \
    --slurpfile canonical "${canonical_src}" \
    --slurpfile unavailable "${unavailable_src}" \
    --slurpfile gate "${gate_src}" \
    --slurpfile gateLive "${gate_live_src}" '
    def canonicalObj: if $canonicalExists == "true" then ($canonical[0] // null) else null end;
    def unavailableObj: if $unavailableExists == "true" then ($unavailable[0] // null) else null end;
    def latestGateObj: if $gateExists == "true" then ($gate[0] // null) else null end;
    def liveGateObj: if $liveMode == "true" then ($gateLive[0] // null) else null end;
    def chosenGate:
      if liveGateObj != null then liveGateObj
      elif latestGateObj != null then latestGateObj
      else null
      end;
    def summary:
      if canonicalObj == null then
        {
          entryMode: "unknown",
          releaseDecision: "NO-GO",
          overallPass: false,
          releaseGateSource: (if liveGateObj != null then "live" elif latestGateObj != null then "latest_file" else "none" end),
          strictFreshnessPreview: ($strictMode == "true"),
          recommendedAction: ("run accept first: " + $rootDir + "/scripts/chiller_ctl.sh accept")
        }
      else
        {
          entryMode: (canonicalObj.entry.mode // "unknown"),
          releaseDecision: (if chosenGate != null then (chosenGate.decision // "NO-GO") else "NO-GO" end),
          overallPass: (canonicalObj.overallPass // false),
          releaseGateSource: (if liveGateObj != null then "live" elif latestGateObj != null then "latest_file" else "none" end),
          strictFreshnessPreview: ($strictMode == "true"),
          recommendedAction:
            (if chosenGate == null then
              ("run release gate sync: " + $rootDir + "/scripts/chiller_ctl.sh release-gate-latest")
            elif (chosenGate.decision // "NO-GO") != "GO" then
              "do not release; inspect reasons/advisories and rerun acceptance"
            elif (canonicalObj.overallPass // false) != true then
              "acceptance not pass; rerun check and fix failed gates"
            else
              "release candidate is ready under default policy"
            end)
        }
      end;
    {
      source: (if canonicalObj != null then "canonical" else "missing" end),
      files: {
        canonical: {path: $reportPath, exists: ($canonicalExists == "true")},
        unavailable: {path: $unavailablePath, exists: ($unavailableExists == "true")},
        releaseGateLatest: {path: $gatePath, exists: ($gateExists == "true")}
      },
      summary: summary,
      canonical: canonicalObj,
      unavailable: unavailableObj,
      releaseGateLatest: latestGateObj,
      releaseGateLive: liveGateObj,
      releaseGateLiveExitCode: (if $liveMode == "true" then $gateLiveRc else null end),
      error: (if canonicalObj == null then ("acceptance report not found: " + $reportPath) else null end)
    }'

  rm -f "${gate_live_src}"
  if [ -n "${canonical_tmp}" ]; then
    rm -f "${canonical_tmp}"
  fi
  if [ -n "${unavailable_tmp}" ]; then
    rm -f "${unavailable_tmp}"
  fi
  if [ -n "${gate_tmp}" ]; then
    rm -f "${gate_tmp}"
  fi
}

status_cmd() {
  echo "== Entry Status =="
  "${ENTRY_SCRIPT}" status || true
  echo ""
  echo "== Acceptance Snapshot =="
  if [ -f "${REPORT_JSON}" ]; then
    jq -r '
      "version=\(.version // "unknown")",
      "generatedAt=\(.generatedAt // "unknown")",
      "siteId=\(.siteId // "unknown")",
      "entry.mode=\(.entry.mode // "unknown")",
      "contract.ok=\(.contract.ok // false)",
      "stack.ok=\(.stack.ok // false)",
      "readiness.nonDegradedReady=\(.readiness.nonDegradedReady // false)",
      "badge.globalPass=\(.badge.globalPass // false)",
      "overallPass=\(.overallPass // false)"
    ' "${REPORT_JSON}" || true
    if [ -f "${REPORT_UNAVAILABLE_JSON}" ]; then
      echo ""
      echo "== Runtime-Unavailable Snapshot (diagnostic) =="
      jq -r '
        "generatedAt=\(.generatedAt // "unknown")",
        "runtimeUnavailable=\(.runtimeUnavailable // false)",
        "overallPass=\(.overallPass // false)",
        "stack.ok=\(.stack.ok // false)",
        "hint=canonical snapshot is preserved; this file is diagnostic only"
      ' "${REPORT_UNAVAILABLE_JSON}" || true
    fi
  else
    echo "acceptance report not found: ${REPORT_JSON}"
    echo "run: ${0} accept"
  fi
}

runtime_start_cmd() {
  if [ ! -x "${START_LOCAL_STACK_SCRIPT}" ]; then
    echo "[FAIL] start_local_stack script not found: ${START_LOCAL_STACK_SCRIPT}"
    return 1
  fi
  if [ ! -x "${LEGACY_BACKEND_SCRIPT}" ]; then
    echo "[FAIL] legacy backend script not found: ${LEGACY_BACKEND_SCRIPT}"
    return 1
  fi
  if ! /opt/homebrew/opt/redis/bin/redis-cli PING >/dev/null 2>&1; then
    brew services start redis >/dev/null 2>&1 || true
  fi
  "${START_LOCAL_STACK_SCRIPT}"
  "${LEGACY_BACKEND_SCRIPT}" start
  runtime_status_cmd
}

runtime_stop_cmd() {
  local rc=0
  if [ -x "${STOP_LOCAL_STACK_SCRIPT}" ]; then
    "${STOP_LOCAL_STACK_SCRIPT}" || rc=$?
  fi
  if [ -x "${LEGACY_BACKEND_SCRIPT}" ]; then
    "${LEGACY_BACKEND_SCRIPT}" stop || rc=$?
  fi
  return "${rc}"
}

runtime_status_cmd() {
  local json_mode="false"
  local frontend_ok="false"
  local bff_ok="false"
  local legacy_ok="false"
  local redis_ok="false"
  local frontend_code="000"
  local bff_code="000"
  local legacy_code="000"

  if [ "${1:-}" = "--json" ]; then
    json_mode="true"
  elif [ -n "${1:-}" ]; then
    echo "[FAIL] Unknown runtime-status arg: ${1}"
    return 2
  fi

  frontend_code="$(curl -sS -m 5 -o /tmp/chiller_runtime_frontend_probe.html -w '%{http_code}' http://127.0.0.1:3001/dashboard || true)"
  bff_code="$(curl -sS -m 5 -o /tmp/chiller_runtime_bff_probe.json -w '%{http_code}' http://127.0.0.1:8787/healthz || true)"
  legacy_code="$(curl -sS -m 5 -o /tmp/chiller_runtime_legacy_probe.json -w '%{http_code}' 'http://127.0.0.1:8098/user/login?username=probe&password=probe' || true)"

  [ "${frontend_code}" = "200" ] && frontend_ok="true"
  [ "${bff_code}" = "200" ] && bff_ok="true"
  [ "${legacy_code}" = "200" ] && legacy_ok="true"
  if /opt/homebrew/opt/redis/bin/redis-cli PING >/tmp/chiller_runtime_redis_probe.txt 2>&1; then
    redis_ok="true"
  fi

  if [ "${json_mode}" = "true" ]; then
    jq -n \
      --arg frontendOk "${frontend_ok}" \
      --arg frontendCode "${frontend_code}" \
      --arg bffOk "${bff_ok}" \
      --arg bffCode "${bff_code}" \
      --arg legacyOk "${legacy_ok}" \
      --arg legacyCode "${legacy_code}" \
      --arg redisOk "${redis_ok}" \
      '{
        frontend: {ok: ($frontendOk == "true"), port: 3001, httpCode: ($frontendCode|tonumber? // null)},
        bff: {ok: ($bffOk == "true"), port: 8787, httpCode: ($bffCode|tonumber? // null)},
        legacy: {ok: ($legacyOk == "true"), port: 8098, httpCode: ($legacyCode|tonumber? // null)},
        redis: {ok: ($redisOk == "true"), port: 6379},
        overall: {
          runtimeChainOk: (($frontendOk == "true") and ($bffOk == "true") and ($legacyOk == "true")),
          dataCompletenessEnhanced: ($redisOk == "true")
        }
      }'
  else
    echo "== Runtime Status =="
    echo "frontend.3001=${frontend_ok} (http=${frontend_code})"
    echo "bff.8787=${bff_ok} (http=${bff_code})"
    echo "legacy.8098=${legacy_ok} (http=${legacy_code})"
    echo "redis.6379=${redis_ok}"
    if [ "${frontend_ok}" = "true" ] && [ "${bff_ok}" = "true" ] && [ "${legacy_ok}" = "true" ]; then
      echo "runtimeChain=ok"
    else
      echo "runtimeChain=not_ready"
    fi
    if [ "${redis_ok}" = "true" ]; then
      echo "runtimeDataCompleteness=enhanced"
    else
      echo "runtimeDataCompleteness=partial_without_redis"
    fi
  fi
}

check_cmd() {
  local site="${1:-${SITE_ID:-126lnoffice}}"
  SITE_ID="${site}" "${STACK_SCRIPT}"
}

accept_cmd() {
  local mode="${1:-}"
  if [ "${mode}" = "--dry-run" ]; then
    DRY_RUN=1 bash "${ACCEPT_SCRIPT}"
    return 0
  fi
  bash "${ACCEPT_SCRIPT}"
}

accept_contract_cmd() {
  (cd "${BFF_DIR}" && npm run check:acceptance-report)
}

verify_gates_cmd() {
  local mode="${1:-}"
  case "${mode}" in
    "" )
      echo "== Gate Verify =="
      echo "[1/7] acceptance-report contract"
      (cd "${BFF_DIR}" && npm run check:acceptance-report)
      echo "[2/7] status-json contract"
      (cd "${BFF_DIR}" && npm run check:status-json)
      if [ ! -f "${RELEASE_SNAPSHOT_LATEST_JSON}" ]; then
        release_snapshot_cmd --runtime-required=0 --json >/dev/null || true
      fi
      echo "[3/7] release-snapshot contract"
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_PATH="${RELEASE_SNAPSHOT_LATEST_JSON}" npm run check:release-snapshot)
      if [ ! -f "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" ]; then
        release_snapshot_index_cmd --limit=20 --json >/dev/null || true
      fi
      echo "[4/7] release-snapshot-index contract"
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_INDEX_PATH="${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" npm run check:release-snapshot-index)
      if [ ! -f "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" ]; then
        release_snapshot_diff_cmd --json >/dev/null || true
      fi
      echo "[5/7] release-snapshot-diff contract"
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_DIFF_PATH="${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" npm run check:release-snapshot-diff)
      echo "[6/7] release-snapshot consistency"
      release_snapshot_consistency_cmd --json >/dev/null
      if [ ! -f "${RELEASE_READY_SYNC_LATEST_JSON}" ]; then
        release_ready_sync_cmd --runtime-required=0 --json >/dev/null || true
      fi
      echo "[7/7] release-ready-brief contract"
      (cd "${BFF_DIR}" && RELEASE_READY_SYNC_PATH="${RELEASE_READY_SYNC_LATEST_JSON}" npm run check:release-ready-brief)
      echo "[OK] verify-gates passed"
      ;;
    --json)
      local rc1 rc2 rc3 rc4 rc5 rc6 rc7 overall overall_exit passed_count
      set +e
      (cd "${BFF_DIR}" && npm run check:acceptance-report >/dev/null 2>&1); rc1=$?
      (cd "${BFF_DIR}" && npm run check:status-json >/dev/null 2>&1); rc2=$?
      if [ ! -f "${RELEASE_SNAPSHOT_LATEST_JSON}" ]; then
        release_snapshot_cmd --runtime-required=0 --json >/dev/null 2>&1 || true
      fi
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_PATH="${RELEASE_SNAPSHOT_LATEST_JSON}" npm run check:release-snapshot >/dev/null 2>&1); rc3=$?
      if [ ! -f "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" ]; then
        release_snapshot_index_cmd --limit=20 --json >/dev/null 2>&1 || true
      fi
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_INDEX_PATH="${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" npm run check:release-snapshot-index >/dev/null 2>&1); rc4=$?
      if [ ! -f "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" ]; then
        release_snapshot_diff_cmd --json >/dev/null 2>&1 || true
      fi
      (cd "${BFF_DIR}" && RELEASE_SNAPSHOT_DIFF_PATH="${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" npm run check:release-snapshot-diff >/dev/null 2>&1); rc5=$?
      release_snapshot_consistency_cmd --json >/dev/null 2>&1; rc6=$?
      if [ ! -f "${RELEASE_READY_SYNC_LATEST_JSON}" ]; then
        release_ready_sync_cmd --runtime-required=0 --json >/dev/null 2>&1 || true
      fi
      (cd "${BFF_DIR}" && RELEASE_READY_SYNC_PATH="${RELEASE_READY_SYNC_LATEST_JSON}" npm run check:release-ready-brief >/dev/null 2>&1); rc7=$?
      set -e

      passed_count=0
      [ "${rc1}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc2}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc3}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc4}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc5}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc6}" -eq 0 ] && passed_count=$((passed_count + 1))
      [ "${rc7}" -eq 0 ] && passed_count=$((passed_count + 1))

      if [ "${passed_count}" -eq 7 ]; then
        overall="PASS"
      else
        overall="FAIL"
      fi
      if [ "${overall}" = "PASS" ]; then
        overall_exit=0
      else
        overall_exit=1
      fi

      local verify_tmp
      verify_tmp="$(mktemp)"
      jq -n \
        --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        --arg overall "${overall}" \
        --argjson passedCount "${passed_count}" \
        --argjson totalCount 7 \
        --argjson gate1 "${rc1}" \
        --argjson gate2 "${rc2}" \
        --argjson gate3 "${rc3}" \
        --argjson gate4 "${rc4}" \
        --argjson gate5 "${rc5}" \
        --argjson gate6 "${rc6}" \
        --argjson gate7 "${rc7}" \
        '{
          version: "v1.0",
          generatedAt: $now,
          overall: $overall,
          passedCount: $passedCount,
          totalCount: $totalCount,
          gates: [
            {name: "acceptance-report", ok: ($gate1 == 0), exitCode: $gate1},
            {name: "status-json", ok: ($gate2 == 0), exitCode: $gate2},
            {name: "release-snapshot", ok: ($gate3 == 0), exitCode: $gate3},
            {name: "release-snapshot-index", ok: ($gate4 == 0), exitCode: $gate4},
            {name: "release-snapshot-diff", ok: ($gate5 == 0), exitCode: $gate5},
            {name: "release-snapshot-consistency", ok: ($gate6 == 0), exitCode: $gate6},
            {name: "release-ready-brief", ok: ($gate7 == 0), exitCode: $gate7}
          ]
        }
        | .failedGates = ([.gates[] | select(.ok != true) | .name])
        | .failedCount = (.failedGates | length)
        ' >"${verify_tmp}"
      cat "${verify_tmp}"
      mv "${verify_tmp}" "${VERIFY_GATES_LATEST_JSON}"
      if [ "${overall}" = "PASS" ]; then
        return 0
      fi
      return "${overall_exit}"
      ;;
    *)
      echo "[FAIL] Unknown verify-gates arg: ${mode}"
      return 2
      ;;
  esac
}

verify_gates_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:verify-gates)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && VERIFY_GATES_SELFTEST=1 npm run check:verify-gates)
      ;;
    *)
      echo "[FAIL] Unknown verify-gates-check arg: ${arg}"
      return 2
      ;;
  esac
}

verify_gates_latest_cmd() {
  local json_mode
  json_mode="false"
  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown verify-gates-latest arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ ! -f "${VERIFY_GATES_LATEST_JSON}" ]; then
    echo "[FAIL] verify-gates latest file not found: ${VERIFY_GATES_LATEST_JSON}"
    echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh verify-gates --json"
    return 1
  fi

  if [ "${json_mode}" = "true" ]; then
    cat "${VERIFY_GATES_LATEST_JSON}"
  else
    echo "verifyGatesLatestJson=${VERIFY_GATES_LATEST_JSON}"
    jq -r '
      "overall=\(.overall // "FAIL")",
      "passed=\((.passedCount // 0))/\((.totalCount // 0))",
      "generatedAt=\(.generatedAt // "unknown")",
      "failedGates=\(
        ([
          (.gates // [])
          | .[]
          | select(.ok != true)
          | .name
        ] | if length > 0 then join(",") else "none" end)
      )"
    ' "${VERIFY_GATES_LATEST_JSON}"
  fi
}

check_family_cmd() {
  local mode="${1:-}"
  local rc
  case "${mode}" in
    "" )
      set +e
      (cd "${BFF_DIR}" && npm run sync:check-family)
      rc=$?
      set -e
      if [ ! -f "${CHECK_FAMILY_LATEST_JSON}" ]; then
        echo "[FAIL] check-family latest file not found: ${CHECK_FAMILY_LATEST_JSON}"
        return 1
      fi
      echo "checkFamilyLatestJson=${CHECK_FAMILY_LATEST_JSON}"
      jq -r '
        "overall=\(.overall // "FAIL")",
        "passed=\((.passedCount // 0))/\((.totalCount // 0))",
        "generatedAt=\(.generatedAt // "unknown")",
        "failedChecks=\(
          ([
            (.checks // [])
            | .[]
            | select(.ok != true)
            | .script
          ] | if length > 0 then join(",") else "none" end)
        )"
      ' "${CHECK_FAMILY_LATEST_JSON}"
      return "${rc}"
      ;;
    --json)
      set +e
      (cd "${BFF_DIR}" && npm run sync:check-family >/dev/null 2>&1)
      rc=$?
      set -e
      if [ ! -f "${CHECK_FAMILY_LATEST_JSON}" ]; then
        echo "[FAIL] check-family latest file not found: ${CHECK_FAMILY_LATEST_JSON}"
        return 1
      fi
      cat "${CHECK_FAMILY_LATEST_JSON}"
      return "${rc}"
      ;;
    *)
      echo "[FAIL] Unknown check-family arg: ${mode}"
      return 2
      ;;
  esac
}

check_family_latest_cmd() {
  local mode="${1:-}"
  case "${mode}" in
    "" )
      if [ ! -f "${CHECK_FAMILY_LATEST_JSON}" ]; then
        echo "[FAIL] check-family latest file not found: ${CHECK_FAMILY_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh check-family --json"
        return 1
      fi
      echo "checkFamilyLatestJson=${CHECK_FAMILY_LATEST_JSON}"
      jq -r '
        "overall=\(.overall // "FAIL")",
        "passed=\((.passedCount // 0))/\((.totalCount // 0))",
        "generatedAt=\(.generatedAt // "unknown")",
        "failedChecks=\(
          ([
            (.checks // [])
            | .[]
            | select(.ok != true)
            | .script
          ] | if length > 0 then join(",") else "none" end)
        )"
      ' "${CHECK_FAMILY_LATEST_JSON}"
      ;;
    --json)
      if [ ! -f "${CHECK_FAMILY_LATEST_JSON}" ]; then
        echo "[FAIL] check-family latest file not found: ${CHECK_FAMILY_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh check-family --json"
        return 1
      fi
      cat "${CHECK_FAMILY_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown check-family-latest arg: ${mode}"
      return 2
      ;;
  esac
}

check_family_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:check-family)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && CHECK_FAMILY_SELFTEST=1 npm run check:check-family)
      ;;
    *)
      echo "[FAIL] Unknown check-family-check arg: ${arg}"
      return 2
      ;;
  esac
}

check_family_freshness_check_cmd() {
  local arg="${1:-}"
  local max_age_min
  max_age_min="${CHECK_FAMILY_MAX_AGE_MIN:-60}"

  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && MAX_AGE_MIN="${max_age_min}" npm run check:check-family-freshness)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && CHECK_FAMILY_FRESHNESS_SELFTEST=1 npm run check:check-family-freshness)
      ;;
    --max-age-min=*)
      max_age_min="${arg#--max-age-min=}"
      (cd "${BFF_DIR}" && MAX_AGE_MIN="${max_age_min}" npm run check:check-family-freshness)
      ;;
    *)
      echo "[FAIL] Unknown check-family-freshness-check arg: ${arg}"
      return 2
      ;;
  esac
}

check_family_brief_cmd() {
  local mode="${1:-}"
  local rc
  case "${mode}" in
    "" )
      set +e
      (cd "${BFF_DIR}" && npm run sync:check-family-brief)
      rc=$?
      set -e
      if [ ! -f "${CHECK_FAMILY_BRIEF_LATEST_JSON}" ]; then
        echo "[FAIL] check-family brief latest file not found: ${CHECK_FAMILY_BRIEF_LATEST_JSON}"
        return 1
      fi
      echo "checkFamilyBriefLatestJson=${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      jq -r '
        "overall=\(.overall // "FAIL")",
        "passed=\((.passedCount // 0))/\((.totalCount // 0))",
        "freshness=\(.freshness.state // "unknown")",
        "failedCount=\(.failedCount // 0)",
        "topFailedChecks=\((if (.topFailedChecks|length)>0 then (.topFailedChecks|join(",")) else "none" end))"
      ' "${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      return "${rc}"
      ;;
    --json)
      set +e
      (cd "${BFF_DIR}" && npm run sync:check-family-brief >/dev/null 2>&1)
      rc=$?
      set -e
      if [ ! -f "${CHECK_FAMILY_BRIEF_LATEST_JSON}" ]; then
        echo "[FAIL] check-family brief latest file not found: ${CHECK_FAMILY_BRIEF_LATEST_JSON}"
        return 1
      fi
      cat "${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      return "${rc}"
      ;;
    *)
      echo "[FAIL] Unknown check-family-brief arg: ${mode}"
      return 2
      ;;
  esac
}

check_family_brief_latest_cmd() {
  local mode="${1:-}"
  case "${mode}" in
    "" )
      if [ ! -f "${CHECK_FAMILY_BRIEF_LATEST_JSON}" ]; then
        echo "[FAIL] check-family brief latest file not found: ${CHECK_FAMILY_BRIEF_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh check-family-brief --json"
        return 1
      fi
      echo "checkFamilyBriefLatestJson=${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      jq -r '
        "overall=\(.overall // "FAIL")",
        "passed=\((.passedCount // 0))/\((.totalCount // 0))",
        "freshness=\(.freshness.state // "unknown")",
        "failedCount=\(.failedCount // 0)",
        "topFailedChecks=\((if (.topFailedChecks|length)>0 then (.topFailedChecks|join(",")) else "none" end))"
      ' "${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      ;;
    --json)
      if [ ! -f "${CHECK_FAMILY_BRIEF_LATEST_JSON}" ]; then
        echo "[FAIL] check-family brief latest file not found: ${CHECK_FAMILY_BRIEF_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh check-family-brief --json"
        return 1
      fi
      cat "${CHECK_FAMILY_BRIEF_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown check-family-brief-latest arg: ${mode}"
      return 2
      ;;
  esac
}

check_family_brief_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:check-family-brief)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && CHECK_FAMILY_BRIEF_SELFTEST=1 npm run check:check-family-brief)
      ;;
    *)
      echo "[FAIL] Unknown check-family-brief-check arg: ${arg}"
      return 2
      ;;
  esac
}

check_family_consistency_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:check-family-consistency)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && CHECK_FAMILY_CONSISTENCY_SELFTEST=1 npm run check:check-family-consistency)
      ;;
    *)
      echo "[FAIL] Unknown check-family-consistency-check arg: ${arg}"
      return 2
      ;;
  esac
}

compute_age_minutes() {
  local ts="$1"
  if [ -z "${ts}" ]; then
    echo ""
    return 0
  fi
  node -e '
    const ts = process.argv[1];
    const t = Date.parse(ts);
    if (Number.isNaN(t)) process.exit(2);
    const diff = Math.floor((Date.now() - t) / 60000);
    process.stdout.write(String(diff));
  ' "${ts}" 2>/dev/null || echo ""
}

release_gate_cmd() {
  local contract_ok canonical_exists overall_pass decision exit_code
  local strict_mode json_mode generated_at age_min freshness_state
  local reasons_json reasons_joined advisories_json advisories_joined
  local unavailable_snapshot_present
  local -a reasons advisories
  contract_ok="false"
  canonical_exists="false"
  overall_pass="false"
  decision="NO-GO"
  exit_code=1
  strict_mode="false"
  json_mode="false"
  generated_at=""
  age_min=""
  freshness_state="unknown"
  unavailable_snapshot_present="false"

  while [ $# -gt 0 ]; do
    case "${1}" in
      --strict-freshness)
        strict_mode="true"
        ;;
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-gate arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if accept_contract_cmd >/dev/null 2>&1; then
    contract_ok="true"
  else
    reasons+=("contract_not_ok")
  fi

  if [ -f "${REPORT_JSON}" ]; then
    canonical_exists="true"
    overall_pass="$(jq -r '.overallPass // false' "${REPORT_JSON}" 2>/dev/null || echo "false")"
    generated_at="$(jq -r '.generatedAt // empty' "${REPORT_JSON}" 2>/dev/null || true)"
    age_min="$(compute_age_minutes "${generated_at}")"
    if [ -n "${age_min}" ] && echo "${age_min}" | grep -Eq '^-?[0-9]+$'; then
      if [ "${age_min}" -ge "${FRESH_STALE_MIN}" ]; then
        freshness_state="stale"
      elif [ "${age_min}" -ge "${FRESH_WARN_MIN}" ]; then
        freshness_state="warn"
      elif [ "${age_min}" -ge 0 ]; then
        freshness_state="fresh"
      fi
    fi
  else
    reasons+=("canonical_missing")
  fi

  if [ -f "${REPORT_UNAVAILABLE_JSON}" ]; then
    unavailable_snapshot_present="true"
    advisories+=("runtime_unavailable_snapshot_present")
  fi

  if [ "${contract_ok}" = "true" ] &&
    [ "${canonical_exists}" = "true" ] &&
    [ "${overall_pass}" = "true" ]; then
    decision="GO"
    exit_code=0
  elif [ "${canonical_exists}" = "true" ] &&
    [ "${overall_pass}" != "true" ]; then
    reasons+=("canonical_not_pass")
  fi

  if [ "${strict_mode}" = "true" ] && [ "${freshness_state}" != "fresh" ]; then
    reasons+=("freshness_not_fresh_strict")
    decision="NO-GO"
    exit_code=1
  fi

  if [ "${freshness_state}" = "warn" ]; then
    advisories+=("freshness_warn")
  fi

  if [ "${#reasons[@]}" -gt 0 ]; then
    reasons_json="$(printf '%s\n' "${reasons[@]}" | jq -Rsc 'split("\n") | map(select(length>0))')"
    reasons_joined="$(IFS=,; echo "${reasons[*]}")"
  else
    reasons_json="[]"
    reasons_joined="none"
  fi

  if [ "${#advisories[@]}" -gt 0 ]; then
    advisories_json="$(printf '%s\n' "${advisories[@]}" | jq -Rsc 'split("\n") | map(select(length>0))')"
    advisories_joined="$(IFS=,; echo "${advisories[*]}")"
  else
    advisories_json="[]"
    advisories_joined="none"
  fi

  if [ "${json_mode}" = "true" ]; then
    jq -n \
      --arg contractOk "${contract_ok}" \
      --arg canonicalExists "${canonical_exists}" \
      --arg canonicalOverallPass "${overall_pass}" \
      --arg canonicalGeneratedAt "${generated_at:-unknown}" \
      --arg canonicalAgeMin "${age_min:-unknown}" \
      --arg freshness "${freshness_state}" \
      --arg freshWarnMin "${FRESH_WARN_MIN}" \
      --arg freshStaleMin "${FRESH_STALE_MIN}" \
      --arg strictFreshness "${strict_mode}" \
      --arg decision "${decision}" \
      --argjson exitCode "${exit_code}" \
      --argjson reasons "${reasons_json}" \
      --argjson advisories "${advisories_json}" \
      --arg unavailableSnapshotPresent "${unavailable_snapshot_present}" \
      '{
        contractOk: ($contractOk == "true"),
        canonicalExists: ($canonicalExists == "true"),
        canonicalOverallPass: ($canonicalOverallPass == "true"),
        unavailableSnapshotPresent: ($unavailableSnapshotPresent == "true"),
        canonicalGeneratedAt: $canonicalGeneratedAt,
        canonicalAgeMin: (if ($canonicalAgeMin|test("^-?[0-9]+$")) then ($canonicalAgeMin|tonumber) else null end),
        freshness: $freshness,
        freshWarnMin: ($freshWarnMin|tonumber),
        freshStaleMin: ($freshStaleMin|tonumber),
        strictFreshness: ($strictFreshness == "true"),
        reasons: $reasons,
        advisories: $advisories,
        decision: $decision,
        exitCode: $exitCode
      }'
  else
    echo "== Release Gate =="
    echo "contractOk=${contract_ok}"
    echo "canonicalExists=${canonical_exists}"
    echo "canonicalOverallPass=${overall_pass}"
    echo "canonicalGeneratedAt=${generated_at:-unknown}"
    echo "canonicalAgeMin=${age_min:-unknown}"
    echo "freshness=${freshness_state}"
    echo "freshWarnMin=${FRESH_WARN_MIN}"
    echo "freshStaleMin=${FRESH_STALE_MIN}"
    echo "strictFreshness=${strict_mode}"
    echo "unavailableSnapshotPresent=${unavailable_snapshot_present}"
    echo "reasons=${reasons_joined}"
    echo "advisories=${advisories_joined}"
    echo "decision=${decision}"
    echo "exitCode=${exit_code}"
  fi

  return ${exit_code}
}

release_gate_latest_cmd() {
  local strict_arg gate_json gate_rc
  strict_arg=""
  if [ "${1:-}" = "--strict-freshness" ]; then
    strict_arg="--strict-freshness"
  fi

  set +e
  gate_json="$(release_gate_cmd ${strict_arg} --json)"
  gate_rc=$?
  set -e

  printf '%s\n' "${gate_json}" | jq . >"${RELEASE_GATE_LATEST_JSON}"
  node -e '
    const fs = require("fs");
    const p = process.argv[1];
    const out = process.argv[2];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    const lines = [
      "# Release Gate Latest",
      "",
      `- decision: **${j.decision}**`,
      `- exitCode: \`${j.exitCode}\``,
      `- contractOk: \`${j.contractOk}\``,
      `- canonicalExists: \`${j.canonicalExists}\``,
      `- canonicalOverallPass: \`${j.canonicalOverallPass}\``,
      `- freshness: \`${j.freshness}\``,
      `- strictFreshness: \`${j.strictFreshness}\``,
      `- reasons: \`${(j.reasons || []).join(",") || "none"}\``,
      `- advisories: \`${(j.advisories || []).join(",") || "none"}\``
    ];
    fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
  ' "${RELEASE_GATE_LATEST_JSON}" "${RELEASE_GATE_LATEST_MD}"

  echo "releaseGateLatestJson=${RELEASE_GATE_LATEST_JSON}"
  echo "releaseGateLatestMd=${RELEASE_GATE_LATEST_MD}"
  return ${gate_rc}
}

release_snapshot_cmd() {
  local strict_mode runtime_required json_mode
  local status_tmp preflight_log_tmp preflight_json_tmp
  local snapshot_stamp snapshot_archive_json snapshot_archive_md
  local verify_ok preflight_ok preflight_cmd_rc
  strict_mode="false"
  runtime_required="${RUNTIME_REQUIRED:-1}"
  json_mode="false"
  verify_ok="false"
  preflight_ok="false"
  preflight_cmd_rc=0

  while [ $# -gt 0 ]; do
    case "${1}" in
      --strict-freshness)
        strict_mode="true"
        ;;
      --runtime-required=0)
        runtime_required="0"
        ;;
      --runtime-required=1)
        runtime_required="1"
        ;;
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-snapshot arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  status_tmp="$(mktemp)"
  preflight_log_tmp="$(mktemp)"
  preflight_json_tmp="$(mktemp)"
  snapshot_stamp="$(date '+%Y%m%d-%H%M%S')"
  snapshot_archive_json="${RELEASE_SNAPSHOT_ARCHIVE_DIR}/release-snapshot-${snapshot_stamp}.json"
  snapshot_archive_md="${RELEASE_SNAPSHOT_ARCHIVE_DIR}/release-snapshot-${snapshot_stamp}.md"

  if [ "${strict_mode}" = "true" ]; then
    status_json_cmd --live --strict-freshness >"${status_tmp}"
  else
    status_json_cmd --live >"${status_tmp}"
  fi

  set +e
  verify_gates_cmd >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    verify_ok="true"
  fi
  set -e

  set +e
  if [ "${strict_mode}" = "true" ]; then
    RUNTIME_REQUIRED="${runtime_required}" preflight_cmd --strict-freshness >"${preflight_log_tmp}" 2>&1
  else
    RUNTIME_REQUIRED="${runtime_required}" preflight_cmd >"${preflight_log_tmp}" 2>&1
  fi
  preflight_cmd_rc=$?
  set -e

  if [ -f "${ROOT_DIR}/docs/v1.8-release-preflight.json" ]; then
    cp "${ROOT_DIR}/docs/v1.8-release-preflight.json" "${preflight_json_tmp}"
    preflight_ok="true"
  fi

  node -e '
    const fs = require("fs");
    const statusPath = process.argv[1];
    const preflightPath = process.argv[2];
    const outJson = process.argv[3];
    const outMd = process.argv[4];
    const archiveJson = process.argv[5];
    const archiveMd = process.argv[6];
    const strictMode = process.argv[7] === "true";
    const runtimeRequired = process.argv[8] === "1";
    const verifyOk = process.argv[9] === "true";
    const preflightJsonExists = process.argv[10] === "true";
    const preflightCmdRc = Number(process.argv[11] || "0");
    const now = new Date().toISOString();

    const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
    const preflight = preflightJsonExists
      ? JSON.parse(fs.readFileSync(preflightPath, "utf8"))
      : null;

    const releaseGate = status.releaseGateLive || status.releaseGateLatest || null;
    const reasons = [];
    const advisories = [];

    if (!verifyOk) reasons.push("verify_gates_failed");
    if (!preflight) {
      reasons.push("preflight_report_missing");
    } else if (preflight.preflightPass !== true) {
      reasons.push("preflight_not_pass");
    }

    if (runtimeRequired === false) advisories.push("runtime_optional_mode");
    if (strictMode === true) advisories.push("strict_freshness_mode");
    if (releaseGate && Array.isArray(releaseGate.advisories)) {
      advisories.push(...releaseGate.advisories);
    }
    if (preflightCmdRc !== 0 && preflight && preflight.preflightPass === true) {
      advisories.push("preflight_cmd_nonzero_but_report_pass");
    }

    const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
    const finalReasons = uniq(reasons);
    const finalAdvisories = uniq(advisories);
    const decision = finalReasons.length === 0 ? "GO" : "NO-GO";
    const exitCode = decision === "GO" ? 0 : 1;

    const payload = {
      version: "v1.0",
      generatedAt: now,
      decision,
      exitCode,
      reasons: finalReasons,
      advisories: finalAdvisories,
      inputs: {
        strictFreshness: strictMode,
        runtimeRequired
      },
      checks: {
        verifyGatesOk: verifyOk,
        preflightCommandExitCode: preflightCmdRc,
        preflightReportExists: Boolean(preflight),
        preflightPass: preflight ? preflight.preflightPass === true : false
      },
      statusSummary: status.summary || null,
      releaseGate: releaseGate
        ? {
            decision: releaseGate.decision ?? null,
            reasons: releaseGate.reasons ?? [],
            advisories: releaseGate.advisories ?? [],
            strictFreshness: releaseGate.strictFreshness ?? null,
            freshness: releaseGate.freshness ?? null,
            source: status?.summary?.releaseGateSource ?? null
          }
        : null,
      preflight: preflight
        ? {
            preflightPass: preflight.preflightPass ?? null,
            gates: preflight.gates ?? null
          }
        : null,
      artifacts: {
        latestJson: outJson,
        latestMd: outMd,
        archiveJson,
        archiveMd
      }
    };

    fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + "\n", "utf8");

    const md = [
      "# Release Snapshot Latest",
      "",
      `- decision: **${payload.decision}**`,
      `- exitCode: \`${payload.exitCode}\``,
      `- strictFreshness: \`${payload.inputs.strictFreshness}\``,
      `- runtimeRequired: \`${payload.inputs.runtimeRequired}\``,
      `- verifyGatesOk: \`${payload.checks.verifyGatesOk}\``,
      `- preflightPass: \`${payload.checks.preflightPass}\``,
      `- reasons: \`${payload.reasons.join(",") || "none"}\``,
      `- advisories: \`${payload.advisories.join(",") || "none"}\``
    ].join("\n") + "\n";
    fs.writeFileSync(outMd, md, "utf8");
  ' "${status_tmp}" "${preflight_json_tmp}" "${RELEASE_SNAPSHOT_LATEST_JSON}" "${RELEASE_SNAPSHOT_LATEST_MD}" "${snapshot_archive_json}" "${snapshot_archive_md}" "${strict_mode}" "${runtime_required}" "${verify_ok}" "${preflight_ok}" "${preflight_cmd_rc}"

  mkdir -p "${RELEASE_SNAPSHOT_ARCHIVE_DIR}"
  cp "${RELEASE_SNAPSHOT_LATEST_JSON}" "${snapshot_archive_json}"
  cp "${RELEASE_SNAPSHOT_LATEST_MD}" "${snapshot_archive_md}"
  release_snapshot_index_cmd --limit=20 --json >/dev/null 2>&1 || true

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_SNAPSHOT_LATEST_JSON}"
  else
    echo "releaseSnapshotLatestJson=${RELEASE_SNAPSHOT_LATEST_JSON}"
    echo "releaseSnapshotLatestMd=${RELEASE_SNAPSHOT_LATEST_MD}"
    echo "releaseSnapshotArchiveJson=${snapshot_archive_json}"
    echo "releaseSnapshotArchiveMd=${snapshot_archive_md}"
    jq -r '"decision=\(.decision)\nexitCode=\(.exitCode)\nreasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))\nadvisories=\((if (.advisories|length)>0 then (.advisories|join(",")) else "none" end))"' "${RELEASE_SNAPSHOT_LATEST_JSON}"
  fi

  rm -f "${status_tmp}" "${preflight_log_tmp}" "${preflight_json_tmp}"
  if [ -f "${RELEASE_SNAPSHOT_LATEST_JSON}" ]; then
    return "$(jq -r '.exitCode // 1' "${RELEASE_SNAPSHOT_LATEST_JSON}")"
  fi
  return 1
}

release_snapshot_index_cmd() {
  local limit json_mode
  limit=10
  json_mode="false"

  while [ $# -gt 0 ]; do
    case "${1}" in
      --limit=*)
        limit="${1#--limit=}"
        ;;
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-snapshot-index arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if ! echo "${limit}" | grep -Eq '^[0-9]+$'; then
    echo "[FAIL] --limit must be a non-negative integer"
    return 2
  fi

  mkdir -p "${RELEASE_SNAPSHOT_ARCHIVE_DIR}"

  node -e '
    const fs = require("fs");
    const path = require("path");
    const archiveDir = process.argv[1];
    const outJson = process.argv[2];
    const outMd = process.argv[3];
    const limit = Number(process.argv[4] || "10");
    const now = new Date().toISOString();

    const files = fs.existsSync(archiveDir)
      ? fs.readdirSync(archiveDir).filter((name) => /^release-snapshot-\d{8}-\d{6}\.json$/.test(name))
      : [];

    const entries = files
      .map((name) => {
        const fullPath = path.join(archiveDir, name);
        try {
          const raw = fs.readFileSync(fullPath, "utf8");
          const parsed = JSON.parse(raw);
          const stat = fs.statSync(fullPath);
          return {
            file: fullPath,
            fileName: name,
            mtime: stat.mtime.toISOString(),
            generatedAt: parsed.generatedAt ?? null,
            decision: parsed.decision ?? "UNKNOWN",
            exitCode: Number.isInteger(parsed.exitCode) ? parsed.exitCode : null,
            reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
            advisories: Array.isArray(parsed.advisories) ? parsed.advisories : [],
            strictFreshness: parsed?.inputs?.strictFreshness ?? null,
            runtimeRequired: parsed?.inputs?.runtimeRequired ?? null
          };
        } catch (error) {
          return {
            file: fullPath,
            fileName: name,
            mtime: null,
            generatedAt: null,
            decision: "UNKNOWN",
            exitCode: null,
            reasons: ["snapshot_parse_failed"],
            advisories: [String(error.message || error)]
          };
        }
      })
      .sort((a, b) => {
        const at = a.generatedAt || a.mtime || "";
        const bt = b.generatedAt || b.mtime || "";
        return bt.localeCompare(at);
      });

    const sliced = entries.slice(0, limit);
    const summary = {
      total: entries.length,
      shown: sliced.length,
      go: sliced.filter((e) => e.decision === "GO").length,
      noGo: sliced.filter((e) => e.decision === "NO-GO").length,
      unknown: sliced.filter((e) => e.decision !== "GO" && e.decision !== "NO-GO").length
    };

    const payload = {
      version: "v1.0",
      generatedAt: now,
      limit,
      archiveDir,
      summary,
      entries: sliced
    };

    fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + "\n", "utf8");

    const md = [
      "# Release Snapshot Index Latest",
      "",
      `- total: \`${summary.total}\``,
      `- shown: \`${summary.shown}\``,
      `- go: \`${summary.go}\``,
      `- noGo: \`${summary.noGo}\``,
      `- unknown: \`${summary.unknown}\``,
      ""
    ];
    for (const e of sliced) {
      md.push(`- ${e.fileName}: \`${e.decision}\` reasons=\`${(e.reasons || []).join(",") || "none"}\` advisories=\`${(e.advisories || []).join(",") || "none"}\``);
    }
    fs.writeFileSync(outMd, md.join("\n") + "\n", "utf8");
  ' "${RELEASE_SNAPSHOT_ARCHIVE_DIR}" "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" "${RELEASE_SNAPSHOT_INDEX_LATEST_MD}" "${limit}"

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}"
  else
    echo "releaseSnapshotIndexLatestJson=${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}"
    echo "releaseSnapshotIndexLatestMd=${RELEASE_SNAPSHOT_INDEX_LATEST_MD}"
    jq -r '"total=\(.summary.total)\nshown=\(.summary.shown)\ngo=\(.summary.go)\nnoGo=\(.summary.noGo)\nunknown=\(.summary.unknown)"' "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}"
  fi
}

release_snapshot_consistency_cmd() {
  local json_mode refresh_index
  json_mode="false"
  refresh_index="true"

  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      --no-refresh-index)
        refresh_index="false"
        ;;
      *)
        echo "[FAIL] Unknown release-snapshot-consistency arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ "${refresh_index}" = "true" ]; then
    release_snapshot_index_cmd --limit=20 --json >/dev/null 2>&1 || true
  fi

  node -e '
    const fs = require("fs");
    const latestPath = process.argv[1];
    const indexPath = process.argv[2];
    const outJson = process.argv[3];
    const outMd = process.argv[4];
    const now = new Date().toISOString();

    const payload = {
      version: "v1.0",
      generatedAt: now,
      decision: "NO-GO",
      exitCode: 1,
      reasons: [],
      checks: {
        latestExists: false,
        indexExists: false,
        indexHasEntries: false,
        decisionMatch: false,
        reasonsMatch: false,
        advisoriesMatch: false
      },
      latest: null,
      indexNewest: null
    };

    const normalize = (arr) => (Array.isArray(arr) ? [...arr].filter((x) => typeof x === "string").sort() : []);
    const sameArray = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

    let latest = null;
    let idx = null;

    if (!fs.existsSync(latestPath)) {
      payload.reasons.push("latest_snapshot_missing");
    } else {
      payload.checks.latestExists = true;
      try {
        latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
      } catch {
        payload.reasons.push("latest_snapshot_invalid_json");
      }
    }

    if (!fs.existsSync(indexPath)) {
      payload.reasons.push("snapshot_index_missing");
    } else {
      payload.checks.indexExists = true;
      try {
        idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      } catch {
        payload.reasons.push("snapshot_index_invalid_json");
      }
    }

    const newest = idx && Array.isArray(idx.entries) && idx.entries.length > 0 ? idx.entries[0] : null;
    if (!newest) {
      payload.reasons.push("snapshot_index_empty");
    } else {
      payload.checks.indexHasEntries = true;
    }

    if (latest && newest) {
      payload.latest = {
        decision: latest.decision ?? null,
        reasons: latest.reasons ?? [],
        advisories: latest.advisories ?? [],
        generatedAt: latest.generatedAt ?? null
      };
      payload.indexNewest = {
        fileName: newest.fileName ?? null,
        decision: newest.decision ?? null,
        reasons: newest.reasons ?? [],
        advisories: newest.advisories ?? [],
        generatedAt: newest.generatedAt ?? null
      };

      payload.checks.decisionMatch = (latest.decision ?? null) === (newest.decision ?? null);
      payload.checks.reasonsMatch = sameArray(latest.reasons, newest.reasons);
      payload.checks.advisoriesMatch = sameArray(latest.advisories, newest.advisories);

      if (!payload.checks.decisionMatch || !payload.checks.reasonsMatch || !payload.checks.advisoriesMatch) {
        payload.reasons.push("snapshot_index_latest_mismatch");
      }
    }

    payload.reasons = [...new Set(payload.reasons)];
    if (payload.reasons.length === 0) {
      payload.decision = "GO";
      payload.exitCode = 0;
    }

    fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + "\n", "utf8");
    const md = [
      "# Release Snapshot Consistency Latest",
      "",
      `- decision: **${payload.decision}**`,
      `- exitCode: \`${payload.exitCode}\``,
      `- reasons: \`${payload.reasons.join(",") || "none"}\``,
      `- latestExists: \`${payload.checks.latestExists}\``,
      `- indexExists: \`${payload.checks.indexExists}\``,
      `- indexHasEntries: \`${payload.checks.indexHasEntries}\``,
      `- decisionMatch: \`${payload.checks.decisionMatch}\``,
      `- reasonsMatch: \`${payload.checks.reasonsMatch}\``,
      `- advisoriesMatch: \`${payload.checks.advisoriesMatch}\``
    ].join("\n") + "\n";
    fs.writeFileSync(outMd, md, "utf8");
  ' "${RELEASE_SNAPSHOT_LATEST_JSON}" "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}" "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_MD}"

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}"
  else
    echo "releaseSnapshotConsistencyLatestJson=${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}"
    echo "releaseSnapshotConsistencyLatestMd=${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_MD}"
    jq -r '"decision=\(.decision)\nexitCode=\(.exitCode)\nreasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))"' "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}"
  fi

  if [ -f "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}" ]; then
    return "$(jq -r '.exitCode // 1' "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}")"
  fi
  return 1
}

release_snapshot_diff_cmd() {
  local json_mode refresh_index
  json_mode="false"
  refresh_index="true"

  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      --no-refresh-index)
        refresh_index="false"
        ;;
      *)
        echo "[FAIL] Unknown release-snapshot-diff arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ "${refresh_index}" = "true" ]; then
    release_snapshot_index_cmd --limit=20 --json >/dev/null 2>&1 || true
  fi

  node -e '
    const fs = require("fs");
    const indexPath = process.argv[1];
    const outJson = process.argv[2];
    const outMd = process.argv[3];
    const now = new Date().toISOString();

    const uniqSorted = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).filter((x) => typeof x === "string"))).sort();
    const diffAdded = (current, previous) => {
      const c = new Set(uniqSorted(current));
      const p = new Set(uniqSorted(previous));
      return [...c].filter((x) => !p.has(x)).sort();
    };
    const diffRemoved = (current, previous) => {
      const c = new Set(uniqSorted(current));
      const p = new Set(uniqSorted(previous));
      return [...p].filter((x) => !c.has(x)).sort();
    };

    const payload = {
      version: "v1.0",
      generatedAt: now,
      hasPrevious: false,
      diffClass: "insufficient_history",
      current: null,
      previous: null,
      decisionChanged: null,
      reasonsAdded: [],
      reasonsRemoved: [],
      advisoriesAdded: [],
      advisoriesRemoved: [],
      reasons: [],
      exitCode: 0
    };

    if (!fs.existsSync(indexPath)) {
      payload.reasons = ["snapshot_index_missing"];
      payload.exitCode = 1;
      payload.diffClass = "error";
    } else {
      let idx = null;
      try {
        idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      } catch {
        payload.reasons = ["snapshot_index_invalid_json"];
        payload.exitCode = 1;
        payload.diffClass = "error";
      }

      if (idx && Array.isArray(idx.entries)) {
        const current = idx.entries[0] || null;
        const previous = idx.entries[1] || null;
        payload.current = current
          ? {
              fileName: current.fileName ?? null,
              generatedAt: current.generatedAt ?? null,
              decision: current.decision ?? "UNKNOWN",
              reasons: uniqSorted(current.reasons),
              advisories: uniqSorted(current.advisories)
            }
          : null;
        payload.previous = previous
          ? {
              fileName: previous.fileName ?? null,
              generatedAt: previous.generatedAt ?? null,
              decision: previous.decision ?? "UNKNOWN",
              reasons: uniqSorted(previous.reasons),
              advisories: uniqSorted(previous.advisories)
            }
          : null;

        if (!current) {
          payload.reasons = ["snapshot_index_empty"];
          payload.exitCode = 1;
          payload.diffClass = "error";
        } else if (!previous) {
          payload.hasPrevious = false;
          payload.diffClass = "insufficient_history";
        } else {
          payload.hasPrevious = true;
          payload.decisionChanged = payload.current.decision !== payload.previous.decision;
          payload.reasonsAdded = diffAdded(payload.current.reasons, payload.previous.reasons);
          payload.reasonsRemoved = diffRemoved(payload.current.reasons, payload.previous.reasons);
          payload.advisoriesAdded = diffAdded(payload.current.advisories, payload.previous.advisories);
          payload.advisoriesRemoved = diffRemoved(payload.current.advisories, payload.previous.advisories);

          if (payload.previous.decision === "GO" && payload.current.decision === "NO-GO") {
            payload.diffClass = "risk_up";
          } else if (payload.previous.decision === "NO-GO" && payload.current.decision === "GO") {
            payload.diffClass = "recovery";
          } else if (payload.decisionChanged === true) {
            payload.diffClass = "changed";
          } else {
            payload.diffClass = "stable";
          }
        }
      }
    }

    fs.writeFileSync(outJson, JSON.stringify(payload, null, 2) + "\n", "utf8");
    const md = [
      "# Release Snapshot Diff Latest",
      "",
      `- diffClass: \`${payload.diffClass}\``,
      `- hasPrevious: \`${payload.hasPrevious}\``,
      `- decisionChanged: \`${payload.decisionChanged}\``,
      `- reasonsAdded: \`${(payload.reasonsAdded || []).join(",") || "none"}\``,
      `- reasonsRemoved: \`${(payload.reasonsRemoved || []).join(",") || "none"}\``,
      `- advisoriesAdded: \`${(payload.advisoriesAdded || []).join(",") || "none"}\``,
      `- advisoriesRemoved: \`${(payload.advisoriesRemoved || []).join(",") || "none"}\``,
      `- reasons: \`${(payload.reasons || []).join(",") || "none"}\``
    ].join("\n") + "\n";
    fs.writeFileSync(outMd, md, "utf8");
  ' "${RELEASE_SNAPSHOT_INDEX_LATEST_JSON}" "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" "${RELEASE_SNAPSHOT_DIFF_LATEST_MD}"

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}"
  else
    echo "releaseSnapshotDiffLatestJson=${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}"
    echo "releaseSnapshotDiffLatestMd=${RELEASE_SNAPSHOT_DIFF_LATEST_MD}"
    jq -r '"diffClass=\(.diffClass)\nhasPrevious=\(.hasPrevious)\ndecisionChanged=\(.decisionChanged)\nreasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))"' "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}"
  fi

  if [ -f "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" ]; then
    return "$(jq -r '.exitCode // 1' "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}")"
  fi
  return 1
}

release_ready_cmd() {
  local strict_mode runtime_required json_mode
  local snapshot_tmp consistency_tmp diff_tmp
  local verify_rc snapshot_rc consistency_rc diff_rc
  local snapshot_decision snapshot_exit_code consistency_decision consistency_exit_code
  local diff_class diff_exit_code reasons_json advisories_json decision
  local decision_changed has_previous consistency_ok verify_gates_ok
  local runtime_probe_path runtime_ready example_ready runtime_status_tmp
  local -a reasons advisories
  strict_mode="false"
  runtime_required="${RUNTIME_REQUIRED:-1}"
  json_mode="false"
  runtime_ready="null"
  example_ready="null"
  runtime_status_tmp=""
  verify_rc=1
  snapshot_rc=1
  consistency_rc=1
  diff_rc=1
  snapshot_decision="UNKNOWN"
  snapshot_exit_code=1
  consistency_decision="UNKNOWN"
  consistency_exit_code=1
  diff_class="unknown"
  diff_exit_code=1
  decision_changed="null"
  has_previous="null"
  consistency_ok="false"
  verify_gates_ok="false"
  runtime_probe_path="${BFF_DIR}/openapi/examples/real-link-ready-probe-report.json"

  while [ $# -gt 0 ]; do
    case "${1}" in
      --strict-freshness)
        strict_mode="true"
        ;;
      --runtime-required=0)
        runtime_required="0"
        ;;
      --runtime-required=1)
        runtime_required="1"
        ;;
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-ready arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  snapshot_tmp="$(mktemp)"
  consistency_tmp="$(mktemp)"
  diff_tmp="$(mktemp)"

  if verify_gates_cmd >"${RELEASE_READY_VERIFY_LOG}" 2>&1; then
    verify_rc=0
  else
    verify_rc=$?
  fi

  if [ "${strict_mode}" = "true" ]; then
    if release_snapshot_cmd --strict-freshness --runtime-required="${runtime_required}" --json >"${snapshot_tmp}"; then
      snapshot_rc=0
    else
      snapshot_rc=$?
    fi
  else
    if release_snapshot_cmd --runtime-required="${runtime_required}" --json >"${snapshot_tmp}"; then
      snapshot_rc=0
    else
      snapshot_rc=$?
    fi
  fi

  if release_snapshot_consistency_cmd --json >"${consistency_tmp}"; then
    consistency_rc=0
  else
    consistency_rc=$?
  fi

  if release_snapshot_diff_cmd --json >"${diff_tmp}"; then
    diff_rc=0
  else
    diff_rc=$?
  fi

  snapshot_decision="$(jq -r '.decision // "UNKNOWN"' "${snapshot_tmp}" 2>/dev/null || echo "UNKNOWN")"
  snapshot_exit_code="$(jq -r '.exitCode // 1' "${snapshot_tmp}" 2>/dev/null || echo "1")"
  consistency_decision="$(jq -r '.decision // "UNKNOWN"' "${consistency_tmp}" 2>/dev/null || echo "UNKNOWN")"
  consistency_exit_code="$(jq -r '.exitCode // 1' "${consistency_tmp}" 2>/dev/null || echo "1")"
  diff_class="$(jq -r '.diffClass // "unknown"' "${diff_tmp}" 2>/dev/null || echo "unknown")"
  diff_exit_code="$(jq -r '.exitCode // 1' "${diff_tmp}" 2>/dev/null || echo "1")"
  decision_changed="$(jq -r 'if has("decisionChanged") then (if .decisionChanged == null then "null" else (.decisionChanged|tostring) end) else "null" end' "${diff_tmp}" 2>/dev/null || echo "null")"
  has_previous="$(jq -r 'if has("hasPrevious") then (if .hasPrevious == null then "null" else (.hasPrevious|tostring) end) else "null" end' "${diff_tmp}" 2>/dev/null || echo "null")"

  if [ "${verify_rc}" -eq 0 ]; then
    verify_gates_ok="true"
  fi
  if [ "${consistency_rc}" -eq 0 ] && [ "${consistency_decision}" = "GO" ]; then
    consistency_ok="true"
  fi

  runtime_status_tmp="$(mktemp)"
  if runtime_status_cmd --json >"${runtime_status_tmp}" 2>/dev/null; then
    runtime_ready="$(jq -r 'if .overall.runtimeChainOk == true then "true" elif .overall.runtimeChainOk == false then "false" else "null" end' "${runtime_status_tmp}" 2>/dev/null || echo "null")"
  fi

  if [ -f "${runtime_probe_path}" ]; then
    if [ "${runtime_ready}" = "null" ]; then
      runtime_ready="$(jq -r 'if (.runtimeReady|type) == "boolean" then (if .runtimeReady then "true" else "false" end) else "null" end' "${runtime_probe_path}" 2>/dev/null || echo "null")"
    fi
    example_ready="$(jq -r 'if (.exampleReady|type) == "boolean" then (if .exampleReady then "true" else "false" end) else "null" end' "${runtime_probe_path}" 2>/dev/null || echo "null")"
  fi

  if [ "${verify_rc}" -ne 0 ]; then
    reasons+=("verify_gates_failed")
  fi
  if [ "${snapshot_rc}" -ne 0 ] || [ "${snapshot_decision}" != "GO" ]; then
    reasons+=("release_snapshot_not_go")
  fi
  if [ "${consistency_rc}" -ne 0 ] || [ "${consistency_decision}" != "GO" ]; then
    reasons+=("snapshot_consistency_not_go")
  fi
  if [ "${diff_rc}" -ne 0 ] || [ "${diff_exit_code}" != "0" ]; then
    reasons+=("snapshot_diff_error")
  fi

  if [ "${runtime_required}" = "1" ] && [ "${runtime_ready}" != "true" ]; then
    reasons+=("runtime_not_ready_required")
  elif [ "${runtime_required}" = "0" ] && [ "${runtime_ready}" = "false" ]; then
    advisories+=("runtime_not_ready_optional")
  elif [ "${runtime_required}" = "0" ] && [ "${runtime_ready}" = "null" ]; then
    advisories+=("runtime_ready_unknown_optional")
  fi

  # exampleReady comes from contract/example probes, not the live runtime chain.
  # Keep it in checks for observability, but do not let it affect runtime release advisories.

  reasons_json="$(printf '%s\n' "${reasons[@]-}" | jq -Rsc 'split("\n") | map(select(length>0)) | unique')"
  advisories_json="$(printf '%s\n' "${advisories[@]-}" | jq -Rsc 'split("\n") | map(select(length>0)) | unique')"

  decision="NO-GO"
  if [ "$(jq -r 'length' <<<"${reasons_json}")" -eq 0 ]; then
    decision="GO"
  fi

  jq -n \
    --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg strictFreshness "${strict_mode}" \
    --arg runtimeRequired "${runtime_required}" \
    --arg snapshotDecision "${snapshot_decision}" \
    --arg snapshotExitCode "${snapshot_exit_code}" \
    --arg consistencyDecision "${consistency_decision}" \
    --arg consistencyExitCode "${consistency_exit_code}" \
    --arg diffClass "${diff_class}" \
    --arg diffExitCode "${diff_exit_code}" \
    --arg decisionChanged "${decision_changed}" \
    --arg hasPrevious "${has_previous}" \
    --arg consistencyOk "${consistency_ok}" \
    --arg verifyGatesOk "${verify_gates_ok}" \
    --arg runtimeReady "${runtime_ready}" \
    --arg exampleReady "${example_ready}" \
    --argjson verifyRc "${verify_rc}" \
    --argjson snapshotRc "${snapshot_rc}" \
    --argjson consistencyRc "${consistency_rc}" \
    --argjson diffRc "${diff_rc}" \
    --argjson reasons "${reasons_json}" \
    --argjson advisories "${advisories_json}" \
    --arg decision "${decision}" \
    --argjson exitCode "$(if [ "${decision}" = "GO" ]; then echo 0; else echo 1; fi)" \
    --arg snapshotPath "${RELEASE_SNAPSHOT_LATEST_JSON}" \
    --arg consistencyPath "${RELEASE_SNAPSHOT_CONSISTENCY_LATEST_JSON}" \
    --arg diffPath "${RELEASE_SNAPSHOT_DIFF_LATEST_JSON}" \
    --arg runtimeProbePath "${runtime_probe_path}" \
    --arg verifyLogPath "${RELEASE_READY_VERIFY_LOG}" \
    '{
      version: "v1.0",
      generatedAt: $now,
      decision: $decision,
      exitCode: $exitCode,
      reasons: $reasons,
      advisories: $advisories,
      inputs: {
        strictFreshness: ($strictFreshness == "true"),
        runtimeRequired: ($runtimeRequired == "1")
      },
      verifyGatesOk: ($verifyGatesOk == "true"),
      consistencyOk: ($consistencyOk == "true"),
      diffClass: $diffClass,
      decisionChanged: (if $decisionChanged == "true" then true elif $decisionChanged == "false" then false else null end),
      hasPrevious: (if $hasPrevious == "true" then true elif $hasPrevious == "false" then false else null end),
      checks: {
        verifyGatesRc: $verifyRc,
        releaseSnapshotRc: $snapshotRc,
        snapshotConsistencyRc: $consistencyRc,
        snapshotDiffRc: $diffRc,
        snapshotDecision: $snapshotDecision,
        snapshotExitCode: (if ($snapshotExitCode|test("^-?[0-9]+$")) then ($snapshotExitCode|tonumber) else null end),
        consistencyDecision: $consistencyDecision,
        consistencyExitCode: (if ($consistencyExitCode|test("^-?[0-9]+$")) then ($consistencyExitCode|tonumber) else null end),
        diffClass: $diffClass,
        diffExitCode: (if ($diffExitCode|test("^-?[0-9]+$")) then ($diffExitCode|tonumber) else null end),
        runtimeReady: (if $runtimeReady == "true" then true elif $runtimeReady == "false" then false else null end),
        exampleReady: (if $exampleReady == "true" then true elif $exampleReady == "false" then false else null end)
      },
      artifacts: {
        releaseReadyLatestJson: "'"${RELEASE_READY_LATEST_JSON}"'",
        releaseReadyLatestMd: "'"${RELEASE_READY_LATEST_MD}"'",
        releaseSnapshotLatestJson: $snapshotPath,
        releaseSnapshotConsistencyLatestJson: $consistencyPath,
        releaseSnapshotDiffLatestJson: $diffPath,
        runtimeProbePath: $runtimeProbePath,
        verifyGatesLogPath: $verifyLogPath
      }
    }' >"${RELEASE_READY_LATEST_JSON}"

  node -e '
    const fs = require("fs");
    const src = process.argv[1];
    const out = process.argv[2];
    const j = JSON.parse(fs.readFileSync(src, "utf8"));
    const lines = [
      "# Release Ready Latest",
      "",
      `- decision: **${j.decision}**`,
      `- exitCode: \`${j.exitCode}\``,
      `- strictFreshness: \`${j.inputs.strictFreshness}\``,
      `- runtimeRequired: \`${j.inputs.runtimeRequired}\``,
      `- snapshotDecision: \`${j.checks.snapshotDecision}\``,
      `- consistencyDecision: \`${j.checks.consistencyDecision}\``,
      `- diffClass: \`${j.checks.diffClass}\``,
      `- runtimeReady: \`${j.checks.runtimeReady}\``,
      `- exampleReady: \`${j.checks.exampleReady}\``,
      `- reasons: \`${(j.reasons || []).join(",") || "none"}\``,
      `- advisories: \`${(j.advisories || []).join(",") || "none"}\``
    ];
    fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
  ' "${RELEASE_READY_LATEST_JSON}" "${RELEASE_READY_LATEST_MD}"

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_READY_LATEST_JSON}"
  else
    echo "releaseReadyLatestJson=${RELEASE_READY_LATEST_JSON}"
    echo "releaseReadyLatestMd=${RELEASE_READY_LATEST_MD}"
    jq -r '"decision=\(.decision)\nexitCode=\(.exitCode)\nreasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))\nadvisories=\((if (.advisories|length)>0 then (.advisories|join(",")) else "none" end))"' "${RELEASE_READY_LATEST_JSON}"
  fi

  if [ -f "${RELEASE_READY_LATEST_JSON}" ]; then
    rm -f "${snapshot_tmp}" "${consistency_tmp}" "${diff_tmp}" "${runtime_status_tmp}"
    return "$(jq -r '.exitCode // 1' "${RELEASE_READY_LATEST_JSON}")"
  fi

  rm -f "${snapshot_tmp}" "${consistency_tmp}" "${diff_tmp}" "${runtime_status_tmp}"
  return 1
}

release_command_center_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run sync:release-command-center >/dev/null)
      release_command_center_latest_cmd
      ;;
    --json)
      (cd "${BFF_DIR}" && npm run sync:release-command-center >/dev/null)
      release_command_center_latest_cmd --json
      ;;
    *)
      echo "[FAIL] Unknown release-command-center arg: ${arg}"
      return 2
      ;;
  esac
}

release_command_center_sync_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run sync:release-command-center-sync >/dev/null)
      release_command_center_sync_latest_cmd
      ;;
    --json)
      (cd "${BFF_DIR}" && npm run sync:release-command-center-sync >/dev/null)
      release_command_center_sync_latest_cmd --json
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-sync arg: ${arg}"
      return 2
      ;;
  esac
}

release_command_center_sync_latest_cmd() {
  local json_mode="${1:-}"
  case "${json_mode}" in
    "")
      if [ ! -f "${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}" ]; then
        echo "[FAIL] release-command-center-sync latest not found: ${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-command-center-sync --json"
        return 1
      fi
      echo "releaseCommandCenterSyncLatestJson=${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}"
      jq -r '
        "decision=\(.decision // "NO-GO")",
        "summaryClass=\(.summaryClass // "blocked")",
        "exitCode=\(.exitCode // 1)",
        "generatedAt=\(.generatedAt // "unknown")",
        "source=\(.source // "unknown")",
        "firstAction=\(.firstAction // "inspect reasons and rerun sync")",
        "reasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))",
        "advisories=\((if (.advisories|length)>0 then (.advisories|join(",")) else "none" end))",
        "step.releaseCommandCenterSync.ok=\(.steps.releaseCommandCenterSync.ok // false)",
        "step.releaseCommandCenterCheck.ok=\(.steps.releaseCommandCenterCheck.ok // false)",
        "step.releaseCommandCenterLatestCheckSync.ok=\(.steps.releaseCommandCenterLatestCheckSync.ok // false)",
        "step.releaseCommandCenterLatestCheck.ok=\(.steps.releaseCommandCenterLatestCheck.ok // false)"
      ' "${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}"
      ;;
    --json)
      if [ ! -f "${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}" ]; then
        echo "[FAIL] release-command-center-sync latest not found: ${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-command-center-sync --json"
        return 1
      fi
      cat "${RELEASE_COMMAND_CENTER_SYNC_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-sync-latest arg: ${json_mode}"
      return 2
      ;;
  esac
}

release_command_center_sync_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run check:release-command-center-sync)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_COMMAND_CENTER_SYNC_SELFTEST=1 npm run check:release-command-center-sync)
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-sync-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_command_center_latest_cmd() {
  local json_mode="${1:-}"
  case "${json_mode}" in
    "")
      if [ ! -f "${RELEASE_COMMAND_CENTER_LATEST_JSON}" ]; then
        echo "[FAIL] release-command-center latest not found: ${RELEASE_COMMAND_CENTER_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-command-center --json"
        return 1
      fi
      echo "releaseCommandCenterLatestJson=${RELEASE_COMMAND_CENTER_LATEST_JSON}"
      jq -r '
        "decision=\(.decision // "NO-GO")",
        "summaryClass=\(.summaryClass // "blocked")",
        "exitCode=\(.exitCode // 1)",
        "generatedAt=\(.generatedAt // "unknown")",
        "source=\(.source // "unknown")",
        "firstAction=\(.firstAction // "inspect reasons and rerun checks")",
        "reasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))",
        "advisories=\((if (.advisories|length)>0 then (.advisories|join(",")) else "none" end))",
        "gate.releaseReadyLatestCheck.ok=\(.gates.releaseReadyLatestCheck.ok // false)",
        "gate.releaseReadyConsistencySync.ok=\(.gates.syncReleaseReadyConsistency.ok // false)",
        "gate.releaseReadyConsistencyCheck.ok=\(.gates.releaseReadyConsistency.ok // false)",
        "gate.releaseReadyConsistencyPayload.ok=\(.gates.releaseReadyConsistencyPayload.ok // false)",
        "gate.checkFamily.ok=\(.gates.checkFamily.ok // false)",
        "gate.checkFamilyBrief.ok=\(.gates.checkFamilyBrief.ok // false)"
      ' "${RELEASE_COMMAND_CENTER_LATEST_JSON}"
      ;;
    --json)
      if [ ! -f "${RELEASE_COMMAND_CENTER_LATEST_JSON}" ]; then
        echo "[FAIL] release-command-center latest not found: ${RELEASE_COMMAND_CENTER_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-command-center --json"
        return 1
      fi
      cat "${RELEASE_COMMAND_CENTER_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-latest arg: ${json_mode}"
      return 2
      ;;
  esac
}

release_command_center_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run check:release-command-center)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_COMMAND_CENTER_SELFTEST=1 npm run check:release-command-center)
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_command_center_latest_check_sync_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run sync:release-command-center-latest-check)
      ;;
    --json)
      (cd "${BFF_DIR}" && npm run sync:release-command-center-latest-check >/dev/null)
      if [ ! -f "${RELEASE_COMMAND_CENTER_LATEST_CHECK_JSON}" ]; then
        echo "[FAIL] release-command-center-latest-check json not found: ${RELEASE_COMMAND_CENTER_LATEST_CHECK_JSON}"
        return 1
      fi
      cat "${RELEASE_COMMAND_CENTER_LATEST_CHECK_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-latest-check-sync arg: ${arg}"
      return 2
      ;;
  esac
}

release_command_center_latest_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run check:release-command-center-latest-check)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_COMMAND_CENTER_LATEST_CHECK_SELFTEST=1 npm run check:release-command-center-latest-check)
      ;;
    *)
      echo "[FAIL] Unknown release-command-center-latest-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_latest_cmd() {
  local json_mode
  json_mode="false"
  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-ready-latest arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ ! -f "${RELEASE_READY_LATEST_JSON}" ]; then
    echo "[FAIL] release-ready latest file not found: ${RELEASE_READY_LATEST_JSON}"
    echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-ready --runtime-required=0 --json"
    return 1
  fi

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_READY_LATEST_JSON}"
  else
    echo "releaseReadyLatestJson=${RELEASE_READY_LATEST_JSON}"
    echo "releaseReadyLatestMd=${RELEASE_READY_LATEST_MD}"
    jq -r '"decision=\(.decision)\nexitCode=\(.exitCode)\ngeneratedAt=\(.generatedAt // "unknown")\nreasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))\nadvisories=\((if (.advisories|length)>0 then (.advisories|join(",")) else "none" end))"' "${RELEASE_READY_LATEST_JSON}"
  fi
}

release_ready_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:release-ready)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_READY_SELFTEST=1 npm run check:release-ready)
      ;;
    *)
      echo "[FAIL] Unknown release-ready-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_latest_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:release-ready-latest-check)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_READY_LATEST_CHECK_SELFTEST=1 npm run check:release-ready-latest-check)
      ;;
    *)
      echo "[FAIL] Unknown release-ready-latest-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_consistency_sync_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run sync:release-ready-consistency)
      ;;
    --json)
      (cd "${BFF_DIR}" && npm run sync:release-ready-consistency >/dev/null)
      if [ ! -f "${RELEASE_READY_CONSISTENCY_LATEST_JSON}" ]; then
        echo "[FAIL] release-ready-consistency json not found: ${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
        return 1
      fi
      cat "${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown release-ready-consistency-sync arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_consistency_latest_cmd() {
  local json_mode="${1:-}"
  case "${json_mode}" in
    "")
      if [ ! -f "${RELEASE_READY_CONSISTENCY_LATEST_JSON}" ]; then
        echo "[FAIL] release-ready-consistency latest not found: ${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-ready-consistency-sync --json"
        return 1
      fi
      echo "releaseReadyConsistencyLatestJson=${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
      jq -r '
        "decision=\(.decision // "NO-GO")",
        "exitCode=\(.exitCode // 1)",
        "generatedAt=\(.generatedAt // "unknown")",
        "step.releaseReadyLatestCheck.ok=\(.steps.releaseReadyLatestCheck.ok // false)",
        "step.checkFamilyConsistency.ok=\(.steps.checkFamilyConsistency.ok // false)",
        "step.checkFamilyOverall.ok=\(.steps.checkFamilyOverall.ok // false)",
        "reasons=\((if (.reasons|length)>0 then (.reasons|join(",")) else "none" end))"
      ' "${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
      ;;
    --json)
      if [ ! -f "${RELEASE_READY_CONSISTENCY_LATEST_JSON}" ]; then
        echo "[FAIL] release-ready-consistency latest not found: ${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
        echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-ready-consistency-sync --json"
        return 1
      fi
      cat "${RELEASE_READY_CONSISTENCY_LATEST_JSON}"
      ;;
    *)
      echo "[FAIL] Unknown release-ready-consistency-latest arg: ${json_mode}"
      return 2
      ;;
  esac
}

release_ready_consistency_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run check:release-ready-consistency)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_READY_CONSISTENCY_SELFTEST=1 npm run check:release-ready-consistency)
      ;;
    *)
      echo "[FAIL] Unknown release-ready-consistency-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_latest_check_sync_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "")
      (cd "${BFF_DIR}" && npm run sync:release-ready-latest-check)
      ;;
    --json)
      (cd "${BFF_DIR}" && npm run sync:release-ready-latest-check >/dev/null)
      if [ ! -f "${ROOT_DIR}/docs/release-ready-latest-check.json" ]; then
        echo "[FAIL] release-ready-latest-check json not found: ${ROOT_DIR}/docs/release-ready-latest-check.json"
        return 1
      fi
      cat "${ROOT_DIR}/docs/release-ready-latest-check.json"
      ;;
    *)
      echo "[FAIL] Unknown release-ready-latest-check-sync arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_sync_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:release-ready-sync)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_READY_SYNC_SELFTEST=1 npm run check:release-ready-sync)
      ;;
    *)
      echo "[FAIL] Unknown release-ready-sync-check arg: ${arg}"
      return 2
      ;;
  esac
}

release_ready_sync_cmd() {
  local strict_mode runtime_required json_mode recompute_mode
  local ready_tmp check_tmp latest_tmp sync_tmp
  local ready_rc check_rc latest_rc
  strict_mode="false"
  runtime_required="${RUNTIME_REQUIRED:-0}"
  json_mode="false"
  recompute_mode="false"
  ready_rc=1
  check_rc=1
  latest_rc=1

  while [ $# -gt 0 ]; do
    case "${1}" in
      --recompute)
        recompute_mode="true"
        ;;
      --strict-freshness)
        strict_mode="true"
        ;;
      --runtime-required=0)
        runtime_required="0"
        ;;
      --runtime-required=1)
        runtime_required="1"
        ;;
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-ready-sync arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  ready_tmp="$(mktemp)"
  check_tmp="$(mktemp)"
  latest_tmp="$(mktemp)"
  sync_tmp="$(mktemp)"

  if [ "${recompute_mode}" = "true" ]; then
    if [ "${strict_mode}" = "true" ]; then
      if release_ready_cmd --strict-freshness --runtime-required="${runtime_required}" --json >"${ready_tmp}"; then
        ready_rc=0
      else
        ready_rc=$?
      fi
    else
      if release_ready_cmd --runtime-required="${runtime_required}" --json >"${ready_tmp}"; then
        ready_rc=0
      else
        ready_rc=$?
      fi
    fi
  else
    if release_ready_latest_cmd --json >"${ready_tmp}" 2>/dev/null; then
      ready_rc=0
    else
      ready_rc=$?
    fi
  fi

  if release_ready_check_cmd >"${check_tmp}" 2>&1; then
    check_rc=0
  else
    check_rc=$?
  fi

  if release_ready_latest_cmd --json >"${latest_tmp}" 2>/dev/null; then
    latest_rc=0
  else
    latest_rc=$?
  fi

  jq -n \
    --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg strictFreshness "${strict_mode}" \
    --arg runtimeRequired "${runtime_required}" \
    --arg recomputeMode "${recompute_mode}" \
    --argjson readyRc "${ready_rc}" \
    --argjson checkRc "${check_rc}" \
    --argjson latestRc "${latest_rc}" \
    --slurpfile ready "${ready_tmp}" \
    --slurpfile latest "${latest_tmp}" \
    '{
      version: "v1.0",
      generatedAt: $now,
      decision: (if $readyRc == 0 then "GO" else "NO-GO" end),
      exitCode: (if $readyRc == 0 and $checkRc == 0 and $latestRc == 0 then 0 else 1 end),
      inputs: {
        strictFreshness: ($strictFreshness == "true"),
        runtimeRequired: ($runtimeRequired == "1"),
        recompute: ($recomputeMode == "true")
      },
      steps: {
        releaseReady: {ok: ($readyRc == 0), exitCode: $readyRc, mode: (if $recomputeMode == "true" then "recompute" else "read_latest" end)},
        releaseReadyCheck: {ok: ($checkRc == 0), exitCode: $checkRc},
        releaseReadyLatest: {ok: ($latestRc == 0), exitCode: $latestRc}
      },
      releaseReady: ($ready[0] // null),
      releaseReadyLatest: ($latest[0] // null)
    }' >"${sync_tmp}"

  if [ "${json_mode}" = "true" ]; then
    cat "${sync_tmp}"
  else
    jq -r '"decision=\(.decision)\nexitCode=\(.exitCode)\nstep.releaseReady=\(.steps.releaseReady.ok)\nstep.releaseReady.mode=\(.steps.releaseReady.mode)\nstep.releaseReadyCheck=\(.steps.releaseReadyCheck.ok)\nstep.releaseReadyLatest=\(.steps.releaseReadyLatest.ok)\nlatest.decision=\(.releaseReadyLatest.decision // "unknown")\nlatest.generatedAt=\(.releaseReadyLatest.generatedAt // "unknown")"' "${sync_tmp}"
  fi

  local sync_exit
  sync_exit="$(jq -r '.exitCode // 1' "${sync_tmp}")"
  mv "${sync_tmp}" "${RELEASE_READY_SYNC_LATEST_JSON}"
  rm -f "${ready_tmp}" "${check_tmp}" "${latest_tmp}"
  return "${sync_exit}"
}

release_ready_sync_latest_cmd() {
  local json_mode
  json_mode="false"
  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-ready-sync-latest arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ ! -f "${RELEASE_READY_SYNC_LATEST_JSON}" ]; then
    echo "[FAIL] release-ready-sync latest file not found: ${RELEASE_READY_SYNC_LATEST_JSON}"
    echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json"
    return 1
  fi

  if [ "${json_mode}" = "true" ]; then
    cat "${RELEASE_READY_SYNC_LATEST_JSON}"
  else
    echo "releaseReadySyncLatestJson=${RELEASE_READY_SYNC_LATEST_JSON}"
    jq -r '
      "decision=\(.decision // "NO-GO")",
      "exitCode=\(.exitCode // 1)",
      "generatedAt=\(.generatedAt // "unknown")",
      "step.releaseReady.ok=\(.steps.releaseReady.ok // false)",
      "step.releaseReady.mode=\(.steps.releaseReady.mode // "unknown")",
      "step.releaseReadyCheck.ok=\(.steps.releaseReadyCheck.ok // false)",
      "step.releaseReadyLatest.ok=\(.steps.releaseReadyLatest.ok // false)",
      "latest.decision=\(.releaseReadyLatest.decision // "unknown")",
      "latest.generatedAt=\(.releaseReadyLatest.generatedAt // "unknown")"
    ' "${RELEASE_READY_SYNC_LATEST_JSON}"
  fi
}

release_ready_brief_cmd() {
  local json_mode
  json_mode="false"
  while [ $# -gt 0 ]; do
    case "${1}" in
      --json)
        json_mode="true"
        ;;
      *)
        echo "[FAIL] Unknown release-ready-brief arg: ${1}"
        return 2
        ;;
    esac
    shift
  done

  if [ ! -f "${RELEASE_READY_SYNC_LATEST_JSON}" ]; then
    echo "[FAIL] release-ready-sync latest file not found: ${RELEASE_READY_SYNC_LATEST_JSON}"
    echo "run: ${ROOT_DIR}/scripts/chiller_ctl.sh release-ready-sync --runtime-required=0 --json"
    return 1
  fi

  if [ "${json_mode}" = "true" ]; then
    jq '{
      decision: (.decision // "NO-GO"),
      exitCode: (.exitCode // 1),
      stepReleaseReadyOk: (.steps.releaseReady.ok // false),
      stepReleaseReadyMode: (.steps.releaseReady.mode // "unknown"),
      stepReleaseReadyCheckOk: (.steps.releaseReadyCheck.ok // false),
      stepReleaseReadyLatestOk: (.steps.releaseReadyLatest.ok // false),
      latestDecision: (.releaseReadyLatest.decision // "unknown"),
      latestGeneratedAt: (.releaseReadyLatest.generatedAt // "unknown"),
      reasons: (.releaseReadyLatest.reasons // []),
      advisories: (.releaseReadyLatest.advisories // [])
    }' "${RELEASE_READY_SYNC_LATEST_JSON}"
  else
    jq -r '
      "decision=\(.decision // "NO-GO")",
      "exitCode=\(.exitCode // 1)",
      "step.releaseReady.ok=\(.steps.releaseReady.ok // false)",
      "step.releaseReady.mode=\(.steps.releaseReady.mode // "unknown")",
      "step.releaseReadyCheck.ok=\(.steps.releaseReadyCheck.ok // false)",
      "step.releaseReadyLatest.ok=\(.steps.releaseReadyLatest.ok // false)",
      "latest.decision=\(.releaseReadyLatest.decision // "unknown")",
      "latest.generatedAt=\(.releaseReadyLatest.generatedAt // "unknown")",
      "latest.reasons=\((if (.releaseReadyLatest.reasons|length)>0 then (.releaseReadyLatest.reasons|join(",")) else "none" end))",
      "latest.advisories=\((if (.releaseReadyLatest.advisories|length)>0 then (.releaseReadyLatest.advisories|join(",")) else "none" end))"
    ' "${RELEASE_READY_SYNC_LATEST_JSON}"
  fi
}

release_ready_brief_check_cmd() {
  local arg="${1:-}"
  case "${arg}" in
    "" )
      (cd "${BFF_DIR}" && npm run check:release-ready-brief)
      ;;
    --selftest)
      (cd "${BFF_DIR}" && RELEASE_READY_BRIEF_SELFTEST=1 npm run check:release-ready-brief)
      ;;
    *)
      echo "[FAIL] Unknown release-ready-brief-check arg: ${arg}"
      return 2
      ;;
  esac
}

preflight_cmd() {
  local strict_arg="${1:-}"
  if [ "${strict_arg}" = "--strict-freshness" ]; then
    RELEASE_GATE_STRICT_FRESHNESS=1 bash "${PREFLIGHT_SCRIPT}"
    return 0
  fi
  if [ -n "${strict_arg}" ]; then
    echo "[FAIL] Unknown preflight arg: ${strict_arg}"
    return 2
  fi
  bash "${PREFLIGHT_SCRIPT}"
}

switch_shell_cmd() {
  "${ENTRY_SCRIPT}" switch shell
}

switch_legacy_cmd() {
  "${ENTRY_SCRIPT}" switch legacy
}

main() {
  local cmd="${1:-status}"
  case "${cmd}" in
    status)
      status_cmd
      ;;
    runtime-start)
      runtime_start_cmd
      ;;
    runtime-stop)
      runtime_stop_cmd
      ;;
    runtime-status)
      shift || true
      runtime_status_cmd "${1:-}"
      ;;
    status-json)
      shift || true
      status_json_cmd "$@"
      ;;
    release-gate)
      shift || true
      release_gate_cmd "$@"
      ;;
    release-gate-latest)
      shift || true
      release_gate_latest_cmd "${1:-}"
      ;;
    release-snapshot)
      shift || true
      release_snapshot_cmd "$@"
      ;;
    release-snapshot-index)
      shift || true
      release_snapshot_index_cmd "$@"
      ;;
    release-snapshot-consistency)
      shift || true
      release_snapshot_consistency_cmd "$@"
      ;;
    release-snapshot-diff)
      shift || true
      release_snapshot_diff_cmd "$@"
      ;;
    release-ready)
      shift || true
      release_ready_cmd "$@"
      ;;
    release-command-center)
      shift || true
      release_command_center_cmd "${1:-}"
      ;;
    release-command-center-sync)
      shift || true
      release_command_center_sync_cmd "${1:-}"
      ;;
    release-command-center-sync-latest)
      shift || true
      release_command_center_sync_latest_cmd "${1:-}"
      ;;
    release-command-center-sync-check)
      shift || true
      release_command_center_sync_check_cmd "${1:-}"
      ;;
    release-command-center-latest)
      shift || true
      release_command_center_latest_cmd "${1:-}"
      ;;
    release-command-center-check)
      shift || true
      release_command_center_check_cmd "${1:-}"
      ;;
    release-command-center-latest-check)
      shift || true
      release_command_center_latest_check_cmd "${1:-}"
      ;;
    release-command-center-latest-check-sync)
      shift || true
      release_command_center_latest_check_sync_cmd "${1:-}"
      ;;
    release-ready-consistency-sync)
      shift || true
      release_ready_consistency_sync_cmd "${1:-}"
      ;;
    release-ready-consistency-latest)
      shift || true
      release_ready_consistency_latest_cmd "${1:-}"
      ;;
    release-ready-consistency-check)
      shift || true
      release_ready_consistency_check_cmd "${1:-}"
      ;;
    release-ready-latest)
      shift || true
      release_ready_latest_cmd "$@"
      ;;
    release-ready-check)
      shift || true
      release_ready_check_cmd "${1:-}"
      ;;
    release-ready-latest-check)
      shift || true
      release_ready_latest_check_cmd "${1:-}"
      ;;
    release-ready-latest-check-sync)
      shift || true
      release_ready_latest_check_sync_cmd "${1:-}"
      ;;
    release-ready-sync-check)
      shift || true
      release_ready_sync_check_cmd "${1:-}"
      ;;
    release-ready-sync-latest-check)
      shift || true
      release_ready_sync_check_cmd "${1:-}"
      ;;
    release-ready-sync)
      shift || true
      release_ready_sync_cmd "$@"
      ;;
    release-ready-sync-latest)
      shift || true
      release_ready_sync_latest_cmd "$@"
      ;;
    release-ready-brief)
      shift || true
      release_ready_brief_cmd "$@"
      ;;
    release-ready-brief-check)
      shift || true
      release_ready_brief_check_cmd "${1:-}"
      ;;
    check)
      shift || true
      check_cmd "${1:-}"
      ;;
    accept)
      shift || true
      accept_cmd "${1:-}"
      ;;
    accept-contract)
      accept_contract_cmd
      ;;
    verify-gates)
      shift || true
      verify_gates_cmd "${1:-}"
      ;;
    verify-gates-latest)
      shift || true
      verify_gates_latest_cmd "$@"
      ;;
    verify-gates-check)
      shift || true
      verify_gates_check_cmd "${1:-}"
      ;;
    verify-gates-latest-check)
      shift || true
      verify_gates_check_cmd "${1:-}"
      ;;
    check-family)
      shift || true
      check_family_cmd "${1:-}"
      ;;
    check-family-latest)
      shift || true
      check_family_latest_cmd "${1:-}"
      ;;
    check-family-check)
      shift || true
      check_family_check_cmd "${1:-}"
      ;;
    check-family-brief)
      shift || true
      check_family_brief_cmd "${1:-}"
      ;;
    check-family-brief-latest)
      shift || true
      check_family_brief_latest_cmd "${1:-}"
      ;;
    check-family-brief-check)
      shift || true
      check_family_brief_check_cmd "${1:-}"
      ;;
    check-family-consistency-check)
      shift || true
      check_family_consistency_check_cmd "${1:-}"
      ;;
    check-family-freshness-check)
      shift || true
      check_family_freshness_check_cmd "${1:-}"
      ;;
    preflight)
      shift || true
      preflight_cmd "${1:-}"
      ;;
    switch-shell)
      switch_shell_cmd
      ;;
    switch-legacy)
      switch_legacy_cmd
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "[FAIL] Unknown command: ${cmd}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
