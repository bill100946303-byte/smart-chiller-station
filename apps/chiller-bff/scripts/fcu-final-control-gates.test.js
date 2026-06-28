import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "check-fcu-final-control-gates.js");

test("final control gates refreshes canary evidence before canary readiness", () => {
  const source = fs.readFileSync(scriptPath, "utf8");
  const orderedKeys = [
    'key: "smallBatchPlan"',
    'key: "goLivePreflight"',
    'key: "canaryQueue"',
    'key: "fieldArm"',
    'key: "canaryPackage"',
    'key: "baAdapter"',
    'key: "canaryReadiness"'
  ];
  const positions = orderedKeys.map((needle) => source.indexOf(needle));
  assert.equal(positions.every((position) => position >= 0), true);
  for (let index = 1; index < positions.length; index += 1) {
    assert.equal(
      positions[index] > positions[index - 1],
      true,
      `${orderedKeys[index]} must be refreshed after ${orderedKeys[index - 1]}`
    );
  }
});

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
        FCU_FINAL_CONTROL_GATES_REFRESH: "false",
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
    quality: path.join(tempDir, "fcu-quality-remediation-latest.json"),
    plan: path.join(tempDir, "fcu-all-device-dispatch-plan-latest.json"),
    closeout: path.join(tempDir, "fcu-field-remediation-closeout-latest.json"),
    workOrders: path.join(tempDir, "fcu-field-remediation-work-orders-latest.json"),
    executionPack: path.join(tempDir, "fcu-field-remediation-execution-pack-latest.json"),
    signoff: path.join(tempDir, "fcu-field-remediation-signoff-latest.json"),
    signoffClean: path.join(tempDir, "fcu-field-remediation-signoff-clean-input-latest.json"),
    signoffPromote: path.join(tempDir, "fcu-field-remediation-signoff-promote-latest.json"),
    canaryReadiness: path.join(tempDir, "fcu-canary-readiness-latest.json"),
    finalCompletion: path.join(tempDir, "fcu-final-control-completion-latest.json"),
    finalWorklist: path.join(tempDir, "fcu-final-control-worklist-latest.json"),
    outputJson: path.join(tempDir, "gates.json"),
    outputMd: path.join(tempDir, "gates.md")
  };
}

function buildEnv(tempDir, files) {
  return {
    FCU_FINAL_CONTROL_GATES_OUTPUT_DIR: tempDir,
    FCU_FINAL_CONTROL_GATES_JSON: files.outputJson,
    FCU_FINAL_CONTROL_GATES_MD: files.outputMd
  };
}

function writeBlockedEvidence(files) {
  writeJson(files.quality, {
    ok: false,
    summary: {
      p0Count: 8,
      communicationAlarmCount: 8,
      zeroTemperatureCount: 4,
      invalidTemperatureCount: 4
    }
  });
  writeJson(files.plan, {
    ok: true,
    summary: {
      immediateReady: 9,
      stagedSetpoint: 12,
      blocked: 8,
      canCompleteAllNow: false
    }
  });
  writeJson(files.closeout, {
    ok: false,
    verdict: "field_remediation_open",
    summary: {
      readyForCanary: false,
      remainingDeviceCount: 8
    }
  });
  writeJson(files.workOrders, {
    ok: false,
    summary: {
      totalWorkOrders: 8,
      openCount: 8
    },
    workOrders: []
  });
  writeJson(files.executionPack, {
    ok: false,
    controlMutation: false,
    summary: {
      openP0Devices: 8,
      reasonCounts: {
        communication_alarm: 8,
        zero_temperature: 4,
        setpoint_feedback_out_of_bounds: 6
      }
    }
  });
  writeJson(files.signoff, {
    ok: false,
    summary: {
      signoffComplete: false,
      completeRows: 0,
      expectedWorkOrders: 8
    }
  });
  writeJson(files.canaryReadiness, {
    ok: false,
    verdict: "canary_blocked",
    summary: {
      canaryReady: false,
      blockedCount: 2
    }
  });
  writeJson(files.finalCompletion, {
    ok: false,
    verdict: "final_control_incomplete"
  });
  writeJson(files.finalWorklist, {
    ok: false,
    verdict: "worklist_open",
    summary: {
      openActions: 6
    },
    actions: [
      {
        priority: "P0",
        phase: "field_remediation",
        action: "处理 8 台 P0 FCU",
        target: "现场 BA/自控"
      }
    ]
  });
}

function writePassingEvidence(files) {
  writeJson(files.quality, { ok: true, summary: { p0Count: 0 } });
  writeJson(files.plan, {
    ok: true,
    summary: {
      immediateReady: 29,
      stagedSetpoint: 0,
      blocked: 0,
      canCompleteAllNow: true
    }
  });
  writeJson(files.closeout, {
    ok: true,
    verdict: "field_remediation_closed",
    summary: { readyForCanary: true }
  });
  writeJson(files.workOrders, {
    ok: true,
    summary: { totalWorkOrders: 0, openCount: 0 },
    workOrders: []
  });
  writeJson(files.executionPack, {
    ok: true,
    controlMutation: false,
    summary: { openP0Devices: 0, reasonCounts: {} }
  });
  writeJson(files.signoff, {
    ok: true,
    summary: {
      signoffComplete: true,
      completeRows: 8,
      expectedWorkOrders: 8
    }
  });
  writeJson(files.canaryReadiness, {
    ok: true,
    verdict: "canary_ready",
    summary: { canaryReady: true, blockedCount: 0 }
  });
  writeJson(files.finalCompletion, {
    ok: true,
    verdict: "final_control_complete"
  });
  writeJson(files.finalWorklist, {
    ok: true,
    verdict: "worklist_closed",
    summary: { openActions: 0 },
    actions: []
  });
}

test("final control gates report blocked state without control mutation", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-gates-blocked-"));
  try {
    const files = buildFiles(tempDir);
    writeBlockedEvidence(files);

    const result = await runNodeScript(buildEnv(tempDir, files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /FCU_FINAL_CONTROL_GATES ok=false/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.gateCount, 8);
    assert.equal(report.summary.blocked, 8);
    assert.equal(report.summary.qualityP0Devices, 8);
    assert.equal(report.summary.fieldP0Devices, 8);
    assert.equal(report.gates.some((item) => item.label === "现场执行包"), true);
    assert.equal(report.blockers.some((item) => item.label === "Canary readiness"), true);
    assert.equal(report.nextActions[0].phase, "field_remediation");
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /# FCU 最终控制总门禁/);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /现场执行包/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final control gates pass only when every evidence gate is closed", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-gates-pass-"));
  try {
    const files = buildFiles(tempDir);
    writePassingEvidence(files);

    const result = await runNodeScript(buildEnv(tempDir, files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /FCU_FINAL_CONTROL_GATES ok=true/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.passed, 8);
    assert.equal(report.summary.blocked, 0);
    assert.deepEqual(report.blockers, []);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /可进入最终控制归档/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
