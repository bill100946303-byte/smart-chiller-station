import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";
import { buildDefaultFcuControlPolicy, normalizeFcuControlPolicy } from "../src/services/fcuControlService.js";

const CONFIRM_PHRASE = "I_APPROVE_FCU_SITE_AUTHORIZATION";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_DOCS_DIR = path.resolve(REPO_ROOT, "docs");
const SITE_ID = normalizeText(readCliOption("site-id") || process.env.SITE_ID) || "126lnoffice";
const SITE_AUTHORIZATION_BY = normalizeText(readCliOption("authorized-by") || process.env.FCU_SITE_AUTHORIZATION_BY);
const COMMISSIONING_OWNER = normalizeText(readCliOption("commissioning-owner") || process.env.FCU_COMMISSIONING_OWNER);
const BA_OWNER = normalizeText(readCliOption("ba-owner") || process.env.FCU_BA_OWNER);
const WINDOW_START = normalizeText(readCliOption("window-start") || process.env.FCU_SITE_AUTHORIZATION_WINDOW_START);
const WINDOW_END = normalizeText(readCliOption("window-end") || process.env.FCU_SITE_AUTHORIZATION_WINDOW_END);
const NOTES = normalizeText(readCliOption("notes") || process.env.FCU_SITE_AUTHORIZATION_NOTES);
const BA_CONFIRM_ARMED = normalizeBoolean(readCliOption("ba-confirm-armed") || process.env.FCU_BA_WRITE_CONFIRM_ARMED, false);
const FINAL_CONFIRM_ARMED = normalizeBoolean(readCliOption("final-confirm-armed") || process.env.FCU_FINAL_ROLLOUT_CONFIRM_ARMED, false);
const CONFIRM = normalizeText(readCliOption("confirm") || process.env.FCU_SITE_AUTHORIZATION_CONFIRM);
const OUTPUT_JSON =
  process.env.FCU_SITE_AUTHORIZATION_JSON ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-site-authorization-latest.json");
