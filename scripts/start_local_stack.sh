#!/usr/bin/env bash
set -u

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
SHELL_DIR="${ROOT_DIR}/apps/chiller-shell-v1"
# shellcheck source=/dev/null
[ -f "${ROOT_DIR}/scripts/load_shell_env.sh" ] && . "${ROOT_DIR}/scripts/load_shell_env.sh"
load_shell_env_defaults "${ROOT_DIR}"

BFF_PORT="${BFF_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
SITE_ID="${SITE_ID:-${VITE_SITE_ID:-126lnoffice}}"
TREND_RANGE="${TREND_RANGE:-${VITE_TREND_RANGE:-24h}}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-http://127.0.0.1:8098}"
APP_MODE="${APP_MODE:-local}"
APP_MODE_LABEL="${APP_MODE_LABEL:-}"
READ_ONLY_MODE="${READ_ONLY_MODE:-0}"
BFF_APP_BASE_URL="${BFF_APP_BASE_URL:-${VITE_BFF_BASE_URL:-http://127.0.0.1:${BFF_PORT}}}"
BFF_HEALTH_URL="${BFF_HEALTH_URL:-${BFF_APP_BASE_URL}/healthz}"
FRONTEND_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:${FRONTEND_PORT}/}"
FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3001 3002 3003}"
BFF_LOG="/tmp/chiller-bff-dev.log"
SHELL_LOG="/tmp/chiller-shell-dev.log"
BFF_PID_FILE="/tmp/chiller_bff.pid"
SHELL_PID_FILE="/tmp/chiller_shell.pid"
BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.dev}"
SHELL_LAUNCH_LABEL_PREFIX="${SHELL_LAUNCH_LABEL_PREFIX:-com.billchow.chiller.shell.dev}"

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

start_bff() {
  if is_http_up "$BFF_HEALTH_URL"; then
    local pid
    pid="$(lsof -tiTCP:"${BFF_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    [ -n "$pid" ] && echo "$pid" >"$BFF_PID_FILE"
    ok "bff already up"
    return
  fi
  [ -d "$BFF_DIR" ] || fail "missing bff dir: $BFF_DIR"
  start_launch_job \
    "$BFF_LAUNCH_LABEL" \
    "$BFF_LOG" \
    /bin/zsh -lc \
    "cd \"$BFF_DIR\" && export BFF_PORT=\"$BFF_PORT\" LEGACY_BASE_URL=\"$LEGACY_BASE_URL\" APP_MODE=\"$APP_MODE\" APP_MODE_LABEL=\"$APP_MODE_LABEL\" READ_ONLY_MODE=\"$READ_ONLY_MODE\" && exec npm run dev"
  ok "bff start issued via launchctl label=${BFF_LAUNCH_LABEL}"
}

start_shell() {
  if is_http_up "$FRONTEND_URL"; then
    ok "frontend already up"
    return
  fi
  [ -d "$SHELL_DIR" ] || fail "missing shell dir: $SHELL_DIR"
  local requested_url="${FRONTEND_BASE_URL:-}"
  local requested_port="${FRONTEND_PORT}"
  local port_list=""
  local candidate
  local pid
  local shell_label

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
    FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}/"
    shell_label="${SHELL_LAUNCH_LABEL_PREFIX}.${FRONTEND_PORT}"

    start_launch_job \
      "$shell_label" \
      "$SHELL_LOG" \
      /bin/zsh -lc \
      "cd \"$SHELL_DIR\" && export VITE_BFF_BASE_URL=\"$BFF_APP_BASE_URL\" VITE_SITE_ID=\"$SITE_ID\" VITE_TREND_RANGE=\"$TREND_RANGE\" VITE_LEGACY_BASE_URL=\"$LEGACY_BASE_URL\" VITE_APP_MODE=\"$APP_MODE\" VITE_APP_MODE_LABEL=\"$APP_MODE_LABEL\" VITE_APP_READ_ONLY=\"$READ_ONLY_MODE\" && exec npm run dev -- --host 127.0.0.1 --port \"$FRONTEND_PORT\""

    sleep 2

    if is_http_up "$FRONTEND_URL"; then
      pid="$(lsof -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
      [ -n "$pid" ] && echo "$pid" >"$SHELL_PID_FILE"
      ok "frontend start issued on ${FRONTEND_URL}, pid=${pid:-?}"
      return
    fi

    warn "frontend not ready on port ${FRONTEND_PORT}, trying next candidate"
    remove_launch_job "$shell_label"
    pid="$(lsof -tiTCP:"${FRONTEND_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    kill_pid_if_running "${pid}"
    rm -f "$SHELL_PID_FILE"

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
say "frontend env: VITE_BFF_BASE_URL=${BFF_APP_BASE_URL}"
start_bff
start_shell
wait_up "bff" "$BFF_HEALTH_URL"
wait_up "frontend" "$FRONTEND_URL"
if is_http_up "$BFF_HEALTH_URL"; then
  bff_pid="$(lsof -tiTCP:"${BFF_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
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
