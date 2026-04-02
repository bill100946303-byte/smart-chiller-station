import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOptimizeDraftResponse,
  validateOptimizeDraftRequest
} from "./optimizeService.js";

const baseConfig = {
  staleThresholdHours: 6,
  ratedCoolingCapacityKw: 2400
};

const baseOverview = {
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

const baseAnomalies = {
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

const baseRecommendations = {
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

const request = {
  loadKw: 1200,
  outdoorTempC: 32.5,
  mode: "cooling"
};

const wetBulbRequest = {
  loadKw: 1200,
  outdoorTempC: 27.6,
  mode: "cooling"
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
          endpoint: `/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=${month}&dateType=2`,
          ok,
          status: ok ? 200 : 500,
          message: ok ? "OK" : "error",
          rows: ok ? rows.length : null,
          error: ok ? null : "historical source failed"
        }
      ],
      endpoint: `/zsqy/energycalendar/btwentyfive/findLoadSpecificGravity?date=${month}&dateType=2`,
      ok,
      status: ok ? 200 : 500,
      message: ok ? "OK" : "error",
      rows: ok ? rows.length : null,
      error: ok ? null : "historical source failed"
    }
  };
}

function buildCalendarReport(month, items, ok = true) {
  return {
    month,
    items,
    sourceStatus: {
      overall: ok ? "ok" : "failed",
      sources: [
        {
          key: "energyEfficiencyCalendar",
          endpoint: `/zsqy/energycalendar/findEnergyCalendar?appId=140&year=${month.slice(0, 4)}&month=${Number(month.slice(5))}`,
          ok,
          status: ok ? 200 : 500,
          message: ok ? "OK" : "error",
          rows: ok ? items.length : null,
          error: ok ? null : "calendar source failed"
        },
        {
          key: "energyEfficiencyCalendarSummary",
          endpoint: `/zsqy/energycalendar/140/findMonthEnergy?date=${month}`,
          ok,
          status: ok ? 200 : 500,
          message: ok ? "OK" : "error",
          rows: ok ? 1 : 0,
          error: ok ? null : "calendar summary failed"
        }
      ]
    }
  };
}