const OUTPUT_MD =
  process.env.FCU_SITE_AUTHORIZATION_MD ||
  path.resolve(DEFAULT_DOCS_DIR, "fcu-site-authorization-latest.md");

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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = normalizeText(value).toLowerCase();
  if (["1", "true", "yes", "on", "armed"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function validateWindow(startValue, endValue) {
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (!startValue || !endValue || !Number.isFinite(start) || !Number.isFinite(end)) {
    return {
      ok: false,
      active: false,
      reason: "授权窗口开始和结束必须是可解析时间"
    };
  }
  if (end <= start) {
    return {
      ok: false,
      active: false,
      reason: "授权窗口结束必须晚于开始"
    };
  }
  const now = Date.now();
  return {
    ok: true,
    active: now >= start && now <= end,
    reason: now < start ? "授权窗口未开始" : now > end ? "授权窗口已过期" : "授权窗口当前生效"
  };
}

function buildIssues() {
  const issues = [];
  if (!SITE_AUTHORIZATION_BY) {
    issues.push("缺少授权确认人 FCU_SITE_AUTHORIZATION_BY");
  }
  if (!COMMISSIONING_OWNER) {
    issues.push("缺少投运负责人 FCU_COMMISSIONING_OWNER");
  }
  if (!BA_OWNER) {
    issues.push("缺少 BA 负责人 FCU_BA_OWNER");
  }
  const windowState = validateWindow(WINDOW_START, WINDOW_END);
  if (!windowState.ok) {
    issues.push(windowState.reason);
  }
  if (CONFIRM === CONFIRM_PHRASE && windowState.ok && !windowState.active) {
    issues.push(`${windowState.reason}，禁止写入配置中心`);
  }
  if (CONFIRM && CONFIRM !== CONFIRM_PHRASE) {
    issues.push("确认短语不匹配，禁止写入配置中心");
  }
  return {
    issues,
    windowState
  };
}

function buildNextPolicy(existingPolicy) {
  const base = normalizeFcuControlPolicy(existingPolicy || buildDefaultFcuControlPolicy());
  return normalizeFcuControlPolicy({
    ...base,
    fieldAuthorization: {
      ...base.fieldAuthorization,
      siteAuthorizationStatus: "approved",
      siteAuthorizationBy: SITE_AUTHORIZATION_BY,
      commissioningOwner: COMMISSIONING_OWNER,
      baOwner: BA_OWNER,
      siteAuthorizationWindowStart: WINDOW_START,
      siteAuthorizationWindowEnd: WINDOW_END,
      baWriteConfirmArmed: BA_CONFIRM_ARMED,
      finalRolloutConfirmArmed: FINAL_CONFIRM_ARMED,
      notes: NOTES || base.fieldAuthorization.notes
    }
  });
}

function buildReport({ dbFile, before, after, issues, windowState, persisted }) {
  const beforePolicy = normalizeFcuControlPolicy(before || buildDefaultFcuControlPolicy());
  const afterPolicy = normalizeFcuControlPolicy(after || buildNextPolicy(beforePolicy));
  const confirmMatched = CONFIRM === CONFIRM_PHRASE;
  return {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    scope: "fcu_site_authorization",
    persisted,
    dryRun: !persisted,
    controlMutation: false,
    adminConfigMutation: persisted,
    dbFile,
    confirmRequired: CONFIRM_PHRASE,
    confirmMatched,
    window: {
      start: WINDOW_START,
      end: WINDOW_END,
      configured: windowState.ok,
      active: windowState.active,
      status: windowState.reason
    },
    before: {
      siteAuthorizationStatus: beforePolicy.fieldAuthorization.siteAuthorizationStatus,
      siteAuthorizationBy: beforePolicy.fieldAuthorization.siteAuthorizationBy,
      commissioningOwner: beforePolicy.fieldAuthorization.commissioningOwner,
      baOwner: beforePolicy.fieldAuthorization.baOwner,
      siteAuthorizationWindowStart: beforePolicy.fieldAuthorization.siteAuthorizationWindowStart,
      siteAuthorizationWindowEnd: beforePolicy.fieldAuthorization.siteAuthorizationWindowEnd,
      baWriteConfirmArmed: beforePolicy.fieldAuthorization.baWriteConfirmArmed,
      finalRolloutConfirmArmed: beforePolicy.fieldAuthorization.finalRolloutConfirmArmed
    },
    after: {
      siteAuthorizationStatus: afterPolicy.fieldAuthorization.siteAuthorizationStatus,
      siteAuthorizationBy: afterPolicy.fieldAuthorization.siteAuthorizationBy,
      commissioningOwner: afterPolicy.fieldAuthorization.commissioningOwner,
      baOwner: afterPolicy.fieldAuthorization.baOwner,
      siteAuthorizationWindowStart: afterPolicy.fieldAuthorization.siteAuthorizationWindowStart,
      siteAuthorizationWindowEnd: afterPolicy.fieldAuthorization.siteAuthorizationWindowEnd,
      baWriteConfirmArmed: afterPolicy.fieldAuthorization.baWriteConfirmArmed,
      finalRolloutConfirmArmed: afterPolicy.fieldAuthorization.finalRolloutConfirmArmed
    },
    blockers: issues.map((issue) => ({
      severity: "P0",
      issue
    })),
    nextSteps: [
      "确认 3002 授权状态与责任人显示正确",
      "确认授权窗口当前生效后重跑 check:fcu-field-arm",
      "确认 BFF 后端只读总闸仍按现场投运计划打开",
      "执行 BGS01 首台 Canary 前再次核对 BA 写入确认短语"
    ]
  };
}

function writeReport(report) {
  ensureParentDir(OUTPUT_JSON);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# FCU 现场授权准备",
    "",
    `- 站点：${report.siteId}`,
    `- 状态：${report.persisted ? "已写入配置中心" : "dry-run，未写入"}`,
    `- 控制写入：${report.controlMutation ? "存在" : "无"}`,
    `- 授权窗口：${report.window.status}`,
    `- 阻断项：${report.blockers.length}`,
    "",
    "## P0",
    ...(
      report.blockers.length > 0
        ? report.blockers.map((item) => `- ${item.issue}`)
        : ["- 无"]
    ),
    "",
    "## 下一步",
    ...report.nextSteps.map((item) => `- ${item}`)
  ];
  ensureParentDir(OUTPUT_MD);
  fs.writeFileSync(OUTPUT_MD, `${lines.join("\n")}\n`);
}

function main() {
  const dbFile = path.resolve(process.cwd(), appConfig.adminDbFile);
  const adminStore = createAdminStore({ dbFile });
  try {
    const existing = adminStore.getFcuControlPolicy(SITE_ID);
    const before = existing?.policy || null;
    const { issues, windowState } = buildIssues();
    const nextPolicy = buildNextPolicy(before);
    const shouldPersist = issues.length === 0 && CONFIRM === CONFIRM_PHRASE && windowState.active;
    let after = nextPolicy;
    if (shouldPersist) {
      const record = adminStore.upsertFcuControlPolicy(
        SITE_ID,
        nextPolicy,
        {
          userId: "system:fcu-site-authorization",
          username: "FCU Site Authorization"
        },
        {
          requestId: `script-${Date.now()}`
        }
      );
      after = normalizeFcuControlPolicy(record?.policy || nextPolicy);
    }
    const report = buildReport({
      dbFile,
      before,
      after,
      issues,
      windowState,
      persisted: shouldPersist
    });
    writeReport(report);
    console.log(
      `FCU_SITE_AUTHORIZATION ok=${report.ok} persisted=${report.persisted} windowActive=${report.window.active} mutation=${report.controlMutation}`
    );
    console.log(`json=${OUTPUT_JSON}`);
    console.log(`md=${OUTPUT_MD}`);
    process.exitCode = report.ok ? 0 : 2;
  } finally {
    adminStore.close?.();
  }
}

main();
