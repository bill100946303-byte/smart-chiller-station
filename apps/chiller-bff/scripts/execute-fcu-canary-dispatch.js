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
const PREFLIGHT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.resolve(DOCS_DIR, "fcu-go-live-preflight-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json");
const OUTPUT_JSON_DEFAULT =
  process.env.FCU_CANARY_DISPATCH_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.json");
const OUTPUT_MD_DEFAULT =
  process.env.FCU_CANARY_DISPATCH_MD ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_CANARY_DISPATCH_TIMEOUT_MS, 20000);
const FEEDBACK_TIMEOUT_MS = normalizeInteger(process.env.FCU_CANARY_FEEDBACK_TIMEOUT_MS, 120000);
const FEEDBACK_POLL_MS = normalizeInteger(process.env.FCU_CANARY_FEEDBACK_POLL_MS, 5000);
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM);
const REQUESTED_DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE);
const COMMAND_KIND = normalizeCommandKind(process.env.FCU_CANARY_COMMAND_KIND || "setpoint");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function slugifyDeviceCode(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function resolveDevicePath(defaultPath, extension) {
  if (!REQUESTED_DEVICE_CODE) {
    return defaultPath;
  }
  return defaultPath.replace(/-latest\.[^.]+$/, `-${slugifyDeviceCode(REQUESTED_DEVICE_CODE)}.${extension}`);
}

const OUTPUT_JSON = resolveDevicePath(OUTPUT_JSON_DEFAULT, "json");
const OUTPUT_MD = resolveDevicePath(OUTPUT_MD_DEFAULT, "md");

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeCommandKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["setpoint", "fan_speed"].includes(normalized) ? normalized : "setpoint";
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

function readFieldArmCheck() {
  return readJsonFile(FIELD_ARM_JSON);
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

function extractCommand(device, kind) {
  const preview = kind === "fan_speed" ? device?.previews?.fanSpeed : device?.previews?.setpoint;
  if (preview?.decisionStatus !== "ready" || preview.commandCount <= 0) {
    return null;
  }
  const command = preview.commands?.[0] || null;
  if (!command) {
    return null;
  }
  if (kind === "fan_speed") {
    return {
      fanSpeed: command.value || "auto"
    };
  }
  return {
    setpointC: command.value
  };
}

function selectCanaryDevice(plan) {
  const devices = Array.isArray(plan?.devices) ? plan.devices : [];
  if (REQUESTED_DEVICE_CODE) {
    return devices.find((item) => normalizeText(item?.deviceCode) === REQUESTED_DEVICE_CODE) || null;
  }
  return devices[0] || null;
}

function resolveExpectedCanaryDeviceCode(plan, fieldArm) {
  return normalizeText(fieldArm?.firstCanary) ||
    normalizeText(plan?.summary?.firstCanary) ||
    normalizeText(Array.isArray(plan?.devices) ? plan.devices[0]?.deviceCode : "");
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function readFeedbackRecordStatus(verification) {
  return normalizeText(verification?.payload?.record?.status);
}

function isFinalFeedbackStatus(status) {
  return [
    "feedback_confirmed",
    "feedback_mismatch_locked",
    "feedback_partial",
    "feedback_not_checkable"
  ].includes(normalizeText(status));
}

async function verifyRecordUntilFinal(recordId) {
  if (!recordId) {
    return {
      final: null,
      attempts: [],
      timedOut: false
    };
  }
  const startedAt = Date.now();
  const attempts = [];
  let final = null;
  while (Date.now() - startedAt <= FEEDBACK_TIMEOUT_MS) {
    const verification = await verifyRecord(recordId);
    const recordStatus = readFeedbackRecordStatus(verification);
    attempts.push({
      checkedAt: new Date().toISOString(),
      ok: verification?.ok === true,
      status: verification?.status ?? null,
      recordStatus: recordStatus || null
    });
    final = verification;
    if (isFinalFeedbackStatus(recordStatus)) {
      return {
        final,
        attempts,
        timedOut: false
      };
    }
    if (FEEDBACK_POLL_MS <= 0) {
      break;
    }
    await sleep(FEEDBACK_POLL_MS);
  }
  return {
    final,
    attempts,
    timedOut: true
  };
}

function shouldRollbackAfterVerification(recordStatus) {
  return ["feedback_mismatch_locked", "feedback_partial", "feedback_not_checkable"].includes(normalizeText(recordStatus));
}

async function rollbackRecord(recordId, verification) {
  if (!recordId || !shouldRollbackAfterVerification(verification?.payload?.record?.status)) {
    return null;
  }
  return requestJson(
    "POST",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-records/${encodeURIComponent(recordId)}/rollback`,
    {
      reason: `canary feedback abnormal: ${verification?.payload?.record?.status || "unknown"}`
    }
  );
}

function buildBlockedReport(plan, preflight, health, blockingItems, canary = null) {
  const fieldArm = readFieldArmCheck();
  return {
    ok: false,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "blocked_before_canary_dispatch",
    commandKind: COMMAND_KIND,
    controlMutation: false,
    planFile: PLAN_JSON,
    preflightFile: PREFLIGHT_JSON,
    fieldArmFile: FIELD_ARM_JSON,
    canary,
    blockingItems,
    evidence: {
      health: {
        ok: health?.ok === true,
        status: health?.status ?? null,
        url: health?.url || null,
        readOnlyMode: health?.payload?.readOnlyMode ?? null
      },
      preflight: {
        ok: preflight?.ok === true,
        verdict: preflight?.verdict || null,
        blockingItems: preflight?.blockingItems || []
      },
      fieldArm: {
        ok: fieldArm?.ok === true,
        verdict: fieldArm?.verdict || null,
        blockingItems: fieldArm?.blockingItems || []
      },
      planSummary: plan?.summary || null
    }
  };
}

function summarizeRollback(response) {
  if (!response) {
    return null;
  }
  return {
    ok: response.ok,
    status: response.status,
    recordStatus: response.payload?.record?.status || null,
    rolledBackAt: response.payload?.record?.rolledBackAt || null,
    rollbackReason: response.payload?.record?.rollbackReason || null
  };
}

function buildDispatchReport(plan, preflight, health, canary, requestedCommand, dispatch, verificationResult, rollback) {
  const verification = verificationResult?.final || null;
  const feedbackRecordStatus = verification?.payload?.record?.status || null;
  return {
    ok: dispatch.controlMutation === true &&
      dispatch.decisionStatus === "dispatched" &&
      feedbackRecordStatus === "feedback_confirmed",
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    mode: "confirmed_canary_dispatch",
    commandKind: COMMAND_KIND,
    controlMutation: dispatch.controlMutation === true,
    planFile: PLAN_JSON,
    preflightFile: PREFLIGHT_JSON,
    canary,
    requestedCommand,
    dispatch,
    verification: verification
      ? {
          ok: verification.ok,
          status: verification.status,
          recordStatus: feedbackRecordStatus,
          feedback: verification.payload?.feedback || null,
          attempts: verificationResult?.attempts || [],
          timedOut: verificationResult?.timedOut === true
        }
      : null,
    rollback: summarizeRollback(rollback),
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null
      },
      preflight: {
        ok: preflight.ok === true,
        verdict: preflight.verdict || null
      },
      planSummary: plan.summary || null
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU Canary 单台下发结果");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 设备: ${report.canary?.deviceCode || "--"} ${report.canary?.deviceName || ""}`.trim());
  lines.push(`- 命令: ${report.commandKind}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 结论: ${report.ok ? "canary 下发完成" : "未执行或未成功"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  if (report.requestedCommand) {
    lines.push("## 请求命令");
    lines.push("");
    lines.push(`- ${JSON.stringify(report.requestedCommand)}`);
    lines.push("");
  }
  if (report.blockingItems?.length) {
    lines.push("## 阻断项");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  if (report.dispatch) {
    lines.push("## 下发结果");
    lines.push("");
    lines.push(`- 状态: ${report.dispatch.decisionStatus || "unknown"}`);
    lines.push(`- mutation: ${report.dispatch.controlMutation ? "yes" : "no"}`);
    lines.push(`- recordId: ${report.dispatch.recordId || "--"}`);
    lines.push(`- 反馈: ${report.verification?.recordStatus || "未校验"}`);
    lines.push(`- 回退: ${report.rollback?.recordStatus || "未触发"}`);
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
  const preflight = readJsonFile(PREFLIGHT_JSON);
  const fieldArm = readFieldArmCheck();
  const health = await requestJson("GET", "/healthz");
  const canaryDevice = selectCanaryDevice(plan);
  const expectedCanaryDeviceCode = resolveExpectedCanaryDeviceCode(plan, fieldArm);
  const requestedCommand = canaryDevice ? extractCommand(canaryDevice, COMMAND_KIND) : null;
  const canary = canaryDevice
    ? {
        deviceCode: canaryDevice.deviceCode,
        deviceName: canaryDevice.deviceName || canaryDevice.deviceCode,
        zoneTemperatureC: canaryDevice.zoneTemperatureC ?? null,
        setpointC: canaryDevice.setpointC ?? null
      }
    : null;
  const blockingItems = [];
  if (plan?.error) {
    blockingItems.push({ key: "plan_unavailable", message: plan.error });
  }
  if (preflight?.error) {
    blockingItems.push({ key: "preflight_unavailable", message: preflight.error });
  }
  if (preflight?.ok !== true) {
    blockingItems.push({
      key: "preflight_not_go",
      message: `上线前预检未通过：${preflight?.verdict || "unknown"}`
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
  if (health.ok !== true) {
    blockingItems.push({
      key: "bff_unavailable",
      message: health.error || `BFF health failed with status ${health.status}`
    });
  }
  if (!canaryDevice) {
    blockingItems.push({
      key: "canary_device_not_found",
      message: REQUESTED_DEVICE_CODE ? `执行单中未找到 ${REQUESTED_DEVICE_CODE}。` : "执行单没有 canary 设备。"
    });
  }
  if (canaryDevice && expectedCanaryDeviceCode && normalizeText(canaryDevice.deviceCode) !== expectedCanaryDeviceCode) {
    blockingItems.push({
      key: "canary_order_violation",
      message: `只能先执行首台 Canary ${expectedCanaryDeviceCode}，当前请求 ${normalizeText(canaryDevice.deviceCode)}。`
    });
  }
  if (!requestedCommand) {
    blockingItems.push({
      key: "canary_command_not_ready",
      message: `${canary?.deviceCode || "--"} 没有 ready 的 ${COMMAND_KIND} 命令。`
    });
  }
  if (blockingItems.length > 0) {
    const report = buildBlockedReport(plan, preflight, health, blockingItems, canary);
    writeReport(report);
    console.log(`FCU_CANARY_DISPATCH ok=false mode=blocked_before_canary_dispatch device=${canary?.deviceCode || "--"} command=${COMMAND_KIND} mutation=false blocking=${blockingItems.length}`);
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    process.exitCode = 2;
    return;
  }

  const deviceCode = normalizeText(canaryDevice.deviceCode);
  const route = `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-command?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}&deviceCode=${encodeURIComponent(deviceCode)}`;
  const dispatchResponse = await requestJson("POST", route, {
    dispatch: true,
    deviceCode,
    command: requestedCommand
  });
  const dispatch = summarizeDispatch(dispatchResponse);
  const verificationResult = await verifyRecordUntilFinal(dispatch.recordId);
  const rollback = await rollbackRecord(dispatch.recordId, verificationResult.final);
  const report = buildDispatchReport(plan, preflight, health, canary, requestedCommand, dispatch, verificationResult, rollback);
  writeReport(report);
  console.log(`FCU_CANARY_DISPATCH ok=${report.ok} mode=confirmed_canary_dispatch device=${deviceCode} command=${COMMAND_KIND} mutation=${report.controlMutation}`);
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
