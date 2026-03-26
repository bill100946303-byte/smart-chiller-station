import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const OPENAPI_FILE = path.resolve(process.cwd(), "openapi/bff-v1.yaml");
const CONTRACT_PATHS = [
  "/bff/v1/sites/{siteId}/dashboard/overview",
  "/bff/v1/sites/{siteId}/dashboard/trends",
  "/bff/v1/sites/{siteId}/anomalies/summary",
  "/bff/v1/sites/{siteId}/anomalies/list",
  "/bff/v1/sites/{siteId}/devices/list",
  "/bff/v1/sites/{siteId}/devices/tree",
  "/bff/v1/sites/{siteId}/devices/{deviceId}",
  "/bff/v1/sites/{siteId}/system/topology",
  "/bff/v1/sites/{siteId}/system/diagram",
  "/bff/v1/sites/{siteId}/recommendations"
];

function loadOpenApi() {
  const text = fs.readFileSync(OPENAPI_FILE, "utf8");
  return yaml.load(text);
}

function resolveRef(doc, ref) {
  if (!ref || !ref.startsWith("#/")) {
    throw new Error(`Unsupported ref: ${ref}`);
  }
  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = doc;
  for (const segment of segments) {
    current = current?.[segment];
    if (current === undefined) {
      throw new Error(`Unresolved ref: ${ref}`);
    }
  }
  return current;
}

function mergeAllOf(doc, schema) {
  if (!Array.isArray(schema?.allOf)) {
    return schema;
  }
  const merged = {};
  for (const item of schema.allOf) {
    const resolved = normalizeSchema(doc, item);
    Object.assign(merged, resolved);
    if (resolved?.properties) {
      merged.properties = { ...(merged.properties || {}), ...resolved.properties };
    }
    if (Array.isArray(resolved?.required)) {
      merged.required = Array.from(new Set([...(merged.required || []), ...resolved.required]));
    }
  }
  return merged;
}

function normalizeSchema(doc, schema) {
  if (!schema) {
    return {};
  }
  if (schema.$ref) {
    const resolved = normalizeSchema(doc, resolveRef(doc, schema.$ref));
    const { $ref, ...localOverrides } = schema;
    return {
      ...resolved,
      ...localOverrides,
      properties: localOverrides.properties
        ? { ...(resolved.properties || {}), ...localOverrides.properties }
        : resolved.properties,
      required:
        Array.isArray(resolved.required) || Array.isArray(localOverrides.required)
          ? Array.from(new Set([...(resolved.required || []), ...(localOverrides.required || [])]))
          : resolved.required
    };
  }
  if (schema.allOf) {
    return mergeAllOf(doc, schema);
  }
  return schema;
}

function assertType(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return true;
  }
}

function validateValue(doc, schemaInput, value, atPath, errors) {
  const schema = normalizeSchema(doc, schemaInput);
  if (!schema || Object.keys(schema).length === 0) {
    return;
  }

  if (value === null) {
    if (schema.nullable) {
      return;
    }
    errors.push(`${atPath}: value is null but schema is not nullable`);
    return;
  }

  if (schema.type && !assertType(schema.type, value)) {
    errors.push(`${atPath}: expected type ${schema.type}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${atPath}: value "${String(value)}" not in enum`);
  }

  if (typeof schema.pattern === "string" && typeof value === "string") {
    let regex = null;
    try {
      regex = new RegExp(schema.pattern);
    } catch (error) {
      errors.push(`${atPath}: invalid regex pattern "${schema.pattern}"`);
    }
    if (regex && !regex.test(value)) {
      errors.push(`${atPath}: value "${value}" does not match pattern ${schema.pattern}`);
    }
  }

  if (schema.type === "object") {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${atPath}: missing required key "${key}"`);
      }
    }
    const properties = schema.properties || {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        validateValue(doc, childSchema, value[key], `${atPath}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${atPath}: unexpected key "${key}"`);
        }
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${atPath}: expected at least ${schema.minItems} items`);
    }
    for (let i = 0; i < value.length; i += 1) {
      validateValue(doc, schema.items || {}, value[i], `${atPath}[${i}]`, errors);
    }
  }
}

function collectExamples(doc) {
  const list = [];
  for (const pathName of CONTRACT_PATHS) {
    const op = doc?.paths?.[pathName]?.get;
    const schema = op?.responses?.["200"]?.content?.["application/json"]?.schema;
    const externalValue =
      op?.responses?.["200"]?.content?.["application/json"]?.examples?.default?.externalValue;

    if (!schema) {
      throw new Error(`Missing 200 schema for ${pathName}`);
    }
    if (!externalValue) {
      throw new Error(`Missing externalValue example for ${pathName}`);
    }
    list.push({
      pathName,
      schema,
      exampleFile: path.resolve(path.dirname(OPENAPI_FILE), externalValue)
    });
  }
  return list;
}

function collectSupplementalExamples(doc) {
  const degradedDevicesTreeSchema =
    doc?.paths?.["/bff/v1/sites/{siteId}/devices/tree"]?.get?.responses?.["200"]?.content?.[
      "application/json"
    ]?.schema;
  const degradedDevicesTreeFile = path.resolve(
    path.dirname(OPENAPI_FILE),
    "./examples/devices-tree-degraded.json"
  );

  const list = [];
  if (degradedDevicesTreeSchema && fs.existsSync(degradedDevicesTreeFile)) {
    list.push({
      pathName: "/bff/v1/sites/{siteId}/devices/tree#degraded",
      schema: degradedDevicesTreeSchema,
      exampleFile: degradedDevicesTreeFile
    });
  }
  return list;
}

const RECOMMENDATIONS_PATH = "/bff/v1/sites/{siteId}/recommendations";
const TRENDS_PATH = "/bff/v1/sites/{siteId}/dashboard/trends";
const OVERVIEW_PATH = "/bff/v1/sites/{siteId}/dashboard/overview";
const ANOMALIES_LIST_PATH = "/bff/v1/sites/{siteId}/anomalies/list";
const SYSTEM_DIAGRAM_PATH = "/bff/v1/sites/{siteId}/system/diagram";
const SOURCE_STATUS_SUMMARY_CASES_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/source-status-summary-cases.json"
);
const SOURCE_KEY_SCAN_REPORT_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/source-key-scan-report.json"
);
const REAL_LINK_READY_SAMPLE_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/real-link-ready-sample.json"
);
const REAL_LINK_READY_PROBE_REPORT_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/real-link-ready-probe-report.json"
);
const RUNPARAMS_500_FALLBACK_SAMPLE_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/dashboard-trends-runparams-500-fallback-ok.json"
);
const RECOMMENDATIONS_STATION_COP_MISSING_SAMPLE_FILE = path.resolve(
  process.cwd(),
  "openapi/examples/recommendations-station-cop-missing.json"
);
const SOURCE_STATUS_LOCALIZATION_PATHS = [
  "/bff/v1/sites/{siteId}/dashboard/overview",
  "/bff/v1/sites/{siteId}/dashboard/trends",
  "/bff/v1/sites/{siteId}/anomalies/summary",
  "/bff/v1/sites/{siteId}/recommendations"
];
const REQUIRED_METRIC_SOURCE_KEYS = [
  "metric.chilled_delta_t_c",
  "metric.cooling_delta_t_c",
  "metric.station_cop",
  "metric.station_total_power_kw"
];
const ALLOWED_STATIC_SOURCE_KEYS = new Set([
  "energy",
  "devices",
  "alarms",
  "alarmDiagnosis",
  "energyCurve",
  "runParams",
  "trendBaseline",
  "trendQuality",
  "subsystemSummary",
  "latestAlarmLog",
  "alarmSeveritySplit",
  "rules",
  "dashboardOverview",
  "anomalySummary",
  "ruleMetrics"
]);
const METRIC_SOURCE_KEY_BASELINE = new Set(REQUIRED_METRIC_SOURCE_KEYS);
const ALLOWED_MISSING_METRIC_CATEGORIES = new Set([
  "upstream_unreachable",
  "field_missing_or_invalid",
  "unknown"
]);
const REQUIRED_TREND_SOURCE_KEYS = ["energyCurve", "runParams"];
const HOME_ENERGY_FALLBACK_TRIGGER = "homeEnergyEfficiency";
const HOME_ENERGY_FALLBACK_REQUIRED_FIELDS = [
  "currentCop",
  "totalPowerKw",
  "chilledDeltaT",
  "coolingDeltaT"
];
const DEFAULT_RUNTIME_PROBE_BASE_URL = process.env.RUNTIME_PROBE_BASE_URL || "http://127.0.0.1:8787";
const DEFAULT_RUNTIME_PROBE_SITE_ID = process.env.SITE_ID || "126lnoffice";
const DEFAULT_RUNTIME_PROBE_TIMEOUT_MS = Number.parseInt(
  process.env.RUNTIME_PROBE_TIMEOUT_MS || "1500",
  10
);
const RUNTIME_PROBE_ENABLED = process.env.RUNTIME_PROBE !== "0";

