import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BFF_DIR = process.cwd();
const ROOT_DIR = path.resolve(BFF_DIR, "..", "..");

const RELEASE_COMMAND_CENTER_PATH =
  process.env.RELEASE_COMMAND_CENTER_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest.json");
const RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH =
  process.env.RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-latest-check.json");
const RELEASE_COMMAND_CENTER_SYNC_PATH =
  process.env.RELEASE_COMMAND_CENTER_SYNC_PATH ||
  path.resolve(ROOT_DIR, "docs/release-command-center-sync-latest.json");

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

function buildFirstAction({ decision, latestCheckOk, syncOk }) {
  if (!syncOk) {
    return "先重跑 release-command-center-sync，确保总同步完整完成。";
  }
  if (!latestCheckOk) {
    return "先重跑 release-command-center-latest-check，确认最新投影层通过。";
  }
  if (decision === "NO-GO") {
    return "先看 reasons，再处理阻塞项，处理完后重新同步。";
  }
  return "可以从 release-command-center-latest-check 开始做值班判定。";
}

function main() {
  const syncCenter = runNpmScript("sync:release-command-center");
  const checkCenter = runNpmScript("check:release-command-center");
  const syncLatestCheck = runNpmScript("sync:release-command-center-latest-check");
  const checkLatestCheck = runNpmScript("check:release-command-center-latest-check");

  const centerPayload = readJson(RELEASE_COMMAND_CENTER_PATH, "releaseCommandCenterLatest");
  const latestCheckPayload = readJson(
    RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH,
    "releaseCommandCenterLatestCheck"
  );

  const reasons = uniqStrings([
    ...(Array.isArray(centerPayload.reasons) ? centerPayload.reasons : []),
    ...(syncCenter.ok ? [] : ["release_command_center_sync_failed"]),
    ...(checkCenter.ok ? [] : ["release_command_center_check_failed"]),
    ...(syncLatestCheck.ok ? [] : ["release_command_center_latest_check_sync_failed"]),
    ...(checkLatestCheck.ok ? [] : ["release_command_center_latest_check_failed"])
  ]);

  const advisories = uniqStrings([
    ...(Array.isArray(centerPayload.advisories) ? centerPayload.advisories : []),
    ...(syncCenter.ok && checkCenter.ok && syncLatestCheck.ok && checkLatestCheck.ok
      ? []
      : ["sync_chain_review_required"])
  ]);

  const decision = reasons.length === 0 ? "GO" : "NO-GO";
  const summaryClass =
    decision === "NO-GO" ? "blocked" : advisories.length > 0 ? "review_required" : "ready";

  const payload = {
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    source: "sync_chain",
    decision,
    summaryClass,
    exitCode: decision === "GO" ? 0 : 1,
    reasons,
    advisories,
    firstAction: buildFirstAction({
      decision,
      latestCheckOk: checkLatestCheck.ok,
      syncOk: syncCenter.ok && syncLatestCheck.ok
    }),
    steps: {
      releaseCommandCenterSync: {
        ok: syncCenter.ok,
        exitCode: syncCenter.exitCode
      },
      releaseCommandCenterCheck: {
        ok: checkCenter.ok,
        exitCode: checkCenter.exitCode
      },
      releaseCommandCenterLatestCheckSync: {
        ok: syncLatestCheck.ok,
        exitCode: syncLatestCheck.exitCode
      },
      releaseCommandCenterLatestCheck: {
        ok: checkLatestCheck.ok,
        exitCode: checkLatestCheck.exitCode
      }
    },
    releaseCommandCenter: {
      decision: centerPayload.decision ?? "NO-GO",
      summaryClass: centerPayload.summaryClass ?? "blocked",
      exitCode: Number.isInteger(centerPayload.exitCode) ? centerPayload.exitCode : 1,
      generatedAt: centerPayload.generatedAt ?? "",
      reasons: Array.isArray(centerPayload.reasons) ? centerPayload.reasons : [],
      advisories: Array.isArray(centerPayload.advisories) ? centerPayload.advisories : []
    },
    releaseCommandCenterLatestCheck: {
      decision: latestCheckPayload.decision ?? "NO-GO",
      summaryClass: latestCheckPayload.summaryClass ?? "blocked",
      exitCode: Number.isInteger(latestCheckPayload.exitCode) ? latestCheckPayload.exitCode : 1,
      generatedAt: latestCheckPayload.generatedAt ?? "",
      consistencyOk:
        typeof latestCheckPayload.consistencyOk === "boolean"
          ? latestCheckPayload.consistencyOk
          : null
    },
    artifacts: {
      releaseCommandCenterPath: RELEASE_COMMAND_CENTER_PATH,
      releaseCommandCenterLatestCheckPath: RELEASE_COMMAND_CENTER_LATEST_CHECK_PATH
    }
  };

  fs.writeFileSync(RELEASE_COMMAND_CENTER_SYNC_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Release-command-center-sync synced: ${RELEASE_COMMAND_CENTER_SYNC_PATH}\n`);
}

main();
