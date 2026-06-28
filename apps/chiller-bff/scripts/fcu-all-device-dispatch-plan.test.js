import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const planScriptPath = path.join(__dirname, "plan-fcu-all-device-dispatch.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runPlanScript(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [planScriptPath], {
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

function startStubBff({ health, commissioning }) {
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    let payload = null;
    if (url === "/healthz") {
      payload = health;
    } else if (url.includes("/hvac-terminal/fan-coils/commissioning-status")) {
      payload = commissioning;
    }
    if (!payload) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

test("FCU all-device plan stages setpoint-only blocked devices instead of hard blocking them", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-all-device-plan-"));
  const outputJson = path.join(tempDir, "plan.json");
  const outputMd = path.join(tempDir, "plan.md");
  const stub = await startStubBff({
    health: {
      ok: true,
      readOnlyMode: true
    },
    commissioning: {
      executionGate: {
        dispatchAllowed: false,
        blockedReasons: ["read_only_mode"]
      },
      items: [
        {
          device: {
            deviceCode: "BGS01",
            deviceName: "办公室01",
            zoneTemperatureC: 26,
            setpointC: 25
          },
          deviceReady: true,
          canDispatch: false,
          blockedReasons: [],
          controlBlockReasons: []
        },
        {
          device: {
            deviceCode: "QT01",
            deviceName: "前厅01",
            zoneTemperatureC: 27,
            setpointC: 35,
            setpointFeedbackC: 35
          },
          deviceReady: false,
          canDispatch: false,
          blockedReasons: ["setpoint_feedback_valid", "global_execution_gate"],
          controlBlockReasons: ["setpoint_feedback_out_of_bounds"]
        },
        {
          device: {
            deviceCode: "BGS03",
            deviceName: "办公室03",
            zoneTemperatureC: 0,
            setpointC: 24,
            communicationAlarm: true
          },
          deviceReady: false,
          canDispatch: false,
          blockedReasons: ["temperature_valid"],
          controlBlockReasons: ["communication_alarm", "temperature_quality_guard"]
        }
      ]
    }
  });

  try {
    const result = await runPlanScript({
      BFF_BASE_URL: stub.baseUrl,
      FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: outputJson,
      FCU_ALL_DEVICE_DISPATCH_PLAN_MD: outputMd
    });

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /immediate=1 staged=1 blocked=1/);
    const report = readJson(outputJson);
    assert.equal(report.summary.immediateReady, 1);
    assert.equal(report.summary.stagedSetpoint, 1);
    assert.equal(report.summary.blocked, 1);
    assert.deepEqual(report.stagedSetpointDevices.map((item) => item.deviceCode), ["QT01"]);
    assert.equal(report.stagedSetpointDevices[0].setpointNormalizationRequired, true);
    assert.deepEqual(report.blockedDevices.map((item) => item.deviceCode), ["BGS03"]);
    assert.deepEqual(report.blockingByReason.map((item) => item.reason), ["communication_alarm", "temperature_quality_guard"]);
    assert.match(fs.readFileSync(outputMd, "utf8"), /分步调设定/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