function pushRecommendationsError(errors, jsonPath, message) {
  errors.push(`${RECOMMENDATIONS_PATH}.${jsonPath}: ${message}`);
}

function pushSourceStatusError(errors, pathName, jsonPath, message) {
  errors.push(`${pathName}.${jsonPath}: ${message}`);
}

function pushSourceStatusCasesError(errors, jsonPath, message) {
  errors.push(`source-status-summary-cases.${jsonPath}: ${message}`);
}

function pushSourceKeyWarning(warnings, pathName, jsonPath, message) {
  warnings.push(`${pathName}.${jsonPath}: ${message}`);
}

function pushI18nNotice(notices, message) {
  notices.push(`I18N_ASSERTION: ${message}`);
}

function addExamplePath(examplePaths, key, value) {
  const current = examplePaths[key] || [];
  if (!current.includes(value)) {
    current.push(value);
  }
  examplePaths[key] = current;
}

function newRealLinkGroupedFailures() {
  return {
    upstream_unreachable: [],
    upstream_5xx: [],
    field_missing_or_invalid: []
  };
}

function buildRealLinkGroupedByEndpoint(groupedFailures) {
  const groupedByEndpoint = {};
  const categories = ["upstream_unreachable", "upstream_5xx", "field_missing_or_invalid"];
  for (const category of categories) {
    const items = Array.isArray(groupedFailures?.[category]) ? groupedFailures[category] : [];
    for (const item of items) {
      const endpoint = typeof item?.endpoint === "string" ? item.endpoint : "unknown";
      if (!groupedByEndpoint[endpoint]) {
        groupedByEndpoint[endpoint] = newRealLinkGroupedFailures();
      }
      groupedByEndpoint[endpoint][category].push(item);
    }
  }
  return groupedByEndpoint;
}

function formatRealLinkFailureItem(item) {
  const jsonPath = String(item?.jsonPath || "unknown.path");
  const message = String(item?.message || "failure");
  return `${jsonPath}: ${message}`;
}

function buildRealLinkFailureSummary(groupedFailures) {
  const normalizedGroupedFailures = groupedFailures || newRealLinkGroupedFailures();
  const groupedByEndpoint = buildRealLinkGroupedByEndpoint(normalizedGroupedFailures);
  const categories = ["upstream_unreachable", "upstream_5xx", "field_missing_or_invalid"];

  const byCategory = {};
  let totalFailures = 0;
  for (const category of categories) {
    const count = Array.isArray(normalizedGroupedFailures[category])
      ? normalizedGroupedFailures[category].length
      : 0;
    byCategory[category] = count;
    totalFailures += count;
  }

  const byEndpoint = {};
  for (const [endpoint, endpointGroups] of Object.entries(groupedByEndpoint)) {
    let endpointTotal = 0;
    const endpointCounts = {};
    for (const category of categories) {
      const count = Array.isArray(endpointGroups?.[category]) ? endpointGroups[category].length : 0;
      endpointCounts[category] = count;
      endpointTotal += count;
    }
    byEndpoint[endpoint] = {
      total: endpointTotal,
      ...endpointCounts
    };
  }

  return {
    groupedFailures: normalizedGroupedFailures,
    groupedByEndpoint,
    summary: {
      totalFailures,
      byCategory,
      byEndpoint
    }
  };
}

function formatProbeReadyLine(name, ready) {
  if (ready === null || ready === undefined) {
    return `${name}=unknown`;
  }
  return `${name}=${ready ? "true" : "false"}`;
}

