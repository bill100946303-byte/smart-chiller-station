import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const BFF_BASE_URL = normalizeText(process.env.BFF_BASE_URL) || "http://127.0.0.1:8787";
const SITE_CODE = normalizeText(process.env.B25_SITE_CODE) || "btwentyfive";
const DATABASE_KEY = normalizeText(process.env.B25_DATABASE_KEY) || "140btwentyfive";
const PROJECT_KEY = normalizeText(process.env.B25_PROJECT_KEY) || "126lnoffice";
const PROJECT_TEMPLATE = normalizeText(process.env.B25_PROJECT_TEMPLATE) || "1";
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.OPTIMIZE_DEMO_SHADOW_SUITE_TIMEOUT_MS, 30000);
const ADVISOR_LOAD_KW = normalizeNumber(process.env.OPTIMIZE_DEMO_SHADOW_SUITE_LOAD_KW, 1422);
const ADVISOR_OUTDOOR_TEMP_C = normalizeNumber(process.env.OPTIMIZE_DEMO_SHADOW_SUITE_OUTDOOR_TEMP_C, 22.9);
const ADVISOR_MODE = normalizeText(process.env.OPTIMIZE_DEMO_SHADOW_SUITE_MODE) || "cooling";
const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_SHADOW_SUITE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-shadow-suite-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_SHADOW_SUITE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-shadow-suite-latest.md");

const TOWER_JSON =
  process.env.B25_TOWER_APPROACH_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-readiness-latest.json");
const TOWER_MD =
  process.env.B25_TOWER_APPROACH_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/b25-tower-approach-readiness-latest.md");
const PUMP_JSON =
  process.env.PUMP_DELTA_T_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/pump-delta-t-readiness-latest.json");
const PUMP_MD =
  process.env.PUMP_DELTA_T_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/pump-delta-t-readiness-latest.md");
const GOVERNANCE_JSON =
  process.env.OPTIMIZE_SHADOW_GOVERNANCE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-shadow-governance-latest.json");
const GOVERNANCE_MD =
  process.env.OPTIMIZE_SHADOW_GOVERNANCE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-shadow-governance-latest.md");
const UI_COPY_JSON =
  process.env.OPTIMIZE_DEMO_UI_BOUNDARY_COPY_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-ui-boundary-copy-latest.json");
const UI_COPY_MD =
  process.env.OPTIMIZE_DEMO_UI_BOUNDARY_COPY_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-ui-boundary-copy-latest.md");
const DIAGNOSTIC_READINESS_JSON =
  process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.json");
const DIAGNOSTIC_READINESS_MD =
  process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.md");
const FIELD_COLLECTION_PACKAGE_JSON =
  process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-collection-package-latest.json");
const FIELD_COLLECTION_PACKAGE_MD =
  process.env.OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-collection-package-latest.md");
const FIELD_DATA_PREFLIGHT_JSON =
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.json");
const FIELD_DATA_PREFLIGHT_MD =
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.md");
const FIELD_DATA_PROMOTE_JSON =
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-promote-latest.json");
const FIELD_DATA_PROMOTE_MD =
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-promote-latest.md");

const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.OPTIMIZE_DEMO_SHADOW_SUITE_STRICT || "").trim().toLowerCase()
);

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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      readError: error instanceof Error ? error.message : String(error)
    };
  }
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

