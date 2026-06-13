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
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_TIMEOUT_MS, 30000);
const LOAD_KW = normalizeNumber(process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_LOAD_KW, 1422);
const OUTDOOR_TEMP_C = normalizeNumber(process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_OUTDOOR_TEMP_C, 22.9);
const MODE = normalizeText(process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_MODE) || "cooling";
const OUTPUT_JSON =
  process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_JSON ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-verification-package-latest.json");
const OUTPUT_MD =
  process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_MD ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-verification-package-latest.md");
const OUTPUT_HTML =
  process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_HTML ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-verification-package-latest.html");
const OUTPUT_CONTROL_TREND_CSV =
  process.env.OPTIMIZE_DEMO_CONTROL_TREND_TEMPLATE_CSV ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-command-feedback-template-latest.csv");
const OUTPUT_START_STOP_CSV =
  process.env.OPTIMIZE_DEMO_START_STOP_TEMPLATE_CSV ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-template-latest.csv");
const OUTPUT_CONTROL_PARAMETER_CSV =
  process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_TEMPLATE_CSV ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-parameter-template-latest.csv");
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_FIELD_PACKAGE_STRICT).toLowerCase()
);

const REQUIRED_TASK_KEYS = [
  "sensor-calibration-installation-ledger",
  "terminal-safety-signal-closure",
  "plc-pump-protection-mapping",
  "chiller-combination-sampling-plan",
  "branch-hydraulic-history-window",
  "control-command-feedback-event-window",
  "tower-field-inspection-ledger"
];

const REQUIRED_BOUNDARIES = [
  "不创建执行单",
  "不审批",
  "不 dispatch",
  "不写真实 PLC",
  "不自动启停主机",
  "不进入 enforced",
  "不计算多机单台 COP",
  "不判定设备故障",
  "不自动改 PID",
  "不自动启停设备"
];

const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2
};

const CONTROL_OSCILLATION_TEMPLATE_BOUNDARY =
  "模板只用于补齐控制震荡诊断证据，不自动改 PID，不自动启停设备，不写真实 PLC。";

const CONTROL_TREND_TEMPLATE_COLUMNS = [
  { key: "timestamp", label: "采样时间", required: true, example: "2026-06-13T10:00:00+08:00" },
  { key: "siteId", label: "站点ID", required: true, example: "140" },
  { key: "loopKey", label: "控制回路", required: true, example: "chilled_water_delta_t" },
  { key: "equipmentType", label: "设备类型", required: true, example: "chilled_pump" },
  { key: "equipmentId", label: "设备ID", required: true, example: "CHP4" },
  { key: "signalRole", label: "信号角色", required: true, example: "frequency_command" },
  { key: "pointCode", label: "点位编码", required: true, example: "B25_AI_CHWP_FREQ_CMD" },
  { key: "pointName", label: "点位名称", required: true, example: "冷冻泵频率命令" },
  { key: "value", label: "数值", required: true, example: "40.0" },
  { key: "unit", label: "单位", required: true, example: "Hz" },
  { key: "controlMode", label: "控制模式", required: false, example: "auto" },
  { key: "sampleIntervalSec", label: "采样周期秒", required: true, example: "60" },
  { key: "qualityFlag", label: "质量标记", required: true, example: "good" },
  { key: "sourceSystem", label: "来源系统", required: true, example: "SCADA" },
  { key: "remark", label: "备注", required: false, example: "同一时间轴对齐" }
];

const START_STOP_EVENT_TEMPLATE_COLUMNS = [
  { key: "eventAt", label: "事件时间", required: true, example: "2026-06-13T10:15:00+08:00" },
  { key: "siteId", label: "站点ID", required: true, example: "140" },
  { key: "equipmentType", label: "设备类型", required: true, example: "chiller" },
  { key: "equipmentId", label: "设备ID", required: true, example: "CH7" },
  { key: "eventType", label: "事件类型", required: true, example: "start" },
  { key: "previousStatus", label: "前状态", required: false, example: "off" },
  { key: "nextStatus", label: "后状态", required: true, example: "on" },
  { key: "commandSource", label: "命令来源", required: false, example: "operator" },
  { key: "reasonCode", label: "原因码", required: false, example: "load_increase" },
  { key: "runMinutesBeforeEvent", label: "事件前运行分钟", required: false, example: "180" },
  { key: "stopMinutesBeforeEvent", label: "事件前停机分钟", required: false, example: "240" },
  { key: "alarmActive", label: "是否有告警", required: true, example: "false" },
  { key: "sourceSystem", label: "来源系统", required: true, example: "SCADA" },
  { key: "remark", label: "备注", required: false, example: "用于最小运行/停机时间统计" }
];

