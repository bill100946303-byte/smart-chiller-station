import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BUILD = normalizeText(process.env.FCU_BUILD) || "1";
const FLOOR = normalizeText(process.env.FCU_FLOOR) || "1";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_QUALITY_REMEDIATION_TIMEOUT_MS, 20000);
const OUTPUT_JSON =
  process.env.FCU_QUALITY_REMEDIATION_JSON ||
  path.join(DOCS_DIR, "fcu-quality-remediation-latest.json");
const OUTPUT_MD =
  process.env.FCU_QUALITY_REMEDIATION_MD ||
  path.join(DOCS_DIR, "fcu-quality-remediation-latest.md");
const OUTPUT_CSV =
  process.env.FCU_QUALITY_REMEDIATION_CSV ||
  path.join(DOCS_DIR, "fcu-quality-remediation-latest.csv");

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      parseError: true,
      error: error instanceof Error ? error.message : "json parse failed",
      raw: text.slice(0, 500)
    };
  }
}

function requestJson(routePath) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        timeout: REQUEST_TIMEOUT_MS
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            url: target.toString(),
            payload: parseJsonSafely(raw)
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        url: target.toString(),
        error: error instanceof Error ? error.message : "request failed"
      });
    });
    req.end();
  });
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

function pointSummary(point) {
  if (!point) {
    return null;
  }
  return {
    pointName: point.pointName || point.label || null,
    tagName: point.tagName || null,
    value: point.value ?? null,
    numericValue: point.numericValue ?? null,
    unit: point.unit ?? null,
    writable: point.writable === true,
    writeAllowed: point.writeAllowed === true,
    alarmActive: point.alarmActive === true,
    rawTagTime: point.rawTagTime ?? null
  };
}

function isValidZoneTemperature(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 5 && numeric <= 45;
}

function hasTemperatureQualityBlock(item) {
  const flags = item.quality?.flags || [];
  return (
    flags.includes("missing_temperature") ||
    flags.includes("zero_temperature") ||
    flags.includes("invalid_temperature") ||
    item.zoneTemperatureC === 0 ||
    !isValidZoneTemperature(item.zoneTemperatureC)
  );
}

function severityFor(item) {
  const flags = item.quality?.flags || [];
  const commissioningReasons = item.commissioningItem?.blockedReasons || [];
  const hasSetpointFeedbackBlock = commissioningReasons.includes("setpoint_feedback_valid");
  const hasHardQualityBlock =
    flags.includes("missing_temperature") ||
    (commissioningReasons.includes("temperature_valid") && hasTemperatureQualityBlock(item)) ||
    item.communicationAlarm === true ||
    flags.includes("zero_temperature") ||
    flags.includes("invalid_temperature") ||
    item.zoneTemperatureC === 0 ||
    !isValidZoneTemperature(item.zoneTemperatureC);
  const hasWritableBlock = commissioningReasons.some((reason) =>
    ["start_writable", "stop_writable", "setpoint_writable", "fan_speed_writable"].includes(reason)
  );
  if (hasSetpointFeedbackBlock && !hasHardQualityBlock && !hasWritableBlock) {
    return "P1";
  }
  if (
    flags.includes("missing_temperature") ||
    (commissioningReasons.includes("temperature_valid") && hasTemperatureQualityBlock(item)) ||
    commissioningReasons.includes("setpoint_feedback_valid") ||
    commissioningReasons.includes("start_writable") ||
    commissioningReasons.includes("stop_writable") ||
    commissioningReasons.includes("setpoint_writable") ||
    commissioningReasons.includes("fan_speed_writable")
  ) {
    return "P0";
  }
  if (item.communicationAlarm && (flags.includes("zero_temperature") || item.zoneTemperatureC === 0)) {
    return "P0";
  }
  if (item.communicationAlarm) {
    return "P0";
  }
  if (flags.includes("invalid_temperature") || item.zoneTemperatureC === 0) {
    return "P0";
  }
  return "P1";
}

