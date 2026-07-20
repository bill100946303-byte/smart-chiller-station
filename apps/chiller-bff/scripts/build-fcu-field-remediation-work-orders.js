import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const CLOSEOUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-closeout-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.csv");
const SIGNOFF_INPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv");
const SIGNOFF_EDITABLE_COLUMNS = new Set([
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
]);
const INTERNAL_REASON_EXCLUDES = new Set([
  "communication_ok",
  "temperature_valid",
  "setpoint_feedback_valid",
  "global_execution_gate",
  "backend_write_gate",
  "read_only_mode"
]);

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
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

function uniq(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean))];
}

function publicReasons(items) {
  return uniq(items).filter((reason) => !INTERNAL_REASON_EXCLUDES.has(reason));
}

function classifyOwner(reasons) {
  const normalized = uniq(reasons);
  if (normalized.some((reason) => reason.includes("communication") || reason.includes("temperature"))) {
    return "BA/自控工程师";
  }
  if (normalized.some((reason) => reason.includes("writable") || reason.includes("mapping"))) {
    return "平台工程师 + BA工程师";
  }
  return "现场值班 + 平台工程师";
}

function buildVerificationFields(device) {
  const reasons = uniq(device.reasons || []);
  return {
    communicationAlarmAfter: reasons.some((reason) => reason.includes("communication")) ? "必填：0" : "可选",
    zoneTemperatureAfterC: reasons.some((reason) => reason.includes("temperature") || reason.includes("zero")) ? "必填：5-45" : "可选",
    setpointFeedbackAfterC: Number(device.setpointC) <= 10 || Number(device.setpointC) >= 32 ? "必填：10-32" : "可选",
    writePointMappingChecked: "必填：yes/no",
    twoSampleNormal: "必填：yes/no",
    localManualLockout: "必填：none/manual/lockout",
    releaseDecision: "必填：hold/recheck/release"
  };
}

function normalizeWorkOrder(device, index) {
  const deviceCode = normalizeText(device.deviceCode) || `UNKNOWN_${index + 1}`;
  const reasons = publicReasons(device.reasons || []);
  const fieldActions = uniq(device.fieldActions || []);
  const releaseCriteria = uniq(device.releaseCriteria || []);
  return {
    workOrderId: `FCU-P0-${deviceCode}`,
    priority: normalizeText(device.priority) || "P0",
    deviceCode,
    deviceName: normalizeText(device.deviceName) || deviceCode,
    status: "open",
    owner: classifyOwner(reasons),
    plannedAction: fieldActions,
    releaseCriteria,
    currentEvidence: {
      zoneTemperatureC: device.zoneTemperatureC ?? null,
      setpointC: device.setpointC ?? null,
      communicationAlarm: device.communicationAlarm ?? null,
      qualityStatus: device.qualityStatus || null,
      reasons
    },
    fieldVerification: buildVerificationFields(device),
    signoff: {
      handledBy: "",
      handledAt: "",
      reviewedBy: "",
      reviewedAt: "",
      notes: ""
    }
  };
}

