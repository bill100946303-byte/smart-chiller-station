import { buildOptimizeDraftResponse } from "../src/services/optimizeService.js";
import http from "node:http";
import https from "node:https";

const BFF_BASE_URL = process.env.BFF_BASE_URL || "http://127.0.0.1:8787";
const SITE_ID = process.env.SITE_ID || "btwentyfive";
const EXPECTED_MIN_CONDENSER_INLET_TEMP_C = (() => {
  const raw =
    process.env.EXPECTED_TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C ||
    process.env.TOWER_APPROACH_MIN_CONDENSER_INLET_TEMP_C ||
    "";
  if (String(raw).trim().length === 0) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
})();
const REQUEST = {
  loadKw: 1200,
  outdoorTempC: 27.6,
  mode: "cooling"
};

const BASE_CONFIG = {
  staleThresholdHours: 6,
  ratedCoolingCapacityKw: 2400,
  towerApproach: {
    minCondenserInletTempC: 28
  }
};

const BASE_OVERVIEW = {
  energyCards: {
    currentCop: 4,
    totalPowerKw: 300,
    chilledDeltaT: 5.4,
    coolingDeltaT: 4.2,
    chillerPowerKw: 180,
    chilledPumpPowerKw: 45,
    coolingPumpPowerKw: 42,
    coolingTowerPowerKw: 33,
    chilledSupplyTemp: 7.1,
    coolingReturnTemp: 31.8,
    thermalUnbalanceRate: 0.12
  },
  freshness: {
    latestTimestamp: "2026-04-01T01:00:00.000Z",
    stale: false,
    ageHours: 1.5
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "overview", ok: true }]
  }
};

const BASE_ANOMALIES = {
  counts: {
    total: 1,
    critical: 0,
    major: 0,
    minor: 1
  },
  freshness: {
    latestTimestamp: "2026-04-01T00:30:00.000Z",
    stale: false,
    ageHours: 2
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "anomalies", ok: true }]
  }
};

const BASE_RECOMMENDATIONS = {
  cards: [
    {
      title: "优化冷却塔风机级数",
      category: "optimization",
      actions: ["先检查冷却塔风机级数", "再复核冷却水温差"],
      relatedDevices: ["tower-01"],
      ruleId: "cooling-side-low-efficiency"
    }
  ],
  ruleEvaluation: {
    matchedRuleIds: ["cooling-side-low-efficiency"],
    skippedRuleIds: [],
    skippedRuleDetails: []
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "recommendations", ok: true }]
  }
};

function buildProportionReport(month, rows, ok = true) {
  return {
    filters: {
      date: month,
      dateType: "2"
    },
    rows,
    latestTimestamp: `${month}-15T00:00:00.000Z`,
    sourceStatus: {
      overall: ok ? "ok" : "failed",
      sources: [
        {
          key: "energyEfficiencyProportion",
          endpoint: `/zsqy/energycalendar/${SITE_ID}/findLoadSpecificGravity?date=${month}&dateType=2`,
          ok,
          status: ok ? 200 : 500,
          message: ok ? "OK" : "error",
          rows: ok ? rows.length : null,
          error: ok ? null : "historical source failed"
        }
      ],
      endpoint: `/zsqy/energycalendar/${SITE_ID}/findLoadSpecificGravity?date=${month}&dateType=2`,
      ok,
      status: ok ? 200 : 500,
      message: ok ? "OK" : "error",
      rows: ok ? rows.length : null,
      error: ok ? null : "historical source failed"
    }
  };
}

function makeReadyReports() {
  return {
    "2026-04": buildProportionReport("2026-04", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.8, wetBulbC: 27.2 }
    ]),
    "2026-03": buildProportionReport("2026-03", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 5.0, wetBulbC: 27.4 }
    ]),
    "2026-02": buildProportionReport("2026-02", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 5.2, wetBulbC: 27.8 }
    ]),
    "2026-01": buildProportionReport("2026-01", []),
    "2025-12": buildProportionReport("2025-12", []),
    "2025-11": buildProportionReport("2025-11", [])
  };
}

function makePartialReports() {
  return {
    "2026-04": buildProportionReport("2026-04", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.7, wetBulbC: 27.2 },
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.8, wetBulbC: 27.4 },
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.9, wetBulbC: 27.8 }
    ]),
    "2026-03": buildProportionReport("2026-03", []),
    "2026-02": buildProportionReport("2026-02", []),
    "2026-01": buildProportionReport("2026-01", []),
    "2025-12": buildProportionReport("2025-12", []),
    "2025-11": buildProportionReport("2025-11", [])
  };
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getHistorySource(details) {
  const sources = Array.isArray(details?.sourceStatus?.sources) ? details.sourceStatus.sources : [];
  return sources.find((source) => source?.key === "historyBenchmark") || null;
}

