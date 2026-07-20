import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOptimizeExecutionFeedbackSnapshot,
  buildOptimizeDraftResponse,
  validateOptimizeDraftRequest
} from "./optimizeService.js";

const baseConfig = {
  staleThresholdHours: 6,
  ratedCoolingCapacityKw: 2400,
  towerApproach: {
    minCondenserInletTempC: 28
  }
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

const chillerStagingRequest = {
  loadKw: 2600,
  outdoorTempC: 27.5,
  mode: "cooling",
  equipmentContext: {
    activeChillerIds: ["OLD-1", "NEW-1"]
  }
};

function buildChillerStagingConfig(overrides = {}) {
  return {
    ...baseConfig,
    chillerStaging: {
      currentRunMinutes: 120,
      chillers: [
        { id: "OLD-1", ratedCapacityKw: 1800, generation: "old", runMinutes: 180 },
        { id: "NEW-1", ratedCapacityKw: 1800, generation: "new", runMinutes: 180 },
        { id: "NEW-2", ratedCapacityKw: 1800, generation: "new", offMinutes: 240 }
      ],
      candidateCombinations: [
        ["OLD-1", "NEW-1"],
        ["NEW-1", "NEW-2"]
      ],
      ...(overrides.chillerStaging || {})
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "chillerStaging"))
  };
}

function buildChillerStagingOverview(overrides = {}) {
  return {
    ...baseOverview,
    energyCards: {
      ...baseOverview.energyCards,
      currentCop: 3.66,
      totalPowerKw: 710,
      chillerPowerKw: 540,
      chilledPumpPowerKw: 72,
      coolingPumpPowerKw: 58,
      coolingTowerPowerKw: 40,
      chilledSupplyTemp: 7.0,
      coolingReturnTemp: 31.5,
      outdoorWetBulbC: 27.5,
      ...(overrides.energyCards || {})
    },
    freshness: {
      ...baseOverview.freshness,
      ...(overrides.freshness || {})
    }
  };
}

function buildChillerCombinationHistory(overrides = {}) {
  return [
    {
      combination: ["OLD-1", "NEW-1"],
      sampleCount: 86,
      loadRatePct: 72.2,
      wetBulbC: 27.4,
      chilledSupplyTempC: 7.0,
      stationCop: 3.66,
      comboCop: 4.81,
      stationPowerKw: 710,
      chillerPowerKw: 540
    },
    {
      combination: ["NEW-1", "NEW-2"],
      sampleCount: overrides.targetSampleCount ?? 126,
      loadRatePct: 72.2,
      wetBulbC: 27.6,
      chilledSupplyTempC: 7.0,
      stationCop: overrides.targetStationCop ?? 4.19,
      comboCop: 5.65,
      stationPowerKw: overrides.targetStationPowerKw ?? 620,
      chillerPowerKw: 460
    }
  ];
}

function buildOperationalPointSummary(overrides = {}) {
  return {
    status: "ready",
    basis: "legacy_realtime_register_summary",
    counts: {
      deviceRows: 184,
      registerPoints: 1215,
      chillerCount: 7,
      runningChillerCount: 3,
      chilledPumpCount: 5,
      runningChilledPumpCount: 2,
      coolingPumpCount: 5,
      runningCoolingPumpCount: 2,
      coolingTowerCount: 6,
      runningCoolingTowerCount: 3,
      coolingTowerFanCount: 39,
      runningCoolingTowerFanCount: 24,
      branchCount: 3,
      coolingTowerCellCount: 6,
      keywordCounts: {
        "流量": 17,
        "压力": 55,
        "阀": 176,
        "频率": 87,
        "功率": 40,
        "温度": 127,
        "湿球": 1
      },
      ...(overrides.counts || {})
    },
    pointDictionary: {
      applied: true,
      source: "test_operational_dictionary",
      ...(overrides.pointDictionary || {})
    },
    keySignals: {
      chilledWater: {
        supplyTempC: 8.5,
        returnTempC: 12.8,
        deltaTC: 4.3,
        supplyPressureKpa: 503.1,
        returnPressureKpa: 403.8,
        differentialPressureKpa: 99.3,
        bypassValveOpenPct: 0,
        ...(overrides.keySignals?.chilledWater || {})
      },
      coolingWater: {
        supplyTempC: 32.7,
        returnTempC: 28,
        deltaTC: 4.7,
        ...(overrides.keySignals?.coolingWater || {})
      },
      weather: {
        wetBulbC: 24.9,
        outdoorTempC: 27.1,
        humidityPct: 83.9,
        ...(overrides.keySignals?.weather || {})
      },
      power: {
        runningChillerPowerKw: 1565.8,
        runningChilledPumpPowerKw: 82.6,
        runningCoolingPumpPowerKw: 44.1,
        runningCoolingTowerPowerKw: 83.2,
        ...(overrides.keySignals?.power || {})
      },
      pumpFrequency: {
        chilledAvgHz: 40.4,
        coolingAvgHz: 34.2,
        ...(overrides.keySignals?.pumpFrequency || {})
      },
      towerFrequency: {
        avgHz: 33.5,
        ...(overrides.keySignals?.towerFrequency || {})
      }
    },
    groups: {
      chillers: [
        { id: "CH4", label: "4#冷水机组", running: true, powerKw: 425, faultActive: false },
        { id: "CH5", label: "5#冷水机组", running: true, powerKw: 522, faultActive: false },
        { id: "CH7", label: "7#冷水机组", running: true, powerKw: 619.2, faultActive: false }
      ],
      chilledPumps: [
        { id: "CHP4", running: true, frequencyHz: 40.4, powerKw: 37.4 },
        { id: "CHP5", running: true, frequencyHz: 40.3, powerKw: 45.2 }
      ],
      coolingPumps: [
        { id: "CWP4", running: true, frequencyHz: 30.4, powerKw: 14 },
        { id: "CWP5", running: true, frequencyHz: 37.9, powerKw: 30.1 }
      ],
      coolingTowers: [
        { id: "CT1", running: true, frequencyHz: 33.5, powerKw: 20.7 }
      ],
      branches: [
        { label: "支路1", flowM3h: 1220.3, returnPressureKpa: 419.7, supplyTempC: 8.6, returnTempC: 12.9, deltaTC: 4.3 },
        { label: "支路2", flowM3h: 1257.1, returnPressureKpa: 415.9, supplyTempC: 8.4, returnTempC: 12.8, deltaTC: 4.4 },
        { label: "支路3", flowM3h: 33.1, returnPressureKpa: 395.5, supplyTempC: 9.2, returnTempC: 11.9, deltaTC: 2.7 }
      ],
      coolingTowerCells: [
        { label: "CT1", flowM3h: 103 },
        { label: "CT2", flowM3h: 135.5 },
        { label: "CT3", flowM3h: 75.8 },
        { label: "CT4", flowM3h: 96.8 },
        { label: "CT5", flowM3h: 860.1 },
        { label: "CT6", flowM3h: 1042.5 }
      ],
      ...(overrides.groups || {})
    }
  };
}

function buildRuntimeSamples({
  combination,
  count,
  loadKw = 2600,
  stationPowerKw,
  chillerPowerKw,
  wetBulbC = 27.5,
  chilledSupplyTempC = 7.0,
  intervalMinutes = 5,
  start = Date.parse("2026-04-12T00:00:00+08:00")
}) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: new Date(start + index * intervalMinutes * 60 * 1000).toISOString(),
    runningCombination: combination,
    loadKw,
    stationPowerKw,
    chillerPowerKw,
    wetBulbC,
    chilledSupplyTempC,
    intervalMinutes,
    alarmCount: 0
  }));
}

function buildOperationalTrendWindow(overrides = {}) {
  const start = Date.parse("2026-06-10T00:00:00+08:00");
  const buildSeries = (metric, label, values) => ({
    metric,
    label,
    points: values.map((value, index) => ({
      t: new Date(start + index * 60 * 60 * 1000).toISOString(),
      v: value
    }))
  });
  return {
    range: "24h",
    generatedAt: "2026-06-10T12:00:00.000+08:00",
    series: [
      buildSeries("currentCop", "冷站COP", overrides.currentCop || [7.0, 6.9, 6.7, 6.5, 6.3, 6.0]),
      buildSeries("totalPowerKw", "总功率", overrides.totalPowerKw || [1880, 1895, 1905, 1910, 1920, 1910]),
      buildSeries("chilledDeltaT", "冷冻水温差", overrides.chilledDeltaT || [4.5, 4.4, 4.3, 4.2, 4.3, 4.2]),
      buildSeries("coolingDeltaT", "冷却水温差", overrides.coolingDeltaT || [4.8, 4.7, 4.6, 4.7, 4.8, 4.7])
    ],
    sourceStatus: {
      overall: "ok"
    }
  };
}

function buildControlLedgerImportReport(overrides = {}) {
  return {
    status: overrides.status || "CONTROL_LEDGER_IMPORT_READY",
    generatedAt: "2026-06-13T10:30:00.000+08:00",
    controlBoundary: "导入器只做现场台账回填、字段规范化和证据校验，不自动改 PID，不自动启停设备，不写真实 PLC。",
    summary: {
      tableCount: 3,
      totalRows: 126,
      acceptedRows: 126,
      blockersCount: 0,
      warningsCount: 0,
      ...(overrides.summary || {})
    },
    outputs: {
      json: "docs/optimize-demo-140-control-ledger-import-latest.json"
    },
    tables: overrides.tables || [
      {
        key: "control_command_feedback_trend",
        title: "控制命令/反馈高频趋势",
        inputMode: "field_export",
        inputPath: "field/control-trend.csv",
        outputPath: "docs/optimize-demo-140-control-command-feedback-normalized-latest.csv",
        rowCount: 90,
        acceptedRowCount: 90,
        blockers: [],
        warnings: []
      },
      {
        key: "start_stop_event_ledger",
        title: "设备启停事件台账",
        inputMode: "field_export",
        inputPath: "field/start-stop.csv",
        outputPath: "docs/optimize-demo-140-start-stop-event-normalized-latest.csv",
        rowCount: 24,
        acceptedRowCount: 24,
        blockers: [],
        warnings: []
      },
      {
        key: "control_parameter_ledger",
        title: "PID/死区/延时参数台账",
        inputMode: "field_export",
        inputPath: "field/control-parameters.csv",
        outputPath: "docs/optimize-demo-140-control-parameter-normalized-latest.csv",
        rowCount: 12,
        acceptedRowCount: 12,
        blockers: [],
        warnings: []
      }
    ],
    blockers: [],
    warnings: [],
    ...(overrides.extra || {})
  };
}