function countByReason(workOrders) {
  const counts = new Map();
  for (const item of workOrders) {
    for (const reason of item.currentEvidence.reasons || []) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function groupDevicesByReason(workOrders) {
  const groups = new Map();
  for (const item of workOrders) {
    for (const reason of item.currentEvidence.reasons || []) {
      const devices = groups.get(reason) || [];
      devices.push(item.deviceCode);
      groups.set(reason, devices);
    }
  }
  return [...groups.entries()]
    .map(([reason, devices]) => ({ reason, devices }))
    .sort((left, right) => right.devices.length - left.devices.length || left.reason.localeCompare(right.reason));
}

function buildReport(closeoutResult) {
  const closeout = closeoutResult.payload || {};
  const workOrders = (Array.isArray(closeout.remainingDevices) ? closeout.remainingDevices : [])
    .filter((device) => normalizeText(device.deviceCode) && normalizeText(device.priority || "P0") === "P0")
    .map(normalizeWorkOrder);
  const openCount = workOrders.filter((item) => item.status === "open").length;
  return {
    ok: closeoutResult.ok === true && closeout.ok === true && openCount === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_work_orders",
    siteId: normalizeText(closeout.siteId) || "126lnoffice",
    build: normalizeText(closeout.build) || "1",
    floor: normalizeText(closeout.floor) || "1",
    controlMutation: false,
    dispatch: false,
    sourceCloseout: {
      path: closeoutResult.path,
      ok: closeout.ok === true,
      verdict: closeout.verdict || null,
      readyForCanary: closeout.summary?.readyForCanary === true,
      error: closeoutResult.error || null
    },
    summary: {
      totalWorkOrders: workOrders.length,
      openCount,
      readyForCanaryAfterCloseout: closeout.summary?.readyForCanary === true,
      requiresFieldSignoff: openCount > 0,
      reasonCounts: countByReason(workOrders),
      reasonGroups: groupDevicesByReason(workOrders),
      recommendedOrder: [
        "先处理 communication_alarm：恢复控制器供电、通讯线、地址、网关轮询和 BA 报警复位。",
        "再处理 zero_temperature / invalid_temperature：确认温度点不是 0°C、断线值或量程错误。",
        "再处理 setpoint_feedback_out_of_bounds：将设定反馈分步拉回 10-32°C 策略边界内。",
        "最后核对启停、设定、风速写点 writable=true，并连续两次采样正常。"
      ]
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV,
      signoffInputCsv: SIGNOFF_INPUT_CSV
    },
    importTemplate: {
      requiredColumns: [
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
      ],
      releaseDecisionValues: ["hold", "recheck", "release"],
      note: "现场填写后仍需重跑实时质量整改和 closeout；该工单包不覆盖 BA 实时证据。"
    },
    workOrders
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场消缺工单包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 工单数: ${report.summary.totalWorkOrders}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 现场填写规则");
  lines.push("");
  lines.push("- 处理后必须填写处理人、处理时间、通讯报警复检、温度复检、写点映射复检、连续两次采样、就地/手动/锁定状态、复核人。");
  lines.push("- `releaseDecision=release` 不等于自动放行；必须重跑实时质量整改、全量分批计划和 closeout。");
  lines.push("- 本包只用于现场整改和签字留痕，不产生任何 BA/PLC 写入。");
  lines.push(`- 现场填写文件: ${report.outputs.signoffInputCsv}；刷新工单时不会覆盖已存在的现场填写文件。`);
  lines.push("");
  if (report.summary.reasonCounts.length > 0) {
    lines.push("## 现场处理顺序");
    lines.push("");
    for (const item of report.summary.recommendedOrder) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("## 按原因分组");
    lines.push("");
    for (const item of report.summary.reasonGroups) {
      lines.push(`- ${item.reason}: ${item.devices.length} 台 / ${item.devices.join(", ")}`);
    }
    lines.push("");
  }
  if (report.workOrders.length > 0) {
    lines.push("## 工单");
    lines.push("");
    for (const item of report.workOrders) {
      lines.push(`### ${item.workOrderId} ${item.deviceName}`);
      lines.push(`- 负责人: ${item.owner}`);
      lines.push(`- 当前值: 温度 ${item.currentEvidence.zoneTemperatureC ?? "--"}°C，设定 ${item.currentEvidence.setpointC ?? "--"}°C，通讯报警 ${item.currentEvidence.communicationAlarm ?? "--"}`);
      lines.push(`- 原因: ${item.currentEvidence.reasons.join("；") || "--"}`);
      lines.push("- 现场动作:");
      for (const action of item.plannedAction) {
        lines.push(`  - ${action}`);
      }
      lines.push(`- 放行标准: ${item.releaseCriteria.join("；") || "--"}`);
      lines.push(`- 复检字段: 通讯=${item.fieldVerification.communicationAlarmAfter}，温度=${item.fieldVerification.zoneTemperatureAfterC}，连续采样=${item.fieldVerification.twoSampleNormal}`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "workOrderId",
    "priority",
    "deviceCode",
    "deviceName",
    "owner",
    "status",
    "currentZoneTemperatureC",
    "currentSetpointC",
    "currentCommunicationAlarm",
    "reasons",
    "plannedAction",
    "releaseCriteria",
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
  const rows = report.workOrders.map((item) => [
    item.workOrderId,
    item.priority,
    item.deviceCode,
    item.deviceName,
    item.owner,
    item.status,
    item.currentEvidence.zoneTemperatureC,
    item.currentEvidence.setpointC,
    item.currentEvidence.communicationAlarm,
    item.currentEvidence.reasons,
    item.plannedAction,
    item.releaseCriteria,
    item.signoff.handledBy,
    item.signoff.handledAt,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    item.signoff.reviewedBy,
    item.signoff.reviewedAt,
    item.signoff.notes
  ]);
  return `${[header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function readExistingWorkOrderIds(csvPath) {
  try {
    const text = fs.readFileSync(csvPath, "utf8");
    return new Set(
      text
        .split(/\r?\n/)
        .slice(1)
        .map((line) => normalizeText(line.split(",")[0]))
        .filter(Boolean)
    );
  } catch (_error) {
    return new Set();
  }
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

function parseCsvRecords(text) {
  const rows = parseCsv(text);
  const header = rows[0] || [];
  const records = rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
  return { header, records };
}

function renderCsvRecords(header, records) {
  return `${[
    header,
    ...records.map((record) => header.map((column) => record[column] ?? ""))
  ].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function buildSignoffInputCsv(report, existingText) {
  const current = parseCsvRecords(renderCsv(report));
  if (!normalizeText(existingText)) {
    return renderCsvRecords(current.header, current.records);
  }
  const existing = parseCsvRecords(existingText);
  const existingByWorkOrder = new Map(
    existing.records
      .map((record) => [normalizeText(record.workOrderId), record])
      .filter(([workOrderId]) => Boolean(workOrderId))
  );
  const currentIds = new Set(current.records.map((record) => normalizeText(record.workOrderId)).filter(Boolean));
  const mergedCurrentRecords = current.records.map((record) => {
    const existingRecord = existingByWorkOrder.get(normalizeText(record.workOrderId));
    if (!existingRecord) {
      return record;
    }
    const merged = { ...record };
    for (const column of SIGNOFF_EDITABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(existingRecord, column)) {
        merged[column] = existingRecord[column] ?? "";
      }
    }
    return merged;
  });
  const staleRecords = existing.records.filter((record) => {
    const workOrderId = normalizeText(record.workOrderId);
    return workOrderId && !currentIds.has(workOrderId);
  });
  return renderCsvRecords(current.header, [...mergedCurrentRecords, ...staleRecords]);
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  const csv = renderCsv(report);
  fs.writeFileSync(OUTPUT_CSV, csv);
  if (!fs.existsSync(SIGNOFF_INPUT_CSV)) {
    ensureParentDir(SIGNOFF_INPUT_CSV);
    fs.writeFileSync(SIGNOFF_INPUT_CSV, csv);
  } else {
    const existingText = fs.readFileSync(SIGNOFF_INPUT_CSV, "utf8");
    fs.writeFileSync(SIGNOFF_INPUT_CSV, buildSignoffInputCsv(report, existingText));
  }
}

function main() {
  const closeoutResult = readJsonFile(CLOSEOUT_JSON);
  const report = buildReport(closeoutResult);
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_WORK_ORDERS ok=${report.ok} workOrders=${report.summary.totalWorkOrders} open=${report.summary.openCount} mutation=false`
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
