import { Router } from "express";
import { resolveFcuEvidenceDirectory } from "../lib/fcu-evidence-paths.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { badRequest, conflict, forbidden, unauthorized } from "../lib/admin-errors.js";
import { resolveSiteRuntimeConfig } from "../lib/site-runtime-config.js";
import { validateStationRuntimeBindingSource } from "../services/deviceService.js";
import { buildDefaultFcuControlPolicy, normalizeFcuControlPolicy } from "../services/fcuControlService.js";
const SITE_MEMBER_ROLES = new Set(["site_admin", "auditor"]);
const SITE_STATUSES = new Set(["active", "paused", "disabled"]);
const FCU_SIGNOFF_PROMOTE_CONFIRM = "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT";
const FCU_SIGNOFF_COLUMNS = [
  "workOrderId",
  "deviceCode",
  "handledBy",
  "handledAt",
  "communicationAlarmAfter",
  "zoneTemperatureAfterC",
  "setpointFeedbackAfterC",
  "writePointMappingChecked",
  "twoSampleNormal",
  "localManualLockout",
  "releaseDecision",
  "reviewedBy",
  "reviewedAt",
  "notes"
];

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeSiteStatus(value, fallback = "active") {
  const normalized = normalizeText(value).toLowerCase();
  return SITE_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeLegacyBaseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    return null;
  }
}

function toResponse(res, requestId, body, status = 200) {
  res.status(status).json({
    ok: true,
    requestId,
    ...body
  });
}

function matchesBootstrap(user, config) {
  const allowedIds = new Set((config.adminBootstrapUserIds || []).filter(Boolean));
  const allowedNames = new Set(
    (config.adminBootstrapUsernames || []).map((item) => item.toLowerCase()).filter(Boolean)
  );
  if (user?.userId && allowedIds.has(user.userId)) {
    return true;
  }
  if (user?.username && allowedNames.has(String(user.username).toLowerCase())) {
    return true;
  }
  return false;
}

function getAccessContext(context) {
  const siteIds = context.siteRoles.map((item) => item.scopeId).filter(Boolean);
  const allowAllSites =
    context.platformRole === "platform_admin" || context.platformRole === "auditor";
  return {
    allowAllSites,
    siteIds
  };
}

function requireAdminContext(adminStore, userId) {
  const context = adminStore.getAdminContext(userId);
  if (!context.platformRole && context.siteRoles.length === 0) {
    throw forbidden("This account does not have admin access");
  }
  return context;
}

function canReadSite(context, siteId) {
  if (context.platformRole === "platform_admin" || context.platformRole === "auditor") {
    return true;
  }
  return context.siteRoles.some((item) => item.scopeId === siteId);
}

function canWriteSite(context, siteId) {
  if (context.platformRole === "platform_admin") {
    return true;
  }
  return context.siteRoles.some((item) => item.scopeId === siteId && item.role === "site_admin");
}

function assertCanReadSite(context, siteId) {
  if (!canReadSite(context, siteId)) {
    throw forbidden("You do not have access to this site", { siteId });
  }
}

function assertCanWriteSite(context, siteId) {
  if (!canWriteSite(context, siteId)) {
    throw forbidden("You do not have write access to this site", { siteId });
  }
}

function assertCanViewAuditLogs(context) {
  if (context.platformRole || context.siteRoles.length > 0) {
    return;
  }
  throw forbidden("You do not have access to audit logs");
}

function assertWritableRole(role) {
  const normalizedRole = normalizeText(role).toLowerCase();
  if (!SITE_MEMBER_ROLES.has(normalizedRole)) {
    throw badRequest("Invalid site member role", {
      field: "role",
      allowed: Array.from(SITE_MEMBER_ROLES)
    });
  }
  return normalizedRole;
}

function normalizeRuntimeConfigPayload(body) {
  if (!body || typeof body !== "object") {
    return {
      energyParams: {},
      ruleThresholds: {},
      featureFlags: {}
    };
  }

  const record = body;
  const normalizeRuntimeJsonObject = (value, field) => {
    let parsed = value;
    if (typeof parsed === "string") {
      const trimmed = parsed.trim();
      if (!trimmed) {
        return {};
      }
      try {
        parsed = JSON.parse(trimmed);
      } catch (_error) {
        throw badRequest(`${field} must be valid JSON`, { field });
      }
    }
    if (parsed == null) {
      return {};
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest(`${field} must be a JSON object`, { field });
    }
    return parsed;
  };

  return {
    energyParams: normalizeRuntimeJsonObject(record.energyParams ?? record.energyParamsJson, "energyParams"),
    ruleThresholds: normalizeRuntimeJsonObject(
      record.ruleThresholds ?? record.ruleThresholdsJson,
      "ruleThresholds"
    ),
    featureFlags: normalizeRuntimeJsonObject(
      record.featureFlags ?? record.featureFlagsJson,
      "featureFlags"
    )
  };
}

function assertFcuControlPolicyIsSaveable(policy) {
  const authorization = policy?.fieldAuthorization || {};
  if (authorization.siteAuthorizationStatus !== "approved") {
    return;
  }
  const missingFields = [];
  if (!normalizeText(authorization.siteAuthorizationBy)) {
    missingFields.push("fieldAuthorization.siteAuthorizationBy");
  }
  if (!normalizeText(authorization.commissioningOwner)) {
    missingFields.push("fieldAuthorization.commissioningOwner");
  }
  if (!normalizeText(authorization.baOwner)) {
    missingFields.push("fieldAuthorization.baOwner");
  }
  if (!normalizeText(authorization.siteAuthorizationWindowStart)) {
    missingFields.push("fieldAuthorization.siteAuthorizationWindowStart");
  }
  if (!normalizeText(authorization.siteAuthorizationWindowEnd)) {
    missingFields.push("fieldAuthorization.siteAuthorizationWindowEnd");
  }
  if (missingFields.length > 0) {
    throw badRequest("FCU approved field authorization requires owners and authorization window", {
      fields: missingFields,
      hint: "已授权状态必须记录授权确认人、投运负责人、BA负责人、授权窗口开始和结束时间。"
    });
  }
  const start = Date.parse(authorization.siteAuthorizationWindowStart);
  const end = Date.parse(authorization.siteAuthorizationWindowEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw badRequest("FCU approved field authorization window is invalid", {
      fields: [
        "fieldAuthorization.siteAuthorizationWindowStart",
        "fieldAuthorization.siteAuthorizationWindowEnd"
      ],
      hint: "授权窗口结束时间必须晚于开始时间。"
    });
  }
}

function normalizeSitePayload(body = {}, options = {}) {
  const siteId = normalizeText(body.siteId);
  return {
    siteId,
    siteName: normalizeOptionalText(body.siteName),
    siteCode: normalizeOptionalText(body.siteCode),
    city: normalizeOptionalText(body.city),
    status:
      body.status == null && options.allowMissingStatus
        ? null
        : normalizeSiteStatus(body.status),
    ownerName: normalizeOptionalText(body.ownerName),
    remark: normalizeOptionalText(body.remark)
  };
}

function normalizeSourceConfigPayload(body = {}) {
  return {
    legacyBaseUrl: normalizeLegacyBaseUrl(body.legacyBaseUrl),
    ipAddress: normalizeOptionalText(body.ipAddress),
    port: normalizeOptionalText(body.port),
    databaseKey: normalizeOptionalText(body.databaseKey),
    modelKey: normalizeOptionalText(body.modelKey),
    preferredProjectKey: normalizeOptionalText(body.preferredProjectKey),
    template: normalizeOptionalText(body.template),
    controlMode: normalizeOptionalText(body.controlMode),
    status: normalizeOptionalText(body.status)
  };
}

function normalizeSiteMemberPayload(body = {}) {
  const userId = normalizeText(body.userId);
  if (!userId) {
    throw badRequest("userId is required", { field: "userId" });
  }
  return {
    userId,
    username: normalizeOptionalText(body.username) || userId,
    role: assertWritableRole(body.role)
  };
}

function normalizeConfigVersionId(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw badRequest("versionId is required", { field: "versionId" });
  }
  return normalized;
}

function buildMeResponse(adminStore, context, requestId, autoImportedSiteIds = []) {
  const managedSites = adminStore.listSites({}, getAccessContext(context));
  const effectiveRole =
    context.platformRole ||
    context.siteRoles.find((item) => item.role === "site_admin")?.role ||
    context.siteRoles[0]?.role ||
    "auditor";
  return {
    requestId,
    user: {
      userId: context.principal?.userId || null,
      username: context.principal?.username || null
    },
    userId: context.principal?.userId || null,
    username: context.principal?.username || null,
    role: effectiveRole,
    visibleSites: managedSites,
    bootstrap: autoImportedSiteIds.length > 0,
    roles: {
      platformRole: context.platformRole,
      siteRoles: context.siteRoles
    },
    managedSites,
    autoImportedSiteIds
  };
}

