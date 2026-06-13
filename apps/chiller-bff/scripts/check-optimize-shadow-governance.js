import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");

const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const SITE_CODE = normalizeText(process.env.B25_SITE_CODE) || "btwentyfive";
const DATABASE_KEY = normalizeText(process.env.B25_DATABASE_KEY) || "140btwentyfive";
const PROJECT_KEY = normalizeText(process.env.B25_PROJECT_KEY) || "126lnoffice";
const PROJECT_TEMPLATE = normalizeText(process.env.B25_PROJECT_TEMPLATE) || "1";
const EXPECTED_TOWER_EXECUTION_ID = normalizeText(process.env.EXPECTED_TOWER_EXECUTION_ID);
const EXPECTED_PUMP_EXECUTION_ID = normalizeText(process.env.EXPECTED_PUMP_EXECUTION_ID);
const EXPECTED_TOWER_TARGET_TCWS_C = normalizeNumber(process.env.EXPECTED_TOWER_TARGET_TCWS_C, 28);
const EXPECTED_TOWER_GUARDRAIL_C = normalizeNumber(process.env.EXPECTED_TOWER_GUARDRAIL_C, 30);
const EXPECTED_PUMP_CHWP_TRIM_HZ = normalizeNumber(process.env.EXPECTED_PUMP_CHWP_TRIM_HZ, -1);
const EXPECTED_PUMP_CWP_TRIM_HZ = normalizeNumber(process.env.EXPECTED_PUMP_CWP_TRIM_HZ, 0);
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.OPTIMIZE_SHADOW_GOVERNANCE_TIMEOUT_MS, 15000);
const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.OPTIMIZE_SHADOW_GOVERNANCE_STRICT || "").trim().toLowerCase()
);
const OUTPUT_JSON =
  process.env.OPTIMIZE_SHADOW_GOVERNANCE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-shadow-governance-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_SHADOW_GOVERNANCE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-shadow-governance-latest.md");

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
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

function buildHeaders(extra = {}) {
  return {
    "x-chiller-site-id": SITE_ID,
    "x-chiller-site-code": SITE_CODE,
    "x-chiller-project-database-key": DATABASE_KEY,
    "x-chiller-project-key": PROJECT_KEY,
    "x-chiller-project-template": PROJECT_TEMPLATE,
    ...extra
  };
}

