import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_STRICT).toLowerCase()
);
const DEFAULT_INPUT_DIR = path.resolve(ROOT_DIR, "docs/field-data/optimize-demo-140");
const DEFAULT_INPUT = path.resolve(DEFAULT_INPUT_DIR, "sensor-calibration-installation.csv");
const INPUT_CSV = resolvePath(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV, DEFAULT_INPUT);
const OUTPUT_JSON = resolvePath(
  process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_JSON,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.json")
);
const OUTPUT_MD = resolvePath(
  process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_MD,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.md")
);
const NORMALIZED_CSV = resolvePath(
  process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_NORMALIZED_CSV,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-calibration-installation-normalized-latest.csv")
);

const CONTROL_BOUNDARY =
  "传感器台账预检只校验校准记录、安装位置和点位映射完整性；不判定仪表故障，不自动修正测点，不写真实 PLC。";

const COLUMNS = [
  { key: "pointCode", label: "点位编码", required: true },
  { key: "pointName", label: "点位名称", required: true },
  { key: "sensorType", label: "仪表类型", required: true },
  { key: "systemSide", label: "系统侧", required: false },
  { key: "equipmentId", label: "设备ID", required: false },
  { key: "location", label: "安装位置", required: true },
  { key: "installPosition", label: "安装点描述", required: true },
  { key: "unit", label: "单位", required: false },
  { key: "rangeLow", label: "量程下限", required: false },
  { key: "rangeHigh", label: "量程上限", required: false },
  { key: "accuracyClass", label: "精度等级", required: false },
  { key: "lastCalibrationDate", label: "最近校准日期", required: true },
  { key: "calibrationDueDate", label: "下次校准日期", required: true },
  { key: "calibrationProvider", label: "校准机构", required: false },
  { key: "owner", label: "责任人", required: true },
  { key: "sourceSystem", label: "来源系统", required: true, fallback: "field_ledger" },
  { key: "remark", label: "备注", required: false }
];

const FIELD_ALIASES = {
  pointCode: ["pointCode", "点位编码", "点名", "点位号", "tag", "tagName", "point"],
  pointName: ["pointName", "点位名称", "名称", "描述", "tagDescription", "pointDesc"],
  sensorType: ["sensorType", "仪表类型", "传感器类型", "类型", "meterType", "sensor"],
  systemSide: ["systemSide", "系统侧", "系统", "专业", "side"],
  equipmentId: ["equipmentId", "设备ID", "设备编号", "设备", "deviceId", "equipment"],
  location: ["location", "安装位置", "位置", "区域", "楼层", "机房位置"],
  installPosition: ["installPosition", "安装点描述", "安装点", "探头位置", "测点位置", "取压位置"],
  unit: ["unit", "单位", "uom"],
  rangeLow: ["rangeLow", "量程下限", "下限", "rangeMin", "min"],
  rangeHigh: ["rangeHigh", "量程上限", "上限", "rangeMax", "max"],
  accuracyClass: ["accuracyClass", "精度等级", "精度", "accuracy"],
  lastCalibrationDate: ["lastCalibrationDate", "最近校准日期", "校准日期", "上次校准", "lastCalibration"],
  calibrationDueDate: ["calibrationDueDate", "下次校准日期", "校准有效期", "到期日期", "dueDate"],
  calibrationProvider: ["calibrationProvider", "校准机构", "检测机构", "provider"],
  owner: ["owner", "责任人", "维护人", "负责人"],
  sourceSystem: ["sourceSystem", "来源系统", "来源", "系统", "source"],
  remark: ["remark", "备注", "说明", "comment", "note"]
};

const SENSOR_TYPE_NORMALIZATION = {
  温度: "temperature",
  温度计: "temperature",
  温度传感器: "temperature",
  流量: "flow",
  流量计: "flow",
  压力: "pressure",
  压差: "pressure",
  电表: "power",
  功率: "power",
  电能: "power",
  冷量表: "cooling_energy",
  冷量: "cooling_energy",
  湿球: "wet_bulb",
  湿度: "humidity"
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, "").replace(/[_-]+/g, "").toLowerCase();
}

