#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
SHELL_DIR="${ROOT_DIR}/apps/chiller-shell-v1"
REPAIR_BFF_SCRIPT="${ROOT_DIR}/scripts/repair-bff-8787.sh"
NGINX_BIN="/opt/homebrew/bin/nginx"
BREW_BIN="/opt/homebrew/bin/brew"
NODE_BIN="/opt/homebrew/bin/node"
NGINX_SITE_CONFIG="/opt/homebrew/etc/nginx/servers/chiller-shell-3001.conf"

fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }
ok() { printf '[OK] %s\n' "$*"; }

[ -x "${NGINX_BIN}" ] || fail "nginx is not installed at ${NGINX_BIN}"
[ -x "${BREW_BIN}" ] || fail "Homebrew is not installed at ${BREW_BIN}"
[ -x "${NODE_BIN}" ] || fail "node is not installed at ${NODE_BIN}"
[ -f "${NGINX_SITE_CONFIG}" ] || fail "missing nginx site config: ${NGINX_SITE_CONFIG}"
[ -x "${REPAIR_BFF_SCRIPT}" ] || fail "missing executable BFF repair script: ${REPAIR_BFF_SCRIPT}"

mkdir -p "${SHELL_DIR}/.logs"
"${REPAIR_BFF_SCRIPT}"
"${NGINX_BIN}" -t

if ! curl -fsS --max-time 3 http://127.0.0.1:3001/health >/dev/null; then
  "${BREW_BIN}" services restart nginx
fi

for _ in $(seq 1 15); do
  if curl -fsS --max-time 3 http://127.0.0.1:3001/health >/dev/null; then
    ok "3001 health endpoint is available"
    curl -fsS --max-time 5 'http://127.0.0.1:3001/bff/v1/sites/126lnoffice/capabilities' |
      "${NODE_BIN}" -e '
        let body = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { body += chunk; });
        process.stdin.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const types = new Set((payload.items || []).map((item) => item.subsystemType));
            const required = ["chilled_plant", "compressed_air", "boiler_room"];
            process.exit(payload.sourceStatus?.overall === "ok" && required.every((type) => types.has(type)) ? 0 : 1);
          } catch {
            process.exit(1);
          }
        });
      '
    curl -fsS --max-time 5 'http://127.0.0.1:3001/bff/v1/sites/140/capabilities' |
      "${NODE_BIN}" -e '
        let body = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { body += chunk; });
        process.stdin.on("end", () => {
          try {
            const payload = JSON.parse(body);
            const chilledPlant = (payload.items || []).find((item) => item.subsystemType === "chilled_plant");
            process.exit(payload.sourceStatus?.overall === "ok" && Boolean(chilledPlant) ? 0 : 1);
          } catch {
            process.exit(1);
          }
        });
      '
    ok "multi-station capabilities are available through 3001"
    curl -fsS --max-time 3 'http://127.0.0.1:3001/hvac-terminal?siteId=126&view=control' >/dev/null
    ok "3001 control route is available"
    exit 0
  fi
  sleep 1
done

fail "3001 did not recover; inspect ${SHELL_DIR}/.logs/nginx-3001.error.log"
