import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BUILD = normalizeText(process.env.FCU_BUILD) || "1";
const FLOOR = normalizeText(process.env.FCU_FLOOR) || "1";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const CONFIRM = normalizeText(process.env.FCU_FINAL_CONTROL_ROLLOUT_CONFIRM);
const TARGET_SETPOINT_C = normalizeNumber(process.env.FCU_ALL_DEVICE_TARGET_SETPOINT_C, 25.5);
const MAX_SETPOINT_STEP_C = normalizeNumber(process.env.FCU_ALL_DEVICE_MAX_SETPOINT_SHIFT_C, 2);
const FAN_SPEED = normalizeFanSpeed(process.env.FCU_ALL_DEVICE_FAN_SPEED || "auto");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_ALL_DEVICE_EXECUTION_TIMEOUT_MS, 20000);
const STOP_ON_ABNORMAL = normalizeBoolean(process.env.FCU_ALL_DEVICE_STOP_ON_ABNORMAL, true);
const PLAN_JSON =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json");
const CANARY_DISPATCH_JSON =
  process.env.FCU_CANARY_DISPATCH_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.json");
const SMALL_BATCH_EXECUTION_JSON =
  process.env.FCU_SMALL_BATCH_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-execution-latest.json");
const OUTPUT_JSON =
  process.env.FCU_ALL_DEVICE_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-all-device-dispatch-execution-latest.json");
const OUTPUT_MD =
  process.env.FCU_ALL_DEVICE_EXECUTION_MD ||
  path.resolve(DOCS_DIR, "fcu-all-device-dispatch-execution-latest.md");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNumber(value, fallback) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(normalized);
}

function normalizeFanSpeed(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["auto", "low", "medium", "high"].includes(normalized) ? normalized : "auto";
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      parseError: true,
      raw: text.slice(0, 500)
    };
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "read json failed",
      path: filePath
    };
  }
}

function requestJson(method, routePath, payload = null) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = body
    ? {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    : {};
  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            url: target.toString(),
            payload: parseJsonSafely(raw)
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        url: target.toString(),
        error: error instanceof Error ? error.message : "request failed"
      });
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
}

function readDeviceRows(plan) {
  const rows = [
    ...(Array.isArray(plan?.stagedSetpointDevices) ? plan.stagedSetpointDevices : []),
    ...(Array.isArray(plan?.blockedDevices) ? plan.blockedDevices : [])
  ];
  const map = new Map();
  for (const row of rows) {
    const code = normalizeText(row?.deviceCode);
    if (code && !map.has(code)) {
      map.set(code, row);
    }
  }
  return map;
}

function collectConfirmedDeviceCodes(canary, smallBatch) {
  const confirmed = new Set();
  if (canary?.ok === true && canary?.verification?.recordStatus === "feedback_confirmed") {
    const code = normalizeText(canary?.canary?.deviceCode);
    if (code) {
      confirmed.add(code);
    }
  }
  for (const device of Array.isArray(smallBatch?.devices) ? smallBatch.devices : []) {
    const code = normalizeText(device?.deviceCode);
    const allConfirmed = Array.isArray(device?.results) &&
      device.results.length > 0 &&
      device.results.every((result) => result?.verification?.recordStatus === "feedback_confirmed");
    if (code && allConfirmed) {
      confirmed.add(code);
    }
  }
  return confirmed;
}

function smallBatchFeedbackConfirmed(smallBatch) {
  const devices = Array.isArray(smallBatch?.devices) ? smallBatch.devices : [];
  if (devices.length === 0) {
    return false;
  }
  return devices.every((device) => {
    const results = Array.isArray(device?.results) ? device.results : [];
    return results.length > 0 && results.every((result) => result?.verification?.recordStatus === "feedback_confirmed");
  });
}

function smallBatchConfirmed(plan, canary, smallBatch) {
  const firstCanary = normalizeText(plan?.firstCanary);
  const canaryCode = normalizeText(canary?.canary?.deviceCode);
  return (
    canary?.ok === true &&
    canary?.mode === "confirmed_canary_dispatch" &&
    canary?.controlMutation === true &&
    canary?.verification?.recordStatus === "feedback_confirmed" &&
    (!firstCanary || canaryCode === firstCanary) &&
    smallBatch?.ok === true &&
    smallBatch?.mode === "confirmed_dispatch" &&
    smallBatch?.controlMutation === true &&
    smallBatchFeedbackConfirmed(smallBatch)
  );
}

