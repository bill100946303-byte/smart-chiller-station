#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
SHELL_DIR="${ROOT_DIR}/apps/chiller-shell-v1"
LOG_FILE="${ROOT_DIR}/docs/v1.8-release-preflight.log"
REPORT_FILE="${ROOT_DIR}/docs/v1.8-release-preflight.json"
RELEASE_GATE_LATEST_JSON="${ROOT_DIR}/docs/release-gate-latest.json"
RUNTIME_REQUIRED="${RUNTIME_REQUIRED:-1}"
RELEASE_GATE_STRICT_FRESHNESS="${RELEASE_GATE_STRICT_FRESHNESS:-0}"

say() {
  printf '%s\n' "$1"
}

step() {
  printf '\n== %s ==\n' "$1"
}

run_and_log() {
  local name="$1"
  shift
  step "${name}"
  printf '$ %s\n' "$*" | tee -a "${LOG_FILE}"
  "$@" 2>&1 | tee -a "${LOG_FILE}"
  return ${PIPESTATUS[0]}
}

main() {
  : >"${LOG_FILE}"
  say "v1.8 release preflight started: $(date '+%Y-%m-%d %H:%M:%S')"
  say "runtimeRequired=${RUNTIME_REQUIRED}"
  say "releaseGateStrictFreshness=${RELEASE_GATE_STRICT_FRESHNESS}"

  local stack_ok=1
  local contract_ok=1
  local status_json_ok=1
  local shell_ok=1
  local release_gate_ok=1
  local stack_readiness_check="1"
  if [ "${RUNTIME_REQUIRED}" != "1" ]; then
    stack_readiness_check="0"
  fi

  if ! run_and_log "Stack Health + Readiness" \
    /usr/bin/env bash -lc "AUTO_BOOT=1 READINESS_CHECK=${stack_readiness_check} SITE_ID=126lnoffice BFF_BASE_URL=http://127.0.0.1:8787 FRONTEND_BASE_URL=http://127.0.0.1:3001 FRONTEND_PORT=3001 ${ROOT_DIR}/scripts/check_stack.sh"; then
    stack_ok=0
    say "[WARN] stack health step failed"
    if [ "${RUNTIME_REQUIRED}" = "1" ]; then
      say "[FAIL] runtime required and stack check failed"
    else
      say "[WARN] runtime optional mode: continue despite stack failure"
    fi
  fi

  if ! run_and_log "BFF Contract Gate" \
    /usr/bin/env bash -lc "cd ${BFF_DIR} && npm run check:contract"; then
    contract_ok=0
    say "[FAIL] bff contract gate failed"
  fi

  if ! run_and_log "Status-JSON Contract Gate" \
    /usr/bin/env bash -lc "cd ${BFF_DIR} && npm run check:status-json"; then
    status_json_ok=0
    say "[FAIL] status-json contract gate failed"
  fi

  if ! run_and_log "Shell Build Gate" \
    /usr/bin/env bash -lc "cd ${SHELL_DIR} && npm run build"; then
    shell_ok=0
    say "[FAIL] shell build gate failed"
  fi

  local release_gate_cmd="${ROOT_DIR}/scripts/chiller_ctl.sh release-gate-latest"
  if [ "${RELEASE_GATE_STRICT_FRESHNESS}" = "1" ]; then
    release_gate_cmd="${release_gate_cmd} --strict-freshness"
  fi

  if ! run_and_log "Release Gate Sync" \
    /usr/bin/env bash -lc "${release_gate_cmd}"; then
    release_gate_ok=0
    say "[FAIL] release gate sync failed"
  fi

  step "Artifact Presence"
  {
    ls -l "${ROOT_DIR}/docs/ui-badge-state-v1.8.json"
    ls -l "${ROOT_DIR}/apps/chiller-shell-v1/public/ui-badge-state-v1.8.json"
    ls -l "${ROOT_DIR}/docs/v1.8-signoff-decision.md"
    ls -l "${ROOT_DIR}/docs/ui-consistency-review-v1.8.md"
    ls -l "${ROOT_DIR}/docs/readiness-baseline-freeze-v1.8.md"
  } 2>&1 | tee -a "${LOG_FILE}"

  node -e '
    const fs = require("fs");
    const reportPath = process.argv[1];
    const stackOk = process.argv[2] === "1";
    const contractOk = process.argv[3] === "1";
    const statusJsonOk = process.argv[4] === "1";
    const shellOk = process.argv[5] === "1";
    const runtimeRequired = process.argv[6] === "1";
    const readinessGateEnabled = process.argv[7] === "1";
    const releaseGateOk = process.argv[8] === "1";
    const releaseGatePath = process.argv[9];
    const releaseGateStrictFreshness = process.argv[10] === "1";
    const readinessPath = "/tmp/chiller_readiness_report.json";
    const badgePath = "/Users/billchow/Documents/智慧冷冻站/docs/ui-badge-state-v1.8.json";
    const now = new Date().toISOString();
    const readiness = readinessGateEnabled && fs.existsSync(readinessPath)
      ? JSON.parse(fs.readFileSync(readinessPath, "utf8"))
      : null;
    const badge = readinessGateEnabled && fs.existsSync(badgePath)
      ? JSON.parse(fs.readFileSync(badgePath, "utf8"))
      : null;
    const releaseGate = fs.existsSync(releaseGatePath)
      ? JSON.parse(fs.readFileSync(releaseGatePath, "utf8"))
      : null;
    const payload = {
      version: "v1.8",
      generatedAt: now,
      gates: {
        stackOk,
        contractOk,
        statusJsonOk,
        shellOk,
        releaseGateOk,
        releaseGateStrictFreshness,
        runtimeRequired,
        readinessGateEnabled
      },
      readiness: readiness
        ? {
            nonDegradedReady: readiness.nonDegradedReady === true,
            ndFailedCount: readiness?.nd?.failedCount ?? null,
            attribution: readiness?.attribution ?? null
          }
        : null,
      badge: badge
        ? {
            rule: badge.rule ?? null,
            globalPass: badge?.global?.pass === true
          }
        : null,
      releaseGate: releaseGate
        ? {
            decision: releaseGate.decision ?? null,
            exitCode: releaseGate.exitCode ?? null,
            reasons: releaseGate.reasons ?? [],
            advisories: releaseGate.advisories ?? []
          }
        : null,
      runtimeArtifactsSkipped: !readinessGateEnabled
    };
    payload.preflightPass =
      contractOk &&
      statusJsonOk &&
      shellOk &&
      releaseGateOk &&
      (runtimeRequired ? stackOk : true);
    fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  ' "${REPORT_FILE}" "${stack_ok}" "${contract_ok}" "${status_json_ok}" "${shell_ok}" "${RUNTIME_REQUIRED}" "${stack_readiness_check}" "${release_gate_ok}" "${RELEASE_GATE_LATEST_JSON}" "${RELEASE_GATE_STRICT_FRESHNESS}"

  if [ "${contract_ok}" != "1" ] || [ "${status_json_ok}" != "1" ] || [ "${shell_ok}" != "1" ] || [ "${release_gate_ok}" != "1" ]; then
    say "[FAIL] preflight blocked by contract/status-json/build/release-gate"
    exit 1
  fi
  if [ "${RUNTIME_REQUIRED}" = "1" ] && [ "${stack_ok}" != "1" ]; then
    say "[FAIL] preflight blocked by runtime gate"
    exit 1
  fi

  say ""
  say "v1.8 release preflight done."
  say "log: ${LOG_FILE}"
  say "report: ${REPORT_FILE}"
}

main "$@"
