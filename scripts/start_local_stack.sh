#!/usr/bin/env bash
set -u

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
SHELL_DIR="${ROOT_DIR}/apps/chiller-shell-v1"
# shellcheck source=/dev/null
[ -f "${ROOT_DIR}/scripts/load_shell_env.sh" ] && . "${ROOT_DIR}/scripts/load_shell_env.sh"
load_shell_env_defaults "${ROOT_DIR}"

slugify_token() {
  local value="$1"
  value="$(printf '%s' "${value}" | tr -cs '[:alnum:]' '-')"
  value="${value#-}"
  value="${value%-}"
  if [ -z "${value}" ]; then
    value="default"
  fi
  printf '%s\n' "${value}"
}

BFF_PORT="${BFF_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
SITE_ID="${SITE_ID:-${VITE_SITE_ID:-126lnoffice}}"
TREND_RANGE="${TREND_RANGE:-${VITE_TREND_RANGE:-24h}}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-https://www.ssge.com.cn:8098}"
REALTIME_PARAMS_BASE_URL="${REALTIME_PARAMS_BASE_URL:-https://ln.szgreenenergy.com}"
REALTIME_PARAMS_TIMEOUT_MS="${REALTIME_PARAMS_TIMEOUT_MS:-1500}"
BYX_POWER_BASE_URL="${BYX_POWER_BASE_URL:-}"
BYX_POWER_APP="${BYX_POWER_APP:-}"
BYX_POWER_PUBLIC_KEY="${BYX_POWER_PUBLIC_KEY:-}"
BYX_POWER_LOGIN_ID="${BYX_POWER_LOGIN_ID:-}"
BYX_POWER_TIMEOUT_MS="${BYX_POWER_TIMEOUT_MS:-3000}"
BYX_POWER_HISTORY_DIR="${BYX_POWER_HISTORY_DIR:-}"
BYX_POWER_ASSIGNMENT_FILE="${BYX_POWER_ASSIGNMENT_FILE:-}"
APP_MODE="${APP_MODE:-local}"
APP_MODE_LABEL="${APP_MODE_LABEL:-}"
# Fail closed: local startup must remain read-only unless an operator
# explicitly opens a reviewed, time-bounded commissioning window.
READ_ONLY_MODE="${READ_ONLY_MODE:-1}"
BFF_APP_BASE_URL="${BFF_APP_BASE_URL:-${VITE_BFF_BASE_URL:-http://127.0.0.1:${BFF_PORT}}}"
BFF_HEALTH_URL="${BFF_HEALTH_URL:-${BFF_APP_BASE_URL}/healthz}"
FRONTEND_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:${FRONTEND_PORT}/}"
# Port 3002 is reserved for chiller-admin-v1. Never start the operator shell
# there, otherwise the project configuration CTA opens the wrong application.
FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3001 3003 3004}"
APP_MODE_SLUG="$(slugify_token "${APP_MODE}")"
BFF_LOG="${BFF_LOG:-/tmp/chiller-bff-${APP_MODE_SLUG}-${BFF_PORT}.log}"
SHELL_LOG_BASE="${SHELL_LOG_BASE:-/tmp/chiller-shell-${APP_MODE_SLUG}}"
SHELL_LOG="${SHELL_LOG:-${SHELL_LOG_BASE}-${FRONTEND_PORT}.log}"
BFF_PID_FILE="${BFF_PID_FILE:-/tmp/chiller_bff_${APP_MODE_SLUG}_${BFF_PORT}.pid}"
SHELL_PID_FILE_BASE="${SHELL_PID_FILE_BASE:-/tmp/chiller_shell_${APP_MODE_SLUG}}"
SHELL_PID_FILE="${SHELL_PID_FILE:-${SHELL_PID_FILE_BASE}_${FRONTEND_PORT}.pid}"
SHELL_ENV_FILE_BASE="${SHELL_ENV_FILE_BASE:-/tmp/chiller_shell_${APP_MODE_SLUG}}"
BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.${APP_MODE_SLUG}.${BFF_PORT}}"
SHELL_LAUNCH_LABEL_PREFIX="${SHELL_LAUNCH_LABEL_PREFIX:-com.billchow.chiller.shell.${APP_MODE_SLUG}}"

