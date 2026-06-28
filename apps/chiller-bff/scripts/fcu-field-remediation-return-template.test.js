import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-field-remediation-return-template.js");

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
    signoff: path.join(tempDir, "signoff.json"),
    outputJson: path.join(tempDir, "return-template.json"),
    outputMd: path.join(tempDir, "return-template.md"),
    outputCsv: path.join(tempDir, "return-template.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: files.outputJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: files.outputMd,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: files.outputCsv
  };
}

function writeFixtures(files) {
  writeJson(files.workOrders, {
    siteId: "126lnoffice",
    build: "1",
    floor: "10",
    workOrders: [
      {
        workOrderId: "FCU-P0-BGS03",
        priority: "P0",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师",
        currentEvidence: {
          communicationAlarm: true,
          zoneTemperatureC: 0,
          setpointC: 0,
          qualityStatus: "invalid",
          reasons: ["communication_alarm", "zero_temperature", "setpoint_feedback_out_of_bounds"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "必填：5-45",
          setpointFeedbackAfterC: "必填：10-32",
          writePointMappingChecked: "必填：yes/no",
          twoSampleNormal: "必填：yes/no",
          localManualLockout: "必填：none/manual/lockout",
          releaseDecision: "必填：hold/recheck/release"
        },
        releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"],
        plannedAction: ["恢复通讯", "复核温度点"]
      },
      {
        workOrderId: "FCU-P0-QT02",
        priority: "P0",
        deviceCode: "QT02",
        deviceName: "前厅02",
        currentEvidence: {
          communicationAlarm: true,
          zoneTemperatureC: 26,
          setpointC: 26,
          qualityStatus: "invalid",
          reasons: ["communication_alarm"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "可选",
          setpointFeedbackAfterC: "可选",
          writePointMappingChecked: "必填：yes/no",
          twoSampleNormal: "必填：yes/no",
          localManualLockout: "必填：none/manual/lockout",
          releaseDecision: "必填：hold/recheck/release"
        },
        releaseCriteria: ["communicationAlarm=0"],
        plannedAction: ["恢复通讯"]
      }
    ]
  });
  writeJson(files.signoff, {
    summary: {
      expectedWorkOrders: 2,
      completeRows: 0
    },
    releaseMatrix: [
      {
        workOrderId: "FCU-P0-BGS03",
        missingFields: ["handledBy", "communicationAlarmAfter", "zoneTemperatureAfterC"]
      },
      {
        workOrderId: "FCU-P0-QT02",
        missingFields: ["handledBy", "communicationAlarmAfter"]
      }
    ]
  });
}

test("field remediation return template creates onsite fill pack without control mutation", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-return-template-"));
  try {
    const files = buildFiles(tempDir);
    writeFixtures(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /FCU_FIELD_REMEDIATION_RETURN_TEMPLATE ok=true devices=2 mutation=false/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
    assert.equal(report.summary.deviceCount, 2);
    assert.equal(report.summary.communicationBlocked, 2);
    assert.equal(report.summary.temperatureBlocked, 1);
    assert.equal(report.summary.setpointBlocked, 1);
    assert.equal(report.summary.draftSuggestibleDevices, 1);
    assert.equal(report.summary.draftTemperatureSuggestions, 1);
    assert.equal(report.summary.draftSetpointSuggestions, 1);
    assert.deepEqual(
      report.devices.map((item) => item.deviceCode),
      ["BGS03", "QT02"]
    );
    assert.equal(report.devices[0].requiredValues.communicationAlarmAfter, "必填：0");
    assert.equal(report.devices[0].reviewDraft.releaseDecisionDefault, "recheck");
    assert.equal(report.devices[0].reviewDraft.suggestedValues.zoneTemperatureAfterC, undefined);
    assert.equal(report.devices[0].reviewDraft.blockedAutoFillFields.includes("communicationAlarmAfter"), true);
    assert.equal(report.devices[0].row.releaseDecision, "");
    assert.equal(report.devices[1].reviewDraft.suggestedValues.zoneTemperatureAfterC, "26");
    assert.equal(report.devices[1].reviewDraft.suggestedValues.setpointFeedbackAfterC, "26");
    assert.equal(report.devices[1].reviewDraft.manualOnlyFields.includes("releaseDecision"), true);
    assert.equal(report.devices[1].row.releaseDecision, "");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /本模板只用于现场回填和复核/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /复核草稿/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /currentReasons/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /reviewDraftSuggestedValues/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /BGS03/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
