import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "check-fcu-field-remediation-signoff.js");

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
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
    workOrders: path.join(tempDir, "work-orders.json"),
    signoffCsv: path.join(tempDir, "signoff.csv"),
    outputJson: path.join(tempDir, "signoff.json"),
    outputMd: path.join(tempDir, "signoff.md"),
    outputCsv: path.join(tempDir, "signoff-report.csv"),
    releaseMatrixCsv: path.join(tempDir, "signoff-release-matrix.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_CSV: files.signoffCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: files.outputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: files.releaseMatrixCsv
  };
}

function sampleWorkOrders() {
  return {
    ok: false,
    siteId: "126lnoffice",
    build: "1",
    floor: "1",
    summary: {
      totalWorkOrders: 1,
      openCount: 1
    },
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师",
        plannedAction: ["复检通讯报警", "核对写点映射"],
        releaseCriteria: ["通讯报警=0", "连续两次采样正常"],
        currentEvidence: {
          zoneTemperatureC: 0,
          setpointC: 24,
          communicationAlarm: true,
          reasons: ["communication_alarm", "zero_temperature"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "必填：5-45",
          setpointFeedbackAfterC: "可选",
          writePointMappingChecked: "必填：yes/no",
          twoSampleNormal: "必填：yes/no",
          localManualLockout: "必填：none/manual/lockout",
          releaseDecision: "必填：hold/recheck/release"
        }
      }
    ]
  };
}

const csvHeader = [
  "workOrderId",
  "deviceCode",
  "handledBy",
  "handledAt",
  "communicationAlarmAfter",
  "zoneTemperatureAfterC",
  "setpointFeedbackAfterC",
  "writePointMappingChecked",
  "twoSampleNormal",
  "localManualLockout",
  "releaseDecision",
  "reviewedBy",
  "reviewedAt"
].join(",");

test("field remediation signoff rejects blank onsite CSV rows", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-blank-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, sampleWorkOrders());
    writeText(files.signoffCsv, `${csvHeader}\nFCU-P0-BGS03,BGS03,,,,,,,,,,,\n`);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /complete=0\/1/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.signoffComplete, false);
    assert.equal(report.onsiteReleasePrecheck.ok, false);
    assert.equal(report.onsiteReleasePrecheck.onsiteReleaseReadyCount, 0);
    assert.equal(report.onsiteReleasePrecheck.onsiteReleaseBlockedCount, 1);
    assert.equal(report.onsiteReleasePrecheck.onsiteCanaryCandidateCount, 0);
    assert.equal(report.onsiteReleasePrecheck.devices[0].nextBlockingFields.includes("handledBy"), true);
    assert.equal(report.records[0].issues.includes("handledBy_missing"), true);
    assert.equal(report.records[0].issues.includes("releaseDecision_not_release"), true);
    assert.equal(report.records[0].missingChecklist.some((item) => item.field === "handledBy"), true);
    assert.equal(report.records[0].missingChecklist.some((item) => item.requiredValue === "release"), true);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /不能凭 CSV 直接进入 BA 写入/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /handledBy: 应填 现场处理人姓名/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /missingFields/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /writePointMappingChecked/);
    assert.equal(report.releaseMatrix[0].canEnterCanary, false);
    assert.equal(report.releaseMatrix[0].onsiteCanaryCandidate, false);
    assert.equal(report.releaseMatrix[0].canaryBlockReason, "signoff_incomplete");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场放行预检/);
    assert.match(fs.readFileSync(files.releaseMatrixCsv, "utf8"), /canEnterCanary/);
    assert.match(fs.readFileSync(files.releaseMatrixCsv, "utf8"), /复检通讯报警/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation signoff accepts complete rows but keeps realtime closeout boundary", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-complete-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, sampleWorkOrders());
    writeText(
      files.signoffCsv,
      `${csvHeader}\nFCU-P0-BGS03,BGS03,张工,2026-06-18T10:00:00+08:00,0,25.5,24,yes,yes,none,release,李工,2026-06-18T10:10:00+08:00\n`
    );

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.signoffComplete, true);
    assert.equal(report.summary.stillRequiresRealtimeCloseout, true);
    assert.equal(report.records[0].signoffComplete, true);
    assert.deepEqual(report.records[0].issues, []);
    assert.equal(report.onsiteReleasePrecheck.ok, true);
    assert.equal(report.onsiteReleasePrecheck.onsiteReleaseReadyCount, 1);
    assert.equal(report.onsiteReleasePrecheck.onsiteCanaryCandidateCount, 1);
    assert.equal(report.onsiteReleasePrecheck.canaryCandidateCount, 0);
    assert.equal(report.onsiteReleasePrecheck.canaryStillBlockedCount, 1);
    assert.deepEqual(report.onsiteReleasePrecheck.devices[0].nextBlockingFields, [
      "realtime_closeout",
      "canary_readiness",
      "final_control_gates"
    ]);
    assert.equal(report.releaseMatrix[0].signoffComplete, true);
    assert.equal(report.releaseMatrix[0].onsiteCanaryCandidate, true);
    assert.equal(report.releaseMatrix[0].canEnterCanary, false);
    assert.equal(report.releaseMatrix[0].canaryBlockReason, "signoff_complete_but_realtime_closeout_required");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation signoff rejects invalid or reversed onsite timestamps", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-time-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, sampleWorkOrders());
    writeText(
      files.signoffCsv,
      `${csvHeader}\nFCU-P0-BGS03,BGS03,张工,not-a-time,0,25.5,24,yes,yes,none,release,李工,2026-06-18T10:10:00+08:00\n`
    );

    const invalidResult = await runNodeScript(buildEnv(files));

    assert.equal(invalidResult.status, 2, invalidResult.stdout || invalidResult.stderr);
    const invalidReport = readJson(files.outputJson);
    assert.equal(invalidReport.records[0].issues.includes("handledAt_invalid"), true);
    assert.equal(invalidReport.records[0].missingChecklist.some((item) => item.field === "handledAt"), true);

    writeText(
      files.signoffCsv,
      `${csvHeader}\nFCU-P0-BGS03,BGS03,张工,2026-06-18T10:20:00+08:00,0,25.5,24,yes,yes,none,release,李工,2026-06-18T10:10:00+08:00\n`
    );

    const reversedResult = await runNodeScript(buildEnv(files));

    assert.equal(reversedResult.status, 2, reversedResult.stdout || reversedResult.stderr);
    const reversedReport = readJson(files.outputJson);
    assert.equal(reversedReport.records[0].issues.includes("reviewedAt_before_handledAt"), true);
    assert.equal(reversedReport.releaseMatrix[0].canEnterCanary, false);
    assert.match(fs.readFileSync(files.releaseMatrixCsv, "utf8"), /reviewedAt=晚于或等于 handledAt/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation signoff ignores stale rows for unknown work orders", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-signoff-stale-row-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, sampleWorkOrders());
    writeText(
      files.signoffCsv,
      `${csvHeader}\nFCU-P0-BGS03,BGS03,张工,2026-06-18T10:00:00+08:00,0,25.5,24,yes,yes,none,release,李工,2026-06-18T10:10:00+08:00\nFCU-P0-OLD,OLD,,,,,,,,,,,\n`
    );

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.summary.signoffComplete, true);
    assert.equal(report.summary.ignoredRows, 1);
    assert.equal(report.ignoredRecords[0].workOrderId, "FCU-P0-OLD");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