function buildEffectiveSourceConfig(config, adminStore, siteId) {
  const runtimeConfig = resolveSiteRuntimeConfig(config, adminStore, siteId);
  return runtimeConfig?.siteSourceConfig || null;
}

function readAdminJsonReport(filePath, label) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        status: "missing",
        label,
        sourceFile: filePath,
        payload: null,
        error: `${label} report is missing`
      };
    }
    return {
      status: "ok",
      label,
      sourceFile: filePath,
      payload: JSON.parse(fs.readFileSync(filePath, "utf8")),
      error: null
    };
  } catch (error) {
    return {
      status: "error",
      label,
      sourceFile: filePath,
      payload: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => normalizeText(value))) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => normalizeText(value))) {
    rows.push(row);
  }
  return rows;
}

function renderCsv(header, records) {
  return `${[header, ...records.map((record) => header.map((column) => record[column] ?? ""))]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}\n`;
}

function buildFcuFieldRemediationReportPaths(config = {}, siteId = "") {
  const docsDir = resolveFcuEvidenceDirectory(config.fcuFinalControlOutputDir, siteId);
  return {
    docsDir,
    quality: path.join(docsDir, "fcu-quality-remediation-latest.json"),
    allDevicePlan: path.join(docsDir, "fcu-all-device-dispatch-plan-latest.json"),
    closeout: path.join(docsDir, "fcu-field-remediation-closeout-latest.json"),
    workOrders: path.join(docsDir, "fcu-field-remediation-work-orders-latest.json"),
    executionPack: path.join(docsDir, "fcu-field-remediation-execution-pack-latest.json"),
    signoffInputCsv: path.join(docsDir, "fcu-field-remediation-signoff-input-latest.csv"),
    signoff: path.join(docsDir, "fcu-field-remediation-signoff-latest.json"),
    signoffClean: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.json"),
    signoffCleanMd: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.md"),
    signoffCurrentCsv: path.join(docsDir, "fcu-field-remediation-signoff-current-only-latest.csv"),
    signoffStaleCsv: path.join(docsDir, "fcu-field-remediation-signoff-stale-rows-latest.csv"),
    signoffPromote: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.json"),
    signoffPromoteMd: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.md"),
    returnTemplateJson: path.join(docsDir, "fcu-field-remediation-return-template-latest.json"),
    returnTemplateMd: path.join(docsDir, "fcu-field-remediation-return-template-latest.md"),
    returnTemplateCsv: path.join(docsDir, "fcu-field-remediation-return-template-latest.csv"),
    fieldHandoffJson: path.join(docsDir, "fcu-field-handoff-pack-latest.json"),
    fieldHandoffMd: path.join(docsDir, "fcu-field-handoff-pack-latest.md"),
    fieldHandoffCsv: path.join(docsDir, "fcu-field-handoff-pack-latest.csv"),
    finalControlWorklistJson: path.join(docsDir, "fcu-final-control-worklist-latest.json"),
    finalControlWorklistMd: path.join(docsDir, "fcu-final-control-worklist-latest.md"),
    finalControlFieldExecutionPackJson: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.json"),
    finalControlFieldExecutionPackMd: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.md"),
    finalControlFieldExecutionPackCsv: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.csv"),
    finalControlRunbookJson: path.join(docsDir, "fcu-final-control-runbook-latest.json"),
    finalControlRunbookMd: path.join(docsDir, "fcu-final-control-runbook-latest.md"),
    canaryReadinessJson: path.join(docsDir, "fcu-canary-readiness-latest.json"),
    canaryReadinessMd: path.join(docsDir, "fcu-canary-readiness-latest.md"),
    evidenceConsistencyJson: path.join(docsDir, "fcu-final-control-evidence-consistency-latest.json"),
    evidenceConsistencyMd: path.join(docsDir, "fcu-final-control-evidence-consistency-latest.md"),
    finalControlGates: path.join(docsDir, "fcu-final-control-gates-latest.json")
  };
}

function slugifyFcuDeviceCode(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function buildFcuAdminCanaryPaths(config = {}, deviceCode = "", siteId = "") {
  const docsDir = resolveFcuEvidenceDirectory(config.fcuFinalControlOutputDir, siteId);
  const slug = slugifyFcuDeviceCode(deviceCode);
  return {
    docsDir,
    canaryWindowJson: path.join(docsDir, `fcu-canary-window-${slug}.json`),
    canaryWindowMd: path.join(docsDir, `fcu-canary-window-${slug}.md`),
    canaryExecutionPackageJson: path.join(docsDir, `fcu-canary-execution-package-${slug}.json`),
    canaryExecutionPackageMd: path.join(docsDir, `fcu-canary-execution-package-${slug}.md`),
    canaryExecutionPackageCsv: path.join(docsDir, `fcu-canary-execution-package-${slug}.csv`),
    adapterReadinessJson: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.json`),
    adapterReadinessMd: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.md`),
    adapterReadinessCsv: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.csv`),
    canaryDispatchJson: path.join(docsDir, `fcu-canary-dispatch-${slug}.json`),
    canaryDispatchMd: path.join(docsDir, `fcu-canary-dispatch-${slug}.md`),
    feedbackMonitorJson: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.json`),
    feedbackMonitorMd: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.md`),
    feedbackMonitorCsv: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.csv`),
    fieldArmPackageJson: path.join(docsDir, `fcu-field-arm-package-${slug}.json`),
    fieldArmPackageMd: path.join(docsDir, `fcu-field-arm-package-${slug}.md`),
    fieldArmPackageCsv: path.join(docsDir, `fcu-field-arm-package-${slug}.csv`),
    finalCompletionJson: path.join(docsDir, "fcu-final-control-completion-latest.json"),
    finalCompletionMd: path.join(docsDir, "fcu-final-control-completion-latest.md"),
    finalWorklistJson: path.join(docsDir, "fcu-final-control-worklist-latest.json"),
    finalWorklistMd: path.join(docsDir, "fcu-final-control-worklist-latest.md"),
    finalControlFieldExecutionPackJson: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.json"),
    finalControlFieldExecutionPackMd: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.md"),
    finalControlFieldExecutionPackCsv: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.csv"),
    finalControlRunbookJson: path.join(docsDir, "fcu-final-control-runbook-latest.json"),
    finalControlRunbookMd: path.join(docsDir, "fcu-final-control-runbook-latest.md"),
    qualityRemediationJson: path.join(docsDir, "fcu-quality-remediation-latest.json"),
    qualityRemediationMd: path.join(docsDir, "fcu-quality-remediation-latest.md"),
    qualityRemediationCsv: path.join(docsDir, "fcu-quality-remediation-latest.csv"),
    allDevicePlanJson: path.join(docsDir, "fcu-all-device-dispatch-plan-latest.json"),
    allDevicePlanMd: path.join(docsDir, "fcu-all-device-dispatch-plan-latest.md"),
    fieldRemediationCloseoutJson: path.join(docsDir, "fcu-field-remediation-closeout-latest.json"),
    fieldRemediationCloseoutMd: path.join(docsDir, "fcu-field-remediation-closeout-latest.md"),
    fieldRemediationCloseoutCsv: path.join(docsDir, "fcu-field-remediation-closeout-latest.csv"),
    fieldRemediationWorkOrdersJson: path.join(docsDir, "fcu-field-remediation-work-orders-latest.json"),
    fieldRemediationWorkOrdersMd: path.join(docsDir, "fcu-field-remediation-work-orders-latest.md"),
    fieldRemediationWorkOrdersCsv: path.join(docsDir, "fcu-field-remediation-work-orders-latest.csv"),
    fieldRemediationExecutionPackJson: path.join(docsDir, "fcu-field-remediation-execution-pack-latest.json"),
    fieldRemediationExecutionPackMd: path.join(docsDir, "fcu-field-remediation-execution-pack-latest.md"),
    fieldRemediationExecutionPackCsv: path.join(docsDir, "fcu-field-remediation-execution-pack-latest.csv"),
    fieldRemediationSignoffInputCsv: path.join(docsDir, "fcu-field-remediation-signoff-input-latest.csv"),
    fieldRemediationSignoffJson: path.join(docsDir, "fcu-field-remediation-signoff-latest.json"),
    fieldRemediationSignoffMd: path.join(docsDir, "fcu-field-remediation-signoff-latest.md"),
    fieldRemediationSignoffReportCsv: path.join(docsDir, "fcu-field-remediation-signoff-latest.csv"),
    fieldRemediationSignoffCleanJson: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.json"),
    fieldRemediationSignoffCleanMd: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.md"),
    fieldRemediationSignoffCurrentCsv: path.join(docsDir, "fcu-field-remediation-signoff-current-only-latest.csv"),
    fieldRemediationSignoffStaleCsv: path.join(docsDir, "fcu-field-remediation-signoff-stale-rows-latest.csv"),
    fieldRemediationSignoffPromoteJson: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.json"),
    fieldRemediationSignoffPromoteMd: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.md"),
    fieldHandoffJson: path.join(docsDir, "fcu-field-handoff-pack-latest.json"),
    fieldHandoffMd: path.join(docsDir, "fcu-field-handoff-pack-latest.md"),
    fieldHandoffCsv: path.join(docsDir, "fcu-field-handoff-pack-latest.csv"),
    fieldReturnTemplateJson: path.join(docsDir, "fcu-field-remediation-return-template-latest.json"),
    fieldReturnTemplateMd: path.join(docsDir, "fcu-field-remediation-return-template-latest.md"),
    fieldReturnTemplateCsv: path.join(docsDir, "fcu-field-remediation-return-template-latest.csv"),
    goLivePreflightJson: path.join(docsDir, "fcu-go-live-preflight-latest.json"),
    goLivePreflightMd: path.join(docsDir, "fcu-go-live-preflight-latest.md"),
    fieldArmCheckJson: path.join(docsDir, "fcu-field-arm-check-latest.json"),
    fieldArmCheckMd: path.join(docsDir, "fcu-field-arm-check-latest.md"),
    canaryReadinessJson: path.join(docsDir, "fcu-canary-readiness-latest.json"),
    canaryReadinessMd: path.join(docsDir, "fcu-canary-readiness-latest.md")
  };
}

