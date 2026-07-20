import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");

const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SITE_ID = process.env.SITE_ID || "btwentyfive";
const LEGACY_SITE_ID = process.env.B25_LEGACY_APP_ID || "140";
const SITE_CODE = process.env.B25_SITE_CODE || "btwentyfive";
const DATABASE_KEY = process.env.B25_DATABASE_KEY || "140btwentyfive";
const PROJECT_KEY = process.env.B25_PROJECT_KEY || "126lnoffice";
const PROJECT_TEMPLATE = process.env.B25_PROJECT_TEMPLATE || "1";
const ACTOR_USER_ID = process.env.B25_ACTOR_USER_ID || process.env.USER_ID || "";
const OUTPUT_JSONL =
  process.env.B25_TOWER_APPROACH_SHADOW_JSONL ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-shadow-samples.jsonl");
const OUTPUT_JSON =
  process.env.B25_TOWER_APPROACH_SHADOW_JSON ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-shadow-latest.json");
const OUTPUT_MD =
  process.env.B25_TOWER_APPROACH_SHADOW_MD ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-shadow-latest.md");
const TOWER_APPROACH_MAX_PLAUSIBLE_C = 20;

function asTrimmedText(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function asFiniteNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(/,/g, "").replace(/%/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function roundNullable(value, digits = 1) {
  const number = asFiniteNumber(value, null);
  return number === null ? null : Number(number.toFixed(digits));
}

function resolveTowerApproachMeasurement(tcwsC, wetBulbC) {
  const tcws = asFiniteNumber(tcwsC, null);
  const wetBulb = asFiniteNumber(wetBulbC, null);
  if (tcws === null || wetBulb === null) {
    return {
      value: null,
      plausible: false,
      reason: "缺湿球温度或冷却水出水温，无法计算当前接近度。"
    };
  }
  const rawValue = roundNullable(tcws - wetBulb, 1);
  if (rawValue < 0) {
    return {
      value: null,
      plausible: false,
      reason: "当前接近度计算结果为负值，冷却水出水温低于湿球，疑似湿球温度或冷却水温点位异常。"
    };
  }
  if (rawValue > TOWER_APPROACH_MAX_PLAUSIBLE_C) {
    return {
      value: null,
      plausible: false,
      reason: "当前接近度超过 20℃，疑似冷却塔温度点位、湿球点位或单位异常。"
    };
  }
  return {
    value: rawValue,
    plausible: true,
    reason: null
  };
}

function normalizeRatio(value) {
  const number = asFiniteNumber(value, null);
  if (number === null) {
    return null;
  }
  return Math.abs(number) > 1 ? number / 100 : number;
}

function formatNumber(value, digits = 1, unit = "") {
  const number = asFiniteNumber(value, null);
  if (number === null) {
    return "--";
  }
  return `${number.toFixed(digits)}${unit}`;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildHeaders(extra = {}) {
  const headers = {
    "x-chiller-site-id": LEGACY_SITE_ID,
    "x-chiller-site-code": SITE_CODE,
    "x-chiller-project-database-key": DATABASE_KEY,
    "x-chiller-project-key": PROJECT_KEY,
    "x-chiller-project-template": PROJECT_TEMPLATE,
    ...extra
  };
  if (ACTOR_USER_ID) {
    headers["x-chiller-user-id"] = ACTOR_USER_ID;
  }
  return headers;
}

async function requestJson(routePath, options = {}) {
  const response = await fetch(`${BFF_BASE_URL}${routePath}`, {
    ...options,
    headers: buildHeaders(options.headers || {})
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    payload = { parseError: true, raw: raw.slice(0, 500) };
  }
  return {
    ok: response.ok,
    status: response.status,
    payload,
    error: response.ok ? null : `HTTP ${response.status}`
  };
}

function chooseOptimizeInputs(energyCards) {
  const loadKw =
    asFiniteNumber(process.env.B25_OPTIMIZE_LOAD_KW, null) ??
    asFiniteNumber(energyCards?.totalCoolingCapacity, null) ??
    13500;
  const outdoorTempC =
    asFiniteNumber(process.env.B25_OPTIMIZE_OUTDOOR_TEMP_C, null) ??
    asFiniteNumber(energyCards?.outdoorTempC, null) ??
    asFiniteNumber(energyCards?.outdoorWetBulbC, null) ??
    32.5;
  return {
    loadKw,
    outdoorTempC,
    mode: "cooling"
  };
}

function loadBand(loadRatePct) {
  const value = asFiniteNumber(loadRatePct, null);
  if (value === null) {
    return "unknown";
  }
  if (value < 45) {
    return "low";
  }
  if (value < 70) {
    return "medium";
  }
  return "high";
}

function sourceOkForShadow(overall) {
  return overall === "ok" || overall === "partial";
}

function buildSample({ overview, advice, executions, checkedAt }) {
  const energyCards = overview.payload?.energyCards || {};
  const details = advice.payload?.details || {};
  const advisor = details.towerApproachAdvisor || {};
  const currentTcwsC = roundNullable(energyCards.coolingReturnTemp, 1);
  const wetBulbC =
    roundNullable(energyCards.outdoorWetBulbC, 1) ??
    roundNullable(advisor.currentWetBulbC, 1) ??
    roundNullable(advisor.advisorResult?.currentWetBulbC, 1);
  const calculatedApproachMeasurement = resolveTowerApproachMeasurement(currentTcwsC, wetBulbC);
  const calculatedApproachC = calculatedApproachMeasurement.value;
  const currentApproachC =
    roundNullable(advisor.currentApproachC, 1) ??
    roundNullable(advisor.advisorResult?.currentApproachC, 1) ??
    calculatedApproachC;
  const targetApproachC =
    roundNullable(advisor.targetApproachC, 1) ??
    roundNullable(advisor.advisorResult?.targetApproachC, 1);
  const targetTcwsC =
    roundNullable(advisor.targetTcwsC, 1) ??
    roundNullable(advisor.advisorResult?.targetTcwsC, 1);
  const loadKw = roundNullable(energyCards.totalCoolingCapacity, 1);
  const ratedCoolingCapacityKw = asFiniteNumber(details.ratedCoolingCapacityKw, null);
  const loadRateCandidates = [
    { source: "overview.energyCards.currentLoadRate", value: roundNullable(energyCards.currentLoadRate, 1) },
    { source: "overview.energyCards.loadRatePct", value: roundNullable(energyCards.loadRatePct, 1) },
    { source: "advisor.requestedLoadRatePct", value: roundNullable(advisor.requestedLoadRatePct, 1) },
    { source: "advisor.advisorResult.requestedLoadRatePct", value: roundNullable(advisor.advisorResult?.requestedLoadRatePct, 1) },
    {
      source: "loadKw/ratedCoolingCapacityKw",
      value: loadKw !== null && ratedCoolingCapacityKw ? roundNullable((loadKw / ratedCoolingCapacityKw) * 100, 1) : null
    }
  ];
  const selectedLoadRate = loadRateCandidates.find((candidate) => candidate.value !== null);
  const loadRatePct = selectedLoadRate?.value ?? null;
  const latestExecution = Array.isArray(executions.payload?.items) ? executions.payload.items[0] || null : null;
  const blockers = [];
  const warnings = [];

  const overviewOverall = asTrimmedText(overview.payload?.sourceStatus?.overall, "unknown");
  const adviceOverall = asTrimmedText(details.sourceStatus?.overall, "unknown");
  if (!overview.ok || !sourceOkForShadow(overviewOverall)) {
    blockers.push(`dashboard overview not shadow-ready: ${overview.status}/${overviewOverall}`);
  }
  if (!advice.ok || advice.payload?.ok !== true || !sourceOkForShadow(adviceOverall)) {
    blockers.push(`optimize advice not shadow-ready: ${advice.status}/${adviceOverall}`);
  }
  if (advisor.status !== "ready" || advisor.executionReady !== true) {
    blockers.push(`towerApproachAdvisor not ready: status=${advisor.status || "unknown"} executionReady=${String(advisor.executionReady)}`);
  }
  if (targetApproachC === null || targetTcwsC === null) {
    blockers.push("target approach or target Tcws missing");
  }
  if (!calculatedApproachMeasurement.plausible && calculatedApproachMeasurement.reason) {
    blockers.push(calculatedApproachMeasurement.reason);
  }
  if (latestExecution?.status === "pending_approval" || latestExecution?.status === "approved") {
    warnings.push(`existing execution is ${latestExecution.status}; review before assisted mode`);
  }
  if (normalizeRatio(energyCards.thermalUnbalanceRate) !== null && normalizeRatio(energyCards.thermalUnbalanceRate) > 0.1) {
    warnings.push("thermal balance deviation is above 10%; compare savings conservatively");
  }

  const status = blockers.length === 0 ? "GO_SHADOW_SAMPLE" : "BLOCKED";
  return {
    checkedAt,
    status,
    site: {
      siteId: SITE_ID,
      legacySiteId: LEGACY_SITE_ID,
      siteCode: SITE_CODE,
      databaseKey: DATABASE_KEY,
      projectKey: PROJECT_KEY
    },
    mode: {
      intended: "shadow",
      enforcedAllowed: false,
      dispatchWriteAttempted: false
    },
    sources: {
      overviewStatus: overview.status,
      overviewOverall,
      adviceStatus: advice.status,
      adviceOverall,
      executionListStatus: executions.status,
      executionTotal: executions.payload?.total ?? null
    },
    operatingPoint: {
      cop: roundNullable(energyCards.currentCop, 2),
      totalPowerKw: roundNullable(energyCards.totalPowerKw, 1),
      loadKw,
      loadRatePct,
      loadRateSource: selectedLoadRate?.source ?? null,
      loadBand: loadBand(loadRatePct),
      wetBulbC,
      outdoorTempC: roundNullable(energyCards.outdoorTempC, 1),
      coolingReturnTempC: currentTcwsC,
      coolingDeltaTC: roundNullable(energyCards.coolingDeltaT, 1),
      thermalUnbalanceRate: normalizeRatio(energyCards.thermalUnbalanceRate)
    },
    towerApproach: {
      advisorStatus: advisor.status || null,
      executionReady: advisor.executionReady === true,
      currentApproachC,
      calculatedApproachC,
      targetApproachC,
      targetTcwsC,
      approachDeltaC:
        currentApproachC !== null && targetApproachC !== null
          ? roundNullable(targetApproachC - currentApproachC, 1)
          : null,
      tcwsDeltaC:
        currentTcwsC !== null && targetTcwsC !== null
          ? roundNullable(targetTcwsC - currentTcwsC, 1)
          : null,
      guardrails: Array.isArray(advisor.guardrails)
        ? advisor.guardrails.map((item) => ({
            key: item?.key ?? null,
            status: item?.status ?? null,
            message: item?.message ?? null
          }))
        : []
    },
    latestExecution: latestExecution
      ? {
          id: latestExecution.id ?? null,
          type: latestExecution.type ?? null,
          status: latestExecution.status ?? null,
          targetApproachC: latestExecution.targetApproachC ?? null,
          targetTcwsC: latestExecution.targetTcwsC ?? null,
          dispatchMode: latestExecution.dispatch?.mode ?? null,
          lastApproveOk: latestExecution.dispatch?.lastApprove?.ok ?? null,
          lastRollbackOk: latestExecution.dispatch?.lastRollback?.ok ?? null
        }
      : null,
    blockers,
    warnings,
    nextAction:
      status === "GO_SHADOW_SAMPLE"
        ? "Keep collecting read-only shadow samples across low/medium/high load bands; do not enable enforced."
        : "Resolve blockers before collecting this sample as valid shadow evidence."
  };
}

function renderMarkdown(sample) {
  return `# B25 冷却塔 Approach Shadow 最新样本

- 采样时间：${sample.checkedAt}
- 结论：${sample.status}
- 模式：${sample.mode.intended}
- 是否允许 enforced：${sample.mode.enforcedAllowed ? "是" : "否"}
- 是否尝试真实下发：${sample.mode.dispatchWriteAttempted ? "是" : "否"}

## 工况

| 项目 | 数值 |
| --- | --- |
| COP | ${formatNumber(sample.operatingPoint.cop, 2)} |
| 总功率 | ${formatNumber(sample.operatingPoint.totalPowerKw, 1, " kW")} |
| 当前负荷 | ${formatNumber(sample.operatingPoint.loadKw, 1, " kW")} |
| 负荷率 | ${formatNumber(sample.operatingPoint.loadRatePct, 1, "%")} |
| 负荷率来源 | ${sample.operatingPoint.loadRateSource || "--"} |
| 负荷区间 | ${sample.operatingPoint.loadBand} |
| 湿球温度 | ${formatNumber(sample.operatingPoint.wetBulbC, 1, "℃")} |
| 冷却水回水/Tcws | ${formatNumber(sample.operatingPoint.coolingReturnTempC, 1, "℃")} |
| 冷却水温差 | ${formatNumber(sample.operatingPoint.coolingDeltaTC, 1, "℃")} |
| 热平衡偏差 | ${formatNumber(sample.operatingPoint.thermalUnbalanceRate === null ? null : sample.operatingPoint.thermalUnbalanceRate * 100, 1, "%")} |

## Approach 建议

| 项目 | 数值 |
| --- | --- |
| 当前 Approach | ${formatNumber(sample.towerApproach.currentApproachC, 1, "℃")} |
| AI 目标 Approach | ${formatNumber(sample.towerApproach.targetApproachC, 1, "℃")} |
| Approach 调整量 | ${formatNumber(sample.towerApproach.approachDeltaC, 1, "℃")} |
| AI 目标 Tcws | ${formatNumber(sample.towerApproach.targetTcwsC, 1, "℃")} |
| Tcws 调整量 | ${formatNumber(sample.towerApproach.tcwsDeltaC, 1, "℃")} |
| advisor 状态 | ${sample.towerApproach.advisorStatus || "--"} |
| executionReady | ${sample.towerApproach.executionReady ? "true" : "false"} |

## 执行台

| 项目 | 数值 |
| --- | --- |
| execution total | ${sample.sources.executionTotal ?? "--"} |
| latest status | ${sample.latestExecution?.status ?? "--"} |
| latest dispatch mode | ${sample.latestExecution?.dispatchMode ?? "--"} |
| latest rollback ok | ${String(sample.latestExecution?.lastRollbackOk ?? "--")} |

## 阻断项

${sample.blockers.length > 0 ? sample.blockers.map((item) => `- ${item}`).join("\n") : "- 无"}

## 风险提示

${sample.warnings.length > 0 ? sample.warnings.map((item) => `- ${item}`).join("\n") : "- 无"}

## 下一步

- ${sample.nextAction}
`;
}

async function main() {
  const checkedAt = new Date().toISOString();
  const overview = await requestJson(`/bff/v1/sites/${SITE_ID}/dashboard/overview`);
  const energyCards = overview.payload?.energyCards || {};
  const optimizeInputs = chooseOptimizeInputs(energyCards);
  const advice = await requestJson(`/bff/v1/sites/${SITE_ID}/optimize`, {
    method: "POST",
    body: JSON.stringify({ inputs: optimizeInputs }),
    headers: { "content-type": "application/json" }
  });
  const executions = await requestJson(`/bff/v1/sites/${SITE_ID}/optimize/tower-approach/executions`);
  const sample = buildSample({ overview, advice, executions, checkedAt });

  ensureParentDir(OUTPUT_JSONL);
  fs.appendFileSync(OUTPUT_JSONL, `${JSON.stringify(sample)}\n`);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(sample, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(sample));

  process.stdout.write(`B25 tower approach shadow sample: ${sample.status}\n`);
  process.stdout.write(`jsonl=${OUTPUT_JSONL}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);

  if (sample.status !== "GO_SHADOW_SAMPLE") {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`B25 tower approach shadow sample failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
