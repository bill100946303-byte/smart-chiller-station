import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { buildDefaultFcuControlPolicy, normalizeFcuControlPolicy } from "../src/services/fcuControlService.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const SITE_ID = normalizeText(readCliOption("site-id") || process.env.SITE_ID) || "126lnoffice";
const BUILD = normalizeText(readCliOption("build") || process.env.FCU_BUILD) || "1";
const FLOOR = normalizeText(readCliOption("floor") || process.env.FCU_FLOOR) || "1";
const MODE = normalizeMode(readCliOption("mode") || process.env.FCU_ALL_DEVICE_MODE || "enforced");
const DISPATCH_ADAPTER = normalizeText(readCliOption("dispatch-adapter") || process.env.FCU_DISPATCH_ADAPTER) || "legacy-scene-command";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_ALL_DEVICE_TIMEOUT_MS, 20000);
const OUTPUT_JSON =
  process.env.FCU_ALL_DEVICE_POLICY_JSON ||
  path.join(DOCS_DIR, "fcu-all-device-policy-latest.json");
const OUTPUT_MD =
  process.env.FCU_ALL_DEVICE_POLICY_MD ||
  path.join(DOCS_DIR, "fcu-all-device-policy-latest.md");

function readCliOption(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

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

function normalizeMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["shadow", "assisted", "enforced"].includes(normalized) ? normalized : "enforced";
}

function uniqueTextList(items) {
  const seen = new Set();
  const values = [];
  for (const item of Array.isArray(items) ? items : []) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    values.push(text);
  }
  return values;
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

function readDeviceCode(item) {
  return normalizeText(item?.deviceCode || item?.deviceId || item?.deviceName);
}

function discoverDeviceCodes(snapshot) {
  return uniqueTextList((Array.isArray(snapshot?.items) ? snapshot.items : []).map(readDeviceCode));
}

function buildNextPolicy(existingPolicy, deviceCodes) {
  const base = normalizeFcuControlPolicy(existingPolicy || buildDefaultFcuControlPolicy());
  return normalizeFcuControlPolicy({
    ...base,
    enabled: true,
    defaultMode: MODE,
    dispatchAdapter: DISPATCH_ADAPTER,
    whitelist: deviceCodes,
    allowSetpoint: true,
    allowFanSpeed: true,
    allowStartStop: true,
    occupied: true
  });
}

function summarizeCommissioning(payload) {
  const summary = payload?.summary || {};
  return {
    total: summary.total ?? 0,
    ready: summary.ready ?? 0,
    environmentBlocked: summary.environmentBlocked ?? 0,
    deviceBlocked: summary.deviceBlocked ?? 0,
    notFound: summary.notFound ?? 0,
    deviceReady: summary.deviceReady ?? 0,
    canDispatch: summary.canDispatch ?? 0,
    dispatchAllowed: payload?.executionGate?.dispatchAllowed === true
  };
}

