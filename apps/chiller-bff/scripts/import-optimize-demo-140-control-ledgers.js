import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_STRICT).toLowerCase()
);

const DEFAULT_CONTROL_TREND_INPUT = path.resolve(
  ROOT_DIR,
  "docs/optimize-demo-140-control-command-feedback-template-latest.csv"
);
const DEFAULT_START_STOP_INPUT = path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-template-latest.csv");
const DEFAULT_CONTROL_PARAMETER_INPUT = path.resolve(
  ROOT_DIR,
  "docs/optimize-demo-140-control-parameter-template-latest.csv"
);

const INPUT_CONTROL_TREND_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV) || DEFAULT_CONTROL_TREND_INPUT;
const INPUT_START_STOP_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_START_STOP_INPUT_CSV) || DEFAULT_START_STOP_INPUT;
const INPUT_CONTROL_PARAMETER_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV) || DEFAULT_CONTROL_PARAMETER_INPUT;

const OUTPUT_JSON =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_JSON) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-latest.json");
const OUTPUT_MD =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_MD) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-latest.md");
const OUTPUT_CONTROL_TREND_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_TREND_NORMALIZED_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-command-feedback-normalized-latest.csv");
const OUTPUT_START_STOP_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_START_STOP_NORMALIZED_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-normalized-latest.csv");
const OUTPUT_CONTROL_PARAMETER_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_NORMALIZED_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-parameter-normalized-latest.csv");

const CONTROL_BOUNDARY =
  "导入器只做现场台账回填、字段规范化和证据校验，不自动改 PID，不自动启停设备，不写真实 PLC。";

const CONTROL_TREND_COLUMNS = [
  { key: "timestamp", label: "采样时间", required: true },
  { key: "siteId", label: "站点ID", required: true, fallback: SITE_ID },
  { key: "loopKey", label: "控制回路", required: true },
  { key: "equipmentType", label: "设备类型", required: true },
  { key: "equipmentId", label: "设备ID", required: true },
  { key: "signalRole", label: "信号角色", required: true },
  { key: "pointCode", label: "点位编码", required: true },
  { key: "pointName", label: "点位名称", required: true },
  { key: "value", label: "数值", required: true },
  { key: "unit", label: "单位", required: true },
  { key: "controlMode", label: "控制模式", required: false },
  { key: "sampleIntervalSec", label: "采样周期秒", required: true, fallback: "60" },
  { key: "qualityFlag", label: "质量标记", required: true, fallback: "good" },
  { key: "sourceSystem", label: "来源系统", required: true, fallback: "SCADA" },
  { key: "remark", label: "备注", required: false }
];

const START_STOP_COLUMNS = [
  { key: "eventAt", label: "事件时间", required: true },
  { key: "siteId", label: "站点ID", required: true, fallback: SITE_ID },
  { key: "equipmentType", label: "设备类型", required: true },
  { key: "equipmentId", label: "设备ID", required: true },
  { key: "eventType", label: "事件类型", required: true },
  { key: "previousStatus", label: "前状态", required: false },
  { key: "nextStatus", label: "后状态", required: true },
  { key: "commandSource", label: "命令来源", required: false },
  { key: "reasonCode", label: "原因码", required: false },
  { key: "runMinutesBeforeEvent", label: "事件前运行分钟", required: false },
  { key: "stopMinutesBeforeEvent", label: "事件前停机分钟", required: false },
  { key: "alarmActive", label: "是否有告警", required: true, fallback: "false" },
  { key: "sourceSystem", label: "来源系统", required: true, fallback: "SCADA" },
  { key: "remark", label: "备注", required: false }
];

