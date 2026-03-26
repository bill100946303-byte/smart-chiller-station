#!/usr/bin/env bash
set -u

ROOT_DIR="/Users/billchow/Documents/智慧冷冻站"
BFF_DIR="${ROOT_DIR}/apps/chiller-bff"
# shellcheck source=/dev/null
[ -f "${ROOT_DIR}/scripts/load_shell_env.sh" ] && . "${ROOT_DIR}/scripts/load_shell_env.sh"
load_shell_env_defaults "${ROOT_DIR}"

SITE_ID="${1:-${SITE_ID:-${VITE_SITE_ID:-126lnoffice}}}"
TREND_RANGE="${TREND_RANGE:-${VITE_TREND_RANGE:-24h}}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-http://127.0.0.1:8098}"
BFF_BASE_URL="${BFF_BASE_URL:-${VITE_BFF_BASE_URL:-http://127.0.0.1:8787}}"
STATE_FILE="/tmp/chiller_trigger_state_${SITE_ID}.json"
OUT_FILE="/tmp/chiller_trigger_report_${SITE_ID}.json"

say() { printf '%s\n' "$1"; }
ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; }

http_code() {
  local url="$1"
  curl -sS -m 5 -o /tmp/chiller_trigger_body.txt -w '%{http_code}' "$url" 2>/tmp/chiller_trigger_err.txt || true
}

fetch_bff_json() {
  local endpoint="$1"
  local out_file="$2"
  local code
  code="$(curl -sS -m 8 -o "$out_file" -w '%{http_code}' "${BFF_BASE_URL}${endpoint}" 2>/tmp/chiller_trigger_fetch_err.txt || true)"
  if ! echo "$code" | grep -Eq '^2'; then
    return 1
  fi
  return 0
}

say "=== Trigger Readiness Check ==="
say "siteId=${SITE_ID}"
say "trendRange=${TREND_RANGE}"
say "legacy=${LEGACY_BASE_URL}"
say "bff=${BFF_BASE_URL}"

LEGACY_CODE="$(http_code "${LEGACY_BASE_URL}/healthz")"
BFF_CODE="$(http_code "${BFF_BASE_URL}/healthz")"

LEGACY_REACHABLE=false
BFF_REACHABLE=false
if [ "${LEGACY_CODE}" != "000" ]; then
  LEGACY_REACHABLE=true
fi
if echo "${BFF_CODE}" | grep -Eq '^2'; then
  BFF_REACHABLE=true
fi

if [ "${LEGACY_REACHABLE}" = true ]; then
  ok "legacy reachable (HTTP ${LEGACY_CODE})"
else
  warn "legacy unreachable"
fi

if [ "${BFF_REACHABLE}" = true ]; then
  ok "bff reachable (HTTP ${BFF_CODE})"