function buildReasons(item) {
  const reasons = [];
  if (item.communicationAlarm) {
    reasons.push("communication_alarm");
  }
  if (item.zoneTemperatureC === 0) {
    reasons.push("zero_temperature");
  }
  for (const flag of item.quality?.flags || []) {
    if (!reasons.includes(flag)) {
      reasons.push(flag);
    }
  }
  for (const reason of item.commissioningItem?.blockedReasons || []) {
    const shouldKeepReason =
      ["start_writable", "stop_writable", "setpoint_writable", "fan_speed_writable"].includes(reason) ||
      (reason === "temperature_valid" && hasTemperatureQualityBlock(item)) ||
      reason === "setpoint_feedback_valid";
    if (shouldKeepReason && !reasons.includes(reason)) {
      if (reason === "temperature_valid") {
        reasons.push("temperature_quality_guard");
      } else if (reason === "setpoint_feedback_valid") {
        reasons.push("setpoint_feedback_out_of_bounds");
      } else {
        reasons.push(reason);
      }
    }
  }
  return reasons.filter((item) => item !== "stopped");
}

function buildFieldActions(item) {
  const actions = [];
  if (item.communicationAlarm) {
    actions.push("现场确认 FCU 控制器供电、通讯线、地址、网关轮询和 BA 通讯报警复位。");
    actions.push(`核对通讯报警点 ${item.points?.communicationAlarm?.tagName || "--"} 是否仍为 1。`);
  }
  if (item.zoneTemperatureC === 0 || item.quality?.flags?.includes("zero_temperature")) {
    actions.push(`核对内置温度点 ${item.points?.zoneTemperature?.tagName || "--"}，0°C 不允许进入闭环。`);
  }
  if (item.quality?.flags?.includes("invalid_temperature") && item.zoneTemperatureC !== 0) {
    actions.push("复核温度有效范围、通讯报警联动规则和 BA 原始值，确认不是误报。");
  }
  if (
    item.quality?.flags?.includes("missing_temperature") ||
    (item.commissioningItem?.blockedReasons?.includes("temperature_valid") && hasTemperatureQualityBlock(item))
  ) {
    actions.push(`补齐或修复区域温度点 ${item.points?.zoneTemperature?.tagName || "--"}，缺温度时禁止进入闭环。`);
  }
  const writableActions = [
    ["start_writable", "启动写点"],
    ["stop_writable", "停止写点"],
    ["setpoint_writable", "设定写点"],
    ["fan_speed_writable", "风速写点"]
  ].filter(([reason]) => item.commissioningItem?.blockedReasons?.includes(reason));
  for (const [, label] of writableActions) {
    actions.push(`补齐 ${label} 的 BA 写入映射、白名单和反馈校验，未确认前只允许预演。`);
  }
  if (
    item.commissioningItem?.blockedReasons?.includes("setpoint_feedback_valid") ||
    Number(item.setpointFeedbackC ?? item.setpointC) >= 32 ||
    Number(item.setpointFeedbackC ?? item.setpointC) <= 10
  ) {
    actions.push(`复核设定反馈点 ${item.points?.setpointFeedback?.tagName || "--"}，超出策略边界时禁止自动闭环，需人工确认后分步拉回。`);
  }
  return actions;
}

function buildReleaseCriteria(item) {
  const criteria = [
    "communicationAlarm=0",
    "zoneTemperatureC 在 5-45°C",
    "setpointFeedbackC 在策略允许范围内",
    "启停、设定、风速写点均已映射且 writable=true",
    "quality.status=ok",
    "连续两次采样保持正常",
    "未处于本地手动/禁控/回退锁定"
  ];
  if (item.zoneTemperatureC === 0) {
    criteria.push("0°C 原始点恢复为有效温度");
  }
  return criteria;
}

function buildRemediationItem(item, commissioningItem = null) {
  const itemWithCommissioning = {
    ...item,
    commissioningItem
  };
  const reasons = buildReasons(itemWithCommissioning);
  return {
    deviceCode: item.deviceCode,
    deviceName: item.deviceName,
    severity: severityFor(itemWithCommissioning),
    status: commissioningItem?.status || "blocked",
    zoneTemperatureC: item.zoneTemperatureC ?? null,
    setpointC: item.setpointFeedbackC ?? item.setpointC ?? null,
    running: item.running ?? null,
    communicationAlarm: item.communicationAlarm === true,
    qualityStatus: item.quality?.status || null,
    reasons,
    controlBlockReasons: commissioningItem?.controlBlockReasons || [],
    blockedReasons: commissioningItem?.blockedReasons || [],
    points: {
      communicationAlarm: pointSummary(item.points?.communicationAlarm),
      zoneTemperature: pointSummary(item.points?.zoneTemperature),
      setpointFeedback: pointSummary(item.points?.setpointFeedback),
      run: pointSummary(item.points?.run)
    },
    fieldActions: buildFieldActions(itemWithCommissioning),
    releaseCriteria: buildReleaseCriteria(itemWithCommissioning)
  };
}