say() { printf '%s\n' "$1"; }
ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

kill_pid_if_running() {
  local pid="$1"
  if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
  fi
}

remove_launch_job() {
  local label="$1"
  launchctl remove "$label" >/dev/null 2>&1 || true
}

start_launch_job() {
  local label="$1"
  local log_file="$2"
  shift 2
  remove_launch_job "$label"
  : >"$log_file"
  launchctl submit -l "$label" -o "$log_file" -e "$log_file" -- "$@"
}

is_http_up() {
  local url="$1"
  local code
  code="$(curl -sS -m 3 -o /tmp/chiller_stack_start_body.txt -w '%{http_code}' "$url" || true)"
  echo "$code" | grep -Eq '^2'
}

expected_read_only_json() {
  case "$(printf '%s' "${READ_ONLY_MODE}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      printf 'true\n'
      ;;
    *)
      printf 'false\n'
      ;;
  esac
}

bff_health_matches_expected() {
  local body_file="/tmp/chiller_stack_start_body.txt"
  local expected_read_only
  expected_read_only="$(expected_read_only_json)"
  [ -s "$body_file" ] || return 1
  node -e 'const fs = require("fs"); const [file, appMode, readOnly, legacyBaseUrl, realtimeBaseUrl, realtimeTimeoutMs] = process.argv.slice(1); const trim = (value) => String(value || "").replace(/\/+$/, ""); const data = JSON.parse(fs.readFileSync(file, "utf8")); if (data.appMode !== appMode || String(Boolean(data.readOnlyMode)) !== readOnly || trim(data.legacyBaseUrl) !== trim(legacyBaseUrl) || trim(data.realtimeParamsBaseUrl) !== trim(realtimeBaseUrl) || Number(data.realtimeParamsTimeoutMs) !== Number(realtimeTimeoutMs)) process.exit(1);' \
    "$body_file" "$APP_MODE" "$expected_read_only" "$LEGACY_BASE_URL" "$REALTIME_PARAMS_BASE_URL" "$REALTIME_PARAMS_TIMEOUT_MS" >/dev/null 2>&1
}

