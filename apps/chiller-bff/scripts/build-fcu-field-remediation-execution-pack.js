import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const WORK_ORDERS_JSON =
  process.env.FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-work-orders-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-execution-pack-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-execution-pack-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV ||
  path.resolve(DOCS_DIR, "fcu-field-remediation-execution-pack-latest.csv");

const REASON_META = {
  communication_alarm: {
    phase: "restore_communication",
    owner: "BA/自控工程师",
    action: "复检 FCU 控制器供电、通讯链路、网关轮询和报警复位；确认通讯报警点复位为 0。",
    acceptance: "communicationAlarmAfter=0，且连续两次 BA 采样无通讯报警。"
  },
  zero_temperature: {
    phase: "restore_temperature",
    owner: "BA/自控工程师",
    action: "核对区域温度点位来源、量程和绑定房间，修复 0°C 异常值。",
    acceptance: "zoneTemperatureAfterC 在 5-45°C，且不再为 0。"
  },
  invalid_temperature: {
    phase: "restore_temperature",
    owner: "BA/自控工程师",
    action: "核对温度点位量程、数据类型、缩放系数和上位机映射。",
    acceptance: "zoneTemperatureAfterC 在 5-45°C。"
  },
  temperature_quality_guard: {
    phase: "restore_temperature",
    owner: "BA/自控工程师",
    action: "确认温度质量标记恢复，异常温度不再参与闭环判断。",
    acceptance: "连续两次采样温度有效，qualityStatus 不再为 invalid。"
  },
  setpoint_feedback_out_of_bounds: {
    phase: "normalize_setpoint_feedback",
    owner: "平台工程师 + BA工程师",
    action: "核对设定反馈点位和当前设定值；必要时先人工归一到 10-32°C 范围，再允许进入闭环。",
    acceptance: "setpointFeedbackAfterC 留空或在 10-32°C，且与现场面板显示一致。"
  },
  evidence_incomplete: {
    phase: "restore_evidence",
    owner: "现场值班 + 平台工程师",
    action: "恢复 FCU 快照、commissioning 状态、全量分批计划和 closeout 证据后重跑清单。",
    acceptance: "evidenceIncomplete=false，quality.ok=true。"
  }
};

const PHASE_ORDER = [
  "restore_evidence",
  "restore_communication",
  "restore_temperature",
  "normalize_setpoint_feedback",
  "verify_write_mapping",
  "two_sample_validation",
  "onsite_signoff",
  "rerun_closeout"
];

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  return String(value).trim();
}

function uniq(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean))];
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

function reasonMeta(reason) {
  return REASON_META[reason] || {
    phase: "verify_write_mapping",
    owner: "平台工程师 + BA工程师",
    action: `复核 ${reason} 对应的点位、白名单和现场状态。`,
    acceptance: "对应阻断原因消失，且不会产生未授权写入。"
  };
}

