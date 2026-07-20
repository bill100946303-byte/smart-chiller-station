import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const EXECUTION_PACK_JSON =
  process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-execution-pack-latest.json");
const SIGNOFF_CLEAN_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-clean-input-latest.json");
const SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const FINAL_RUNBOOK_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_HANDOFF_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_HANDOFF_PACK_MD ||
  path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_HANDOFF_PACK_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.csv");

const REASON_LABELS = {
  communication_alarm: "通讯报警",
  zero_temperature: "0°C异常",
  invalid_temperature: "温度无效",
  temperature_quality_guard: "温度质量门槛",
  setpoint_feedback_out_of_bounds: "设定反馈越界"
};

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniq(items) {
  return [...new Set(asArray(items).map(normalizeText).filter(Boolean))];
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
      error: error instanceof Error ? error.message : "read json failed"
    };
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = Array.isArray(value) ? value.join("；") : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatReason(reason) {
  return REASON_LABELS[reason] || reason;
}

function classifyTodayAction(workOrder) {
  const reasons = uniq(workOrder.currentEvidence?.reasons || []);
  if (reasons.includes("communication_alarm")) {
    return "先恢复通讯报警，再做温度和设定反馈复核。";
  }
  if (reasons.some((reason) => reason.includes("temperature") || reason === "zero_temperature")) {
    return "先修复温度点位量程/绑定，再连续两次采样。";
  }
  if (reasons.includes("setpoint_feedback_out_of_bounds")) {
    return "核对面板设定反馈，必要时人工分步拉回 10-32°C。";
  }
  return "核对写点映射、就地状态和连续两次采样。";
}

function buildDeviceRows(workOrders) {
  return workOrders.map((item) => {
    const reasons = uniq(item.currentEvidence?.reasons || []);
    const verification = item.fieldVerification || {};
    return {
      workOrderId: item.workOrderId || `FCU-P0-${item.deviceCode || "UNKNOWN"}`,
      priority: item.priority || "P0",
      deviceCode: item.deviceCode || "",
      deviceName: item.deviceName || item.deviceCode || "",
      owner: item.owner || "BA/自控工程师",
      reasons,
      reasonLabels: reasons.map(formatReason),
      currentEvidence: item.currentEvidence || {},
      todayAction: classifyTodayAction(item),
      requiredReturnFields: {
        handledBy: "必填",
        handledAt: "必填",
        communicationAlarmAfter: verification.communicationAlarmAfter || "按需",
        zoneTemperatureAfterC: verification.zoneTemperatureAfterC || "按需",
        setpointFeedbackAfterC: verification.setpointFeedbackAfterC || "按需",
        writePointMappingChecked: "yes",
        twoSampleNormal: "yes",
        localManualLockout: "none",
        releaseDecision: "release",
        reviewedBy: "必填",
        reviewedAt: "必填"
      },
      releaseCriteria: asArray(item.releaseCriteria),
      plannedAction: asArray(item.plannedAction)
    };
  });
}

function pickNextAllowedStep(runbook, signoffClean) {
  const staleRows = signoffClean.summary?.staleRows ?? asArray(signoffClean.staleRecords).length;
  if (staleRows > 0) {
    return "先清理过期签核行，生成 current-only 输入表。";
  }
  if ((runbook.summary?.blockedDeviceCount || 0) > 0 || (runbook.summary?.p0OpenActions || 0) > 0) {
    return "先完成现场 P0 消缺和签核，禁止进入真实写入。";
  }
  if (runbook.summary?.canaryReady !== true) {
    return "刷新 closeout 与 Canary readiness，确认首台 Canary 条件。";
  }
  return "进入首台 Canary 前最后复核授权、确认短语和 BA 写适配器。";
}

