import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const FINAL_WORKLIST_JSON =
  process.env.FCU_FINAL_CONTROL_WORKLIST_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-worklist-latest.json");
const FINAL_RUNBOOK_JSON =
  process.env.FCU_FINAL_CONTROL_RUNBOOK_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-runbook-latest.json");
const FIELD_HANDOFF_JSON =
  process.env.FCU_FIELD_HANDOFF_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-handoff-pack-latest.json");
const SIGNOFF_JSON =
  process.env.FCU_FIELD_REMEDIATION_SIGNOFF_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-signoff-latest.json");
const CANARY_READINESS_JSON =
  process.env.FCU_CANARY_READINESS_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-readiness-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-field-execution-pack-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-field-execution-pack-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV ||
  path.resolve(DOCS_DIR, "fcu-final-control-field-execution-pack-latest.csv");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
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

function findSignoffRecord(signoff, device) {
  const keys = [device.workOrderId, device.deviceCode, device.deviceName].map(normalizeText).filter(Boolean);
  const releaseRows = asArray(signoff.releaseMatrix);
  const openRows = asArray(signoff.openRecords);
  return (
    releaseRows.find((item) => keys.includes(normalizeText(item.workOrderId)) || keys.includes(normalizeText(item.deviceCode)) || keys.includes(normalizeText(item.deviceName))) ||
    openRows.find((item) => keys.includes(normalizeText(item.workOrderId)) || keys.includes(normalizeText(item.deviceCode)) || keys.includes(normalizeText(item.deviceName))) ||
    null
  );
}

function buildDeviceQueue(handoff, signoff) {
  return asArray(handoff.devices).map((device, index) => {
    const signoffRecord = findSignoffRecord(signoff, device) || {};
    const missingFields = asArray(signoffRecord.missingFields).length
      ? asArray(signoffRecord.missingFields)
      : asArray(signoffRecord.missingChecklist).map((item) => item.field || item.issue || "签核缺项").filter(Boolean);
    const reasonLabels = asArray(device.reasonLabels).length ? asArray(device.reasonLabels) : asArray(device.reasons);
    const canEnterCanary = signoffRecord.canEnterCanary === true;
    const signoffComplete = signoffRecord.signoffComplete === true;
    const onsiteCanaryCandidate = signoffRecord.onsiteCanaryCandidate === true || signoffComplete;
    return {
      sequence: index + 1,
      workOrderId: device.workOrderId || signoffRecord.workOrderId || "",
      deviceCode: device.deviceCode || signoffRecord.deviceCode || "",
      deviceName: device.deviceName || signoffRecord.deviceName || "",
      owner: device.owner || "BA/自控工程师",
      canEnterCanary,
      signoffComplete,
      onsiteCanaryCandidate,
      reasons: reasonLabels,
      missingFields,
      todayAction: device.todayAction || asArray(signoffRecord.nextActions)[0] || "按现场消缺作战表处理。",
      releaseCriteria: asArray(device.releaseCriteria).length ? asArray(device.releaseCriteria) : asArray(signoffRecord.releaseCriteria),
      requiredReturnFields: device.requiredReturnFields || {},
      canaryBlockReason: signoffRecord.canaryBlockReason || ""
    };
  });
}

