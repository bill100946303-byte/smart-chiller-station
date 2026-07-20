import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const CONFIRM_PHRASE = "I_UNDERSTAND_REAL_BA_WRITE";
const TARGET_DEVICE_CODE = normalizeText(process.env.FCU_CANARY_DEVICE_CODE);
const CANARY_QUEUE_JSON =
  process.env.FCU_CANARY_QUEUE_JSON ||
  path.join(DOCS_DIR, "fcu-canary-queue-latest.json");
const SMALL_BATCH_PLAN_JSON =
  process.env.FCU_SMALL_BATCH_PLAN_JSON ||
  path.join(DOCS_DIR, "fcu-small-batch-dispatch-plan-latest.json");
const GO_LIVE_PREFLIGHT_JSON =
  process.env.FCU_GO_LIVE_PREFLIGHT_JSON ||
  path.join(DOCS_DIR, "fcu-go-live-preflight-latest.json");
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.join(DOCS_DIR, "fcu-field-arm-check-latest.json");
const FINAL_RUNBOOK_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.join(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const QUALITY_REMEDIATION_JSON =
  process.env.FCU_QUALITY_REMEDIATION_JSON ||
  path.join(DOCS_DIR, "fcu-quality-remediation-latest.json");
const OUTPUT_JSON_DEFAULT =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_JSON ||
  path.join(DOCS_DIR, "fcu-canary-execution-package-latest.json");
const OUTPUT_MD_DEFAULT =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_MD ||
  path.join(DOCS_DIR, "fcu-canary-execution-package-latest.md");
const OUTPUT_CSV_DEFAULT =
  process.env.FCU_CANARY_EXECUTION_PACKAGE_CSV ||
  path.join(DOCS_DIR, "fcu-canary-execution-package-latest.csv");
const OUTPUT_JSON = resolveOutputPath(OUTPUT_JSON_DEFAULT, "json");
const OUTPUT_MD = resolveOutputPath(OUTPUT_MD_DEFAULT, "md");
const OUTPUT_CSV = resolveOutputPath(OUTPUT_CSV_DEFAULT, "csv");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function slugifyDeviceCode(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function resolveOutputPath(defaultPath, extension) {
  if (!TARGET_DEVICE_CODE) {
    return defaultPath;
  }
  return defaultPath.replace(/-latest\.[^.]+$/, `-${slugifyDeviceCode(TARGET_DEVICE_CODE)}.${extension}`);
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

function firstArrayItem(value) {
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

function findDeviceByCode(devices, deviceCode) {
  return (Array.isArray(devices) ? devices : []).find((item) => normalizeText(item.deviceCode) === deviceCode) || null;
}

function normalizeBlockers(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      key: normalizeText(item.key || item.reason || item),
      label: normalizeText(item.label || item.message || item.key || item),
      severity: normalizeText(item.severity || item.priority || "P0") || "P0"
    }))
    .filter((item) => item.key || item.label);
}

function uniqueBlockers(items) {
  const seen = new Set();
  const output = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = normalizeText(item.key || item.label || item.message);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildCondition(key, label, passed, evidence, action) {
  return {
    key,
    label,
    passed: passed === true,
    evidence: evidence || "",
    action: action || ""
  };
}

function readPreviewCommand(device, key) {
  const commands = device?.previews?.[key]?.commands;
  return Array.isArray(commands) ? commands[0] || null : null;
}

function commandHasMapping(command) {
  return Boolean(command?.pointName && command?.tagName && command?.value !== undefined);
}

function normalizePackageCommand(command, kind) {
  if (!command) {
    return null;
  }
  return {
    kind,
    commandType: command.commandType || kind,
    pointKey: command.pointKey || null,
    pointName: command.pointName || null,
    tagName: command.tagName || null,
    value: command.value,
    unit: command.unit || null
  };
}

function buildReport(files) {
  const queue = files.queue.payload || {};
  const smallBatchPlan = files.smallBatchPlan.payload || {};
  const preflight = files.preflight.payload || {};
  const fieldArm = files.fieldArm.payload || {};
  const runbook = files.runbook.payload || {};
  const quality = files.quality.payload || {};
  const preferredDeviceCode = TARGET_DEVICE_CODE || queue.summary?.firstCanary || fieldArm.firstCanary || "BGS01";
  const canaryItem =
    findDeviceByCode(queue.queue, preferredDeviceCode) ||
    firstArrayItem(queue.queue) ||
    findDeviceByCode(smallBatchPlan.devices, preferredDeviceCode) ||
    null;
  const canaryDeviceCode =
    TARGET_DEVICE_CODE ||
    normalizeText(canaryItem?.deviceCode) ||
    normalizeText(queue.summary?.firstCanary) ||
    normalizeText(fieldArm.firstCanary) ||
    normalizeText(runbook.scope?.canaryDevice) ||
    "BGS01";
  const qualityDevice = findDeviceByCode(quality.devices, canaryDeviceCode);
  const planDevice = findDeviceByCode(smallBatchPlan.devices, canaryDeviceCode);
  const baWriteConfirmPresent = normalizeText(process.env.FCU_SMALL_BATCH_CONFIRM) === CONFIRM_PHRASE;
  const backendWriteGateReady =
    fieldArm.ok === true &&
    fieldArm.verdict === "field_arm_ready" &&
    !(Array.isArray(fieldArm.blockingItems) ? fieldArm.blockingItems : []).some((item) =>
      ["backend_write_gate", "execution_gate_open"].includes(normalizeText(item.key))
    );
  const primaryCommand =
    commandHasMapping(canaryItem?.primaryCommand)
      ? canaryItem.primaryCommand
      : normalizePackageCommand(readPreviewCommand(planDevice, "setpoint"), "setpoint");
  const secondaryCommand =
    commandHasMapping(canaryItem?.secondaryCommand)
      ? canaryItem.secondaryCommand
      : normalizePackageCommand(readPreviewCommand(planDevice, "fanSpeed"), "fan_speed");
  const commandKind = normalizeText(primaryCommand?.kind) || "setpoint";
  const executionCommand =
    canaryItem?.command ||
    `FCU_CANARY_DEVICE_CODE=${canaryDeviceCode} FCU_CANARY_COMMAND_KIND=${commandKind} FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE} npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`;
  const preconditions = [
    buildCondition(
      "go_live_preflight",
      "上线前预检",
      preflight.ok === true && preflight.verdict === "go_live_ready",
      preflight.verdict || "missing",
      "npm --prefix apps/chiller-bff run check:fcu-go-live-preflight"
    ),
    buildCondition(
      "field_arm",
      "现场 Arm-Check",
      fieldArm.ok === true && fieldArm.verdict === "field_arm_ready",
      fieldArm.verdict || "missing",
      "npm --prefix apps/chiller-bff run check:fcu-field-arm"
    ),
    buildCondition(
      "canary_queue",
      "Canary 队列",
      queue.ok === true && Boolean(canaryItem || planDevice),
      `target=${canaryDeviceCode}, first=${queue.summary?.firstCanary || "--"} devices=${queue.summary?.plannedDevices || 0}`,
      "npm --prefix apps/chiller-bff run build:fcu-canary-queue"
    ),
    buildCondition(
      "canary_quality",
      "首台数据质量",
      !qualityDevice || qualityDevice.severity !== "P0",
      qualityDevice ? `${qualityDevice.severity || "--"} ${(qualityDevice.reasons || []).join("/")}` : "not_in_p0_quality_list",
      "如为 P0，先按 docs/fcu-quality-remediation-latest.csv 完成现场整改。"
    ),
    buildCondition(
      "ba_write_confirm",
      "BA 写入二次确认",
      baWriteConfirmPresent,
      baWriteConfirmPresent ? "FCU_SMALL_BATCH_CONFIRM=present" : `requires FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`,
      `export FCU_SMALL_BATCH_CONFIRM=${CONFIRM_PHRASE}`
    ),
    buildCondition(
      "backend_write_gate",
      "BFF 写入总闸",
      backendWriteGateReady,
      backendWriteGateReady ? "field_arm_ready confirms /healthz readOnlyMode=false" : "requires /healthz readOnlyMode=false",
      "READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev"
    )
  ];
  const blockedPreconditions = preconditions.filter((item) => !item.passed);
  const rollbackTriggers = [
    "60-120 秒内反馈未变更为 feedback_confirmed",
    "反馈值与执行单目标不一致或 verify-feedback 返回 mismatch/failed",
    "通讯报警、0°C/越界温度、就地/手动模式、本地锁定任一出现",
    "现场人员报告投诉、禁控或面板抢控制",
    "回退失败时进入 rollback_watch，禁止继续 Canary 或扩批"
  ];
  const feedbackChecks = [
    {
      key: "record_status",
      check: "执行报告 verification.recordStatus",
      expected: "feedback_confirmed"
    },
    {
      key: "completion_milestone",
      check: "docs/fcu-final-control-completion-latest.json milestones.canary.ok",
      expected: "true"
    },
    {
      key: "control_mutation",
      check: "Canary 执行报告 controlMutation",
      expected: "true，仅在授权真实写入窗口内允许"
    },
    {
      key: "no_rollback",
      check: "执行报告 rollback / blockers",
      expected: "无 rollback，阻断项为空"
    }
  ];
  const acceptance = [
    `${canaryDeviceCode} 单台真实写入执行报告 mode=confirmed_canary_dispatch`,
    "verification.recordStatus=feedback_confirmed",
    "最终完成度检查 canary.ok=true 且 canary.feedbackStatus=feedback_confirmed",
    "无通讯报警、无 0°C/越界温度、无本地手动抢控制",
    "审计记录包含 actor、recordId、deviceCode、command、dispatchReceipt、feedback verification"
  ];
  const report = {
    ok: blockedPreconditions.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_canary_execution_package",
    controlMutation: false,
    verdict: blockedPreconditions.length === 0 ? "canary_ready_for_authorized_window" : "canary_package_ready_with_open_gates",
    canary: {
      deviceCode: canaryDeviceCode,
      deviceName: normalizeText(canaryItem?.deviceName) || canaryDeviceCode,
      zoneTemperatureC: canaryItem?.zoneTemperatureC ?? null,
      setpointC: canaryItem?.setpointC ?? null,
      running: canaryItem?.running ?? null,
      primaryCommand,
      secondaryCommand,
      executionCommand,
      rollbackCommand:
        "如执行报告生成 recordId：npm --prefix apps/chiller-bff run rollback:fcu-small-batch-dispatch -- --record-id=<recordId>"
    },
    requiredEnv: {
      FCU_CANARY_DEVICE_CODE: canaryDeviceCode,
      FCU_CANARY_COMMAND_KIND: commandKind,
      FCU_SMALL_BATCH_CONFIRM: CONFIRM_PHRASE,
      READ_ONLY_MODE: "false",
      CHILLER_READ_ONLY_MODE: "false"
    },
    preconditions,
    blockers: uniqueBlockers([
      ...blockedPreconditions.map((item) => ({
        key: item.key,
        label: item.label,
        message: item.evidence,
        action: item.action
      })),
      ...normalizeBlockers(preflight.blockingItems),
      ...normalizeBlockers(fieldArm.blockingItems)
    ]),
    feedbackChecks,
    rollbackTriggers,
    acceptance,
    evidence: {
      queue: { ok: files.queue.ok, path: files.queue.path, summary: queue.summary || null, error: files.queue.error || null },
      smallBatchPlan: { ok: files.smallBatchPlan.ok, path: files.smallBatchPlan.path, summary: smallBatchPlan.summary || null, error: files.smallBatchPlan.error || null },
      preflight: { ok: files.preflight.ok, path: files.preflight.path, verdict: preflight.verdict || null, error: files.preflight.error || null },
      fieldArm: { ok: files.fieldArm.ok, path: files.fieldArm.path, verdict: fieldArm.verdict || null, error: files.fieldArm.error || null },
      runbook: { ok: files.runbook.ok, path: files.runbook.path, scope: runbook.scope || null, error: files.runbook.error || null },
      quality: { ok: files.quality.ok, path: files.quality.path, summary: quality.summary || null, error: files.quality.error || null }
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    }
  };
  return report;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 首台 Canary 执行包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 首台: ${report.canary.deviceName} ${report.canary.deviceCode}`);
  lines.push(`- 结论: ${report.verdict}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无，当前仅生成执行包"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 执行命令");
  lines.push("");
  lines.push("```bash");
  lines.push(report.canary.executionCommand);
  lines.push("```");
  lines.push("");
  lines.push("## 前置条件");
  lines.push("");
  lines.push("| 条件 | 状态 | 证据 | 处理动作 |");
  lines.push("|---|---|---|---|");
  for (const item of report.preconditions) {
    lines.push(`| ${item.label} | ${item.passed ? "通过" : "未满足"} | ${item.evidence || "--"} | ${item.action || "--"} |`);
  }
  lines.push("");
  lines.push("## 反馈验收");
  lines.push("");
  lines.push("| 检查项 | 期望 |");
  lines.push("|---|---|");
  for (const item of report.feedbackChecks) {
    lines.push(`| ${item.check} | ${item.expected} |`);
  }
  lines.push("");
  lines.push("## 回退触发");
  lines.push("");
  for (const item of report.rollbackTriggers) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## 最终验收");
  lines.push("");
  for (const item of report.acceptance) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const rows = [
    ["section", "key", "label", "status", "evidence", "action"],
    ...report.preconditions.map((item) => [
      "precondition",
      item.key,
      item.label,
      item.passed ? "passed" : "open",
      item.evidence,
      item.action
    ]),
    ...report.feedbackChecks.map((item) => [
      "feedback",
      item.key,
      item.check,
      "required",
      item.expected,
      ""
    ]),
    ...report.rollbackTriggers.map((item, index) => [
      "rollback",
      `rollback_${index + 1}`,
      item,
      "trigger",
      "",
      report.canary.rollbackCommand
    ])
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function writeReport(report) {
  report.outputs = {
    json: OUTPUT_JSON,
    markdown: OUTPUT_MD,
    csv: OUTPUT_CSV
  };
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
}

const report = buildReport({
  queue: readJsonFile(CANARY_QUEUE_JSON),
  smallBatchPlan: readJsonFile(SMALL_BATCH_PLAN_JSON),
  preflight: readJsonFile(GO_LIVE_PREFLIGHT_JSON),
  fieldArm: readJsonFile(FIELD_ARM_JSON),
  runbook: readJsonFile(FINAL_RUNBOOK_JSON),
  quality: readJsonFile(QUALITY_REMEDIATION_JSON)
});
writeReport(report);
console.log(
  `FCU_CANARY_EXECUTION_PACKAGE ok=${report.ok} verdict=${report.verdict} canary=${report.canary.deviceCode} blockers=${report.blockers.length} mutation=false`
);
console.log(`json=${OUTPUT_JSON}`);
console.log(`md=${OUTPUT_MD}`);
console.log(`csv=${OUTPUT_CSV}`);
if (!report.ok) {
  process.exitCode = 2;
}
