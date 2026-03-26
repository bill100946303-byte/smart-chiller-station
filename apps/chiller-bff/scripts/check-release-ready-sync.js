import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_READY_SYNC_PATH =
  process.env.RELEASE_READY_SYNC_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-sync-latest.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadJson(errors) {
  if (!fs.existsSync(RELEASE_READY_SYNC_PATH)) {
    pushError(errors, "/releaseReadySync", `file missing: ${RELEASE_READY_SYNC_PATH}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(RELEASE_READY_SYNC_PATH, "utf8"));
  } catch (error) {
    pushError(errors, "/releaseReadySync", `invalid JSON: ${String(error)}`);
    return null;
  }
}

function validateStep(step, pathKey, errors, requireMode = false) {
  if (!isObject(step)) {
    pushError(errors, pathKey, "must be object");
    return;
  }
  if (typeof step.ok !== "boolean") {
    pushError(errors, `${pathKey}.ok`, "must be boolean");
  }
  if (!Number.isInteger(step.exitCode)) {
    pushError(errors, `${pathKey}.exitCode`, "must be integer");
  }
  if (requireMode) {
    if (typeof step.mode !== "string") {
      pushError(errors, `${pathKey}.mode`, "must be string");
    } else if (!["read_latest", "recompute"].includes(step.mode)) {
      pushError(errors, `${pathKey}.mode`, 'must be "read_latest" | "recompute"');
    }
  }
}

function validateReleaseSubObject(value, jsonPath, errors) {
  if (!isObject(value)) {
    pushError(errors, jsonPath, "must be object");
    return;
  }
  if (typeof value.decision !== "string") {
    pushError(errors, `${jsonPath}.decision`, "must be string");
  } else if (!["GO", "NO-GO"].includes(value.decision)) {
    pushError(errors, `${jsonPath}.decision`, 'must be one of "GO" | "NO-GO"');
  }
  if (!Number.isInteger(value.exitCode)) {
    pushError(errors, `${jsonPath}.exitCode`, "must be integer");
  } else if (![0, 1].includes(value.exitCode)) {
    pushError(errors, `${jsonPath}.exitCode`, "must be 0 or 1");
  }
  for (const key of ["reasons", "advisories"]) {
    const arr = value[key];
    if (!Array.isArray(arr)) {
      pushError(errors, `${jsonPath}.${key}`, "must be array");
      continue;
    }
    for (let i = 0; i < arr.length; i += 1) {
      if (typeof arr[i] !== "string") {
        pushError(errors, `${jsonPath}.${key}[${i}]`, "must be string");
      }
    }
  }
}

function validatePayload(payload) {
  const errors = [];
  if (!isObject(payload)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  if (typeof payload.version !== "string") {
    pushError(errors, "/version", "must be string");
  }
  if (typeof payload.generatedAt !== "string") {
    pushError(errors, "/generatedAt", "must be string");
  }

  if (typeof payload.decision !== "string") {
    pushError(errors, "/decision", "must be string");
  } else if (!["GO", "NO-GO"].includes(payload.decision)) {
    pushError(errors, "/decision", 'must be one of "GO" | "NO-GO"');
  }

  if (!Number.isInteger(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be integer");
  } else if (![0, 1].includes(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be 0 or 1");
  }

  if (!isObject(payload.inputs)) {
    pushError(errors, "/inputs", "must be object");
  } else {
    for (const key of ["strictFreshness", "runtimeRequired", "recompute"]) {
      if (typeof payload.inputs[key] !== "boolean") {
        pushError(errors, `/inputs.${key}`, "must be boolean");
      }
    }
  }

  if (!isObject(payload.steps)) {
    pushError(errors, "/steps", "must be object");
  } else {
    validateStep(payload.steps.releaseReady, "/steps.releaseReady", errors, true);
    validateStep(payload.steps.releaseReadyCheck, "/steps.releaseReadyCheck", errors);
    validateStep(payload.steps.releaseReadyLatest, "/steps.releaseReadyLatest", errors);
  }

  validateReleaseSubObject(payload.releaseReady, "/releaseReady", errors);
  validateReleaseSubObject(payload.releaseReadyLatest, "/releaseReadyLatest", errors);

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

function runSelfCheck(basePayload) {
  const failures = [];
  const cases = [
    {
      name: "missing-steps",
      expectedPathPrefix: "/steps:",
      mutate: (payload) => {
        delete payload.steps;
      }
    },
    {
      name: "invalid-release-ready-latest-decision",
      expectedPathPrefix: "/releaseReadyLatest.decision:",
      mutate: (payload) => {
        payload.releaseReadyLatest.decision = "UNKNOWN";
      }
    },
    {
      name: "invalid-step-mode",
      expectedPathPrefix: "/steps.releaseReady.mode:",
      mutate: (payload) => {
        payload.steps.releaseReady.mode = "invalid_mode";
      }
    }
  ];

  process.stdout.write("Release-ready-sync self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-ready-sync self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready-sync self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const payload = loadJson(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Release-ready-sync validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.RELEASE_READY_SYNC_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Release-ready-sync validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready-sync validation passed: ${RELEASE_READY_SYNC_PATH}\n`);
}

main();
