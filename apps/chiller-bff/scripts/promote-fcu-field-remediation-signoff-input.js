import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIRM_PHRASE = "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const CLEAN_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json");
const SIGNOFF_INPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-input-latest.csv");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-promote-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-promote-latest.md");
const CONFIRM = normalizeText(process.env.FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM);

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function buildBackupPath(targetPath, generatedAt) {
  const stamp = generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  return targetPath.replace(/\.csv$/, `-backup-${stamp}.csv`);
}

function countCsvRows(text) {
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => normalizeText(line)).length;
}

function buildReport(cleanResult) {
  const generatedAt = new Date().toISOString();
  const clean = cleanResult.payload || {};
  const currentCsv = normalizeText(clean.outputs?.currentCsv);
  const staleCsv = normalizeText(clean.outputs?.staleCsv);
  const issues = [];
  if (cleanResult.ok !== true) {
    issues.push("clean_report_read_failed");
  }
  if (!currentCsv || !fs.existsSync(currentCsv)) {
    issues.push("current_csv_missing");
  }
  if (!SIGNOFF_INPUT_CSV || !SIGNOFF_INPUT_CSV.endsWith(".csv")) {
    issues.push("target_signoff_input_invalid");
  }
  const currentCsvText = currentCsv && fs.existsSync(currentCsv) ? fs.readFileSync(currentCsv, "utf8") : "";
  const currentRows = currentCsvText ? countCsvRows(currentCsvText) : 0;
  const expectedRows = Number(clean.summary?.currentRows);
  if (Number.isFinite(expectedRows) && currentRows !== expectedRows) {
    issues.push("current_csv_row_count_mismatch");
  }
  const confirmMatched = CONFIRM === CONFIRM_PHRASE;
  const backupCsv = buildBackupPath(SIGNOFF_INPUT_CSV, generatedAt);
  const shouldPromote = issues.length === 0 && confirmMatched;
  return {
    ok: shouldPromote || (issues.length === 0 && !confirmMatched),
    generatedAt,
    scope: "fcu_field_remediation_signoff_input_promote",
    mode: shouldPromote ? "promote" : "dry_run",
    controlMutation: false,
    fileMutation: shouldPromote,
    confirmMatched,
    confirmRequired: CONFIRM_PHRASE,
    issues,
    summary: {
      currentRows,
      staleRows: clean.summary?.staleRows ?? null,
      generatedMissingRows: clean.summary?.generatedMissingRows ?? null
    },
    source: {
      cleanJson: cleanResult.path,
      currentCsv,
      staleCsv
    },
    target: {
      signoffInputCsv: SIGNOFF_INPUT_CSV,
      backupCsv
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD
    }
  };
}

function applyPromotion(report) {
  if (!report.fileMutation) {
    return report;
  }
  ensureParentDir(report.target.backupCsv);
  if (fs.existsSync(report.target.signoffInputCsv)) {
    fs.copyFileSync(report.target.signoffInputCsv, report.target.backupCsv);
  }
  fs.copyFileSync(report.source.currentCsv, report.target.signoffInputCsv);
  return {
    ...report,
    promoted: {
      backupWritten: fs.existsSync(report.target.backupCsv),
      targetWritten: true
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场签字输入提升报告");
  lines.push("");
  lines.push(`- 模式: ${report.mode}`);
  lines.push(`- 确认短语匹配: ${report.confirmMatched ? "是" : "否"}`);
  lines.push(`- 当前有效行: ${report.summary.currentRows}`);
  lines.push(`- 旧行: ${report.summary.staleRows ?? "--"}`);
  lines.push(`- 文件写入: ${report.fileMutation ? "是" : "否"}`);
  lines.push(`- BA/PLC 写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 文件");
  lines.push("");
  lines.push(`- 当前有效 CSV: ${report.source.currentCsv || "--"}`);
  lines.push(`- 旧行归档 CSV: ${report.source.staleCsv || "--"}`);
  lines.push(`- 目标输入 CSV: ${report.target.signoffInputCsv}`);
  lines.push(`- 备份 CSV: ${report.target.backupCsv}`);
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("## 阻断");
    lines.push("");
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }
  lines.push("");
  lines.push("## 边界");
  lines.push("");
  lines.push("- 本脚本只处理现场签字 CSV 文件，不产生 BA/PLC 写入。");
  lines.push("- 提升后仍需重跑签字校验、实时 closeout 和 Canary 总门禁。");
  lines.push(`- 若要真实替换主输入，需设置 FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM=${report.confirmRequired}`);
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

function main() {
  const report = applyPromotion(buildReport(readJsonFile(CLEAN_JSON)));
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE ok=${report.ok} mode=${report.mode} fileMutation=${report.fileMutation} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  if (report.issues.length > 0 || !report.confirmMatched) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
