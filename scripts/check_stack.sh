#!/usr/bin/env bash
set -u

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
SHELL_DIR="${ROOT_DIR}/apps/chiller-shell-v1"
# shellcheck source=/dev/null
[ -f "${ROOT_DIR}/scripts/load_shell_env.sh" ] && . "${ROOT_DIR}/scripts/load_shell_env.sh"
load_shell_env_defaults "${ROOT_DIR}"

SITE_ID="${1:-${SITE_ID:-${VITE_SITE_ID:-126lnoffice}}}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-http://127.0.0.1:8098}"
BFF_BASE_URL="${BFF_BASE_URL:-${VITE_BFF_BASE_URL:-http://127.0.0.1:8787}}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:3001}"
FRONTEND_EXPECT_SERVER="${FRONTEND_EXPECT_SERVER:-vite}"
AUTO_BOOT="${AUTO_BOOT:-0}"
READINESS_CHECK="${READINESS_CHECK:-1}"
BFF_LOG="/tmp/chiller-bff-dev.log"
SHELL_LOG="/tmp/chiller-shell-dev.log"

FAIL_COUNT=0
WARN_COUNT=0

say() {
  printf '%s\n' "$1"
}

ok() {
  printf '[OK] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
  printf '[FAIL] %s\n' "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_http() {
  local name="$1"
  local url="$2"
  local expect2xx="${3:-yes}"
  local code

  code="$(curl -sS -m 4 -o /tmp/chiller_check_body.txt -w '%{http_code}' "$url" 2>/tmp/chiller_check_err.txt || true)"
  if [ "$code" = "000" ]; then
    fail "${name}: unreachable (${url})"
    return
  fi

  if [ "$expect2xx" = "yes" ] && ! echo "$code" | grep -Eq '^2'; then
    fail "${name}: HTTP ${code} (${url})"
    return
  fi

  if [ "$expect2xx" = "no" ]; then
    ok "${name}: reachable HTTP ${code} (${url})"
    return
  fi

  ok "${name}: HTTP ${code} (${url})"
}

check_frontend_server() {
  local url="$1"
  if [ -z "${FRONTEND_EXPECT_SERVER}" ]; then
    return
  fi

  local headers
  headers="$(curl -sS -m 4 -D - -o /tmp/chiller_frontend_body.txt "${url}" 2>/tmp/chiller_frontend_err.txt || true)"
  if [ -z "${headers}" ]; then
    warn "frontend server header check skipped: no response headers"
    return
  fi

  local server
  server="$(echo "${headers}" | awk 'BEGIN{IGNORECASE=1} /^server:/{sub(/\r/,""); $1=""; gsub(/^ +/,""); print; exit}')"
  if [ -z "${server}" ]; then
    warn "frontend server header missing (${url})"
    return
  fi

  if echo "${server}" | tr '[:upper:]' '[:lower:]' | grep -q "$(echo "${FRONTEND_EXPECT_SERVER}" | tr '[:upper:]' '[:lower:]')"; then
    ok "frontend server header matched (${server})"
  else
    warn "frontend server header mismatch: expected contains '${FRONTEND_EXPECT_SERVER}', actual '${server}'"
  fi
}

check_contract() {
  if [ ! -d "$BFF_DIR" ]; then
    fail "bff directory missing: $BFF_DIR"
    return
  fi
  if (cd "$BFF_DIR" && npm run check:contract >/tmp/chiller_contract_out.txt 2>/tmp/chiller_contract_err.txt); then
    ok "bff contract check passed"
  else
    fail "bff contract check failed (see /tmp/chiller_contract_err.txt)"
  fi
}

check_probe() {
  if [ ! -d "$BFF_DIR" ]; then
    fail "bff directory missing: $BFF_DIR"
    return
  fi
  if (cd "$BFF_DIR" && node scripts/probe.js "$SITE_ID" >/tmp/chiller_probe.json 2>/tmp/chiller_probe_err.txt); then
    ok "bff probe executed"
    node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("/tmp/chiller_probe.json", "utf8"));
      const o = p?.overview?.sourceStatus?.overall ?? "unknown";
      const t = p?.trends?.sourceStatus?.overall ?? "unknown";
      const a = p?.anomalies?.sourceStatus?.overall ?? "unknown";
      const r = p?.recommendations?.sourceStatus?.overall ?? "unknown";
      const cards = p?.recommendations?.summary?.total ?? 0;
      console.log(`[INFO] sourceStatus overall => overview:${o} trends:${t} anomalies:${a} recommendations:${r}`);
      console.log(`[INFO] recommendation cards => ${cards}`);
    '
  else
    fail "bff probe failed (see /tmp/chiller_probe_err.txt)"
  fi
}

