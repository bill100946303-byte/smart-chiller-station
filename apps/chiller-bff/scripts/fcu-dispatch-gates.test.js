import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const canaryScriptPath = path.join(__dirname, "execute-fcu-canary-dispatch.js");
const batchScriptPath = path.join(__dirname, "execute-fcu-small-batch-dispatch.js");
const allDeviceScriptPath = path.join(__dirname, "execute-fcu-all-device-dispatch.js");
const finalRolloutScriptPath = path.join(__dirname, "execute-fcu-final-control-rollout.js");
const finalCompletionScriptPath = path.join(__dirname, "check-fcu-final-control-completion.js");
const confirmPhrase = "I_UNDERSTAND_REAL_BA_WRITE";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createTempHarness() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-dispatch-gates-"));
  const files = {
    plan: path.join(tempDir, "plan.json"),
    preflight: path.join(tempDir, "preflight.json"),
    fieldArm: path.join(tempDir, "field-arm.json"),
    canary: path.join(tempDir, "canary.json"),
    canaryMd: path.join(tempDir, "canary.md"),
    batch: path.join(tempDir, "batch.json"),
    batchMd: path.join(tempDir, "batch.md"),
    allPolicy: path.join(tempDir, "all-policy.json"),
    matrix: path.join(tempDir, "matrix.json"),
    queue: path.join(tempDir, "queue.json"),
    runbook: path.join(tempDir, "runbook.json"),
    canaryReadiness: path.join(tempDir, "canary-readiness.json"),
    allPlan: path.join(tempDir, "all-plan.json"),
    allPlanMd: path.join(tempDir, "all-plan.md"),
    allExecution: path.join(tempDir, "all-execution.json"),
    allExecutionMd: path.join(tempDir, "all-execution.md"),
    goLivePreflight: path.join(tempDir, "go-live-preflight.json"),
    goLivePreflightMd: path.join(tempDir, "go-live-preflight.md"),
    finalCompletion: path.join(tempDir, "final-completion.json"),
    finalCompletionMd: path.join(tempDir, "final-completion.md"),
    finalRollout: path.join(tempDir, "final-rollout.json"),
    finalRolloutMd: path.join(tempDir, "final-rollout.md"),
    fieldSignoffInput: path.join(tempDir, "field-signoff-input.csv"),
    fieldSignoff: path.join(tempDir, "field-signoff.json"),
    fieldSignoffClean: path.join(tempDir, "field-signoff-clean.json"),
    fieldSignoffPromote: path.join(tempDir, "field-signoff-promote.json"),
    fieldHandoff: path.join(tempDir, "field-handoff.json"),
    fieldHandoffMd: path.join(tempDir, "field-handoff.md"),
    fieldHandoffCsv: path.join(tempDir, "field-handoff.csv"),
    fieldReturnTemplate: path.join(tempDir, "field-return-template.json"),
    fieldReturnTemplateMd: path.join(tempDir, "field-return-template.md"),
    fieldReturnTemplateCsv: path.join(tempDir, "field-return-template.csv")
  };
  return {
    tempDir,
    files,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function buildReadyPlan() {
  return {
    ok: true,
    siteId: "126lnoffice",
    build: "1",
    floor: "1",
    summary: {
      firstCanary: "BGS01",
      plannedDevices: 2,
      requiresFeedbackBeforeNext: true
    },
    devices: [
      {
        deviceCode: "BGS01",
        deviceName: "办公室01",
        zoneTemperatureC: 26,
        setpointC: 24,
        previews: {
          setpoint: {
            decisionStatus: "ready",
            commandCount: 1,
            commands: [{ value: 25.5 }]
          },
          fanSpeed: {
            decisionStatus: "ready",
            commandCount: 1,
            commands: [{ value: "auto" }]
          }
        }
      },
      {
        deviceCode: "LZBGS",
        deviceName: "刘总办公室",
        zoneTemperatureC: 26,
        setpointC: 24,
        previews: {
          setpoint: {
            decisionStatus: "ready",
            commandCount: 1,
            commands: [{ value: 25.5 }]
          },
          fanSpeed: {
            decisionStatus: "ready",
            commandCount: 1,
            commands: [{ value: "auto" }]
          }
        }
      }
    ]
  };
}

function buildReadyPreflight() {
  return {
    ok: true,
    verdict: "go_live_ready",
    blockingItems: []
  };
}

function buildReadyFieldArm() {
  return {
    ok: true,
    verdict: "field_arm_ready",
    firstCanary: "BGS01",
    blockingItems: []
  };
}

function buildReadyPolicy() {
  return {
    ok: true,
    after: {
      whitelistCount: 2,
      whitelist: ["BGS01", "LZBGS"]
    }
  };
}

function buildReadyAllDevicePlan() {
  return {
    ok: true,
    siteId: "126lnoffice",
    firstCanary: "BGS01",
    summary: {
      total: 3,
      deviceReady: 3,
      immediateReady: 2,
      stagedSetpoint: 1,
      blocked: 0
    },
    waves: [
      { key: "canary", label: "首台 Canary", devices: ["BGS01"] },
      { key: "immediate_wave_1", label: "立即执行批次", devices: ["LZBGS"] },
      { key: "staged_setpoint_wave_1", label: "设定分步批次", devices: ["BGS05"] }
    ],
    stagedSetpointDevices: [
      {
        deviceCode: "BGS05",
        deviceName: "办公室05",
        zoneTemperatureC: 28,
        setpointC: 24
      }
    ]
  };
}

function buildReadyMatrix() {
  return {
    ok: true,
    summary: {
      total: 2,
      rawDeviceRows: 2,
      duplicateCollapsedCount: 0,
      controlPageReady: 2,
      deviceReady: 2
    }
  };
}

function buildReadyQueue() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      firstCanary: "BGS01",
      plannedDevices: 2,
      requiresFeedbackBeforeNext: true
    }
  };
}