test("validateOptimizeDraftRequest rejects missing loadKw", () => {
  const result = validateOptimizeDraftRequest({
    inputs: {
      outdoorTempC: 30,
      mode: "cooling"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateOptimizeDraftRequest rejects missing outdoorTempC", () => {
  const result = validateOptimizeDraftRequest({
    inputs: {
      loadKw: 800,
      mode: "cooling"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateOptimizeDraftRequest rejects unsupported mode", () => {
  const result = validateOptimizeDraftRequest({
    inputs: {
      loadKw: 800,
      outdoorTempC: 31,
      mode: "heating"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateOptimizeDraftRequest defaults mode to cooling", () => {
  const result = validateOptimizeDraftRequest({
    inputs: {
      loadKw: 800,
      outdoorTempC: 31
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.request.mode, "cooling");
});

test("buildOptimizeDraftResponse preserves legacy fields and anchors schemes to benchmark when ready", async () => {
  const historyBenchmarkReports = {
    "2026-04": buildProportionReport("2026-04", []),
    "2026-03": buildProportionReport("2026-03", []),
    "2026-02": buildProportionReport("2026-02", []),
    "2026-01": buildProportionReport("2026-01", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.8, wetBulbC: 27.2 }
    ]),
    "2025-12": buildProportionReport("2025-12", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 5.0, wetBulbC: 27.4 }
    ]),
    "2025-11": buildProportionReport("2025-11", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 5.2, wetBulbC: 27.8 }
    ])
  };

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.decision.confidence, "rule-based-draft-stable");
  assert.equal(response.recommendation.systemCop, 4);
  assert.equal(response.gate.level, "ready");
  assert.equal(response.draftLabel, "规则估算草案，仅供方案评审");
  assert.equal(response.historyBenchmark.status, "ready");
  assert.equal(response.historyBenchmark.matchingTier, "load-wetbulb-strict");
  assert.equal(response.historyBenchmark.fallbackLevel, 0);
  assert.equal(response.historyBenchmark.requestedWetBulbC, 27.6);
  assert.equal(response.historyBenchmark.matchedWetBulbBand, "26℃~28℃湿球区间");
  assert.equal(response.historyBenchmark.wetBulbToleranceC, 2);
  assert.equal(response.historyBenchmark.confidence, "high");
  assert.equal(response.historyBenchmark.matchedBucketLabel, "50%~60%负荷区间");
  assert.equal(response.historyBenchmark.sampleCount, 3);
  assert.equal(response.historyBenchmark.matchedMonthCount, 3);
  assert.equal(response.historyBenchmark.sampleWindow.months.length, 6);
  assert.deepEqual(response.historyBenchmark.matchedWetBulbBands, ["26℃~28℃湿球区间"]);
  assert.equal(response.historyBenchmark.referenceCop.low, 4.8);
  assert.equal(response.historyBenchmark.referenceCop.median, 5.0);
  assert.equal(response.historyBenchmark.referenceCop.high, 5.2);
  assert.equal(response.historyBenchmark.currentGap.copDeltaToMedian, 1.0);
  assert.equal(response.historyBenchmark.currentGap.powerDeltaKwToMedian, -60.0);
  assert.equal(response.benefitEstimate.status, "ready");
  assert.equal(response.benefitEstimate.opportunityLevel, "high");
  assert.equal(response.benefitEstimate.expectedTargetCop, 5.0);
  assert.equal(response.benefitEstimate.expectedTargetPowerKw, 240.0);
  assert.equal(response.benefitEstimate.expectedPowerDeltaKw, -60.0);
  assert.equal(response.benefitEstimate.expectedPowerDeltaPct, -0.2);
  assert.equal(response.benefitEstimate.expectedCopDelta, 1.0);
  assert.equal(response.benefitEstimate.confidence, "high");
  assert.deepEqual(response.benefitEstimate.basis, {
    matchingTier: "load-wetbulb-strict",
    fallbackLevel: 0,
    sampleCount: 3,
    monthCount: 6,
    matchedMonthCount: 3,
    matchedWetBulbBands: ["26℃~28℃湿球区间"]
  });
  assert.equal(response.reviewReadiness.status, "ready");
  assert.ok(response.reviewReadiness.score >= 70);
  assert.equal(response.reviewReadiness.missingSignals.length, 0);
  assert.match(response.reviewReadiness.reason, /关键现态齐全/);
  assert.equal(response.schemes.length, 3);
  assert.equal(response.schemes[0].targetCop, 4.8);
  assert.equal(response.schemes[0].targetPowerKw, 250.0);
  assert.equal(response.schemes[1].targetCop, 5.0);
  assert.equal(response.schemes[1].targetPowerKw, 240.0);
  assert.equal(response.schemes[2].targetCop, 5.2);
  assert.equal(response.schemes[2].targetPowerKw, 230.8);
  assert.ok(response.schemes[0].readiness);
  assert.ok(response.schemes[0].readiness.score >= 0 && response.schemes[0].readiness.score <= 100);
  assert.equal(response.ruleEvidence.matchedCount, 1);
  assert.equal(response.ruleEvidence.skippedCount, 0);
  assert.match(response.schemes[0].links.devices.href, /\/devices\?deviceId=tower-01/);
  const historySource = response.sourceStatus.sources.find((source) => source.key === "historyBenchmark");
  assert.ok(historySource);
  assert.equal(historySource.reasonCode, "history_match_strict");
});

test("buildOptimizeDraftResponse falls back to existing scheme logic when benchmark is unavailable", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      staleThresholdHours: 6
    },
    "btwentyfive",
    request,
    {
      overview: baseOverview,
      anomalies: baseAnomalies,
      recommendations: baseRecommendations
    }
  );

  assert.equal(response.historyBenchmark.status, "unavailable");
  assert.equal(response.historyBenchmark.matchingTier, "unavailable");
  assert.equal(response.historyBenchmark.fallbackLevel, 3);
  assert.equal(response.benefitEstimate.status, "unavailable");
  assert.equal(response.benefitEstimate.confidence, "low");
  assert.deepEqual(response.benefitEstimate.basis, {
    matchingTier: "unavailable",
    fallbackLevel: 3,
    sampleCount: 0,
    monthCount: 3,
    matchedMonthCount: 0,
    matchedWetBulbBands: []
  });
  assert.equal(response.reviewReadiness.status, "partial");
  assert.ok(response.reviewReadiness.score >= 50 && response.reviewReadiness.score <= 70);
  assert.match(response.reviewReadiness.reason, /历史对标不可用/);
  assert.equal(response.benefitEstimate.expectedTargetPowerKw, null);
  assert.equal(response.schemes[0].targetPowerKw, 315);
  assert.equal(response.schemes[1].targetPowerKw, 300);
  assert.equal(response.schemes[2].targetPowerKw, 285);
  assert.ok(response.schemes.every((scheme) => scheme.readiness));
  const historySource = response.sourceStatus.sources.find((source) => source.key === "historyBenchmark");
  assert.ok(historySource);
  assert.equal(historySource.ok, false);
  assert.equal(historySource.error, "historical benchmark unavailable");
  assert.equal(historySource.reasonCode, "rated_cooling_capacity_missing");
});

test("buildOptimizeDraftResponse falls back to relaxed wet bulb matching when strict samples are insufficient", async () => {
  const historyBenchmarkReports = {
    "2026-04": buildProportionReport("2026-04", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.6, wetBulbC: 27.1 }
    ]),
    "2026-03": buildProportionReport("2026-03", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.8, wetBulbC: 28.4 }
    ]),
    "2026-02": buildProportionReport("2026-02", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 5.0, wetBulbC: 29.0 }
    ]),
    "2026-01": buildProportionReport("2026-01", []),
    "2025-12": buildProportionReport("2025-12", []),
    "2025-11": buildProportionReport("2025-11", [])
  };

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.historyBenchmark.status, "ready");
  assert.equal(response.historyBenchmark.matchingTier, "load-wetbulb-relaxed");
  assert.equal(response.historyBenchmark.fallbackLevel, 1);
  assert.equal(response.historyBenchmark.confidence, "medium");
  assert.equal(response.historyBenchmark.matchedWetBulbBand, "26℃~28℃湿球区间");
  assert.deepEqual(response.historyBenchmark.matchedWetBulbBands, [
    "26℃~28℃湿球区间",
    "28℃~30℃湿球区间"
  ]);
  assert.equal(response.historyBenchmark.matchedMonthCount, 3);
  assert.equal(response.historyBenchmark.sampleWindow.months.length, 3);
  assert.equal(response.benefitEstimate.confidence, "medium");
  assert.deepEqual(response.benefitEstimate.basis, {
    matchingTier: "load-wetbulb-relaxed",
    fallbackLevel: 1,
    sampleCount: 3,
    monthCount: 3,
    matchedMonthCount: 3,
    matchedWetBulbBands: ["26℃~28℃湿球区间", "28℃~30℃湿球区间"]
  });
  assert.equal(response.historyBenchmark.sampleCount, 3);
  assert.equal(response.historyBenchmark.referenceCop.median, 4.8);
});

