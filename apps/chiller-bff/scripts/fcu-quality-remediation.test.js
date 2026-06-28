import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qualityScriptPath = path.join(__dirname, "check-fcu-quality-remediation.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runNodeScript(scriptPath, env) {
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

function startStubBff({ snapshot, commissioning }) {
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    let payload = null;
    if (url.includes("/hvac-terminal/fan-coils/commissioning-status")) {
      payload = commissioning;
    } else if (url.includes("/hvac-terminal/fan-coils")) {
      payload = snapshot;
    }
    if (!payload) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const status = Number(payload.__status || 200);
    res.writeHead(status, { "content-type": "application/json" });
    const body = payload.__payload || payload;
    res.end(JSON.stringify(body));
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

test("FCU quality remediation treats missing temperature and write-point blockers as P0", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-quality-remediation-"));
  const outputJson = path.join(tempDir, "quality.json");
  const outputMd = path.join(tempDir, "quality.md");
  const outputCsv = path.join(tempDir, "quality.csv");
  const stub = await startStubBff({
    snapshot: {
      site: { siteId: "126lnoffice" },
      summary: {
        total: 2,
        communicationAlarmCount: 0,
        zeroTemperatureCount: 0,
        invalidTemperatureCount: 1,
        dataStatus: "ok"
      },
      items: [
        {
          deviceCode: "BGS01",
          deviceName: "办公室01",
          zoneTemperatureC: null,
          setpointC: 24,
          communicationAlarm: false,
          quality: {
            status: "invalid",
            flags: ["missing_temperature"],
            comfortEligible: false
          },
          points: {
            zoneTemperature: {
              tagName: "BGS01-506-40219",
              value: null
            }
          }
        },
        {
          deviceCode: "BGS02",
          deviceName: "办公室02",
          zoneTemperatureC: 25.5,
          setpointC: 24,
          communicationAlarm: false,
          quality: {
            status: "ok",
            flags: [],
            comfortEligible: true
          },
          points: {
            zoneTemperature: {
              tagName: "BGS02-506-40251",
              value: 25.5
            }
          }
        }
      ]
    },
    commissioning: {
      summary: {
        total: 2,
        deviceReady: 1,
        deviceBlocked: 1
      },
      items: [
        {
          device: {
            deviceCode: "BGS01",
            deviceName: "办公室01"
          },
          status: "blocked",
          blockedReasons: ["temperature_valid", "start_writable", "stop_writable", "setpoint_writable", "fan_speed_writable"],
          controlBlockReasons: ["invalid_temperature", "temperature_quality_guard"]
        },
        {
          device: {
            deviceCode: "BGS02",
            deviceName: "办公室02"
          },
          status: "environment_blocked",
          blockedReasons: ["global_execution_gate"],
          controlBlockReasons: []
        }
      ]
    }
  });

  try {
    const result = await runNodeScript(qualityScriptPath, {
      BFF_BASE_URL: stub.baseUrl,
      FCU_QUALITY_REMEDIATION_JSON: outputJson,
      FCU_QUALITY_REMEDIATION_MD: outputMd,
      FCU_QUALITY_REMEDIATION_CSV: outputCsv
    });

    assert.equal(result.status, 0, result.stdout || result.stderr);
    assert.match(result.stdout, /remediation=1 p0=1/);
    const report = readJson(outputJson);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.remediationCount, 1);
    assert.equal(report.summary.p0Count, 1);
    assert.equal(report.summary.canCompleteFinalControl, false);
    assert.deepEqual(
      report.reasonCounts.map((item) => item.reason).sort(),
      ["fan_speed_writable", "missing_temperature", "setpoint_writable", "start_writable", "stop_writable", "temperature_quality_guard"].sort()
    );
    assert.equal(report.devices[0].deviceCode, "BGS01");
    assert.equal(report.devices[0].severity, "P0");
    assert.ok(report.devices[0].reasons.includes("missing_temperature"));
    assert.ok(report.devices[0].reasons.includes("start_writable"));
    assert.match(report.devices[0].fieldActions.join("\n"), /缺温度时禁止进入闭环/);
    assert.match(report.devices[0].fieldActions.join("\n"), /启动写点/);
    assert.match(report.devices[0].releaseCriteria.join("\n"), /writable=true/);
    assert.match(fs.readFileSync(outputMd, "utf8"), /写点[\s\S]*映射/);
    assert.match(fs.readFileSync(outputCsv, "utf8"), /BGS01/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FCU quality remediation blocks final control when snapshot evidence is unavailable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-quality-remediation-snapshot-fail-"));
  const outputJson = path.join(tempDir, "quality.json");
  const outputMd = path.join(tempDir, "quality.md");
  const outputCsv = path.join(tempDir, "quality.csv");
  const stub = await startStubBff({
    snapshot: {
      __status: 500,
      __payload: {
        error: "snapshot unavailable"
      }
    },
    commissioning: {
      summary: {
        total: 29,
        deviceReady: 20,
        deviceBlocked: 9
      },
      items: []
    }
  });

  try {
    const result = await runNodeScript(qualityScriptPath, {
      BFF_BASE_URL: stub.baseUrl,
      FCU_QUALITY_REMEDIATION_JSON: outputJson,
      FCU_QUALITY_REMEDIATION_MD: outputMd,
      FCU_QUALITY_REMEDIATION_CSV: outputCsv
    });

    assert.equal(result.status, 2, result.stdout || result.stderr);
    assert.match(result.stdout, /remediation=9 p0=9/);
    const report = readJson(outputJson);
    assert.equal(report.ok, false);
    assert.equal(report.controlMutation, false);
    assert.equal(report.summary.evidenceIncomplete, true);
    assert.equal(report.summary.canCompleteFinalControl, false);
    assert.equal(report.summary.p0Count, 9);
    assert.equal(report.summary.remediationCount, 9);
    assert.equal(report.evidence.snapshot.status, 500);
    assert.match(report.nextActions[0].reason, /质量证据不完整/);
    assert.match(fs.readFileSync(outputMd, "utf8"), /存在质量阻断/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FCU quality remediation does not turn valid temperature condition keys into temperature work", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-quality-remediation-valid-temp-"));
  const outputJson = path.join(tempDir, "quality.json");
  const outputMd = path.join(tempDir, "quality.md");
  const outputCsv = path.join(tempDir, "quality.csv");
  const stub = await startStubBff({
    snapshot: {
      site: { siteId: "126lnoffice" },
      summary: {
        total: 1,
        communicationAlarmCount: 1,
        zeroTemperatureCount: 0,
        invalidTemperatureCount: 1,
        dataStatus: "ok"
      },
      items: [
        {
          deviceCode: "BGS06",
          deviceName: "办公室06",
          zoneTemperatureC: 22,
          setpointC: 24,
          communicationAlarm: true,
          quality: {
            status: "invalid",
            flags: [],
            comfortEligible: false
          },
          points: {
            communicationAlarm: {
              tagName: "BGS06-502-40166",
              value: "1"
            },
            zoneTemperature: {
              tagName: "BGS06-506-40571",
              value: "22.0"
            },
            setpointFeedback: {
              tagName: "BGS06-506-40575",
              value: "24.0"
            }
          }
        }
      ]
    },
    commissioning: {
      summary: {
        total: 1,
        deviceReady: 0,
        deviceBlocked: 1
      },
      items: [
        {
          device: {
            deviceCode: "BGS06",
            deviceName: "办公室06"
          },
          status: "blocked",
          blockedReasons: ["communication_ok", "temperature_valid", "global_execution_gate"],
          controlBlockReasons: ["communication_alarm", "invalid_temperature"]
        }
      ]
    }
  });

  try {
    const result = await runNodeScript(qualityScriptPath, {
      BFF_BASE_URL: stub.baseUrl,
      FCU_QUALITY_REMEDIATION_JSON: outputJson,
      FCU_QUALITY_REMEDIATION_MD: outputMd,
      FCU_QUALITY_REMEDIATION_CSV: outputCsv
    });

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(outputJson);
    assert.equal(report.summary.p0Count, 1);
    assert.deepEqual(report.reasonCounts.map((item) => item.reason), ["communication_alarm"]);
    assert.equal(report.devices[0].deviceCode, "BGS06");
    assert.deepEqual(report.devices[0].reasons, ["communication_alarm"]);
    assert.match(report.devices[0].fieldActions.join("\n"), /通讯报警/);
    assert.doesNotMatch(report.devices[0].fieldActions.join("\n"), /补齐或修复区域温度点/);
    assert.doesNotMatch(report.devices[0].fieldActions.join("\n"), /缺温度/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FCU quality remediation reports zero temperature as quality guard instead of temperature_valid", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-quality-remediation-zero-temp-"));
  const outputJson = path.join(tempDir, "quality.json");
  const outputMd = path.join(tempDir, "quality.md");
  const outputCsv = path.join(tempDir, "quality.csv");
  const stub = await startStubBff({
    snapshot: {
      site: { siteId: "126lnoffice" },
      summary: {
        total: 1,
        communicationAlarmCount: 1,
        zeroTemperatureCount: 1,
        invalidTemperatureCount: 1,
        dataStatus: "ok"
      },
      items: [
        {
          deviceCode: "BGS03",
          deviceName: "办公室03",
          zoneTemperatureC: 0,
          setpointC: 24,
          communicationAlarm: true,
          quality: {
            status: "invalid",
            flags: ["zero_temperature", "invalid_temperature"],
            comfortEligible: false
          },
          points: {
            communicationAlarm: {
              tagName: "BGS03-502-40166",
              value: "1"
            },
            zoneTemperature: {
              tagName: "BGS03-506-40571",
              value: "0.0"
            }
          }
        }
      ]
    },
    commissioning: {
      summary: {
        total: 1,
        deviceReady: 0,
        deviceBlocked: 1
      },
      items: [
        {
          device: {
            deviceCode: "BGS03",
            deviceName: "办公室03"
          },
          status: "blocked",
          blockedReasons: ["communication_ok", "temperature_valid", "global_execution_gate"],
          controlBlockReasons: ["communication_alarm", "invalid_temperature"]
        }
      ]
    }
  });

  try {
    const result = await runNodeScript(qualityScriptPath, {
      BFF_BASE_URL: stub.baseUrl,
      FCU_QUALITY_REMEDIATION_JSON: outputJson,
      FCU_QUALITY_REMEDIATION_MD: outputMd,
      FCU_QUALITY_REMEDIATION_CSV: outputCsv
    });

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(outputJson);
    assert.equal(report.summary.p0Count, 1);
    assert.ok(report.devices[0].reasons.includes("temperature_quality_guard"));
    assert.ok(!report.devices[0].reasons.includes("temperature_valid"));
    assert.ok(report.reasonCounts.some((item) => item.reason === "temperature_quality_guard"));
    assert.ok(!report.reasonCounts.some((item) => item.reason === "temperature_valid"));
    assert.match(fs.readFileSync(outputMd, "utf8"), /temperature_quality_guard/);
    assert.doesNotMatch(fs.readFileSync(outputMd, "utf8"), /temperature_valid/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FCU quality remediation stages setpoint-only feedback issues as P1 onsite actions", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-quality-remediation-setpoint-feedback-"));
  const outputJson = path.join(tempDir, "quality.json");
  const outputMd = path.join(tempDir, "quality.md");
  const outputCsv = path.join(tempDir, "quality.csv");
  const stub = await startStubBff({
    snapshot: {
      site: { siteId: "126lnoffice" },
      summary: {
        total: 1,
        communicationAlarmCount: 0,
        zeroTemperatureCount: 0,
        invalidTemperatureCount: 0,
        dataStatus: "ok"
      },
      items: [
        {
          deviceCode: "ZZBGS",
          deviceName: "周总",
          zoneTemperatureC: 24,
          setpointC: 35,
          setpointFeedbackC: 35,
          communicationAlarm: false,
          quality: {
            status: "ok",
            flags: [],
            comfortEligible: true
          },
          points: {
            setpointFeedback: {
              tagName: "ZZBGS-506-40239",
              value: "35.0"
            }
          }
        }
      ]
    },
    commissioning: {
      summary: {
        total: 1,
        deviceReady: 0,
        deviceBlocked: 1
      },
      items: [
        {
          device: {
            deviceCode: "ZZBGS",
            deviceName: "周总"
          },
          status: "blocked",
          blockedReasons: ["setpoint_feedback_valid"],
          controlBlockReasons: ["setpoint_feedback_out_of_bounds"]
        }
      ]
    }
  });

  try {
    const result = await runNodeScript(qualityScriptPath, {
      BFF_BASE_URL: stub.baseUrl,
      FCU_QUALITY_REMEDIATION_JSON: outputJson,
      FCU_QUALITY_REMEDIATION_MD: outputMd,
      FCU_QUALITY_REMEDIATION_CSV: outputCsv
    });

    assert.equal(result.status, 0, result.stdout || result.stderr);
    const report = readJson(outputJson);
    assert.equal(report.summary.remediationCount, 1);
    assert.equal(report.summary.p0Count, 0);
    assert.equal(report.summary.canCompleteFinalControl, false);
    assert.equal(report.devices[0].severity, "P1");
    assert.deepEqual(report.devices[0].reasons, ["setpoint_feedback_out_of_bounds"]);
    assert.match(report.devices[0].fieldActions.join("\n"), /超出策略边界/);
    assert.match(report.devices[0].releaseCriteria.join("\n"), /setpointFeedbackC/);
    assert.match(fs.readFileSync(outputMd, "utf8"), /setpoint_feedback_out_of_bounds/);
    assert.match(fs.readFileSync(outputCsv, "utf8"), /ZZBGS/);
  } finally {
    await stub.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