function runFcuAdminScript(scriptName, env, acceptedStatuses = [0, 2]) {
  const scriptPath = fileURLToPath(new URL(`../../scripts/${scriptName}`, import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });
  return {
    script: scriptName,
    status: result.status ?? 0,
    accepted: acceptedStatuses.includes(result.status ?? 0),
    stdout: normalizeText(result.stdout).slice(-4000),
    stderr: normalizeText(result.stderr).slice(-4000)
  };
}

function runFcuLocalFieldEvidenceRefreshScripts(paths, siteId) {
  const scripts = {};
  if (!fs.existsSync(paths.quality) || !fs.existsSync(paths.allDevicePlan)) {
    scripts.fieldEvidenceRefresh = {
      script: "local-field-evidence-refresh",
      status: 0,
      accepted: true,
      stdout: "skipped: quality or all-device plan evidence is not available in this output directory",
      stderr: ""
    };
    return scripts;
  }
  scripts.closeout = runFcuAdminScript("check-fcu-field-remediation-closeout.js", {
    SITE_ID: siteId,
    FCU_QUALITY_REMEDIATION_JSON: paths.quality,
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: paths.allDevicePlan,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: paths.closeout,
    FCU_FIELD_REMEDIATION_CLOSEOUT_MD: paths.closeout.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: paths.closeout.replace(/\.json$/, ".csv")
  });
  scripts.workOrders = runFcuAdminScript("build-fcu-field-remediation-work-orders.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: paths.closeout,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: paths.workOrders.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: paths.workOrders.replace(/\.json$/, ".csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.signoffInputCsv
  });
  scripts.executionPack = runFcuAdminScript("build-fcu-field-remediation-execution-pack.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: paths.executionPack,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: paths.executionPack.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: paths.executionPack.replace(/\.json$/, ".csv")
  });
  scripts.signoffAfterFieldRefresh = runFcuAdminScript("check-fcu-field-remediation-signoff.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_CSV: paths.signoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: paths.signoff.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: paths.signoff.replace(/\.json$/, ".csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: paths.signoff.replace(/\.json$/, "-release-matrix.csv")
  });
  return scripts;
}

function runFcuFinalEvidenceRefreshScripts(paths, siteId) {
  const scripts = {};
  const shouldFullRefresh = !fs.existsSync(paths.workOrders);
  if (!shouldFullRefresh) {
    Object.assign(scripts, runFcuLocalFieldEvidenceRefreshScripts(paths, siteId));
  }
  scripts.finalControlGates = runFcuAdminScript("check-fcu-final-control-gates.js", {
    SITE_ID: siteId,
    FCU_FINAL_CONTROL_GATES_OUTPUT_DIR: paths.docsDir,
    FCU_FINAL_CONTROL_GATES_JSON: paths.finalControlGates,
    FCU_FINAL_CONTROL_GATES_MD: paths.finalControlGates.replace(/\.json$/, ".md"),
    FCU_FINAL_CONTROL_GATES_REFRESH: shouldFullRefresh ? "true" : "false"
  });
  scripts.handoff = runFcuAdminScript("build-fcu-field-handoff-pack.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: paths.executionPack,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: paths.finalControlRunbookJson,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_HANDOFF_PACK_MD: paths.fieldHandoffMd,
    FCU_FIELD_HANDOFF_PACK_CSV: paths.fieldHandoffCsv
  });
  scripts.returnTemplate = runFcuAdminScript("build-fcu-field-remediation-return-template.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: paths.returnTemplateJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: paths.returnTemplateMd,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: paths.returnTemplateCsv
  });
  scripts.finalControlWorklist = runFcuAdminScript("build-fcu-final-control-worklist.js", {
    SITE_ID: siteId,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalControlWorklistJson,
    FCU_FINAL_CONTROL_WORKLIST_MD: paths.finalControlWorklistMd,
    FCU_FINAL_CONTROL_GATES_JSON: paths.finalControlGates,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: paths.executionPack,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: paths.returnTemplateJson,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON: paths.finalControlFieldExecutionPackJson,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD: paths.finalControlFieldExecutionPackMd,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV: paths.finalControlFieldExecutionPackCsv,
    FCU_FINAL_WORKLIST_REFRESH_QUALITY: "false",
    FCU_FINAL_WORKLIST_REFRESH_PLAN: "false",
    FCU_FINAL_WORKLIST_REFRESH_CLOSEOUT: "false",
    FCU_FINAL_WORKLIST_REFRESH_WORK_ORDERS: "false",
    FCU_FINAL_WORKLIST_REFRESH_EXECUTION_PACK: "false",
    FCU_FINAL_WORKLIST_REFRESH_HANDOFF: "false",
    FCU_FINAL_WORKLIST_REFRESH_RETURN_TEMPLATE: "false",
    FCU_FINAL_WORKLIST_REFRESH_SIGNOFF: "false",
    FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_CLEAN: "false",
    FCU_FINAL_WORKLIST_REFRESH_SIGNOFF_PROMOTE: "false",
    FCU_FINAL_WORKLIST_REFRESH_CANARY_READINESS: "false",
    FCU_FINAL_WORKLIST_REFRESH_FINAL_FIELD_EXECUTION_PACK: "false"
  });
  scripts.finalControlRunbook = runFcuAdminScript("build-fcu-final-control-runbook.js", {
    SITE_ID: siteId,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: paths.finalControlRunbookJson,
    FCU_FINAL_CONTROL_RUNBOOK_MD: paths.finalControlRunbookMd,
    FCU_FINAL_CONTROL_GATES_JSON: paths.finalControlGates,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalControlWorklistJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean
  });
  scripts.finalControlFieldExecutionPack = runFcuAdminScript("build-fcu-final-control-field-execution-pack.js", {
    SITE_ID: siteId,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalControlWorklistJson,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: paths.finalControlRunbookJson,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_CANARY_READINESS_JSON: paths.canaryReadinessJson,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON: paths.finalControlFieldExecutionPackJson,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD: paths.finalControlFieldExecutionPackMd,
    FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV: paths.finalControlFieldExecutionPackCsv
  });
  scripts.evidenceConsistency = runFcuAdminScript("check-fcu-final-control-evidence-consistency.js", {
    SITE_ID: siteId,
    FCU_FINAL_CONTROL_RUNBOOK_JSON: paths.finalControlRunbookJson,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalControlWorklistJson,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: paths.returnTemplateJson,
    FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_JSON: paths.evidenceConsistencyJson,
    FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_MD: paths.evidenceConsistencyMd
  });
  return scripts;
}

