import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-return-template-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-return-template-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-return-template-latest.csv");

const REQUIRED_RETURN_COLUMNS = [
  "workOrderId",
  "deviceCode",
  "deviceName",
  "handledBy",
  "handledAt",
  "communicationAlarmAfter",
  "zoneTemperatureAfterC",
  "setpointFeedbackAfterC",
  "writePointMappingChecked",
  "twoSampleNormal",
  "localManualLockout",
  "releaseDecision",
  "reviewedBy",
  "reviewedAt",
  "notes"
];

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
      error: error instanceof Error ? error.message : "read json failed",
      payload: {}
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = Array.isArray(value) ? value.join("；") : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function reasonLabel(reason) {
  const labels = {
    communication_alarm: "通讯报警未恢复",
    zero_temperature: "温度点为0°C",
    invalid_temperature: "温度无效",
    temperature_quality_guard: "温度质量门槛未通过",
    setpoint_feedback_out_of_bounds: "设定反馈越界"
  };
  return labels[reason] || reason;
}

function formatRequiredValue(field, workOrder) {
  const verification = workOrder.fieldVerification || {};
  const required = verification[field];
  if (required) {
    return required;
  }
  const defaults = {
    handledBy: "必填：现场处理人",
    handledAt: "必填：ISO时间",
    reviewedBy: "必填：复核人",
    reviewedAt: "必填：ISO时间",
    communicationAlarmAfter: "必填：0",
    zoneTemperatureAfterC: "必填：5-45",
    setpointFeedbackAfterC: "按需：10-32",
    writePointMappingChecked: "必填：yes",
    twoSampleNormal: "必填：yes",
    localManualLockout: "必填：none",
    releaseDecision: "必填：release"
  };
  return defaults[field] || "";
}

function findSignoffMatrix(signoff, workOrderId) {
  return asArray(signoff.releaseMatrix).find((item) => normalizeText(item.workOrderId) === workOrderId) || null;
}

function isValidNumberInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function buildReviewDraft(currentEvidence, reasons) {
  const suggestedValues = {};
  const blockedAutoFillFields = [];
  const manualOnlyFields = [
    "handledBy",
    "handledAt",
    "reviewedBy",
    "reviewedAt",
    "writePointMappingChecked",
    "twoSampleNormal",
    "localManualLockout",
    "releaseDecision"
  ];
  if (currentEvidence.communicationAlarm === false) {
    suggestedValues.communicationAlarmAfter = "0";
  } else {
    blockedAutoFillFields.push("communicationAlarmAfter");
  }
  if (isValidNumberInRange(currentEvidence.zoneTemperatureC, 5, 45)) {
    suggestedValues.zoneTemperatureAfterC = String(currentEvidence.zoneTemperatureC);
  } else {
    blockedAutoFillFields.push("zoneTemperatureAfterC");
  }
  if (isValidNumberInRange(currentEvidence.setpointC, 10, 32)) {
    suggestedValues.setpointFeedbackAfterC = String(currentEvidence.setpointC);
  } else if (currentEvidence.setpointC !== null && currentEvidence.setpointC !== undefined) {
    blockedAutoFillFields.push("setpointFeedbackAfterC");
  }
  return {
    mode: "review_draft_only",
    releaseDecisionDefault: "recheck",
    suggestedValues,
    blockedAutoFillFields,
    manualOnlyFields,
    canSuggestAnyValue: Object.keys(suggestedValues).length > 0,
    cannotReleaseReasons: [
      ...reasons,
      "现场处理人/复核人/时间/写点核对/连续两次采样/手动锁定必须人工确认"
    ],
    safetyBoundary: "草稿值只用于现场复核，不写入 signoff，不代表 release，不触发 BA/PLC。"
  };
}

