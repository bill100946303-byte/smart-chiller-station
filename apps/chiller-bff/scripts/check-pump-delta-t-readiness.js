import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { resolveSiteRuntimeConfig } from "../src/lib/site-runtime-config.js";
import { resolvePumpDeltaTDispatchConfig } from "../src/services/optimizeExecutionDispatchService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");

const SITE_ID = normalizeText(process.env.SITE_ID) || "141";
const BFF_BASE_URL = (process.env.BFF_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const DB_FILE = path.resolve(process.env.ADMIN_DB_FILE || appConfig.adminDbFile);
const LOAD_KW = normalizeNumber(process.env.PUMP_DELTA_T_LOAD_KW, 1422);
const OUTDOOR_TEMP_C = normalizeNumber(process.env.PUMP_DELTA_T_OUTDOOR_TEMP_C, 22.9);
const MODE = normalizeText(process.env.PUMP_DELTA_T_MODE) || "cooling";
const OUTPUT_JSON =
  process.env.PUMP_DELTA_T_READINESS_JSON ||
  path.resolve(ROOT_DIR, "docs/pump-delta-t-readiness-latest.json");
const OUTPUT_MD =
  process.env.PUMP_DELTA_T_READINESS_MD ||
  path.resolve(ROOT_DIR, "docs/pump-delta-t-readiness-latest.md");
const STRICT = ["1", "true", "yes", "on"].includes(
  String(process.env.PUMP_DELTA_T_READINESS_STRICT || "").trim().toLowerCase()
);
const REQUEST_TIMEOUT_MS = normalizeInteger(process.env.PUMP_DELTA_T_READINESS_TIMEOUT_MS, 15000);

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushUnique(target, value) {
  const normalized = normalizeText(value);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      parseError: true,
      raw: text.slice(0, 500)
    };
  }
}

