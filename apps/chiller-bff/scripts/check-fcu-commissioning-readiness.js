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
const OUTPUT_JSON =
  process.env.FCU_COMMISSIONING_READINESS_JSON ||
  path.join(DOCS_DIR, "fcu-commissioning-readiness-latest.json");
const OUTPUT_MD =
  process.env.FCU_COMMISSIONING_READINESS_MD ||
  path.join(DOCS_DIR, "fcu-commissioning-readiness-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_COMMISSIONING_READINESS_TIMEOUT_MS, 20000);

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

function buildReadinessReport(health, commissioning) {
  const payload = commissioning.payload || {};
  const summary = payload.summary || {};
  const report = payload.report || {};
  const executionGate = payload.executionGate || {};
  const ready = commissioning.ok && summary.total > 0 && summary.canDispatch > 0 && summary.canDispatch === summary.deviceReady;
  const blockingItems = [];
  if (!health.ok) {
    blockingItems.push({
      key: "bff_unavailable",
      severity: "P0",
      message: health.error || `BFF health check failed with status ${health.status}`
    });
  }
  if (!commissioning.ok) {
    blockingItems.push({
      key: "commissioning_unavailable",
      severity: "P0",
      message: commissioning.error || `Commissioning endpoint failed with status ${commissioning.status}`
    });
  }
  if ((summary.total || 0) <= 0) {
    blockingItems.push({
      key: "no_fcu_devices",
      severity: "P0",
      message: "未读取到 FCU 设备，不能进入投运。"
    });
  }
  if ((summary.deviceBlocked || 0) > 0) {
    blockingItems.push({
      key: "device_blocked",
      severity: "P0",
      message: `${summary.deviceBlocked} 台 FCU 存在单台通讯、温度、写点或反馈锁定阻断。`,
      deviceCodes: report.blockedDeviceCodes || []
    });
  }
  if (executionGate.dispatchAllowed !== true) {
    blockingItems.push({
      key: "global_execution_gate",
      severity: "P0",
      message: `全局投运闸门未打开：${(executionGate.blockedReasons || []).join(" / ") || "unknown"}`,
      blockedReasons: executionGate.blockedReasons || []
    });
  }
  return {
    ok: ready,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    verdict: ready ? "ready_for_small_batch_dispatch" : report.verdict || "blocked",
    summary,
    executionGate,
    report,
    blockingItems,
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null,
        appMode: health.payload?.appMode ?? null
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

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 投运门禁检查");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.ok ? "可进入小批量真实下发" : "不可进入真实下发"}`);
  lines.push(`- verdict: ${report.verdict}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- 总 FCU: ${report.summary.total ?? 0}`);
  lines.push(`- 设备侧就绪: ${report.summary.deviceReady ?? 0}`);
  lines.push(`- 单台阻断: ${report.summary.deviceBlocked ?? 0}`);
  lines.push(`- 可真实下发: ${report.summary.canDispatch ?? 0}`);
  lines.push("");
  lines.push("## 阻断项");
  lines.push("");
  if (report.blockingItems.length === 0) {
    lines.push("- 无");
  } else {
    for (const item of report.blockingItems) {
      lines.push(`- ${item.severity} ${item.key}: ${item.message}`);
      if (Array.isArray(item.deviceCodes) && item.deviceCodes.length > 0) {
        lines.push(`  - 设备: ${item.deviceCodes.join(", ")}`);
      }
    }
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  for (const action of report.report.nextActions || []) {
    lines.push(`- ${action.priority || "P2"} ${action.action || "待处理"}: ${action.target || ""} ${action.reason || ""}`.trim());
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const health = await requestJson("/healthz");
  const commissioning = await requestJson(
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`
  );
  const report = buildReadinessReport(health, commissioning);
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  console.log(
    `FCU_COMMISSIONING_READINESS ok=${report.ok} verdict=${report.verdict} total=${report.summary.total || 0} deviceReady=${report.summary.deviceReady || 0} canDispatch=${report.summary.canDispatch || 0} blocking=${report.blockingItems.length}`
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
