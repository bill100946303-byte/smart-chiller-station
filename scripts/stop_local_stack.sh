#!/usr/bin/env bash
set -u

BFF_PID_FILE="/tmp/chiller_bff.pid"
SHELL_PID_FILE="/tmp/chiller_shell.pid"
BFF_PORT="${BFF_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3001 3002 3003}"
BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.dev}"
SHELL_LAUNCH_LABEL_PREFIX="${SHELL_LAUNCH_LABEL_PREFIX:-com.billchow.chiller.shell.dev}"

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

say "=== Stop Chiller Local Stack ==="
remove_launch_job "${BFF_LAUNCH_LABEL}"
for port in ${FRONTEND_FALLBACK_PORTS}; do
  remove_launch_job "${SHELL_LAUNCH_LABEL_PREFIX}.${port}"
done
kill_by_pid_file "bff" "$BFF_PID_FILE"
kill_by_pid_file "frontend" "$SHELL_PID_FILE"
kill_port_listener "bff" "${BFF_PORT}"
for port in ${FRONTEND_FALLBACK_PORTS}; do
  kill_port_listener "frontend" "${port}"
done
say "=== Done ==="
