import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = path.resolve(process.cwd(), "..", "..");
const DEFAULT_CTL_PATH = path.resolve(ROOT_DIR, "scripts/chiller_ctl.sh");
const CTL_PATH = process.env.CHILLER_CTL_PATH
  ? path.resolve(process.env.CHILLER_CTL_PATH)
  : DEFAULT_CTL_PATH;

const MODE_CASES = [
  {
    id: "status-json",
    args: ["status-json"]
  },
  {
    id: "status-json--live",
    args: ["status-json", "--live"]
  },
  {
    id: "status-json--live--strict-freshness",
    args: ["status-json", "--live", "--strict-freshness"]
  }
];

function pathFor(modeId, jsonPath) {
  return `/modes/${modeId}${jsonPath}`;
}

function pushError(errors, modeId, jsonPath, message) {
  errors.push(`${pathFor(modeId, jsonPath)}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSummary(modeId, payload, errors) {
  if (!isObject(payload)) {
    pushError(errors, modeId, "", "must be JSON object");
    return;
  }

  if (!isObject(payload.summary)) {
    pushError(errors, modeId, ".summary", "must be object");
    return;
  }

  const summary = payload.summary;
  const requiredStringFields = [
    "entryMode",
    "releaseDecision",
    "releaseGateSource",
    "recommendedAction"
  ];

  for (const field of requiredStringFields) {
    const value = summary[field];
    if (typeof value !== "string") {
      pushError(errors, modeId, `.summary.${field}`, "must be string");
      continue;
    }
    if (value.trim().length === 0) {
      pushError(errors, modeId, `.summary.${field}`, "must be non-empty string");
    }
  }

  if (
    typeof summary.releaseDecision === "string" &&
    !["GO", "NO-GO"].includes(summary.releaseDecision)
  ) {
    pushError(
      errors,
      modeId,
      ".summary.releaseDecision",
      'must be one of "GO" | "NO-GO"'
    );
  }

  if (
    typeof summary.releaseGateSource === "string" &&
    !["live", "latest_file", "none"].includes(summary.releaseGateSource)
  ) {
    pushError(
      errors,
      modeId,
      ".summary.releaseGateSource",
      'must be one of "live" | "latest_file" | "none"'
    );
  }
}

function runModeCase(modeCase, errors) {
  const result = spawnSync("bash", [CTL_PATH, ...modeCase.args], {
    encoding: "utf8"
  });

  if (result.error) {
    pushError(errors, modeCase.id, ".command", `spawn failed: ${String(result.error)}`);
    return;
  }

  if (result.status !== 0) {
    pushError(errors, modeCase.id, ".exitCode", `expected 0, got ${String(result.status)}`);
    return;
  }

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  if (!stdout) {
    pushError(errors, modeCase.id, ".stdout", "must be non-empty JSON string");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    pushError(errors, modeCase.id, ".stdout", `invalid JSON: ${String(error)}`);
    return;
  }

  validateSummary(modeCase.id, payload, errors);
}

function main() {
  const errors = [];
  for (const modeCase of MODE_CASES) {
    runModeCase(modeCase, errors);
  }

  if (errors.length > 0) {
    process.stderr.write("Status-json contract validation failed:\n");
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Status-json contract validation passed for ${MODE_CASES.length} modes\n`
  );
}

main();