function requestJson(method, routePath, payload = null) {
  const target = new URL(routePath, `${BFF_BASE_URL}/`);
  const transport = target.protocol === "https:" ? https : http;
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = body
    ? {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    : {};

  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
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
            payload: parseJsonSafely(raw),
            raw
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
        payload: null,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function readPumpConfig(siteConfig) {
  return isPlainObject(siteConfig?.pumpDeltaT) ? siteConfig.pumpDeltaT : {};
}

function readRuntimePumpConfig(siteConfig) {
  const runtime = siteConfig?.siteRuntimeAdminConfig;
  const rulePump =
    runtime?.ruleThresholds?.pumpDeltaT && isPlainObject(runtime.ruleThresholds.pumpDeltaT)
      ? runtime.ruleThresholds.pumpDeltaT
      : {};
  const flags = isPlainObject(runtime?.featureFlags) ? runtime.featureFlags : {};
  return {
    rulePump,
    featureFlags: flags
  };
}

function readControlTarget(pumpConfig, operation) {
  const controlTargets = isPlainObject(pumpConfig?.controlTargets) ? pumpConfig.controlTargets : {};
  return isPlainObject(controlTargets[operation]) ? controlTargets[operation] : null;
}

function normalizeCommandList(target) {
  if (!isPlainObject(target)) {
    return [];
  }
  if (Array.isArray(target.commands) && target.commands.length > 0) {
    return target.commands.filter(isPlainObject);
  }
  if (
    normalizeText(target.tagName) ||
    normalizeText(target.chwpTagName) ||
    normalizeText(target.cwpTagName) ||
    normalizeText(target.chilledPumpTrimPoint) ||
    normalizeText(target.coolingPumpTrimPoint) ||
    normalizeText(target.valueSource)
  ) {
    return [target];
  }
  return [];
}

function commandSupports(command, sourceNames, directFields) {
  if (!isPlainObject(command)) {
    return false;
  }
  const valueSource = normalizeText(command.valueSource);
  if (valueSource && sourceNames.includes(valueSource)) {
    return true;
  }
  return directFields.some((field) => normalizeText(command[field]));
}

function targetSupports(target, sourceNames, directFields) {
  if (!isPlainObject(target)) {
    return false;
  }
  if (directFields.some((field) => normalizeText(target[field]))) {
    return true;
  }
  return normalizeCommandList(target).some((command) => commandSupports(command, sourceNames, directFields));
}

function validateOperation(operation, target, endpointFallback) {
  const blockers = [];
  const warnings = [];
  const endpoint = normalizeText(target?.endpoint) || normalizeText(endpointFallback);
  const strategy = normalizeText(target?.strategy);
  const commandTemplate =
    normalizeText(target?.commandTemplate) ||
    normalizeText(target?.msgTemplate) ||
    normalizeText(target?.msg);
  const commands = normalizeCommandList(target);
  const isApprove = operation === "approve";
  const chwpSources = isApprove
    ? ["targetChwpFreqTrimHz", "execution.targetChwpFreqTrimHz"]
    : [
        "rollbackTarget.targetChwpFreqTrimHz",
        "execution.rollbackTarget.targetChwpFreqTrimHz",
        "targetChwpFreqTrimHz"
      ];
  const cwpSources = isApprove
    ? ["targetCwpFreqTrimHz", "execution.targetCwpFreqTrimHz"]
    : [
        "rollbackTarget.targetCwpFreqTrimHz",
        "execution.rollbackTarget.targetCwpFreqTrimHz",
        "targetCwpFreqTrimHz"
      ];
  const hasChwpPoint = targetSupports(target, chwpSources, ["chwpTagName", "chilledPumpTrimPoint", "tagName"]);
  const hasCwpPoint = targetSupports(target, cwpSources, ["cwpTagName", "coolingPumpTrimPoint", "tagName"]);

  if (!isPlainObject(target)) {
    pushUnique(blockers, `${operation} 映射缺失`);
  }
  if (!endpoint && !commands.length) {
    pushUnique(blockers, `${operation}.endpoint 或 commands 至少需要一个`);
  }
  if (!strategy && endpoint) {
    pushUnique(warnings, `${operation}.strategy 未配置，assisted 前需说明 endpoint 接收格式`);
  }
  if (!commandTemplate && commands.length) {
    pushUnique(warnings, `${operation}.commandTemplate/msgTemplate 未配置，需确认现场命令格式`);
  }
  if (!hasChwpPoint) {
    pushUnique(blockers, `${operation} 缺 AI_ChwpFreqTrim_Hz / 冷冻泵 Trim 点位映射`);
  }
  if (!hasCwpPoint) {
    pushUnique(blockers, `${operation} 缺 AI_CwpFreqTrim_Hz / 冷却泵 Trim 点位映射`);
  }

  return {
    operation,
    status: blockers.length === 0 ? "ready" : isPlainObject(target) ? "partial" : "missing",
    endpoint: endpoint || null,
    strategy: strategy || null,
    commandTemplate: commandTemplate || null,
    commandCount: commands.length,
    hasChwpPoint,
    hasCwpPoint,
    commands: commands.map((command) => ({
      tagName: normalizeText(command.tagName) || null,
      chwpTagName: normalizeText(command.chwpTagName) || null,
      cwpTagName: normalizeText(command.cwpTagName) || null,
      chilledPumpTrimPoint: normalizeText(command.chilledPumpTrimPoint) || null,
      coolingPumpTrimPoint: normalizeText(command.coolingPumpTrimPoint) || null,
      valueSource: normalizeText(command.valueSource) || null,
      valueTransform: normalizeText(command.valueTransform) || "identity"
    })),
    blockers,
    warnings
  };
}

function summarizeAdvisor(advice) {
  const advisor = advice?.payload?.details?.pumpDeltaTAdvisor || null;
  if (!advisor) {
    return {
      requestOk: advice.ok,
      httpStatus: advice.status,
      status: "missing",
      executionReady: false,
      dispatchReady: false,
      reason: advice.error || "optimize response missing pumpDeltaTAdvisor",
      outputTargets: null,
      current: null,
      blockers: [],
      warnings: []
    };
  }
  return {
    requestOk: advice.ok,
    httpStatus: advice.status,
    status: advisor.status || null,
    executionReady: advisor.executionReady === true,
    dispatchReady: advisor.dispatchReady === true,
    executionMode: advisor.executionMode || null,
    dispatchMode: advisor.dispatchMode || null,
    reason: advisor.reason || null,
    outputTargets: advisor.outputTargets || null,
    current: advisor.current || null,
    blockers: Array.isArray(advisor.blockers) ? advisor.blockers : [],
    warnings: Array.isArray(advisor.warnings) ? advisor.warnings : [],
    execution: advisor.advisorResult?.execution || null
  };
}

function summarizeExecutions(adminStore) {
  const list = adminStore.listOptimizeExecutions(SITE_ID, {
    type: "pump-delta-t",
    limit: 5
  });
  const items = Array.isArray(list.items) ? list.items : [];
  const latest = items[0] || null;
  return {
    total: list.total || items.length,
    latest: latest
      ? {
          executionId: latest.executionId,
          status: latest.status,
          createdAt: latest.createdAt,
          updatedAt: latest.updatedAt,
          approvedAt: latest.approvedAt || null,
          approvedBy: latest.approvedBy || null,
          type: latest.execution?.type || null,
          targetChwpFreqTrimHz: latest.execution?.targetChwpFreqTrimHz ?? null,
          targetCwpFreqTrimHz: latest.execution?.targetCwpFreqTrimHz ?? null,
          ttlSeconds: latest.execution?.ttlSeconds ?? null,
          holdMinutes: latest.execution?.holdMinutes ?? null,
          rollbackLockoutMinutes: latest.execution?.rollbackLockoutMinutes ?? null,
          targetPoints: latest.execution?.targetPoints || null,
          rollbackTarget: latest.execution?.rollbackTarget || null,
          actions: Array.isArray(latest.execution?.actions) ? latest.execution.actions : [],
          timeline: Array.isArray(latest.timeline) ? latest.timeline.map((entry) => entry.action) : []
        }
      : null,
    items: items.map((item) => ({
      executionId: item.executionId,
      status: item.status,
      updatedAt: item.updatedAt,
      targetChwpFreqTrimHz: item.execution?.targetChwpFreqTrimHz ?? null,
      targetCwpFreqTrimHz: item.execution?.targetCwpFreqTrimHz ?? null
    }))
  };
}

function buildReport({ siteConfig, advice, executions }) {
  const pumpConfig = readPumpConfig(siteConfig);
  const runtimePumpConfig = readRuntimePumpConfig(siteConfig);
  const dispatchConfig = resolvePumpDeltaTDispatchConfig(siteConfig);
  const approve = validateOperation("approve", readControlTarget(pumpConfig, "approve"), dispatchConfig.approveEndpoint);
  const rollback = validateOperation("rollback", readControlTarget(pumpConfig, "rollback"), dispatchConfig.rollbackEndpoint);
  const advisor = summarizeAdvisor(advice);
  const blockers = [];
  const warnings = [];
  approve.blockers.forEach((item) => pushUnique(blockers, item));
  rollback.blockers.forEach((item) => pushUnique(blockers, item));
  approve.warnings.forEach((item) => pushUnique(warnings, item));
  rollback.warnings.forEach((item) => pushUnique(warnings, item));
  advisor.warnings.forEach((item) => pushUnique(warnings, item));

  const latest = executions.latest;
  const latestHasTrim =
    latest?.type === "pump-delta-t" &&
    (normalizeNumber(latest.targetChwpFreqTrimHz, 0) !== 0 ||
      normalizeNumber(latest.targetCwpFreqTrimHz, 0) !== 0);
  const latestApproved = latest?.status === "approved";
  const latestPending = latest?.status === "pending_approval";
  const latestHasRollbackZero =
    latest?.rollbackTarget?.mode === "zero-trim" &&
    normalizeNumber(latest.rollbackTarget?.targetChwpFreqTrimHz, null) === 0 &&
    normalizeNumber(latest.rollbackTarget?.targetCwpFreqTrimHz, null) === 0;
  const shadowReady = Boolean(
    latestHasTrim &&
      latestHasRollbackZero &&
      (latestApproved || latestPending || advisor.executionReady)
  );
  const assistedMappingReady =
    dispatchConfig.mode === "assisted" &&
    approve.status === "ready" &&
    rollback.status === "ready";
  const assistedSafetyReady = Boolean(
    assistedMappingReady &&
      advisor.execution?.controlPointMapped === true &&
      advisor.execution?.rollbackMapped === true &&
      !advisor.warnings.some((item) => /末端|泵实际频率|最小流量|PLC/i.test(String(item)))
  );
  const assistedReady = assistedMappingReady && assistedSafetyReady;
  if (!latestHasTrim) {
    pushUnique(blockers, "缺最近 pump-delta-t shadow 执行单或执行单没有非零 Trim 目标。");
  }
  if (latestHasTrim && !latestHasRollbackZero) {
    pushUnique(blockers, "最近 pump-delta-t 执行单缺 0Hz 回退目标。");
  }
  if (!assistedMappingReady) {
    pushUnique(blockers, "assisted 前缺 approve/rollback 点位映射或 dispatchMode 未配置为 assisted。");
  }
  if (assistedMappingReady && !assistedSafetyReady) {
    pushUnique(blockers, "assisted 前仍缺末端保护、泵频率反馈、最小流量或 PLC 等效保护确认。");
  }

  const finalDecision = assistedReady
    ? "GO_ASSISTED_MAPPING_REVIEW"
    : shadowReady
      ? "GO_SHADOW_ONLY"
      : "BLOCK_SHADOW";

  return {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    dbFile: DB_FILE,
    finalDecision,
    shadowReadinessStatus: shadowReady ? "GO" : "BLOCKED",
    assistedReadinessStatus: assistedReady ? "GO" : "BLOCKED",
    dispatchMode: dispatchConfig.mode,
    rawDispatchMode: dispatchConfig.rawMode,
    requestInputs: {
      loadKw: LOAD_KW,
      outdoorTempC: OUTDOOR_TEMP_C,
      mode: MODE
    },
    advisor,
    executions,
    mapping: {
      approve,
      rollback
    },
    runtimePumpConfigPresent: Object.keys(runtimePumpConfig.rulePump).length > 0,
    runtimeFeatureFlags: {
      pumpDeltaTDispatchMode: runtimePumpConfig.featureFlags.pumpDeltaTDispatchMode || null,
      pumpDeltaTDispatchEndpoint: runtimePumpConfig.featureFlags.pumpDeltaTDispatchEndpoint || null,
      pumpDeltaTDispatchApproveEndpoint: runtimePumpConfig.featureFlags.pumpDeltaTDispatchApproveEndpoint || null,
      pumpDeltaTDispatchRollbackEndpoint: runtimePumpConfig.featureFlags.pumpDeltaTDispatchRollbackEndpoint || null
    },
    blockers,
    warnings,
    nextActions: assistedReady
      ? [
          "先在 assisted 中只验证回执和 PLC 本地限幅/斜率/联锁，不开放 enforced。",
          "用 30-60min 同负荷/相近湿球窗口验证泵功率下降、冷机功率未抵消、COP 不劣化。"
        ]
      : shadowReady
        ? [
            "补 AI_ChwpFreqTrim_Hz / AI_CwpFreqTrim_Hz 到 PLC/SCADA 的 approve 点位映射。",
            "补 rollback 到 0Hz 或最近稳定值的回退映射。",
            "由 PLC 或 BFF 接入末端压差/阀位/室温、泵实际频率和最小流量保护状态，再评估 assisted。"
          ]
        : [
            "先生成 pump-delta-t shadow 建议并创建/审批 shadow 执行单。",
            "确认执行单包含 CHWP/CWP Trim、TTL、5min hold、15min rollback lockout 和 0Hz 回退。"
          ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 泵温差导向降频 readiness 检查");
  lines.push("");
  lines.push(`- 结论：${report.finalDecision}`);
  lines.push(`- 站点：${report.siteId}`);
  lines.push(`- shadow 就绪：${report.shadowReadinessStatus}`);
  lines.push(`- assisted 就绪：${report.assistedReadinessStatus}`);
  lines.push(`- dispatchMode：${report.dispatchMode}`);
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push("## 当前 Advisor");
  lines.push("");
  lines.push(`- 状态：${report.advisor.status || "--"}`);
  lines.push(`- executionReady：${report.advisor.executionReady ? "true" : "false"}`);
  lines.push(`- dispatchReady：${report.advisor.dispatchReady ? "true" : "false"}`);
  lines.push(`- 原因：${report.advisor.reason || "--"}`);
  lines.push(
    `- Trim：CHWP ${report.advisor.outputTargets?.chilledPumpFreqTrimHz ?? "--"} Hz / CWP ${
      report.advisor.outputTargets?.coolingPumpFreqTrimHz ?? "--"
    } Hz`
  );
  lines.push("");
  lines.push("## 最近 pump-delta-t 执行单");
  lines.push("");
  if (report.executions.latest) {
    const item = report.executions.latest;
    lines.push(`- executionId：${item.executionId}`);
    lines.push(`- status：${item.status}`);
    lines.push(`- target：CHWP ${item.targetChwpFreqTrimHz} Hz / CWP ${item.targetCwpFreqTrimHz} Hz`);
    lines.push(`- TTL / hold / lockout：${item.ttlSeconds}s / ${item.holdMinutes}min / ${item.rollbackLockoutMinutes}min`);
    lines.push(`- rollback：${item.rollbackTarget?.mode || "--"}，CHWP ${item.rollbackTarget?.targetChwpFreqTrimHz ?? "--"} Hz / CWP ${item.rollbackTarget?.targetCwpFreqTrimHz ?? "--"} Hz`);
    lines.push(`- timeline：${item.timeline.length ? item.timeline.join(" -> ") : "--"}`);
  } else {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 点位映射");
  lines.push("");
  lines.push("| operation | status | endpoint | CHWP点 | CWP点 | commands |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const item of [report.mapping.approve, report.mapping.rollback]) {
    lines.push(
      `| ${item.operation} | ${item.status} | ${item.endpoint || "--"} | ${item.hasChwpPoint ? "是" : "否"} | ${
        item.hasCwpPoint ? "是" : "否"
      } | ${item.commandCount} |`
    );
  }
  lines.push("");
  lines.push("## 阻断项");
  lines.push("");
  if (report.blockers.length) {
    report.blockers.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 风险与提示");
  lines.push("");
  if (report.warnings.length) {
    report.warnings.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("- 无");
  }
  lines.push("");
  lines.push("## 下一步");
  lines.push("");
  report.nextActions.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const adminStore = createAdminStore({ dbFile: DB_FILE });
  try {
    const siteConfig = resolveSiteRuntimeConfig(appConfig, adminStore, SITE_ID);
    const advice = await requestJson("POST", `/bff/v1/sites/${encodeURIComponent(SITE_ID)}/optimize`, {
      context: {
        siteId: SITE_ID
      },
      inputs: {
        loadKw: LOAD_KW,
        outdoorTempC: OUTDOOR_TEMP_C,
        mode: MODE
      }
    });
    const executions = summarizeExecutions(adminStore);
    const report = buildReport({
      siteConfig,
      advice,
      executions
    });
    fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(OUTPUT_MD, renderMarkdown(report), "utf8");
    process.stdout.write(`pump delta-t readiness: ${report.finalDecision}\n`);
    process.stdout.write(`shadow=${report.shadowReadinessStatus} assisted=${report.assistedReadinessStatus}\n`);
    process.stdout.write(`json=${OUTPUT_JSON}\n`);
    process.stdout.write(`markdown=${OUTPUT_MD}\n`);
    if (report.blockers.length) {
      process.stdout.write(`blockers=${report.blockers.length}\n`);
      report.blockers.slice(0, 8).forEach((item) => process.stdout.write(`- ${item}\n`));
    }
    if (STRICT && report.assistedReadinessStatus !== "GO") {
      process.exitCode = 1;
    }
  } finally {
    adminStore.close();
  }
}

main().catch((error) => {
  process.stderr.write(`pump delta-t readiness check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
