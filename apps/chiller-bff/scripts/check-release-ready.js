import path from "node:path";
import fs from "node:fs";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_READY_PATH =
  process.env.RELEASE_READY_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest.json");
const RELEASE_SNAPSHOT_PATH = path.resolve(ROOT_DIR, "docs/release-snapshot-latest.json");
const RELEASE_SNAPSHOT_DIFF_PATH = path.resolve(ROOT_DIR, "docs/release-snapshot-diff-latest.json");
const RELEASE_SNAPSHOT_CONSISTENCY_PATH = path.resolve(
  ROOT_DIR,
  "docs/release-snapshot-consistency-latest.json"
);

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "file missing", payload: null };
  }
  try {
    return { ok: true, payload: JSON.parse(fs.readFileSync(filePath, "utf8")), error: null };
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${String(error)}`, payload: null };
  }
}

function loadReleaseReadyPayload(errors) {
  const releaseReadyJson = parseJsonFile(RELEASE_READY_PATH);
  if (releaseReadyJson.ok && isObject(releaseReadyJson.payload)) {
    return { payload: releaseReadyJson.payload, source: "latest_file" };
  }
  const snapshotJson = parseJsonFile(RELEASE_SNAPSHOT_PATH);
  if (!snapshotJson.ok || !isObject(snapshotJson.payload)) {
    pushError(
      errors,
      "/releaseReadyFallback/snapshot",
      `invalid payload (${RELEASE_SNAPSHOT_PATH}): ${snapshotJson.error || "unknown"}`
    );
    return null;
  }

  const diffJson = parseJsonFile(RELEASE_SNAPSHOT_DIFF_PATH);
  if (!diffJson.ok || !isObject(diffJson.payload)) {
    pushError(
      errors,
      "/releaseReadyFallback/diff",
      `invalid payload (${RELEASE_SNAPSHOT_DIFF_PATH}): ${diffJson.error || "unknown"}`
    );
    return null;
  }

  const consistencyJson = parseJsonFile(RELEASE_SNAPSHOT_CONSISTENCY_PATH);
  const consistencyPayload =
    consistencyJson.ok && isObject(consistencyJson.payload) ? consistencyJson.payload : null;

  const payload = {
    decision: snapshotJson.payload.decision ?? null,
    diffClass: diffJson.payload.diffClass ?? null,
    exitCode: snapshotJson.payload.exitCode ?? null,
    reasons: Array.isArray(snapshotJson.payload.reasons) ? snapshotJson.payload.reasons : [],
    advisories: Array.isArray(snapshotJson.payload.advisories)
      ? snapshotJson.payload.advisories
      : [],
    hasPrevious:
      typeof diffJson.payload.hasPrevious === "boolean" ? diffJson.payload.hasPrevious : null,
    decisionChanged:
      typeof diffJson.payload.decisionChanged === "boolean" || diffJson.payload.decisionChanged === null
        ? diffJson.payload.decisionChanged
        : null,
    consistencyOk: consistencyPayload ? consistencyPayload.decision === "GO" : null,
    verifyGatesOk: null,
    source: "fallback_from_latest_artifacts"
  };
  return { payload, source: "fallback" };
}

function validateReleaseReady(payload) {
  const errors = [];
  if (!isObject(payload)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  if (typeof payload.decision !== "string") {
    pushError(errors, "/decision", "must be string");
  } else if (!["GO", "NO-GO"].includes(payload.decision)) {
    pushError(errors, "/decision", 'must be one of "GO" | "NO-GO"');
  }

  if (typeof payload.diffClass !== "string") {
    pushError(errors, "/diffClass", "must be string");
  } else if (!["stable", "changed", "risk_up", "recovery", "insufficient_history", "error"].includes(payload.diffClass)) {
    pushError(
      errors,
      "/diffClass",
      'must be one of "stable" | "changed" | "risk_up" | "recovery" | "insufficient_history" | "error"'
    );
  }

  if (!Number.isInteger(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be integer");
  } else if (![0, 1].includes(payload.exitCode)) {
    pushError(errors, "/exitCode", "must be 0 or 1");
  }

  for (const key of ["reasons", "advisories"]) {
    const value = payload[key];
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

  if (Object.prototype.hasOwnProperty.call(payload, "hasPrevious")) {
    if (!(typeof payload.hasPrevious === "boolean" || payload.hasPrevious === null)) {
      pushError(errors, "/hasPrevious", "must be boolean or null");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "decisionChanged")) {
    if (!(typeof payload.decisionChanged === "boolean" || payload.decisionChanged === null)) {
      pushError(errors, "/decisionChanged", "must be boolean or null");
    }
  }

  for (const key of ["verifyGatesOk", "consistencyOk"]) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      pushError(errors, `/${key}`, "must exist");
      continue;
    }
    const value = payload[key];
    if (!(typeof value === "boolean" || value === null)) {
      pushError(errors, `/${key}`, "must be boolean or null");
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
  const loaded = loadReleaseReadyPayload(loadErrors);
  if (loadErrors.length > 0 || !loaded?.payload) {
    process.stderr.write("Release-ready self-check failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    if (!loaded?.payload) {
      process.stderr.write("- /selfcheck/base: payload unavailable\n");
    }
    process.exit(1);
  }

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
      name: "invalid-diff-class",
      expectedPathPrefix: "/diffClass:",
      mutate: (payload) => {
        payload.diffClass = "unsafe";
      }
    },
    {
      name: "exit-code-not-integer",
      expectedPathPrefix: "/exitCode:",
      mutate: (payload) => {
        payload.exitCode = "0";
      }
    },
    {
      name: "missing-verify-gates-ok",
      expectedPathPrefix: "/verifyGatesOk:",
      mutate: (payload) => {
        delete payload.verifyGatesOk;
      }
    }
  ];

  process.stdout.write("Release-ready self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(loaded.payload));
    oneCase.mutate(payload);
    const caseErrors = validateReleaseReady(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-ready self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Release-ready self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  if (process.env.RELEASE_READY_SELFTEST === "1") {
    runSelfCheck();
    return;
  }

  const loadErrors = [];
  const loaded = loadReleaseReadyPayload(loadErrors);
  const errors = [...loadErrors];
  if (loaded?.payload) {
    errors.push(...validateReleaseReady(loaded.payload));
  } else {
    pushError(errors, "/releaseReady", "payload unavailable");
  }

  if (errors.length > 0) {
    process.stderr.write("Release-ready validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release-ready validation passed (source=${loaded.source})\n`
  );
}

main();
