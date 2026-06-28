import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.resolve(REPO_ROOT, "docs");

const SITE_ID = normalizeText(process.env.SITE_ID) || "126lnoffice";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.FCU_FINAL_CONTROL_TIMEOUT_MS, 15000);
const FIELD_ARM_JSON =
  process.env.FCU_FIELD_ARM_CHECK_JSON ||
  path.resolve(DOCS_DIR, "fcu-field-arm-check-latest.json");
const CANARY_JSON =
  process.env.FCU_CANARY_DISPATCH_JSON ||
  path.resolve(DOCS_DIR, "fcu-canary-dispatch-latest.json");
const SMALL_BATCH_JSON =
  process.env.FCU_SMALL_BATCH_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-small-batch-dispatch-execution-latest.json");
const ALL_DEVICE_EXECUTION_JSON =
  process.env.FCU_ALL_DEVICE_EXECUTION_JSON ||
  path.resolve(DOCS_DIR, "fcu-all-device-dispatch-execution-latest.json");
const ALL_DEVICE_POLICY_JSON =
  process.env.FCU_ALL_DEVICE_POLICY_JSON ||
  path.resolve(DOCS_DIR, "fcu-all-device-policy-latest.json");
const ALL_DEVICE_DISPATCH_PLAN_JSON =
  process.env.FCU_ALL_DEVICE_DISPATCH_PLAN_JSON ||
  path.resolve(DOCS_DIR, "fcu-all-device-dispatch-plan-latest.json");
const QUALITY_REMEDIATION_JSON =
  process.env.FCU_QUALITY_REMEDIATION_JSON ||
  path.resolve(DOCS_DIR, "fcu-quality-remediation-latest.json");
const OUTPUT_JSON =
  process.env.FCU_FINAL_CONTROL_COMPLETION_JSON ||
  path.resolve(DOCS_DIR, "fcu-final-control-completion-latest.json");
const OUTPUT_MD =
  process.env.FCU_FINAL_CONTROL_COMPLETION_MD ||
  path.resolve(DOCS_DIR, "fcu-final-control-completion-latest.md");

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

function pushCheck(checks, key, label, ok, severity, message, detail = {}) {
  checks.push({
    key,
    label,
    ok: ok === true,
    severity,
    message,
    ...detail
  });
}

function recordStatus(value) {
  return normalizeText(value || "");
}

function resolveCanaryDevice(fieldArm, canary) {
  return (
    normalizeText(fieldArm.firstCanary) ||
    normalizeText(canary.canary?.deviceCode) ||
    normalizeText(canary.device) ||
    null
  );
}

function hasRollbackTriggered(canary) {
  if (!canary.rollback) {
    return false;
  }
  return Boolean(canary.rollback.ok || canary.rollback.recordStatus || canary.rollback.status);
}

function allFeedbackConfirmed(smallBatch) {
  const devices = Array.isArray(smallBatch.devices) ? smallBatch.devices : [];
  if (devices.length === 0) {
    return false;
  }
  return devices.every((device) => {
    const results = Array.isArray(device.results) ? device.results : [];
    return results.length > 0 && results.every((item) => recordStatus(item.verification?.recordStatus) === "feedback_confirmed");
  });
}

function deviceResultsFeedbackConfirmed(device) {
  const results = Array.isArray(device?.results) ? device.results : [];
  return results.length > 0 && results.every((item) => recordStatus(item.verification?.recordStatus) === "feedback_confirmed");
}

