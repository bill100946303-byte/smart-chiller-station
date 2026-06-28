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
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_FIELD_ARM_TIMEOUT_MS, 20000);
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM);
const CANARY_QUEUE_JSON =
  process.env.FCU_CANARY_QUEUE_JSON ||
  path.join(DOCS_DIR, "fcu-canary-queue-latest.json");
const PREFLIGHT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.join(DOCS_DIR, "fcu-go-live-preflight-latest.json");
const RUNBOOK_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.join(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.join(DOCS_DIR, "fcu-field-arm-check-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_ARM_CHECK_MD ||
  path.join(DOCS_DIR, "fcu-field-arm-check-latest.md");

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

function buildNextActions({ blockers, firstCanary, executionGate, nextCommand }) {
  const blockerKeys = new Set((Array.isArray(blockers) ? blockers : []).map((item) => item.key));
  const blockedReasons = Array.isArray(executionGate?.blockedReasons) ? executionGate.blockedReasons : [];
  const actions = [];
  if (blockerKeys.has("backend_write_gate") || blockedReasons.includes("backend_not_readonly")) {
    actions.push({
      priority: "P0",
      action: "关闭后端只读总闸并重启 BFF",
      target: "READ_ONLY_MODE / CHILLER_READ_ONLY_MODE",
      command: "READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev",
      reason: "当前 /healthz 显示 readOnlyMode=true，真实下发会被后端阻断。"
    });
  }
  if (blockerKeys.has("confirm_phrase_present")) {
    actions.push({
      priority: "P0",
      action: "设置真实写入确认短语",
      target: "FCU_SMALL_BATCH_CONFIRM",
      command: `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`,
      reason: "防止误触发真实 BA 写入。"
    });
  }
  if (blockerKeys.has("execution_gate_open") && blockedReasons.includes("subsystem_write_enabled")) {
    actions.push({
      priority: "P0",
      action: "打开空调末端子系统写总闸",
      target: "hvac_terminal controlBoundary.writeEnabled",
      command: "",
      reason: "子系统写边界未打开时不能向 BA 下发。"
    });
  }
  actions.push({
    priority: blockers.length > 0 ? "P1" : "P0",
    action: blockers.length > 0 ? "重跑 Arm-Check" : "执行 Canary 首台真实下发",
    target: firstCanary || "--",
    command: blockers.length > 0 ? "npm --prefix apps/chiller-bff run check:fcu-field-arm" : nextCommand,
    reason: firstCanary
      ? "只允许先执行首台 Canary；反馈通过后再扩大。"
      : "没有可用 Canary 设备时禁止真实下发。"
  });
  actions.push({
    priority: "P0",
    action: "反馈校验与失败回退",
    target: "control-record verify-feedback / rollback",
    command: "",
    reason: "真实下发后必须在 60-120 秒内校验反馈；不一致时锁定设备并回退。"
  });
  return actions;
}

function buildReport({ health, policyResponse, commissioningResponse, queueFile, preflightFile, runbookFile }) {
  const policy = policyResponse.payload?.policy || {};
  const executionGate = policyResponse.payload?.executionGate || commissioningResponse.payload?.executionGate || {};
  const commissioningSummary = commissioningResponse.payload?.summary || {};
  const queue = queueFile.payload || {};
  const preflight = preflightFile.payload || {};
  const runbook = runbookFile.payload || {};
  const checks = [];
  const firstCanary = queue.summary?.firstCanary || runbook.scope?.canaryDevice || null;
  const queueAgeMinutes = minutesSince(queue.generatedAt);
  const preflightAgeMinutes = minutesSince(preflight.generatedAt);
  const runbookAgeMinutes = minutesSince(runbook.generatedAt);

  pushCheck(checks, "bff_health", "BFF 服务在线", health.ok, "P0", health.ok ? "BFF healthz 正常。" : health.error || `BFF health failed: ${health.status}`);
  pushCheck(
    checks,
    "backend_write_gate",
    "后端写入总闸",
    health.payload?.readOnlyMode === false,
    "P0",
    health.payload?.readOnlyMode === false ? "READ_ONLY_MODE 已关闭。" : "当前 /healthz 显示 readOnlyMode=true。"
  );
  pushCheck(
    checks,
    "policy_enforced",
    "FCU 策略 enforced",
    policy.enabled === true && policy.defaultMode === "enforced",
    "P0",
    `enabled=${policy.enabled === true}, mode=${policy.defaultMode || "unknown"}`
  );
  pushCheck(
    checks,
    "adapter_configured",
    "BA 写适配器",
    Boolean(policy.dispatchAdapter && policy.dispatchAdapter !== "none" && policy.dispatchAdapter !== "shadow"),
    "P0",
    `dispatchAdapter=${policy.dispatchAdapter || "none"}`
  );
  pushCheck(
    checks,
    "whitelist_present",
    "白名单覆盖",
    Array.isArray(policy.whitelist) && policy.whitelist.length > 0,
    "P0",
    `白名单 ${Array.isArray(policy.whitelist) ? policy.whitelist.length : 0} 台。`
  );
  pushCheck(
    checks,
    "commissioning_has_ready_devices",
    "设备侧就绪",
    (commissioningSummary.deviceReady || 0) > 0,
    "P0",
    `设备侧就绪 ${commissioningSummary.deviceReady || 0}/${commissioningSummary.total || 0} 台。`
  );
  pushCheck(
    checks,
    "execution_gate_open",
    "全局投运闸门",
    executionGate.dispatchAllowed === true,
    "P0",
    executionGate.dispatchAllowed === true
      ? "executionGate.dispatchAllowed=true。"
      : `未打开：${(executionGate.blockedReasons || []).join(" / ") || "unknown"}`
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
  pushCheck(
    checks,
    "canary_queue_ready",
    "Canary 队列 ready",
    queueFile.ok && queue.ok === true && (queue.summary?.plannedDevices || 0) > 0 && Boolean(firstCanary),
    "P0",
    `队列 ${queue.summary?.plannedDevices || 0} 台，首台 ${firstCanary || "--"}。`
  );
  pushCheck(
    checks,
    "canary_feedback_rule",
    "逐台反馈规则",
    queue.summary?.requiresFeedbackBeforeNext === true,
    "P0",
    queue.summary?.requiresFeedbackBeforeNext === true ? "已要求反馈通过后进入下一台。" : "队列未声明逐台反馈闸门。"
  );
  pushCheck(
    checks,
    "preflight_recent",
    "预检报告新鲜",
    preflightFile.ok && preflightAgeMinutes !== null && preflightAgeMinutes <= 30,
    "P1",
    preflightAgeMinutes === null ? "预检报告缺少时间。" : `预检报告距今 ${preflightAgeMinutes} min。`
  );
  pushCheck(
    checks,
    "queue_recent",
    "Canary 队列新鲜",
    queueFile.ok && queueAgeMinutes !== null && queueAgeMinutes <= 30,
    "P1",
    queueAgeMinutes === null ? "队列报告缺少时间。" : `队列报告距今 ${queueAgeMinutes} min。`
  );
  pushCheck(
    checks,
    "runbook_recent",
    "Runbook 新鲜",
    runbookFile.ok && runbookAgeMinutes !== null && runbookAgeMinutes <= 30,
    "P1",
    runbookAgeMinutes === null ? "Runbook 缺少时间。" : `Runbook 距今 ${runbookAgeMinutes} min。`
  );

  const blockers = checks.filter((item) => !item.ok && item.severity === "P0");
  const warnings = checks.filter((item) => !item.ok && item.severity !== "P0");
  const nextCommand =
    firstCanary
      ? `FCU_CANARY_DEVICE_CODE=${firstCanary} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`
      : "";
  return {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    verdict: blockers.length === 0 ? "field_arm_ready" : "field_arm_blocked",
    controlMutation: false,
    firstCanary,
    confirmPhraseRequired: CONFIRM_PHRASE,
    executionGate,
    policy: {
      enabled: policy.enabled === true,
      defaultMode: policy.defaultMode || null,
      dispatchAdapter: policy.dispatchAdapter || null,
      whitelistCount: Array.isArray(policy.whitelist) ? policy.whitelist.length : 0
    },
    commissioningSummary,
    queueSummary: queue.summary || null,
    preflightVerdict: preflight.verdict || null,
    checks,
    blockingItems: blockers,
    warningItems: warnings,
    nextCommand,
    nextActions: buildNextActions({
      blockers,
      firstCanary,
      executionGate,
      nextCommand
    }),
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null
      },
      policy: {
        ok: policyResponse.ok,
        status: policyResponse.status,
        url: policyResponse.url
      },
      commissioning: {
        ok: commissioningResponse.ok,
        status: commissioningResponse.status,
        url: commissioningResponse.url
      },
      files: {
        queue: { ok: queueFile.ok, path: queueFile.path },
        preflight: { ok: preflightFile.ok, path: preflightFile.path },
        runbook: { ok: runbookFile.ok, path: runbookFile.path }
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场开闸 Arm-Check");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.ok ? "可以进入现场 Canary 真实下发" : "禁止现场真实下发"}`);
  lines.push(`- verdict: ${report.verdict}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 首台 Canary: ${report.firstCanary || "--"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 当前范围");
  lines.push("");
  lines.push(`- 策略: ${report.policy.defaultMode || "--"} / ${report.policy.dispatchAdapter || "--"} / 白名单 ${report.policy.whitelistCount} 台`);
  lines.push(`- 设备侧就绪: ${report.commissioningSummary.deviceReady || 0}/${report.commissioningSummary.total || 0}`);
  lines.push(`- Canary 队列: ${report.queueSummary?.plannedDevices || 0} 台`);
  lines.push(`- 预检: ${report.preflightVerdict || "--"}`);
  lines.push("");
  lines.push("## 检查项");
  lines.push("");
  lines.push("| 检查 | 状态 | 说明 |");
  lines.push("|---|---|---|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "通过" : check.severity} | ${check.message} |`);
  }
  lines.push("");
  if (report.blockingItems.length > 0) {
    lines.push("## P0 阻断");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  if (report.warningItems.length > 0) {
    lines.push("## 风险提示");
    lines.push("");
    for (const item of report.warningItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  lines.push("## 下一步命令");
  lines.push("");
  if (report.nextActions?.length) {
    lines.push("| 优先级 | 动作 | 对象 | 命令/处理 | 原因 |");
    lines.push("|---|---|---|---|---|");
    for (const item of report.nextActions) {
      lines.push(`| ${item.priority || "--"} | ${item.action || "--"} | ${item.target || "--"} | ${item.command ? `\`${item.command}\`` : "--"} | ${item.reason || "--"} |`);
    }
    lines.push("");
  }
  if (report.ok) {
    lines.push(`\`${report.nextCommand}\``);
    lines.push("");
    lines.push("- 执行后必须立即运行反馈校验；反馈不一致时执行回退并锁定该设备。");
  } else {
    lines.push("- 当前不允许执行真实下发命令。");
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
    queueFile: readJsonFile(CANARY_QUEUE_JSON),
    preflightFile: readJsonFile(PREFLIGHT_JSON),
    runbookFile: readJsonFile(RUNBOOK_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_FIELD_ARM_CHECK ok=${report.ok} verdict=${report.verdict} first=${report.firstCanary || "--"} blockers=${report.blockingItems.length} mutation=false`
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
