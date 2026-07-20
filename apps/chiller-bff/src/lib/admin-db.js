import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

import { badRequest, conflict, notFound } from "./admin-errors.js";
import {
  PHYSICAL_STATION_PARENT_TYPES,
  isPhysicalStationParentType
} from "./energy-object-semantics.js";

const SITE_STATUSES = new Set(["active", "paused", "disabled"]);
const ADMIN_ROLES = new Set(["platform_admin", "site_admin", "auditor"]);
const OPTIMIZE_EXECUTION_STATUSES = new Set(["pending_approval", "approved", "rolled_back"]);
const DEFAULT_OPTIMIZE_EXECUTION_LIMIT = 20;
const MAX_OPTIMIZE_EXECUTION_LIMIT = 100;
const DEFAULT_CHILLER_STAGING_SAMPLE_LIMIT = 500;
const MAX_CHILLER_STAGING_SAMPLE_LIMIT = 2000;
const DEFAULT_HVAC_TERMINAL_SAMPLE_LIMIT = 240;
const MAX_HVAC_TERMINAL_SAMPLE_LIMIT = 2000;
const DEFAULT_HVAC_TERMINAL_SAMPLE_MIN_INTERVAL_SECONDS = 60;
const DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT = 100;
const MAX_SHADOW_VERIFICATION_RECORD_LIMIT = 500;
const DEFAULT_FCU_CONTROL_RECORD_LIMIT = 100;
const MAX_FCU_CONTROL_RECORD_LIMIT = 500;
const SHADOW_VERIFICATION_OUTCOMES = new Set(["improved", "neutral", "regressed", "invalid", "pending"]);
const SUBSYSTEM_STATUSES = new Set(["enabled", "not_configured", "not_applicable"]);
const SUBSYSTEM_MODES = new Set(["monitoring", "optimization_ready", "reserved"]);
const CONTROL_BOUNDARY_MODES = new Set(["read_only", "shadow", "assisted", "enforced"]);
const STATION_RUNTIME_BINDING_STATUSES = new Set([
  "draft",
  "validated",
  "published",
  "superseded",
  "disabled"
]);
const POINT_ROLE_KINDS = new Set([
  "power",
  "temperature",
  "pressure",
  "flow",
  "status",
  "alarm",
  "setpoint",
  "command",
  "feedback"
]);
const STATION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
const STATION_RUNTIME_SOURCE_KEY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,126}[A-Za-z0-9])?$/;

const GLOBAL_REGISTRY_SITE_ID = "__global__";

const DEFAULT_SUBSYSTEM_REGISTRY = [
  {
    subsystemType: "chilled_plant",
    displayName: "冷站系统",
    category: "core",
    description: "冷水机组、冷冻水泵、冷却水泵、冷却塔及冷站群控。",
    defaultStatus: "enabled",
    reserved: false,
    sortOrder: 10,
    pointRoles: [
      { role: "power", label: "冷站总功率", required: true, unit: "kW" },
      { role: "temperature", label: "冷冻/冷却水温度", required: true, unit: "°C" },
      { role: "flow", label: "冷冻/冷却水流量", required: true, unit: "m3/h" },
      { role: "status", label: "设备运行状态", required: true, unit: "" },
      { role: "alarm", label: "设备告警", required: true, unit: "" },
      { role: "setpoint", label: "冷冻水供水设定", required: false, unit: "°C" }
    ]
  },
  {
    subsystemType: "power_monitoring",
    displayName: "电力监控",
    category: "power",
    description: "总表、馈线、需量、功率因数与电能质量监测。",
    defaultStatus: "not_configured",
    reserved: false,
    sortOrder: 20,
    pointRoles: [
      { role: "power", label: "总有功功率", required: true, unit: "kW" },
      { role: "feedback", label: "今日用电量", required: true, unit: "kWh" },
      { role: "feedback", label: "最大需量", required: true, unit: "kW" },
      { role: "feedback", label: "功率因数", required: true, unit: "" },
      { role: "status", label: "馈线状态", required: false, unit: "" },
      { role: "alarm", label: "电力告警", required: false, unit: "" }
    ]
  },
  {
    subsystemType: "compressed_air",
    displayName: "空压站",
    category: "process",
    description: "空压机、干燥机、储气罐、管网压力、泄漏与单耗。",
    defaultStatus: "not_configured",
    reserved: false,
    sortOrder: 30,
    pointRoles: [
      { role: "power", label: "空压站总功率", required: true, unit: "kW" },
      { role: "pressure", label: "管网压力", required: true, unit: "bar" },
      { role: "flow", label: "供气流量", required: true, unit: "Nm3/min" },
      { role: "status", label: "运行/加载状态", required: true, unit: "" },
      { role: "alarm", label: "空压站告警", required: true, unit: "" },
      { role: "temperature", label: "干燥机露点", required: false, unit: "°C" },
      { role: "feedback", label: "单耗/泄漏诊断派生", required: false, unit: "" }
    ]
  },
  {
    subsystemType: "boiler_room",
    displayName: "锅炉房",
    category: "thermal",
    description: "锅炉、循环泵、补水、燃气/蒸汽/热水参数与热效率。",
    defaultStatus: "not_configured",
    reserved: false,
    sortOrder: 40,
    pointRoles: [
      { role: "power", label: "锅炉房电功率", required: false, unit: "kW" },
      { role: "temperature", label: "供回水/蒸汽温度", required: true, unit: "°C" },
      { role: "pressure", label: "系统压力", required: true, unit: "MPa" },
      { role: "flow", label: "热媒流量", required: true, unit: "m3/h" },
      { role: "status", label: "锅炉状态", required: true, unit: "" }
    ]
  },
  {
    subsystemType: "hvac_terminal",
    displayName: "空调末端",
    category: "terminal",
    description: "AHU、PAU、FCU、VAV、区域温湿度与末端阀门。",
    defaultStatus: "not_configured",
    reserved: false,
    sortOrder: 50,
    pointRoles: [
      { role: "temperature", label: "区域/送回风温度", required: true, unit: "°C" },
      { role: "status", label: "末端运行状态", required: true, unit: "" },
      { role: "feedback", label: "阀门/风阀反馈", required: false, unit: "%" },
      { role: "setpoint", label: "区域温度设定", required: false, unit: "°C" },
      { role: "alarm", label: "末端告警", required: false, unit: "" }
    ]
  },
  {
    subsystemType: "photovoltaic_storage",
    displayName: "光伏储能",
    category: "reserved",
    description: "光伏、储能 PCS、电池簇、并网点与削峰填谷策略预留。",
    defaultStatus: "not_applicable",
    reserved: true,
    sortOrder: 70,
    pointRoles: []
  },
  {
    subsystemType: "water_treatment",
    displayName: "水处理",
    category: "reserved",
    description: "补水、软化、排污、水质与药剂投加预留。",
    defaultStatus: "not_applicable",
    reserved: true,
    sortOrder: 80,
    pointRoles: []
  },
  {
    subsystemType: "ev_charging",
    displayName: "充电桩",
    category: "reserved",
    description: "充电负荷、排队策略、需量联动与站内配电约束预留。",
    defaultStatus: "not_applicable",
    reserved: true,
    sortOrder: 90,
    pointRoles: []
  },
  {
    subsystemType: "steam_network",
    displayName: "蒸汽管网",
    category: "reserved",
    description: "蒸汽压力、温度、流量、疏水与管网损失预留。",
    defaultStatus: "not_applicable",
    reserved: true,
    sortOrder: 100,
    pointRoles: []
  }
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function assertStationId(value) {
  const stationId = normalizeText(value);
  if (!stationId) {
    throw badRequest("stationId is required", { field: "stationId" });
  }
  if (!STATION_ID_PATTERN.test(stationId)) {
    throw badRequest("stationId must be a stable 1-64 character identifier", {
      field: "stationId",
      allowed: "ASCII letters, numbers, dot, underscore and hyphen; must start and end with a letter or number"
    });
  }
  return stationId;
}

function resolveStationStatus(value, fallback = "not_configured") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const normalized = normalizeText(value).toLowerCase();
  if (!SUBSYSTEM_STATUSES.has(normalized)) {
    throw badRequest("status must be a supported station status", {
      field: "status",
      allowed: [...SUBSYSTEM_STATUSES]
    });
  }
  return normalized;
}

function resolveStationBoolean(value, fallback, field) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw badRequest(`${field} must be a boolean`, { field });
  }
  return value;
}

function resolveStationNonNegativeInteger(value, fallback, field) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw badRequest(`${field} must be a non-negative integer`, { field });
  }
  return number;
}

function normalizeStationRuntimeSelectorList(value, field, maximum = 1000) {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be an array`, { field });
  }
  const items = normalizeTextList(value);
  if (items.length > maximum) {
    throw badRequest(`${field} exceeds the supported item limit`, {
      field,
      maximum
    });
  }
  return items;
}

function normalizeStationRuntimeSourceKey(value, field) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  if (!STATION_RUNTIME_SOURCE_KEY_PATTERN.test(normalized)) {
    throw badRequest(`${field} must be a stable source identifier`, {
      field,
      allowed: "ASCII letters, numbers, underscore and hyphen"
    });
  }
  return normalized;
}

function normalizeStationRuntimeBindingStatus(value, fallback = "draft") {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (!STATION_RUNTIME_BINDING_STATUSES.has(normalized)) {
    throw badRequest("status must be a supported binding lifecycle state", {
      field: "status",
      allowed: [...STATION_RUNTIME_BINDING_STATUSES]
    });
  }
  return normalized;
}

function buildStationRuntimeBindingPayload(source, selectors) {
  return {
    source: {
      databaseKey: source.databaseKey || null,
      projectKey: source.projectKey || null,
      template: source.template || null
    },
    selectors: {
      deviceIds: [...selectors.deviceIds].sort(),
      deviceCodes: [...selectors.deviceCodes].map((item) => item.toUpperCase()).sort(),
      pointCodes: [...selectors.pointCodes].sort()
    }
  };
}

function buildStationRuntimeBindingPayloadHash(source, selectors) {
  return createHash("sha256")
    .update(JSON.stringify(buildStationRuntimeBindingPayload(source, selectors)))
    .digest("hex");
}

function buildStationRuntimeEffectiveSourceHash(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeExpectedBindingVersion(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw badRequest("expectedVersion must be a non-negative integer", {
      field: "expectedVersion"
    });
  }
  return number;
}

function normalizeSiteStatus(value, fallback = "active") {
  const normalized = normalizeText(value).toLowerCase();
  return SITE_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeAdminRole(value, fallback = null) {
  const normalized = normalizeText(value).toLowerCase();
  return ADMIN_ROLES.has(normalized) ? normalized : fallback;
}

function normalizeSubsystemStatus(value, fallback = "not_configured") {
  const normalized = normalizeText(value).toLowerCase();
  return SUBSYSTEM_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeSubsystemMode(value, fallback = "monitoring") {
  const normalized = normalizeText(value).toLowerCase();
  return SUBSYSTEM_MODES.has(normalized) ? normalized : fallback;
}

function normalizeControlBoundaryMode(value, fallback = "read_only") {
  const normalized = normalizeText(value).toLowerCase();
  return CONTROL_BOUNDARY_MODES.has(normalized) ? normalized : fallback;
}

function normalizePointRoleKind(value, fallback = "feedback") {
  const normalized = normalizeText(value).toLowerCase();
  return POINT_ROLE_KINDS.has(normalized) ? normalized : fallback;
}

function normalizeBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = normalizeText(value).toLowerCase();
  if (["1", "true", "yes", "enabled", "是", "启用"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "disabled", "否", "停用"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeProgress(value, fallback = 0) {
  const number = normalizeFiniteNumber(value);
  if (number === null) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeExecutionStatus(value, fallback = "pending_approval") {
  const normalized = normalizeText(value);
  return OPTIMIZE_EXECUTION_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeExecutionListLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_OPTIMIZE_EXECUTION_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OPTIMIZE_EXECUTION_LIMIT;
  }
  return Math.min(parsed, MAX_OPTIMIZE_EXECUTION_LIMIT);
}

function normalizeChillerStagingSampleLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_CHILLER_STAGING_SAMPLE_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHILLER_STAGING_SAMPLE_LIMIT;
  }
  return Math.min(parsed, MAX_CHILLER_STAGING_SAMPLE_LIMIT);
}

function normalizeHvacTerminalSampleLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_HVAC_TERMINAL_SAMPLE_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HVAC_TERMINAL_SAMPLE_LIMIT;
  }
  return Math.min(parsed, MAX_HVAC_TERMINAL_SAMPLE_LIMIT);
}

function normalizeHvacTerminalSampleIntervalSeconds(value) {
  const number = normalizeFiniteNumber(value);
  if (number === null || number < 0) {
    return DEFAULT_HVAC_TERMINAL_SAMPLE_MIN_INTERVAL_SECONDS;
  }
  return Math.min(Math.floor(number), 3600);
}

function normalizeShadowVerificationRecordLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT;
  }
  return Math.min(parsed, MAX_SHADOW_VERIFICATION_RECORD_LIMIT);
}

function normalizeFcuControlRecordLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_FCU_CONTROL_RECORD_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FCU_CONTROL_RECORD_LIMIT;
  }
  return Math.min(parsed, MAX_FCU_CONTROL_RECORD_LIMIT);
}

function normalizeFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNonNegativeInteger(value) {
  const number = normalizeFiniteNumber(value);
  if (number === null || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const rawItem of value) {
    const item = normalizeText(rawItem);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function normalizeChillerCombination(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[+,/，、\s]+/)
      : [];
  return normalizeTextList(source).slice(0, 12);
}

function buildChillerCombinationKey(value) {
  return normalizeChillerCombination(value)
    .map((item) => item.toUpperCase())
    .sort((left, right) => left.localeCompare(right))
    .join("+");
}

function createChillerStagingSampleId(siteId) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `chs-${normalizeText(siteId) || "site"}-${Date.now()}-${suffix}`;
}

function createShadowVerificationRecordId(siteId) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `svr-${normalizeText(siteId) || "site"}-${Date.now()}-${suffix}`;
}

function createFcuControlRecordId(siteId) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `fcu-${normalizeText(siteId) || "site"}-${Date.now()}-${suffix}`;
}

function createHvacTerminalSampleId(siteId, floor, deviceCode, sampledAt) {
  const key = [siteId, floor, deviceCode, sampledAt]
    .map((item) => normalizeText(item))
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `hts-${key || Date.now()}`;
}

function normalizeDispatchReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const status = normalizeText(value.status).toLowerCase();
  if (status !== "succeeded" && status !== "failed" && status !== "skipped") {
    return null;
  }
  const operation = normalizeText(value.operation).toLowerCase();
  if (operation !== "approve" && operation !== "dispatch" && operation !== "rollback") {
    return null;
  }
  const mode = normalizeText(value.mode).toLowerCase();
  return {
    operation,
    mode: mode || "off",
    status,
    code: normalizeNullableText(value.code),
    message: normalizeNullableText(value.message),
    endpoint: normalizeNullableText(value.endpoint),
    submittedAt: normalizeNullableText(value.submittedAt),
    completedAt: normalizeNullableText(value.completedAt),
    httpStatus:
      typeof value.httpStatus === "number" && Number.isFinite(value.httpStatus)
        ? value.httpStatus
        : null,
    response:
      value.response && typeof value.response === "object" && !Array.isArray(value.response)
        ? cloneJson(value.response, {})
        : null
  };
}

function normalizeFeedbackSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const baseline =
    value.baseline && typeof value.baseline === "object" && !Array.isArray(value.baseline)
      ? cloneJson(value.baseline, {})
      : {};
  const freshness =
    value.freshness && typeof value.freshness === "object" && !Array.isArray(value.freshness)
      ? cloneJson(value.freshness, {})
      : {};
  const sourceStatus =
    value.sourceStatus && typeof value.sourceStatus === "object" && !Array.isArray(value.sourceStatus)
      ? cloneJson(value.sourceStatus, {})
      : {};
  const phase = normalizeNullableText(value.phase);
  const capturedAt = normalizeNullableText(value.capturedAt);
  if (!phase && !capturedAt && !Object.keys(baseline).length && !Object.keys(freshness).length && !Object.keys(sourceStatus).length) {
    return null;
  }
  return {
    phase,
    capturedAt,
    baseline,
    freshness,
    sourceStatus
  };
}

function mergeExecutionDispatchState(existingExecution, stage, receipt, timestamp) {
  if (!receipt) {
    return existingExecution;
  }
  const execution = existingExecution && typeof existingExecution === "object" ? cloneJson(existingExecution, {}) : {};
  const previousDispatch =
    execution.dispatch && typeof execution.dispatch === "object" && !Array.isArray(execution.dispatch)
      ? cloneJson(execution.dispatch, {})
      : {};
  const nextDispatch = {
    ...previousDispatch,
    updatedAt: timestamp
  };
  if (stage === "approve") {
    nextDispatch.lastApprove = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "applied" : "apply_pending";
  }
  if (stage === "dispatch") {
    nextDispatch.lastDispatch = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "applied" : "apply_pending";
  }
  if (stage === "rollback") {
    nextDispatch.lastRollback = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "rolled_back" : "rollback_pending";
  }
  return {
    ...execution,
    dispatch: nextDispatch
  };
}

function mergeExecutionFeedbackState(existingExecution, stage, snapshot) {
  const normalizedSnapshot = normalizeFeedbackSnapshot(snapshot);
  if (!normalizedSnapshot) {
    return existingExecution;
  }
  const execution = existingExecution && typeof existingExecution === "object" ? cloneJson(existingExecution, {}) : {};
  const previousFeedbackSnapshots =
    execution.feedbackSnapshots && typeof execution.feedbackSnapshots === "object" && !Array.isArray(execution.feedbackSnapshots)
      ? cloneJson(execution.feedbackSnapshots, {})
      : {};
  const key = stage === "rollback" ? "rollback" : stage === "dispatch" ? "dispatch" : "approve";
  return {
    ...execution,
    feedbackSnapshots: {
      ...previousFeedbackSnapshots,
      [key]: normalizedSnapshot,
      latest: normalizedSnapshot
    }
  };
}

function safeJsonParse(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function toJsonText(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function cloneJson(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_error) {
    return fallback;
  }
}

function beginTransaction(db) {
  db.exec("BEGIN");
}

function commitTransaction(db) {
  db.exec("COMMIT");
}

function rollbackTransaction(db) {
  db.exec("ROLLBACK");
}

function withTransaction(db, action) {
  beginTransaction(db);
  try {
    const result = action();
    commitTransaction(db);
    return result;
  } catch (error) {
    rollbackTransaction(db);
    throw error;
  }
}

function mapSiteRow(row) {
  if (!row) {
    return null;
  }

  return {
    siteId: row.site_id,
    siteName: row.site_name || row.site_id,
    siteCode: row.site_code || null,
    city: row.city || null,
    status: row.status || "active",
    ownerName: row.owner_name || null,
    remark: row.remark || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    importedAt: row.imported_at || null,
    sourceConfig: {
      siteId: row.site_id,
      legacyBaseUrl: row.source_legacy_base_url || null,
      ipAddress: row.source_ip_address || null,
      port: row.source_port || null,
      databaseKey: row.source_database_key || null,
      modelKey: row.source_model_key || null,
      preferredProjectKey: row.source_preferred_project_key || null,
      template: row.source_template || null,
      controlMode: row.source_control_mode || null,
      status: row.source_status || null,
      createdAt: row.source_created_at || null,
      updatedAt: row.source_updated_at || null
    },
    runtimeConfig: {
      siteId: row.site_id,
      energyParams: safeJsonParse(row.runtime_energy_params_json, {}),
      ruleThresholds: safeJsonParse(row.runtime_rule_thresholds_json, {}),
      featureFlags: safeJsonParse(row.runtime_feature_flags_json, {}),
      version: typeof row.runtime_version === "number" ? row.runtime_version : null,
      createdAt: row.runtime_created_at || null,
      updatedAt: row.runtime_updated_at || null
    }
  };
}

function mapPrincipalRow(row) {
  if (!row) {
    return null;
  }
  return {
    principalId: row.principal_id,
    userId: row.user_id,
    username: row.username || row.user_id,
    status: row.status || "active",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapBindingRow(row) {
  if (!row) {
    return null;
  }
  return {
    bindingId: row.binding_id,
    principalId: row.principal_id,
    userId: row.user_id,
    username: row.username || row.user_id,
    role: row.role,
    scopeType: row.scope_type,
    scopeId: row.scope_type === "platform" ? null : row.scope_id,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function mapOptimizeExecutionRow(row) {
  if (!row) {
    return null;
  }

  const payload = safeJsonParse(row.payload_json, {});
  const timeline = safeJsonParse(row.timeline_json, []);
  const approvalPayload = payload?.approval && typeof payload.approval === "object" ? payload.approval : {};
  const rollbackPayload = payload?.rollback && typeof payload.rollback === "object" ? payload.rollback : {};
  const normalizedTimeline = Array.isArray(timeline) ? timeline : [];
  const approvedAt = row.approved_at || approvalPayload.approvedAt || payload.approvedAt || null;
  const approvedBy = row.approved_by || approvalPayload.approverUserId || payload.approvedBy || null;
  const rolledBackAt =
    row.rolled_back_at || rollbackPayload.completedAt || rollbackPayload.requestedAt || payload.rolledBackAt || null;
  const rolledBackBy =
    row.rolled_back_by || rollbackPayload.requestedBy || payload.rolledBackBy || null;
  const createdAt = row.created_at || payload.createdAt || null;
  const updatedAt = row.updated_at || payload.updatedAt || createdAt;

  return {
    executionId: row.execution_id,
    siteId: row.site_id,
    createdAt,
    updatedAt,
    status: row.status || payload.status || "pending_approval",
    draft: payload.draft && typeof payload.draft === "object" ? payload.draft : {
      generatedAt: null,
      gateLevel: null
    },
    execution: payload.execution && typeof payload.execution === "object" ? payload.execution : {},
    approval: {
      required: approvalPayload.required !== false,
      status: approvalPayload.status || (approvedAt ? "approved" : "pending"),
      requestedAt: approvalPayload.requestedAt || createdAt,
      approvedAt,
      approverUserId: approvedBy,
      note: approvalPayload.note || null
    },
    rollback: {
      status: rollbackPayload.status || (rolledBackAt ? "completed" : "none"),
      reason: rollbackPayload.reason || null,
      requestedBy: rolledBackBy,
      requestedAt: rollbackPayload.requestedAt || rolledBackAt,
      completedAt: rollbackPayload.completedAt || rolledBackAt
    },
    approvedAt,
    approvedBy,
    rolledBackAt,
    rolledBackBy,
    timeline: normalizedTimeline
  };
}

function mapShadowVerificationRecordRow(row) {
  if (!row) {
    return null;
  }
  const payload = safeJsonParse(row.payload_json, {});
  return {
    recordId: row.record_id,
    siteId: row.site_id,
    executionId: row.execution_id || null,
    verificationType: row.verification_type,
    targetLabel: row.target_label || null,
    outcome: row.outcome || "pending",
    windowMinutes: typeof row.window_minutes === "number" ? row.window_minutes : null,
    metrics: {
      loadKw: typeof row.load_kw === "number" ? row.load_kw : null,
      wetBulbC: typeof row.wet_bulb_c === "number" ? row.wet_bulb_c : null,
      stationCop: typeof row.station_cop === "number" ? row.station_cop : null,
      comboCop: typeof row.combo_cop === "number" ? row.combo_cop : null,
      kwPerRt: typeof row.kw_per_rt === "number" ? row.kw_per_rt : null,
      stationPowerKw: typeof row.station_power_kw === "number" ? row.station_power_kw : null,
      chillerPowerKw: typeof row.chiller_power_kw === "number" ? row.chiller_power_kw : null,
      alarmCount: typeof row.alarm_count === "number" ? row.alarm_count : 0
    },
    note: payload.note || null,
    invalidReason: payload.invalidReason || null,
    sourceRecordId: payload.sourceRecordId || null,
    payload,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    recordedBy: row.recorded_by || null,
    requestId: row.request_id || null
  };
}

function mapChillerStagingSampleRow(row) {
  if (!row) {
    return null;
  }
  const sample = safeJsonParse(row.sample_payload_json, {});
  const combination = safeJsonParse(row.combination_json, []);
  return {
    sampleId: row.sample_id,
    siteId: row.site_id,
    combinationKey: row.combination_key,
    combination: Array.isArray(combination) ? combination : [],
    capturedAt: row.captured_at || null,
    createdAt: row.created_at || null,
    requestId: row.request_id || null,
    source: row.source || sample.source || null,
    loadKw: typeof row.load_kw === "number" ? row.load_kw : null,
    loadRatePct: typeof row.load_rate_pct === "number" ? row.load_rate_pct : null,
    wetBulbC: typeof row.wet_bulb_c === "number" ? row.wet_bulb_c : null,
    chilledSupplyTempC: typeof row.chilled_supply_temp_c === "number" ? row.chilled_supply_temp_c : null,
    stationPowerKw: typeof row.station_power_kw === "number" ? row.station_power_kw : null,
    chillerPowerKw: typeof row.chiller_power_kw === "number" ? row.chiller_power_kw : null,
    stationCop: typeof row.station_cop === "number" ? row.station_cop : null,
    comboCop: typeof row.combo_cop === "number" ? row.combo_cop : null,
    kwPerRt: typeof row.kw_per_rt === "number" ? row.kw_per_rt : null,
    sampleMinutes: typeof row.sample_minutes === "number" ? row.sample_minutes : null,
    alarmCount: typeof row.alarm_count === "number" ? row.alarm_count : 0,
    sample
  };
}

function mapHvacTerminalSampleRow(row) {
  if (!row) {
    return null;
  }
  const qualityFlags = safeJsonParse(row.quality_flags_json, []);
  return {
    sampleId: row.sample_id,
    siteId: row.site_id,
    building: row.building || null,
    floor: row.floor || null,
    floorName: row.floor_name || null,
    deviceId: row.device_id || null,
    deviceCode: row.device_code || null,
    deviceName: row.device_name || null,
    sampledAt: row.sampled_at || null,
    zoneTemperatureC: typeof row.zone_temp_c === "number" ? row.zone_temp_c : null,
    setpointC: typeof row.setpoint_c === "number" ? row.setpoint_c : null,
    running: row.running == null ? null : row.running === 1,
    valveOpen: row.valve_open == null ? null : row.valve_open === 1,
    valveOpenPct: typeof row.valve_open_pct === "number" ? row.valve_open_pct : null,
    fanSpeedState: typeof row.fan_speed_state === "number" ? row.fan_speed_state : null,
    communicationAlarm: row.communication_alarm == null ? null : row.communication_alarm === 1,
    qualityStatus: row.quality_status || "unknown",
    qualityFlags: Array.isArray(qualityFlags) ? qualityFlags : [],
    rawTagTime: row.raw_tag_time || null,
    sourceStatus: row.source_status || null,
    createdAt: row.created_at || null,
    requestId: row.request_id || null
  };
}

function mapFcuControlPolicyRow(row) {
  if (!row) {
    return null;
  }
  return {
    siteId: row.site_id,
    policy: safeJsonParse(row.policy_json, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapFcuControlRecordRow(row) {
  if (!row) {
    return null;
  }
  const payload = safeJsonParse(row.payload_json, {});
  return {
    ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
    recordId: row.record_id,
    siteId: row.site_id,
    deviceCode: row.device_code,
    deviceName: row.device_name || null,
    mode: row.mode,
    status: row.status,
    actionKind: row.action_kind,
    reason: row.reason || null,
    createdAt: row.created_at,
    createdBy: row.created_by || null,
    updatedAt: row.updated_at,
    rolledBackAt: row.rolled_back_at || null,
    rolledBackBy: row.rolled_back_by || null,
    rollbackReason: row.rollback_reason || null,
    requestId: row.request_id || null,
    payload
  };
}

function mapSubsystemRegistryRow(row) {
  if (!row) {
    return null;
  }
  return {
    siteId: row.site_id || GLOBAL_REGISTRY_SITE_ID,
    subsystemType: row.subsystem_type,
    displayName: row.display_name || row.subsystem_type,
    category: row.category || "general",
    description: row.description || null,
    defaultStatus: normalizeSubsystemStatus(row.default_status, "not_configured"),
    reserved: row.reserved === 1,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 999,
    pointRoles: safeJsonParse(row.point_roles_json, []),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapSiteSubsystemCapabilityRow(row) {
  if (!row) {
    return null;
  }
  const status = normalizeSubsystemStatus(row.status, "not_configured");
  const enabled = status === "enabled";
  return {
    siteId: row.site_id,
    subsystemType: row.subsystem_type,
    displayName: row.display_name || row.subsystem_type,
    category: row.category || "general",
    description: row.description || null,
    status,
    mode: normalizeSubsystemMode(row.mode, row.reserved === 1 ? "reserved" : "monitoring"),
    reserved: row.reserved === 1,
    enabled,
    kpis: enabled ? safeJsonParse(row.kpis_json, []) : [],
    alarmCount: enabled ? normalizeNonNegativeInteger(row.alarm_count) : null,
    freshnessStatus: row.freshness_status || (enabled ? "unknown" : "not_configured"),
    sourceStatus: row.source_status || (enabled ? "unknown" : "not_configured"),
    pointMappingProgress: normalizeProgress(row.point_mapping_progress),
    advisorPluginStatus: enabled ? row.advisor_plugin_status || "not_configured" : "not_configured",
    pageTemplateStatus: row.page_template_status || "not_configured",
    published: row.published !== 0,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapStationInstanceRow(row) {
  if (!row) {
    return null;
  }
  const status = normalizeSubsystemStatus(row.status, "not_configured");
  const enabled = status === "enabled";
  const bindingState = STATION_RUNTIME_BINDING_STATUSES.has(row.binding_status)
    ? row.binding_status
    : "unconfigured";
  const bindingVersion = Number.isSafeInteger(row.binding_version) && row.binding_version > 0
    ? row.binding_version
    : null;
  const publishedBindingVersion = Number.isSafeInteger(row.published_binding_version)
    && row.published_binding_version > 0
    ? row.published_binding_version
    : null;
  const draftBindingVersion = Number.isSafeInteger(row.draft_binding_version)
    && row.draft_binding_version > 0
    ? row.draft_binding_version
    : null;
  return {
    siteId: row.site_id,
    stationId: row.station_id,
    stationName: row.station_name || row.station_id,
    parentSubsystemType: row.parent_subsystem_type,
    status,
    enabled,
    // Runtime health is evidence, not editable station identity. Until a
    // persistent probe ledger exists, even a published binding remains unknown.
    sourceStatus: enabled && publishedBindingVersion ? "unknown" : "not_configured",
    freshnessStatus: enabled && publishedBindingVersion ? "unknown" : "not_configured",
    alarmCount: null,
    bindingState,
    bindingVersion,
    draftBindingVersion,
    publishedBindingVersion,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 999,
    published: row.published !== 0,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapStationRuntimeBindingRow(row) {
  if (!row) {
    return null;
  }
  const deviceIds = safeJsonParse(row.device_ids_json, []);
  const deviceCodes = safeJsonParse(row.device_codes_json, []);
  const pointCodes = safeJsonParse(row.point_codes_json, []);
  return {
    siteId: row.site_id,
    stationId: row.station_id,
    stationName: row.station_name || null,
    parentSubsystemType: row.parent_subsystem_type || null,
    stationStatus: row.station_status || null,
    stationPublished: row.station_published === 1,
    status: STATION_RUNTIME_BINDING_STATUSES.has(row.status) ? row.status : "draft",
    bindingVersion: Number.isSafeInteger(row.binding_version) ? row.binding_version : 0,
    source: {
      databaseKey: row.database_key || null,
      projectKey: row.project_key || null,
      template: row.template || null
    },
    selectors: {
      deviceIds: Array.isArray(deviceIds) ? deviceIds : [],
      deviceCodes: Array.isArray(deviceCodes) ? deviceCodes : [],
      pointCodes: Array.isArray(pointCodes) ? pointCodes : []
    },
    payloadHash: row.payload_hash || null,
    validatedHash: row.validated_hash || null,
    validation: safeJsonParse(row.validation_json, null),
    checkedAt: row.checked_at || null,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapPointRoleMappingRow(row) {
  if (!row) {
    return null;
  }
  return {
    mappingId: String(row.mapping_id),
    siteId: row.site_id,
    subsystemType: row.subsystem_type,
    pointRole: normalizePointRoleKind(row.point_role),
    pointName: row.point_name || "",
    pointCode: row.point_code || "",
    unit: row.unit || "",
    dataType: row.data_type || "",
    direction: row.direction || "read",
    required: row.required === 1,
    writable: row.writable === 1,
    source: row.source || "manual",
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapAdvisorPluginBindingRow(row) {
  if (!row) {
    return null;
  }
  return {
    siteId: row.site_id,
    subsystemType: row.subsystem_type,
    pluginKey: row.plugin_key,
    status: row.status || "not_configured",
    mode: normalizeSubsystemMode(row.mode, "monitoring"),
    config: safeJsonParse(row.config_json, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapControlBoundaryRow(row) {
  if (!row) {
    return null;
  }
  return {
    siteId: row.site_id,
    subsystemType: row.subsystem_type,
    mode: normalizeControlBoundaryMode(row.mode),
    approvalRequired: row.approval_required !== 0,
    plcProtectionRequired: row.plc_protection_required !== 0,
    rollbackRequired: row.rollback_required !== 0,
    writeEnabled: row.write_enabled === 1,
    notes: row.notes || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null
  };
}

function mapConfigVersionRow(row) {
  if (!row) {
    return null;
  }
  return {
    versionId: row.version_id,
    siteId: row.site_id,
    status: row.status || "draft",
    summary: row.summary || null,
    payload: safeJsonParse(row.payload_json, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    publishedAt: row.published_at || null,
    rolledBackAt: row.rolled_back_at || null
  };
}

function ensureLocalDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function ensureTableColumn(db, tableName, columnName, definitionSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
}

function migrateLegacyStationRuntimeBindingsToDrafts(db) {
  const legacyTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_station_runtime_bindings'"
  ).get();
  if (!legacyTable) {
    return;
  }
  const rows = db.prepare("SELECT * FROM admin_station_runtime_bindings").all();
  const timestamp = nowIso();
  for (const row of rows) {
    const siteId = normalizeText(row.site_id);
    const stationId = normalizeText(row.station_id);
    const deviceIds = safeJsonParse(row.device_ids_json, []);
    if (!siteId || !stationId || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      continue;
    }
    const existing = db.prepare(
      `SELECT binding_version
       FROM admin_station_runtime_binding_versions
       WHERE site_id = ? AND station_id = ?
       ORDER BY binding_version DESC LIMIT 1`
    ).get(siteId, stationId);
    if (existing) {
      continue;
    }
    const source = {
      databaseKey: normalizeNullableText(row.database_key),
      projectKey: normalizeNullableText(row.project_key),
      template: normalizeNullableText(row.template)
    };
    const selectors = {
      deviceIds: normalizeTextList(deviceIds),
      deviceCodes: normalizeTextList(safeJsonParse(row.device_codes_json, [])),
      pointCodes: normalizeTextList(safeJsonParse(row.point_codes_json, []))
    };
    const payloadHash = buildStationRuntimeBindingPayloadHash(source, selectors);
    const bindingVersion = Number.isSafeInteger(row.binding_version) && row.binding_version > 0
      ? row.binding_version
      : 1;
    db.prepare(
      `
        INSERT INTO admin_station_runtime_binding_versions (
          site_id, station_id, binding_version, status, database_key, project_key,
          template, device_ids_json, device_codes_json, point_codes_json,
          payload_hash, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      siteId,
      stationId,
      bindingVersion,
      source.databaseKey,
      source.projectKey,
      source.template,
      toJsonText(selectors.deviceIds, []),
      toJsonText(selectors.deviceCodes, []),
      toJsonText(selectors.pointCodes, []),
      payloadHash,
      normalizeNullableText(row.notes),
      row.created_at || timestamp,
      timestamp,
      normalizeNullableText(row.created_by),
      normalizeNullableText(row.updated_by)
    );
    db.prepare(
      `
        INSERT INTO admin_station_runtime_binding_heads (
          site_id, station_id, draft_version, current_published_version, updated_at, updated_by
        ) VALUES (?, ?, ?, NULL, ?, ?)
        ON CONFLICT(site_id, station_id) DO UPDATE SET
          draft_version = excluded.draft_version,
          current_published_version = NULL,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      `
    ).run(
      siteId,
      stationId,
      bindingVersion,
      timestamp,
      normalizeNullableText(row.updated_by)
    );
  }
  const migratedTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_station_runtime_bindings_legacy'"
  ).get();
  if (!migratedTable) {
    db.exec("ALTER TABLE admin_station_runtime_bindings RENAME TO admin_station_runtime_bindings_legacy");
  }
}

