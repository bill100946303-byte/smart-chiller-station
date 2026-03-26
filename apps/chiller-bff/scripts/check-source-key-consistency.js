import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const OPENAPI_FILE = path.resolve(process.cwd(), "openapi/bff-v1.yaml");
const DICT_FILE = path.resolve(process.cwd(), "../../docs/source-status-key-dictionary-v1.2.json");
const SUMMARY_CASES_FILE = path.resolve(process.cwd(), "openapi/examples/source-status-summary-cases.json");
const REPORT_FILE = path.resolve(process.cwd(), "openapi/examples/source-key-consistency-report.json");
const SOURCE_STATUS_PATHS = [
  "/bff/v1/sites/{siteId}/dashboard/overview",
  "/bff/v1/sites/{siteId}/dashboard/trends",
  "/bff/v1/sites/{siteId}/anomalies/summary",
  "/bff/v1/sites/{siteId}/recommendations"
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function normalizeSchema(doc, schema) {
  if (!schema) {
    return {};
  }
  if (schema.$ref && schema.$ref.startsWith("#/")) {
    const segments = schema.$ref
      .slice(2)
      .split("/")
      .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
    let current = doc;
    for (const segment of segments) {
      current = current?.[segment];
      if (current === undefined) {
        throw new Error(`Unresolved ref: ${schema.$ref}`);
      }
    }
    return normalizeSchema(doc, current);
  }
  return schema;
}

function getSourceKeyPattern(doc) {
  const sourceEndpointStatus = normalizeSchema(doc, doc?.components?.schemas?.SourceEndpointStatus);
  const pattern = sourceEndpointStatus?.properties?.key?.pattern;
  if (typeof pattern !== "string") {
    throw new Error("components.schemas.SourceEndpointStatus.properties.key.pattern is required");
  }
  return new RegExp(pattern);
}

function collectExamplePayloads(doc) {
  const payloads = [];
  for (const pathName of SOURCE_STATUS_PATHS) {
    const externalValue =
      doc?.paths?.[pathName]?.get?.responses?.["200"]?.content?.["application/json"]?.examples?.default?.externalValue;
    if (!externalValue) {
      throw new Error(`${pathName}: missing default example externalValue`);
    }
    const examplePath = path.resolve(path.dirname(OPENAPI_FILE), externalValue);
    const json = loadJson(examplePath);
    payloads.push({ pathName, json });
  }

  if (fs.existsSync(SUMMARY_CASES_FILE)) {
    const summaryCases = loadJson(SUMMARY_CASES_FILE);
    if (Array.isArray(summaryCases?.cases)) {
      summaryCases.cases.forEach((item, index) => {
        payloads.push({
          pathName: `source-status-summary-cases.cases[${index}]`,
          json: item
        });
      });
    }
  }

  return payloads;
}

function collectSourceKeys(payloads) {
  const records = [];
  for (const payload of payloads) {
    const sources = payload?.json?.sourceStatus?.sources;
    if (!Array.isArray(sources)) {
      continue;
    }
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      if (typeof source?.key === "string") {
        records.push({
          key: source.key,
          path: `${payload.pathName}.sourceStatus.sources[${i}].key`
        });
      }
    }
  }
  return records;
}

function buildMappingSets(dict) {
  const labels = dict?.labels || {};
  const aliases = dict?.convergence?.aliases || {};
  const staticKeys = new Set(
    Object.keys(labels)
      .filter((key) => !key.startsWith("metric."))
      .map((key) => key.trim())
  );
  const aliasKeys = new Set(Object.keys(aliases).map((key) => key.trim()));

  const metricBaseKeys = new Set();
  const metricFieldMap = dict?.metricTemplate?.fieldCnMap || {};
  for (const fieldName of Object.keys(metricFieldMap)) {
    metricBaseKeys.add(`metric.${fieldName}`);
  }
  for (const labelKey of Object.keys(labels)) {
    if (labelKey.startsWith("metric.")) {
      metricBaseKeys.add(labelKey);
    }
  }

  return { staticKeys, aliasKeys, metricBaseKeys };
}

function addExamplePath(map, key, pathName) {
  if (!map[key]) {
    map[key] = [];
  }
  if (!map[key].includes(pathName)) {
    map[key].push(pathName);
  }
}

function main() {
  const errors = [];
  const warnings = [];
  const notices = [];

  let doc = null;
  let dict = null;
  let patternRegex = null;
  let payloads = [];
  let records = [];

  try {
    doc = loadYaml(OPENAPI_FILE);
    dict = loadJson(DICT_FILE);
    patternRegex = getSourceKeyPattern(doc);
    payloads = collectExamplePayloads(doc);
    records = collectSourceKeys(payloads);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`<bootstrap>: ${message}`);
    process.exit(1);
  }

  const { staticKeys, aliasKeys, metricBaseKeys } = buildMappingSets(dict);
  const uniqueKeys = new Set();
  const unknownStaticKeys = new Set();
  const newMetricKeys = new Set();
  const examplePaths = {};

  for (const item of records) {
    const key = item.key;
    uniqueKeys.add(key);
    addExamplePath(examplePaths, key, item.path);

    if (!patternRegex.test(key)) {
      errors.push(`${item.path}: value "${key}" does not match pattern ${patternRegex.source}`);
      continue;
    }

    if (key.startsWith("metric.")) {
      if (!metricBaseKeys.has(key)) {
        newMetricKeys.add(key);
        warnings.push(`${item.path}: [warning] new metric key "${key}" requires dictionary update`);
      }
      continue;
    }

    if (!staticKeys.has(key) && !aliasKeys.has(key)) {
      unknownStaticKeys.add(key);
      errors.push(`${item.path}: static key "${key}" missing mapping in docs/source-status-key-dictionary-v1.2.json`);
    }
  }

  if (records.length === 0) {
    notices.push("no sourceStatus.sources[*].key found in example payloads");
  }

  const report = {
    status: errors.length > 0 ? "fail" : "pass",
    summary: {
      checkedCount: records.length,
      uniqueKeys: Array.from(uniqueKeys).sort((a, b) => a.localeCompare(b)),
      unknownStaticKeys: Array.from(unknownStaticKeys).sort((a, b) => a.localeCompare(b)),
      newMetricKeys: Array.from(newMetricKeys).sort((a, b) => a.localeCompare(b)),
      errorCount: errors.length,
      warningCount: warnings.length
    },
    examplePaths,
    errors,
    warnings,
    notices
  };

  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (report.status === "pass") {
    console.log("Source key consistency check passed.");
  } else {
    console.error("Source key consistency check failed.");
  }
  console.log(`- checked=${report.summary.checkedCount}, unique=${report.summary.uniqueKeys.length}`);
  console.log(`- errors=${errors.length}, warnings=${warnings.length}`);
  console.log(`- report=${REPORT_FILE}`);

  for (const message of warnings) {
    console.log(message);
  }
  for (const message of errors) {
    console.error(message);
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
