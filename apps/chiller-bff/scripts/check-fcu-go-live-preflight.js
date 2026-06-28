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
const PLAN_JSON =
  process.env.FCU_SMALL_BATCH_PLAN_JSON ||
  path.join(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json");
const MATRIX_JSON =
  process.env.FCU_DEVICE_CONTROL_MATRIX_JSON ||
  path.join(DOCS_DIR, "fcu-device-control-matrix-latest.json");
const ALL_DEVICE_POLICY_JSON = path.join(DOCS_DIR, "fcu-all-device-policy-latest.json");
const SMALL_BATCH_POLICY_JSON = path.join(DOCS_DIR, "fcu-small-batch-policy-latest.json");
const POLICY_JSON =
  process.env.FCU_POLICY_JSON ||
  process.env.FCU_SMALL_BATCH_POLICY_JSON ||
  (fs.existsSync(ALL_DEVICE_POLICY_JSON) ? ALL_DEVICE_POLICY_JSON : SMALL_BATCH_POLICY_JSON);
const OUTPUT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.join(DOCS_DIR, "fcu-go-live-preflight-latest.json");
const OUTPUT_MD =
  process.env.FCU_GO_LIVE_PREFLIGHT_MD ||
  path.join(DOCS_DIR, "fcu-go-live-preflight-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_GO_LIVE_PREFLIGHT_TIMEOUT_MS, 20000);
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM);
const MAX_PLAN_AGE_MINUTES = normalizeInteger(process.env.FCU_GO_LIVE_MAX_PLAN_AGE_MINUTES, 30);

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
    return {
      ok: true,
      path: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      error: error instanceof Error ? error.message : "read json failed"
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

function minutesSince(isoText) {
  const timestamp = Date.parse(String(isoText || ""));
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function unique(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean))];
}

function plannedDeviceCodes(plan) {
  return unique((Array.isArray(plan?.devices) ? plan.devices : []).map((item) => item.deviceCode));
}

function readyPlanDeviceCodes(plan) {
  return unique(
    (Array.isArray(plan?.devices) ? plan.devices : [])
      .filter((item) =>
        item?.previews?.setpoint?.decisionStatus === "ready" ||
        item?.previews?.fanSpeed?.decisionStatus === "ready"
      )
      .map((item) => item.deviceCode)
  );
}

function commandCount(plan) {
  return (Array.isArray(plan?.devices) ? plan.devices : []).reduce((total, item) => {
    const setpointReady = item?.previews?.setpoint?.decisionStatus === "ready" ? item?.previews?.setpoint?.commandCount || 0 : 0;
    const fanReady = item?.previews?.fanSpeed?.decisionStatus === "ready" ? item?.previews?.fanSpeed?.commandCount || 0 : 0;
    return total + setpointReady + fanReady;
  }, 0);
}

function pushCheck(checks, key, label, ok, severity, message, detail = {}) {
  checks.push({
    key,
    label,
    ok: ok === true,
    severity,
    message,
    ...detail
  });
}

