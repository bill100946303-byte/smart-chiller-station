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
const TARGET_SETPOINT_C = normalizeNumber(process.env.FCU_ALL_DEVICE_TARGET_SETPOINT_C, 25.5);
const MAX_SETPOINT_SHIFT_C = normalizeNumber(process.env.FCU_ALL_DEVICE_MAX_SETPOINT_SHIFT_C, 2);
const WAVE_SIZE = normalizeInteger(process.env.FCU_ALL_DEVICE_WAVE_SIZE, 9);
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_ALL_DEVICE_PLAN_TIMEOUT_MS, 20000);
const DEVICE_REASON_EXCLUDES = new Set([
  "global_execution_gate",
  "backend_write_gate",
  "read_only_mode",
  "subsystem_write_disabled",
  "adapter_not_configured"
]);
const OUTPUT_JSON =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON ||
  path.join(DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const OUTPUT_MD =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_MD ||
  path.join(DOCS_DIR, "fcu-all-device-dispatch-plan-latest.md");

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

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      parseError: true,
      error: error instanceof Error ? error.message : "json parse failed",
      raw: text.slice(0, 500)
    };
  }
}

function requestJson(routePath) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
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
    req.end();
  });
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readDeviceCode(item) {
  return normalizeText(item?.device?.deviceCode || item?.device?.deviceId || item?.device?.deviceName);
}

function readDeviceName(item) {
  return normalizeText(item?.device?.deviceName || readDeviceCode(item));
}

function readCurrentSetpoint(item) {
  const value = Number(item?.device?.setpointC ?? item?.device?.setpointFeedbackC);
  return Number.isFinite(value) ? value : null;
}

function summarizeBlockedReasons(item) {
  const rawReasons = [
    ...(Array.isArray(item?.controlBlockReasons) ? item.controlBlockReasons : []),
    ...(Array.isArray(item?.blockedReasons) ? item.blockedReasons : [])
  ].map(normalizeText).filter(Boolean);
  const hasTemperatureQualityBlock =
    rawReasons.includes("temperature_quality_guard") ||
    rawReasons.includes("invalid_temperature") ||
    rawReasons.includes("zero_temperature") ||
    item?.device?.zoneTemperatureC === 0;
  const reasons = rawReasons
    .map((reason) => {
      if (reason === "temperature_valid" && hasTemperatureQualityBlock) {
        return "temperature_quality_guard";
      }
      return reason;
    })
    .filter((reason) => reason !== "temperature_valid" && reason !== "communication_ok" && !DEVICE_REASON_EXCLUDES.has(reason));
  return Array.from(new Set(reasons));
}

function buildDeviceRow(item) {
  const setpointC = readCurrentSetpoint(item);
  const setpointShiftC = setpointC == null ? null : Math.abs(setpointC - TARGET_SETPOINT_C);
  return {
    deviceCode: readDeviceCode(item),
    deviceName: readDeviceName(item),
    status: item?.status || null,
    deviceReady: item?.deviceReady === true,
    canDispatch: item?.canDispatch === true,
    running: item?.device?.running ?? null,
    zoneTemperatureC: item?.device?.zoneTemperatureC ?? null,
    setpointC,
    setpointShiftC,
    communicationAlarm: item?.device?.communicationAlarm === true,
    qualityStatus: item?.device?.qualityStatus || null,
    blockedReasons: summarizeBlockedReasons(item)
  };
}

function isSetpointOnlyBlocked(item) {
  if (item.deviceReady === true) {
    return false;
  }
  const reasons = new Set(item.blockedReasons || []);
  if (!(reasons.has("setpoint_feedback_valid") || reasons.has("setpoint_feedback_out_of_bounds"))) {
    return false;
  }
  const allowed = new Set(["setpoint_feedback_valid", "setpoint_feedback_out_of_bounds"]);
  return [...reasons].every((reason) => allowed.has(reason));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function classifyDevices(items) {
  const rows = items.map(buildDeviceRow).filter((item) => item.deviceCode);
  const setpointOnlyRows = rows.filter(isSetpointOnlyBlocked);
  const readyRows = rows.filter((item) => item.deviceReady);
  const blockedRows = rows.filter((item) => !item.deviceReady && !isSetpointOnlyBlocked(item));
  const immediateRows = readyRows.filter(
    (item) => item.setpointShiftC != null && item.setpointShiftC <= MAX_SETPOINT_SHIFT_C
  );
  const stagedRows = [
    ...readyRows.filter((item) => item.setpointShiftC == null || item.setpointShiftC > MAX_SETPOINT_SHIFT_C),
    ...setpointOnlyRows.map((item) => ({
      ...item,
      setpointNormalizationRequired: true
    }))
  ];
  const firstCanary = immediateRows.find((item) => item.deviceCode === "BGS01") || immediateRows[0] || null;
  const immediateWithoutCanary = firstCanary
    ? immediateRows.filter((item) => item.deviceCode !== firstCanary.deviceCode)
    : immediateRows;
  const waves = [];
  if (firstCanary) {
    waves.push({
      key: "canary",
      label: "首台 Canary",
      size: 1,
      devices: [firstCanary.deviceCode],
      purpose: "先验证真实写入、反馈校验和回退链路。"
    });
  }
  chunk(immediateWithoutCanary, WAVE_SIZE).forEach((wave, index) => {
    waves.push({
      key: `immediate_wave_${index + 1}`,
      label: `可立即小批量 ${index + 1}`,
      size: wave.length,
      devices: wave.map((item) => item.deviceCode),
      purpose: "设定偏移在保护范围内，可在 Canary 反馈确认后分批执行。"
    });
  });
  chunk(stagedRows, WAVE_SIZE).forEach((wave, index) => {
    waves.push({
      key: `staged_setpoint_wave_${index + 1}`,
      label: `分步调设定 ${index + 1}`,
      size: wave.length,
      devices: wave.map((item) => item.deviceCode),
      purpose: "当前设定与目标偏差超过单次保护限，需要先按 0.5-2.0°C 分步拉回。"
    });
  });
  return {
    rows,
    readyRows,
    blockedRows,
    immediateRows,
    stagedRows,
    firstCanary,
    waves
  };
}

function buildReport({ health, commissioning }) {
  const items = Array.isArray(commissioning.payload?.items) ? commissioning.payload.items : [];
  const classified = classifyDevices(items);
  const executionGate = commissioning.payload?.executionGate || {};
  const blockingByReason = new Map();
  for (const item of classified.blockedRows) {
    for (const reason of item.blockedReasons.length ? item.blockedReasons : ["unknown"]) {
      blockingByReason.set(reason, (blockingByReason.get(reason) || 0) + 1);
    }
  }
  const total = classified.rows.length;
  const plannedDeviceCount = classified.immediateRows.length + classified.stagedRows.length;
  return {
    ok: health.ok === true && commissioning.ok === true && total > 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    controlMutation: false,
    dispatch: false,
    targetSetpointC: TARGET_SETPOINT_C,
    maxSetpointShiftC: MAX_SETPOINT_SHIFT_C,
    waveSize: WAVE_SIZE,
    summary: {
      total,
      deviceReady: classified.readyRows.length,
      immediateReady: classified.immediateRows.length,
      stagedSetpoint: classified.stagedRows.length,
      blocked: classified.blockedRows.length,
      plannedDeviceCount,
      canCompleteAllNow: classified.blockedRows.length === 0,
      dispatchAllowed: executionGate.dispatchAllowed === true
    },
    firstCanary: classified.firstCanary?.deviceCode || null,
    waves: classified.waves,
    blockedDevices: classified.blockedRows,
    stagedSetpointDevices: classified.stagedRows,
    blockingByReason: Array.from(blockingByReason.entries()).map(([reason, count]) => ({ reason, count })),
    nextActions: buildNextActions(classified, executionGate),
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
        summary: commissioning.payload?.summary || null,
        executionGate
      }
    }
  };
}

