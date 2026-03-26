#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {
    input: "/tmp/chiller_probe.json",
    output: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      options.input = argv[++i];
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      options.output = argv[++i];
      continue;
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidIso(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushFailure(target, id, pathName, reason) {
  target.push({
    id,
    path: pathName,
    reason
  });
}

function evaluateNdFields(probe) {
  const failures = [];

  const overview = probe?.overview || {};
  const trends = probe?.trends || {};
  const anomalies = probe?.anomalies || {};
  const recommendations = probe?.recommendations || {};

  const sourceOverallChecks = [
    ["ND-001", "overview.sourceStatus.overall", overview?.sourceStatus?.overall],
    ["ND-002", "trends.sourceStatus.overall", trends?.sourceStatus?.overall],
    ["ND-003", "anomalies.sourceStatus.overall", anomalies?.sourceStatus?.overall],
    ["ND-004", "recommendations.sourceStatus.overall", recommendations?.sourceStatus?.overall]
  ];

  for (const [id, p, value] of sourceOverallChecks) {
    if (value !== "ok") {
      pushFailure(failures, id, p, `expected "ok", got "${String(value)}"`);
    }
  }

  const sourceLists = [
    ["overview", asArray(overview?.sourceStatus?.sources)],
    ["trends", asArray(trends?.sourceStatus?.sources)],
    ["anomalies", asArray(anomalies?.sourceStatus?.sources)],
    ["recommendations", asArray(recommendations?.sourceStatus?.sources)]
  ];
  for (const [moduleName, list] of sourceLists) {
    if (list.length < 1) {
      pushFailure(
        failures,
        "ND-005",
        `${moduleName}.sourceStatus.sources`,
        "expected non-empty sources array"
      );
    }
    list.forEach((item, index) => {
      if (!item?.key || typeof item.key !== "string") {
        pushFailure(
          failures,
          "ND-006",
          `${moduleName}.sourceStatus.sources[${index}].key`,
          "missing or invalid key"
        );
      }
    });
  }

  const requiredRecommendationKeys = [
    "rules",
    "dashboardOverview",
    "anomalySummary",
    "ruleMetrics",
    "metric.chilled_delta_t_c",
    "metric.cooling_delta_t_c",
    "metric.station_cop",
    "metric.station_total_power_kw"
  ];
  const recSources = asArray(recommendations?.sourceStatus?.sources);
  const recSourceMap = new Map(recSources.map((item) => [item?.key, item]));
  for (const key of requiredRecommendationKeys) {
    if (!recSourceMap.has(key)) {
      pushFailure(
        failures,
        "ND-007",
        "recommendations.sourceStatus.sources[*].key",
        `missing required key: ${key}`
      );
      continue;
    }
    const item = recSourceMap.get(key);
    if (item?.ok !== true) {
      pushFailure(
        failures,
        "ND-008",
        `recommendations.sourceStatus.sources[key=${key}].ok`,
        `expected true, got ${String(item?.ok)}`
      );
    }
    const status = item?.status;
    const statusOk = status == null || (isFiniteNumber(status) && status < 500);
    if (!statusOk || item?.ok === false) {
      pushFailure(
        failures,
        "ND-009",
        `recommendations.sourceStatus.sources[key=${key}].status`,
        `status/ok not healthy: status=${String(status)}, ok=${String(item?.ok)}`
      );
    }
  }

  const freshnessChecks = [
    ["ND-010", "overview.freshness.latestTimestamp", overview?.freshness?.latestTimestamp],
    ["ND-011", "trends.freshness.latestTimestamp", trends?.freshness?.latestTimestamp],
    ["ND-012", "anomalies.freshness.latestTimestamp", anomalies?.freshness?.latestTimestamp]
  ];
  for (const [id, p, value] of freshnessChecks) {
    if (!isValidIso(value)) {
      pushFailure(failures, id, p, "missing or invalid ISO timestamp");
    }
  }

  const staleChecks = [
    ["ND-013", "overview.freshness.stale", overview?.freshness?.stale],
    ["ND-014", "trends.freshness.stale", trends?.freshness?.stale],
    ["ND-015", "anomalies.freshness.stale", anomalies?.freshness?.stale]
  ];
  for (const [id, p, value] of staleChecks) {
    if (value !== false) {
      pushFailure(failures, id, p, `expected false, got ${String(value)}`);
    }
  }

  const ageChecks = [
    ["ND-016", "overview.freshness.ageHours", overview?.freshness?.ageHours],
    ["ND-017", "trends.freshness.ageHours", trends?.freshness?.ageHours],
    ["ND-018", "anomalies.freshness.ageHours", anomalies?.freshness?.ageHours]
  ];
  for (const [id, p, value] of ageChecks) {
    if (!isFiniteNumber(value) || value < 0 || value > 24) {
      pushFailure(failures, id, p, `ageHours out of range: ${String(value)}`);
    }
  }

  const trendSeries = asArray(trends?.series);
  if (trendSeries.length < 3) {
    pushFailure(failures, "ND-019", "trends.series", `expected >=3, got ${trendSeries.length}`);
  }

  const requiredTrendMetrics = ["totalPowerKw", "currentCop", "chilledDeltaT"];
  const trendMetricMap = new Map(trendSeries.map((series) => [series?.metric, series]));
  for (const metric of requiredTrendMetrics) {
    const item = trendMetricMap.get(metric);
    if (!item) {
      pushFailure(
        failures,
        "ND-020",
        "trends.series[*].metric",
        `missing required metric: ${metric}`
      );
      continue;
    }
    const points = asArray(item?.points);
    if (points.length < 1) {
      pushFailure(
        failures,
        "ND-021",
        `trends.series[metric=${metric}].points`,
        "expected at least 1 point"
      );
    }
    let validTs = false;
    let validValue = false;
    points.forEach((point, index) => {
      if (!isValidIso(point?.t)) {
        pushFailure(
          failures,
          "ND-022",
          `trends.series[metric=${metric}].points[${index}].t`,
          `invalid timestamp: ${String(point?.t)}`
        );
      } else {
        validTs = true;
      }
      if (point?.v === null || point?.v === undefined) {
        return;
      }
      if (!isFiniteNumber(point?.v)) {
        pushFailure(
          failures,
          "ND-023",
          `trends.series[metric=${metric}].points[${index}].v`,
          `invalid numeric value: ${String(point?.v)}`
        );
      } else {
        validValue = true;
      }
    });
    if (!validTs) {
      pushFailure(
        failures,
        "ND-022",
        `trends.series[metric=${metric}].points[*].t`,
        "no valid timestamp points"
      );
    }
    if (!validValue) {
      pushFailure(
        failures,
        "ND-023",
        `trends.series[metric=${metric}].points[*].v`,
        "no finite numeric values"
      );
    }
  }

  const ruleEval = recommendations?.ruleEvaluation || {};
  if (ruleEval?.rulesLoaded !== true) {
    pushFailure(
      failures,
      "ND-024",
      "recommendations.ruleEvaluation.rulesLoaded",
      `expected true, got ${String(ruleEval?.rulesLoaded)}`
    );
  }
  if (ruleEval?.error != null) {
    pushFailure(
      failures,
      "ND-025",
      "recommendations.ruleEvaluation.error",
      `expected null, got ${String(ruleEval?.error)}`
    );
  }
  if (!Number.isInteger(ruleEval?.totalEnabledRules) || ruleEval.totalEnabledRules < 1) {
    pushFailure(
      failures,
      "ND-026",
      "recommendations.ruleEvaluation.totalEnabledRules",
      `expected integer >=1, got ${String(ruleEval?.totalEnabledRules)}`
    );
  }
  const skippedIds = asArray(ruleEval?.skippedRuleIds);
  if (skippedIds.length > 0) {
    pushFailure(
      failures,
      "ND-027",
      "recommendations.ruleEvaluation.skippedRuleIds",
      `expected empty, got length=${skippedIds.length}`
    );
  }
  const skippedDetails = asArray(ruleEval?.skippedRuleDetails);
  if (skippedDetails.length > 0) {
    pushFailure(
      failures,
      "ND-028",
      "recommendations.ruleEvaluation.skippedRuleDetails",
      `expected empty, got length=${skippedDetails.length}`
    );
  }

  const allowedCategories = new Set([
    "upstream_unreachable",
    "field_missing_or_invalid",
    "unknown"
  ]);
  skippedDetails.forEach((detail, detailIndex) => {
    asArray(detail?.missingMetrics).forEach((metric, metricIndex) => {
      if (!allowedCategories.has(metric?.category)) {
        pushFailure(
          failures,
          "ND-029",
          `recommendations.ruleEvaluation.skippedRuleDetails[${detailIndex}].missingMetrics[${metricIndex}].category`,
          `unexpected category: ${String(metric?.category)}`
        );
      }
    });
  });

  return failures;
}

function evaluateM123(probe) {
  const sourceOverallList = [
    probe?.overview?.sourceStatus?.overall,
    probe?.trends?.sourceStatus?.overall,
    probe?.anomalies?.sourceStatus?.overall,
    probe?.recommendations?.sourceStatus?.overall
  ];
  const dashboardM1FailedCount = sourceOverallList.filter((value) => value !== "ok").length;
  const dashboardM1 = {
    value: `${dashboardM1FailedCount}/4`,
    threshold: "<=0/4",
    pass: dashboardM1FailedCount === 0
  };

  const dashboardM2Stale = [
    probe?.overview?.freshness?.stale,
    probe?.trends?.freshness?.stale,
    probe?.anomalies?.freshness?.stale
  ].some((value) => value === true);
  const dashboardM2 = {
    value: dashboardM2Stale ? 1 : 0,
    threshold: "0",
    pass: !dashboardM2Stale
  };

  const requiredMetrics = ["totalPowerKw", "currentCop", "chilledDeltaT"];
  const trends = asArray(probe?.trends?.series);
  const metricPoints = requiredMetrics.map((metric) => {
    const item = trends.find((series) => series?.metric === metric);
    const points = asArray(item?.points);
    const validPointCount = points.filter(
      (point) => isValidIso(point?.t) && isFiniteNumber(point?.v)
    ).length;
    return {
      metric,
      validPointCount,
      pass: validPointCount >= 1
    };
  });
  const passedMetrics = metricPoints.filter((item) => item.pass).length;
  const nonEmptySeries = metricPoints.filter((item) => item.validPointCount >= 1).length;
  const rate = requiredMetrics.length ? passedMetrics / requiredMetrics.length : 0;
  const dashboardM3 = {
    value: `${passedMetrics}/${requiredMetrics.length} (${(rate * 100).toFixed(1)}%)`,
    threshold: ">=80% and non_empty_series>=2",
    pass: rate >= 0.8 && nonEmptySeries >= 2,
    detail: {
      nonEmptySeries,
      metrics: metricPoints
    }
  };

  const topologyOverall = probe?.topology?.sourceStatus?.overall;
  const systemM1FailedCount = topologyOverall === "ok" ? 0 : 1;
  const systemM1 = {
    value: `${systemM1FailedCount}/1`,
    threshold: "<=0/1",
    pass: systemM1FailedCount === 0
  };
  const systemM2 = {
    value: dashboardM2.value,
    threshold: "0",
    pass: dashboardM2.pass
  };
  const systemM3 = {
    value: dashboardM3.value,
    threshold: ">=80% (chain proxy)",
    pass: dashboardM3.pass,
    detail: dashboardM3.detail
  };

  return {
    dashboard: {
      M1: dashboardM1,
      M2: dashboardM2,
      M3: dashboardM3,
      pass: dashboardM1.pass && dashboardM2.pass && dashboardM3.pass
    },
    systemOverview: {
      M1: systemM1,
      M2: systemM2,
      M3: systemM3,
      pass: systemM1.pass && systemM2.pass && systemM3.pass
    }
  };
}

function inferFailureAttribution(ndFailures) {
  if (ndFailures.length === 0) {
    return "none";
  }
  const upstreamHints = [
    "sourceStatus",
    "freshness",
    "trends.series",
    "ruleEvaluation"
  ];
  const hasUpstream = ndFailures.some((item) =>
    upstreamHints.some((hint) => item.path.includes(hint))
  );
  return hasUpstream ? "upstream_interface" : "frontend_presentation";
}

function writeIfNeeded(filePath, data) {
  if (!filePath) {
    return;
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const options = parseArgs(process.argv);
  const probe = readJson(options.input);
  const ndFailures = evaluateNdFields(probe);
  const m123 = evaluateM123(probe);
  const report = {
    generatedAt: new Date().toISOString(),
    input: options.input,
    nonDegradedReady: ndFailures.length === 0,
    attribution: inferFailureAttribution(ndFailures),
    nd: {
      failedCount: ndFailures.length,
      failures: ndFailures
    },
    m123
  };

  writeIfNeeded(options.output, report);

  const lines = [];
  lines.push(`Readiness: ${report.nonDegradedReady ? "PASS" : "FAIL"}`);
  lines.push(`Attribution: ${report.attribution}`);
  lines.push(
    `Dashboard => M1 ${m123.dashboard.M1.value} (${m123.dashboard.M1.pass ? "PASS" : "FAIL"}), M2 ${m123.dashboard.M2.value} (${m123.dashboard.M2.pass ? "PASS" : "FAIL"}), M3 ${m123.dashboard.M3.value} (${m123.dashboard.M3.pass ? "PASS" : "FAIL"})`
  );
  lines.push(
    `SystemOverview => M1 ${m123.systemOverview.M1.value} (${m123.systemOverview.M1.pass ? "PASS" : "FAIL"}), M2 ${m123.systemOverview.M2.value} (${m123.systemOverview.M2.pass ? "PASS" : "FAIL"}), M3 ${m123.systemOverview.M3.value} (${m123.systemOverview.M3.pass ? "PASS" : "FAIL"})`
  );
  lines.push(`ND failed: ${report.nd.failedCount}`);
  if (report.nd.failedCount > 0) {
    const preview = report.nd.failures.slice(0, 6);
    preview.forEach((item) => lines.push(`- ${item.id} ${item.path}: ${item.reason}`));
    if (report.nd.failedCount > preview.length) {
      lines.push(`- ... ${report.nd.failedCount - preview.length} more`);
    }
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

main();