function requestJson(method, routePath) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers: buildHeaders()
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
            payload: parseJsonSafely(raw),
            error: status >= 200 && status < 300 ? null : `HTTP ${status}`
          });
        });
      }
    );

    req.on("error", (error) => {
      resolve({
        ok: false,
        status: null,
        url: target.toString(),
        payload: null,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.end();
  });
}

function pushUnique(target, message) {
  const normalized = normalizeText(message);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function numberMatches(actual, expected, tolerance = 0.05) {
  if (actual === null || expected === null) {
    return false;
  }
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function hasTimelineAction(record, action) {
  return Array.isArray(record?.timeline) && record.timeline.some((item) => normalizeText(item?.action) === action);
}

function validatePendingTower(record) {
  const blockers = [];
  const warnings = [];
  if (!record) {
    pushUnique(blockers, "缺 tower-approach 执行单，无法证明塔侧 shadow 待审状态。");
    return { status: "missing", blockers, warnings };
  }

  if (EXPECTED_TOWER_EXECUTION_ID && record.executionId !== EXPECTED_TOWER_EXECUTION_ID) {
    pushUnique(blockers, `最新 tower 执行单不是预期单号：${record.executionId || "--"}`);
  }
  if (record.status !== "pending_approval") {
    pushUnique(blockers, `tower 执行单状态不是 pending_approval：${record.status || "--"}`);
  }
  if (record.approval?.status !== "pending") {
    pushUnique(blockers, `tower 审批状态不是 pending：${record.approval?.status || "--"}`);
  }
  if (record.execution?.dispatch) {
    pushUnique(blockers, "tower 执行单已出现 dispatch 字段，不能作为未下发待审证据。");
  }
  for (const action of ["approved", "dispatched", "rolled_back"]) {
    if (hasTimelineAction(record, action)) {
      pushUnique(blockers, `tower timeline 已出现 ${action}，不再是纯待审单。`);
    }
  }
  if (!numberMatches(record.execution?.targetTcwsC ?? null, EXPECTED_TOWER_TARGET_TCWS_C)) {
    pushUnique(blockers, `tower 本次目标 Tcws 不是 ${EXPECTED_TOWER_TARGET_TCWS_C}℃。`);
  }
  if (!numberMatches(record.execution?.guardrailSnapshot?.value ?? null, EXPECTED_TOWER_GUARDRAIL_C)) {
    pushUnique(blockers, `tower guardrail 不是 ${EXPECTED_TOWER_GUARDRAIL_C}℃。`);
  }
  if (record.execution?.rollbackTarget?.targetTcwsC === null || record.execution?.rollbackTarget?.targetTcwsC === undefined) {
    pushUnique(blockers, "tower 缺回退目标 Tcws。");
  }
  if (!Array.isArray(record.execution?.actions) || !record.execution.actions.some((item) => String(item).includes("不写 PLC"))) {
    pushUnique(warnings, "tower actions 未显式写明“不写 PLC”。");
  }

  return {
    status: blockers.length === 0 ? "go_shadow_pending" : "blocked",
    blockers,
    warnings
  };
}

function validatePendingPump(record) {
  const blockers = [];
  const warnings = [];
  if (!record) {
    pushUnique(blockers, "缺 pump-delta-t 执行单，无法证明泵侧 shadow 待审状态。");
    return { status: "missing", blockers, warnings };
  }

  if (EXPECTED_PUMP_EXECUTION_ID && record.executionId !== EXPECTED_PUMP_EXECUTION_ID) {
    pushUnique(blockers, `最新 pump 执行单不是预期单号：${record.executionId || "--"}`);
  }
  if (record.status !== "pending_approval") {
    pushUnique(blockers, `pump 执行单状态不是 pending_approval：${record.status || "--"}`);
  }
  if (record.approval?.status !== "pending") {
    pushUnique(blockers, `pump 审批状态不是 pending：${record.approval?.status || "--"}`);
  }
  if (record.execution?.dispatch) {
    pushUnique(blockers, "pump 执行单已出现 dispatch 字段，不能作为未下发待审证据。");
  }
  for (const action of ["approved", "dispatched", "rolled_back"]) {
    if (hasTimelineAction(record, action)) {
      pushUnique(blockers, `pump timeline 已出现 ${action}，不再是纯待审单。`);
    }
  }
  if (!numberMatches(record.execution?.targetChwpFreqTrimHz ?? null, EXPECTED_PUMP_CHWP_TRIM_HZ)) {
    pushUnique(blockers, `pump 冷冻泵修正不是 ${EXPECTED_PUMP_CHWP_TRIM_HZ}Hz。`);
  }
  if (!numberMatches(record.execution?.targetCwpFreqTrimHz ?? null, EXPECTED_PUMP_CWP_TRIM_HZ)) {
    pushUnique(blockers, `pump 冷却泵修正不是 ${EXPECTED_PUMP_CWP_TRIM_HZ}Hz。`);
  }
  if (!record.execution?.rollbackTarget) {
    pushUnique(blockers, "pump 缺回退目标。");
  }
  if (!record.execution?.targetPoints?.chilledPump || !record.execution?.targetPoints?.coolingPump) {
    pushUnique(warnings, "pump targetPoints 未同时包含冷冻泵与冷却泵影子点。");
  }

  return {
    status: blockers.length === 0 ? "go_shadow_pending" : "blocked",
    blockers,
    warnings
  };
}

function summarizeExecution(record) {
  if (!record) {
    return null;
  }
  return {
    executionId: record.executionId || null,
    status: record.status || null,
    approvalStatus: record.approval?.status || null,
    title: record.execution?.title || null,
    type: record.execution?.type || null,
    targetTcwsC: record.execution?.targetTcwsC ?? null,
    targetApproachC: record.execution?.targetApproachC ?? null,
    targetChwpFreqTrimHz: record.execution?.targetChwpFreqTrimHz ?? null,
    targetCwpFreqTrimHz: record.execution?.targetCwpFreqTrimHz ?? null,
    guardrailSnapshot: record.execution?.guardrailSnapshot || null,
    rollbackTarget: record.execution?.rollbackTarget || null,
    dispatch: record.execution?.dispatch || null,
    timeline: Array.isArray(record.timeline) ? record.timeline : []
  };
}

function renderMarkdown(report) {
  const tower = report.tower.latestExecution;
  const pump = report.pump.latestExecution;
  const blockers = report.blockers.length ? report.blockers : ["无"];
  const warnings = report.warnings.length ? report.warnings : ["无"];
  return `# Optimize Shadow Governance 检查

- 结论：${report.finalDecision}
- 站点：${report.site.siteId}
- 生成时间：${report.generatedAt}
- BFF：${report.bffBaseUrl}

## 最新 Tower 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | ${tower?.executionId || "--"} |
| status | ${tower?.status || "--"} |
| approval | ${tower?.approvalStatus || "--"} |
| target Tcws | ${tower?.targetTcwsC ?? "--"}℃ |
| guardrail | ${tower?.guardrailSnapshot?.value ?? "--"}℃ |
| dispatch | ${tower?.dispatch ? "present" : "none"} |
| timeline | ${(tower?.timeline || []).map((item) => item.action).join(", ") || "--"} |

## 最新 Pump 待审单

| 项目 | 数值 |
| --- | --- |
| executionId | ${pump?.executionId || "--"} |
| status | ${pump?.status || "--"} |
| approval | ${pump?.approvalStatus || "--"} |
| CHWP trim | ${pump?.targetChwpFreqTrimHz ?? "--"} Hz |
| CWP trim | ${pump?.targetCwpFreqTrimHz ?? "--"} Hz |
| dispatch | ${pump?.dispatch ? "present" : "none"} |
| timeline | ${(pump?.timeline || []).map((item) => item.action).join(", ") || "--"} |

## 阻断项

${blockers.map((item) => `- ${item}`).join("\n")}

## 风险与提示

${warnings.map((item) => `- ${item}`).join("\n")}

## 结论口径

- 该检查只读，只证明当前 shadow 演示治理状态。
- 若结论不是 GO_SHADOW_PENDING，不应继续做 UI 演示或人工审批。
- 本检查不批准、不写入、不回退任何执行单。
`;
}

async function main() {
  const [health, towerList, pumpList] = await Promise.all([
    requestJson("GET", "/healthz"),
    requestJson("GET", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/tower-approach/executions?limit=5`),
    requestJson("GET", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/executions?type=pump-delta-t&limit=5`)
  ]);

  const blockers = [];
  const warnings = [];
  if (!health.ok || health.payload?.ok !== true) {
    pushUnique(blockers, `BFF healthz 失败：${health.error || health.status || "unknown"}`);
  }
  if (!towerList.ok) {
    pushUnique(blockers, `tower execution list 失败：${towerList.error || towerList.status || "unknown"}`);
  }
  if (!pumpList.ok) {
    pushUnique(blockers, `pump execution list 失败：${pumpList.error || pumpList.status || "unknown"}`);
  }

  const towerItems = Array.isArray(towerList.payload?.items) ? towerList.payload.items : [];
  const pumpItems = Array.isArray(pumpList.payload?.items) ? pumpList.payload.items : [];
  const latestTower = towerItems[0] || null;
  const latestPump = pumpItems[0] || null;
  const towerValidation = validatePendingTower(latestTower);
  const pumpValidation = validatePendingPump(latestPump);
  towerValidation.blockers.forEach((item) => pushUnique(blockers, item));
  towerValidation.warnings.forEach((item) => pushUnique(warnings, item));
  pumpValidation.blockers.forEach((item) => pushUnique(blockers, item));
  pumpValidation.warnings.forEach((item) => pushUnique(warnings, item));

  const olderApprovedTower = towerItems.slice(1).find((item) => item?.status === "approved");
  if (olderApprovedTower) {
    pushUnique(warnings, `存在历史已批准 tower shadow 旧记录：${olderApprovedTower.executionId}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    site: {
      siteId: SITE_ID,
      siteCode: SITE_CODE,
      databaseKey: DATABASE_KEY,
      projectKey: PROJECT_KEY,
      template: PROJECT_TEMPLATE
    },
    bffBaseUrl: BFF_BASE_URL,
    finalDecision: blockers.length === 0 ? "GO_SHADOW_PENDING" : "NO_GO",
    health: {
      ok: health.ok,
      payload: health.payload || null
    },
    tower: {
      validationStatus: towerValidation.status,
      total: towerList.payload?.total ?? towerItems.length,
      latestExecution: summarizeExecution(latestTower)
    },
    pump: {
      validationStatus: pumpValidation.status,
      total: pumpList.payload?.total ?? pumpItems.length,
      latestExecution: summarizeExecution(latestPump)
    },
    blockers,
    warnings
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));

  console.log(`optimize shadow governance: ${report.finalDecision}`);
  console.log(`tower=${towerValidation.status} pump=${pumpValidation.status}`);
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`markdown=${OUTPUT_MD}`);
  if (blockers.length) {
    console.log(`blockers=${blockers.length}`);
    blockers.forEach((item) => console.log(`- ${item}`));
  }
  if (warnings.length) {
    console.log(`warnings=${warnings.length}`);
    warnings.forEach((item) => console.log(`- ${item}`));
  }

  if (STRICT && blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
