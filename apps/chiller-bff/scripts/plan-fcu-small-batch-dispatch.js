import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BUILD = normalizeText(process.env.FCU_BUILD) || "1";
const FLOOR = normalizeText(process.env.FCU_FLOOR) || "1";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const LIMIT = normalizeInteger(process.env.FCU_SMALL_BATCH_LIMIT, 2);
const SETPOINT_C = normalizeNumber(process.env.FCU_SMALL_BATCH_SETPOINT_C, 25.5);
const MAX_SETPOINT_SHIFT_C = normalizeNumber(process.env.FCU_SMALL_BATCH_MAX_SETPOINT_SHIFT_C, 2);
const FAN_SPEED = normalizeFanSpeed(process.env.FCU_SMALL_BATCH_FAN_SPEED || "auto");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_SMALL_BATCH_TIMEOUT_MS, 20000);
const OUTPUT_JSON =
  process.env.FCU_SMALL_BATCH_PLAN_JSON ||
  path.join(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json");
const OUTPUT_MD =
  process.env.FCU_SMALL_BATCH_PLAN_MD ||
  path.join(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.md");

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
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function pickCandidateDevices(commissioningPayload) {
  const items = Array.isArray(commissioningPayload?.items) ? commissioningPayload.items : [];
  return items
    .filter((item) => item?.deviceReady === true)
    .filter((item) => item?.device?.communicationAlarm !== true)
    .filter((item) => Number.isFinite(item?.device?.zoneTemperatureC))
    .filter((item) => Number.isFinite(item?.device?.setpointC))
    .filter((item) => Math.abs(Number(item?.device?.setpointC) - SETPOINT_C) <= MAX_SETPOINT_SHIFT_C)
    .sort((a, b) => {
      const tempA = Number(a?.device?.zoneTemperatureC);
      const tempB = Number(b?.device?.zoneTemperatureC);
      const distanceA = Math.abs(tempA - SETPOINT_C);
      const distanceB = Math.abs(tempB - SETPOINT_C);
      return distanceA - distanceB;
    })
    .slice(0, LIMIT);
}

function summarizePreview(commandPreview) {
  const payload = commandPreview.payload || {};
  const decision = Array.isArray(payload.decisions) ? payload.decisions[0] || null : null;
  return {
    ok: commandPreview.ok,
    status: commandPreview.status,
    dispatchRequested: payload.dispatchRequested === true,
    dispatchAllowed: payload.dispatchAllowed === true,
    controlMutation: payload.controlMutation === true || payload.summary?.controlMutation === true,
    recordId: decision?.recordId || null,
    decisionStatus: decision?.status || null,
    reason: decision?.reason || null,
    blockReasons: decision?.blockReasons || [],
    commandCount: Array.isArray(decision?.commands) ? decision.commands.length : 0,
    commands: Array.isArray(decision?.commands) ? decision.commands : []
  };
}

async function previewDevice(device) {
  const deviceCode = device?.device?.deviceCode || device?.device?.deviceId || device?.device?.deviceName || "";
  const route = `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-command?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}&deviceCode=${encodeURIComponent(deviceCode)}`;
  const setpointPreview = await requestJson("POST", route, {
    dispatch: false,
    deviceCode,
    command: {
      setpointC: SETPOINT_C
    }
  });
  const fanSpeedPreview = await requestJson("POST", route, {
    dispatch: false,
    deviceCode,
    command: {
      fanSpeed: FAN_SPEED
    }
  });
  return {
    deviceCode,
    deviceName: device?.device?.deviceName || deviceCode,
    zoneTemperatureC: device?.device?.zoneTemperatureC ?? null,
    setpointC: device?.device?.setpointC ?? null,
    running: device?.device?.running ?? null,
    previews: {
      setpoint: summarizePreview(setpointPreview),
      fanSpeed: summarizePreview(fanSpeedPreview)
    },
    evidence: {
      setpointUrl: setpointPreview.url,
      fanSpeedUrl: fanSpeedPreview.url
    }
  };
}

function buildPlan(health, commissioning, devices) {
  const payload = commissioning.payload || {};
  const summary = payload.summary || {};
  const report = payload.report || {};
  const executionGate = payload.executionGate || {};
  const previewReadyCount = devices.reduce((total, device) => {
    const ready =
      device.previews.setpoint.decisionStatus === "ready" ||
      device.previews.fanSpeed.decisionStatus === "ready";
    return total + (ready ? 1 : 0);
  }, 0);
  return {
    ok: health.ok && commissioning.ok && devices.length > 0 && previewReadyCount > 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    dispatch: false,
    requestedLimit: LIMIT,
    targetSetpointC: SETPOINT_C,
    maxSetpointShiftC: MAX_SETPOINT_SHIFT_C,
    targetFanSpeed: FAN_SPEED,
    summary: {
      ...summary,
      plannedDevices: devices.length,
      previewReadyDevices: previewReadyCount
    },
    executionGate,
    commissioningVerdict: report.verdict || null,
    commissioningSummaryText: report.summaryText || "",
    devices,
    nextStep:
      executionGate.dispatchAllowed === true
        ? "现场授权后仍建议先对 1 台执行确认下发，等待反馈校验通过再扩大到下一台。"
        : "当前仅生成只读预演执行单；打开全局投运闸门后重新运行本脚本，再执行确认下发。",
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
        requestId: commissioning.payload?.requestId || null
      }
    }
  };
}