function buildDeviceTask(workOrder) {
  const reasons = uniq(workOrder.currentEvidence?.reasons || []);
  const reasonTasks = reasons.map((reason) => ({ reason, ...reasonMeta(reason) }));
  const phases = uniq([
    ...reasonTasks.map((item) => item.phase),
    "verify_write_mapping",
    "two_sample_validation",
    "onsite_signoff",
    "rerun_closeout"
  ]).sort((left, right) => PHASE_ORDER.indexOf(left) - PHASE_ORDER.indexOf(right));
  const owners = uniq([
    normalizeText(workOrder.owner),
    ...reasonTasks.map((item) => item.owner),
    "现场值班",
    "平台工程师"
  ]);
  const actions = uniq([
    ...reasonTasks.map((item) => item.action),
    "逐台核对启停、设定、风速写点映射和 writable 标记，但本执行包不触发写入。",
    "连续两次采样确认通讯、温度、设定反馈、就地/手动状态均正常。",
    "补齐处理人、处理时间、复核人、复核时间和 releaseDecision 后重跑签字校验。",
    "重跑质量整改、全量分批计划、现场 closeout 和 Canary readiness。"
  ]);
  const acceptance = uniq([
    ...reasonTasks.map((item) => item.acceptance),
    ...(workOrder.releaseCriteria || []),
    "writePointMappingChecked=yes",
    "twoSampleNormal=yes",
    "localManualLockout=none",
    "releaseDecision=release",
    "重跑 closeout 后该设备不再出现在 P0 remainingDevices 中。"
  ]);
  return {
    workOrderId: workOrder.workOrderId,
    priority: workOrder.priority || "P0",
    deviceCode: workOrder.deviceCode,
    deviceName: workOrder.deviceName,
    owner: owners.join(" / "),
    phases,
    reasons,
    currentEvidence: workOrder.currentEvidence || {},
    actions,
    acceptance,
    signoffFields: {
      handledBy: "必填",
      handledAt: "必填",
      communicationAlarmAfter: workOrder.fieldVerification?.communicationAlarmAfter || "按需",
      zoneTemperatureAfterC: workOrder.fieldVerification?.zoneTemperatureAfterC || "按需",
      setpointFeedbackAfterC: workOrder.fieldVerification?.setpointFeedbackAfterC || "按需",
      writePointMappingChecked: "yes",
      twoSampleNormal: "yes",
      localManualLockout: "none",
      releaseDecision: "release",
      reviewedBy: "必填",
      reviewedAt: "必填"
    }
  };
}

function buildPhaseSummary(deviceTasks) {
  return PHASE_ORDER.map((phase) => {
    const devices = deviceTasks.filter((item) => item.phases.includes(phase));
    return {
      phase,
      deviceCount: devices.length,
      deviceCodes: devices.map((item) => item.deviceCode),
      owners: uniq(devices.flatMap((item) => item.owner.split(" / "))),
      acceptance:
        phase === "restore_communication"
          ? "通讯报警为 0，连续两次采样正常。"
          : phase === "restore_temperature"
            ? "温度在 5-45°C，0°C/越界温度消失。"
            : phase === "normalize_setpoint_feedback"
              ? "设定反馈留空或在 10-32°C，并与现场面板一致。"
              : phase === "verify_write_mapping"
                ? "写点映射核对完成，本包不产生写入。"
                : phase === "two_sample_validation"
                  ? "连续两次 BA 采样均正常。"
                  : phase === "onsite_signoff"
                    ? "处理和复核签字完整，releaseDecision=release。"
                    : phase === "rerun_closeout"
                      ? "重跑证据链后 closeout/canary readiness 不再被现场 P0 卡住。"
                      : "证据链恢复。"
    };
  }).filter((item) => item.deviceCount > 0);
}