function postJson(url, payload) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            status: Number(res.statusCode || 0),
            body: raw
          });
        });
      }
    );

    req.on("error", (error) => {
      reject(error);
    });
    req.setTimeout(10_000, () => {
      req.destroy(new Error("request timeout after 10s"));
    });
    req.write(body);
    req.end();
  });
}

async function runHttpBoundaryCheck() {
  const endpoint = `${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/optimize`;
  const response = await postJson(endpoint, {
    inputs: REQUEST
  });

  let payload = null;
  try {
    payload = JSON.parse(response.body);
  } catch (error) {
    throw new Error(`http boundary: response is not valid json (${String(error)})`);
  }

  expect(response.status === 200, `http advisor: expected status 200, got ${response.status}`);
  expect(payload?.ok === true, `http advisor: expected ok=true, got ${String(payload?.ok)}`);
  expect(payload?.code === "OK", `http advisor: expected code=OK, got ${String(payload?.code)}`);
  expect(payload?.details && typeof payload.details === "object", "http boundary: missing details object");

  const historySource = getHistorySource(payload.details);
  expect(historySource, "http boundary: sourceStatus missing historyBenchmark source");

  const optimizeEngineSource =
    Array.isArray(payload.details?.sourceStatus?.sources)
      ? payload.details.sourceStatus.sources.find((item) => item?.key === "optimizeEngine")
      : null;
  expect(optimizeEngineSource, "http advisor: sourceStatus missing optimizeEngine source");
  expect(optimizeEngineSource.ok === true, "http advisor: optimizeEngine source ok must be true");
  expect(
    optimizeEngineSource.reasonCode === "advisor_result_ready",
    `http advisor: optimizeEngine reasonCode must be advisor_result_ready, got ${String(optimizeEngineSource.reasonCode)}`
  );
  expect(
    typeof payload.details?.historyBenchmark?.status === "string",
    "http boundary: details.historyBenchmark.status must exist"
  );
  if (payload.details?.towerApproachAdvisor && typeof payload.details.towerApproachAdvisor === "object") {
    expect(
      typeof payload.details?.towerApproachAdvisor?.status === "string",
      "http boundary: details.towerApproachAdvisor.status must exist"
    );
    expect(
      payload.details?.towerApproachAdvisor?.advisorResult?.type === "tower_approach_ai_closed_loop",
      "http advisor: details.towerApproachAdvisor.advisorResult.type must be tower_approach_ai_closed_loop"
    );
    if (EXPECTED_MIN_CONDENSER_INLET_TEMP_C !== null) {
      const guardrails = Array.isArray(payload.details?.towerApproachAdvisor?.guardrails)
        ? payload.details.towerApproachAdvisor.guardrails
        : [];
      const minTempGuardrail = guardrails.find((item) => item?.key === "chillerMinCondenserInletTempC") || null;
      expect(minTempGuardrail, "http boundary: towerApproachAdvisor.guardrails missing chillerMinCondenserInletTempC");
      expect(
        minTempGuardrail.status === "ready",
        `http boundary: min temp guardrail should be ready, got ${String(minTempGuardrail.status)}`
      );
      expect(
        Number(minTempGuardrail.value) === EXPECTED_MIN_CONDENSER_INLET_TEMP_C,
        `http boundary: expected min temp guardrail value=${EXPECTED_MIN_CONDENSER_INLET_TEMP_C}, got ${String(minTempGuardrail.value)}`
      );
    }
  } else {
    process.stdout.write(
      "[WARN] http boundary: live endpoint has no towerApproachAdvisor yet; fixture checks still enforce L3 schema\n"
    );
  }
}

