import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_STRICT).toLowerCase()
);

const PREFLIGHT_JSON = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.json")
);
const OUTPUT_JSON = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_JSON,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-promote-latest.json")
);
const OUTPUT_MD = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_MD,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-promote-latest.md")
);

const IMPORT_JSON = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_IMPORT_JSON || process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_JSON,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-latest.json")
);
const IMPORT_MD = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_IMPORT_MD || process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_MD,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-latest.md")
);
const NORMALIZED_CONTROL_TREND = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_CONTROL_TREND_NORMALIZED_CSV ||
    process.env.OPTIMIZE_DEMO_CONTROL_TREND_NORMALIZED_CSV,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-command-feedback-normalized-latest.csv")
);
const NORMALIZED_START_STOP = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_START_STOP_NORMALIZED_CSV ||
    process.env.OPTIMIZE_DEMO_START_STOP_NORMALIZED_CSV,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-normalized-latest.csv")
);
const NORMALIZED_CONTROL_PARAMETER = resolveRootPath(
  process.env.OPTIMIZE_DEMO_FIELD_DATA_PROMOTE_CONTROL_PARAMETER_NORMALIZED_CSV ||
    process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_NORMALIZED_CSV,
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-parameter-normalized-latest.csv")
);

const REQUIRED_PREFLIGHT_INPUT_KEYS = [
  "sensor_calibration_installation_ledger",
  "control_command_feedback_trend",
  "start_stop_event_ledger",
  "control_parameter_ledger"
];
const CONTROL_IMPORT_INPUT_KEYS = [
  "control_command_feedback_trend",
  "start_stop_event_ledger",
  "control_parameter_ledger"
];

const CONTROL_BOUNDARY =
  "promotion 只在现场 CSV 预检 READY 后执行正式台账导入；不自动改 PID，不自动启停设备，不写真实 PLC。";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveRootPath(value, fallback) {
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

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePreflightInputs(preflightReport) {
  const byKey = new Map();
  for (const input of Array.isArray(preflightReport?.inputs) ? preflightReport.inputs : []) {
    const key = normalizeText(input.key);
    if (!key) {
      continue;
    }
    byKey.set(key, {
      key,
      title: normalizeText(input.title) || key,
      path: resolveRootPath(input.path, ""),
      sourcePath: normalizeText(input.path),
      exists: input.exists === true,
      mode: normalizeText(input.mode) || "unknown",
      requiredForReady: input.requiredForReady === true
    });
  }
  return REQUIRED_PREFLIGHT_INPUT_KEYS.map((key) => byKey.get(key) || {
    key,
    title: key,
    path: "",
    sourcePath: "",
    exists: false,
    mode: "missing",
    requiredForReady: true
  });
}

function runFormalImport(inputs) {
  const inputByKey = Object.fromEntries(inputs.map((input) => [input.key, input]));
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "import-optimize-demo-140-control-ledgers.js")], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      SITE_ID,
      OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV: inputByKey.control_command_feedback_trend.path,
      OPTIMIZE_DEMO_START_STOP_INPUT_CSV: inputByKey.start_stop_event_ledger.path,
      OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV: inputByKey.control_parameter_ledger.path,
      OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_JSON: IMPORT_JSON,
      OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_MD: IMPORT_MD,
      OPTIMIZE_DEMO_CONTROL_TREND_NORMALIZED_CSV: NORMALIZED_CONTROL_TREND,
      OPTIMIZE_DEMO_START_STOP_NORMALIZED_CSV: NORMALIZED_START_STOP,
      OPTIMIZE_DEMO_CONTROL_PARAMETER_NORMALIZED_CSV: NORMALIZED_CONTROL_PARAMETER
    },
    encoding: "utf8"
  });
  return {
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    report: readJson(IMPORT_JSON)
  };
}