else
  fail "bff unreachable, skip endpoint readiness evaluation"
  node -e '
    const fs=require("fs");
    const out=process.argv[1];
    const report={
      generatedAt:new Date().toISOString(),
      siteId:process.argv[2],
      legacyReachable:process.argv[3]==="true",
      bffReachable:false,
      triggerReady:{
        hvacRules:false,
        uiDesign:false,
        bffContract:"event-driven"
      },
      reason:"bff-unreachable"
    };
    fs.writeFileSync(out, JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  ' "${OUT_FILE}" "${SITE_ID}" "${LEGACY_REACHABLE}"
  say "report saved: ${OUT_FILE}"
  exit 1
fi

OVERVIEW_FILE="/tmp/chiller_trigger_overview_${SITE_ID}.json"
TRENDS_FILE="/tmp/chiller_trigger_trends_${SITE_ID}.json"
ANOM_FILE="/tmp/chiller_trigger_anomalies_${SITE_ID}.json"
REC_FILE="/tmp/chiller_trigger_recommendations_${SITE_ID}.json"

FAIL_FETCH=0
fetch_bff_json "/bff/v1/sites/${SITE_ID}/dashboard/overview" "${OVERVIEW_FILE}" || FAIL_FETCH=1
fetch_bff_json "/bff/v1/sites/${SITE_ID}/dashboard/trends?range=${TREND_RANGE}" "${TRENDS_FILE}" || FAIL_FETCH=1
fetch_bff_json "/bff/v1/sites/${SITE_ID}/anomalies/summary" "${ANOM_FILE}" || FAIL_FETCH=1
fetch_bff_json "/bff/v1/sites/${SITE_ID}/recommendations" "${REC_FILE}" || FAIL_FETCH=1

if [ "${FAIL_FETCH}" -ne 0 ]; then
  fail "one or more bff endpoints failed"
fi

CONTRACT_OK=false
if (cd "${BFF_DIR}" && npm run check:contract >/tmp/chiller_trigger_contract_out.txt 2>/tmp/chiller_trigger_contract_err.txt); then
  CONTRACT_OK=true
  ok "contract check passed"
else
  warn "contract check failed"
fi

node -e '
  const fs = require("fs");
  const [overviewPath, trendsPath, anomaliesPath, recPath, statePath, outPath, siteId, legacyReachableRaw, contractOkRaw] = process.argv.slice(1);

  function safeReadJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  const overview = safeReadJson(overviewPath) || {};
  const trends = safeReadJson(trendsPath) || {};
  const anomalies = safeReadJson(anomaliesPath) || {};
  const recommendations = safeReadJson(recPath) || {};
  const prev = safeReadJson(statePath) || null;

  const trendsPoints = Array.isArray(trends?.series)
    ? trends.series.reduce((sum, s) => sum + (Array.isArray(s?.points) ? s.points.length : 0), 0)
    : 0;
  const anomalyEvents = Array.isArray(anomalies?.latestEvents) ? anomalies.latestEvents.length : 0;
  const recommendationCards = recommendations?.summary?.total ?? 0;

  const overviewOverall = overview?.sourceStatus?.overall ?? "unknown";
  const trendsOverall = trends?.sourceStatus?.overall ?? "unknown";
  const anomaliesOverall = anomalies?.sourceStatus?.overall ?? "unknown";

  const dataReadySingle = trendsPoints > 0 && anomalyEvents > 0;
  const dataReadyTwoRuns = Boolean(prev?.dataReadySingle) && dataReadySingle;

  const legacyReachable = legacyReachableRaw === "true";
  const contractOk = contractOkRaw === "true";

  const report = {
    generatedAt: new Date().toISOString(),
    siteId,
    legacyReachable,
    bffReachable: true,
    contractOk,
    observations: {
      sourceOverall: {
        overview: overviewOverall,
        trends: trendsOverall,
        anomalies: anomaliesOverall
      },
      trendsPoints,
      anomalyEvents,
      recommendationCards,
      dataReadySingle,
      dataReadyTwoRuns
    },
    triggerReady: {
      hvacRules: legacyReachable && dataReadyTwoRuns,
      uiDesign:
        trendsPoints > 0 &&
        overviewOverall !== "failed" &&
        trendsOverall !== "failed" &&
        anomaliesOverall !== "failed",
      bffContract: "event-driven (only when DTO/schema changed)"
    },
    nextAction: []
  };

  if (!legacyReachable) {
    report.nextAction.push("恢复8098后端可达性");
  }
  if (trendsPoints <= 0) {
    report.nextAction.push("修复trends数据源，确保返回有效points");
  }
  if (anomalyEvents <= 0) {
    report.nextAction.push("修复anomalies数据源，确保返回最新告警事件");
  }
  if (!contractOk) {
    report.nextAction.push("修复OpenAPI合同或示例，确保check:contract通过");
  }
  if (report.nextAction.length === 0) {
    report.nextAction.push("可触发待命线程执行下一轮任务");
  }

  const nextState = {
    generatedAt: report.generatedAt,
    siteId: report.siteId,
    dataReadySingle
  };
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2));
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
' "${OVERVIEW_FILE}" "${TRENDS_FILE}" "${ANOM_FILE}" "${REC_FILE}" "${STATE_FILE}" "${OUT_FILE}" "${SITE_ID}" "${LEGACY_REACHABLE}" "${CONTRACT_OK}"

say "report saved: ${OUT_FILE}"