function renderMarkdown(plan) {
  const lines = [];
  lines.push("# FCU 小批量投运执行单");
  lines.push("");
  lines.push(`- 站点: ${plan.siteId}`);
  lines.push(`- 楼层: build=${plan.build}, floor=${plan.floor}`);
  lines.push(`- 生成时间: ${plan.generatedAt}`);
  lines.push(`- 下发模式: ${plan.dispatch ? "真实下发" : "只读预演"}`);
  lines.push(`- 目标设定: ${plan.targetSetpointC}°C`);
  lines.push(`- 单台最大设定偏移: ${plan.maxSetpointShiftC}°C`);
  lines.push(`- 目标风速: ${plan.targetFanSpeed}`);
  lines.push(`- 结论: ${plan.ok ? "已生成可执行预演单" : "执行单未就绪"}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- 总 FCU: ${plan.summary.total ?? 0}`);
  lines.push(`- 设备侧就绪: ${plan.summary.deviceReady ?? 0}`);
  lines.push(`- 单台阻断: ${plan.summary.deviceBlocked ?? 0}`);
  lines.push(`- 可真实下发: ${plan.summary.canDispatch ?? 0}`);
  lines.push(`- 本次计划设备: ${plan.summary.plannedDevices ?? 0}`);
  lines.push(`- 预演 ready 设备: ${plan.summary.previewReadyDevices ?? 0}`);
  lines.push("");
  lines.push("## 设备执行单");
  lines.push("");
  for (const device of plan.devices) {
    lines.push(`### ${device.deviceCode} ${device.deviceName}`);
    lines.push("");
    lines.push(`- 当前温度: ${device.zoneTemperatureC ?? "--"}°C`);
    lines.push(`- 当前设定: ${device.setpointC ?? "--"}°C`);
    lines.push(`- 运行状态: ${device.running === true ? "运行" : device.running === false ? "停止" : "未知"}`);
    lines.push(`- 设定预演: ${device.previews.setpoint.decisionStatus || "unknown"} / 命令 ${device.previews.setpoint.commandCount}`);
    lines.push(`- 风速预演: ${device.previews.fanSpeed.decisionStatus || "unknown"} / 命令 ${device.previews.fanSpeed.commandCount}`);
    if (device.previews.setpoint.blockReasons.length || device.previews.fanSpeed.blockReasons.length) {
      lines.push(`- 阻断: ${[...device.previews.setpoint.blockReasons, ...device.previews.fanSpeed.blockReasons].join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## 下一步");
  lines.push("");
  lines.push(`- ${plan.nextStep}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const health = await requestJson("GET", "/healthz");
  const commissioning = await requestJson(
    "GET",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  const candidates = pickCandidateDevices(commissioning.payload || {});
  const devices = [];
  for (const candidate of candidates) {
    devices.push(await previewDevice(candidate));
  }
  const plan = buildPlan(health, commissioning, devices);
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(plan, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(plan));
  console.log(
    `FCU_SMALL_BATCH_PLAN ok=${plan.ok} planned=${plan.summary.plannedDevices || 0} previewReady=${plan.summary.previewReadyDevices || 0} canDispatch=${plan.summary.canDispatch || 0} dispatch=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!plan.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