function buildFinalReleaseChecklist(runbook, canaryReadiness, handoff, signoff) {
  const summary = runbook.summary || {};
  const signoffSummary = signoff.summary || {};
  const openP0Devices = handoff.summary?.openP0Devices ?? summary.openP0Devices ?? summary.blockedDeviceCount ?? 0;
  return [
    {
      key: "signoff",
      label: "现场签核",
      ok: signoffSummary.signoffComplete === true || summary.signoffCompleteRows === summary.signoffExpectedRows,
      detail: `${summary.signoffCompleteRows ?? signoffSummary.completeRows ?? 0}/${summary.signoffExpectedRows ?? signoffSummary.expectedWorkOrders ?? "--"}`,
      action: "全部当前工单 release 后重跑 signoff。"
    },
    {
      key: "closeout",
      label: "实时 closeout",
      ok: openP0Devices === 0,
      detail: `P0 ${openP0Devices} 台`,
      action: "关闭 P0 消缺并重跑 closeout。"
    },
    {
      key: "canary-readiness",
      label: "Canary readiness",
      ok: canaryReadiness.summary?.canaryReady === true || canaryReadiness.canaryReady === true,
      detail: canaryReadiness.verdict || "readiness 待读取",
      action: canaryReadiness.readinessPlaybook?.firstBlockedAction || "重跑 Canary readiness。"
    },
    {
      key: "final-gate",
      label: "最终总门禁",
      ok: summary.finalGatePassed === true,
      detail: `${summary.passedGates ?? 0}/${summary.gateCount ?? 8}`,
      action: "最终总门禁未全绿前禁止真实 BA 写入。"
    }
  ];
}