async function runReadyFixtureCheck() {
  const response = await buildOptimizeDraftResponse(BASE_CONFIG, SITE_ID, REQUEST, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: BASE_OVERVIEW,
    anomalies: BASE_ANOMALIES,
    recommendations: BASE_RECOMMENDATIONS,
    historyBenchmarkReports: makeReadyReports()
  });

  expect(response.historyBenchmark?.status === "ready", `ready fixture: expected status=ready, got ${response.historyBenchmark?.status}`);
  expect(response.historyBenchmark?.matchedMonthCount >= 3, "ready fixture: matchedMonthCount must be >= 3");
  expect(
    Array.isArray(response.historyBenchmark?.sampleWindow?.months) &&
      response.historyBenchmark.sampleWindow.months.length === 3,
    `ready fixture: sampleWindow.months should stop at 3, got ${response.historyBenchmark?.sampleWindow?.months?.length}`
  );
  expect(
    Array.isArray(response.historyBenchmark?.matchedWetBulbBands),
    "ready fixture: matchedWetBulbBands must be array"
  );
  expect(
    response.historyBenchmark.matchedWetBulbBands.length >= 1,
    "ready fixture: matchedWetBulbBands should contain at least 1 bucket"
  );
  expect(response.towerApproachAdvisor?.status === "ready", `ready fixture: expected towerApproachAdvisor.status=ready, got ${response.towerApproachAdvisor?.status}`);
  expect(response.towerApproachAdvisor?.executionReady === true, "ready fixture: towerApproachAdvisor.executionReady must be true");
  expect(
    typeof response.towerApproachAdvisor?.targetApproachC === "number",
    "ready fixture: towerApproachAdvisor.targetApproachC must be numeric"
  );
}

async function runPartialFixtureCheck() {
  const response = await buildOptimizeDraftResponse(BASE_CONFIG, SITE_ID, REQUEST, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: BASE_OVERVIEW,
    anomalies: BASE_ANOMALIES,
    recommendations: BASE_RECOMMENDATIONS,
    historyBenchmarkReports: makePartialReports()
  });

  expect(response.historyBenchmark?.status === "partial", `partial fixture: expected status=partial, got ${response.historyBenchmark?.status}`);
  expect(response.historyBenchmark?.sampleCount >= 3, "partial fixture: sampleCount should still be >= 3");
  expect(
    response.historyBenchmark?.matchedMonthCount === 1,
    `partial fixture: matchedMonthCount should be 1, got ${response.historyBenchmark?.matchedMonthCount}`
  );
  expect(
    Array.isArray(response.historyBenchmark?.sampleWindow?.months) &&
      response.historyBenchmark.sampleWindow.months.length === 6,
    `partial fixture: sampleWindow.months should continue to 6, got ${response.historyBenchmark?.sampleWindow?.months?.length}`
  );
  expect(
    response.towerApproachAdvisor?.status === "partial",
    `partial fixture: expected towerApproachAdvisor.status=partial, got ${response.towerApproachAdvisor?.status}`
  );
  expect(
    response.towerApproachAdvisor?.executionReady === false,
    "partial fixture: towerApproachAdvisor.executionReady must be false"
  );
}

async function runUnavailableFixtureCheck() {
  const response = await buildOptimizeDraftResponse(
    {
      staleThresholdHours: 6
    },
    SITE_ID,
    REQUEST,
    {
      overview: BASE_OVERVIEW,
      anomalies: BASE_ANOMALIES,
      recommendations: BASE_RECOMMENDATIONS
    }
  );

  expect(
    response.historyBenchmark?.status === "unavailable",
    `unavailable fixture: expected historyBenchmark.status=unavailable, got ${response.historyBenchmark?.status}`
  );
  expect(
    response.benefitEstimate?.status === "unavailable",
    `unavailable fixture: expected benefitEstimate.status=unavailable, got ${response.benefitEstimate?.status}`
  );
  expect(
    response.towerApproachAdvisor?.status === "partial",
    `unavailable fixture: expected towerApproachAdvisor.status=partial, got ${response.towerApproachAdvisor?.status}`
  );
  expect(
    response.towerApproachAdvisor?.executionReady === false,
    "unavailable fixture: towerApproachAdvisor.executionReady must be false"
  );
  const historySource = getHistorySource(response);
  expect(historySource, "unavailable fixture: sourceStatus missing historyBenchmark source");
  expect(historySource.ok === false, "unavailable fixture: historyBenchmark source ok must be false");
}

async function main() {
  const checks = [
    { name: "http-advisor-result", run: runHttpBoundaryCheck },
    { name: "fixture-ready-state", run: runReadyFixtureCheck },
    { name: "fixture-partial-state", run: runPartialFixtureCheck },
    { name: "fixture-unavailable-state", run: runUnavailableFixtureCheck }
  ];

  const failures = [];
  for (const oneCheck of checks) {
    try {
      await oneCheck.run();
      process.stdout.write(`[PASS] ${oneCheck.name}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${oneCheck.name}: ${message}`);
      process.stderr.write(`[FAIL] ${oneCheck.name}: ${message}\n`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`optimize L3 smoke failed: ${checks.length - failures.length}/${checks.length} passed\n`);
    process.exit(1);
  }

  process.stdout.write(`optimize L3 smoke passed: ${checks.length}/${checks.length}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`optimize L3 smoke crashed: ${message}\n`);
  process.exit(1);
});