function buildFieldDataPreflightReport(overrides = {}) {
  return {
    finalDecision: overrides.finalDecision || "FIELD_DATA_PREFLIGHT_READY",
    generatedAt: "2026-06-13T11:00:00.000+08:00",
    controlBoundary:
      "预检只校验现场 CSV 可读性、字段映射和证据边界；不自动改 PID，不自动启停设备，不写真实 PLC，不覆盖正式 latest 导入报告。",
    inputs: [
      {
        key: "control_command_feedback_trend",
        title: "控制命令/反馈高频趋势",
        path: "field/control-command-feedback.csv",
        exists: true,
        mode: "explicit_field_export",
        requiredForReady: true
      },
      {
        key: "start_stop_event_ledger",
        title: "设备启停事件台账",
        path: "field/start-stop-event.csv",
        exists: true,
        mode: "explicit_field_export",
        requiredForReady: true
      },
      {
        key: "control_parameter_ledger",
        title: "PID/死区/延时参数台账",
        path: "field/control-parameter.csv",
        exists: true,
        mode: "explicit_field_export",
        requiredForReady: true
      }
    ],
    import: {
      status: "CONTROL_LEDGER_IMPORT_READY",
      acceptedRows: 9,
      totalRows: 9,
      blockersCount: 0,
      warningsCount: 0
    },
    blockers: [],
    warnings: [],
    ...(overrides.extra || {})
  };
}

function buildFieldDataPromoteReport(overrides = {}) {
  return {
    finalDecision: overrides.finalDecision || "FIELD_DATA_PROMOTE_READY",
    generatedAt: "2026-06-13T11:10:00.000+08:00",
    controlBoundary:
      "promotion 只在现场 CSV 预检 READY 后执行正式台账导入；不自动改 PID，不自动启停设备，不写真实 PLC。",
    preflight: {
      finalDecision: "FIELD_DATA_PREFLIGHT_READY",
      reportPath: "docs/optimize-demo-140-field-data-preflight-latest.json"
    },
    import: {
      status: "CONTROL_LEDGER_IMPORT_READY",
      acceptedRows: 9,
      totalRows: 9,
      blockersCount: 0,
      warningsCount: 0
    },
    blockers: [],
    warnings: [],
    ...(overrides.extra || {})
  };
}

function buildSensorLedgerPreflightReport(overrides = {}) {
  return {
    finalDecision: overrides.finalDecision || "SENSOR_LEDGER_PREFLIGHT_READY",
    generatedAt: "2026-06-13T11:30:00.000+08:00",
    controlBoundary:
      "传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。",
    inputs: [
      {
        key: "sensor_calibration_installation_ledger",
        title: "传感器校准/安装位置台账",
        path: "field/sensor-calibration-installation.csv",
        exists: true,
        mode: "explicit_field_export",
        requiredForReady: true
      }
    ],
    summary: {
      totalRows: 18,
      acceptedRows: 18,
      blockersCount: 0,
      warningsCount: 0,
      expiredCalibrationCount: 0,
      missingRangeCount: 0,
      sensorTypeCount: 5,
      pointCodeCount: 18,
      ...(overrides.summary || {})
    },
    blockers: [],
    warnings: [],
    ...(overrides.extra || {})
  };
}

function buildFieldCollectionPackageReport(overrides = {}) {
  return {
    finalDecision: overrides.finalDecision || "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT",
    generatedAt: "2026-06-13T11:45:00.000+08:00",
    controlBoundary:
      "现场采集包 readiness 只校验说明、模板、正式输入位置和边界；不写 PLC、不创建 shadow 单、不判断真实节能。",
    formalInputs: overrides.formalInputs || [
      {
        key: "sensorLedger",
        label: "传感器校准/安装位置台账",
        path: "docs/field-data/optimize-demo-140/sensor-calibration-installation.csv",
        status: "missing",
        lineCount: 0
      },
      {
        key: "controlCommandFeedback",
        label: "控制命令/反馈高频趋势",
        path: "docs/field-data/optimize-demo-140/control-command-feedback.csv",
        status: "missing",
        lineCount: 0
      },
      {
        key: "startStopEvent",
        label: "设备启停事件台账",
        path: "docs/field-data/optimize-demo-140/start-stop-event.csv",
        status: "missing",
        lineCount: 0
      },
      {
        key: "controlParameter",
        label: "PID/死区/延时参数台账",
        path: "docs/field-data/optimize-demo-140/control-parameter.csv",
        status: "missing",
        lineCount: 0
      }
    ],
    templates: [{ key: "sensorLedger" }, { key: "chillerCombinationSamplingLog" }],
    blockers: [],
    warnings: ["正式现场 CSV 尚未投放。"],
    ...(overrides.extra || {})
  };
}

function pickPrimarySchemeForTest(schemes) {
  const items = Array.isArray(schemes) ? schemes : [];
  return [...items].sort((left, right) => {
    const statusRank = {
      ready: 0,
      caution: 1,
      blocked: 2
    };
    const preferenceRank = {
      aggressive: 0,
      balanced: 1,
      conservative: 2
    };
    const statusDiff = (statusRank[left?.status] ?? 3) - (statusRank[right?.status] ?? 3);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const readinessLeft = typeof left?.readiness?.score === "number" ? left.readiness.score : -1;
    const readinessRight = typeof right?.readiness?.score === "number" ? right.readiness.score : -1;
    if (readinessLeft !== readinessRight) {
      return readinessRight - readinessLeft;
    }
    return (preferenceRank[left?.key] ?? 3) - (preferenceRank[right?.key] ?? 3);
  })[0];
}

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

function buildReadyHistoryBenchmarkReports() {
  return {
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

test("validateOptimizeDraftRequest keeps optional equipment context for L4 guardrail resolution", () => {
  const result = validateOptimizeDraftRequest({
    inputs: {
      loadKw: 800,
      outdoorTempC: 31,
      equipmentContext: {
        activeChillerIds: [" ch-01 ", "ch-01", "", "ch-02"],
        activeChillerModels: [" YK-01 ", "YK-01", "YK-02"]
      }
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.request.equipmentContext, {
    activeChillerIds: ["ch-01", "ch-02"],
    activeChillerModels: ["YK-01", "YK-02"]
  });
});

test("buildOptimizeDraftResponse treats non-positive COP snapshots as unavailable", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: {
      ...baseOverview,
      energyCards: {
        ...baseOverview.energyCards,
        currentCop: 0
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations
  });

  assert.equal(response.baseline.systemCop, null);
  assert.equal(response.recommendation.systemCop, null);
  assert.match(
    response.recommendation.steps.join(" | "),
    /Current COP snapshot is unavailable or non-positive/
  );
});

test("buildOptimizeExecutionFeedbackSnapshot does not depend on field policy config", () => {
  const snapshot = buildOptimizeExecutionFeedbackSnapshot(baseOverview, baseAnomalies, {
    phase: "approved"
  });

  assert.equal(snapshot.phase, "approved");
  assert.equal(snapshot.baseline.systemCop, 4);
  assert.equal(snapshot.baseline.totalPowerKw, 300);
  assert.equal(snapshot.sourceStatus.overview, "ok");
  assert.equal(snapshot.sourceStatus.anomalies, "ok");
  assert.match(snapshot.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
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
  assert.equal(response.draftLabel, "主机组合 / 冷却塔接近度 / 泵温差导向 L4 建议");
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
  assert.equal(response.towerApproachAdvisor.status, "ready");
  assert.equal(response.towerApproachAdvisor.currentTcwsC, 31.8);
  assert.equal(response.towerApproachAdvisor.currentApproachC, 4.2);
  assert.equal(response.towerApproachAdvisor.targetBandC.low, 1.8);
  assert.equal(response.towerApproachAdvisor.targetBandC.high, 3.8);
  assert.equal(response.towerApproachAdvisor.targetApproachC, 3.7);
  assert.equal(response.towerApproachAdvisor.targetTcwsC, 31.3);
  assert.equal(response.towerApproachAdvisor.executionReady, true);
  assert.equal(response.towerApproachAdvisor.executionMode, "read_only");
  assert.equal(response.towerApproachAdvisor.controlMode, "read-only-advice");
  assert.equal(response.towerApproachAdvisor.outputTargets.stepLimited, false);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.allowedToCreateExecution, true);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.allowedToDispatch, false);
  assert.ok(Array.isArray(response.towerApproachAdvisor.guardrails));
  assert.ok(response.towerApproachAdvisor.guardrails.length >= 4);
  assert.equal(response.pumpDeltaTAdvisor.status, "ready");
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.chilledPumpFreqTrimHz, 0);
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.coolingPumpFreqTrimHz, 0);
  assert.equal(response.pumpDeltaTAdvisor.executionReady, false);
  assert.equal(response.pumpDeltaTAdvisor.targetPoints.chilledPump, "AI_ChwpFreqTrim_Hz");
  assert.equal(response.pumpDeltaTAdvisor.targetPoints.coolingPump, "AI_CwpFreqTrim_Hz");
  assert.equal(response.chillerStagingAdvisor.status, "unavailable");
  assert.equal(response.chillerStagingAdvisor.basis, "combination_empirical_performance");
  assert.equal(response.chillerStagingAdvisor.advisorResult.execution.enforcedAllowed, false);
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

test("buildOptimizeDraftResponse allows shadow dispatch without PLC control point mapping", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      towerApproach: {
        ...baseConfig.towerApproach,
        dispatch: {
          mode: "shadow"
        }
      }
    },
    "btwentyfive",
    wetBulbRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: baseOverview,
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
    }
  );

  assert.equal(response.towerApproachAdvisor.status, "ready");
  assert.equal(response.towerApproachAdvisor.executionMode, "shadow");
  assert.equal(response.towerApproachAdvisor.dispatchMode, "shadow");
  assert.equal(response.towerApproachAdvisor.dispatchReady, true);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.allowedToCreateExecution, true);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.allowedToDispatch, true);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.controlPointMapped, false);
  assert.match(response.towerApproachAdvisor.warnings.join(" | "), /控制点未映射/);
});

test("buildOptimizeDraftResponse outputs pump delta-t trim when both pump loops have low delta-T", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: {
      ...baseOverview,
      energyCards: {
        ...baseOverview.energyCards,
        chilledDeltaT: 3.2,
        coolingDeltaT: 3.1,
        currentCop: 4.2,
        totalPowerKw: 310,
        chillerPowerKw: 190,
        chilledPumpPowerKw: 46,
        coolingPumpPowerKw: 44
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
  });

  assert.equal(response.pumpDeltaTAdvisor.status, "ready");
  assert.equal(response.pumpDeltaTAdvisor.executionMode, "shadow");
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.chilledPumpFreqTrimHz, -1);
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.coolingPumpFreqTrimHz, -1);
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.ttlSeconds, 300);
  assert.equal(response.pumpDeltaTAdvisor.executionReady, true);
  assert.equal(response.pumpDeltaTAdvisor.dispatchReady, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.allowedToCreateExecution, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.allowedToDispatch, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.enforcedAllowed, false);
});

