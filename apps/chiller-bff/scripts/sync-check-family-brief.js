import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");
const CHECK_FAMILY_BRIEF_PATH =
  process.env.CHECK_FAMILY_BRIEF_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json");

const WARN_AGE_MIN = Number.parseInt(process.env.CHECK_FAMILY_WARN_AGE_MIN || "30", 10);
const STALE_AGE_MIN = Number.parseInt(process.env.CHECK_FAMILY_STALE_AGE_MIN || "60", 10);

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

function getAgeMinutes(generatedAt) {
  const ts = Date.parse(generatedAt);
  if (Number.isNaN(ts)) {
    return null;
  }
  return Math.floor((Date.now() - ts) / 60000);
}

function getFreshnessState(ageMinutes, warnAgeMin, staleAgeMin) {
  if (!Number.isInteger(ageMinutes) || ageMinutes < 0) {
    return "unknown";
  }
  if (ageMinutes >= staleAgeMin) {
    return "stale";
  }
  if (ageMinutes >= warnAgeMin) {
    return "warn";
  }
  return "fresh";
}

function validateSourcePayload(payload) {
  if (!isObject(payload)) {
    fail("/checkFamily", "must be object");
  }
  if (typeof payload.overall !== "string" || !["PASS", "FAIL"].includes(payload.overall)) {
    fail("/checkFamily.overall", 'must be one of "PASS" | "FAIL"');
  }
  if (!Number.isInteger(payload.passedCount)) {
    fail("/checkFamily.passedCount", "must be integer");
  }
  if (!Number.isInteger(payload.totalCount) || payload.totalCount < 1) {
    fail("/checkFamily.totalCount", "must be integer >= 1");
  }
  if (!Array.isArray(payload.checks)) {
    fail("/checkFamily.checks", "must be array");
  }
  if (typeof payload.generatedAt !== "string" || payload.generatedAt.trim().length === 0) {
    fail("/checkFamily.generatedAt", "must be non-empty string");
  }
}

function normalizeTopFailedChecks(checks) {
  const failed = checks
    .filter((x) => isObject(x) && typeof x.script === "string" && x.ok !== true)
    .map((x) => x.script);
  return failed.slice(0, 3);
}

function buildBriefPayload(sourcePayload, ageMinutes, warnAgeMin, staleAgeMin) {
  const failedCount = sourcePayload.totalCount - sourcePayload.passedCount;
  const freshnessState = getFreshnessState(ageMinutes, warnAgeMin, staleAgeMin);

  return {
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    source: "check-family-latest",
    sourcePath: CHECK_FAMILY_PATH,
    sourceGeneratedAt: sourcePayload.generatedAt,
    overall: sourcePayload.overall,
    passedCount: sourcePayload.passedCount,
    totalCount: sourcePayload.totalCount,
    failedCount,
    topFailedChecks: normalizeTopFailedChecks(sourcePayload.checks),
    freshness: {
      state: freshnessState,
      ageMinutes,
      warnAgeMin,
      staleAgeMin,
      maxAgeMin: staleAgeMin
    }
  };
}

function main() {
  if (!Number.isInteger(WARN_AGE_MIN) || WARN_AGE_MIN < 0) {
    fail("/config/CHECK_FAMILY_WARN_AGE_MIN", "must be non-negative integer");
  }
  if (!Number.isInteger(STALE_AGE_MIN) || STALE_AGE_MIN < WARN_AGE_MIN) {
    fail("/config/CHECK_FAMILY_STALE_AGE_MIN", "must be integer >= WARN_AGE_MIN");
  }

  const sourcePayload = mustReadJson(CHECK_FAMILY_PATH, "/checkFamily");
  validateSourcePayload(sourcePayload);
  const ageMinutes = getAgeMinutes(sourcePayload.generatedAt);
  if (ageMinutes === null) {
    fail("/checkFamily.generatedAt", "must be valid ISO datetime");
  }

  const briefPayload = buildBriefPayload(sourcePayload, ageMinutes, WARN_AGE_MIN, STALE_AGE_MIN);
  fs.writeFileSync(CHECK_FAMILY_BRIEF_PATH, `${JSON.stringify(briefPayload, null, 2)}\n`, "utf8");
  process.stdout.write(`Check-family-brief synced: ${CHECK_FAMILY_BRIEF_PATH}\n`);
}

main();
