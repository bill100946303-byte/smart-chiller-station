import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "build-fcu-canary-execution-package.js");
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";

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
    queue: path.join(tempDir, "queue.json"),
    smallBatchPlan: path.join(tempDir, "small-batch-plan.json"),
    preflight: path.join(tempDir, "preflight.json"),
    fieldArm: path.join(tempDir, "field-arm.json"),
    runbook: path.join(tempDir, "runbook.json"),
    quality: path.join(tempDir, "quality.json"),
    outputJson: path.join(tempDir, "canary-package.json"),
    outputMd: path.join(tempDir, "canary-package.md"),
    outputCsv: path.join(tempDir, "canary-package.csv")
  };
}

function buildEnv(files, extra = {}) {
  return {
    FCU_CANARY_QUEUE_JSON: files.queue,
    FCU_SMALL_BATCH_PLAN_JSON: files.smallBatchPlan,
    FCU_GO_LIVE_PREFLIGHT_JSON: files.preflight,
    FCU_FIELD_ARM_CHECK_JSON: files.fieldArm,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: files.runbook,
    FCU_QUALITY_REMEDIATION_JSON: files.quality,
    FCU_CANARY_EXECUTION_PACKAGE_JSON: files.outputJson,
    FCU_CANARY_EXECUTION_PACKAGE_MD: files.outputMd,
    FCU_CANARY_EXECUTION_PACKAGE_CSV: files.outputCsv,
    ...extra
  };
}

function writeReadyInputs(files) {
  writeJson(files.queue, {
    ok: true,
    summary: {
      firstCanary: "BGS01",
      plannedDevices: 2
    },
    queue: [
      {
        deviceCode: "BGS01",
        deviceName: "办公室01-BGS01",
        zoneTemperatureC: 27,
        setpointC: 26,
        running: true,
        primaryCommand: {
          kind: "setpoint",
          commandType: "setpoint",
          pointKey: "setpoint",
          pointName: "设置温度",
          tagName: "BGS01-508-40133",
          value: 25.5,
          unit: "°C"
        },
        secondaryCommand: {
          kind: "fan_speed",
          commandType: "fan_speed",
          pointKey: "fanSpeed",
          pointName: "风速模式",
          tagName: "BGS01-508-40136",
          value: "auto"
        }
      }
    ]
  });
  writeJson(files.smallBatchPlan, {
    ok: true,
    summary: {
      plannedDeviceCount: 2
    },
    devices: [
      {
        deviceCode: "BGS01",
        previews: {
          setpoint: {
            commands: [
              {
                commandType: "setpoint",
                pointKey: "setpoint",
                pointName: "设置温度",
                tagName: "BGS01-508-40133",
                value: 25.5,
                unit: "°C"
              }
            ]
          },
          fanSpeed: {
            commands: [
              {
                commandType: "fan_speed",
                pointKey: "fanSpeed",
                pointName: "风速模式",
                tagName: "BGS01-508-40136",
                value: "auto"
              }
            ]
          }
        }
      }
    ]
  });
  writeJson(files.preflight, {
    ok: true,
    verdict: "go_live_ready",
    blockingItems: []
  });
  writeJson(files.fieldArm, {
    ok: true,
    verdict: "field_arm_ready",
    firstCanary: "BGS01",
    blockingItems: []
  });
  writeJson(files.runbook, {
    ok: true,
    scope: {
      canaryDevice: "BGS01"
    }
  });
  writeJson(files.quality, {
    ok: true,
    summary: {
      p0Count: 0
    },
    devices: []
  });
}

test("canary execution package is ready when preflight, arm-check, confirm, and write gate are ready", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-package-ready-"));
  try {
    const files = buildFiles(tempDir);
    writeReadyInputs(files);

    const result = await runNodeScript(buildEnv(files, {
      FCU_SMALL_BATCH_CONFIRM: CONFIRM_PHRASE
    }));

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /ok=true/);
    assert.match(result.stdout, /verdict=canary_ready_for_authorized_window/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, true);
    assert.equal(report.verdict, "canary_ready_for_authorized_window");
    assert.equal(report.blockers.length, 0);
    assert.equal(report.canary.deviceCode, "BGS01");
    assert.equal(report.canary.primaryCommand.tagName, "BGS01-508-40133");
    assert.equal(report.preconditions.find((item) => item.key === "ba_write_confirm")?.passed, true);
    assert.equal(report.preconditions.find((item) => item.key === "backend_write_gate")?.passed, true);
    assert.match(fs.readFileSync(files.outputMd, "utf8"), /FCU_CANARY_DEVICE_CODE=BGS01/);
    assert.match(fs.readFileSync(files.outputCsv, "utf8"), /ba_write_confirm/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("canary execution package blocks when confirm phrase or backend write gate is missing", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-canary-package-blocked-"));
  try {
    const files = buildFiles(tempDir);
    writeReadyInputs(files);
    writeJson(files.fieldArm, {
      ok: false,
      verdict: "field_arm_blocked",
      firstCanary: "BGS01",
      blockingItems: [
        {
          key: "backend_write_gate",
          label: "BFF 写入总闸",
          severity: "P0",
          message: "requires /healthz readOnlyMode=false"
        }
      ]
    });

    const result = await runNodeScript(buildEnv(files));

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /ok=false/);
    assert.match(result.stdout, /verdict=canary_package_ready_with_open_gates/);
    const report = readJson(files.outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.preconditions.find((item) => item.key === "ba_write_confirm")?.passed, false);
    assert.equal(report.preconditions.find((item) => item.key === "backend_write_gate")?.passed, false);
    assert.ok(report.blockers.find((item) => item.key === "ba_write_confirm"));
    assert.ok(report.blockers.find((item) => item.key === "backend_write_gate"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
