import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "check-fcu-field-remediation-closeout.js");

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
      resolve({
        status: status ?? 0,
        stdout,
        stderr
      });
    });
  });
}

function buildFiles(tempDir) {
  return {
    quality: path.join(tempDir, "quality.json"),
    plan: path.join(tempDir, "plan.json"),
    outputJson: path.join(tempDir, "closeout.json"),
    outputMd: path.join(tempDir, "closeout.md"),
    outputCsv: path.join(tempDir, "closeout.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_QUALITY_REMEDIATION_JSON: files.quality,
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.plan,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_CLOSEOUT_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: files.outputCsv
  };
}

test("field remediation closeout stays blocked while P0 devices remain", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-closeout-open-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.quality, {
      ok: true,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      summary: {
        p0Count: 2,
        remediationCount: 2,
        canCompleteFinalControl: false,
        evidenceIncomplete: false
      },
      devices: [
        {
          deviceCode: "BGS03",
          deviceName: "办公室03",
          severity: "P0",
          status: "blocked",
          zoneTemperatureC: 0,
          setpointC: 0,
          communicationAlarm: true,
          qualityStatus: "invalid",
          reasons: ["communication_alarm", "zero_temperature"],
          blockedReasons: ["communication_ok", "temperature_valid", "global_execution_gate"],
          fieldActions: ["现场确认通讯报警复位。"],
          releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"]
        }
      ]
    });
    writeJson(files.plan, {
      ok: true,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      firstCanary: "BGS01",
      summary: {
        plannedDeviceCount: 21,
        blocked: 2
      },
      blockedDevices: [
        {
          deviceCode: "BGS03",
          deviceName: "办公室03",
          status: "blocked",
          communicationAlarm: true,
          zoneTemperatureC: 0,
          setpointC: 0,
          qualityStatus: "invalid",
          blockedReasons: ["communication_alarm", "temperature_valid"]
        },
        {
          deviceCode: "BGS04",
          deviceName: "办公室04",
          status: "blocked",
          communicationAlarm: true,
          zoneTemperatureC: 0,
          setpointC: 0,
          qualityStatus: "invalid",
          blockedReasons: ["communication_alarm"]
        }
      ]
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /verdict=field_remediation_open/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.readyForCanary, false);
    assert.equal(report.summary.qualityP0Count, 2);
    assert.equal(report.summary.planBlockedCount, 2);
    assert.equal(report.remainingDevices.length, 2);
    const bgs03 = report.remainingDevices.find((item) => item.deviceCode === "BGS03");
    assert.ok(bgs03);
    assert.deepEqual(bgs03.reasons, ["communication_alarm", "zero_temperature"]);
    assert.ok(report.remainingDevices.find((item) => item.deviceCode === "BGS04"));
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场消缺未关闭/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /BGS03/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation closeout blocks when evidence is incomplete", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-closeout-evidence-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.quality, {
      ok: false,
      summary: {
        p0Count: 0,
        canCompleteFinalControl: false,
        evidenceIncomplete: true
      },
      devices: []
    });
    writeJson(files.plan, {
      ok: true,
      summary: {
        plannedDeviceCount: 21,
        blocked: 0
      },
      blockedDevices: []
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /field_remediation_evidence_incomplete/);
    const report = readJson(files.outputJson);
    assert.equal(report.summary.evidenceIncomplete, true);
    assert.equal(report.summary.qualityP0Count, 1);
    assert.equal(report.remainingDevices[0].deviceCode, "EVIDENCE_INCOMPLETE");
    assert.match(report.remainingDevices[0].fieldActions.join("\n"), /恢复 FCU 快照/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation closeout passes only when quality and plan are both closed", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-closeout-ready-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.quality, {
      ok: true,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      summary: {
        p0Count: 0,
        remediationCount: 0,
        canCompleteFinalControl: true,
        evidenceIncomplete: false
      },
      devices: []
    });
    writeJson(files.plan, {
      ok: true,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      firstCanary: "BGS01",
      summary: {
        plannedDeviceCount: 29,
        blocked: 0
      },
      blockedDevices: []
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /field_remediation_ready_for_canary/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.qualityClosed, true);
    assert.equal(report.summary.planReady, true);
    assert.equal(report.summary.readyForCanary, true);
    assert.deepEqual(report.releaseGate.requiredBeforeCanary, []);
    assert.equal(report.remainingDevices.length, 0);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /可进入首台 Canary/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
