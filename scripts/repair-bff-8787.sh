#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
BFF_PORT="${BFF_PORT:-8787}"
BFF_HEALTH_URL="${BFF_HEALTH_URL:-http://127.0.0.1:${BFF_PORT}/healthz}"
BFF_LAUNCH_LABEL="${BFF_LAUNCH_LABEL:-com.billchow.chiller.bff.local.${BFF_PORT}}"
BFF_LOG="${BFF_LOG:-/tmp/chiller-bff-local-${BFF_PORT}.log}"
NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"

# shellcheck source=/dev/null
[ -f "${ROOT_DIR}/scripts/load_shell_env.sh" ] && . "${ROOT_DIR}/scripts/load_shell_env.sh"
load_shell_env_defaults "${ROOT_DIR}"

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
# Fail closed for unattended recovery. Real writes require an explicit,
# reviewed READ_ONLY_MODE=0 override at invocation time.
READ_ONLY_MODE="${READ_ONLY_MODE:-1}"

fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }
ok() { printf '[OK] %s\n' "$*"; }

bff_healthy() {
  local expected_read_only
  case "$(printf '%s' "${READ_ONLY_MODE}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) expected_read_only="true" ;;
    *) expected_read_only="false" ;;
  esac
  curl -fsS --max-time 3 "${BFF_HEALTH_URL}" |
    "${NODE_BIN}" -e '
      let body = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { body += chunk; });
      process.stdin.on("end", () => {
        try {
          const payload = JSON.parse(body);
          const expectedReadOnly = process.argv[2] === "true";
          process.exit(
            payload.ok === true &&
            Number(payload.port) === Number(process.argv[1]) &&
            payload.readOnlyMode === expectedReadOnly
              ? 0
              : 1
          );
        } catch {
          process.exit(1);
        }
      });
    ' "${BFF_PORT}" "${expected_read_only}"
}

if bff_healthy; then
  ok "BFF ${BFF_PORT} health endpoint is available"
  exit 0
fi

[ -d "${BFF_DIR}" ] || fail "missing BFF directory: ${BFF_DIR}"
[ -f "${BFF_DIR}/package.json" ] || fail "missing BFF package.json"
[ -x "${NODE_BIN}" ] || fail "node is not installed at ${NODE_BIN}"

listener_pid="$(lsof -tiTCP:"${BFF_PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [ -n "${listener_pid}" ]; then
  fail "port ${BFF_PORT} is occupied by pid ${listener_pid}, but BFF health contract failed"
fi

launchctl remove "${BFF_LAUNCH_LABEL}" >/dev/null 2>&1 || true
: >"${BFF_LOG}"
launchctl submit \
  -l "${BFF_LAUNCH_LABEL}" \
  -o "${BFF_LOG}" \
  -e "${BFF_LOG}" \
  -- \
  /usr/bin/env \
  BFF_PORT="${BFF_PORT}" \
  LEGACY_BASE_URL="${LEGACY_BASE_URL}" \
  REALTIME_PARAMS_BASE_URL="${REALTIME_PARAMS_BASE_URL}" \
  REALTIME_PARAMS_TIMEOUT_MS="${REALTIME_PARAMS_TIMEOUT_MS}" \
  BYX_POWER_BASE_URL="${BYX_POWER_BASE_URL}" \
  BYX_POWER_APP="${BYX_POWER_APP}" \
  BYX_POWER_PUBLIC_KEY="${BYX_POWER_PUBLIC_KEY}" \
  BYX_POWER_LOGIN_ID="${BYX_POWER_LOGIN_ID}" \
  BYX_POWER_TIMEOUT_MS="${BYX_POWER_TIMEOUT_MS}" \
  BYX_POWER_HISTORY_DIR="${BYX_POWER_HISTORY_DIR}" \
  BYX_POWER_ASSIGNMENT_FILE="${BYX_POWER_ASSIGNMENT_FILE}" \
  APP_MODE="${APP_MODE}" \
  APP_MODE_LABEL="${APP_MODE_LABEL}" \
  READ_ONLY_MODE="${READ_ONLY_MODE}" \
  /bin/zsh -lc "cd \"${BFF_DIR}\" && exec npm run dev"

for _ in $(seq 1 25); do
  if bff_healthy; then
    ok "BFF ${BFF_PORT} recovered via launchctl label=${BFF_LAUNCH_LABEL}"
    exit 0
  fi
  sleep 1
done

fail "BFF ${BFF_PORT} did not recover; inspect ${BFF_LOG}"
