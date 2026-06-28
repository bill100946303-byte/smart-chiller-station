import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "check-fcu-canary-readiness.js");

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runNodeScript(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status: status ?? 0, stdout, stderr });
    });
  });
}

function buildFiles(tempDir) {
  return {
    signoff: path.join(tempDir, "signoff.json"),
    closeout: path.join(tempDir, "closeout.json"),
    fieldArm: path.join(tempDir, "field-arm.json"),
    adapter: path.join(tempDir, "adapter.json"),
    canaryPackage: path.join(tempDir, "canary-package.json"),
    outputJson: path.join(tempDir, "readiness.json"),
    outputMd: path.join(tempDir, "readiness.md")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.closeout,
    FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
    FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapter,
    FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
    FCU_CANARY_READINESS_JSON: files.outputJson,
    FCU_CANARY_READINESS_MD: files.outputMd
  };
}

function writeReadyReports(files) {
  writeJson(files.signoff, {
    ok: true,
    siteId: "126lnoffice",
    controlMutation: false,
    summary: {
      signoffComplete: true,
      completeRows: 9,
      expectedWorkOrders: 9
    }
  });
  writeJson(files.closeout, {
    ok: true,
    siteId: "126lnoffice",
    verdict: "field_remediation_ready_for_canary",
    controlMutation: false,
    summary: {
      readyForCanary: true,
      remainingDeviceCount: 0,
      firstCanary: "BGS01"
    }
  });
  writeJson(files.fieldArm, {
    ok: true,
    verdict: "field_arm_ready",
    controlMutation: false,
    firstCanary: "BGS01"
  });
  writeJson(files.adapter, {
    ok: true,
    verdict: "ba_write_adapter_ready",
    controlMutation: false,
    blockingItems: []
  });
  writeJson(files.canaryPackage, {
    ok: true,
    verdict: "canary_package_ready",
    controlMutation: false,
    canary: {
      deviceCode: "BGS01"
    },
    blockers: []
  });
}

test("canary readiness passes only when all referenced gates are ready", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-readiness-ready-"));
  try {
    const files = buildFiles(tempDir);
    writeReadyReports(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /verdict=canary_ready/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.canaryReady, true);
    assert.equal(report.summary.blockedCount, 0);
    assert.equal(report.readinessPlaybook.canExecuteCanary, true);
    assert.equal(report.readinessPlaybook.blockedGateCount, 0);
    assert.equal(report.readinessPlaybook.readyGateCount, 6);
    assert.equal(report.readinessPlaybook.firstBlockedPhase, null);
    assert.equal(report.readinessPlaybook.fieldBlocked, false);
    assert.equal(report.readinessPlaybook.baBlocked, false);
    assert.equal(report.readinessPlaybook.canaryPackageBlocked, false);
    assert.equal(report.readinessPlaybook.phasePlan.length, 6);
    assert.equal(report.readinessPlaybook.phasePlan[0].phase, "现场签字");
    assert.match(report.nextCommand, /execute:fcu-canary-dispatch/);
    const markdown = fs.readFileSync(files.outputMd, "utf8");
    assert.match(markdown, /可以进入 Canary/);
    assert.match(markdown, /Readiness 作战表/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("canary readiness blocks when signoff, closeout, and arm-check are not ready", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-readiness-blocked-"));
  try {
    const files = buildFiles(tempDir);
    writeReadyReports(files);
    writeJson(files.signoff, {
      ok: false,
      controlMutation: false,
      summary: {
        signoffComplete: false,
        completeRows: 0,
        expectedWorkOrders: 9
      }
    });
    writeJson(files.closeout, {
      ok: false,
      verdict: "field_remediation_open",
      controlMutation: false,
      summary: {
        readyForCanary: false,
        remainingDeviceCount: 9
      }
    });
    writeJson(files.fieldArm, {
      ok: false,
      verdict: "field_arm_blocked",
      controlMutation: false,
      firstCanary: "BGS01"
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /verdict=canary_blocked/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.summary.canaryReady, false);
    assert.ok(report.blockers.find((item) => item.key === "field_signoff_complete"));
    assert.ok(report.blockers.find((item) => item.key === "realtime_closeout_ready"));
    assert.ok(report.blockers.find((item) => item.key === "field_arm_ready"));
    assert.equal(report.readinessPlaybook.canExecuteCanary, false);
    assert.equal(report.readinessPlaybook.blockedGateCount, 3);
    assert.equal(report.readinessPlaybook.readyGateCount, 3);
    assert.equal(report.readinessPlaybook.firstBlockedPhase, "现场签字");
    assert.equal(report.readinessPlaybook.firstBlockedOwner, "现场/运维");
    assert.match(report.readinessPlaybook.firstBlockedAction, /fcu-field-remediation-signoff-input-latest.csv/);
    assert.equal(report.readinessPlaybook.fieldBlocked, true);
    assert.equal(report.readinessPlaybook.baBlocked, false);
    assert.equal(report.readinessPlaybook.canaryPackageBlocked, false);
    const signoffPhase = report.readinessPlaybook.phasePlan.find((item) => item.key === "field_signoff_complete");
    assert.equal(signoffPhase.sourceFile, files.signoff);
    assert.equal(signoffPhase.sourceReadable, true);
    assert.equal(report.nextCommand, "先处理 blockers；禁止执行 execute:fcu-canary-dispatch");
    const markdown = fs.readFileSync(files.outputMd, "utf8");
    assert.match(markdown, /Readiness 作战表/);
    assert.match(markdown, /第一阻断: 现场签字/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
