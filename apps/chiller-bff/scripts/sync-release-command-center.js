import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BFF_DIR = process.cwd();
const ROOT_DIR = path.resolve(BFF_DIR, "..", "..");

const RELEASE_READY_LATEST_PATH =
  process.env.RELEASE_READY_LATEST_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest.json");
const RELEASE_READY_LATEST_CHECK_PATH =
  process.env.RELEASE_READY_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-latest-check.json");
const RELEASE_READY_CONSISTENCY_PATH =
  process.env.RELEASE_READY_CONSISTENCY_PATH ||
  path.resolve(ROOT_DIR, "docs/release-ready-consistency-latest.json");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");
const CHECK_FAMILY_BRIEF_PATH =
  process.env.CHECK_FAMILY_BRIEF_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json");
const RELEASE_COMMAND_CENTER_PATH =
  process.env.RELEASE_COMMAND_CENTER_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
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

function uniqStrings(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return [...new Set(input.filter((value) => typeof value === "string" && value.length > 0))];
}

function gateFromDecision(value) {
  return {
    ok: value?.decision === "GO",
    exitCode: Number.isInteger(value?.exitCode) ? value.exitCode : 1
  };
}

function gateFromOverall(value) {
  return {
    ok: value?.overall === "PASS",
    exitCode: value?.overall === "PASS" ? 0 : 1
  };
}

function gateFromCheckResult(value) {
  return {
    ok: value.ok,
    exitCode: value.exitCode
  };
}

function buildFirstAction({ decision, syncCheckFamily, checkLatest, checkConsistency, freshnessState }) {
  if (!syncCheckFamily.ok) {
    return "先重跑 check-family，总链路未通过时不要发布。";
  }
  if (!checkLatest.ok) {
    return "先重跑 release-ready-latest-check，确认最新发布判定快照。";
  }
  if (!checkConsistency.ok) {
    return "先处理 release-ready 与 check-family 的一致性异常，再决定是否发布。";
  }
  if (decision === "NO-GO") {
    return "先看 reasons，逐项解除阻塞后再重新检查。";
  }
  if (freshnessState !== "fresh") {
    return "先重跑 check-family 刷新快照，再做发布判断。";
  }
  return "可以按当前默认策略进入发布动作。";
}

