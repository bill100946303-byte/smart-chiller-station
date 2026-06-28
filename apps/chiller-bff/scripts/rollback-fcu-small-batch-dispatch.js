import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const EXECUTION_JSON =
  process.env.FCU_SMALL_BATCH_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-execution-latest.json");
const OUTPUT_JSON =
  process.env.FCU_SMALL_BATCH_ROLLBACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-rollback-latest.json");
const OUTPUT_MD =
  process.env.FCU_SMALL_BATCH_ROLLBACK_MD ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-rollback-latest.md");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_SMALL_BATCH_ROLLBACK_TIMEOUT_MS, 20000);
const CONFIRM_PHRASE = "I_UNDERSTAND_FCU_ROLLBACK_LOCKOUT";
const CONFIRM = normalizeText(process.env.FCU_SMALL_BATCH_ROLLBACK_CONFIRM);

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

function collectRollbackTargets(execution) {
  const targets = [];
  for (const device of Array.isArray(execution?.devices) ? execution.devices : []) {
    for (const result of Array.isArray(device?.results) ? device.results : []) {
      const recordId = normalizeText(result?.dispatch?.recordId);
      if (!recordId) {
        continue;
      }
      const status = normalizeText(result?.dispatch?.decisionStatus);
      const feedbackStatus = normalizeText(result?.verification?.recordStatus);
      const shouldRollback =
        status === "dispatched" &&
        (!feedbackStatus || ["feedback_pending", "feedback_mismatch_locked", "feedback_partial", "feedback_not_checkable"].includes(feedbackStatus));
      if (shouldRollback) {
        targets.push({
          deviceCode: normalizeText(device.deviceCode),
          deviceName: normalizeText(device.deviceName),
          kind: normalizeText(result.kind),
          recordId,
          status,
          feedbackStatus
        });
      }
    }
  }
  return targets;
}

async function rollbackTarget(target) {
  const response = await requestJson(
    "POST",
    `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/control-records/${encodeURIComponent(target.recordId)}/rollback`,
    {
      reason: `small batch rollback: ${target.kind} ${target.feedbackStatus || "feedback_not_confirmed"}`
    }
  );
  return {
    ...target,
    ok: response.ok,
    status: response.status,
    recordStatus: response.payload?.record?.status || null,
    rolledBackAt: response.payload?.record?.rolledBackAt || null,
    url: response.url
  };
}

function buildReport(execution, blockingItems, results = []) {
  const mutation = results.some((item) => item.ok === true);
  return {
    ok: blockingItems.length === 0 && results.length > 0 && results.every((item) => item.ok === true),
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    mode: blockingItems.length > 0 ? "blocked_before_rollback" : "rollback_requested",
    controlMutation: mutation,
    executionFile: EXECUTION_JSON,
    blockingItems,
    targets: results,
    executionSummary: {
      ok: execution?.ok ?? null,
      mode: execution?.mode || null,
      controlMutation: execution?.controlMutation ?? null
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 小批量回退结果");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 回退记录变更: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 结论: ${report.ok ? "回退完成" : "未回退或未完成"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  if (report.blockingItems.length > 0) {
    lines.push("## 阻断项");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  if (report.targets.length > 0) {
    lines.push("## 回退目标");
    lines.push("");
    for (const item of report.targets) {
      lines.push(`- ${item.deviceCode} ${item.kind} ${item.recordId}: ${item.recordStatus || item.status}`);
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
  const execution = readJsonFile(EXECUTION_JSON);
  const targets = collectRollbackTargets(execution);
  const blockingItems = [];
  if (execution?.error) {
    blockingItems.push({
      key: "execution_report_unavailable",
      message: execution.error
    });
  }
  if (CONFIRM !== CONFIRM_PHRASE) {
    blockingItems.push({
      key: "confirm_phrase_missing",
      message: `必须设置 FCU_SMALL_BATCH_ROLLBACK_CONFIRM=${CONFIRM_PHRASE} 才允许回退记录。`
    });
  }
  if (targets.length === 0) {
    blockingItems.push({
      key: "no_rollback_targets",
      message: "执行报告中没有需要回退的真实下发记录。"
    });
  }
  if (blockingItems.length > 0) {
    const report = buildReport(execution, blockingItems, []);
    writeReport(report);
    console.log(`FCU_SMALL_BATCH_ROLLBACK ok=false mode=blocked_before_rollback targets=0 mutation=false blocking=${blockingItems.length}`);
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    process.exitCode = 2;
    return;
  }
  const results = [];
  for (const target of targets) {
    results.push(await rollbackTarget(target));
  }
  const report = buildReport(execution, [], results);
  writeReport(report);
  console.log(`FCU_SMALL_BATCH_ROLLBACK ok=${report.ok} mode=rollback_requested targets=${results.length} mutation=${report.controlMutation}`);
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
