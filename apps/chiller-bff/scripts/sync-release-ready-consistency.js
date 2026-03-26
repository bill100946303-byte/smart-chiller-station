import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BFF_DIR = process.cwd();
const ROOT_DIR = path.resolve(BFF_DIR, "..", "..");

const RELEASE_READY_LATEST_PATH =
  process.env.RELEASE_READY_LATEST_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest.json");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");
const CHECK_FAMILY_BRIEF_PATH =
  process.env.CHECK_FAMILY_BRIEF_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json");
const RELEASE_READY_CONSISTENCY_PATH =
  process.env.RELEASE_READY_CONSISTENCY_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-consistency-latest.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} missing: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} invalid JSON: ${String(error)}`);
  }
}

function runNpmScript(script, envOverrides = {}) {
  const run = spawnSync("npm", ["run", script], {
    cwd: BFF_DIR,
    stdio: "pipe",
    env: { ...process.env, ...envOverrides },
    encoding: "utf8"
  });
  return {
    ok: (run.status ?? 1) === 0,
    exitCode: run.status ?? 1,
    stdout: run.stdout ?? "",
    stderr: run.stderr ?? ""
  };
}

function uniqStrings(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return [...new Set(input.filter((x) => typeof x === "string"))];
}

function main() {
  const checkReleaseReadyLatest = runNpmScript("check:release-ready-latest-check");
  const checkFamilyConsistency = runNpmScript("check:check-family-consistency", {
    CHECK_FAMILY_PATH,
    CHECK_FAMILY_BRIEF_PATH
  });

  const releaseReadyLatest = readJson(RELEASE_READY_LATEST_PATH, "releaseReadyLatest");
  const checkFamilyLatest = readJson(CHECK_FAMILY_PATH, "checkFamilyLatest");
  const checkFamilyBriefLatest = readJson(CHECK_FAMILY_BRIEF_PATH, "checkFamilyBriefLatest");

  const reasons = [];
  if (!checkReleaseReadyLatest.ok) {
    reasons.push("release_ready_latest_check_failed");
  }
  if (!checkFamilyConsistency.ok) {
    reasons.push("check_family_consistency_failed");
  }
  if ((releaseReadyLatest.decision ?? "NO-GO") !== "GO") {
    reasons.push("release_ready_not_go");
  }
  if ((checkFamilyLatest.overall ?? "FAIL") !== "PASS") {
    reasons.push("check_family_not_pass");
  }

  const decision = reasons.length === 0 ? "GO" : "NO-GO";
  const payload = {
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    decision,
    exitCode: decision === "GO" ? 0 : 1,
    reasons,
    advisories: uniqStrings(releaseReadyLatest.advisories),
    steps: {
      releaseReadyLatestCheck: {
        ok: checkReleaseReadyLatest.ok,
        exitCode: checkReleaseReadyLatest.exitCode
      },
      checkFamilyConsistency: {
        ok: checkFamilyConsistency.ok,
        exitCode: checkFamilyConsistency.exitCode
      },
      checkFamilyOverall: {
        ok: (checkFamilyLatest.overall ?? "FAIL") === "PASS",
        exitCode: (checkFamilyLatest.overall ?? "FAIL") === "PASS" ? 0 : 1
      }
    },
    releaseReadyLatest: {
      decision: releaseReadyLatest.decision ?? "NO-GO",
      exitCode: Number.isInteger(releaseReadyLatest.exitCode) ? releaseReadyLatest.exitCode : 1,
      generatedAt: releaseReadyLatest.generatedAt ?? "",
      reasons: Array.isArray(releaseReadyLatest.reasons) ? releaseReadyLatest.reasons : [],
      advisories: Array.isArray(releaseReadyLatest.advisories) ? releaseReadyLatest.advisories : []
    },
    checkFamilyLatest: {
      overall: checkFamilyLatest.overall ?? "FAIL",
      passedCount: Number.isInteger(checkFamilyLatest.passedCount) ? checkFamilyLatest.passedCount : 0,
      totalCount: Number.isInteger(checkFamilyLatest.totalCount) ? checkFamilyLatest.totalCount : 0,
      generatedAt: checkFamilyLatest.generatedAt ?? ""
    },
    checkFamilyBriefLatest: {
      overall: checkFamilyBriefLatest.overall ?? "FAIL",
      passedCount: Number.isInteger(checkFamilyBriefLatest.passedCount)
        ? checkFamilyBriefLatest.passedCount
        : 0,
      totalCount: Number.isInteger(checkFamilyBriefLatest.totalCount)
        ? checkFamilyBriefLatest.totalCount
        : 0,
      failedCount: Number.isInteger(checkFamilyBriefLatest.failedCount)
        ? checkFamilyBriefLatest.failedCount
        : 0,
      freshnessState: checkFamilyBriefLatest?.freshness?.state ?? "unknown",
      generatedAt: checkFamilyBriefLatest.generatedAt ?? ""
    },
    artifacts: {
      releaseReadyLatestPath: RELEASE_READY_LATEST_PATH,
      checkFamilyPath: CHECK_FAMILY_PATH,
      checkFamilyBriefPath: CHECK_FAMILY_BRIEF_PATH
    }
  };

  fs.writeFileSync(RELEASE_READY_CONSISTENCY_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Release-ready-consistency synced: ${RELEASE_READY_CONSISTENCY_PATH}\n`);
}

main();
