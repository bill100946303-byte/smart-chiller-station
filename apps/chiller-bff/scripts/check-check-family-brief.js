import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const CHECK_FAMILY_BRIEF_PATH =
  process.env.CHECK_FAMILY_BRIEF_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadPayload(errors) {
  if (!fs.existsSync(CHECK_FAMILY_BRIEF_PATH)) {
    pushError(errors, "/checkFamilyBrief", `file missing: ${CHECK_FAMILY_BRIEF_PATH}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CHECK_FAMILY_BRIEF_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, "/checkFamilyBrief", `invalid JSON: ${String(error)}`);
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
  if (typeof payload.overall !== "string") {
    pushError(errors, "/overall", "must be string");
  } else if (!["PASS", "FAIL"].includes(payload.overall)) {
    pushError(errors, "/overall", 'must be one of "PASS" | "FAIL"');
  }
  if (!Number.isInteger(payload.passedCount) || payload.passedCount < 0) {
    pushError(errors, "/passedCount", "must be non-negative integer");
  }
  if (!Number.isInteger(payload.totalCount) || payload.totalCount < 1) {
    pushError(errors, "/totalCount", "must be integer >= 1");
  }
  if (!Number.isInteger(payload.failedCount) || payload.failedCount < 0) {
    pushError(errors, "/failedCount", "must be non-negative integer");
  }

  if (
    Number.isInteger(payload.passedCount) &&
    Number.isInteger(payload.totalCount) &&
    Number.isInteger(payload.failedCount)
  ) {
    if (payload.passedCount + payload.failedCount !== payload.totalCount) {
      pushError(errors, "/failedCount", "must satisfy passedCount + failedCount == totalCount");
    }
  }

  if (!Array.isArray(payload.topFailedChecks)) {
    pushError(errors, "/topFailedChecks", "must be array");
  } else {
    if (payload.topFailedChecks.length > 3) {
      pushError(errors, "/topFailedChecks", "must contain at most 3 items");
    }
    for (let i = 0; i < payload.topFailedChecks.length; i += 1) {
      if (typeof payload.topFailedChecks[i] !== "string") {
        pushError(errors, `/topFailedChecks[${i}]`, "must be string");
      }
    }
  }

  if (!isObject(payload.freshness)) {
    pushError(errors, "/freshness", "must be object");
  } else {
    if (typeof payload.freshness.state !== "string") {
      pushError(errors, "/freshness/state", "must be string");
    } else if (!["fresh", "warn", "stale", "unknown"].includes(payload.freshness.state)) {
      pushError(errors, "/freshness/state", 'must be one of "fresh" | "warn" | "stale" | "unknown"');
    }
    for (const key of ["ageMinutes", "warnAgeMin", "staleAgeMin", "maxAgeMin"]) {
      if (!Number.isInteger(payload.freshness[key])) {
        pushError(errors, `/freshness/${key}`, "must be integer");
      }
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
    pushError(failures, `/selfcheck/${caseName}`, `error format mismatch, got "${matched}"`);
    return;
  }
  process.stdout.write(`selfcheck.${caseName}: ${matched}\n`);
}

function runSelfCheck(basePayload) {
  const failures = [];
  const cases = [
    {
      name: "missing-overall",
      expectedPathPrefix: "/overall:",
      mutate: (payload) => {
        delete payload.overall;
      }
    },
    {
      name: "invalid-freshness-state",
      expectedPathPrefix: "/freshness/state:",
      mutate: (payload) => {
        payload.freshness.state = "bad";
      }
    },
    {
      name: "too-many-top-failed",
      expectedPathPrefix: "/topFailedChecks:",
      mutate: (payload) => {
        payload.topFailedChecks = ["a", "b", "c", "d"];
      }
    }
  ];

  process.stdout.write("Check-family-brief self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Check-family-brief self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Check-family-brief self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Check-family-brief validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.CHECK_FAMILY_BRIEF_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Check-family-brief validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Check-family-brief validation passed: ${CHECK_FAMILY_BRIEF_PATH}\n`);
}

main();
