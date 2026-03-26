import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_READY_PATH =
  process.env.RELEASE_READY_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest.json");
const RELEASE_READY_LATEST_CHECK_PATH =
  process.env.RELEASE_READY_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest-check.json");

function fail(jsonPath, message) {
  process.stderr.write(`${jsonPath}: ${message}\n`);
  process.exit(1);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mustReadJson(filePath, jsonPath) {
  if (!fs.existsSync(filePath)) {
    fail(jsonPath, `file missing: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(jsonPath, `invalid JSON: ${String(error)}`);
  }
}

function validateSourcePayload(payload) {
  if (!isObject(payload)) {
    fail("/releaseReadyLatest", "must be object");
  }
  if (typeof payload.decision !== "string") {
    fail("/releaseReadyLatest.decision", "must be string");
  }
  if (!["GO", "NO-GO"].includes(payload.decision)) {
    fail("/releaseReadyLatest.decision", 'must be one of "GO" | "NO-GO"');
  }
  if (!Number.isInteger(payload.exitCode)) {
    fail("/releaseReadyLatest.exitCode", "must be integer");
  }
  if (![0, 1].includes(payload.exitCode)) {
    fail("/releaseReadyLatest.exitCode", "must be 0 or 1");
  }
}

function normalizeStringArray(value, jsonPath) {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail(jsonPath, "must be array");
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      fail(`${jsonPath}[${i}]`, "must be string");
    }
  }
  return value;
}

function normalizeBooleanOrNull(value, jsonPath) {
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  fail(jsonPath, "must be boolean or null");
}

function buildOutput(sourcePayload) {
  return {
    version: "v1.1",
    generatedAt: new Date().toISOString(),
    source: "latest_file",
    decision: sourcePayload.decision,
    exitCode: sourcePayload.exitCode,
    reasons: normalizeStringArray(sourcePayload.reasons, "/releaseReadyLatest.reasons"),
    advisories: normalizeStringArray(sourcePayload.advisories, "/releaseReadyLatest.advisories"),
    diffClass:
      typeof sourcePayload.diffClass === "string" ? sourcePayload.diffClass : "insufficient_history",
    decisionChanged:
      typeof sourcePayload.decisionChanged === "boolean" || sourcePayload.decisionChanged === null
        ? sourcePayload.decisionChanged
        : null,
    hasPrevious:
      typeof sourcePayload.hasPrevious === "boolean" || sourcePayload.hasPrevious === null
        ? sourcePayload.hasPrevious
        : null,
    verifyGatesOk: normalizeBooleanOrNull(sourcePayload.verifyGatesOk ?? null, "/releaseReadyLatest.verifyGatesOk"),
    consistencyOk: normalizeBooleanOrNull(sourcePayload.consistencyOk ?? null, "/releaseReadyLatest.consistencyOk"),
    upstreamGeneratedAt: typeof sourcePayload.generatedAt === "string" ? sourcePayload.generatedAt : null,
    upstreamPath: RELEASE_READY_PATH
  };
}

function main() {
  const sourcePayload = mustReadJson(RELEASE_READY_PATH, "/releaseReadyLatest");
  validateSourcePayload(sourcePayload);
  const outputPayload = buildOutput(sourcePayload);

  fs.writeFileSync(RELEASE_READY_LATEST_CHECK_PATH, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
  process.stdout.write(`Release-ready-latest-check synced: ${RELEASE_READY_LATEST_CHECK_PATH}\n`);
}

main();
