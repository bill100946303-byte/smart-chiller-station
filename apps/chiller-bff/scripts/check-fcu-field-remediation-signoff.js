import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const SIGNOFF_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.csv");
const RELEASE_MATRIX_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV ||
  OUTPUT_CSV.replace(/\.csv$/, "-release-matrix.csv");

const REQUIRED_COLUMNS = [
  "workOrderId",
  "deviceCode",
  "handledBy",
  "handledAt",
  "communicationAlarmAfter",
  "zoneTemperatureAfterC",
  "writePointMappingChecked",
  "twoSampleNormal",
  "localManualLockout",
  "releaseDecision",
  "reviewedBy",
  "reviewedAt"
];

const ISSUE_GUIDE = {
  handledBy_missing: {
    field: "handledBy",
    requiredValue: "现场处理人姓名",
    action: "填写实际处理人，不能用空值或系统默认值。",
    reason: "最终控制必须能追溯现场消缺责任人。"
  },
  handledAt_missing: {
    field: "handledAt",
    requiredValue: "现场处理完成时间，建议 ISO 时间",
    action: "填写处理完成时间，例如 2026-06-18T10:00:00+08:00。",
    reason: "需要确认处理发生在当前投运窗口和最新实时采样之前。"
  },
  handledAt_invalid: {
    field: "handledAt",
    requiredValue: "可解析时间，建议 ISO 时间",
    action: "重新填写可解析的处理完成时间，例如 2026-06-18T10:00:00+08:00。",
    reason: "无法解析处理时间时，不能判断现场处理是否属于本次投运窗口。"
  },
  reviewedBy_missing: {
    field: "reviewedBy",
    requiredValue: "复核人姓名",
    action: "填写复核人，建议由非处理人或现场负责人复核。",
    reason: "真实写入前需要二人复核，避免单人误放行。"
  },
  reviewedAt_missing: {
    field: "reviewedAt",
    requiredValue: "复核完成时间，建议 ISO 时间",
    action: "填写复核完成时间。",
    reason: "需要证明复核晚于现场处理。"
  },
  reviewedAt_invalid: {
    field: "reviewedAt",
    requiredValue: "可解析时间，建议 ISO 时间",
    action: "重新填写可解析的复核完成时间，例如 2026-06-18T10:10:00+08:00。",
    reason: "无法解析复核时间时，不能证明真实写入前已完成复核。"
  },
  reviewedAt_before_handledAt: {
    field: "reviewedAt",
    requiredValue: "晚于或等于 handledAt",
    action: "核对处理和复核时间，复核时间必须不早于处理完成时间。",
    reason: "复核早于处理完成不符合现场放行流程。"
  },
  releaseDecision_not_release: {
    field: "releaseDecision",
    requiredValue: "release",
    action: "只有现场确认可放行时填写 release；仍需观察则填写 hold/recheck 并保持阻断。",
    reason: "非 release 的设备不能进入 Canary 或全量闭环。"
  },
  communicationAlarmAfter_not_0: {
    field: "communicationAlarmAfter",
    requiredValue: "0",
    action: "复检 BA 通讯报警点，确认报警复位后填写 0。",
    reason: "通讯报警设备不能执行启停、设定或风速写入。"
  },
  zoneTemperatureAfterC_out_of_range: {
    field: "zoneTemperatureAfterC",
    requiredValue: "5-45",
    action: "填写现场复检后的区域温度，0°C 或越界值必须先修复点位。",
    reason: "温度异常会导致过冷/过热判断错误。"
  },
  setpointFeedbackAfterC_out_of_range: {
    field: "setpointFeedbackAfterC",
    requiredValue: "10-32 或留空",
    action: "如填写设定反馈，必须为 10-32°C；异常设定需人工确认后分步拉回。",
    reason: "设定反馈越界会导致闭环策略漂移。"
  },
  writePointMappingChecked_not_yes: {
    field: "writePointMappingChecked",
    requiredValue: "yes",
    action: "逐台核对启停、设定、风速写点映射且 writable=true 后填写 yes。",
    reason: "写点未核对时不能真实下发。"
  },
  twoSampleNormal_not_yes: {
    field: "twoSampleNormal",
    requiredValue: "yes",
    action: "连续两次采样通讯、温度、反馈均正常后填写 yes。",
    reason: "单次恢复不能排除通讯抖动或点位漂移。"
  },
  localManualLockout_not_none: {
    field: "localManualLockout",
    requiredValue: "none",
    action: "确认就地面板、手动模式、禁控/回退锁定均解除后填写 none。",
    reason: "手动优先，平台不能和现场面板抢控制。"
  }
};

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => normalizeText(value))) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => normalizeText(value))) {
    rows.push(row);
  }
  return rows;
}

