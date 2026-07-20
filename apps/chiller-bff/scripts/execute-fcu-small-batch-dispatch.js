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
const PLAN_JSON =
  process.env.FCU_SMALL_BATCH_PLAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json");
const CANARY_DISPATCH_JSON =
  process.env.FCU_CANARY_DISPATCH_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.json");
const OUTPUT_JSON =
  process.env.FCU_SMALL_BATCH_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-execution-latest.json");
const OUTPUT_MD =
  process.env.FCU_SMALL_BATCH_EXECUTION_MD ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-execution-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_SMALL_BATCH_EXECUTION_TIMEOUT_MS, 20000);
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM);

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
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

function readFieldArmCheck() {
  return readJsonFile(FIELD_ARM_JSON);
}

function readCanaryDispatchReport() {
  return readJsonFile(CANARY_DISPATCH_JSON);
}

function evaluateCanaryDispatchPrerequisite(plan, canaryDispatch) {
  const expectedCanary = normalizeText(plan?.summary?.firstCanary) ||
    normalizeText(Array.isArray(plan?.devices) ? plan.devices[0]?.deviceCode : "");
  const actualCanary = normalizeText(canaryDispatch?.canary?.deviceCode);
  const recordStatus = normalizeText(canaryDispatch?.verification?.recordStatus);
  const ok =
    canaryDispatch?.ok === true &&
    canaryDispatch?.mode === "confirmed_canary_dispatch" &&
    canaryDispatch?.controlMutation === true &&
    recordStatus === "feedback_confirmed" &&
    (!expectedCanary || actualCanary === expectedCanary);
  return {
    ok,
    expectedCanary,
    actualCanary,
    recordStatus,
    mode: canaryDispatch?.mode || null,
    controlMutation: canaryDispatch?.controlMutation ?? null,
    reportOk: canaryDispatch?.ok ?? null
  };
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

function extractReadyCommands(device) {
  const commands = [];
  const setpoint = device?.previews?.setpoint;
  const fanSpeed = device?.previews?.fanSpeed;
  if (setpoint?.decisionStatus === "ready" && setpoint.commandCount > 0) {
    commands.push({
      kind: "setpoint",
      command: {
        setpointC: device.previews.setpoint.commands?.[0]?.value
      }
    });
  }
  if (fanSpeed?.decisionStatus === "ready" && fanSpeed.commandCount > 0) {
    commands.push({
      kind: "fan_speed",
      command: {
        fanSpeed: device.previews.fanSpeed.commands?.[0]?.value || "auto"
      }
    });
  }
  return commands.filter((item) => Object.values(item.command).some((value) => value !== undefined && value !== null && value !== ""));
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

async function executeDevice(device) {
  const deviceCode = normalizeText(device?.deviceCode);
  const route = `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-command?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}&deviceCode=${encodeURIComponent(deviceCode)}`;
  const commandResults = [];
  for (const command of extractReadyCommands(device)) {
    const dispatchResponse = await requestJson("POST", route, {
      dispatch: true,
      deviceCode,
      command: command.command
    });
    const summary = summarizeDispatch(dispatchResponse);
    const verification = await verifyRecord(summary.recordId);
    commandResults.push({
      kind: command.kind,
      requestedCommand: command.command,
      dispatch: summary,
      verification: verification
        ? {
            ok: verification.ok,
            status: verification.status,
            recordStatus: verification.payload?.record?.status || null,
            feedback: verification.payload?.feedback || null
          }
        : null
    });
  }
  return {
    deviceCode,
    deviceName: device?.deviceName || deviceCode,
    results: commandResults
  };
}

function buildBlockedExecution(plan, health, commissioning, blockingItems) {
  const fieldArm = readFieldArmCheck();
  const canaryDispatch = readCanaryDispatchReport();
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "blocked_before_dispatch",
    controlMutation: false,
    planFile: PLAN_JSON,
    fieldArmFile: FIELD_ARM_JSON,
    canaryDispatchFile: CANARY_DISPATCH_JSON,
    blockingItems,
    planSummary: plan?.summary || null,
    evidence: {
      health: {
        ok: health?.ok === true,
        status: health?.status ?? null,
        url: health?.url || null,
        readOnlyMode: health?.payload?.readOnlyMode ?? null
      },
      commissioning: {
        ok: commissioning?.ok === true,
        status: commissioning?.status ?? null,
        url: commissioning?.url || null,
        summary: commissioning?.payload?.summary || null,
        executionGate: commissioning?.payload?.executionGate || null
      },
      fieldArm: {
        ok: fieldArm?.ok === true,
        verdict: fieldArm?.verdict || null,
        blockingItems: fieldArm?.blockingItems || []
      },
      canaryDispatch: {
        ok: canaryDispatch?.ok === true,
        mode: canaryDispatch?.mode || null,
        canary: canaryDispatch?.canary || null,
        verification: canaryDispatch?.verification || null
      }
    },
    devices: []
  };
}

function buildExecutionReport(plan, health, commissioning, devices) {
  const controlMutation = devices.some((device) =>
    device.results.some((result) => result.dispatch.controlMutation === true)
  );
  const dispatchFailures = devices.flatMap((device) =>
    device.results.filter((result) => result.dispatch.decisionStatus !== "dispatched")
  );
  return {
    ok: controlMutation && dispatchFailures.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "confirmed_dispatch",
    controlMutation,
    planFile: PLAN_JSON,
    canaryDispatchFile: CANARY_DISPATCH_JSON,
    planSummary: plan.summary || null,
    commissioningSummary: commissioning.payload?.summary || null,
    devices,
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null
      },
      commissioning: {
        ok: commissioning.ok,
        status: commissioning.status,
        url: commissioning.url,
        executionGate: commissioning.payload?.executionGate || null
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 小批量确认执行结果");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 结论: ${report.ok ? "执行成功" : "未执行或未成功"}`);
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
  if (report.devices?.length) {
    lines.push("## 设备结果");
    lines.push("");
    for (const device of report.devices) {
      lines.push(`### ${device.deviceCode} ${device.deviceName}`);
      lines.push("");
      for (const result of device.results) {
        lines.push(`- ${result.kind}: ${result.dispatch.decisionStatus || "unknown"} / mutation=${result.dispatch.controlMutation ? "yes" : "no"} / feedback=${result.verification?.recordStatus || "未校验"}`);
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
  const fieldArm = readFieldArmCheck();
  const canaryDispatch = readCanaryDispatchReport();
  const canaryPrerequisite = evaluateCanaryDispatchPrerequisite(plan, canaryDispatch);
  const health = await requestJson("GET", "/healthz");
  const commissioning = await requestJson(
    "GET",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  const blockingItems = [];
  if (plan?.error) {
    blockingItems.push({
      key: "plan_unavailable",
      message: plan.error
    });
  }
  if (fieldArm?.error) {
    blockingItems.push({
      key: "field_arm_unavailable",
      message: fieldArm.error
    });
  }
  if (fieldArm?.ok !== true || fieldArm?.verdict !== "field_arm_ready") {
    blockingItems.push({
      key: "field_arm_not_ready",
      message: `现场 arm-check 未通过：${fieldArm?.verdict || "unknown"}`
    });
  }
  if (CONFIRM !== CONFIRM_PHRASE) {
    blockingItems.push({
      key: "confirm_phrase_missing",
      message: `必须设置 FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} 才允许真实 BA 写入。`
    });
  }
  if (canaryDispatch?.error) {
    blockingItems.push({
      key: "canary_dispatch_report_unavailable",
      message: canaryDispatch.error
    });
  }
  if (canaryPrerequisite.ok !== true) {
    blockingItems.push({
      key: "canary_feedback_not_confirmed",
      message: `小批量执行前必须先完成首台 Canary 真实下发并反馈确认。expected=${canaryPrerequisite.expectedCanary || "--"}, actual=${canaryPrerequisite.actualCanary || "--"}, recordStatus=${canaryPrerequisite.recordStatus || "--"}, mode=${canaryPrerequisite.mode || "--"}`
    });
  }
  if (health.ok !== true) {
    blockingItems.push({
      key: "bff_unavailable",
      message: health.error || `BFF health failed with status ${health.status}`
    });
  }
  if (commissioning.ok !== true) {
    blockingItems.push({
      key: "commissioning_unavailable",
      message: commissioning.error || `Commissioning check failed with status ${commissioning.status}`
    });
  }
  if (commissioning.payload?.executionGate?.dispatchAllowed !== true) {
    blockingItems.push({
      key: "global_execution_gate",
      message: `全局投运闸门未打开：${(commissioning.payload?.executionGate?.blockedReasons || []).join(" / ") || "unknown"}`
    });
  }
  if (!Array.isArray(plan?.devices) || plan.devices.length === 0) {
    blockingItems.push({
      key: "empty_plan",
      message: "执行单没有设备。"
    });
  }

  if (blockingItems.length > 0) {
    const blocked = buildBlockedExecution(plan, health, commissioning, blockingItems);
    writeReport(blocked);
    console.log(`FCU_SMALL_BATCH_EXECUTION ok=false mode=blocked_before_dispatch blocking=${blockingItems.length} mutation=false`);
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    process.exitCode = 2;
    return;
  }

  const devices = [];
  for (const device of plan.devices) {
    devices.push(await executeDevice(device));
  }
  const report = buildExecutionReport(plan, health, commissioning, devices);
  writeReport(report);
  console.log(
    `FCU_SMALL_BATCH_EXECUTION ok=${report.ok} mode=confirmed_dispatch devices=${devices.length} mutation=${report.controlMutation}`
  );
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