function writeRealLinkReadyProbeReport(exampleResult, runtimeProbe, sampleResult, extraProbeResults = {}) {
  const exampleSummary = buildRealLinkFailureSummary(exampleResult?.groupedFailures);
  const runtimeSummary = buildRealLinkFailureSummary(runtimeProbe?.groupedFailures);
  const exampleReady = Boolean(exampleResult?.ready);
  const runtimeReady = typeof runtimeProbe?.runtimeReady === "boolean" ? runtimeProbe.runtimeReady : null;
  const baselineSampleReady = Boolean(sampleResult?.ready);
  const homeEnergyFallback = extraProbeResults?.homeEnergyFallback;

  const report = {
    generatedAt: new Date().toISOString(),
    ready: exampleReady,
    exampleReady,
    exampleReadyLine: formatProbeReadyLine("example-ready", exampleReady),
    runtimeReady,
    runtimeReadyLine: formatProbeReadyLine("runtime-ready", runtimeReady),
    baselineSampleReady,
    reasons: Array.isArray(exampleResult?.reasons) ? exampleResult.reasons : [],
    exampleReasons: Array.isArray(exampleResult?.reasons) ? exampleResult.reasons : [],
    groupedFailures: exampleSummary.groupedFailures,
    groupedByEndpoint: exampleSummary.groupedByEndpoint,
    summary: exampleSummary.summary,
    runtimeProbe: {
      enabled: Boolean(runtimeProbe?.enabled),
      available: Boolean(runtimeProbe?.available),
      probeBaseUrl: runtimeProbe?.probeBaseUrl || DEFAULT_RUNTIME_PROBE_BASE_URL,
      siteId: runtimeProbe?.siteId || DEFAULT_RUNTIME_PROBE_SITE_ID,
      timeoutMs:
        typeof runtimeProbe?.timeoutMs === "number" && Number.isFinite(runtimeProbe.timeoutMs)
          ? runtimeProbe.timeoutMs
          : DEFAULT_RUNTIME_PROBE_TIMEOUT_MS,
      runtimeReady,
      runtimeReadyLine: formatProbeReadyLine("runtime-ready", runtimeReady),
      reasons: Array.isArray(runtimeProbe?.reasons) ? runtimeProbe.reasons : [],
      groupedFailures: runtimeSummary.groupedFailures,
      groupedByEndpoint: runtimeSummary.groupedByEndpoint,
      summary: runtimeSummary.summary
    },
    baselineSample: REAL_LINK_READY_SAMPLE_FILE,
    baselineSampleReasons: Array.isArray(sampleResult?.reasons) ? sampleResult.reasons : [],
    nonBlockingProbes: {
      homeEnergyFallback: {
        applicable: Boolean(homeEnergyFallback?.applicable),
        ready: Boolean(homeEnergyFallback?.ready),
        reasons: Array.isArray(homeEnergyFallback?.reasons) ? homeEnergyFallback.reasons : [],
        triggerMessage:
          typeof homeEnergyFallback?.triggerMessage === "string"
            ? homeEnergyFallback.triggerMessage
            : null
      }
    }
  };

  fs.writeFileSync(REAL_LINK_READY_PROBE_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function evaluateHomeEnergyFallback(payload) {
  const reasons = [];
  const sources = Array.isArray(payload?.sourceStatus?.sources) ? payload.sourceStatus.sources : [];
  const energySource = sources.find((item) => item?.key === "energy");
  if (!energySource) {
    return {
      applicable: false,
      ready: true,
      reasons: ["dashboardOverview.sourceStatus.sources missing key=energy"],
      triggerMessage: null
    };
  }

  const message = typeof energySource.message === "string" ? energySource.message : "";
  const triggerMatched = message.includes(HOME_ENERGY_FALLBACK_TRIGGER);
  if (!triggerMatched) {
    return {
      applicable: false,
      ready: true,
      reasons: [`energy source message missing fallback trigger "${HOME_ENERGY_FALLBACK_TRIGGER}"`],
      triggerMessage: message || null
    };
  }

  const energyCards = payload?.energyCards;
  if (!energyCards || typeof energyCards !== "object" || Array.isArray(energyCards)) {
    reasons.push("/dashboard/overview.energyCards: must be object when homeEnergy fallback triggered");
  } else {
    for (const field of HOME_ENERGY_FALLBACK_REQUIRED_FIELDS) {
      const value = energyCards[field];
      if (!(typeof value === "number" && Number.isFinite(value))) {
        reasons.push(
          `/dashboard/overview.energyCards.${field}: must be number when homeEnergy fallback triggered`
        );
      }
    }
  }

  return {
    applicable: true,
    ready: reasons.length === 0,
    reasons,
    triggerMessage: message
  };
}

function runHomeEnergyFallbackNonBlockingProbe(exampleByPath) {
  const currentOverview = exampleByPath.get(OVERVIEW_PATH);
  const currentResult = evaluateHomeEnergyFallback(currentOverview);
  const currentState =
    currentResult.applicable && currentResult.ready
      ? "READY"
      : currentResult.applicable
        ? "NOT_READY"
        : "N/A";

  process.stdout.write(`HomeEnergy fallback probe (non-blocking): ${currentState}\n`);
  if (typeof currentResult.triggerMessage === "string") {
    process.stdout.write(`- trigger message: ${currentResult.triggerMessage}\n`);
  }
  if (!currentResult.ready || !currentResult.applicable) {
    for (const reason of currentResult.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  }
  return currentResult;
}

function getSourceKeyPatternRegex(doc, errors) {
  const patternPath = "components.schemas.SourceEndpointStatus.properties.key.pattern";
  const sourceEndpointStatus = normalizeSchema(doc, doc?.components?.schemas?.SourceEndpointStatus);
  const keyPattern = sourceEndpointStatus?.properties?.key?.pattern;
  if (typeof keyPattern !== "string") {
    errors.push(`${patternPath}: is required`);
    return null;
  }
  try {
    return new RegExp(keyPattern);
  } catch (error) {
    errors.push(`${patternPath}: invalid regex: ${String(error)}`);
    return null;
  }
}

function checkSourceStatusShape(pathName, payload, keyPatternRegex, errors) {
  const sourceStatus = payload?.sourceStatus;
  if (!sourceStatus || typeof sourceStatus !== "object" || Array.isArray(sourceStatus)) {
    pushSourceStatusError(errors, pathName, "sourceStatus", "must be object");
    return;
  }

  const sources = sourceStatus.sources;
  if (!Array.isArray(sources)) {
    pushSourceStatusError(errors, pathName, "sourceStatus.sources", "must be array");
    return;
  }

  for (let i = 0; i < sources.length; i += 1) {
    const item = sources[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      pushSourceStatusError(errors, pathName, `sourceStatus.sources[${i}]`, "must be object");
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(item, "key")) {
      pushSourceStatusError(errors, pathName, `sourceStatus.sources[${i}].key`, "must exist");
    } else if (typeof item.key !== "string") {
      pushSourceStatusError(errors, pathName, `sourceStatus.sources[${i}].key`, "must be string");
    } else if (keyPatternRegex && !keyPatternRegex.test(item.key)) {
      pushSourceStatusError(
        errors,
        pathName,
        `sourceStatus.sources[${i}].key`,
        `does not match pattern ${keyPatternRegex.source}`
      );
    }

    if (Object.prototype.hasOwnProperty.call(item, "ok") && typeof item.ok !== "boolean") {
      pushSourceStatusError(errors, pathName, `sourceStatus.sources[${i}].ok`, "must be boolean");
    }

    if (
      Object.prototype.hasOwnProperty.call(item, "status") &&
      !(item.status === null || (typeof item.status === "number" && Number.isFinite(item.status)))
    ) {
      pushSourceStatusError(
        errors,
        pathName,
        `sourceStatus.sources[${i}].status`,
        "must be number or null"
      );
    }
  }
}

function checkSourceStatusBranchCoverage(pathName, payload, errors) {
  const sources = payload?.sourceStatus?.sources;
  if (!Array.isArray(sources)) {
    return;
  }
  const hasOkTrue = sources.some((item) => item?.ok === true);
  const hasFailedWithStatusCode = sources.some(
    (item) => item?.ok === false && typeof item?.status === "number" && item.status >= 500
  );
  const hasFailedWithNullStatus = sources.some((item) => item?.ok === false && item?.status === null);

  if (!hasOkTrue) {
    pushSourceStatusError(
      errors,
      pathName,
      "sourceStatus.sources",
      "must include at least one source with ok=true"
    );
  }
  if (!hasFailedWithStatusCode) {
    pushSourceStatusError(
      errors,
      pathName,
      "sourceStatus.sources",
      "must include at least one source with ok=false and status>=500"
    );
  }
  if (!hasFailedWithNullStatus) {
    pushSourceStatusError(
      errors,
      pathName,
      "sourceStatus.sources",
      "must include at least one source with ok=false and status=null"
    );
  }
}

function runSourceStatusRegressions(doc, exampleByPath, errors) {
  const keyPatternRegex = getSourceKeyPatternRegex(doc, errors);
  for (const pathName of SOURCE_STATUS_LOCALIZATION_PATHS) {
    const payload = exampleByPath.get(pathName);
    if (!payload) {
      pushSourceStatusError(errors, pathName, "$", "example payload missing");
      continue;
    }
    checkSourceStatusShape(pathName, payload, keyPatternRegex, errors);
    checkSourceStatusBranchCoverage(pathName, payload, errors);
  }
}

function runI18nSafetyRegressions(exampleByPath, errors, notices) {
  for (const pathName of SOURCE_STATUS_LOCALIZATION_PATHS) {
    const payload = exampleByPath.get(pathName);
    const sources = payload?.sourceStatus?.sources;
    if (!Array.isArray(sources)) {
      continue;
    }

    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(source, "key")) {
        errors.push(
          `${pathName}.sourceStatus.sources[${i}].key: required for i18n summary rendering (do not depend on message/error)`
        );
      }
      if (!Object.prototype.hasOwnProperty.call(source, "ok")) {
        errors.push(
          `${pathName}.sourceStatus.sources[${i}].ok: required for i18n summary rendering (do not depend on message/error)`
        );
      }
      if (!Object.prototype.hasOwnProperty.call(source, "status")) {
        errors.push(
          `${pathName}.sourceStatus.sources[${i}].status: required for i18n summary rendering (do not depend on message/error)`
        );
      }
    }
  }

  const recExample = exampleByPath.get(RECOMMENDATIONS_PATH);
  const skipped = recExample?.ruleEvaluation?.skippedRuleDetails;
  if (Array.isArray(skipped)) {
    for (let i = 0; i < skipped.length; i += 1) {
      const missingMetrics = skipped[i]?.missingMetrics;
      if (!Array.isArray(missingMetrics)) {
        continue;
      }
      for (let j = 0; j < missingMetrics.length; j += 1) {
        const metric = missingMetrics[j];
        if (!Object.prototype.hasOwnProperty.call(metric || {}, "category")) {
          errors.push(
            `${RECOMMENDATIONS_PATH}.ruleEvaluation.skippedRuleDetails[${i}].missingMetrics[${j}].category: required for i18n rendering (do not depend on message)`
          );
        }
      }
    }
  }

  pushI18nNotice(
    notices,
    "Primary rendering must use key/ok/status/category; message/error are diagnostic details only."
  );
}

function runSourceStatusSummaryCasesRegressions(errors) {
  if (!fs.existsSync(SOURCE_STATUS_SUMMARY_CASES_FILE)) {
    pushSourceStatusCasesError(errors, "$", `file missing: ${SOURCE_STATUS_SUMMARY_CASES_FILE}`);
    return;
  }

  let rawCases = null;
  try {
    rawCases = JSON.parse(fs.readFileSync(SOURCE_STATUS_SUMMARY_CASES_FILE, "utf8"));
  } catch (error) {
    pushSourceStatusCasesError(errors, "$", `parse failed: ${String(error)}`);
    return;
  }

  const cases = rawCases?.cases;
  if (!Array.isArray(cases)) {
    pushSourceStatusCasesError(errors, "cases", "must be array");
    return;
  }

  let hasEmptySourcesCase = false;
  let hasMissingKeyCase = false;
  let hasMissingKeyWithNullStatus = false;
  let hasMissingKeyWith500Status = false;

  for (let i = 0; i < cases.length; i += 1) {
    const oneCase = cases[i];
    if (!oneCase || typeof oneCase !== "object" || Array.isArray(oneCase)) {
      pushSourceStatusCasesError(errors, `cases[${i}]`, "must be object");
      continue;
    }

    const sourceStatus = oneCase.sourceStatus;
    if (!sourceStatus || typeof sourceStatus !== "object" || Array.isArray(sourceStatus)) {
      pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus`, "must be object");
      continue;
    }

    if (!Array.isArray(sourceStatus.sources)) {
      pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus.sources`, "must be array");
      continue;
    }

    if (sourceStatus.sources.length === 0) {
      hasEmptySourcesCase = true;
    }

    for (let j = 0; j < sourceStatus.sources.length; j += 1) {
      const source = sourceStatus.sources[j];
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus.sources[${j}]`, "must be object");
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(source, "ok")) {
        pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus.sources[${j}].ok`, "must exist");
      } else if (typeof source.ok !== "boolean") {
        pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus.sources[${j}].ok`, "must be boolean");
      }

      if (!Object.prototype.hasOwnProperty.call(source, "status")) {
        pushSourceStatusCasesError(errors, `cases[${i}].sourceStatus.sources[${j}].status`, "must exist");
      } else if (!(source.status === null || (typeof source.status === "number" && Number.isFinite(source.status)))) {
        pushSourceStatusCasesError(
          errors,
          `cases[${i}].sourceStatus.sources[${j}].status`,
          "must be number or null"
        );
      }

      if (!Object.prototype.hasOwnProperty.call(source, "key")) {
        hasMissingKeyCase = true;
        if (!(typeof source.endpoint === "string" && source.endpoint.trim().length > 0)) {
          pushSourceStatusCasesError(
            errors,
            `cases[${i}].sourceStatus.sources[${j}].endpoint`,
            "must be non-empty string when key is missing (frontend fallback label)"
          );
        }
        if (source.status === null) {
          hasMissingKeyWithNullStatus = true;
        }
        if (typeof source.status === "number" && source.status >= 500) {
          hasMissingKeyWith500Status = true;
        }
      }
    }
  }

  if (!hasEmptySourcesCase) {
    pushSourceStatusCasesError(errors, "cases", "must include one empty sources[] case");
  }
  if (!hasMissingKeyCase) {
    pushSourceStatusCasesError(errors, "cases", "must include one missing-key source case");
  }
  if (!hasMissingKeyWithNullStatus) {
    pushSourceStatusCasesError(errors, "cases", "must include one missing-key case with status=null");
  }
  if (!hasMissingKeyWith500Status) {
    pushSourceStatusCasesError(errors, "cases", "must include one missing-key case with status>=500");
  }
}

function runSourceKeyDriftWarnings(exampleByPath, warnings) {
  const keyStats = new Map();
  const examplePaths = {};
  const newMetricKeys = new Set();
  const unknownStaticKeys = new Set();

  for (const pathName of SOURCE_STATUS_LOCALIZATION_PATHS) {
    const payload = exampleByPath.get(pathName);
    const sources = payload?.sourceStatus?.sources;
    if (!Array.isArray(sources)) {
      continue;
    }
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      const key = source?.key;
      if (typeof key !== "string") {
        continue;
      }
      const keyPath = `${pathName}.sourceStatus.sources[${i}].key`;
      addExamplePath(examplePaths, key, keyPath);
      const current = keyStats.get(key) || { count: 0, locations: [] };
      current.count += 1;
      if (current.locations.length < 3) {
        current.locations.push(keyPath);
      }
      keyStats.set(key, current);

      if (key.startsWith("metric.")) {
        if (!METRIC_SOURCE_KEY_BASELINE.has(key)) {
          newMetricKeys.add(key);
          pushSourceKeyWarning(
            warnings,
            pathName,
            `sourceStatus.sources[${i}].key`,
            `[NEW_METRIC_KEY] "${key}" not in baseline mapping; frontend i18n mapping should be updated`
          );
        }
        continue;
      }

      if (!ALLOWED_STATIC_SOURCE_KEYS.has(key)) {
        unknownStaticKeys.add(key);
        pushSourceKeyWarning(
          warnings,
          pathName,
          `sourceStatus.sources[${i}].key`,
          `[UNKNOWN_STATIC_KEY] "${key}" not in allowlist; add version note and compatibility-window plan`
        );
      }
    }
  }

  const uniqueKeys = Array.from(keyStats.keys()).sort((a, b) => a.localeCompare(b));
  return {
    keyStats,
    uniqueKeys,
    newMetricKeys: Array.from(newMetricKeys).sort((a, b) => a.localeCompare(b)),
    unknownStaticKeys: Array.from(unknownStaticKeys).sort((a, b) => a.localeCompare(b)),
    examplePaths
  };
}

function writeSourceKeyScanReport(scanReport) {
  const report = {
    uniqueKeys: scanReport.uniqueKeys,
    newMetricKeys: scanReport.newMetricKeys,
    unknownStaticKeys: scanReport.unknownStaticKeys,
    examplePaths: scanReport.examplePaths
  };
  fs.writeFileSync(SOURCE_KEY_SCAN_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printSourceKeyScanReport(scanReport, warnings) {
  const sortedEntries = Array.from(scanReport.keyStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  process.stdout.write("Source key scan report:\n");
  process.stdout.write(`- uniqueKeys=${sortedEntries.length}\n`);
  for (const [key, stat] of sortedEntries) {
    const sample = stat.locations[0] || "n/a";
    process.stdout.write(`- ${key}: count=${stat.count}, sample=${sample}\n`);
  }

  if (warnings.length === 0) {
    process.stdout.write("Source key drift warnings: none\n");
    return;
  }

  process.stdout.write(`Source key drift warnings (${warnings.length}):\n`);
  for (const warning of warnings) {
    process.stdout.write(`- ${warning}\n`);
  }
}

function printI18nNotices(notices) {
  if (notices.length === 0) {
    return;
  }
  process.stdout.write(`I18N safety notices (${notices.length}):\n`);
  for (const notice of notices) {
    process.stdout.write(`- ${notice}\n`);
  }
}

function loadRealLinkReadySample(errors) {
  if (!fs.existsSync(REAL_LINK_READY_SAMPLE_FILE)) {
    errors.push(`real-link-ready-sample.$: file missing: ${REAL_LINK_READY_SAMPLE_FILE}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(REAL_LINK_READY_SAMPLE_FILE, "utf8"));
  } catch (error) {
    errors.push(`real-link-ready-sample.$: parse failed: ${String(error)}`);
    return null;
  }
}