function nextSetpointForDevice(row) {
  const current = Number(row?.setpointC);
  if (!Number.isFinite(current)) {
    return TARGET_SETPOINT_C;
  }
  const delta = TARGET_SETPOINT_C - current;
  if (Math.abs(delta) <= MAX_SETPOINT_STEP_C) {
    return TARGET_SETPOINT_C;
  }
  return Number((current + Math.sign(delta) * MAX_SETPOINT_STEP_C).toFixed(1));
}

function commandForDevice(deviceCode, row) {
  const commands = [];
  commands.push({
    kind: "setpoint",
    command: {
      setpointC: nextSetpointForDevice(row)
    }
  });
  commands.push({
    kind: "fan_speed",
    command: {
      fanSpeed: FAN_SPEED
    }
  });
  return commands.filter((item) => item.command.setpointC != null || item.command.fanSpeed);
}

function summarizeDispatch(response) {
  const payload = response.payload || {};
  const decision = Array.isArray(payload.decisions) ? payload.decisions[0] || null : null;
  return {
    ok: response.ok,
    status: response.status,
    dispatchRequested: payload.dispatchRequested === true,
    dispatchAllowed: payload.dispatchAllowed === true,
    controlMutation: payload.controlMutation === true || payload.summary?.controlMutation === true,
    recordId: decision?.recordId || null,
    decisionStatus: decision?.status || null,
    reason: decision?.reason || null,
    blockReasons: decision?.blockReasons || [],
    commandCount: Array.isArray(decision?.commands) ? decision.commands.length : 0,
    commands: Array.isArray(decision?.commands) ? decision.commands : [],
    dispatch: decision?.dispatch || null,
    executionGate: payload.executionGate || null
  };
}

