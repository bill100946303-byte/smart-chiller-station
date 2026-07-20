import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const BFF_BASE_URL = (normalizeText(process.env.BFF_BASE_URL) || "http://127.0.0.1:8787").replace(/\/+$/, "");
const SITE_CODE = normalizeText(process.env.B25_SITE_CODE) || "btwentyfive";
const DATABASE_KEY = normalizeText(process.env.B25_DATABASE_KEY) || "140btwentyfive";
const PROJECT_KEY = normalizeText(process.env.B25_PROJECT_KEY) || "126lnoffice";
const PROJECT_TEMPLATE = normalizeText(process.env.B25_PROJECT_TEMPLATE) || "1";
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_TIMEOUT_MS, 30000);
const LOAD_KW = normalizeNumber(process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_LOAD_KW, 12861);
const OUTDOOR_TEMP_C = normalizeNumber(process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_OUTDOOR_TEMP_C, 24.9);
const MODE = normalizeText(process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_MODE) || "cooling";
const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-diagnostic-readiness-latest.md");
const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.OPTIMIZE_DEMO_DIAGNOSTIC_READINESS_STRICT || "").trim().toLowerCase()
);

const REQUIRED_KEYS = [
  "instrumentDataQuality",
  "chilledHydraulicBalance",
  "lowDeltaTRootCause",
  "coolingTowerCapability",
  "chillerCombinationOptimization",
  "chillerHealthDegradation",
  "pumpEfficiency",
  "valveStiction",
  "controlOscillation",
  "terminalComfortProtection"
];

const REQUIRED_BOUNDARY_TEXT = [
  "不新增真实 PLC 下发",
  "自动启停",
  "enforced"
];

const REQUIRED_FIELD_CHECKLIST_KEYS = [
  "sensor-calibration-installation-ledger",
  "terminal-safety-signal-closure",
  "plc-pump-protection-mapping",
  "chiller-combination-sampling-plan",
  "branch-hydraulic-history-window",
  "control-command-feedback-event-window",
  "tower-field-inspection-ledger"
];

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