function buildReport({ health, policyResponse, commissioningResponse, policyFile, matrixFile, planFile }) {
  const livePolicy = policyResponse.payload?.policy || {};
  const executionGate = policyResponse.payload?.executionGate || commissioningResponse.payload?.executionGate || {};
  const policy = policyFile.payload || {};
  const matrix = matrixFile.payload || {};
  const plan = planFile.payload || {};
  const filePolicy = policy.after || {};
  const whitelist = unique(livePolicy.whitelist || filePolicy.whitelist || []);
  const planned = plannedDeviceCodes(plan);
  const previewReady = readyPlanDeviceCodes(plan);
  const unexpectedPlanned = planned.filter((code) => !whitelist.includes(code));
  const missingWhitelistInPlan = whitelist.filter((code) => !planned.includes(code));
  const planAgeMinutes = minutesSince(plan.generatedAt);
  const checks = [];

  pushCheck(checks, "bff_health", "BFF 服务可用", health.ok, "P0", health.ok ? "BFF healthz 正常。" : health.error || `BFF healthz failed: ${health.status}`);
  pushCheck(
    checks,
    "policy_enforced",
    "策略进入 enforced",
    livePolicy.defaultMode === "enforced",
    "P0",
    livePolicy.defaultMode === "enforced" ? "FCU 策略已进入 enforced。" : `当前策略模式为 ${livePolicy.defaultMode || "unknown"}。`
  );
  pushCheck(
    checks,
    "adapter_configured",
    "BA 写适配器已配置",
    Boolean(livePolicy.dispatchAdapter && livePolicy.dispatchAdapter !== "none" && livePolicy.dispatchAdapter !== "shadow"),
    "P0",
    `当前适配器: ${livePolicy.dispatchAdapter || "none"}`
  );
  pushCheck(checks, "whitelist_available", "白名单已配置", whitelist.length > 0, "P0", `当前白名单 ${whitelist.length} 台。`, { whitelist });
  pushCheck(
    checks,
    "matrix_route_covers_whitelist",
    "逐台控制页覆盖白名单",
    matrix.summary?.controlPageReady === whitelist.length,
    "P1",
    `逐台控制页 ${matrix.summary?.controlPageReady ?? 0} 台，白名单 ${whitelist.length} 台，设备侧就绪 ${matrix.summary?.deviceReady ?? 0} 台。`
  );
  pushCheck(
    checks,
    "upstream_duplicate_rows_collapsed",
    "上游重复设备行已折叠",
    (matrix.summary?.duplicateCollapsedCount || 0) === 0,
    "P1",
    `上游原始行 ${matrix.summary?.rawDeviceRows ?? matrix.summary?.total ?? 0}，折叠重复 ${matrix.summary?.duplicateCollapsedCount || 0}。`
  );
  pushCheck(
    checks,
    "plan_recent",
    "执行单新鲜",
    planAgeMinutes !== null && planAgeMinutes <= MAX_PLAN_AGE_MINUTES,
    "P0",
    planAgeMinutes === null ? "执行单缺少生成时间。" : `执行单距今 ${planAgeMinutes} min，阈值 ${MAX_PLAN_AGE_MINUTES} min。`
  );
  pushCheck(
    checks,
    "plan_within_whitelist",
    "执行单属于白名单子集",
    planned.length > 0 && unexpectedPlanned.length === 0,
    "P0",
    `计划设备: ${planned.join(", ") || "无"}。`,
    { unexpectedPlanned, missingWhitelistInPlan }
  );
  pushCheck(checks, "preview_ready", "预演命令 ready", previewReady.length === planned.length && commandCount(plan) > 0, "P0", `预演 ready 设备 ${previewReady.length}/${planned.length}，命令 ${commandCount(plan)} 条。`);
  pushCheck(
    checks,
    "execution_gate_open",
    "全局真实下发闸门打开",
    executionGate.dispatchAllowed === true,
    "P0",
    executionGate.dispatchAllowed === true
      ? "全局投运闸门已打开。"
      : `全局投运闸门未打开：${(executionGate.blockedReasons || []).join(" / ") || "unknown"}`
  );
  pushCheck(
    checks,
    "confirm_phrase_present",
    "真实写入确认短语",
    CONFIRM === CONFIRM_PHRASE,
    "P0",
    CONFIRM === CONFIRM_PHRASE
      ? "确认短语已设置。"
      : `必须设置 FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}。`
  );

  const blockers = checks.filter((item) => !item.ok && item.severity === "P0");
  const warnings = checks.filter((item) => !item.ok && item.severity !== "P0");
  return {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    verdict: blockers.length === 0 ? "go_live_ready" : "go_live_blocked",
    controlMutation: false,
    plannedDevices: planned,
    whitelist,
    previewReadyDevices: previewReady,
    commandCount: commandCount(plan),
    executionGate,
    checks,
    blockingItems: blockers,
    warningItems: warnings,
    evidence: {
      health: { ok: health.ok, status: health.status, url: health.url, readOnlyMode: health.payload?.readOnlyMode ?? null },
      policy: { ok: policyResponse.ok, status: policyResponse.status, url: policyResponse.url },
      commissioning: { ok: commissioningResponse.ok, status: commissioningResponse.status, url: commissioningResponse.url },
      files: {
        policy: { ok: policyFile.ok, path: policyFile.path },
        matrix: { ok: matrixFile.ok, path: matrixFile.path },
        plan: { ok: planFile.ok, path: planFile.path }
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 真实下发上线前预检");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.ok ? "可以进入真实小批量下发" : "禁止真实下发"}`);
  lines.push(`- verdict: ${report.verdict}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 范围");
  lines.push("");
  lines.push(`- 白名单: ${report.whitelist.join(", ") || "无"}`);
  lines.push(`- 执行单设备: ${report.plannedDevices.join(", ") || "无"}`);
  lines.push(`- 预演 ready: ${report.previewReadyDevices.join(", ") || "无"}`);
  lines.push(`- 命令数: ${report.commandCount}`);
  lines.push("");
  lines.push("## 检查项");
  lines.push("");
  lines.push("| 检查 | 状态 | 说明 |");
  lines.push("|---|---|---|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "通过" : check.severity} | ${check.message} |`);
  }
  lines.push("");
  lines.push("## 结论");
  lines.push("");
  if (report.ok) {
    lines.push("- 所有 P0 条件满足，可以执行 `npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch`。");
  } else {
    for (const item of report.blockingItems) {
      lines.push(`- ${item.severity} ${item.key}: ${item.message}`);
    }
  }
  if (report.warningItems.length > 0) {
    lines.push("");
    lines.push("## 风险提示");
    lines.push("");
    for (const item of report.warningItems) {
      lines.push(`- ${item.severity} ${item.key}: ${item.message}`);
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
  const [health, policyResponse, commissioningResponse] = await Promise.all([
    requestJson("/healthz"),
    requestJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-policy`),
    requestJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`)
  ]);
  const report = buildReport({
    health,
    policyResponse,
    commissioningResponse,
    policyFile: readJsonFile(POLICY_JSON),
    matrixFile: readJsonFile(MATRIX_JSON),
    planFile: readJsonFile(PLAN_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_GO_LIVE_PREFLIGHT ok=${report.ok} verdict=${report.verdict} whitelist=${report.whitelist.join(",")} planned=${report.plannedDevices.join(",")} blockers=${report.blockingItems.length} mutation=false`
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
