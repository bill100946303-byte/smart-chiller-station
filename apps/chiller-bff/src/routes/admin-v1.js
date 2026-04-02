import { Router } from "express";

import { badRequest, forbidden, unauthorized } from "../lib/admin-errors.js";
const SITE_MEMBER_ROLES = new Set(["site_admin", "auditor"]);
const SITE_STATUSES = new Set(["active", "paused", "disabled"]);

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

  return {
    energyParams: body.energyParams ?? {},
    ruleThresholds: body.ruleThresholds ?? {},
    featureFlags: body.featureFlags ?? {}
  };
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

  router.get("/sites/:siteId/source-config", (req, res, next) => {
    try {
      const siteId = normalizeText(req.params.siteId);
      const context = requireAdminContext(adminStore, req.adminUser.userId);
      assertCanReadSite(context, siteId);
      adminStore.assertSiteExists(siteId);
      toResponse(res, req.requestId, {
        siteId,
        sourceConfig: adminStore.getSiteSourceConfig(siteId)
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
        sourceConfig
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
