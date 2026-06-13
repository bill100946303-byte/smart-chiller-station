import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { badRequest, conflict, notFound } from "./admin-errors.js";

const SITE_STATUSES = new Set(["active", "paused", "disabled"]);
const ADMIN_ROLES = new Set(["platform_admin", "site_admin", "auditor"]);
const OPTIMIZE_EXECUTION_STATUSES = new Set(["pending_approval", "approved", "rolled_back"]);
const DEFAULT_OPTIMIZE_EXECUTION_LIMIT = 20;
const MAX_OPTIMIZE_EXECUTION_LIMIT = 100;
const DEFAULT_CHILLER_STAGING_SAMPLE_LIMIT = 500;
const MAX_CHILLER_STAGING_SAMPLE_LIMIT = 2000;
const DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT = 100;
const MAX_SHADOW_VERIFICATION_RECORD_LIMIT = 500;
const SHADOW_VERIFICATION_OUTCOMES = new Set(["improved", "neutral", "regressed", "invalid", "pending"]);

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

function normalizeSiteStatus(value, fallback = "active") {
  const normalized = normalizeText(value).toLowerCase();
  return SITE_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeAdminRole(value, fallback = null) {
  const normalized = normalizeText(value).toLowerCase();
  return ADMIN_ROLES.has(normalized) ? normalized : fallback;
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

function normalizeShadowVerificationRecordLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SHADOW_VERIFICATION_RECORD_LIMIT;
  }
  return Math.min(parsed, MAX_SHADOW_VERIFICATION_RECORD_LIMIT);
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

    CREATE INDEX IF NOT EXISTS idx_admin_shadow_verification_site_recorded
      ON admin_shadow_verification_records(site_id, recorded_at DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_admin_shadow_verification_execution
      ON admin_shadow_verification_records(site_id, execution_id, recorded_at DESC);
  `);

  ensureTableColumn(db, "admin_site_source_configs", "preferred_project_key", "preferred_project_key TEXT");
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
    createShadowVerificationRecord,
    getShadowVerificationRecord,
    listShadowVerificationRecords,
    approveOptimizeExecution,
    rollbackOptimizeExecution,
    dispatchOptimizeExecution,
    getOptimizeExecutionOverview,
    listAuditLogs
  };
}
