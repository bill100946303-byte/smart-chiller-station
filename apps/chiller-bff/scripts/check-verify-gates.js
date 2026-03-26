import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const VERIFY_GATES_PATH =
  process.env.VERIFY_GATES_PATH ||
  path.resolve(ROOT_DIR, "docs/verify-gates-latest.json");

const EXPECTED_GATES = [
  "acceptance-report",
  "status-json",
  "release-snapshot",
  "release-snapshot-index",
  "release-snapshot-diff",
  "release-snapshot-consistency",
  "release-ready-brief"
];

function pushError(errors, jsonPath, message) {
  errors.push(`${jsonPath}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function loadPayload(errors) {
  if (!fs.existsSync(VERIFY_GATES_PATH)) {
    pushError(errors, "/verifyGates", `file missing: ${VERIFY_GATES_PATH}`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(VERIFY_GATES_PATH, "utf8"));
    if (!isObject(parsed)) {
      pushError(errors, "/", "must be object");
      return null;
    }
    return parsed;
  } catch (error) {
    pushError(errors, "/verifyGates", `invalid JSON: ${String(error)}`);
    return null;
  }
}

function validatePayload(payload) {
  const errors = [];

  if (typeof payload.version !== "string") {
    pushError(errors, "/version", "must be string");
  }
  if (typeof payload.generatedAt !== "string") {
    pushError(errors, "/generatedAt", "must be string");
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
  } else if (payload.totalCount !== EXPECTED_GATES.length) {
    pushError(errors, "/totalCount", `must be ${EXPECTED_GATES.length}`);
  }

  if (Number.isInteger(payload.passedCount) && Number.isInteger(payload.totalCount)) {
    if (payload.passedCount < 0 || payload.passedCount > payload.totalCount) {
      pushError(errors, "/passedCount", "must be within [0,totalCount]");
    }
  }

  if (!Array.isArray(payload.gates)) {
    pushError(errors, "/gates", "must be array");
    return errors;
  }

  if (!Array.isArray(payload.failedGates)) {
    pushError(errors, "/failedGates", "must be array");
  }
  if (!Number.isInteger(payload.failedCount)) {
    pushError(errors, "/failedCount", "must be integer");
  } else if (payload.failedCount < 0) {
    pushError(errors, "/failedCount", "must be >= 0");
  }

  if (payload.gates.length !== EXPECTED_GATES.length) {
    pushError(errors, "/gates", `must contain ${EXPECTED_GATES.length} items`);
  }

  const seen = new Set();
  const failedFromGates = [];
  for (let i = 0; i < payload.gates.length; i += 1) {
    const gate = payload.gates[i];
    const basePath = `/gates[${i}]`;
    if (!isObject(gate)) {
      pushError(errors, basePath, "must be object");
      continue;
    }
    if (typeof gate.name !== "string") {
      pushError(errors, `${basePath}.name`, "must be string");
    } else {
      seen.add(gate.name);
      if (!EXPECTED_GATES.includes(gate.name)) {
        pushError(errors, `${basePath}.name`, "must be known gate name");
      }
    }
    if (typeof gate.ok !== "boolean") {
      pushError(errors, `${basePath}.ok`, "must be boolean");
    } else if (gate.ok === false && typeof gate.name === "string") {
      failedFromGates.push(gate.name);
    }
    if (!Number.isInteger(gate.exitCode)) {
      pushError(errors, `${basePath}.exitCode`, "must be integer");
    }
  }

  for (const gateName of EXPECTED_GATES) {
    if (!seen.has(gateName)) {
      pushError(errors, "/gates", `missing gate "${gateName}"`);
    }
  }

  if (Array.isArray(payload.failedGates)) {
    const failedSet = new Set();
    for (let i = 0; i < payload.failedGates.length; i += 1) {
      const one = payload.failedGates[i];
      if (typeof one !== "string") {
        pushError(errors, `/failedGates[${i}]`, "must be string");
        continue;
      }
      if (!EXPECTED_GATES.includes(one)) {
        pushError(errors, `/failedGates[${i}]`, "must be known gate name");
      }
      if (failedSet.has(one)) {
        pushError(errors, `/failedGates[${i}]`, "must not contain duplicate gate name");
      }
      failedSet.add(one);
    }

    const failedFromGateSet = new Set(failedFromGates);
    for (const one of failedSet) {
      if (!failedFromGateSet.has(one)) {
        pushError(errors, "/failedGates", `contains "${one}" but gates[].ok shows PASS`);
      }
    }
    for (const one of failedFromGateSet) {
      if (!failedSet.has(one)) {
        pushError(errors, "/failedGates", `missing "${one}" while gates[].ok shows FAIL`);
      }
    }

    if (Number.isInteger(payload.failedCount) && payload.failedCount !== failedSet.size) {
      pushError(errors, "/failedCount", "must equal failedGates.length");
    }

    if (typeof payload.overall === "string") {
      if (failedSet.size === 0 && payload.overall !== "PASS") {
        pushError(errors, "/overall", "must be PASS when failedGates is empty");
      }
      if (failedSet.size > 0 && payload.overall !== "FAIL") {
        pushError(errors, "/overall", "must be FAIL when failedGates is not empty");
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
      name: "invalid-exit-code",
      expectedPathPrefix: "/gates[0].exitCode:",
      mutate: (payload) => {
        payload.gates[0].exitCode = "0";
      }
    },
    {
      name: "missing-brief-gate",
      expectedPathPrefix: "/gates:",
      mutate: (payload) => {
        payload.gates = payload.gates.filter((x) => x.name !== "release-ready-brief");
      }
    },
    {
      name: "failed-count-mismatch",
      expectedPathPrefix: "/failedCount:",
      mutate: (payload) => {
        payload.failedCount = 99;
      }
    }
  ];

  process.stdout.write("Verify-gates self-check mode enabled\n");
  for (const oneCase of cases) {
    const payload = JSON.parse(JSON.stringify(basePayload));
    oneCase.mutate(payload);
    const caseErrors = validatePayload(payload);
    assertSelfCheckCase(oneCase.name, caseErrors, oneCase.expectedPathPrefix, failures);
  }

  if (failures.length > 0) {
    process.stderr.write("Verify-gates self-check failed:\n");
    for (const err of failures) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Verify-gates self-check passed: ${cases.length}/${cases.length}\n`);
}

function main() {
  const loadErrors = [];
  const payload = loadPayload(loadErrors);
  if (loadErrors.length > 0 || !payload) {
    process.stderr.write("Verify-gates validation failed:\n");
    for (const err of loadErrors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  if (process.env.VERIFY_GATES_SELFTEST === "1") {
    runSelfCheck(payload);
    return;
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    process.stderr.write("Verify-gates validation failed:\n");
    for (const err of errors) {
      process.stderr.write(`- ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`Verify-gates validation passed: ${VERIFY_GATES_PATH}\n`);
}

main();
