import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH =
  process.env.RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest-check.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadPayload(errors) {
  if (!fs.existsSync(RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH)) {
    pushError(
      errors,
      "/releaseCommandCenterLatestCheck",
      `file missing: ${RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH}`
    );
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(
      errors,
      "/releaseCommandCenterLatestCheck",
      `invalid JSON: ${String(error)}`
    );
    return null;
  }
}

function validatePayload(payload) {
  const errors = [];
  if (typeof payload.version !== "string" || payload.version.trim().length === 0) {
    pushError(errors, "/version", "must be non-empty string");
  }
  if (typeof payload.generatedAt !== "string" || payload.generatedAt.trim().length === 0) {
    pushError(errors, "/generatedAt", "must be non-empty string");
  }
  if (typeof payload.source !== "string") {
    pushError(errors, "/source", "must be string");
  } else if (!["latest_file"].includes(payload.source)) {
    pushError(errors, "/source", 'must be "latest_file"');
  }
  if (typeof payload.decision !== "string") {
    pushError(errors, "/decision", "must be string");
  } else if (!["GO", "NO-GO"].includes(payload.decision)) {
    pushError(errors, "/decision", 'must be one of "GO" | "NO-GO"');
  }
  if (typeof payload.summaryClass !== "string") {
    pushError(errors, "/summaryClass", "must be string");
  } else if (!["ready", "blocked", "review_required"].includes(payload.summaryClass)) {
    pushError(errors, "/summaryClass", 'must be one of "ready" | "blocked" | "review_required"');
  }
  if (!Number.isInteger(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be integer");
  } else if (![0, 1].includes(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be 0 or 1");
  }
  for (const key of ["reasons", "advisories"]) {
    const arr = payload[key];
    if (!Array.isArray(arr)) {
      pushError(errors, `/${key}`, "must be array");
      continue;
    }
    for (let i = 0; i < arr.length; i += 1) {
      if (typeof arr[i] !== "string") {
        pushError(errors, `/${key}[${i}]`, "must be string");
      }
    }
  }
  if (typeof payload.firstAction !== "string" || payload.firstAction.trim().length === 0) {
    pushError(errors, "/firstAction", "must be non-empty string");
  }
  if (typeof payload.consistencyOk !== "boolean") {
    pushError(errors, "/consistencyOk", "must be boolean");
  }
  if (!(typeof payload.upstreamGeneratedAt === "string" || payload.upstreamGeneratedAt === null)) {
    pushError(errors, "/upstreamGeneratedAt", "must be string or null");
  }
  if (typeof payload.upstreamPath !== "string" || payload.upstreamPath.trim().length === 0) {
    pushError(errors, "/upstreamPath", "must be non-empty string");
  }
  if (payload.decision === "GO" && payload.exitCode !== 0) {
    pushError(errors, "/exitCode", "must be 0 when decision=GO");
  }
  if (payload.decision === "NO-GO" && payload.exitCode !== 1) {
    pushError(errors, "/exitCode", "must be 1 when decision=NO-GO");
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
    pushError(failures, `/selfcheck/${caseName}`, `error format mismatch, got "${matched}"`);
    return;
  }
  process.stdout.write(`selfcheck.${caseName}: ${matched}\n`);
}

function runSelfCheck(basePayload) {
  const failures = [];
  const cases = [
    {
      name: "missing-decision",
      expectedPathPrefix: "/decision:",
      mutate: (payload) => {
        delete payload.decision;
      }
    },
    {
      name: "invalid-summary-class",
      expectedPathPrefix: "/summaryClass:",
      mutate: (payload) => {
        payload.summaryClass = "unsafe";
      }
    },
    {
      name: "missing-consistency-ok",
      expectedPathPrefix: "/consistencyOk:",
      mutate: (payload) => {
        delete payload.consistencyOk;
      }
    }
  ];

  process.stdout.write("Release-command-center-latest-check self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-command-center-latest-check self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(
    `Release-command-center-latest-check self-check passed: ${cases.length}/${cases.length}\n`
  );
}

function main() {
  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Release-command-center-latest-check validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.RELEASE_COMMAND_CENTER_LATEST_CHECK_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Release-command-center-latest-check validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release-command-center-latest-check validation passed: ${RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH}\n`
  );
}

main();
