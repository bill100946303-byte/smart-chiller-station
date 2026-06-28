import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-final-control-runbook.js");

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
    finalGates: path.join(tempDir, "fcu-final-control-gates-latest.json"),
    finalWorklist: path.join(tempDir, "fcu-final-control-worklist-latest.json"),
    signoff: path.join(tempDir, "fcu-field-remediation-signoff-latest.json"),
    signoffClean: path.join(tempDir, "fcu-field-remediation-signoff-clean-input-latest.json"),
    closeout: path.join(tempDir, "fcu-field-remediation-closeout-latest.json"),
    canaryReadiness: path.join(tempDir, "fcu-canary-readiness-latest.json"),
    allDevicePlan: path.join(tempDir, "fcu-all-device-dispatch-plan-latest.json"),
    finalCompletion: path.join(tempDir, "fcu-final-control-completion-latest.json"),
    outputJson: path.join(tempDir, "runbook.json"),
    outputMd: path.join(tempDir, "runbook.md")
  };
}

function buildEnv(files) {
  return {
    FCU_FINAL_CONTROL_GATES_JSON: files.finalGates,
    FCU_FINAL_CONTROL_WORKLIST_JSON: files.finalWorklist,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.signoffClean,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.closeout,
    FCU_CANARY_READINESS_JSON: files.canaryReadiness,
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allDevicePlan,
    FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletion,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: files.outputJson,
    FCU_FINAL_CONTROL_RUNBOOK_MD: files.outputMd
  };
}

