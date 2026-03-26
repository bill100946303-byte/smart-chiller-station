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

function loadSyncPayload(errors) {
  if (!fs.existsSync(RELEASE_READY_SYNC_PATH)) {
    pushError(errors, "/releaseReadySync", `file missing: ${RELEASE_READY_SYNC_PATH}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(RELEASE_READY_SYNC_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/releaseReadySync", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, "/releaseReadySync", `invalid JSON: ${String(error)}`);
    return null;
  }
}

function toBrief(syncPayload) {
  return {
    decision: syncPayload.decision ?? "NO-GO",
    exitCode: syncPayload.exitCode ?? 1,
    stepReleaseReadyOk: syncPayload.steps?.releaseReady?.ok ?? false,
    stepReleaseReadyMode: syncPayload.steps?.releaseReady?.mode ?? "unknown",
    stepReleaseReadyCheckOk: syncPayload.steps?.releaseReadyCheck?.ok ?? false,
    stepReleaseReadyLatestOk: syncPayload.steps?.releaseReadyLatest?.ok ?? false,
    latestDecision: syncPayload.releaseReadyLatest?.decision ?? "unknown",
    latestGeneratedAt: syncPayload.releaseReadyLatest?.generatedAt ?? "unknown",
    reasons: syncPayload.releaseReadyLatest?.reasons ?? [],
    advisories: syncPayload.releaseReadyLatest?.advisories ?? []
  };
}

function validateBrief(brief) {
  const errors = [];
  if (!isObject(brief)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  if (typeof brief.decision !== "string") {
    pushError(errors, "/decision", "must be string");
  } else if (!["GO", "NO-GO"].includes(brief.decision)) {
    pushError(errors, "/decision", 'must be one of "GO" | "NO-GO"');
  }

  if (!Number.isInteger(brief.exitCode)) {
    pushError(errors, "/exitCode", "must be integer");
  } else if (![0, 1].includes(brief.exitCode)) {
    pushError(errors, "/exitCode", "must be 0 or 1");
  }

  for (const key of [
    "stepReleaseReadyOk",
    "stepReleaseReadyCheckOk",
    "stepReleaseReadyLatestOk"
  ]) {
    if (typeof brief[key] !== "boolean") {
      pushError(errors, `/${key}`, "must be boolean");
    }
  }

  if (typeof brief.stepReleaseReadyMode !== "string") {
    pushError(errors, "/stepReleaseReadyMode", "must be string");
  } else if (!["read_latest", "recompute", "unknown"].includes(brief.stepReleaseReadyMode)) {
    pushError(
      errors,
      "/stepReleaseReadyMode",
      'must be one of "read_latest" | "recompute" | "unknown"'
    );
  }

  if (typeof brief.latestDecision !== "string") {
    pushError(errors, "/latestDecision", "must be string");
  } else if (!["GO", "NO-GO", "unknown"].includes(brief.latestDecision)) {
    pushError(errors, "/latestDecision", 'must be one of "GO" | "NO-GO" | "unknown"');
  }

  if (typeof brief.latestGeneratedAt !== "string") {
    pushError(errors, "/latestGeneratedAt", "must be string");
  }

  for (const key of ["reasons", "advisories"]) {
    const value = brief[key];
    if (!Array.isArray(value)) {
      pushError(errors, `/${key}`, "must be array");
      continue;
    }
    for (let i = 0; i < value.length; i += 1) {
      if (typeof value[i] !== "string") {
        pushError(errors, `/${key}[${i}]`, "must be string");
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

function runSelfCheck(baseBrief) {
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
      name: "invalid-step-mode",
      expectedPathPrefix: "/stepReleaseReadyMode:",
      mutate: (payload) => {
        payload.stepReleaseReadyMode = "bad_mode";
      }
    },
    {
      name: "reasons-not-array",
      expectedPathPrefix: "/reasons:",
      mutate: (payload) => {
        payload.reasons = "none";
      }
    }
  ];

  process.stdout.write("Release-ready-brief self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(baseBrief));
    oneCase.mutate(payload);
    const caseErrors = validateBrief(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-ready-brief self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready-brief self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const syncPayload = loadSyncPayload(loadErrors);
  if (loadErrors.length > 0 || !syncPayload) {
    process.stderr.write("Release-ready-brief validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  const brief = toBrief(syncPayload);

  if (process.env.RELEASE_READY_BRIEF_SELFTEST === "1") {
    runSelfCheck(brief);
    return;
  }

  const errors = validateBrief(brief);
  if (errors.length > 0) {
    process.stderr.write("Release-ready-brief validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready-brief validation passed: ${RELEASE_READY_SYNC_PATH}\n`);
}

main();