function buildReadyRunbook() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    scope: {
      canaryDevice: "BGS01"
    }
  };
}

function buildBlockedCanaryReadiness() {
  return {
    ok: false,
    verdict: "canary_blocked",
    controlMutation: false,
    summary: {
      canaryReady: false,
      gateCount: 1,
      blockedCount: 1,
      p0BlockedCount: 1
    },
    blockers: [
      {
        key: "field_arm_ready",
        severity: "P0",
        message: "field arm is not ready in the final-rollout dry-run fixture"
      }
    ]
  };
}

function buildReadyFieldSignoff(jsonPath) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: {
      signoffCsv: jsonPath.replace(/\.json$/, ".csv")
    },
    summary: {
      expectedWorkOrders: 0,
      csvRows: 0,
      completeRows: 0,
      openRows: 0,
      ignoredRows: 0,
      signoffComplete: true,
      stillRequiresRealtimeCloseout: true
    },
    records: [],
    releaseMatrix: [],
    outputs: {
      json: jsonPath,
      markdown: jsonPath.replace(/\.json$/, ".md"),
      csv: jsonPath.replace(/\.json$/, ".csv"),
      releaseMatrixCsv: jsonPath.replace(/\.json$/, "-release-matrix.csv")
    }
  };
}

function buildReadyFieldSignoffClean(jsonPath, inputCsv) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      inputRows: 0,
      currentRows: 0,
      staleRows: 0,
      status: "ready"
    },
    outputs: {
      json: jsonPath,
      markdown: jsonPath.replace(/\.json$/, ".md"),
      currentCsv: inputCsv,
      staleCsv: jsonPath.replace(/\.json$/, "-stale.csv")
    }
  };
}

