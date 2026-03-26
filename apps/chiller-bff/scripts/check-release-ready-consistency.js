import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_READY_CONSISTENCY_PATH =
  process.env.RELEASE_READY_CONSISTENCY_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-consistency-latest.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadPayload(errors) {
  if (!fs.existsSync(RELEASE_READY_CONSISTENCY_PATH)) {
    pushError(errors, "/releaseReadyConsistency", `file missing: ${RELEASE_READY_CONSISTENCY_PATH}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RELEASE_READY_CONSISTENCY_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, "/releaseReadyConsistency", `invalid JSON: ${String(error)}`);
    return null;
  }
}

function validateStep(step, pathKey, errors) {
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
}

function validatePayload(payload) {
  const errors = [];
  if (typeof payload.version !== "string" || payload.version.trim().length === 0) {
    pushError(errors, "/version", "must be non-empty string");
  }
  if (typeof payload.generatedAt !== "string" || payload.generatedAt.trim().length === 0) {
    pushError(errors, "/generatedAt", "must be non-empty string");
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

  if (!Array.isArray(payload.reasons)) {
    pushError(errors, "/reasons", "must be array");
  } else {
    for (let i = 0; i < payload.reasons.length; i += 1) {
      if (typeof payload.reasons[i] !== "string" || !/^[a-z0-9_]+$/.test(payload.reasons[i])) {
        pushError(errors, `/reasons[${i}]`, "must be snake_case string");
      }
    }
  }
  if (!Array.isArray(payload.advisories)) {
    pushError(errors, "/advisories", "must be array");
  }

  if (!isObject(payload.steps)) {
    pushError(errors, "/steps", "must be object");
  } else {
    validateStep(payload.steps.releaseReadyLatestCheck, "/steps.releaseReadyLatestCheck", errors);
    validateStep(payload.steps.checkFamilyConsistency, "/steps.checkFamilyConsistency", errors);
    validateStep(payload.steps.checkFamilyOverall, "/steps.checkFamilyOverall", errors);
  }

  if (!isObject(payload.releaseReadyLatest)) {
    pushError(errors, "/releaseReadyLatest", "must be object");
  } else if (typeof payload.releaseReadyLatest.decision !== "string") {
    pushError(errors, "/releaseReadyLatest.decision", "must be string");
  }
  if (!isObject(payload.checkFamilyLatest)) {
    pushError(errors, "/checkFamilyLatest", "must be object");
  } else if (typeof payload.checkFamilyLatest.overall !== "string") {
    pushError(errors, "/checkFamilyLatest.overall", "must be string");
  }
  if (!isObject(payload.checkFamilyBriefLatest)) {
    pushError(errors, "/checkFamilyBriefLatest", "must be object");
  } else if (typeof payload.checkFamilyBriefLatest.overall !== "string") {
    pushError(errors, "/checkFamilyBriefLatest.overall", "must be string");
  }

  if (
    payload.decision === "GO" &&
    Array.isArray(payload.reasons) &&
    isObject(payload.steps) &&
    isObject(payload.releaseReadyLatest) &&
    isObject(payload.checkFamilyLatest)
  ) {
    if (payload.reasons.length !== 0) {
      pushError(errors, "/reasons", "must be empty when decision=GO");
    }
    if (payload.exitCode !== 0) {
      pushError(errors, "/exitCode", "must be 0 when decision=GO");
    }
    if (payload.steps.releaseReadyLatestCheck?.ok !== true) {
      pushError(errors, "/steps.releaseReadyLatestCheck.ok", "must be true when decision=GO");
    }
    if (payload.steps.checkFamilyConsistency?.ok !== true) {
      pushError(errors, "/steps.checkFamilyConsistency.ok", "must be true when decision=GO");
    }
    if (payload.steps.checkFamilyOverall?.ok !== true) {
      pushError(errors, "/steps.checkFamilyOverall.ok", "must be true when decision=GO");
    }
    if (payload.releaseReadyLatest.decision !== "GO") {
      pushError(errors, "/releaseReadyLatest.decision", "must be GO when decision=GO");
    }
    if (payload.checkFamilyLatest.overall !== "PASS") {
      pushError(errors, "/checkFamilyLatest.overall", "must be PASS when decision=GO");
    }
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
      name: "invalid-step-ok",
      expectedPathPrefix: "/steps.checkFamilyConsistency.ok:",
      mutate: (payload) => {
        payload.steps.checkFamilyConsistency.ok = "true";
      }
    },
    {
      name: "go-with-reasons",
      expectedPathPrefix: "/reasons:",
      mutate: (payload) => {
        payload.decision = "GO";
        payload.exitCode = 0;
        payload.reasons = ["check_family_not_pass"];
      }
    }
  ];

  process.stdout.write("Release-ready-consistency self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-ready-consistency self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Release-ready-consistency self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Release-ready-consistency validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.RELEASE_READY_CONSISTENCY_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Release-ready-consistency validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready-consistency validation passed: ${RELEASE_READY_CONSISTENCY_PATH}\n`);
}

main();