test("buildOptimizeDraftResponse falls back to load-only history matching when wet bulb samples are unavailable", async () => {
  const historyBenchmarkReports = {
    "2026-04": buildProportionReport("2026-04", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.4 }
    ]),
    "2026-03": buildProportionReport("2026-03", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.6 }
    ]),
    "2026-02": buildProportionReport("2026-02", [
      { rangeLabel: "50%~60%负荷区间", loadRatioPct: 50, stationEfficiency: 4.8 }
    ]),
    "2026-01": buildProportionReport("2026-01", []),
    "2025-12": buildProportionReport("2025-12", []),
    "2025-11": buildProportionReport("2025-11", [])
  };

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.historyBenchmark.status, "ready");
  assert.equal(response.historyBenchmark.matchingTier, "load-only-fallback");
  assert.equal(response.historyBenchmark.fallbackLevel, 2);
  assert.equal(response.historyBenchmark.confidence, "low");
  assert.equal(response.historyBenchmark.matchedWetBulbBand, null);
  assert.deepEqual(response.historyBenchmark.matchedWetBulbBands, []);
  assert.equal(response.historyBenchmark.matchedMonthCount, 3);
  assert.equal(response.historyBenchmark.sampleWindow.months.length, 3);
  assert.equal(response.benefitEstimate.confidence, "low");
  assert.deepEqual(response.benefitEstimate.basis, {
    matchingTier: "load-only-fallback",
    fallbackLevel: 2,
    sampleCount: 3,
    monthCount: 3,
    matchedMonthCount: 3,
    matchedWetBulbBands: []
  });
  assert.equal(response.historyBenchmark.referenceCop.median, 4.6);
});

