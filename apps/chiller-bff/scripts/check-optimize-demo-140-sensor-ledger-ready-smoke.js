import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(BFF_DIR, "../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "140";
const FIXTURE_DIR =
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_READY_FIXTURE_DIR) ||
  path.resolve(ROOT_DIR, "tmp/optimize-demo-140-sensor-ledger-ready-fixture");
const OUTPUT_JSON =
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_READY_SMOKE_JSON) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.json");
const OUTPUT_MD =
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_READY_SMOKE_MD) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-ready-smoke-latest.md");
const OUTPUT_NORMALIZED_CSV =
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_READY_SMOKE_NORMALIZED_CSV) ||
  path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-calibration-installation-ready-smoke-normalized-latest.csv");
const DEFAULT_LATEST_JSON = path.resolve(ROOT_DIR, "docs/optimize-demo-140-sensor-ledger-preflight-latest.json");
const STRICT = ["1", "true", "yes", "on"].includes(
  normalizeText(process.env.OPTIMIZE_DEMO_SENSOR_LEDGER_READY_SMOKE_STRICT).toLowerCase()
);
const CONTROL_BOUNDARY_PARTS = ["不判定仪表故障", "不自动修正测点", "不写真实 PLC"];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

function writeFixtureCsv() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const sensorLedgerCsv = path.resolve(FIXTURE_DIR, "sensor-calibration-installation-field-export.csv");
  const headers = [
    "点位编码",
    "点位名称",
    "仪表类型",
    "系统侧",
    "设备ID",
    "安装位置",
    "安装点描述",
    "单位",
    "量程下限",
    "量程上限",
    "精度等级",
    "最近校准日期",
    "下次校准日期",
    "校准机构",
    "责任人",
    "来源系统",
    "备注"
  ];
  const rows = [
    [
      "B25_CHW_SUPPLY_TEMP",
      "冷冻水总供水温度",
      "温度",
      "chilled_water",
      "CHW-HEADER",
      "冷冻站机房总管",
      "冷冻水供水总管出站侧",
      "C",
      "0",
      "50",
      "0.2C",
      "2026-01-01",
      "2027-01-01",
      "ready-smoke-provider",
      "site_operator",
      "field_ledger",
      "ready-smoke 样例，不作为现场证据"
    ],
    [
      "B25_CHW_RETURN_FLOW",
      "冷冻水总回水流量",
      "流量",
      "chilled_water",
      "CHW-HEADER",
      "冷冻站机房总管",
      "冷冻水回水总管",
      "m3/h",
      "0",
      "5000",
      "1.0%",
      "2026-01-01",
      "2027-01-01",
      "ready-smoke-provider",
      "site_operator",
      "field_ledger",
      "ready-smoke 样例，不作为现场证据"
    ],
    [
      "B25_STATION_POWER_METER",
      "冷站总功率表",
      "电表",
      "power",
      "METER-STATION",
      "低压配电室",
      "冷站总进线计量柜",
      "kW",
      "0",
      "5000",
      "0.5S",
      "2026-01-01",
      "2027-01-01",
      "ready-smoke-provider",
      "site_operator",
      "field_ledger",
      "ready-smoke 样例，不作为现场证据"
    ],
    [
      "B25_OUTDOOR_WET_BULB",
      "室外湿球温度",
      "湿球",
      "weather",
      "WB-01",
      "冷却塔进风侧",
      "避开排风回流的百叶外侧",
      "C",
      "-10",
      "50",
      "0.3C",
      "2026-01-01",
      "2027-01-01",
      "ready-smoke-provider",
      "site_operator",
      "field_ledger",
      "ready-smoke 样例，不作为现场证据"
    ]
  ];
  fs.writeFileSync(sensorLedgerCsv, renderCsv([headers, ...rows]), "utf8");
  return sensorLedgerCsv;
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
  lines.push("# 140 传感器台账预检 READY 路径自检");
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
  lines.push(`| 预检状态 | ${report.preflightDecision} |`);
  lines.push(`| 输入模式 | ${report.inputMode || "--"} |`);
  lines.push(`| 接受行数 | ${report.acceptedRows} |`);
  lines.push(`| 传感器类型数 | ${report.sensorTypeCount} |`);
  lines.push(`| 点位数 | ${report.pointCodeCount} |`);
  lines.push(`| blockers | ${report.blockers.length} |`);
  lines.push(`| warnings | ${report.warnings.length} |`);
  lines.push("");
  lines.push("## 输出");
  lines.push("");
  lines.push(`- 预检 JSON：\`${rel(OUTPUT_JSON)}\``);
  lines.push(`- 预检 Markdown：\`${rel(OUTPUT_MD)}\``);
  lines.push(`- 规范化 CSV：\`${rel(OUTPUT_NORMALIZED_CSV)}\``);
  lines.push("");
  lines.push("## 注意");
  lines.push("");
  lines.push("- 本自检使用 `tmp/` 下生成的样例 CSV，只验证传感器台账预检 READY 路径。");
  lines.push("- 本自检不覆盖默认 `docs/optimize-demo-140-sensor-ledger-preflight-latest.json`，不能作为现场实测证据。");
  lines.push("- 真实交付时必须用现场校准/安装位置台账重新运行 `check:optimize-demo-140-sensor-ledger-preflight`。");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const blockers = [];
  const warnings = [];
  const fixtureCsv = writeFixtureCsv();
  ensureDir(OUTPUT_JSON);

  const result = spawnSync(
    process.execPath,
    [path.resolve(BFF_DIR, "scripts/check-optimize-demo-140-sensor-ledger-preflight.js")],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        SITE_ID,
        OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_STRICT: "1",
        OPTIMIZE_DEMO_SENSOR_LEDGER_INPUT_CSV: fixtureCsv,
        OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_JSON: OUTPUT_JSON,
        OPTIMIZE_DEMO_SENSOR_LEDGER_PREFLIGHT_MD: OUTPUT_MD,
        OPTIMIZE_DEMO_SENSOR_LEDGER_NORMALIZED_CSV: OUTPUT_NORMALIZED_CSV
      },
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    pushUnique(blockers, `传感器台账预检退出码异常：${result.status}`);
  }
  if (result.error) {
    pushUnique(blockers, `传感器台账预检执行失败：${result.error.message}`);
  }
  if (!fs.existsSync(OUTPUT_JSON)) {
    pushUnique(blockers, `传感器台账预检未生成 JSON：${OUTPUT_JSON}`);
  }

  const preflightReport = fs.existsSync(OUTPUT_JSON) ? readJson(OUTPUT_JSON) : null;
  if (preflightReport?.finalDecision !== "SENSOR_LEDGER_PREFLIGHT_READY") {
    pushUnique(blockers, `READY 自检预检状态异常：${preflightReport?.finalDecision || "--"}`);
  }
  if (preflightReport?.executionMode !== "read_only") {
    pushUnique(blockers, `预检报告 executionMode 越界：${preflightReport?.executionMode || "--"}`);
  }
  for (const text of CONTROL_BOUNDARY_PARTS) {
    if (!String(preflightReport?.controlBoundary || "").includes(text)) {
      pushUnique(blockers, `预检报告缺少边界：${text}`);
    }
  }
  if (preflightReport?.input?.mode !== "explicit_field_export") {
    pushUnique(blockers, `READY 自检应使用 explicit_field_export，当前=${preflightReport?.input?.mode || "--"}`);
  }
  if (Number(preflightReport?.summary?.acceptedRows || 0) < 4) {
    pushUnique(blockers, `READY 自检接受行数不足：${preflightReport?.summary?.acceptedRows ?? "--"}`);
  }
  if (Number(preflightReport?.summary?.sensorTypeCount || 0) < 4) {
    pushUnique(blockers, `READY 自检关键仪表类型覆盖不足：${preflightReport?.summary?.sensorTypeCount ?? "--"}`);
  }
  if (Number(preflightReport?.summary?.warningsCount || 0) !== 0) {
    pushUnique(blockers, `READY 自检不应有 warnings：${preflightReport?.summary?.warningsCount ?? "--"}`);
  }
  if (Number(preflightReport?.summary?.blockersCount || 0) !== 0) {
    pushUnique(blockers, `READY 自检不应有 blockers：${preflightReport?.summary?.blockersCount ?? "--"}`);
  }
  const outputPaths = [OUTPUT_JSON, OUTPUT_MD, OUTPUT_NORMALIZED_CSV].map((item) => path.resolve(item));
  const defaultLatestPreserved = !outputPaths.includes(DEFAULT_LATEST_JSON);
  if (!defaultLatestPreserved) {
    pushUnique(blockers, "READY 自检输出路径不应指向默认 latest 预检报告。");
  }
  if (result.stdout && !result.stdout.includes("SENSOR_LEDGER_PREFLIGHT_READY")) {
    pushUnique(warnings, "预检 stdout 未包含 SENSOR_LEDGER_PREFLIGHT_READY。");
  }

  const decision = blockers.length
    ? "SENSOR_LEDGER_PREFLIGHT_READY_SMOKE_BLOCKED"
    : "SENSOR_LEDGER_PREFLIGHT_READY_SMOKE_READY";
  const checkReport = {
    checkedAt: new Date().toISOString(),
    siteId: SITE_ID,
    decision,
    preflightDecision: preflightReport?.finalDecision || null,
    inputMode: preflightReport?.input?.mode || null,
    acceptedRows: Number(preflightReport?.summary?.acceptedRows || 0),
    sensorTypeCount: Number(preflightReport?.summary?.sensorTypeCount || 0),
    pointCodeCount: Number(preflightReport?.summary?.pointCodeCount || 0),
    controlBoundary: preflightReport?.controlBoundary || null,
    fixtureCsv: rel(fixtureCsv),
    normalizedOutput: rel(OUTPUT_NORMALIZED_CSV),
    defaultLatestPreserved,
    blockers,
    warnings,
    stdout: result.stdout,
    stderr: result.stderr
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ ...preflightReport, readySmoke: checkReport }, null, 2), "utf8");
  fs.writeFileSync(OUTPUT_MD, renderCheckMarkdown(checkReport), "utf8");

  process.stdout.write(`optimize-demo 140 sensor ledger ready smoke: ${decision}\n`);
  process.stdout.write(`preflight=${checkReport.preflightDecision || "--"} acceptedRows=${checkReport.acceptedRows}\n`);
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
