#!/usr/bin/env bash
set -u

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

APP_MODE="${APP_MODE:-local}"
APP_MODE_SLUG="$(slugify_token "${APP_MODE}")"
BFF_PORT="${BFF_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
# Keep the fixed 3002 admin UI outside the operator-shell stop sweep.
FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3001 3003 3004}"
BFF_PID_FILE="${BFF_PID_FILE:-/tmp/chiller_bff_${APP_MODE_SLUG}_${BFF_PORT}.pid}"
SHELL_PID_FILE="${SHELL_PID_FILE:-/tmp/chiller_shell_${APP_MODE_SLUG}_${FRONTEND_PORT}.pid}"
SHELL_ENV_FILE_BASE="${SHELL_ENV_FILE_BASE:-/tmp/chiller_shell_${APP_MODE_SLUG}}"
SHELL_ENV_FILE="${SHELL_ENV_FILE:-${SHELL_ENV_FILE_BASE}_${FRONTEND_PORT}.env}"
BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.${APP_MODE_SLUG}.${BFF_PORT}}"
SHELL_LAUNCH_LABEL_PREFIX="${SHELL_LAUNCH_LABEL_PREFIX:-com.billchow.chiller.shell.${APP_MODE_SLUG}}"

say() { printf '%s\n' "$1"; }
ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }

remove_launch_job() {
  local label="$1"
  launchctl remove "$label" >/dev/null 2>&1 || true
}

kill_port_listener() {
  local name="$1"
  local port="$2"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    kill ${pids} >/dev/null 2>&1 || true
    ok "${name}: killed residual listener(s) on :${port}"
  fi
}

kill_by_pid_file() {
  local name="$1"
  local pid_file="$2"
  if [ ! -f "$pid_file" ]; then
    warn "${name}: pid file missing (${pid_file})"
    return
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    warn "${name}: pid file empty (${pid_file})"
    rm -f "$pid_file"
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    ok "${name}: stop signal sent (pid=${pid})"
  else
    warn "${name}: process not running (pid=${pid})"
  fi
  rm -f "$pid_file"
}

remove_shell_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    rm -f "$env_file"
    ok "frontend: removed env fingerprint (${env_file})"
  fi
}

say "=== Stop Chiller Local Stack ==="
remove_launch_job "${BFF_LAUNCH_LABEL}"
for port in ${FRONTEND_FALLBACK_PORTS}; do
  remove_launch_job "${SHELL_LAUNCH_LABEL_PREFIX}.${port}"
done
kill_by_pid_file "bff" "$BFF_PID_FILE"
kill_by_pid_file "frontend" "$SHELL_PID_FILE"
remove_shell_env_file "$SHELL_ENV_FILE"
kill_port_listener "bff" "${BFF_PORT}"
for port in ${FRONTEND_FALLBACK_PORTS}; do
  kill_port_listener "frontend" "${port}"
  remove_shell_env_file "${SHELL_ENV_FILE_BASE}_${port}.env"
done
say "=== Done ==="
