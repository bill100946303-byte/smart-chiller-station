#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.resolve(__dirname, "../.local/byx-power-assignments.json");

const CATEGORY_LABELS = {
  chiller_plant: "冷站动力",
  hvac_terminal: "空调末端",
  lighting: "照明",
  outlet: "插座",
  logistics: "后勤用电",
  weak_current: "弱电/IT",
  backup: "备用/其他",
  other: "未归类"
};

const CATEGORY_BY_LABEL = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [label, key])
);

function normalizeText(value) {
  return value == null ? "" : String(value).replace(/^\uFEFF/, "").trim();
}

function normalizeCategory(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  if (CATEGORY_LABELS[text]) {
    return text;
  }
  return CATEGORY_BY_LABEL[text] || "";
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: process.env.BYX_POWER_ASSIGNMENT_FILE || DEFAULT_OUTPUT,
    siteId: "",
    merge: false,
    includeUnconfirmed: false
  };
  for (const item of argv) {
    if (item === "--merge") {
      args.merge = true;
    } else if (item === "--include-unconfirmed") {
      args.includeUnconfirmed = true;
    } else if (item.startsWith("--input=")) {
      args.input = item.slice("--input=".length);
    } else if (item.startsWith("--output=")) {
      args.output = item.slice("--output=".length);
    } else if (item.startsWith("--site-id=")) {
      args.siteId = item.slice("--site-id=".length);
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  if (row.length > 1 || normalizeText(row[0])) {
    rows.push(row);
  }
  return rows;
}

function rowValue(row, ...names) {
  for (const name of names) {
    const value = row[name];
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function readCsvRecords(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map(normalizeText);
  return rows.slice(1)
    .filter((row) => row.some((value) => normalizeText(value)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function hasConfirmation(row) {
  return Boolean(
    rowValue(row, "业主确认用途", "ownerConfirmedCategory") ||
    rowValue(row, "业主确认系统", "ownerConfirmedSystem") ||
    rowValue(row, "安装位置", "ownerConfirmedLocation") ||
    rowValue(row, "配电箱/回路", "ownerConfirmedPanel") ||
    rowValue(row, "现场备注", "fieldNote")
  );
}

function buildAssignment(row, options) {
  const siteId = rowValue(row, "站点", "siteId") || options.siteId;
  if (options.siteId && siteId && siteId !== options.siteId) {
    return { skipped: true, reason: "site_mismatch" };
  }
  const projectId = rowValue(row, "百益信项目ID", "projectId");
  const projectName = rowValue(row, "百益信项目", "projectName");
  const deviceId = rowValue(row, "设备ID", "deviceId");
  const deviceName = rowValue(row, "设备名称", "deviceName");
  if (!deviceId && !deviceName) {
    return { skipped: true, reason: "missing_device_identity" };
  }
  const confirmedCategoryRaw = rowValue(row, "业主确认用途", "ownerConfirmedCategory");
  const category = normalizeCategory(confirmedCategoryRaw);
  if (confirmedCategoryRaw && !category) {
    return { error: `Unsupported category "${confirmedCategoryRaw}" for device ${deviceId || deviceName}` };
  }
  const confirmed = hasConfirmation(row);
  if (!confirmed && !options.includeUnconfirmed) {
    return { skipped: true, reason: "empty_confirmation" };
  }
  return {
    assignment: {
      siteId,
      projectId,
      projectName,
      deviceId,
      deviceName,
      category,
      categoryLabel: category ? CATEGORY_LABELS[category] : "",
      system: rowValue(row, "业主确认系统", "ownerConfirmedSystem"),
      location: rowValue(row, "安装位置", "ownerConfirmedLocation"),
      panel: rowValue(row, "配电箱/回路", "ownerConfirmedPanel"),
      status: confirmed ? "confirmed" : "draft",
      note: rowValue(row, "现场备注", "fieldNote"),
      updatedAt: new Date().toISOString()
    }
  };
}

function identityOf(assignment) {
  return [
    normalizeText(assignment.siteId),
    normalizeText(assignment.projectId),
    normalizeText(assignment.deviceId) || normalizeText(assignment.deviceName)
  ].join(":");
}

function readExistingAssignments(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.assignments)) {
    return payload.assignments;
  }
  if (payload.devices && typeof payload.devices === "object" && !Array.isArray(payload.devices)) {
    return Object.values(payload.devices);
  }
  return [];
}

export function importByxPowerAssignments(options) {
  if (!options.input) {
    throw new Error("Missing --input=<assignment.csv>");
  }
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output || DEFAULT_OUTPUT);
  const records = readCsvRecords(inputPath);
  const assignments = [];
  const skipped = {};
  const errors = [];
  for (const record of records) {
    const result = buildAssignment(record, options);
    if (result.error) {
      errors.push(result.error);
    } else if (result.skipped) {
      skipped[result.reason] = (skipped[result.reason] || 0) + 1;
    } else {
      assignments.push(result.assignment);
    }
  }
  if (errors.length > 0) {
    const error = new Error(errors.join("; "));
    error.summary = { errors };
    throw error;
  }

  const byIdentity = new Map();
  if (options.merge) {
    for (const existing of readExistingAssignments(outputPath)) {
      byIdentity.set(identityOf(existing), existing);
    }
  }
  for (const assignment of assignments) {
    byIdentity.set(identityOf(assignment), assignment);
  }
  const nextAssignments = Array.from(byIdentity.values()).sort((left, right) => {
    const projectCompare = normalizeText(left.projectName).localeCompare(normalizeText(right.projectName), "zh-CN");
    if (projectCompare !== 0) return projectCompare;
    return normalizeText(left.deviceName).localeCompare(normalizeText(right.deviceName), "zh-CN");
  });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceCsv: inputPath,
    assignments: nextAssignments
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    ok: true,
    input: inputPath,
    output: outputPath,
    readRows: records.length,
    importedRows: assignments.length,
    outputRows: nextAssignments.length,
    skipped,
    merge: options.merge === true,
    includeUnconfirmed: options.includeUnconfirmed === true
  };
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/import-byx-power-assignments.js --input=/path/byx-power-assignment.csv [--output=/path/byx-power-assignments.json] [--site-id=140] [--merge]",
    "",
    "Notes:",
    "  - Reads the CSV exported by /power-monitoring/byx/assignment.csv.",
    "  - Imports only rows with owner-confirmed fields by default.",
    "  - Writes local JSON only; it does not call BYX control APIs, PLC, or scene execution."
  ].join("\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const summary = importByxPowerAssignments(args);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(error?.summary ? { summary: error.summary } : {})
    }, null, 2));
    process.exit(1);
  }
}
