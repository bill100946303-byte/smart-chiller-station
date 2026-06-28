import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const QUALITY_REMEDIATION_JSON =
  process.env.FCU_QUALITY_REMEDIATION_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-quality-remediation-latest.json");
const ALL_DEVICE_PLAN_JSON =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-closeout-latest.json");
const OUTPUT_MD =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_MD ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-closeout-latest.md");
const OUTPUT_CSV =
  process.env.FCU_FIELD_REMEDIATION_CLOSEOUT_CSV ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-field-remediation-closeout-latest.csv");
const INTERNAL_REASON_EXCLUDES = new Set([
  "communication_ok",
  "temperature_valid",
  "setpoint_feedback_valid",
  "global_execution_gate",
  "backend_write_gate",
  "read_only_mode"
]);

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function uniq(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean))];
}

function publicReasons(items) {
  return uniq(items).filter((reason) => !INTERNAL_REASON_EXCLUDES.has(reason));
}

function normalizeCloseoutDevice(device, fallback = {}) {
  const deviceCode = normalizeText(device.deviceCode || fallback.deviceCode);
  const deviceName = normalizeText(device.deviceName || fallback.deviceName);
  const reasons = publicReasons([...(device.reasons || []), ...(device.blockedReasons || []), ...(fallback.reasons || [])]);
  return {
    priority: normalizeText(device.severity || fallback.priority) || "P0",
    deviceCode,
    deviceName,
    status: normalizeText(device.status || fallback.status) || "blocked",
    zoneTemperatureC: device.zoneTemperatureC ?? fallback.zoneTemperatureC ?? null,
    setpointC: device.setpointC ?? fallback.setpointC ?? null,
    communicationAlarm: device.communicationAlarm ?? fallback.communicationAlarm ?? null,
    qualityStatus: normalizeText(device.qualityStatus || fallback.qualityStatus) || null,
    reasons,
    fieldActions: uniq(device.fieldActions || fallback.fieldActions || []),
    releaseCriteria: uniq(device.releaseCriteria || fallback.releaseCriteria || [])
  };
}

function buildFallbackAction(device) {
  const reasons = uniq(device.blockedReasons || device.reasons || []);
  if (reasons.some((reason) => reason.includes("communication"))) {
    return "现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。";
  }
  if (reasons.some((reason) => reason.includes("temperature"))) {
    return "复核区域温度点、0°C 原始值和温度有效范围，异常温度禁止进入闭环。";
  }
  return "按 commissioning 阻断原因完成现场核查，整改后重跑质量整改和全量分批计划。";
}

function buildFallbackReleaseCriteria(device) {
  const criteria = ["quality.status=ok", "communicationAlarm=0", "zoneTemperatureC 在 5-45°C", "连续两次采样保持正常"];
  if ((device.blockedReasons || []).some((reason) => String(reason).includes("writable"))) {
    criteria.push("启停、设定、风速写点均已映射且 writable=true");
  }
  return criteria;
}

function collectRemainingDevices(quality, plan, evidenceIncomplete) {
  const devicesByCode = new Map();
  for (const item of Array.isArray(quality.devices) ? quality.devices : []) {
    if (normalizeText(item.severity) !== "P0") {
      continue;
    }
    const device = normalizeCloseoutDevice(item);
    if (device.deviceCode) {
      devicesByCode.set(device.deviceCode, device);
    }
  }

  const planBlockedDevices = Array.isArray(plan.blockedDevices) ? plan.blockedDevices : [];
  for (const item of planBlockedDevices) {
    const deviceCode = normalizeText(item.deviceCode);
    if (!deviceCode) {
      continue;
    }
    const existing = devicesByCode.get(deviceCode);
    if (existing) {
      continue;
    }
    const fallback = {
      priority: "P0",
      status: item.status,
      deviceCode,
      deviceName: item.deviceName,
      zoneTemperatureC: item.zoneTemperatureC,
      setpointC: item.setpointC,
      communicationAlarm: item.communicationAlarm,
      qualityStatus: item.qualityStatus,
      reasons: item.blockedReasons,
      fieldActions: [buildFallbackAction(item)],
      releaseCriteria: buildFallbackReleaseCriteria(item)
    };
    devicesByCode.set(deviceCode, normalizeCloseoutDevice(existing || {}, fallback));
  }

  if (devicesByCode.size === 0 && evidenceIncomplete) {
    devicesByCode.set("EVIDENCE_INCOMPLETE", {
      priority: "P0",
      deviceCode: "EVIDENCE_INCOMPLETE",
      deviceName: "证据缺失",
      status: "blocked",
      zoneTemperatureC: null,
      setpointC: null,
      communicationAlarm: null,
      qualityStatus: "unknown",
      reasons: ["evidence_incomplete"],
      fieldActions: ["恢复 FCU 快照、commissioning 状态和全量分批计划证据后重跑关闭检查。"],
      releaseCriteria: ["quality.ok=true", "evidenceIncomplete=false", "计划 blocked=0"]
    });
  }

  return [...devicesByCode.values()].sort((a, b) => a.deviceCode.localeCompare(b.deviceCode));
}