function readCsvRecords(filePath) {
  try {
    const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
    const header = rows[0] || [];
    const records = rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
    return { ok: true, path: filePath, header, records };
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      header: [],
      records: [],
      error: error instanceof Error ? error.message : "read csv failed"
    };
  }
}

function isYes(value) {
  return ["yes", "y", "true", "1", "是", "通过"].includes(normalizeText(value).toLowerCase());
}

function isNone(value) {
  return ["none", "no", "false", "0", "无", "正常"].includes(normalizeText(value).toLowerCase());
}

function checkNumericRange(value, min, max) {
  const parsed = Number(normalizeText(value));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function parseTimestamp(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildExpectedWorkOrderMap(workOrdersReport) {
  const map = new Map();
  for (const item of Array.isArray(workOrdersReport.workOrders) ? workOrdersReport.workOrders : []) {
    if (normalizeText(item.workOrderId)) {
      map.set(normalizeText(item.workOrderId), item);
    }
  }
  return map;
}

function validateRecord(record, expected) {
  const issues = [];
  const releaseDecision = normalizeText(record.releaseDecision).toLowerCase();
  if (!normalizeText(record.handledBy)) {
    issues.push("handledBy_missing");
  }
  if (!normalizeText(record.handledAt)) {
    issues.push("handledAt_missing");
  } else if (Number.isNaN(parseTimestamp(record.handledAt))) {
    issues.push("handledAt_invalid");
  }
  if (!normalizeText(record.reviewedBy)) {
    issues.push("reviewedBy_missing");
  }
  if (!normalizeText(record.reviewedAt)) {
    issues.push("reviewedAt_missing");
  } else if (Number.isNaN(parseTimestamp(record.reviewedAt))) {
    issues.push("reviewedAt_invalid");
  }
  const handledAtMs = parseTimestamp(record.handledAt);
  const reviewedAtMs = parseTimestamp(record.reviewedAt);
  if (
    Number.isFinite(handledAtMs) &&
    Number.isFinite(reviewedAtMs) &&
    reviewedAtMs < handledAtMs
  ) {
    issues.push("reviewedAt_before_handledAt");
  }
  if (releaseDecision !== "release") {
    issues.push("releaseDecision_not_release");
  }
  if (normalizeText(record.communicationAlarmAfter) !== "0") {
    issues.push("communicationAlarmAfter_not_0");
  }
  if (!checkNumericRange(record.zoneTemperatureAfterC, 5, 45)) {
    issues.push("zoneTemperatureAfterC_out_of_range");
  }
  if (normalizeText(record.setpointFeedbackAfterC) && !checkNumericRange(record.setpointFeedbackAfterC, 10, 32)) {
    issues.push("setpointFeedbackAfterC_out_of_range");
  }
  if (!isYes(record.writePointMappingChecked)) {
    issues.push("writePointMappingChecked_not_yes");
  }
  if (!isYes(record.twoSampleNormal)) {
    issues.push("twoSampleNormal_not_yes");
  }
  if (!isNone(record.localManualLockout)) {
    issues.push("localManualLockout_not_none");
  }
  const missingChecklist = issues.map((issue) => ({
    issue,
    field: ISSUE_GUIDE[issue]?.field || issue,
    requiredValue: ISSUE_GUIDE[issue]?.requiredValue || "",
    action: ISSUE_GUIDE[issue]?.action || "按现场工单补齐该项后重跑签字校验。",
    reason: ISSUE_GUIDE[issue]?.reason || "该项未通过会阻断 FCU 最终控制。"
  }));
  return {
    workOrderId: normalizeText(record.workOrderId),
    deviceCode: normalizeText(record.deviceCode || expected?.deviceCode),
    deviceName: normalizeText(record.deviceName || expected?.deviceName),
    releaseDecision,
    signoffComplete: issues.length === 0,
    issues,
    missingChecklist,
    values: {
      handledBy: normalizeText(record.handledBy),
      handledAt: normalizeText(record.handledAt),
      communicationAlarmAfter: normalizeText(record.communicationAlarmAfter),
      zoneTemperatureAfterC: normalizeText(record.zoneTemperatureAfterC),
      setpointFeedbackAfterC: normalizeText(record.setpointFeedbackAfterC),
      writePointMappingChecked: normalizeText(record.writePointMappingChecked),
      twoSampleNormal: normalizeText(record.twoSampleNormal),
      localManualLockout: normalizeText(record.localManualLockout),
      reviewedBy: normalizeText(record.reviewedBy),
      reviewedAt: normalizeText(record.reviewedAt)
    }
  };
}

function formatVerificationTarget(workOrder) {
  const verification = workOrder?.fieldVerification || {};
  const targets = [
    `通讯=${verification.communicationAlarmAfter || "0"}`,
    `温度=${verification.zoneTemperatureAfterC || "5-45"}`,
    `写点=${verification.writePointMappingChecked || "yes"}`,
    `连续采样=${verification.twoSampleNormal || "yes"}`,
    `手动锁定=${verification.localManualLockout || "none"}`,
    `放行=${verification.releaseDecision || "release"}`
  ];
  if (verification.setpointFeedbackAfterC) {
    targets.splice(2, 0, `设定反馈=${verification.setpointFeedbackAfterC}`);
  }
  return targets.join("；");
}

function buildReleaseMatrix({ expectedMap, records, missingWorkOrders }) {
  const recordsByWorkOrder = new Map(records.map((item) => [item.workOrderId, item]));
  return [...expectedMap.entries()].map(([workOrderId, workOrder]) => {
    const record = recordsByWorkOrder.get(workOrderId) || null;
    const missingChecklist = record?.missingChecklist || [
      {
        issue: "signoff_row_missing",
        field: "signoff row",
        requiredValue: "现场签字行",
        action: "在现场签字 CSV 中补齐该工单行并填写所有复检字段。",
        reason: "缺少签字行时不能进入 Canary。"
      }
    ];
    const signoffComplete = record?.signoffComplete === true;
    return {
      workOrderId,
      deviceCode: normalizeText(record?.deviceCode || workOrder.deviceCode),
      deviceName: normalizeText(record?.deviceName || workOrder.deviceName),
      owner: normalizeText(workOrder.owner) || "现场值班 + 平台工程师",
      signoffComplete,
      onsiteCanaryCandidate: signoffComplete,
      canEnterCanary: false,
      canaryBlockReason: signoffComplete
        ? "signoff_complete_but_realtime_closeout_required"
        : missingWorkOrders.includes(workOrderId)
          ? "signoff_row_missing"
          : "signoff_incomplete",
      currentEvidence: {
        zoneTemperatureC: workOrder.currentEvidence?.zoneTemperatureC ?? null,
        setpointC: workOrder.currentEvidence?.setpointC ?? null,
        communicationAlarm: workOrder.currentEvidence?.communicationAlarm ?? null,
        reasons: workOrder.currentEvidence?.reasons || []
      },
      missingFields: missingChecklist.map((item) => item.field),
      requiredValues: missingChecklist.map((item) => `${item.field}=${item.requiredValue}`),
      nextActions: missingChecklist.map((item) => item.action),
      plannedAction: workOrder.plannedAction || [],
      releaseCriteria: workOrder.releaseCriteria || [],
      verificationTarget: formatVerificationTarget(workOrder),
      rerunCommand: "npm --prefix apps/chiller-bff run check:fcu-field-remediation-signoff && npm --prefix apps/chiller-bff run build:fcu-final-control-worklist"
    };
  });
}

function buildOnsiteReleasePrecheck(releaseMatrix) {
  const devices = releaseMatrix.map((item) => {
    const nextBlockingFields = item.signoffComplete
      ? ["realtime_closeout", "canary_readiness", "final_control_gates"]
      : item.missingFields;
    const nextAction = item.signoffComplete
      ? "签字已完成；重跑实时 closeout、Canary readiness 和最终总门禁，不能凭 CSV 直接下发。"
      : (item.nextActions || [])[0] || "补齐现场签字和复核字段后重跑签字校验。";
    return {
      workOrderId: item.workOrderId,
      deviceCode: item.deviceCode,
      deviceName: item.deviceName,
      signoffComplete: item.signoffComplete,
      onsiteReleaseReady: item.signoffComplete,
      onsiteCanaryCandidate: item.onsiteCanaryCandidate === true,
      canEnterCanary: item.canEnterCanary,
      canaryBlockReason: item.canaryBlockReason,
      nextBlockingFields,
      nextAction,
      verificationTarget: item.verificationTarget
    };
  });
  const readyDevices = devices.filter((item) => item.onsiteReleaseReady);
  const onsiteCanaryCandidates = devices.filter((item) => item.onsiteCanaryCandidate);
  const blockedDevices = devices.filter((item) => !item.onsiteReleaseReady);
  const blockFieldCounts = {};
  for (const device of blockedDevices) {
    for (const field of device.nextBlockingFields || []) {
      blockFieldCounts[field] = (blockFieldCounts[field] || 0) + 1;
    }
  }
  return {
    ok: blockedDevices.length === 0,
    onsiteReleaseReadyCount: readyDevices.length,
    onsiteReleaseBlockedCount: blockedDevices.length,
    onsiteCanaryCandidateCount: onsiteCanaryCandidates.length,
    canaryCandidateCount: 0,
    canaryStillBlockedCount: devices.length,
    blockFieldCounts,
    nextGlobalActions: [
      blockedDevices.length > 0 ? "补齐所有 onsiteReleaseReady=false 的现场签字字段" : null,
      "重跑 check:fcu-field-remediation-signoff",
      "重跑 check:fcu-field-remediation-closeout",
      "重跑 check:fcu-canary-readiness",
      "重跑 check:fcu-final-control-gates"
    ].filter(Boolean),
    safetyBoundary: [
      "onsiteReleaseReady 只代表现场签字和复核字段完整。",
      "onsiteCanaryCandidate 只代表可进入实时 closeout/Field Arm 预检，不代表 canEnterCanary。",
      "canEnterCanary 第一版仍必须由实时 closeout、BA 写适配器、Canary readiness 和最终总门禁共同放行。",
      "本预检不产生 BA/PLC 写入。"
    ],
    devices
  };
}

function buildReport({ workOrdersResult, signoffCsv }) {
  const workOrdersReport = workOrdersResult.payload || {};
  const expectedMap = buildExpectedWorkOrderMap(workOrdersReport);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !signoffCsv.header.includes(column));
  const currentRecords = signoffCsv.records.filter((record) => expectedMap.has(normalizeText(record.workOrderId)));
  const ignoredRecords = signoffCsv.records.filter((record) => !expectedMap.has(normalizeText(record.workOrderId)));
  const records = currentRecords.map((record) => validateRecord(record, expectedMap.get(normalizeText(record.workOrderId))));
  const seen = new Set(records.map((item) => item.workOrderId).filter(Boolean));
  const missingWorkOrders = [...expectedMap.keys()].filter((workOrderId) => !seen.has(workOrderId));
  const openRecords = records.filter((item) => !item.signoffComplete);
  const signoffComplete =
    workOrdersResult.ok === true &&
    signoffCsv.ok === true &&
    missingColumns.length === 0 &&
    missingWorkOrders.length === 0 &&
    openRecords.length === 0;
  const releaseMatrix = buildReleaseMatrix({
    expectedMap,
    records,
    missingWorkOrders
  });
  return {
    ok: signoffComplete,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_signoff",
    siteId: normalizeText(workOrdersReport.siteId) || "126lnoffice",
    build: normalizeText(workOrdersReport.build) || "1",
    floor: normalizeText(workOrdersReport.floor) || "1",
    controlMutation: false,
    dispatch: false,
    summary: {
      expectedWorkOrders: expectedMap.size,
      csvRows: signoffCsv.records.length,
      signoffComplete,
      completeRows: records.filter((item) => item.signoffComplete).length,
      openRows: openRecords.length,
      missingColumns,
      missingWorkOrders,
      ignoredRows: ignoredRecords.length,
      stillRequiresRealtimeCloseout: true
    },
    source: {
      workOrdersJson: workOrdersResult.path,
      signoffCsv: signoffCsv.path,
      workOrdersError: workOrdersResult.error || null,
      csvError: signoffCsv.error || null
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV,
      releaseMatrixCsv: RELEASE_MATRIX_CSV
    },
    records,
    releaseMatrix,
    onsiteReleasePrecheck: buildOnsiteReleasePrecheck(releaseMatrix),
    ignoredRecords: ignoredRecords.map((record) => ({
      workOrderId: normalizeText(record.workOrderId),
      deviceCode: normalizeText(record.deviceCode),
      reason: "unknown_or_stale_work_order"
    }))
  };
}

function renderReleaseMatrixCsv(report) {
  const header = [
    "workOrderId",
    "deviceCode",
    "deviceName",
    "owner",
    "signoffComplete",
    "onsiteCanaryCandidate",
    "canEnterCanary",
    "canaryBlockReason",
    "currentZoneTemperatureC",
    "currentSetpointC",
    "currentCommunicationAlarm",
    "currentReasons",
    "missingFields",
    "requiredValues",
    "nextActions",
    "plannedAction",
    "releaseCriteria",
    "verificationTarget",
    "rerunCommand"
  ];
  const rows = report.releaseMatrix.map((item) => [
    item.workOrderId,
    item.deviceCode,
    item.deviceName,
    item.owner,
    item.signoffComplete,
    item.onsiteCanaryCandidate,
    item.canEnterCanary,
    item.canaryBlockReason,
    item.currentEvidence.zoneTemperatureC,
    item.currentEvidence.setpointC,
    item.currentEvidence.communicationAlarm,
    item.currentEvidence.reasons,
    item.missingFields,
    item.requiredValues,
    item.nextActions,
    item.plannedAction,
    item.releaseCriteria,
    item.verificationTarget,
    item.rerunCommand
  ]);
  return `${[header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场消缺签字校验");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 工单数: ${report.summary.expectedWorkOrders}`);
  lines.push(`- 签字完成: ${report.summary.signoffComplete ? "是" : "否"}`);
  lines.push(`- 完成行: ${report.summary.completeRows}/${report.summary.csvRows}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 关键边界");
  lines.push("");
  lines.push("- 本校验只确认现场工单填写完整性。");
  lines.push("- 即使全部签字完成，也必须重跑实时质量整改、全量分批计划和 closeout，不能凭 CSV 直接进入 BA 写入。");
  lines.push("");
  if (report.onsiteReleasePrecheck) {
    lines.push("## 现场放行预检");
    lines.push("");
    lines.push(`- 现场签字候选: ${report.onsiteReleasePrecheck.onsiteReleaseReadyCount}/${report.summary.expectedWorkOrders}`);
    lines.push(`- 现场仍阻断: ${report.onsiteReleasePrecheck.onsiteReleaseBlockedCount}`);
    lines.push(`- Canary 仍阻断: ${report.onsiteReleasePrecheck.canaryStillBlockedCount}`);
    lines.push(`- 下一步: ${(report.onsiteReleasePrecheck.nextGlobalActions || []).join("；")}`);
    lines.push("");
  }
  if (report.summary.missingColumns.length > 0) {
    lines.push(`- 缺失列: ${report.summary.missingColumns.join(", ")}`);
  }
  if (report.summary.missingWorkOrders.length > 0) {
    lines.push(`- 缺失工单: ${report.summary.missingWorkOrders.join(", ")}`);
  }
  if (report.summary.ignoredRows > 0) {
    lines.push(`- 忽略旧工单行: ${report.summary.ignoredRows}`);
  }
  const openRecords = report.records.filter((item) => !item.signoffComplete);
  if (openRecords.length > 0) {
    lines.push("");
    lines.push("## 未通过记录");
    lines.push("");
    for (const item of openRecords) {
      lines.push(`### ${item.workOrderId || item.deviceCode || "--"} ${item.deviceName || ""}`);
      lines.push("");
      lines.push(`- 问题: ${item.issues.join("；") || "unknown"}`);
      for (const missing of item.missingChecklist || []) {
        lines.push(`- ${missing.field}: 应填 ${missing.requiredValue || "--"}；${missing.action}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "workOrderId",
    "deviceCode",
    "deviceName",
    "signoffComplete",
    "issues",
    "missingFields",
    "requiredValues",
    "nextActions",
    "releaseDecision"
  ];
  const rows = report.records.map((item) => [
    item.workOrderId,
    item.deviceCode,
    item.deviceName,
    item.signoffComplete,
    item.issues,
    (item.missingChecklist || []).map((missing) => missing.field),
    (item.missingChecklist || []).map((missing) => `${missing.field}=${missing.requiredValue}`),
    (item.missingChecklist || []).map((missing) => missing.action),
    item.releaseDecision
  ]);
  return `${[header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
  ensureParentDir(RELEASE_MATRIX_CSV);
  fs.writeFileSync(RELEASE_MATRIX_CSV, renderReleaseMatrixCsv(report));
}

function main() {
  const report = buildReport({
    workOrdersResult: readJsonFile(WORK_ORDERS_JSON),
    signoffCsv: readCsvRecords(SIGNOFF_CSV)
  });
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_SIGNOFF ok=${report.ok} complete=${report.summary.completeRows}/${report.summary.expectedWorkOrders} open=${report.summary.openRows} mutation=false`
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
