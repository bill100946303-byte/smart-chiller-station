import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-field-remediation-work-orders.js");

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
    closeout: path.join(tempDir, "closeout.json"),
    outputJson: path.join(tempDir, "work-orders.json"),
    outputMd: path.join(tempDir, "work-orders.md"),
    outputCsv: path.join(tempDir, "work-orders.csv"),
    signoffInputCsv: path.join(tempDir, "signoff-input.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.closeout,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: files.outputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.signoffInputCsv
  };
}

test("field remediation work orders turn open closeout devices into signoff rows", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-work-orders-open-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.closeout, {
      ok: false,
      siteId: "126lnoffice",
      build: "1",
      floor: "1",
      verdict: "field_remediation_open",
      summary: {
        readyForCanary: false,
        remainingDeviceCount: 1
      },
      remainingDevices: [
        {
          priority: "P0",
          deviceCode: "BGS03",
          deviceName: "办公室03",
          zoneTemperatureC: 0,
          setpointC: 0,
          communicationAlarm: true,
          qualityStatus: "invalid",
          reasons: ["communication_alarm", "zero_temperature"],
          fieldActions: ["现场确认 FCU 控制器供电和通讯报警复位。"],
          releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"]
        }
      ]
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /workOrders=1 open=1/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.totalWorkOrders, 1);
    assert.equal(report.summary.requiresFieldSignoff, true);
    assert.deepEqual(report.summary.reasonCounts, [
      { reason: "communication_alarm", count: 1 },
      { reason: "zero_temperature", count: 1 }
    ]);
    assert.deepEqual(report.summary.reasonGroups, [
      { reason: "communication_alarm", devices: ["BGS03"] },
      { reason: "zero_temperature", devices: ["BGS03"] }
    ]);
    assert.equal(report.summary.recommendedOrder.some((item) => item.includes("communication_alarm")), true);
    assert.equal(report.workOrders[0].workOrderId, "FCU-P0-BGS03");
    assert.equal(report.workOrders[0].owner, "BA/自控工程师");
    assert.equal(report.workOrders[0].fieldVerification.communicationAlarmAfter, "必填：0");
    assert.equal(report.outputs.signoffInputCsv, files.signoffInputCsv);
    assert.equal(report.importTemplate.requiredColumns.includes("releaseDecision"), true);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /handledBy,handledAt/);
    assert.match(fs.readFileSync(files.signoffInputCsv, "utf8"), /handledBy,handledAt/);
    const markdown = fs.readFileSync(files.outputMd, "utf8");
    assert.match(markdown, /releaseDecision=release` 不等于自动放行/);
    assert.match(markdown, /## 现场处理顺序/);
    assert.match(markdown, /## 按原因分组/);
    assert.match(markdown, /communication_alarm: 1 台 \/ BGS03/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation work orders preserve onsite fields while refreshing current guidance columns", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-work-orders-keep-signoff-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.closeout, {
      ok: false,
      siteId: "126lnoffice",
      summary: { readyForCanary: false },
      remainingDevices: [
        {
          priority: "P0",
          deviceCode: "BGS03",
          deviceName: "办公室03",
          reasons: ["communication_alarm", "communication_ok", "global_execution_gate"],
          fieldActions: ["检查通讯。", "复核最新 BA 网关轮询。"],
          releaseCriteria: ["communicationAlarm=0", "连续两次采样保持正常"]
        },
        {
          priority: "P0",
          deviceCode: "BGS04",
          deviceName: "办公室04",
          reasons: ["communication_alarm"],
          fieldActions: ["检查通讯。"],
          releaseCriteria: ["communicationAlarm=0"]
        }
      ]
    });
    fs.writeFileSync(
      files.signoffInputCsv,
      [
        "workOrderId,priority,deviceCode,deviceName,owner,status,currentZoneTemperatureC,currentSetpointC,currentCommunicationAlarm,reasons,plannedAction,releaseCriteria,handledBy,handledAt,communicationAlarmAfter,zoneTemperatureAfterC,setpointFeedbackAfterC,writePointMappingChecked,twoSampleNormal,localManualLockout,releaseDecision,reviewedBy,reviewedAt,notes",
        "FCU-P0-BGS03,P0,BGS03,办公室03,旧负责人,open,,,,old_reason,旧动作,旧标准,已填写,2026-06-18T10:00:00+08:00,0,24,,yes,yes,none,release,复核人,2026-06-18T10:05:00+08:00,保留备注",
        ""
      ].join("\n")
    );

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    const signoffInput = fs.readFileSync(files.signoffInputCsv, "utf8");
    assert.match(signoffInput, /FCU-P0-BGS03/);
    assert.match(signoffInput, /已填写/);
    assert.match(signoffInput, /复核最新 BA 网关轮询/);
    assert.match(signoffInput, /连续两次采样保持正常/);
    assert.doesNotMatch(signoffInput, /old_reason/);
    assert.doesNotMatch(signoffInput, /communication_ok/);
    assert.doesNotMatch(signoffInput, /global_execution_gate/);
    assert.match(signoffInput, /FCU-P0-BGS04/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field remediation work orders pass when closeout is already ready", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-work-orders-ready-"));
  try {
    const files = buildFiles(tempDir);
    writeJson(files.closeout, {
      ok: true,
      siteId: "126lnoffice",
      verdict: "field_remediation_ready_for_canary",
      summary: {
        readyForCanary: true,
        remainingDeviceCount: 0
      },
      remainingDevices: []
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.summary.totalWorkOrders, 0);
    assert.equal(report.summary.readyForCanaryAfterCloseout, true);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /工单数: 0/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
