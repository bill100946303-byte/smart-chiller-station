import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const RELEASE_COMMAND_CENTER_PATH =
  process.env.RELEASE_COMMAND_CENTER_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest.json");
const RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH =
  process.env.RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest-check.json");

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

function buildOutput(sourcePayload) {
  return {
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    source: "latest_file",
    decision: sourcePayload.decision ?? "NO-GO",
    summaryClass: sourcePayload.summaryClass ?? "blocked",
    exitCode: Number.isInteger(sourcePayload.exitCode) ? sourcePayload.exitCode : 1,
    reasons: normalizeStringArray(sourcePayload.reasons, "/releaseCommandCenter.reasons"),
    advisories: normalizeStringArray(sourcePayload.advisories, "/releaseCommandCenter.advisories"),
    firstAction:
      typeof sourcePayload.firstAction === "string" && sourcePayload.firstAction.trim().length > 0
        ? sourcePayload.firstAction
        : "inspect reasons and rerun release command center",
    consistencyOk:
      sourcePayload?.gates?.releaseReadyConsistencyPayload?.ok === true &&
      sourcePayload?.gates?.checkFamily?.ok === true &&
      sourcePayload?.gates?.checkFamilyBrief?.ok === true,
    upstreamGeneratedAt: typeof sourcePayload.generatedAt === "string" ? sourcePayload.generatedAt : null,
    upstreamPath: RELEASE_COMMAND_CENTER_PATH
  };
}

function main() {
  const sourcePayload = mustReadJson(RELEASE_COMMAND_CENTER_PATH, "/releaseCommandCenter");
  if (!isObject(sourcePayload)) {
    fail("/releaseCommandCenter", "must be object");
  }
  const outputPayload = buildOutput(sourcePayload);
  fs.writeFileSync(
    RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH,
    `${JSON.stringify(outputPayload, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(
    `Release-command-center-latest-check synced: ${RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH}\n`
  );
}

main();
