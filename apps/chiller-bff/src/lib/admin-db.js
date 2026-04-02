import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { badRequest, conflict, notFound } from "./admin-errors.js";

const SITE_STATUSES = new Set(["active", "paused", "disabled"]);
const ADMIN_ROLES = new Set(["platform_admin", "site_admin", "auditor"]);

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

function ensureLocalDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
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

    CREATE INDEX IF NOT EXISTS idx_admin_role_bindings_scope
      ON admin_role_bindings(scope_type, scope_id);

    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_scope
      ON admin_audit_logs(scope_type, scope_id, created_at DESC);
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
            template,
            control_mode,
            status,
            created_at,
            updated_at,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        siteId,
        next.legacyBaseUrl,
        next.ipAddress,
        next.port,
        next.databaseKey,
        next.modelKey,
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
    listAuditLogs
  };
}