function pushUnique(target, message) {
  const normalized = normalizeText(message);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(method, routePath, payload = null) {
  const target = new URL(routePath, `${BFF_BASE_URL.replace(/\/+$/, "")}/`);
  const transport = target.protocol === "https:" ? https : http;
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = {
    "x-chiller-site-id": SITE_ID,
    "x-chiller-site-code": SITE_CODE,
    "x-chiller-project-database-key": DATABASE_KEY,
    "x-chiller-project-key": PROJECT_KEY,
    "x-chiller-project-template": PROJECT_TEMPLATE
  };
  if (body) {
    headers["content-type"] = "application/json";
    headers["content-length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers
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
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function requestJsonWithRetry(method, routePath, payload = null, attempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await requestJson(method, routePath, payload);
    if (last.ok) {
      return {
        ...last,
        attempts: attempt
      };
    }
    if (attempt < attempts) {
      await sleep(300 * attempt);
    }
  }
  return {
    ...(last || {
      ok: false,
      status: null,
      payload: null,
      error: "request did not run"
    }),
    attempts
  };
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function findForbiddenSingleCopKeys(value, currentPath = "", found = []) {
  if (!value || typeof value !== "object") {
    return found;
  }
  const forbidden = new Set(["singleChillerCop", "singleMachineCop", "singleUnitCop", "perChillerCop", "individualChillerCop"]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenSingleCopKeys(item, `${currentPath}[${index}]`, found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    if (forbidden.has(key)) {
      found.push(childPath);
    }
    findForbiddenSingleCopKeys(child, childPath, found);
  }
  return found;
}

function summarizeAdvisorContract(response) {
  const blockers = [];
  const warnings = [];
  if (!response.ok || response.payload?.ok !== true) {
    pushUnique(blockers, `optimize draft 请求失败：${response.error || response.status || "payload invalid"}`);
  }

  const details = response.payload?.details || {};
  const chiller = details.chillerStagingAdvisor || null;
  const diagnostics = details.operationalDiagnosticsAdvisor || null;
  const forbiddenKeys = findForbiddenSingleCopKeys(details);

  if (!chiller) {
    pushUnique(blockers, "缺 chillerStagingAdvisor。");
  } else {
    if (chiller.basis !== "combination_empirical_performance") {
      pushUnique(blockers, `chillerStagingAdvisor.basis 异常：${chiller.basis || "--"}`);
    }
    if (!["read_only", "shadow"].includes(chiller.executionMode)) {
      pushUnique(blockers, `chillerStagingAdvisor.executionMode 越界：${chiller.executionMode || "--"}`);
    }
    if (chiller.dispatchReady === true || chiller.advisorResult?.execution?.allowedToDispatch === true) {
      pushUnique(blockers, "主机组合 Advisor 不应允许真实 dispatch。");
    }
    if (chiller.advisorResult?.execution?.enforcedAllowed !== false) {
      pushUnique(blockers, "主机组合 Advisor 必须显式 enforcedAllowed=false。");
    }
    if (!Array.isArray(chiller.current?.runningCombination) || chiller.current.runningCombination.length === 0) {
      pushUnique(warnings, "主机组合 Advisor 未识别当前运行组合。");
    }
    const boundaryText = [
      chiller.disclaimer,
      chiller.reason,
      ...(Array.isArray(chiller.warnings) ? chiller.warnings : []),
      ...(Array.isArray(chiller.blockers) ? chiller.blockers : [])
    ].join(" | ");
    if (!/不输出单机实时 COP|不拆分单台主机 COP|只评价主机组合 COP|不计算多机单台 COP/.test(boundaryText)) {
      pushUnique(warnings, "主机组合 Advisor 未在摘要字段中显式说明多机不拆单机 COP 边界。");
    }
  }

  if (!diagnostics) {
    pushUnique(blockers, "缺 operationalDiagnosticsAdvisor。");
  } else {
    if (diagnostics.executionMode !== "read_only") {
      pushUnique(blockers, `operationalDiagnosticsAdvisor.executionMode 必须为 read_only，当前为 ${diagnostics.executionMode || "--"}`);
    }
    if (!["ready", "partial"].includes(diagnostics.status)) {
      pushUnique(blockers, `operationalDiagnosticsAdvisor.status 不可用于演示：${diagnostics.status || "--"}`);
    }
    const itemKeys = Array.isArray(diagnostics.items) ? diagnostics.items.map((item) => item?.key).filter(Boolean) : [];
    for (const key of [
      "instrumentDataQuality",
      "chilledHydraulicBalance",
      "lowDeltaTRootCause",
      "coolingTowerCapability",
      "chillerHealthCombination"
    ]) {
      if (!itemKeys.includes(key)) {
        pushUnique(blockers, `operationalDiagnosticsAdvisor 缺诊断项：${key}`);
      }
    }
    if (diagnostics.summary?.pointDictionary?.applied !== true) {
      pushUnique(warnings, "140 站点运行诊断未显示站点点位字典已应用。");
    }
    const disclaimers = Array.isArray(diagnostics.disclaimers) ? diagnostics.disclaimers.join(" | ") : "";
    if (!/不新增真实 PLC 下发能力/.test(disclaimers)) {
      pushUnique(blockers, "运行诊断 Advisor 缺“不新增真实 PLC 下发能力”边界。");
    }
    if (!/不计算多机单台 COP|不计算.*单台 COP|多机运行只评价组合 COP/.test(disclaimers)) {
      pushUnique(blockers, "运行诊断 Advisor 缺“多机不计算单台 COP”边界。");
    }
  }

  for (const pathName of forbiddenKeys) {
    pushUnique(blockers, `响应中出现不允许的单机 COP 字段：${pathName}`);
  }

  const ok = blockers.length === 0;
  return {
    ok,
    expected: "ADVISOR_CONTRACT_READY",
    finalDecision: ok ? "ADVISOR_CONTRACT_READY" : "NO_GO",
    request: {
      ok: response.ok,
      status: response.status,
      url: response.url
    },
    inputs: {
      loadKw: ADVISOR_LOAD_KW,
      outdoorTempC: ADVISOR_OUTDOOR_TEMP_C,
      mode: ADVISOR_MODE
    },
    chillerStaging: chiller
      ? {
          status: chiller.status || null,
          executionMode: chiller.executionMode || null,
          dispatchReady: chiller.dispatchReady === true,
          basis: chiller.basis || null,
          confidence: chiller.confidence || null,
          currentCombination: Array.isArray(chiller.current?.runningCombination) ? chiller.current.runningCombination : [],
          runningCount: chiller.current?.runningCount ?? null,
          sampleTotal: chiller.evidence?.sampleSummary?.sampleTotal ?? chiller.sampleEvidence?.sampleSummary?.sampleTotal ?? null,
          sampleCaptureStatus: chiller.sampleCapture?.status || null
        }
      : null,
    operationalDiagnostics: diagnostics
      ? {
          status: diagnostics.status || null,
          executionMode: diagnostics.executionMode || null,
          itemKeys: Array.isArray(diagnostics.items) ? diagnostics.items.map((item) => item?.key).filter(Boolean) : [],
          readyCount: diagnostics.summary?.readyCount ?? null,
          partialCount: diagnostics.summary?.partialCount ?? null,
          unavailableCount: diagnostics.summary?.unavailableCount ?? null,
          pointDictionaryApplied: diagnostics.summary?.pointDictionary?.applied === true,
          pointCoverage: diagnostics.summary?.pointCoverage || null
        }
      : null,
    blockers,
    warnings
  };
}

function runScript({ key, label, script, env }) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [path.resolve(__dirname, script)], {
    cwd: BFF_DIR,
    env: {
      ...process.env,
      SITE_ID,
      BFF_BASE_URL,
      ...env
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  const endedAt = new Date().toISOString();
  return {
    key,
    label,
    script,
    exitCode: typeof result.status === "number" ? result.status : 1,
    signal: result.signal || null,
    startedAt,
    endedAt,
    stdout: normalizeText(result.stdout),
    stderr: normalizeText(result.stderr),
    error: result.error ? result.error.message : null
  };
}

function summarizeTower(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `tower readiness 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `tower readiness 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    pushUnique(blockers, item);
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const ok = report?.finalDecision === "GO_SHADOW" && report?.shadowReadinessStatus === "GO" && blockers.length === 0;
  return {
    ok,
    expected: "GO_SHADOW",
    finalDecision: report?.finalDecision || null,
    shadowReadinessStatus: report?.shadowReadinessStatus || null,
    readOnlyAdviceStatus: report?.readOnlyAdviceStatus || null,
    telemetry: report?.telemetry || null,
    dataReadinessGate: report?.dataReadinessGate || null,
    latestExecutionId: report?.executionGovernance?.latestExecutionId || null,
    blockers,
    warnings,
    reportJson: rel(TOWER_JSON),
    reportMarkdown: rel(TOWER_MD)
  };
}

function summarizePump(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `pump readiness 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `pump readiness 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    if (/assisted 前/.test(String(item))) {
      pushUnique(warnings, item);
    } else {
      pushUnique(blockers, item);
    }
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const ok =
    report?.finalDecision === "GO_SHADOW_ONLY" &&
    report?.shadowReadinessStatus === "GO" &&
    report?.assistedReadinessStatus === "BLOCKED" &&
    blockers.length === 0;
  return {
    ok,
    expected: "GO_SHADOW_ONLY",
    finalDecision: report?.finalDecision || null,
    shadowReadinessStatus: report?.shadowReadinessStatus || null,
    assistedReadinessStatus: report?.assistedReadinessStatus || null,
    dispatchMode: report?.dispatchMode || null,
    advisor: report?.advisor || null,
    latestExecution: report?.executions?.latest || null,
    blockers,
    warnings,
    reportJson: rel(PUMP_JSON),
    reportMarkdown: rel(PUMP_MD)
  };
}

function summarizeGovernance(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `shadow governance 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `shadow governance 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    pushUnique(blockers, item);
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const ok = report?.finalDecision === "GO_SHADOW_PENDING" && blockers.length === 0;
  return {
    ok,
    expected: "GO_SHADOW_PENDING",
    finalDecision: report?.finalDecision || null,
    towerLatestExecution: report?.tower?.latestExecution || null,
    pumpLatestExecution: report?.pump?.latestExecution || null,
    blockers,
    warnings,
    reportJson: rel(GOVERNANCE_JSON),
    reportMarkdown: rel(GOVERNANCE_MD)
  };
}

function summarizeUiCopy(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `UI boundary copy 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `UI boundary copy 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    pushUnique(blockers, item);
  }
  const ok = report?.finalDecision === "UI_BOUNDARY_COPY_READY" && blockers.length === 0;
  return {
    ok,
    expected: "UI_BOUNDARY_COPY_READY",
    finalDecision: report?.finalDecision || null,
    required: Array.isArray(report?.required) ? report.required : [],
    forbidden: Array.isArray(report?.forbidden) ? report.forbidden : [],
    blockers,
    warnings,
    reportJson: rel(UI_COPY_JSON),
    reportMarkdown: rel(UI_COPY_MD)
  };
}

function summarizeDiagnosticReadiness(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `diagnostic readiness 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `diagnostic readiness 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    pushUnique(blockers, item);
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const matrix = report?.summary?.matrix || null;
  const ok = report?.finalDecision === "DIAGNOSTIC_READINESS_READY" && blockers.length === 0;
  return {
    ok,
    expected: "DIAGNOSTIC_READINESS_READY",
    finalDecision: report?.finalDecision || null,
    advisorStatus: report?.summary?.advisorStatus || null,
    executionMode: report?.summary?.executionMode || null,
    readyNowCount: matrix?.readyNowCount ?? null,
    directionalCount: matrix?.directionalCount ?? null,
    pointGapCount: matrix?.pointGapCount ?? null,
    total: matrix?.total ?? null,
    controlBoundary: matrix?.controlBoundary || null,
    blockers,
    warnings,
    reportJson: rel(DIAGNOSTIC_READINESS_JSON),
    reportMarkdown: rel(DIAGNOSTIC_READINESS_MD)
  };
}

function summarizeFieldCollectionPackage(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `field collection package 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `field collection package 报告读取失败：${report.readError}`);
  }
  for (const item of Array.isArray(report?.blockers) ? report.blockers : []) {
    pushUnique(blockers, item);
  }
  for (const item of Array.isArray(report?.warnings) ? report.warnings : []) {
    pushUnique(warnings, item);
  }
  const formalInputs = Array.isArray(report?.formalInputs) ? report.formalInputs : [];
  const ok = report?.finalDecision === "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT" && blockers.length === 0;
  return {
    ok,
    expected: "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT",
    finalDecision: report?.finalDecision || null,
    formalInputCount: formalInputs.length,
    missingFormalInputs: formalInputs.filter((item) => item?.status === "missing").length,
    presentFormalInputs: formalInputs.filter((item) => item?.status === "present_with_rows").length,
    templateCount: Array.isArray(report?.templates) ? report.templates.length : null,
    blockers,
    warnings,
    reportJson: rel(FIELD_COLLECTION_PACKAGE_JSON),
    reportMarkdown: rel(FIELD_COLLECTION_PACKAGE_MD)
  };
}

function summarizeFieldDataPreflight(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `field data preflight 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `field data preflight 报告读取失败：${report.readError}`);
  }
  const finalDecision = report?.finalDecision || null;
  const acceptedForShadow = new Set([
    "FIELD_DATA_PREFLIGHT_READY",
    "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS",
    "FIELD_DATA_PREFLIGHT_PARTIAL"
  ]);
  const reportBlockers = Array.isArray(report?.blockers) ? report.blockers : [];
  const reportWarnings = Array.isArray(report?.warnings) ? report.warnings : [];
  if (!acceptedForShadow.has(finalDecision)) {
    pushUnique(blockers, `正式现场 CSV 总预检不可用于演示：${finalDecision || "--"}`);
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else if (finalDecision !== "FIELD_DATA_PREFLIGHT_READY") {
    reportBlockers.forEach((item) => pushUnique(warnings, item));
  } else {
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  }
  reportWarnings.forEach((item) => pushUnique(warnings, item));

  const inputs = Array.isArray(report?.inputs) ? report.inputs : [];
  const presentInputs = inputs.filter((item) => item?.exists === true).length;
  const missingInputs = inputs.filter((item) => item?.exists !== true).length;
  const ok = acceptedForShadow.has(finalDecision) && blockers.length === 0;
  return {
    ok,
    expected: "FIELD_DATA_PREFLIGHT_READY_OR_WAITING",
    finalDecision,
    executionMode: report?.executionMode || null,
    controlBoundary: report?.controlBoundary || null,
    inputCount: inputs.length,
    presentInputs,
    missingInputs,
    sensorStatus: report?.sensorLedger?.status || null,
    importStatus: report?.import?.status || null,
    blockers,
    warnings,
    reportJson: rel(FIELD_DATA_PREFLIGHT_JSON),
    reportMarkdown: rel(FIELD_DATA_PREFLIGHT_MD)
  };
}

function summarizeFieldDataPromote(report, run) {
  const blockers = [];
  const warnings = [];
  if (run.exitCode !== 0) {
    pushUnique(blockers, `field data promote 脚本退出码 ${run.exitCode}`);
  }
  if (report?.readError) {
    pushUnique(blockers, `field data promote 报告读取失败：${report.readError}`);
  }
  const finalDecision = report?.finalDecision || null;
  const acceptedForShadow = new Set([
    "FIELD_DATA_PROMOTE_READY",
    "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT"
  ]);
  const reportBlockers = Array.isArray(report?.blockers) ? report.blockers : [];
  const reportWarnings = Array.isArray(report?.warnings) ? report.warnings : [];
  if (!acceptedForShadow.has(finalDecision)) {
    pushUnique(blockers, `正式现场 CSV 导入 Gate 不可用于演示：${finalDecision || "--"}`);
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  } else if (finalDecision !== "FIELD_DATA_PROMOTE_READY") {
    reportBlockers.forEach((item) => pushUnique(warnings, item));
  } else {
    reportBlockers.forEach((item) => pushUnique(blockers, item));
  }
  reportWarnings.forEach((item) => pushUnique(warnings, item));

  const inputs = Array.isArray(report?.inputs) ? report.inputs : [];
  const presentInputs = inputs.filter((item) => item?.exists === true).length;
  const missingInputs = inputs.filter((item) => item?.exists !== true).length;
  const ok = acceptedForShadow.has(finalDecision) && blockers.length === 0;
  return {
    ok,
    expected: "FIELD_DATA_PROMOTE_READY_OR_WAITING",
    finalDecision,
    executionMode: report?.executionMode || null,
    controlBoundary: report?.controlBoundary || null,
    preflightDecision: report?.preflight?.finalDecision || null,
    inputCount: inputs.length,
    presentInputs,
    missingInputs,
    importStatus: report?.import?.status || null,
    blockers,
    warnings,
    reportJson: rel(FIELD_DATA_PROMOTE_JSON),
    reportMarkdown: rel(FIELD_DATA_PROMOTE_MD)
  };
}

function summarizeExecutionForMutationGuard(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  return {
    executionId: item.executionId || null,
    status: item.status || null,
    approvalStatus: item.approval?.status || null,
    dispatchPresent: Boolean(item.execution?.dispatch),
    timelineActions: Array.isArray(item.timeline) ? item.timeline.map((entry) => normalizeText(entry?.action)).filter(Boolean) : []
  };
}

async function fetchControlMutationSnapshot() {
  const [towerResponse, pumpResponse] = await Promise.all([
    requestJsonWithRetry("GET", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/tower-approach/executions?limit=5`),
    requestJsonWithRetry("GET", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize/executions?type=pump-delta-t&limit=5`)
  ]);
  const towerItems = Array.isArray(towerResponse.payload?.items) ? towerResponse.payload.items : [];
  const pumpItems = Array.isArray(pumpResponse.payload?.items) ? pumpResponse.payload.items : [];
  return {
    generatedAt: new Date().toISOString(),
    tower: {
      ok: towerResponse.ok,
      status: towerResponse.status,
      attempts: towerResponse.attempts || 1,
      error: towerResponse.error || null,
      items: towerItems.map(summarizeExecutionForMutationGuard).filter(Boolean)
    },
    pump: {
      ok: pumpResponse.ok,
      status: pumpResponse.status,
      attempts: pumpResponse.attempts || 1,
      error: pumpResponse.error || null,
      items: pumpItems.map(summarizeExecutionForMutationGuard).filter(Boolean)
    }
  };
}

function compareExecutionSnapshots(scope, beforeItems, afterItems, blockers) {
  const beforeIds = beforeItems.map((item) => item.executionId).join(",");
  const afterIds = afterItems.map((item) => item.executionId).join(",");
  if (beforeIds !== afterIds) {
    pushUnique(blockers, `${scope} 执行单列表发生变化：before=${beforeIds || "--"} after=${afterIds || "--"}`);
    return;
  }
  for (let index = 0; index < beforeItems.length; index += 1) {
    const before = beforeItems[index];
    const after = afterItems[index];
    if (!after) {
      pushUnique(blockers, `${scope} 执行单 ${before.executionId || index} 在检查后缺失。`);
      continue;
    }
    for (const key of ["status", "approvalStatus", "dispatchPresent"]) {
      if (before[key] !== after[key]) {
        pushUnique(
          blockers,
          `${scope} 执行单 ${before.executionId || index} 字段 ${key} 发生变化：${String(before[key])} -> ${String(after[key])}`
        );
      }
    }
    const beforeTimeline = before.timelineActions.join(">");
    const afterTimeline = after.timelineActions.join(">");
    if (beforeTimeline !== afterTimeline) {
      pushUnique(
        blockers,
        `${scope} 执行单 ${before.executionId || index} timeline 发生变化：${beforeTimeline || "--"} -> ${afterTimeline || "--"}`
      );
    }
  }
}

function summarizeControlMutationGuard(beforeSnapshot, afterSnapshot) {
  const blockers = [];
  const warnings = [];
  if (!beforeSnapshot?.tower?.ok) {
    pushUnique(blockers, `suite 前 tower 执行单快照失败：${beforeSnapshot?.tower?.error || beforeSnapshot?.tower?.status || "unknown"}`);
  }
  if (!beforeSnapshot?.pump?.ok) {
    pushUnique(blockers, `suite 前 pump 执行单快照失败：${beforeSnapshot?.pump?.error || beforeSnapshot?.pump?.status || "unknown"}`);
  }
  if (!afterSnapshot?.tower?.ok) {
    pushUnique(blockers, `suite 后 tower 执行单快照失败：${afterSnapshot?.tower?.error || afterSnapshot?.tower?.status || "unknown"}`);
  }
  if (!afterSnapshot?.pump?.ok) {
    pushUnique(blockers, `suite 后 pump 执行单快照失败：${afterSnapshot?.pump?.error || afterSnapshot?.pump?.status || "unknown"}`);
  }
  if (!blockers.length) {
    compareExecutionSnapshots("tower", beforeSnapshot.tower.items, afterSnapshot.tower.items, blockers);
    compareExecutionSnapshots("pump", beforeSnapshot.pump.items, afterSnapshot.pump.items, blockers);
  }
  const ok = blockers.length === 0;
  return {
    ok,
    expected: "NO_CONTROL_MUTATION",
    finalDecision: ok ? "NO_CONTROL_MUTATION" : "NO_GO",
    before: beforeSnapshot,
    after: afterSnapshot,
    towerExecutionCount: afterSnapshot?.tower?.items?.length ?? null,
    pumpExecutionCount: afterSnapshot?.pump?.items?.length ?? null,
    blockers,
    warnings
  };
}

function renderMarkdown(report) {
  const blockers = report.blockers.length ? report.blockers : ["无"];
  const warnings = report.warnings.length ? report.warnings : ["无"];
  const tower = report.components.tower;
  const pump = report.components.pump;
  const governance = report.components.governance;
  const uiCopy = report.components.uiCopy;
  const diagnosticReadiness = report.components.diagnosticReadiness;
  const fieldCollectionPackage = report.components.fieldCollectionPackage;
  const fieldDataPreflight = report.components.fieldDataPreflight;
  const fieldDataPromote = report.components.fieldDataPromote;
  const advisors = report.components.advisors;
  const mutationGuard = report.components.mutationGuard;
  const towerTelemetry = tower.telemetry || {};
  const towerDataGate = tower.dataReadinessGate || {};
  const pumpLatest = pump.latestExecution || {};
  const governanceTower = governance.towerLatestExecution || {};
  const governancePump = governance.pumpLatestExecution || {};
  const chiller = advisors.chillerStaging || {};
  const diagnostics = advisors.operationalDiagnostics || {};
  return `# 140 /optimize-demo Shadow Suite 总检查

- 结论：${report.finalDecision}
- 站点：${report.siteId}
- BFF：${report.bffBaseUrl}
- 生成时间：${report.generatedAt}
- 控制边界：可刷新草案/采样证据；不批准、不 dispatch、不 rollback、不写真实 PLC

## 组件结论

| 组件 | 期望 | 当前 | 结果 | 报告 |
| --- | --- | --- | --- | --- |
| Advisor 合同 | ${advisors.expected} | ${advisors.finalDecision || "--"} | ${advisors.ok ? "通过" : "阻断"} | 本报告 |
| 诊断可行性矩阵 | ${diagnosticReadiness.expected} | ${diagnosticReadiness.finalDecision || "--"} | ${diagnosticReadiness.ok ? "通过" : "阻断"} | ${diagnosticReadiness.reportMarkdown} |
| 现场采集包 readiness | ${fieldCollectionPackage.expected} | ${fieldCollectionPackage.finalDecision || "--"} | ${fieldCollectionPackage.ok ? "通过" : "阻断"} | ${fieldCollectionPackage.reportMarkdown} |
| 正式现场 CSV 总预检 | ${fieldDataPreflight.expected} | ${fieldDataPreflight.finalDecision || "--"} | ${fieldDataPreflight.ok ? "通过" : "阻断"} | ${fieldDataPreflight.reportMarkdown} |
| 正式现场 CSV 导入 Gate | ${fieldDataPromote.expected} | ${fieldDataPromote.finalDecision || "--"} | ${fieldDataPromote.ok ? "通过" : "阻断"} | ${fieldDataPromote.reportMarkdown} |
| UI 边界文案 | ${uiCopy.expected} | ${uiCopy.finalDecision || "--"} | ${uiCopy.ok ? "通过" : "阻断"} | ${uiCopy.reportMarkdown} |
| 控制副作用防护 | ${mutationGuard.expected} | ${mutationGuard.finalDecision || "--"} | ${mutationGuard.ok ? "通过" : "阻断"} | 本报告 |
| 冷却塔 Approach | ${tower.expected} | ${tower.finalDecision || "--"} | ${tower.ok ? "通过" : "阻断"} | ${tower.reportMarkdown} |
| 泵温差降频 | ${pump.expected} | ${pump.finalDecision || "--"} | ${pump.ok ? "通过" : "阻断"} | ${pump.reportMarkdown} |
| Shadow 治理 | ${governance.expected} | ${governance.finalDecision || "--"} | ${governance.ok ? "通过" : "阻断"} | ${governance.reportMarkdown} |

## 当前关键状态

| 项目 | 数值 |
| --- | --- |
| 塔侧 shadow | ${tower.shadowReadinessStatus || "--"} |
| 塔侧数据门禁 | ${towerDataGate.finalDecision || "--"} (${towerDataGate.readyCount ?? "--"}/${towerDataGate.total ?? "--"}) |
| 塔侧目标 Tcws | ${towerTelemetry.advisorTargetTcwsC ?? "--"} ℃ |
| 塔侧当前 Approach | ${towerTelemetry.calculatedApproachC ?? "--"} ℃ |
| 塔侧最新执行单 | ${governanceTower.executionId || tower.latestExecutionId || "--"} |
| 泵侧 shadow | ${pump.shadowReadinessStatus || "--"} |
| 泵侧 assisted | ${pump.assistedReadinessStatus || "--"} |
| 泵侧 Trim | CHWP ${pumpLatest.targetChwpFreqTrimHz ?? governancePump.targetChwpFreqTrimHz ?? "--"} Hz / CWP ${pumpLatest.targetCwpFreqTrimHz ?? governancePump.targetCwpFreqTrimHz ?? "--"} Hz |
| 泵侧最新执行单 | ${governancePump.executionId || pumpLatest.executionId || "--"} |
| 最新 tower dispatch | ${governanceTower.dispatch ? "present" : "none"} |
| 最新 pump dispatch | ${governancePump.dispatch ? "present" : "none"} |
| 主机组合 Advisor | ${chiller.status || "--"} / ${chiller.executionMode || "--"} |
| 当前主机组合 | ${Array.isArray(chiller.currentCombination) && chiller.currentCombination.length ? chiller.currentCombination.join(" + ") : "--"} |
| 主机组合样本 | ${chiller.sampleTotal ?? "--"} |
| 运行诊断 Advisor | ${diagnostics.status || "--"} / ${diagnostics.executionMode || "--"} |
| 运行诊断项 | ${Array.isArray(diagnostics.itemKeys) ? diagnostics.itemKeys.length : "--"} |
| 点位字典 | ${diagnostics.pointDictionaryApplied ? "已应用" : "未确认"} |
| 诊断可行性矩阵 | ${diagnosticReadiness.readyNowCount ?? "--"} 可做 / ${diagnosticReadiness.directionalCount ?? "--"} 疑似 / ${diagnosticReadiness.pointGapCount ?? "--"} 补点 |
| 诊断矩阵控制边界 | ${diagnosticReadiness.controlBoundary || "--"} |
| 现场采集包 | ${fieldCollectionPackage.finalDecision || "--"} |
| 正式现场 CSV | ${fieldCollectionPackage.presentFormalInputs ?? "--"} 已投放 / ${fieldCollectionPackage.missingFormalInputs ?? "--"} 未投放 |
| 正式 CSV 总预检 | ${fieldDataPreflight.finalDecision || "--"} (${fieldDataPreflight.presentInputs ?? "--"}/${fieldDataPreflight.inputCount ?? "--"} 已投放) |
| 正式导入 Gate | ${fieldDataPromote.finalDecision || "--"} |
| UI 必备边界文案 | ${Array.isArray(uiCopy.required) ? uiCopy.required.filter((item) => item.ok).length : "--"} / ${Array.isArray(uiCopy.required) ? uiCopy.required.length : "--"} |
| suite 控制副作用 | ${mutationGuard.finalDecision || "--"} |

## 阻断项

${blockers.map((item) => `- ${item}`).join("\n")}

## 风险与提示

${warnings.map((item) => `- ${item}`).join("\n")}

## 塔侧数据门禁缺口

| key | 状态 | 证据 | 恢复动作 |
| --- | --- | --- | --- |
${Array.isArray(towerDataGate.items) && towerDataGate.items.length ? towerDataGate.items.map((item) => `| ${item.key} | ${item.status} | ${item.evidence} | ${item.recoveryAction} |`).join("\n") : "| -- | -- | -- | -- |"}

## 子报告

- ${tower.reportMarkdown}
- ${pump.reportMarkdown}
- ${governance.reportMarkdown}
- ${diagnosticReadiness.reportMarkdown}
- ${fieldCollectionPackage.reportMarkdown}
- ${fieldDataPreflight.reportMarkdown}
- ${fieldDataPromote.reportMarkdown}
- ${uiCopy.reportMarkdown}

## 结论口径

- 该 suite 只证明 140 /optimize-demo 当前 shadow 演示链路状态。
- Advisor 合同检查会生成一次草案，可能刷新 append-only 主机组合采样证据；它不做控制动作。
- 控制副作用防护会对比 suite 前后 tower/pump 执行单状态、审批、dispatch 和 timeline；append-only 采样不纳入控制副作用。
- GO_SHADOW_PENDING 只表示可进入人工审阅，不表示可真实下发。
- 泵侧若仍为 GO_SHADOW_ONLY，必须继续锁定 assisted/enforced。
- 任何 approve、dispatch、rollback 都必须由人工另行确认，本检查不会执行这些动作。
`;
}

function buildReport({
  runs,
  advisorResponse,
  towerReport,
  pumpReport,
  governanceReport,
  diagnosticReadinessReport,
  fieldCollectionPackageReport,
  fieldDataPreflightReport,
  fieldDataPromoteReport,
  uiCopyReport,
  executionSnapshotBefore,
  executionSnapshotAfter
}) {
  const advisors = summarizeAdvisorContract(advisorResponse);
  const diagnosticReadiness = summarizeDiagnosticReadiness(diagnosticReadinessReport, runs.diagnosticReadiness);
  const fieldCollectionPackage = summarizeFieldCollectionPackage(fieldCollectionPackageReport, runs.fieldCollectionPackage);
  const fieldDataPreflight = summarizeFieldDataPreflight(fieldDataPreflightReport, runs.fieldDataPreflight);
  const fieldDataPromote = summarizeFieldDataPromote(fieldDataPromoteReport, runs.fieldDataPromote);
  const uiCopy = summarizeUiCopy(uiCopyReport, runs.uiCopy);
  const mutationGuard = summarizeControlMutationGuard(executionSnapshotBefore, executionSnapshotAfter);
  const tower = summarizeTower(towerReport, runs.tower);
  const pump = summarizePump(pumpReport, runs.pump);
  const governance = summarizeGovernance(governanceReport, runs.governance);
  const blockers = [];
  const warnings = [];

  for (const component of [
    advisors,
    diagnosticReadiness,
    fieldCollectionPackage,
    fieldDataPreflight,
    fieldDataPromote,
    uiCopy,
    mutationGuard,
    tower,
    pump,
    governance
  ]) {
    component.blockers.forEach((item) => pushUnique(blockers, item));
    component.warnings.forEach((item) => pushUnique(warnings, item));
  }

  if (!advisors.ok) {
    pushUnique(blockers, "Advisor 合同检查未通过，不能作为完整 AI 优化建议模块验收证据。");
  }
  if (!diagnosticReadiness.ok) {
    pushUnique(blockers, "诊断可行性矩阵检查未通过，不能证明数据资源拓展边界。");
  }
  if (!fieldCollectionPackage.ok) {
    pushUnique(blockers, "现场采集包 readiness 未通过，不能证明现场补数路径可交付。");
  }
  if (!fieldDataPreflight.ok) {
    pushUnique(blockers, "正式现场 CSV 总预检未处于可演示状态，不能证明正式数据 gate 已收口。");
  }
  if (!fieldDataPromote.ok) {
    pushUnique(blockers, "正式现场 CSV 导入 Gate 未处于可演示状态，不能证明正式数据不会误入生产。");
  }
  if (!uiCopy.ok) {
    pushUnique(blockers, "UI 边界文案检查未通过，不能作为对外演示验收证据。");
  }
  if (!mutationGuard.ok) {
    pushUnique(blockers, "suite 运行前后执行单状态发生变化，不能证明检查过程无控制副作用。");
  }
  if (!tower.ok) {
    pushUnique(blockers, "塔侧未达到 GO_SHADOW，不能作为完整 shadow 演示链路。");
  }
  if (!pump.ok) {
    pushUnique(blockers, "泵侧未保持 GO_SHADOW_ONLY，不能作为当前安全边界证据。");
  }
  if (!governance.ok) {
    pushUnique(blockers, "shadow governance 未达到 GO_SHADOW_PENDING，不能进入人工审阅。");
  }

  const finalDecision = blockers.length === 0 ? "GO_SHADOW_PENDING" : "NO_GO";
  return {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    finalDecision,
    components: {
      advisors,
      diagnosticReadiness,
      fieldCollectionPackage,
      fieldDataPreflight,
      fieldDataPromote,
      uiCopy,
      mutationGuard,
      tower,
      pump,
      governance
    },
    runs,
    blockers,
    warnings,
    reportFiles: {
      json: rel(OUTPUT_JSON),
      markdown: rel(OUTPUT_MD)
    }
  };
}

async function main() {
  const executionSnapshotBefore = await fetchControlMutationSnapshot();
  const advisorResponse = await requestJson("POST", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize`, {
    context: {
      siteId: SITE_ID
    },
    inputs: {
      loadKw: ADVISOR_LOAD_KW,
      outdoorTempC: ADVISOR_OUTDOOR_TEMP_C,
      mode: ADVISOR_MODE
    }
  });

  const runs = {
    uiCopy: runScript({
      key: "ui-copy",
      label: "UI 边界文案",
      script: "check-optimize-demo-ui-boundary-copy.js",
      env: {
        OPTIMIZE_DEMO_UI_BOUNDARY_COPY_JSON: UI_COPY_JSON,
        OPTIMIZE_DEMO_UI_BOUNDARY_COPY_MD: UI_COPY_MD
      }
    }),
    diagnosticReadiness: runScript({
      key: "diagnostic-readiness",
      label: "诊断可行性矩阵",
      script: "check-optimize-demo-diagnostic-readiness.js",
      env: {
        OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_JSON: DIAGNOSTIC_READINESS_JSON,
        OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_MD: DIAGNOSTIC_READINESS_MD,
        OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_LOAD_KW: String(ADVISOR_LOAD_KW),
        OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_OUTDOOR_TEMP_C: String(ADVISOR_OUTDOOR_TEMP_C),
        OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_MODE: ADVISOR_MODE
      }
    }),
    fieldCollectionPackage: runScript({
      key: "field-collection-package",
      label: "现场采集包 readiness",
      script: "check-optimize-demo-140-field-collection-package.js",
      env: {
        OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_JSON: FIELD_COLLECTION_PACKAGE_JSON,
        OPTIMIZE_DEMO_FIELD_COLLECTION_PACKAGE_MD: FIELD_COLLECTION_PACKAGE_MD
      }
    }),
    fieldDataPreflight: runScript({
      key: "field-data-preflight",
      label: "正式现场 CSV 总预检",
      script: "check-optimize-demo-140-field-data-preflight.js",
      env: {
        OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON: FIELD_DATA_PREFLIGHT_JSON,
        OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_MD: FIELD_DATA_PREFLIGHT_MD
      }
    }),
    fieldDataPromote: runScript({
      key: "field-data-promote",
      label: "正式现场 CSV 导入 Gate",
      script: "promote-optimize-demo-140-field-data-ledgers.js",
      env: {
        OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON: FIELD_DATA_PREFLIGHT_JSON,
        OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_JSON: FIELD_DATA_PROMOTE_JSON,
        OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_MD: FIELD_DATA_PROMOTE_MD
      }
    }),
    tower: runScript({
      key: "tower",
      label: "冷却塔 Approach readiness",
      script: "check-b25-tower-approach-readiness.js",
      env: {
        B25_TOWER_APPROACH_READINESS_JSON: TOWER_JSON,
        B25_TOWER_APPROACH_READINESS_MD: TOWER_MD
      }
    }),
    pump: runScript({
      key: "pump",
      label: "泵温差降频 readiness",
      script: "check-pump-delta-t-readiness.js",
      env: {
        PUMP_DELTA_T_READINESS_JSON: PUMP_JSON,
        PUMP_DELTA_T_READINESS_MD: PUMP_MD
      }
    }),
    governance: runScript({
      key: "governance",
      label: "shadow governance",
      script: "check-optimize-shadow-governance.js",
      env: {
        OPTIMIZE_SHADOW_GOVERNANCE_JSON: GOVERNANCE_JSON,
        OPTIMIZE_SHADOW_GOVERNANCE_MD: GOVERNANCE_MD
      }
    })
  };
  const executionSnapshotAfter = await fetchControlMutationSnapshot();

  const report = buildReport({
    runs,
    advisorResponse,
    towerReport: readJson(TOWER_JSON),
    pumpReport: readJson(PUMP_JSON),
    governanceReport: readJson(GOVERNANCE_JSON),
    diagnosticReadinessReport: readJson(DIAGNOSTIC_READINESS_JSON),
    fieldCollectionPackageReport: readJson(FIELD_COLLECTION_PACKAGE_JSON),
    fieldDataPreflightReport: readJson(FIELD_DATA_PREFLIGHT_JSON),
    fieldDataPromoteReport: readJson(FIELD_DATA_PROMOTE_JSON),
    uiCopyReport: readJson(UI_COPY_JSON),
    executionSnapshotBefore,
    executionSnapshotAfter
  });

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 shadow suite: ${report.finalDecision}\n`);
  process.stdout.write(`advisors=${report.components.advisors.finalDecision || "--"} diagnostic=${report.components.diagnosticReadiness.finalDecision || "--"} fieldCollection=${report.components.fieldCollectionPackage.finalDecision || "--"} fieldDataPreflight=${report.components.fieldDataPreflight.finalDecision || "--"} fieldDataPromote=${report.components.fieldDataPromote.finalDecision || "--"} uiCopy=${report.components.uiCopy.finalDecision || "--"} mutation=${report.components.mutationGuard.finalDecision || "--"} tower=${report.components.tower.finalDecision || "--"} pump=${report.components.pump.finalDecision || "--"} governance=${report.components.governance.finalDecision || "--"}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (report.blockers.length) {
    process.stdout.write(`blockers=${report.blockers.length}\n`);
    report.blockers.slice(0, 10).forEach((item) => process.stdout.write(`- ${item}\n`));
  }
  if (report.warnings.length) {
    process.stdout.write(`warnings=${report.warnings.length}\n`);
    report.warnings.slice(0, 10).forEach((item) => process.stdout.write(`- ${item}\n`));
  }

  if (STRICT && report.finalDecision !== "GO_SHADOW_PENDING") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`optimize-demo 140 shadow suite failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
