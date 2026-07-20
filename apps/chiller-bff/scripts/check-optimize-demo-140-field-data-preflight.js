import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_STRICT).toLowerCase()
);

const DEFAULT_INPUT_DIR = path.resolve(ROOT_DIR, "docs/field-data/optimize-demo-140");
const DEFAULT_SENSOR_LEDGER_INPUT = path.resolve(DEFAULT_INPUT_DIR, "sensor-calibration-installation.csv");
const DEFAULT_CONTROL_TREND_INPUT = path.resolve(DEFAULT_INPUT_DIR, "control-command-feedback.csv");
const DEFAULT_START_STOP_INPUT = path.resolve(DEFAULT_INPUT_DIR, "start-stop-event.csv");
const DEFAULT_CONTROL_PARAMETER_INPUT = path.resolve(DEFAULT_INPUT_DIR, "control-parameter.csv");

const INPUTS = [
  {
    key: "sensor_calibration_installation_ledger",
    title: "传感器校准/安装位置台账",
    env: "OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV",
    path: resolveInputPath(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV, DEFAULT_SENSOR_LEDGER_INPUT),
    requiredForReady: true,
    preflight: "sensorLedger"
  },
  {
    key: "control_command_feedback_trend",
    title: "控制命令/反馈高频趋势",
    env: "OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV",
    path: resolveInputPath(process.env.OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV, DEFAULT_CONTROL_TREND_INPUT),
    requiredForReady: true,
    preflight: "controlLedgerImport"
  },
  {
    key: "start_stop_event_ledger",
    title: "设备启停事件台账",
    env: "OPTIMIZE_DEMO_START_STOP_INPUT_CSV",
    path: resolveInputPath(process.env.OPTIMIZE_DEMO_START_STOP_INPUT_CSV, DEFAULT_START_STOP_INPUT),
    requiredForReady: true,
    preflight: "controlLedgerImport"
  },
  {
    key: "control_parameter_ledger",
    title: "PID/死区/延时参数台账",
    env: "OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV",
    path: resolveInputPath(process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV, DEFAULT_CONTROL_PARAMETER_INPUT),
    requiredForReady: true,
    preflight: "controlLedgerImport"
  }
];

const OUTPUT_JSON =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_JSON,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.json")
  );
const OUTPUT_MD =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_MD,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-field-data-preflight-latest.md")
  );

const IMPORT_JSON =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_IMPORT_JSON,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-field-preflight-import-latest.json")
  );
const IMPORT_MD =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_IMPORT_MD,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-field-preflight-import-latest.md")
  );
const NORMALIZED_CONTROL_TREND =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_CONTROL_TREND_NORMALIZED_CSV,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-command-feedback-field-preflight-normalized-latest.csv")
  );
const NORMALIZED_START_STOP =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_START_STOP_NORMALIZED_CSV,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-field-preflight-normalized-latest.csv")
  );
const NORMALIZED_CONTROL_PARAMETER =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_CONTROL_PARAMETER_NORMALIZED_CSV,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-parameter-field-preflight-normalized-latest.csv")
  );
const SENSOR_PREFLIGHT_JSON =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_SENSOR_LEDGER_JSON ||
      process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_JSON,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.json")
  );
const SENSOR_PREFLIGHT_MD =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_SENSOR_LEDGER_MD ||
      process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_MD,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.md")
  );
const NORMALIZED_SENSOR_LEDGER =
  resolveOutputPath(
    process.env.OPTIMIZE_DEMO_FIELD_DATA_PREFLIGHT_SENSOR_LEDGER_NORMALIZED_CSV ||
      process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_NORMALIZED_CSV,
    path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-calibration-installation-normalized-latest.csv")
  );

const CONTROL_BOUNDARY =
  "预检只校验 4 张正式现场 CSV 的可读性、字段映射和证据边界；不判定仪表故障，不自动修正测点，不自动改 PID，不自动启停设备，不写真实 PLC，不覆盖正式 latest 导入报告。";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveInputPath(value, fallback) {
  const text = normalizeText(value);
  if (!text) {
    return path.resolve(fallback);
  }
  return path.isAbsolute(text) ? text : path.resolve(ROOT_DIR, text);
}

