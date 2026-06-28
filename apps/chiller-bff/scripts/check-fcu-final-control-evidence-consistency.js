import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const FINAL_RUNBOOK_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const FINAL_WORKLIST_JSON =
  process.env.FCU_FINAL_CONTROL_WORKLIST_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-worklist-latest.json");
const FIELD_HANDOFF_JSON =
  process.env.FCU_FIELD_HANDOFF_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.json");
const SIGNOFF_CLEAN_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json");
const SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const RETURN_TEMPLATE_JSON =
  process.env.FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-return-template-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-evidence-consistency-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-evidence-consistency-latest.md");
const ALLOW_TMP_OUTPUTS = process.env.FCU_FINAL_CONTROL_EVIDENCE_ALLOW_TMP_OUTPUTS === "true";

function readJson(filePath, label) {
  try {
    return {
      ok: true,
      label,
      path: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      label,
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
      payload: {}
    };
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePath(value) {
  return typeof value === "string" ? path.resolve(value) : "";
}

function hasTempPath(value) {
  const normalized = normalizePath(value);
  return Boolean(normalized && normalized.startsWith(path.resolve(os.tmpdir())));
}

function addMismatch(issues, key, sources) {
  const values = sources.map((source) => source.value);
  const knownValues = values.filter((value) => value !== null && value !== undefined);
  const unique = new Set(knownValues.map((value) => JSON.stringify(value)));
  if (knownValues.length <= 1 || unique.size <= 1) {
    return;
  }
  issues.push({
    severity: "P0",
    key,
    message: `${key} evidence mismatch`,
    sources
  });
}

function collectTempPathIssues(issues, object, prefix = "") {
  if (ALLOW_TMP_OUTPUTS || !object || typeof object !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(object)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" && hasTempPath(value)) {
      issues.push({
        severity: "P0",
        key: "temp_output_path",
        message: "final-control evidence output path points to a temp directory",
        field: nextKey,
        value
      });
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      collectTempPathIssues(issues, value, nextKey);
    }
  }
}

function buildReport() {
  const files = {
    runbook: readJson(FINAL_RUNBOOK_JSON, "final runbook"),
    worklist: readJson(FINAL_WORKLIST_JSON, "final worklist"),
    handoff: readJson(FIELD_HANDOFF_JSON, "field handoff"),
    signoffClean: readJson(SIGNOFF_CLEAN_JSON, "signoff clean"),
    signoff: readJson(SIGNOFF_JSON, "signoff"),
    returnTemplate: readJson(RETURN_TEMPLATE_JSON, "field return template")
  };
  const issues = [];
  for (const [key, file] of Object.entries(files)) {
    if (!file.ok) {
      issues.push({
        severity: "P0",
        key: "missing_or_invalid_json",
        source: key,
        file: file.path,
        message: file.error
      });
    }
  }

  const runbook = files.runbook.payload || {};
  const worklist = files.worklist.payload || {};
  const handoff = files.handoff.payload || {};
  const signoffClean = files.signoffClean.payload || {};
  const signoff = files.signoff.payload || {};
  const returnTemplate = files.returnTemplate.payload || {};
  const worklistHandoff = worklist.fieldPackages?.fieldHandoff || {};

  addMismatch(issues, "stale_signoff_rows", [
    { source: "runbook.summary.signoffStaleRows", value: toNumber(runbook.summary?.signoffStaleRows) },
    { source: "worklist.fieldPackages.fieldHandoff.staleSignoffRows", value: toNumber(worklistHandoff.staleSignoffRows) },
    { source: "handoff.summary.staleSignoffRows", value: toNumber(handoff.summary?.staleSignoffRows) },
    { source: "signoffClean.summary.staleRows", value: toNumber(signoffClean.summary?.staleRows) },
    { source: "signoff.summary.ignoredRows", value: toNumber(signoff.summary?.ignoredRows) }
  ]);
  addMismatch(issues, "signoff_complete_rows", [
    { source: "runbook.summary.signoffCompleteRows", value: toNumber(runbook.summary?.signoffCompleteRows) },
    { source: "worklist.fieldPackages.fieldHandoff.signoffCompleteRows", value: toNumber(worklistHandoff.signoffCompleteRows) },
    { source: "handoff.summary.signoffCompleteRows", value: toNumber(handoff.summary?.signoffCompleteRows) },
    { source: "signoff.summary.completeRows", value: toNumber(signoff.summary?.completeRows) }
  ]);
  addMismatch(issues, "signoff_expected_rows", [
    { source: "runbook.summary.signoffExpectedRows", value: toNumber(runbook.summary?.signoffExpectedRows) },
    { source: "worklist.fieldPackages.fieldHandoff.signoffExpectedRows", value: toNumber(worklistHandoff.signoffExpectedRows) },
    { source: "handoff.summary.signoffExpectedRows", value: toNumber(handoff.summary?.signoffExpectedRows) },
    { source: "signoffClean.summary.expectedWorkOrders", value: toNumber(signoffClean.summary?.expectedWorkOrders) },
    { source: "signoff.summary.expectedWorkOrders", value: toNumber(signoff.summary?.expectedWorkOrders) }
  ]);
  addMismatch(issues, "handoff_open_p0_devices", [
    { source: "worklist.fieldPackages.fieldHandoff.openP0Devices", value: toNumber(worklistHandoff.openP0Devices) },
    { source: "handoff.summary.openP0Devices", value: toNumber(handoff.summary?.openP0Devices) },
    { source: "handoff.devices.length", value: Array.isArray(handoff.devices) ? handoff.devices.length : null }
  ]);

  for (const [source, payload] of Object.entries({ runbook, worklist, handoff })) {
    if (payload.controlMutation === true || payload.dispatch === true) {
      issues.push({
        severity: "P0",
        key: "unexpected_control_mutation",
        source,
        controlMutation: payload.controlMutation === true,
        dispatch: payload.dispatch === true
      });
    }
  }
  collectTempPathIssues(issues, {
    worklistHandoff,
    handoffOutputFiles: handoff.outputFiles,
    signoffCleanOutputs: signoffClean.outputs,
    signoffOutputs: signoff.outputs,
    returnTemplateOutputs: returnTemplate.outputs,
    returnTemplateSourceFiles: returnTemplate.sourceFiles
  });

  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_final_control_evidence_consistency",
    controlMutation: false,
    dispatch: false,
    verdict: issues.length === 0 ? "evidence_consistent" : "evidence_inconsistent",
    summary: {
      issueCount: issues.length,
      staleSignoffRows: toNumber(runbook.summary?.signoffStaleRows),
      signoffCompleteRows: toNumber(runbook.summary?.signoffCompleteRows),
      signoffExpectedRows: toNumber(runbook.summary?.signoffExpectedRows),
      openP0Devices: toNumber(handoff.summary?.openP0Devices),
      finalGatePassed: runbook.summary?.finalGatePassed === true,
      canaryReady: runbook.summary?.canaryReady === true
    },
    issues,
    sourceFiles: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, file.path]))
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制证据一致性检查");
  lines.push("");
  lines.push(`- 结论: ${report.verdict}`);
  lines.push(`- 问题数: ${report.summary.issueCount}`);
  lines.push(`- P0设备: ${report.summary.openP0Devices ?? "--"}`);
  lines.push(`- 过期签核行: ${report.summary.staleSignoffRows ?? "--"}`);
  lines.push(`- 签核进度: ${report.summary.signoffCompleteRows ?? "--"}/${report.summary.signoffExpectedRows ?? "--"}`);
  lines.push(`- 写入副作用: ${report.controlMutation || report.dispatch ? "存在" : "无"}`);
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("## Issues");
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.key}: ${issue.message || issue.field || "--"}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

const report = buildReport();
writeReport(report);
console.log(`FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY ok=${report.ok} issues=${report.summary.issueCount} mutation=false`);
console.log(`json=${OUTPUT_JSON}`);
console.log(`md=${OUTPUT_MD}`);
if (!report.ok) {
  process.exitCode = 2;
}
