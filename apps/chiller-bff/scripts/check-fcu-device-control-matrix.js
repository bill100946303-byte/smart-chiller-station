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
const SHELL_BASE_URL = (process.env.SHELL_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const OUTPUT_JSON =
  process.env.FCU_DEVICE_CONTROL_MATRIX_JSON ||
  path.join(DOCS_DIR, "fcu-device-control-matrix-latest.json");
const OUTPUT_MD =
  process.env.FCU_DEVICE_CONTROL_MATRIX_MD ||
  path.join(DOCS_DIR, "fcu-device-control-matrix-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_DEVICE_CONTROL_MATRIX_TIMEOUT_MS, 20000);

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
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
}

function deviceKey(item) {
  return normalizeText(item?.deviceCode || item?.deviceId || item?.deviceName);
}

function buildDeviceUrl(deviceCode) {
  const params = new URLSearchParams();
  params.set("siteId", SITE_ID);
  params.set("view", "device");
  params.set("deviceCode", deviceCode);
  return `${SHELL_BASE_URL}/hvac-terminal?${params.toString()}`;
}

function humanizeBlockReason(reason) {
  const normalized = normalizeText(reason);
  const labels = {
    whitelisted: "未在小批量白名单",
    not_whitelisted: "未在小批量白名单",
    global_execution_gate: "全局投运闸门未开",
    backend_not_readonly: "后端只读总闸未开",
    communication_ok: "通讯异常",
    temperature_valid: "温度无效",
    not_local_manual: "本地/手动优先",
    start_writable: "启动写点不可写",
    stop_writable: "停止写点不可写",
    setpoint_writable: "设定写点不可写",
    fan_speed_writable: "风速写点不可写",
    feedback_unlocked: "反馈锁定",
    policy_enabled: "策略未启用",
    device_mode_enforced: "单台未进入自动闭环",
    device_found: "设备快照缺失"
  };
  return labels[normalized] || normalized;
}

function collectBlockedReasons(commissioning) {
  const failedConditionReasons = (Array.isArray(commissioning?.conditions) ? commissioning.conditions : [])
    .filter((condition) => condition?.ok === false)
    .map((condition) => condition.key || condition.label);
  const controlReasons = Array.isArray(commissioning?.controlBlockReasons) ? commissioning.controlBlockReasons : [];
  return [...new Set([...failedConditionReasons, ...controlReasons].map(humanizeBlockReason).filter(Boolean))];
}

function summarizeDevice(item, commissioningByCode, executionGate) {
  const code = deviceKey(item);
  const commissioning = commissioningByCode.get(code) || null;
  const qualityStatus = normalizeText(item?.quality?.status) || "unknown";
  const blockedReasons = collectBlockedReasons(commissioning);
  return {
    deviceCode: code,
    deviceName: normalizeText(item?.deviceName) || code,
    deviceTypeName: normalizeText(item?.deviceTypeName) || "FCU",
    floorName: normalizeText(item?.floorName),
    deviceUrl: buildDeviceUrl(code),
    running: item?.running ?? null,
    communicationAlarm: item?.communicationAlarm ?? null,
    zoneTemperatureC: typeof item?.zoneTemperatureC === "number" ? item.zoneTemperatureC : null,
    setpointC: typeof item?.setpointFeedbackC === "number" ? item.setpointFeedbackC : typeof item?.setpointC === "number" ? item.setpointC : null,
    fanSpeedState: typeof item?.fanSpeedState === "number" ? item.fanSpeedState : null,
    valveOpen: item?.valveOpen ?? null,
    pointCount: item?.pointCount || 0,
    writablePointCount: item?.writablePointCount || 0,
    qualityStatus,
    commissioningStatus: commissioning?.status || "unknown",
    deviceReady: commissioning?.deviceReady === true,
    canDispatch: commissioning?.canDispatch === true,
    globalDispatchAllowed: executionGate?.dispatchAllowed === true,
    blockedReasons,
    latestRecordStatus: commissioning?.latestRecord?.status || null,
    controlPageReady: Boolean(code)
  };
}

function buildReport(snapshotResponse, commissioningResponse) {
  const snapshot = snapshotResponse.payload || {};
  const commissioning = commissioningResponse.payload || {};
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const commissioningByCode = new Map();
  for (const status of Array.isArray(commissioning.items) ? commissioning.items : []) {
    const code = deviceKey(status?.device);
    if (code) {
      commissioningByCode.set(code, status);
    }
  }
  const executionGate = commissioning.executionGate || {};
  const devices = items.map((item) => summarizeDevice(item, commissioningByCode, executionGate));
  const missingRouteCount = devices.filter((item) => !item.controlPageReady).length;
  const deviceReadyCount = devices.filter((item) => item.deviceReady).length;
  const canDispatchCount = devices.filter((item) => item.canDispatch).length;
  const blockedCount = devices.filter((item) => !item.deviceReady).length;
  const alarmCount = devices.filter((item) => item.communicationAlarm === true).length;
  const invalidTempCount = devices.filter((item) =>
    item.zoneTemperatureC === null || item.zoneTemperatureC === 0 || item.zoneTemperatureC < 5 || item.zoneTemperatureC > 45
  ).length;
  return {
    ok: snapshotResponse.ok && commissioningResponse.ok && devices.length > 0 && missingRouteCount === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    shellBaseUrl: SHELL_BASE_URL,
    summary: {
      total: devices.length,
      rawDeviceRows: snapshot.summary?.rawDeviceRows ?? devices.length,
      duplicateCollapsedCount: snapshot.summary?.duplicateCollapsedCount ?? 0,
      controlPageReady: devices.length - missingRouteCount,
      missingRoute: missingRouteCount,
      deviceReady: deviceReadyCount,
      deviceBlocked: blockedCount,
      canDispatch: canDispatchCount,
      communicationAlarm: alarmCount,
      invalidTemperature: invalidTempCount,
      globalDispatchAllowed: executionGate.dispatchAllowed === true
    },
    executionGate,
    devices,
    evidence: {
      snapshot: {
        ok: snapshotResponse.ok,
        status: snapshotResponse.status,
        url: snapshotResponse.url
      },
      commissioning: {
        ok: commissioningResponse.ok,
        status: commissioningResponse.status,
        url: commissioningResponse.url,
        requestId: commissioning.requestId || null
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 逐台控制矩阵");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.ok ? "逐台控制页已具备" : "逐台控制页或数据读取不完整"}`);
  lines.push(`- 全局真实下发: ${report.summary.globalDispatchAllowed ? "允许" : "未允许"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- FCU 总数: ${report.summary.total}`);
  lines.push(`- 上游原始行: ${report.summary.rawDeviceRows}`);
  lines.push(`- 重复折叠: ${report.summary.duplicateCollapsedCount}`);
  lines.push(`- 控制页可进入: ${report.summary.controlPageReady}`);
  lines.push(`- 设备侧就绪: ${report.summary.deviceReady}`);
  lines.push(`- 单台阻断: ${report.summary.deviceBlocked}`);
  lines.push(`- 可真实下发: ${report.summary.canDispatch}`);
  lines.push(`- 通讯报警: ${report.summary.communicationAlarm}`);
  lines.push(`- 温度异常: ${report.summary.invalidTemperature}`);
  lines.push("");
  lines.push("## 逐台清单");
  lines.push("");
  lines.push("| 设备 | 温度 | 设定 | 质量 | 设备侧 | 真实下发 | 阻断原因 | 控制页 |");
  lines.push("|---|---:|---:|---|---|---|---|---|");
  for (const item of report.devices) {
    const temp = item.zoneTemperatureC === null ? "--" : `${item.zoneTemperatureC.toFixed(1)}°C`;
    const setpoint = item.setpointC === null ? "--" : `${item.setpointC.toFixed(1)}°C`;
    const reasons = item.blockedReasons.length ? item.blockedReasons.slice(0, 3).join(" / ") : "无";
    lines.push(
      `| ${item.deviceName} ${item.deviceCode} | ${temp} | ${setpoint} | ${item.qualityStatus} | ${item.deviceReady ? "就绪" : "阻断"} | ${item.canDispatch ? "允许" : "禁止"} | ${reasons} | [打开](${item.deviceUrl}) |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const snapshot = await requestJson(
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  const commissioning = await requestJson(
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  const report = buildReport(snapshot, commissioning);
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  console.log(
    `FCU_DEVICE_CONTROL_MATRIX ok=${report.ok} total=${report.summary.total} controlPageReady=${report.summary.controlPageReady} deviceReady=${report.summary.deviceReady} canDispatch=${report.summary.canDispatch}`
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
