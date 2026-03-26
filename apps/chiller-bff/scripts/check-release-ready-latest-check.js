import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_READY_LATEST_CHECK_PATH =
  process.env.RELEASE_READY_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest-check.json");
const RELEASE_READY_PATH =
  process.env.RELEASE_READY_PATH ||
  process.env.RELEASE_READY_LATEST_PATH ||
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
  const exists = fs.existsSync(filePath);
  if (!exists) {
    return { ok: false, exists, error: "file missing", payload: null };
  }
  try {
    return { ok: true, exists, payload: JSON.parse(fs.readFileSync(filePath, "utf8")), error: null };
  } catch (error) {
    return { ok: false, exists, error: `invalid JSON: ${String(error)}`, payload: null };
  }
}

function loadPayload(errors) {
  const latestCheckJson = parseJsonFile(RELEASE_READY_LATEST_CHECK_PATH);
  if (latestCheckJson.exists) {
    if (!latestCheckJson.ok || !isObject(latestCheckJson.payload)) {
      pushError(
        errors,
        "/releaseReadyLatestCheck",
        `invalid payload (${RELEASE_READY_LATEST_CHECK_PATH}): ${latestCheckJson.error || "unknown"}`
      );
      return null;
    }
    return { source: "latest_check_file", payload: latestCheckJson.payload };
  }

  const latestJson = parseJsonFile(RELEASE_READY_PATH);
  if (latestJson.ok && isObject(latestJson.payload)) {
    return { source: "latest_file", payload: latestJson.payload };
  }
  if (latestJson.exists && (!latestJson.ok || !isObject(latestJson.payload))) {
    pushError(
      errors,
      "/releaseReadyLatest",
      `invalid payload (${RELEASE_READY_PATH}): ${latestJson.error || "unknown"}`
    );
    return null;
  }

  const snapshotJson = parseJsonFile(RELEASE_SNAPSHOT_PATH);
  if (!snapshotJson.ok || !isObject(snapshotJson.payload)) {
    pushError(
      errors,
      "/releaseReadyLatestFallback/snapshot",
      `invalid payload (${RELEASE_SNAPSHOT_PATH}): ${snapshotJson.error || "unknown"}`
    );
    return null;
  }

  const diffJson = parseJsonFile(RELEASE_SNAPSHOT_DIFF_PATH);
  if (!diffJson.ok || !isObject(diffJson.payload)) {
    pushError(
      errors,
      "/releaseReadyLatestFallback/diff",
      `invalid payload (${RELEASE_SNAPSHOT_DIFF_PATH}): ${diffJson.error || "unknown"}`
    );
    return null;
  }

  const consistencyJson = parseJsonFile(RELEASE_SNAPSHOT_CONSISTENCY_PATH);
  const consistencyPayload =
    consistencyJson.ok && isObject(consistencyJson.payload) ? consistencyJson.payload : null;

  const payload = {
    generatedAt: snapshotJson.payload.generatedAt ?? null,
    source: "fallback_from_latest_artifacts",
    decision: snapshotJson.payload.decision ?? null,
    exitCode: snapshotJson.payload.exitCode ?? null,
    reasons: Array.isArray(snapshotJson.payload.reasons) ? snapshotJson.payload.reasons : [],
    advisories: Array.isArray(snapshotJson.payload.advisories)
      ? snapshotJson.payload.advisories
      : [],
    diffClass: diffJson.payload.diffClass ?? null,
    decisionChanged:
      typeof diffJson.payload.decisionChanged === "boolean" || diffJson.payload.decisionChanged === null
        ? diffJson.payload.decisionChanged
        : null,
    hasPrevious:
      typeof diffJson.payload.hasPrevious === "boolean" || diffJson.payload.hasPrevious === null
        ? diffJson.payload.hasPrevious
        : null,
    verifyGatesOk: null,
    consistencyOk: consistencyPayload ? consistencyPayload.decision === "GO" : null
  };
  return { source: "fallback", payload };
}

function validatePayload(payload) {
  const errors = [];
  if (!isObject(payload)) {
    pushError(errors, "/", "must be object");
    return errors;
  }

  if (typeof payload.generatedAt !== "string") {
    pushError(errors, "/generatedAt", "must be string");
  }

  if (typeof payload.source !== "string") {
    pushError(errors, "/source", "must be string");
  } else if (
    !["latest_check_file", "latest_file", "fallback_from_latest_artifacts"].includes(payload.source)
  ) {
    pushError(
      errors,
      "/source",
      'must be "latest_check_file" | "latest_file" | "fallback_from_latest_artifacts"'
    );
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

  if (typeof payload.diffClass !== "string") {
    pushError(errors, "/diffClass", "must be string");
  } else if (
    !["stable", "changed", "risk_up", "recovery", "insufficient_history", "error"].includes(
      payload.diffClass
    )
  ) {
    pushError(
      errors,
      "/diffClass",
      'must be one of "stable" | "changed" | "risk_up" | "recovery" | "insufficient_history" | "error"'
    );
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
      name: "missing-verify-gates-ok",
      expectedPathPrefix: "/verifyGatesOk:",
      mutate: (payload) => {
        delete payload.verifyGatesOk;
      }
    }
  ];

  process.stdout.write("Release-ready-latest-check self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Release-ready-latest-check self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release-ready-latest-check self-check passed: ${cases.length}/${cases.length}\n`
  );
}

function main() {
  const loadErrors = [];
  const loaded = loadPayload(loadErrors);
  const errors = [...loadErrors];
  if (!loaded?.payload) {
    pushError(errors, "/releaseReadyLatestCheck", "payload unavailable");
  }

  if (process.env.RELEASE_READY_LATEST_CHECK_SELFTEST === "1") {
    if (!loaded?.payload) {
      process.stderr.write("Release-ready-latest-check self-check failed:\n");
      for (const err of errors) {
        process.stderr.write(`- ${err}\n`);
      }
      process.exit(1);
    }
    runSelfCheck(loaded.payload);
    return;
  }

  if (loaded?.payload) {
    if (!Object.prototype.hasOwnProperty.call(loaded.payload, "source")) {
      if (loaded.source === "fallback") {
        loaded.payload.source = "fallback_from_latest_artifacts";
      } else if (loaded.source === "latest_check_file") {
        loaded.payload.source = "latest_check_file";
      } else {
        loaded.payload.source = "latest_file";
      }
    }
    errors.push(...validatePayload(loaded.payload));
  }

  if (errors.length > 0) {
    process.stderr.write("Release-ready-latest-check validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Release-ready-latest-check validation passed (source=${loaded.source})\n`
  );
}

main();