function main() {
  const syncCheckFamily = runNpmScript("sync:check-family", { CHECK_FAMILY_SILENT: "1" });
  const syncConsistency = runNpmScript("sync:release-ready-consistency");
  const syncLatestCheck = runNpmScript("sync:release-ready-latest-check");
  const checkLatest = runNpmScript("check:release-ready-latest-check");
  const checkConsistency = runNpmScript("check:release-ready-consistency");

  const releaseReadyLatest = readJson(RELEASE_READY_LATEST_PATH, "releaseReadyLatest");
  const releaseReadyLatestCheck = readJson(
    RELEASE_READY_LATEST_CHECK_PATH,
    "releaseReadyLatestCheck"
  );
  const releaseReadyConsistency = readJson(
    RELEASE_READY_CONSISTENCY_PATH,
    "releaseReadyConsistency"
  );
  const checkFamilyLatest = readJson(CHECK_FAMILY_PATH, "checkFamilyLatest");
  const checkFamilyBriefLatest = readJson(CHECK_FAMILY_BRIEF_PATH, "checkFamilyBriefLatest");

  const reasons = uniqStrings([
    ...(Array.isArray(releaseReadyLatest.reasons) ? releaseReadyLatest.reasons : []),
    ...(syncCheckFamily.ok ? [] : ["check_family_sync_failed"]),
    ...(syncConsistency.ok ? [] : ["release_ready_consistency_sync_failed"]),
    ...(syncLatestCheck.ok ? [] : ["release_ready_latest_check_sync_failed"]),
    ...(checkLatest.ok ? [] : ["release_ready_latest_check_failed"]),
    ...(checkConsistency.ok ? [] : ["release_ready_consistency_check_failed"]),
    ...((releaseReadyLatest.decision ?? "NO-GO") === "GO" ? [] : ["release_ready_not_go"]),
    ...((releaseReadyConsistency.decision ?? "NO-GO") === "GO"
      ? []
      : ["release_ready_consistency_not_go"]),
    ...(checkFamilyLatest.overall === "PASS" ? [] : ["check_family_not_pass"]),
    ...(checkFamilyBriefLatest.overall === "PASS" ? [] : ["check_family_brief_not_pass"])
  ]);

  const freshnessState = checkFamilyBriefLatest?.freshness?.state ?? "unknown";
  const advisories = uniqStrings([
    ...(Array.isArray(releaseReadyLatest.advisories) ? releaseReadyLatest.advisories : []),
    ...(freshnessState === "fresh" ? [] : [`check_family_freshness_${freshnessState}`])
  ]);

  const decision = reasons.length === 0 ? "GO" : "NO-GO";
  const summaryClass =
    decision === "NO-GO" ? "blocked" : advisories.length > 0 ? "review_required" : "ready";

  const payload = {
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    source: "aggregated_latest",
    decision,
    summaryClass,
    exitCode: decision === "GO" ? 0 : 1,
    reasons,
    advisories,
    firstAction: buildFirstAction({
      decision,
      syncCheckFamily,
      checkLatest,
      checkConsistency,
      freshnessState
    }),
    gates: {
      syncCheckFamily: gateFromCheckResult(syncCheckFamily),
      syncReleaseReadyConsistency: gateFromCheckResult(syncConsistency),
      syncReleaseReadyLatestCheck: gateFromCheckResult(syncLatestCheck),
      releaseReadyLatestCheck: gateFromCheckResult(checkLatest),
      releaseReadyConsistency: gateFromCheckResult(checkConsistency),
      releaseReadyLatest: gateFromDecision(releaseReadyLatest),
      releaseReadyLatestCheckPayload: gateFromDecision(releaseReadyLatestCheck),
      releaseReadyConsistencyPayload: gateFromDecision(releaseReadyConsistency),
      checkFamily: gateFromOverall(checkFamilyLatest),
      checkFamilyBrief: gateFromOverall(checkFamilyBriefLatest)
    },
    releaseReadyLatest: {
      decision: releaseReadyLatest.decision ?? "NO-GO",
      exitCode: Number.isInteger(releaseReadyLatest.exitCode) ? releaseReadyLatest.exitCode : 1,
      generatedAt: releaseReadyLatest.generatedAt ?? "",
      reasons: Array.isArray(releaseReadyLatest.reasons) ? releaseReadyLatest.reasons : [],
      advisories: Array.isArray(releaseReadyLatest.advisories) ? releaseReadyLatest.advisories : [],
      consistencyOk:
        typeof releaseReadyLatest.consistencyOk === "boolean"
          ? releaseReadyLatest.consistencyOk
          : null,
      verifyGatesOk:
        typeof releaseReadyLatest.verifyGatesOk === "boolean"
          ? releaseReadyLatest.verifyGatesOk
          : null
    },
    releaseReadyLatestCheck: {
      source: releaseReadyLatestCheck.source ?? "unknown",
      decision: releaseReadyLatestCheck.decision ?? "NO-GO",
      exitCode: Number.isInteger(releaseReadyLatestCheck.exitCode)
        ? releaseReadyLatestCheck.exitCode
        : 1,
      generatedAt: releaseReadyLatestCheck.generatedAt ?? "",
      consistencyOk:
        typeof releaseReadyLatestCheck.consistencyOk === "boolean"
          ? releaseReadyLatestCheck.consistencyOk
          : null,
      verifyGatesOk:
        typeof releaseReadyLatestCheck.verifyGatesOk === "boolean"
          ? releaseReadyLatestCheck.verifyGatesOk
          : null
    },
    releaseReadyConsistency: {
      decision: releaseReadyConsistency.decision ?? "NO-GO",
      exitCode: Number.isInteger(releaseReadyConsistency.exitCode)
        ? releaseReadyConsistency.exitCode
        : 1,
      generatedAt: releaseReadyConsistency.generatedAt ?? "",
      reasons: Array.isArray(releaseReadyConsistency.reasons)
        ? releaseReadyConsistency.reasons
        : []
    },
    checkFamilyLatest: {
      overall: checkFamilyLatest.overall ?? "FAIL",
      passedCount: Number.isInteger(checkFamilyLatest.passedCount)
        ? checkFamilyLatest.passedCount
        : 0,
      totalCount: Number.isInteger(checkFamilyLatest.totalCount)
        ? checkFamilyLatest.totalCount
        : 0,
      generatedAt: checkFamilyLatest.generatedAt ?? ""
    },
    checkFamilyBriefLatest: {
      overall: checkFamilyBriefLatest.overall ?? "FAIL",
      failedCount: Number.isInteger(checkFamilyBriefLatest.failedCount)
        ? checkFamilyBriefLatest.failedCount
        : 0,
      freshnessState,
      generatedAt: checkFamilyBriefLatest.generatedAt ?? ""
    },
    artifacts: {
      releaseReadyLatestPath: RELEASE_READY_LATEST_PATH,
      releaseReadyLatestCheckPath: RELEASE_READY_LATEST_CHECK_PATH,
      releaseReadyConsistencyPath: RELEASE_READY_CONSISTENCY_PATH,
      checkFamilyPath: CHECK_FAMILY_PATH,
      checkFamilyBriefPath: CHECK_FAMILY_BRIEF_PATH
    }
  };

  fs.writeFileSync(RELEASE_COMMAND_CENTER_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Release-command-center synced: ${RELEASE_COMMAND_CENTER_PATH}\n`);
}

main();
