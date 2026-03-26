#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-/Users/billchow/Documents/chiller-station-legacy/config/nginx.local.conf}"
SHELL_ROOT="${SHELL_ROOT:-/Users/billchow/Documents/智慧冷冻站/apps/chiller-shell-v1/dist}"
LEGACY_ROOT="${LEGACY_ROOT:-/Users/billchow/Documents/126lnoffice/web/vue_dist}"
LISTEN_PORT="${LISTEN_PORT:-3001}"

usage() {
  cat <<'EOF'
Usage:
  manage_3001_entry.sh status
  manage_3001_entry.sh switch shell
  manage_3001_entry.sh switch legacy

Environment:
  CONFIG_PATH  nginx config path
  SHELL_ROOT   new shell root path
  LEGACY_ROOT  legacy vue_dist root path
  LISTEN_PORT  target server listen port (default 3001)
EOF
}

read_current_root() {
  awk -v port="${LISTEN_PORT}" '
    BEGIN { in_server=0; in_loc=0; depth=0; loc_depth=0; root="" }
    {
      line=$0
      open_count=gsub(/\{/, "{", line)
      close_count=gsub(/\}/, "}", line)
    }
    /^[[:space:]]*server[[:space:]]*\{/ {
      in_server=1
      depth=1
      in_loc=0
      next
    }
    in_server {
      if ($0 ~ "^[[:space:]]*listen[[:space:]]+" port "([[:space:];]|$)") {
        target_server=1
      }
      if (target_server && $0 ~ "^[[:space:]]*location[[:space:]]+/[[:space:]]*\\{") {
        in_loc=1
        loc_depth=1
        next
      }
      if (target_server && in_loc && $0 ~ "^[[:space:]]*root[[:space:]]+") {
        root=$0
        sub(/^[[:space:]]*root[[:space:]]+/, "", root)
        sub(/;.*/, "", root)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", root)
        if (root != "") {
          print root
          exit 0
        }
      }

      if (target_server && in_loc) {
        loc_depth += open_count
        loc_depth -= close_count
        if (loc_depth <= 0) {
          in_loc=0
        }
      }
      depth += open_count
      depth -= close_count
      if (depth <= 0) {
        in_server=0
        target_server=0
        in_loc=0
      }
    }
  ' "${CONFIG_PATH}"
}

show_status() {
  local current
  current="$(read_current_root || true)"
  if [ -z "${current}" ]; then
    echo "[WARN] Cannot detect current root from ${CONFIG_PATH} (listen ${LISTEN_PORT})"
    return 1
  fi

  echo "CONFIG_PATH=${CONFIG_PATH}"
  echo "LISTEN_PORT=${LISTEN_PORT}"
  echo "CURRENT_ROOT=${current}"
  if [ "${current}" = "${SHELL_ROOT}" ]; then
    echo "ENTRY_MODE=shell"
  elif [ "${current}" = "${LEGACY_ROOT}" ]; then
    echo "ENTRY_MODE=legacy"
  else
    echo "ENTRY_MODE=custom"
  fi
}

switch_entry() {
  local target_mode="$1"
  local target_root=""
  case "${target_mode}" in
    shell) target_root="${SHELL_ROOT}" ;;
    legacy) target_root="${LEGACY_ROOT}" ;;
    *) echo "[FAIL] Unsupported target mode: ${target_mode}"; usage; exit 1 ;;
  esac

  local current
  current="$(read_current_root || true)"
  if [ -z "${current}" ]; then
    echo "[FAIL] Cannot detect current root in ${CONFIG_PATH}"
    exit 1
  fi

  if [ "${current}" = "${target_root}" ]; then
    echo "[OK] Already in target mode: ${target_mode}"
    show_status
    exit 0
  fi

  local backup="${CONFIG_PATH}.bak.$(date +%Y%m%d%H%M%S)"
  cp "${CONFIG_PATH}" "${backup}"
  echo "[OK] Backup created: ${backup}"

  awk -v port="${LISTEN_PORT}" -v new_root="${target_root}" '
    BEGIN { in_server=0; depth=0; target_server=0; in_loc=0; loc_depth=0; changed=0 }
    {
      raw=$0
      line=$0
      open_count=gsub(/\{/, "{", line)
      close_count=gsub(/\}/, "}", line)

      if (raw ~ /^[[:space:]]*server[[:space:]]*\{/) {
        in_server=1
        depth=1
        target_server=0
        in_loc=0
        print raw
        next
      }

      if (in_server) {
        if (raw ~ "^[[:space:]]*listen[[:space:]]+" port "([[:space:];]|$)") {
          target_server=1
        }
        if (target_server && raw ~ /^[[:space:]]*location[[:space:]]+\/[[:space:]]*\{/) {
          in_loc=1
          loc_depth=1
          print raw
          next
        }
        if (target_server && in_loc && raw ~ /^[[:space:]]*root[[:space:]]+/) {
          indent=raw
          sub(/root.*/, "", indent)
          printf "%sroot   %s;\n", indent, new_root
          changed=1
        } else {
          print raw
        }

        if (target_server && in_loc) {
          loc_depth += open_count
          loc_depth -= close_count
          if (loc_depth <= 0) {
            in_loc=0
          }
        }
        depth += open_count
        depth -= close_count
        if (depth <= 0) {
          in_server=0
          target_server=0
          in_loc=0
        }
        next
      }

      print raw
    }
    END {
      if (!changed) {
        exit 2
      }
    }
  ' "${CONFIG_PATH}" > "${CONFIG_PATH}.tmp" || {
    rc=$?
    rm -f "${CONFIG_PATH}.tmp"
    if [ "${rc}" = "2" ]; then
      echo "[FAIL] Did not find target root line to update."
    else
      echo "[FAIL] Failed to rewrite config (awk rc=${rc})"
    fi
    exit 1
  }

  mv "${CONFIG_PATH}.tmp" "${CONFIG_PATH}"
  echo "[OK] Updated root -> ${target_root}"

  nginx -t -c "${CONFIG_PATH}"
  nginx -s reload -c "${CONFIG_PATH}"
  echo "[OK] nginx reloaded"
  show_status
}

main() {
  if [ ! -f "${CONFIG_PATH}" ]; then
    echo "[FAIL] Config not found: ${CONFIG_PATH}"
    exit 1
  fi

  local cmd="${1:-status}"
  case "${cmd}" in
    status)
      show_status
      ;;
    switch)
      local mode="${2:-}"
      if [ -z "${mode}" ]; then
        usage
        exit 1
      fi
      switch_entry "${mode}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