function runMigrations(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin_sites (
      site_id TEXT PRIMARY KEY,
      site_name TEXT,
      site_code TEXT,
      city TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      owner_name TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      imported_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_principals (
      principal_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_role_bindings (
      binding_id INTEGER PRIMARY KEY AUTOINCREMENT,
      principal_id INTEGER NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(principal_id, scope_type, scope_id),
      FOREIGN KEY (principal_id) REFERENCES admin_principals(principal_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_site_source_configs (
      site_id TEXT PRIMARY KEY,
      legacy_base_url TEXT,
      ip_address TEXT,
      port TEXT,
      database_key TEXT,
      model_key TEXT,
      preferred_project_key TEXT,
      template TEXT,
      control_mode TEXT,
      status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_site_runtime_configs (
      site_id TEXT PRIMARY KEY,
      energy_params_json TEXT NOT NULL DEFAULT '{}',
      rule_thresholds_json TEXT NOT NULL DEFAULT '{}',
      feature_flags_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_subsystem_registry (
      site_id TEXT NOT NULL DEFAULT '${GLOBAL_REGISTRY_SITE_ID}',
      subsystem_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      default_status TEXT NOT NULL DEFAULT 'not_configured',
      reserved INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 999,
      point_roles_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, subsystem_type)
    );

    CREATE TABLE IF NOT EXISTS admin_site_subsystem_capabilities (
      site_id TEXT NOT NULL,
      subsystem_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_configured',
      mode TEXT NOT NULL DEFAULT 'monitoring',
      kpis_json TEXT NOT NULL DEFAULT '[]',
      alarm_count INTEGER NOT NULL DEFAULT 0,
      freshness_status TEXT NOT NULL DEFAULT 'not_configured',
      source_status TEXT NOT NULL DEFAULT 'not_configured',
      point_mapping_progress INTEGER NOT NULL DEFAULT 0,
      advisor_plugin_status TEXT NOT NULL DEFAULT 'not_configured',
      page_template_status TEXT NOT NULL DEFAULT 'not_configured',
      notes TEXT,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, subsystem_type),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_station_instances (
      site_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      station_name TEXT NOT NULL,
      parent_subsystem_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_configured',
      source_status TEXT NOT NULL DEFAULT 'not_configured',
      freshness_status TEXT NOT NULL DEFAULT 'not_configured',
      alarm_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 999,
      published INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, station_id),
      UNIQUE (site_id, parent_subsystem_type, station_name),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_station_instances_parent
      ON admin_station_instances(site_id, parent_subsystem_type, sort_order, station_id);

    CREATE TABLE IF NOT EXISTS admin_station_runtime_binding_versions (
      site_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      binding_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      database_key TEXT,
      project_key TEXT,
      template TEXT,
      device_ids_json TEXT NOT NULL DEFAULT '[]',
      device_codes_json TEXT NOT NULL DEFAULT '[]',
      point_codes_json TEXT NOT NULL DEFAULT '[]',
      payload_hash TEXT NOT NULL,
      validated_hash TEXT,
      validation_json TEXT,
      checked_at TEXT,
      published_at TEXT,
      published_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, station_id, binding_version),
      FOREIGN KEY (site_id, station_id)
        REFERENCES admin_station_instances(site_id, station_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_station_runtime_binding_heads (
      site_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      draft_version INTEGER,
      current_published_version INTEGER,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      PRIMARY KEY (site_id, station_id),
      FOREIGN KEY (site_id, station_id)
        REFERENCES admin_station_instances(site_id, station_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_station_runtime_binding_versions_status
      ON admin_station_runtime_binding_versions(site_id, status, binding_version);

    CREATE TABLE IF NOT EXISTS admin_point_role_mappings (
      mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      subsystem_type TEXT NOT NULL,
      point_role TEXT NOT NULL,
      point_name TEXT NOT NULL,
      point_code TEXT,
      unit TEXT,
      data_type TEXT,
      direction TEXT NOT NULL DEFAULT 'read',
      required INTEGER NOT NULL DEFAULT 0,
      writable INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_advisor_plugin_bindings (
      site_id TEXT NOT NULL,
      subsystem_type TEXT NOT NULL,
      plugin_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_configured',
      mode TEXT NOT NULL DEFAULT 'monitoring',
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, subsystem_type, plugin_key),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_control_boundaries (
      site_id TEXT NOT NULL,
      subsystem_type TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'read_only',
      approval_required INTEGER NOT NULL DEFAULT 1,
      plc_protection_required INTEGER NOT NULL DEFAULT 1,
      rollback_required INTEGER NOT NULL DEFAULT 1,
      write_enabled INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      PRIMARY KEY (site_id, subsystem_type),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_config_versions (
      version_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      summary TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      published_at TEXT,
      rolled_back_at TEXT,
      PRIMARY KEY (site_id, version_id),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      actor_username TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL DEFAULT '',
      before_json TEXT,
      after_json TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_optimize_executions (
      execution_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      timeline_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      rolled_back_at TEXT,
      rolled_back_by TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_chiller_staging_samples (
      sample_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      combination_key TEXT NOT NULL,
      combination_json TEXT NOT NULL,
      sample_payload_json TEXT NOT NULL,
      source TEXT,
      captured_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      request_id TEXT,
      load_kw REAL,
      load_rate_pct REAL,
      wet_bulb_c REAL,
      chilled_supply_temp_c REAL,
      station_power_kw REAL,
      chiller_power_kw REAL,
      station_cop REAL,
      combo_cop REAL,
      kw_per_rt REAL,
      sample_minutes REAL,
      alarm_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_hvac_terminal_samples (
      sample_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      building TEXT,
      floor TEXT NOT NULL,
      floor_name TEXT,
      device_id TEXT,
      device_code TEXT NOT NULL,
      device_name TEXT,
      sampled_at TEXT NOT NULL,
      zone_temp_c REAL,
      setpoint_c REAL,
      running INTEGER,
      valve_open INTEGER,
      valve_open_pct REAL,
      fan_speed_state REAL,
      communication_alarm INTEGER,
      quality_status TEXT NOT NULL DEFAULT 'unknown',
      quality_flags_json TEXT NOT NULL DEFAULT '[]',
      raw_tag_time TEXT,
      source_status TEXT,
      created_at TEXT NOT NULL,
      request_id TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_fcu_control_policies (
      site_id TEXT PRIMARY KEY,
      policy_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_fcu_control_records (
      record_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      device_code TEXT NOT NULL,
      device_name TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      action_kind TEXT NOT NULL,
      reason TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      rolled_back_at TEXT,
      rolled_back_by TEXT,
      rollback_reason TEXT,
      request_id TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_shadow_verification_records (
      record_id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      execution_id TEXT,
      verification_type TEXT NOT NULL,
      target_label TEXT,
      outcome TEXT NOT NULL,
      window_minutes INTEGER,
      load_kw REAL,
      wet_bulb_c REAL,
      station_cop REAL,
      combo_cop REAL,
      kw_per_rt REAL,
      station_power_kw REAL,
      chiller_power_kw REAL,
      alarm_count INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      recorded_by TEXT,
      request_id TEXT,
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_role_bindings_scope
      ON admin_role_bindings(scope_type, scope_id);

    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_scope
      ON admin_audit_logs(scope_type, scope_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_optimize_executions_site_status_updated
      ON admin_optimize_executions(site_id, status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_chiller_staging_samples_site_combo_captured
      ON admin_chiller_staging_samples(site_id, combination_key, captured_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_hvac_terminal_samples_unique
      ON admin_hvac_terminal_samples(site_id, floor, device_code, sampled_at);

    CREATE INDEX IF NOT EXISTS idx_admin_hvac_terminal_samples_site_floor_sampled
      ON admin_hvac_terminal_samples(site_id, floor, sampled_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_hvac_terminal_samples_device_sampled
      ON admin_hvac_terminal_samples(site_id, device_code, sampled_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_fcu_control_records_site_device_time
      ON admin_fcu_control_records(site_id, device_code, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_shadow_verification_site_recorded
      ON admin_shadow_verification_records(site_id, recorded_at DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_shadow_verification_execution
      ON admin_shadow_verification_records(site_id, execution_id, recorded_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_site_subsystem_capabilities_site_status
      ON admin_site_subsystem_capabilities(site_id, status, published);

    CREATE INDEX IF NOT EXISTS idx_admin_point_role_mappings_site_subsystem
      ON admin_point_role_mappings(site_id, subsystem_type, point_role);

    CREATE INDEX IF NOT EXISTS idx_admin_config_versions_site_status
      ON admin_config_versions(site_id, status, updated_at DESC);
  `);

  ensureTableColumn(db, "admin_site_source_configs", "preferred_project_key", "preferred_project_key TEXT");
  migrateLegacyStationRuntimeBindingsToDrafts(db);
  ensureConfigVersionsSiteScopedKey(db);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_admin_config_versions_site_status
      ON admin_config_versions(site_id, status, updated_at DESC);
  `);
}

function ensureConfigVersionsSiteScopedKey(db) {
  const columns = db.prepare("PRAGMA table_info(admin_config_versions)").all();
  const versionColumn = columns.find((column) => column.name === "version_id");
  const siteColumn = columns.find((column) => column.name === "site_id");
  if (versionColumn?.pk === 2 && siteColumn?.pk === 1) {
    return;
  }
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE admin_config_versions_next (
      version_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      summary TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      published_at TEXT,
      rolled_back_at TEXT,
      PRIMARY KEY (site_id, version_id),
      FOREIGN KEY (site_id) REFERENCES admin_sites(site_id) ON DELETE CASCADE
    );
    INSERT OR REPLACE INTO admin_config_versions_next (
      version_id,
      site_id,
      status,
      summary,
      payload_json,
      created_at,
      updated_at,
      created_by,
      updated_by,
      published_at,
      rolled_back_at
    )
    SELECT
      version_id,
      site_id,
      status,
      summary,
      payload_json,
      created_at,
      updated_at,
      created_by,
      updated_by,
      published_at,
      rolled_back_at
    FROM admin_config_versions;
    DROP TABLE admin_config_versions;
    ALTER TABLE admin_config_versions_next RENAME TO admin_config_versions;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

function createQueryHelpers(db) {
  return {
    get(sql, ...params) {
      return db.prepare(sql).get(...params);
    },
    all(sql, ...params) {
      return db.prepare(sql).all(...params);
    },
    run(sql, ...params) {
      return db.prepare(sql).run(...params);
    }
  };
}

function seedDefaultSubsystemRegistry(sql) {
  const timestamp = nowIso();
  for (const item of DEFAULT_SUBSYSTEM_REGISTRY) {
    const existing = sql.get(
      `
        SELECT subsystem_type
        FROM admin_subsystem_registry
        WHERE site_id = ? AND subsystem_type = ?
        LIMIT 1
      `,
      GLOBAL_REGISTRY_SITE_ID,
      item.subsystemType
    );
    if (existing) {
      sql.run(
        `
          UPDATE admin_subsystem_registry
          SET
            display_name = ?,
            category = ?,
            description = ?,
            default_status = ?,
            reserved = ?,
            sort_order = ?,
            point_roles_json = ?,
            updated_at = ?,
            updated_by = 'system'
          WHERE site_id = ? AND subsystem_type = ?
        `,
        item.displayName,
        item.category,
        item.description,
        item.defaultStatus,
        item.reserved ? 1 : 0,
        item.sortOrder,
        toJsonText(item.pointRoles, []),
        timestamp,
        GLOBAL_REGISTRY_SITE_ID,
        item.subsystemType
      );
      continue;
    }
    sql.run(
      `
        INSERT INTO admin_subsystem_registry (
          site_id,
          subsystem_type,
          display_name,
          category,
          description,
          default_status,
          reserved,
          sort_order,
          point_roles_json,
          created_at,
          updated_at,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', 'system')
      `,
      GLOBAL_REGISTRY_SITE_ID,
      item.subsystemType,
      item.displayName,
      item.category,
      item.description,
      item.defaultStatus,
      item.reserved ? 1 : 0,
      item.sortOrder,
      toJsonText(item.pointRoles, []),
      timestamp,
      timestamp
    );
  }
}

function createSiteSelectSql(extraWhere = "") {
  return `
    SELECT
      s.site_id,
      s.site_name,
      s.site_code,
      s.city,
      s.status,
      s.owner_name,
      s.remark,
      s.created_at,
      s.updated_at,
      s.imported_at,
      sc.legacy_base_url AS source_legacy_base_url,
      sc.ip_address AS source_ip_address,
      sc.port AS source_port,
      sc.database_key AS source_database_key,
      sc.model_key AS source_model_key,
      sc.preferred_project_key AS source_preferred_project_key,
      sc.template AS source_template,
      sc.control_mode AS source_control_mode,
      sc.status AS source_status,
      sc.created_at AS source_created_at,
      sc.updated_at AS source_updated_at,
      rc.energy_params_json AS runtime_energy_params_json,
      rc.rule_thresholds_json AS runtime_rule_thresholds_json,
      rc.feature_flags_json AS runtime_feature_flags_json,
      rc.version AS runtime_version,
      rc.created_at AS runtime_created_at,
      rc.updated_at AS runtime_updated_at
    FROM admin_sites s
    LEFT JOIN admin_site_source_configs sc
      ON sc.site_id = s.site_id
    LEFT JOIN admin_site_runtime_configs rc
      ON rc.site_id = s.site_id
    ${extraWhere}
  `;
}

function createOptimizeExecutionSelectSql(extraWhere = "") {
  return `
    SELECT
      execution_id,
      site_id,
      status,
      payload_json,
      timeline_json,
      created_at,
      updated_at,
      approved_at,
      approved_by,
      rolled_back_at,
      rolled_back_by
    FROM admin_optimize_executions
    ${extraWhere}
  `;
}

export function createAdminStore(options) {
  const dbFile = options?.dbFile || ":memory:";
  if (dbFile !== ":memory:") {
    ensureLocalDirectory(dbFile);
  }

  const db = new DatabaseSync(dbFile);
  runMigrations(db);
  const sql = createQueryHelpers(db);
  seedDefaultSubsystemRegistry(sql);

  function recordAudit(entry) {
    sql.run(
      `
        INSERT INTO admin_audit_logs (
          actor_user_id,
          actor_username,
          action,
          target_type,
          target_id,
          scope_type,
          scope_id,
          before_json,
          after_json,
          request_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      normalizeNullableText(entry.actorUserId),
      normalizeNullableText(entry.actorUsername),
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.scopeType,
      entry.scopeId || "",
      entry.beforeJson ?? null,
      entry.afterJson ?? null,
      normalizeNullableText(entry.requestId),
      nowIso()
    );
  }

  function getPrincipalByUserId(userId) {
    return mapPrincipalRow(
      sql.get(
        `
          SELECT principal_id, user_id, username, status, created_at, updated_at
          FROM admin_principals
          WHERE user_id = ?
        `,
        userId
      )
    );
  }

  function ensurePrincipal(userId, username) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) {
      throw badRequest("userId is required", { field: "userId" });
    }

    const normalizedUsername = normalizeNullableText(username) || normalizedUserId;
    const existing = getPrincipalByUserId(normalizedUserId);
    if (existing) {
      if (normalizedUsername && normalizedUsername !== existing.username) {
        sql.run(
          `
            UPDATE admin_principals
            SET username = ?, updated_at = ?
            WHERE principal_id = ?
          `,
          normalizedUsername,
          nowIso(),
          existing.principalId
        );
      }
      return getPrincipalByUserId(normalizedUserId);
    }

    const createdAt = nowIso();
    sql.run(
      `
        INSERT INTO admin_principals (user_id, username, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
      `,
      normalizedUserId,
      normalizedUsername,
      createdAt,
      createdAt
    );

    return getPrincipalByUserId(normalizedUserId);
  }

  function getBindingByPrincipalAndScope(principalId, scopeType, scopeId) {
    return mapBindingRow(
      sql.get(
        `
          SELECT
            b.binding_id,
            b.principal_id,
            p.user_id,
            p.username,
            b.role,
            b.scope_type,
            b.scope_id,
            b.created_at,
            b.updated_at
          FROM admin_role_bindings b
          JOIN admin_principals p ON p.principal_id = b.principal_id
          WHERE b.principal_id = ? AND b.scope_type = ? AND b.scope_id = ?
        `,
        principalId,
        scopeType,
        scopeId
      )
    );
  }

  function getBindingById(bindingId) {
    return mapBindingRow(
      sql.get(
        `
          SELECT
            b.binding_id,
            b.principal_id,
            p.user_id,
            p.username,
            b.role,
            b.scope_type,
            b.scope_id,
            b.created_at,
            b.updated_at
          FROM admin_role_bindings b
          JOIN admin_principals p ON p.principal_id = b.principal_id
          WHERE b.binding_id = ?
        `,
        bindingId
      )
    );
  }

  function setBindingRole(principalId, scopeType, scopeId, role) {
    const normalizedRole = normalizeAdminRole(role);
    if (!normalizedRole) {
      throw badRequest("Invalid role", { field: "role", allowed: Array.from(ADMIN_ROLES) });
    }

    const existing = getBindingByPrincipalAndScope(principalId, scopeType, scopeId);
    if (existing) {
      sql.run(
        `
          UPDATE admin_role_bindings
          SET role = ?, updated_at = ?
          WHERE binding_id = ?
        `,
        normalizedRole,
        nowIso(),
        existing.bindingId
      );
      return getBindingById(existing.bindingId);
    }

    const createdAt = nowIso();
    sql.run(
      `
        INSERT INTO admin_role_bindings (
          principal_id,
          scope_type,
          scope_id,
          role,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      principalId,
      scopeType,
      scopeId,
      normalizedRole,
      createdAt,
      createdAt
    );
    return getBindingByPrincipalAndScope(principalId, scopeType, scopeId);
  }

  function getAdminContext(userId) {
    const principal = getPrincipalByUserId(userId);
    if (!principal) {
      return {
        principal: null,
        platformRole: null,
        siteRoles: [],
        roles: []
      };
    }

    const rows = sql.all(
      `
        SELECT
          b.binding_id,
          b.principal_id,
          p.user_id,
          p.username,
          b.role,
          b.scope_type,
          b.scope_id,
          b.created_at,
          b.updated_at
        FROM admin_role_bindings b
        JOIN admin_principals p ON p.principal_id = b.principal_id
        WHERE b.principal_id = ?
        ORDER BY b.scope_type ASC, b.scope_id ASC
      `,
      principal.principalId
    );
    const bindings = rows.map(mapBindingRow);
    const platformBinding =
      bindings.find((item) => item.scopeType === "platform" && item.role === "platform_admin") ||
      bindings.find((item) => item.scopeType === "platform") ||
      null;

    return {
      principal,
      platformRole: platformBinding?.role || null,
      siteRoles: bindings.filter((item) => item.scopeType === "site"),
      roles: bindings
    };
  }

  function bootstrapPlatformAdmin(user, options = {}) {
    const principal = ensurePrincipal(user.userId, user.username);
    const binding = getBindingByPrincipalAndScope(principal.principalId, "platform", "");
    if (binding) {
      return {
        created: false,
        binding
      };
    }

    const nextBinding = setBindingRole(principal.principalId, "platform", "", "platform_admin");
    recordAudit({
      actorUserId: user.userId,
      actorUsername: user.username,
      action: "role.bootstrap",
      targetType: "principal",
      targetId: user.userId,
      scopeType: "platform",
      scopeId: "",
      beforeJson: null,
      afterJson: toJsonText(nextBinding),
      requestId: options.requestId
    });

    return {
      created: true,
      binding: nextBinding
    };
  }

  function getSite(siteId) {
    return mapSiteRow(
      sql.get(
        `${createSiteSelectSql("WHERE s.site_id = ?")} LIMIT 1`,
        siteId
      )
    );
  }

  function assertSiteExists(siteId) {
    const site = getSite(siteId);
    if (!site) {
      throw notFound(`Site not found: ${siteId}`, { siteId });
    }
    return site;
  }

  function insertSite(site, actor, imported = false) {
    const createdAt = nowIso();
    sql.run(
      `
        INSERT INTO admin_sites (
          site_id,
          site_name,
          site_code,
          city,
          status,
          owner_name,
          remark,
          created_at,
          updated_at,
          created_by,
          updated_by,
          imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      site.siteId,
      normalizeNullableText(site.siteName) || site.siteId,
      normalizeNullableText(site.siteCode),
      normalizeNullableText(site.city),
      normalizeSiteStatus(site.status),
      normalizeNullableText(site.ownerName),
      normalizeNullableText(site.remark),
      createdAt,
      createdAt,
      normalizeNullableText(actor?.userId),
      normalizeNullableText(actor?.userId),
      imported ? createdAt : null
    );
  }

  function updateSiteRecord(siteId, patch, actor) {
    const existing = assertSiteExists(siteId);
    const updated = {
      siteName: normalizeNullableText(patch.siteName) || existing.siteName,
      siteCode: normalizeNullableText(patch.siteCode) ?? existing.siteCode,
      city: normalizeNullableText(patch.city) ?? existing.city,
      status: normalizeSiteStatus(patch.status, existing.status),
      ownerName: normalizeNullableText(patch.ownerName) ?? existing.ownerName,
      remark: normalizeNullableText(patch.remark) ?? existing.remark
    };
    sql.run(
      `
        UPDATE admin_sites
        SET
          site_name = ?,
          site_code = ?,
          city = ?,
          status = ?,
          owner_name = ?,
          remark = ?,
          updated_at = ?,
          updated_by = ?
        WHERE site_id = ?
      `,
      updated.siteName,
      updated.siteCode,
      updated.city,
      updated.status,
      updated.ownerName,
      updated.remark,
      nowIso(),
      normalizeNullableText(actor?.userId),
      siteId
    );
    return {
      before: existing,
      after: getSite(siteId)
    };
  }

  function createSite(site, actor, options = {}) {
    const normalizedSiteId = normalizeText(site.siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }

    if (getSite(normalizedSiteId)) {
      throw conflict(`Site already exists: ${normalizedSiteId}`, { siteId: normalizedSiteId });
    }

    return withTransaction(db, () => {
      insertSite(
        {
          siteId: normalizedSiteId,
          siteName: site.siteName,
          siteCode: site.siteCode,
          city: site.city,
          status: site.status,
          ownerName: site.ownerName,
          remark: site.remark
        },
        actor,
        options.imported === true
      );
      const created = getSite(normalizedSiteId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: options.imported ? "site.import" : "site.create",
        targetType: "site",
        targetId: normalizedSiteId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: null,
        afterJson: toJsonText(created),
        requestId: options.requestId
      });
      return created;
    });
  }

  function mergeImportedSite(existing, incoming) {
    return {
      siteName: existing.siteName || incoming.siteName || existing.siteId,
      siteCode: existing.siteCode || incoming.siteCode,
      city: existing.city || incoming.city,
      status: existing.status || "active",
      ownerName: existing.ownerName || incoming.ownerName || null,
      remark: existing.remark || incoming.remark || null
    };
  }

  function getSiteSourceConfig(siteId) {
    const row = sql.get(
      `
        SELECT
          site_id,
          legacy_base_url,
          ip_address,
          port,
          database_key,
          model_key,
          preferred_project_key,
          template,
          control_mode,
          status,
          created_at,
          updated_at
        FROM admin_site_source_configs
        WHERE site_id = ?
      `,
      siteId
    );
    if (!row) {
      return {
        siteId,
        legacyBaseUrl: null,
        ipAddress: null,
        port: null,
        databaseKey: null,
        modelKey: null,
        preferredProjectKey: null,
        template: null,
        controlMode: null,
        status: null,
        createdAt: null,
        updatedAt: null
      };
    }
    return {
      siteId: row.site_id,
      legacyBaseUrl: row.legacy_base_url || null,
      ipAddress: row.ip_address || null,
      port: row.port || null,
      databaseKey: row.database_key || null,
      modelKey: row.model_key || null,
      preferredProjectKey: row.preferred_project_key || null,
      template: row.template || null,
      controlMode: row.control_mode || null,
      status: row.status || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  function upsertSourceConfig(siteId, patch, actor, options = {}) {
    assertSiteExists(siteId);
    const existing = getSiteSourceConfig(siteId);
    const next = {
      legacyBaseUrl:
        options.preserveExisting && existing.legacyBaseUrl
          ? existing.legacyBaseUrl
          : normalizeNullableText(patch.legacyBaseUrl) ?? existing.legacyBaseUrl,
      ipAddress:
        options.preserveExisting && existing.ipAddress
          ? existing.ipAddress
          : normalizeNullableText(patch.ipAddress) ?? existing.ipAddress,
      port:
        options.preserveExisting && existing.port
          ? existing.port
          : normalizeNullableText(patch.port) ?? existing.port,
      databaseKey:
        options.preserveExisting && existing.databaseKey
          ? existing.databaseKey
          : normalizeNullableText(patch.databaseKey) ?? existing.databaseKey,
      modelKey:
        options.preserveExisting && existing.modelKey
          ? existing.modelKey
          : normalizeNullableText(patch.modelKey) ?? existing.modelKey,
      preferredProjectKey:
        options.preserveExisting && existing.preferredProjectKey
          ? existing.preferredProjectKey
          : normalizeNullableText(patch.preferredProjectKey) ?? existing.preferredProjectKey,
      template:
        options.preserveExisting && existing.template
          ? existing.template
          : normalizeNullableText(patch.template) ?? existing.template,
      controlMode:
        options.preserveExisting && existing.controlMode
          ? existing.controlMode
          : normalizeNullableText(patch.controlMode) ?? existing.controlMode,
      status:
        options.preserveExisting && existing.status
          ? existing.status
          : normalizeNullableText(patch.status) ?? existing.status
    };

    const hasExisting = Boolean(existing.createdAt);
    const timestamp = nowIso();
    if (hasExisting) {
      sql.run(
        `
          UPDATE admin_site_source_configs
          SET
            legacy_base_url = ?,
            ip_address = ?,
            port = ?,
            database_key = ?,
            model_key = ?,
            preferred_project_key = ?,
            template = ?,
            control_mode = ?,
            status = ?,
            updated_at = ?,
            updated_by = ?
          WHERE site_id = ?
        `,
        next.legacyBaseUrl,
        next.ipAddress,
        next.port,
        next.databaseKey,
        next.modelKey,
        next.preferredProjectKey,
        next.template,
        next.controlMode,
        next.status,
        timestamp,
        normalizeNullableText(actor?.userId),
        siteId
      );
    } else {
      sql.run(
        `
          INSERT INTO admin_site_source_configs (
            site_id,
            legacy_base_url,
            ip_address,
            port,
            database_key,
            model_key,
            preferred_project_key,
            template,
            control_mode,
            status,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        next.legacyBaseUrl,
        next.ipAddress,
        next.port,
        next.databaseKey,
        next.modelKey,
        next.preferredProjectKey,
        next.template,
        next.controlMode,
        next.status,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }

    const after = getSiteSourceConfig(siteId);
    if (!options.silent) {
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: options.imported ? "site.source-config.import" : "site.source-config.update",
        targetType: "site_source_config",
        targetId: siteId,
        scopeType: "site",
        scopeId: siteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
    }
    return after;
  }

  function getSiteRuntimeConfig(siteId) {
    const row = sql.get(
      `
        SELECT
          site_id,
          energy_params_json,
          rule_thresholds_json,
          feature_flags_json,
          version,
          created_at,
          updated_at
        FROM admin_site_runtime_configs
        WHERE site_id = ?
      `,
      siteId
    );
    if (!row) {
      return {
        siteId,
        energyParams: {},
        ruleThresholds: {},
        featureFlags: {},
        version: null,
        createdAt: null,
        updatedAt: null
      };
    }
    return {
      siteId: row.site_id,
      energyParams: safeJsonParse(row.energy_params_json, {}),
      ruleThresholds: safeJsonParse(row.rule_thresholds_json, {}),
      featureFlags: safeJsonParse(row.feature_flags_json, {}),
      version: typeof row.version === "number" ? row.version : null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  function upsertRuntimeConfig(siteId, patch, actor, options = {}) {
    assertSiteExists(siteId);
    const existing = getSiteRuntimeConfig(siteId);
    const next = {
      energyParams: patch.energyParams ?? existing.energyParams ?? {},
      ruleThresholds: patch.ruleThresholds ?? existing.ruleThresholds ?? {},
      featureFlags: patch.featureFlags ?? existing.featureFlags ?? {}
    };
    const hasExisting = Boolean(existing.createdAt);
    const timestamp = nowIso();
    if (hasExisting) {
      sql.run(
        `
          UPDATE admin_site_runtime_configs
          SET
            energy_params_json = ?,
            rule_thresholds_json = ?,
            feature_flags_json = ?,
            version = ?,
            updated_at = ?,
            updated_by = ?
          WHERE site_id = ?
        `,
        toJsonText(next.energyParams),
        toJsonText(next.ruleThresholds),
        toJsonText(next.featureFlags),
        (existing.version || 0) + 1,
        timestamp,
        normalizeNullableText(actor?.userId),
        siteId
      );
    } else {
      sql.run(
        `
          INSERT INTO admin_site_runtime_configs (
            site_id,
            energy_params_json,
            rule_thresholds_json,
            feature_flags_json,
            version,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
        `,
        siteId,
        toJsonText(next.energyParams),
        toJsonText(next.ruleThresholds),
        toJsonText(next.featureFlags),
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }

    const after = getSiteRuntimeConfig(siteId);
    recordAudit({
      actorUserId: actor?.userId,
      actorUsername: actor?.username,
      action: "site.runtime-config.update",
      targetType: "site_runtime_config",
      targetId: siteId,
      scopeType: "site",
      scopeId: siteId,
      beforeJson: toJsonText(existing),
      afterJson: toJsonText(after),
      requestId: options.requestId
    });
    return after;
  }

  function importSites(projects, actor, options = {}) {
    if (!Array.isArray(projects) || projects.length === 0) {
      return [];
    }

    const importedIds = [];
    withTransaction(db, () => {
      for (const project of projects) {
        const siteId = normalizeText(project.siteId);
        if (!siteId) {
          continue;
        }

        const existingSite = getSite(siteId);
        if (!existingSite) {
          insertSite(
            {
              siteId,
              siteName: project.siteName,
              siteCode: project.siteCode,
              city: project.city,
              status: "active",
              ownerName: null,
              remark: null
            },
            actor,
            true
          );
          const createdSite = getSite(siteId);
          recordAudit({
            actorUserId: actor?.userId,
            actorUsername: actor?.username,
            action: "site.import",
            targetType: "site",
            targetId: siteId,
            scopeType: "site",
            scopeId: siteId,
            beforeJson: null,
            afterJson: toJsonText(createdSite),
            requestId: options.requestId
          });
          importedIds.push(siteId);
        } else {
          const merged = mergeImportedSite(existingSite, project);
          sql.run(
            `
              UPDATE admin_sites
              SET
                site_name = ?,
                site_code = ?,
                city = ?,
                imported_at = COALESCE(imported_at, ?),
                updated_at = ?
              WHERE site_id = ?
            `,
            merged.siteName,
            merged.siteCode,
            merged.city,
            nowIso(),
            nowIso(),
            siteId
          );
        }

        upsertSourceConfig(
          siteId,
          {
            ipAddress: project.ipAddress,
            port: project.port,
            databaseKey: project.databaseKey,
            modelKey: project.modelKey,
            preferredProjectKey: project.preferredProjectKey,
            template: project.template,
            controlMode: project.controlMode,
            status: null
          },
          actor,
          {
            imported: true,
            preserveExisting: true,
            silent: true,
            requestId: options.requestId
          }
        );
      }
    });
    return importedIds;
  }

  function listSites(filters = {}, access = {}) {
    const where = [];
    const params = [];

    if (filters.status) {
      where.push("s.status = ?");
      params.push(filters.status);
    }

    const keyword = normalizeText(filters.keyword);
    if (keyword) {
      where.push(
        "(s.site_id LIKE ? OR s.site_name LIKE ? OR s.site_code LIKE ? OR s.city LIKE ? OR s.owner_name LIKE ?)"
      );
      params.push(
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`
      );
    }

    if (!access.allowAllSites) {
      const siteIds = Array.isArray(access.siteIds) ? access.siteIds.filter(Boolean) : [];
      if (siteIds.length === 0) {
        return [];
      }
      where.push(`s.site_id IN (${siteIds.map(() => "?").join(", ")})`);
      params.push(...siteIds);
    }

    const rows = sql.all(
      `${createSiteSelectSql(where.length > 0 ? `WHERE ${where.join(" AND ")}` : "")}
       ORDER BY s.updated_at DESC, s.site_id ASC`,
      ...params
    );

    return rows.map(mapSiteRow);
  }

  function listSiteMembers(siteId) {
    assertSiteExists(siteId);
    const rows = sql.all(
      `
        SELECT
          b.binding_id,
          b.principal_id,
          p.user_id,
          p.username,
          b.role,
          b.scope_type,
          b.scope_id,
          b.created_at,
          b.updated_at
        FROM admin_role_bindings b
        JOIN admin_principals p ON p.principal_id = b.principal_id
        WHERE b.scope_type = 'site' AND b.scope_id = ?
        ORDER BY b.updated_at DESC, p.user_id ASC
      `,
      siteId
    );
    return rows.map(mapBindingRow);
  }

  function createSiteMember(siteId, member, actor, options = {}) {
    assertSiteExists(siteId);
    const principal = ensurePrincipal(member.userId, member.username);
    const existing = getBindingByPrincipalAndScope(principal.principalId, "site", siteId);
    if (existing) {
      throw conflict(`Member already exists for site: ${siteId}`, {
        siteId,
        userId: principal.userId
      });
    }

    return withTransaction(db, () => {
      const binding = setBindingRole(principal.principalId, "site", siteId, member.role);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.member.create",
        targetType: "site_member",
        targetId: String(binding.bindingId),
        scopeType: "site",
        scopeId: siteId,
        beforeJson: null,
        afterJson: toJsonText(binding),
        requestId: options.requestId
      });
      return binding;
    });
  }

  function updateSiteMember(siteId, bindingId, role, actor, options = {}) {
    assertSiteExists(siteId);
    const existing = getBindingById(bindingId);
    if (!existing || existing.scopeType !== "site" || existing.scopeId !== siteId) {
      throw notFound(`Site member not found: ${bindingId}`, { siteId, bindingId });
    }

    return withTransaction(db, () => {
      const updated = setBindingRole(existing.principalId, "site", siteId, role);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.member.update",
        targetType: "site_member",
        targetId: String(bindingId),
        scopeType: "site",
        scopeId: siteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(updated),
        requestId: options.requestId
      });
      return updated;
    });
  }

  function deleteSiteMember(siteId, bindingId, actor, options = {}) {
    assertSiteExists(siteId);
    const existing = getBindingById(bindingId);
    if (!existing || existing.scopeType !== "site" || existing.scopeId !== siteId) {
      throw notFound(`Site member not found: ${bindingId}`, { siteId, bindingId });
    }

    withTransaction(db, () => {
      sql.run(`DELETE FROM admin_role_bindings WHERE binding_id = ?`, bindingId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.member.delete",
        targetType: "site_member",
        targetId: String(bindingId),
        scopeType: "site",
        scopeId: siteId,
        beforeJson: toJsonText(existing),
        afterJson: null,
        requestId: options.requestId
      });
    });

    return existing;
  }

  function getOptimizeExecution(siteId, executionId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedExecutionId = normalizeText(executionId);
    if (!normalizedSiteId || !normalizedExecutionId) {
      return null;
    }

    return mapOptimizeExecutionRow(
      sql.get(
        `${createOptimizeExecutionSelectSql("WHERE site_id = ? AND execution_id = ?")} LIMIT 1`,
        normalizedSiteId,
        normalizedExecutionId
      )
    );
  }

  function normalizeOptimizeExecutionRecord(siteId, record, fallbackNow = nowIso()) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedExecutionId = normalizeText(record?.executionId);
    const normalizedStatus = normalizeExecutionStatus(record?.status);
    const createdAt = normalizeNullableText(record?.createdAt) || fallbackNow;
    const updatedAt = normalizeNullableText(record?.updatedAt) || createdAt;
    const approvedAt = normalizeNullableText(record?.approvedAt ?? record?.approval?.approvedAt);
    const approvedBy = normalizeNullableText(record?.approvedBy ?? record?.approval?.approverUserId);
    const rolledBackAt =
      normalizeNullableText(record?.rolledBackAt ?? record?.rollback?.completedAt ?? record?.rollback?.requestedAt);
    const rolledBackBy = normalizeNullableText(record?.rolledBackBy ?? record?.rollback?.requestedBy);
    const timeline = Array.isArray(record?.timeline) ? cloneJson(record.timeline, []) : [];
    const approvalInput = record?.approval && typeof record.approval === "object" ? record.approval : {};
    const rollbackInput = record?.rollback && typeof record.rollback === "object" ? record.rollback : {};

    return {
      executionId: normalizedExecutionId,
      siteId: normalizedSiteId,
      createdAt,
      updatedAt,
      status: normalizedStatus,
      draft: record?.draft && typeof record.draft === "object" ? cloneJson(record.draft, {}) : {
        generatedAt: null,
        gateLevel: null
      },
      execution: record?.execution && typeof record.execution === "object" ? cloneJson(record.execution, {}) : {},
      approval: {
        required: approvalInput.required !== false,
        status: approvalInput.status || (approvedAt ? "approved" : "pending"),
        requestedAt: approvalInput.requestedAt || createdAt,
        approvedAt,
        approverUserId: approvedBy,
        note: approvalInput.note || null
      },
      rollback: {
        status: rollbackInput.status || (rolledBackAt ? "completed" : "none"),
        reason: rollbackInput.reason || null,
        requestedBy: rolledBackBy,
        requestedAt: rollbackInput.requestedAt || rolledBackAt,
        completedAt: rollbackInput.completedAt || rolledBackAt
      },
      approvedAt,
      approvedBy,
      rolledBackAt,
      rolledBackBy,
      timeline
    };
  }

  function normalizeChillerStagingSampleRecord(siteId, sample, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    const fallbackNow = normalizeNullableText(options.capturedAt) || nowIso();
    const combination = normalizeChillerCombination(
      sample?.combination ||
      sample?.runningCombination ||
      sample?.activeChillerIds ||
      sample?.chillerIds
    );
    const combinationKey = normalizeText(sample?.combinationKey) || buildChillerCombinationKey(combination);
    const loadKw = normalizeFiniteNumber(sample?.loadKw ?? sample?.systemCoolingLoadKw ?? sample?.coolingLoadKw);
    const stationPowerKw = normalizeFiniteNumber(
      sample?.stationPowerKw ?? sample?.stationPowerTotalKw ?? sample?.totalPowerKw
    );
    const chillerPowerKw = normalizeFiniteNumber(
      sample?.chillerPowerKw ?? sample?.chillerPowerTotalKw ?? sample?.chillerPower
    );
    if (!combination.length || !combinationKey) {
      throw badRequest("chiller staging sample requires running combination", {
        field: "sample.combination"
      });
    }
    if (loadKw === null || stationPowerKw === null || chillerPowerKw === null) {
      throw badRequest("chiller staging sample requires load, station power and chiller power", {
        field: "sample.loadKw/stationPowerKw/chillerPowerKw"
      });
    }
    const capturedAt = normalizeNullableText(sample?.capturedAt ?? sample?.timestamp ?? sample?.ts) || fallbackNow;
    const createdAt = normalizeNullableText(options.createdAt) || nowIso();
    const payload = {
      ...cloneJson(sample, {}),
      sampleId: normalizeNullableText(sample?.sampleId) || createChillerStagingSampleId(normalizedSiteId),
      siteId: normalizedSiteId,
      combination,
      combinationKey,
      capturedAt,
      source: normalizeNullableText(sample?.source) || "current_realtime_snapshot",
      includedInHistory: true,
      persistedSample: true,
      loadKw,
      loadRatePct: normalizeFiniteNumber(sample?.loadRatePct ?? sample?.combinationPlrPct),
      wetBulbC: normalizeFiniteNumber(sample?.wetBulbC ?? sample?.outdoorWetBulbC ?? sample?.outdoorTempC),
      chilledSupplyTempC: normalizeFiniteNumber(sample?.chilledSupplyTempC ?? sample?.chilledSupplyTemp),
      stationPowerKw,
      chillerPowerKw,
      stationCop: normalizeFiniteNumber(sample?.stationCop) ?? Number((loadKw / stationPowerKw).toFixed(2)),
      comboCop: normalizeFiniteNumber(sample?.comboCop) ?? Number((loadKw / chillerPowerKw).toFixed(2)),
      kwPerRt: normalizeFiniteNumber(sample?.kwPerRt),
      sampleMinutes: normalizeFiniteNumber(sample?.sampleMinutes ?? sample?.intervalMinutes) ?? 5,
      alarmCount: normalizeNonNegativeInteger(sample?.alarmCount ?? sample?.activeAlarmCount)
    };
    return {
      sampleId: payload.sampleId,
      siteId: normalizedSiteId,
      combinationKey,
      combination,
      sample: payload,
      capturedAt,
      createdAt,
      requestId: normalizeNullableText(options.requestId),
      source: payload.source,
      loadKw: payload.loadKw,
      loadRatePct: payload.loadRatePct,
      wetBulbC: payload.wetBulbC,
      chilledSupplyTempC: payload.chilledSupplyTempC,
      stationPowerKw: payload.stationPowerKw,
      chillerPowerKw: payload.chillerPowerKw,
      stationCop: payload.stationCop,
      comboCop: payload.comboCop,
      kwPerRt: payload.kwPerRt,
      sampleMinutes: payload.sampleMinutes,
      alarmCount: payload.alarmCount
    };
  }

  function normalizeHvacTerminalSampleRecord(siteId, snapshot, item, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    const normalizedItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const floor = normalizeNullableText(options.floor ?? snapshot?.floor) || "1";
    const sampledAt = normalizeNullableText(normalizedItem.sampledAt ?? snapshot?.sampledAt ?? options.sampledAt) || nowIso();
    const deviceCode =
      normalizeNullableText(normalizedItem.deviceCode) ||
      normalizeNullableText(normalizedItem.deviceName) ||
      normalizeNullableText(normalizedItem.deviceId);
    if (!deviceCode) {
      return null;
    }
    const quality = normalizedItem.quality && typeof normalizedItem.quality === "object" ? normalizedItem.quality : {};
    const qualityFlags = normalizeTextList(Array.isArray(quality.flags) ? quality.flags : []);
    return {
      sampleId:
        normalizeNullableText(normalizedItem.sampleId) ||
        createHvacTerminalSampleId(normalizedSiteId, floor, deviceCode, sampledAt),
      siteId: normalizedSiteId,
      building: normalizeNullableText(options.building ?? snapshot?.building),
      floor,
      floorName: normalizeNullableText(options.floorName ?? snapshot?.floorName ?? normalizedItem.floorName),
      deviceId: normalizeNullableText(normalizedItem.deviceId),
      deviceCode,
      deviceName: normalizeNullableText(normalizedItem.deviceName),
      sampledAt,
      zoneTemperatureC: normalizeFiniteNumber(normalizedItem.zoneTemperatureC),
      setpointC: normalizeFiniteNumber(normalizedItem.setpointFeedbackC ?? normalizedItem.setpointC),
      running:
        typeof normalizedItem.running === "boolean"
          ? normalizedItem.running
          : null,
      valveOpen:
        typeof normalizedItem.valveOpen === "boolean"
          ? normalizedItem.valveOpen
          : null,
      valveOpenPct: normalizeFiniteNumber(normalizedItem.valveOpenPct),
      fanSpeedState: normalizeFiniteNumber(normalizedItem.fanSpeedState),
      communicationAlarm:
        typeof normalizedItem.communicationAlarm === "boolean"
          ? normalizedItem.communicationAlarm
          : null,
      qualityStatus: normalizeNullableText(quality.status) || "unknown",
      qualityFlags,
      rawTagTime: normalizeNullableText(normalizedItem.rawTagTime),
      sourceStatus: normalizeNullableText(snapshot?.summary?.dataStatus ?? snapshot?.sourceStatus?.overall),
      createdAt: normalizeNullableText(options.createdAt) || nowIso(),
      requestId: normalizeNullableText(options.requestId)
    };
  }

  function normalizeShadowVerificationRecord(siteId, record, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    const source = record && typeof record === "object" && !Array.isArray(record) ? record : {};
    const verificationType = normalizeNullableText(source.verificationType ?? source.type) || "chiller-staging";
    const rawOutcome = normalizeText(source.outcome).toLowerCase() || "pending";
    if (!SHADOW_VERIFICATION_OUTCOMES.has(rawOutcome)) {
      throw badRequest("shadow verification record outcome is invalid", {
        field: "outcome",
        allowed: Array.from(SHADOW_VERIFICATION_OUTCOMES)
      });
    }
    const metrics = source.metrics && typeof source.metrics === "object" && !Array.isArray(source.metrics)
      ? source.metrics
      : {};
    const recordedAt = normalizeNullableText(source.recordedAt ?? source.timestamp ?? source.createdAt) || nowIso();
    const createdAt = normalizeNullableText(options.createdAt) || nowIso();
    const payload = {
      ...cloneJson(source, {}),
      recordId: normalizeNullableText(source.recordId) || createShadowVerificationRecordId(normalizedSiteId),
      siteId: normalizedSiteId,
      executionId: normalizeNullableText(source.executionId),
      verificationType,
      targetLabel: normalizeNullableText(source.targetLabel),
      outcome: rawOutcome,
      windowMinutes: normalizeNonNegativeInteger(source.windowMinutes ?? metrics.windowMinutes),
      metrics: {
        loadKw: normalizeFiniteNumber(metrics.loadKw ?? source.loadKw),
        wetBulbC: normalizeFiniteNumber(metrics.wetBulbC ?? source.wetBulbC),
        stationCop: normalizeFiniteNumber(metrics.stationCop ?? source.stationCop),
        comboCop: normalizeFiniteNumber(metrics.comboCop ?? source.comboCop),
        kwPerRt: normalizeFiniteNumber(metrics.kwPerRt ?? source.kwPerRt),
        stationPowerKw: normalizeFiniteNumber(metrics.stationPowerKw ?? source.stationPowerKw),
        chillerPowerKw: normalizeFiniteNumber(metrics.chillerPowerKw ?? source.chillerPowerKw),
        alarmCount: normalizeNonNegativeInteger(metrics.alarmCount ?? source.alarmCount)
      },
      note: normalizeNullableText(source.note),
      invalidReason: normalizeNullableText(source.invalidReason),
      sourceRecordId: normalizeNullableText(source.sourceRecordId),
      recordedAt,
      recordedBy: normalizeNullableText(source.recordedBy ?? options.recordedBy),
      appendOnly: true,
      controlMutation: false
    };
    return {
      recordId: payload.recordId,
      siteId: normalizedSiteId,
      executionId: payload.executionId,
      verificationType,
      targetLabel: payload.targetLabel,
      outcome: rawOutcome,
      windowMinutes: payload.windowMinutes,
      loadKw: payload.metrics.loadKw,
      wetBulbC: payload.metrics.wetBulbC,
      stationCop: payload.metrics.stationCop,
      comboCop: payload.metrics.comboCop,
      kwPerRt: payload.metrics.kwPerRt,
      stationPowerKw: payload.metrics.stationPowerKw,
      chillerPowerKw: payload.metrics.chillerPowerKw,
      alarmCount: payload.metrics.alarmCount,
      payload,
      recordedAt,
      createdAt,
      sourceRecordId: payload.sourceRecordId,
      recordedBy: payload.recordedBy,
      requestId: normalizeNullableText(options.requestId)
    };
  }

  function insertOptimizeExecutionRow(record) {
    sql.run(
      `
        INSERT INTO admin_optimize_executions (
          execution_id,
          site_id,
          status,
          payload_json,
          timeline_json,
          created_at,
          updated_at,
          approved_at,
          approved_by,
          rolled_back_at,
          rolled_back_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.executionId,
      record.siteId,
      record.status,
      toJsonText(record),
      toJsonText(record.timeline, []),
      record.createdAt,
      record.updatedAt,
      record.approvedAt,
      record.approvedBy,
      record.rolledBackAt,
      record.rolledBackBy
    );
  }

  function updateOptimizeExecutionRow(record) {
    sql.run(
      `
        UPDATE admin_optimize_executions
        SET
          status = ?,
          payload_json = ?,
          timeline_json = ?,
          updated_at = ?,
          approved_at = ?,
          approved_by = ?,
          rolled_back_at = ?,
          rolled_back_by = ?
        WHERE execution_id = ? AND site_id = ?
      `,
      record.status,
      toJsonText(record),
      toJsonText(record.timeline, []),
      record.updatedAt,
      record.approvedAt,
      record.approvedBy,
      record.rolledBackAt,
      record.rolledBackBy,
      record.executionId,
      record.siteId
    );
  }

  function insertChillerStagingSampleRow(record) {
    sql.run(
      `
        INSERT INTO admin_chiller_staging_samples (
          sample_id,
          site_id,
          combination_key,
          combination_json,
          sample_payload_json,
          source,
          captured_at,
          created_at,
          request_id,
          load_kw,
          load_rate_pct,
          wet_bulb_c,
          chilled_supply_temp_c,
          station_power_kw,
          chiller_power_kw,
          station_cop,
          combo_cop,
          kw_per_rt,
          sample_minutes,
          alarm_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.sampleId,
      record.siteId,
      record.combinationKey,
      toJsonText(record.combination, []),
      toJsonText(record.sample, {}),
      record.source,
      record.capturedAt,
      record.createdAt,
      record.requestId,
      record.loadKw,
      record.loadRatePct,
      record.wetBulbC,
      record.chilledSupplyTempC,
      record.stationPowerKw,
      record.chillerPowerKw,
      record.stationCop,
      record.comboCop,
      record.kwPerRt,
      record.sampleMinutes,
      record.alarmCount
    );
  }

  function insertHvacTerminalSampleRow(record) {
    return sql.run(
      `
        INSERT OR IGNORE INTO admin_hvac_terminal_samples (
          sample_id,
          site_id,
          building,
          floor,
          floor_name,
          device_id,
          device_code,
          device_name,
          sampled_at,
          zone_temp_c,
          setpoint_c,
          running,
          valve_open,
          valve_open_pct,
          fan_speed_state,
          communication_alarm,
          quality_status,
          quality_flags_json,
          raw_tag_time,
          source_status,
          created_at,
          request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.sampleId,
      record.siteId,
      record.building,
      record.floor,
      record.floorName,
      record.deviceId,
      record.deviceCode,
      record.deviceName,
      record.sampledAt,
      record.zoneTemperatureC,
      record.setpointC,
      record.running == null ? null : record.running ? 1 : 0,
      record.valveOpen == null ? null : record.valveOpen ? 1 : 0,
      record.valveOpenPct,
      record.fanSpeedState,
      record.communicationAlarm == null ? null : record.communicationAlarm ? 1 : 0,
      record.qualityStatus,
      toJsonText(record.qualityFlags, []),
      record.rawTagTime,
      record.sourceStatus,
      record.createdAt,
      record.requestId
    );
  }

  function insertShadowVerificationRecordRow(record) {
    sql.run(
      `
        INSERT INTO admin_shadow_verification_records (
          record_id,
          site_id,
          execution_id,
          verification_type,
          target_label,
          outcome,
          window_minutes,
          load_kw,
          wet_bulb_c,
          station_cop,
          combo_cop,
          kw_per_rt,
          station_power_kw,
          chiller_power_kw,
          alarm_count,
          payload_json,
          recorded_at,
          created_at,
          recorded_by,
          request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      record.recordId,
      record.siteId,
      record.executionId,
      record.verificationType,
      record.targetLabel,
      record.outcome,
      record.windowMinutes,
      record.loadKw,
      record.wetBulbC,
      record.stationCop,
      record.comboCop,
      record.kwPerRt,
      record.stationPowerKw,
      record.chillerPowerKw,
      record.alarmCount,
      toJsonText(record.payload, {}),
      record.recordedAt,
      record.createdAt,
      record.recordedBy,
      record.requestId
    );
  }

  function getFcuControlPolicy(siteId) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return null;
    }
    return mapFcuControlPolicyRow(
      sql.get(
        `
          SELECT *
          FROM admin_fcu_control_policies
          WHERE site_id = ?
          LIMIT 1
        `,
        normalizedSiteId
      )
    );
  }

  function upsertFcuControlPolicy(siteId, policy, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const existing = getFcuControlPolicy(normalizedSiteId);
    const timestamp = nowIso();
    const nextPolicy = cloneJson(policy, {});
    return withTransaction(db, () => {
      if (existing) {
        sql.run(
          `
            UPDATE admin_fcu_control_policies
            SET policy_json = ?, updated_at = ?, updated_by = ?
            WHERE site_id = ?
          `,
          toJsonText(nextPolicy, {}),
          timestamp,
          normalizeNullableText(actor?.userId),
          normalizedSiteId
        );
      } else {
        sql.run(
          `
            INSERT INTO admin_fcu_control_policies (
              site_id,
              policy_json,
              created_at,
              updated_at,
              created_by,
              updated_by
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          normalizedSiteId,
          toJsonText(nextPolicy, {}),
          timestamp,
          timestamp,
          normalizeNullableText(actor?.userId),
          normalizeNullableText(actor?.userId)
        );
      }
      const updated = getFcuControlPolicy(normalizedSiteId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "hvac-terminal.fcu-control-policy.upsert",
        targetType: "fcu_control_policy",
        targetId: normalizedSiteId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(updated),
        requestId: options.requestId
      });
      return updated;
    });
  }

  function createFcuControlRecord(siteId, decision, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const source = decision && typeof decision === "object" && !Array.isArray(decision) ? decision : {};
    const timestamp = normalizeNullableText(source.createdAt) || nowIso();
    const recordId = normalizeNullableText(source.recordId) || createFcuControlRecordId(normalizedSiteId);
    const deviceCode = normalizeNullableText(source.deviceCode);
    if (!deviceCode) {
      throw badRequest("deviceCode is required", { field: "deviceCode" });
    }
    const payload = {
      ...cloneJson(source, {}),
      recordId,
      siteId: normalizedSiteId,
      createdAt: timestamp,
      createdBy: normalizeNullableText(actor?.userId),
      controlMutation: source?.dispatch?.controlMutation === true
    };
    sql.run(
      `
        INSERT INTO admin_fcu_control_records (
          record_id,
          site_id,
          device_code,
          device_name,
          mode,
          status,
          action_kind,
          reason,
          payload_json,
          created_at,
          created_by,
          updated_at,
          request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      recordId,
      normalizedSiteId,
      deviceCode,
      normalizeNullableText(source.deviceName),
      normalizeNullableText(source.mode) || "shadow",
      normalizeNullableText(source.status) || "held",
      normalizeNullableText(source.actionKind) || "hold",
      normalizeNullableText(source.reason),
      toJsonText(payload, {}),
      timestamp,
      normalizeNullableText(actor?.userId),
      timestamp,
      normalizeNullableText(options.requestId)
    );
    const created = getFcuControlRecord(normalizedSiteId, recordId);
    recordAudit({
      actorUserId: actor?.userId,
      actorUsername: actor?.username,
      action: "hvac-terminal.fcu-control-record.create",
      targetType: "fcu_control_record",
      targetId: recordId,
      scopeType: "site",
      scopeId: normalizedSiteId,
      beforeJson: null,
      afterJson: toJsonText(created),
      requestId: options.requestId
    });
    return created;
  }

  function getFcuControlRecord(siteId, recordId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedRecordId = normalizeText(recordId);
    if (!normalizedSiteId || !normalizedRecordId) {
      return null;
    }
    return mapFcuControlRecordRow(
      sql.get(
        `
          SELECT *
          FROM admin_fcu_control_records
          WHERE site_id = ? AND record_id = ?
          LIMIT 1
        `,
        normalizedSiteId,
        normalizedRecordId
      )
    );
  }

  function listFcuControlRecords(siteId, filters = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        siteId: "",
        total: 0,
        items: []
      };
    }
    const where = ["site_id = ?"];
    const params = [normalizedSiteId];
    const deviceCode = normalizeText(filters.deviceCode);
    const status = normalizeText(filters.status);
    if (deviceCode) {
      where.push("device_code = ?");
      params.push(deviceCode);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const totalRow = sql.get(
      `
        SELECT COUNT(*) AS count
        FROM admin_fcu_control_records
        WHERE ${where.join(" AND ")}
      `,
      ...params
    );
    const items = sql
      .all(
        `
          SELECT *
          FROM admin_fcu_control_records
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC, record_id DESC
          LIMIT ?
        `,
        ...params,
        normalizeFcuControlRecordLimit(filters.limit)
      )
      .map(mapFcuControlRecordRow)
      .filter(Boolean);
    return {
      siteId: normalizedSiteId,
      total: typeof totalRow?.count === "number" ? totalRow.count : 0,
      items
    };
  }

  function rollbackFcuControlRecord(siteId, recordId, payload = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedRecordId = normalizeText(recordId);
    if (!normalizedSiteId || !normalizedRecordId) {
      throw badRequest("recordId is required", { field: "recordId" });
    }
    const existing = getFcuControlRecord(normalizedSiteId, normalizedRecordId);
    if (!existing) {
      throw notFound("FCU control record not found", { recordId: normalizedRecordId });
    }
    const timestamp = nowIso();
    const reason = normalizeNullableText(payload?.reason) || "manual rollback";
    const nextPayload = {
      ...(existing.payload && typeof existing.payload === "object" ? existing.payload : existing),
      status: "rolled_back",
      rolledBackAt: timestamp,
      rolledBackBy: normalizeNullableText(actor?.userId),
      rollbackReason: reason
    };
    return withTransaction(db, () => {
      sql.run(
        `
          UPDATE admin_fcu_control_records
          SET status = ?, payload_json = ?, updated_at = ?, rolled_back_at = ?, rolled_back_by = ?, rollback_reason = ?
          WHERE site_id = ? AND record_id = ?
        `,
        "rolled_back",
        toJsonText(nextPayload, {}),
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        reason,
        normalizedSiteId,
        normalizedRecordId
      );
      const updated = getFcuControlRecord(normalizedSiteId, normalizedRecordId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "hvac-terminal.fcu-control-record.rollback",
        targetType: "fcu_control_record",
        targetId: normalizedRecordId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(updated),
        requestId: options.requestId
      });
      return updated;
    });
  }

  function verifyFcuControlRecordFeedback(siteId, recordId, verification = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedRecordId = normalizeText(recordId);
    if (!normalizedSiteId || !normalizedRecordId) {
      throw badRequest("recordId is required", { field: "recordId" });
    }
    const existing = getFcuControlRecord(normalizedSiteId, normalizedRecordId);
    if (!existing) {
      throw notFound("FCU control record not found", { recordId: normalizedRecordId });
    }
    const timestamp = nowIso();
    const nextStatus = normalizeNullableText(verification?.status) || existing.status;
    const nextReason = normalizeNullableText(verification?.reason) || existing.reason;
    const nextPayload = {
      ...(existing.payload && typeof existing.payload === "object" ? existing.payload : existing),
      ...cloneJson(verification, {}),
      status: nextStatus,
      reason: nextReason,
      feedback: cloneJson(verification?.feedback, existing.feedback || null),
      updatedAt: timestamp
    };
    return withTransaction(db, () => {
      sql.run(
        `
          UPDATE admin_fcu_control_records
          SET status = ?, reason = ?, payload_json = ?, updated_at = ?
          WHERE site_id = ? AND record_id = ?
        `,
        nextStatus,
        nextReason,
        toJsonText(nextPayload, {}),
        timestamp,
        normalizedSiteId,
        normalizedRecordId
      );
      const updated = getFcuControlRecord(normalizedSiteId, normalizedRecordId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "hvac-terminal.fcu-control-record.verify-feedback",
        targetType: "fcu_control_record",
        targetId: normalizedRecordId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(updated),
        requestId: options.requestId
      });
      return updated;
    });
  }

  function createOptimizeExecution(siteId, record, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }

    const normalizedRecord = normalizeOptimizeExecutionRecord(normalizedSiteId, record);
    if (!normalizedRecord.executionId) {
      throw badRequest("executionId is required", { field: "execution.executionId" });
    }

    return withTransaction(db, () => {
      const existing = getOptimizeExecution(normalizedSiteId, normalizedRecord.executionId);
      if (existing) {
        throw conflict(`Execution already exists: ${normalizedRecord.executionId}`, {
          executionId: normalizedRecord.executionId
        });
      }

      insertOptimizeExecutionRow(normalizedRecord);
      const created = getOptimizeExecution(normalizedSiteId, normalizedRecord.executionId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "optimize.execution.create",
        targetType: "optimize_execution",
        targetId: normalizedRecord.executionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: null,
        afterJson: toJsonText(created),
        requestId: options.requestId
      });
      return created;
    });
  }

  function createChillerStagingSample(siteId, sample, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const normalizedRecord = normalizeChillerStagingSampleRecord(normalizedSiteId, sample, {
      requestId: options.requestId,
      capturedAt: options.capturedAt
    });
    return withTransaction(db, () => {
      insertChillerStagingSampleRow(normalizedRecord);
      const created = getChillerStagingSample(normalizedSiteId, normalizedRecord.sampleId);
      if (options.audit === true) {
        recordAudit({
          actorUserId: actor?.userId,
          actorUsername: actor?.username,
          action: "optimize.chiller-staging-sample.create",
          targetType: "chiller_staging_sample",
          targetId: normalizedRecord.sampleId,
          scopeType: "site",
          scopeId: normalizedSiteId,
          beforeJson: null,
          afterJson: toJsonText(created),
          requestId: options.requestId
        });
      }
      return created;
    });
  }

  function getChillerStagingSample(siteId, sampleId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedSampleId = normalizeText(sampleId);
    if (!normalizedSiteId || !normalizedSampleId) {
      return null;
    }
    return mapChillerStagingSampleRow(
      sql.get(
        `
          SELECT *
          FROM admin_chiller_staging_samples
          WHERE site_id = ? AND sample_id = ?
          LIMIT 1
        `,
        normalizedSiteId,
        normalizedSampleId
      )
    );
  }

  function listChillerStagingSamples(siteId, filters = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        siteId: "",
        total: 0,
        items: []
      };
    }
    const limit = normalizeChillerStagingSampleLimit(filters.limit);
    const where = ["site_id = ?"];
    const params = [normalizedSiteId];
    const combinationKey = normalizeText(filters.combinationKey).toUpperCase();
    if (combinationKey) {
      where.push("combination_key = ?");
      params.push(combinationKey);
    }
    const totalRow = sql.get(
      `
        SELECT COUNT(*) AS count
        FROM admin_chiller_staging_samples
        WHERE ${where.join(" AND ")}
      `,
      ...params
    );
    const items = sql
      .all(
        `
          SELECT *
          FROM admin_chiller_staging_samples
          WHERE ${where.join(" AND ")}
          ORDER BY captured_at DESC, created_at DESC, sample_id DESC
          LIMIT ?
        `,
        ...params,
        limit
      )
      .map(mapChillerStagingSampleRow)
      .filter(Boolean);
    return {
      siteId: normalizedSiteId,
      total: typeof totalRow?.count === "number" ? totalRow.count : 0,
      items
    };
  }

  function getLatestChillerStagingSample(siteId, filters = {}) {
    const list = listChillerStagingSamples(siteId, {
      ...filters,
      limit: 1
    });
    return list.items[0] || null;
  }

  function getLatestHvacTerminalSample(siteId, filters = {}) {
    const list = listHvacTerminalSamples(siteId, {
      ...filters,
      limit: 1
    });
    return list.items[0] || null;
  }

  function appendHvacTerminalSnapshotSamples(siteId, snapshot, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const floor = normalizeNullableText(options.floor ?? snapshot?.floor) || "1";
    const sampledAt = normalizeNullableText(snapshot?.sampledAt ?? options.sampledAt) || nowIso();
    const minIntervalSeconds = normalizeHvacTerminalSampleIntervalSeconds(options.minIntervalSeconds);
    const latest = getLatestHvacTerminalSample(normalizedSiteId, { floor });
    const elapsedSeconds =
      latest?.sampledAt && Number.isFinite(Date.parse(latest.sampledAt))
        ? (Date.parse(sampledAt) - Date.parse(latest.sampledAt)) / 1000
        : Number.POSITIVE_INFINITY;

    if (latest && elapsedSeconds >= 0 && elapsedSeconds < minIntervalSeconds) {
      return {
        status: "skipped_recent",
        siteId: normalizedSiteId,
        floor,
        sampledAt,
        inserted: 0,
        skipped: items.length,
        latestSampledAt: latest.sampledAt,
        minIntervalSeconds
      };
    }

    const records = items
      .map((item) =>
        normalizeHvacTerminalSampleRecord(normalizedSiteId, snapshot, item, {
          ...options,
          floor,
          sampledAt,
          requestId: options.requestId,
          createdAt: options.createdAt
        })
      )
      .filter(Boolean);

    let inserted = 0;
    withTransaction(db, () => {
      for (const record of records) {
        const result = insertHvacTerminalSampleRow(record);
        inserted += Number(result?.changes || 0);
      }
      if (options.audit === true && inserted > 0) {
        recordAudit({
          actorUserId: actor?.userId,
          actorUsername: actor?.username,
          action: "hvac-terminal.samples.append",
          targetType: "hvac_terminal_samples",
          targetId: `${normalizedSiteId}:${floor}:${sampledAt}`,
          scopeType: "site",
          scopeId: normalizedSiteId,
          beforeJson: null,
          afterJson: toJsonText({ floor, sampledAt, inserted }),
          requestId: options.requestId
        });
      }
    });

    return {
      status: inserted > 0 ? "recorded" : "duplicate",
      siteId: normalizedSiteId,
      floor,
      sampledAt,
      inserted,
      skipped: Math.max(0, records.length - inserted),
      latestSampledAt: latest?.sampledAt || null,
      minIntervalSeconds
    };
  }

  function listHvacTerminalSamples(siteId, filters = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        siteId: "",
        total: 0,
        items: []
      };
    }
    const limit = normalizeHvacTerminalSampleLimit(filters.limit);
    const where = ["site_id = ?"];
    const params = [normalizedSiteId];
    const floor = normalizeText(filters.floor);
    const deviceCode = normalizeText(filters.deviceCode);
    if (floor) {
      where.push("floor = ?");
      params.push(floor);
    }
    if (deviceCode) {
      where.push("device_code = ?");
      params.push(deviceCode);
    }
    const totalRow = sql.get(
      `
        SELECT COUNT(*) AS count
        FROM admin_hvac_terminal_samples
        WHERE ${where.join(" AND ")}
      `,
      ...params
    );
    const items = sql
      .all(
        `
          SELECT *
          FROM admin_hvac_terminal_samples
          WHERE ${where.join(" AND ")}
          ORDER BY sampled_at DESC, created_at DESC, device_code ASC
          LIMIT ?
        `,
        ...params,
        limit
      )
      .map(mapHvacTerminalSampleRow)
      .filter(Boolean);
    return {
      siteId: normalizedSiteId,
      total: typeof totalRow?.count === "number" ? totalRow.count : 0,
      items
    };
  }

  function listHvacTerminalSampleTimeline(siteId, filters = {}) {
    const limit = normalizeHvacTerminalSampleLimit(filters.limit);
    const list = listHvacTerminalSamples(siteId, {
      ...filters,
      limit
    });
    const buckets = new Map();
    for (const sample of list.items) {
      const key = sample.sampledAt || "";
      if (!key) {
        continue;
      }
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(sample);
    }
    const items = Array.from(buckets.entries())
      .map(([sampledAt, samples]) => {
        const validComfortSamples = samples.filter(
          (item) => item.qualityStatus === "ok" && typeof item.zoneTemperatureC === "number"
        );
        const averageZoneTemperatureC =
          validComfortSamples.length > 0
            ? Number(
                (
                  validComfortSamples.reduce((sum, item) => sum + item.zoneTemperatureC, 0) /
                  validComfortSamples.length
                ).toFixed(1)
              )
            : null;
        return {
          sampledAt,
          total: samples.length,
          runningCount: samples.filter((item) => item.running === true).length,
          stoppedCount: samples.filter((item) => item.running === false).length,
          communicationAlarmCount: samples.filter((item) => item.communicationAlarm === true).length,
          invalidTemperatureCount: samples.filter((item) => item.qualityFlags.includes("invalid_temperature")).length,
          zeroTemperatureCount: samples.filter((item) => item.qualityFlags.includes("zero_temperature")).length,
          comfortEligibleCount: validComfortSamples.length,
          averageZoneTemperatureC
        };
      })
      .sort((left, right) => String(left.sampledAt).localeCompare(String(right.sampledAt)));
    return {
      siteId: list.siteId,
      floor: normalizeNullableText(filters.floor),
      totalSamples: list.total,
      items
    };
  }

  function createShadowVerificationRecord(siteId, record, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const normalizedRecord = normalizeShadowVerificationRecord(normalizedSiteId, record, {
      requestId: options.requestId,
      recordedBy: actor?.userId
    });
    return withTransaction(db, () => {
      insertShadowVerificationRecordRow(normalizedRecord);
      const created = getShadowVerificationRecord(normalizedSiteId, normalizedRecord.recordId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "optimize.shadow-verification-record.create",
        targetType: "shadow_verification_record",
        targetId: normalizedRecord.recordId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: null,
        afterJson: toJsonText(created),
        requestId: options.requestId
      });
      return created;
    });
  }

  function getShadowVerificationRecord(siteId, recordId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedRecordId = normalizeText(recordId);
    if (!normalizedSiteId || !normalizedRecordId) {
      return null;
    }
    return mapShadowVerificationRecordRow(
      sql.get(
        `
          SELECT *
          FROM admin_shadow_verification_records
          WHERE site_id = ? AND record_id = ?
          LIMIT 1
        `,
        normalizedSiteId,
        normalizedRecordId
      )
    );
  }

  function listShadowVerificationRecords(siteId, filters = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        siteId: "",
        total: 0,
        items: []
      };
    }
    const limit = normalizeShadowVerificationRecordLimit(filters.limit);
    const where = ["site_id = ?"];
    const params = [normalizedSiteId];
    const executionId = normalizeText(filters.executionId);
    const verificationType = normalizeText(filters.verificationType || filters.type);
    if (executionId) {
      where.push("execution_id = ?");
      params.push(executionId);
    }
    if (verificationType) {
      where.push("verification_type = ?");
      params.push(verificationType);
    }
    const totalRow = sql.get(
      `
        SELECT COUNT(*) AS count
        FROM admin_shadow_verification_records
        WHERE ${where.join(" AND ")}
      `,
      ...params
    );
    const items = sql
      .all(
        `
          SELECT *
          FROM admin_shadow_verification_records
          WHERE ${where.join(" AND ")}
          ORDER BY recorded_at DESC, created_at DESC, record_id DESC
          LIMIT ?
        `,
        ...params,
        limit
      )
      .map(mapShadowVerificationRecordRow)
      .filter(Boolean);
    return {
      siteId: normalizedSiteId,
      total: typeof totalRow?.count === "number" ? totalRow.count : 0,
      items
    };
  }

  function listOptimizeExecutions(siteId, filters = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        siteId: "",
        total: 0,
        items: []
      };
    }

    const normalizedStatus = normalizeExecutionStatus(filters.status, "");
    const statusFilter = normalizedStatus || null;
    const typeFilter = normalizeText(filters.type).toLowerCase() || null;
    const limit = normalizeExecutionListLimit(filters.limit);
    const where = ["site_id = ?"];
    const params = [normalizedSiteId];
    if (statusFilter) {
      where.push("status = ?");
      params.push(statusFilter);
    }
    if (typeFilter) {
      where.push("json_extract(payload_json, '$.execution.type') = ?");
      params.push(typeFilter);
    }

    const totalRow = sql.get(
      `
        SELECT COUNT(1) AS total
        FROM admin_optimize_executions
        WHERE ${where.join(" AND ")}
      `,
      ...params
    );
    const rows = sql.all(
      `${createOptimizeExecutionSelectSql(`WHERE ${where.join(" AND ")}`)}
       ORDER BY updated_at DESC, created_at DESC, execution_id DESC
       LIMIT ?`,
      ...params,
      limit
    );

    return {
      siteId: normalizedSiteId,
      total: Number(totalRow?.total || 0),
      items: rows.map(mapOptimizeExecutionRow)
    };
  }

  function getOptimizeExecutionOverview(siteId) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      return {
        pendingApprovalCount: 0,
        approvedCount: 0,
        rolledBackCount: 0,
        latestExecutionId: null,
        latestExecutionStatus: null,
        latestExecutionAt: null
      };
    }

    const grouped = sql.all(
      `
        SELECT status, COUNT(1) AS total
        FROM admin_optimize_executions
        WHERE site_id = ?
        GROUP BY status
      `,
      normalizedSiteId
    );
    const countByStatus = new Map(
      grouped.map((row) => [String(row.status || ""), Number(row.total || 0)])
    );
    const latest = mapOptimizeExecutionRow(
      sql.get(
        `${createOptimizeExecutionSelectSql("WHERE site_id = ?")}
         ORDER BY updated_at DESC, created_at DESC, execution_id DESC
         LIMIT 1`,
        normalizedSiteId
      )
    );

    return {
      pendingApprovalCount: countByStatus.get("pending_approval") || 0,
      approvedCount: countByStatus.get("approved") || 0,
      rolledBackCount: countByStatus.get("rolled_back") || 0,
      latestExecutionId: latest?.executionId || null,
      latestExecutionStatus: latest?.status || null,
      latestExecutionAt: latest?.updatedAt || latest?.createdAt || null
    };
  }

  function approveOptimizeExecution(siteId, executionId, patch = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedExecutionId = normalizeText(executionId);
    if (!normalizedSiteId || !normalizedExecutionId) {
      throw badRequest("siteId and executionId are required", {
        fields: ["siteId", "executionId"]
      });
    }

    return withTransaction(db, () => {
      const existing = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      if (!existing) {
        throw notFound(`Execution not found: ${normalizedExecutionId}`, {
          siteId: normalizedSiteId,
          executionId: normalizedExecutionId
        });
      }
      if (!existing.approval?.required) {
        throw conflict("Execution does not require approval");
      }
      if (existing.status === "approved") {
        throw conflict("Execution is already approved");
      }
      if (existing.status === "rolled_back") {
        throw conflict("Execution is already rolled back");
      }

      const timestamp = nowIso();
      const approverUserId =
        normalizeNullableText(patch?.approverUserId) || normalizeNullableText(actor?.userId) || "unknown";
      const note = normalizeNullableText(patch?.note);
      const dispatchReceipt = normalizeDispatchReceipt(patch?.dispatch);
      const feedbackSnapshot = normalizeFeedbackSnapshot(patch?.feedbackSnapshot);
      const next = normalizeOptimizeExecutionRecord(normalizedSiteId, {
        ...cloneJson(existing, {}),
        status: "approved",
        updatedAt: timestamp,
        approvedAt: timestamp,
        approvedBy: approverUserId,
        execution: mergeExecutionFeedbackState(
          mergeExecutionDispatchState(existing.execution, "approve", dispatchReceipt, timestamp),
          "approve",
          feedbackSnapshot
        ),
        approval: {
          ...(existing.approval || {}),
          required: existing.approval?.required !== false,
          status: "approved",
          requestedAt: existing.approval?.requestedAt || existing.createdAt || timestamp,
          approvedAt: timestamp,
          approverUserId,
          note: note ?? existing.approval?.note ?? null
        },
        timeline: [
          ...(Array.isArray(existing.timeline) ? existing.timeline : []),
          {
            at: timestamp,
            actorUserId: approverUserId,
            action: "approved",
            note: note || null
          }
        ]
      });

      updateOptimizeExecutionRow(next);
      const approved = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "optimize.execution.approve",
        targetType: "optimize_execution",
        targetId: normalizedExecutionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(approved),
        requestId: options.requestId
      });
      return approved;
    });
  }

  function rollbackOptimizeExecution(siteId, executionId, patch = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedExecutionId = normalizeText(executionId);
    if (!normalizedSiteId || !normalizedExecutionId) {
      throw badRequest("siteId and executionId are required", {
        fields: ["siteId", "executionId"]
      });
    }

    return withTransaction(db, () => {
      const existing = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      if (!existing) {
        throw notFound(`Execution not found: ${normalizedExecutionId}`, {
          siteId: normalizedSiteId,
          executionId: normalizedExecutionId
        });
      }
      if (existing.status !== "approved") {
        throw conflict("Execution must be approved before rollback");
      }

      const timestamp = nowIso();
      const actorUserId = normalizeNullableText(actor?.userId) || "unknown";
      const reason = normalizeNullableText(patch?.reason) || "manual rollback";
      const dispatchReceipt = normalizeDispatchReceipt(patch?.dispatch);
      const feedbackSnapshot = normalizeFeedbackSnapshot(patch?.feedbackSnapshot);
      const next = normalizeOptimizeExecutionRecord(normalizedSiteId, {
        ...cloneJson(existing, {}),
        status: "rolled_back",
        updatedAt: timestamp,
        rolledBackAt: timestamp,
        rolledBackBy: actorUserId,
        execution: mergeExecutionFeedbackState(
          mergeExecutionDispatchState(existing.execution, "rollback", dispatchReceipt, timestamp),
          "rollback",
          feedbackSnapshot
        ),
        rollback: {
          status: "completed",
          reason,
          requestedBy: actorUserId,
          requestedAt: timestamp,
          completedAt: timestamp
        },
        timeline: [
          ...(Array.isArray(existing.timeline) ? existing.timeline : []),
          {
            at: timestamp,
            actorUserId,
            action: "rolled_back",
            note: reason
          }
        ]
      });

      updateOptimizeExecutionRow(next);
      const rolledBack = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "optimize.execution.rollback",
        targetType: "optimize_execution",
        targetId: normalizedExecutionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(rolledBack),
        requestId: options.requestId
      });
      return rolledBack;
    });
  }

  function dispatchOptimizeExecution(siteId, executionId, patch = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedExecutionId = normalizeText(executionId);
    if (!normalizedSiteId || !normalizedExecutionId) {
      throw badRequest("siteId and executionId are required", {
        fields: ["siteId", "executionId"]
      });
    }

    return withTransaction(db, () => {
      const existing = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      if (!existing) {
        throw notFound(`Execution not found: ${normalizedExecutionId}`, {
          siteId: normalizedSiteId,
          executionId: normalizedExecutionId
        });
      }
      if (existing.status !== "approved") {
        throw conflict("Execution must be approved before dispatch");
      }

      const timestamp = nowIso();
      const actorUserId = normalizeNullableText(actor?.userId) || "unknown";
      const dispatchReceipt = normalizeDispatchReceipt(patch?.dispatch);
      if (!dispatchReceipt) {
        throw badRequest("dispatch receipt is required", {
          field: "dispatch"
        });
      }
      const feedbackSnapshot = normalizeFeedbackSnapshot(patch?.feedbackSnapshot);
      const next = normalizeOptimizeExecutionRecord(normalizedSiteId, {
        ...cloneJson(existing, {}),
        updatedAt: timestamp,
        execution: mergeExecutionFeedbackState(
          mergeExecutionDispatchState(existing.execution, "dispatch", dispatchReceipt, timestamp),
          "dispatch",
          feedbackSnapshot
        ),
        timeline: [
          ...(Array.isArray(existing.timeline) ? existing.timeline : []),
          {
            at: timestamp,
            actorUserId,
            action: "dispatched",
            note: dispatchReceipt.message || dispatchReceipt.code || null
          }
        ]
      });

      updateOptimizeExecutionRow(next);
      const dispatched = getOptimizeExecution(normalizedSiteId, normalizedExecutionId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "optimize.execution.dispatch",
        targetType: "optimize_execution",
        targetId: normalizedExecutionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(existing),
        afterJson: toJsonText(dispatched),
        requestId: options.requestId
      });
      return dispatched;
    });
  }

  function listSubsystemRegistry() {
    return sql
      .all(
        `
          SELECT *
          FROM admin_subsystem_registry
          WHERE site_id = ?
          ORDER BY sort_order ASC, subsystem_type ASC
        `,
        GLOBAL_REGISTRY_SITE_ID
      )
      .map(mapSubsystemRegistryRow)
      .filter(Boolean);
  }

  function getSubsystemRegistryItem(subsystemType) {
    const normalizedType = normalizeText(subsystemType);
    if (!normalizedType) {
      return null;
    }
    return mapSubsystemRegistryRow(
      sql.get(
        `
          SELECT *
          FROM admin_subsystem_registry
          WHERE site_id = ? AND subsystem_type = ?
          LIMIT 1
        `,
        GLOBAL_REGISTRY_SITE_ID,
        normalizedType
      )
    );
  }

  function assertSubsystemType(subsystemType) {
    const registryItem = getSubsystemRegistryItem(subsystemType);
    if (!registryItem) {
      throw badRequest(`Unknown subsystem type: ${normalizeText(subsystemType)}`, {
        field: "subsystemType"
      });
    }
    return registryItem;
  }

  function assertPhysicalStationParentType(parentSubsystemType) {
    const normalizedType = normalizeText(parentSubsystemType);
    const registryItem = getSubsystemRegistryItem(normalizedType);
    if (!registryItem) {
      throw badRequest(`Unknown subsystem type: ${normalizedType}`, {
        field: "parentSubsystemType",
        allowed: [...PHYSICAL_STATION_PARENT_TYPES]
      });
    }
    if (!isPhysicalStationParentType(registryItem.subsystemType)) {
      throw badRequest(
        `Subsystem type cannot be used as a physical station parent: ${registryItem.subsystemType}`,
        {
          field: "parentSubsystemType",
          allowed: [...PHYSICAL_STATION_PARENT_TYPES]
        }
      );
    }
    return registryItem;
  }

  function getSiteCapabilityRow(siteId, subsystemType) {
    return sql.get(
      `
        SELECT
          c.*,
          r.display_name,
          r.category,
          r.description,
          r.reserved
        FROM admin_site_subsystem_capabilities c
        JOIN admin_subsystem_registry r
          ON r.site_id = ? AND r.subsystem_type = c.subsystem_type
        WHERE c.site_id = ? AND c.subsystem_type = ?
        LIMIT 1
      `,
      GLOBAL_REGISTRY_SITE_ID,
      siteId,
      subsystemType
    );
  }

  function upsertSiteCapabilityRow(siteId, subsystemType, patch, actor) {
    const registryItem = assertSubsystemType(subsystemType);
    const existing = mapSiteSubsystemCapabilityRow(getSiteCapabilityRow(siteId, subsystemType));
    const timestamp = nowIso();
    const status = normalizeSubsystemStatus(
      patch?.status,
      existing?.status || registryItem.defaultStatus || "not_configured"
    );
    const mode = normalizeSubsystemMode(
      patch?.mode,
      registryItem.reserved ? "reserved" : existing?.mode || "monitoring"
    );
    const enabled = status === "enabled";
    const kpis = enabled ? cloneJson(patch?.kpis ?? existing?.kpis ?? [], []) : [];
    const alarmCount = enabled ? normalizeNonNegativeInteger(patch?.alarmCount ?? existing?.alarmCount) : 0;
    const published =
      patch?.published == null
        ? existing?.published !== false
        : normalizeBooleanFlag(patch.published, true);
    const next = {
      siteId,
      subsystemType,
      status,
      mode,
      kpis,
      alarmCount,
      freshnessStatus: enabled
        ? normalizeNullableText(patch?.freshnessStatus) || existing?.freshnessStatus || "unknown"
        : "not_configured",
      sourceStatus: enabled
        ? normalizeNullableText(patch?.sourceStatus) || existing?.sourceStatus || "unknown"
        : "not_configured",
      pointMappingProgress: normalizeProgress(
        patch?.pointMappingProgress,
        existing?.pointMappingProgress || 0
      ),
      advisorPluginStatus: enabled
        ? normalizeNullableText(patch?.advisorPluginStatus) || existing?.advisorPluginStatus || "not_configured"
        : "not_configured",
      pageTemplateStatus: normalizeNullableText(patch?.pageTemplateStatus) || existing?.pageTemplateStatus || "not_configured",
      notes: normalizeNullableText(patch?.notes) ?? existing?.notes ?? null,
      published
    };

    if (existing?.createdAt) {
      sql.run(
        `
          UPDATE admin_site_subsystem_capabilities
          SET
            status = ?,
            mode = ?,
            kpis_json = ?,
            alarm_count = ?,
            freshness_status = ?,
            source_status = ?,
            point_mapping_progress = ?,
            advisor_plugin_status = ?,
            page_template_status = ?,
            notes = ?,
            published = ?,
            updated_at = ?,
            updated_by = ?
          WHERE site_id = ? AND subsystem_type = ?
        `,
        next.status,
        next.mode,
        toJsonText(next.kpis, []),
        next.alarmCount,
        next.freshnessStatus,
        next.sourceStatus,
        next.pointMappingProgress,
        next.advisorPluginStatus,
        next.pageTemplateStatus,
        next.notes,
        next.published ? 1 : 0,
        timestamp,
        normalizeNullableText(actor?.userId),
        siteId,
        subsystemType
      );
    } else {
      sql.run(
        `
          INSERT INTO admin_site_subsystem_capabilities (
            site_id,
            subsystem_type,
            status,
            mode,
            kpis_json,
            alarm_count,
            freshness_status,
            source_status,
            point_mapping_progress,
            advisor_plugin_status,
            page_template_status,
            notes,
            published,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        subsystemType,
        next.status,
        next.mode,
        toJsonText(next.kpis, []),
        next.alarmCount,
        next.freshnessStatus,
        next.sourceStatus,
        next.pointMappingProgress,
        next.advisorPluginStatus,
        next.pageTemplateStatus,
        next.notes,
        next.published ? 1 : 0,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }
    return mapSiteSubsystemCapabilityRow(getSiteCapabilityRow(siteId, subsystemType));
  }

  function getControlBoundary(siteId, subsystemType) {
    return mapControlBoundaryRow(
      sql.get(
        `
          SELECT *
          FROM admin_control_boundaries
          WHERE site_id = ? AND subsystem_type = ?
          LIMIT 1
        `,
        siteId,
        subsystemType
      )
    );
  }

  function upsertControlBoundary(siteId, subsystemType, patch = {}, actor = {}) {
    const existing = getControlBoundary(siteId, subsystemType);
    const timestamp = nowIso();
    const next = {
      mode: normalizeControlBoundaryMode(patch.mode, existing?.mode || "read_only"),
      approvalRequired: normalizeBooleanFlag(patch.approvalRequired, existing?.approvalRequired ?? true),
      plcProtectionRequired: normalizeBooleanFlag(
        patch.plcProtectionRequired,
        existing?.plcProtectionRequired ?? true
      ),
      rollbackRequired: normalizeBooleanFlag(patch.rollbackRequired, existing?.rollbackRequired ?? true),
      writeEnabled: normalizeBooleanFlag(patch.writeEnabled, existing?.writeEnabled ?? false),
      notes: normalizeNullableText(patch.notes) ?? existing?.notes ?? null
    };
    if (existing?.createdAt) {
      sql.run(
        `
          UPDATE admin_control_boundaries
          SET
            mode = ?,
            approval_required = ?,
            plc_protection_required = ?,
            rollback_required = ?,
            write_enabled = ?,
            notes = ?,
            updated_at = ?,
            updated_by = ?
          WHERE site_id = ? AND subsystem_type = ?
        `,
        next.mode,
        next.approvalRequired ? 1 : 0,
        next.plcProtectionRequired ? 1 : 0,
        next.rollbackRequired ? 1 : 0,
        next.writeEnabled ? 1 : 0,
        next.notes,
        timestamp,
        normalizeNullableText(actor?.userId),
        siteId,
        subsystemType
      );
    } else {
      sql.run(
        `
          INSERT INTO admin_control_boundaries (
            site_id,
            subsystem_type,
            mode,
            approval_required,
            plc_protection_required,
            rollback_required,
            write_enabled,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        subsystemType,
        next.mode,
        next.approvalRequired ? 1 : 0,
        next.plcProtectionRequired ? 1 : 0,
        next.rollbackRequired ? 1 : 0,
        next.writeEnabled ? 1 : 0,
        next.notes,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }
    return getControlBoundary(siteId, subsystemType);
  }

  function listAdvisorPluginBindings(siteId, subsystemType = "") {
    const where = ["site_id = ?"];
    const params = [siteId];
    const normalizedType = normalizeText(subsystemType);
    if (normalizedType) {
      where.push("subsystem_type = ?");
      params.push(normalizedType);
    }
    return sql
      .all(
        `
          SELECT *
          FROM admin_advisor_plugin_bindings
          WHERE ${where.join(" AND ")}
          ORDER BY subsystem_type ASC, plugin_key ASC
        `,
        ...params
      )
      .map(mapAdvisorPluginBindingRow)
      .filter(Boolean);
  }

  function upsertAdvisorPluginBinding(siteId, subsystemType, patch = {}, actor = {}) {
    const pluginKey = normalizeNullableText(patch.pluginKey) || `${subsystemType}_advisor`;
    const existing = mapAdvisorPluginBindingRow(
      sql.get(
        `
          SELECT *
          FROM admin_advisor_plugin_bindings
          WHERE site_id = ? AND subsystem_type = ? AND plugin_key = ?
          LIMIT 1
        `,
        siteId,
        subsystemType,
        pluginKey
      )
    );
    const timestamp = nowIso();
    const next = {
      pluginKey,
      status: normalizeNullableText(patch.status) || existing?.status || "not_configured",
      mode: normalizeSubsystemMode(patch.mode, existing?.mode || "monitoring"),
      config: cloneJson(patch.config ?? existing?.config ?? {}, {})
    };
    if (existing?.createdAt) {
      sql.run(
        `
          UPDATE admin_advisor_plugin_bindings
          SET status = ?, mode = ?, config_json = ?, updated_at = ?, updated_by = ?
          WHERE site_id = ? AND subsystem_type = ? AND plugin_key = ?
        `,
        next.status,
        next.mode,
        toJsonText(next.config, {}),
        timestamp,
        normalizeNullableText(actor?.userId),
        siteId,
        subsystemType,
        pluginKey
      );
    } else {
      sql.run(
        `
          INSERT INTO admin_advisor_plugin_bindings (
            site_id,
            subsystem_type,
            plugin_key,
            status,
            mode,
            config_json,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        subsystemType,
        pluginKey,
        next.status,
        next.mode,
        toJsonText(next.config, {}),
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }
    return listAdvisorPluginBindings(siteId, subsystemType).find((item) => item.pluginKey === pluginKey) || null;
  }

  function ensureSiteSubsystemDefaults(siteId, actor = { userId: "system", username: "system" }) {
    assertSiteExists(siteId);
    const registry = listSubsystemRegistry();
    for (const item of registry) {
      if (!getSiteCapabilityRow(siteId, item.subsystemType)) {
        upsertSiteCapabilityRow(
          siteId,
          item.subsystemType,
          {
            status: item.defaultStatus,
            mode: item.reserved ? "reserved" : "monitoring",
            published: true,
            pageTemplateStatus: item.reserved ? "reserved" : "available",
            notes: item.reserved ? "预留子系统，当前项目默认不适用。" : null
          },
          actor
        );
      }
      if (!getControlBoundary(siteId, item.subsystemType)) {
        upsertControlBoundary(
          siteId,
          item.subsystemType,
          {
            mode: "read_only",
            approvalRequired: true,
            plcProtectionRequired: true,
            rollbackRequired: true,
            notes: "第一版配置中心只读/影子运行，不启用 PLC 写控制。"
          },
          actor
        );
      }
    }
  }

  function listPointRoleMappings(siteId, filters = {}) {
    assertSiteExists(siteId);
    const where = ["site_id = ?"];
    const params = [siteId];
    const subsystemType = normalizeText(filters.subsystemType);
    if (subsystemType) {
      where.push("subsystem_type = ?");
      params.push(subsystemType);
    }
    return {
      siteId,
      items: sql
        .all(
          `
            SELECT *
            FROM admin_point_role_mappings
            WHERE ${where.join(" AND ")}
            ORDER BY subsystem_type ASC, point_role ASC, point_name ASC, mapping_id ASC
          `,
          ...params
        )
        .map(mapPointRoleMappingRow)
        .filter(Boolean)
    };
  }

  function computePointMappingProgress(siteId, registryItem) {
    const requiredRoles = Array.from(
      new Set(
        (Array.isArray(registryItem.pointRoles) ? registryItem.pointRoles : [])
          .filter((item) => item?.required !== false)
          .map((item) => item.role)
          .filter(Boolean)
      )
    );
    if (!requiredRoles.length) {
      return 0;
    }
    const mappings = listPointRoleMappings(siteId, {
      subsystemType: registryItem.subsystemType
    }).items;
    const mappedRoles = new Set(mappings.map((item) => item.pointRole));
    const mappedRequired = requiredRoles.filter((role) => mappedRoles.has(role)).length;
    return normalizeProgress((mappedRequired / requiredRoles.length) * 100);
  }

  function listStationInstances(siteId, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const where = ["s.site_id = ?"];
    const params = [GLOBAL_REGISTRY_SITE_ID, normalizedSiteId];
    const parentSubsystemType = normalizeText(options.parentSubsystemType);
    if (parentSubsystemType) {
      assertPhysicalStationParentType(parentSubsystemType);
      where.push("s.parent_subsystem_type = ?");
      params.push(parentSubsystemType);
    }
    if (options.publishedOnly === true) {
      where.push("s.published = 1");
    }
    const items = sql
      .all(
        `
          SELECT
            s.*,
            COALESCE(p.status, d.status) AS binding_status,
            COALESCE(h.current_published_version, h.draft_version) AS binding_version,
            h.draft_version AS draft_binding_version,
            h.current_published_version AS published_binding_version
          FROM admin_station_instances s
          JOIN admin_subsystem_registry r
            ON r.site_id = ? AND r.subsystem_type = s.parent_subsystem_type
          LEFT JOIN admin_station_runtime_binding_heads h
            ON h.site_id = s.site_id AND h.station_id = s.station_id
          LEFT JOIN admin_station_runtime_binding_versions d
            ON d.site_id = h.site_id
           AND d.station_id = h.station_id
           AND d.binding_version = h.draft_version
          LEFT JOIN admin_station_runtime_binding_versions p
            ON p.site_id = h.site_id
           AND p.station_id = h.station_id
           AND p.binding_version = h.current_published_version
          WHERE ${where.join(" AND ")}
          ORDER BY r.sort_order ASC, s.sort_order ASC, s.station_name ASC, s.station_id ASC
        `,
        ...params
      )
      .map(mapStationInstanceRow)
      .filter((item) => item && isPhysicalStationParentType(item.parentSubsystemType));
    return {
      siteId: normalizedSiteId,
      generatedAt: nowIso(),
      items,
      total: items.length
    };
  }

  function getStationRuntimeBindingHead(siteId, stationId) {
    return sql.get(
      `
        SELECT *
        FROM admin_station_runtime_binding_heads
        WHERE site_id = ? AND station_id = ?
        LIMIT 1
      `,
      siteId,
      stationId
    ) || null;
  }

  function getStationRuntimeBindingVersion(siteId, stationId, bindingVersion) {
    if (!Number.isSafeInteger(bindingVersion) || bindingVersion <= 0) {
      return null;
    }
    return mapStationRuntimeBindingRow(
      sql.get(
        `
          SELECT
            b.*,
            s.station_name,
            s.parent_subsystem_type,
            s.status AS station_status,
            s.published AS station_published
          FROM admin_station_runtime_binding_versions b
          JOIN admin_station_instances s
            ON s.site_id = b.site_id AND s.station_id = b.station_id
          WHERE b.site_id = ? AND b.station_id = ? AND b.binding_version = ?
          LIMIT 1
        `,
        siteId,
        stationId,
        bindingVersion
      )
    );
  }

  function getStationRuntimeBinding(siteId, stationId, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedStationId = assertStationId(stationId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    assertSiteExists(normalizedSiteId);
    const head = getStationRuntimeBindingHead(normalizedSiteId, normalizedStationId);
    if (!head) {
      return null;
    }
    const explicitVersion = Number(options.bindingVersion);
    const view = normalizeText(options.view) || "effective";
    const bindingVersion = Number.isSafeInteger(explicitVersion) && explicitVersion > 0
      ? explicitVersion
      : view === "published"
        ? head.current_published_version
        : view === "draft"
          ? head.draft_version
          : head.draft_version || head.current_published_version;
    return getStationRuntimeBindingVersion(normalizedSiteId, normalizedStationId, bindingVersion);
  }

  function getStationRuntimeBindingState(siteId, stationId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedStationId = assertStationId(stationId);
    assertSiteExists(normalizedSiteId);
    const head = getStationRuntimeBindingHead(normalizedSiteId, normalizedStationId);
    const draftBinding = head?.draft_version
      ? getStationRuntimeBindingVersion(normalizedSiteId, normalizedStationId, head.draft_version)
      : null;
    const publishedBinding = head?.current_published_version
      ? getStationRuntimeBindingVersion(normalizedSiteId, normalizedStationId, head.current_published_version)
      : null;
    return {
      siteId: normalizedSiteId,
      stationId: normalizedStationId,
      draftVersion: draftBinding?.bindingVersion || null,
      publishedVersion: publishedBinding?.bindingVersion || null,
      draftBinding,
      publishedBinding,
      effectiveBinding: publishedBinding
    };
  }

  function listStationRuntimeBindings(siteId) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const stationIds = sql.all(
      `
        SELECT h.station_id
        FROM admin_station_runtime_binding_heads h
        JOIN admin_station_instances s
          ON s.site_id = h.site_id AND s.station_id = h.station_id
        WHERE h.site_id = ?
        ORDER BY s.sort_order ASC, s.station_name ASC, s.station_id ASC
      `,
      normalizedSiteId
    );
    const items = stationIds.map((row) => getStationRuntimeBindingState(normalizedSiteId, row.station_id));
    return {
      siteId: normalizedSiteId,
      generatedAt: nowIso(),
      items,
      total: items.length
    };
  }

  function assertPhysicalStationForBinding(siteId, stationId) {
    const station = mapStationInstanceRow(
      sql.get(
        "SELECT * FROM admin_station_instances WHERE site_id = ? AND station_id = ? LIMIT 1",
        siteId,
        stationId
      )
    );
    if (!station || !isPhysicalStationParentType(station.parentSubsystemType)) {
      throw notFound(`Physical station not found: ${stationId}`, { siteId, stationId });
    }
    return station;
  }

  function normalizeStationRuntimeBindingDraftPayload(payload = {}) {
    if (Object.prototype.hasOwnProperty.call(payload || {}, "status")) {
      throw badRequest("PUT runtime-binding only saves a draft; status is server-managed", { field: "status" });
    }
    const source = payload?.source && typeof payload.source === "object" && !Array.isArray(payload.source)
      ? payload.source
      : {};
    const selectors = payload?.selectors && typeof payload.selectors === "object" && !Array.isArray(payload.selectors)
      ? payload.selectors
      : {};
    const deviceIds = normalizeStationRuntimeSelectorList(selectors.deviceIds, "selectors.deviceIds");
    const deviceCodes = normalizeStationRuntimeSelectorList(selectors.deviceCodes, "selectors.deviceCodes");
    const pointCodes = normalizeStationRuntimeSelectorList(selectors.pointCodes, "selectors.pointCodes", 5000);
    if (deviceIds.length === 0) {
      throw badRequest("station runtime binding requires selectors.deviceIds", {
        field: "selectors.deviceIds",
        reason: "Device detail authorization must be decidable before contacting upstream"
      });
    }
    const wildcardSelectors = [...deviceIds, ...deviceCodes, ...pointCodes]
      .filter((item) => /[*?]|^(?:all|any)$/i.test(item));
    if (wildcardSelectors.length > 0) {
      throw badRequest("Station runtime binding does not allow wildcard or match-all selectors", {
        field: "selectors",
        values: wildcardSelectors
      });
    }
    const databaseKey = normalizeStationRuntimeSourceKey(source.databaseKey, "source.databaseKey");
    const projectKey = normalizeStationRuntimeSourceKey(source.projectKey, "source.projectKey");
    const template = normalizeNullableText(source.template);
    if (template && template.length > 32) {
      throw badRequest("source.template exceeds 32 characters", { field: "source.template" });
    }
    const normalizedSource = { databaseKey, projectKey, template };
    const normalizedSelectors = { deviceIds, deviceCodes, pointCodes };
    return {
      source: normalizedSource,
      selectors: normalizedSelectors,
      payloadHash: buildStationRuntimeBindingPayloadHash(normalizedSource, normalizedSelectors),
      notes: normalizeNullableText(payload?.notes)
    };
  }

  function upsertStationRuntimeBinding(siteId, stationId, payload = {}, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedStationId = assertStationId(stationId);
    assertSiteExists(normalizedSiteId);
    assertPhysicalStationForBinding(normalizedSiteId, normalizedStationId);
    const expectedVersion = normalizeExpectedBindingVersion(payload?.expectedVersion);
    const draft = normalizeStationRuntimeBindingDraftPayload(payload);

    return withTransaction(db, () => {
      const before = getStationRuntimeBindingState(normalizedSiteId, normalizedStationId);
      const latestRow = sql.get(
        `SELECT MAX(binding_version) AS latest_version
         FROM admin_station_runtime_binding_versions
         WHERE site_id = ? AND station_id = ?`,
        normalizedSiteId,
        normalizedStationId
      );
      const currentVersion = Number.isSafeInteger(latestRow?.latest_version) ? latestRow.latest_version : 0;
      if (expectedVersion !== currentVersion) {
        throw conflict("Station runtime binding version conflict", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          expectedVersion,
          currentVersion
        });
      }
      const bindingVersion = currentVersion + 1;
      const timestamp = nowIso();
      if (before.draftVersion) {
        sql.run(
          `UPDATE admin_station_runtime_binding_versions
           SET status = 'superseded', updated_at = ?
           WHERE site_id = ? AND station_id = ? AND binding_version = ?`,
          timestamp,
          normalizedSiteId,
          normalizedStationId,
          before.draftVersion
        );
      }
      sql.run(
        `
          INSERT INTO admin_station_runtime_binding_versions (
            site_id, station_id, binding_version, status, database_key,
            project_key, template, device_ids_json, device_codes_json,
            point_codes_json, payload_hash, notes, created_at, updated_at,
            created_by, updated_by
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizedSiteId,
        normalizedStationId,
        bindingVersion,
        draft.source.databaseKey,
        draft.source.projectKey,
        draft.source.template,
        toJsonText(draft.selectors.deviceIds, []),
        toJsonText(draft.selectors.deviceCodes, []),
        toJsonText(draft.selectors.pointCodes, []),
        draft.payloadHash,
        draft.notes,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
      sql.run(
        `
          INSERT INTO admin_station_runtime_binding_heads (
            site_id, station_id, draft_version, current_published_version, updated_at, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(site_id, station_id) DO UPDATE SET
            draft_version = excluded.draft_version,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `,
        normalizedSiteId,
        normalizedStationId,
        bindingVersion,
        before.publishedVersion,
        timestamp,
        normalizeNullableText(actor?.userId)
      );
      const after = getStationRuntimeBindingState(normalizedSiteId, normalizedStationId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.station-runtime-binding.draft.save",
        targetType: "station_runtime_binding",
        targetId: `${normalizedSiteId}:${normalizedStationId}:v${bindingVersion}`,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after.draftBinding;
    });
  }

  function recordStationRuntimeBindingValidation(
    siteId,
    stationId,
    expectedVersionValue,
    validation,
    actor = {},
    options = {}
  ) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedStationId = assertStationId(stationId);
    const expectedVersion = normalizeExpectedBindingVersion(expectedVersionValue);
    const checkedAt = normalizeNullableText(validation?.checkedAt) || nowIso();
    const validationPayload = validation && typeof validation === "object" && !Array.isArray(validation)
      ? cloneJson(validation, {})
      : {};
    return withTransaction(db, () => {
      const head = getStationRuntimeBindingHead(normalizedSiteId, normalizedStationId);
      const before = getStationRuntimeBinding(normalizedSiteId, normalizedStationId, { view: "draft" });
      const currentVersion = head?.draft_version || head?.current_published_version || 0;
      if (!before || head?.draft_version !== expectedVersion) {
        throw conflict("Station runtime binding draft version conflict", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          expectedVersion,
          currentVersion
        });
      }
      const effectiveSourceHash = buildStationRuntimeEffectiveSourceHash(
        validationPayload.effectiveSource
      );
      const validationOk = validationPayload.ok === true
        && validationPayload.payloadHash === before.payloadHash
        && Boolean(effectiveSourceHash)
        && validationPayload.effectiveSourceHash === effectiveSourceHash;
      validationPayload.ok = validationOk;
      validationPayload.payloadHash = before.payloadHash;
      validationPayload.checkedAt = checkedAt;
      if (!validationOk && validation?.ok === true && !effectiveSourceHash) {
        validationPayload.errors = Array.from(new Set([
          ...(Array.isArray(validationPayload.errors) ? validationPayload.errors : []),
          "EFFECTIVE_SOURCE_EVIDENCE_MISSING"
        ]));
      } else if (
        !validationOk
        && validation?.ok === true
        && validationPayload.effectiveSourceHash !== effectiveSourceHash
      ) {
        validationPayload.errors = Array.from(new Set([
          ...(Array.isArray(validationPayload.errors) ? validationPayload.errors : []),
          "EFFECTIVE_SOURCE_HASH_MISMATCH"
        ]));
      }
      sql.run(
        `
          UPDATE admin_station_runtime_binding_versions
          SET status = ?, validated_hash = ?, validation_json = ?, checked_at = ?, updated_at = ?
          WHERE site_id = ? AND station_id = ? AND binding_version = ?
        `,
        validationOk ? "validated" : "draft",
        validationOk ? before.payloadHash : null,
        toJsonText(validationPayload, {}),
        checkedAt,
        nowIso(),
        normalizedSiteId,
        normalizedStationId,
        expectedVersion
      );
      const after = getStationRuntimeBindingVersion(normalizedSiteId, normalizedStationId, expectedVersion);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.station-runtime-binding.validate",
        targetType: "station_runtime_binding",
        targetId: `${normalizedSiteId}:${normalizedStationId}:v${expectedVersion}`,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function publishStationRuntimeBinding(
    siteId,
    stationId,
    expectedVersionValue,
    actor = {},
    options = {}
  ) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedStationId = assertStationId(stationId);
    const expectedVersion = normalizeExpectedBindingVersion(expectedVersionValue);
    return withTransaction(db, () => {
      const head = getStationRuntimeBindingHead(normalizedSiteId, normalizedStationId);
      const before = getStationRuntimeBinding(normalizedSiteId, normalizedStationId, { view: "draft" });
      const currentVersion = head?.draft_version || head?.current_published_version || 0;
      if (!before || head?.draft_version !== expectedVersion) {
        throw conflict("Station runtime binding draft version conflict", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          expectedVersion,
          currentVersion
        });
      }
      if (
        before.status !== "validated"
        || before.validation?.ok !== true
        || !before.payloadHash
        || before.validatedHash !== before.payloadHash
        || !before.validation?.effectiveSourceHash
        || before.validation.effectiveSourceHash !== buildStationRuntimeEffectiveSourceHash(
          before.validation.effectiveSource
        )
      ) {
        throw conflict("Station runtime binding must pass validation without payload drift before publish", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          status: before.status,
          payloadHash: before.payloadHash,
          validatedHash: before.validatedHash
        });
      }
      if (before.stationStatus !== "enabled" || before.stationPublished !== true) {
        throw conflict("Physical station must be enabled and published before binding publish", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          stationStatus: before.stationStatus,
          stationPublished: before.stationPublished
        });
      }
      const actorUserId = normalizeText(actor?.userId);
      if (
        !actorUserId
        || !before.createdBy
        || actorUserId === before.createdBy
        || actorUserId === before.updatedBy
      ) {
        throw conflict("Binding publisher must be different from every editor of the current draft", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          creatorUserId: before.createdBy || null,
          lastEditorUserId: before.updatedBy || null,
          publisherUserId: actorUserId || null
        });
      }
      const requestedDeviceIds = new Set(before.selectors.deviceIds);
      const requestedDeviceCodes = new Set(before.selectors.deviceCodes.map((item) => item.toUpperCase()));
      const conflicts = listStationRuntimeBindings(normalizedSiteId).items
        .filter((item) => item.stationId !== normalizedStationId && item.publishedBinding)
        .map((item) => ({
          stationId: item.stationId,
          overlappingDeviceIds: item.publishedBinding.selectors.deviceIds.filter((value) => requestedDeviceIds.has(value)),
          overlappingDeviceCodes: item.publishedBinding.selectors.deviceCodes.filter((value) => (
            requestedDeviceCodes.has(String(value).toUpperCase())
          ))
        }))
        .filter((item) => item.overlappingDeviceIds.length > 0 || item.overlappingDeviceCodes.length > 0);
      if (conflicts.length > 0) {
        throw conflict("Station runtime device selectors overlap another published station", {
          siteId: normalizedSiteId,
          stationId: normalizedStationId,
          conflicts
        });
      }
      const timestamp = nowIso();
      if (head?.current_published_version) {
        sql.run(
          `UPDATE admin_station_runtime_binding_versions
           SET status = 'superseded', updated_at = ?
           WHERE site_id = ? AND station_id = ? AND binding_version = ?`,
          timestamp,
          normalizedSiteId,
          normalizedStationId,
          head.current_published_version
        );
      }
      sql.run(
        `
          UPDATE admin_station_runtime_binding_versions
          SET status = 'published', published_at = ?, published_by = ?, updated_at = ?
          WHERE site_id = ? AND station_id = ? AND binding_version = ?
        `,
        timestamp,
        actorUserId,
        timestamp,
        normalizedSiteId,
        normalizedStationId,
        expectedVersion
      );
      sql.run(
        `
          UPDATE admin_station_runtime_binding_heads
          SET draft_version = NULL,
              current_published_version = ?,
              updated_at = ?,
              updated_by = ?
          WHERE site_id = ? AND station_id = ?
        `,
        expectedVersion,
        timestamp,
        actorUserId,
        normalizedSiteId,
        normalizedStationId
      );
      const after = getStationRuntimeBindingVersion(normalizedSiteId, normalizedStationId, expectedVersion);
      recordAudit({
        actorUserId,
        actorUsername: actor?.username,
        action: "site.station-runtime-binding.publish",
        targetType: "station_runtime_binding",
        targetId: `${normalizedSiteId}:${normalizedStationId}:v${expectedVersion}`,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function upsertStationInstances(siteId, payload, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) {
      throw badRequest("station instances payload requires items", { field: "items" });
    }
    const before = listStationInstances(normalizedSiteId);
    return withTransaction(db, () => {
      for (const item of items) {
        const forbiddenEvidenceFields = ["sourceStatus", "freshnessStatus", "alarmCount"]
          .filter((field) => Object.prototype.hasOwnProperty.call(item || {}, field));
        if (forbiddenEvidenceFields.length > 0) {
          throw badRequest("Station identity payload cannot contain runtime evidence fields", {
            fields: forbiddenEvidenceFields,
            reason: "source/freshness/alarm evidence is derived from actual runtime responses"
          });
        }
        const stationId = assertStationId(item?.stationId);
        const existing = mapStationInstanceRow(
          sql.get(
            `
              SELECT *
              FROM admin_station_instances
              WHERE site_id = ? AND station_id = ?
              LIMIT 1
            `,
            normalizedSiteId,
            stationId
          )
        );
        const stationName = normalizeText(item?.stationName) || existing?.stationName || "";
        if (!stationName) {
          throw badRequest("stationName is required", { field: "stationName" });
        }
        const parentSubsystemType = normalizeText(item?.parentSubsystemType) || existing?.parentSubsystemType || "";
        if (!parentSubsystemType) {
          throw badRequest("parentSubsystemType is required", { field: "parentSubsystemType" });
        }
        assertPhysicalStationParentType(parentSubsystemType);
        if (existing && existing.parentSubsystemType !== parentSubsystemType) {
          const bindingCount = sql.get(
            `SELECT COUNT(*) AS count
             FROM admin_station_runtime_binding_versions
             WHERE site_id = ? AND station_id = ?`,
            normalizedSiteId,
            stationId
          )?.count || 0;
          if (bindingCount > 0) {
            throw conflict("Cannot change station type after runtime binding history exists", {
              siteId: normalizedSiteId,
              stationId,
              currentParentSubsystemType: existing.parentSubsystemType,
              requestedParentSubsystemType: parentSubsystemType
            });
          }
        }
        const duplicateName = sql.get(
          `
            SELECT station_id
            FROM admin_station_instances
            WHERE site_id = ?
              AND parent_subsystem_type = ?
              AND station_name = ?
              AND station_id <> ?
            LIMIT 1
          `,
          normalizedSiteId,
          parentSubsystemType,
          stationName,
          stationId
        );
        if (duplicateName?.station_id) {
          throw conflict("Station name already exists for this energy-object type", {
            field: "stationName",
            siteId: normalizedSiteId,
            parentSubsystemType,
            stationName,
            conflictingStationId: duplicateName.station_id
          });
        }
        const status = resolveStationStatus(item?.status, existing?.status || "not_configured");
        const enabled = status === "enabled";
        const timestamp = nowIso();
        const next = {
          stationId,
          stationName,
          parentSubsystemType,
          status,
          // Identity writes never manufacture live evidence. These legacy
          // columns remain schema-compatible but are no longer client-owned.
          sourceStatus: enabled ? "waiting" : "not_configured",
          freshnessStatus: enabled ? "unknown" : "not_configured",
          alarmCount: 0,
          sortOrder: resolveStationNonNegativeInteger(
            item?.sortOrder,
            existing?.sortOrder ?? 999,
            "sortOrder"
          ),
          published: resolveStationBoolean(
            item?.published,
            existing?.published === true,
            "published"
          ),
          notes: normalizeNullableText(item?.notes) ?? existing?.notes ?? null
        };

        if (existing) {
          sql.run(
            `
              UPDATE admin_station_instances
              SET station_name = ?,
                  parent_subsystem_type = ?,
                  status = ?,
                  source_status = ?,
                  freshness_status = ?,
                  alarm_count = ?,
                  sort_order = ?,
                  published = ?,
                  notes = ?,
                  updated_at = ?,
                  updated_by = ?
              WHERE site_id = ? AND station_id = ?
            `,
            next.stationName,
            next.parentSubsystemType,
            next.status,
            next.sourceStatus,
            next.freshnessStatus,
            next.alarmCount,
            next.sortOrder,
            next.published ? 1 : 0,
            next.notes,
            timestamp,
            normalizeNullableText(actor?.userId),
            normalizedSiteId,
            next.stationId
          );
        } else {
          sql.run(
            `
              INSERT INTO admin_station_instances (
                site_id,
                station_id,
                station_name,
                parent_subsystem_type,
                status,
                source_status,
                freshness_status,
                alarm_count,
                sort_order,
                published,
                notes,
                created_at,
                updated_at,
                created_by,
                updated_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            normalizedSiteId,
            next.stationId,
            next.stationName,
            next.parentSubsystemType,
            next.status,
            next.sourceStatus,
            next.freshnessStatus,
            next.alarmCount,
            next.sortOrder,
            next.published ? 1 : 0,
            next.notes,
            timestamp,
            timestamp,
            normalizeNullableText(actor?.userId),
            normalizeNullableText(actor?.userId)
          );
        }
      }
      const after = listStationInstances(normalizedSiteId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.station-instances.update",
        targetType: "station_instance",
        targetId: normalizedSiteId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function listSiteSubsystems(siteId, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    if (!normalizedSiteId) {
      throw badRequest("siteId is required", { field: "siteId" });
    }
    ensureSiteSubsystemDefaults(normalizedSiteId);
    const where = ["c.site_id = ?"];
    const params = [GLOBAL_REGISTRY_SITE_ID, normalizedSiteId];
    if (options.publishedOnly === true) {
      where.push("c.published = 1");
    }
    const rows = sql
      .all(
        `
          SELECT
            c.*,
            r.display_name,
            r.category,
            r.description,
            r.reserved,
            r.sort_order
          FROM admin_site_subsystem_capabilities c
          JOIN admin_subsystem_registry r
            ON r.site_id = ? AND r.subsystem_type = c.subsystem_type
          WHERE ${where.join(" AND ")}
          ORDER BY r.sort_order ASC, c.subsystem_type ASC
        `,
        ...params
      )
      .map(mapSiteSubsystemCapabilityRow)
      .filter(Boolean);
    const registryByType = new Map(listSubsystemRegistry().map((item) => [item.subsystemType, item]));
    const advisorBindings = listAdvisorPluginBindings(normalizedSiteId);
    const items = rows.map((item) => {
      const registryItem = registryByType.get(item.subsystemType) || {
        pointRoles: []
      };
      const computedProgress = computePointMappingProgress(normalizedSiteId, registryItem);
      return {
        ...item,
        pointMappingProgress: computedProgress,
        requiredPointRoles: registryItem.pointRoles || [],
        advisorBindings: item.enabled
          ? advisorBindings.filter((binding) => binding.subsystemType === item.subsystemType)
          : [],
        controlBoundary: getControlBoundary(normalizedSiteId, item.subsystemType)
      };
    });
    const stationRegistry = listStationInstances(normalizedSiteId, {
      publishedOnly: options.publishedOnly === true
    });
    return {
      siteId: normalizedSiteId,
      generatedAt: nowIso(),
      items,
      total: items.length,
      stationInstances: stationRegistry.items,
      stationTotal: stationRegistry.total
    };
  }

  function getSiteCapabilities(siteId, options = {}) {
    const subsystems = listSiteSubsystems(siteId, {
      publishedOnly: options.publishedOnly === true
    });
    return {
      siteId: subsystems.siteId,
      generatedAt: subsystems.generatedAt,
      items: subsystems.items.map((item) => ({
        ...item,
        kpis: item.enabled ? item.kpis : [],
        alarmCount: item.enabled ? item.alarmCount : null,
        advisorBindings: item.enabled ? item.advisorBindings : []
      })),
      total: subsystems.total,
      stationInstances: subsystems.stationInstances,
      stationTotal: subsystems.stationTotal
    };
  }

  function upsertSiteSubsystems(siteId, payload, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) {
      throw badRequest("subsystems payload requires items", { field: "items" });
    }
    const before = listSiteSubsystems(normalizedSiteId);
    return withTransaction(db, () => {
      for (const item of items) {
        const subsystemType = normalizeText(item?.subsystemType);
        if (!subsystemType) {
          throw badRequest("subsystemType is required", { field: "subsystemType" });
        }
        upsertSiteCapabilityRow(normalizedSiteId, subsystemType, item, actor);
        if (item?.controlBoundary && typeof item.controlBoundary === "object") {
          upsertControlBoundary(normalizedSiteId, subsystemType, item.controlBoundary, actor);
        }
        if (item?.advisorBinding && typeof item.advisorBinding === "object") {
          upsertAdvisorPluginBinding(normalizedSiteId, subsystemType, item.advisorBinding, actor);
        }
        if (Array.isArray(item?.advisorBindings)) {
          item.advisorBindings.forEach((binding) => {
            if (binding && typeof binding === "object") {
              upsertAdvisorPluginBinding(normalizedSiteId, subsystemType, binding, actor);
            }
          });
        }
      }
      const after = listSiteSubsystems(normalizedSiteId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.subsystems.update",
        targetType: "site_subsystem_capability",
        targetId: normalizedSiteId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function normalizePointMappingInput(siteId, source, actor = {}) {
    const subsystemType = normalizeText(source?.subsystemType);
    if (!subsystemType) {
      throw badRequest("subsystemType is required", { field: "subsystemType" });
    }
    assertSubsystemType(subsystemType);
    return {
      siteId,
      subsystemType,
      pointRole: normalizePointRoleKind(source?.pointRole || source?.role),
      pointName: normalizeText(source?.pointName || source?.name || source?.label),
      pointCode: normalizeNullableText(source?.pointCode || source?.code || source?.tag),
      unit: normalizeNullableText(source?.unit) || "",
      dataType: normalizeNullableText(source?.dataType || source?.type) || "",
      direction: "read",
      required: normalizeBooleanFlag(source?.required, false),
      writable: false,
      source: normalizeNullableText(source?.source) || "manual",
      notes: normalizeNullableText(source?.notes || source?.note),
      actorUserId: normalizeNullableText(actor?.userId)
    };
  }

  function upsertPointRoleMappings(siteId, payload, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const subsystemType = normalizeText(payload?.subsystemType);
    if (subsystemType) {
      assertSubsystemType(subsystemType);
    }
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    const before = listPointRoleMappings(normalizedSiteId, {
      subsystemType
    });
    return withTransaction(db, () => {
      if (subsystemType) {
        sql.run(
          `DELETE FROM admin_point_role_mappings WHERE site_id = ? AND subsystem_type = ?`,
          normalizedSiteId,
          subsystemType
        );
      } else {
        sql.run(`DELETE FROM admin_point_role_mappings WHERE site_id = ?`, normalizedSiteId);
      }
      const timestamp = nowIso();
      for (const rawItem of items) {
        const normalized = normalizePointMappingInput(
          normalizedSiteId,
          {
            ...rawItem,
            subsystemType: subsystemType || rawItem?.subsystemType
          },
          actor
        );
        if (!normalized.pointName && !normalized.pointCode) {
          continue;
        }
        sql.run(
          `
            INSERT INTO admin_point_role_mappings (
              site_id,
              subsystem_type,
              point_role,
              point_name,
              point_code,
              unit,
              data_type,
              direction,
              required,
              writable,
              source,
              notes,
              created_at,
              updated_at,
              created_by,
              updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
          `,
          normalized.siteId,
          normalized.subsystemType,
          normalized.pointRole,
          normalized.pointName || normalized.pointCode || "",
          normalized.pointCode,
          normalized.unit,
          normalized.dataType,
          normalized.direction,
          normalized.required ? 1 : 0,
          normalized.source,
          normalized.notes,
          timestamp,
          timestamp,
          normalized.actorUserId,
          normalized.actorUserId
        );
      }
      const after = listPointRoleMappings(normalizedSiteId, {
        subsystemType
      });
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.point-role-mappings.update",
        targetType: "point_role_mapping",
        targetId: subsystemType ? `${normalizedSiteId}:${subsystemType}` : normalizedSiteId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function inferPointRoleFromText(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
      return {
        pointRole: "feedback",
        confidence: 0.2,
        reason: "字段为空，默认按反馈点预览。"
      };
    }
    const matchers = [
      { role: "command", words: ["cmd", "command", "命令", "指令", "写", "下发", "控制命令", "启停命令"] },
      { role: "alarm", words: ["alarm", "fault", "告警", "报警", "故障"] },
      { role: "status", words: ["status", "state", "run", "running", "运行", "状态", "启停状态", "加载", "卸载", "load", "unload", "开机", "停机", "ready"] },
      { role: "feedback", words: ["specific", "单耗", "比功率", "能效", "泄漏率", "kwh/nm3", "kwh/nm³", "kwh", "用电", "电量", "累计", "feedback", "反馈", "开度", "频率"] },
      { role: "temperature", words: ["temp", "temperature", "温度", "露点", "dew", "供水", "回水", "送风", "回风"] },
      { role: "pressure", words: ["pressure", "press", "压力", "压差", "气压", "bar", "mpa"] },
      { role: "flow", words: ["flow", "流量", "m3", "nm3", "瞬时流"] },
      { role: "power", words: ["kw", "kwh", "power", "功率", "电量", "有功", "需量", "电能"] },
      { role: "setpoint", words: ["set", "sp", "设定", "目标", "给定"] },
      { role: "feedback", words: ["fb"] }
    ];
    for (const matcher of matchers) {
      if (matcher.words.some((word) => text.includes(word))) {
        return {
          pointRole: matcher.role,
          confidence: matcher.role === "command" ? 0.62 : 0.78,
          reason: `命中 ${matcher.words.find((word) => text.includes(word))} 关键词。`
        };
      }
    }
    return {
      pointRole: "feedback",
      confidence: 0.35,
      reason: "未命中强规则，按反馈点预览。"
    };
  }

  function parsePointRoleImportRows(payload) {
    if (Array.isArray(payload?.rows)) {
      return payload.rows.map((row) => (row && typeof row === "object" ? row : {}));
    }
    const text = normalizeText(payload?.text || payload?.rawText || payload);
    if (!text) {
      return [];
    }
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      return [];
    }
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const firstCells = lines[0].split(delimiter).map((cell) => cell.trim());
    const hasHeader = firstCells.some((cell) => /name|point|code|tag|unit|subsystem|名称|点位|编码|单位|子系统/i.test(cell));
    const headers = hasHeader
      ? firstCells
      : ["pointName", "pointCode", "unit", "subsystemType"];
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const cells = line.split(delimiter).map((cell) => cell.trim());
      const record = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] || "";
      });
      return record;
    });
  }

  function pickImportField(row, candidates) {
    for (const key of candidates) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
        return String(row[key]).trim();
      }
    }
    return "";
  }

  function previewPointRoleMappingImport(siteId, payload = {}) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const fallbackSubsystemType = normalizeText(payload?.subsystemType) || "chilled_plant";
    const rows = parsePointRoleImportRows(payload);
    const items = rows.map((row, index) => {
      const subsystemType =
        normalizeText(
          pickImportField(row, ["subsystemType", "subsystem", "子系统", "系统", "system"])
        ) || fallbackSubsystemType;
      const pointName = pickImportField(row, ["pointName", "name", "label", "点位名称", "名称", "变量名"]);
      const pointCode = pickImportField(row, ["pointCode", "code", "tag", "点位编码", "编码", "变量编码"]);
      const unit = pickImportField(row, ["unit", "单位"]);
      const roleText = pickImportField(row, ["pointRole", "role", "点位角色", "角色"]) || `${pointName} ${pointCode}`;
      const inferred = inferPointRoleFromText(roleText);
      const writableCandidate = /cmd|command|命令|指令|控制|写/.test(`${pointName} ${pointCode}`.toLowerCase());
      return {
        rowNumber: index + 1,
        subsystemType,
        pointRole: inferred.pointRole,
        pointName,
        pointCode,
        unit,
        dataType: pickImportField(row, ["dataType", "type", "类型"]),
        direction: "read",
        required: inferred.confidence >= 0.7,
        writable: false,
        source: "import_preview",
        confidence: inferred.confidence,
        reason: inferred.reason,
        warnings: [
          !getSubsystemRegistryItem(subsystemType) ? `未知子系统 ${subsystemType}` : "",
          !pointName && !pointCode ? "缺少点位名称或编码" : "",
          writableCandidate ? "疑似写点/命令点，第一版只允许预览，不会启用写控制。" : ""
        ].filter(Boolean)
      };
    });
    const acceptedCount = items.filter((item) => item.warnings.length === 0).length;
    const writableCandidates = items.filter((item) => item.warnings.some((warning) => warning.includes("写点"))).length;
    return {
      siteId: normalizedSiteId,
      generatedAt: nowIso(),
      totalRows: items.length,
      acceptedRows: acceptedCount,
      writableCandidates,
      items,
      summary: {
        message: "导入预览不会写入真实控制点；请确认角色映射后再手动保存。",
        blocked: false
      }
    };
  }

  function createSiteConfigSnapshot(siteId) {
    return {
      snapshotVersion: 3,
      siteId,
      capturedAt: nowIso(),
      subsystems: listSiteSubsystems(siteId),
      stationInstances: listStationInstances(siteId),
      stationRuntimeBindings: listStationRuntimeBindings(siteId),
      pointRoleMappings: listPointRoleMappings(siteId),
      advisorPluginBindings: listAdvisorPluginBindings(siteId)
    };
  }

  function createPublishedSiteConfigSnapshot(siteId) {
    const snapshot = createSiteConfigSnapshot(siteId);
    return {
      ...snapshot,
      subsystems: {
        ...snapshot.subsystems,
        items: (snapshot.subsystems?.items || []).map((item) => ({
          ...item,
          published: true
        }))
      },
      stationInstances: {
        ...snapshot.stationInstances,
        items: (snapshot.stationInstances?.items || []).map((item) => ({
          ...item,
          published: true
        }))
      }
    };
  }

  function getConfigVersion(siteId, versionId) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedVersionId = normalizeText(versionId);
    if (!normalizedSiteId || !normalizedVersionId) {
      return null;
    }
    return mapConfigVersionRow(
      sql.get(
        `
          SELECT *
          FROM admin_config_versions
          WHERE site_id = ? AND version_id = ?
          LIMIT 1
        `,
        normalizedSiteId,
        normalizedVersionId
      )
    );
  }

  function listConfigVersions(siteId, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    assertSiteExists(normalizedSiteId);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const items = sql
      .all(
        `
          SELECT *
          FROM admin_config_versions
          WHERE site_id = ?
          ORDER BY updated_at DESC, created_at DESC, version_id DESC
          LIMIT ?
        `,
        normalizedSiteId,
        limit
      )
      .map((row) => {
        const mapped = mapConfigVersionRow(row);
        if (!mapped) {
          return null;
        }
        return {
          ...mapped,
          payload: undefined
        };
      })
      .filter(Boolean);
    return {
      siteId: normalizedSiteId,
      generatedAt: nowIso(),
      items
    };
  }

  function publishConfigVersion(siteId, versionId, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedVersionId = normalizeText(versionId);
    if (!normalizedVersionId) {
      throw badRequest("versionId is required", { field: "versionId" });
    }
    assertSiteExists(normalizedSiteId);
    const before = getConfigVersion(normalizedSiteId, normalizedVersionId);
    if (before) {
      throw conflict("Published config version is immutable", {
        siteId: normalizedSiteId,
        versionId: normalizedVersionId,
        status: before.status
      });
    }
    // A version represents the state that becomes current after this publish,
    // not the draft flags that happened to exist one line earlier.
    const snapshot = createPublishedSiteConfigSnapshot(normalizedSiteId);
    const timestamp = nowIso();
    return withTransaction(db, () => {
      sql.run(
        `
          INSERT INTO admin_config_versions (
            version_id,
            site_id,
            status,
            summary,
            payload_json,
            created_at,
            updated_at,
            created_by,
            updated_by,
            published_at
          ) VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)
        `,
        normalizedVersionId,
        normalizedSiteId,
        normalizeNullableText(options.summary) || `发布配置 ${normalizedVersionId}`,
        toJsonText(snapshot, {}),
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId),
        timestamp
      );
      sql.run(
        `
          UPDATE admin_site_subsystem_capabilities
          SET published = 1, updated_at = ?, updated_by = ?
          WHERE site_id = ?
        `,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizedSiteId
      );
      sql.run(
        `
          UPDATE admin_station_instances
          SET published = 1, updated_at = ?, updated_by = ?
          WHERE site_id = ?
        `,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizedSiteId
      );
      const after = getConfigVersion(normalizedSiteId, normalizedVersionId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.config-version.publish",
        targetType: "config_version",
        targetId: normalizedVersionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return after;
    });
  }

  function restorePointMappingsFromSnapshot(siteId, snapshot, actor = {}) {
    const timestamp = nowIso();
    const mappings = Array.isArray(snapshot?.pointRoleMappings?.items)
      ? snapshot.pointRoleMappings.items
      : [];
    sql.run(`DELETE FROM admin_point_role_mappings WHERE site_id = ?`, siteId);
    for (const item of mappings) {
      const normalized = normalizePointMappingInput(siteId, item, actor);
      sql.run(
        `
          INSERT INTO admin_point_role_mappings (
            site_id,
            subsystem_type,
            point_role,
            point_name,
            point_code,
            unit,
            data_type,
            direction,
            required,
            writable,
            source,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'read', ?, 0, ?, ?, ?, ?, ?, ?)
        `,
        normalized.siteId,
        normalized.subsystemType,
        normalized.pointRole,
        normalized.pointName || normalized.pointCode || "",
        normalized.pointCode,
        normalized.unit,
        normalized.dataType,
        normalized.required ? 1 : 0,
        normalized.source || "rollback",
        normalized.notes,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }
  }

  function restoreStationInstancesFromSnapshot(siteId, snapshot, actor = {}) {
    if (!Array.isArray(snapshot?.stationInstances?.items)) {
      return;
    }
    const restorableItems = snapshot.stationInstances.items
      .map((item) => ({
        item,
        stationId: normalizeText(item?.stationId),
        stationName: normalizeText(item?.stationName),
        parentSubsystemType: normalizeText(item?.parentSubsystemType)
      }))
      .filter(({ stationId, stationName, parentSubsystemType }) => (
        stationId && stationName && parentSubsystemType
      ));
    for (const { parentSubsystemType } of restorableItems) {
      assertPhysicalStationParentType(parentSubsystemType);
    }
    const timestamp = nowIso();
    // Historical binding versions reference station identities. A config
    // rollback therefore disables stations absent from the snapshot instead
    // of deleting rows and cascading immutable binding history away.
    sql.run(
      `UPDATE admin_station_instances
       SET status = 'not_configured', published = 0, updated_at = ?, updated_by = ?
       WHERE site_id = ?`,
      timestamp,
      normalizeNullableText(actor?.userId),
      siteId
    );
    for (const { item, stationId, stationName, parentSubsystemType } of restorableItems) {
      const status = normalizeSubsystemStatus(item?.status, "not_configured");
      const enabled = status === "enabled";
      const existing = sql.get(
        `SELECT parent_subsystem_type
         FROM admin_station_instances
         WHERE site_id = ? AND station_id = ?
         LIMIT 1`,
        siteId,
        stationId
      );
      if (existing && existing.parent_subsystem_type !== parentSubsystemType) {
        const bindingCount = sql.get(
          `SELECT COUNT(*) AS count
           FROM admin_station_runtime_binding_versions
           WHERE site_id = ? AND station_id = ?`,
          siteId,
          stationId
        )?.count || 0;
        if (bindingCount > 0) {
          throw conflict("Cannot relabel a physical station with immutable binding history", {
            siteId,
            stationId,
            currentParentSubsystemType: existing.parent_subsystem_type,
            requestedParentSubsystemType: parentSubsystemType
          });
        }
      }
      sql.run(
        `
          INSERT INTO admin_station_instances (
            site_id,
            station_id,
            station_name,
            parent_subsystem_type,
            status,
            source_status,
            freshness_status,
            alarm_count,
            sort_order,
            published,
            notes,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(site_id, station_id) DO UPDATE SET
            station_name = excluded.station_name,
            parent_subsystem_type = excluded.parent_subsystem_type,
            status = excluded.status,
            source_status = excluded.source_status,
            freshness_status = excluded.freshness_status,
            alarm_count = excluded.alarm_count,
            sort_order = excluded.sort_order,
            published = excluded.published,
            notes = excluded.notes,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `,
        siteId,
        stationId,
        stationName,
        parentSubsystemType,
        status,
        enabled ? "waiting" : "not_configured",
        enabled ? "unknown" : "not_configured",
        0,
        item?.sortOrder == null ? 999 : normalizeNonNegativeInteger(item.sortOrder),
        normalizeBooleanFlag(item?.published, false) ? 1 : 0,
        normalizeNullableText(item?.notes),
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
    }
  }

  function restoreStationRuntimeBindingsFromSnapshot(siteId, snapshot, actor = {}) {
    const snapshotItems = Array.isArray(snapshot?.stationRuntimeBindings?.items)
      ? snapshot.stationRuntimeBindings.items
      : [];
    const normalizedItems = snapshotItems.map((state) => {
      const sourceBinding = state?.publishedBinding || state?.effectiveBinding || state?.draftBinding || state;
      const stationId = assertStationId(state?.stationId || sourceBinding?.stationId);
      const station = sql.get(
        "SELECT station_id FROM admin_station_instances WHERE site_id = ? AND station_id = ? LIMIT 1",
        siteId,
        stationId
      );
      if (!station) {
        throw badRequest("Binding snapshot references a missing physical station", {
          siteId,
          stationId
        });
      }
      const draft = normalizeStationRuntimeBindingDraftPayload({
        source: sourceBinding?.source || {},
        selectors: sourceBinding?.selectors || {},
        notes: sourceBinding?.notes
      });
      return {
        stationId,
        draft
      };
    });

    const timestamp = nowIso();
    // Rollback never treats historical validation as current. Clear every live
    // head first, retain immutable rows as superseded evidence, then create new
    // drafts that must pass validation and approval again.
    sql.run(
      `UPDATE admin_station_runtime_binding_versions
       SET status = 'superseded', updated_at = ?
       WHERE site_id = ? AND status IN ('draft', 'validated', 'published')`,
      timestamp,
      siteId
    );
    sql.run(
      `UPDATE admin_station_runtime_binding_heads
       SET draft_version = NULL,
           current_published_version = NULL,
           updated_at = ?,
           updated_by = ?
       WHERE site_id = ?`,
      timestamp,
      normalizeNullableText(actor?.userId),
      siteId
    );
    for (const item of normalizedItems) {
      const head = getStationRuntimeBindingHead(siteId, item.stationId);
      const latestVersion = Number(sql.get(
        `SELECT MAX(binding_version) AS latest_version
         FROM admin_station_runtime_binding_versions
         WHERE site_id = ? AND station_id = ?`,
        siteId,
        item.stationId
      )?.latest_version) || 0;
      const bindingVersion = latestVersion + 1;
      if (head?.draft_version) {
        sql.run(
          `UPDATE admin_station_runtime_binding_versions
           SET status = 'superseded', updated_at = ?
           WHERE site_id = ? AND station_id = ? AND binding_version = ?`,
          timestamp,
          siteId,
          item.stationId,
          head.draft_version
        );
      }
      sql.run(
        `
          INSERT INTO admin_station_runtime_binding_versions (
            site_id, station_id, binding_version, status, database_key,
            project_key, template, device_ids_json, device_codes_json,
            point_codes_json, payload_hash, notes, created_at, updated_at,
            created_by, updated_by
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        item.stationId,
        bindingVersion,
        item.draft.source.databaseKey,
        item.draft.source.projectKey,
        item.draft.source.template,
        toJsonText(item.draft.selectors.deviceIds, []),
        toJsonText(item.draft.selectors.deviceCodes, []),
        toJsonText(item.draft.selectors.pointCodes, []),
        item.draft.payloadHash,
        item.draft.notes,
        timestamp,
        timestamp,
        normalizeNullableText(actor?.userId),
        normalizeNullableText(actor?.userId)
      );
      sql.run(
        `
          INSERT INTO admin_station_runtime_binding_heads (
            site_id, station_id, draft_version, current_published_version, updated_at, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(site_id, station_id) DO UPDATE SET
            draft_version = excluded.draft_version,
            current_published_version = NULL,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `,
        siteId,
        item.stationId,
        bindingVersion,
        null,
        timestamp,
        normalizeNullableText(actor?.userId)
      );
    }
  }

  function rollbackConfigVersion(siteId, versionId, actor = {}, options = {}) {
    const normalizedSiteId = normalizeText(siteId);
    const normalizedVersionId = normalizeText(versionId);
    const version = getConfigVersion(normalizedSiteId, normalizedVersionId);
    if (!version) {
      throw notFound(`Config version not found: ${normalizedVersionId}`, {
        siteId: normalizedSiteId,
        versionId: normalizedVersionId
      });
    }
    const before = createSiteConfigSnapshot(normalizedSiteId);
    const snapshot = version.payload || {};
    const timestamp = nowIso();
    return withTransaction(db, () => {
      const subsystemItems = Array.isArray(snapshot?.subsystems?.items)
        ? snapshot.subsystems.items
        : [];
      for (const item of subsystemItems) {
        upsertSiteCapabilityRow(normalizedSiteId, item.subsystemType, item, actor);
        if (item.controlBoundary) {
          upsertControlBoundary(normalizedSiteId, item.subsystemType, item.controlBoundary, actor);
        }
        if (Array.isArray(item.advisorBindings)) {
          item.advisorBindings.forEach((binding) => {
            upsertAdvisorPluginBinding(normalizedSiteId, item.subsystemType, binding, actor);
          });
        }
      }
      restoreStationInstancesFromSnapshot(normalizedSiteId, snapshot, actor);
      restoreStationRuntimeBindingsFromSnapshot(normalizedSiteId, snapshot, actor);
      restorePointMappingsFromSnapshot(normalizedSiteId, snapshot, actor);
      sql.run(
        `
          UPDATE admin_config_versions
          SET status = 'rolled_back',
              updated_at = ?,
              updated_by = ?,
              rolled_back_at = ?
          WHERE site_id = ? AND version_id = ?
        `,
        timestamp,
        normalizeNullableText(actor?.userId),
        timestamp,
        normalizedSiteId,
        normalizedVersionId
      );
      const after = createSiteConfigSnapshot(normalizedSiteId);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.config-version.rollback",
        targetType: "config_version",
        targetId: normalizedVersionId,
        scopeType: "site",
        scopeId: normalizedSiteId,
        beforeJson: toJsonText(before),
        afterJson: toJsonText(after),
        requestId: options.requestId
      });
      return {
        version: getConfigVersion(normalizedSiteId, normalizedVersionId),
        restored: after
      };
    });
  }

  function listAuditLogs(filters = {}, access = {}) {
    const where = [];
    const params = [];

    const actorUserId = normalizeText(filters.actorUserId);
    if (actorUserId) {
      where.push("actor_user_id = ?");
      params.push(actorUserId);
    }

    const action = normalizeText(filters.action);
    if (action) {
      where.push("action = ?");
      params.push(action);
    }

    const siteId = normalizeText(filters.siteId);
    if (siteId) {
      where.push("scope_type = 'site' AND scope_id = ?");
      params.push(siteId);
    } else if (!access.allowAllSites) {
      const siteIds = Array.isArray(access.siteIds) ? access.siteIds.filter(Boolean) : [];
      if (siteIds.length === 0) {
        return [];
      }
      where.push(`(scope_type = 'site' AND scope_id IN (${siteIds.map(() => "?").join(", ")}))`);
      params.push(...siteIds);
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);

    return sql
      .all(
        `
          SELECT
            audit_id,
            actor_user_id,
            actor_username,
            action,
            target_type,
            target_id,
            scope_type,
            scope_id,
            before_json,
            after_json,
            request_id,
            created_at
          FROM admin_audit_logs
          ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY created_at DESC, audit_id DESC
          LIMIT ?
        `,
        ...params,
        limit
      )
      .map((row) => ({
        auditId: row.audit_id,
        actorUserId: row.actor_user_id || null,
        actorUsername: row.actor_username || null,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        scopeType: row.scope_type,
        scopeId: row.scope_type === "platform" ? null : row.scope_id,
        before: safeJsonParse(row.before_json, null),
        after: safeJsonParse(row.after_json, null),
        requestId: row.request_id || null,
        createdAt: row.created_at
      }));
  }

  function updateSite(siteId, patch, actor, options = {}) {
    return withTransaction(db, () => {
      const result = updateSiteRecord(siteId, patch, actor);
      recordAudit({
        actorUserId: actor?.userId,
        actorUsername: actor?.username,
        action: "site.update",
        targetType: "site",
        targetId: siteId,
        scopeType: "site",
        scopeId: siteId,
        beforeJson: toJsonText(result.before),
        afterJson: toJsonText(result.after),
        requestId: options.requestId
      });
      return result.after;
    });
  }

  return {
    dbFile,
    close() {
      db.close();
    },
    ensurePrincipal,
    bootstrapPlatformAdmin,
    getAdminContext,
    listSites,
    getSite,
    createSite,
    updateSite,
    assertSiteExists,
    getSiteSourceConfig,
    upsertSourceConfig,
    getSiteRuntimeConfig,
    upsertRuntimeConfig,
    importSites,
    listSiteMembers,
    createSiteMember,
    updateSiteMember,
    deleteSiteMember,
    getOptimizeExecution,
    createOptimizeExecution,
    listOptimizeExecutions,
    createChillerStagingSample,
    getChillerStagingSample,
    listChillerStagingSamples,
    getLatestChillerStagingSample,
    appendHvacTerminalSnapshotSamples,
    getLatestHvacTerminalSample,
    listHvacTerminalSamples,
    listHvacTerminalSampleTimeline,
    getFcuControlPolicy,
    upsertFcuControlPolicy,
    createFcuControlRecord,
    getFcuControlRecord,
    listFcuControlRecords,
    rollbackFcuControlRecord,
    verifyFcuControlRecordFeedback,
    createShadowVerificationRecord,
    getShadowVerificationRecord,
    listShadowVerificationRecords,
    approveOptimizeExecution,
    rollbackOptimizeExecution,
    dispatchOptimizeExecution,
    getOptimizeExecutionOverview,
    listSubsystemRegistry,
    listSiteSubsystems,
    getSiteCapabilities,
    upsertSiteSubsystems,
    listStationInstances,
    upsertStationInstances,
    getStationRuntimeBinding,
    getStationRuntimeBindingState,
    listStationRuntimeBindings,
    upsertStationRuntimeBinding,
    recordStationRuntimeBindingValidation,
    publishStationRuntimeBinding,
    listPointRoleMappings,
    upsertPointRoleMappings,
    previewPointRoleMappingImport,
    listConfigVersions,
    publishConfigVersion,
    rollbackConfigVersion,
    listAuditLogs
  };
}