function requestJson(method, routePath, payload = null) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
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

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function pushUnique(target, message) {
  const normalized = normalizeText(message);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function itemByKey(matrix, key) {
  const items = Array.isArray(matrix?.items) ? matrix.items : [];
  return items.find((item) => item?.key === key) || null;
}

function textIncludesAny(value, candidates) {
  const text = String(value || "");
  return candidates.some((candidate) => text.includes(candidate));
}

function summarizeMatrix(response) {
  const blockers = [];
  const warnings = [];
  if (!response.ok || response.payload?.ok !== true) {
    pushUnique(blockers, `optimize draft 请求失败：${response.error || response.status || "payload invalid"}`);
  }
  const details = response.payload?.details || {};
  const advisor = details.operationalDiagnosticsAdvisor || null;
  const matrix = advisor?.summary?.diagnosticReadinessMatrix || null;
  const fieldChecklist = advisor?.summary?.fieldVerificationChecklist || null;
  const diagnosticItems = Array.isArray(advisor?.items) ? advisor.items : [];
  const items = Array.isArray(matrix?.items) ? matrix.items : [];
  const keys = items.map((item) => item?.key).filter(Boolean);
  const fieldItems = Array.isArray(fieldChecklist?.items) ? fieldChecklist.items : [];
  const fieldKeys = fieldItems.map((item) => item?.key).filter(Boolean);

  if (!advisor) {
    pushUnique(blockers, "缺 operationalDiagnosticsAdvisor。");
  } else if (advisor.executionMode !== "read_only") {
    pushUnique(blockers, `operationalDiagnosticsAdvisor.executionMode 越界：${advisor.executionMode || "--"}`);
  }

  if (!matrix) {
    pushUnique(blockers, "缺 diagnosticReadinessMatrix。");
  } else {
    if (matrix.controlBoundary !== "read_only_or_shadow_only") {
      pushUnique(blockers, `diagnosticReadinessMatrix.controlBoundary 异常：${matrix.controlBoundary || "--"}`);
    }
    if (Number(matrix.total) !== REQUIRED_KEYS.length || items.length !== REQUIRED_KEYS.length) {
      pushUnique(blockers, `诊断可行性矩阵项数异常：total=${matrix.total ?? "--"} items=${items.length}`);
    }
    for (const key of REQUIRED_KEYS) {
      if (!keys.includes(key)) {
        pushUnique(blockers, `诊断可行性矩阵缺少 key=${key}`);
      }
    }
    const countSum =
      Number(matrix.readyNowCount || 0) + Number(matrix.directionalCount || 0) + Number(matrix.pointGapCount || 0);
    if (countSum !== items.length) {
      pushUnique(blockers, `诊断可行性矩阵计数不闭合：ready+directional+pointGap=${countSum}, items=${items.length}`);
    }
    const notesText = Array.isArray(matrix.boundaryNotes) ? matrix.boundaryNotes.join(" | ") : "";
    for (const required of REQUIRED_BOUNDARY_TEXT) {
      if (!notesText.includes(required)) {
        pushUnique(blockers, `诊断可行性边界缺少：${required}`);
      }
    }
  }

  for (const item of items) {
    if (!["ready", "partial", "unavailable"].includes(item?.status)) {
      pushUnique(blockers, `${item?.key || "--"} status 越界：${item?.status || "--"}`);
    }
    if (!["can_do_v1", "directional_review", "point_gap"].includes(item?.currentFeasibility)) {
      pushUnique(blockers, `${item?.key || "--"} currentFeasibility 越界：${item?.currentFeasibility || "--"}`);
    }
    if (!["read_only", "shadow_review", "point_plan"].includes(item?.allowedMode)) {
      pushUnique(blockers, `${item?.key || "--"} allowedMode 越界：${item?.allowedMode || "--"}`);
    }
    if (["assisted", "enforced"].includes(item?.allowedMode)) {
      pushUnique(blockers, `${item?.key || "--"} 不应开放 ${item.allowedMode}`);
    }
  }

  const pumpEfficiency = itemByKey(matrix, "pumpEfficiency");
  if (pumpEfficiency?.currentFeasibility === "can_do_v1") {
    pushUnique(blockers, "水泵效率诊断当前不能标为可做 V1；缺单泵流量/泵曲线时只能疑似判断。");
  }
  if (pumpEfficiency && !String(pumpEfficiency.boundary || "").includes("不能输出水泵效率百分比")) {
    pushUnique(blockers, "水泵效率诊断缺少“不能输出水泵效率百分比”边界。");
  }

  const terminalComfort = itemByKey(matrix, "terminalComfortProtection");
  if (terminalComfort?.currentFeasibility === "can_do_v1") {
    pushUnique(blockers, "末端舒适/缺冷风险诊断当前不能标为可做 V1；缺末端安全信号时只能补点或方向性审阅。");
  }
  if (terminalComfort?.allowedMode !== "point_plan") {
    pushUnique(blockers, `末端舒适/缺冷风险诊断 allowedMode 应保持 point_plan，当前=${terminalComfort?.allowedMode || "--"}`);
  }

  const chillerCombination = itemByKey(matrix, "chillerCombinationOptimization");
  if (
    chillerCombination &&
    !textIncludesAny(chillerCombination.boundary, ["不拆分单台主机实时 COP", "不自动启停主机"])
  ) {
    pushUnique(blockers, "主机组合优化缺少多机不拆单机 COP 或不自动启停边界。");
  }

  const instrumentDiagnostic = diagnosticItems.find((item) => item?.key === "instrumentDataQuality") || null;
  const instrumentCurrent = instrumentDiagnostic?.current || {};
  const driftCandidates = Array.isArray(instrumentCurrent.driftCandidates) ? instrumentCurrent.driftCandidates : [];
  const crossChecks = Array.isArray(instrumentCurrent.crossChecks) ? instrumentCurrent.crossChecks : [];
	  const fieldReviewTargets = Array.isArray(instrumentCurrent.fieldReviewTargets)
	    ? instrumentCurrent.fieldReviewTargets
	    : [];
  const sensorLedgerEvidence = instrumentCurrent.sensorLedgerEvidence || {};
	  if (!instrumentDiagnostic) {
    pushUnique(blockers, "运行诊断缺 instrumentDataQuality。");
  } else {
    if (!driftCandidates.length) {
      pushUnique(blockers, "仪表偏移 V1 缺 driftCandidates。");
    }
    if (!crossChecks.length) {
      pushUnique(blockers, "仪表偏移 V1 缺 crossChecks。");
    }
    if (!fieldReviewTargets.length) {
      pushUnique(blockers, "仪表偏移 V1 缺 fieldReviewTargets。");
    }
    if (!String(instrumentCurrent.reviewBoundary || "").includes("不自动修正测点")) {
      pushUnique(blockers, "仪表偏移 V1 缺不自动修正测点边界。");
    }
	    if (!String(instrumentCurrent.reviewBoundary || "").includes("不判定仪表故障")) {
	      pushUnique(blockers, "仪表偏移 V1 缺不判定仪表故障边界。");
	    }
    if (!sensorLedgerEvidence || typeof sensorLedgerEvidence !== "object" || !sensorLedgerEvidence.status) {
      pushUnique(blockers, "仪表偏移 V1 缺 sensorLedgerEvidence 台账预检状态。");
    } else if (!String(sensorLedgerEvidence.controlBoundary || "").includes("不自动修正测点")) {
      pushUnique(blockers, "传感器台账预检缺不自动修正测点边界。");
    }
    for (const candidate of driftCandidates) {
      if (!["review", "normal", "insufficient"].includes(candidate?.status)) {
        pushUnique(blockers, `${candidate?.key || "--"} 仪表偏移候选 status 越界：${candidate?.status || "--"}`);
      }
      if (String(candidate?.boundary || "").includes("自动修正") && !String(candidate?.boundary || "").includes("不自动修正")) {
        pushUnique(blockers, `${candidate?.key || "--"} 仪表偏移候选边界疑似允许自动修正。`);
      }
    }
  }

  const hydraulicDiagnostic = diagnosticItems.find((item) => item?.key === "chilledHydraulicBalance") || null;
  const hydraulicCurrent = hydraulicDiagnostic?.current || {};
  const hydraulicRiskIndicators = Array.isArray(hydraulicCurrent.riskIndicators)
    ? hydraulicCurrent.riskIndicators
    : [];
  const hydraulicFieldReviewTargets = Array.isArray(hydraulicCurrent.fieldReviewTargets)
    ? hydraulicCurrent.fieldReviewTargets
    : [];
  if (!hydraulicDiagnostic) {
    pushUnique(blockers, "运行诊断缺 chilledHydraulicBalance。");
  } else {
    if (!hydraulicRiskIndicators.length) {
      pushUnique(blockers, "水力平衡 V1 缺 riskIndicators。");
    }
    if (!hydraulicFieldReviewTargets.length) {
      pushUnique(blockers, "水力平衡 V1 缺 fieldReviewTargets。");
    }
    if (!String(hydraulicCurrent.reviewBoundary || "").includes("不自动降泵")) {
      pushUnique(blockers, "水力平衡 V1 缺不自动降泵边界。");
    }
    if (!String(hydraulicCurrent.reviewBoundary || "").includes("不直接判定末端阀门故障")) {
      pushUnique(blockers, "水力平衡 V1 缺不直接判定末端阀门故障边界。");
    }
    if (!hydraulicRiskIndicators.some((item) => item?.key === "terminal_safety_gap" && item?.status === "gap")) {
      pushUnique(blockers, "水力平衡 V1 缺末端安全 gap 指示。");
    }
    for (const indicator of hydraulicRiskIndicators) {
      if (!["active", "watch", "normal", "gap", "unknown"].includes(indicator?.status)) {
        pushUnique(blockers, `${indicator?.key || "--"} 水力风险指示 status 越界：${indicator?.status || "--"}`);
      }
      const boundary = String(indicator?.boundary || "");
      if (boundary.includes("自动降泵") && !boundary.includes("不自动降泵")) {
        pushUnique(blockers, `${indicator?.key || "--"} 水力风险指示边界疑似允许自动降泵。`);
      }
    }
  }

  const controlOscillationDiagnostic = diagnosticItems.find((item) => item?.key === "controlOscillation") || null;
  const controlOscillationCurrent = controlOscillationDiagnostic?.current || {};
  const controlOscillationRiskIndicators = Array.isArray(controlOscillationCurrent.riskIndicators)
    ? controlOscillationCurrent.riskIndicators
    : [];
  const controlOscillationFieldReviewTargets = Array.isArray(controlOscillationCurrent.fieldReviewTargets)
    ? controlOscillationCurrent.fieldReviewTargets
    : [];
  if (!controlOscillationDiagnostic) {
    pushUnique(blockers, "运行诊断缺 controlOscillation。");
  } else {
    if (!controlOscillationRiskIndicators.length) {
      pushUnique(blockers, "控制震荡 V1 缺 riskIndicators。");
    }
    if (!controlOscillationFieldReviewTargets.length) {
      pushUnique(blockers, "控制震荡 V1 缺 fieldReviewTargets。");
    }
    if (!String(controlOscillationCurrent.reviewBoundary || "").includes("不自动改 PID")) {
      pushUnique(blockers, "控制震荡 V1 缺不自动改 PID 边界。");
    }
    if (!String(controlOscillationCurrent.reviewBoundary || "").includes("不自动启停")) {
      pushUnique(blockers, "控制震荡 V1 缺不自动启停边界。");
    }
    const frequencyCommandFeedbackIndicator = controlOscillationRiskIndicators.find(
      (item) => item?.key === "frequency_command_feedback_gap"
    );
    const startStopEventIndicator = controlOscillationRiskIndicators.find((item) => item?.key === "start_stop_event_gap");
    if (!frequencyCommandFeedbackIndicator || !["gap", "watch"].includes(frequencyCommandFeedbackIndicator.status)) {
      pushUnique(blockers, "控制震荡 V1 缺频率命令/反馈 gap/watch 指示。");
    }
    if (!startStopEventIndicator || !["gap", "watch"].includes(startStopEventIndicator.status)) {
      pushUnique(blockers, "控制震荡 V1 缺启停事件 gap/watch 指示。");
    }
    const ledgerEvidence = controlOscillationCurrent.ledgerEvidence || {};
    if (!["ready", "partial", "blocked", "unavailable"].includes(ledgerEvidence.status || "unavailable")) {
      pushUnique(blockers, `控制震荡台账导入状态越界：${ledgerEvidence.status || "--"}`);
    }
    if (!String(ledgerEvidence.controlBoundary || "").includes("不自动改 PID")) {
      pushUnique(blockers, "控制震荡台账导入缺不自动改 PID 边界。");
    }
    if (!String(ledgerEvidence.controlBoundary || "").includes("不自动启停")) {
      pushUnique(blockers, "控制震荡台账导入缺不自动启停边界。");
    }
    const fieldDataPreflight = ledgerEvidence.preflight || {};
    if (!["ready", "partial", "waiting", "blocked", "unavailable"].includes(fieldDataPreflight.status || "unavailable")) {
      pushUnique(blockers, `现场 CSV 预检状态越界：${fieldDataPreflight.status || "--"}`);
    }
    if (!String(fieldDataPreflight.controlBoundary || "").includes("不写真实 PLC")) {
      pushUnique(blockers, "现场 CSV 预检缺不写真实 PLC 边界。");
    }
    const fieldDataPromotion = ledgerEvidence.promotion || {};
    if (!["ready", "partial", "waiting", "blocked", "unavailable"].includes(fieldDataPromotion.status || "unavailable")) {
      pushUnique(blockers, `现场 CSV 正式导入 gate 状态越界：${fieldDataPromotion.status || "--"}`);
    }
    if (!String(fieldDataPromotion.controlBoundary || "").includes("不写真实 PLC")) {
      pushUnique(blockers, "现场 CSV 正式导入 gate 缺不写真实 PLC 边界。");
    }
    for (const indicator of controlOscillationRiskIndicators) {
      if (!["active", "watch", "normal", "gap", "unknown"].includes(indicator?.status)) {
        pushUnique(blockers, `${indicator?.key || "--"} 控制震荡风险指示 status 越界：${indicator?.status || "--"}`);
      }
      const boundary = String(indicator?.boundary || "");
      if (boundary.includes("自动改 PID") && !boundary.includes("不自动改 PID")) {
        pushUnique(blockers, `${indicator?.key || "--"} 控制震荡风险指示边界疑似允许自动改 PID。`);
      }
      if (boundary.includes("自动启停") && !boundary.includes("不自动启停")) {
        pushUnique(blockers, `${indicator?.key || "--"} 控制震荡风险指示边界疑似允许自动启停。`);
      }
    }
  }

  const valveStiction = itemByKey(matrix, "valveStiction");
  if (valveStiction?.currentFeasibility === "can_do_v1") {
    pushUnique(blockers, "阀门卡滞诊断当前不能标为可做 V1；缺命令/反馈/动作历史时只能疑似判断。");
  }

  if (!fieldChecklist) {
    pushUnique(blockers, "缺 fieldVerificationChecklist。");
  } else {
    if (fieldChecklist.controlBoundary !== "read_only_point_verification_only") {
      pushUnique(blockers, `fieldVerificationChecklist.controlBoundary 异常：${fieldChecklist.controlBoundary || "--"}`);
    }
    if (Number(fieldChecklist.total) !== REQUIRED_FIELD_CHECKLIST_KEYS.length || fieldItems.length !== REQUIRED_FIELD_CHECKLIST_KEYS.length) {
      pushUnique(blockers, `现场复核清单项数异常：total=${fieldChecklist.total ?? "--"} items=${fieldItems.length}`);
    }
    if (Number(fieldChecklist.p0Count || 0) < 4) {
      pushUnique(blockers, `现场复核清单 P0 数不足：${fieldChecklist.p0Count ?? "--"}`);
    }
    for (const key of REQUIRED_FIELD_CHECKLIST_KEYS) {
      if (!fieldKeys.includes(key)) {
        pushUnique(blockers, `现场复核清单缺少 key=${key}`);
      }
    }
    for (const item of fieldItems) {
      if (!["P0", "P1", "P2"].includes(item?.priority)) {
        pushUnique(blockers, `${item?.key || "--"} priority 越界：${item?.priority || "--"}`);
      }
      if (item?.allowedMode && item.allowedMode !== "field_review_only") {
        pushUnique(blockers, `${item?.key || "--"} allowedMode 应保持 field_review_only，当前=${item.allowedMode}`);
      }
      const boundary = String(item?.boundary || "");
      if (["assisted", "enforced"].some((mode) => String(item?.allowedMode || "").includes(mode))) {
        pushUnique(blockers, `${item?.key || "--"} 不应开放 assisted/enforced 模式。`);
      }
      if (!boundary.includes("不") && !boundary.includes("只")) {
        pushUnique(warnings, `${item?.key || "--"} 边界说明偏弱：${boundary || "--"}`);
      }
    }
    const terminalSafetyTask = fieldItems.find((item) => item?.key === "terminal-safety-signal-closure");
    if (terminalSafetyTask && !String(terminalSafetyTask.boundary || "").includes("assisted")) {
      pushUnique(blockers, "末端安全复核任务缺少 assisted 锁定边界。");
    }
    const chillerSamplingTask = fieldItems.find((item) => item?.key === "chiller-combination-sampling-plan");
    if (chillerSamplingTask && !String(chillerSamplingTask.boundary || "").includes("不拆单台 COP")) {
      pushUnique(blockers, "主机组合采样任务缺少不拆单台 COP 边界。");
    }
  }

  const readyNowCount = Number(matrix?.readyNowCount || 0);
  const directionalCount = Number(matrix?.directionalCount || 0);
  const pointGapCount = Number(matrix?.pointGapCount || 0);
  if (readyNowCount < 3) {
    pushUnique(warnings, `当前可做 V1 项较少：${readyNowCount}。`);
  }
  if (directionalCount < 1) {
    pushUnique(warnings, "当前没有方向性诊断项，需确认 B/C 档是否被误升格。");
  }
  if (pointGapCount < 1) {
    pushUnique(warnings, "当前没有补点项；若未接入末端安全数据，需复核 C 档边界。");
  }

  return {
    ok: blockers.length === 0,
    finalDecision: blockers.length === 0 ? "DIAGNOSTIC_READINESS_READY" : "NO_GO",
    advisorStatus: advisor?.status || null,
    executionMode: advisor?.executionMode || null,
    matrix: matrix
      ? {
          basis: matrix.basis || null,
          scope: matrix.scope || null,
          total: matrix.total ?? null,
          readyNowCount,
          directionalCount,
          pointGapCount,
          controlBoundary: matrix.controlBoundary || null,
          boundaryNotes: Array.isArray(matrix.boundaryNotes) ? matrix.boundaryNotes : [],
          items
        }
      : null,
    fieldVerificationChecklist: fieldChecklist
      ? {
          basis: fieldChecklist.basis || null,
          scope: fieldChecklist.scope || null,
          total: fieldChecklist.total ?? null,
          p0Count: Number(fieldChecklist.p0Count || 0),
          p1Count: Number(fieldChecklist.p1Count || 0),
          controlBoundary: fieldChecklist.controlBoundary || null,
          items: fieldItems
        }
      : null,
    diagnosticItems,
    blockers,
    warnings
  };
}

function renderMarkdown(report) {
  const matrix = report.summary.matrix || {};
  const items = Array.isArray(matrix.items) ? matrix.items : [];
  const fieldChecklist = report.summary.fieldVerificationChecklist || {};
  const fieldItems = Array.isArray(fieldChecklist.items) ? fieldChecklist.items : [];
  const instrumentDiagnostic = Array.isArray(report.summary.diagnosticItems)
    ? report.summary.diagnosticItems.find((item) => item?.key === "instrumentDataQuality")
    : null;
  const instrumentCurrent = instrumentDiagnostic?.current || {};
  const driftCandidates = Array.isArray(instrumentCurrent.driftCandidates) ? instrumentCurrent.driftCandidates : [];
  const crossChecks = Array.isArray(instrumentCurrent.crossChecks) ? instrumentCurrent.crossChecks : [];
	  const fieldReviewTargets = Array.isArray(instrumentCurrent.fieldReviewTargets)
	    ? instrumentCurrent.fieldReviewTargets
	    : [];
  const sensorLedgerEvidence = instrumentCurrent.sensorLedgerEvidence || {};
  const hydraulicDiagnostic = Array.isArray(report.summary.diagnosticItems)
    ? report.summary.diagnosticItems.find((item) => item?.key === "chilledHydraulicBalance")
    : null;
  const hydraulicCurrent = hydraulicDiagnostic?.current || {};
  const hydraulicRiskIndicators = Array.isArray(hydraulicCurrent.riskIndicators)
    ? hydraulicCurrent.riskIndicators
    : [];
  const hydraulicFieldReviewTargets = Array.isArray(hydraulicCurrent.fieldReviewTargets)
    ? hydraulicCurrent.fieldReviewTargets
    : [];
  const controlOscillationDiagnostic = Array.isArray(report.summary.diagnosticItems)
    ? report.summary.diagnosticItems.find((item) => item?.key === "controlOscillation")
    : null;
  const controlOscillationCurrent = controlOscillationDiagnostic?.current || {};
  const controlOscillationRiskIndicators = Array.isArray(controlOscillationCurrent.riskIndicators)
    ? controlOscillationCurrent.riskIndicators
    : [];
  const controlOscillationFieldReviewTargets = Array.isArray(controlOscillationCurrent.fieldReviewTargets)
    ? controlOscillationCurrent.fieldReviewTargets
    : [];
  return `# /optimize-demo 诊断可行性矩阵检查

- 结论：${report.finalDecision}
- 站点：${report.siteId}
- BFF：${report.bffBaseUrl}
- 生成时间：${report.generatedAt}
- 请求：load=${report.inputs.loadKw}kW, outdoor=${report.inputs.outdoorTempC}℃, mode=${report.inputs.mode}

## 汇总

| 项 | 值 |
| --- | --- |
| Advisor 状态 | ${report.summary.advisorStatus || "--"} |
| 执行模式 | ${report.summary.executionMode || "--"} |
| 矩阵总项 | ${matrix.total ?? "--"} |
| 可做 V1 | ${matrix.readyNowCount ?? "--"} |
| 只能疑似判断 | ${matrix.directionalCount ?? "--"} |
| 暂不能做/补点 | ${matrix.pointGapCount ?? "--"} |
| 控制边界 | ${matrix.controlBoundary || "--"} |
| 现场复核清单 | ${(fieldChecklist.p0Count ?? "--")} P0 / ${(fieldChecklist.p1Count ?? "--")} P1 |
| 复核清单边界 | ${fieldChecklist.controlBoundary || "--"} |

## 矩阵项

| key | 档位 | 状态 | 可行性 | 模式 | 边界 |
| --- | --- | --- | --- | --- | --- |
${items.map((item) => `| ${item.key || "--"} | ${item.tier || "--"} | ${item.status || "--"} | ${item.currentFeasibility || "--"} | ${item.allowedMode || "--"} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

## 现场复核清单

| key | 优先级 | 任务 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- |
${fieldItems.map((item) => `| ${item.key || "--"} | ${item.priority || "--"} | ${item.title || "--"} | ${String(item.verificationTarget || "--").replace(/\|/g, "/")} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

## 仪表偏移 V1

| 项 | 值 |
| --- | --- |
| 候选数 | ${driftCandidates.length} |
| 交叉校验 | ${crossChecks.length} |
| 现场复核对象 | ${fieldReviewTargets.length} |
| 传感器台账预检 | ${sensorLedgerEvidence.status || "--"} / accepted=${sensorLedgerEvidence.acceptedRows ?? "--"} / missing=${sensorLedgerEvidence.missingInputCount ?? "--"} |
| 边界 | ${instrumentCurrent.reviewBoundary || "--"} |
| 台账边界 | ${sensorLedgerEvidence.controlBoundary || "--"} |

### 偏移候选

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
${driftCandidates.map((item) => `| ${item.key || "--"} | ${item.status || "--"} | ${item.label || item.metric || "--"} | ${item.value ?? "--"}${item.unit || ""} | ${Array.isArray(item.suspectedSignals) ? item.suspectedSignals.join(" / ") : "--"} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

### 交叉校验

| key | 状态 | 数值 | 证据 | 复核对象 |
| --- | --- | --- | --- | --- |
${crossChecks.map((item) => `| ${item.key || "--"} | ${item.status || "--"} | ${item.value ?? "--"}${item.unit || ""} | ${String(item.evidence || "--").replace(/\|/g, "/")} | ${String(item.reviewTarget || "--").replace(/\|/g, "/")} |`).join("\n")}

## 水力平衡 V1

| 项 | 值 |
| --- | --- |
| 风险指示 | ${hydraulicRiskIndicators.length} |
| 现场复核对象 | ${hydraulicFieldReviewTargets.length} |
| active 风险 | ${hydraulicCurrent.activeRiskCount ?? "--"} |
| 证据缺口 | ${hydraulicCurrent.gapCount ?? "--"} |
| 边界 | ${hydraulicCurrent.reviewBoundary || "--"} |

### 水力风险指示

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
${hydraulicRiskIndicators.map((item) => `| ${item.key || "--"} | ${item.status || "--"} | ${item.label || "--"} | ${item.value ?? "--"}${item.unit || ""} | ${String(item.reviewTarget || "--").replace(/\|/g, "/")} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

### 水力现场复核对象

| key | 优先级 | 任务 | 触发原因 | 边界 |
| --- | --- | --- | --- | --- |
${hydraulicFieldReviewTargets.map((item) => `| ${item.key || "--"} | ${item.priority || "--"} | ${item.title || "--"} | ${String(item.trigger || "--").replace(/\|/g, "/")} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

## 控制震荡 V1

| 项 | 值 |
| --- | --- |
| 风险指示 | ${controlOscillationRiskIndicators.length} |
| 现场复核对象 | ${controlOscillationFieldReviewTargets.length} |
| active 风险 | ${controlOscillationCurrent.activeRiskCount ?? "--"} |
| 观察项 | ${controlOscillationCurrent.watchRiskCount ?? "--"} |
| 证据缺口 | ${controlOscillationCurrent.gapCount ?? "--"} |
| 台账导入 | ${controlOscillationCurrent.ledgerEvidence?.status || "--"} / ${controlOscillationCurrent.ledgerEvidence?.evidenceMode || "--"} / accepted=${controlOscillationCurrent.ledgerEvidence?.acceptedRows ?? "--"} |
| 现场CSV预检 | ${controlOscillationCurrent.ledgerEvidence?.preflight?.status || "--"} / missing=${controlOscillationCurrent.ledgerEvidence?.preflight?.missingInputCount ?? "--"} / accepted=${controlOscillationCurrent.ledgerEvidence?.preflight?.acceptedRows ?? "--"} |
| 正式导入Gate | ${controlOscillationCurrent.ledgerEvidence?.promotion?.status || "--"} / accepted=${controlOscillationCurrent.ledgerEvidence?.promotion?.acceptedRows ?? "--"} |
| 边界 | ${controlOscillationCurrent.reviewBoundary || "--"} |

### 控制震荡风险指示

| key | 状态 | 指标 | 数值 | 复核对象 | 边界 |
| --- | --- | --- | --- | --- | --- |
${controlOscillationRiskIndicators.map((item) => `| ${item.key || "--"} | ${item.status || "--"} | ${item.label || "--"} | ${item.value ?? "--"}${item.unit || ""} | ${String(item.reviewTarget || "--").replace(/\|/g, "/")} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

### 控制震荡现场复核对象

| key | 优先级 | 任务 | 触发原因 | 边界 |
| --- | --- | --- | --- | --- |
${controlOscillationFieldReviewTargets.map((item) => `| ${item.key || "--"} | ${item.priority || "--"} | ${item.title || "--"} | ${String(item.trigger || "--").replace(/\|/g, "/")} | ${String(item.boundary || "--").replace(/\|/g, "/")} |`).join("\n")}

## 边界说明

${Array.isArray(matrix.boundaryNotes) && matrix.boundaryNotes.length ? matrix.boundaryNotes.map((item) => `- ${item}`).join("\n") : "- --"}

## 阻断项

${report.blockers.length ? report.blockers.map((item) => `- ${item}`).join("\n") : "- 无"}

## 警告

${report.warnings.length ? report.warnings.map((item) => `- ${item}`).join("\n") : "- 无"}

## 结论口径

- 本检查只读取 /optimize 建议响应，不创建、审批、dispatch 或 rollback 执行单。
- A档可做 V1；B档只能输出疑似风险和复核建议；C档只进入补点清单。
- 不证明真实 PLC 已接入，不开放 assisted/enforced，不承诺固定节能。
`;
}

async function main() {
  const response = await requestJson("POST", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize`, {
    context: {
      siteId: SITE_ID
    },
    inputs: {
      loadKw: LOAD_KW,
      outdoorTempC: OUTDOOR_TEMP_C,
      mode: MODE
    }
  });
  const summary = summarizeMatrix(response);
  const report = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    finalDecision: summary.finalDecision,
    inputs: {
      loadKw: LOAD_KW,
      outdoorTempC: OUTDOOR_TEMP_C,
      mode: MODE
    },
    response: {
      ok: response.ok,
      status: response.status,
      url: response.url,
      error: response.error
    },
    summary,
    blockers: summary.blockers,
    warnings: summary.warnings,
    reportFiles: {
      json: rel(OUTPUT_JSON),
      markdown: rel(OUTPUT_MD)
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo diagnostic readiness: ${report.finalDecision}\n`);
  process.stdout.write(
    `matrix=${summary.matrix ? `${summary.matrix.readyNowCount} ready / ${summary.matrix.directionalCount} directional / ${summary.matrix.pointGapCount} point-gap` : "--"}\n`
  );
  process.stdout.write(
    `fieldChecklist=${summary.fieldVerificationChecklist ? `${summary.fieldVerificationChecklist.p0Count} P0 / ${summary.fieldVerificationChecklist.p1Count} P1` : "--"}\n`
  );
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

  if (STRICT && report.finalDecision !== "DIAGNOSTIC_READINESS_READY") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`optimize-demo diagnostic readiness failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