function collectConfirmedDeviceCodes({ canary, smallBatch, allDeviceExecution }) {
  const confirmed = new Set();
  if (
    canary?.ok === true &&
    canary?.mode === "confirmed_canary_dispatch" &&
    canary?.controlMutation === true &&
    recordStatus(canary.verification?.recordStatus || canary.verification?.status) === "feedback_confirmed"
  ) {
    const code = normalizeText(canary.canary?.deviceCode || canary.device);
    if (code) {
      confirmed.add(code);
    }
  }
  for (const device of Array.isArray(smallBatch?.devices) ? smallBatch.devices : []) {
    const code = normalizeText(device?.deviceCode);
    if (code && deviceResultsFeedbackConfirmed(device)) {
      confirmed.add(code);
    }
  }
  for (const wave of Array.isArray(allDeviceExecution?.waves) ? allDeviceExecution.waves : []) {
    for (const device of Array.isArray(wave?.devices) ? wave.devices : []) {
      const code = normalizeText(device?.deviceCode);
      if (code && deviceResultsFeedbackConfirmed(device)) {
        confirmed.add(code);
      }
    }
  }
  return confirmed;
}

function buildNextActions(report) {
  const failedKeys = new Set(report.checks.filter((item) => !item.ok).map((item) => item.key));
  const firstCanary = report.firstCanary || "BGS01";
  const actions = [];
  if (failedKeys.has("backend_write_gate")) {
    actions.push({
      priority: "P0",
      action: "关闭 BFF 只读总闸并重启",
      command: "READ_ONLY_MODE=false CHILLER_READ_ONLY_MODE=false npm --prefix apps/chiller-bff run dev",
      reason: "当前 /healthz readOnlyMode=true 时禁止真实写 BA。"
    });
  }
  if (failedKeys.has("field_arm_ready")) {
    actions.push({
      priority: "P0",
      action: "重跑现场 Arm-Check",
      command: "npm --prefix apps/chiller-bff run check:fcu-field-arm",
      reason: "只有 field_arm_ready 才允许进入 Canary。"
    });
  }
  if (failedKeys.has("canary_dispatch_confirmed") || failedKeys.has("canary_feedback_confirmed")) {
    actions.push({
      priority: "P0",
      action: "执行首台 Canary 并等待反馈确认",
      command: `FCU_CANARY_DEVICE_CODE=${firstCanary} FCU_CANARY_COMMAND_KIND=setpoint FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-canary-dispatch`,
      reason: "最终控制最小完成口径要求首台真实下发并反馈确认。"
    });
  }
  if (failedKeys.has("canary_no_rollback")) {
    actions.push({
      priority: "P0",
      action: "处理回退后的设备锁定和复盘",
      command: "",
      reason: "已触发回退不能判定最终控制完成。"
    });
  }
  if (report.milestones?.canary?.ok && !report.milestones?.smallBatch?.ok) {
    actions.push({
      priority: "P1",
      action: "扩大到小批量白名单",
      command: "FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch",
      reason: "首台 Canary 完成后才允许小批量扩展。"
    });
  }
  if (report.milestones?.smallBatch?.ok && !report.milestones?.allDevice?.ok) {
    actions.push({
      priority: "P1",
      action: "全量 FCU 分批执行并反馈确认",
      command: "FCU_SMALL_BATCH_LIMIT=30 FCU_SMALL_BATCH_CONFIRM=I_UNDERSTAND_REAL_BA_WRITE npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch",
      reason: "小批量通过后，按全量白名单分批推进，直到全部 FCU 反馈确认。"
    });
  }
  return actions;
}

