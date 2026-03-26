import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BFF_DIR = process.cwd();
const ROOT_DIR = path.resolve(BFF_DIR, "..", "..");
const CHECK_FAMILY_PATH =
  process.env.CHECK_FAMILY_PATH ||
  path.resolve(ROOT_DIR, "docs/check-family-latest.json");

const CHECKS = [
  {
    script: "check:contract",
    input: "openapi/bff-v1.yaml + openapi/examples/*.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:source-keys",
    input: "openapi/bff-v1.yaml + docs/source-status-key-dictionary-v1.2.json",
    output: "stdout + report json",
    recompute: false
  },
  {
    script: "check:acceptance-report",
    input: "docs/v19.2-acceptance-report.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:status-json",
    input: "scripts/chiller_ctl.sh status-json modes",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-snapshot",
    input: "docs/release-snapshot-latest.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-snapshot-index",
    input: "docs/release-snapshot-index-latest.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-snapshot-diff",
    input: "docs/release-snapshot-diff-latest.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-ready",
    input: "docs/release-ready-latest.json or fallback artifacts",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-ready-latest-check",
    input: "docs/release-ready-latest-check.json or latest/fallback",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-ready-sync",
    input: "docs/release-ready-sync-latest.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-ready-brief",
    input: "docs/release-ready-sync-latest.json brief projection",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:release-ready-consistency",
    input: "docs/release-ready-consistency-latest.json",
    output: "stdout",
    recompute: true
  },
  {
    script: "check:verify-gates",
    input: "docs/verify-gates-latest.json",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:check-family-freshness",
    input: "docs/check-family-latest.json + MAX_AGE_MIN",
    output: "stdout",
    recompute: false
  },
  {
    script: "check:check-family-brief",
    input: "docs/check-family-brief-latest.json",
    output: "stdout",
    recompute: true
  },
  {
    script: "check:check-family-consistency",
    input: "docs/check-family-latest.json + docs/check-family-brief-latest.json",
    output: "stdout",
    recompute: true
  },
  {
    script: "check:check-family",
    input: "docs/check-family-latest.json",
    output: "stdout",
    recompute: true
  }
];