async function verifyRecord(recordId) {
  if (!recordId) {
    return null;
  }
  return requestJson(
    "POST",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-records/${encodeURIComponent(recordId)}/verify-feedback?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`,
    {}
  );
}

async function executeDevice(deviceCode, row) {
  const route = `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-command?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}&deviceCode=${encodeURIComponent(deviceCode)}`;
  const results = [];
  for (const item of commandForDevice(deviceCode, row)) {
    const response = await requestJson("POST", route, {
      dispatch: true,
      deviceCode,
      command: item.command
    });
    const dispatch = summarizeDispatch(response);
    const verification = await verifyRecord(dispatch.recordId);
    results.push({
      kind: item.kind,
      requestedCommand: item.command,
      dispatch,
      verification: verification
        ? {
            ok: verification.ok,
            status: verification.status,
            recordStatus: verification.payload?.record?.status || null,
            feedback: verification.payload?.feedback || null
          }
        : null
    });
    if (STOP_ON_ABNORMAL && verification?.payload?.record?.status !== "feedback_confirmed") {
      break;
    }
  }
  return {
    deviceCode,
    deviceName: row?.deviceName || deviceCode,
    results
  };
}

function buildBlockedReport({ plan, health, fieldArm, canary, smallBatch, blockingItems }) {
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "blocked_before_all_device_dispatch",
    controlMutation: false,
    planFile: PLAN_JSON,
    fieldArmFile: FIELD_ARM_JSON,
    canaryDispatchFile: CANARY_DISPATCH_JSON,
    smallBatchExecutionFile: SMALL_BATCH_EXECUTION_JSON,
    blockingItems,
    planSummary: plan?.summary || null,
    evidence: {
      health: {
        ok: health?.ok === true,
        status: health?.status ?? null,
        url: health?.url || null,
        readOnlyMode: health?.payload?.readOnlyMode ?? null
      },
      fieldArm: {
        ok: fieldArm?.ok === true,
        verdict: fieldArm?.verdict || null,
        blockingItems: fieldArm?.blockingItems || []
      },
      canaryDispatch: {
        ok: canary?.ok === true,
        mode: canary?.mode || null,
        verification: canary?.verification || null
      },
      smallBatchExecution: {
        ok: smallBatch?.ok === true,
        mode: smallBatch?.mode || null,
        devices: Array.isArray(smallBatch?.devices) ? smallBatch.devices.length : 0
      }
    },
    waves: []
  };
}

function buildExecutionReport({ plan, health, waves, confirmedBefore }) {
  const dispatchedDevices = waves.flatMap((wave) => wave.devices || []);
  const mutation = dispatchedDevices.some((device) =>
    device.results.some((result) => result.dispatch.controlMutation === true)
  );
  const abnormal = dispatchedDevices.flatMap((device) =>
    device.results.filter((result) => result.verification?.recordStatus !== "feedback_confirmed")
  );
  return {
    ok: dispatchedDevices.length > 0 && mutation && abnormal.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "confirmed_all_device_dispatch",
    controlMutation: mutation,
    planFile: PLAN_JSON,
    confirmedBefore: Array.from(confirmedBefore),
    planSummary: plan.summary || null,
    waves,
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 全量波次确认执行结果");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 结论: ${report.ok ? "全量波次执行成功" : "未执行或未成功"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  if (report.blockingItems?.length) {
    lines.push("## 阻断项");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  if (report.waves?.length) {
    lines.push("## 波次结果");
    lines.push("");
    for (const wave of report.waves) {
      lines.push(`### ${wave.label || wave.key}`);
      for (const device of wave.devices) {
        const statusText = device.results.map((item) => `${item.kind}/${item.verification?.recordStatus || "未校验"}`).join(", ");
        lines.push(`- ${device.deviceCode}: ${statusText}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

async function main() {
  const plan = readJsonFile(PLAN_JSON);
  const fieldArm = readJsonFile(FIELD_ARM_JSON);
  const canary = readJsonFile(CANARY_DISPATCH_JSON);
  const smallBatch = readJsonFile(SMALL_BATCH_EXECUTION_JSON);
  const health = await requestJson("GET", "/healthz");
  const blockingItems = [];
  if (plan?.error) {
    blockingItems.push({ key: "plan_unavailable", message: plan.error });
  }
  if (CONFIRM !== CONFIRM_PHRASE) {
    blockingItems.push({
      key: "final_rollout_confirm_missing",
      message: `必须设置 FCU_FINAL_CONTROL_ROLLOUT_CONFIRM=${CONFIRM_PHRASE} 才允许全量真实下发。`
    });
  }
  if (health.ok !== true) {
    blockingItems.push({ key: "bff_unavailable", message: health.error || `BFF health failed: ${health.status}` });
  }
  if (health.payload?.readOnlyMode !== false) {
    blockingItems.push({ key: "backend_write_gate", message: "当前 BFF readOnlyMode 不是 false。" });
  }
  if (fieldArm?.ok !== true || fieldArm?.verdict !== "field_arm_ready") {
    blockingItems.push({ key: "field_arm_not_ready", message: `现场 arm-check 未通过：${fieldArm?.verdict || "unknown"}` });
  }
  if (!smallBatchConfirmed(plan, canary, smallBatch)) {
    blockingItems.push({ key: "small_batch_feedback_not_confirmed", message: "全量执行前必须先完成 Canary 与小批量真实下发并反馈确认。" });
  }
  const waves = Array.isArray(plan?.waves) ? plan.waves : [];
  if (waves.length === 0) {
    blockingItems.push({ key: "empty_waves", message: "全量计划没有波次。" });
  }
  if (blockingItems.length > 0) {
    const report = buildBlockedReport({ plan, health, fieldArm, canary, smallBatch, blockingItems });
    writeReport(report);
    console.log(`FCU_ALL_DEVICE_EXECUTION ok=false mode=blocked_before_all_device_dispatch blocking=${blockingItems.length} mutation=false`);
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    process.exitCode = 2;
    return;
  }
  const deviceRows = readDeviceRows(plan);
  const confirmedBefore = collectConfirmedDeviceCodes(canary, smallBatch);
  const executedWaves = [];
  for (const wave of waves.filter((item) => item.key !== "canary")) {
    const devices = [];
    for (const deviceCode of wave.devices || []) {
      if (confirmedBefore.has(deviceCode)) {
        continue;
      }
      const result = await executeDevice(deviceCode, deviceRows.get(deviceCode) || { deviceCode });
      devices.push(result);
      const abnormal = result.results.some((item) => item.verification?.recordStatus !== "feedback_confirmed");
      if (STOP_ON_ABNORMAL && abnormal) {
        executedWaves.push({ ...wave, devices });
        const report = buildExecutionReport({ plan, health, waves: executedWaves, confirmedBefore });
        report.ok = false;
        report.mode = "stopped_on_abnormal_feedback";
        writeReport(report);
        console.log(`FCU_ALL_DEVICE_EXECUTION ok=false mode=stopped_on_abnormal_feedback devices=${devices.length} mutation=${report.controlMutation}`);
        console.log(`json=${OUTPUT_JSON}`);
        console.log(`md=${OUTPUT_MD}`);
        process.exitCode = 2;
        return;
      }
    }
    if (devices.length > 0) {
      executedWaves.push({ ...wave, devices });
    }
  }
  const report = buildExecutionReport({ plan, health, waves: executedWaves, confirmedBefore });
  writeReport(report);
  console.log(`FCU_ALL_DEVICE_EXECUTION ok=${report.ok} mode=${report.mode} waves=${executedWaves.length} mutation=${report.controlMutation}`);
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
