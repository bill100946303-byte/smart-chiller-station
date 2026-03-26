import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

  if (!Number.isInteger(payload.passedCount)) {
    pushError(errors, "/passedCount", "must be integer");
  }
  if (!Number.isInteger(payload.totalCount)) {
    pushError(errors, "/totalCount", "must be integer");
  } else if (payload.totalCount < 1) {
    pushError(errors, "/totalCount", "must be >= 1");
  }

  if (Number.isInteger(payload.passedCount) && Number.isInteger(payload.totalCount)) {
    if (payload.passedCount < 0 || payload.passedCount > payload.totalCount) {
      pushError(errors, "/passedCount", "must be within [0,totalCount]");
    }
  }

  if (!Array.isArray(payload.checks)) {
    pushError(errors, "/checks", "must be array");
    return errors;
  }
  if (payload.checks.length === 0) {
    pushError(errors, "/checks", "must contain at least 1 item");
  }

  if (Number.isInteger(payload.totalCount) && payload.totalCount !== payload.checks.length) {
    pushError(errors, "/totalCount", "must equal checks.length");
  }

  let okCount = 0;
  const seenScripts = new Set();
  for (let i = 0; i < payload.checks.length; i += 1) {
    const one = payload.checks[i];
    const base = `/checks[${i}]`;
    if (!isObject(one)) {
      pushError(errors, base, "must be object");
      continue;
    }

    if (typeof one.script !== "string" || one.script.trim().length === 0) {
      pushError(errors, `${base}/script`, "must be non-empty string");
    } else {
      if (!/^check:[a-z0-9-]+$/.test(one.script)) {
        pushError(errors, `${base}/script`, 'must match pattern "^check:[a-z0-9-]+$"');
      }
      if (seenScripts.has(one.script)) {
        pushError(errors, `${base}/script`, "must be unique");
      }
      seenScripts.add(one.script);
    }

    if (typeof one.ok !== "boolean") {
      pushError(errors, `${base}/ok`, "must be boolean");
    } else if (one.ok) {
      okCount += 1;
    }

    if (!Number.isInteger(one.exitCode)) {
      pushError(errors, `${base}/exitCode`, "must be integer");
    }
    if (typeof one.input !== "string" || one.input.trim().length === 0) {
      pushError(errors, `${base}/input`, "must be non-empty string");
    }
    if (typeof one.output !== "string" || one.output.trim().length === 0) {
      pushError(errors, `${base}/output`, "must be non-empty string");
    }
    if (typeof one.recompute !== "boolean") {
      pushError(errors, `${base}/recompute`, "must be boolean");
    }
  }

  if (Number.isInteger(payload.passedCount) && payload.passedCount !== okCount) {
    pushError(errors, "/passedCount", "must equal count(checks[*].ok==true)");
  }

  for (const requiredScript of [
    "check:contract",
    "check:verify-gates",
    "check:release-ready-consistency",
    "check:check-family-freshness",
    "check:check-family-brief",
    "check:check-family-consistency",
    "check:release-ready-latest-check"
  ]) {
    if (!seenScripts.has(requiredScript)) {
      pushError(errors, "/checks", `missing required script "${requiredScript}"`);
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
      name: "missing-overall",
      expectedPathPrefix: "/overall:",
      mutate: (payload) => {
        delete payload.overall;
      }
    },
    {
      name: "checks-not-array",
      expectedPathPrefix: "/checks:",
      mutate: (payload) => {
        payload.checks = {};
      }
    },
    {
      name: "check-ok-not-boolean",
      expectedPathPrefix: "/checks[0]/ok:",
      mutate: (payload) => {
        if (!Array.isArray(payload.checks) || payload.checks.length === 0) {
          payload.checks = [
            {
              script: "check:contract",
              ok: true,
              exitCode: 0,
              input: "openapi/bff-v1.yaml",
              output: "stdout",
              recompute: false
            }
          ];
          payload.totalCount = 1;
          payload.passedCount = 1;
        }
        payload.checks[0].ok = "yes";
      }
    }
  ];

  process.stdout.write("Check-family self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Check-family self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Check-family self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Check-family validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.CHECK_FAMILY_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Check-family validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Check-family validation passed: ${CHECK_FAMILY_PATH}\n`);
}

main();