const CONTROL_PARAMETER_TEMPLATE_COLUMNS = [
  { key: "effectiveAt", label: "生效时间", required: true, example: "2026-06-13T09:00:00+08:00" },
  { key: "siteId", label: "站点ID", required: true, example: "140" },
  { key: "loopKey", label: "控制回路", required: true, example: "tower_fan_tcws" },
  { key: "equipmentType", label: "设备类型", required: false, example: "cooling_tower" },
  { key: "equipmentId", label: "设备ID", required: false, example: "CT1" },
  { key: "parameterKey", label: "参数键", required: true, example: "deadband_c" },
  { key: "parameterName", label: "参数名称", required: true, example: "冷却水温控制死区" },
  { key: "value", label: "参数值", required: true, example: "0.5" },
  { key: "unit", label: "单位", required: false, example: "℃" },
  { key: "previousValue", label: "上一值", required: false, example: "0.8" },
  { key: "rollbackValue", label: "回退值", required: false, example: "0.8" },
  { key: "changeTicket", label: "变更单号", required: false, example: "field-review-001" },
  { key: "approvedBy", label: "批准人", required: false, example: "现场负责人" },
  { key: "sourceSystem", label: "来源系统", required: true, example: "PLC/SCADA" },
  { key: "remark", label: "备注", required: false, example: "仅记录参数台账，不自动写入" }
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

function escapePipe(value) {
  return String(value ?? "--").replace(/\|/g, "/").replace(/\r?\n/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listText(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" / ") || "--";
  }
  return normalizeText(String(value ?? "")) || "--";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function renderCsv(columns, rows) {
  const header = columns.map((column) => csvEscape(column.key)).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function itemByKey(items, key) {
  return (Array.isArray(items) ? items : []).find((item) => item?.key === key) || null;
}

function sortTasks(tasks) {
  return [...(Array.isArray(tasks) ? tasks : [])].sort((left, right) => {
    const leftRank = PRIORITY_ORDER[left?.priority] ?? 99;
    const rightRank = PRIORITY_ORDER[right?.priority] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left?.key || "").localeCompare(String(right?.key || ""));
  });
}

function buildEngineeringSummary(matrix, checklist) {
  return {
    positioning: "140/B25 /optimize-demo 现场复核交付包",
    purpose: "把 AI 优化建议的 B/C 档数据缺口转成现场可执行、可验收的点位/资料复核任务。",
    diagnosticReadiness: matrix
      ? `${matrix.readyNowCount ?? "--"} 可做 V1 / ${matrix.directionalCount ?? "--"} 疑似判断 / ${matrix.pointGapCount ?? "--"} 补点`
      : "--",
    fieldTaskSummary: checklist ? `${checklist.p0Count ?? "--"} P0 / ${checklist.p1Count ?? "--"} P1` : "--",
    controlBoundary: "read_only_point_verification_only",
    handoffDecision: "先完成 P0 复核，再提高 Advisor 置信度；未闭合前不得把 shadow 建议升级为 assisted/enforced。"
  };
}

function buildNextActions(tasks) {
  const p0Tasks = sortTasks(tasks).filter((item) => item.priority === "P0");
  const p1Tasks = sortTasks(tasks).filter((item) => item.priority === "P1");
  return [
    {
      step: 1,
      title: "先闭合 P0 复核",
      detail: p0Tasks.map((item) => item.title).join("；") || "--",
      acceptance: "P0 任务均形成现场证据、责任人和复核日期。"
    },
    {
      step: 2,
      title: "补齐 P1 趋势和巡检证据",
      detail: p1Tasks.map((item) => item.title).join("；") || "--",
      acceptance: "支路趋势和塔巡检证据能与 24h 运行窗口对齐。"
    },
    {
      step: 3,
      title: "回灌 /optimize-demo 置信度",
      detail: "仅把证据用于提高诊断置信度和 shadow 对比质量，不新增真实 PLC 写入链路。",
      acceptance: "Advisor 仍保持 read_only/shadow，页面和报告不出现自动启停或 enforced 承诺。"
    }
  ];
}

function buildTaskWorkbookRows(tasks) {
  return sortTasks(tasks).map((task) => ({
    key: task.key || null,
    priority: task.priority || null,
    title: task.title || null,
    ownerRole: task.ownerRole || null,
    sourceDiagnosticKey: task.sourceDiagnosticKey || null,
    sourceTier: task.sourceTier || null,
    verificationTarget: task.verificationTarget || null,
    missingData: Array.isArray(task.missingData) ? task.missingData : [],
    requiredEvidence: Array.isArray(task.requiredEvidence) ? task.requiredEvidence : [],
    acceptanceCriteria: task.acceptanceCriteria || null,
    boundary: task.boundary || null,
    allowedMode: task.allowedMode || null,
    fieldStatus: "待现场复核",
    evidenceOwner: "",
    evidenceFileOrSystem: "",
    verifiedAt: "",
    reviewer: "",
    reviewResult: ""
  }));
}

function columnsToTemplateRows(columns, tableKey) {
  return columns.map((column, index) => ({
    tableKey,
    order: index + 1,
    fieldKey: column.key,
    label: column.label,
    required: column.required === true,
    example: column.example || "",
    boundary: CONTROL_OSCILLATION_TEMPLATE_BOUNDARY
  }));
}

function buildControlOscillationLedgerTemplate() {
  const trendRows = [
    {
      timestamp: "2026-06-13T10:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "chilled_water_delta_t",
      equipmentType: "chilled_pump",
      equipmentId: "CHP4",
      signalRole: "frequency_command",
      pointCode: "B25_AI_CHWP_FREQ_CMD",
      pointName: "冷冻泵频率命令",
      value: "40.0",
      unit: "Hz",
      controlMode: "auto",
      sampleIntervalSec: "60",
      qualityFlag: "good",
      sourceSystem: "SCADA",
      remark: "与反馈、供回水温度、旁通阀按同一时间轴对齐"
    },
    {
      timestamp: "2026-06-13T10:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "chilled_water_delta_t",
      equipmentType: "chilled_pump",
      equipmentId: "CHP4",
      signalRole: "frequency_feedback",
      pointCode: "B25_CHWP_FREQ_FB",
      pointName: "冷冻泵频率反馈",
      value: "39.8",
      unit: "Hz",
      controlMode: "auto",
      sampleIntervalSec: "60",
      qualityFlag: "good",
      sourceSystem: "SCADA",
      remark: "用于判断命令/反馈跟随偏差"
    },
    {
      timestamp: "2026-06-13T10:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "tower_fan_tcws",
      equipmentType: "cooling_tower",
      equipmentId: "CT1",
      signalRole: "frequency_command",
      pointCode: "B25_CT_FAN_FREQ_CMD",
      pointName: "塔风机频率命令",
      value: "30.0",
      unit: "Hz",
      controlMode: "auto",
      sampleIntervalSec: "60",
      qualityFlag: "good",
      sourceSystem: "SCADA",
      remark: "用于判断塔侧 hunting"
    }
  ];
  const startStopRows = [
    {
      eventAt: "2026-06-13T10:15:00+08:00",
      siteId: SITE_ID,
      equipmentType: "chiller",
      equipmentId: "CH7",
      eventType: "start",
      previousStatus: "off",
      nextStatus: "on",
      commandSource: "operator",
      reasonCode: "load_increase",
      runMinutesBeforeEvent: "",
      stopMinutesBeforeEvent: "240",
      alarmActive: "false",
      sourceSystem: "SCADA",
      remark: "用于校验最小停机时间和频繁启停"
    },
    {
      eventAt: "2026-06-13T11:05:00+08:00",
      siteId: SITE_ID,
      equipmentType: "cooling_tower",
      equipmentId: "CT1",
      eventType: "stop",
      previousStatus: "on",
      nextStatus: "off",
      commandSource: "auto",
      reasonCode: "tcws_below_band",
      runMinutesBeforeEvent: "50",
      stopMinutesBeforeEvent: "",
      alarmActive: "false",
      sourceSystem: "SCADA",
      remark: "用于校验加减塔延时和防震荡死区"
    }
  ];
  const parameterRows = [
    {
      effectiveAt: "2026-06-13T09:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "chilled_water_delta_t",
      equipmentType: "chilled_pump",
      equipmentId: "CHP4",
      parameterKey: "ramp_limit_hz_per_min",
      parameterName: "冷冻泵频率斜率限制",
      value: "1",
      unit: "Hz/min",
      previousValue: "",
      rollbackValue: "",
      changeTicket: "",
      approvedBy: "",
      sourceSystem: "PLC",
      remark: "只记录参数台账，不自动写 PLC"
    },
    {
      effectiveAt: "2026-06-13T09:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "tower_fan_tcws",
      equipmentType: "cooling_tower",
      equipmentId: "CT1",
      parameterKey: "deadband_c",
      parameterName: "冷却水温控制死区",
      value: "0.5",
      unit: "℃",
      previousValue: "",
      rollbackValue: "",
      changeTicket: "",
      approvedBy: "",
      sourceSystem: "PLC",
      remark: "用于判断塔风机频率震荡，不自动改 PID"
    },
    {
      effectiveAt: "2026-06-13T09:00:00+08:00",
      siteId: SITE_ID,
      loopKey: "chiller_staging",
      equipmentType: "chiller",
      equipmentId: "CH7",
      parameterKey: "min_on_minutes",
      parameterName: "主机最小运行时间",
      value: "30",
      unit: "min",
      previousValue: "",
      rollbackValue: "",
      changeTicket: "",
      approvedBy: "",
      sourceSystem: "PLC",
      remark: "用于频繁启停诊断，不自动启停设备"
    }
  ];
  return {
    basis: "control_oscillation_field_ledger_template_v1",
    scope: "field_review_only",
    ownerRole: "自控工程师 / PLC 工程师 / 运行值班负责人",
    controlBoundary: CONTROL_OSCILLATION_TEMPLATE_BOUNDARY,
    acceptanceCriteria: [
      "高频趋势、启停事件和参数台账可按同一时间轴对齐。",
      "采样周期建议 <= 60 秒；若只能小时级，控制震荡仍只能方向性判断。",
      "任何 PID、死区、延时或启停参数调整必须由人工审批和 PLC 本地保护兜底。"
    ],
    tables: [
      {
        key: "control_command_feedback_trend",
        title: "控制命令/反馈高频趋势",
        outputCsv: rel(OUTPUT_CONTROL_TREND_CSV),
        requiredSampleIntervalSecMax: 60,
        columns: CONTROL_TREND_TEMPLATE_COLUMNS,
        fieldRows: columnsToTemplateRows(CONTROL_TREND_TEMPLATE_COLUMNS, "control_command_feedback_trend"),
        exampleRows: trendRows
      },
      {
        key: "start_stop_event_ledger",
        title: "设备启停事件台账",
        outputCsv: rel(OUTPUT_START_STOP_CSV),
        columns: START_STOP_EVENT_TEMPLATE_COLUMNS,
        fieldRows: columnsToTemplateRows(START_STOP_EVENT_TEMPLATE_COLUMNS, "start_stop_event_ledger"),
        exampleRows: startStopRows
      },
      {
        key: "control_parameter_ledger",
        title: "PID/死区/延时参数台账",
        outputCsv: rel(OUTPUT_CONTROL_PARAMETER_CSV),
        columns: CONTROL_PARAMETER_TEMPLATE_COLUMNS,
        fieldRows: columnsToTemplateRows(CONTROL_PARAMETER_TEMPLATE_COLUMNS, "control_parameter_ledger"),
        exampleRows: parameterRows
      }
    ]
  };
}

function summarizeFieldPackage(response) {
  const blockers = [];
  const warnings = [];
  if (!response.ok || response.payload?.ok !== true) {
    pushUnique(blockers, `optimize draft 请求失败：${response.error || response.status || "payload invalid"}`);
  }

  const details = response.payload?.details || {};
  const advisor = details.operationalDiagnosticsAdvisor || null;
  const matrix = advisor?.summary?.diagnosticReadinessMatrix || null;
  const checklist = advisor?.summary?.fieldVerificationChecklist || null;
  const matrixItems = Array.isArray(matrix?.items) ? matrix.items : [];
  const tasks = sortTasks(Array.isArray(checklist?.items) ? checklist.items : []);
  const controlOscillationLedgerTemplate = buildControlOscillationLedgerTemplate();
  const taskKeys = tasks.map((item) => item?.key).filter(Boolean);

  if (!advisor) {
    pushUnique(blockers, "缺 operationalDiagnosticsAdvisor。");
  } else if (advisor.executionMode !== "read_only") {
    pushUnique(blockers, `operationalDiagnosticsAdvisor.executionMode 越界：${advisor.executionMode || "--"}`);
  }

  if (!matrix) {
    pushUnique(blockers, "缺 diagnosticReadinessMatrix，无法形成可行性依据。");
  } else {
    if (matrix.controlBoundary !== "read_only_or_shadow_only") {
      pushUnique(blockers, `诊断矩阵控制边界异常：${matrix.controlBoundary || "--"}`);
    }
    if (Number(matrix.readyNowCount || 0) < 4) {
      pushUnique(warnings, `当前 A档可做项少于预期：${matrix.readyNowCount ?? "--"}`);
    }
  }

  if (!checklist) {
    pushUnique(blockers, "缺 fieldVerificationChecklist。");
  } else {
    if (checklist.controlBoundary !== "read_only_point_verification_only") {
      pushUnique(blockers, `现场复核清单控制边界异常：${checklist.controlBoundary || "--"}`);
    }
    if (Number(checklist.total) !== REQUIRED_TASK_KEYS.length || tasks.length !== REQUIRED_TASK_KEYS.length) {
      pushUnique(blockers, `现场复核任务数异常：total=${checklist.total ?? "--"} items=${tasks.length}`);
    }
    if (Number(checklist.p0Count || 0) < 4) {
      pushUnique(blockers, `P0 复核任务不足：${checklist.p0Count ?? "--"}`);
    }
    if (Number(checklist.p1Count || 0) < 2) {
      pushUnique(blockers, `P1 复核任务不足：${checklist.p1Count ?? "--"}`);
    }
    for (const key of REQUIRED_TASK_KEYS) {
      if (!taskKeys.includes(key)) {
        pushUnique(blockers, `现场复核清单缺少 key=${key}`);
      }
    }
  }

  for (const task of tasks) {
    if (!["P0", "P1", "P2"].includes(task?.priority)) {
      pushUnique(blockers, `${task?.key || "--"} priority 越界：${task?.priority || "--"}`);
    }
    if (task?.allowedMode !== "field_review_only") {
      pushUnique(blockers, `${task?.key || "--"} allowedMode 应保持 field_review_only，当前=${task?.allowedMode || "--"}`);
    }
    for (const requiredField of ["title", "verificationTarget", "acceptanceCriteria", "boundary", "ownerRole"]) {
      if (!normalizeText(task?.[requiredField])) {
        pushUnique(blockers, `${task?.key || "--"} 缺少 ${requiredField}`);
      }
    }
    if (!Array.isArray(task?.requiredEvidence) || task.requiredEvidence.length === 0) {
      pushUnique(blockers, `${task?.key || "--"} 缺 requiredEvidence`);
    }
    if (!Array.isArray(task?.missingData) || task.missingData.length === 0) {
      pushUnique(warnings, `${task?.key || "--"} 缺 missingData，现场任务可能难以解释来源。`);
    }
  }

  const chillerSampling = itemByKey(tasks, "chiller-combination-sampling-plan");
  if (chillerSampling) {
    const boundary = String(chillerSampling.boundary || "");
    if (!boundary.includes("不拆单台 COP") || !boundary.includes("不自动启停主机")) {
      pushUnique(blockers, "主机组合采样任务必须声明不拆单台 COP、不开自动启停。");
    }
    if (!String(chillerSampling.acceptanceCriteria || "").includes(">=30")) {
      pushUnique(blockers, "主机组合采样任务缺少 >=30 样本低置信门槛。");
    }
  }

  const terminalSafety = itemByKey(tasks, "terminal-safety-signal-closure");
  if (terminalSafety && !String(terminalSafety.boundary || "").includes("不允许 assisted/enforced")) {
    pushUnique(blockers, "末端安全任务必须声明未闭合前不允许 assisted/enforced。");
  }

  const sensorLedger = itemByKey(tasks, "sensor-calibration-installation-ledger");
  if (sensorLedger && !String(sensorLedger.boundary || "").includes("不自动修正测点")) {
    pushUnique(blockers, "仪表台账任务必须声明不自动修正测点。");
  }

  const controlEventWindow = itemByKey(tasks, "control-command-feedback-event-window");
  if (controlEventWindow) {
    const boundary = String(controlEventWindow.boundary || "");
    if (!boundary.includes("不自动改 PID") || !boundary.includes("不自动启停")) {
      pushUnique(blockers, "控制命令/反馈与启停事件任务必须声明不自动改 PID、不自动启停。");
    }
  }

  if (controlOscillationLedgerTemplate.controlBoundary !== CONTROL_OSCILLATION_TEMPLATE_BOUNDARY) {
    pushUnique(blockers, "控制震荡台账模板边界异常。");
  }
  const templateTables = Array.isArray(controlOscillationLedgerTemplate.tables)
    ? controlOscillationLedgerTemplate.tables
    : [];
  const requiredTemplateTables = [
    "control_command_feedback_trend",
    "start_stop_event_ledger",
    "control_parameter_ledger"
  ];
  for (const key of requiredTemplateTables) {
    const table = templateTables.find((item) => item?.key === key);
    if (!table) {
      pushUnique(blockers, `控制震荡台账模板缺少 ${key}`);
      continue;
    }
    if (!Array.isArray(table.columns) || table.columns.length < 8) {
      pushUnique(blockers, `${key} 模板字段不足。`);
    }
    if (!Array.isArray(table.exampleRows) || table.exampleRows.length === 0) {
      pushUnique(blockers, `${key} 缺示例行。`);
    }
  }
  const trendTable = templateTables.find((item) => item?.key === "control_command_feedback_trend");
  const trendColumnKeys = Array.isArray(trendTable?.columns) ? trendTable.columns.map((item) => item.key) : [];
  for (const key of ["timestamp", "loopKey", "equipmentId", "signalRole", "pointCode", "value", "sampleIntervalSec"]) {
    if (!trendColumnKeys.includes(key)) {
      pushUnique(blockers, `控制命令/反馈趋势模板缺少字段 ${key}`);
    }
  }
  const eventTable = templateTables.find((item) => item?.key === "start_stop_event_ledger");
  const eventColumnKeys = Array.isArray(eventTable?.columns) ? eventTable.columns.map((item) => item.key) : [];
  for (const key of ["eventAt", "equipmentType", "equipmentId", "eventType", "nextStatus", "alarmActive"]) {
    if (!eventColumnKeys.includes(key)) {
      pushUnique(blockers, `启停事件模板缺少字段 ${key}`);
    }
  }
  const parameterTable = templateTables.find((item) => item?.key === "control_parameter_ledger");
  const parameterColumnKeys = Array.isArray(parameterTable?.columns) ? parameterTable.columns.map((item) => item.key) : [];
  for (const key of ["effectiveAt", "loopKey", "parameterKey", "parameterName", "value", "rollbackValue"]) {
    if (!parameterColumnKeys.includes(key)) {
      pushUnique(blockers, `控制参数模板缺少字段 ${key}`);
    }
  }

  return {
    ok: blockers.length === 0,
    finalDecision: blockers.length === 0 ? "FIELD_VERIFICATION_PACKAGE_READY" : "NO_GO",
    advisorStatus: advisor?.status || null,
    executionMode: advisor?.executionMode || null,
    matrix: matrix
      ? {
          basis: matrix.basis || null,
          scope: matrix.scope || null,
          total: matrix.total ?? null,
          readyNowCount: Number(matrix.readyNowCount || 0),
          directionalCount: Number(matrix.directionalCount || 0),
          pointGapCount: Number(matrix.pointGapCount || 0),
          controlBoundary: matrix.controlBoundary || null,
          boundaryNotes: Array.isArray(matrix.boundaryNotes) ? matrix.boundaryNotes : [],
          items: matrixItems
        }
      : null,
    fieldVerificationChecklist: checklist
      ? {
          basis: checklist.basis || null,
          scope: checklist.scope || null,
          total: checklist.total ?? null,
          p0Count: Number(checklist.p0Count || 0),
          p1Count: Number(checklist.p1Count || 0),
          controlBoundary: checklist.controlBoundary || null,
          items: tasks
        }
      : null,
    engineeringSummary: buildEngineeringSummary(matrix, checklist),
    nextActions: buildNextActions(tasks),
    workbookRows: buildTaskWorkbookRows(tasks),
    controlOscillationLedgerTemplate,
    requiredBoundaries: REQUIRED_BOUNDARIES,
    blockers,
    warnings
  };
}

function renderMarkdown(report) {
  const matrix = report.summary.matrix || {};
  const checklist = report.summary.fieldVerificationChecklist || {};
  const tasks = Array.isArray(checklist.items) ? checklist.items : [];
  const rows = Array.isArray(report.summary.workbookRows) ? report.summary.workbookRows : [];
  const controlTemplate = report.summary.controlOscillationLedgerTemplate || {};
  const controlTables = Array.isArray(controlTemplate.tables) ? controlTemplate.tables : [];
  return `# 140/B25 /optimize-demo 现场复核交付包

- 结论：${report.finalDecision}
- 站点：${report.siteId}
- BFF：${report.bffBaseUrl}
- 生成时间：${report.generatedAt}
- 请求：load=${report.inputs.loadKw}kW, outdoor=${report.inputs.outdoorTempC}℃, mode=${report.inputs.mode}

## 1. 交付定位

${report.summary.engineeringSummary.purpose}

| 项 | 当前口径 |
| --- | --- |
| 诊断可行性 | ${report.summary.engineeringSummary.diagnosticReadiness} |
| 现场复核任务 | ${report.summary.engineeringSummary.fieldTaskSummary} |
| 控制边界 | ${report.summary.engineeringSummary.controlBoundary} |
| 推进决策 | ${report.summary.engineeringSummary.handoffDecision} |

## 2. 现场复核任务

| 优先级 | 任务 | 复核对象 | 责任角色 | 验收标准 | 边界 |
| --- | --- | --- | --- | --- | --- |
${tasks.map((item) => `| ${item.priority || "--"} | ${escapePipe(item.title)} | ${escapePipe(item.verificationTarget)} | ${escapePipe(item.ownerRole)} | ${escapePipe(item.acceptanceCriteria)} | ${escapePipe(item.boundary)} |`).join("\n")}

## 3. 任务证据模板

| key | 优先级 | 需补数据 | 需提交证据 | 现场状态 | 证据路径/系统 | 复核人 | 复核结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((item) => `| ${item.key || "--"} | ${item.priority || "--"} | ${escapePipe(listText(item.missingData))} | ${escapePipe(listText(item.requiredEvidence))} | ${item.fieldStatus || "--"} |  |  |  |`).join("\n")}

## 4. 控制震荡台账模板

用途：${escapePipe(controlTemplate.basis || "--")}；责任角色：${escapePipe(controlTemplate.ownerRole || "--")}。

边界：${escapePipe(controlTemplate.controlBoundary || "--")}

验收：

${Array.isArray(controlTemplate.acceptanceCriteria) ? controlTemplate.acceptanceCriteria.map((item) => `- ${item}`).join("\n") : "- --"}

${controlTables.map((table) => `### ${table.title || table.key || "--"}

CSV：\`${table.outputCsv || "--"}\`

| 字段 | 中文名 | 必填 | 示例 |
| --- | --- | --- | --- |
${(Array.isArray(table.columns) ? table.columns : []).map((column) => `| ${column.key || "--"} | ${escapePipe(column.label)} | ${column.required ? "是" : "否"} | ${escapePipe(column.example)} |`).join("\n")}
`).join("\n")}

## 5. 只读边界

${report.summary.requiredBoundaries.map((item) => `- ${item}`).join("\n")}

## 6. 推荐推进顺序

${report.summary.nextActions.map((item) => `- ${item.step}. ${item.title}：${item.detail}；验收：${item.acceptance}`).join("\n")}

## 7. 诊断矩阵摘要

| 项 | 值 |
| --- | --- |
| Advisor 状态 | ${report.summary.advisorStatus || "--"} |
| 执行模式 | ${report.summary.executionMode || "--"} |
| 矩阵总项 | ${matrix.total ?? "--"} |
| 可做 V1 | ${matrix.readyNowCount ?? "--"} |
| 只能疑似判断 | ${matrix.directionalCount ?? "--"} |
| 暂不能做/补点 | ${matrix.pointGapCount ?? "--"} |
| 矩阵控制边界 | ${matrix.controlBoundary || "--"} |
| 复核清单边界 | ${checklist.controlBoundary || "--"} |

## 8. 阻断项

${report.blockers.length ? report.blockers.map((item) => `- ${item}`).join("\n") : "- 无"}

## 9. 警告

${report.warnings.length ? report.warnings.map((item) => `- ${item}`).join("\n") : "- 无"}

## 10. 验收口径

- 这份交付包只读取 /optimize 建议响应，不创建、审批、dispatch 或 rollback 执行单。
- P0 未闭合前，泵频、主机组合和塔 Approach 只能保持 read_only/shadow。
- 多机运行且无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆分单台主机 COP。
- 仪表偏移、水力平衡、阀门和主机健康类诊断只输出复核建议，不直接判定设备故障。
- 控制震荡台账模板只用于补齐诊断证据，不自动改 PID，不自动启停设备。
`;
}

function renderHtml(report) {
  const checklist = report.summary.fieldVerificationChecklist || {};
  const tasks = Array.isArray(checklist.items) ? checklist.items : [];
  const rows = Array.isArray(report.summary.workbookRows) ? report.summary.workbookRows : [];
  const matrix = report.summary.matrix || {};
  const controlTemplate = report.summary.controlOscillationLedgerTemplate || {};
  const controlTables = Array.isArray(controlTemplate.tables) ? controlTemplate.tables : [];
  const taskCards = tasks
    .map(
      (item) => `
        <section class="task">
          <div class="task-head">
            <span class="priority">${escapeHtml(item.priority || "--")}</span>
            <h3>${escapeHtml(item.title || "--")}</h3>
          </div>
          <dl>
            <dt>复核对象</dt><dd>${escapeHtml(item.verificationTarget || "--")}</dd>
            <dt>责任角色</dt><dd>${escapeHtml(item.ownerRole || "--")}</dd>
            <dt>需补数据</dt><dd>${escapeHtml(listText(item.missingData))}</dd>
            <dt>需提交证据</dt><dd>${escapeHtml(listText(item.requiredEvidence))}</dd>
            <dt>验收标准</dt><dd>${escapeHtml(item.acceptanceCriteria || "--")}</dd>
            <dt>控制边界</dt><dd>${escapeHtml(item.boundary || "--")}</dd>
          </dl>
        </section>`
    )
    .join("");
  const workbookRows = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.key || "--")}</td>
          <td>${escapeHtml(item.priority || "--")}</td>
          <td>${escapeHtml(listText(item.missingData))}</td>
          <td>${escapeHtml(listText(item.requiredEvidence))}</td>
          <td>${escapeHtml(item.fieldStatus || "--")}</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`
    )
    .join("");
  const controlTemplateSections = controlTables
    .map((table) => {
      const columnRows = (Array.isArray(table.columns) ? table.columns : [])
        .map(
          (column) => `
            <tr>
              <td>${escapeHtml(column.key || "--")}</td>
              <td>${escapeHtml(column.label || "--")}</td>
              <td>${column.required ? "是" : "否"}</td>
              <td>${escapeHtml(column.example || "--")}</td>
            </tr>`
        )
        .join("");
      return `
        <section class="template-block">
          <h3>${escapeHtml(table.title || table.key || "--")}</h3>
          <p>CSV：${escapeHtml(table.outputCsv || "--")}</p>
          <table>
            <thead>
              <tr><th>字段</th><th>中文名</th><th>必填</th><th>示例</th></tr>
            </thead>
            <tbody>${columnRows}</tbody>
          </table>
        </section>`;
    })
    .join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>140/B25 /optimize-demo 现场复核交付包</title>
  <style>
    :root {
      color: #172033;
      background: #f4f7fb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 32px;
      background: #f4f7fb;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
    }
    header {
      background: #122033;
      color: #f8fbff;
      padding: 28px 32px;
      border-radius: 8px;
      border: 1px solid #223a58;
    }
    h1,
    h2,
    h3 {
      margin: 0;
      letter-spacing: 0;
    }
    h1 {
      font-size: 28px;
      line-height: 1.25;
    }
    h2 {
      margin-top: 28px;
      margin-bottom: 12px;
      font-size: 20px;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .meta div,
    .summary div {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      padding: 10px 12px;
    }
    .meta span,
    .summary span {
      display: block;
      color: #9fb7d5;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .summary div {
      background: #fff;
      color: #172033;
      border-color: #d9e2ef;
    }
    .summary strong {
      font-size: 18px;
    }
    .tasks {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .task {
      background: #fff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      padding: 16px;
      break-inside: avoid;
    }
    .task-head {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .priority {
      background: #fff2cc;
      border: 1px solid #f0c65a;
      color: #684b00;
      border-radius: 999px;
      font-weight: 700;
      padding: 4px 8px;
      font-size: 12px;
    }
    dl {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 6px 10px;
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    dt {
      color: #5b6b82;
    }
    dd {
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      overflow: hidden;
      font-size: 13px;
    }
    th,
    td {
      border-bottom: 1px solid #e6edf6;
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #edf3fb;
      color: #2d3d52;
    }
    .boundary {
      background: #fff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      padding: 14px 18px;
    }
    .boundary li {
      margin: 6px 0;
    }
    .template-block {
      background: #fff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 14px;
      break-inside: avoid;
    }
    .template-block h3 {
      margin-bottom: 8px;
      font-size: 16px;
    }
    .template-block p {
      color: #5b6b82;
      margin: 0 0 10px;
      font-size: 13px;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      header,
      .task,
      table,
      .boundary {
        box-shadow: none;
      }
    }
    @media (max-width: 820px) {
      body {
        padding: 16px;
      }
      .meta,
      .summary,
      .tasks {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>140/B25 /optimize-demo 现场复核交付包</h1>
      <p>${escapeHtml(report.summary.engineeringSummary.purpose)}</p>
      <div class="meta">
        <div><span>结论</span>${escapeHtml(report.finalDecision)}</div>
        <div><span>站点</span>${escapeHtml(report.siteId)}</div>
        <div><span>BFF</span>${escapeHtml(report.bffBaseUrl)}</div>
        <div><span>生成时间</span>${escapeHtml(report.generatedAt)}</div>
      </div>
    </header>
    <section class="summary">
      <div><span>诊断可行性</span><strong>${escapeHtml(report.summary.engineeringSummary.diagnosticReadiness)}</strong></div>
      <div><span>现场复核任务</span><strong>${escapeHtml(report.summary.engineeringSummary.fieldTaskSummary)}</strong></div>
      <div><span>执行模式</span><strong>${escapeHtml(report.summary.executionMode || "--")}</strong></div>
      <div><span>控制边界</span><strong>${escapeHtml(report.summary.engineeringSummary.controlBoundary)}</strong></div>
    </section>
    <h2>现场复核任务</h2>
    <section class="tasks">${taskCards}</section>
    <h2>任务证据模板</h2>
    <table>
      <thead>
        <tr>
          <th>key</th>
          <th>优先级</th>
          <th>需补数据</th>
          <th>需提交证据</th>
          <th>现场状态</th>
          <th>证据路径/系统</th>
          <th>复核人</th>
          <th>复核结论</th>
        </tr>
      </thead>
      <tbody>${workbookRows}</tbody>
    </table>
    <h2>控制震荡台账模板</h2>
    <section class="boundary">
      <p>${escapeHtml(controlTemplate.controlBoundary || "--")}</p>
      <ul>${(Array.isArray(controlTemplate.acceptanceCriteria) ? controlTemplate.acceptanceCriteria : []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    ${controlTemplateSections}
    <h2>只读边界</h2>
    <section class="boundary">
      <ul>${report.summary.requiredBoundaries.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
    <h2>诊断矩阵摘要</h2>
    <table>
      <tbody>
        <tr><th>Advisor 状态</th><td>${escapeHtml(report.summary.advisorStatus || "--")}</td></tr>
        <tr><th>矩阵总项</th><td>${escapeHtml(matrix.total ?? "--")}</td></tr>
        <tr><th>可做 / 疑似 / 补点</th><td>${escapeHtml(`${matrix.readyNowCount ?? "--"} / ${matrix.directionalCount ?? "--"} / ${matrix.pointGapCount ?? "--"}`)}</td></tr>
        <tr><th>矩阵边界</th><td>${escapeHtml(matrix.controlBoundary || "--")}</td></tr>
        <tr><th>复核清单边界</th><td>${escapeHtml(checklist.controlBoundary || "--")}</td></tr>
      </tbody>
    </table>
  </main>
</body>
</html>
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
  const summary = summarizeFieldPackage(response);
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
      markdown: rel(OUTPUT_MD),
      html: rel(OUTPUT_HTML),
      controlTrendCsv: rel(OUTPUT_CONTROL_TREND_CSV),
      startStopCsv: rel(OUTPUT_START_STOP_CSV),
      controlParameterCsv: rel(OUTPUT_CONTROL_PARAMETER_CSV)
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");
  fs.writeFileSync(OUTPUT_HTML, renderHtml(report), "utf8");
  const controlTemplate = report.summary.controlOscillationLedgerTemplate || {};
  const templateTables = Array.isArray(controlTemplate.tables) ? controlTemplate.tables : [];
  const trendTable = templateTables.find((item) => item.key === "control_command_feedback_trend");
  const eventTable = templateTables.find((item) => item.key === "start_stop_event_ledger");
  const parameterTable = templateTables.find((item) => item.key === "control_parameter_ledger");
  if (trendTable) {
    fs.writeFileSync(OUTPUT_CONTROL_TREND_CSV, renderCsv(trendTable.columns, trendTable.exampleRows), "utf8");
  }
  if (eventTable) {
    fs.writeFileSync(OUTPUT_START_STOP_CSV, renderCsv(eventTable.columns, eventTable.exampleRows), "utf8");
  }
  if (parameterTable) {
    fs.writeFileSync(OUTPUT_CONTROL_PARAMETER_CSV, renderCsv(parameterTable.columns, parameterTable.exampleRows), "utf8");
  }

  process.stdout.write(`optimize-demo 140 field verification package: ${report.finalDecision}\n`);
  process.stdout.write(
    `fieldChecklist=${summary.fieldVerificationChecklist ? `${summary.fieldVerificationChecklist.p0Count} P0 / ${summary.fieldVerificationChecklist.p1Count} P1` : "--"}\n`
  );
  process.stdout.write(
    `matrix=${summary.matrix ? `${summary.matrix.readyNowCount} ready / ${summary.matrix.directionalCount} directional / ${summary.matrix.pointGapCount} point-gap` : "--"}\n`
  );
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  process.stdout.write(`html=${OUTPUT_HTML}\n`);
  process.stdout.write(`controlTrendCsv=${OUTPUT_CONTROL_TREND_CSV}\n`);
  process.stdout.write(`startStopCsv=${OUTPUT_START_STOP_CSV}\n`);
  process.stdout.write(`controlParameterCsv=${OUTPUT_CONTROL_PARAMETER_CSV}\n`);
  if (report.blockers.length) {
    process.stdout.write(`blockers=${report.blockers.length}\n`);
    report.blockers.slice(0, 10).forEach((item) => process.stdout.write(`- ${item}\n`));
  }
  if (report.warnings.length) {
    process.stdout.write(`warnings=${report.warnings.length}\n`);
    report.warnings.slice(0, 10).forEach((item) => process.stdout.write(`- ${item}\n`));
  }

  if (STRICT && report.finalDecision !== "FIELD_VERIFICATION_PACKAGE_READY") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `optimize-demo 140 field verification package failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
