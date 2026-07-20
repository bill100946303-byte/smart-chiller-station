import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-field-handoff-pack.js");

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
    executionPack: path.join(tempDir, "execution-pack.json"),
    signoffClean: path.join(tempDir, "signoff-clean.json"),
    signoff: path.join(tempDir, "signoff.json"),
    runbook: path.join(tempDir, "runbook.json"),
    outputJson: path.join(tempDir, "handoff.json"),
    outputMd: path.join(tempDir, "handoff.md"),
    outputCsv: path.join(tempDir, "handoff.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.workOrders,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: files.executionPack,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: files.runbook,
    FCU_FIELD_HANDOFF_PACK_JSON: files.outputJson,
    FCU_FIELD_HANDOFF_PACK_MD: files.outputMd,
    FCU_FIELD_HANDOFF_PACK_CSV: files.outputCsv
  };
}

function writeBlockedFixtures(files) {
  writeJson(files.workOrders, {
    ok: false,
    siteId: "126lnoffice",
    build: "1",
    floor: "1",
    outputs: {
      signoffInputCsv: "/tmp/signoff-input.csv"
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
        releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"],
        plannedAction: ["修复通讯和温度点"]
      },
      {
        workOrderId: "FCU-P0-QT02",
        priority: "P0",
        deviceCode: "QT02",
        deviceName: "前厅02",
        owner: "BA/自控工程师",
        currentEvidence: {
          zoneTemperatureC: 26,
          setpointC: 26,
          communicationAlarm: true,
          reasons: ["communication_alarm"]
        },
        fieldVerification: {
          communicationAlarmAfter: "必填：0",
          zoneTemperatureAfterC: "可选",
          setpointFeedbackAfterC: "可选"
        },
        releaseCriteria: ["communicationAlarm=0"],
        plannedAction: ["修复通讯"]
      }
    ]
  });
  writeJson(files.executionPack, {
    ok: false,
    build: "1",
    floor: "1",
    executionOrder: [
      {
        phase: "restore_communication",
        deviceCount: 2,
        deviceCodes: ["BGS03", "QT02"],
        owners: ["BA/自控工程师"],
        acceptance: "通讯报警为 0，连续两次采样正常。"
      },
      {
        phase: "restore_temperature",
        deviceCount: 1,
        deviceCodes: ["BGS03"],
        owners: ["BA/自控工程师"],
        acceptance: "温度在 5-45°C，0°C/越界温度消失。"
      }
    ]
  });
  writeJson(files.signoffClean, {
    ok: false,
    summary: {
      expectedWorkOrders: 2,
      sourceRows: 3,
      currentRows: 2,
      staleRows: 1
    },
    outputs: {
      currentCsv: "/tmp/current-only.csv",
      staleCsv: "/tmp/stale.csv"
    },
    staleRecords: [
      {
        workOrderId: "FCU-P0-CWS",
        deviceCode: "CWS",
        deviceName: "财务室",
        reason: "not_in_current_work_orders"
      }
    ]
  });
  writeJson(files.signoff, {
    ok: false,
    summary: {
      expectedWorkOrders: 2,
      completeRows: 0,
      openRows: 2,
      ignoredRows: 1
    }
  });
  writeJson(files.runbook, {
    ok: false,
    siteId: "126lnoffice",
    summary: {
      finalGatePassed: false,
      canaryReady: false,
      signoffCompleteRows: 0,
      signoffExpectedRows: 2,
      blockedDeviceCount: 2,
      p0OpenActions: 2
    }
  });
}

test("field handoff pack summarizes onsite blockers without control mutation", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-handoff-"));
  try {
    const files = buildFiles(tempDir);
    writeBlockedFixtures(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /FCU_FIELD_HANDOFF_PACK ok=false devices=2 stale=1 mutation=false/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
    assert.equal(report.summary.openP0Devices, 2);
    assert.equal(report.summary.staleSignoffRows, 1);
    assert.equal(report.summary.nextAllowedStep, "先清理过期签核行，生成 current-only 输入表。");
    assert.deepEqual(
      report.todaySequence.map((item) => item.phase),
      ["restore_communication", "restore_temperature"]
    );
    assert.deepEqual(
      report.devices.map((item) => item.deviceCode),
      ["BGS03", "QT02"]
    );
    assert.equal(report.devices[0].requiredReturnFields.releaseDecision, "release");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /最终门禁未通过/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /本交接包不产生 BA\/PLC 写入/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /BGS03/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