function buildNextActions(classified, executionGate) {
  const actions = [];
  if (executionGate.dispatchAllowed !== true) {
    actions.push({
      priority: "P0",
      action: "打开后端只读/全局投运闸门后重跑 Arm-Check",
      target: "backend_not_readonly / executionGate",
      reason: `当前阻断：${(executionGate.blockedReasons || []).join(" / ") || "unknown"}`
    });
  }
  if (classified.firstCanary) {
    actions.push({
      priority: "P0",
      action: "先执行首台 Canary",
      target: classified.firstCanary.deviceCode,
      reason: "首台反馈确认后再进入小批量。"
    });
  }
  if (classified.blockedRows.length > 0) {
    actions.push({
      priority: "P0",
      action: "整改通讯/温度质量阻断设备",
      target: `${classified.blockedRows.length} 台`,
      reason: "通讯报警、0°C、越界温度设备不能进入自动闭环。"
    });
  }
  if (classified.stagedRows.length > 0) {
    actions.push({
      priority: "P1",
      action: "对大偏差设定值设备执行分步拉回",
      target: `${classified.stagedRows.length} 台`,
      reason: "避免一次性把 10-19°C 等异常设定拉到目标值。"
    });
  }
  return actions;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 全量最终控制分批计划");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 目标设定: ${report.targetSetpointC}°C`);
  lines.push(`- 单次设定偏移保护: ${report.maxSetpointShiftC}°C`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- 总 FCU: ${report.summary.total}`);
  lines.push(`- 设备侧就绪: ${report.summary.deviceReady}`);
  lines.push(`- 可立即执行: ${report.summary.immediateReady}`);
  lines.push(`- 需分步调设定: ${report.summary.stagedSetpoint}`);
  lines.push(`- 质量/通讯阻断: ${report.summary.blocked}`);
  lines.push(`- 当前可全量完成: ${report.summary.canCompleteAllNow ? "是" : "否"}`);
  lines.push("");
  lines.push("## 波次");
  lines.push("");
  lines.push("| 波次 | 台数 | 设备 | 目的 |");
  lines.push("|---|---:|---|---|");
  for (const wave of report.waves) {
    lines.push(`| ${wave.label} | ${wave.size} | ${wave.devices.join(", ") || "--"} | ${wave.purpose} |`);
  }
  lines.push("");
  if (report.blockedDevices.length > 0) {
    lines.push("## 阻断设备");
    lines.push("");
    lines.push("| 设备 | 名称 | 温度 | 设定 | 原因 |");
    lines.push("|---|---|---:|---:|---|");
    for (const item of report.blockedDevices) {
      lines.push(`| ${item.deviceCode} | ${item.deviceName} | ${item.zoneTemperatureC ?? "--"} | ${item.setpointC ?? "--"} | ${item.blockedReasons.join(", ") || "--"} |`);
    }
    lines.push("");
  }
  if (report.nextActions.length > 0) {
    lines.push("## 下一步");
    lines.push("");
    for (const action of report.nextActions) {
      lines.push(`- ${action.priority} ${action.action}: ${action.target}。${action.reason}`);
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
  const [health, commissioning] = await Promise.all([
    requestJson("/healthz"),
    requestJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`)
  ]);
  const report = buildReport({ health, commissioning });
  writeReport(report);
  console.log(
    `FCU_ALL_DEVICE_DISPATCH_PLAN ok=${report.ok} total=${report.summary.total} immediate=${report.summary.immediateReady} staged=${report.summary.stagedSetpoint} blocked=${report.summary.blocked} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