test("buildOptimizeDraftResponse locks assisted pump dispatch until terminal safety preconditions are mapped", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      pumpDeltaT: {
        dispatchMode: "assisted",
        controlTargets: {
          approve: {
            strategy: "json-command",
            commands: [
              { chwpTagName: "B25_AI_ChwpFreqTrim_Hz", valueSource: "targetChwpFreqTrimHz" },
              { cwpTagName: "B25_AI_CwpFreqTrim_Hz", valueSource: "targetCwpFreqTrimHz" }
            ]
          },
          rollback: {
            commands: [
              { chwpTagName: "B25_AI_ChwpFreqTrim_Hz", valueSource: "rollbackTarget.targetChwpFreqTrimHz" },
              { cwpTagName: "B25_AI_CwpFreqTrim_Hz", valueSource: "rollbackTarget.targetCwpFreqTrimHz" }
            ]
          }
        }
      }
    },
    "btwentyfive",
    wetBulbRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          chilledDeltaT: 3.2,
          coolingDeltaT: 3.1,
          currentCop: 4.2,
          totalPowerKw: 310,
          chillerPowerKw: 190,
          chilledPumpPowerKw: 46,
          coolingPumpPowerKw: 44
        }
      },
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
    }
  );

  assert.equal(response.pumpDeltaTAdvisor.executionMode, "assisted");
  assert.equal(response.pumpDeltaTAdvisor.executionReady, true);
  assert.equal(response.pumpDeltaTAdvisor.dispatchReady, false);
  assert.equal(response.pumpDeltaTAdvisor.shadowMapping.status, "mapped");
  assert.equal(response.pumpDeltaTAdvisor.shadowMapping.rollbackMapped, true);
  assert.equal(response.pumpDeltaTAdvisor.targetPoints.chilledPump, "B25_AI_ChwpFreqTrim_Hz");
  assert.equal(response.pumpDeltaTAdvisor.safetyPreconditions.assistedReady, false);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.controlPointMapped, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.rollbackMapped, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.allowedToDispatch, false);
  assert.match(response.pumpDeltaTAdvisor.warnings.join(" | "), /末端安全|PLC 本地保护/);
});

test("buildOptimizeDraftResponse allows assisted pump dispatch only after safety preconditions are ready", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      pumpDeltaT: {
        dispatchMode: "assisted",
        controlTargets: {
          approve: {
            strategy: "json-command",
            commands: [
              { chwpTagName: "B25_AI_ChwpFreqTrim_Hz", valueSource: "targetChwpFreqTrimHz" },
              { cwpTagName: "B25_AI_CwpFreqTrim_Hz", valueSource: "targetCwpFreqTrimHz" }
            ]
          },
          rollback: {
            commands: [
              { chwpTagName: "B25_AI_ChwpFreqTrim_Hz", valueSource: "rollbackTarget.targetChwpFreqTrimHz" },
              { cwpTagName: "B25_AI_CwpFreqTrim_Hz", valueSource: "rollbackTarget.targetCwpFreqTrimHz" }
            ]
          }
        },
        safetyInputs: {
          terminalDifferentialPressureReady: "ready",
          plcPumpTrimProtected: "protected",
          minFlowProtected: "protected",
          pumpFrequencyFeedbackReady: "ready"
        }
      }
    },
    "btwentyfive",
    wetBulbRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          chilledDeltaT: 3.2,
          coolingDeltaT: 3.1,
          currentCop: 4.2,
          totalPowerKw: 310,
          chillerPowerKw: 190,
          chilledPumpPowerKw: 46,
          coolingPumpPowerKw: 44
        }
      },
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
    }
  );

  assert.equal(response.pumpDeltaTAdvisor.executionMode, "assisted");
  assert.equal(response.pumpDeltaTAdvisor.executionReady, true);
  assert.equal(response.pumpDeltaTAdvisor.dispatchReady, true);
  assert.equal(response.pumpDeltaTAdvisor.shadowMapping.assistedDispatchReady, true);
  assert.equal(response.pumpDeltaTAdvisor.safetyPreconditions.status, "ready");
  assert.equal(response.pumpDeltaTAdvisor.safetyPreconditions.terminalSafetyReady, true);
  assert.equal(response.pumpDeltaTAdvisor.safetyPreconditions.plcProtectionReady, true);
  assert.equal(response.pumpDeltaTAdvisor.safetyPreconditions.pumpFrequencyFeedbackReady, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.allowedToDispatch, true);
  assert.equal(response.pumpDeltaTAdvisor.advisorResult.execution.assistedDispatchReady, true);
  assert.deepEqual(response.pumpDeltaTAdvisor.advisorResult.execution.targetPoints, [
    "B25_AI_ChwpFreqTrim_Hz",
    "B25_AI_CwpFreqTrim_Hz"
  ]);
});

test("buildOptimizeDraftResponse freezes pump delta-t trim when live data is stale", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: {
      ...baseOverview,
      freshness: {
        latestTimestamp: "2026-04-01T01:00:00.000Z",
        stale: true,
        ageHours: 8
      },
      energyCards: {
        ...baseOverview.energyCards,
        chilledDeltaT: 3.2,
        coolingDeltaT: 3.1
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
  });

  assert.equal(response.pumpDeltaTAdvisor.status, "unavailable");
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.chilledPumpFreqTrimHz, 0);
  assert.equal(response.pumpDeltaTAdvisor.outputTargets.coolingPumpFreqTrimHz, 0);
  assert.equal(response.pumpDeltaTAdvisor.executionReady, false);
  assert.match(response.pumpDeltaTAdvisor.blockers.join(" | "), /新鲜度|实时快照/);
});

test("buildOptimizeDraftResponse falls back to existing scheme logic when benchmark is unavailable", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      staleThresholdHours: 6
    },
    "btwentyfive",
    wetBulbRequest,
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
  assert.equal(response.towerApproachAdvisor.status, "partial");
  assert.equal(response.towerApproachAdvisor.executionReady, false);
  assert.equal(response.towerApproachAdvisor.controlMode, "read-only-advice");
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

test("buildOptimizeDraftResponse blocks tower approach when current approach is physically impossible", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations
  });

  assert.equal(response.towerApproachAdvisor.currentApproachC, null);
  assert.equal(response.towerApproachAdvisor.targetApproachC, null);
  assert.equal(response.towerApproachAdvisor.targetTcwsC, null);
  assert.equal(response.towerApproachAdvisor.outputTargets.rawTargetApproachC, null);
  assert.equal(response.towerApproachAdvisor.outputTargets.currentApproachC, null);
  assert.equal(response.towerApproachAdvisor.outputTargets.stepLimited, false);
  assert.equal(response.towerApproachAdvisor.status, "unavailable");
  assert.equal(response.towerApproachAdvisor.executionReady, false);
  assert.equal(response.towerApproachAdvisor.advisorResult.execution.allowedToCreateExecution, false);
  assert.equal(response.pumpDeltaTAdvisor.current.currentApproachC, null);
  const instrumentDiagnostic = response.operationalDiagnosticsAdvisor.items.find(
    (item) => item.key === "instrumentDataQuality"
  );
  const wetBulbBoundaryCheck = instrumentDiagnostic?.current?.crossChecks?.find(
    (item) => item.key === "wet_bulb_physical_boundary"
  );
  assert.equal(wetBulbBoundaryCheck?.value, null);
  assert.equal(wetBulbBoundaryCheck?.status, "review");
  assert.doesNotMatch(wetBulbBoundaryCheck?.evidence || "", /-\d/);
  const approachSignal = response.towerApproachAdvisor.inputSignals.find(
    (item) => item.key === "currentApproachC"
  );
  assert.equal(approachSignal?.value, null);
  assert.equal(approachSignal?.ok, false);
  assert.match(approachSignal?.reason || "", /负值/);
  const currentTcwsSignal = response.towerApproachAdvisor.inputSignals.find(
    (item) => item.key === "currentTcwsC"
  );
  assert.equal(currentTcwsSignal?.ok, false);
  assert.match(currentTcwsSignal?.reason || "", /不符合冷却塔物理约束/);
  assert.match(response.towerApproachAdvisor.blockers.join(" | "), /接近度计算结果为负值/);
});

test("buildOptimizeDraftResponse creates tower approach multi-step shadow plan when target violates minimum condenser inlet temp", async () => {
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

  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      towerApproach: {
        minCondenserInletTempC: 33
      }
    },
    "btwentyfive",
    wetBulbRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: baseOverview,
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports
    }
  );

  assert.equal(response.towerApproachAdvisor.status, "ready");
  assert.equal(response.towerApproachAdvisor.executionReady, true);
  assert.equal(response.towerApproachAdvisor.targetTcwsC, 32.3);
  assert.equal(response.towerApproachAdvisor.targetApproachC, 4.7);
  assert.equal(response.towerApproachAdvisor.outputTargets.finalTargetTcwsC, 33);
  assert.equal(response.towerApproachAdvisor.outputTargets.finalTargetApproachC, 5.4);
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.required, true);
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.reason, "min_condenser_guardrail");
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.stepCount, 3);
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.nextStepTargetTcwsC, 32.3);
  assert.deepEqual(
    response.towerApproachAdvisor.outputTargets.multiStepPlan.steps.map((step) => step.targetTcwsC),
    [32.3, 32.8, 33]
  );
  assert.equal(response.towerApproachAdvisor.outputTargets.targetAdjustedByMinCondenserGuardrail, true);
  assert.equal(response.towerApproachAdvisor.outputTargets.stepLimited, true);
  assert.match(response.towerApproachAdvisor.reason, /多步 shadow/);
  assert.doesNotMatch(response.towerApproachAdvisor.blockers.join(" | "), /单步目标变化/);
  assert.match(response.towerApproachAdvisor.warnings.join(" | "), /分 3 步 shadow/);
  const minTempGuardrail = response.towerApproachAdvisor.guardrails.find(
    (item) => item.key === "chillerMinCondenserInletTempC"
  );
  assert.ok(minTempGuardrail);
  assert.equal(minTempGuardrail.value, 33);
  assert.equal(minTempGuardrail.status, "ready");
});