test("buildOptimizeDraftResponse stays partial when a single month has multiple rows but not enough unique months", async () => {
  const historyBenchmarkReports = {
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

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.historyBenchmark.status, "partial");
  assert.equal(response.historyBenchmark.matchedMonthCount, 1);
  assert.equal(response.historyBenchmark.sampleCount, 3);
  assert.notEqual(response.historyBenchmark.status, "ready");
  assert.deepEqual(response.historyBenchmark.matchedWetBulbBands, ["26℃~28℃湿球区间"]);
});

test("buildOptimizeDraftResponse emits prioritized device actions with preconditions", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      staleThresholdHours: 6
    },
    "btwentyfive",
    request,
    {
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 3.9,
          totalPowerKw: 300,
          chilledDeltaT: 2.6,
          coolingDeltaT: 2.1,
          chillerPowerKw: 100
        }
      },
      anomalies: baseAnomalies,
      recommendations: baseRecommendations
    }
  );

  const conservativeScheme = response.schemes[0];
  assert.ok(Array.isArray(conservativeScheme.deviceActions));
  assert.equal(conservativeScheme.deviceActions.length, 4);
  assert.ok(conservativeScheme.deviceActions.every((item) => Array.isArray(item.preconditions)));
  assert.ok(conservativeScheme.deviceActions.every((item) => item.preconditions.length > 0));
  assert.ok(conservativeScheme.readiness);
  assert.ok(conservativeScheme.readiness.blockers.length > 0);
  assert.ok(conservativeScheme.readiness.checkpoints.length > 0);

  const rank = {
    high: 0,
    medium: 1,
    low: 2
  };
  const actionRanks = conservativeScheme.deviceActions.map((item) => rank[item.priority] ?? 9);
  for (let index = 1; index < actionRanks.length; index += 1) {
    assert.ok(actionRanks[index - 1] <= actionRanks[index]);
  }
});

