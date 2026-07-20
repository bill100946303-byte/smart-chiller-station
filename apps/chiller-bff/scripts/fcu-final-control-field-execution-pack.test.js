import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-final-control-field-execution-pack.js");

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
    finalWorklist: path.join(tempDir, "worklist.json"),
    runbook: path.join(tempDir, "runbook.json"),
    handoff: path.join(tempDir, "handoff.json"),
    signoff: path.join(tempDir, "signoff.json"),
    canaryReadiness: path.join(tempDir, "canary-readiness.json"),
    outputJson: path.join(tempDir, "field-execution.json"),
    outputMd: path.join(tempDir, "field-execution.md"),
    outputCsv: path.join(tempDir, "field-execution.csv")
  };
}

function buildEnv(files) {
  return {
    FCU_FINAL_CONTROL_WORKLIST_JSON: files.finalWorklist,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: files.runbook,
    FCU_FIELD_HANDOFF_PACK_JSON: files.handoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_CANARY_READINESS_JSON: files.canaryReadiness,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON: files.outputJson,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD: files.outputMd,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV: files.outputCsv
  };
}

function writeBlockedFixtures(files) {
  writeJson(files.finalWorklist, {
    ok: false,
    siteId: "126lnoffice",
    summary: {
      openActions: 11,
      p0OpenActions: 10
    }
  });
  writeJson(files.runbook, {
    ok: false,
    siteId: "126lnoffice",
    verdict: "final_dispatch_blocked",
    summary: {
      finalGatePassed: false,
      gateCount: 8,
      passedGates: 0,
      canaryReady: false,
      signoffCompleteRows: 0,
      signoffExpectedRows: 2,
      blockedDeviceCount: 2
    },
    controlMutation: false,
    dispatch: false
  });
  writeJson(files.handoff, {
    ok: false,
    siteId: "126lnoffice",
    summary: {
      openP0Devices: 2,
      signoffCompleteRows: 0,
      signoffExpectedRows: 2
    },
    devices: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        owner: "BA/自控工程师",
        reasonLabels: ["通讯报警", "0°C异常"],
        todayAction: "修复通讯和温度点。",
        releaseCriteria: ["communicationAlarm=0", "zoneTemperatureC 在 5-45°C"]
      },
      {
        workOrderId: "FCU-P0-QT02",
        deviceCode: "QT02",
        deviceName: "前厅02",
        owner: "BA/自控工程师",
        reasonLabels: ["通讯报警"],
        todayAction: "修复通讯。",
        releaseCriteria: ["communicationAlarm=0"]
      }
    ]
  });
  writeJson(files.signoff, {
    ok: false,
    summary: {
      expectedWorkOrders: 2,
      completeRows: 0,
      signoffComplete: false
    },
    openRecords: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        missingChecklist: [
          { field: "handledBy", action: "填写处理人" },
          { field: "releaseDecision", action: "现场确认 release" }
        ]
      }
    ],
    releaseMatrix: [
      {
        workOrderId: "FCU-P0-QT02",
        deviceCode: "QT02",
        deviceName: "前厅02",
        signoffComplete: true,
        onsiteCanaryCandidate: true,
        canEnterCanary: false,
        canaryBlockReason: "实时 closeout 仍阻断",
        missingFields: []
      }
    ]
  });
  writeJson(files.canaryReadiness, {
    ok: false,
    verdict: "canary_blocked",
    summary: {
      canaryReady: false,
      blockedCount: 4
    },
    readinessPlaybook: {
      firstBlockedAction: "先完成现场签核和实时 closeout。"
    }
  });
}

test("final control field execution pack builds readonly onsite queue", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-field-execution-"));
  try {
    const files = buildFiles(tempDir);
    writeBlockedFixtures(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK ok=false devices=2 checklist=0\/4 mutation=false dispatch=false/);
    const report = readJson(files.outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
    assert.equal(report.summary.firstBlocker, "现场签核");
    assert.equal(report.summary.openDevices, 2);
    assert.equal(report.summary.onsiteCanaryCandidateDevices, 1);
    assert.deepEqual(report.deviceQueue.map((item) => item.deviceCode), ["BGS03", "QT02"]);
    assert.equal(report.deviceQueue[0].missingFields[0], "handledBy");
    assert.equal(report.deviceQueue[1].onsiteCanaryCandidate, true);
    assert.equal(report.deviceQueue[1].canEnterCanary, false);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /最终放行前仍阻断/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场候选\/后续门禁阻断/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /onsite_candidate_blocked/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /本脚本不调用 control-cycle、control-command、Canary dispatch/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /BGS03/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