test("buildOptimizeDraftResponse resolves tower approach guardrail by active chiller before default threshold", async () => {
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

  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      towerApproach: {
        minCondenserInletTempC: 28.5,
        minCondenserInletTempCByModel: {
          "YK-01": 29.8
        },
        minCondenserInletTempCByChiller: {
          "ch-01": 33,
          "ch-02": 29.6
        }
      }
    },
    "btwentyfive",
    {
      ...wetBulbRequest,
      equipmentContext: {
        activeChillerIds: ["ch-01", "ch-02"],
        activeChillerModels: ["YK-01"]
      }
    },
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: baseOverview,
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports
    }
  );

  assert.equal(response.towerApproachAdvisor.status, "ready");
  assert.equal(response.towerApproachAdvisor.executionReady, true);
  assert.equal(response.towerApproachAdvisor.targetTcwsC, 32.3);
  assert.equal(response.towerApproachAdvisor.outputTargets.finalTargetTcwsC, 33);
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.required, true);
  assert.equal(response.towerApproachAdvisor.outputTargets.multiStepPlan.stepCount, 3);
  const minTempGuardrail = response.towerApproachAdvisor.guardrails.find(
    (item) => item.key === "chillerMinCondenserInletTempC"
  );
  assert.ok(minTempGuardrail);
  assert.equal(minTempGuardrail.value, 33);
  assert.equal(minTempGuardrail.resolvedBy, "by-chiller");
  assert.deepEqual(minTempGuardrail.matchedKeys, ["ch-01", "ch-02"]);
  assert.match(minTempGuardrail.message, /活跃机组实例/);
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

test("buildOptimizeDraftResponse downgrades strategy when live snapshot is stale", async () => {
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
    overview: {
      ...baseOverview,
      freshness: {
        latestTimestamp: "2026-04-01T01:00:00.000Z",
        stale: true,
        ageHours: 8
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.decision.confidence, "rule-based-draft-partial");
  assert.equal(response.gate.level, "caution");
  assert.match(response.gate.reason, /新鲜度阈值/);
  assert.equal(response.reviewReadiness.status, "partial");
  assert.match(response.reviewReadiness.reason, /新鲜度阈值/);
  assert.ok(response.schemes.some((scheme) => scheme.deviceActions.some((item) => /实时快照/.test(item.action))));
  assert.equal(response.schemes[0].status, "ready");
  assert.equal(response.schemes[1].status, "caution");
  assert.equal(response.schemes[2].status, "blocked");
});

test("buildOptimizeDraftResponse prioritizes thermal balance before efficiency-first moves", async () => {
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
    overview: {
      ...baseOverview,
      energyCards: {
        ...baseOverview.energyCards,
        thermalUnbalanceRate: 0.21
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports
  });

  assert.equal(response.gate.level, "caution");
  assert.match(response.gate.reason, /热平衡偏差/);
  assert.equal(response.reviewReadiness.status, "partial");
  assert.match(response.reviewReadiness.reason, /热平衡偏差/);
  assert.ok(response.schemes.some((scheme) => scheme.deviceActions.some((item) => /恢复热平衡/.test(item.action))));
  assert.equal(response.schemes[0].status, "ready");
  assert.equal(response.schemes[1].status, "caution");
  assert.equal(response.schemes[2].status, "blocked");
});

test("buildOptimizeDraftResponse normalizes percent thermal balance values for optimize gates", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: {
      ...baseOverview,
      energyCards: {
        ...baseOverview.energyCards,
        thermalUnbalanceRate: 16.2
      }
    },
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: buildReadyHistoryBenchmarkReports()
  });

  assert.equal(response.gate.level, "caution");
  assert.match(response.gate.reason, /16.2%/);
  assert.doesNotMatch(response.gate.reason, /1620/);
  assert.match(response.reviewReadiness.reason, /16.2%/);
  assert.ok(
    response.schemes.some((scheme) =>
      scheme.deviceActions.some((item) => /16.2%/.test(item.reason))
    )
  );
});

test("buildOptimizeDraftResponse surfaces recent governance feedback without changing gate semantics", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    executionOverview: {
      pendingApprovalCount: 1,
      approvedCount: 1,
      rolledBackCount: 1,
      latestExecutionId: "opx-btwentyfive-2",
      latestExecutionStatus: "pending_approval",
      latestExecutionAt: "2026-04-09T20:10:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-2",
        status: "pending_approval",
        createdAt: "2026-04-09T20:00:00.000+08:00",
        updatedAt: "2026-04-09T20:10:00.000+08:00",
        execution: {
          type: "scheme",
          schemeKey: "balanced",
          title: "平衡方案"
        }
      },
      {
        executionId: "opx-btwentyfive-1",
        status: "rolled_back",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T19:00:00.000+08:00",
        execution: {
          type: "scheme",
          schemeKey: "aggressive",
          title: "激进方案"
        },
        rollback: {
          reason: "现场振荡，回退到手动"
        }
      }
    ]
  });

  assert.equal(response.gate.level, "ready");
  assert.equal(response.executionFeedback.status, "pending");
  assert.equal(response.executionFeedback.outcomeClass, "pending_approval");
  assert.equal(response.executionFeedback.pendingApprovalCount, 1);
  assert.match(response.executionFeedback.summary, /待审批执行/);
  assert.ok(response.executionFeedback.signals.some((item) => /回退/.test(item)));
  assert.match(response.diagnostics.join(" | "), /executionFeedback.status=pending/);
});

test("buildOptimizeDraftResponse compares current primary scheme against the latest approved scheme target", async () => {
  const baselineResponse = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: {
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
    }
  });
  const primaryScheme = pickPrimarySchemeForTest(baselineResponse.schemes);
  assert.ok(primaryScheme);

  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: {
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
    },
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 1,
      rolledBackCount: 0,
      latestExecutionId: "opx-btwentyfive-approved",
      latestExecutionStatus: "approved",
      latestExecutionAt: "2026-04-09T18:30:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-approved",
        status: "approved",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T18:30:00.000+08:00",
        execution: {
          type: "scheme",
          schemeKey: primaryScheme.key,
          title: primaryScheme.title,
          targetCop: typeof primaryScheme.targetCop === "number" ? primaryScheme.targetCop - 0.4 : null,
          targetPowerKw:
            typeof primaryScheme.targetPowerKw === "number" ? primaryScheme.targetPowerKw - 18 : null
        }
      }
    ]
  });

  assert.equal(response.executionFeedback.status, "approved-history");
  assert.equal(response.executionFeedback.outcomeClass, "approved");
  assert.equal(response.executionFeedback.currentDraftComparison.status, "changed-target");
  assert.equal(response.executionFeedback.currentDraftComparison.targetPowerDeltaKw, 18);
  assert.equal(response.executionFeedback.currentDraftComparison.targetCopDelta, 0.4);
  assert.match(response.executionFeedback.summary, /最近一次已批准目标已调整/);
});

test("buildOptimizeDraftResponse classifies approved execution with failed dispatch as approved_not_applied", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 1,
      rolledBackCount: 0,
      latestExecutionId: "opx-btwentyfive-approve-failed",
      latestExecutionStatus: "approved",
      latestExecutionAt: "2026-04-09T18:30:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-approve-failed",
        status: "approved",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T18:30:00.000+08:00",
        execution: {
          type: "tower-approach",
          dispatch: {
            latestStatus: "apply_pending",
            lastApprove: {
              status: "failed",
              code: "DISPATCH_ENDPOINT_MISSING",
              mode: "shadow"
            }
          }
        }
      }
    ]
  });

  assert.equal(response.executionFeedback.outcomeClass, "approved_not_applied");
  assert.equal(response.executionFeedback.approveDispatchStatus, "failed");
  assert.equal(response.executionFeedback.approveDispatchCode, "DISPATCH_ENDPOINT_MISSING");
  assert.match(response.executionFeedback.summary, /未真正下发/);
});

test("buildOptimizeDraftResponse classifies rolled back execution after successful apply", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 0,
      rolledBackCount: 1,
      latestExecutionId: "opx-btwentyfive-rolled-back",
      latestExecutionStatus: "rolled_back",
      latestExecutionAt: "2026-04-09T18:35:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-rolled-back",
        status: "rolled_back",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T18:35:00.000+08:00",
        rollback: {
          reason: "现场振荡，回退到手动"
        },
        execution: {
          type: "tower-approach",
          dispatch: {
            latestStatus: "rolled_back",
            lastApprove: {
              status: "succeeded",
              code: "DISPATCH_OK",
              mode: "shadow"
            },
            lastRollback: {
              status: "succeeded",
              code: "DISPATCH_OK",
              mode: "shadow"
            }
          }
        }
      }
    ]
  });

  assert.equal(response.executionFeedback.outcomeClass, "rolled_back_after_apply");
  assert.equal(response.executionFeedback.rollbackDispatchStatus, "succeeded");
  assert.match(response.executionFeedback.summary, /已执行后回退/);
});

test("buildOptimizeDraftResponse exposes latest observed KPI snapshot from execution feedback", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", request, {
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 1,
      rolledBackCount: 0,
      latestExecutionId: "opx-btwentyfive-observed",
      latestExecutionStatus: "approved",
      latestExecutionAt: "2026-04-09T18:35:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-observed",
        status: "approved",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T18:35:00.000+08:00",
        draft: {
          baseline: {
            systemCop: 4.2,
            totalPowerKw: 229.5,
            activeAlarmCount: 1,
            thermalUnbalanceRate: 0.12
          }
        },
        execution: {
          type: "scheme",
          targetCop: 4.5,
          targetPowerKw: 220,
          feedbackSnapshots: {
            latest: {
              phase: "approved",
              capturedAt: "2026-04-09T18:35:00.000+08:00",
              baseline: {
                systemCop: 4.6,
                totalPowerKw: 214.2,
                activeAlarmCount: 0,
                thermalUnbalanceRate: 0.08
              }
            }
          }
        }
      }
    ]
  });

  assert.equal(response.executionFeedback.latestObservedSnapshot.phase, "approved");
  assert.equal(response.executionFeedback.latestObservedSnapshot.systemCop, 4.6);
  assert.equal(response.executionFeedback.latestObservedSnapshot.totalPowerKw, 214.2);
  assert.equal(response.executionFeedback.observedBaselineComparison.status, "improved");
  assert.equal(response.executionFeedback.observedBaselineComparison.systemCopDelta, 0.4);
  assert.equal(response.executionFeedback.observedBaselineComparison.totalPowerDeltaKw, -15.3);
  assert.equal(response.executionFeedback.observedTargetComparison.status, "met");
  assert.equal(response.executionFeedback.observedTargetComparison.observedCopGap, 0.1);
  assert.equal(response.executionFeedback.observedTargetComparison.observedPowerGapKw, -5.8);
  assert.ok(response.executionFeedback.signals.some((item) => /相对提交前回采/.test(item)));
  assert.ok(response.executionFeedback.signals.some((item) => /审批后回采/.test(item)));
});

