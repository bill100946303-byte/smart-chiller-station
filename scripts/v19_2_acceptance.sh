#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
ENTRY_SCRIPT="${ROOT_DIR}/scripts/manage_3001_entry.sh"
EVAL_SCRIPT="${ROOT_DIR}/scripts/evaluate_non_degraded_readiness.mjs"
BADGE_SCRIPT="${ROOT_DIR}/scripts/generate_ui_badge_state.mjs"
REPORT_JSON="${ROOT_DIR}/docs/v19.2-acceptance-report.json"
REPORT_MD="${ROOT_DIR}/docs/v19.2-acceptance-report.md"
REPORT_UNAVAILABLE_JSON="${ROOT_DIR}/docs/v19.2-acceptance-report.unavailable.json"
REPORT_UNAVAILABLE_MD="${ROOT_DIR}/docs/v19.2-acceptance-report.unavailable.md"
LOG_FILE="${ROOT_DIR}/docs/v19.2-acceptance.log"

SITE_ID="${SITE_ID:-126lnoffice}"
BFF_BASE_URL="${BFF_BASE_URL:-http://127.0.0.1:8787}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:3001}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-http://127.0.0.1:8098}"
BADGE_DOC_PATH="${ROOT_DIR}/docs/ui-badge-state-v1.8.json"
BADGE_PUBLIC_PATH="${ROOT_DIR}/apps/chiller-shell-v1/public/ui-badge-state-v1.8.json"
BADGE_DIST_PATH="${ROOT_DIR}/apps/chiller-shell-v1/dist/ui-badge-state-v1.8.json"
PROBE_FILE="/tmp/chiller_probe_acceptance.json"
READINESS_FILE="/tmp/chiller_readiness_report.json"
WRITE_CANONICAL_ON_UNAVAILABLE="${WRITE_CANONICAL_ON_UNAVAILABLE:-0}"
DRY_RUN="${DRY_RUN:-0}"
DRY_RUN_REPORT_JSON="/tmp/v19.2-acceptance-dry-run.json"
DRY_RUN_REPORT_MD="/tmp/v19.2-acceptance-dry-run.md"

say() { printf '%s\n' "$1"; }

check_http_status() {
  local url="$1"
  local code
  code="$(curl -sS -m 6 -o /tmp/chiller_accept_check_body.txt -w '%{http_code}' "${url}" 2>/dev/null || true)"
  if [ -z "${code}" ]; then
    code="000"
  fi
  echo "${code}"
}

endpoint_status_and_overall() {
  local url="$1"
  local body_file="$2"
  local code overall
  code="$(curl -sS -m 6 -o "${body_file}" -w '%{http_code}' "${url}" 2>/dev/null || true)"
  [ -z "${code}" ] && code="000"
  overall=""
  if [ "${code}" = "200" ]; then
    overall="$(jq -r '.sourceStatus.overall // empty' "${body_file}" 2>/dev/null || true)"
  fi
  printf '%s|%s\n' "${code}" "${overall}"
}

sync_badge_files() {
  if [ -f "${BADGE_DOC_PATH}" ]; then
    mkdir -p "$(dirname "${BADGE_PUBLIC_PATH}")"
    cp "${BADGE_DOC_PATH}" "${BADGE_PUBLIC_PATH}"
    if [ -d "${ROOT_DIR}/apps/chiller-shell-v1/dist" ]; then
      cp "${BADGE_DOC_PATH}" "${BADGE_DIST_PATH}"
    fi
  fi
}

