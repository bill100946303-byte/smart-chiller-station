#!/usr/bin/env bash

load_shell_env_defaults() {
  local root_dir="${1:-}"
  if [ -z "${root_dir}" ]; then
    return 0
  fi

  local env_file="${root_dir}/apps/chiller-shell-v1/.env.local"
  if [ ! -f "${env_file}" ]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1090
  . "${env_file}"
  set +a
}