function buildReadyFieldSignoffPromote(jsonPath, inputCsv) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      promoted: false,
      status: "ready_current_only"
    },
    target: {
      signoffInputCsv: inputCsv
    },
    outputs: {
      json: jsonPath,
      markdown: jsonPath.replace(/\.json$/, ".md")
    }
  };
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

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function withFakeBff(callback, options = {}) {
  const requests = [];
  let dispatchCounter = 0;
  const feedbackStatuses = Array.isArray(options.feedbackStatuses)
    ? [...options.feedbackStatuses]
    : [options.feedbackStatus || "feedback_confirmed"];
  let feedbackCounter = 0;
  const server = http.createServer((req, res) => {
    requests.push({
      method: req.method,
      url: req.url
    });
    if (req.url === "/healthz") {
      sendJson(res, 200, options.health || { ok: true, readOnlyMode: false });
      return;
    }
    if (req.url?.includes("/control-policy")) {
      sendJson(res, 200, {
        policy: {
          enabled: true,
          defaultMode: "enforced",
          dispatchAdapter: "scene-command",
          whitelist: ["BGS01", "LZBGS"]
        },
        executionGate: {
          dispatchAllowed: true,
          blockedReasons: []
        }
      });
      return;
    }
    if (req.url?.includes("/commissioning-status")) {
      sendJson(res, 200, {
        ok: true,
        summary: { total: 2, deviceReady: 2, canDispatch: 2 },
        executionGate: { dispatchAllowed: true, blockedReasons: [] },
        items: [
          {
            status: "ready",
            deviceReady: true,
            canDispatch: true,
            device: {
              deviceCode: "BGS01",
              deviceName: "办公室01",
              running: false,
              zoneTemperatureC: 26,
              setpointC: 24,
              communicationAlarm: false,
              qualityStatus: "ok"
            },
            conditions: []
          },
          {
            status: "ready",
            deviceReady: true,
            canDispatch: true,
            device: {
              deviceCode: "LZBGS",
              deviceName: "刘总办公室",
              running: true,
              zoneTemperatureC: 26,
              setpointC: 24,
              communicationAlarm: false,
              qualityStatus: "ok"
            },
            conditions: []
          }
        ],
        report: {
          verdict: "ready_for_control",
          summaryText: "2台 FCU 已具备真实下发条件。"
        }
      });
      return;
    }
    if (req.method === "POST" && req.url?.includes("/control-command")) {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const body = raw ? JSON.parse(raw) : {};
        requests[requests.length - 1].body = body;
        const target = new URL(req.url || "/", "http://127.0.0.1");
        const deviceCode = target.searchParams.get("deviceCode") || body.deviceCode || "UNKNOWN";
        dispatchCounter += 1;
        const command = body.command || {};
        const commandType =
          command.setpointC != null
            ? "setpoint"
            : command.fanSpeed != null
              ? "fan_speed"
              : command.start
                ? "start"
                : command.stop
                  ? "stop"
                  : "unknown";
        sendJson(res, 201, {
          dispatchRequested: true,
          dispatchAllowed: body.dispatch === true,
          controlMutation: body.dispatch === true,
          summary: {
            controlMutation: body.dispatch === true,
            dispatchedCount: body.dispatch === true ? 1 : 0,
            readyCount: body.dispatch === true ? 0 : 1
          },
          decisions: [
            {
              recordId: `rec-${dispatchCounter}`,
              deviceCode,
              status: body.dispatch === true ? "dispatched" : "ready",
              commands: [
                {
                  commandType,
                  value: command.setpointC ?? command.fanSpeed ?? true
                }
              ],
              dispatch: {
                ok: true
              }
            }
          ],
          executionGate: {
            dispatchAllowed: true,
            blockedReasons: []
          }
        });
      });
      return;
    }
    if (req.method === "POST" && req.url?.includes("/verify-feedback")) {
      const feedbackStatus = feedbackStatuses[Math.min(feedbackCounter, feedbackStatuses.length - 1)] || "feedback_confirmed";
      feedbackCounter += 1;
      sendJson(res, 200, {
        record: {
          status: feedbackStatus
        },
        feedback: {
          status: feedbackStatus === "feedback_confirmed" ? "confirmed" : "partial"
        }
      });
      return;
    }
    if (req.method === "POST" && req.url?.includes("/rollback")) {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const body = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, {
          ok: true,
          record: {
            status: "rolled_back",
            rolledBackAt: "2026-06-17T20:00:00.000Z",
            rollbackReason: body.reason || "test rollback"
          }
        });
      });
      return;
    }
    sendJson(res, 500, { ok: false, error: "unexpected request" });
  });
  return new Promise((resolve, reject) => {
    server.listen(0, async () => {
      try {
        const address = server.address();
        const result = await callback({
          baseUrl: `http://127.0.0.1:${address.port}`,
          requests
        });
        server.close((error) => (error ? reject(error) : resolve(result)));
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

test("execute-fcu-canary-dispatch blocks requests that skip the first canary", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.preflight, buildReadyPreflight());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(canaryScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.preflight,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_CANARY_DISPATCH_MD: harness.files.canaryMd,
        FCU_CANARY_DEVICE_CODE: "LZBGS",
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.canary);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, false);
      assert.equal(report.blockingItems.some((item) => item.key === "canary_order_violation"), true);
      assert.equal(requests.some((item) => item.method === "POST" && item.url?.includes("/control-command")), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("check-fcu-final-control-completion reports incomplete when write gate and canary feedback are missing", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.fieldArm, {
      ok: false,
      verdict: "field_arm_blocked",
      firstCanary: "BGS01",
      blockingItems: [{ key: "backend_write_gate" }]
    });
    writeJson(harness.files.canary, {
      ok: false,
      mode: "blocked_before_canary_dispatch",
      controlMutation: false,
      canary: { deviceCode: "BGS01" },
      verification: null
    });
    writeJson(harness.files.batch, {
      ok: false,
      mode: "blocked_before_dispatch",
      controlMutation: false
    });
    writeJson(harness.files.allPlan, {
      ok: true,
      summary: { total: 2, deviceReady: 2, immediateReady: 1, stagedSetpoint: 1, blocked: 0 },
      firstCanary: "BGS01",
      waves: []
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalCompletionScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.finalCompletion);
      assert.equal(report.ok, false);
      assert.equal(report.verdict, "final_control_incomplete");
      assert.equal(report.controlMutation, false);
      const blockerKeys = report.blockingItems.map((item) => item.key);
      assert.equal(blockerKeys.includes("backend_write_gate"), true);
      assert.equal(blockerKeys.includes("field_arm_ready"), true);
      assert.equal(blockerKeys.includes("canary_dispatch_confirmed"), true);
      assert.equal(blockerKeys.includes("canary_feedback_confirmed"), true);
      assert.equal(requests.some((item) => item.method === "POST"), false);
    }, { health: { ok: true, readOnlyMode: true } });
  } finally {
    harness.cleanup();
  }
});

test("check-fcu-final-control-completion keeps total goal incomplete after only first-canary feedback", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: {
        deviceCode: "BGS01",
        recordId: "rec-1"
      },
      verification: {
        recordId: "rec-1",
        recordStatus: "feedback_confirmed"
      }
    });
    writeJson(harness.files.batch, {
      ok: false,
      mode: "not_started",
      controlMutation: false
    });
    writeJson(harness.files.allPolicy, {
      ok: true,
      after: {
        whitelistCount: 2,
        whitelist: ["BGS01", "LZBGS"]
      }
    });
    writeJson(harness.files.allPlan, {
      ok: true,
      summary: { total: 2, deviceReady: 2, immediateReady: 1, stagedSetpoint: 1, blocked: 0 },
      firstCanary: "BGS01",
      waves: [{ key: "canary", devices: ["BGS01"] }]
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalCompletionScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_EXECUTION_JSON: harness.files.allExecution,
        FCU_ALL_DEVICE_EXECUTION_MD: harness.files.allExecutionMd,
        FCU_ALL_DEVICE_POLICY_JSON: harness.files.allPolicy,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.finalCompletion);
      assert.equal(report.ok, false);
      assert.equal(report.verdict, "final_control_incomplete");
      assert.equal(report.scope, "fcu_all_device_final_control");
      assert.equal(report.controlMutation, true);
      assert.equal(report.firstCanary, "BGS01");
      assert.equal(report.canaryVerificationStatus, "feedback_confirmed");
      assert.equal(report.milestones.canary.ok, true);
      assert.equal(report.milestones.smallBatch.ok, false);
      assert.equal(report.milestones.allDevice.ok, false);
      assert.equal(requests.some((item) => item.method === "POST"), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("check-fcu-final-control-completion passes only after all whitelisted FCUs have confirmed feedback", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: {
        deviceCode: "BGS01",
        recordId: "rec-1"
      },
      verification: {
        recordId: "rec-1",
        recordStatus: "feedback_confirmed"
      }
    });
    writeJson(harness.files.batch, {
      ok: true,
      mode: "confirmed_dispatch",
      controlMutation: true,
      devices: [
        {
          deviceCode: "BGS01",
          results: [
            { kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } },
            { kind: "fan_speed", verification: { recordStatus: "feedback_confirmed" } }
          ]
        },
        {
          deviceCode: "LZBGS",
          results: [
            { kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } },
            { kind: "fan_speed", verification: { recordStatus: "feedback_confirmed" } }
          ]
        }
      ]
    });
    writeJson(harness.files.allPolicy, {
      ok: true,
      after: {
        whitelistCount: 2,
        whitelist: ["BGS01", "LZBGS"]
      }
    });
    writeJson(harness.files.allPlan, {
      ok: true,
      summary: { total: 2, deviceReady: 2, immediateReady: 2, stagedSetpoint: 0, blocked: 0 },
      firstCanary: "BGS01",
      waves: [{ key: "canary", devices: ["BGS01"] }, { key: "immediate_wave_1", devices: ["LZBGS"] }]
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalCompletionScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_POLICY_JSON: harness.files.allPolicy,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.finalCompletion);
      assert.equal(report.ok, true);
      assert.equal(report.verdict, "fcu_all_device_control_complete");
      assert.equal(report.scope, "fcu_all_device_final_control");
      assert.equal(report.milestones.canary.ok, true);
      assert.equal(report.milestones.smallBatch.ok, true);
      assert.equal(report.milestones.allDevice.ok, true);
      assert.equal(report.milestones.allDevice.confirmedDevices, 2);
      assert.equal(report.milestones.allDevice.targetDevices, 2);
      assert.equal(requests.some((item) => item.method === "POST"), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("check-fcu-final-control-completion combines canary, small-batch, and all-device feedback", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: {
        deviceCode: "BGS01",
        recordId: "rec-1"
      },
      verification: {
        recordId: "rec-1",
        recordStatus: "feedback_confirmed"
      }
    });
    writeJson(harness.files.batch, {
      ok: true,
      mode: "confirmed_dispatch",
      controlMutation: true,
      devices: [
        {
          deviceCode: "BGS01",
          results: [{ kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } }]
        }
      ]
    });
    writeJson(harness.files.allExecution, {
      ok: true,
      mode: "confirmed_all_device_dispatch",
      controlMutation: true,
      waves: [
        {
          key: "remaining_wave_1",
          devices: [
            {
              deviceCode: "LZBGS",
              results: [
                { kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } },
                { kind: "fan_speed", verification: { recordStatus: "feedback_confirmed" } }
              ]
            }
          ]
        }
      ]
    });
    writeJson(harness.files.allPolicy, {
      ok: true,
      after: {
        whitelistCount: 2,
        whitelist: ["BGS01", "LZBGS"]
      }
    });
    writeJson(harness.files.allPlan, {
      ok: true,
      summary: { total: 2, deviceReady: 2, immediateReady: 2, stagedSetpoint: 0, blocked: 0 },
      firstCanary: "BGS01",
      waves: [{ key: "canary", devices: ["BGS01"] }, { key: "immediate_wave_1", devices: ["LZBGS"] }]
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalCompletionScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_EXECUTION_JSON: harness.files.allExecution,
        FCU_ALL_DEVICE_POLICY_JSON: harness.files.allPolicy,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.finalCompletion);
      assert.equal(report.ok, true);
      assert.equal(report.milestones.allDevice.confirmedDevices, 2);
      assert.deepEqual(report.milestones.allDevice.confirmedDeviceCodes, ["BGS01", "LZBGS"]);
      assert.equal(requests.some((item) => item.method === "POST"), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-all-device-dispatch blocks without final rollout confirmation", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.allPlan, buildReadyAllDevicePlan());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: { deviceCode: "BGS01" },
      verification: { recordStatus: "feedback_confirmed" }
    });
    writeJson(harness.files.batch, {
      ok: true,
      mode: "confirmed_dispatch",
      controlMutation: true,
      devices: [
        {
          deviceCode: "LZBGS",
          results: [{ kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } }]
        }
      ]
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(allDeviceScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_EXECUTION_JSON: harness.files.allExecution,
        FCU_ALL_DEVICE_EXECUTION_MD: harness.files.allExecutionMd
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.allExecution);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, false);
      assert.equal(report.blockingItems.some((item) => item.key === "final_rollout_confirm_missing"), true);
      assert.equal(requests.some((item) => item.method === "POST" && item.url?.includes("/control-command")), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-all-device-dispatch executes only remaining wave devices after canary and small batch", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.allPlan, buildReadyAllDevicePlan());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: { deviceCode: "BGS01" },
      verification: { recordStatus: "feedback_confirmed" }
    });
    writeJson(harness.files.batch, {
      ok: true,
      mode: "confirmed_dispatch",
      controlMutation: true,
      devices: [
        {
          deviceCode: "LZBGS",
          results: [
            { kind: "setpoint", verification: { recordStatus: "feedback_confirmed" } },
            { kind: "fan_speed", verification: { recordStatus: "feedback_confirmed" } }
          ]
        }
      ]
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(allDeviceScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_EXECUTION_JSON: harness.files.allExecution,
        FCU_ALL_DEVICE_EXECUTION_MD: harness.files.allExecutionMd,
        FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.allExecution);
      assert.equal(report.ok, true);
      assert.equal(report.mode, "confirmed_all_device_dispatch");
      assert.equal(report.controlMutation, true);
      assert.deepEqual(report.confirmedBefore.sort(), ["BGS01", "LZBGS"]);
      const executedDevices = report.waves.flatMap((wave) => wave.devices.map((device) => device.deviceCode));
      assert.deepEqual(executedDevices, ["BGS05"]);
      const commandRequests = requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command"));
      assert.equal(commandRequests.length, 2);
      assert.equal(commandRequests.every((item) => item.body?.dispatch === true), true);
      assert.equal(commandRequests.every((item) => item.url.includes("deviceCode=BGS05")), true);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-canary-dispatch completes only first-canary dispatch after confirmed feedback", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.preflight, buildReadyPreflight());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(canaryScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.preflight,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_CANARY_DISPATCH_MD: harness.files.canaryMd,
        FCU_CANARY_FEEDBACK_TIMEOUT_MS: "1000",
        FCU_CANARY_FEEDBACK_POLL_MS: "1",
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.canary);
      assert.equal(report.ok, true);
      assert.equal(report.mode, "confirmed_canary_dispatch");
      assert.equal(report.controlMutation, true);
      assert.equal(report.canary.deviceCode, "BGS01");
      assert.equal(report.verification.recordStatus, "feedback_confirmed");
      assert.equal(report.verification.attempts.length, 1);
      const commandRequests = requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command"));
      assert.equal(commandRequests.length, 1);
      assert.equal(commandRequests[0].url.includes("deviceCode=BGS01"), true);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-canary-dispatch polls pending feedback until it is confirmed", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.preflight, buildReadyPreflight());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(canaryScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.preflight,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_CANARY_DISPATCH_MD: harness.files.canaryMd,
        FCU_CANARY_FEEDBACK_TIMEOUT_MS: "1000",
        FCU_CANARY_FEEDBACK_POLL_MS: "1",
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.canary);
      assert.equal(report.ok, true);
      assert.equal(report.verification.recordStatus, "feedback_confirmed");
      assert.deepEqual(report.verification.attempts.map((item) => item.recordStatus), [
        "feedback_pending",
        "feedback_confirmed"
      ]);
      assert.equal(requests.filter((item) => item.method === "POST" && item.url?.includes("/verify-feedback")).length, 2);
    }, { feedbackStatuses: ["feedback_pending", "feedback_confirmed"] });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-canary-dispatch rolls back the canary record when feedback is abnormal", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.preflight, buildReadyPreflight());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(canaryScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.preflight,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_CANARY_DISPATCH_MD: harness.files.canaryMd,
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.canary);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, true);
      assert.equal(report.canary.deviceCode, "BGS01");
      assert.equal(report.verification.recordStatus, "feedback_partial");
      assert.equal(report.rollback.recordStatus, "rolled_back");
      assert.equal(requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command")).length, 1);
      assert.equal(requests.filter((item) => item.method === "POST" && item.url?.includes("/rollback")).length, 1);
    }, { feedbackStatus: "feedback_partial" });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-small-batch-dispatch requires confirmed first-canary feedback before expanding", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: false,
      mode: "blocked_before_canary_dispatch",
      controlMutation: false,
      canary: {
        deviceCode: "BGS01"
      },
      verification: null
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(batchScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_SMALL_BATCH_EXECUTION_MD: harness.files.batchMd,
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.batch);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, false);
      assert.equal(report.blockingItems.some((item) => item.key === "canary_feedback_not_confirmed"), true);
      assert.equal(requests.some((item) => item.method === "POST" && item.url?.includes("/control-command")), false);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-small-batch-dispatch expands only after first-canary feedback is confirmed", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.plan, buildReadyPlan());
    writeJson(harness.files.fieldArm, buildReadyFieldArm());
    writeJson(harness.files.canary, {
      ok: true,
      mode: "confirmed_canary_dispatch",
      controlMutation: true,
      canary: {
        deviceCode: "BGS01"
      },
      verification: {
        recordStatus: "feedback_confirmed"
      }
    });
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(batchScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_SMALL_BATCH_EXECUTION_MD: harness.files.batchMd,
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 0);
      const report = readJson(harness.files.batch);
      assert.equal(report.ok, true);
      assert.equal(report.mode, "confirmed_dispatch");
      assert.equal(report.controlMutation, true);
      assert.equal(report.devices.length, 2);
      assert.equal(report.devices.every((device) => device.results.every((item) => item.verification.recordStatus === "feedback_confirmed")), true);
      const commandRequests = requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command"));
      assert.equal(commandRequests.length, 4);
      assert.equal(commandRequests.some((item) => item.url.includes("deviceCode=BGS01")), true);
      assert.equal(commandRequests.some((item) => item.url.includes("deviceCode=LZBGS")), true);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-final-control-rollout skips real dispatch without final rollout confirmation", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.allPolicy, buildReadyPolicy());
    writeJson(harness.files.matrix, buildReadyMatrix());
    writeJson(harness.files.queue, buildReadyQueue());
    writeJson(harness.files.runbook, buildReadyRunbook());
    writeJson(harness.files.canaryReadiness, buildBlockedCanaryReadiness());
    fs.writeFileSync(harness.files.fieldSignoffInput, "workOrderId,deviceCode,status\n");
    writeJson(harness.files.fieldSignoff, buildReadyFieldSignoff(harness.files.fieldSignoff));
    writeJson(
      harness.files.fieldSignoffClean,
      buildReadyFieldSignoffClean(harness.files.fieldSignoffClean, harness.files.fieldSignoffInput)
    );
    writeJson(
      harness.files.fieldSignoffPromote,
      buildReadyFieldSignoffPromote(harness.files.fieldSignoffPromote, harness.files.fieldSignoffInput)
    );
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalRolloutScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_SMALL_BATCH_PLAN_MD: harness.files.canaryMd,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_ALL_DEVICE_DISPATCH_PLAN_MD: harness.files.allPlanMd,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.goLivePreflight,
        FCU_GO_LIVE_PREFLIGHT_MD: harness.files.goLivePreflightMd,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_FIELD_ARM_CHECK_MD: harness.files.batchMd,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_POLICY_JSON: harness.files.allPolicy,
        FCU_POLICY_JSON: harness.files.allPolicy,
        FCU_DEVICE_CONTROL_MATRIX_JSON: harness.files.matrix,
        FCU_CANARY_QUEUE_JSON: harness.files.queue,
        FCU_CANARY_READINESS_JSON: harness.files.canaryReadiness,
        FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
        FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
        FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
        FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK: "false",
        FCU_FINAL_CONTROL_RUNBOOK_JSON: harness.files.runbook,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd,
        FCU_FINAL_CONTROL_ROLLOUT_JSON: harness.files.finalRollout,
        FCU_FINAL_CONTROL_ROLLOUT_MD: harness.files.finalRolloutMd,
        FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: harness.files.fieldSignoffInput,
        FCU_FIELD_REMEDIATION_SIGNOFF_JSON: harness.files.fieldSignoff,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: harness.files.fieldSignoffClean,
        FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: harness.files.fieldSignoffPromote,
        FCU_FIELD_HANDOFF_PACK_JSON: harness.files.fieldHandoff,
        FCU_FIELD_HANDOFF_PACK_MD: harness.files.fieldHandoffMd,
        FCU_FIELD_HANDOFF_PACK_CSV: harness.files.fieldHandoffCsv,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: harness.files.fieldReturnTemplate,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: harness.files.fieldReturnTemplateMd,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: harness.files.fieldReturnTemplateCsv,
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.finalRollout);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, false);
      const finalWorklistPath = path.join(harness.tempDir, "fcu-final-control-worklist-latest.json");
      assert.equal(fs.existsSync(finalWorklistPath), true);
      assert.equal(report.phases.find((item) => item.key === "finalWorklist")?.outputPath, finalWorklistPath);
      assert.equal(report.confirm.smallBatchConfirmPresent, true);
      assert.equal(report.confirm.finalRolloutConfirmPresent, false);
      assert.equal(report.skipped.some((item) => item.key === "canaryDispatch"), true);
      assert.equal(report.skipped.some((item) => item.key === "smallBatchDispatch"), true);
      assert.equal(report.skipped.some((item) => item.key === "allDeviceDispatch"), true);
      assert.equal(report.blockers.some((item) => item.key === "final_rollout_confirm_missing"), true);
      const commandRequests = requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command"));
      assert.equal(commandRequests.length > 0, true);
      assert.equal(commandRequests.every((item) => item.body?.dispatch !== true), true);
    });
  } finally {
    harness.cleanup();
  }
});