main() {
  local run_log run_mode
  run_mode="normal"
  if [ "${DRY_RUN}" = "1" ]; then
    run_mode="dry-run"
    run_log="$(mktemp)"
  else
    run_log="${LOG_FILE}"
    : >"${run_log}"
  fi
  say "v19.2 acceptance started (${run_mode}): $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "${run_log}"

  # 1) force 3001 entry to shell mode (idempotent)
  if [ "${DRY_RUN}" != "1" ]; then
    "${ENTRY_SCRIPT}" switch shell >>"${run_log}" 2>&1 || true
  fi
  local entry_mode entry_ok
  entry_mode="$("${ENTRY_SCRIPT}" status | awk -F= '/^ENTRY_MODE=/{print $2}' | tr -d '\r')"
  entry_ok="false"
  [ "${entry_mode}" = "shell" ] && entry_ok="true"

  # 2) contract gate
  local contract_ok="false"
  if (cd "${ROOT_DIR}/apps/chiller-bff" && npm run check:contract >>"${run_log}" 2>&1); then
    contract_ok="true"
  fi

  # 3) raw stack http checks
  local legacy_status bff_status frontend_status
  legacy_status="$(check_http_status "${LEGACY_BASE_URL}/healthz")"
  bff_status="$(check_http_status "${BFF_BASE_URL}/healthz")"
  frontend_status="$(check_http_status "${FRONTEND_BASE_URL}/")"

  local legacy_ok bff_ok frontend_ok stack_ok
  legacy_ok="false"
  bff_ok="false"
  frontend_ok="false"
  stack_ok="false"
  [ "${legacy_status}" != "000" ] && legacy_ok="true"
  if echo "${bff_status}" | grep -Eq '^2'; then bff_ok="true"; fi
  if echo "${frontend_status}" | grep -Eq '^2'; then frontend_ok="true"; fi
  if [ "${legacy_ok}" = "true" ] && [ "${bff_ok}" = "true" ] && [ "${frontend_ok}" = "true" ]; then
    stack_ok="true"
  fi

  # 4) bff probe + readiness evaluate
  local probe_ok readiness_ready readiness_nd_failed
  probe_ok="false"
  readiness_ready="false"
  readiness_nd_failed=""
  if (cd "${ROOT_DIR}/apps/chiller-bff" && node scripts/probe.js "${SITE_ID}" >"${PROBE_FILE}" 2>>"${run_log}"); then
    probe_ok="true"
    if node "${EVAL_SCRIPT}" --input "${PROBE_FILE}" --output "${READINESS_FILE}" >>"${run_log}" 2>&1; then
      readiness_ready="$(jq -r '.nonDegradedReady // false' "${READINESS_FILE}" 2>/dev/null || echo "false")"
      readiness_nd_failed="$(jq -r '.nd.failedCount // ""' "${READINESS_FILE}" 2>/dev/null || true)"
      if [ "${DRY_RUN}" != "1" ] &&
        node "${BADGE_SCRIPT}" --input "${READINESS_FILE}" --output "${BADGE_DOC_PATH}" >>"${run_log}" 2>&1; then
        sync_badge_files
      fi
    fi
  fi

  # 5) endpoint status
  local tmp_overview tmp_trends tmp_anomalies tmp_recommendations
  tmp_overview="$(mktemp)"
  tmp_trends="$(mktemp)"
  tmp_anomalies="$(mktemp)"
  tmp_recommendations="$(mktemp)"

  local overview_code overview_overall
  local trends_code trends_overall
  local anomalies_code anomalies_overall
  local recommendations_code recommendations_overall
  IFS='|' read -r overview_code overview_overall < <(
    endpoint_status_and_overall "${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/dashboard/overview" "${tmp_overview}"
  )
  IFS='|' read -r trends_code trends_overall < <(
    endpoint_status_and_overall "${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/dashboard/trends?range=24h" "${tmp_trends}"
  )
  IFS='|' read -r anomalies_code anomalies_overall < <(
    endpoint_status_and_overall "${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/anomalies/summary" "${tmp_anomalies}"
  )
  IFS='|' read -r recommendations_code recommendations_overall < <(
    endpoint_status_and_overall "${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/recommendations" "${tmp_recommendations}"
  )

  local overview_ok trends_ok anomalies_ok recommendations_ok
  overview_ok="false"; trends_ok="false"; anomalies_ok="false"; recommendations_ok="false"
  [ "${overview_overall}" = "ok" ] && overview_ok="true"
  [ "${trends_overall}" = "ok" ] && trends_ok="true"
  [ "${anomalies_overall}" = "ok" ] && anomalies_ok="true"
  [ "${recommendations_overall}" = "ok" ] && recommendations_ok="true"

  local badge_pass
  badge_pass="false"
  if [ -f "${BADGE_DOC_PATH}" ]; then
    badge_pass="$(jq -r '.global.pass // false' "${BADGE_DOC_PATH}" 2>/dev/null || echo "false")"
  fi

  local overall_pass
  overall_pass="false"
  if [ "${entry_ok}" = "true" ] &&
    [ "${stack_ok}" = "true" ] &&
    [ "${contract_ok}" = "true" ] &&
    [ "${probe_ok}" = "true" ] &&
    [ "${readiness_ready}" = "true" ] &&
    [ "${badge_pass}" = "true" ] &&
    [ "${overview_ok}" = "true" ] &&
    [ "${trends_ok}" = "true" ] &&
    [ "${anomalies_ok}" = "true" ] &&
    [ "${recommendations_ok}" = "true" ]; then
    overall_pass="true"
  fi

  local runtime_unavailable
  runtime_unavailable="false"
  if [ "${legacy_status}" = "000" ] &&
    [ "${bff_status}" = "000" ] &&
    [ "${frontend_status}" = "000" ] &&
    [ "${overview_code}" = "000" ] &&
    [ "${trends_code}" = "000" ] &&
    [ "${anomalies_code}" = "000" ] &&
    [ "${recommendations_code}" = "000" ]; then
    runtime_unavailable="true"
  fi

  local tmp_report_json tmp_report_md
  tmp_report_json="$(mktemp)"
  tmp_report_md="$(mktemp)"
  local report_target_json report_target_md
  report_target_json="${REPORT_JSON}"
  report_target_md="${REPORT_MD}"
  if [ "${DRY_RUN}" = "1" ]; then
    report_target_json="${DRY_RUN_REPORT_JSON}"
    report_target_md="${DRY_RUN_REPORT_MD}"
  fi

  cat >"${tmp_report_json}" <<EOF
{
  "version": "v19.2",
  "mode": "${run_mode}",
  "generatedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "siteId": "${SITE_ID}",
  "runtimeUnavailable": ${runtime_unavailable},
  "entry": {"mode": "${entry_mode:-unknown}", "port3001Ok": ${entry_ok}},
  "contract": {"ok": ${contract_ok}},
  "stack": {
    "ok": ${stack_ok},
    "legacyHealthStatus": "${legacy_status}",
    "bffHealthStatus": "${bff_status}",
    "frontendStatus": "${frontend_status}"
  },
  "probe": {"ok": ${probe_ok}, "file": "${PROBE_FILE}"},
  "readiness": {"nonDegradedReady": ${readiness_ready}, "ndFailedCount": ${readiness_nd_failed:-null}},
  "badge": {"globalPass": ${badge_pass}, "path": "${BADGE_DOC_PATH}"},
  "endpoints": {
    "overview": {"status": "${overview_code}", "overall": "${overview_overall}", "ok": ${overview_ok}},
    "trends": {"status": "${trends_code}", "overall": "${trends_overall}", "ok": ${trends_ok}},
    "anomalies": {"status": "${anomalies_code}", "overall": "${anomalies_overall}", "ok": ${anomalies_ok}},
    "recommendations": {"status": "${recommendations_code}", "overall": "${recommendations_overall}", "ok": ${recommendations_ok}}
  },
  "overallPass": ${overall_pass}
}
EOF

  cat >"${tmp_report_md}" <<EOF
# V19.2 一键验收报告

- 时间：$(date '+%Y-%m-%d %H:%M:%S')
- 模式：\`${run_mode}\`
- 站点：\`${SITE_ID}\`
- 结论：**$( [ "${overall_pass}" = "true" ] && echo "PASS" || echo "FAIL" )**
- runtimeUnavailable=\`${runtime_unavailable}\`

## 关键结果
- entry.mode=\`${entry_mode:-unknown}\`
- contract.ok=\`${contract_ok}\`
- stack.ok=\`${stack_ok}\` (legacy=${legacy_status}, bff=${bff_status}, frontend=${frontend_status})
- readiness.nonDegradedReady=\`${readiness_ready}\`
- badge.globalPass=\`${badge_pass}\`
- endpoints.overview/trends/anomalies/recommendations=\`${overview_overall}/${trends_overall}/${anomalies_overall}/${recommendations_overall}\`

## 产物
- JSON：\`${report_target_json}\`
- 日志：\`${run_log}\`
EOF

  if [ "${DRY_RUN}" = "1" ]; then
    cp "${tmp_report_json}" "${DRY_RUN_REPORT_JSON}"
    cp "${tmp_report_md}" "${DRY_RUN_REPORT_MD}"
    say "[INFO] dry-run report json: ${DRY_RUN_REPORT_JSON}" | tee -a "${run_log}"
    say "[INFO] dry-run report md: ${DRY_RUN_REPORT_MD}" | tee -a "${run_log}"
    say "[INFO] canonical report unchanged: ${REPORT_JSON}" | tee -a "${run_log}"
  elif [ "${runtime_unavailable}" = "true" ] &&
    [ "${WRITE_CANONICAL_ON_UNAVAILABLE}" != "1" ] &&
    [ -f "${REPORT_JSON}" ]; then
    cp "${tmp_report_json}" "${REPORT_UNAVAILABLE_JSON}"
    cp "${tmp_report_md}" "${REPORT_UNAVAILABLE_MD}"
    say "[WARN] runtime unavailable snapshot detected; canonical report preserved." | tee -a "${run_log}"
    say "[WARN] unavailable json: ${REPORT_UNAVAILABLE_JSON}" | tee -a "${run_log}"
    say "[WARN] unavailable md: ${REPORT_UNAVAILABLE_MD}" | tee -a "${run_log}"
  else
    cp "${tmp_report_json}" "${REPORT_JSON}"
    cp "${tmp_report_md}" "${REPORT_MD}"
  fi

  rm -f "${tmp_overview}" "${tmp_trends}" "${tmp_anomalies}" "${tmp_recommendations}" "${tmp_report_json}" "${tmp_report_md}"
  say "report json: ${report_target_json}"
  say "report md: ${report_target_md}"
  say "log: ${run_log}"
  say "overallPass=${overall_pass}"
}

main "$@"