function buildReport({
  health,
  fieldArmFile,
  canaryFile,
  smallBatchFile,
  allDeviceExecutionFile,
  allDevicePolicyFile,
  allDevicePlanFile,
  qualityRemediationFile
}) {
  const fieldArm = fieldArmFile.payload || {};
  const canary = canaryFile.payload || {};
  const smallBatch = smallBatchFile.payload || {};
  const allDeviceExecution = allDeviceExecutionFile.payload || {};
  const allDevicePolicy = allDevicePolicyFile.payload || {};
  const allDevicePlan = allDevicePlanFile.payload || {};
  const qualityRemediation = qualityRemediationFile.payload || {};
  const checks = [];
  const firstCanary = resolveCanaryDevice(fieldArm, canary);
  const canaryDevice = normalizeText(canary.canary?.deviceCode || canary.device);
  const verificationStatus = recordStatus(canary.verification?.recordStatus || canary.verification?.status);
  const rollbackTriggered = hasRollbackTriggered(canary);
  const smallBatchDevices = Array.isArray(smallBatch.devices) ? smallBatch.devices : [];
  const allDeviceTargetCount =
    Number(allDevicePolicy.after?.whitelistCount || allDevicePolicy.discovery?.uniqueDeviceCount || 0) || 0;
  const smallBatchConfirmed = allFeedbackConfirmed(smallBatch);
  const confirmedDeviceCodes = collectConfirmedDeviceCodes({ canary, smallBatch, allDeviceExecution });
  const confirmedDeviceCount = confirmedDeviceCodes.size;

  pushCheck(
    checks,
    "bff_health",
    "BFF 服务在线",
    health.ok === true && health.payload?.ok !== false,
    "P0",
    health.ok ? "BFF /healthz 可读取。" : health.error || `BFF health failed: ${health.status}`,
    { evidence: { status: health.status, url: health.url } }
  );
  pushCheck(
    checks,
    "backend_write_gate",
    "后端写入总闸",
    health.payload?.readOnlyMode === false,
    "P0",
    health.payload?.readOnlyMode === false ? "readOnlyMode=false。" : "readOnlyMode=true 或无法确认。",
    { readOnlyMode: health.payload?.readOnlyMode ?? null }
  );
  pushCheck(
    checks,
    "field_arm_report_present",
    "Arm-Check 报告存在",
    fieldArmFile.ok === true,
    "P0",
    fieldArmFile.ok ? fieldArmFile.path : fieldArmFile.error || "缺少 Arm-Check JSON。"
  );
  pushCheck(
    checks,
    "field_arm_ready",
    "现场 Arm-Check ready",
    fieldArmFile.ok === true && fieldArm.ok === true && fieldArm.verdict === "field_arm_ready",
    "P0",
    `ok=${fieldArm.ok === true}, verdict=${fieldArm.verdict || "unknown"}`
  );
  pushCheck(
    checks,
    "canary_report_present",
    "Canary 报告存在",
    canaryFile.ok === true,
    "P0",
    canaryFile.ok ? canaryFile.path : canaryFile.error || "缺少 Canary JSON。"
  );
  pushCheck(
    checks,
    "canary_device_matches",
    "首台 Canary 设备一致",
    Boolean(firstCanary && canaryDevice && firstCanary === canaryDevice),
    "P0",
    `firstCanary=${firstCanary || "--"}, canaryDevice=${canaryDevice || "--"}`
  );
  pushCheck(
    checks,
    "canary_dispatch_confirmed",
    "首台真实下发完成",
    canaryFile.ok === true &&
      canary.ok === true &&
      canary.mode === "confirmed_canary_dispatch" &&
      canary.controlMutation === true,
    "P0",
    `ok=${canary.ok === true}, mode=${canary.mode || "unknown"}, controlMutation=${canary.controlMutation === true}`
  );
  pushCheck(
    checks,
    "canary_feedback_confirmed",
    "首台反馈确认",
    verificationStatus === "feedback_confirmed",
    "P0",
    `verification.recordStatus=${verificationStatus || "--"}`
  );
  pushCheck(
    checks,
    "canary_no_rollback",
    "首台未触发回退",
    rollbackTriggered === false,
    "P0",
    rollbackTriggered ? "Canary 报告存在 rollback 记录。" : "未发现 rollback 记录。"
  );
  pushCheck(
    checks,
    "small_batch_confirmed",
    "小批量反馈确认",
    smallBatchFile.ok === true &&
      smallBatch.ok === true &&
      smallBatch.mode === "confirmed_dispatch" &&
      smallBatch.controlMutation === true &&
      smallBatchConfirmed,
    "P0",
    `ok=${smallBatch.ok === true}, mode=${smallBatch.mode || "unknown"}, devices=${smallBatchDevices.length}, feedbackConfirmed=${smallBatchConfirmed}`
  );
  pushCheck(
    checks,
    "all_device_policy_present",
    "全量白名单策略存在",
    allDevicePolicyFile.ok === true && allDevicePolicy.ok === true && allDeviceTargetCount > 0,
    "P0",
    `ok=${allDevicePolicy.ok === true}, targetCount=${allDeviceTargetCount}`
  );
  pushCheck(
    checks,
    "all_device_feedback_confirmed",
    "全量 FCU 反馈确认",
    smallBatchFile.ok === true &&
      smallBatchConfirmed &&
      allDeviceTargetCount > 0 &&
      confirmedDeviceCount >= allDeviceTargetCount,
    "P0",
    `confirmedDevices=${confirmedDeviceCount}, targetDevices=${allDeviceTargetCount}`
  );

  const canaryMilestone = {
    ok:
      fieldArmFile.ok === true &&
      fieldArm.ok === true &&
      fieldArm.verdict === "field_arm_ready" &&
      canaryFile.ok === true &&
      canary.ok === true &&
      canary.mode === "confirmed_canary_dispatch" &&
      canary.controlMutation === true &&
      verificationStatus === "feedback_confirmed" &&
      rollbackTriggered === false,
    deviceCode: canaryDevice || null,
    feedbackStatus: verificationStatus || null
  };
  const smallBatchMilestone = {
    ok:
      canaryMilestone.ok &&
      smallBatchFile.ok === true &&
      smallBatch.ok === true &&
      smallBatch.mode === "confirmed_dispatch" &&
      smallBatch.controlMutation === true &&
      smallBatchConfirmed,
    devices: smallBatchDevices.length,
    feedbackConfirmed: smallBatchConfirmed
  };
  const allDeviceMilestone = {
    ok:
      smallBatchMilestone.ok &&
      allDevicePolicyFile.ok === true &&
      allDevicePolicy.ok === true &&
      allDeviceTargetCount > 0 &&
      confirmedDeviceCount >= allDeviceTargetCount,
    targetDevices: allDeviceTargetCount,
    confirmedDevices: confirmedDeviceCount,
    confirmedDeviceCodes: Array.from(confirmedDeviceCodes).sort()
  };
  const blockers = checks.filter((item) => !item.ok && item.severity === "P0");
  const ok = allDeviceMilestone.ok === true && blockers.length === 0;
  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    scope: "fcu_all_device_final_control",
    verdict: ok ? "fcu_all_device_control_complete" : "final_control_incomplete",
    controlMutation:
      (canary.ok === true && canary.controlMutation === true) ||
      (smallBatch.ok === true && smallBatch.controlMutation === true) ||
      (allDeviceExecution.ok === true && allDeviceExecution.controlMutation === true),
    milestones: {
      canary: canaryMilestone,
      smallBatch: smallBatchMilestone,
      allDevice: allDeviceMilestone
    },
    rolloutPlan: allDevicePlanFile.ok
      ? {
          ok: allDevicePlan.ok === true,
          total: allDevicePlan.summary?.total ?? null,
          deviceReady: allDevicePlan.summary?.deviceReady ?? null,
          immediateReady: allDevicePlan.summary?.immediateReady ?? null,
          stagedSetpoint: allDevicePlan.summary?.stagedSetpoint ?? null,
          blocked: allDevicePlan.summary?.blocked ?? null,
          canCompleteAllNow: allDevicePlan.summary?.canCompleteAllNow ?? null,
          firstCanary: allDevicePlan.firstCanary || null,
          waveCount: Array.isArray(allDevicePlan.waves) ? allDevicePlan.waves.length : 0,
          blockingByReason: allDevicePlan.blockingByReason || []
        }
      : {
          ok: false,
          error: allDevicePlanFile.error || "全量分批计划不存在"
        },
    qualityRemediation: qualityRemediationFile.ok
      ? {
          ok: qualityRemediation.ok === true,
          remediationCount: qualityRemediation.summary?.remediationCount ?? null,
          p0Count: qualityRemediation.summary?.p0Count ?? null,
          canCompleteFinalControl: qualityRemediation.summary?.canCompleteFinalControl ?? null,
          reasonCounts: qualityRemediation.reasonCounts || [],
          deviceCodes: Array.isArray(qualityRemediation.devices)
            ? qualityRemediation.devices.map((item) => item.deviceCode).filter(Boolean)
            : []
        }
      : {
          ok: false,
          error: qualityRemediationFile.error || "FCU 质量整改清单不存在"
        },
    firstCanary,
    canaryDevice: canaryDevice || null,
    canaryRecordId: canary.recordId || canary.canary?.recordId || canary.verification?.recordId || null,
    canaryVerificationStatus: verificationStatus || null,
    smallBatchStatus: {
      present: smallBatchFile.ok === true,
      ok: smallBatch.ok === true,
      mode: smallBatch.mode || null,
      controlMutation: smallBatch.controlMutation === true
    },
    checks,
    blockingItems: blockers,
    nextActions: [],
    evidence: {
      health: {
        ok: health.ok,
        status: health.status,
        url: health.url,
        readOnlyMode: health.payload?.readOnlyMode ?? null
      },
      files: {
        fieldArm: { ok: fieldArmFile.ok, path: fieldArmFile.path },
        canary: { ok: canaryFile.ok, path: canaryFile.path },
        smallBatch: { ok: smallBatchFile.ok, path: smallBatchFile.path },
        allDeviceExecution: { ok: allDeviceExecutionFile.ok, path: allDeviceExecutionFile.path },
        allDevicePolicy: { ok: allDevicePolicyFile.ok, path: allDevicePolicyFile.path },
        allDevicePlan: { ok: allDevicePlanFile.ok, path: allDevicePlanFile.path },
        qualityRemediation: { ok: qualityRemediationFile.ok, path: qualityRemediationFile.path }
      }
    }
  };
  report.nextActions = buildNextActions(report);
  return report;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 最终控制完成度检查");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 范围: ${report.scope}`);
  lines.push(`- 结论: ${report.ok ? "全量 FCU 最终控制已完成" : "最终控制未完成"}`);
  lines.push(`- verdict: ${report.verdict}`);
  lines.push(`- 首台 Canary: ${report.firstCanary || "--"}`);
  lines.push(`- 反馈状态: ${report.canaryVerificationStatus || "--"}`);
  lines.push(`- 控制写入副作用证据: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 阶段进度");
  lines.push("");
  lines.push("| 阶段 | 状态 | 证据 |");
  lines.push("|---|---|---|");
  lines.push(`| 首台 Canary | ${report.milestones.canary.ok ? "完成" : "未完成"} | ${report.milestones.canary.deviceCode || "--"} / ${report.milestones.canary.feedbackStatus || "--"} |`);
  lines.push(`| 小批量 | ${report.milestones.smallBatch.ok ? "完成" : "未完成"} | ${report.milestones.smallBatch.devices} 台 / feedbackConfirmed=${report.milestones.smallBatch.feedbackConfirmed} |`);
  lines.push(`| 全量 FCU | ${report.milestones.allDevice.ok ? "完成" : "未完成"} | ${report.milestones.allDevice.confirmedDevices}/${report.milestones.allDevice.targetDevices} 台 |`);
  lines.push("");
  lines.push("## 全量分批计划");
  lines.push("");
  if (report.rolloutPlan.ok) {
    lines.push(`- 总 FCU: ${report.rolloutPlan.total}`);
    lines.push(`- 设备侧就绪: ${report.rolloutPlan.deviceReady}`);
    lines.push(`- 可立即执行: ${report.rolloutPlan.immediateReady}`);
    lines.push(`- 需分步调设定: ${report.rolloutPlan.stagedSetpoint}`);
    lines.push(`- 质量/通讯阻断: ${report.rolloutPlan.blocked}`);
    lines.push(`- 波次数: ${report.rolloutPlan.waveCount}`);
    if (report.rolloutPlan.blockingByReason?.length) {
      lines.push(`- 主要阻断: ${report.rolloutPlan.blockingByReason.map((item) => `${item.reason}=${item.count}`).join(", ")}`);
    }
  } else {
    lines.push(`- 未生成: ${report.rolloutPlan.error || "--"}`);
  }
  lines.push("");
  lines.push("## 质量整改");
  lines.push("");
  if (report.qualityRemediation.ok) {
    lines.push(`- 需整改: ${report.qualityRemediation.remediationCount}`);
    lines.push(`- P0: ${report.qualityRemediation.p0Count}`);
    lines.push(`- 可进入全量最终控制: ${report.qualityRemediation.canCompleteFinalControl ? "是" : "否"}`);
    if (report.qualityRemediation.deviceCodes.length) {
      lines.push(`- 设备: ${report.qualityRemediation.deviceCodes.join(", ")}`);
    }
    if (report.qualityRemediation.reasonCounts.length) {
      lines.push(`- 原因: ${report.qualityRemediation.reasonCounts.map((item) => `${item.reason}=${item.count}`).join(", ")}`);
    }
  } else {
    lines.push(`- 未生成: ${report.qualityRemediation.error || "--"}`);
  }
  lines.push("");
  lines.push("## 检查项");
  lines.push("");
  lines.push("| 检查 | 状态 | 说明 |");
  lines.push("|---|---|---|");
  for (const check of report.checks) {
    lines.push(`| ${check.label} | ${check.ok ? "通过" : check.severity} | ${check.message} |`);
  }
  lines.push("");
  if (report.blockingItems.length > 0) {
    lines.push("## P0 阻断");
    lines.push("");
    for (const item of report.blockingItems) {
      lines.push(`- ${item.key}: ${item.message}`);
    }
    lines.push("");
  }
  lines.push("## 下一步");
  lines.push("");
  if (report.nextActions.length === 0) {
    lines.push("- 暂无。");
  } else {
    lines.push("| 优先级 | 动作 | 命令 | 原因 |");
    lines.push("|---|---|---|---|");
    for (const item of report.nextActions) {
      lines.push(`| ${item.priority || "--"} | ${item.action || "--"} | ${item.command ? `\`${item.command}\`` : "--"} | ${item.reason || "--"} |`);
    }
  }
  lines.push("");
  lines.push("## 边界");
  lines.push("");
  lines.push("- 本检查器只读，不触发 BA/PLC 写入。");
  lines.push("- 默认完成口径为全量 FCU：首台 Canary、小批量、全量白名单均真实下发且反馈确认。");
  return `${lines.join("\n")}\n`;
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

async function main() {
  const health = await requestJson("/healthz");
  const report = buildReport({
    health,
    fieldArmFile: readJsonFile(FIELD_ARM_JSON),
    canaryFile: readJsonFile(CANARY_JSON),
    smallBatchFile: readJsonFile(SMALL_BATCH_JSON),
    allDeviceExecutionFile: readJsonFile(ALL_DEVICE_EXECUTION_JSON),
    allDevicePolicyFile: readJsonFile(ALL_DEVICE_POLICY_JSON),
    allDevicePlanFile: readJsonFile(ALL_DEVICE_DISPATCH_PLAN_JSON),
    qualityRemediationFile: readJsonFile(QUALITY_REMEDIATION_JSON)
  });
  writeReport(report);
  console.log(
    `FCU_FINAL_CONTROL_COMPLETION ok=${report.ok} verdict=${report.verdict} scope=${report.scope} first=${report.firstCanary || "--"} blockers=${report.blockingItems.length} mutation=${report.controlMutation}`
  );
  console.log(`json=${OUTPUT_JSON}`);
  console.log(`md=${OUTPUT_MD}`);
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
