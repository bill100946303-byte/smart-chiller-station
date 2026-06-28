import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { buildDefaultFcuControlPolicy, normalizeFcuControlPolicy } from "../src/services/fcuControlService.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

const SITE_ID = normalizeText(readCliOption("site-id") || process.env.SITE_ID) || "126lnoffice";
const DEVICE_CODES = uniqueTextList(
  (readCliOption("devices") || process.env.FCU_SMALL_BATCH_DEVICES || "BGS01,LZBGS")
    .split(",")
    .map((item) => item.trim())
);
const MODE = normalizeMode(readCliOption("mode") || process.env.FCU_SMALL_BATCH_MODE || "enforced");
const DISPATCH_ADAPTER = normalizeText(readCliOption("dispatch-adapter") || process.env.FCU_DISPATCH_ADAPTER) || "legacy-scene-command";
const OUTPUT_JSON =
  process.env.FCU_SMALL_BATCH_POLICY_JSON ||
  path.join(DOCS_DIR, "fcu-small-batch-policy-latest.json");
const OUTPUT_MD =
  process.env.FCU_SMALL_BATCH_POLICY_MD ||
  path.join(DOCS_DIR, "fcu-small-batch-policy-latest.md");

function readCliOption(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function normalizeMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["shadow", "assisted", "enforced"].includes(normalized) ? normalized : "enforced";
}

function uniqueTextList(items) {
  const seen = new Set();
  const values = [];
  for (const item of Array.isArray(items) ? items : []) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    values.push(text);
  }
  return values;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
}

function buildNextPolicy(existingPolicy) {
  const base = normalizeFcuControlPolicy(existingPolicy || buildDefaultFcuControlPolicy());
  return normalizeFcuControlPolicy({
    ...base,
    enabled: true,
    defaultMode: MODE,
    dispatchAdapter: DISPATCH_ADAPTER,
    whitelist: DEVICE_CODES,
    allowSetpoint: true,
    allowFanSpeed: true,
    allowStartStop: true,
    occupied: true
  });
}

function buildReport({ dbFile, before, after }) {
  const beforePolicy = normalizeFcuControlPolicy(before || buildDefaultFcuControlPolicy());
  return {
    ok: DEVICE_CODES.length > 0 && after?.whitelist?.length === DEVICE_CODES.length,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    dbFile,
    controlMutation: false,
    adminConfigMutation: true,
    note: "仅更新 FCU 控制策略白名单和模式，不执行 BA/PLC 写入。",
    before: {
      enabled: beforePolicy.enabled,
      defaultMode: beforePolicy.defaultMode,
      dispatchAdapter: beforePolicy.dispatchAdapter,
      whitelistCount: beforePolicy.whitelist.length,
      whitelist: beforePolicy.whitelist
    },
    after: {
      enabled: after.enabled,
      defaultMode: after.defaultMode,
      dispatchAdapter: after.dispatchAdapter,
      whitelistCount: after.whitelist.length,
      whitelist: after.whitelist,
      allowSetpoint: after.allowSetpoint,
      allowFanSpeed: after.allowFanSpeed,
      allowStartStop: after.allowStartStop,
      targetLowC: after.targetLowC,
      targetHighC: after.targetHighC,
      minSetpointC: after.minSetpointC,
      maxSetpointC: after.maxSetpointC,
      setpointStepC: after.setpointStepC,
      setpointDwellMinutes: after.setpointDwellMinutes,
      startStopDwellMinutes: after.startStopDwellMinutes,
      feedbackTimeoutSeconds: after.feedbackTimeoutSeconds,
      rollbackLockoutMinutes: after.rollbackLockoutMinutes
    },
    nextChecks: [
      "npm --prefix apps/chiller-bff run check:fcu-device-control-matrix",
      "npm --prefix apps/chiller-bff run plan:fcu-small-batch-dispatch",
      "npm --prefix apps/chiller-bff run execute:fcu-small-batch-dispatch"
    ]
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# FCU 小批量投运策略");
  lines.push("");
  lines.push(`- 站点: ${report.siteId}`);
  lines.push(`- 结论: ${report.ok ? "已配置小批量策略" : "配置未完成"}`);
  lines.push(`- 控制写入副作用: ${report.controlMutation ? "存在" : "无"}`);
  lines.push(`- 配置变更: ${report.adminConfigMutation ? "存在" : "无"}`);
  lines.push(`- 生成时间: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 策略变化");
  lines.push("");
  lines.push(`- 原模式: ${report.before.defaultMode} / 原白名单: ${report.before.whitelistCount} 台`);
  lines.push(`- 新模式: ${report.after.defaultMode} / 新白名单: ${report.after.whitelistCount} 台`);
  lines.push(`- BA 写适配器: ${report.after.dispatchAdapter}`);
  lines.push(`- 首批设备: ${report.after.whitelist.join(", ") || "无"}`);
  lines.push("");
  lines.push("## 保护参数");
  lines.push("");
  lines.push(`- 舒适区间: ${report.after.targetLowC}-${report.after.targetHighC}°C`);
  lines.push(`- 设定范围: ${report.after.minSetpointC}-${report.after.maxSetpointC}°C`);
  lines.push(`- 设定步长: ${report.after.setpointStepC}°C`);
  lines.push(`- 设定保持: ${report.after.setpointDwellMinutes} min`);
  lines.push(`- 启停保持: ${report.after.startStopDwellMinutes} min`);
  lines.push(`- 反馈超时: ${report.after.feedbackTimeoutSeconds} s`);
  lines.push(`- 回退锁定: ${report.after.rollbackLockoutMinutes} min`);
  lines.push("");
  lines.push("## 下一步检查");
  lines.push("");
  for (const item of report.nextChecks) {
    lines.push(`- \`${item}\``);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  if (DEVICE_CODES.length === 0) {
    throw new Error("FCU small-batch policy requires at least one device code.");
  }
  const dbFile = path.resolve(process.cwd(), appConfig.adminDbFile);
  const adminStore = createAdminStore({
    dbFile
  });
  try {
    const existing = adminStore.getFcuControlPolicy(SITE_ID);
    const before = existing?.policy || null;
    const nextPolicy = buildNextPolicy(before);
    const record = adminStore.upsertFcuControlPolicy(
      SITE_ID,
      nextPolicy,
      {
        userId: "system:fcu-small-batch-policy",
        username: "FCU Small Batch Policy"
      },
      {
        requestId: `script-${Date.now()}`
      }
    );
    const report = buildReport({
      dbFile,
      before,
      after: normalizeFcuControlPolicy(record?.policy || nextPolicy)
    });
    ensureParentDir(OUTPUT_JSON);
    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
    ensureParentDir(OUTPUT_MD);
    fs.writeFileSync(OUTPUT_MD, renderMarkdown(report));
    console.log(
      `FCU_SMALL_BATCH_POLICY ok=${report.ok} mode=${report.after.defaultMode} whitelist=${report.after.whitelist.join(",")} mutation=false`
    );
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    if (!report.ok) {
      process.exitCode = 2;
    }
  } finally {
    adminStore.close();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