function evaluateRealLinkReadyWithPayloads(payloadsByName) {
  const reasons = [];
  const groupedFailures = newRealLinkGroupedFailures();

  const endpointChecks = [
    { name: "dashboardOverview", payload: payloadsByName.dashboardOverview, path: "/dashboard/overview" },
    { name: "dashboardTrends", payload: payloadsByName.dashboardTrends, path: "/dashboard/trends" },
    { name: "anomaliesSummary", payload: payloadsByName.anomaliesSummary, path: "/anomalies/summary" },
    { name: "recommendations", payload: payloadsByName.recommendations, path: "/recommendations" }
  ];

  for (const endpoint of endpointChecks) {
    const sourceStatus = endpoint.payload?.sourceStatus;
    if (!sourceStatus || typeof sourceStatus !== "object") {
      reasons.push(`${endpoint.name}.sourceStatus missing`);
      continue;
    }
    if (sourceStatus.overall !== "ok") {
      reasons.push(`${endpoint.name}.sourceStatus.overall=${String(sourceStatus.overall)} (expected ok)`);
    }
    const sources = Array.isArray(sourceStatus.sources) ? sourceStatus.sources : [];
    const badCount = sources.filter((item) => item?.ok !== true).length;
    if (badCount > 0) {
      reasons.push(`${endpoint.name}.sourceStatus has ${badCount} source(s) with ok=false`);
    }
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      if (source?.ok !== false) {
        continue;
      }
      const sourcePath = `${endpoint.path}.sourceStatus.sources[${i}]`;
      const keyText = String(source?.key);
      if (typeof source?.status === "number" && source.status >= 500) {
        groupedFailures.upstream_5xx.push(
          {
            endpoint: endpoint.path,
            category: "upstream_5xx",
            jsonPath: sourcePath,
            key: keyText,
            status: source.status,
            message: `key=${keyText} status=${String(source.status)}`
          }
        );
      } else if (source?.status === null) {
        groupedFailures.upstream_unreachable.push(
          {
            endpoint: endpoint.path,
            category: "upstream_unreachable",
            jsonPath: sourcePath,
            key: keyText,
            status: null,
            message: `key=${keyText} status=null`
          }
        );
      }
    }
  }

  const trends = payloadsByName.dashboardTrends;
  if (trends?.freshness?.stale !== false) {
    reasons.push(`dashboardTrends.freshness.stale=${String(trends?.freshness?.stale)} (expected false)`);
  }
  const hasNumericTrendPoint = (Array.isArray(trends?.series) ? trends.series : []).some((series) =>
    (Array.isArray(series?.points) ? series.points : []).some(
      (point) => typeof point?.v === "number" && Number.isFinite(point.v)
    )
  );
  if (!hasNumericTrendPoint) {
    reasons.push("dashboardTrends.series has no numeric point value");
  }

  const recommendations = payloadsByName.recommendations;
  const skipped = Array.isArray(recommendations?.ruleEvaluation?.skippedRuleDetails)
    ? recommendations.ruleEvaluation.skippedRuleDetails
    : [];
  const degradedSkipped = [];
  for (let i = 0; i < skipped.length; i += 1) {
    const item = skipped[i];
    const missingMetrics = Array.isArray(item?.missingMetrics) ? item.missingMetrics : [];
    if (item?.reason === "missing-metric" || missingMetrics.length > 0) {
      degradedSkipped.push(item);
    }
    for (let j = 0; j < missingMetrics.length; j += 1) {
      const metric = missingMetrics[j];
      const category = metric?.category;
      const metricPath =
        `/recommendations.ruleEvaluation.skippedRuleDetails[${i}].missingMetrics[${j}]`;
      if (category === "field_missing_or_invalid") {
        groupedFailures.field_missing_or_invalid.push(
          {
            endpoint: "/recommendations",
            category: "field_missing_or_invalid",
            jsonPath: metricPath,
            ruleId: String(item?.ruleId),
            metric: String(metric?.metric),
            message: `metric=${String(metric?.metric)} category=field_missing_or_invalid`
          }
        );
      } else if (category === "upstream_unreachable") {
        groupedFailures.upstream_unreachable.push(
          {
            endpoint: "/recommendations",
            category: "upstream_unreachable",
            jsonPath: metricPath,
            ruleId: String(item?.ruleId),
            metric: String(metric?.metric),
            message: `metric=${String(metric?.metric)} category=upstream_unreachable`
          }
        );
      }
    }
  }
  if (degradedSkipped.length > 0) {
    reasons.push(
      `recommendations.ruleEvaluation.skippedRuleDetails has ${degradedSkipped.length} degraded item(s)`
    );
  }

  return {
    ready: reasons.length === 0,
    reasons,
    groupedFailures
  };
}