function buildReport({ snapshotResponse, commissioningResponse }) {
  const snapshot = snapshotResponse.payload || {};
  const commissioningItems = new Map(
    (commissioningResponse.payload?.items || []).map((item) => [
      normalizeText(item?.device?.deviceCode || item?.device?.deviceId || item?.device?.deviceName),
      item
    ])
  );
  const allItems = Array.isArray(snapshot.items) ? snapshot.items : [];
  const remediationItems = allItems
    .map((item) => {
      const commissioningItem = commissioningItems.get(normalizeText(item.deviceCode));
      return {
        item,
        commissioningItem,
        reasons: buildReasons({
          ...item,
          commissioningItem
        })
      };
    })
    .filter(({ item, reasons }) => item.communicationAlarm === true || item.quality?.status === "invalid" || item.zoneTemperatureC === 0 || reasons.length > 0)
    .map(({ item, commissioningItem }) => buildRemediationItem(item, commissioningItem));
  const p0Items = remediationItems.filter((item) => item.severity === "P0");
  const evidenceIncomplete = snapshotResponse.ok !== true || commissioningResponse.ok !== true;
  const fallbackBlockedCount =
    Number(commissioningResponse.payload?.summary?.deviceBlocked) ||
    Number(commissioningResponse.payload?.summary?.blocked) ||
    Number(commissioningResponse.payload?.summary?.total) ||
    0;
  const conservativeP0Count = evidenceIncomplete ? Math.max(p0Items.length, fallbackBlockedCount, 1) : p0Items.length;
  const conservativeRemediationCount = evidenceIncomplete
    ? Math.max(remediationItems.length, fallbackBlockedCount, 1)
    : remediationItems.length;
  const reasonCounts = new Map();
  for (const item of remediationItems) {
    for (const reason of item.reasons.length ? item.reasons : ["unknown"]) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }
  return {
    ok: snapshotResponse.ok === true && commissioningResponse.ok === true,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    build: BUILD,
    floor: FLOOR,
    bffBaseUrl: BFF_BASE_URL,
    controlMutation: false,
    dispatch: false,
    summary: {
      total: snapshot.summary?.total ?? allItems.length,
      remediationCount: conservativeRemediationCount,
      p0Count: conservativeP0Count,
      canCompleteFinalControl: evidenceIncomplete ? false : remediationItems.length === 0,
      evidenceIncomplete,
      communicationAlarmCount: snapshot.summary?.communicationAlarmCount ?? null,
      zeroTemperatureCount: snapshot.summary?.zeroTemperatureCount ?? null,
      invalidTemperatureCount: snapshot.summary?.invalidTemperatureCount ?? null
    },
    fieldPackage: {
      csv: OUTPUT_CSV,
      markdown: OUTPUT_MD,
      json: OUTPUT_JSON
    },
    reasonCounts: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })),
    devices: remediationItems,
    nextActions: [
      {
        priority: "P0",
        action: "逐台处理通讯报警、0°C/无效温度和写点映射",
        target: evidenceIncomplete ? `至少 ${conservativeP0Count} 台或证据缺失` : `${p0Items.length} 台`,
        reason: evidenceIncomplete
          ? "质量证据不完整时禁止进入全量自动闭环，必须先恢复快照/commissioning 证据。"
          : "未恢复前禁止进入全量自动闭环。"
      },
      {
        priority: "P0",
        action: "整改后重跑全量分批计划",
        target: "plan:fcu-all-device-dispatch",
        reason: "确认阻断设备进入 deviceReady 后再扩大投运。"
      }
    ],
    evidence: {
      snapshot: {
        ok: snapshotResponse.ok,
        status: snapshotResponse.status,
        url: snapshotResponse.url,
        dataStatus: snapshot.summary?.dataStatus || null
      },
      commissioning: {
        ok: commissioningResponse.ok,
        status: commissioningResponse.status,
        url: commissioningResponse.url,
        summary: commissioningResponse.payload?.summary || null
      }
    }
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 质量阻断整改清单");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 楼层: build=${report.build}, floor=${report.floor}`);
  lines.push(`- 真实写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 结论: ${report.summary.canCompleteFinalControl ? "无质量阻断" : "存在质量阻断，不能全量最终控制"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 汇总");
  lines.push("");
  lines.push(`- FCU 总数: ${report.summary.total}`);
  lines.push(`- 需整改: ${report.summary.remediationCount}`);
  lines.push(`- P0: ${report.summary.p0Count}`);
  lines.push(`- 通讯报警: ${report.summary.communicationAlarmCount ?? "--"}`);
  lines.push(`- 0°C: ${report.summary.zeroTemperatureCount ?? "--"}`);
  lines.push(`- 无效温度: ${report.summary.invalidTemperatureCount ?? "--"}`);
  if (report.reasonCounts.length > 0) {
    lines.push(`- 原因分布: ${report.reasonCounts.map((item) => `${item.reason}=${item.count}`).join(", ")}`);
  }
  lines.push("");
  if (report.devices.length > 0) {
    lines.push("## 设备清单");
    lines.push("");
    lines.push("| 优先级 | 设备 | 名称 | 温度 | 设定 | 通讯报警 | 原因 | 关键点位 |");
    lines.push("|---|---|---|---:|---:|---|---|---|");
    for (const item of report.devices) {
      const tags = [
        item.points.communicationAlarm?.tagName,
        item.points.zoneTemperature?.tagName,
        item.points.setpointFeedback?.tagName
      ].filter(Boolean).join(" / ");
      lines.push(`| ${item.severity} | ${item.deviceCode} | ${item.deviceName} | ${item.zoneTemperatureC ?? "--"} | ${item.setpointC ?? "--"} | ${item.communicationAlarm ? "是" : "否"} | ${item.reasons.join(", ") || "--"} | ${tags || "--"} |`);
    }
    lines.push("");
    lines.push("## 现场动作");
    lines.push("");
    for (const item of report.devices) {
      lines.push(`### ${item.deviceCode} ${item.deviceName}`);
      for (const action of item.fieldActions) {
        lines.push(`- ${action}`);
      }
      lines.push(`- 放行标准: ${item.releaseCriteria.join("；")}。`);
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
    "zoneTemperatureC",
    "setpointC",
    "running",
    "communicationAlarm",
    "qualityStatus",
    "reasons",
    "communicationAlarmTag",
    "communicationAlarmValue",
    "zoneTemperatureTag",
    "zoneTemperatureValue",
    "setpointFeedbackTag",
    "setpointFeedbackValue",
    "runTag",
    "runValue",
    "fieldActions",
    "releaseCriteria"
  ];
  const rows = report.devices.map((item) => [
    item.severity,
    item.deviceCode,
    item.deviceName,
    item.zoneTemperatureC,
    item.setpointC,
    item.running,
    item.communicationAlarm,
    item.qualityStatus,
    item.reasons,
    item.points.communicationAlarm?.tagName,
    item.points.communicationAlarm?.value,
    item.points.zoneTemperature?.tagName,
    item.points.zoneTemperature?.value,
    item.points.setpointFeedback?.tagName,
    item.points.setpointFeedback?.value,
    item.points.run?.tagName,
    item.points.run?.value,
    item.fieldActions,
    item.releaseCriteria
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

async function main() {
  const [snapshotResponse, commissioningResponse] = await Promise.all([
    requestJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`),
    requestJson(`/bff/v1/sites/${encodeURIComponent(SITE_ID)}/hvac-terminal/fan-coils/commissioning-status?build=${encodeURIComponent(BUILD)}&floor=${encodeURIComponent(FLOOR)}`)
  ]);
  const report = buildReport({ snapshotResponse, commissioningResponse });
  writeReport(report);
  console.log(
    `FCU_QUALITY_REMEDIATION ok=${report.ok} remediation=${report.summary.remediationCount} p0=${report.summary.p0Count} mutation=false`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
  console.log(`csv=${OUTPUT_CSV}`);
  if (!report.ok) {
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