const CONTROL_PARAMETER_COLUMNS = [
  { key: "effectiveAt", label: "生效时间", required: true },
  { key: "siteId", label: "站点ID", required: true, fallback: SITE_ID },
  { key: "loopKey", label: "控制回路", required: true },
  { key: "equipmentType", label: "设备类型", required: false },
  { key: "equipmentId", label: "设备ID", required: false },
  { key: "parameterKey", label: "参数键", required: true },
  { key: "parameterName", label: "参数名称", required: true },
  { key: "value", label: "参数值", required: true },
  { key: "unit", label: "单位", required: false },
  { key: "previousValue", label: "上一值", required: false },
  { key: "rollbackValue", label: "回退值", required: false },
  { key: "changeTicket", label: "变更单号", required: false },
  { key: "approvedBy", label: "批准人", required: false },
  { key: "sourceSystem", label: "来源系统", required: true, fallback: "PLC/SCADA" },
  { key: "remark", label: "备注", required: false }
];

const TABLES = [
  {
    key: "control_command_feedback_trend",
    title: "控制命令/反馈高频趋势",
    inputPath: INPUT_CONTROL_TREND_CSV,
    defaultInputPath: DEFAULT_CONTROL_TREND_INPUT,
    outputPath: OUTPUT_CONTROL_TREND_CSV,
    columns: CONTROL_TREND_COLUMNS,
    timestampFields: ["timestamp"],
    numericFields: ["value", "sampleIntervalSec"],
    validators: [validateTrendRows]
  },
  {
    key: "start_stop_event_ledger",
    title: "设备启停事件台账",
    inputPath: INPUT_START_STOP_CSV,
    defaultInputPath: DEFAULT_START_STOP_INPUT,
    outputPath: OUTPUT_START_STOP_CSV,
    columns: START_STOP_COLUMNS,
    timestampFields: ["eventAt"],
    numericFields: ["runMinutesBeforeEvent", "stopMinutesBeforeEvent"],
    validators: [validateEventRows]
  },
  {
    key: "control_parameter_ledger",
    title: "PID/死区/延时参数台账",
    inputPath: INPUT_CONTROL_PARAMETER_CSV,
    defaultInputPath: DEFAULT_CONTROL_PARAMETER_INPUT,
    outputPath: OUTPUT_CONTROL_PARAMETER_CSV,
    columns: CONTROL_PARAMETER_COLUMNS,
    timestampFields: ["effectiveAt"],
    numericFields: ["value", "previousValue", "rollbackValue"],
    validators: [validateParameterRows]
  }
];

const FIELD_ALIASES = {
  timestamp: ["timestamp", "采样时间", "时间", "采集时间", "记录时间", "datetime", "date_time", "ts"],
  eventAt: ["eventAt", "事件时间", "时间", "启停时间", "发生时间", "datetime", "date_time", "ts"],
  effectiveAt: ["effectiveAt", "生效时间", "设置时间", "参数时间", "修改时间", "datetime", "date_time", "ts"],
  siteId: ["siteId", "站点ID", "站点", "项目ID", "site", "site_id", "projectId"],
  loopKey: ["loopKey", "控制回路", "回路", "loop", "loop_key", "controlLoop"],
  equipmentType: ["equipmentType", "设备类型", "类型", "deviceType", "equipment_type"],
  equipmentId: ["equipmentId", "设备ID", "设备", "设备编号", "deviceId", "equipment_id", "device"],
  signalRole: ["signalRole", "信号角色", "角色", "点位角色", "signal_role"],
  pointCode: ["pointCode", "点位编码", "点名", "点位", "点位号", "tag", "tagName", "point"],
  pointName: ["pointName", "点位名称", "名称", "描述", "tagDescription", "pointDesc"],
  value: ["value", "数值", "值", "当前值", "参数值", "采样值", "val"],
  unit: ["unit", "单位", "uom"],
  controlMode: ["controlMode", "控制模式", "模式", "mode"],
  sampleIntervalSec: ["sampleIntervalSec", "采样周期秒", "采样周期", "周期秒", "intervalSec", "sample_interval_sec"],
  qualityFlag: ["qualityFlag", "质量标记", "质量", "数据质量", "quality", "quality_flag"],
  sourceSystem: ["sourceSystem", "来源系统", "来源", "系统", "source", "source_system"],
  remark: ["remark", "备注", "说明", "comment", "note"],
  eventType: ["eventType", "事件类型", "启停类型", "动作", "event", "event_type"],
  previousStatus: ["previousStatus", "前状态", "原状态", "previous", "prev_status"],
  nextStatus: ["nextStatus", "后状态", "新状态", "当前状态", "next", "next_status"],
  commandSource: ["commandSource", "命令来源", "来源类型", "command_source"],
  reasonCode: ["reasonCode", "原因码", "原因", "reason", "reason_code"],
  runMinutesBeforeEvent: ["runMinutesBeforeEvent", "事件前运行分钟", "运行时长", "运行分钟", "run_minutes"],
  stopMinutesBeforeEvent: ["stopMinutesBeforeEvent", "事件前停机分钟", "停机时长", "停机分钟", "stop_minutes"],
  alarmActive: ["alarmActive", "是否有告警", "告警", "告警状态", "alarm", "alarm_active"],
  parameterKey: ["parameterKey", "参数键", "参数编码", "参数ID", "paramKey", "parameter"],
  parameterName: ["parameterName", "参数名称", "名称", "参数描述", "paramName"],
  previousValue: ["previousValue", "上一值", "原值", "旧值", "previous_value"],
  rollbackValue: ["rollbackValue", "回退值", "rollback", "fallbackValue"],
  changeTicket: ["changeTicket", "变更单号", "工单号", "ticket", "change_ticket"],
  approvedBy: ["approvedBy", "批准人", "审批人", "确认人", "approved_by"]
};