function printRealLinkReadyGroupedFailures(groupedFailures) {
  process.stdout.write("Real-link-ready failure groups (by category):\n");
  const groups = [
    "upstream_unreachable",
    "upstream_5xx",
    "field_missing_or_invalid"
  ];
  for (const group of groups) {
    const items = Array.isArray(groupedFailures?.[group]) ? groupedFailures[group] : [];
    process.stdout.write(`- group=${group} count=${items.length}\n`);
    for (const item of items) {
      process.stdout.write(`  - ${formatRealLinkFailureItem(item)}\n`);
    }
  }

  const groupedByEndpoint = buildRealLinkGroupedByEndpoint(groupedFailures);
  const endpointNames = Object.keys(groupedByEndpoint).sort((a, b) => a.localeCompare(b));
  process.stdout.write("Real-link-ready failure groups (by endpoint/category):\n");
  for (const endpoint of endpointNames) {
    process.stdout.write(`- endpoint=${endpoint}\n`);
    for (const group of groups) {
      const items = groupedByEndpoint?.[endpoint]?.[group] || [];
      process.stdout.write(`  - group=${group} count=${items.length}\n`);
      for (const item of items) {
        process.stdout.write(`    - ${formatRealLinkFailureItem(item)}\n`);
      }
    }
  }
}

function createRuntimeProbePlaceholder(endpointPath, status, errorMessage) {
  return {
    sourceStatus: {
      overall: "partial",
      sources: [
        {
          key: "runtimeProbe",
          endpoint: endpointPath,
          ok: false,
          status,
          message: null,
          error: errorMessage,
          rows: null
        }
      ]
    }
  };
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status ?? null,
        error: `HTTP ${String(response.status ?? "unknown")}`
      };
    }

    if (!text || text.trim().length === 0) {
      return {
        ok: false,
        status: response.status ?? null,
        error: "empty response body"
      };
    }

    try {
      return {
        ok: true,
        status: response.status ?? null,
        payload: JSON.parse(text)
      };
    } catch (error) {
      return {
        ok: false,
        status: response.status ?? null,
        error: `invalid JSON: ${String(error)}`
      };
    }
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: isAbort ? `timeout >= ${String(timeoutMs)}ms` : String(error)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeRuntimeRealLinkReady() {
  const timeoutMs =
    Number.isFinite(DEFAULT_RUNTIME_PROBE_TIMEOUT_MS) && DEFAULT_RUNTIME_PROBE_TIMEOUT_MS > 0
      ? DEFAULT_RUNTIME_PROBE_TIMEOUT_MS
      : 1500;
  const probeBaseUrl = DEFAULT_RUNTIME_PROBE_BASE_URL.replace(/\/$/, "");
  const siteId = DEFAULT_RUNTIME_PROBE_SITE_ID;
  const emptyGroupedFailures = newRealLinkGroupedFailures();

  if (!RUNTIME_PROBE_ENABLED) {
    return {
      enabled: false,
      available: false,
      runtimeReady: null,
      reasons: ["runtime probe disabled by RUNTIME_PROBE=0"],
      groupedFailures: emptyGroupedFailures,
      probeBaseUrl,
      siteId,
      timeoutMs
    };
  }

  const endpoints = [
    {
      key: "dashboardOverview",
      path: "/dashboard/overview",
      urlPath: `/bff/v1/sites/${siteId}/dashboard/overview`
    },
    {
      key: "dashboardTrends",
      path: "/dashboard/trends",
      urlPath: `/bff/v1/sites/${siteId}/dashboard/trends`
    },
    {
      key: "anomaliesSummary",
      path: "/anomalies/summary",
      urlPath: `/bff/v1/sites/${siteId}/anomalies/summary`
    },
    {
      key: "recommendations",
      path: "/recommendations",
      urlPath: `/bff/v1/sites/${siteId}/recommendations`
    }
  ];

  const payloadsByName = {};
  const runtimeProbeReasons = [];
  let successCount = 0;

  const runtimeChecks = await Promise.all(
    endpoints.map(async (endpoint) => {
      const url = `${probeBaseUrl}${endpoint.urlPath}`;
      const result = await fetchJsonWithTimeout(url, timeoutMs);
      return { endpoint, url, result };
    })
  );

  for (const check of runtimeChecks) {
    const endpointName = check.endpoint.key;
    const endpointPath = check.endpoint.path;
    const probeResult = check.result;
    if (probeResult.ok && probeResult.payload && typeof probeResult.payload === "object") {
      payloadsByName[endpointName] = probeResult.payload;
      successCount += 1;
      continue;
    }

    runtimeProbeReasons.push(
      `${endpointName} runtime probe failed: ${probeResult.error} (${check.url})`
    );
    payloadsByName[endpointName] = createRuntimeProbePlaceholder(
      endpointPath,
      probeResult.status ?? null,
      probeResult.error
    );
  }

  const evaluated = evaluateRealLinkReadyWithPayloads(payloadsByName);
  const runtimeAvailable = successCount > 0;
  return {
    enabled: true,
    available: runtimeAvailable,
    runtimeReady: runtimeAvailable ? Boolean(evaluated.ready) : null,
    reasons: runtimeAvailable
      ? [...runtimeProbeReasons, ...evaluated.reasons]
      : runtimeProbeReasons.length > 0
        ? runtimeProbeReasons
        : ["runtime probe unavailable"],
    groupedFailures: evaluated.groupedFailures,
    probeBaseUrl,
    siteId,
    timeoutMs
  };
}

