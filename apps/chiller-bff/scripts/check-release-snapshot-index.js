import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultIndexPath = path.resolve(
  __dirname,
  "../../../docs/release-snapshot-index-latest.json"
);
const indexPath = process.env.RELEASE_SNAPSHOT_INDEX_PATH
  ? path.resolve(process.env.RELEASE_SNAPSHOT_INDEX_PATH)
  : defaultIndexPath;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function mustObject(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!isObject(value)) {
    pushError(errors, jsonPath, "must be object");
    return null;
  }
  return value;
}

function mustNumber(parent, key, parentPath, errors, { integerOnly = false, min = null } = {}) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    pushError(errors, jsonPath, "must be number");
    return null;
  }
  if (integerOnly && !Number.isInteger(value)) {
    pushError(errors, jsonPath, "must be integer");
  }
  if (typeof min === "number" && value < min) {
    pushError(errors, jsonPath, `must be >= ${String(min)}`);
  }
  return value;
}

function mustString(parent, key, parentPath, errors, { nonEmpty = false } = {}) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (typeof value !== "string") {
    pushError(errors, jsonPath, "must be string");
    return null;
  }
  if (nonEmpty && value.trim().length === 0) {
    pushError(errors, jsonPath, "must be non-empty string");
  }
  return value;
}

function mustStringOrNull(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!(value === null || typeof value === "string")) {
    pushError(errors, jsonPath, "must be string or null");
    return null;
  }
  return value;
}

function mustBooleanOrNull(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!(value === null || typeof value === "boolean")) {
    pushError(errors, jsonPath, "must be boolean or null");
    return null;
  }
  return value;
}

function mustIntegerOrNull(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!(value === null || Number.isInteger(value))) {
    pushError(errors, jsonPath, "must be integer or null");
    return null;
  }
  return value;
}

function mustStringArray(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (!Array.isArray(value)) {
    pushError(errors, jsonPath, "must be array");
    return null;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      pushError(errors, `${jsonPath}[${i}]`, "must be string");
    }
  }
  return value;
}

function loadJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    pushError(errors, "/report", `file not found: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    pushError(errors, "/report", `invalid json: ${error.message}`);
    return null;
  }
}

function validateIndex(data) {
  const errors = [];
  if (!isObject(data)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  const summary = mustObject(data, "summary", "", errors);
  if (summary) {
    mustNumber(summary, "total", "/summary", errors, { integerOnly: true, min: 0 });
    mustNumber(summary, "shown", "/summary", errors, { integerOnly: true, min: 0 });
    mustNumber(summary, "go", "/summary", errors, { integerOnly: true, min: 0 });
    mustNumber(summary, "noGo", "/summary", errors, { integerOnly: true, min: 0 });
    mustNumber(summary, "unknown", "/summary", errors, { integerOnly: true, min: 0 });
  }

  if (!Array.isArray(data.entries)) {
    pushError(errors, "/entries", "must be array");
  } else {
    for (let i = 0; i < data.entries.length; i += 1) {
      const entry = data.entries[i];
      const entryPath = `/entries[${i}]`;
      if (!isObject(entry)) {
        pushError(errors, entryPath, "must be object");
        continue;
      }

      mustString(entry, "file", entryPath, errors, { nonEmpty: true });
      mustString(entry, "fileName", entryPath, errors, { nonEmpty: true });
      const decision = mustString(entry, "decision", entryPath, errors, { nonEmpty: true });
      if (typeof decision === "string" && !["GO", "NO-GO", "UNKNOWN"].includes(decision)) {
        pushError(errors, `${entryPath}/decision`, 'must be one of "GO" | "NO-GO" | "UNKNOWN"');
      }
      mustIntegerOrNull(entry, "exitCode", entryPath, errors);
      mustStringArray(entry, "reasons", entryPath, errors);
      mustStringArray(entry, "advisories", entryPath, errors);
      mustStringOrNull(entry, "mtime", entryPath, errors);
      mustStringOrNull(entry, "generatedAt", entryPath, errors);
      mustBooleanOrNull(entry, "strictFreshness", entryPath, errors);
      mustBooleanOrNull(entry, "runtimeRequired", entryPath, errors);
    }

    if (summary && Number.isInteger(summary.shown) && summary.shown !== data.entries.length) {
      pushError(
        errors,
        "/summary/shown",
        `must equal entries length (${String(data.entries.length)})`
      );
    }
  }

  return errors;
}

function assertSelfCheckCase(caseName, caseErrors, expectedPathPrefix, failures) {
  const matched = caseErrors.find((entry) => entry.startsWith(expectedPathPrefix));
  if (!matched) {
    pushError(
      failures,
      `/selfcheck/${caseName}`,
      `expected error path "${expectedPathPrefix}" not found`
    );
    return;
  }
  if (!/^\/[^:]+: .+/.test(matched)) {
    pushError(
      failures,
      `/selfcheck/${caseName}`,
      `error format mismatch, got "${matched}"`
    );
    return;
  }
  process.stdout.write(`selfcheck.${caseName}: ${matched}\n`);
}

function runSelfCheck() {
  const loadErrors = [];
  const baseline = loadJson(indexPath, loadErrors);
  if (loadErrors.length > 0) {
    process.stderr.write("Release snapshot index self-check failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  const failures = [];
  const cases = [
    {
      name: "missing-summary-total",
      expectedPathPrefix: "/summary/total:",
      mutate: (payload) => {
        if (isObject(payload.summary)) {
          delete payload.summary.total;
        }
      }
    },
    {
      name: "entry-decision-invalid",
      expectedPathPrefix: "/entries[0]/decision:",
      mutate: (payload) => {
        if (!Array.isArray(payload.entries)) {
          payload.entries = [{}];
        } else if (payload.entries.length === 0) {
          payload.entries.push({});
        }
        payload.entries[0] = {
          ...(isObject(payload.entries[0]) ? payload.entries[0] : {}),
          decision: "MAYBE"
        };
      }
    },
    {
      name: "entry-reasons-not-array",
      expectedPathPrefix: "/entries[0]/reasons:",
      mutate: (payload) => {
        if (!Array.isArray(payload.entries)) {
          payload.entries = [{}];
        } else if (payload.entries.length === 0) {
          payload.entries.push({});
        }
        payload.entries[0] = {
          ...(isObject(payload.entries[0]) ? payload.entries[0] : {}),
          reasons: "none"
        };
      }
    }
  ];

  process.stdout.write("Release snapshot index self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(baseline));
    oneCase.mutate(payload);
    const caseErrors = validateIndex(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release snapshot index self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release snapshot index self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  if (process.env.RELEASE_SNAPSHOT_INDEX_SELFTEST === "1") {
    runSelfCheck();
    return;
  }

  const errors = [];
  const index = loadJson(indexPath, errors);
  if (index) {
    errors.push(...validateIndex(index));
  }

  if (errors.length > 0) {
    process.stderr.write("Release snapshot index validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release snapshot index validation passed: ${path.relative(process.cwd(), indexPath)}\n`
  );
}

main();