function decide(preflightReport, inputs, importRun, blockers) {
  if (!preflightReport) {
    return "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT";
  }
  if (preflightReport.finalDecision !== "FIELD_DATA_PREFLIGHT_READY") {
    return "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT";
  }
  if (blockers.length > 0) {
    return "FIELD_DATA_PROMOTE_BLOCKED";
  }
  const importStatus = importRun?.report?.status || "CONTROL_LEDGER_IMPORT_BLOCKED";
  const tableModes = new Set((importRun?.report?.tables || []).map((table) => table.inputMode));
  if (importRun?.exitCode !== 0 || importStatus === "CONTROL_LEDGER_IMPORT_BLOCKED") {
    return "FIELD_DATA_PROMOTE_BLOCKED";
  }
  if (importStatus === "CONTROL_LEDGER_IMPORT_READY" && !tableModes.has("template_sample")) {
    return "FIELD_DATA_PROMOTE_READY";
  }
  return "FIELD_DATA_PROMOTE_PARTIAL";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 140 现场控制台账正式导入 Gate");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.finalDecision}\``);
  lines.push("");
  lines.push(`边界：${report.controlBoundary}`);
  lines.push("");
  lines.push("## 输入");
  lines.push("");
  lines.push(`预检报告：\`${report.preflight.reportPath}\``);
  lines.push("");
  lines.push("| 表 | 路径 | 用途 | 预检模式 | 存在 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const input of report.inputs) {
    lines.push(`| ${input.title} | \`${input.path || "--"}\` | ${input.importMode} | ${input.mode} | ${input.exists ? "yes" : "no"} |`);
  }
  lines.push("");
  lines.push("## 正式导入结果");
  lines.push("");
  lines.push("| 项目 | 结果 |");
  lines.push("| --- | --- |");
  lines.push(`| importStatus | \`${report.import.status}\` |`);
  lines.push(`| acceptedRows | ${report.import.acceptedRows} |`);
  lines.push(`| warnings | ${report.import.warningsCount} |`);
  lines.push(`| blockers | ${report.import.blockersCount} |`);
  lines.push(`| importJson | \`${report.import.reportJson}\` |`);
  lines.push("");
  if (report.blockers.length) {
    lines.push("## 阻断项");
    lines.push("");
    report.blockers.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  if (report.warnings.length) {
    lines.push("## 警告");
    lines.push("");
    report.warnings.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  lines.push("## 口径");
  lines.push("");
  lines.push("- `FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT`：尚未通过现场 CSV 预检，不执行正式导入。");
  lines.push("- `FIELD_DATA_PROMOTE_READY`：已按预检输入执行正式导入，`/optimize-demo` 可读取正式 latest 证据。");
  lines.push("- 本命令只写台账报告和规范化 CSV，不创建执行单，不审批，不 dispatch，不写 PLC。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const preflightReport = readJson(PREFLIGHT_JSON);
  const inputs = resolvePreflightInputs(preflightReport);
  const blockers = [];
  const warnings = [];

  if (!preflightReport) {
    pushUnique(blockers, `现场 CSV 预检报告不存在：${PREFLIGHT_JSON}`);
  } else if (preflightReport.finalDecision !== "FIELD_DATA_PREFLIGHT_READY") {
    pushUnique(blockers, `现场 CSV 预检未 READY：${preflightReport.finalDecision || "--"}`);
  }

  for (const input of inputs) {
    if (!input.path || !fs.existsSync(input.path)) {
      pushUnique(blockers, `${input.title} 文件不存在：${input.path || input.sourcePath || "--"}`);
    } else if (!fs.statSync(input.path).isFile()) {
      pushUnique(blockers, `${input.title} 路径不是文件：${input.path}`);
    }
    if (input.mode === "template_sample") {
      pushUnique(blockers, `${input.title} 仍是模板样例，禁止 promotion。`);
    }
  }

  const importRun = blockers.length === 0 ? runFormalImport(inputs) : null;
  const importReport = importRun?.report || {};
  for (const blocker of importReport.blockers || []) {
    pushUnique(blockers, blocker);
  }
  for (const warning of importReport.warnings || []) {
    pushUnique(warnings, warning);
  }

  const finalDecision = decide(preflightReport, inputs, importRun, blockers);
  const report = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    finalDecision,
    scope: "optimize_demo_140_field_data_promote_to_formal_ledger",
    executionMode: "read_only",
    controlBoundary: CONTROL_BOUNDARY,
    preflight: {
      reportPath: rel(PREFLIGHT_JSON),
      finalDecision: preflightReport?.finalDecision || "FIELD_DATA_PREFLIGHT_UNAVAILABLE",
      generatedAt: preflightReport?.generatedAt || null
    },
    inputs: inputs.map((input) => ({
      key: input.key,
      title: input.title,
      path: input.path ? rel(input.path) : "",
      exists: Boolean(input.path && fs.existsSync(input.path)),
      mode: input.mode,
      importMode: CONTROL_IMPORT_INPUT_KEYS.includes(input.key) ? "control-ledger-import" : "preflight-only",
      requiredForReady: input.requiredForReady
    })),
    import: {
      status: importReport.status || "CONTROL_LEDGER_IMPORT_NOT_RUN",
      exitCode: importRun?.exitCode ?? null,
      signal: importRun?.signal ?? null,
      acceptedRows: importReport.summary?.acceptedRows || 0,
      totalRows: importReport.summary?.totalRows || 0,
      warningsCount: importReport.summary?.warningsCount || 0,
      blockersCount: importReport.summary?.blockersCount || 0,
      reportJson: rel(IMPORT_JSON),
      reportMarkdown: rel(IMPORT_MD),
      normalizedOutputs: {
        controlTrendCsv: rel(NORMALIZED_CONTROL_TREND),
        startStopCsv: rel(NORMALIZED_START_STOP),
        controlParameterCsv: rel(NORMALIZED_CONTROL_PARAMETER)
      },
      stdout: (importRun?.stdout || "").trim().split("\n").filter(Boolean).slice(0, 12),
      stderr: (importRun?.stderr || "").trim().split("\n").filter(Boolean).slice(0, 12)
    },
    blockers,
    warnings
  };

  ensureDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), "utf8");
  ensureDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 field data promote: ${report.finalDecision}\n`);
  process.stdout.write(`preflight=${report.preflight.finalDecision} importStatus=${report.import.status} accepted=${report.import.acceptedRows}\n`);
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
  if (STRICT && report.finalDecision !== "FIELD_DATA_PROMOTE_READY") {
    process.exitCode = 1;
  }
}

main();
