import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");
const CHECK_FAMILY_BRIEF_PATH =
  process.env.CHECK_FAMILY_BRIEF_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadJson(filePath, rootPath, errors) {
  if (!fs.existsSync(filePath)) {
    pushError(errors, rootPath, `file missing: ${filePath}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, rootPath, "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, rootPath, `invalid JSON: ${String(error)}`);
    return null;
  }
}

function validateFamilyShape(family, errors) {
  if (typeof family.overall !== "string") {
    pushError(errors, "/family/overall", "must be string");
  } else if (!["PASS", "FAIL"].includes(family.overall)) {
    pushError(errors, "/family/overall", 'must be one of "PASS" | "FAIL"');
  }
  if (!Number.isInteger(family.passedCount) || family.passedCount < 0) {
    pushError(errors, "/family/passedCount", "must be non-negative integer");
  }
  if (!Number.isInteger(family.totalCount) || family.totalCount < 1) {
    pushError(errors, "/family/totalCount", "must be integer >= 1");
  }
  if (!Array.isArray(family.checks)) {
    pushError(errors, "/family/checks", "must be array");
    return;
  }
  for (let i = 0; i < family.checks.length; i += 1) {
    const one = family.checks[i];
    const base = `/family/checks[${i}]`;
    if (!isObject(one)) {
      pushError(errors, base, "must be object");
      continue;
    }
    if (typeof one.script !== "string" || one.script.trim().length === 0) {
      pushError(errors, `${base}/script`, "must be non-empty string");
    }
    if (typeof one.ok !== "boolean") {
      pushError(errors, `${base}/ok`, "must be boolean");
    }
  }
}

function validateBriefShape(brief, errors) {
  if (typeof brief.overall !== "string") {
    pushError(errors, "/brief/overall", "must be string");
  } else if (!["PASS", "FAIL"].includes(brief.overall)) {
    pushError(errors, "/brief/overall", 'must be one of "PASS" | "FAIL"');
  }
  if (!Number.isInteger(brief.passedCount) || brief.passedCount < 0) {
    pushError(errors, "/brief/passedCount", "must be non-negative integer");
  }
  if (!Number.isInteger(brief.totalCount) || brief.totalCount < 1) {
    pushError(errors, "/brief/totalCount", "must be integer >= 1");
  }
  if (!Number.isInteger(brief.failedCount) || brief.failedCount < 0) {
    pushError(errors, "/brief/failedCount", "must be non-negative integer");
  }
  if (!Array.isArray(brief.topFailedChecks)) {
    pushError(errors, "/brief/topFailedChecks", "must be array");
  } else if (brief.topFailedChecks.length > 3) {
    pushError(errors, "/brief/topFailedChecks", "must contain at most 3 items");
  }
}

function validateConsistency(family, brief) {
  const errors = [];
  validateFamilyShape(family, errors);
  validateBriefShape(brief, errors);
  if (errors.length > 0) {
    return errors;
  }

  if (brief.overall !== family.overall) {
    pushError(errors, "/brief/overall", "must equal family.overall");
  }
  if (brief.passedCount !== family.passedCount) {
    pushError(errors, "/brief/passedCount", "must equal family.passedCount");
  }
  if (brief.totalCount !== family.totalCount) {
    pushError(errors, "/brief/totalCount", "must equal family.totalCount");
  }

  const familyFailedCount = family.totalCount - family.passedCount;
  if (brief.failedCount !== familyFailedCount) {
    pushError(errors, "/brief/failedCount", "must equal family.totalCount - family.passedCount");
  }

  const familyFailedScripts = family.checks
    .filter((x) => isObject(x) && x.ok === false && typeof x.script === "string")
    .map((x) => x.script);
  const failedSet = new Set(familyFailedScripts);
  for (let i = 0; i < brief.topFailedChecks.length; i += 1) {
    const value = brief.topFailedChecks[i];
    if (typeof value !== "string" || value.trim().length === 0) {
      pushError(errors, `/brief/topFailedChecks[${i}]`, "must be non-empty string");
      continue;
    }
    if (!failedSet.has(value)) {
      pushError(
        errors,
        `/brief/topFailedChecks[${i}]`,
        "must reference a failed script from family.checks"
      );
    }
  }

  if (family.overall === "PASS") {
    if (brief.failedCount !== 0) {
      pushError(errors, "/brief/failedCount", "must be 0 when family.overall=PASS");
    }
    if (brief.topFailedChecks.length !== 0) {
      pushError(errors, "/brief/topFailedChecks", "must be empty when family.overall=PASS");
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

function runSelfCheck(baseFamily, baseBrief) {
  const failures = [];
  const cases = [
    {
      name: "missing-family-overall",
      expectedPathPrefix: "/family/overall:",
      mutate: (family) => {
        delete family.overall;
      }
    },
    {
      name: "mismatch-passed-count",
      expectedPathPrefix: "/brief/passedCount:",
      mutate: (_family, brief) => {
        brief.passedCount += 1;
      }
    },
    {
      name: "unknown-top-failed-script",
      expectedPathPrefix: "/brief/topFailedChecks[0]:",
      mutate: (family, brief) => {
        family.overall = "FAIL";
        family.passedCount = Math.max(0, family.totalCount - 1);
        if (Array.isArray(family.checks) && family.checks.length > 0) {
          family.checks[0].ok = false;
        }
        brief.overall = "FAIL";
        brief.passedCount = family.passedCount;
        brief.totalCount = family.totalCount;
        brief.failedCount = family.totalCount - family.passedCount;
        brief.topFailedChecks = ["check:not-exists"];
      }
    }
  ];

  process.stdout.write("Check-family-consistency self-check mode enabled\n");
  for (const oneCase of cases) {
    const family = JSON.parse(JSON.stringify(baseFamily));
    const brief = JSON.parse(JSON.stringify(baseBrief));
    oneCase.mutate(family, brief);
    const caseErrors = validateConsistency(family, brief);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Check-family-consistency self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Check-family-consistency self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const family = loadJson(CHECK_FAMILY_PATH, "/family", loadErrors);
  const brief = loadJson(CHECK_FAMILY_BRIEF_PATH, "/brief", loadErrors);
  if (loadErrors.length > 0 || !family || !brief) {
    process.stderr.write("Check-family-consistency validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.CHECK_FAMILY_CONSISTENCY_SELFTEST === "1") {
    runSelfCheck(family, brief);
    return;
  }

  const errors = validateConsistency(family, brief);
  if (errors.length > 0) {
    process.stderr.write("Check-family-consistency validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Check-family-consistency validation passed: ${CHECK_FAMILY_PATH} <=> ${CHECK_FAMILY_BRIEF_PATH}\n`
  );
}

main();