async function runRealLinkReadyNonBlockingProbe(exampleByPath, errors, extraProbeResults = {}) {
  const sample = loadRealLinkReadySample(errors);
  if (!sample) {
    return;
  }

  const sampleResult = evaluateRealLinkReadyWithPayloads({
    dashboardOverview: sample.dashboardOverview,
    dashboardTrends: sample.dashboardTrends,
    anomaliesSummary: sample.anomaliesSummary,
    recommendations: sample.recommendations
  });
  if (!sampleResult.ready) {
    errors.push(
      `real-link-ready-sample.$: sample must represent non-degraded state, got ${sampleResult.reasons.join("; ")}`
    );
  }

  const currentResult = evaluateRealLinkReadyWithPayloads({
    dashboardOverview: exampleByPath.get("/bff/v1/sites/{siteId}/dashboard/overview"),
    dashboardTrends: exampleByPath.get("/bff/v1/sites/{siteId}/dashboard/trends"),
    anomaliesSummary: exampleByPath.get("/bff/v1/sites/{siteId}/anomalies/summary"),
    recommendations: exampleByPath.get("/bff/v1/sites/{siteId}/recommendations")
  });

  const runtimeProbe = await probeRuntimeRealLinkReady();
  writeRealLinkReadyProbeReport(currentResult, runtimeProbe, sampleResult, extraProbeResults);

  process.stdout.write(
    `Real-link-ready probe (non-blocking): ${currentResult.ready ? "READY" : "NOT_READY"}\n`
  );
  process.stdout.write(`${formatProbeReadyLine("example-ready", currentResult.ready)}\n`);
  process.stdout.write(`${formatProbeReadyLine("runtime-ready", runtimeProbe.runtimeReady)}\n`);

  if (!runtimeProbe.available) {
    process.stdout.write("Real-link-ready runtime probe (non-blocking): UNAVAILABLE\n");
    for (const reason of runtimeProbe.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  } else {
    process.stdout.write(
      `Real-link-ready runtime probe (non-blocking): ${runtimeProbe.runtimeReady ? "READY" : "NOT_READY"}\n`
    );
    if (!runtimeProbe.runtimeReady) {
      for (const reason of runtimeProbe.reasons) {
        process.stdout.write(`- ${reason}\n`);
      }
      printRealLinkReadyGroupedFailures(runtimeProbe.groupedFailures);
    }
  }

  if (!currentResult.ready) {
    for (const reason of currentResult.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
    printRealLinkReadyGroupedFailures(currentResult.groupedFailures);
  }

  process.stdout.write(`Real-link-ready baseline sample: ${REAL_LINK_READY_SAMPLE_FILE}\n`);
  process.stdout.write(`Real-link-ready probe report: ${REAL_LINK_READY_PROBE_REPORT_FILE}\n`);
}

function getRecommendationsExample(checks, errors) {
  const recCheck = checks.find((check) => check.pathName === RECOMMENDATIONS_PATH);
  if (!recCheck) {
    pushRecommendationsError(errors, "$", "contract path missing");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(recCheck.exampleFile, "utf8"));
  } catch (error) {
    pushRecommendationsError(errors, "$", `failed to parse example: ${String(error)}`);
    return null;
  }
}

function checkSkippedRuleDetailsRegression(recExample, errors) {
  const skippedPath = "ruleEvaluation.skippedRuleDetails";
  const skipped = recExample?.ruleEvaluation?.skippedRuleDetails;
  if (!Array.isArray(skipped)) {
    pushRecommendationsError(errors, skippedPath, "must be an array");
    return;
  }

  for (let i = 0; i < skipped.length; i += 1) {
    const item = skipped[i];
    if (typeof item?.ruleId !== "string") {
      pushRecommendationsError(errors, `${skippedPath}[${i}].ruleId`, "must be string");
    }
    if (typeof item?.reason !== "string") {
      pushRecommendationsError(errors, `${skippedPath}[${i}].reason`, "must be string");
    }
    if (!Array.isArray(item?.missingMetrics)) {
      pushRecommendationsError(errors, `${skippedPath}[${i}].missingMetrics`, "must be array");
      continue;
    }
    for (let j = 0; j < item.missingMetrics.length; j += 1) {
      const metric = item.missingMetrics[j];
      if (typeof metric?.metric !== "string") {
        pushRecommendationsError(
          errors,
          `${skippedPath}[${i}].missingMetrics[${j}].metric`,
          "must be string"
        );
      }
      if (typeof metric?.category !== "string") {
        pushRecommendationsError(
          errors,
          `${skippedPath}[${i}].missingMetrics[${j}].category`,
          "must be string"
        );
      } else if (metric.category.trim().length === 0) {
        pushRecommendationsError(
          errors,
          `${skippedPath}[${i}].missingMetrics[${j}].category`,
          "must be a non-empty string"
        );
      } else if (!ALLOWED_MISSING_METRIC_CATEGORIES.has(metric.category)) {
        pushRecommendationsError(
          errors,
          `${skippedPath}[${i}].missingMetrics[${j}].category`,
          `must be one of upstream_unreachable|field_missing_or_invalid|unknown, got "${metric.category}"`
        );
      }
      if (
        metric &&
        typeof metric === "object" &&
        Object.prototype.hasOwnProperty.call(metric, "message") &&
        !(metric.message === null || typeof metric.message === "string")
      ) {
        pushRecommendationsError(
          errors,
          `${skippedPath}[${i}].missingMetrics[${j}].message`,
          "must be string or null"
        );
      }
    }
  }
}

function checkSkippedRuleCoverageRegression(recExample, errors) {
  const skipped = Array.isArray(recExample?.ruleEvaluation?.skippedRuleDetails)
    ? recExample.ruleEvaluation.skippedRuleDetails
    : [];
  const categories = new Set();

  for (const item of skipped) {
    if (!Array.isArray(item?.missingMetrics)) {
      continue;
    }
    for (const metric of item.missingMetrics) {
      if (typeof metric?.category === "string") {
        categories.add(metric.category);
      }
    }
  }

  for (const requiredCategory of ALLOWED_MISSING_METRIC_CATEGORIES) {
    if (!categories.has(requiredCategory)) {
      pushRecommendationsError(
        errors,
        "ruleEvaluation.skippedRuleDetails",
        `must include at least one missingMetrics.category="${requiredCategory}" for UI branch coverage`
      );
    }
  }
}

function checkMetricSourceKeyRegression(recExample, errors) {
  const sourcesPath = "sourceStatus.sources";
  const sources = recExample?.sourceStatus?.sources;
  if (!Array.isArray(sources)) {
    pushRecommendationsError(errors, sourcesPath, "must be an array");
    return;
  }
  const sourceKeys = sources
    .map((source) => source?.key)
    .filter((key) => typeof key === "string");
  for (const requiredKey of REQUIRED_METRIC_SOURCE_KEYS) {
    if (!sourceKeys.includes(requiredKey)) {
      pushRecommendationsError(errors, `${sourcesPath}[*].key`, `must include ${requiredKey}`);
    }
  }
}

function checkMetricPatternRegression(doc, recExample, errors) {
  const patternPath = "components.schemas.SourceEndpointStatus.properties.key.pattern";
  const sourceEndpointStatus = normalizeSchema(doc, doc?.components?.schemas?.SourceEndpointStatus);
  const keyPattern = sourceEndpointStatus?.properties?.key?.pattern;
  if (typeof keyPattern !== "string") {
    pushRecommendationsError(errors, patternPath, "is required");
    return;
  }

  let patternRegex = null;
  try {
    patternRegex = new RegExp(keyPattern);
  } catch (error) {
    pushRecommendationsError(errors, patternPath, `invalid regex: ${String(error)}`);
    return;
  }

  if (!patternRegex.test("metric.station_total_power_kw")) {
    pushRecommendationsError(errors, patternPath, "must match metric.<snake_case>");
  }

  const sources = Array.isArray(recExample?.sourceStatus?.sources) ? recExample.sourceStatus.sources : [];
  for (let i = 0; i < sources.length; i += 1) {
    const key = sources[i]?.key;
    if (typeof key === "string" && key.startsWith("metric.")) {
      const strictMetricRegex = /^metric\.[a-z0-9_]+$/;
      if (!strictMetricRegex.test(key)) {
        pushRecommendationsError(
          errors,
          `sourceStatus.sources[${i}].key`,
          `metric key "${key}" must match metric.<snake_case>`
        );
        continue;
      }
      if (!patternRegex.test(key)) {
        pushRecommendationsError(
          errors,
          `sourceStatus.sources[${i}].key`,
          `metric key "${key}" does not match ${keyPattern}`
        );
      }
    }
  }
}

function assertNegativeCase(caseName, caseErrors, expectedPath, errors) {
  if (!caseErrors.some((entry) => entry.startsWith(expectedPath))) {
    pushRecommendationsError(
      errors,
      `$selfcheck.${caseName}`,
      `expected error path "${expectedPath}" was not emitted`
    );
  }
}

function assertNoUnexpectedCase(caseName, caseErrors, unexpectedPath, errors) {
  if (caseErrors.some((entry) => entry.startsWith(unexpectedPath))) {
    pushRecommendationsError(
      errors,
      `$selfcheck.${caseName}`,
      `unexpected error path "${unexpectedPath}" was emitted`
    );
  }
}

function runRecommendationsNegativeSelfChecks(doc, errors) {
  const missingMetricsErrors = [];
  checkSkippedRuleDetailsRegression(
    {
      ruleEvaluation: {
        skippedRuleDetails: [{ ruleId: "r1", reason: "missing-metric" }]
      },
      sourceStatus: { sources: [] }
    },
    missingMetricsErrors
  );
  assertNegativeCase(
    "missingMetricsPath",
    missingMetricsErrors,
    `${RECOMMENDATIONS_PATH}.ruleEvaluation.skippedRuleDetails[0].missingMetrics:`,
    errors
  );

  const missingCategoryErrors = [];
  checkSkippedRuleDetailsRegression(
    {
      ruleEvaluation: {
        skippedRuleDetails: [
          {
            ruleId: "r1.1",
            reason: "missing-metric",
            missingMetrics: [{ metric: "station_cop", message: null }]
          }
        ]
      },
      sourceStatus: { sources: [] }
    },
    missingCategoryErrors
  );
  assertNegativeCase(
    "missingCategoryPath",
    missingCategoryErrors,
    `${RECOMMENDATIONS_PATH}.ruleEvaluation.skippedRuleDetails[0].missingMetrics[0].category:`,
    errors
  );

  const invalidCategoryErrors = [];
  checkSkippedRuleDetailsRegression(
    {
      ruleEvaluation: {
        skippedRuleDetails: [
          {
            ruleId: "r2",
            reason: "missing-metric",
            missingMetrics: [{ metric: "station_cop", category: "bad_category", message: null }]
          }
        ]
      },
      sourceStatus: { sources: [] }
    },
    invalidCategoryErrors
  );
  assertNegativeCase(
    "invalidCategoryPath",
    invalidCategoryErrors,
    `${RECOMMENDATIONS_PATH}.ruleEvaluation.skippedRuleDetails[0].missingMetrics[0].category:`,
    errors
  );

  const messageOptionalErrors = [];
  checkSkippedRuleDetailsRegression(
    {
      ruleEvaluation: {
        skippedRuleDetails: [
          {
            ruleId: "r2.1",
            reason: "missing-metric",
            missingMetrics: [{ metric: "station_cop", category: "unknown" }]
          }
        ]
      },
      sourceStatus: { sources: [] }
    },
    messageOptionalErrors
  );
  assertNoUnexpectedCase(
    "messageOptionalPath",
    messageOptionalErrors,
    `${RECOMMENDATIONS_PATH}.ruleEvaluation.skippedRuleDetails[0].missingMetrics[0].message:`,
    errors
  );

  const invalidMetricKeyErrors = [];
  checkMetricPatternRegression(
    doc,
    {
      sourceStatus: {
        sources: [{ key: "metric.BadKey", endpoint: "", ok: false, status: null, message: null, error: null, rows: null }]
      }
    },
    invalidMetricKeyErrors
  );
  assertNegativeCase(
    "metricPatternPath",
    invalidMetricKeyErrors,
    `${RECOMMENDATIONS_PATH}.sourceStatus.sources[0].key:`,
    errors
  );
}

function runRecommendationsRegressions(doc, checks, errors) {
  const recExample = getRecommendationsExample(checks, errors);
  if (!recExample) {
    return;
  }
  checkSkippedRuleDetailsRegression(recExample, errors);
  checkSkippedRuleCoverageRegression(recExample, errors);
  checkMetricSourceKeyRegression(recExample, errors);
  checkMetricPatternRegression(doc, recExample, errors);
  runRecommendationsNegativeSelfChecks(doc, errors);
}

function runTrendsRegressions(exampleByPath, errors) {
  const trendsExample = exampleByPath.get(TRENDS_PATH);
  if (!trendsExample || typeof trendsExample !== "object") {
    errors.push(`${TRENDS_PATH}: example payload missing`);
    return;
  }

  if (!["24h", "7d", "30d"].includes(trendsExample.range)) {
    errors.push(`${TRENDS_PATH}.range: must be one of 24h|7d|30d`);
  }

  const series = Array.isArray(trendsExample.series) ? trendsExample.series : [];
  const stats = Array.isArray(trendsExample.stats) ? trendsExample.stats : [];
  const seriesMetrics = new Set(series.map((item) => item?.metric).filter((value) => typeof value === "string"));
  const statMetrics = new Set(stats.map((item) => item?.metric).filter((value) => typeof value === "string"));

  for (const metric of seriesMetrics) {
    if (!statMetrics.has(metric)) {
      errors.push(`${TRENDS_PATH}.stats[*].metric: missing for series metric "${metric}"`);
    }
  }

  const sourceKeys = new Set(
    (trendsExample?.sourceStatus?.sources || [])
      .map((item) => item?.key)
      .filter((value) => typeof value === "string")
  );
  for (const key of REQUIRED_TREND_SOURCE_KEYS) {
    if (!sourceKeys.has(key)) {
      errors.push(`${TRENDS_PATH}.sourceStatus.sources[*].key: must include ${key}`);
    }
  }
}

function runAnomaliesListRegressions(exampleByPath, errors) {
  const listExample = exampleByPath.get(ANOMALIES_LIST_PATH);
  if (!listExample || typeof listExample !== "object") {
    errors.push(`${ANOMALIES_LIST_PATH}: example payload missing`);
    return;
  }

  if (!Number.isInteger(listExample.page) || listExample.page < 1) {
    errors.push(`${ANOMALIES_LIST_PATH}.page: must be integer >= 1`);
  }
  if (!Number.isInteger(listExample.pageSize) || listExample.pageSize < 1) {
    errors.push(`${ANOMALIES_LIST_PATH}.pageSize: must be integer >= 1`);
  }
  if (!Number.isInteger(listExample.total) || listExample.total < 0) {
    errors.push(`${ANOMALIES_LIST_PATH}.total: must be integer >= 0`);
  }

  const filters = listExample.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    errors.push(`${ANOMALIES_LIST_PATH}.filters: must be object`);
  }

  const items = Array.isArray(listExample.items) ? listExample.items : [];
  const allowedSeverities = new Set(["critical", "major", "minor", "normal"]);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!allowedSeverities.has(item?.severity)) {
      errors.push(
        `${ANOMALIES_LIST_PATH}.items[${i}].severity: must be one of critical|major|minor|normal`
      );
    }
    if (typeof item?.id !== "string" || item.id.trim().length === 0) {
      errors.push(`${ANOMALIES_LIST_PATH}.items[${i}].id: must be non-empty string`);
    }
    if (typeof item?.title !== "string" || item.title.trim().length === 0) {
      errors.push(`${ANOMALIES_LIST_PATH}.items[${i}].title: must be non-empty string`);
    }
    if (typeof item?.occurredAt !== "string" || item.occurredAt.trim().length === 0) {
      errors.push(`${ANOMALIES_LIST_PATH}.items[${i}].occurredAt: must be non-empty string`);
    }
    if (typeof item?.source !== "string" || item.source.trim().length === 0) {
      errors.push(`${ANOMALIES_LIST_PATH}.items[${i}].source: must be non-empty string`);
    }
  }

  const sourceKeys = new Set(
    (listExample?.sourceStatus?.sources || [])
      .map((item) => item?.key)
      .filter((value) => typeof value === "string")
  );
  if (!sourceKeys.has("latestAlarmLog")) {
    errors.push(`${ANOMALIES_LIST_PATH}.sourceStatus.sources[*].key: must include latestAlarmLog`);
  }
}