function runNpmScript(script, envOverrides = {}) {
  const result = spawnSync("npm", ["run", script], {
    cwd: BFF_DIR,
    stdio: "pipe",
    env: { ...process.env, ...envOverrides },
    encoding: "utf8"
  });
  return {
    ok: (result.status ?? 1) === 0,
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function buildPayload(checkResults) {
  const passedCount = checkResults.filter((x) => x.ok).length;
  return {
    version: "v1.2",
    generatedAt: new Date().toISOString(),
    overall: passedCount === checkResults.length ? "PASS" : "FAIL",
    passedCount,
    totalCount: checkResults.length,
    checks: checkResults.map((x) => ({
      script: x.script,
      ok: x.ok,
      exitCode: x.exitCode,
      input: x.input,
      output: x.output,
      recompute: x.recompute
    }))
  };
}

function updateResult(results, script, patch) {
  const idx = results.findIndex((x) => x.script === script);
  if (idx < 0) {
    throw new Error(`script not found in check-family results: ${script}`);
  }
  results[idx] = { ...results[idx], ...patch };
}

function writePayload(payload) {
  fs.writeFileSync(CHECK_FAMILY_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  const silent = process.env.CHECK_FAMILY_SILENT === "1";

  const results = [];
  for (const one of CHECKS) {
    if (
      one.script === "check:check-family" ||
      one.script === "check:check-family-brief" ||
      one.script === "check:check-family-consistency" ||
      one.script === "check:release-ready-consistency"
    ) {
      results.push({ ...one, ok: false, exitCode: 1 });
      continue;
    }
    if (!silent) {
      process.stdout.write(`running ${one.script}...\n`);
    }
    const run = runNpmScript(one.script);
    results.push({ ...one, ok: run.ok, exitCode: run.exitCode });
  }

  // Provisional write so downstream checks can validate the same output file.
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running sync:check-family-brief (phase1)...\n");
  }
  const syncBriefPhase1 = runNpmScript("sync:check-family-brief", {
    CHECK_FAMILY_SILENT: "1"
  });
  if (!silent && !syncBriefPhase1.ok) {
    process.stdout.write(`sync:check-family-brief phase1 failed (exit=${syncBriefPhase1.exitCode})\n`);
  }

  if (!silent) {
    process.stdout.write("running check:check-family-brief (phase1)...\n");
  }
  const briefRunPhase1 = runNpmScript("check:check-family-brief");
  updateResult(results, "check:check-family-brief", {
    ok: syncBriefPhase1.ok && briefRunPhase1.ok,
    exitCode: syncBriefPhase1.ok ? briefRunPhase1.exitCode : syncBriefPhase1.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running sync:check-family-brief (phase2)...\n");
  }
  const syncBriefPhase2 = runNpmScript("sync:check-family-brief", {
    CHECK_FAMILY_SILENT: "1"
  });
  if (!silent && !syncBriefPhase2.ok) {
    process.stdout.write(`sync:check-family-brief phase2 failed (exit=${syncBriefPhase2.exitCode})\n`);
  }

  if (!silent) {
    process.stdout.write("running check:check-family-brief (phase2)...\n");
  }
  const briefRunPhase2 = runNpmScript("check:check-family-brief");
  updateResult(results, "check:check-family-brief", {
    ok: syncBriefPhase2.ok && briefRunPhase2.ok,
    exitCode: syncBriefPhase2.ok ? briefRunPhase2.exitCode : syncBriefPhase2.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family-consistency...\n");
  }
  const consistencyRun = runNpmScript("check:check-family-consistency", {
    CHECK_FAMILY_PATH,
    CHECK_FAMILY_BRIEF_PATH: path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json")
  });
  updateResult(results, "check:check-family-consistency", {
    ok: consistencyRun.ok,
    exitCode: consistencyRun.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family (phase1)...\n");
  }
  const selfRun = runNpmScript("check:check-family", {
    CHECK_FAMILY_PATH
  });
  updateResult(results, "check:check-family", { ok: selfRun.ok, exitCode: selfRun.exitCode });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running sync:check-family-brief (final)...\n");
  }
  const syncBriefFinal = runNpmScript("sync:check-family-brief", {
    CHECK_FAMILY_SILENT: "1"
  });
  if (!silent && !syncBriefFinal.ok) {
    process.stdout.write(`sync:check-family-brief final failed (exit=${syncBriefFinal.exitCode})\n`);
  }
  if (!silent) {
    process.stdout.write("running check:check-family-brief (final)...\n");
  }
  const briefRunFinal = runNpmScript("check:check-family-brief");
  updateResult(results, "check:check-family-brief", {
    ok: syncBriefFinal.ok && briefRunFinal.ok,
    exitCode: syncBriefFinal.ok ? briefRunFinal.exitCode : syncBriefFinal.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family-consistency (final)...\n");
  }
  const consistencyFinal = runNpmScript("check:check-family-consistency", {
    CHECK_FAMILY_PATH,
    CHECK_FAMILY_BRIEF_PATH: path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json")
  });
  updateResult(results, "check:check-family-consistency", {
    ok: consistencyFinal.ok,
    exitCode: consistencyFinal.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running sync:release-ready-consistency...\n");
  }
  const syncReleaseReadyConsistency = runNpmScript("sync:release-ready-consistency");
  if (!silent && !syncReleaseReadyConsistency.ok) {
    process.stdout.write(
      `sync:release-ready-consistency failed (exit=${syncReleaseReadyConsistency.exitCode})\n`
    );
  }
  if (!silent) {
    process.stdout.write("running check:release-ready-consistency...\n");
  }
  const releaseReadyConsistencyCheck = runNpmScript("check:release-ready-consistency");
  updateResult(results, "check:release-ready-consistency", {
    ok: syncReleaseReadyConsistency.ok && releaseReadyConsistencyCheck.ok,
    exitCode: syncReleaseReadyConsistency.ok
      ? releaseReadyConsistencyCheck.exitCode
      : syncReleaseReadyConsistency.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family (final)...\n");
  }
  const selfRunFinal = runNpmScript("check:check-family", {
    CHECK_FAMILY_PATH
  });
  updateResult(results, "check:check-family", {
    ok: selfRunFinal.ok,
    exitCode: selfRunFinal.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running sync:check-family-brief (seal)...\n");
  }
  const syncBriefSeal = runNpmScript("sync:check-family-brief", {
    CHECK_FAMILY_SILENT: "1"
  });
  if (!silent && !syncBriefSeal.ok) {
    process.stdout.write(`sync:check-family-brief seal failed (exit=${syncBriefSeal.exitCode})\n`);
  }
  if (!silent) {
    process.stdout.write("running check:check-family-brief (seal)...\n");
  }
  const briefRunSeal = runNpmScript("check:check-family-brief");
  updateResult(results, "check:check-family-brief", {
    ok: syncBriefSeal.ok && briefRunSeal.ok,
    exitCode: syncBriefSeal.ok ? briefRunSeal.exitCode : syncBriefSeal.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family-consistency (seal)...\n");
  }
  const consistencySeal = runNpmScript("check:check-family-consistency", {
    CHECK_FAMILY_PATH,
    CHECK_FAMILY_BRIEF_PATH: path.resolve(ROOT_DIR, "docs/check-family-brief-latest.json")
  });
  updateResult(results, "check:check-family-consistency", {
    ok: consistencySeal.ok,
    exitCode: consistencySeal.exitCode
  });
  writePayload(buildPayload(results));

  if (!silent) {
    process.stdout.write("running check:check-family (seal)...\n");
  }
  const selfRunSeal = runNpmScript("check:check-family", {
    CHECK_FAMILY_PATH
  });
  updateResult(results, "check:check-family", {
    ok: selfRunSeal.ok,
    exitCode: selfRunSeal.exitCode
  });

  const payload = buildPayload(results);
  writePayload(payload);

  if (!silent) {
    process.stdout.write(
      `Check-family synced: ${CHECK_FAMILY_PATH} (overall=${payload.overall}, passed=${payload.passedCount}/${payload.totalCount})\n`
    );
  }

  process.exit(payload.overall === "PASS" ? 0 : 1);
}

main();