function buildReport({ qualityResult, planResult }) {
  const quality = qualityResult.payload || {};
  const plan = planResult.payload || {};
  const qualitySummary = quality.summary || {};
  const planSummary = plan.summary || {};
  const evidenceIncomplete =
    qualityResult.ok !== true ||
    planResult.ok !== true ||
    quality.ok !== true ||
    qualitySummary.evidenceIncomplete === true;
  const remainingDevices = collectRemainingDevices(quality, plan, evidenceIncomplete);
  const qualityP0Count = Math.max(
    finiteNumber(qualitySummary.p0Count),
    remainingDevices.filter((device) => device.priority === "P0").length,
    evidenceIncomplete ? 1 : 0
  );
  const planBlockedCount = Math.max(finiteNumber(planSummary.blocked), finiteNumber(planSummary.deviceBlocked));
  const plannedDeviceCount = Math.max(
    finiteNumber(planSummary.plannedDeviceCount),
    finiteNumber(planSummary.deviceReady),
    finiteNumber(planSummary.immediateReady) + finiteNumber(planSummary.stagedSetpoint)
  );
  const qualityClosed =
    !evidenceIncomplete &&
    qualityP0Count === 0 &&
    qualitySummary.canCompleteFinalControl === true &&
    remainingDevices.length === 0;
  const planReady = planResult.ok === true && plan.ok === true && planBlockedCount === 0 && plannedDeviceCount > 0;
  const readyForCanary = qualityClosed && planReady;
  const verdict = evidenceIncomplete
    ? "field_remediation_evidence_incomplete"
    : readyForCanary
      ? "field_remediation_ready_for_canary"
      : "field_remediation_open";

  return {
    ok: readyForCanary,
    generatedAt: new Date().toISOString(),
    scope: "fcu_field_remediation_closeout",
    siteId: normalizeText(quality.siteId || plan.siteId) || "126lnoffice",
    build: normalizeText(quality.build || plan.build) || "1",
    floor: normalizeText(quality.floor || plan.floor) || "1",
    verdict,
    controlMutation: false,
    dispatch: false,
    summary: {
      qualityClosed,
      planReady,
      readyForCanary,
      evidenceIncomplete,
      remainingDeviceCount: remainingDevices.length,
      qualityP0Count,
      planBlockedCount,
      plannedDeviceCount,
      firstCanary: plan.firstCanary || null
    },
    remainingDevices,
    releaseGate: {
      canProceedToCanary: readyForCanary,
      requiredBeforeCanary: readyForCanary
        ? []
        : [
            qualityClosed ? null : "关闭所有 P0 现场消缺项",
            planReady ? null : "全量分批计划 blocked=0 且存在 plannedDeviceCount"
          ].filter(Boolean)
    },
    evidence: {
      qualityRemediation: {
        ok: qualityResult.ok,
        path: qualityResult.path,
        reportOk: quality.ok === true,
        error: qualityResult.error || null
      },
      allDevicePlan: {
        ok: planResult.ok,
        path: planResult.path,
        reportOk: plan.ok === true,
        error: planResult.error || null
      }
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
  lines.push("# FCU 现场消缺关闭检查");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 结论: ${report.summary.readyForCanary ? "可进入首台 Canary" : "现场消缺未关闭"}`);
  lines.push(`- 判定: ${report.verdict}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- P0 设备: ${report.summary.qualityP0Count}`);
  lines.push(`- 计划阻断: ${report.summary.planBlockedCount}`);
  lines.push(`- 已规划设备: ${report.summary.plannedDeviceCount}`);
  lines.push(`- 首台 Canary: ${report.summary.firstCanary || "--"}`);
  lines.push(`- 证据不完整: ${report.summary.evidenceIncomplete ? "是" : "否"}`);
  lines.push("");
  if (report.releaseGate.requiredBeforeCanary.length > 0) {
    lines.push("## Canary 前置项");
    lines.push("");
    for (const item of report.releaseGate.requiredBeforeCanary) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }
  if (report.remainingDevices.length > 0) {
    lines.push("## 未关闭设备");
    lines.push("");
    lines.push("| 优先级 | 设备 | 名称 | 状态 | 温度 | 通讯报警 | 原因 |");
    lines.push("|---|---|---|---|---:|---|---|");
    for (const device of report.remainingDevices) {
      lines.push(
        `| ${device.priority} | ${device.deviceCode} | ${device.deviceName || "--"} | ${device.status} | ${device.zoneTemperatureC ?? "--"} | ${device.communicationAlarm ?? "--"} | ${device.reasons.join(", ") || "--"} |`
      );
    }
    lines.push("");
    lines.push("## 现场动作");
    lines.push("");
    for (const device of report.remainingDevices) {
      lines.push(`### ${device.deviceCode} ${device.deviceName || ""}`.trim());
      for (const action of device.fieldActions) {
        lines.push(`- ${action}`);
      }
      if (device.releaseCriteria.length > 0) {
        lines.push(`- 放行标准: ${device.releaseCriteria.join("；")}。`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderCsv(report) {
  const header = [
    "priority",
    "deviceCode",
    "deviceName",
    "status",
    "zoneTemperatureC",
    "setpointC",
    "communicationAlarm",
    "qualityStatus",
    "reasons",
    "fieldActions",
    "releaseCriteria"
  ];
  const rows = report.remainingDevices.map((device) => [
    device.priority,
    device.deviceCode,
    device.deviceName,
    device.status,
    device.zoneTemperatureC,
    device.setpointC,
    device.communicationAlarm,
    device.qualityStatus,
    device.reasons,
    device.fieldActions,
    device.releaseCriteria
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
  const report = buildReport({
    qualityResult: readJsonFile(QUALITY_REMEDIATION_JSON),
    planResult: readJsonFile(ALL_DEVICE_PLAN_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_FIELD_REMEDIATION_CLOSEOUT ok=${report.ok} verdict=${report.verdict} p0=${report.summary.qualityP0Count} blocked=${report.summary.planBlockedCount} readyForCanary=${report.summary.readyForCanary} mutation=false`
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