function buildDeviceRows(workOrders, signoff) {
  return workOrders.map((workOrder) => {
    const workOrderId = normalizeText(workOrder.workOrderId);
    const matrix = findSignoffMatrix(signoff, workOrderId);
    const currentEvidence = workOrder.currentEvidence || {};
    const reasons = asArray(currentEvidence.reasons).map(normalizeText).filter(Boolean);
    const missingFields = asArray(matrix?.missingFields).map(normalizeText).filter(Boolean);
    const requiredValues = Object.fromEntries(
      REQUIRED_RETURN_COLUMNS.map((column) => [column, formatRequiredValue(column, workOrder)])
    );
    const reviewDraft = buildReviewDraft(currentEvidence, reasons);
    return {
      workOrderId,
      priority: normalizeText(workOrder.priority) || "P0",
      deviceCode: normalizeText(workOrder.deviceCode),
      deviceName: normalizeText(workOrder.deviceName || workOrder.deviceCode),
      owner: normalizeText(workOrder.owner) || "BA/自控工程师",
      currentEvidence: {
        communicationAlarm: currentEvidence.communicationAlarm ?? null,
        zoneTemperatureC: currentEvidence.zoneTemperatureC ?? null,
        setpointC: currentEvidence.setpointC ?? null,
        qualityStatus: currentEvidence.qualityStatus || null,
        reasons,
        reasonLabels: reasons.map(reasonLabel)
      },
      requiredValues,
      reviewDraft,
      missingFields,
      releaseCriteria: asArray(workOrder.releaseCriteria),
      plannedAction: asArray(workOrder.plannedAction),
      row: {
        workOrderId,
        deviceCode: normalizeText(workOrder.deviceCode),
        deviceName: normalizeText(workOrder.deviceName || workOrder.deviceCode),
        handledBy: "",
        handledAt: "",
        communicationAlarmAfter: "",
        zoneTemperatureAfterC: "",
        setpointFeedbackAfterC: "",
        writePointMappingChecked: "",
        twoSampleNormal: "",
        localManualLockout: "",
        releaseDecision: "",
        reviewedBy: "",
        reviewedAt: "",
        notes: [
          `当前异常=${reasons.map(reasonLabel).join("；") || "待复核"}`,
          reviewDraft.canSuggestAnyValue
            ? `可参考草稿=${Object.entries(reviewDraft.suggestedValues).map(([field, value]) => `${field}:${value}`).join("；")}`
            : "可参考草稿=无",
          `必填=${missingFields.join("；") || "按验收项全部回填"}`
        ].join(" | ")
      }
    };
  });
}

function buildReport({ workOrdersResult, signoffResult }) {
  const workOrdersReport = workOrdersResult.payload || {};
  const signoff = signoffResult.payload || {};
  const workOrders = asArray(workOrdersReport.workOrders);
  const deviceRows = buildDeviceRows(workOrders, signoff);
  const communicationBlocked = deviceRows.filter((item) =>
    item.currentEvidence.reasons.includes("communication_alarm")
  ).length;
  const temperatureBlocked = deviceRows.filter((item) =>
    item.currentEvidence.reasons.some((reason) => reason.includes("temperature") || reason.includes("zero"))
  ).length;
  const setpointBlocked = deviceRows.filter((item) =>
    item.currentEvidence.reasons.includes("setpoint_feedback_out_of_bounds")
  ).length;
  const draftSuggestibleDevices = deviceRows.filter((item) => item.reviewDraft.canSuggestAnyValue).length;
  const draftTemperatureSuggestions = deviceRows.filter((item) => item.reviewDraft.suggestedValues.zoneTemperatureAfterC).length;
  const draftSetpointSuggestions = deviceRows.filter((item) => item.reviewDraft.suggestedValues.setpointFeedbackAfterC).length;
  return {
    ok: workOrdersResult.ok === true && signoffResult.ok === true && deviceRows.length > 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_return_template",
    siteId: normalizeText(workOrdersReport.siteId) || "126lnoffice",
    build: normalizeText(workOrdersReport.build) || "1",
    floor: normalizeText(workOrdersReport.floor) || "1",
    controlMutation: false,
    dispatch: false,
    summary: {
      deviceCount: deviceRows.length,
      communicationBlocked,
      temperatureBlocked,
      setpointBlocked,
      draftSuggestibleDevices,
      draftTemperatureSuggestions,
      draftSetpointSuggestions,
      signoffCompleteRows: signoff.summary?.completeRows ?? null,
      signoffExpectedRows: signoff.summary?.expectedWorkOrders ?? null,
      canaryBlockedUntil: [
        deviceRows.length > 0 ? "全部现场回填 release" : null,
        "重跑 signoff",
        "重跑实时 closeout",
        "重跑 final-control gates"
      ].filter(Boolean)
    },
    sourceFiles: {
      workOrders: workOrdersResult.path,
      signoff: signoffResult.path,
      workOrdersError: workOrdersResult.error || null,
      signoffError: signoffResult.error || null
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    },
    requiredColumns: REQUIRED_RETURN_COLUMNS,
    devices: deviceRows,
    rerunCommands: [
      "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff",
      "npm --prefix apps/chiller-bff run check:fcu-field-remediation-closeout",
      "npm --prefix apps/chiller-bff run build:fcu-final-control-worklist",
      "npm --prefix apps/chiller-bff run build:fcu-final-control-runbook",
      "npm --prefix apps/chiller-bff run check:fcu-final-control-evidence-consistency"
    ],
    safetyBoundary: [
      "本模板只用于现场回填和复核，不产生 BA/PLC 写入。",
      "reviewDraft 只给现场复核参考，不自动写入 signoff 输入表。",
      "release 只是现场放行意见，不等于系统允许真实下发。",
      "所有设备仍必须通过实时 closeout、Canary readiness 和最终总门禁。"
    ]
  };
}

