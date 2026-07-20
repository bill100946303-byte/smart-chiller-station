import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const TARGET_DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE);
const CANARY_DISPATCH_JSON_DEFAULT =
  process.env.FCU_CANARY_DISPATCH_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.json");
const FINAL_COMPLETION_JSON =
  process.env.FCU_FINAL_CONTROL_COMPLETION_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-completion-latest.json");
const CANARY_PACKAGE_JSON_DEFAULT =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-execution-package-latest.json");
const ADAPTER_READINESS_JSON_DEFAULT =
  process.env.FCU_BA_WRITE_ADAPTER_READINESS_JSON ||
  path.resolve(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json");
const OUTPUT_JSON_DEFAULT =
  process.env.FCU_CANARY_FEEDBACK_MONITOR_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-feedback-monitor-latest.json");
const OUTPUT_MD_DEFAULT =
  process.env.FCU_CANARY_FEEDBACK_MONITOR_MD ||
  path.resolve(DOCS_DIR, "fcu-canary-feedback-monitor-latest.md");
const OUTPUT_CSV_DEFAULT =
  process.env.FCU_CANARY_FEEDBACK_MONITOR_CSV ||
  path.resolve(DOCS_DIR, "fcu-canary-feedback-monitor-latest.csv");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function slugifyDeviceCode(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function resolveDevicePath(defaultPath, extension) {
  if (!TARGET_DEVICE_CODE) {
    return defaultPath;
  }
  return defaultPath.replace(/-latest\.[^.]+$/, `-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.${extension}`);
}

const CANARY_DISPATCH_JSON = resolveDevicePath(CANARY_DISPATCH_JSON_DEFAULT, "json");
const CANARY_PACKAGE_JSON = resolveDevicePath(CANARY_PACKAGE_JSON_DEFAULT, "json");
const ADAPTER_READINESS_JSON = resolveDevicePath(ADAPTER_READINESS_JSON_DEFAULT, "json");
const OUTPUT_JSON = resolveDevicePath(OUTPUT_JSON_DEFAULT, "json");
const OUTPUT_MD = resolveDevicePath(OUTPUT_MD_DEFAULT, "md");
const OUTPUT_CSV = resolveDevicePath(OUTPUT_CSV_DEFAULT, "csv");

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
      payload: null,
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function readCanaryRecordId(dispatch) {
  return normalizeText(
    dispatch.dispatch?.recordId ||
      dispatch.recordId ||
      dispatch.verification?.recordId ||
      dispatch.summary?.recordId
  );
}

function readFeedbackStatus(dispatch, finalCompletion) {
  return normalizeText(
    dispatch.verification?.recordStatus ||
      dispatch.verification?.status ||
      finalCompletion.canaryVerificationStatus ||
      finalCompletion.milestones?.canary?.feedbackStatus
  );
}

function hasRollback(dispatch) {
  return Boolean(dispatch.rollback?.ok || dispatch.rollback?.recordStatus || dispatch.rollback?.status);
}

function buildReport(files) {
  const dispatch = files.dispatch.payload || {};
  const finalCompletion = files.finalCompletion.payload || {};
  const canaryPackage = files.canaryPackage.payload || {};
  const adapterReadiness = files.adapterReadiness.payload || {};
  const deviceCode =
    TARGET_DEVICE_CODE ||
    normalizeText(dispatch.canary?.deviceCode) ||
    normalizeText(dispatch.deviceCode) ||
    normalizeText(canaryPackage.canary?.deviceCode) ||
    normalizeText(adapterReadiness.canary?.deviceCode) ||
    "BGS01";
  const recordId = readCanaryRecordId(dispatch);
  const feedbackStatus = readFeedbackStatus(dispatch, finalCompletion);
  const rollbackTriggered = hasRollback(dispatch);
  const dispatchConfirmed =
    dispatch.mode === "confirmed_canary_dispatch" ||
    dispatch.dispatch?.controlMutation === true ||
    dispatch.controlMutation === true;
  const feedbackConfirmed = feedbackStatus === "feedback_confirmed";
  const feedbackAbnormal = ["feedback_mismatch_locked", "feedback_partial", "feedback_not_checkable"].includes(feedbackStatus);
  let verdict = "waiting_for_canary_dispatch";
  if (rollbackTriggered) {
    verdict = "rollback_triggered";
  } else if (feedbackAbnormal) {
    verdict = "rollback_required";
  } else if (feedbackConfirmed) {
    verdict = "canary_feedback_confirmed";
  } else if (dispatchConfirmed || recordId) {
    verdict = "waiting_for_feedback_confirmation";
  }
  const checks = [
    {
      key: "canary_dispatch_report",
      label: "Canary 执行报告",
      ok: files.dispatch.ok && !dispatch.error,
      evidence: files.dispatch.ok ? files.dispatch.path : files.dispatch.error || "missing"
    },
    {
      key: "canary_record_id",
      label: "执行记录 ID",
      ok: Boolean(recordId),
      evidence: recordId || "missing"
    },
    {
      key: "canary_dispatch_confirmed",
      label: "真实下发已确认",
      ok: dispatchConfirmed,
      evidence: dispatch.mode || `controlMutation=${dispatch.controlMutation}`
    },
    {
      key: "feedback_confirmed",
      label: "反馈已确认",
      ok: feedbackConfirmed,
      evidence: feedbackStatus || "missing"
    },
    {
      key: "rollback_not_triggered",
      label: "未触发回退",
      ok: !rollbackTriggered,
      evidence: rollbackTriggered ? dispatch.rollback?.recordStatus || dispatch.rollback?.status || "rollback" : "none"
    }
  ];
  const nextActions = [];
  if (!dispatchConfirmed) {
    nextActions.push({
      priority: "P0",
      action: `执行 ${deviceCode} 单台真实下发`,
      command: canaryPackage.canary?.executionCommand || `FCU_CANARY_DEVICE_CODE=${deviceCode} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`,
      reason: "尚未形成 confirmed_canary_dispatch。"
    });
  } else if (!feedbackConfirmed && !rollbackTriggered) {
    nextActions.push({
      priority: "P0",
      action: "等待或重跑反馈校验",
      command: recordId ? `POST /bff/v1/sites/${SITE_ID}/hvac-terminal/fan-coils/control-records/${recordId}/verify-feedback?build=1&floor=1` : "",
      reason: feedbackStatus || "反馈未确认。"
    });
  }
  if (feedbackAbnormal && !rollbackTriggered) {
    nextActions.push({
      priority: "P0",
      action: "执行回退并锁定设备",
      command: recordId ? `POST /bff/v1/sites/${SITE_ID}/hvac-terminal/fan-coils/control-records/${recordId}/rollback` : "",
      reason: `反馈异常：${feedbackStatus}`
    });
  }
  if (feedbackConfirmed && !rollbackTriggered) {
    nextActions.push({
      priority: "P1",
      action: "允许进入小批量前检查",
      command: "npm --prefix apps/chiller-bff run check:fcu-final-control-completion",
      reason: "首台 Canary 反馈已确认。"
    });
  }
  return {
    ok: feedbackConfirmed && !rollbackTriggered,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_canary_feedback_monitor",
    verdict,
    controlMutation: false,
    canary: {
      deviceCode,
      recordId: recordId || null,
      dispatchConfirmed,
      feedbackStatus: feedbackStatus || null,
      feedbackConfirmed,
      rollbackTriggered
    },
    checks,
    nextActions,
    evidence: {
      dispatch: { ok: files.dispatch.ok, path: files.dispatch.path, mode: dispatch.mode || null, error: files.dispatch.error || null },
      finalCompletion: { ok: files.finalCompletion.ok, path: files.finalCompletion.path, verdict: finalCompletion.verdict || null, error: files.finalCompletion.error || null },
      canaryPackage: { ok: files.canaryPackage.ok, path: files.canaryPackage.path, verdict: canaryPackage.verdict || null, error: files.canaryPackage.error || null },
      adapterReadiness: { ok: files.adapterReadiness.ok, path: files.adapterReadiness.path, verdict: adapterReadiness.verdict || null, error: files.adapterReadiness.error || null }
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 首台 Canary 反馈监视");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 设备: ${report.canary.deviceCode}`);
  lines.push(`- 记录: ${report.canary.recordId || "--"}`);
  lines.push(`- 结论: ${report.verdict}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无，只读监视报告"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 检查项");
  lines.push("");
  lines.push("| 检查 | 状态 | 证据 |");
  lines.push("|---|---|---|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "通过" : "未通过"} | ${check.evidence || "--"} |`);
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  for (const action of report.nextActions) {
    lines.push(`- ${action.priority} ${action.action}: ${action.reason || ""}`);
    if (action.command) {
      lines.push(`  - \`${action.command}\``);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const rows = [
    ["key", "label", "ok", "evidence"],
    ...report.checks.map((check) => [check.key, check.label, check.ok ? "true" : "false", check.evidence])
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
}

const report = buildReport({
  dispatch: readJsonFile(CANARY_DISPATCH_JSON),
  finalCompletion: readJsonFile(FINAL_COMPLETION_JSON),
  canaryPackage: readJsonFile(CANARY_PACKAGE_JSON),
  adapterReadiness: readJsonFile(ADAPTER_READINESS_JSON)
});
writeReport(report);
console.log(
  `FCU_CANARY_FEEDBACK_MONITOR ok=${report.ok} verdict=${report.verdict} canary=${report.canary.deviceCode} feedback=${report.canary.feedbackStatus || "--"} mutation=false`
);
console.log(`json=${OUTPUT_JSON}`);
console.log(`md=${OUTPUT_MD}`);
console.log(`csv=${OUTPUT_CSV}`);
if (!report.ok) {
  process.exitCode = 2;
}
