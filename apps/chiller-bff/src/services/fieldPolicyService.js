import fs from "node:fs";

let cachedPath = null;
let cachedMap = new Map();

function readDictionaryMap(filePath) {
  if (!filePath) {
    return new Map();
  }
  if (cachedPath === filePath) {
    return cachedMap;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const fields = Array.isArray(parsed?.fields) ? parsed.fields : [];
    const map = new Map(fields.map((field) => [field.field_name, field.null_strategy]));
    cachedPath = filePath;
    cachedMap = map;
    return map;
  } catch (_error) {
    cachedPath = filePath;
    cachedMap = new Map();
    return cachedMap;
  }
}

function sanitizeValue(value) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function defaultNeverNull(fieldName, fallbackValue) {
  if (fallbackValue !== undefined && fallbackValue !== null) {
    return fallbackValue;
  }
  if (fieldName === "generated_at") {
    return new Date().toISOString();
  }
  if (fieldName === "site_id") {
    return "unknown-site";
  }
  if (fieldName.endsWith("_count")) {
    return 0;
  }
  return "";
}

export function applyFieldNullStrategy(config, fieldName, value, fallbackValue = null) {
  const strategy = readDictionaryMap(config.fieldDictionaryFile).get(fieldName);
  const sanitized = sanitizeValue(value);

  switch (strategy) {
    case "never_null":
      return sanitized ?? defaultNeverNull(fieldName, fallbackValue);
    case "use_default_empty_string":
      return sanitized === null || sanitized === undefined ? "" : String(sanitized);
    case "use_default_false":
      return sanitized === null || sanitized === undefined ? false : Boolean(sanitized);
    case "use_default_0":
      return sanitized === null || sanitized === undefined ? 0 : sanitized;
    case "use_default_minor":
      return sanitized === null || sanitized === undefined ? "minor" : sanitized;
    case "use_default_null":
    case "return_null":
      return sanitized ?? null;
    default:
      return sanitized;
  }
}

export function buildGeneratedAt(config) {
  return applyFieldNullStrategy(config, "generated_at", new Date().toISOString());
}

export function countMissingCriticalMetrics(metricMap) {
  if (!metricMap || typeof metricMap !== "object") {
    return 0;
  }
  return Object.values(metricMap).filter((value) => value === null || value === undefined).length;
}