function renderCsv(report) {
  const header = [
    ...REQUIRED_RETURN_COLUMNS,
    "currentCommunicationAlarm",
    "currentZoneTemperatureC",
    "currentSetpointC",
    "currentReasons",
    "requiredValues",
    "reviewDraftSuggestedValues",
    "reviewDraftBlockedAutoFillFields",
    "reviewDraftManualOnlyFields",
    "releaseCriteria",
    "plannedAction"
  ];
  const rows = report.devices.map((item) => [
    ...REQUIRED_RETURN_COLUMNS.map((column) => item.row[column] ?? ""),
    item.currentEvidence.communicationAlarm,
    item.currentEvidence.zoneTemperatureC,
    item.currentEvidence.setpointC,
    item.currentEvidence.reasonLabels,
    Object.entries(item.requiredValues).map(([field, value]) => `${field}=${value}`),
    Object.entries(item.reviewDraft.suggestedValues).map(([field, value]) => `${field}=${value}`),
    item.reviewDraft.blockedAutoFillFields,
    item.reviewDraft.manualOnlyFields,
    item.releaseCriteria,
    item.plannedAction
  ]);
  return `${[header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制现场回填模板");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 待回填设备: ${report.summary.deviceCount}`);
  lines.push(`- 通讯阻断: ${report.summary.communicationBlocked}`);
  lines.push(`- 温度阻断: ${report.summary.temperatureBlocked}`);
  lines.push(`- 设定反馈阻断: ${report.summary.setpointBlocked}`);
  lines.push(`- 可参考草稿设备: ${report.summary.draftSuggestibleDevices}`);
  lines.push(`- 温度可参考: ${report.summary.draftTemperatureSuggestions}`);
  lines.push(`- 设定反馈可参考: ${report.summary.draftSetpointSuggestions}`);
  lines.push(`- 签核进度: ${report.summary.signoffCompleteRows ?? "--"}/${report.summary.signoffExpectedRows ?? "--"}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation || report.dispatch ? "存在" : "无"}`);
  lines.push("");
  lines.push("## 现场填写顺序");
  lines.push("");
  lines.push("1. 先恢复所有 communication_alarm。");
  lines.push("2. 再处理 0°C、无效温度和温度质量门槛。");
  lines.push("3. 再把设定反馈拉回 10-32°C。");
  lines.push("4. 最后核对写点、连续两次采样、手动锁定和 release。");
  lines.push("");
  lines.push("## 逐台设备");
  lines.push("");
  for (const item of report.devices) {
    lines.push(`### ${item.deviceCode} ${item.deviceName}`);
    lines.push(`- 当前异常: ${item.currentEvidence.reasonLabels.join("、") || "--"}`);
    lines.push(`- 当前值: 通讯报警=${item.currentEvidence.communicationAlarm ?? "--"}，温度=${item.currentEvidence.zoneTemperatureC ?? "--"}，设定=${item.currentEvidence.setpointC ?? "--"}`);
    lines.push(`- 复核草稿: ${Object.entries(item.reviewDraft.suggestedValues).map(([field, value]) => `${field}=${value}`).join("；") || "无"}`);
    lines.push(`- 草稿不可自动填: ${item.reviewDraft.blockedAutoFillFields.join("；") || "--"}`);
    lines.push(`- 必填项: ${Object.entries(item.requiredValues).map(([field, value]) => `${field}=${value}`).join("；")}`);
    lines.push(`- 验收: ${item.releaseCriteria.join("；") || "--"}`);
    lines.push("");
  }
  lines.push("## 回填后必须重跑");
  lines.push("");
  for (const command of report.rerunCommands) {
    lines.push(`- \`${command}\``);
  }
  lines.push("");
  lines.push("## 安全边界");
  lines.push("");
  for (const item of report.safetyBoundary) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
}

function main() {
  const report = buildReport({
    workOrdersResult: readJsonFile(WORK_ORDERS_JSON),
    signoffResult: readJsonFile(SIGNOFF_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_RETURN_TEMPLATE ok=${report.ok} devices=${report.summary.deviceCount} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  console.log(`csv=${OUTPUT_CSV}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
