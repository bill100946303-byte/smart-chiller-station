import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultReportPath = path.resolve(
  __dirname,
  "../../../docs/v19.2-acceptance-report.json"
);
const reportPath = process.env.ACCEPTANCE_REPORT_PATH
  ? path.resolve(process.env.ACCEPTANCE_REPORT_PATH)
  : defaultReportPath;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mustObject(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}.${key}`;
  if (!isObject(value)) {
    errors.push(`${jsonPath}: must be object`);
    return null;
  }
  return value;
}

function mustString(parent, key, parentPath, errors, { nonEmpty = false } = {}) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}.${key}`;
  if (typeof value !== "string") {
    errors.push(`${jsonPath}: must be string`);
    return null;
  }
  if (nonEmpty && value.trim() === "") {
    errors.push(`${jsonPath}: must be non-empty string`);
  }
  return value;
}

function mustBoolean(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}.${key}`;
  if (typeof value !== "boolean") {
    errors.push(`${jsonPath}: must be boolean`);
    return null;
  }
  return value;
}

function mustStatusString(parent, key, parentPath, errors) {
  const value = mustString(parent, key, parentPath, errors, { nonEmpty: true });
  if (typeof value === "string" && !/^\d{3}$/.test(value)) {
    errors.push(`${parentPath}.${key}: must be 3-digit HTTP status string`);
  }
  return value;
}

function loadJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`/report: file not found: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`/report: invalid json: ${error.message}`);
    return null;
  }
}

function validateReport(data) {
  const errors = [];

  if (!isObject(data)) {
    errors.push("/: must be object");
    return errors;
  }

  mustString(data, "version", "/", errors, { nonEmpty: true });
  mustString(data, "siteId", "/", errors, { nonEmpty: true });
  mustString(data, "generatedAt", "/", errors, { nonEmpty: true });
  mustBoolean(data, "overallPass", "/", errors);
  if (Object.prototype.hasOwnProperty.call(data, "runtimeUnavailable")) {
    mustBoolean(data, "runtimeUnavailable", "/", errors);
  }

  const entry = mustObject(data, "entry", "/", errors);
  if (entry) {
    mustString(entry, "mode", "/entry", errors, { nonEmpty: true });
    mustBoolean(entry, "port3001Ok", "/entry", errors);
  }

  const contract = mustObject(data, "contract", "/", errors);
  if (contract) {
    mustBoolean(contract, "ok", "/contract", errors);
  }

  const stack = mustObject(data, "stack", "/", errors);
  if (stack) {
    mustBoolean(stack, "ok", "/stack", errors);
    mustStatusString(stack, "legacyHealthStatus", "/stack", errors);
    mustStatusString(stack, "bffHealthStatus", "/stack", errors);
    mustStatusString(stack, "frontendStatus", "/stack", errors);
  }

  const readiness = mustObject(data, "readiness", "/", errors);
  if (readiness) {
    mustBoolean(readiness, "nonDegradedReady", "/readiness", errors);
  }

  const badge = mustObject(data, "badge", "/", errors);
  if (badge) {
    mustBoolean(badge, "globalPass", "/badge", errors);
  }

  const endpoints = mustObject(data, "endpoints", "/", errors);
  if (endpoints) {
    for (const key of ["overview", "trends", "anomalies", "recommendations"]) {
      const endpoint = mustObject(endpoints, key, "/endpoints", errors);
      if (!endpoint) continue;
      mustStatusString(endpoint, "status", `/endpoints.${key}`, errors);
      mustString(endpoint, "overall", `/endpoints.${key}`, errors);
      mustBoolean(endpoint, "ok", `/endpoints.${key}`, errors);
    }
  }

  return errors;
}

function assertSelfCheckCase(caseName, caseErrors, expectedPathPrefix, failures) {
  const matched = caseErrors.find((entry) => entry.startsWith(expectedPathPrefix));
  if (!matched) {
    failures.push(
      `selfcheck.${caseName}: expected error path "${expectedPathPrefix}" not found`
    );
    return;
  }
  if (!/^[^:]+: .+/.test(matched)) {
    failures.push(
      `selfcheck.${caseName}: error line does not match "<json_path>: <error_message>", got "${matched}"`
    );
    return;
  }
  console.log(`selfcheck.${caseName}: ${matched}`);
}

function runSelfCheck() {
  const loadErrors = [];
  const baseline = loadJson(reportPath, loadErrors);
  if (loadErrors.length > 0) {
    console.error("Acceptance report self-check failed:");
    for (const err of loadErrors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  const failures = [];
  const cases = [
    {
      name: "missing-entry-mode",
      expectedPathPrefix: "/entry.mode:",
      mutate: (payload) => {
        if (payload?.entry && typeof payload.entry === "object") {
          delete payload.entry.mode;
        }
      }
    },
    {
      name: "overview-status-not-3-digit",
      expectedPathPrefix: "/endpoints.overview.status:",
      mutate: (payload) => {
        if (payload?.endpoints?.overview && typeof payload.endpoints.overview === "object") {
          payload.endpoints.overview.status = "20";
        }
      }
    },
    {
      name: "badge-global-pass-not-boolean",
      expectedPathPrefix: "/badge.globalPass:",
      mutate: (payload) => {
        if (payload?.badge && typeof payload.badge === "object") {
          payload.badge.globalPass = "true";
        }
      }
    }
  ];

  console.log("Acceptance report self-check mode enabled");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(baseline));
    oneCase.mutate(payload);
    const caseErrors = validateReport(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    console.error("Acceptance report self-check failed:");
    for (const err of failures) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log(`Acceptance report self-check passed: ${cases.length}/${cases.length}`);
}

function main() {
  if (process.env.ACCEPTANCE_REPORT_SELFTEST === "1") {
    runSelfCheck();
    return;
  }

  const errors = [];
  const report = loadJson(reportPath, errors);
  if (report) {
    errors.push(...validateReport(report));
  }

  if (errors.length > 0) {
    console.error("Acceptance report validation failed:");
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Acceptance report validation passed: ${path.relative(process.cwd(), reportPath)}`
  );
}

main();
