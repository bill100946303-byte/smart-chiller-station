import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runNodeScript(scriptName, env, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd,
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

test("canary artifact scripts do not derive docs from process cwd", () => {
  for (const scriptName of [
    "check-fcu-commissioning-readiness.js",
    "check-fcu-device-control-matrix.js",
    "check-fcu-field-arm.js",
    "check-fcu-go-live-preflight.js",
    "check-fcu-quality-remediation.js",
    "build-fcu-canary-queue.js",
    "build-fcu-canary-execution-package.js",
    "build-fcu-field-arm-package.js",
    "execute-fcu-canary-dispatch.js",
    "execute-fcu-canary-window.js",
    "execute-fcu-small-batch-dispatch.js",
    "plan-fcu-small-batch-dispatch.js",
    "plan-fcu-all-device-dispatch.js",
    "rollback-fcu-small-batch-dispatch.js",
    "stage-fcu-small-batch-policy.js",
    "stage-fcu-all-device-policy.js",
    "check-fcu-final-control-completion.js"
  ]) {
    const source = fs.readFileSync(path.join(__dirname, scriptName), "utf8");
    assert.equal(
      source.includes('path.resolve(process.cwd(), "../../docs'),
      false,
      `${scriptName} must resolve default docs from the script directory, not caller cwd`
    );
  }
});

test("canary queue builds from explicit inputs while caller cwd is repo root", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-queue-path-"));
  const repoRoot = path.resolve(__dirname, "../../..");
  try {
    const planJson = path.join(tempDir, "plan.json");
    const preflightJson = path.join(tempDir, "preflight.json");
    const outputJson = path.join(tempDir, "queue.json");
    const outputMd = path.join(tempDir, "queue.md");
    writeJson(planJson, {
      devices: [
        {
          deviceCode: "BGS01",
          deviceName: "办公室01",
          zoneTemperatureC: 27,
          setpointC: 26,
          previews: {
            setpoint: {
              decisionStatus: "ready",
              commandCount: 1,
              commands: [{ commandType: "setpoint", tagName: "BGS01-SP", value: 25.5, unit: "C" }]
            }
          }
        }
      ]
    });
    writeJson(preflightJson, {
      ok: false,
      verdict: "blocked_until_field_authorization",
      blockingItems: []
    });
    const result = await runNodeScript("build-fcu-canary-queue.js", {
      FCU_SMALL_BATCH_PLAN_JSON: planJson,
      FCU_GO_LIVE_PREFLIGHT_JSON: preflightJson,
      FCU_CANARY_QUEUE_JSON: outputJson,
      FCU_CANARY_QUEUE_MD: outputMd
    }, repoRoot);
    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = JSON.parse(fs.readFileSync(outputJson, "utf8"));
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.firstCanary, "BGS01");
    assert.equal(fs.existsSync(outputMd), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("field arm package builds from explicit reports while caller cwd is repo root", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-field-arm-path-"));
  const repoRoot = path.resolve(__dirname, "../../..");
  try {
    const files = {
      canaryPackage: path.join(tempDir, "canary-package.json"),
      adapter: path.join(tempDir, "adapter.json"),
      feedback: path.join(tempDir, "feedback.json"),
      canaryWindow: path.join(tempDir, "canary-window.json"),
      worklist: path.join(tempDir, "worklist.json"),
      completion: path.join(tempDir, "completion.json"),
      quality: path.join(tempDir, "quality.json"),
      outputJson: path.join(tempDir, "field-arm.json"),
      outputMd: path.join(tempDir, "field-arm.md"),
      outputCsv: path.join(tempDir, "field-arm.csv")
    };
    writeJson(files.canaryPackage, {
      canary: {
        deviceCode: "BGS01",
        deviceName: "办公室01",
        primaryCommand: { tagName: "BGS01-SP", value: 25.5 },
        executionCommand: "execute canary"
      },
      requiredEnv: {
        FCU_SMALL_BATCH_CONFIRM: "I_UNDERSTAND_REAL_BA_WRITE"
      },
      blockers: []
    });
    writeJson(files.adapter, {
      canary: {
        command: { tagName: "BGS01-SP", value: 25.5 }
      },
      checks: [
        { key: "backend_write_gate", ok: false, evidence: "readOnlyMode=true" },
        { key: "ba_write_confirm", ok: false, evidence: "confirm missing" },
        { key: "canary_command_mapping", ok: true, evidence: "mapped" }
      ],
      blockingItems: []
    });
    writeJson(files.feedback, {
      verdict: "waiting_for_canary_dispatch",
      canary: {
        dispatchConfirmed: false,
        feedbackConfirmed: false
      }
    });
    writeJson(files.canaryWindow, { evidence: { readiness: { blockers: [] } } });
    writeJson(files.worklist, { actions: [] });
    writeJson(files.completion, {});
    writeJson(files.quality, { devices: [] });
    const result = await runNodeScript("build-fcu-field-arm-package.js", {
      FCU_CANARY_DEVICE_CODE: "BGS01",
      FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryPackage,
      FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapter,
      FCU_CANARY_FEEDBACK_MONITOR_JSON: files.feedback,
      FCU_CANARY_WINDOW_JSON: files.canaryWindow,
      FCU_FINAL_CONTROL_WORKLIST_JSON: files.worklist,
      FCU_FINAL_CONTROL_COMPLETION_JSON: files.completion,
      FCU_QUALITY_REMEDIATION_JSON: files.quality,
      FCU_FIELD_ARM_PACKAGE_JSON: files.outputJson,
      FCU_FIELD_ARM_PACKAGE_MD: files.outputMd,
      FCU_FIELD_ARM_PACKAGE_CSV: files.outputCsv
    }, repoRoot);
    assert.equal(result.status, 2, result.stdout || result.stderr);
    const report = JSON.parse(fs.readFileSync(files.outputJson, "utf8"));
    assert.equal(report.controlMutation, false);
    assert.equal(report.deviceCode, "BGS01");
    assert.equal(fs.existsSync(files.outputMd), true);
    assert.equal(fs.existsSync(files.outputCsv), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
