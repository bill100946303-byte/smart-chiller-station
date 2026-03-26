import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultReleaseSnapshotPath = path.resolve(
  __dirname,
  "../../../docs/release-snapshot-latest.json"
);
const legacyPreflightPath = path.resolve(
  __dirname,
  "../../../docs/v1.8-release-preflight.json"
);
const snapshotPath = process.env.RELEASE_SNAPSHOT_PATH
  ? path.resolve(process.env.RELEASE_SNAPSHOT_PATH)
  : (fs.existsSync(defaultReleaseSnapshotPath)
      ? defaultReleaseSnapshotPath
      : legacyPreflightPath);

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

function mustBoolean(parent, key, parentPath, errors) {
  const value = parent?.[key];
  const jsonPath = `${parentPath}/${key}`;
  if (typeof value !== "boolean") {
    pushError(errors, jsonPath, "must be boolean");
    return null;
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

function validateReleaseSnapshotV1(data) {
  const errors = [];
  if (!isObject(data)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  const decision = mustString(data, "decision", "", errors, { nonEmpty: true });
  if (typeof decision === "string" && !["GO", "NO-GO"].includes(decision)) {
    pushError(errors, "/decision", 'must be one of "GO" | "NO-GO"');
  }

  const exitCode = data?.exitCode;
  if (typeof exitCode !== "number" || !Number.isInteger(exitCode)) {
    pushError(errors, "/exitCode", "must be integer");
  } else if (![0, 1].includes(exitCode)) {
    pushError(errors, "/exitCode", "must be 0 or 1");
  }

  mustStringArray(data, "reasons", "", errors);
  mustStringArray(data, "advisories", "", errors);

  const checks = mustObject(data, "checks", "", errors);
  if (checks) {
    mustBoolean(checks, "verifyGatesOk", "/checks", errors);
    mustBoolean(checks, "preflightPass", "/checks", errors);
  }

  return errors;
}

function validateLegacyPreflightSnapshot(data) {
  const errors = [];
  if (!isObject(data)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  mustBoolean(data, "preflightPass", "", errors);

  const gates = mustObject(data, "gates", "", errors);
  if (gates) {
    mustBoolean(gates, "contractOk", "/gates", errors);
    mustBoolean(gates, "statusJsonOk", "/gates", errors);
    mustBoolean(gates, "shellOk", "/gates", errors);
    mustBoolean(gates, "releaseGateOk", "/gates", errors);
  }

  const releaseGate = mustObject(data, "releaseGate", "", errors);
  if (releaseGate) {
    const decision = mustString(releaseGate, "decision", "/releaseGate", errors, { nonEmpty: true });
    if (typeof decision === "string" && !["GO", "NO-GO"].includes(decision)) {
      pushError(errors, "/releaseGate/decision", 'must be one of "GO" | "NO-GO"');
    }
    mustStringArray(releaseGate, "reasons", "/releaseGate", errors);
    mustStringArray(releaseGate, "advisories", "/releaseGate", errors);
  }

  return errors;
}

function validateSnapshot(data) {
  const isReleaseSnapshotV1 =
    Object.prototype.hasOwnProperty.call(data ?? {}, "checks") &&
    (
      Object.prototype.hasOwnProperty.call(data ?? {}, "decision") ||
      Object.prototype.hasOwnProperty.call(data ?? {}, "reasons") ||
      Object.prototype.hasOwnProperty.call(data ?? {}, "advisories")
    );
  const isLegacyPreflight =
    Object.prototype.hasOwnProperty.call(data ?? {}, "preflightPass") &&
    Object.prototype.hasOwnProperty.call(data ?? {}, "gates") &&
    Object.prototype.hasOwnProperty.call(data ?? {}, "releaseGate");

  if (isReleaseSnapshotV1) {
    return validateReleaseSnapshotV1(data);
  }
  if (isLegacyPreflight) {
    return validateLegacyPreflightSnapshot(data);
  }
  return ['/: unsupported snapshot schema (expected release-snapshot v1 or legacy preflight)'];
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
  const baseline = loadJson(snapshotPath, loadErrors);
  if (loadErrors.length > 0) {
    process.stderr.write("Release snapshot self-check failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  const failures = [];
  const isReleaseSnapshotV1 =
    isObject(baseline) &&
    Object.prototype.hasOwnProperty.call(baseline, "decision") &&
    Object.prototype.hasOwnProperty.call(baseline, "checks");

  const cases = isReleaseSnapshotV1
    ? [
        {
          name: "decision-not-string",
          expectedPathPrefix: "/decision:",
          mutate: (payload) => {
            payload.decision = 123;
          }
        },
        {
          name: "checks-verify-gates-not-boolean",
          expectedPathPrefix: "/checks/verifyGatesOk:",
          mutate: (payload) => {
            if (isObject(payload.checks)) {
              payload.checks.verifyGatesOk = "true";
            }
          }
        },
        {
          name: "reasons-not-array",
          expectedPathPrefix: "/reasons:",
          mutate: (payload) => {
            payload.reasons = "preflight_not_pass";
          }
        }
      ]
    : [
        {
          name: "missing-release-gate-decision",
          expectedPathPrefix: "/releaseGate/decision:",
          mutate: (payload) => {
            if (isObject(payload.releaseGate)) {
              delete payload.releaseGate.decision;
            }
          }
        },
        {
          name: "gates-status-json-not-boolean",
          expectedPathPrefix: "/gates/statusJsonOk:",
          mutate: (payload) => {
            if (isObject(payload.gates)) {
              payload.gates.statusJsonOk = "true";
            }
          }
        },
        {
          name: "release-gate-reasons-not-array",
          expectedPathPrefix: "/releaseGate/reasons:",
          mutate: (payload) => {
            if (isObject(payload.releaseGate)) {
              payload.releaseGate.reasons = "contract_not_ok";
            }
          }
        }
      ];

  process.stdout.write("Release snapshot self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(baseline));
    oneCase.mutate(payload);
    const caseErrors = validateSnapshot(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release snapshot self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Release snapshot self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  if (process.env.RELEASE_SNAPSHOT_SELFTEST === "1") {
    runSelfCheck();
    return;
  }

  const errors = [];
  const report = loadJson(snapshotPath, errors);
  if (report) {
    errors.push(...validateSnapshot(report));
  }

  if (errors.length > 0) {
    process.stderr.write("Release snapshot validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release snapshot validation passed: ${path.relative(process.cwd(), snapshotPath)}\n`
  );
}

main();
