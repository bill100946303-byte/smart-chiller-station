import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");
const DEFAULT_MAX_AGE_MIN = 60;

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMaxAgeMin(errors) {
  const raw = process.env.MAX_AGE_MIN ?? String(DEFAULT_MAX_AGE_MIN);
  if (!/^\d+$/.test(raw)) {
    pushError(errors, "/config/MAX_AGE_MIN", "must be non-negative integer string");
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    pushError(errors, "/config/MAX_AGE_MIN", "must be non-negative integer");
    return null;
  }
  return parsed;
}

function loadPayload(errors) {
  if (!fs.existsSync(CHECK_FAMILY_PATH)) {
    pushError(errors, "/checkFamily", `file missing: ${CHECK_FAMILY_PATH}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CHECK_FAMILY_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, "/checkFamily", `invalid JSON: ${String(error)}`);
    return null;
  }
}

function validateFreshness(payload, maxAgeMin, errors, nowMs = Date.now()) {
  if (!isObject(payload)) {
    pushError(errors, "/", "must be object");
    return null;
  }

  if (typeof payload.generatedAt !== "string" || payload.generatedAt.trim().length === 0) {
    pushError(errors, "/generatedAt", "must be non-empty string");
    return null;
  }

  const ts = Date.parse(payload.generatedAt);
  if (Number.isNaN(ts)) {
    pushError(errors, "/generatedAt", "must be valid ISO datetime");
    return null;
  }

  const ageMin = Math.floor((nowMs - ts) / 60000);
  if (ageMin < 0) {
    pushError(errors, "/generatedAt", "must not be in the future");
    return null;
  }

  if (ageMin > maxAgeMin) {
    pushError(errors, "/generatedAt", `age ${ageMin}m exceeds MAX_AGE_MIN=${maxAgeMin}`);
    return ageMin;
  }

  return ageMin;
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

function runSelfCheck(maxAgeMin) {
  const basePayload = { generatedAt: new Date().toISOString() };
  const failures = [];
  const cases = [
    {
      name: "missing-generated-at",
      expectedPathPrefix: "/generatedAt:",
      mutate: (payload) => {
        delete payload.generatedAt;
      }
    },
    {
      name: "invalid-generated-at",
      expectedPathPrefix: "/generatedAt:",
      mutate: (payload) => {
        payload.generatedAt = "not-a-datetime";
      }
    },
    {
      name: "stale-generated-at",
      expectedPathPrefix: "/generatedAt:",
      mutate: (payload) => {
        const staleMs = Date.now() - (maxAgeMin + 5) * 60 * 1000;
        payload.generatedAt = new Date(staleMs).toISOString();
      }
    }
  ];

  process.stdout.write("Check-family-freshness self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = [];
    validateFreshness(payload, maxAgeMin, caseErrors, Date.now());
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Check-family-freshness self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Check-family-freshness self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const initErrors = [];
  const maxAgeMin = parseMaxAgeMin(initErrors);
  if (initErrors.length > 0 || maxAgeMin === null) {
    process.stderr.write("Check-family-freshness validation failed:\n");
    for (const err of initErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.CHECK_FAMILY_FRESHNESS_SELFTEST === "1") {
    runSelfCheck(maxAgeMin);
    return;
  }

  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  const errors = [...loadErrors];
  let ageMin = null;
  if (payload) {
    ageMin = validateFreshness(payload, maxAgeMin, errors, Date.now());
  }

  if (errors.length > 0) {
    process.stderr.write("Check-family-freshness validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Check-family-freshness validation passed: ${CHECK_FAMILY_PATH} (ageMin=${String(
      ageMin
    )}, maxAgeMin=${maxAgeMin})\n`
  );
}

main();