function writeBlockedEvidence(files) {
  writeJson(files.finalGates, {
    ok: false,
    controlMutation: false,
    summary: {
      gateCount: 8,
      passed: 0,
      blocked: 8,
      canaryReady: false,
      signoffCompleteRows: 0,
      signoffExpectedRows: 2
    },
    gates: [
      {
        label: "现场签字",
        ok: false,
        value: "0/2",
        blocker: "现场签字未完成"
      },
      {
        label: "Canary readiness",
        ok: false,
        value: "canary_blocked",
        blocker: "Canary 总门禁阻断"
      }
    ],
    blockers: [
      {
        label: "现场签字",
        ok: false,
        value: "0/2",
        blocker: "现场签字未完成"
      },
      {
        label: "Canary readiness",
        ok: false,
        value: "canary_blocked",
        blocker: "Canary 总门禁阻断"
      }
    ],
    nextActions: [
      {
        key: "set-final-rollout-confirm",
        priority: "P0",
        phase: "environment",
        action: "设置最终控制总确认短语",
        command: "export FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE",
        acceptance: "confirm.finalRolloutConfirmPresent=true"
      },
      {
        key: "execute-canary",
        priority: "P0",
        phase: "canary",
        action: "执行首台 Canary 并确认反馈",
        target: "BGS01",
        command: "FCU_CANARY_DEVICE_CODE=BGS01 npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch",
        acceptance: "feedback_confirmed"
      },
      {
        key: "quality-remediation",
        priority: "P0",
        phase: "field_quality",
        action: "整改通讯报警、0°C/无效温度和写点缺失设备",
        target: "2 台 P0 FCU",
        command: "npm --prefix apps/chiller-bff run check:fcu-quality-remediation",
        acceptance: "quality.status=ok"
      },
      {
        key: "clean-stale-signoff",
        priority: "P0",
        phase: "field_signoff",
        action: "确认提升 current-only 现场签字输入并归档旧行",
        command: "FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT npm --prefix apps/chiller-bff run promote:fcu-field-remediation-signoff-input",
        acceptance: "confirmMatched=true"
      },
      {
        key: "complete-field-remediation-signoff",
        priority: "P0",
        phase: "field_signoff",
        action: "补齐 FCU 现场消缺签字和复核字段",
        command: "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff",
        acceptance: "summary.signoffComplete=true"
      }
    ]
  });
  writeJson(files.finalWorklist, {
    ok: false,
    summary: {
      openActions: 1,
      p0OpenActions: 1,
      plannedDeviceCount: 2,
      blockedDeviceCount: 2,
      stagedSetpointDevices: 0
    },
    actions: []
  });
  writeJson(files.signoff, {
    ok: false,
    summary: {
      expectedWorkOrders: 2,
      completeRows: 0,
      openRows: 2
    },
    releaseMatrix: [
      {
        workOrderId: "FCU-P0-BGS03",
        deviceCode: "BGS03",
        deviceName: "办公室03",
        signoffComplete: false,
        canaryBlockReason: "signoff_incomplete",
        missingFields: ["handledBy", "reviewedBy"]
      },
      {
        workOrderId: "FCU-P0-ZHYS",
        deviceCode: "ZHYS",
        deviceName: "中会议室",
        signoffComplete: false,
        canaryBlockReason: "signoff_incomplete",
        missingFields: ["handledBy", "reviewedBy"]
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
    staleRecords: [
      {
        workOrderId: "FCU-P0-CWS",
        deviceCode: "CWS",
        deviceName: "财务室",
        reason: "not_in_current_work_orders"
      }
    ]
  });
  writeJson(files.closeout, { ok: false, verdict: "field_remediation_open" });
  writeJson(files.canaryReadiness, { ok: false, summary: { canaryReady: false } });
  writeJson(files.allDevicePlan, { ok: false, summary: { blockedDevices: 2 } });
  writeJson(files.finalCompletion, { ok: false, verdict: "final_control_incomplete" });
}

function writePassingEvidence(files) {
  writeJson(files.finalGates, {
    ok: true,
    controlMutation: false,
    summary: {
      gateCount: 8,
      passed: 8,
      blocked: 0,
      canaryReady: true,
      signoffCompleteRows: 2,
      signoffExpectedRows: 2
    },
    gates: [],
    blockers: [],
    nextActions: []
  });
  writeJson(files.finalWorklist, {
    ok: true,
    summary: {
      openActions: 0,
      p0OpenActions: 0,
      plannedDeviceCount: 2,
      blockedDeviceCount: 0,
      stagedSetpointDevices: 0
    },
    actions: []
  });
  writeJson(files.signoff, {
    ok: true,
    summary: {
      expectedWorkOrders: 2,
      completeRows: 2,
      openRows: 0
    },
    releaseMatrix: [
      { workOrderId: "FCU-P0-BGS03", deviceCode: "BGS03", signoffComplete: true },
      { workOrderId: "FCU-P0-ZHYS", deviceCode: "ZHYS", signoffComplete: true }
    ]
  });
  writeJson(files.signoffClean, {
    ok: true,
    summary: {
      expectedWorkOrders: 2,
      sourceRows: 2,
      currentRows: 2,
      staleRows: 0
    },
    staleRecords: []
  });
  writeJson(files.closeout, { ok: true, verdict: "field_remediation_ready_for_canary" });
  writeJson(files.canaryReadiness, { ok: true, summary: { canaryReady: true } });
  writeJson(files.allDevicePlan, { ok: true, summary: { blockedDevices: 0 } });
  writeJson(files.finalCompletion, { ok: true, verdict: "final_control_complete" });
}

test("final runbook follows final gate blocked state and forbids dispatch", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-runbook-blocked-"));
  try {
    const files = buildFiles(tempDir);
    writeBlockedEvidence(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /verdict=final_dispatch_blocked/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.verdict, "final_dispatch_blocked");
    assert.equal(report.controlMutation, false);
    assert.equal(report.dispatch, false);
    assert.equal(report.summary.passedGates, 0);
    assert.equal(report.summary.blockedGates, 8);
    assert.equal(report.summary.signoffCompleteRows, 0);
    assert.equal(report.summary.signoffExpectedRows, 2);
    assert.equal(report.summary.signoffStaleRows, 1);
    assert.deepEqual(
      report.nextActions.map((item) => item.key),
      [
        "quality-remediation",
        "clean-stale-signoff",
        "complete-field-remediation-signoff",
        "execute-canary",
        "set-final-rollout-confirm"
      ]
    );
    assert.deepEqual(
      report.staleSignoffRows.map((item) => item.deviceCode),
      ["CWS"]
    );
    assert.equal(report.blockers.some((item) => item.label === "Canary readiness"), true);
    assert.deepEqual(
      report.openSignoffRows.map((item) => item.deviceCode),
      ["BGS03", "ZHYS"]
    );
    const markdown = fs.readFileSync(files.outputMd, "utf8");
    assert.match(markdown, /最终总门禁未通过，禁止真实 BA\/PLC 写入/);
    assert.match(markdown, /过期签核行/);
    assert.match(markdown, /FCU-P0-CWS/);
    assert.match(markdown, /promote:fcu-field-remediation-signoff-input/);
    assert.match(markdown, /BGS03/);
    assert.match(markdown, /ZHYS/);
    assert.ok(
      markdown.indexOf("整改通讯报警、0°C/无效温度和写点缺失设备") <
        markdown.indexOf("执行首台 Canary 并确认反馈")
    );
    assert.ok(
      markdown.indexOf("补齐 FCU 现场消缺签字和复核字段") <
        markdown.indexOf("设置最终控制总确认短语")
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("final runbook reports complete only when final gate and completion both pass", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-final-runbook-complete-"));
  try {
    const files = buildFiles(tempDir);
    writePassingEvidence(files);

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /verdict=final_control_complete/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.verdict, "final_control_complete");
    assert.equal(report.summary.passedGates, 8);
    assert.equal(report.summary.blockedGates, 0);
    assert.equal(report.summary.signoffStaleRows, 0);
    assert.equal(report.openSignoffRows.length, 0);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /最终控制已完成/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