function buildReport(inputs) {
  const finalWorklist = inputs.finalWorklist.payload || {};
  const runbook = inputs.runbook.payload || {};
  const handoff = inputs.handoff.payload || {};
  const signoff = inputs.signoff.payload || {};
  const canaryReadiness = inputs.canaryReadiness.payload || {};
  const deviceQueue = buildDeviceQueue(handoff, signoff);
  const finalReleaseChecklist = buildFinalReleaseChecklist(runbook, canaryReadiness, handoff, signoff);
  const readyChecklistCount = finalReleaseChecklist.filter((item) => item.ok).length;
  const firstBlocker = finalReleaseChecklist.find((item) => !item.ok) || null;
  const openDevices = deviceQueue.filter((item) => item.canEnterCanary !== true);

  return {
    ok:
      inputs.finalWorklist.ok === true &&
      inputs.runbook.ok === true &&
      inputs.handoff.ok === true &&
      inputs.signoff.ok === true &&
      inputs.canaryReadiness.ok === true &&
      finalReleaseChecklist.every((item) => item.ok),
    generatedAt: new Date().toISOString(),
    scope: "fcu_final_control_field_execution_pack",
    siteId: runbook.siteId || finalWorklist.siteId || handoff.siteId || "126lnoffice",
    controlMutation: false,
    dispatch: false,
    summary: {
      totalDevices: deviceQueue.length,
      openDevices: openDevices.length,
      onsiteCanaryCandidateDevices: deviceQueue.filter((item) => item.onsiteCanaryCandidate === true).length,
      canaryReadyDevices: deviceQueue.filter((item) => item.canEnterCanary === true).length,
      signoffCompleteRows: runbook.summary?.signoffCompleteRows ?? signoff.summary?.completeRows ?? 0,
      signoffExpectedRows: runbook.summary?.signoffExpectedRows ?? signoff.summary?.expectedWorkOrders ?? deviceQueue.length,
      finalGatePassed: runbook.summary?.finalGatePassed === true,
      canaryReady: canaryReadiness.summary?.canaryReady === true || canaryReadiness.canaryReady === true,
      finalReleaseChecklistReady: readyChecklistCount,
      finalReleaseChecklistTotal: finalReleaseChecklist.length,
      firstBlocker: firstBlocker?.label || null,
      nextAction: firstBlocker?.action || "全部门禁通过后进入首台 Canary 执行窗口。"
    },
    sourceFiles: {
      finalWorklist: inputs.finalWorklist.path,
      runbook: inputs.runbook.path,
      handoff: inputs.handoff.path,
      signoff: inputs.signoff.path,
      canaryReadiness: inputs.canaryReadiness.path
    },
    outputFiles: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    },
    finalReleaseChecklist,
    deviceQueue,
    safetyBoundary: [
      "本现场执行包只用于最终控制投运前的现场签核和证据核对。",
      "本脚本不调用 control-cycle、control-command、Canary dispatch 或任何 BA/PLC 写入接口。",
      "deviceQueue 中 canEnterCanary=true 也不等于允许真实下发。",
      "必须由 3001 单台确认、后端总闸、审计和反馈回退共同放行。"
    ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制现场执行包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 结论: ${report.ok ? "最终放行前证据已齐" : "最终放行前仍阻断"}`);
  lines.push(`- 设备: ${report.summary.canaryReadyDevices}/${report.summary.totalDevices} 台可进 Canary`);
  lines.push(`- 签核: ${report.summary.signoffCompleteRows}/${report.summary.signoffExpectedRows}`);
  lines.push(`- 核对清单: ${report.summary.finalReleaseChecklistReady}/${report.summary.finalReleaseChecklistTotal}`);
  lines.push(`- 第一阻断: ${report.summary.firstBlocker || "无"}`);
  lines.push(`- 下一步: ${report.summary.nextAction}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push("");
  lines.push("## 最终放行前核对清单");
  lines.push("");
  for (const item of report.finalReleaseChecklist) {
    lines.push(`- ${item.label}: ${item.ok ? "通过" : "阻断"}；${item.detail}；${item.action}`);
  }
  lines.push("");
  lines.push("## 逐台现场执行队列");
  lines.push("");
  if (report.deviceQueue.length === 0) {
    lines.push("- 当前无待处理 FCU。");
  } else {
    for (const item of report.deviceQueue) {
      lines.push(`### ${item.sequence}. ${item.deviceCode || "--"} ${item.deviceName || ""}`);
      lines.push(`- 状态: ${item.canEnterCanary ? "可进 Canary" : item.onsiteCanaryCandidate ? "现场候选/后续门禁阻断" : item.signoffComplete ? "签核完成/后续阻断" : "待现场签核"}`);
      lines.push(`- 负责人: ${item.owner}`);
      lines.push(`- 阻断/缺项: ${(item.missingFields.length ? item.missingFields : item.reasons).join("、") || item.canaryBlockReason || "--"}`);
      lines.push(`- 现场动作: ${item.todayAction}`);
      lines.push(`- 放行标准: ${item.releaseCriteria.slice(0, 3).join("；") || "--"}`);
      lines.push("");
    }
  }
  lines.push("## 安全边界");
  lines.push("");
  for (const item of report.safetyBoundary) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "sequence",
    "workOrderId",
    "deviceCode",
    "deviceName",
    "owner",
    "status",
    "onsiteCanaryCandidate",
    "missingFields",
    "reasons",
    "todayAction",
    "releaseCriteria",
    "canaryBlockReason"
  ];
  const rows = report.deviceQueue.map((item) => [
    item.sequence,
    item.workOrderId,
    item.deviceCode,
    item.deviceName,
    item.owner,
    item.canEnterCanary ? "can_enter_canary" : item.onsiteCanaryCandidate ? "onsite_candidate_blocked" : item.signoffComplete ? "signed_blocked" : "needs_signoff",
    item.onsiteCanaryCandidate,
    item.missingFields,
    item.reasons,
    item.todayAction,
    item.releaseCriteria,
    item.canaryBlockReason
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
    finalWorklist: readJsonFile(FINAL_WORKLIST_JSON),
    runbook: readJsonFile(FINAL_RUNBOOK_JSON),
    handoff: readJsonFile(FIELD_HANDOFF_JSON),
    signoff: readJsonFile(SIGNOFF_JSON),
    canaryReadiness: readJsonFile(CANARY_READINESS_JSON)
  };
  const report = buildReport(inputs);
  writeReport(report);
  console.log(
    `FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK ok=${report.ok} devices=${report.summary.totalDevices} checklist=${report.summary.finalReleaseChecklistReady}/${report.summary.finalReleaseChecklistTotal} mutation=false dispatch=false`
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
