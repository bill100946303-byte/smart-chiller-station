import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const SIGNOFF_INPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.md");
const OUTPUT_CURRENT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-current-only-latest.csv");
const OUTPUT_STALE_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-stale-rows-latest.csv");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
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

function deriveHeader(signoffCsv, workOrders) {
  if (signoffCsv.header.length > 0) {
    return signoffCsv.header;
  }
  return [
    "workOrderId",
    "priority",
    "deviceCode",
    "deviceName",
    "owner",
    "status",
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
  ].filter((column) => column || workOrders.length >= 0);
}

function recordFromWorkOrder(workOrder, header) {
  const values = {
    workOrderId: workOrder.workOrderId || "",
    priority: workOrder.priority || "P0",
    deviceCode: workOrder.deviceCode || "",
    deviceName: workOrder.deviceName || "",
    owner: workOrder.owner || "",
    status: workOrder.status || "open",
    currentZoneTemperatureC: workOrder.currentEvidence?.zoneTemperatureC ?? "",
    currentSetpointC: workOrder.currentEvidence?.setpointC ?? "",
    currentCommunicationAlarm: workOrder.currentEvidence?.communicationAlarm ?? "",
    reasons: workOrder.currentEvidence?.reasons || [],
    plannedAction: workOrder.plannedAction || [],
    releaseCriteria: workOrder.releaseCriteria || []
  };
  return Object.fromEntries(header.map((column) => [column, values[column] ?? ""]));
}

function renderCsv(header, records) {
  return `${[header, ...records.map((record) => header.map((column) => record[column] ?? ""))]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}\n`;
}

function buildReport({ workOrdersResult, signoffCsv }) {
  const workOrders = Array.isArray(workOrdersResult.payload?.workOrders) ? workOrdersResult.payload.workOrders : [];
  const header = deriveHeader(signoffCsv, workOrders);
  const expectedIds = new Set(workOrders.map((item) => normalizeText(item.workOrderId)).filter(Boolean));
  const recordsById = new Map(signoffCsv.records.map((record) => [normalizeText(record.workOrderId), record]));
  const currentRecords = workOrders.map((workOrder) => {
    const workOrderId = normalizeText(workOrder.workOrderId);
    return recordsById.get(workOrderId) || recordFromWorkOrder(workOrder, header);
  });
  const staleRecords = signoffCsv.records.filter((record) => !expectedIds.has(normalizeText(record.workOrderId)));
  return {
    ok: workOrdersResult.ok === true && signoffCsv.ok === true && staleRecords.length === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_signoff_clean_input",
    siteId: normalizeText(workOrdersResult.payload?.siteId) || "126lnoffice",
    build: normalizeText(workOrdersResult.payload?.build) || "1",
    floor: normalizeText(workOrdersResult.payload?.floor) || "1",
    controlMutation: false,
    dispatch: false,
    summary: {
      expectedWorkOrders: workOrders.length,
      sourceRows: signoffCsv.records.length,
      currentRows: currentRecords.length,
      staleRows: staleRecords.length,
      generatedMissingRows: currentRecords.filter((record) => !recordsById.has(normalizeText(record.workOrderId))).length
    },
    source: {
      workOrdersJson: workOrdersResult.path,
      signoffInputCsv: signoffCsv.path,
      workOrdersError: workOrdersResult.error || null,
      signoffInputError: signoffCsv.error || null
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      currentCsv: OUTPUT_CURRENT_CSV,
      staleCsv: OUTPUT_STALE_CSV
    },
    header,
    currentRecords,
    staleRecords: staleRecords.map((record) => ({
      workOrderId: normalizeText(record.workOrderId),
      deviceCode: normalizeText(record.deviceCode),
      deviceName: normalizeText(record.deviceName),
      reason: "not_in_current_work_orders"
    }))
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场签字输入清理包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 当前工单: ${report.summary.expectedWorkOrders}`);
  lines.push(`- 当前有效行: ${report.summary.currentRows}`);
  lines.push(`- 旧行: ${report.summary.staleRows}`);
  lines.push(`- 补生成缺失行: ${report.summary.generatedMissingRows}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 使用边界");
  lines.push("");
  lines.push("- 本脚本不覆盖原始现场填写文件，只输出 current-only 和 stale-rows 两份派生 CSV。");
  lines.push("- current-only 文件用于现场继续填写当前工单；stale-rows 文件只用于归档审计。");
  lines.push("- 清理旧行不等于放行，仍需重跑签字校验、实时 closeout 和 Canary 总门禁。");
  lines.push("");
  lines.push(`- 当前有效 CSV: ${report.outputs.currentCsv}`);
  lines.push(`- 旧行归档 CSV: ${report.outputs.staleCsv}`);
  if (report.staleRecords.length > 0) {
    lines.push("");
    lines.push("## 旧行");
    lines.push("");
    for (const record of report.staleRecords) {
      lines.push(`- ${record.workOrderId || "--"} ${record.deviceCode || ""} ${record.deviceName || ""}: ${record.reason}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CURRENT_CSV);
  fs.writeFileSync(OUTPUT_CURRENT_CSV, renderCsv(report.header, report.currentRecords));
  ensureParentDir(OUTPUT_STALE_CSV);
  fs.writeFileSync(OUTPUT_STALE_CSV, renderCsv(report.header, report.staleRecords));
}

function main() {
  const report = buildReport({
    workOrdersResult: readJsonFile(WORK_ORDERS_JSON),
    signoffCsv: readCsvRecords(SIGNOFF_INPUT_CSV)
  });
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN ok=${report.ok} current=${report.summary.currentRows} stale=${report.summary.staleRows} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`currentCsv=${OUTPUT_CURRENT_CSV}`);
  console.log(`staleCsv=${OUTPUT_STALE_CSV}`);
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