test("buildOptimizeDraftResponse downgrades gate when latest observed execution regresses against submitted baseline", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 1,
      rolledBackCount: 0,
      latestExecutionId: "opx-btwentyfive-degraded",
      latestExecutionStatus: "approved",
      latestExecutionAt: "2026-04-09T18:35:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-degraded",
        status: "approved",
        createdAt: "2026-04-09T18:00:00.000+08:00",
        updatedAt: "2026-04-09T18:35:00.000+08:00",
        draft: {
          baseline: {
            systemCop: 4.2,
            totalPowerKw: 229.5,
            activeAlarmCount: 1,
            thermalUnbalanceRate: 0.08
          }
        },
        execution: {
          type: "scheme",
          targetCop: 4.4,
          targetPowerKw: 225,
          feedbackSnapshots: {
            latest: {
              phase: "approved",
              capturedAt: "2026-04-09T18:35:00.000+08:00",
              baseline: {
                systemCop: 3.9,
                totalPowerKw: 244.8,
                activeAlarmCount: 2,
                thermalUnbalanceRate: 0.12
              }
            }
          }
        }
      }
    ]
  });

  assert.equal(response.gate.level, "caution");
  assert.match(response.gate.reason, /回采相对提交前退化/);
  assert.equal(response.reviewReadiness.status, "partial");
  assert.equal(response.schemes[0].status, "ready");
  assert.equal(response.schemes[1].status, "caution");
  assert.equal(response.schemes[2].status, "blocked");
  assert.equal(response.executionFeedback.observedBaselineComparison.status, "degraded");
  assert.ok(response.executionFeedback.signals.some((item) => /优先考虑回退或停发相近目标/.test(item)));
});

test("buildOptimizeDraftResponse downgrades gate after two consecutive missed target observations", async () => {
  const response = await buildOptimizeDraftResponse(baseConfig, "btwentyfive", wetBulbRequest, {
    now: new Date("2026-04-15T12:00:00+08:00"),
    overview: baseOverview,
    anomalies: baseAnomalies,
    recommendations: baseRecommendations,
    historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
    executionOverview: {
      pendingApprovalCount: 0,
      approvedCount: 2,
      rolledBackCount: 0,
      latestExecutionId: "opx-btwentyfive-missed-2",
      latestExecutionStatus: "approved",
      latestExecutionAt: "2026-04-09T20:35:00.000+08:00"
    },
    recentExecutions: [
      {
        executionId: "opx-btwentyfive-missed-2",
        status: "approved",
        createdAt: "2026-04-09T20:00:00.000+08:00",
        updatedAt: "2026-04-09T20:35:00.000+08:00",
        draft: {
          baseline: {
            systemCop: 4.2,
            totalPowerKw: 229.5,
            activeAlarmCount: 1,
            thermalUnbalanceRate: 0.12
          }
        },
        execution: {
          type: "scheme",
          targetCop: 4.8,
          targetPowerKw: 210,
          feedbackSnapshots: {
            latest: {
              phase: "approved",
              capturedAt: "2026-04-09T20:35:00.000+08:00",
              baseline: {
                systemCop: 4.4,
                totalPowerKw: 222.4,
                activeAlarmCount: 0,
                thermalUnbalanceRate: 0.09
              }
            }
          }
        }
      },
      {
        executionId: "opx-btwentyfive-missed-1",
        status: "approved",
        createdAt: "2026-04-08T20:00:00.000+08:00",
        updatedAt: "2026-04-08T20:30:00.000+08:00",
        draft: {
          baseline: {
            systemCop: 4.1,
            totalPowerKw: 231.0,
            activeAlarmCount: 1,
            thermalUnbalanceRate: 0.11
          }
        },
        execution: {
          type: "scheme",
          targetCop: 4.7,
          targetPowerKw: 215,
          feedbackSnapshots: {
            latest: {
              phase: "approved",
              capturedAt: "2026-04-08T20:30:00.000+08:00",
              baseline: {
                systemCop: 4.3,
                totalPowerKw: 225.2,
                activeAlarmCount: 0,
                thermalUnbalanceRate: 0.09
              }
            }
          }
        }
      }
    ]
  });

  assert.equal(response.gate.level, "caution");
  assert.match(response.gate.reason, /连续 2 次方案执行回采未达到提交目标/);
  assert.equal(response.reviewReadiness.status, "partial");
  assert.equal(response.schemes[0].status, "ready");
  assert.equal(response.schemes[1].status, "caution");
  assert.equal(response.schemes[2].status, "blocked");
  assert.equal(response.executionFeedback.observedTargetComparison.status, "missed");
  assert.ok(response.executionFeedback.signals.some((item) => /避免继续放大相近目标/.test(item)));
});

test("buildOptimizeDraftResponse recommends empirical chiller combination switch without single-machine COP split", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig(),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: buildChillerCombinationHistory()
    }
  );

  assert.equal(response.chillerStagingAdvisor.status, "ready");
  assert.equal(response.chillerStagingAdvisor.executionMode, "shadow");
  assert.equal(response.chillerStagingAdvisor.executionReady, true);
  assert.equal(response.chillerStagingAdvisor.dispatchReady, false);
  assert.equal(response.chillerStagingAdvisor.current.runningCount, 2);
  assert.equal(response.chillerStagingAdvisor.current.comboCop, 4.81);
  assert.equal(response.chillerStagingAdvisor.current.stationCop, 3.66);
  assert.equal("singleChillerCop" in response.chillerStagingAdvisor.current, false);
  assert.equal(response.chillerStagingAdvisor.recommendation.action, "switch_combination");
  assert.deepEqual(response.chillerStagingAdvisor.recommendation.targetCombination, ["NEW-1", "NEW-2"]);
  assert.equal(response.chillerStagingAdvisor.recommendation.expectedTotalPowerDeltaKw, -90);
  assert.equal(response.chillerStagingAdvisor.recommendation.expectedCopDelta, 0.53);
  assert.equal(response.chillerStagingAdvisor.confidence, "high");
  assert.match(response.chillerStagingAdvisor.disclaimer, /不输出单机实时 COP/);
  assert.equal("singleChillerCop" in response.chillerStagingAdvisor.evidence.learningBoundary, false);
  assert.equal(
    response.chillerStagingAdvisor.evidence.learningBoundary.singleChillerCopLearning,
    "only_when_single_chiller_running"
  );
  assert.equal(response.chillerStagingAdvisor.evidence.currentWindow.canLearnSingleChillerCop, false);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.currentCombinationSamples, 86);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.targetCombinationSamples, 126);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.status, "comparison_candidate_available");
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.readyForRanking, true);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.sameBandReadyCandidateCount, 1);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.currentCombinationSamples, 86);
  assert.equal(
    response.chillerStagingAdvisor.evidence.targetCombinationEvidence.matchingTier,
    "same_load_wet_bulb_chws_band"
  );
  assert.equal(response.chillerStagingAdvisor.savingsVerification.durationMinutes.min, 30);
  assert.equal(response.chillerStagingAdvisor.savingsVerification.durationMinutes.max, 60);
  assert.ok(response.chillerStagingAdvisor.savingsVerification.metrics.includes("kwPerRt"));
  assert.equal(response.chillerStagingAdvisor.advisorResult.execution.enforcedAllowed, false);
});

test("buildOptimizeDraftResponse aggregates raw runtime samples into chiller combination evidence", async () => {
  const runtimeSamples = [
    ...buildRuntimeSamples({
      combination: ["OLD-1", "NEW-1"],
      count: 50,
      stationPowerKw: 710,
      chillerPowerKw: 540,
      start: Date.parse("2026-04-12T00:00:00+08:00")
    }),
    ...buildRuntimeSamples({
      combination: ["NEW-1", "NEW-2"],
      count: 110,
      stationPowerKw: 620,
      chillerPowerKw: 460,
      start: Date.parse("2026-04-13T00:00:00+08:00")
    })
  ];
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig(),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerRuntimeSamples: runtimeSamples
    }
  );

  const targetCandidate = response.chillerStagingAdvisor.candidates.find(
    (item) => item.key === "NEW-1+NEW-2"
  );
  assert.equal(response.chillerStagingAdvisor.status, "ready");
  assert.equal(response.chillerStagingAdvisor.recommendation.action, "switch_combination");
  assert.deepEqual(response.chillerStagingAdvisor.recommendation.targetCombination, ["NEW-1", "NEW-2"]);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.historyRowCount, 2);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.sampleTotal, 160);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.targetCombinationSamples, 110);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.status, "comparison_candidate_available");
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.readyForRanking, true);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.coveredCandidateCount, 2);
  assert.equal(response.chillerStagingAdvisor.evidence.targetCombinationEvidence.source, "runtime_sample_aggregation");
  assert.equal(response.chillerStagingAdvisor.evidence.targetCombinationEvidence.sampleMinutes, 550);
  assert.equal(targetCandidate.source, "runtime_sample_aggregation");
  assert.equal(targetCandidate.kwPerRt, 0.839);
  assert.equal("singleChillerCop" in targetCandidate, false);
});

test("buildOptimizeDraftResponse marks single-chiller windows as single COP learning samples", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig({
      chillerStaging: {
        currentRunMinutes: 160,
        candidateCombinations: [["NEW-1"]]
      }
    }),
    "btwentyfive",
    {
      ...chillerStagingRequest,
      loadKw: 1000,
      equipmentContext: {
        activeChillerIds: ["NEW-1"]
      }
    },
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview({
        energyCards: {
          currentCop: 4.2,
          totalPowerKw: 238,
          chillerPowerKw: 185
        }
      }),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: [
        {
          combination: ["NEW-1"],
          sampleCount: 45,
          loadRatePct: 55.6,
          wetBulbC: 27.5,
          chilledSupplyTempC: 7.0,
          stationCop: 4.2,
          comboCop: 5.4,
          stationPowerKw: 238,
          chillerPowerKw: 185
        }
      ]
    }
  );

  assert.equal(response.chillerStagingAdvisor.evidence.currentWindow.canLearnSingleChillerCop, true);
  assert.equal(response.chillerStagingAdvisor.evidence.currentWindow.sampleRole, "single_chiller_learning_window");
  assert.equal(
    response.chillerStagingAdvisor.evidence.currentCombinationEvidence.note,
    "单台运行窗口可作为该主机单机 COP 样本。"
  );
  assert.equal("singleChillerCop" in response.chillerStagingAdvisor.current, false);
});