function buildReport(workOrdersResult) {
  const source = workOrdersResult.payload || {};
  const workOrders = Array.isArray(source.workOrders) ? source.workOrders : [];
  const deviceTasks = workOrders.map(buildDeviceTask);
  const blockedByReason = {};
  for (const task of deviceTasks) {
    for (const reason of task.reasons) {
      if (!blockedByReason[reason]) {
        blockedByReason[reason] = [];
      }
      blockedByReason[reason].push(task.deviceCode);
    }
  }
  return {
    ok: workOrdersResult.ok === true && source.ok === true && deviceTasks.length === 0,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_execution_pack",
    siteId: normalizeText(source.siteId) || "126lnoffice",
    build: normalizeText(source.build) || "1",
    floor: normalizeText(source.floor) || "1",
    controlMutation: false,
    dispatch: false,
    sourceWorkOrders: {
      path: workOrdersResult.path,
      ok: source.ok === true,
      error: workOrdersResult.error || null
    },
    summary: {
      totalDevices: deviceTasks.length,
      openP0Devices: deviceTasks.filter((item) => item.priority === "P0").length,
      canEnterCanaryAfterExecutionPack: source.summary?.readyForCanaryAfterCloseout === true && deviceTasks.length === 0,
      requiresOnsiteExecution: deviceTasks.length > 0,
      reasonCounts: Object.fromEntries(Object.entries(blockedByReason).map(([reason, devices]) => [reason, devices.length]))
    },
    outputs: {
      json: OUTPUT_JSON,
      markdown: OUTPUT_MD,
      csv: OUTPUT_CSV
    },
    executionOrder: buildPhaseSummary(deviceTasks),
    blockedByReason,
    deviceTasks
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 现场消缺执行包");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 待处理 P0 设备: ${report.summary.openP0Devices}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 执行顺序");
  lines.push("");
  for (const phase of report.executionOrder) {
    lines.push(`- ${phase.phase}: ${phase.deviceCount} 台 (${phase.deviceCodes.join("、")})；负责人: ${phase.owners.join(" / ") || "--"}；验收: ${phase.acceptance}`);
  }
  lines.push("");
  lines.push("## 按原因分组");
  lines.push("");
  for (const [reason, devices] of Object.entries(report.blockedByReason)) {
    lines.push(`- ${reason}: ${devices.join("、")}`);
  }
  lines.push("");
  lines.push("## 逐台执行");
  lines.push("");
  for (const task of report.deviceTasks) {
    lines.push(`### ${task.deviceCode} ${task.deviceName}`);
    lines.push(`- 负责人: ${task.owner}`);
    lines.push(`- 当前值: 温度 ${task.currentEvidence.zoneTemperatureC ?? "--"}°C，设定 ${task.currentEvidence.setpointC ?? "--"}°C，通讯报警 ${task.currentEvidence.communicationAlarm ?? "--"}`);
    lines.push(`- 阻断原因: ${task.reasons.join("；") || "--"}`);
    lines.push("- 现场动作:");
    for (const action of task.actions) {
      lines.push(`  - ${action}`);
    }
    lines.push("- 放行口径:");
    for (const item of task.acceptance) {
      lines.push(`  - ${item}`);
    }
    lines.push(`- 签字字段: 通讯=${task.signoffFields.communicationAlarmAfter}，温度=${task.signoffFields.zoneTemperatureAfterC}，设定反馈=${task.signoffFields.setpointFeedbackAfterC}，写点=${task.signoffFields.writePointMappingChecked}，连续采样=${task.signoffFields.twoSampleNormal}，就地锁定=${task.signoffFields.localManualLockout}`);
    lines.push("");
  }
  lines.push("## 边界");
  lines.push("");
  lines.push("- 本执行包只指导现场消缺、复检和签字，不下发 BA/PLC。");
  lines.push("- 即使全部签字完成，也必须重跑质量整改、全量分批计划、closeout、Canary readiness。");
  lines.push("- 首台 Canary 反馈确认前，不允许扩大到小批量或全量。");
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "deviceCode",
    "deviceName",
    "priority",
    "owner",
    "phases",
    "reasons",
    "currentZoneTemperatureC",
    "currentSetpointC",
    "currentCommunicationAlarm",
    "actions",
    "acceptance",
    "communicationAlarmAfter",
    "zoneTemperatureAfterC",
    "setpointFeedbackAfterC",
    "writePointMappingChecked",
    "twoSampleNormal",
    "localManualLockout",
    "releaseDecision"
  ];
  const rows = report.deviceTasks.map((task) => [
    task.deviceCode,
    task.deviceName,
    task.priority,
    task.owner,
    task.phases,
    task.reasons,
    task.currentEvidence.zoneTemperatureC,
    task.currentEvidence.setpointC,
    task.currentEvidence.communicationAlarm,
    task.actions,
    task.acceptance,
    task.signoffFields.communicationAlarmAfter,
    task.signoffFields.zoneTemperatureAfterC,
    task.signoffFields.setpointFeedbackAfterC,
    task.signoffFields.writePointMappingChecked,
    task.signoffFields.twoSampleNormal,
    task.signoffFields.localManualLockout,
    task.signoffFields.releaseDecision
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
  const workOrdersResult = readJsonFile(WORK_ORDERS_JSON);
  const report = buildReport(workOrdersResult);
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_EXECUTION_PACK ok=${report.ok} devices=${report.summary.totalDevices} p0=${report.summary.openP0Devices} mutation=false`
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