const ROLE_NORMALIZATION = {
  "频率命令": "frequency_command",
  "频率给定": "frequency_command",
  "命令": "command",
  "给定": "command",
  "频率反馈": "frequency_feedback",
  "反馈": "feedback",
  "运行反馈": "run_feedback",
  "阀位命令": "valve_position_command",
  "阀位反馈": "valve_position_feedback"
};

const EVENT_NORMALIZATION = {
  启动: "start",
  开机: "start",
  开: "start",
  start: "start",
  停止: "stop",
  停机: "stop",
  关: "stop",
  stop: "stop"
};

const STATUS_NORMALIZATION = {
  运行: "on",
  启动: "on",
  开: "on",
  on: "on",
  true: "on",
  "1": "on",
  停止: "off",
  停机: "off",
  关: "off",
  off: "off",
  false: "off",
  "0": "off"
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, "").replace(/[_-]+/g, "").toLowerCase();
}

function normalizeNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = normalizeText(String(value ?? "")).replace(/,/g, "").replace(/%/g, "");
  if (!text) {
    return fallback;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushUnique(list, value) {
  const text = normalizeText(value);
  if (text && !list.includes(text)) {
    list.push(text);
  }
}

function rel(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
  if (rows.length === 0) {
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

function buildHeaderMap(headers, columns) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const map = new Map();
  for (const column of columns) {
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

function normalizeRole(value) {
  const text = normalizeText(value);
  return ROLE_NORMALIZATION[text] || text;
}

function normalizeEvent(value) {
  const text = normalizeText(value);
  return EVENT_NORMALIZATION[text] || text;
}

function normalizeStatus(value) {
  const text = normalizeText(value);
  return STATUS_NORMALIZATION[text] || text;
}

function normalizeBoolean(value) {
  const text = normalizeText(String(value ?? "")).toLowerCase();
  if (["1", "true", "yes", "y", "有", "是", "告警"].includes(text)) {
    return "true";
  }
  if (["0", "false", "no", "n", "无", "否", "正常"].includes(text)) {
    return "false";
  }
  return normalizeText(String(value ?? ""));
}

function normalizeRow(rawRow, headerMap, table) {
  const normalized = {};
  for (const column of table.columns) {
    const header = headerMap.get(column.key);
    const value = header ? rawRow[header] : "";
    normalized[column.key] = normalizeText(value) || column.fallback || "";
  }
  if (normalized.signalRole) {
    normalized.signalRole = normalizeRole(normalized.signalRole);
  }
  if (normalized.eventType) {
    normalized.eventType = normalizeEvent(normalized.eventType);
  }
  if (normalized.previousStatus) {
    normalized.previousStatus = normalizeStatus(normalized.previousStatus);
  }
  if (normalized.nextStatus) {
    normalized.nextStatus = normalizeStatus(normalized.nextStatus);
  }
  if (Object.hasOwn(normalized, "alarmActive")) {
    normalized.alarmActive = normalizeBoolean(normalized.alarmActive);
  }
  return normalized;
}

function validateCommon(table, rows, headerMap) {
  const blockers = [];
  const warnings = [];
  const requiredColumns = table.columns.filter((column) => column.required);
  for (const column of requiredColumns) {
    if (!headerMap.has(column.key) && !column.fallback) {
      pushUnique(warnings, `${table.title} 输入表头未显式包含 ${column.label}(${column.key})。`);
    }
  }
  rows.forEach((row, index) => {
    const rowLabel = `${table.title} 第 ${index + 1} 行`;
    for (const column of requiredColumns) {
      if (!normalizeText(row[column.key])) {
        pushUnique(blockers, `${rowLabel} 缺少必填字段 ${column.label}(${column.key})。`);
      }
    }
    for (const field of table.timestampFields || []) {
      const text = normalizeText(row[field]);
      if (text && Number.isNaN(Date.parse(text))) {
        pushUnique(blockers, `${rowLabel} 时间字段 ${field} 无法解析：${text}`);
      }
    }
    for (const field of table.numericFields || []) {
      const text = normalizeText(row[field]);
      if (text && normalizeNumber(text, null) == null) {
        pushUnique(blockers, `${rowLabel} 数值字段 ${field} 无法解析：${text}`);
      }
    }
    if (normalizeText(row.siteId) !== SITE_ID) {
      pushUnique(warnings, `${rowLabel} siteId=${row.siteId || "--"}，当前 SITE_ID=${SITE_ID}。`);
    }
  });
  return { blockers, warnings };
}

function validateTrendRows(rows) {
  const blockers = [];
  const warnings = [];
  const roles = new Set(rows.map((row) => normalizeText(row.signalRole)).filter(Boolean));
  if (![...roles].some((role) => role.includes("command"))) {
    pushUnique(warnings, "控制命令/反馈趋势缺少 command 类角色，无法判断命令变化。");
  }
  if (![...roles].some((role) => role.includes("feedback"))) {
    pushUnique(warnings, "控制命令/反馈趋势缺少 feedback 类角色，无法判断执行跟随偏差。");
  }
  rows.forEach((row, index) => {
    const sampleIntervalSec = normalizeNumber(row.sampleIntervalSec, null);
    if (sampleIntervalSec != null && sampleIntervalSec > 60) {
      pushUnique(warnings, `控制命令/反馈高频趋势第 ${index + 1} 行采样周期 ${sampleIntervalSec}s > 60s，控制震荡只能方向性判断。`);
    }
    if (normalizeText(row.qualityFlag).toLowerCase() !== "good") {
      pushUnique(warnings, `控制命令/反馈高频趋势第 ${index + 1} 行质量标记=${row.qualityFlag || "--"}。`);
    }
  });
  return { blockers, warnings };
}

function validateEventRows(rows) {
  const blockers = [];
  const warnings = [];
  const validEvents = new Set(["start", "stop"]);
  rows.forEach((row, index) => {
    if (!validEvents.has(normalizeText(row.eventType))) {
      pushUnique(blockers, `设备启停事件台账第 ${index + 1} 行 eventType 必须为 start/stop，当前=${row.eventType || "--"}。`);
    }
    if (!["on", "off"].includes(normalizeText(row.nextStatus))) {
      pushUnique(warnings, `设备启停事件台账第 ${index + 1} 行 nextStatus 不是 on/off：${row.nextStatus || "--"}。`);
    }
    if (!["true", "false"].includes(normalizeText(row.alarmActive))) {
      pushUnique(warnings, `设备启停事件台账第 ${index + 1} 行 alarmActive 无法归一为 true/false：${row.alarmActive || "--"}。`);
    }
  });
  return { blockers, warnings };
}

function validateParameterRows(rows) {
  const blockers = [];
  const warnings = [];
  const riskKeys = ["pid", "deadband", "delay", "ramp", "min_on", "min_off", "minimum"];
  const hasControlParameter = rows.some((row) => {
    const key = `${row.parameterKey || ""} ${row.parameterName || ""}`.toLowerCase();
    return riskKeys.some((riskKey) => key.includes(riskKey));
  });
  if (!hasControlParameter) {
    pushUnique(warnings, "控制参数台账未看到 PID/死区/延时/斜率/最小运行时间等关键参数。");
  }
  rows.forEach((row, index) => {
    if (!normalizeText(row.rollbackValue)) {
      pushUnique(warnings, `控制参数台账第 ${index + 1} 行未提供 rollbackValue；若未来调整参数，必须另走人工审批和回退确认。`);
    }
    if (!normalizeText(row.approvedBy)) {
      pushUnique(warnings, `控制参数台账第 ${index + 1} 行未提供 approvedBy；当前只能作为现场资料回填，不能作为变更审批。`);
    }
  });
  return { blockers, warnings };
}

function importTable(table) {
  const blockers = [];
  const warnings = [];
  const inputPath = path.resolve(table.inputPath);
  if (!fs.existsSync(inputPath)) {
    return {
      ...table,
      inputPath,
      inputMode: "missing",
      rows: [],
      sourceHeaders: [],
      rowCount: 0,
      acceptedRowCount: 0,
      blockers: [`缺少输入文件：${inputPath}`],
      warnings
    };
  }

  let parsed;
  try {
    parsed = parseCsv(fs.readFileSync(inputPath, "utf8"));
  } catch (error) {
    return {
      ...table,
      inputPath,
      inputMode: "parse_failed",
      rows: [],
      sourceHeaders: [],
      rowCount: 0,
      acceptedRowCount: 0,
      blockers: [`CSV 解析失败：${error instanceof Error ? error.message : String(error)}`],
      warnings
    };
  }

  const headerMap = buildHeaderMap(parsed.headers, table.columns);
  const rows = parsed.rows.map((row) => normalizeRow(row, headerMap, table));
  if (rows.length === 0) {
    pushUnique(blockers, `${table.title} 没有数据行。`);
  }

  const common = validateCommon(table, rows, headerMap);
  blockers.push(...common.blockers);
  warnings.push(...common.warnings);
  for (const validate of table.validators || []) {
    const result = validate(rows);
    blockers.push(...result.blockers);
    warnings.push(...result.warnings);
  }

  const inputMode = path.resolve(table.defaultInputPath) === inputPath ? "template_sample" : "field_export";
  if (inputMode === "template_sample") {
    pushUnique(warnings, `${table.title} 当前使用模板示例输入；现场交付时需替换为 SCADA/PLC 导出文件。`);
  }

  return {
    ...table,
    inputPath,
    inputMode,
    sourceHeaders: parsed.headers,
    headerMap: Object.fromEntries([...headerMap.entries()]),
    rows,
    rowCount: parsed.rows.length,
    acceptedRowCount: blockers.length === 0 ? rows.length : 0,
    blockers,
    warnings
  };
}

function summarize(results) {
  const blockers = [];
  const warnings = [];
  for (const result of results) {
    for (const blocker of result.blockers) {
      pushUnique(blockers, `${result.title}: ${blocker}`);
    }
    for (const warning of result.warnings) {
      pushUnique(warnings, `${result.title}: ${warning}`);
    }
  }

  const hasMissingOrParseFailure = results.some((result) => ["missing", "parse_failed"].includes(result.inputMode));
  const hasTemplateSample = results.some((result) => result.inputMode === "template_sample");
  let status = "CONTROL_LEDGER_IMPORT_READY";
  if (blockers.length > 0 || hasMissingOrParseFailure) {
    status = "CONTROL_LEDGER_IMPORT_BLOCKED";
  } else if (hasTemplateSample || warnings.length > 0) {
    status = "CONTROL_LEDGER_IMPORT_PARTIAL";
  }

  return {
    ok: blockers.length === 0,
    status,
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    scope: "optimize_demo_140_control_oscillation_field_ledgers",
    executionMode: "read_only",
    controlBoundary: CONTROL_BOUNDARY,
    summary: {
      tableCount: results.length,
      totalRows: results.reduce((sum, result) => sum + result.rowCount, 0),
      acceptedRows: results.reduce((sum, result) => sum + result.acceptedRowCount, 0),
      blockersCount: blockers.length,
      warningsCount: warnings.length
    },
    outputs: {
      json: rel(OUTPUT_JSON),
      markdown: rel(OUTPUT_MD),
      controlTrendCsv: rel(OUTPUT_CONTROL_TREND_CSV),
      startStopCsv: rel(OUTPUT_START_STOP_CSV),
      controlParameterCsv: rel(OUTPUT_CONTROL_PARAMETER_CSV)
    },
    tables: results.map((result) => ({
      key: result.key,
      title: result.title,
      inputMode: result.inputMode,
      inputPath: rel(result.inputPath),
      outputPath: rel(result.outputPath),
      rowCount: result.rowCount,
      acceptedRowCount: result.acceptedRowCount,
      sourceHeaders: result.sourceHeaders,
      headerMap: result.headerMap || {},
      blockers: result.blockers,
      warnings: result.warnings
    })),
    blockers,
    warnings
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 140 控制震荡台账导入报告");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.status}\``);
  lines.push("");
  lines.push(`边界：${report.controlBoundary}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push("| 项目 | 数值 |");
  lines.push("| --- | ---: |");
  lines.push(`| 表数量 | ${report.summary.tableCount} |`);
  lines.push(`| 输入行数 | ${report.summary.totalRows} |`);
  lines.push(`| 接受行数 | ${report.summary.acceptedRows} |`);
  lines.push(`| blockers | ${report.summary.blockersCount} |`);
  lines.push(`| warnings | ${report.summary.warningsCount} |`);
  lines.push("");
  lines.push("## 表级结果");
  lines.push("");
  lines.push("| 表 | 输入模式 | 输入 | 输出 | 行数 | blockers | warnings |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: |");
  for (const table of report.tables) {
    lines.push(
      `| ${table.title} | ${table.inputMode} | \`${table.inputPath}\` | \`${table.outputPath}\` | ${table.rowCount} | ${table.blockers.length} | ${table.warnings.length} |`
    );
  }
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
  lines.push("## 使用口径");
  lines.push("");
  lines.push("- 输入可以是现场 SCADA/PLC 导出的 CSV，也可以是按模板人工回填的 CSV。");
  lines.push("- 导入器会按中文/英文表头别名归一到标准字段，并输出规范化 CSV。");
  lines.push("- 当前报告只证明台账字段可读、可对齐、可复核；不证明 PID 参数正确，也不证明设备需要启停。");
  lines.push("- 任何参数调整、启停策略或控制逻辑修改必须另走人工审批、PLC 本地保护和 shadow 验证。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const results = TABLES.map(importTable);
  const report = summarize(results);

  for (const result of results) {
    ensureDir(result.outputPath);
    fs.writeFileSync(result.outputPath, renderCsv(result.columns, result.rows), "utf8");
  }

  ensureDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), "utf8");
  ensureDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 control ledger import: ${report.status}\n`);
  process.stdout.write(`tables=${report.summary.tableCount} rows=${report.summary.totalRows} accepted=${report.summary.acceptedRows}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  process.stdout.write(`controlTrendCsv=${OUTPUT_CONTROL_TREND_CSV}\n`);
  process.stdout.write(`startStopCsv=${OUTPUT_START_STOP_CSV}\n`);
  process.stdout.write(`controlParameterCsv=${OUTPUT_CONTROL_PARAMETER_CSV}\n`);
  if (report.warnings.length > 0) {
    process.stdout.write(`warnings=${report.warnings.length}\n`);
    for (const warning of report.warnings.slice(0, 8)) {
      process.stdout.write(`- ${warning}\n`);
    }
  }
  if (report.blockers.length > 0) {
    process.stdout.write(`blockers=${report.blockers.length}\n`);
    for (const blocker of report.blockers) {
      process.stdout.write(`- ${blocker}\n`);
    }
    if (STRICT) {
      process.exitCode = 1;
    }
  }
}

main();
