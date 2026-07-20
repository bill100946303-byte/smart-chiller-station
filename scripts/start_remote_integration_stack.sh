#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"

pick_free_port() {
  local candidate
  for candidate in "$@"; do
    if ! lsof -nP -iTCP:"${candidate}" -sTCP:LISTEN >/dev/null 2>&1; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  printf '%s\n' "$1"
}

DEFAULT_BFF_PORT="$(pick_free_port 8788 8789 8790 8791)"
DEFAULT_FRONTEND_PORT="$(pick_free_port 3004 3005 3006 3007)"

export APP_MODE="${APP_MODE:-remote-integration}"
export APP_MODE_LABEL="${APP_MODE_LABEL:-远端联调}"
export READ_ONLY_MODE="${READ_ONLY_MODE:-1}"
export LEGACY_BASE_URL="${LEGACY_BASE_URL:-https://www.ssge.com.cn:8098}"
export BFF_PORT="${BFF_PORT:-${DEFAULT_BFF_PORT}}"
export FRONTEND_PORT="${FRONTEND_PORT:-${DEFAULT_FRONTEND_PORT}}"
export BFF_APP_BASE_URL="${BFF_APP_BASE_URL:-http://127.0.0.1:${BFF_PORT}}"
export BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.remote-integration.${BFF_PORT}}"
export SHELL_LAUNCH_LABEL_PREFIX="${SHELL_LAUNCH_LABEL_PREFIX:-com.billchow.chiller.shell.remote.integration}"
export FRONTEND_FALLBACK_PORTS="${FRONTEND_FALLBACK_PORTS:-3004 3005 3006 3007}"

exec "${ROOT_DIR}/scripts/start_local_stack.sh"