function runSystemDiagramRegressions(exampleByPath, errors) {
  const diagramExample = exampleByPath.get(SYSTEM_DIAGRAM_PATH);
  if (!diagramExample || typeof diagramExample !== "object") {
    errors.push(`${SYSTEM_DIAGRAM_PATH}: example payload missing`);
    return;
  }

  const nodes = Array.isArray(diagramExample.nodes) ? diagramExample.nodes : [];
  if (nodes.length === 0) {
    errors.push(`${SYSTEM_DIAGRAM_PATH}.nodes: must include at least 1 node`);
  }

  const edges = Array.isArray(diagramExample.edges) ? diagramExample.edges : [];
  if (edges.length === 0) {
    errors.push(`${SYSTEM_DIAGRAM_PATH}.edges: must include at least 1 edge`);
  }

  const hasDeviceIdRef = nodes.some(
    (node) => typeof node?.deviceIdRef === "string" && node.deviceIdRef.trim().length > 0
  );
  if (!hasDeviceIdRef) {
    errors.push(`${SYSTEM_DIAGRAM_PATH}.nodes[*].deviceIdRef: must include at least one deviceIdRef`);
  }

  const hasChilledSupply = edges.some((edge) => edge?.pipeClass === "chilled_supply");
  if (!hasChilledSupply) {
    errors.push(`${SYSTEM_DIAGRAM_PATH}.edges[*].pipeClass: must include chilled_supply`);
  }

  const hasCoolingSupply = edges.some((edge) => edge?.pipeClass === "cooling_supply");
  if (!hasCoolingSupply) {
    errors.push(`${SYSTEM_DIAGRAM_PATH}.edges[*].pipeClass: must include cooling_supply`);
  }
}

function loadRunParams500FallbackSample() {
  if (!fs.existsSync(RUNPARAMS_500_FALLBACK_SAMPLE_FILE)) {
    return { payload: null, issues: [`sample missing: ${RUNPARAMS_500_FALLBACK_SAMPLE_FILE}`] };
  }
  try {
    return {
      payload: JSON.parse(fs.readFileSync(RUNPARAMS_500_FALLBACK_SAMPLE_FILE, "utf8")),
      issues: []
    };
  } catch (error) {
    return { payload: null, issues: [`sample parse failed: ${String(error)}`] };
  }
}