test("execute-fcu-final-control-rollout skips real dispatch when final gates are blocked even with confirmation", async () => {
  const harness = createTempHarness();
  try {
    writeJson(harness.files.allPolicy, buildReadyPolicy());
    writeJson(harness.files.matrix, buildReadyMatrix());
    writeJson(harness.files.queue, buildReadyQueue());
    writeJson(harness.files.runbook, buildReadyRunbook());
    writeJson(harness.files.canaryReadiness, buildBlockedCanaryReadiness());
    fs.writeFileSync(harness.files.fieldSignoffInput, "workOrderId,deviceCode,status\n");
    writeJson(harness.files.fieldSignoff, {
      ok: false,
      summary: {
        signoffComplete: false,
        completeRows: 0,
        expectedWorkOrders: 1
      }
    });
    writeJson(
      harness.files.fieldSignoffClean,
      buildReadyFieldSignoffClean(harness.files.fieldSignoffClean, harness.files.fieldSignoffInput)
    );
    writeJson(
      harness.files.fieldSignoffPromote,
      buildReadyFieldSignoffPromote(harness.files.fieldSignoffPromote, harness.files.fieldSignoffInput)
    );
    await withFakeBff(async ({ baseUrl, requests }) => {
      const result = await runNodeScript(finalRolloutScriptPath, {
        BFF_BASE_URL: baseUrl,
        FCU_SMALL_BATCH_PLAN_JSON: harness.files.plan,
        FCU_SMALL_BATCH_PLAN_MD: harness.files.canaryMd,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: harness.files.allPlan,
        FCU_ALL_DEVICE_DISPATCH_PLAN_MD: harness.files.allPlanMd,
        FCU_GO_LIVE_PREFLIGHT_JSON: harness.files.goLivePreflight,
        FCU_GO_LIVE_PREFLIGHT_MD: harness.files.goLivePreflightMd,
        FCU_FIELD_ARM_CHECK_JSON: harness.files.fieldArm,
        FCU_FIELD_ARM_CHECK_MD: harness.files.batchMd,
        FCU_CANARY_DISPATCH_JSON: harness.files.canary,
        FCU_SMALL_BATCH_EXECUTION_JSON: harness.files.batch,
        FCU_ALL_DEVICE_POLICY_JSON: harness.files.allPolicy,
        FCU_POLICY_JSON: harness.files.allPolicy,
        FCU_DEVICE_CONTROL_MATRIX_JSON: harness.files.matrix,
        FCU_CANARY_QUEUE_JSON: harness.files.queue,
        FCU_CANARY_READINESS_JSON: harness.files.canaryReadiness,
        FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
        FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
        FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
        FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK: "false",
        FCU_FINAL_CONTROL_RUNBOOK_JSON: harness.files.runbook,
        FCU_FINAL_CONTROL_COMPLETION_JSON: harness.files.finalCompletion,
        FCU_FINAL_CONTROL_COMPLETION_MD: harness.files.finalCompletionMd,
        FCU_FINAL_CONTROL_ROLLOUT_JSON: harness.files.finalRollout,
        FCU_FINAL_CONTROL_ROLLOUT_MD: harness.files.finalRolloutMd,
        FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: harness.files.fieldSignoffInput,
        FCU_FIELD_REMEDIATION_SIGNOFF_JSON: harness.files.fieldSignoff,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: harness.files.fieldSignoffClean,
        FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: harness.files.fieldSignoffPromote,
        FCU_FIELD_HANDOFF_PACK_JSON: harness.files.fieldHandoff,
        FCU_FIELD_HANDOFF_PACK_MD: harness.files.fieldHandoffMd,
        FCU_FIELD_HANDOFF_PACK_CSV: harness.files.fieldHandoffCsv,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: harness.files.fieldReturnTemplate,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: harness.files.fieldReturnTemplateMd,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: harness.files.fieldReturnTemplateCsv,
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
        FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
        FCU_SMALL_BATCH_CONFIRM: confirmPhrase,
        FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: confirmPhrase
      });
      assert.equal(result.status, 2);
      const report = readJson(harness.files.finalRollout);
      assert.equal(report.ok, false);
      assert.equal(report.controlMutation, false);
      assert.equal(report.confirm.smallBatchConfirmPresent, true);
      assert.equal(report.confirm.finalRolloutConfirmPresent, true);
      assert.equal(report.skipped.every((item) => item.reason === "final gates not ready"), true);
      assert.equal(report.blockers.some((item) => item.key === "finalGates_failed"), true);
      const commandRequests = requests.filter((item) => item.method === "POST" && item.url?.includes("/control-command"));
      assert.equal(commandRequests.length > 0, true);
      assert.equal(commandRequests.every((item) => item.body?.dispatch !== true), true);
    });
  } finally {
    harness.cleanup();
  }
});