function resolvePath(value, fallback) {
  const text = normalizeText(value);
  if (!text) {
    return path.resolve(fallback);
  }
  return path.isAbsolute(text) ? text : path.resolve(ROOT_DIR, text);
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pushUnique(list, value) {
  const text = normalizeText(value);
  if (text && !list.includes(text)) {
    list.push(text);
  }
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function renderCsv(columns, rows) {
  const keys = columns.map((column) => column.key);
  const lines = [keys.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(keys.map((key) => csvEscape(row[key] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
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
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(cell);
      cell = "";
    } else if (char === "\n") {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  if (inQuotes) {
    throw new Error("CSV 引号未闭合");
  }
  if (!rows.length) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((header) => normalizeText(header));
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cellValue) => normalizeText(cellValue)))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = normalizeText(row[index] ?? "");
      });
      return record;
    });
  return { headers, rows: dataRows };
}

function buildHeaderMap(headers) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const map = new Map();
  for (const column of COLUMNS) {
    const aliases = FIELD_ALIASES[column.key] || [column.key];
    for (const alias of [column.key, column.label, ...aliases]) {
      const matchedHeader = normalizedHeaders.get(normalizeHeader(alias));
      if (matchedHeader) {
        map.set(column.key, matchedHeader);
        break;
      }
    }
  }
  return map;
}

