import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const FIXTURE_DIR =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_READY_FIXTURE_DIR) ||
  path.resolve(ROOT_DIR, "tmp/optimize-demo-140-control-ledger-ready-fixture");
const OUTPUT_JSON =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_READY_SMOKE_JSON) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.json");
const OUTPUT_MD =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_READY_SMOKE_MD) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-ready-smoke-latest.md");
const OUTPUT_CONTROL_TREND_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_TREND_READY_SMOKE_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-command-feedback-ready-smoke-latest.csv");
const OUTPUT_START_STOP_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_START_STOP_READY_SMOKE_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-start-stop-event-ready-smoke-latest.csv");
const OUTPUT_CONTROL_PARAMETER_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_PARAMETER_READY_SMOKE_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-parameter-ready-smoke-latest.csv");
const DEFAULT_LATEST_JSON = path.resolve(ROOT_DIR, "docs/optimize-demo-140-control-ledger-import-latest.json");
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_CONTROL_LEDGER_READY_SMOKE_STRICT).toLowerCase()
);

const CONTROL_BOUNDARY_PARTS = ["不自动改 PID", "不自动启停设备", "不写真实 PLC"];

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
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

function renderCsv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function writeFixtureCsvs() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const controlTrendCsv = path.resolve(FIXTURE_DIR, "control-command-feedback-field-export.csv");
  const startStopCsv = path.resolve(FIXTURE_DIR, "start-stop-event-field-export.csv");
  const controlParameterCsv = path.resolve(FIXTURE_DIR, "control-parameter-field-export.csv");

  fs.writeFileSync(
    controlTrendCsv,
    renderCsv([
      ["采样时间", "站点ID", "控制回路", "设备类型", "设备ID", "信号角色", "点位编码", "点位名称", "数值", "单位", "控制模式", "采样周期秒", "质量标记", "来源系统", "备注"],
      ["2026-06-13T10:00:00+08:00", SITE_ID, "chilled_water_delta_t", "chilled_pump", "CHP4", "频率命令", "B25_AI_CHWP_FREQ_CMD", "冷冻泵频率命令", "40.0", "Hz", "auto", "30", "good", "SCADA", "ready-smoke 样例，不作为现场证据"],
      ["2026-06-13T10:00:00+08:00", SITE_ID, "chilled_water_delta_t", "chilled_pump", "CHP4", "频率反馈", "B25_CHWP_FREQ_FB", "冷冻泵频率反馈", "39.8", "Hz", "auto", "30", "good", "SCADA", "ready-smoke 样例，不作为现场证据"],
      ["2026-06-13T10:00:30+08:00", SITE_ID, "tower_fan_tcws", "cooling_tower", "CT1", "频率命令", "B25_CT_FAN_FREQ_CMD", "塔风机频率命令", "32.0", "Hz", "auto", "30", "good", "SCADA", "ready-smoke 样例，不作为现场证据"],
      ["2026-06-13T10:00:30+08:00", SITE_ID, "tower_fan_tcws", "cooling_tower", "CT1", "频率反馈", "B25_CT_FAN_FREQ_FB", "塔风机频率反馈", "31.7", "Hz", "auto", "30", "good", "SCADA", "ready-smoke 样例，不作为现场证据"]
    ]),
    "utf8"
  );

  fs.writeFileSync(
    startStopCsv,
    renderCsv([
      ["事件时间", "站点ID", "设备类型", "设备ID", "事件类型", "前状态", "后状态", "命令来源", "原因码", "事件前运行分钟", "事件前停机分钟", "是否有告警", "来源系统", "备注"],
      ["2026-06-13T10:15:00+08:00", SITE_ID, "chiller", "CH7", "启动", "停机", "运行", "operator", "load_increase", "", "240", "无", "SCADA", "ready-smoke 样例，不作为现场证据"],
      ["2026-06-13T11:05:00+08:00", SITE_ID, "cooling_tower", "CT1", "停止", "运行", "停机", "auto", "tcws_below_band", "50", "", "无", "SCADA", "ready-smoke 样例，不作为现场证据"]
    ]),
    "utf8"
  );

  fs.writeFileSync(
    controlParameterCsv,
    renderCsv([
      ["生效时间", "站点ID", "控制回路", "设备类型", "设备ID", "参数键", "参数名称", "参数值", "单位", "上一值", "回退值", "变更单号", "批准人", "来源系统", "备注"],
      ["2026-06-13T09:00:00+08:00", SITE_ID, "chilled_water_delta_t", "chilled_pump", "CHP4", "ramp_limit_hz_per_min", "冷冻泵频率斜率限制", "1", "Hz/min", "1", "1", "ready-smoke-001", "现场负责人", "PLC", "ready-smoke 样例，不自动写 PLC"],
      ["2026-06-13T09:00:00+08:00", SITE_ID, "tower_fan_tcws", "cooling_tower", "CT1", "deadband_c", "冷却水温控制死区", "0.5", "℃", "0.5", "0.5", "ready-smoke-001", "现场负责人", "PLC", "ready-smoke 样例，不自动改 PID"],
      ["2026-06-13T09:00:00+08:00", SITE_ID, "chiller_staging", "chiller", "CH7", "min_on_minutes", "主机最小运行时间", "30", "min", "30", "30", "ready-smoke-001", "现场负责人", "PLC", "ready-smoke 样例，不自动启停设备"]
    ]),
    "utf8"
  );

  return {
    controlTrendCsv,
    startStopCsv,
    controlParameterCsv
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pushUnique(target, message) {
  const text = normalizeText(message);
  if (text && !target.includes(text)) {
    target.push(text);
  }
}

function renderCheckMarkdown(report) {
  const lines = [];
  lines.push("# 140 控制震荡台账 READY 路径自检");
  lines.push("");
  lines.push(`生成时间：${report.checkedAt}`);
  lines.push("");
  lines.push(`结论：\`${report.decision}\``);
  lines.push("");
  lines.push(`边界：${report.controlBoundary}`);
  lines.push("");
  lines.push("## 结果");
  lines.push("");
  lines.push("| 项 | 值 |");
  lines.push("| --- | --- |");
  lines.push(`| 导入状态 | ${report.importStatus} |`);
  lines.push(`| 输入模式 | ${report.inputModes.join(" / ")} |`);
  lines.push(`| 接受行数 | ${report.acceptedRows} |`);
  lines.push(`| blockers | ${report.blockers.length} |`);
  lines.push(`| warnings | ${report.warnings.length} |`);
  lines.push("");
  lines.push("## 输出");
  lines.push("");
  lines.push(`- 导入 JSON：\`${rel(OUTPUT_JSON)}\``);
  lines.push(`- 导入 Markdown：\`${rel(OUTPUT_MD)}\``);
  lines.push(`- 命令/反馈规范化 CSV：\`${rel(OUTPUT_CONTROL_TREND_CSV)}\``);
  lines.push(`- 启停事件规范化 CSV：\`${rel(OUTPUT_START_STOP_CSV)}\``);
  lines.push(`- 控制参数规范化 CSV：\`${rel(OUTPUT_CONTROL_PARAMETER_CSV)}\``);
  lines.push("");
  lines.push("## 注意");
  lines.push("");
  lines.push("- 本自检使用 `tmp/` 下生成的样例 CSV，只验证导入器 READY 路径。");
  lines.push("- 本自检不覆盖默认 `docs/optimize-demo-140-control-ledger-import-latest.json`，不能作为现场实测证据。");
  lines.push("- 真实交付时必须用现场 SCADA/PLC 导出 CSV 重新运行导入器。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const blockers = [];
  const warnings = [];
  const fixturePaths = writeFixtureCsvs();
  ensureDir(OUTPUT_JSON);

  const result = spawnSync(
    process.execPath,
    [path.resolve(BFF_DIR, "scripts/import-optimize-demo-140-control-ledgers.js")],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        SITE_ID,
        OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_STRICT: "1",
        OPTIMIZE_DEMO_CONTROL_TREND_INPUT_CSV: fixturePaths.controlTrendCsv,
        OPTIMIZE_DEMO_START_STOP_INPUT_CSV: fixturePaths.startStopCsv,
        OPTIMIZE_DEMO_CONTROL_PARAMETER_INPUT_CSV: fixturePaths.controlParameterCsv,
        OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_JSON: OUTPUT_JSON,
        OPTIMIZE_DEMO_CONTROL_LEDGER_IMPORT_MD: OUTPUT_MD,
        OPTIMIZE_DEMO_CONTROL_TREND_NORMALIZED_CSV: OUTPUT_CONTROL_TREND_CSV,
        OPTIMIZE_DEMO_START_STOP_NORMALIZED_CSV: OUTPUT_START_STOP_CSV,
        OPTIMIZE_DEMO_CONTROL_PARAMETER_NORMALIZED_CSV: OUTPUT_CONTROL_PARAMETER_CSV
      },
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    pushUnique(blockers, `导入器退出码异常：${result.status}`);
  }
  if (result.error) {
    pushUnique(blockers, `导入器执行失败：${result.error.message}`);
  }
  if (!fs.existsSync(OUTPUT_JSON)) {
    pushUnique(blockers, `导入器未生成 JSON：${OUTPUT_JSON}`);
  }

  const importReport = fs.existsSync(OUTPUT_JSON) ? readJson(OUTPUT_JSON) : null;
  if (importReport?.status !== "CONTROL_LEDGER_IMPORT_READY") {
    pushUnique(blockers, `READY 自检导入状态异常：${importReport?.status || "--"}`);
  }
  if (importReport?.executionMode !== "read_only") {
    pushUnique(blockers, `导入报告 executionMode 越界：${importReport?.executionMode || "--"}`);
  }
  for (const text of CONTROL_BOUNDARY_PARTS) {
    if (!String(importReport?.controlBoundary || "").includes(text)) {
      pushUnique(blockers, `导入报告缺少边界：${text}`);
    }
  }
  const tables = Array.isArray(importReport?.tables) ? importReport.tables : [];
  const inputModes = [...new Set(tables.map((table) => table.inputMode).filter(Boolean))];
  if (!tables.length || tables.some((table) => table.inputMode !== "field_export")) {
    pushUnique(blockers, "READY 自检应全部使用 field_export 输入模式。");
  }
  if (Number(importReport?.summary?.acceptedRows || 0) < 6) {
    pushUnique(blockers, `READY 自检接受行数不足：${importReport?.summary?.acceptedRows ?? "--"}`);
  }
  if (Number(importReport?.summary?.warningsCount || 0) !== 0) {
    pushUnique(blockers, `READY 自检不应有 warnings：${importReport?.summary?.warningsCount ?? "--"}`);
  }
  if (Number(importReport?.summary?.blockersCount || 0) !== 0) {
    pushUnique(blockers, `READY 自检不应有 blockers：${importReport?.summary?.blockersCount ?? "--"}`);
  }
  const outputPaths = [
    OUTPUT_JSON,
    OUTPUT_MD,
    OUTPUT_CONTROL_TREND_CSV,
    OUTPUT_START_STOP_CSV,
    OUTPUT_CONTROL_PARAMETER_CSV
  ].map((item) => path.resolve(item));
  const defaultLatestPreserved = !outputPaths.includes(DEFAULT_LATEST_JSON);
  if (!defaultLatestPreserved) {
    pushUnique(blockers, "READY 自检输出路径不应指向默认 latest 导入报告。");
  }
  if (result.stdout && !result.stdout.includes("CONTROL_LEDGER_IMPORT_READY")) {
    pushUnique(warnings, "导入器 stdout 未包含 CONTROL_LEDGER_IMPORT_READY。");
  }

  const decision = blockers.length ? "CONTROL_LEDGER_IMPORT_READY_SMOKE_BLOCKED" : "CONTROL_LEDGER_IMPORT_READY_SMOKE_READY";
  const checkReport = {
    checkedAt: new Date().toISOString(),
    siteId: SITE_ID,
    decision,
    importStatus: importReport?.status || null,
    inputModes,
    acceptedRows: Number(importReport?.summary?.acceptedRows || 0),
    controlBoundary: importReport?.controlBoundary || null,
    fixtureDir: rel(FIXTURE_DIR),
    importOutputs: importReport?.outputs || {},
    defaultLatestPreserved,
    blockers,
    warnings,
    stdout: result.stdout,
    stderr: result.stderr
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ ...importReport, readySmoke: checkReport }, null, 2), "utf8");
  fs.writeFileSync(OUTPUT_MD, renderCheckMarkdown(checkReport), "utf8");

  process.stdout.write(`optimize-demo 140 control ledger ready smoke: ${decision}\n`);
  process.stdout.write(`importStatus=${checkReport.importStatus || "--"} acceptedRows=${checkReport.acceptedRows}\n`);
  process.stdout.write(`json=${OUTPUT_JSON}\n`);
  process.stdout.write(`markdown=${OUTPUT_MD}\n`);
  if (warnings.length) {
    process.stdout.write(`warnings=${warnings.length}\n`);
    warnings.forEach((warning) => process.stdout.write(`- ${warning}\n`));
  }
  if (blockers.length) {
    process.stdout.write(`blockers=${blockers.length}\n`);
    blockers.forEach((blocker) => process.stdout.write(`- ${blocker}\n`));
    if (STRICT) {
      process.exitCode = 1;
    }
  }
}

main();