function resolveOutputPath(value, fallback) {
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

function inputMode(input) {
  if (!fs.existsSync(input.path)) {
    return "missing";
  }
  const stat = fs.statSync(input.path);
  if (!stat.isFile()) {
    return "not_file";
  }
  if (path.resolve(input.path).startsWith(path.resolve(DEFAULT_INPUT_DIR))) {
    return "field_drop_folder";
  }
  return "explicit_field_export";
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function pushUnique(list, value) {
  const text = normalizeText(value);
  if (text && !list.includes(text)) {
    list.push(text);
  }
}

function buildImportCommand(inputs) {
  const inputByKey = Object.fromEntries(inputs.map((input) => [input.key, input]));
  const parts = [
    `SITE_ID=${shellQuote(SITE_ID)}`,
    `OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV=${shellQuote(inputByKey.control_command_feedback_trend.path)}`,
    `OPTIMIZE_DEMO_START_STOP_INPUT_CSV=${shellQuote(inputByKey.start_stop_event_ledger.path)}`,
    `OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV=${shellQuote(inputByKey.control_parameter_ledger.path)}`,
    "npm --prefix apps/chiller-bff run import:optimize-demo-140-control-ledgers"
  ];
  return parts.join(" ");
}

function buildPreflightImportEnv() {
  const inputByKey = Object.fromEntries(INPUTS.map((input) => [input.key, input]));
  return {
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
  };
}

function buildSensorPreflightEnv() {
  const inputByKey = Object.fromEntries(INPUTS.map((input) => [input.key, input]));
  return {
    ...process.env,
    SITE_ID,
    OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV: inputByKey.sensor_calibration_installation_ledger.path,
    OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_JSON: SENSOR_PREFLIGHT_JSON,
    OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_MD: SENSOR_PREFLIGHT_MD,
    OPTIMIZE_DEMO_SENSOR_LEDGER_NORMALIZED_CSV: NORMALIZED_SENSOR_LEDGER
  };
}

function runPreflightImport() {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "import-optimize-demo-140-control-ledgers.js")], {
    cwd: ROOT_DIR,
    env: buildPreflightImportEnv(),
    encoding: "utf8"
  });
  let report = null;
  if (fs.existsSync(IMPORT_JSON)) {
    report = JSON.parse(fs.readFileSync(IMPORT_JSON, "utf8"));
  }
  return {
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    report
  };
}

function runSensorPreflight() {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "check-optimize-demo-140-sensor-ledger-preflight.js")], {
    cwd: ROOT_DIR,
    env: buildSensorPreflightEnv(),
    encoding: "utf8"
  });
  let report = null;
  if (fs.existsSync(SENSOR_PREFLIGHT_JSON)) {
    report = JSON.parse(fs.readFileSync(SENSOR_PREFLIGHT_JSON, "utf8"));
  }
  return {
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    report
  };
}

