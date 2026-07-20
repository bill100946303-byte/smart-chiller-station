import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { createAdminAuthMiddleware } from "./lib/admin-auth.js";
import { createAdminStore } from "./lib/admin-db.js";
import { formatApiError } from "./lib/admin-errors.js";
import { config } from "./config.js";
import { buildAdminRouter } from "./routes/admin-v1.js";
import { buildV1Router } from "./routes/v1.js";
import { createAdminLegacyAuthService } from "./services/adminLegacyAuthService.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isAllowedReadOnlyV1Write(req) {
  return (
    req.method === "POST" &&
    (req.path.endsWith("/optimize") ||
      req.path.endsWith("/optimize/tower-approach/advice") ||
      req.path.endsWith("/hvac-terminal/fan-coils/control-cycle") ||
      req.path.endsWith("/hvac-terminal/fan-coils/control-command") ||
      req.path.endsWith("/hvac-terminal/fan-coils/canary-window") ||
      req.path.endsWith("/hvac-terminal/fan-coils/field-arm-package") ||
      req.path.endsWith("/hvac-terminal/fan-coils/canary-dispatch") ||
      req.path.endsWith("/hvac-terminal/fan-coils/final-control-status/refresh") ||
      req.path.endsWith("/hvac-terminal/fan-coils/final-control-rollout") ||
      req.path.endsWith("/power-monitoring/byx/history/snapshots") ||
      req.path.includes("/optimize/executions") ||
      req.path.endsWith("/assistant/query"))
  );
}

export function createReadOnlyMiddleware(options = {}) {
  const { appConfig, allowWrite } = options;
  return function readOnlyMiddleware(req, res, next) {
    if (!appConfig.readOnlyMode || SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    if (typeof allowWrite === "function" && allowWrite(req)) {
      next();
      return;
    }

    res.status(403).json({
      ok: false,
      code: "READ_ONLY_MODE",
      error: `${appConfig.appModeLabel}已启用只读保护，当前环境禁止新增、编辑和删除操作。`,
      requestId: req.requestId || createRequestId(),
      details: {
        appMode: appConfig.appMode,
        appModeLabel: appConfig.appModeLabel,
        readOnlyMode: appConfig.readOnlyMode,
        legacyBaseUrl: appConfig.legacyBaseUrl
      }
    });
  };
}

export function createApp(appConfig = config, dependencies = {}) {
  const app = express();
  const adminStore = dependencies.adminStore || createAdminStore({ dbFile: appConfig.adminDbFile });
  const adminAuthService =
    dependencies.adminAuthService || createAdminLegacyAuthService(appConfig, { cacheTtlMs: 5 * 60 * 1000 });

  app.locals.adminStore = adminStore;

  app.use(cors());
  app.use((req, res, next) => {
    req.requestId = createRequestId();
    res.setHeader("x-request-id", req.requestId);
    next();
  });
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "chiller-bff",
      port: appConfig.port,
      appMode: appConfig.appMode,
      appModeLabel: appConfig.appModeLabel,
      readOnlyMode: appConfig.readOnlyMode,
      legacyBaseUrl: appConfig.legacyBaseUrl,
      realtimeParamsBaseUrl: appConfig.realtimeParamsBaseUrl,
      realtimeParamsTimeoutMs: appConfig.realtimeParamsTimeoutMs,
      adminDbFile: appConfig.adminDbFile,
      adminDevAuth: appConfig.adminDevAuth === true
    });
  });

  app.use(
    "/bff/v1",
    createReadOnlyMiddleware({
      appConfig,
      allowWrite: isAllowedReadOnlyV1Write
    })
  );
  app.use("/bff/v1", buildV1Router(appConfig, { adminStore }));

  app.use("/admin/v1", createAdminAuthMiddleware(adminAuthService));
  app.use(
    "/admin/v1",
    createReadOnlyMiddleware({
      appConfig
    })
  );
  app.use(
    "/admin/v1",
    buildAdminRouter({
      adminStore,
      authService: adminAuthService,
      config: appConfig
    })
  );

  app.use((error, req, res, _next) => {
    const { status, body } = formatApiError(error, req.requestId || createRequestId());
    res.status(status).json(body);
  });

  return {
    app,
    adminStore,
    adminAuthService
  };
}

export function startServer(appConfig = config, dependencies = {}) {
  const { app, adminStore, adminAuthService } = createApp(appConfig, dependencies);
  const host = process.env.BFF_HOST || "0.0.0.0";
  const server = app.listen(appConfig.port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[chiller-bff] listening on http://${host}:${appConfig.port}`);
  });
  return {
    app,
    server,
    adminStore,
    adminAuthService
  };
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === entryFile) {
  startServer();
}