function buildFcuFieldRemediationStatus(config, siteId) {
  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const reports = {
    workOrders: readAdminJsonReport(paths.workOrders, "FCU field remediation work orders"),
    executionPack: readAdminJsonReport(paths.executionPack, "FCU field remediation execution pack"),
    signoff: readAdminJsonReport(paths.signoff, "FCU field remediation signoff"),
    returnTemplate: readAdminJsonReport(paths.returnTemplateJson, "FCU field remediation return template"),
    handoff: readAdminJsonReport(paths.fieldHandoffJson, "FCU field handoff pack"),
    finalControlFieldExecutionPack: readAdminJsonReport(
      paths.finalControlFieldExecutionPackJson,
      "FCU final control field execution pack"
    ),
    finalControlWorklist: readAdminJsonReport(paths.finalControlWorklistJson, "FCU final control worklist"),
    finalControlGates: readAdminJsonReport(paths.finalControlGates, "FCU final control gates")
  };
  const workOrders = reports.workOrders.payload || {};
  const executionPack = reports.executionPack.payload || {};
  const signoff = reports.signoff.payload || {};
  const returnTemplate = reports.returnTemplate.payload || {};
  const handoff = reports.handoff.payload || {};
  const finalControlFieldExecutionPack = reports.finalControlFieldExecutionPack.payload || {};
  const finalControlWorklist = reports.finalControlWorklist.payload || {};
  const finalControlGates = reports.finalControlGates.payload || {};
  return {
    site: { siteId },
    subsystemType: "hvac_terminal",
    equipmentType: "fan_coil",
    controlMutation: false,
    dispatch: false,
    summary: {
      totalWorkOrders: workOrders.summary?.totalWorkOrders ?? null,
      openWorkOrders: workOrders.summary?.openCount ?? null,
      openP0Devices: executionPack.summary?.openP0Devices ?? null,
      signoffComplete: signoff.summary?.signoffComplete === true,
      signoffCompleteRows: signoff.summary?.completeRows ?? null,
      signoffExpectedRows: signoff.summary?.expectedWorkOrders ?? null,
      finalGatePassed: finalControlGates.ok === true,
      finalGatePassedCount: finalControlGates.summary?.passed ?? null,
      finalGateCount: finalControlGates.summary?.gateCount ?? null,
      canaryReady: finalControlGates.summary?.canaryReady === true
    },
    workOrders: {
      ok: workOrders.ok === true,
      summary: workOrders.summary || null,
      items: Array.isArray(workOrders.workOrders) ? workOrders.workOrders : [],
      outputs: workOrders.outputs || null
    },
    executionPack: {
      ok: executionPack.ok === true,
      summary: executionPack.summary || null,
      reasonCounts: executionPack.summary?.reasonCounts || {},
      executionOrder: Array.isArray(executionPack.executionOrder) ? executionPack.executionOrder : [],
      outputs: executionPack.outputs || null
    },
    signoff: {
      ok: signoff.ok === true,
      summary: signoff.summary || null,
      openRecords: Array.isArray(signoff.openRecords) ? signoff.openRecords : [],
      releaseMatrix: Array.isArray(signoff.releaseMatrix) ? signoff.releaseMatrix : [],
      onsiteReleasePrecheck: signoff.onsiteReleasePrecheck || null,
      outputs: signoff.outputs || null
    },
    returnTemplate: {
      ok: returnTemplate.ok === true,
      summary: returnTemplate.summary || null,
      devices: Array.isArray(returnTemplate.devices) ? returnTemplate.devices : [],
      outputs: returnTemplate.outputs || null,
      requiredColumns: Array.isArray(returnTemplate.requiredColumns) ? returnTemplate.requiredColumns : [],
      rerunCommands: Array.isArray(returnTemplate.rerunCommands) ? returnTemplate.rerunCommands : [],
      safetyBoundary: Array.isArray(returnTemplate.safetyBoundary) ? returnTemplate.safetyBoundary : [],
      controlMutation: returnTemplate.controlMutation === true,
      dispatch: returnTemplate.dispatch === true
    },
    handoff: {
      ok: handoff.ok === true,
      summary: handoff.summary || null,
      conclusion: handoff.conclusion || null,
      todaySequence: Array.isArray(handoff.todaySequence) ? handoff.todaySequence : [],
      staleSignoffRows: Array.isArray(handoff.staleSignoffRows) ? handoff.staleSignoffRows : [],
      devices: Array.isArray(handoff.devices) ? handoff.devices : [],
      outputFiles: handoff.outputFiles || null,
      safetyBoundary: Array.isArray(handoff.safetyBoundary) ? handoff.safetyBoundary : [],
      controlMutation: handoff.controlMutation === true,
      dispatch: handoff.dispatch === true
    },
    fieldRemediationPlaybook: finalControlWorklist.fieldRemediationPlaybook || null,
    canaryReadiness: finalControlWorklist.fieldPackages?.canaryReadiness || null,
    finalControlFieldExecutionPack: {
      ok: finalControlFieldExecutionPack.ok === true,
      summary: finalControlFieldExecutionPack.summary || null,
      outputFiles: finalControlFieldExecutionPack.outputFiles || null,
      finalReleaseChecklist: Array.isArray(finalControlFieldExecutionPack.finalReleaseChecklist)
        ? finalControlFieldExecutionPack.finalReleaseChecklist
        : [],
      deviceQueue: Array.isArray(finalControlFieldExecutionPack.deviceQueue)
        ? finalControlFieldExecutionPack.deviceQueue
        : [],
      safetyBoundary: Array.isArray(finalControlFieldExecutionPack.safetyBoundary)
        ? finalControlFieldExecutionPack.safetyBoundary
        : [],
      controlMutation: finalControlFieldExecutionPack.controlMutation === true,
      dispatch: finalControlFieldExecutionPack.dispatch === true
    },
    finalControlGates: {
      ok: finalControlGates.ok === true,
      summary: finalControlGates.summary || null,
      blockers: Array.isArray(finalControlGates.blockers) ? finalControlGates.blockers : [],
      nextActions: Array.isArray(finalControlGates.nextActions) ? finalControlGates.nextActions : [],
      outputs: finalControlGates.outputs || null,
      controlMutation: finalControlGates.controlMutation === true
    },
    reportStatuses: Object.fromEntries(Object.entries(reports).map(([key, item]) => [
      key,
      {
        status: item.status,
        sourceFile: item.sourceFile,
        error: item.error
      }
    ]))
  };
}

function runFcuFieldRemediationSignoffPreview(config, siteId, signoffCsvText) {
  const text = typeof signoffCsvText === "string" ? signoffCsvText : "";
  if (!normalizeText(text)) {
    throw badRequest("signoffCsvText is required", {
      field: "signoffCsvText",
      hint: "请粘贴 FCU 现场签字 CSV 内容后再校验。"
    });
  }
  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-preview-"));
  const inputCsv = path.join(tmpDir, "signoff-input.csv");
  const outputJson = path.join(tmpDir, "signoff-preview.json");
  const outputMd = path.join(tmpDir, "signoff-preview.md");
  const outputCsv = path.join(tmpDir, "signoff-preview.csv");
  const releaseMatrixCsv = path.join(tmpDir, "signoff-preview-release-matrix.csv");
  fs.writeFileSync(inputCsv, text);
  const scriptPath = fileURLToPath(new URL("../../scripts/check-fcu-field-remediation-signoff.js", import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      SITE_ID: siteId,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
      FCU_FIELD_REMEDIATION_SIGNOFF_CSV: inputCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: outputJson,
      FCU_FIELD_REMEDIATION_SIGNOFF_MD: outputMd,
      FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: outputCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: releaseMatrixCsv
    },
    encoding: "utf8"
  });
  const report = readAdminJsonReport(outputJson, "FCU field remediation signoff preview");
  const payload = report.payload || {};
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return {
    site: { siteId },
    controlMutation: false,
    dispatch: false,
    persisted: false,
    mode: "preview",
    script: {
      status: result.status ?? 0,
      accepted: result.status === 0 || result.status === 2,
      stdout: normalizeText(result.stdout).slice(-4000),
      stderr: normalizeText(result.stderr).slice(-4000)
    },
    ok: payload.ok === true,
    summary: payload.summary || null,
    records: Array.isArray(payload.records) ? payload.records : [],
    releaseMatrix: Array.isArray(payload.releaseMatrix) ? payload.releaseMatrix : [],
    ignoredRecords: Array.isArray(payload.ignoredRecords) ? payload.ignoredRecords : [],
    source: {
      workOrdersJson: paths.workOrders,
      signoffCsv: "request_body"
    }
  };
}