test("buildOptimizeDraftResponse downgrades chiller staging when target combination samples are insufficient", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig(),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: buildChillerCombinationHistory({ targetSampleCount: 12 })
    }
  );

  const targetCandidate = response.chillerStagingAdvisor.candidates.find(
    (item) => item.key === "NEW-1+NEW-2"
  );
  assert.equal(response.chillerStagingAdvisor.status, "partial");
  assert.equal(response.chillerStagingAdvisor.executionReady, false);
  assert.equal(response.chillerStagingAdvisor.recommendation.action, "keep");
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.status, "baseline_ready_only");
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.readyForRanking, false);
  assert.equal(response.chillerStagingAdvisor.sampleGovernance.sameBandReadyCandidateCount, 0);
  assert.match(response.chillerStagingAdvisor.sampleGovernance.summary, /候选组合仍不足/);
  assert.ok(targetCandidate);
  assert.equal(targetCandidate.confidence, "low");
  assert.match(targetCandidate.blockers.join(" | "), /低于 30 条/);
});

test("buildOptimizeDraftResponse blocks chiller staging on critical alarms and short current runtime", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig({
      chillerStaging: {
        currentRunMinutes: 35
      }
    }),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 1,
          critical: 1,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: buildChillerCombinationHistory()
    }
  );

  assert.equal(response.chillerStagingAdvisor.status, "partial");
  assert.equal(response.chillerStagingAdvisor.executionReady, false);
  assert.match(response.chillerStagingAdvisor.blockers.join(" | "), /紧急告警|低于 90 分钟/);
  assert.equal(response.chillerStagingAdvisor.advisorResult.execution.allowedToDispatch, false);
});

test("buildOptimizeDraftResponse keeps chiller staging when switch savings are below threshold", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig(),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: buildChillerCombinationHistory({
        targetStationCop: 3.77,
        targetStationPowerKw: 690
      })
    }
  );

  assert.equal(response.chillerStagingAdvisor.status, "partial");
  assert.equal(response.chillerStagingAdvisor.executionReady, false);
  assert.equal(response.chillerStagingAdvisor.recommendation.action, "keep");
  assert.match(response.chillerStagingAdvisor.warnings.join(" | "), /切换收益门槛/);
});

test("buildOptimizeDraftResponse uses realtime chiller context when request lacks active chiller ids", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        chillers: [
          { id: "CH4", label: "4#冷水机组" },
          { id: "CH5", label: "5#冷水机组" },
          { id: "CH7", label: "7#冷水机组" }
        ]
      }
    },
    "140",
    {
      loadKw: 9120,
      outdoorTempC: 21.8,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 7.1,
          totalPowerKw: 1348.9,
          chillerPowerKw: 1093.3
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      fieldCollectionPackageReport: buildFieldCollectionPackageReport(),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"],
          activeChillerModels: ["4#冷水机组", "5#冷水机组", "7#冷水机组"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        chillerInventory: [
          { id: "CH4", label: "4#冷水机组" },
          { id: "CH5", label: "5#冷水机组" },
          { id: "CH7", label: "7#冷水机组" }
        ],
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  assert.deepEqual(response.chillerStagingAdvisor.current.runningCombination, ["CH4", "CH5", "CH7"]);
  assert.equal(response.chillerStagingAdvisor.current.runningCount, 3);
  assert.equal(response.chillerStagingAdvisor.current.systemCoolingLoadKw, 9577.2);
  assert.equal(response.chillerStagingAdvisor.current.loadBasis, "derived_from_station_cop_and_power");
  assert.equal(response.chillerStagingAdvisor.current.comboCop, 8.76);
  assert.equal(response.chillerStagingAdvisor.status, "unavailable");
  assert.equal(response.chillerStagingAdvisor.evidence.currentLiveSample.status, "recordable");
  assert.equal(response.chillerStagingAdvisor.evidence.currentLiveSample.includedInHistory, false);
  assert.deepEqual(response.chillerStagingAdvisor.evidence.currentLiveSample.combination, ["CH4", "CH5", "CH7"]);
  assert.equal(response.chillerStagingAdvisor.evidence.currentLiveSample.stationPowerKw, 1348.9);
  assert.equal(response.chillerStagingAdvisor.evidence.currentLiveSample.chillerPowerKw, 1093.3);
  assert.equal(response.chillerStagingAdvisor.evidence.currentLiveSample.comboCop, 8.76);
  assert.equal(response.chillerStagingAdvisor.evidence.sampleSummary.sampleTotal, 0);
  assert.doesNotMatch(response.chillerStagingAdvisor.blockers.join(" | "), /缺当前运行主机组合/);
  assert.match(response.chillerStagingAdvisor.blockers.join(" | "), /缺当前组合额定容量|缺主机组合历史样本/);
  assert.ok(
    response.sourceStatus.sources.some((source) => source.key === "chillerStagingRuntime" && source.ok === true)
  );
});

test("buildOptimizeDraftResponse returns six read-only operational diagnostics from runtime point summary", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      fieldCollectionPackageReport: buildFieldCollectionPackageReport(),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  assert.equal(advisor.status, "partial");
  assert.equal(advisor.executionMode, "read_only");
  assert.equal(advisor.items.length, 6);
  assert.deepEqual(
    advisor.items.map((item) => item.key),
    [
      "instrumentDataQuality",
      "chilledHydraulicBalance",
      "controlOscillation",
      "lowDeltaTRootCause",
      "coolingTowerCapability",
      "chillerHealthCombination"
    ]
  );
  assert.equal(advisor.summary.pointCoverage.registerPoints, 1215);
  assert.equal(advisor.summary.pointCoverage.coolingTowerFanCount, 39);
  assert.equal(advisor.summary.pointCoverage.runningCoolingTowerFanCount, 24);
  assert.equal(advisor.summary.pointDictionary.applied, true);
  assert.equal(advisor.summary.pointDictionary.source, "test_operational_dictionary");
  const readinessMatrix = advisor.summary.diagnosticReadinessMatrix;
  assert.equal(readinessMatrix.controlBoundary, "read_only_or_shadow_only");
  assert.equal(readinessMatrix.items.length, 10);
  assert.equal(
    readinessMatrix.items.find((item) => item.key === "instrumentDataQuality").currentFeasibility,
    "can_do_v1"
  );
  assert.equal(
    readinessMatrix.items.find((item) => item.key === "pumpEfficiency").currentFeasibility,
    "directional_review"
  );
  assert.match(
    readinessMatrix.items.find((item) => item.key === "pumpEfficiency").boundary,
    /不能输出水泵效率百分比/
  );
  assert.equal(
    readinessMatrix.items.find((item) => item.key === "terminalComfortProtection").currentFeasibility,
    "point_gap"
  );
  assert.equal(readinessMatrix.items.find((item) => item.key === "terminalComfortProtection").allowedMode, "point_plan");
  assert.match(readinessMatrix.boundaryNotes.join(" | "), /不新增真实 PLC 下发/);
  const fieldChecklist = advisor.summary.fieldVerificationChecklist;
  assert.equal(fieldChecklist.controlBoundary, "read_only_point_verification_only");
  assert.equal(fieldChecklist.p0Count, 4);
  assert.equal(fieldChecklist.p1Count, 3);
  assert.deepEqual(
    fieldChecklist.items.slice(0, 4).map((item) => item.priority),
    ["P0", "P0", "P0", "P0"]
  );
  assert.ok(fieldChecklist.items.some((item) => item.key === "sensor-calibration-installation-ledger"));
  assert.ok(fieldChecklist.items.some((item) => item.key === "terminal-safety-signal-closure"));
  assert.ok(fieldChecklist.items.some((item) => item.key === "control-command-feedback-event-window"));
  assert.match(
    fieldChecklist.items.find((item) => item.key === "plc-pump-protection-mapping").boundary,
    /不允许 assisted\/enforced/
  );
  assert.match(
    fieldChecklist.items.find((item) => item.key === "chiller-combination-sampling-plan").boundary,
    /不拆单台 COP/
  );
  const fieldCollection = advisor.summary.fieldCollectionPackageEvidence;
  assert.equal(fieldCollection.status, "ready_to_collect");
  assert.equal(fieldCollection.finalDecision, "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT");
  assert.equal(fieldCollection.readyToCollect, true);
  assert.equal(fieldCollection.formalInputCount, 4);
  assert.equal(fieldCollection.presentFormalInputCount, 0);
  assert.equal(fieldCollection.missingFormalInputCount, 4);
  assert.equal(fieldCollection.templateCount, 2);
  assert.match(fieldCollection.controlBoundary, /不写 PLC/);
  assert.match(
    advisor.items.find((item) => item.key === "chilledHydraulicBalance").warnings.join(" | "),
    /支路流量最大\/最小比/
  );
  assert.match(
    advisor.items.find((item) => item.key === "lowDeltaTRootCause").warnings.join(" | "),
    /冷冻水温差 4.3℃ 偏低/
  );
  assert.match(
    advisor.items.find((item) => item.key === "chillerHealthCombination").warnings.join(" | "),
    /不计算单机实时 COP/
  );
  const controlOscillation = advisor.items.find((item) => item.key === "controlOscillation");
  assert.equal(controlOscillation.current.gapCount, 5);
  assert.match(controlOscillation.current.reviewBoundary, /不自动改 PID/);
  assert.match(controlOscillation.current.reviewBoundary, /不自动启停设备/);
  assert.ok(
    response.sourceStatus.sources.some(
      (source) => source.key === "operationalDiagnosticsAdvisor" && source.reasonCode === "operational_diagnostics_ready"
        || source.key === "operationalDiagnosticsAdvisor" && source.reasonCode === "operational_diagnostics_partial"
    )
  );
});