function normalizeNumber(value) {
  const text = normalizeText(String(value ?? "")).replace(/,/g, "");
  if (!text) {
    return "";
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? String(parsed) : text;
}

function normalizeSensorType(value) {
  const text = normalizeText(value);
  return SENSOR_TYPE_NORMALIZATION[text] || text;
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return text;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeRow(rawRow, headerMap) {
  const row = {};
  for (const column of COLUMNS) {
    const header = headerMap.get(column.key);
    row[column.key] = normalizeText(header ? rawRow[header] : "") || column.fallback || "";
  }
  row.sensorType = normalizeSensorType(row.sensorType);
  row.rangeLow = normalizeNumber(row.rangeLow);
  row.rangeHigh = normalizeNumber(row.rangeHigh);
  row.lastCalibrationDate = normalizeDate(row.lastCalibrationDate);
  row.calibrationDueDate = normalizeDate(row.calibrationDueDate);
  return row;
}

function inputMode(inputPath) {
  if (!fs.existsSync(inputPath)) {
    return "missing";
  }
  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) {
    return "not_file";
  }
  if (path.resolve(inputPath).startsWith(path.resolve(DEFAULT_INPUT_DIR))) {
    return "field_drop_folder";
  }
  return "explicit_field_export";
}

function validateRows(rows, headerMap, generatedAt) {
  const blockers = [];
  const warnings = [];
  const now = Date.parse(generatedAt);
  const requiredColumns = COLUMNS.filter((column) => column.required);
  for (const column of requiredColumns) {
    if (!headerMap.has(column.key) && !column.fallback) {
      pushUnique(warnings, `输入表头未显式包含 ${column.label}(${column.key})。`);
    }
  }
  if (!rows.length) {
    pushUnique(blockers, "传感器台账没有数据行。");
  }
  const seenPointCodes = new Set();
  const sensorTypes = new Set();
  rows.forEach((row, index) => {
    const rowLabel = `第 ${index + 1} 行`;
    for (const column of requiredColumns) {
      if (!normalizeText(row[column.key])) {
        pushUnique(blockers, `${rowLabel} 缺少必填字段 ${column.label}(${column.key})。`);
      }
    }
    if (seenPointCodes.has(row.pointCode)) {
      pushUnique(warnings, `${rowLabel} 点位编码重复：${row.pointCode}。`);
    }
    if (row.pointCode) {
      seenPointCodes.add(row.pointCode);
    }
    if (row.sensorType) {
      sensorTypes.add(row.sensorType);
    }
    for (const field of ["lastCalibrationDate", "calibrationDueDate"]) {
      const text = normalizeText(row[field]);
      if (text && Number.isNaN(Date.parse(text))) {
        pushUnique(blockers, `${rowLabel} 日期字段 ${field} 无法解析：${text}`);
      }
    }
    if (row.calibrationDueDate && !Number.isNaN(Date.parse(row.calibrationDueDate)) && Date.parse(row.calibrationDueDate) < now) {
      pushUnique(warnings, `${rowLabel} 点位 ${row.pointCode || row.pointName} 校准已过期：${row.calibrationDueDate}。`);
    }
    if (!row.rangeLow || !row.rangeHigh) {
      pushUnique(warnings, `${rowLabel} 点位 ${row.pointCode || row.pointName} 缺量程上下限，偏移诊断只能做方向性复核。`);
    }
    if (!row.accuracyClass) {
      pushUnique(warnings, `${rowLabel} 点位 ${row.pointCode || row.pointName} 缺精度等级。`);
    }
  });

  for (const requiredType of ["temperature", "flow", "power", "wet_bulb"]) {
    if (!sensorTypes.has(requiredType)) {
      pushUnique(warnings, `台账未覆盖 ${requiredType} 类关键仪表，相关偏移候选仍需现场补证据。`);
    }
  }

  return { blockers, warnings };
}

function decide(mode, blockers, warnings, rows) {
  if (mode !== "field_drop_folder" && mode !== "explicit_field_export") {
    return "SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS";
  }
  if (blockers.length > 0) {
    return "SENSOR_LEDGER_PREFLIGHT_BLOCKED";
  }
  if (warnings.length > 0 || rows.length === 0) {
    return "SENSOR_LEDGER_PREFLIGHT_PARTIAL";
  }
  return "SENSOR_LEDGER_PREFLIGHT_READY";
}

function buildTemplateRows() {
  return [
    {
      pointCode: "B25_CHW_SUPPLY_TEMP",
      pointName: "冷冻水总供水温度",
      sensorType: "temperature",
      systemSide: "chilled_water",
      equipmentId: "CHW-HEADER",
      location: "冷冻站机房总管",
      installPosition: "冷冻水供水总管出站侧",
      unit: "C",
      rangeLow: "0",
      rangeHigh: "50",
      accuracyClass: "0.2C",
      lastCalibrationDate: "2026-01-01",
      calibrationDueDate: "2027-01-01",
      calibrationProvider: "field_provider",
      owner: "site_operator",
      sourceSystem: "field_ledger",
      remark: "示例，请替换为现场真实台账"
    }
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 140 传感器校准/安装位置台账预检报告");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.finalDecision}\``);
  lines.push("");
  lines.push(`边界：${report.controlBoundary}`);
  lines.push("");
  lines.push("## 输入文件");
  lines.push("");
  lines.push("| 表 | 环境变量 | 路径 | 状态 |");
  lines.push("| --- | --- | --- | --- |");
  lines.push(`| 传感器校准/安装位置台账 | \`OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV\` | \`${report.input.path}\` | ${report.input.mode} |`);
  lines.push("");
  lines.push("## 预检摘要");
  lines.push("");
  lines.push("| 项目 | 结果 |");
  lines.push("| --- | --- |");
  lines.push(`| totalRows | ${report.summary.totalRows} |`);
  lines.push(`| acceptedRows | ${report.summary.acceptedRows} |`);
  lines.push(`| expiredCalibrationCount | ${report.summary.expiredCalibrationCount} |`);
  lines.push(`| missingRangeCount | ${report.summary.missingRangeCount} |`);
  lines.push(`| warnings | ${report.summary.warningsCount} |`);
  lines.push(`| blockers | ${report.summary.blockersCount} |`);
  lines.push("");
  if (report.blockers.length > 0) {
    lines.push("## 阻断项");
    lines.push("");
    report.blockers.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  if (report.warnings.length > 0) {
    lines.push("## 警告");
    lines.push("");
    report.warnings.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  lines.push("## 口径");
  lines.push("");
  lines.push("- `SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS`：现场台账尚未放入约定路径，或环境变量未指向真实文件。");
  lines.push("- `SENSOR_LEDGER_PREFLIGHT_READY`：台账可读、字段可映射、无 blocker/warning，可作为仪表偏移 V1 的复核证据。");
  lines.push("- `SENSOR_LEDGER_PREFLIGHT_PARTIAL`：台账可读但存在校准过期、缺量程或覆盖不足，只能提高部分复核效率。");
  lines.push("- 本预检不判定仪表故障，不自动修正测点，不写真实 PLC。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const generatedAt = new Date().toISOString();
  const mode = inputMode(INPUT_CSV);
  let rows = [];
  let sourceHeaders = [];
  let headerMap = new Map();
  const blockers = [];
  const warnings = [];

  if (mode === "field_drop_folder" || mode === "explicit_field_export") {
    try {
      const parsed = parseCsv(fs.readFileSync(INPUT_CSV, "utf8"));
      sourceHeaders = parsed.headers;
      headerMap = buildHeaderMap(parsed.headers);
      rows = parsed.rows.map((row) => normalizeRow(row, headerMap));
      const validation = validateRows(rows, headerMap, generatedAt);
      blockers.push(...validation.blockers);
      warnings.push(...validation.warnings);
    } catch (error) {
      pushUnique(blockers, `CSV 解析失败：${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (mode === "not_file") {
    pushUnique(blockers, `传感器台账路径不是文件：${INPUT_CSV}`);
  }

  const finalDecision = decide(mode, blockers, warnings, rows);
  const reportBlockers = mode === "missing" ? [`缺少传感器校准/安装位置台账 CSV：${INPUT_CSV}`] : blockers;
  const expiredCalibrationCount = rows.filter(
    (row) => row.calibrationDueDate && !Number.isNaN(Date.parse(row.calibrationDueDate)) && Date.parse(row.calibrationDueDate) < Date.parse(generatedAt)
  ).length;
  const missingRangeCount = rows.filter((row) => !row.rangeLow || !row.rangeHigh).length;
  const acceptedRows = blockers.length === 0 ? rows.length : 0;

  const report = {
    generatedAt,
    siteId: SITE_ID,
    finalDecision,
    scope: "optimize_demo_140_sensor_ledger_preflight",
    executionMode: "read_only",
    controlBoundary: CONTROL_BOUNDARY,
    input: {
      key: "sensor_calibration_installation_ledger",
      title: "传感器校准/安装位置台账",
      env: "OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV",
      path: rel(INPUT_CSV),
      exists: fs.existsSync(INPUT_CSV),
      mode,
      requiredForReady: true
    },
    inputs: [
      {
        key: "sensor_calibration_installation_ledger",
        title: "传感器校准/安装位置台账",
        env: "OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV",
        path: rel(INPUT_CSV),
        exists: fs.existsSync(INPUT_CSV),
        mode,
        requiredForReady: true
      }
    ],
    sourceHeaders,
    headerMap: Object.fromEntries([...headerMap.entries()]),
    summary: {
      totalRows: rows.length,
      acceptedRows,
      blockersCount: reportBlockers.length,
      warningsCount: warnings.length,
      expiredCalibrationCount,
      missingRangeCount,
      sensorTypeCount: new Set(rows.map((row) => row.sensorType).filter(Boolean)).size,
      pointCodeCount: new Set(rows.map((row) => row.pointCode).filter(Boolean)).size
    },
    normalizedOutput: rel(NORMALIZED_CSV),
    templateRows: mode === "missing" ? buildTemplateRows() : [],
    blockers: reportBlockers,
    warnings
  };

  ensureDir(NORMALIZED_CSV);
  fs.writeFileSync(NORMALIZED_CSV, renderCsv(COLUMNS, rows.length ? rows : buildTemplateRows()), "utf8");
  ensureDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), "utf8");
  ensureDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 sensor ledger preflight: ${report.finalDecision}\n`);
  process.stdout.write(`accepted=${report.summary.acceptedRows} warnings=${report.summary.warningsCount} blockers=${report.summary.blockersCount}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (report.blockers.length > 0) {
    process.stdout.write(`blockers=${report.blockers.length}\n`);
    for (const blocker of report.blockers.slice(0, 8)) {
      process.stdout.write(`- ${blocker}\n`);
    }
  }
  if (report.warnings.length > 0) {
    process.stdout.write(`warnings=${report.warnings.length}\n`);
    for (const warning of report.warnings.slice(0, 8)) {
      process.stdout.write(`- ${warning}\n`);
    }
  }
  if (STRICT && report.finalDecision !== "SENSOR_LEDGER_PREFLIGHT_READY") {
    process.exitCode = 1;
  }
}

main();