find_bff_pid() {
  local pids
  local pid
  local command
  pids="$(lsof -tiTCP:"${BFF_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  for pid in ${pids}; do
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if echo "$command" | grep -q "node src/server.js"; then
      printf '%s\n' "$pid"
      return
    fi
  done
  printf '%s\n' "${pids}" | head -n 1
}

stop_existing_bff() {
  local pid
  remove_launch_job "$BFF_LAUNCH_LABEL"
  if [ -f "$BFF_PID_FILE" ]; then
    pid="$(cat "$BFF_PID_FILE" 2>/dev/null || true)"
    kill_pid_if_running "$pid"
    rm -f "$BFF_PID_FILE"
  fi
  pid="$(find_bff_pid)"
  kill_pid_if_running "$pid"
  sleep 1
}

shell_expected_fingerprint() {
  local port="$1"
  printf '%s\n' \
    "FRONTEND_PORT=${port}" \
    "VITE_BFF_BASE_URL=${BFF_APP_BASE_URL}" \
    "VITE_SITE_ID=${SITE_ID}" \
    "VITE_TREND_RANGE=${TREND_RANGE}" \
    "VITE_LEGACY_BASE_URL=${LEGACY_BASE_URL}" \
    "VITE_APP_MODE=${APP_MODE}" \
    "VITE_APP_MODE_LABEL=${APP_MODE_LABEL}" \
    "VITE_APP_READ_ONLY=${READ_ONLY_MODE}"
}

shell_env_matches_expected() {
  local env_file="$1"
  local port="$2"
  [ -f "$env_file" ] || return 1
  [ "$(cat "$env_file" 2>/dev/null || true)" = "$(shell_expected_fingerprint "$port")" ]
}

write_shell_env_fingerprint() {
  local env_file="$1"
  local port="$2"
  shell_expected_fingerprint "$port" >"$env_file"
}

stop_existing_shell_port() {
  local label="$1"
  local pid_file="$2"
  local env_file="$3"
  local port="$4"
  local pid
  remove_launch_job "$label"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    kill_pid_if_running "$pid"
    rm -f "$pid_file"
  fi
  pid="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  kill_pid_if_running "$pid"
  rm -f "$env_file"
  sleep 1
}

start_bff() {
  if is_http_up "$BFF_HEALTH_URL"; then
    local pid
    if bff_health_matches_expected; then
      pid="$(find_bff_pid)"
      [ -n "$pid" ] && echo "$pid" >"$BFF_PID_FILE"
      ok "bff already up"
      return
    fi
    warn "bff already up but runtime config mismatch; restarting"
    stop_existing_bff
    if is_http_up "$BFF_HEALTH_URL" && bff_health_matches_expected; then
      pid="$(find_bff_pid)"
      [ -n "$pid" ] && echo "$pid" >"$BFF_PID_FILE"
      ok "bff already up after cleanup"
      return
    fi
  fi
  [ -d "$BFF_DIR" ] || fail "missing bff dir: $BFF_DIR"
  start_launch_job \
    "$BFF_LAUNCH_LABEL" \
    "$BFF_LOG" \
    /bin/zsh -lc \
    "cd \"$BFF_DIR\" && export BFF_PORT=\"$BFF_PORT\" LEGACY_BASE_URL=\"$LEGACY_BASE_URL\" REALTIME_PARAMS_BASE_URL=\"$REALTIME_PARAMS_BASE_URL\" REALTIME_PARAMS_TIMEOUT_MS=\"$REALTIME_PARAMS_TIMEOUT_MS\" BYX_POWER_BASE_URL=\"$BYX_POWER_BASE_URL\" BYX_POWER_APP=\"$BYX_POWER_APP\" BYX_POWER_PUBLIC_KEY=\"$BYX_POWER_PUBLIC_KEY\" BYX_POWER_LOGIN_ID=\"$BYX_POWER_LOGIN_ID\" BYX_POWER_TIMEOUT_MS=\"$BYX_POWER_TIMEOUT_MS\" BYX_POWER_HISTORY_DIR=\"$BYX_POWER_HISTORY_DIR\" BYX_POWER_ASSIGNMENT_FILE=\"$BYX_POWER_ASSIGNMENT_FILE\" APP_MODE=\"$APP_MODE\" APP_MODE_LABEL=\"$APP_MODE_LABEL\" READ_ONLY_MODE=\"$READ_ONLY_MODE\" && exec npm run dev"
  ok "bff start issued via launchctl label=${BFF_LAUNCH_LABEL}"
}

start_shell() {
  [ -d "$SHELL_DIR" ] || fail "missing shell dir: $SHELL_DIR"
  local requested_url="${FRONTEND_BASE_URL:-}"
  local requested_port="${FRONTEND_PORT}"
  local port_list=""
  local candidate
  local pid
  local shell_label
  local shell_log
  local shell_pid_file
  local shell_env_file

  if [ -n "${requested_url}" ]; then
    port_list="${requested_port}"
  else
    port_list="${requested_port}"
    for candidate in ${FRONTEND_FALLBACK_PORTS}; do
      if ! echo " ${port_list} " | grep -q " ${candidate} "; then
        port_list="${port_list} ${candidate}"
      fi
    done
  fi

  for candidate in ${port_list}; do
    FRONTEND_PORT="${candidate}"
    if [ -n "${requested_url}" ]; then
      FRONTEND_URL="${requested_url}"
    else
      FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}/"
    fi
    shell_label="${SHELL_LAUNCH_LABEL_PREFIX}.${FRONTEND_PORT}"
    shell_log="${SHELL_LOG_BASE}-${FRONTEND_PORT}.log"
    shell_pid_file="${SHELL_PID_FILE_BASE}_${FRONTEND_PORT}.pid"
    shell_env_file="${SHELL_ENV_FILE_BASE}_${FRONTEND_PORT}.env"

    if is_http_up "$FRONTEND_URL"; then
      if shell_env_matches_expected "$shell_env_file" "$FRONTEND_PORT"; then
        pid="$(lsof -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
        SHELL_LOG="${shell_log}"
        SHELL_PID_FILE="${shell_pid_file}"
        [ -n "$pid" ] && echo "$pid" >"$SHELL_PID_FILE"
        ok "frontend already up"
        return
      fi
      warn "frontend already up but runtime config mismatch; restarting"
      stop_existing_shell_port "$shell_label" "$shell_pid_file" "$shell_env_file" "$FRONTEND_PORT"
    fi

    start_launch_job \
      "$shell_label" \
      "$shell_log" \
      /bin/zsh -lc \
      "cd \"$SHELL_DIR\" && export VITE_BFF_BASE_URL=\"$BFF_APP_BASE_URL\" VITE_SITE_ID=\"$SITE_ID\" VITE_TREND_RANGE=\"$TREND_RANGE\" VITE_LEGACY_BASE_URL=\"$LEGACY_BASE_URL\" VITE_APP_MODE=\"$APP_MODE\" VITE_APP_MODE_LABEL=\"$APP_MODE_LABEL\" VITE_APP_READ_ONLY=\"$READ_ONLY_MODE\" && exec npm run dev -- --host 127.0.0.1 --port \"$FRONTEND_PORT\""

    sleep 2

    if is_http_up "$FRONTEND_URL"; then
      pid="$(lsof -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
      SHELL_LOG="${shell_log}"
      SHELL_PID_FILE="${shell_pid_file}"
      write_shell_env_fingerprint "$shell_env_file" "$FRONTEND_PORT"
      [ -n "$pid" ] && echo "$pid" >"$SHELL_PID_FILE"
      ok "frontend start issued on ${FRONTEND_URL}, pid=${pid:-?}"
      return
    fi

    warn "frontend not ready on port ${FRONTEND_PORT}, trying next candidate"
    remove_launch_job "$shell_label"
    pid="$(lsof -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    kill_pid_if_running "${pid}"
    rm -f "$shell_pid_file"
    rm -f "$shell_env_file"

    if [ -n "${requested_url}" ]; then
      break
    fi
  done

  if [ -n "${requested_url}" ]; then
    fail "frontend start failed for FRONTEND_BASE_URL=${requested_url}"
  fi
  fail "frontend start failed for ports: ${port_list}"
}

