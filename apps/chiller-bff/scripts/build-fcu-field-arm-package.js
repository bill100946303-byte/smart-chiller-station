import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE) || "BGS01";
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");
const OUTPUT_JSON =
  process.env.FCU_FIELD_ARM_PACKAGE_JSON ||
  path.join(DOCS_DIR, "fcu-field-arm-package-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_ARM_PACKAGE_MD ||
  path.join(DOCS_DIR, "fcu-field-arm-package-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_ARM_PACKAGE_CSV ||
  path.join(DOCS_DIR, "fcu-field-arm-package-latest.csv");

const REPORT_PATHS = {
  canaryPackage: process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON || path.join(DOCS_DIR, "fcu-canary-execution-package-latest.json"),
  adapterReadiness: process.env.FCU_BA_WRITE_ADAPTER_READINESS_JSON || path.join(DOCS_DIR, "fcu-ba-write-adapter-readiness-latest.json"),
  feedbackMonitor: process.env.FCU_CANARY_FEEDBACK_MONITOR_JSON || path.join(DOCS_DIR, "fcu-canary-feedback-monitor-latest.json"),
  canaryWindow: process.env.FCU_CANARY_WINDOW_JSON || path.join(DOCS_DIR, "fcu-canary-window-latest.json"),
  finalWorklist: process.env.FCU_FINAL_CONTROL_WORKLIST_JSON || path.join(DOCS_DIR, "fcu-final-control-worklist-latest.json"),
  finalCompletion: process.env.FCU_FINAL_CONTROL_COMPLETION_JSON || path.join(DOCS_DIR, "fcu-final-control-completion-latest.json"),
  qualityRemediation: process.env.FCU_QUALITY_REMEDIATION_JSON || path.join(DOCS_DIR, "fcu-quality-remediation-latest.json")
};

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function readJsonFile(filePath) {
  try {
    return {
      ok: true,
      path: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8")),
      error: null
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

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function findDevice(devices, deviceCode) {
  return normalizeList(devices).find((item) => normalizeText(item.deviceCode) === deviceCode) || null;
}

function collectBlockers(...groups) {
  const seen = new Set();
  const output = [];
  for (const group of groups) {
    for (const item of normalizeList(group)) {
      const key = normalizeText(item.key || item.label || item.message || item.reason);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push({
        key,
        label: normalizeText(item.label || item.action || item.key) || key,
        severity: normalizeText(item.severity || item.priority || "P0") || "P0",
        evidence: normalizeText(item.evidence || item.message || item.reason),
        action: normalizeText(item.action || item.command)
      });
    }
  }
  return output;
}

function buildChecklist(canaryPackage, adapterReadiness, feedbackMonitor, finalCompletion) {
  const requiredEnv = canaryPackage.requiredEnv || {};
  const canary = canaryPackage.canary || {};
  return [
    {
      key: "site_authorization",
      phase: "authorization",
      label: "现场授权真实 BA 写入",
      status: "manual_required",
      owner: "现场负责人",
      evidence: "甲方/运维明确授权单台 BGS01 试写，窗口内有人值守。",
      action: "人工签字确认后再设置确认短语。",
      writesControl: false
    },
    {
      key: "backend_write_gate",
      phase: "environment",
      label: "关闭 BFF 只读总闸",
      status: adapterReadiness.checks?.find((item) => item.key === "backend_write_gate")?.ok ? "ready" : "blocked",
      owner: "平台工程师",
      evidence: adapterReadiness.checks?.find((item) => item.key === "backend_write_gate")?.evidence || "readOnlyMode unknown",
      action: "READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev",
      writesControl: false
    },
    {
      key: "ba_confirm_phrase",
      phase: "authorization",
      label: "设置 BA 写入确认短语",
      status: adapterReadiness.checks?.find((item) => item.key === "ba_write_confirm")?.ok ? "ready" : "blocked",
      owner: "平台工程师",
      evidence: `FCU_SMALL_BATCH_CONFIRM=${requiredEnv.FCU_SMALL_BATCH_CONFIRM || CONFIRM_PHRASE}`,
      action: `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`,
      writesControl: false
    },
    {
      key: "canary_command_mapping",
      phase: "mapping",
      label: "核对 Canary 写点映射",
      status: adapterReadiness.checks?.find((item) => item.key === "canary_command_mapping")?.ok ? "ready" : "blocked",
      owner: "自控工程师",
      evidence: adapterReadiness.canary?.command?.tagName || canary.primaryCommand?.tagName || "tag missing",
      action: "确认 BA 点表写点、反馈点和单位一致。",
      writesControl: false
    },
    {
      key: "canary_dispatch",
      phase: "dispatch",
      label: `执行 ${DEVICE_CODE} 单台 Canary`,
      status: feedbackMonitor.canary?.dispatchConfirmed ? "done" : "pending",
      owner: "平台工程师 + 现场值班",
      evidence: feedbackMonitor.verdict || "waiting_for_canary_dispatch",
      action: canary.executionCommand || `FCU_CANARY_DEVICE_CODE=${DEVICE_CODE} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`,
      writesControl: true
    },
    {
      key: "feedback_verification",
      phase: "feedback",
      label: "60-120 秒内反馈校验",
      status: feedbackMonitor.canary?.feedbackConfirmed ? "done" : "pending",
      owner: "平台工程师",
      evidence: feedbackMonitor.canary?.feedbackStatus || finalCompletion.canaryVerificationStatus || "feedback missing",
      action: "执行 verify-feedback，确认 feedback_confirmed 后才允许扩批。",
      writesControl: false
    },
    {
      key: "rollback_ready",
      phase: "rollback",
      label: "回退和锁定准备",
      status: "manual_required",
      owner: "平台工程师 + 现场值班",
      evidence: "反馈不一致、通讯报警、温度异常、投诉或本地抢控制即回退。",
      action: canary.rollbackCommand || "rollback:fcu-small-batch-dispatch -- --record-id=<recordId>",
      writesControl: false
    }
  ];
}

function buildPackage(reports) {
  const canaryPackage = reports.canaryPackage.payload || {};
  const adapterReadiness = reports.adapterReadiness.payload || {};
  const feedbackMonitor = reports.feedbackMonitor.payload || {};
  const canaryWindow = reports.canaryWindow.payload || {};
  const finalWorklist = reports.finalWorklist.payload || {};
  const finalCompletion = reports.finalCompletion.payload || {};
  const qualityRemediation = reports.qualityRemediation.payload || {};
  const canary = {
    ...(canaryPackage.canary || {}),
    ...(adapterReadiness.canary || {}),
    ...(feedbackMonitor.canary || {})
  };
  const qualityDevice = findDevice(qualityRemediation.devices, DEVICE_CODE);
  const checklist = buildChecklist(canaryPackage, adapterReadiness, feedbackMonitor, finalCompletion);
  const blockers = collectBlockers(
    canaryPackage.blockers,
    adapterReadiness.blockingItems,
    canaryWindow.evidence?.readiness?.blockers,
    finalWorklist.actions?.filter((item) => item.priority === "P0"),
    qualityDevice ? [{ key: "quality_remediation", label: "首台质量整改", severity: qualityDevice.severity, evidence: (qualityDevice.reasons || []).join("/") }] : []
  );
  const writeCommand = canary.executionCommand ||
    `FCU_CANARY_DEVICE_CODE=${DEVICE_CODE} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`;
  const feedbackChecks = normalizeList(canaryPackage.feedbackChecks).length
    ? canaryPackage.feedbackChecks
    : normalizeList(feedbackMonitor.checks);
  const rollbackTriggers = normalizeList(canaryPackage.rollbackTriggers).length
    ? canaryPackage.rollbackTriggers
    : [
        "反馈超时未确认",
        "反馈值不一致",
        "通讯报警或温度异常",
        "本地手动/锁定/投诉"
      ];
  return {
    ok: blockers.filter((item) => item.severity === "P0").length === 0 && feedbackMonitor.canary?.feedbackConfirmed === true,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_field_arm_package",
    deviceCode: DEVICE_CODE,
    verdict: feedbackMonitor.canary?.feedbackConfirmed
      ? "canary_feedback_confirmed"
      : blockers.length > 0
        ? "field_arm_package_blocked"
        : "field_arm_package_ready",
    controlMutation: false,
    canary: {
      deviceCode: DEVICE_CODE,
      deviceName: canary.deviceName || null,
      snapshot: adapterReadiness.canary?.snapshot || null,
      command: adapterReadiness.canary?.command || canary.primaryCommand || null,
      secondaryCommand: canary.secondaryCommand || null,
      writeCommand,
      rollbackCommand: canary.rollbackCommand || "rollback:fcu-small-batch-dispatch -- --record-id=<recordId>"
    },
    requiredEnv: {
      READ_ONLY_MODE: "false",
      CHILLER_READ_ONLY_MODE: "false",
      FCU_CANARY_DEVICE_CODE: DEVICE_CODE,
      FCU_CANARY_COMMAND_KIND: "setpoint",
      FCU_SMALL_BATCH_CONFIRM: CONFIRM_PHRASE
    },
    checklist,
    blockers,
    feedbackChecks,
    rollbackTriggers,
    acceptanceRecords: [
      { field: "现场授权人", required: true },
      { field: "投运开始时间", required: true },
      { field: "执行 recordId", required: true },
      { field: "BA 写入返回", required: true },
      { field: "设定反馈/运行反馈", required: true },
      { field: "verify-feedback 结果", required: true },
      { field: "是否触发回退", required: true },
      { field: "现场值班确认", required: true }
    ],
    sourceReports: Object.fromEntries(
      Object.entries(reports).map(([key, report]) => [
        key,
        {
          ok: report.ok,
          path: report.path,
          verdict: report.payload?.verdict || null,
          error: report.error
        }
      ])
    ),
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    }
  };
}

function renderMarkdown(pkg) {
  const lines = [];
  lines.push("# FCU 现场开闸前投运包");
  lines.push("");
  lines.push(`- 站点: ${pkg.siteId}`);
  lines.push(`- 设备: ${pkg.deviceCode} ${pkg.canary.deviceName || ""}`.trim());
  lines.push(`- 结论: ${pkg.verdict}`);
  lines.push(`- 写控制副作用: ${pkg.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${pkg.generatedAt}`);
  lines.push("");
  lines.push("## Canary 命令");
  lines.push("");
  lines.push(`- 写点: ${pkg.canary.command?.pointName || "--"} / ${pkg.canary.command?.tagName || "--"}`);
  lines.push(`- 目标值: ${pkg.canary.command?.value ?? "--"} ${pkg.canary.command?.unit || ""}`.trim());
  lines.push(`- 执行命令: \`${pkg.canary.writeCommand}\``);
  lines.push(`- 回退命令: \`${pkg.canary.rollbackCommand}\``);
  lines.push("");
  lines.push("## 环境变量");
  lines.push("");
  for (const [key, value] of Object.entries(pkg.requiredEnv)) {
    lines.push(`- ${key}=${value}`);
  }
  lines.push("");
  lines.push("## 开闸检查清单");
  lines.push("");
  for (const item of pkg.checklist) {
    lines.push(`- [${item.status === "ready" || item.status === "done" ? "x" : " "}] ${item.label} (${item.phase})`);
    lines.push(`  - 负责人: ${item.owner}`);
    lines.push(`  - 证据: ${item.evidence}`);
    lines.push(`  - 动作: ${item.action}`);
    lines.push(`  - 写控制: ${item.writesControl ? "是" : "否"}`);
  }
  if (pkg.blockers.length > 0) {
    lines.push("");
    lines.push("## 当前阻断");
    lines.push("");
    for (const item of pkg.blockers) {
      lines.push(`- ${item.severity} ${item.label}: ${item.evidence || item.key}`);
      if (item.action) {
        lines.push(`  - 动作: ${item.action}`);
      }
    }
  }
  lines.push("");
  lines.push("## 反馈验收");
  lines.push("");
  for (const item of pkg.feedbackChecks) {
    lines.push(`- ${item.key || item.label || item.check}: ${item.expected || item.evidence || "--"}`);
  }
  lines.push("");
  lines.push("## 回退触发");
  lines.push("");
  for (const item of pkg.rollbackTriggers) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## 验收记录字段");
  lines.push("");
  for (const item of pkg.acceptanceRecords) {
    lines.push(`- ${item.field}${item.required ? "（必填）" : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(pkg) {
  const rows = [
    ["phase", "key", "label", "status", "owner", "evidence", "action", "writes_control"],
    ...pkg.checklist.map((item) => [
      item.phase,
      item.key,
      item.label,
      item.status,
      item.owner,
      item.evidence,
      item.action,
      item.writesControl ? "yes" : "no"
    ])
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function main() {
  const reports = Object.fromEntries(Object.entries(REPORT_PATHS).map(([key, filePath]) => [key, readJsonFile(filePath)]));
  const pkg = buildPackage(reports);
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(pkg, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(pkg));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(pkg));
  console.log(
    `FCU_FIELD_ARM_PACKAGE ok=${pkg.ok} verdict=${pkg.verdict} device=${pkg.deviceCode} blockers=${pkg.blockers.length} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  console.log(`csv=${OUTPUT_CSV}`);
  if (!pkg.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