test("buildOptimizeDraftResponse adds 24h instrument drift window to operational diagnostics", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
	      recommendations: baseRecommendations,
	      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
	      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow(),
      sensorLedgerPreflightReport: buildSensorLedgerPreflightReport(),
	      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const instrument = advisor.items.find((item) => item.key === "instrumentDataQuality");
  const copMetric = instrument.current.driftWindow.metrics.find((item) => item.metric === "currentCop");
  const driftEvidence = instrument.evidence.find((item) => item.key === "currentCopDriftPct");

  assert.equal(advisor.summary.historyWindow.status, "ready");
  assert.equal(advisor.summary.historyWindow.readyMetricCount, 4);
  assert.equal(advisor.summary.historyWindow.steadyState.status, "ready");
  assert.equal(advisor.summary.historyWindow.steadyState.basisMetric, "totalPowerKw");
  assert.equal(advisor.summary.historyWindow.steadyState.sampleCount, 6);
  assert.equal(instrument.current.driftWindow.status, "ready");
  assert.equal(instrument.current.driftWindow.steadyState.status, "ready");
  assert.equal(copMetric.sampleCount, 6);
  assert.equal(copMetric.windowBasis, "steady_state_window");
  assert.equal(copMetric.driftPct, -14.3);
  assert.equal(driftEvidence.value, -14.3);
  const copCandidate = instrument.current.driftCandidates.find((item) => item.key === "cop_steady_state_drift");
  assert.equal(copCandidate.status, "review");
  assert.equal(copCandidate.confidence, "medium");
  assert.match(copCandidate.boundary, /不判定仪表故障/);
  assert.equal(instrument.current.sensorLedgerEvidence.status, "ready");
  assert.equal(instrument.current.sensorLedgerEvidence.readyForReview, true);
  assert.equal(instrument.current.sensorLedgerEvidence.acceptedRows, 18);
  assert.match(instrument.current.sensorLedgerEvidence.controlBoundary, /不自动修正测点/);
  assert.equal(advisor.summary.instrumentDataQuality.sensorLedgerPreflightStatus, "ready");
  assert.equal(advisor.summary.instrumentDataQuality.sensorLedgerReadyForReview, true);
  assert.ok(
    instrument.current.crossChecks.some(
      (item) => item.key === "power_meter_closure" && item.status === "normal"
    )
  );
  assert.ok(
    instrument.current.fieldReviewTargets.some(
      (item) => item.key === "cooling-load-and-power-meter-review" && item.priority === "P0"
    )
  );
  assert.match(instrument.current.reviewBoundary, /不自动修正测点/);
  assert.match(instrument.warnings.join(" | "), /稳态窗口内冷站COP首末偏移 -14.3%/);
  assert.match(instrument.findings.join(" | "), /24h 趋势窗口状态 ready/);
  assert.match(instrument.findings.join(" | "), /仪表偏移 V1 形成 1 个待复核候选/);
  assert.match(advisor.disclaimers.join(" | "), /不直接判定仪表故障/);
});

test("buildOptimizeDraftResponse does not treat scenario load as metered cooling load for COP closure", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 1200,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.5,
          totalPowerKw: 2076.6,
          chillerPowerKw: 1735.2,
          chilledPumpPowerKw: 148.7,
          coolingPumpPowerKw: 121,
          coolingTowerPowerKw: 71.7,
          chilledDeltaT: 4.5,
          coolingDeltaT: 4.7,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow(),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const instrument = advisor.items.find((item) => item.key === "instrumentDataQuality");
  const copClosure = instrument.current.crossChecks.find((item) => item.key === "cop_closure");
  const chillerStaging = response.chillerStagingAdvisor;

  assert.equal(instrument.current.loadSource, "scenario");
  assert.equal(instrument.current.canUseLoadForCopClosure, false);
  assert.equal(instrument.current.calculatedCop, null);
  assert.equal(instrument.current.copDeltaPct, null);
  assert.equal(copClosure.status, "insufficient");
  assert.match(copClosure.evidence, /未声明为实测冷量/);
  assert.doesNotMatch(instrument.warnings.join(" | "), /-91/);
  assert.equal(
    instrument.current.driftCandidates.some((item) => item.key === "cop_closure_gap"),
    false
  );
  assert.match(instrument.findings.join(" | "), /未作为实测冷量参与 COP 闭合/);
  assert.equal(chillerStaging.current.requestLoadKw, 1200);
  assert.equal(chillerStaging.current.loadBasis, "derived_from_station_cop_and_power");
  assert.equal(chillerStaging.current.systemCoolingLoadKw, 13497.9);
  assert.equal(chillerStaging.current.stationCop, 6.5);
  assert.equal(chillerStaging.current.comboCop, 7.78);
  assert.notEqual(chillerStaging.current.comboCop, 0.69);
});

test("buildOptimizeDraftResponse downgrades instrument drift when no steady-state window exists", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        totalPowerKw: [1200, 2000, 1150, 2100, 1300, 2200]
      }),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const instrument = advisor.items.find((item) => item.key === "instrumentDataQuality");
  const copMetric = instrument.current.driftWindow.metrics.find((item) => item.metric === "currentCop");

  assert.equal(advisor.summary.historyWindow.status, "partial");
  assert.equal(advisor.summary.historyWindow.steadyState.status, "unstable");
  assert.equal(instrument.current.driftWindow.status, "partial");
  assert.equal(instrument.current.driftWindow.steadyState.status, "unstable");
  assert.equal(copMetric.windowBasis, "full_window_unstable");
  assert.equal(copMetric.driftPct, -14.3);
  const copCandidate = instrument.current.driftCandidates.find((item) => item.key === "cop_steady_state_drift");
  assert.equal(copCandidate.status, "insufficient");
  assert.equal(copCandidate.confidence, "low");
  assert.match(copCandidate.reason, /只能趋势审阅/);
  assert.ok(
    instrument.current.crossChecks.some(
      (item) => item.key === "trend_steady_state" && item.status === "review"
    )
  );
  assert.match(instrument.warnings.join(" | "), /未形成稳态窗口/);
  assert.doesNotMatch(instrument.warnings.join(" | "), /稳态窗口内冷站COP首末偏移/);
});

test("buildOptimizeDraftResponse flags persistent low chilled delta-T in hydraulic trend window", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.1,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        chilledDeltaT: [4.1, 4.0, 4.2, 4.1, 4.0, 4.2],
        totalPowerKw: [1880, 1890, 1900, 1905, 1910, 1900]
      }),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const hydraulic = advisor.items.find((item) => item.key === "chilledHydraulicBalance");
  const trendMean = hydraulic.evidence.find((item) => item.key === "trendChilledDeltaTMean");
  const lowPct = hydraulic.evidence.find((item) => item.key === "trendLowDeltaTPct");
  const persistentIndicator = hydraulic.current.riskIndicators.find((item) => item.key === "persistent_low_delta_t");
  const branchFlowIndicator = hydraulic.current.riskIndicators.find((item) => item.key === "branch_flow_imbalance");
  const bypassIndicator = hydraulic.current.riskIndicators.find((item) => item.key === "bypass_short_circuit");
  const terminalGapIndicator = hydraulic.current.riskIndicators.find((item) => item.key === "terminal_safety_gap");

  assert.equal(advisor.summary.hydraulicTrend.status, "ready");
  assert.equal(advisor.summary.hydraulicTrend.persistentLowDeltaT, true);
  assert.equal(hydraulic.current.trendWindow.status, "ready");
  assert.equal(hydraulic.current.trendWindow.persistentLowDeltaT, true);
  assert.equal(hydraulic.current.trendWindow.chilledDeltaT.mean, 4.1);
  assert.equal(hydraulic.current.trendWindow.chilledDeltaT.belowPct, 100);
  assert.equal(hydraulic.current.activeRiskCount, 2);
  assert.equal(hydraulic.current.gapCount, 1);
  assert.equal(persistentIndicator.status, "active");
  assert.match(persistentIndicator.boundary, /不自动降泵/);
  assert.equal(branchFlowIndicator.status, "active");
  assert.equal(bypassIndicator.status, "normal");
  assert.equal(terminalGapIndicator.status, "gap");
  assert.match(terminalGapIndicator.boundary, /不允许 assisted\/enforced/);
  assert.ok(
    hydraulic.current.fieldReviewTargets.some(
      (item) => item.key === "terminal-safety-signal-closure" && item.priority === "P0"
    )
  );
  assert.ok(hydraulic.current.fieldReviewTargets.some((item) => item.key === "branch-hydraulic-history-window"));
  assert.match(hydraulic.current.reviewBoundary, /不自动降泵/);
  assert.match(hydraulic.current.reviewBoundary, /不直接判定末端阀门故障/);
  assert.equal(trendMean.value, 4.1);
  assert.equal(lowPct.value, 100);
  assert.equal(hydraulic.evidence.find((item) => item.key === "hydraulicActiveRiskCount").value, 2);
  assert.match(hydraulic.warnings.join(" | "), /低温差具备持续性/);
  assert.match(hydraulic.warnings.join(" | "), /缺支路流量\/压差\/旁通阀历史趋势/);
  assert.match(hydraulic.findings.join(" | "), /水力平衡 V1 形成 2 个风险指示/);
  assert.match(hydraulic.suggestions.join(" | "), /泵降频 shadow 验证/);
});

test("buildOptimizeDraftResponse flags control oscillation trends without implying PID or start-stop control", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        chilledDeltaT: [4.2, 5.2, 4.1, 5.3, 4.0, 5.4],
        coolingDeltaT: [4.5, 5.2, 4.4, 5.3, 4.3, 5.4],
        totalPowerKw: [1880, 2010, 1860, 2020, 1850, 2030]
      }),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const control = advisor.items.find((item) => item.key === "controlOscillation");
  const chilledSawtooth = control.current.riskIndicators.find((item) => item.key === "chilled_delta_t_sawtooth");
  const coolingSawtooth = control.current.riskIndicators.find((item) => item.key === "cooling_delta_t_sawtooth");
  const powerHunting = control.current.riskIndicators.find((item) => item.key === "station_power_hunting");
  const frequencyGap = control.current.riskIndicators.find((item) => item.key === "frequency_command_feedback_gap");
  const startStopGap = control.current.riskIndicators.find((item) => item.key === "start_stop_event_gap");

  assert.equal(control.status, "partial");
  assert.equal(control.current.activeRiskCount, 3);
  assert.equal(control.current.gapCount, 2);
  assert.equal(control.current.trendWindow.status, "active");
  assert.equal(control.current.trendWindow.maxDirectionChangeCount, 4);
  assert.equal(chilledSawtooth.status, "active");
  assert.equal(coolingSawtooth.status, "active");
  assert.equal(powerHunting.status, "active");
  assert.equal(frequencyGap.status, "gap");
  assert.equal(startStopGap.status, "gap");
  assert.match(frequencyGap.boundary, /不自动改 PID/);
  assert.match(startStopGap.boundary, /不自动启停设备/);
  assert.ok(
    control.current.fieldReviewTargets.some(
      (item) => item.key === "control-command-feedback-history-window" && item.priority === "P0"
    )
  );
  assert.ok(control.current.fieldReviewTargets.some((item) => item.key === "start-stop-event-ledger"));
  assert.match(control.current.reviewBoundary, /不自动改 PID/);
  assert.match(control.current.reviewBoundary, /不自动启停设备/);
  assert.equal(advisor.summary.controlOscillation.activeRiskCount, 3);
  assert.equal(advisor.summary.controlOscillation.gapCount, 2);
  assert.match(
    advisor.summary.diagnosticReadinessMatrix.items.find((item) => item.key === "controlOscillation").boundary,
    /不自动改 PID/
  );
});