function evaluateRunParams500Fallback(payload) {
  const reasons = [];
  const sources = Array.isArray(payload?.sourceStatus?.sources) ? payload.sourceStatus.sources : [];
  const hasRunParams500 = sources.some(
    (item) => item?.key === "runParams" && typeof item?.status === "number" && item.status >= 500
  );

  if (!hasRunParams500) {
    return { applicable: false, ready: true, reasons: ["runParams status>=500 not present"] };
  }

  const requiredMetrics = ["chilledDeltaT", "coolingDeltaT"];
  const series = Array.isArray(payload?.series) ? payload.series : [];
  for (const metric of requiredMetrics) {
    const metricSeries = series.find((item) => item?.metric === metric);
    const points = Array.isArray(metricSeries?.points) ? metricSeries.points : [];
    if (points.length === 0) {
      reasons.push(`series metric "${metric}" points is empty`);
      continue;
    }
    const hasValue = points.some(
      (point) => typeof point?.v === "number" && Number.isFinite(point.v)
    );
    if (!hasValue) {
      reasons.push(`series metric "${metric}" has no numeric point value`);
    }
  }

  return {
    applicable: true,
    ready: reasons.length === 0,
    reasons
  };
}

function runRunParams500FallbackNonBlockingProbe(exampleByPath) {
  const baseline = loadRunParams500FallbackSample();
  if (baseline.issues.length > 0) {
    process.stdout.write("RunParams-500 fallback probe (non-blocking): BASELINE_INVALID\n");
    for (const issue of baseline.issues) {
      process.stdout.write(`- ${issue}\n`);
    }
  } else {
    const baselineResult = evaluateRunParams500Fallback(baseline.payload);
    const baselineState =
      baselineResult.applicable && baselineResult.ready
        ? "READY"
        : baselineResult.applicable
          ? "NOT_READY"
          : "N/A";
    process.stdout.write(
      `RunParams-500 fallback baseline probe (non-blocking): ${baselineState}\n`
    );
    if (!baselineResult.ready || !baselineResult.applicable) {
      for (const reason of baselineResult.reasons) {
        process.stdout.write(`- ${reason}\n`);
      }
    }
  }
  process.stdout.write(
    `RunParams-500 fallback baseline sample: ${RUNPARAMS_500_FALLBACK_SAMPLE_FILE}\n`
  );

  const currentTrends = exampleByPath.get(TRENDS_PATH);
  const currentResult = evaluateRunParams500Fallback(currentTrends);
  const currentState =
    currentResult.applicable && currentResult.ready
      ? "READY"
      : currentResult.applicable
        ? "NOT_READY"
        : "N/A";
  process.stdout.write(
    `RunParams-500 fallback current trends probe (non-blocking): ${currentState}\n`
  );
  if (!currentResult.ready || !currentResult.applicable) {
    for (const reason of currentResult.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  }
}

function loadRecommendationsStationCopMissingSample() {
  if (!fs.existsSync(RECOMMENDATIONS_STATION_COP_MISSING_SAMPLE_FILE)) {
    return {
      payload: null,
      issues: [`sample missing: ${RECOMMENDATIONS_STATION_COP_MISSING_SAMPLE_FILE}`]
    };
  }
  try {
    return {
      payload: JSON.parse(fs.readFileSync(RECOMMENDATIONS_STATION_COP_MISSING_SAMPLE_FILE, "utf8")),
      issues: []
    };
  } catch (error) {
    return {
      payload: null,
      issues: [`sample parse failed: ${String(error)}`]
    };
  }
}

function evaluateRecommendationsStationCopMissing(payload) {
  const reasons = [];
  const sources = Array.isArray(payload?.sourceStatus?.sources) ? payload.sourceStatus.sources : [];
  const skippedRuleDetails = Array.isArray(payload?.ruleEvaluation?.skippedRuleDetails)
    ? payload.ruleEvaluation.skippedRuleDetails
    : [];

  const stationCopSourceDown = sources.some(
    (item) => item?.key === "metric.station_cop" && item?.ok === false
  );
  const stationCopFieldMissing = skippedRuleDetails.some((item) =>
    Array.isArray(item?.missingMetrics) &&
    item.missingMetrics.some(
      (metric) =>
        metric?.metric === "station_cop" && metric?.category === "field_missing_or_invalid"
    )
  );

  if (!(stationCopSourceDown && stationCopFieldMissing)) {
    return {
      applicable: false,
      ready: true,
      reasons: [
        "station_cop trigger not present (need metric.station_cop.ok=false and category=field_missing_or_invalid)"
      ]
    };
  }

  const coolingSideRule = skippedRuleDetails.find(
    (item) => item?.ruleId === "cooling-side-low-efficiency"
  );
  if (!coolingSideRule) {
    reasons.push('missing skipped rule "cooling-side-low-efficiency"');
  } else {
    const hasStationCopMetric = Array.isArray(coolingSideRule?.missingMetrics)
      ? coolingSideRule.missingMetrics.some((metric) => metric?.metric === "station_cop")
      : false;
    if (!hasStationCopMetric) {
      reasons.push('"cooling-side-low-efficiency" missingMetrics must include station_cop');
    }
  }

  return {
    applicable: true,
    ready: reasons.length === 0,
    reasons
  };
}

function runRecommendationsStationCopMissingNonBlockingProbe(exampleByPath) {
  const baseline = loadRecommendationsStationCopMissingSample();
  if (baseline.issues.length > 0) {
    process.stdout.write("Station-COP-missing probe (non-blocking): BASELINE_INVALID\n");
    for (const issue of baseline.issues) {
      process.stdout.write(`- ${issue}\n`);
    }
  } else {
    const baselineResult = evaluateRecommendationsStationCopMissing(baseline.payload);
    const baselineState =
      baselineResult.applicable && baselineResult.ready
        ? "READY"
        : baselineResult.applicable
          ? "NOT_READY"
          : "N/A";
    process.stdout.write(
      `Station-COP-missing baseline probe (non-blocking): ${baselineState}\n`
    );
    if (!baselineResult.ready || !baselineResult.applicable) {
      for (const reason of baselineResult.reasons) {
        process.stdout.write(`- ${reason}\n`);
      }
    }
  }
  process.stdout.write(
    `Station-COP-missing baseline sample: ${RECOMMENDATIONS_STATION_COP_MISSING_SAMPLE_FILE}\n`
  );

  const currentRecommendations = exampleByPath.get(RECOMMENDATIONS_PATH);
  const currentResult = evaluateRecommendationsStationCopMissing(currentRecommendations);
  const currentState =
    currentResult.applicable && currentResult.ready
      ? "READY"
      : currentResult.applicable
        ? "NOT_READY"
        : "N/A";
  process.stdout.write(
    `Station-COP-missing current recommendations probe (non-blocking): ${currentState}\n`
  );
  if (!currentResult.ready || !currentResult.applicable) {
    for (const reason of currentResult.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  }
}

async function run() {
  const doc = loadOpenApi();
  const checks = collectExamples(doc);
  const supplementalChecks = collectSupplementalExamples(doc);
  const errors = [];
  const warnings = [];
  const notices = [];
  const exampleByPath = new Map();

  for (const check of [...checks, ...supplementalChecks]) {
    if (!fs.existsSync(check.exampleFile)) {
      errors.push(`${check.pathName}: example file missing: ${check.exampleFile}`);
      continue;
    }
    let example;
    try {
      example = JSON.parse(fs.readFileSync(check.exampleFile, "utf8"));
    } catch (error) {
      errors.push(`${check.pathName}: example JSON parse failed: ${String(error)}`);
      continue;
    }
    exampleByPath.set(check.pathName, example);
    validateValue(doc, check.schema, example, check.pathName, errors);
  }

  runSourceStatusRegressions(doc, exampleByPath, errors);
  runSourceStatusSummaryCasesRegressions(errors);
  runRecommendationsRegressions(doc, checks, errors);
  runRecommendationsStationCopMissingNonBlockingProbe(exampleByPath);
  runTrendsRegressions(exampleByPath, errors);
  runAnomaliesListRegressions(exampleByPath, errors);
  runSystemDiagramRegressions(exampleByPath, errors);
  runRunParams500FallbackNonBlockingProbe(exampleByPath);
  runI18nSafetyRegressions(exampleByPath, errors, notices);
  const scanReport = runSourceKeyDriftWarnings(exampleByPath, warnings);
  writeSourceKeyScanReport(scanReport);
  const homeEnergyFallbackProbe = runHomeEnergyFallbackNonBlockingProbe(exampleByPath);
  await runRealLinkReadyNonBlockingProbe(exampleByPath, errors, {
    homeEnergyFallback: homeEnergyFallbackProbe
  });

  if (errors.length) {
    process.stderr.write("Contract validation failed:\n");
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Contract validation passed for ${checks.length + supplementalChecks.length} examples using ${path.basename(
      OPENAPI_FILE
    )}\n`
  );
  printI18nNotices(notices);
  printSourceKeyScanReport(scanReport, warnings);
  process.stdout.write(`Source key scan JSON written: ${SOURCE_KEY_SCAN_REPORT_FILE}\n`);
}

run().catch((error) => {
  process.stderr.write(`Contract validation failed: ${String(error)}\n`);
  process.exit(1);
});