function decide(preflightInputs, importRun, sensorRun) {
  const missingRequired = preflightInputs.filter((input) => input.requiredForReady && input.mode !== "field_drop_folder" && input.mode !== "explicit_field_export");
  const importStatus = importRun.report?.status || "CONTROL_LEDGER_IMPORT_BLOCKED";
  const tableModes = new Set((importRun.report?.tables || []).map((table) => table.inputMode));
  const sensorStatus = sensorRun.report?.finalDecision || "SENSOR_LEDGER_PREFLIGHT_UNAVAILABLE";

  if (missingRequired.length > 0) {
    return "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS";
  }
  if (sensorRun.exitCode !== 0 || sensorStatus === "SENSOR_LEDGER_PREFLIGHT_BLOCKED") {
    return "FIELD_DATA_PREFLIGHT_BLOCKED";
  }
  if (importRun.exitCode !== 0 || importStatus === "CONTROL_LEDGER_IMPORT_BLOCKED") {
    return "FIELD_DATA_PREFLIGHT_BLOCKED";
  }
  if (
    importStatus === "CONTROL_LEDGER_IMPORT_READY" &&
    sensorStatus === "SENSOR_LEDGER_PREFLIGHT_READY" &&
    !tableModes.has("template_sample")
  ) {
    return "FIELD_DATA_PREFLIGHT_READY";
  }
  return "FIELD_DATA_PREFLIGHT_PARTIAL";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 140 正式现场 CSV 预检报告");
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
  for (const input of report.inputs) {
    lines.push(`| ${input.title} | \`${input.env}\` | \`${input.path}\` | ${input.mode} |`);
  }
  lines.push("");
  lines.push("## 传感器台账预检");
  lines.push("");
  lines.push("| 项目 | 结果 |");
  lines.push("| --- | --- |");
  lines.push(`| sensorStatus | \`${report.sensorLedger.status}\` |`);
  lines.push(`| sensorExitCode | ${report.sensorLedger.exitCode ?? "--"} |`);
  lines.push(`| acceptedRows | ${report.sensorLedger.acceptedRows ?? 0} |`);
  lines.push(`| warnings | ${report.sensorLedger.warningsCount ?? 0} |`);
  lines.push(`| blockers | ${report.sensorLedger.blockersCount ?? 0} |`);
  lines.push(`| reportJson | \`${report.sensorLedger.reportJson}\` |`);
  lines.push("");
  lines.push("## 控制台账导入器预检");
  lines.push("");
  lines.push("| 项目 | 结果 |");
  lines.push("| --- | --- |");
  lines.push(`| importStatus | \`${report.import.status}\` |`);
  lines.push(`| importExitCode | ${report.import.exitCode ?? "--"} |`);
  lines.push(`| acceptedRows | ${report.import.acceptedRows ?? 0} |`);
  lines.push(`| warnings | ${report.import.warningsCount ?? 0} |`);
  lines.push(`| blockers | ${report.import.blockersCount ?? 0} |`);
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
  lines.push("## 正式导入命令");
  lines.push("");
  lines.push("现场 CSV 预检达到 READY 后，再运行以下命令覆盖正式 latest 报告：");
  lines.push("");
  lines.push("```bash");
  lines.push(report.nextImportCommand);
  lines.push("```");
  lines.push("");
  lines.push("## 口径");
  lines.push("");
  lines.push("- `FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS`：4 张正式现场 CSV 尚未全部放入约定路径，或环境变量未指向真实文件。");
  lines.push("- `FIELD_DATA_PREFLIGHT_READY`：传感器台账与 3 张控制台账均可读取、字段可映射、无 blocker/warning，可再执行正式导入。");
  lines.push("- 本预检输出隔离到 field-preflight 文件，不更新 `/optimize-demo` 当前正式台账证据。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const preflightInputs = INPUTS.map((input) => ({
    key: input.key,
    title: input.title,
    env: input.env,
    path: rel(input.path),
    absolutePath: input.path,
    exists: fs.existsSync(input.path),
    mode: inputMode(input),
    preflight: input.preflight,
    requiredForReady: input.requiredForReady
  }));

  const sensorRun = runSensorPreflight();
  const importRun = runPreflightImport();
  const sensorReport = sensorRun.report || {};
  const importReport = importRun.report || {};
  const finalDecision = decide(preflightInputs, importRun, sensorRun);
  const blockers = [];
  const warnings = [];
  const waitingForInputs = finalDecision === "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS";

  for (const input of preflightInputs) {
    if (input.requiredForReady && !input.exists) {
      pushUnique(blockers, `${input.title} 缺少现场 CSV：${input.absolutePath}`);
    } else if (input.mode === "not_file") {
      pushUnique(blockers, `${input.title} 路径不是文件：${input.absolutePath}`);
    }
  }
  for (const blocker of waitingForInputs ? [] : importReport.blockers || []) {
    pushUnique(blockers, blocker);
  }
  for (const blocker of waitingForInputs ? [] : sensorReport.blockers || []) {
    pushUnique(blockers, blocker);
  }
  for (const warning of importReport.warnings || []) {
    pushUnique(warnings, warning);
  }
  for (const warning of sensorReport.warnings || []) {
    pushUnique(warnings, warning);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    finalDecision,
    scope: "optimize_demo_140_field_data_preflight",
    executionMode: "read_only",
    controlBoundary: CONTROL_BOUNDARY,
    inputs: preflightInputs.map((input) => ({
      key: input.key,
      title: input.title,
      env: input.env,
      path: input.path,
      exists: input.exists,
      mode: input.mode,
      preflight: input.preflight,
      requiredForReady: input.requiredForReady
    })),
    sensorLedger: {
      status: sensorReport.finalDecision || "SENSOR_LEDGER_PREFLIGHT_UNAVAILABLE",
      exitCode: sensorRun.exitCode,
      signal: sensorRun.signal,
      acceptedRows: sensorReport.summary?.acceptedRows || 0,
      totalRows: sensorReport.summary?.totalRows || 0,
      warningsCount: sensorReport.summary?.warningsCount || 0,
      blockersCount: sensorReport.summary?.blockersCount || 0,
      reportJson: rel(SENSOR_PREFLIGHT_JSON),
      reportMarkdown: rel(SENSOR_PREFLIGHT_MD),
      normalizedOutput: rel(NORMALIZED_SENSOR_LEDGER),
      stdout: sensorRun.stdout.trim().split("\n").slice(0, 12),
      stderr: sensorRun.stderr.trim().split("\n").filter(Boolean).slice(0, 12)
    },
    import: {
      status: importReport.status || "CONTROL_LEDGER_IMPORT_BLOCKED",
      exitCode: importRun.exitCode,
      signal: importRun.signal,
      acceptedRows: importReport.summary?.acceptedRows || 0,
      totalRows: importReport.summary?.totalRows || 0,
      warningsCount: importReport.summary?.warningsCount || 0,
      blockersCount: importReport.summary?.blockersCount || 0,
      reportJson: rel(IMPORT_JSON),
      reportMarkdown: rel(IMPORT_MD),
      normalizedOutputs: {
        sensorLedgerCsv: rel(NORMALIZED_SENSOR_LEDGER),
        controlTrendCsv: rel(NORMALIZED_CONTROL_TREND),
        startStopCsv: rel(NORMALIZED_START_STOP),
        controlParameterCsv: rel(NORMALIZED_CONTROL_PARAMETER)
      },
      stdout: importRun.stdout.trim().split("\n").slice(0, 12),
      stderr: importRun.stderr.trim().split("\n").filter(Boolean).slice(0, 12)
    },
    nextImportCommand: buildImportCommand(INPUTS),
    blockers,
    warnings
  };

  ensureDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), "utf8");
  ensureDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");

  process.stdout.write(`optimize-demo 140 field data preflight: ${report.finalDecision}\n`);
  process.stdout.write(`sensorStatus=${report.sensorLedger.status} sensorAccepted=${report.sensorLedger.acceptedRows}\n`);
  process.stdout.write(`importStatus=${report.import.status} accepted=${report.import.acceptedRows} warnings=${report.import.warningsCount} blockers=${report.import.blockersCount}\n`);
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
  if (STRICT && report.finalDecision !== "FIELD_DATA_PREFLIGHT_READY") {
    process.exitCode = 1;
  }
}

main();