wait_up() {
  local name="$1"
  local url="$2"
  local i
  for i in $(seq 1 25); do
    if is_http_up "$url"; then
      ok "${name} is up (${url})"
      return
    fi
    sleep 1
  done
  warn "${name} still not up after timeout (${url}); check logs"
}

say "=== Start Chiller Local Stack ==="
say "appMode=${APP_MODE} readOnly=${READ_ONLY_MODE} siteId=${SITE_ID} trendRange=${TREND_RANGE}"
say "legacy=${LEGACY_BASE_URL}"
say "realtime=${REALTIME_PARAMS_BASE_URL} timeoutMs=${REALTIME_PARAMS_TIMEOUT_MS}"
say "frontend env: VITE_BFF_BASE_URL=${BFF_APP_BASE_URL}"
start_bff
start_shell
wait_up "bff" "$BFF_HEALTH_URL"
wait_up "frontend" "$FRONTEND_URL"
if is_http_up "$BFF_HEALTH_URL"; then
  bff_pid="$(find_bff_pid)"
  [ -n "${bff_pid}" ] && echo "${bff_pid}" >"${BFF_PID_FILE}"
fi
if [ -f "${BFF_LOG}" ]; then
  say "--- bff log tail ---"
  tail -n 20 "${BFF_LOG}" || true
fi
if [ -f "${SHELL_LOG}" ]; then
  say "--- frontend log tail ---"
  tail -n 20 "${SHELL_LOG}" || true
fi
say "=== Done ==="