function buildReport({ dbFile, before, after, snapshotResponse, commissioningResponse, deviceCodes }) {
  const beforePolicy = normalizeFcuControlPolicy(before || buildDefaultFcuControlPolicy());
  const snapshot = snapshotResponse.payload || {};
  const commissioning = commissioningResponse.payload || {};
  const rawDeviceRows = snapshot.summary?.rawDeviceRows ?? deviceCodes.length;
  const duplicateCollapsedCount = snapshot.summary?.duplicateCollapsedCount ?? 0;
  const commissioningSummary = summarizeCommissioning(commissioning);
  return {
    ok: snapshotResponse.ok && deviceCodes.length > 0 && after?.whitelist?.length === deviceCodes.length,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    dbFile,
    bffBaseUrl: BFF_BASE_URL,
    controlMutation: false,
    adminConfigMutation: true,
    note: "从当前 FCU 快照发现所有设备并写入控制策略白名单；不执行 BA/PLC 写入。",
    before: {
      enabled: beforePolicy.enabled,
      defaultMode: beforePolicy.defaultMode,
      dispatchAdapter: beforePolicy.dispatchAdapter,
      whitelistCount: beforePolicy.whitelist.length,
      whitelist: beforePolicy.whitelist
    },
    after: {
      enabled: after.enabled,
      defaultMode: after.defaultMode,
      dispatchAdapter: after.dispatchAdapter,
      whitelistCount: after.whitelist.length,
      whitelist: after.whitelist,
      allowSetpoint: after.allowSetpoint,
      allowFanSpeed: after.allowFanSpeed,
      allowStartStop: after.allowStartStop,
      targetLowC: after.targetLowC,
      targetHighC: after.targetHighC,
      minSetpointC: after.minSetpointC,
      maxSetpointC: after.maxSetpointC,
      setpointStepC: after.setpointStepC,
      setpointDwellMinutes: after.setpointDwellMinutes,
      startStopDwellMinutes: after.startStopDwellMinutes,
      feedbackTimeoutSeconds: after.feedbackTimeoutSeconds,
      rollbackLockoutMinutes: after.rollbackLockoutMinutes
    },
    discovery: {
      rawDeviceRows,
      duplicateCollapsedCount,
      uniqueDeviceCount: deviceCodes.length,
      deviceCodes
    },
    commissioning: commissioningSummary,
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
    },
    nextChecks: [
      "npm --prefix apps/chiller-bff run check:fcu-device-control-matrix",
      "FCU_SMALL_BATCH_LIMIT=30 npm --prefix apps/chiller-bff run plan:fcu-small-batch-dispatch",
      "npm --prefix apps/chiller-bff run check:fcu-go-live-preflight",
      "npm --prefix apps/chiller-bff run build:fcu-final-control-runbook"
    ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 全量单台控制策略");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.ok ? "已覆盖当前快照全部 FCU" : "全量策略未完成"}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 配置变更: ${report.adminConfigMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 策略变化");
  lines.push("");
  lines.push(`- 原模式: ${report.before.defaultMode} / 原白名单: ${report.before.whitelistCount} 台`);
  lines.push(`- 新模式: ${report.after.defaultMode} / 新白名单: ${report.after.whitelistCount} 台`);
  lines.push(`- BA 写适配器: ${report.after.dispatchAdapter}`);
  lines.push(`- 全量设备: ${report.after.whitelist.join(", ") || "无"}`);
  lines.push("");
  lines.push("## 发现与投运状态");
  lines.push("");
  lines.push(`- 上游原始行: ${report.discovery.rawDeviceRows}`);
  lines.push(`- 重复折叠: ${report.discovery.duplicateCollapsedCount}`);
  lines.push(`- 唯一 FCU: ${report.discovery.uniqueDeviceCount}`);
  lines.push(`- 设备侧就绪: ${report.commissioning.deviceReady}`);
  lines.push(`- 单台阻断: ${report.commissioning.deviceBlocked}`);
  lines.push(`- 环境阻断: ${report.commissioning.environmentBlocked}`);
  lines.push(`- 可真实下发: ${report.commissioning.canDispatch}`);
  lines.push(`- 全局真实下发: ${report.commissioning.dispatchAllowed ? "允许" : "未允许"}`);
  lines.push("");
  lines.push("## 保护参数");
  lines.push("");
  lines.push(`- 舒适区间: ${report.after.targetLowC}-${report.after.targetHighC}°C`);
  lines.push(`- 设定范围: ${report.after.minSetpointC}-${report.after.maxSetpointC}°C`);
  lines.push(`- 设定步长: ${report.after.setpointStepC}°C`);
  lines.push(`- 设定保持: ${report.after.setpointDwellMinutes} min`);
  lines.push(`- 启停保持: ${report.after.startStopDwellMinutes} min`);
  lines.push(`- 反馈超时: ${report.after.feedbackTimeoutSeconds} s`);
  lines.push(`- 回退锁定: ${report.after.rollbackLockoutMinutes} min`);
  lines.push("");
  lines.push("## 下一步检查");
  lines.push("");
  for (const item of report.nextChecks) {
    lines.push(`- \`${item}\``);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const snapshotResponse = await requestJson(
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  if (!snapshotResponse.ok) {
    throw new Error(`Unable to discover FCU devices from BFF: ${snapshotResponse.status} ${snapshotResponse.error || ""}`.trim());
  }
  const deviceCodes = discoverDeviceCodes(snapshotResponse.payload);
  if (deviceCodes.length === 0) {
    throw new Error("No FCU device code was discovered from the current snapshot.");
  }

  const dbFile = path.resolve(process.cwd(), appConfig.adminDbFile);
  const adminStore = createAdminStore({
    dbFile
  });
  try {
    const existing = adminStore.getFcuControlPolicy(SITE_ID);
    const before = existing?.policy || null;
    const nextPolicy = buildNextPolicy(before, deviceCodes);
    const record = adminStore.upsertFcuControlPolicy(
      SITE_ID,
      nextPolicy,
      {
        userId: "system:fcu-all-device-policy",
        username: "FCU All Device Policy"
      },
      {
        requestId: `script-${Date.now()}`
      }
    );
    const after = normalizeFcuControlPolicy(record?.policy || nextPolicy);
    const commissioningResponse = await requestJson(
      `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
    );
    const report = buildReport({
      dbFile,
      before,
      after,
      snapshotResponse,
      commissioningResponse,
      deviceCodes
    });
    ensureParentDir(OUTPUT_JSON);
    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
    ensureParentDir(OUTPUT_MD);
    fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
    console.log(
      `FCU_ALL_DEVICE_POLICY ok=${report.ok} mode=${report.after.defaultMode} whitelist=${report.after.whitelistCount} mutation=false`
    );
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    if (!report.ok) {
      process.exitCode = 2;
    }
  } finally {
    adminStore.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