test("buildOptimizeDraftResponse falls back to calendar-derived benchmark when proportion samples are unavailable", async () => {
  const historyBenchmarkReports = {
    "2026-04": buildProportionReport("2026-04", []),
    "2026-03": buildProportionReport("2026-03", []),
    "2026-02": buildProportionReport("2026-02", [])
  };
  const historyCalendarReports = {
    "2026-04": buildCalendarReport("2026-04", [
      {
        date: "2026-04-02",
        efficiency: 4.7,
        cooling: 28800
      }
    ]),
    "2026-03": buildCalendarReport("2026-03", [
      {
        date: "2026-03-12",
        efficiency: 4.9,
        cooling: 29280
      }
    ]),
    "2026-02": buildCalendarReport("2026-02", [
      {
        date: "2026-02-20",
        efficiency: 5.1,
        cooling: 29760
      }
    ])
  };

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports,
    historyCalendarReports
  });

  assert.equal(response.historyBenchmark.status, "ready");
  assert.equal(response.historyBenchmark.matchedBucketLabel, "50%~60%负荷区间");
  assert.equal(response.historyBenchmark.sampleCount, 3);
  assert.equal(response.historyBenchmark.referenceCop.low, 4.7);
  assert.equal(response.historyBenchmark.referenceCop.median, 4.9);
  assert.equal(response.historyBenchmark.referenceCop.high, 5.1);
  assert.match(response.historyBenchmark.note, /历史日历日均冷量估算/);
  assert.equal(response.benefitEstimate.status, "ready");
  assert.equal(response.benefitEstimate.expectedTargetCop, 4.9);
  assert.equal(response.benefitEstimate.expectedTargetPowerKw, 244.9);
  assert.equal(response.schemes[1].targetCop, 4.9);
  assert.equal(response.schemes[1].targetPowerKw, 244.9);
  assert.ok(
    response.sourceStatus.sources.some(
      (source) =>
        source.key === "historyBenchmark" &&
        source.endpoint === "/bff/v1/sites/btwentyfive/energy-efficiency/calendar"
    )
  );
});

test("buildOptimizeDraftResponse sets caution gate when major alarms exist", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: {
      ...baseAnomalies,
      counts: {
        total: 2,
        critical: 0,
        major: 1,
        minor: 1
      }
    },
    recommendations: baseRecommendations
  });

  assert.equal(response.gate.level, "caution");
  assert.equal(response.schemes[0].status, "ready");
  assert.equal(response.schemes[1].status, "caution");
  assert.equal(response.schemes[2].status, "blocked");
});

test("buildOptimizeDraftResponse sets blocked gate when critical alarms exist", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: {
      ...baseAnomalies,
      counts: {
        total: 1,
        critical: 1,
        major: 0,
        minor: 0
      }
    },
    recommendations: baseRecommendations
  });

  assert.equal(response.gate.level, "blocked");
  assert.equal(response.reviewReadiness.status, "partial");
  assert.ok(response.schemes.every((item) => item.status === "blocked"));
  assert.ok(response.schemes.every((item) => item.riskLevel === "high"));
  assert.ok(response.schemes.every((item) => item.readiness.level === "blocked"));
});

test("buildOptimizeDraftResponse nulls scheme numbers when current snapshot is incomplete and benchmark is unavailable", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      staleThresholdHours: 6
    },
    "btwentyfive",
    request,
    {
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: null,
          totalPowerKw: null
        }
      },
      anomalies: baseAnomalies,
      recommendations: {
        ...baseRecommendations,
        ruleEvaluation: {
          matchedRuleIds: [],
          skippedRuleIds: ["r1"],
          skippedRuleDetails: [{ ruleId: "r1", reason: "missing-metric", missingMetrics: [] }]
        }
      }
    }
  );

  assert.equal(response.schemes[0].targetPowerKw, null);
  assert.equal(response.schemes[0].targetCop, null);
  assert.equal(response.schemes[0].powerDeltaPct, null);
  assert.equal(response.schemes[0].copDelta, null);
  assert.equal(response.ruleEvidence.skippedCount, 1);
  assert.equal(response.reviewReadiness.status, "unavailable");
  assert.ok(response.reviewReadiness.score <= 35);
  assert.ok(response.schemes.every((scheme) => scheme.readiness.level === "blocked"));
  const overviewSource = response.sourceStatus.sources.find((source) => source.key === "dashboardOverview");
  assert.ok(overviewSource);
  assert.equal(overviewSource.reasonCode, "baseline_snapshot_missing");
});