check_readiness() {
  if [ "${READINESS_CHECK}" != "1" ]; then
    return
  fi
  if [ ! -f "/tmp/chiller_probe.json" ]; then
    warn "readiness check skipped: /tmp/chiller_probe.json missing"
    return
  fi
  if [ ! -f "${ROOT_DIR}/scripts/evaluate_non_degraded_readiness.mjs" ]; then
    warn "readiness check skipped: evaluator script missing"
    return
  fi

  local output_file="/tmp/chiller_readiness_report.json"
  if node "${ROOT_DIR}/scripts/evaluate_non_degraded_readiness.mjs" \
    --input /tmp/chiller_probe.json \
    --output "${output_file}" \
    >/tmp/chiller_readiness_out.txt 2>/tmp/chiller_readiness_err.txt; then
    say "--- readiness ---"
    cat /tmp/chiller_readiness_out.txt
    if grep -q '^Readiness: FAIL' /tmp/chiller_readiness_out.txt; then
      warn "non-degraded readiness not met (${output_file})"
    else
      ok "non-degraded readiness passed (${output_file})"
    fi
  else
    warn "readiness check execution failed (see /tmp/chiller_readiness_err.txt)"
  fi
}

generate_badge_state() {
  if [ "${READINESS_CHECK}" != "1" ]; then
    warn "badge state skipped: READINESS_CHECK=0"
    return
  fi
  if [ ! -f "/tmp/chiller_readiness_report.json" ]; then
    warn "badge state skipped: /tmp/chiller_readiness_report.json missing"
    return
  fi
  if [ ! -f "${ROOT_DIR}/scripts/generate_ui_badge_state.mjs" ]; then
    warn "badge state skipped: generator script missing"
    return
  fi

  local output_file="${ROOT_DIR}/docs/ui-badge-state-v1.8.json"
  local public_file="${ROOT_DIR}/apps/chiller-shell-v1/public/ui-badge-state-v1.8.json"
  local dist_file="${ROOT_DIR}/apps/chiller-shell-v1/dist/ui-badge-state-v1.8.json"
  if node "${ROOT_DIR}/scripts/generate_ui_badge_state.mjs" \
    --input /tmp/chiller_readiness_report.json \
    --output "${output_file}" \
    >/tmp/chiller_badge_state_out.txt 2>/tmp/chiller_badge_state_err.txt; then
    ok "ui badge state generated (${output_file})"
    mkdir -p "$(dirname "${public_file}")"
    cp "${output_file}" "${public_file}"
    ok "ui badge state synced (${public_file})"
    if [ -d "${ROOT_DIR}/apps/chiller-shell-v1/dist" ]; then
      cp "${output_file}" "${dist_file}"
      ok "ui badge state synced (${dist_file})"
    fi
  else
    warn "badge state generation failed (see /tmp/chiller_badge_state_err.txt)"
  fi
}

show_runtime_hints() {
  if [ -f "${BFF_LOG}" ]; then
    say "--- bff log tail ---"
    tail -n 20 "${BFF_LOG}" || true
  fi
  if [ -f "${SHELL_LOG}" ]; then
    say "--- frontend log tail ---"
    tail -n 20 "${SHELL_LOG}" || true
  fi
}

say "=== Chiller Stack Check ==="
say "siteId=${SITE_ID}"
say "legacy=${LEGACY_BASE_URL}"
say "bff=${BFF_BASE_URL}"
say "frontend=${FRONTEND_BASE_URL}"
say "frontendExpectServer=${FRONTEND_EXPECT_SERVER}"
say "autoBoot=${AUTO_BOOT}"
say ""

if [ "${AUTO_BOOT}" = "1" ]; then
  if [ -x "${ROOT_DIR}/scripts/start_local_stack.sh" ]; then
    ok "auto-boot enabled, starting local stack first"
    SITE_ID="${SITE_ID}" /usr/bin/env bash "${ROOT_DIR}/scripts/start_local_stack.sh" >/tmp/chiller_autoboot_out.txt 2>/tmp/chiller_autoboot_err.txt || true
    if [ -f /tmp/chiller_autoboot_out.txt ]; then
      local_frontend_line="$(grep -Eo 'frontend start issued on http://127\.0\.0\.1:[0-9]+/' /tmp/chiller_autoboot_out.txt | tail -n 1 || true)"
      if [ -n "${local_frontend_line}" ]; then
        FRONTEND_BASE_URL="${local_frontend_line#frontend start issued on }"
        ok "auto-boot frontend endpoint => ${FRONTEND_BASE_URL}"
      else
        warn "auto-boot frontend endpoint not detected, recent auto-boot hints:"
        grep -E 'frontend not ready on port|frontend start failed for ports|frontend start failed for FRONTEND_BASE_URL' /tmp/chiller_autoboot_out.txt | tail -n 5 || true
      fi
    fi
  else
    warn "auto-boot requested but start_local_stack.sh not found or not executable"
  fi
fi

check_http "legacy health" "${LEGACY_BASE_URL}/healthz" "no"
check_http "bff health" "${BFF_BASE_URL}/healthz" "yes"
check_http "frontend entry" "${FRONTEND_BASE_URL}/" "yes"
check_frontend_server "${FRONTEND_BASE_URL}/"

say ""
check_contract
check_probe
check_readiness
generate_badge_state

say ""
if [ "$FAIL_COUNT" -gt 0 ]; then
  show_runtime_hints
  say "=== Summary: FAIL=${FAIL_COUNT}, WARN=${WARN_COUNT} ==="
  exit 1
fi
say "=== Summary: FAIL=0, WARN=${WARN_COUNT} ==="
exit 0