function runFcuFieldRemediationSignoffPromote(config, siteId, signoffCsvText, confirmPhrase) {
  const text = typeof signoffCsvText === "string" ? signoffCsvText : "";
  if (!normalizeText(text)) {
    throw badRequest("signoffCsvText is required", {
      field: "signoffCsvText",
      hint: "请粘贴 FCU 现场签字 CSV 内容后再保存。"
    });
  }
  if (normalizeText(confirmPhrase) !== FCU_SIGNOFF_PROMOTE_CONFIRM) {
    throw badRequest("FCU signoff promote confirmation is required", {
      field: "confirmPhrase",
      confirmRequired: FCU_SIGNOFF_PROMOTE_CONFIRM,
      hint: "保存会替换现场签字输入 CSV；该动作不下发 BA/PLC。"
    });
  }

  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const preview = runFcuFieldRemediationSignoffPreview(config, siteId, text);
  if ((preview.summary?.missingColumns || []).length > 0) {
    throw badRequest("FCU signoff CSV is missing required columns", {
      field: "signoffCsvText",
      missingColumns: preview.summary.missingColumns
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fcu-admin-signoff-promote-"));
  const requestInputCsv = path.join(tmpDir, "request-signoff-input.csv");
  fs.writeFileSync(requestInputCsv, text);
  try {
    const scripts = {};
    scripts.clean = runFcuAdminScript("build-fcu-field-remediation-signoff-clean-input.js", {
      SITE_ID: siteId,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: requestInputCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: paths.signoffCleanMd,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: paths.signoffCurrentCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: paths.signoffStaleCsv
    });
    if (!scripts.clean.accepted) {
      throw badRequest("FCU signoff clean step failed", { script: scripts.clean });
    }

    scripts.promote = runFcuAdminScript("promote-fcu-field-remediation-signoff-input.js", {
      SITE_ID: siteId,
      FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
      FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.signoffInputCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: paths.signoffPromote,
      FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: paths.signoffPromoteMd,
      FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM: FCU_SIGNOFF_PROMOTE_CONFIRM
    }, [0]);
    if (!scripts.promote.accepted) {
      throw badRequest("FCU signoff promote step failed", { script: scripts.promote });
    }

    scripts.signoff = runFcuAdminScript("check-fcu-field-remediation-signoff.js", {
      SITE_ID: siteId,
      FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
      FCU_FIELD_REMEDIATION_SIGNOFF_CSV: paths.signoffInputCsv,
      FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
      FCU_FIELD_REMEDIATION_SIGNOFF_MD: paths.signoff.replace(/\.json$/, ".md"),
      FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: paths.signoff.replace(/\.json$/, ".csv"),
      FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: paths.signoff.replace(/\.json$/, "-release-matrix.csv")
    });

    Object.assign(scripts, runFcuFinalEvidenceRefreshScripts(paths, siteId));

    const clean = readAdminJsonReport(paths.signoffClean, "FCU field remediation signoff clean input").payload || {};
    const promote = readAdminJsonReport(paths.signoffPromote, "FCU field remediation signoff promote").payload || {};
    const signoff = readAdminJsonReport(paths.signoff, "FCU field remediation signoff").payload || {};
    const finalControlGates = readAdminJsonReport(paths.finalControlGates, "FCU final control gates").payload || {};
    const finalControlRunbook = readAdminJsonReport(paths.finalControlRunbookJson, "FCU final control runbook").payload || {};
    const evidenceConsistency = readAdminJsonReport(paths.evidenceConsistencyJson, "FCU final control evidence consistency").payload || {};
    return {
      site: { siteId },
      controlMutation: false,
      dispatch: false,
      persisted: promote.fileMutation === true,
      mode: "promote",
      confirmRequired: FCU_SIGNOFF_PROMOTE_CONFIRM,
      ok: signoff.ok === true && finalControlGates.ok === true,
      scripts,
      preview,
      clean: {
        ok: clean.ok === true,
        summary: clean.summary || null,
        outputs: clean.outputs || null,
        staleRecords: Array.isArray(clean.staleRecords) ? clean.staleRecords : []
      },
      promote: {
        ok: promote.ok === true,
        mode: promote.mode || null,
        summary: promote.summary || null,
        target: promote.target || null,
        promoted: promote.promoted || null,
        fileMutation: promote.fileMutation === true
      },
      signoff: {
        ok: signoff.ok === true,
        summary: signoff.summary || null,
        openRecords: Array.isArray(signoff.openRecords) ? signoff.openRecords : [],
        releaseMatrix: Array.isArray(signoff.releaseMatrix) ? signoff.releaseMatrix : [],
        outputs: signoff.outputs || null
      },
      finalControlGates: {
        ok: finalControlGates.ok === true,
        summary: finalControlGates.summary || null,
        blockers: Array.isArray(finalControlGates.blockers) ? finalControlGates.blockers : [],
        nextActions: Array.isArray(finalControlGates.nextActions) ? finalControlGates.nextActions : [],
        controlMutation: finalControlGates.controlMutation === true
      },
      finalControlRunbook: {
        ok: finalControlRunbook.ok === true,
        verdict: finalControlRunbook.verdict || null,
        summary: finalControlRunbook.summary || null,
        controlMutation: finalControlRunbook.controlMutation === true,
        dispatch: finalControlRunbook.dispatch === true
      },
      evidenceConsistency: {
        ok: evidenceConsistency.ok === true,
        verdict: evidenceConsistency.verdict || null,
        summary: evidenceConsistency.summary || null,
        issues: Array.isArray(evidenceConsistency.issues) ? evidenceConsistency.issues : [],
        controlMutation: evidenceConsistency.controlMutation === true,
        dispatch: evidenceConsistency.dispatch === true
      },
      refreshedStatus: buildFcuFieldRemediationStatus(config, siteId)
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runFcuFieldRemediationSignoffCleanPromote(config, siteId, confirmPhrase) {
  if (normalizeText(confirmPhrase) !== FCU_SIGNOFF_PROMOTE_CONFIRM) {
    throw badRequest("FCU signoff clean confirmation is required", {
      field: "confirmPhrase",
      confirmRequired: FCU_SIGNOFF_PROMOTE_CONFIRM,
      hint: "清理旧签字行会备份并替换现场签字输入 CSV；该动作不下发 BA/PLC。"
    });
  }
  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const scripts = {};
  scripts.clean = runFcuAdminScript("build-fcu-field-remediation-signoff-clean-input.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.signoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: paths.signoffCleanMd,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: paths.signoffCurrentCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: paths.signoffStaleCsv
  });
  if (!scripts.clean.accepted) {
    throw badRequest("FCU signoff clean step failed", { script: scripts.clean });
  }
  scripts.promote = runFcuAdminScript("promote-fcu-field-remediation-signoff-input.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.signoffClean,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.signoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: paths.signoffPromote,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: paths.signoffPromoteMd,
    FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM: FCU_SIGNOFF_PROMOTE_CONFIRM
  }, [0]);
  if (!scripts.promote.accepted) {
    throw badRequest("FCU signoff promote step failed", { script: scripts.promote });
  }
  scripts.signoff = runFcuAdminScript("check-fcu-field-remediation-signoff.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_CSV: paths.signoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: paths.signoff.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: paths.signoff.replace(/\.json$/, ".csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: paths.signoff.replace(/\.json$/, "-release-matrix.csv")
  });
  Object.assign(scripts, runFcuFinalEvidenceRefreshScripts(paths, siteId));

  const clean = readAdminJsonReport(paths.signoffClean, "FCU field remediation signoff clean input").payload || {};
  const promote = readAdminJsonReport(paths.signoffPromote, "FCU field remediation signoff promote").payload || {};
  const signoff = readAdminJsonReport(paths.signoff, "FCU field remediation signoff").payload || {};
  const finalControlGates = readAdminJsonReport(paths.finalControlGates, "FCU final control gates").payload || {};
  return {
    site: { siteId },
    controlMutation: false,
    dispatch: false,
    fileMutation: promote.fileMutation === true,
    mode: "clean_promote",
    ok: signoff.ok === true && finalControlGates.ok === true,
    scripts,
    clean: {
      ok: clean.ok === true,
      summary: clean.summary || null,
      staleRecords: Array.isArray(clean.staleRecords) ? clean.staleRecords : [],
      outputs: clean.outputs || null
    },
    promote: {
      ok: promote.ok === true,
      mode: promote.mode || null,
      summary: promote.summary || null,
      target: promote.target || null,
      promoted: promote.promoted || null,
      fileMutation: promote.fileMutation === true
    },
    signoff: {
      ok: signoff.ok === true,
      summary: signoff.summary || null,
      ignoredRecords: Array.isArray(signoff.ignoredRecords) ? signoff.ignoredRecords : [],
      openRecords: Array.isArray(signoff.openRecords) ? signoff.openRecords : [],
      releaseMatrix: Array.isArray(signoff.releaseMatrix) ? signoff.releaseMatrix : [],
      outputs: signoff.outputs || null
    },
    finalControlGates: {
      ok: finalControlGates.ok === true,
      summary: finalControlGates.summary || null,
      blockers: Array.isArray(finalControlGates.blockers) ? finalControlGates.blockers : [],
      nextActions: Array.isArray(finalControlGates.nextActions) ? finalControlGates.nextActions : [],
      controlMutation: finalControlGates.controlMutation === true
    },
    refreshedStatus: buildFcuFieldRemediationStatus(config, siteId)
  };
}

function runFcuFieldRemediationStatusRefresh(config, siteId) {
  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const scripts = runFcuFinalEvidenceRefreshScripts(paths, siteId);
  const status = buildFcuFieldRemediationStatus(config, siteId);
  return {
    site: { siteId },
    controlMutation: false,
    dispatch: false,
    fileMutation: true,
    mode: "refresh",
    ok: status.finalControlGates?.ok === true,
    scripts,
    status
  };
}

function normalizeFcuSignoffRowPayload(body = {}) {
  const record = body.record && typeof body.record === "object" ? body.record : body;
  const normalized = {};
  for (const column of FCU_SIGNOFF_COLUMNS) {
    normalized[column] = normalizeText(record[column]);
  }
  if (!normalized.workOrderId) {
    throw badRequest("workOrderId is required", { field: "workOrderId" });
  }
  if (!normalized.deviceCode) {
    throw badRequest("deviceCode is required", { field: "deviceCode" });
  }
  return normalized;
}

function updateFcuSignoffInputCsvRow(filePath, record) {
  const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const rows = parseCsvRows(existingText);
  const header = rows[0]?.length ? rows[0] : FCU_SIGNOFF_COLUMNS;
  const outputHeader = Array.from(new Set([...header, ...FCU_SIGNOFF_COLUMNS]));
  const records = rows.slice(1).map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
  const rowIndex = records.findIndex((item) => normalizeText(item.workOrderId) === record.workOrderId);
  if (rowIndex >= 0) {
    records[rowIndex] = {
      ...records[rowIndex],
      ...record
    };
  } else {
    records.push(record);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderCsv(outputHeader, records));
  return {
    header: outputHeader,
    rowCount: records.length,
    updatedExisting: rowIndex >= 0
  };
}

function runFcuFieldRemediationSignoffRowSave(config, siteId, body) {
  if (normalizeText(body?.confirmPhrase) !== FCU_SIGNOFF_PROMOTE_CONFIRM) {
    throw badRequest("FCU signoff row save confirmation is required", {
      field: "confirmPhrase",
      confirmRequired: FCU_SIGNOFF_PROMOTE_CONFIRM,
      hint: "保存单台签字行会更新现场签字输入 CSV；该动作不下发 BA/PLC。"
    });
  }
  const paths = buildFcuFieldRemediationReportPaths(config, siteId);
  const record = normalizeFcuSignoffRowPayload(body?.record || body || {});
  const csvUpdate = updateFcuSignoffInputCsvRow(paths.signoffInputCsv, record);

  const scripts = {};
  scripts.signoff = runFcuAdminScript("check-fcu-field-remediation-signoff.js", {
    SITE_ID: siteId,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.workOrders,
    FCU_FIELD_REMEDIATION_SIGNOFF_CSV: paths.signoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.signoff,
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: paths.signoff.replace(/\.json$/, ".md"),
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: paths.signoff.replace(/\.json$/, ".csv"),
    FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: paths.signoff.replace(/\.json$/, "-release-matrix.csv")
  });
  Object.assign(scripts, runFcuFinalEvidenceRefreshScripts(paths, siteId));

  const signoff = readAdminJsonReport(paths.signoff, "FCU field remediation signoff").payload || {};
  const finalControlGates = readAdminJsonReport(paths.finalControlGates, "FCU final control gates").payload || {};
  const finalControlRunbook = readAdminJsonReport(paths.finalControlRunbookJson, "FCU final control runbook").payload || {};
  const evidenceConsistency = readAdminJsonReport(paths.evidenceConsistencyJson, "FCU final control evidence consistency").payload || {};
  return {
    site: { siteId },
    controlMutation: false,
    dispatch: false,
    fileMutation: true,
    mode: "row_save",
    ok: signoff.ok === true && finalControlGates.ok === true,
    record,
    csvUpdate,
    scripts,
    signoff: {
      ok: signoff.ok === true,
      summary: signoff.summary || null,
      openRecords: Array.isArray(signoff.openRecords) ? signoff.openRecords : [],
      releaseMatrix: Array.isArray(signoff.releaseMatrix) ? signoff.releaseMatrix : [],
      outputs: signoff.outputs || null
    },
    finalControlGates: {
      ok: finalControlGates.ok === true,
      summary: finalControlGates.summary || null,
      blockers: Array.isArray(finalControlGates.blockers) ? finalControlGates.blockers : [],
      nextActions: Array.isArray(finalControlGates.nextActions) ? finalControlGates.nextActions : [],
      controlMutation: finalControlGates.controlMutation === true
    },
    finalControlRunbook: {
      ok: finalControlRunbook.ok === true,
      verdict: finalControlRunbook.verdict || null,
      summary: finalControlRunbook.summary || null,
      controlMutation: finalControlRunbook.controlMutation === true,
      dispatch: finalControlRunbook.dispatch === true
    },
    evidenceConsistency: {
      ok: evidenceConsistency.ok === true,
      verdict: evidenceConsistency.verdict || null,
      summary: evidenceConsistency.summary || null,
      issues: Array.isArray(evidenceConsistency.issues) ? evidenceConsistency.issues : [],
      controlMutation: evidenceConsistency.controlMutation === true,
      dispatch: evidenceConsistency.dispatch === true
    },
    refreshedStatus: buildFcuFieldRemediationStatus(config, siteId)
  };
}

function runFcuDeviceFieldArmPackage(config, siteId, deviceCode) {
  const normalizedDeviceCode = normalizeText(deviceCode);
  if (!normalizedDeviceCode) {
    throw badRequest("deviceCode is required", { field: "deviceCode" });
  }
  const paths = buildFcuAdminCanaryPaths(config, normalizedDeviceCode, siteId);
  const scripts = {};
  scripts.canaryWindow = runFcuAdminScript("execute-fcu-canary-window.js", {
    SITE_ID: siteId,
    FCU_CANARY_DEVICE_CODE: normalizedDeviceCode,
    BFF_BASE_URL: process.env.BFF_BASE_URL || "http://127.0.0.1:8787",
    FCU_CANARY_WINDOW_JSON: paths.canaryWindowJson,
    FCU_CANARY_WINDOW_MD: paths.canaryWindowMd,
    FCU_CANARY_EXECUTION_PACKAGE_JSON: paths.canaryExecutionPackageJson,
    FCU_CANARY_EXECUTION_PACKAGE_MD: paths.canaryExecutionPackageMd,
    FCU_CANARY_EXECUTION_PACKAGE_CSV: paths.canaryExecutionPackageCsv,
    FCU_BA_WRITE_ADAPTER_READINESS_JSON: paths.adapterReadinessJson,
    FCU_BA_WRITE_ADAPTER_READINESS_MD: paths.adapterReadinessMd,
    FCU_BA_WRITE_ADAPTER_READINESS_CSV: paths.adapterReadinessCsv,
    FCU_CANARY_DISPATCH_JSON: paths.canaryDispatchJson,
    FCU_CANARY_DISPATCH_MD: paths.canaryDispatchMd,
    FCU_CANARY_FEEDBACK_MONITOR_JSON: paths.feedbackMonitorJson,
    FCU_CANARY_FEEDBACK_MONITOR_MD: paths.feedbackMonitorMd,
    FCU_CANARY_FEEDBACK_MONITOR_CSV: paths.feedbackMonitorCsv,
    FCU_FINAL_CONTROL_COMPLETION_JSON: paths.finalCompletionJson,
    FCU_FINAL_CONTROL_COMPLETION_MD: paths.finalCompletionMd,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalWorklistJson,
    FCU_FINAL_CONTROL_WORKLIST_MD: paths.finalWorklistMd,
    FCU_QUALITY_REMEDIATION_JSON: paths.qualityRemediationJson,
    FCU_QUALITY_REMEDIATION_MD: paths.qualityRemediationMd,
    FCU_QUALITY_REMEDIATION_CSV: paths.qualityRemediationCsv,
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: paths.allDevicePlanJson,
    FCU_ALL_DEVICE_DISPATCH_PLAN_MD: paths.allDevicePlanMd,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: paths.fieldRemediationCloseoutJson,
    FCU_FIELD_REMEDIATION_CLOSEOUT_MD: paths.fieldRemediationCloseoutMd,
    FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: paths.fieldRemediationCloseoutCsv,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.fieldRemediationWorkOrdersJson,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: paths.fieldRemediationWorkOrdersMd,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: paths.fieldRemediationWorkOrdersCsv,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: paths.fieldRemediationExecutionPackJson,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: paths.fieldRemediationExecutionPackMd,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: paths.fieldRemediationExecutionPackCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.fieldRemediationSignoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.fieldRemediationSignoffJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_MD: paths.fieldRemediationSignoffMd,
    FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: paths.fieldRemediationSignoffReportCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.fieldRemediationSignoffCleanJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: paths.fieldRemediationSignoffCleanMd,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: paths.fieldRemediationSignoffCurrentCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: paths.fieldRemediationSignoffStaleCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: paths.fieldRemediationSignoffPromoteJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: paths.fieldRemediationSignoffPromoteMd,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_HANDOFF_PACK_MD: paths.fieldHandoffMd,
    FCU_FIELD_HANDOFF_PACK_CSV: paths.fieldHandoffCsv,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: paths.fieldReturnTemplateJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: paths.fieldReturnTemplateMd,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: paths.fieldReturnTemplateCsv,
    FCU_SIGNOFF_INPUT_PROMOTE_CONFIRM: "",
    FCU_GO_LIVE_PREFLIGHT_JSON: paths.goLivePreflightJson,
    FCU_GO_LIVE_PREFLIGHT_MD: paths.goLivePreflightMd,
    FCU_FIELD_ARM_CHECK_JSON: paths.fieldArmCheckJson,
    FCU_FIELD_ARM_CHECK_MD: paths.fieldArmCheckMd,
    FCU_CANARY_READINESS_JSON: paths.canaryReadinessJson,
    FCU_CANARY_READINESS_MD: paths.canaryReadinessMd,
    FCU_SMALL_BATCH_CONFIRM: "",
    FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: ""
  });

  scripts.fieldArmPackage = runFcuAdminScript("build-fcu-field-arm-package.js", {
    SITE_ID: siteId,
    FCU_CANARY_DEVICE_CODE: normalizedDeviceCode,
    FCU_CANARY_WINDOW_JSON: paths.canaryWindowJson,
    FCU_CANARY_EXECUTION_PACKAGE_JSON: paths.canaryExecutionPackageJson,
    FCU_BA_WRITE_ADAPTER_READINESS_JSON: paths.adapterReadinessJson,
    FCU_CANARY_FEEDBACK_MONITOR_JSON: paths.feedbackMonitorJson,
    FCU_FIELD_ARM_PACKAGE_JSON: paths.fieldArmPackageJson,
    FCU_FIELD_ARM_PACKAGE_MD: paths.fieldArmPackageMd,
    FCU_FIELD_ARM_PACKAGE_CSV: paths.fieldArmPackageCsv,
    FCU_FINAL_CONTROL_WORKLIST_JSON: paths.finalWorklistJson,
    FCU_FINAL_CONTROL_COMPLETION_JSON: paths.finalCompletionJson,
    FCU_QUALITY_REMEDIATION_JSON: paths.qualityRemediationJson,
    FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: paths.allDevicePlanJson,
    FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: paths.fieldRemediationCloseoutJson,
    FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: paths.fieldRemediationWorkOrdersJson,
    FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: paths.fieldRemediationExecutionPackJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: paths.fieldRemediationSignoffInputCsv,
    FCU_FIELD_REMEDIATION_SIGNOFF_JSON: paths.fieldRemediationSignoffJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: paths.fieldRemediationSignoffCleanJson,
    FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: paths.fieldRemediationSignoffPromoteJson,
    FCU_FIELD_HANDOFF_PACK_JSON: paths.fieldHandoffJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: paths.fieldReturnTemplateJson,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: paths.fieldReturnTemplateMd,
    FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: paths.fieldReturnTemplateCsv,
    FCU_SMALL_BATCH_CONFIRM: "",
    FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: ""
  });

  const canaryWindow = readAdminJsonReport(paths.canaryWindowJson, "FCU canary window").payload || {};
  const canaryExecutionPackage = readAdminJsonReport(paths.canaryExecutionPackageJson, "FCU canary execution package").payload || {};
  const adapterReadiness = readAdminJsonReport(paths.adapterReadinessJson, "FCU BA write adapter readiness").payload || {};
  const feedbackMonitor = readAdminJsonReport(paths.feedbackMonitorJson, "FCU canary feedback monitor").payload || {};
  const fieldArmPackage = readAdminJsonReport(paths.fieldArmPackageJson, "FCU field arm package").payload || {};
  return {
    site: { siteId },
    deviceCode: normalizedDeviceCode,
    controlMutation: false,
    dispatch: false,
    mode: "field_arm_package",
    ok: fieldArmPackage.ok === true,
    scripts,
    canaryWindow: {
      ok: canaryWindow.ok === true,
      verdict: canaryWindow.verdict || null,
      canary: canaryWindow.canary || null,
      blockers: Array.isArray(canaryWindow.blockers) ? canaryWindow.blockers : [],
      outputs: canaryWindow.outputs || null
    },
    canaryExecutionPackage: {
      ok: canaryExecutionPackage.ok === true,
      verdict: canaryExecutionPackage.verdict || null,
      canary: canaryExecutionPackage.canary || null,
      blockers: Array.isArray(canaryExecutionPackage.blockers) ? canaryExecutionPackage.blockers : [],
      conditions: Array.isArray(canaryExecutionPackage.conditions) ? canaryExecutionPackage.conditions : [],
      outputs: canaryExecutionPackage.outputs || null
    },
    baWriteAdapterReadiness: {
      ok: adapterReadiness.ok === true,
      verdict: adapterReadiness.verdict || null,
      blockingItems: Array.isArray(adapterReadiness.blockingItems) ? adapterReadiness.blockingItems : [],
      checks: Array.isArray(adapterReadiness.checks) ? adapterReadiness.checks : [],
      outputs: adapterReadiness.outputs || null,
      controlMutation: adapterReadiness.controlMutation === true
    },
    canaryFeedbackMonitor: {
      ok: feedbackMonitor.ok === true,
      verdict: feedbackMonitor.verdict || null,
      feedbackStatus: feedbackMonitor.feedbackStatus || null,
      blockers: Array.isArray(feedbackMonitor.blockers) ? feedbackMonitor.blockers : [],
      outputs: feedbackMonitor.outputs || null,
      controlMutation: feedbackMonitor.controlMutation === true,
      dispatch: feedbackMonitor.dispatch === true
    },
    fieldArmPackage: {
      ok: fieldArmPackage.ok === true,
      verdict: fieldArmPackage.verdict || null,
      checklist: Array.isArray(fieldArmPackage.checklist) ? fieldArmPackage.checklist : [],
      blockers: Array.isArray(fieldArmPackage.blockers) ? fieldArmPackage.blockers : [],
      canary: fieldArmPackage.canary || null,
      outputs: fieldArmPackage.outputs || null
    },
    refreshedStatus: buildFcuFieldRemediationStatus(config, siteId)
  };
}

export function buildAdminRouter(options) {
  const router = Router();
  const { adminStore, authService, config } = options;

  router.use((req, _res, next) => {
    if (!req.adminUser) {
      next(unauthorized("Missing admin user context"));
      return;
    }
    next();
  });

  router.get("/me", async (req, res, next) => {
    try {
      const user = req.adminUser;
      if (matchesBootstrap(user, config)) {
        adminStore.bootstrapPlatformAdmin(user, {
          requestId: req.requestId
        });
      }

      let context = requireAdminContext(adminStore, user.userId);
      let autoImportedSiteIds = [];
      if (context.platformRole === "platform_admin") {
        const projects = await authService.fetchProjectRoster(req.adminToken, user.userId);
        autoImportedSiteIds = adminStore.importSites(projects, user, {
          requestId: req.requestId
        });
        context = requireAdminContext(adminStore, user.userId);
      }

      toResponse(res, req.requestId, buildMeResponse(adminStore, context, req.requestId, autoImportedSiteIds));
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites", (req, res, next) => {
    try {
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      const items = adminStore.listSites(
        {
          keyword: normalizeText(req.query.keyword),
          status: normalizeText(req.query.status)
        },
        getAccessContext(context)
      );
      toResponse(res, req.requestId, {
        items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites", (req, res, next) => {
    try {
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      if (context.platformRole !== "platform_admin") {
        throw forbidden("Only platform admins can register sites");
      }
      const created = adminStore.createSite(normalizeSitePayload(req.body || {}), req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, { site: created }, 201);
    } catch (error) {
      next(error);
    }
  });

  router.get("/subsystem-registry", (req, res, next) => {
    try {
      requireAdminContext(adminStore, req.adminUser.userId);
      const items = adminStore.listSubsystemRegistry();
      toResponse(res, req.requestId, {
        items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const site = adminStore.assertSiteExists(siteId);
      toResponse(res, req.requestId, { site });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const payload = normalizeSitePayload({
        ...(req.body || {}),
        siteId
      }, {
        allowMissingStatus: true
      });
      const updated = adminStore.updateSite(siteId, payload, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, { site: updated });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/subsystems", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const subsystems = adminStore.listSiteSubsystems(siteId);
      toResponse(res, req.requestId, subsystems);
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/subsystems", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const subsystems = adminStore.upsertSiteSubsystems(siteId, req.body || {}, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, subsystems);
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/stations", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const stations = adminStore.listStationInstances(siteId, {
        publishedOnly: normalizeText(req.query.publishedOnly).toLowerCase() === "true",
        parentSubsystemType: normalizeText(req.query.parentSubsystemType)
      });
      toResponse(res, req.requestId, stations);
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/stations", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const stations = adminStore.upsertStationInstances(siteId, req.body || {}, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, stations);
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/stations/:stationId/runtime-binding", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const stationId = normalizeText(req.params.stationId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const state = adminStore.getStationRuntimeBindingState(siteId, stationId);
      toResponse(res, req.requestId, {
        siteId,
        stationId,
        binding: state.draftBinding || state.publishedBinding,
        draftBinding: state.draftBinding,
        publishedBinding: state.publishedBinding,
        draftVersion: state.draftVersion,
        publishedVersion: state.publishedVersion,
        configured: Boolean(state.draftBinding || state.publishedBinding)
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/stations/:stationId/runtime-binding", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const stationId = normalizeText(req.params.stationId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const binding = adminStore.upsertStationRuntimeBinding(
        siteId,
        stationId,
        req.body || {},
        req.adminUser,
        { requestId: req.requestId }
      );
      const state = adminStore.getStationRuntimeBindingState(siteId, stationId);
      toResponse(res, req.requestId, {
        siteId,
        stationId,
        binding,
        draftBinding: state.draftBinding,
        publishedBinding: state.publishedBinding,
        draftVersion: state.draftVersion,
        publishedVersion: state.publishedVersion,
        configured: true
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/stations/:stationId/runtime-binding/validate", async (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const stationId = normalizeText(req.params.stationId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const expectedVersion = Number(req.body?.expectedVersion);
      const binding = adminStore.getStationRuntimeBinding(siteId, stationId, { view: "draft" });
      if (!binding || binding.bindingVersion !== expectedVersion) {
        const state = adminStore.getStationRuntimeBindingState(siteId, stationId);
        throw conflict("expectedVersion does not identify the current draft", {
          field: "expectedVersion",
          expectedVersion,
          currentVersion: state.draftVersion || state.publishedVersion || 0
        });
      }
      const runtimeConfig = resolveSiteRuntimeConfig(config, adminStore, siteId);
      const validation = await validateStationRuntimeBindingSource(runtimeConfig, siteId, binding);
      const validatedBinding = adminStore.recordStationRuntimeBindingValidation(
        siteId,
        stationId,
        expectedVersion,
        validation,
        req.adminUser,
        { requestId: req.requestId }
      );
      const state = adminStore.getStationRuntimeBindingState(siteId, stationId);
      const responseBody = {
        siteId,
        stationId,
        binding: validatedBinding,
        draftBinding: state.draftBinding,
        publishedBinding: state.publishedBinding,
        draftVersion: state.draftVersion,
        publishedVersion: state.publishedVersion,
        validation
      };
      if (validation.ok) {
        toResponse(res, req.requestId, responseBody);
      } else {
        res.status(422).json({
          ok: false,
          code: "STATION_RUNTIME_BINDING_VALIDATION_FAILED",
          error: "Station runtime binding did not pass real-source validation.",
          requestId: req.requestId,
          ...responseBody
        });
      }
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/stations/:stationId/runtime-binding/publish", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const stationId = normalizeText(req.params.stationId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      if (context.platformRole !== "platform_admin") {
        throw forbidden("Only platform admins can publish station runtime bindings");
      }
      const binding = adminStore.publishStationRuntimeBinding(
        siteId,
        stationId,
        req.body?.expectedVersion,
        req.adminUser,
        { requestId: req.requestId }
      );
      const state = adminStore.getStationRuntimeBindingState(siteId, stationId);
      toResponse(res, req.requestId, {
        siteId,
        stationId,
        binding,
        draftVersion: state.draftVersion,
        publishedVersion: state.publishedVersion,
        configured: true
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/capabilities", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const capabilities = adminStore.getSiteCapabilities(siteId, {
        publishedOnly: normalizeText(req.query.publishedOnly).toLowerCase() === "true"
      });
      toResponse(res, req.requestId, capabilities);
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/control-policy", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const record = adminStore.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
      toResponse(res, req.requestId, {
        site: {
          siteId
        },
        policy: normalizeFcuControlPolicy(record?.policy || buildDefaultFcuControlPolicy()),
        persisted: Boolean(record),
        updatedAt: record?.updatedAt || null
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-status", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      toResponse(res, req.requestId, buildFcuFieldRemediationStatus(config, siteId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-status/refresh", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      toResponse(res, req.requestId, runFcuFieldRemediationStatusRefresh(config, siteId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-signoff/preview", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      toResponse(
        res,
        req.requestId,
        runFcuFieldRemediationSignoffPreview(config, siteId, req.body?.signoffCsvText || req.body?.text)
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-signoff/promote", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      toResponse(
        res,
        req.requestId,
        runFcuFieldRemediationSignoffPromote(
          config,
          siteId,
          req.body?.signoffCsvText || req.body?.text,
          req.body?.confirmPhrase
        )
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-signoff/clean-promote", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      toResponse(
        res,
        req.requestId,
        runFcuFieldRemediationSignoffCleanPromote(config, siteId, req.body?.confirmPhrase)
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-remediation-signoff/row", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      toResponse(res, req.requestId, runFcuFieldRemediationSignoffRowSave(config, siteId, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-arm-package", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      toResponse(
        res,
        req.requestId,
        runFcuDeviceFieldArmPackage(config, siteId, req.body?.deviceCode || req.query.deviceCode || req.query.device)
      );
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/hvac-terminal/fan-coils/control-policy", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const policy = normalizeFcuControlPolicy(req.body?.policy || req.body || {});
      assertFcuControlPolicyIsSaveable(policy);
      const record = adminStore.upsertFcuControlPolicy(siteId, policy, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, {
        site: {
          siteId
        },
        policy: normalizeFcuControlPolicy(record?.policy || policy),
        persisted: true,
        updatedAt: record?.updatedAt || null
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/point-role-mappings", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const mappings = adminStore.listPointRoleMappings(siteId, {
        subsystemType: normalizeText(req.query.subsystemType)
      });
      toResponse(res, req.requestId, {
        ...mappings,
        total: mappings.items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/point-role-mappings", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const mappings = adminStore.upsertPointRoleMappings(siteId, req.body || {}, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, {
        ...mappings,
        total: mappings.items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/point-role-mappings/import-preview", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const preview = adminStore.previewPointRoleMappingImport(siteId, req.body || {});
      toResponse(res, req.requestId, { preview });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/config-versions", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const versions = adminStore.listConfigVersions(siteId, {
        limit: req.query.limit
      });
      toResponse(res, req.requestId, {
        ...versions,
        total: versions.items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/config-versions/:versionId/publish", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const versionId = normalizeConfigVersionId(req.params.versionId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const version = adminStore.publishConfigVersion(siteId, versionId, req.adminUser, {
        requestId: req.requestId,
        summary: normalizeOptionalText(req.body?.summary)
      });
      toResponse(res, req.requestId, { siteId, version });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/config-versions/:versionId/rollback", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const versionId = normalizeConfigVersionId(req.params.versionId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const result = adminStore.rollbackConfigVersion(siteId, versionId, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, {
        siteId,
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/source-config", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      adminStore.assertSiteExists(siteId);
      toResponse(res, req.requestId, {
        siteId,
        sourceConfig: adminStore.getSiteSourceConfig(siteId),
        effectiveSourceConfig: buildEffectiveSourceConfig(config, adminStore, siteId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/source-config", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const sourceConfig = adminStore.upsertSourceConfig(
        siteId,
        normalizeSourceConfigPayload(req.body || {}),
        req.adminUser,
        {
          requestId: req.requestId
        }
      );
      toResponse(res, req.requestId, {
        siteId,
        sourceConfig,
        effectiveSourceConfig: buildEffectiveSourceConfig(config, adminStore, siteId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/runtime-config", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      adminStore.assertSiteExists(siteId);
      toResponse(res, req.requestId, {
        siteId,
        runtimeConfig: adminStore.getSiteRuntimeConfig(siteId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/runtime-config", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const runtimeConfig = adminStore.upsertRuntimeConfig(
        siteId,
        normalizeRuntimeConfigPayload(req.body || {}),
        req.adminUser,
        {
          requestId: req.requestId
        }
      );
      toResponse(res, req.requestId, {
        siteId,
        runtimeConfig
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sites/:siteId/members", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      const items = adminStore.listSiteMembers(siteId);
      toResponse(res, req.requestId, {
        siteId,
        items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sites/:siteId/members", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const created = adminStore.createSiteMember(
        siteId,
        normalizeSiteMemberPayload(req.body || {}),
        req.adminUser,
        {
          requestId: req.requestId
        }
      );
      toResponse(res, req.requestId, { siteId, member: created }, 201);
    } catch (error) {
      next(error);
    }
  });

  router.put("/sites/:siteId/members/:bindingId", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const bindingId = Number(req.params.bindingId);
      if (!Number.isInteger(bindingId) || bindingId <= 0) {
        throw badRequest("Invalid bindingId", { field: "bindingId" });
      }
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const updated = adminStore.updateSiteMember(
        siteId,
        bindingId,
        assertWritableRole(req.body?.role),
        req.adminUser,
        {
          requestId: req.requestId
        }
      );
      toResponse(res, req.requestId, { siteId, member: updated });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/sites/:siteId/members/:bindingId", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const bindingId = Number(req.params.bindingId);
      if (!Number.isInteger(bindingId) || bindingId <= 0) {
        throw badRequest("Invalid bindingId", { field: "bindingId" });
      }
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanWriteSite(context, siteId);
      const removed = adminStore.deleteSiteMember(siteId, bindingId, req.adminUser, {
        requestId: req.requestId
      });
      toResponse(res, req.requestId, {
        siteId,
        member: removed
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit-logs", (req, res, next) => {
    try {
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanViewAuditLogs(context);
      const items = adminStore.listAuditLogs(
        {
          siteId: normalizeText(req.query.siteId),
          actorUserId: normalizeText(req.query.actorUserId),
          action: normalizeText(req.query.action),
          limit: normalizeText(req.query.limit)
        },
        getAccessContext(context)
      );
      toResponse(res, req.requestId, {
        items,
        total: items.length
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
