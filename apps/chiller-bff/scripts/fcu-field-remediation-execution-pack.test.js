import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-field-remediation-execution-pack.js");

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
    workOrders: path.join(tempDir, "work-orders.json"),
    outputJson: path.join(tempDir, "execution-pack.json"),
    outputMd: path.join(tempDir, "execution-pack.md"),
    outputCsv: path.join(tempDir, "execution-pack.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.workOrders,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: files.outputCsv
  };
}

test("field remediation execution pack groups onsite P0 work by cause and phase", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-execution-pack-open-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, {
      ok: false,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      summary: {
        totalWorkOrders: 2,
        openCount: 2,
        readyForCanaryAfterCloseout: false
      },
      workOrders: [
        {
          workOrderId: "FCU-P0-BGS03",
          priority: "P0",
          deviceCode: "BGS03",
          deviceName: "办公室03",
          owner: "BA/自控工程师",
          currentEvidence: {
            zoneTemperatureC: 0,
            setpointC: 0,
            communicationAlarm: true,
            reasons: [
              "communication_alarm",
              "zero_temperature",
              "invalid_temperature",
              "temperature_quality_guard",
              "setpoint_feedback_out_of_bounds"
            ]
          },
          fieldVerification: {
            communicationAlarmAfter: "必填：0",
            zoneTemperatureAfterC: "必填：5-45",
            setpointFeedbackAfterC: "必填：10-32"
          },
          releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"]
        },
        {
          workOrderId: "FCU-P0-BGS06",
          priority: "P0",
          deviceCode: "BGS06",
          deviceName: "办公室06",
          owner: "BA/自控工程师",
          currentEvidence: {
            zoneTemperatureC: 22,
            setpointC: 24,
            communicationAlarm: true,
            reasons: ["communication_alarm"]
          },
          fieldVerification: {
            communicationAlarmAfter: "必填：0",
            zoneTemperatureAfterC: "可选",
            setpointFeedbackAfterC: "可选"
          },
          releaseCriteria: ["communicationAlarm=0"]
        }
      ]
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /devices=2 p0=2/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
    assert.equal(report.summary.openP0Devices, 2);
    assert.deepEqual(report.blockedByReason.communication_alarm, ["BGS03", "BGS06"]);
    assert.deepEqual(report.blockedByReason.zero_temperature, ["BGS03"]);
    assert.equal(report.executionOrder.some((item) => item.phase === "restore_communication"), true);
    assert.equal(report.executionOrder.some((item) => item.phase === "onsite_signoff"), true);
    assert.equal(report.deviceTasks[0].signoffFields.localManualLockout, "none");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /本执行包只指导现场消缺、复检和签字，不下发 BA\/PLC/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /communication_alarm/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation execution pack passes when work orders are already closed", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-execution-pack-ready-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.workOrders, {
      ok: true,
      siteId: "126lnoffice",
      summary: {
        totalWorkOrders: 0,
        openCount: 0,
        readyForCanaryAfterCloseout: true
      },
      workOrders: []
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.totalDevices, 0);
    assert.equal(report.summary.canEnterCanaryAfterExecutionPack, true);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /待处理 P0 设备: 0/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