test("buildOptimizeDraftResponse uses imported control ledgers as read-only oscillation evidence", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        chilledDeltaT: [4.2, 5.2, 4.1, 5.3, 4.0, 5.4],
        coolingDeltaT: [4.5, 5.2, 4.4, 5.3, 4.3, 5.4],
        totalPowerKw: [1880, 2010, 1860, 2020, 1850, 2030]
      }),
      controlLedgerImportReport: buildControlLedgerImportReport(),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const control = advisor.items.find((item) => item.key === "controlOscillation");
  const frequencyEvidence = control.current.riskIndicators.find((item) => item.key === "frequency_command_feedback_gap");
  const startStopEvidence = control.current.riskIndicators.find((item) => item.key === "start_stop_event_gap");
  const matrixItem = advisor.summary.diagnosticReadinessMatrix.items.find((item) => item.key === "controlOscillation");

  assert.equal(control.status, "ready");
  assert.equal(control.confidence, "medium");
  assert.equal(control.current.gapCount, 0);
  assert.equal(control.current.watchRiskCount, 2);
  assert.equal(control.current.ledgerEvidence.status, "ready");
  assert.equal(control.current.ledgerEvidence.evidenceMode, "field_export");
  assert.equal(control.current.ledgerEvidence.usableForDiagnosis, true);
  assert.equal(control.current.ledgerEvidence.acceptedRows, 126);
  assert.equal(advisor.summary.controlOscillation.ledgerEvidenceStatus, "ready");
  assert.equal(advisor.summary.controlOscillation.ledgerAcceptedRows, 126);
  assert.equal(advisor.summary.controlOscillation.ledgerUsableForDiagnosis, true);
  assert.equal(frequencyEvidence.status, "watch");
  assert.equal(frequencyEvidence.value, 90);
  assert.match(frequencyEvidence.reason, /现场命令\/反馈高频台账/);
  assert.equal(startStopEvidence.status, "watch");
  assert.equal(startStopEvidence.value, 24);
  assert.match(startStopEvidence.reason, /现场启停事件台账/);
  assert.match(control.current.reviewBoundary, /不自动改 PID/);
  assert.match(control.current.reviewBoundary, /不自动启停设备/);
  assert.match(control.warnings.join(" | "), /仍不自动改 PID 或启停/);
  assert.match(matrixItem.availableData.join(" | "), /控制台账导入 READY，126 行现场证据/);
  assert.match(matrixItem.missingData.join(" | "), /人工对齐负荷扰动/);
  assert.match(matrixItem.boundary, /不自动改 PID/);
});

test("buildOptimizeDraftResponse keeps field-data preflight separate from formal ledger evidence", async () => {
  const templateTables = buildControlLedgerImportReport().tables.map((table) => ({
    ...table,
    inputMode: "template_sample",
    rowCount: table.key === "control_command_feedback_trend" ? 3 : table.key === "start_stop_event_ledger" ? 2 : 3,
    acceptedRowCount: table.key === "control_command_feedback_trend" ? 3 : table.key === "start_stop_event_ledger" ? 2 : 3
  }));
  const response = await buildOptimizeDraftResponse(
    baseConfig,
    "140",
    wetBulbRequest,
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.3,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2
        }
      },
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        chilledDeltaT: [4.2, 5.2, 4.1, 5.3, 4.0, 5.4],
        totalPowerKw: [1880, 2010, 1860, 2020, 1850, 2030]
      }),
      controlLedgerImportReport: buildControlLedgerImportReport({
        status: "CONTROL_LEDGER_IMPORT_PARTIAL",
        summary: {
          totalRows: 8,
          acceptedRows: 8,
          warningsCount: 3
        },
        tables: templateTables
      }),
      fieldDataPreflightReport: buildFieldDataPreflightReport(),
      fieldDataPromoteReport: buildFieldDataPromoteReport()
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  const control = advisor.items.find((item) => item.key === "controlOscillation");
  const frequencyEvidence = control.current.riskIndicators.find((item) => item.key === "frequency_command_feedback_gap");

  assert.equal(control.current.ledgerEvidence.status, "partial");
  assert.equal(control.current.ledgerEvidence.evidenceMode, "template_sample");
  assert.equal(control.current.ledgerEvidence.usableForDiagnosis, false);
  assert.equal(control.current.ledgerEvidence.preflight.status, "ready");
  assert.equal(control.current.ledgerEvidence.preflight.readyForImport, true);
  assert.equal(control.current.ledgerEvidence.preflight.acceptedRows, 9);
  assert.equal(control.current.ledgerEvidence.promotion.status, "ready");
  assert.equal(control.current.ledgerEvidence.promotion.formalImportReady, true);
  assert.equal(control.current.ledgerEvidence.promotion.acceptedRows, 9);
  assert.equal(advisor.summary.controlOscillation.ledgerUsableForDiagnosis, false);
  assert.equal(advisor.summary.controlOscillation.fieldDataPreflightStatus, "ready");
  assert.equal(advisor.summary.controlOscillation.fieldDataPreflightReadyForImport, true);
  assert.equal(advisor.summary.controlOscillation.fieldDataPromoteStatus, "ready");
  assert.equal(advisor.summary.controlOscillation.fieldDataPromoteFormalImportReady, true);
  assert.equal(frequencyEvidence.status, "gap");
  assert.match(control.warnings.join(" | "), /尚未正式导入 latest/);
});

test("buildOptimizeDraftResponse links persistent low delta-T to root-cause candidates", async () => {
  const response = await buildOptimizeDraftResponse(
    {
      ...baseConfig,
      chillerStaging: {
        currentRunMinutes: 120,
        chillers: [
          { id: "CH4", ratedCapacityKw: 3868.5, runMinutes: 180 },
          { id: "CH5", ratedCapacityKw: 4571.9, runMinutes: 180 },
          { id: "CH7", ratedCapacityKw: 5275.3, runMinutes: 180 }
        ],
        candidateCombinations: [["CH4", "CH5", "CH7"]]
      }
    },
    "140",
    {
      loadKw: 12861,
      outdoorTempC: 24.9,
      mode: "cooling"
    },
    {
      now: new Date("2026-06-10T12:00:00+08:00"),
      overview: {
        ...baseOverview,
        energyCards: {
          ...baseOverview.energyCards,
          currentCop: 6.7,
          totalPowerKw: 1889.5,
          chilledDeltaT: 4.1,
          coolingDeltaT: 4.7,
          chillerPowerKw: 1563.8,
          chilledPumpPowerKw: 148,
          coolingPumpPowerKw: 94.5,
          coolingTowerPowerKw: 83.2,
          chilledSupplyTemp: 8.6,
          coolingReturnTemp: 28,
          outdoorWetBulbC: 24.9
        }
      },
      anomalies: {
        ...baseAnomalies,
        counts: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0
        }
      },
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      operationalDiagnosticsHistoryWindow: buildOperationalTrendWindow({
        chilledDeltaT: [4.1, 4.0, 4.2, 4.1, 4.0, 4.2],
        totalPowerKw: [1880, 1890, 1900, 1905, 1910, 1900]
      }),
      chillerStagingRuntimeContext: {
        equipmentContext: {
          activeChillerIds: ["CH4", "CH5", "CH7"]
        },
        currentCombination: ["CH4", "CH5", "CH7"],
        pointSummary: buildOperationalPointSummary(),
        sourceStatus: {
          overall: "ok",
          sources: [{ key: "chillerStagingRuntime", ok: true, rows: 184 }]
        }
      }
    }
  );

  const lowDelta = response.operationalDiagnosticsAdvisor.items.find((item) => item.key === "lowDeltaTRootCause");
  const linkage = lowDelta.current.trendLinkage;
  const activeCandidateKeys = linkage.candidates
    .filter((item) => item.status === "active")
    .map((item) => item.key);

  assert.equal(response.operationalDiagnosticsAdvisor.summary.lowDeltaTRootCause.status, "active");
  assert.equal(response.operationalDiagnosticsAdvisor.summary.lowDeltaTRootCause.persistentLowDeltaT, true);
  assert.equal(response.operationalDiagnosticsAdvisor.summary.lowDeltaTRootCause.topCandidate, "overPumping");
  assert.equal(linkage.status, "active");
  assert.equal(linkage.persistentLowDeltaT, true);
  assert.equal(linkage.trendDataBoundary.pumpFrequencyHistoryAvailable, false);
  assert.equal(linkage.candidates[0].key, "overPumping");
  assert.ok(activeCandidateKeys.includes("persistentLowDeltaT"));
  assert.ok(activeCandidateKeys.includes("overPumping"));
  assert.ok(activeCandidateKeys.includes("hydraulicDistribution"));
  assert.match(lowDelta.warnings.join(" | "), /趋势已证明冷冻侧低温差具备持续性/);
  assert.match(lowDelta.warnings.join(" | "), /低温差根因候选/);
  assert.match(lowDelta.findings.join(" | "), /当前根因首位：大流量小温差/);
});

test("buildOptimizeDraftResponse degrades operational diagnostics when runtime point summary is missing", async () => {
  const response = await buildOptimizeDraftResponse(
    buildChillerStagingConfig(),
    "btwentyfive",
    chillerStagingRequest,
    {
      now: new Date("2026-04-15T12:00:00+08:00"),
      overview: buildChillerStagingOverview(),
      anomalies: baseAnomalies,
      recommendations: baseRecommendations,
      historyBenchmarkReports: buildReadyHistoryBenchmarkReports(),
      chillerCombinationHistory: buildChillerCombinationHistory()
    }
  );

  const advisor = response.operationalDiagnosticsAdvisor;
  assert.equal(advisor.status, "partial");
  assert.equal(advisor.executionMode, "read_only");
  assert.equal(advisor.items.length, 6);
  assert.equal(advisor.items.find((item) => item.key === "instrumentDataQuality").status, "unavailable");
  assert.match(
    advisor.items.find((item) => item.key === "instrumentDataQuality").blockers.join(" | "),
    /缺实时寄存器摘要/
  );
  assert.equal(advisor.items.find((item) => item.key === "lowDeltaTRootCause").status, "ready");
  assert.equal(advisor.items.find((item) => item.key === "controlOscillation").status, "unavailable");
  assert.match(advisor.disclaimers.join(" | "), /不新增真实 PLC 下发能力/);
  assert.match(advisor.disclaimers.join(" | "), /不自动改 PID/);
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