function buildReport(inputs) {
  const workOrders = asArray(inputs.workOrders.payload?.workOrders);
  const executionPack = inputs.executionPack.payload || {};
  const signoffClean = inputs.signoffClean.payload || {};
  const signoff = inputs.signoff.payload || {};
  const runbook = inputs.runbook.payload || {};
  const deviceRows = buildDeviceRows(workOrders);
  const staleRows = signoffClean.summary?.staleRows ?? asArray(signoffClean.staleRecords).length;
  const signoffExpectedRows =
    signoff.summary?.expectedWorkOrders ?? signoffClean.summary?.expectedWorkOrders ?? deviceRows.length;
  const signoffCompleteRows = signoff.summary?.completeRows ?? 0;

  return {
    ok:
      inputs.workOrders.ok === true &&
      inputs.executionPack.ok === true &&
      inputs.signoffClean.ok === true &&
      inputs.signoff.ok === true &&
      inputs.runbook.ok === true &&
      workOrders.length === 0 &&
      staleRows === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_handoff_pack",
    siteId: normalizeText(inputs.workOrders.payload?.siteId || runbook.siteId) || "126lnoffice",
    build: normalizeText(inputs.workOrders.payload?.build || executionPack.build) || "1",
    floor: normalizeText(inputs.workOrders.payload?.floor || executionPack.floor) || "1",
    controlMutation: false,
    dispatch: false,
    conclusion:
      runbook.summary?.finalGatePassed === true
        ? "最终门禁已通过，仍需按 Canary/反馈顺序执行。"
        : "最终门禁未通过，本包只用于现场消缺和签核，不允许真实 BA/PLC 写入。",
    summary: {
      totalWorkOrders: workOrders.length,
      openP0Devices: deviceRows.filter((item) => item.priority === "P0").length,
      staleSignoffRows: staleRows,
      signoffCompleteRows,
      signoffExpectedRows,
      finalGatePassed: runbook.summary?.finalGatePassed === true,
      canaryReady: runbook.summary?.canaryReady === true,
      nextAllowedStep: pickNextAllowedStep(runbook, signoffClean)
    },
    sourceFiles: {
      workOrders: inputs.workOrders.path,
      executionPack: inputs.executionPack.path,
      signoffClean: inputs.signoffClean.path,
      signoff: inputs.signoff.path,
      runbook: inputs.runbook.path
    },
    outputFiles: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV,
      signoffInputCsv: inputs.workOrders.payload?.outputs?.signoffInputCsv || null,
      currentOnlyCsv: signoffClean.outputs?.currentCsv || signoffClean.outputs?.currentOnlyCsv || null,
      staleCsv: signoffClean.outputs?.staleCsv || null
    },
    todaySequence: asArray(executionPack.executionOrder).map((item) => ({
      phase: item.phase,
      deviceCount: item.deviceCount,
      deviceCodes: asArray(item.deviceCodes),
      owners: asArray(item.owners),
      acceptance: item.acceptance || ""
    })),
    staleSignoffRows: asArray(signoffClean.staleRecords),
    devices: deviceRows,
    safetyBoundary: [
      "本交接包不产生 BA/PLC 写入。",
      "releaseDecision=release 只是现场签核结果，不等于系统自动放行。",
      "必须重跑质量整改、closeout、signoff、Canary readiness 和最终总门禁。",
      "首台 Canary 反馈确认前，不允许小批量或全量下发。"
    ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场交接包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.conclusion}`);
  lines.push(`- 待处理 P0 FCU: ${report.summary.openP0Devices}`);
  lines.push(`- 过期签核行: ${report.summary.staleSignoffRows}`);
  lines.push(`- 现场签核: ${report.summary.signoffCompleteRows ?? "--"}/${report.summary.signoffExpectedRows ?? "--"}`);
  lines.push(`- 下一步: ${report.summary.nextAllowedStep}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push("");
  lines.push("## 今日现场顺序");
  lines.push("");
  if (report.todaySequence.length === 0) {
    lines.push("- 无现场执行项。");
  } else {
    for (const item of report.todaySequence) {
      lines.push(`- ${item.phase}: ${item.deviceCount} 台 (${item.deviceCodes.join("、") || "--"})；负责人: ${item.owners.join(" / ") || "--"}；验收: ${item.acceptance || "--"}`);
    }
  }
  lines.push("");
  if (report.staleSignoffRows.length > 0) {
    lines.push("## 先清理的过期签核行");
    lines.push("");
    for (const row of report.staleSignoffRows) {
      lines.push(`- ${row.workOrderId || "--"} ${row.deviceCode || "--"} ${row.deviceName || ""}: ${row.reason || "not_in_current_work_orders"}`);
    }
    lines.push("");
  }
  lines.push("## 逐台交接");
  lines.push("");
  if (report.devices.length === 0) {
    lines.push("- 无待交接 FCU。");
  } else {
    for (const item of report.devices) {
      lines.push(`### ${item.deviceCode} ${item.deviceName}`);
      lines.push(`- 负责人: ${item.owner}`);
      lines.push(`- 阻断原因: ${item.reasonLabels.join("、") || "--"}`);
      lines.push(`- 当前值: 温度 ${item.currentEvidence.zoneTemperatureC ?? "--"}°C，设定 ${item.currentEvidence.setpointC ?? "--"}°C，通讯报警 ${item.currentEvidence.communicationAlarm ?? "--"}`);
      lines.push(`- 今日动作: ${item.todayAction}`);
      lines.push(`- 回填字段: handledBy, handledAt, communicationAlarmAfter, zoneTemperatureAfterC, setpointFeedbackAfterC, writePointMappingChecked=yes, twoSampleNormal=yes, localManualLockout=none, releaseDecision=release, reviewedBy, reviewedAt`);
      lines.push("");
    }
  }
  lines.push("## 回传文件");
  lines.push("");
  lines.push(`- 现场签核输入表: ${report.outputFiles.signoffInputCsv || "--"}`);
  lines.push(`- current-only 输入表: ${report.outputFiles.currentOnlyCsv || "--"}`);
  lines.push(`- 过期行清单: ${report.outputFiles.staleCsv || "--"}`);
  lines.push("");
  lines.push("## 安全边界");
  lines.push("");
  for (const item of report.safetyBoundary) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "workOrderId",
    "deviceCode",
    "deviceName",
    "priority",
    "owner",
    "reasons",
    "currentZoneTemperatureC",
    "currentSetpointC",
    "currentCommunicationAlarm",
    "todayAction",
    "communicationAlarmAfter",
    "zoneTemperatureAfterC",
    "setpointFeedbackAfterC",
    "writePointMappingChecked",
    "twoSampleNormal",
    "localManualLockout",
    "releaseDecision",
    "reviewedBy"
  ];
  const rows = report.devices.map((item) => [
    item.workOrderId,
    item.deviceCode,
    item.deviceName,
    item.priority,
    item.owner,
    item.reasonLabels,
    item.currentEvidence.zoneTemperatureC,
    item.currentEvidence.setpointC,
    item.currentEvidence.communicationAlarm,
    item.todayAction,
    item.requiredReturnFields.communicationAlarmAfter,
    item.requiredReturnFields.zoneTemperatureAfterC,
    item.requiredReturnFields.setpointFeedbackAfterC,
    item.requiredReturnFields.writePointMappingChecked,
    item.requiredReturnFields.twoSampleNormal,
    item.requiredReturnFields.localManualLockout,
    item.requiredReturnFields.releaseDecision,
    item.requiredReturnFields.reviewedBy
  ]);
  return `${[header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
  ensureParentDir(OUTPUT_CSV);
  fs.writeFileSync(OUTPUT_CSV, renderCsv(report));
}

function main() {
  const inputs = {
    workOrders: readJsonFile(WORK_ORDERS_JSON),
    executionPack: readJsonFile(EXECUTION_PACK_JSON),
    signoffClean: readJsonFile(SIGNOFF_CLEAN_JSON),
    signoff: readJsonFile(SIGNOFF_JSON),
    runbook: readJsonFile(FINAL_RUNBOOK_JSON)
  };
  const report = buildReport(inputs);
  writeReport(report);
  console.log(
    `FCU_FIELD_HANDOFF_PACK ok=${report.ok} devices=${report.summary.totalWorkOrders} stale=${report.summary.staleSignoffRows} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  console.log(`csv=${OUTPUT_CSV}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
