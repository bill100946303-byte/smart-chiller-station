import { Router } from "express";
import { resolveSiteRuntimeConfig } from "../lib/site-runtime-config.js";
import { getAnomalyList, getAnomalySummary } from "../services/anomalyService.js";
import { getColdStationLog } from "../services/coldStationLogService.js";
import { getDashboardOverview, getDashboardTrends } from "../services/dashboardService.js";
import { getDeviceDetail, getDeviceList, getDeviceTree } from "../services/deviceService.js";
import {
  buildAssistantQueryResponse,
  validateAssistantQueryRequest
} from "../services/assistantService.js";
import { getEnvironmentBuildings, getEnvironmentConditions } from "../services/environmentService.js";
import { getEnergyAnalysisReport, getEnergyAnalysisTree } from "../services/energyAnalysisService.js";
import {
  getEnergyEfficiencyCalendar,
  getEnergyEfficiencyCalendarPie
} from "../services/energyEfficiencyCalendarService.js";
import {
  getEnergyEfficiencyCompare,
  getEnergyEfficiencyImbalance,
  getEnergyEfficiencyProportion,
  getEnergyEfficiencySearch
} from "../services/energyEfficiencyService.js";
import { getEnergyParameters, updateEnergyParameters } from "../services/energyParameterService.js";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDeviceTypes,
  getKnowledgeDocuments,
  updateKnowledgeDocument
} from "../services/knowledgeService.js";
import { getMeterReadingExport, getMeterReadings } from "../services/meterReadingService.js";
import {
  buildOptimizeDraftResponse,
  validateOptimizeDraftRequest
} from "../services/optimizeService.js";
import {
  getOperationRecords,
  getOperationRecordDeviceTypes,
  getOperationRecordDevices
} from "../services/operationRecordService.js";
import { getPerformanceReport, getPerformanceReportExport } from "../services/performanceReportService.js";
import {
  getReportRecordExport,
  getReportRecordRegOptions,
  getReportRecords
} from "../services/reportRecordService.js";
import { getSceneLegacyTrend, getSceneOnlineMonitor } from "../services/sceneControlService.js";
import { getTopology } from "../services/topologyService.js";
import { getSystemDiagram } from "../services/systemDiagramService.js";
import { getRecommendations } from "../services/recommendationService.js";
import {
  createWorkOrder,
  deleteWorkOrder,
  getWorkOrderAssignees,
  getWorkOrderExport,
  getWorkOrders,
  updateWorkOrder
} from "../services/workOrderService.js";

function resolveSiteId(req, defaultSiteId) {
  return req.params.siteId || defaultSiteId;
}

function getRequestSiteConfig(req, baseConfig) {
  return req.siteRuntimeConfig || baseConfig;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateQuery(value, fallback = formatDate(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function formatDateTimeQuery(date, kind) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = kind === "end" ? "23" : "00";
  const minute = kind === "end" ? "59" : "00";
  const second = kind === "end" ? "59" : "00";
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeDateTimeQuery(value, kind = "start") {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return formatDateTimeQuery(new Date(), kind);
}

export function readRealtimeRequestContext(req) {
  const userIdHeader = req.get("x-chiller-user-id");
  const projectKeyHeader = req.get("x-chiller-project-key");
  const templateHeader = req.get("x-chiller-project-template");
  const bodyContext = req.body && typeof req.body === "object" ? req.body.context : null;
  const routeSiteId =
    typeof req?.params?.siteId === "string" && req.params.siteId.trim() ? req.params.siteId.trim() : "";
  const runtimeSourceConfig =
    req.siteRuntimeConfig && typeof req.siteRuntimeConfig === "object"
      ? req.siteRuntimeConfig.siteSourceConfig
      : null;
  const bodyUserId =
    bodyContext && typeof bodyContext.userId === "string" ? bodyContext.userId.trim() : "";
  const bodyProjectKey =
    bodyContext && typeof bodyContext.projectKey === "string" ? bodyContext.projectKey.trim() : "";
  const bodyTemplate =
    bodyContext && typeof bodyContext.template === "string" ? bodyContext.template.trim() : "";
  const runtimeProjectKey =
    typeof runtimeSourceConfig?.modelKey === "string" && runtimeSourceConfig.modelKey.trim()
      ? runtimeSourceConfig.modelKey.trim()
      : typeof runtimeSourceConfig?.databaseKey === "string" && runtimeSourceConfig.databaseKey.trim()
        ? runtimeSourceConfig.databaseKey.trim()
        : "";
  const runtimeTemplate =
    typeof runtimeSourceConfig?.template === "string" && runtimeSourceConfig.template.trim()
      ? runtimeSourceConfig.template.trim()
      : "";
  const normalizedHeaderProjectKey =
    typeof projectKeyHeader === "string" && projectKeyHeader.trim() ? projectKeyHeader.trim() : "";
  const shouldPreferRuntimeProjectKey =
    runtimeProjectKey &&
    (
      !normalizedHeaderProjectKey ||
      normalizedHeaderProjectKey === routeSiteId ||
      normalizedHeaderProjectKey === runtimeSourceConfig?.databaseKey
    );
  return {
    userId: typeof userIdHeader === "string" && userIdHeader.trim() ? userIdHeader.trim() : bodyUserId,
    projectKey:
      shouldPreferRuntimeProjectKey
        ? runtimeProjectKey
        : normalizedHeaderProjectKey || bodyProjectKey || runtimeProjectKey,
    template:
      typeof templateHeader === "string" && templateHeader.trim()
        ? templateHeader.trim()
        : bodyTemplate || runtimeTemplate
  };
}

function normalizeLegacyBaseUrlOverride(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

function readLegacyBaseUrlOverride(req) {
  const headerValue = req.get("x-chiller-legacy-base-url");
  const bodyContext = req.body && typeof req.body === "object" ? req.body.context : null;
  const bodyValue =
    bodyContext && typeof bodyContext.legacyBaseUrl === "string" ? bodyContext.legacyBaseUrl : "";
  return normalizeLegacyBaseUrlOverride(
    typeof headerValue === "string" && headerValue.trim() ? headerValue : bodyValue
  );
}

function normalizeAssistantPromptOrigin(value) {
  return String(value || "").trim().toLowerCase() === "suggested" ? "suggested" : "manual";
}

function buildAssistantLogEnvelope(event, payload = {}) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...payload
  });
}

function logAssistantEvent(event, payload = {}) {
  // eslint-disable-next-line no-console
  console.log(buildAssistantLogEnvelope(event, payload));
}

async function readRequestBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0));
    });
    req.on("error", reject);
  });
}

export function buildV1Router(config, dependencies = {}) {
  const router = Router();
  const { adminStore } = dependencies;
  const allowedTrendRanges = new Set(["24h", "7d", "30d"]);
  const allowedEnergyAnalysisDateTypes = new Set(["1", "2", "3", "4"]);
  const allowedEnergyEfficiencyTimeSpaces = new Set(["1", "2", "3"]);
  const allowedEnergyEfficiencyProportionDateTypes = new Set(["2", "3"]);
  const allowedEnergyEfficiencyCalendarPieDateTypes = new Set(["1", "2"]);
  const allowedPerformanceMetrics = new Set([
    "systemEfficiency",
    "chillerEfficiency",
    "coolingTowerEfficiency",
    "chilledPumpEfficiency",
    "coolingPumpEfficiency",
    "chilledWaterTemperature",
    "chilledWaterTemperatureDiff",
    "coolingWaterTemperature",
    "coolingWaterTemperatureDiff",
    "chilledWaterFlow",
    "coolingWaterFlow"
  ]);

  router.use("/sites/:siteId", (req, _res, next) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    req.siteRuntimeConfig = resolveSiteRuntimeConfig(config, adminStore, siteId);
    next();
  });

  router.get("/sites/:siteId/dashboard/overview", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const anomalies = await getAnomalySummary(siteConfig, siteId);
    const data = await getDashboardOverview(
      siteConfig,
      siteId,
      anomalies,
      readRealtimeRequestContext(req)
    );
    res.json(data);
  });

  router.get("/sites/:siteId/dashboard/trends", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const range = String(req.query.range || "24h");
    if (!allowedTrendRanges.has(range)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid range value: ${range}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "range",
          allowed: ["24h", "7d", "30d"]
        }
      });
      return;
    }
    const data = await getDashboardTrends(siteConfig, siteId, range, readRealtimeRequestContext(req));
    res.json(data);
  });

  router.get("/sites/:siteId/cold-station-logs", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const rawDate = req.query.date;
    if (rawDate != null && (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()))) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid date value: ${String(rawDate)}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "date",
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }
    const date = normalizeDateQuery(rawDate);
    const data = await getColdStationLog(siteConfig, siteId, date, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (
      (startDate != null && (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()))) ||
      (endDate != null && (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startDate or endDate value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startDate", "endDate"],
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }

    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "10");
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId : "";
    const drId = typeof req.query.drId === "string" ? req.query.drId : "";
    const data = await getOperationRecords(siteConfig, siteId, {
      page,
      pageSize,
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate)),
      drTypeId,
      drId
    });
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records/device-types", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getOperationRecordDeviceTypes(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records/devices", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId : "0";
    const data = await getOperationRecordDevices(getRequestSiteConfig(req, config), siteId, drTypeId);
    res.json(data);
  });

  router.get("/sites/:siteId/energy-parameters", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getEnergyParameters(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.put("/sites/:siteId/energy-parameters", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const payload = req.body || {};
    const result = await updateEnergyParameters(getRequestSiteConfig(req, config), siteId, payload);

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_UPDATE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.json(result);
  });

  router.get("/sites/:siteId/knowledge/documents", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "10");
    const data = await getKnowledgeDocuments(getRequestSiteConfig(req, config), siteId, { page, pageSize });
    res.json(data);
  });

  router.get("/sites/:siteId/knowledge/device-types", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getKnowledgeDeviceTypes(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.post("/sites/:siteId/knowledge/documents", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const body = await readRequestBodyBuffer(req);
    const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
    const result = await createKnowledgeDocument(getRequestSiteConfig(req, config), siteId, {
      contentType,
      body
    });

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_CREATE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.status(201).json(result);
  });

  router.put("/sites/:siteId/knowledge/documents", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const body = await readRequestBodyBuffer(req);
    const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
    const result = await updateKnowledgeDocument(getRequestSiteConfig(req, config), siteId, {
      contentType,
      body
    });

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_UPDATE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.json(result);
  });

  router.delete("/sites/:siteId/knowledge/documents/:documentId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const documentId = typeof req.params.documentId === "string" ? req.params.documentId : "";
    const result = await deleteKnowledgeDocument(getRequestSiteConfig(req, config), siteId, documentId);

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_DELETE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.json(result);
  });

  router.get("/sites/:siteId/work-orders", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "10");
    const id = typeof req.query.id === "string" ? req.query.id : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : "";
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : "";
    const data = await getWorkOrders(getRequestSiteConfig(req, config), siteId, {
      page,
      pageSize,
      id,
      state,
      startDate,
      endDate
    });
    res.json(data);
  });

  router.get("/sites/:siteId/work-orders/assignees", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getWorkOrderAssignees(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.post("/sites/:siteId/work-orders", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const result = await createWorkOrder(getRequestSiteConfig(req, config), siteId, req.body || {});

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_CREATE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.status(201).json(result);
  });

  router.put("/sites/:siteId/work-orders/:orderId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const payload = {
      ...(req.body || {}),
      id: orderId
    };
    const result = await updateWorkOrder(getRequestSiteConfig(req, config), siteId, payload);

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_UPDATE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.json(result);
  });

  router.delete("/sites/:siteId/work-orders/:orderId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const result = await deleteWorkOrder(getRequestSiteConfig(req, config), siteId, orderId);

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_DELETE_FAILED",
        error: result.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: result.status ?? null,
          endpoint: result.endpoint
        }
      });
      return;
    }

    res.json(result);
  });

  router.get("/sites/:siteId/work-orders/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const file = await getWorkOrderExport(getRequestSiteConfig(req, config), siteId);

    if (!file.ok || !file.data) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_EXPORT_FAILED",
        error: file.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: file.status ?? null,
          endpoint: file.endpoint
        }
      });
      return;
    }

    res.setHeader("content-type", file.contentType || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename || `work-order-${siteId}.xls`)}`);
    res.send(Buffer.from(file.data));
  });

  router.get("/sites/:siteId/environment/buildings", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getEnvironmentBuildings(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/environment/conditions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const buildingId = typeof req.query.buildingId === "string" ? req.query.buildingId : "";
    const cooledAir = typeof req.query.cooledAir === "string" ? req.query.cooledAir : "";
    const monitoringSite = typeof req.query.monitoringSite === "string" ? req.query.monitoringSite : "";
    const data = await getEnvironmentConditions(getRequestSiteConfig(req, config), siteId, {
      buildingId,
      cooledAir,
      monitoringSite
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis/tree", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getEnergyAnalysisTree(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const dateType = typeof req.query.dateType === "string" ? req.query.dateType.trim() : "1";
    const deviceIds = typeof req.query.deviceIds === "string"
      ? req.query.deviceIds.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (
      (startDate != null && (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()))) ||
      (endDate != null && (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startDate or endDate value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startDate", "endDate"],
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }

    if (!allowedEnergyAnalysisDateTypes.has(dateType)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid dateType value: ${dateType}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "dateType",
          allowed: Array.from(allowedEnergyAnalysisDateTypes)
        }
      });
      return;
    }

    if (deviceIds.length === 0) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "deviceIds is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "deviceIds"
        }
      });
      return;
    }

    const data = await getEnergyAnalysisReport(siteConfig, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate)),
      dateType,
      deviceIds
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/search", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const timeSpace = typeof req.query.timeSpace === "string" ? req.query.timeSpace.trim() : "1";
    const deviceKeys = typeof req.query.deviceKeys === "string"
      ? req.query.deviceKeys.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (
      (startDate != null && (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()))) ||
      (endDate != null && (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startDate or endDate value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startDate", "endDate"],
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }

    if (!allowedEnergyEfficiencyTimeSpaces.has(timeSpace)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid timeSpace value: ${timeSpace}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "timeSpace",
          allowed: Array.from(allowedEnergyEfficiencyTimeSpaces)
        }
      });
      return;
    }

    if (deviceKeys.length === 0) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "deviceKeys is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "deviceKeys"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencySearch(siteConfig, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate)),
      timeSpace,
      deviceKeys
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/calendar", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const month = typeof req.query.month === "string" ? req.query.month.trim() : "";

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid month value: ${month}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "month",
          expected: "YYYY-MM"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencyCalendar(siteConfig, siteId, { month });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/calendar/pie", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const dateType = typeof req.query.dateType === "string" ? req.query.dateType.trim() : "1";
    const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

    if (!allowedEnergyEfficiencyCalendarPieDateTypes.has(dateType)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid dateType value: ${dateType}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "dateType",
          allowed: Array.from(allowedEnergyEfficiencyCalendarPieDateTypes)
        }
      });
      return;
    }

    const expectedPattern = dateType === "2" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
    if (date && !expectedPattern.test(date)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid date value",
        requestId: `req-${Date.now()}`,
        details: {
          field: "date",
          expected: dateType === "2" ? "YYYY-MM" : "YYYY-MM-DD"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencyCalendarPie(siteConfig, siteId, { date, dateType });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/compare", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const deviceKey = typeof req.query.deviceKey === "string" ? req.query.deviceKey.trim() : "";
    const dates = typeof req.query.dates === "string"
      ? req.query.dates.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (!deviceKey) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "deviceKey is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "deviceKey"
        }
      });
      return;
    }

    if (dates.length === 0 || dates.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item))) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "dates is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "dates",
          expected: "YYYY-MM-DD[,YYYY-MM-DD]"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencyCompare(siteConfig, siteId, {
      deviceKey,
      dates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/proportion", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const dateType = typeof req.query.dateType === "string" ? req.query.dateType.trim() : "2";
    const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

    if (!allowedEnergyEfficiencyProportionDateTypes.has(dateType)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid dateType value: ${dateType}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "dateType",
          allowed: Array.from(allowedEnergyEfficiencyProportionDateTypes)
        }
      });
      return;
    }

    const expected = dateType === "3" ? /^\d{4}$/ : /^\d{4}-\d{2}$/;
    if (!date || !expected.test(date)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid date value",
        requestId: `req-${Date.now()}`,
        details: {
          field: "date",
          expected: dateType === "3" ? "YYYY" : "YYYY-MM"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencyProportion(siteConfig, siteId, {
      date,
      dateType
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/imbalance", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (
      (startDate != null && (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim()))) ||
      (endDate != null && (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startDate or endDate value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startDate", "endDate"],
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }

    const data = await getEnergyEfficiencyImbalance(siteConfig, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate))
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    const data = await getMeterReadings(siteConfig, siteId, {
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end")
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    const file = await getMeterReadingExport(siteConfig, siteId, {
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end")
    });

    if (!file.ok || !file.data) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_EXPORT_FAILED",
        error: file.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: file.status ?? null,
          endpoint: file.endpoint
        }
      });
      return;
    }

    res.setHeader("content-type", file.contentType || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename || `meter-reading-${siteId}.xls`)}`);
    res.send(Buffer.from(file.data));
  });

  router.get("/sites/:siteId/performance-reports", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const metric = typeof req.query.metric === "string" ? req.query.metric.trim() : "systemEfficiency";
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const language = typeof req.query.language === "string" ? req.query.language.trim() : "";
    const unit = typeof req.query.unit === "string" ? req.query.unit.trim() : "";
    const modelKey = typeof req.query.modelKey === "string" ? req.query.modelKey.trim() : "";
    const template = typeof req.query.template === "string" ? req.query.template.trim() : "";

    if (!allowedPerformanceMetrics.has(metric)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid metric value: ${metric}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "metric",
          allowed: Array.from(allowedPerformanceMetrics)
        }
      });
      return;
    }

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    const data = await getPerformanceReport(siteConfig, siteId, {
      metric,
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end"),
      language,
      unit,
      modelKey,
      template
    });
    res.json(data);
  });

  router.get("/sites/:siteId/performance-reports/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const language = typeof req.query.language === "string" ? req.query.language.trim() : "";
    const unit = typeof req.query.unit === "string" ? req.query.unit.trim() : "";
    const modelKey = typeof req.query.modelKey === "string" ? req.query.modelKey.trim() : "";
    const template = typeof req.query.template === "string" ? req.query.template.trim() : "";

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    const file = await getPerformanceReportExport(siteConfig, siteId, {
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end"),
      language,
      unit,
      modelKey,
      template
    });

    if (!file.ok || !file.data) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_EXPORT_FAILED",
        error: file.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: file.status ?? null,
          endpoint: file.endpoint
        }
      });
      return;
    }

    res.setHeader("content-type", file.contentType || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename || `performance-report-${siteId}.pdf`)}`);
    res.send(Buffer.from(file.data));
  });

  router.get("/sites/:siteId/report-records/reg-options", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId.trim() : "";
    const drId = typeof req.query.drId === "string" ? req.query.drId.trim() : "";

    if (!drTypeId || !drId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "drTypeId and drId are required",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["drTypeId", "drId"]
        }
      });
      return;
    }

    const data = await getReportRecordRegOptions(siteConfig, siteId, { drTypeId, drId });
    res.json(data);
  });

  router.get("/sites/:siteId/report-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId.trim() : "";
    const drId = typeof req.query.drId === "string" ? req.query.drId.trim() : "";
    const regIds = typeof req.query.regIds === "string"
      ? req.query.regIds.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    if (!drTypeId || !drId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "drTypeId and drId are required",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["drTypeId", "drId"]
        }
      });
      return;
    }

    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "10");
    const data = await getReportRecords(siteConfig, siteId, {
      page,
      pageSize,
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end"),
      drTypeId,
      drId,
      regIds
    });
    res.json(data);
  });

  router.get("/sites/:siteId/report-records/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId.trim() : "";
    const drId = typeof req.query.drId === "string" ? req.query.drId.trim() : "";
    const regIds = typeof req.query.regIds === "string"
      ? req.query.regIds.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD HH:mm:ss"
        }
      });
      return;
    }

    if (!drTypeId || !drId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "drTypeId and drId are required",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["drTypeId", "drId"]
        }
      });
      return;
    }

    const file = await getReportRecordExport(siteConfig, siteId, {
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end"),
      drTypeId,
      drId,
      regIds
    });

    if (!file.ok || !file.data) {
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_EXPORT_FAILED",
        error: file.error,
        requestId: `req-${Date.now()}`,
        details: {
          status: file.status ?? null,
          endpoint: file.endpoint
        }
      });
      return;
    }

    res.setHeader("content-type", file.contentType || "application/octet-stream");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename || `report-record-${siteId}.xls`)}`);
    res.send(Buffer.from(file.data));
  });

  router.get("/sites/:siteId/anomalies/summary", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getAnomalySummary(getRequestSiteConfig(req, config), siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/anomalies/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "20");
    const severity = typeof req.query.severity === "string" ? req.query.severity : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const data = await getAnomalyList(getRequestSiteConfig(req, config), siteId, {
      page,
      pageSize,
      severity,
      state
    });
    res.json(data);
  });

  router.get("/sites/:siteId/system/topology", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const data = await getTopology(getRequestSiteConfig(req, config), siteId, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/system/diagram", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const layoutMode = typeof req.query.layoutMode === "string" ? req.query.layoutMode : "auto";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "full";
    const data = await getSystemDiagram(siteConfig, siteId, {
      layoutMode,
      scope,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/legacy-trend", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const tagname = typeof req.query.tagname === "string" ? req.query.tagname.trim() : "";
    if (!tagname) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Missing required tagname",
        requestId: `req-${Date.now()}`,
        details: {
          field: "tagname"
        }
      });
      return;
    }
    const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
    const unit = typeof req.query.unit === "string" ? req.query.unit.trim() : "";
    const rawDate = typeof req.query.date === "string" ? req.query.date.trim() : "";
    if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid date value: ${rawDate}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "date",
          expected: "YYYY-MM-DD"
        }
      });
      return;
    }
    const data = await getSceneLegacyTrend(siteConfig, siteId, {
      tagname,
      title,
      unit,
      date: rawDate || null,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/online-monitor", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const data = await getSceneOnlineMonitor(getRequestSiteConfig(req, config), siteId, {
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "12");
    const type = typeof req.query.type === "string" ? req.query.type : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const data = await getDeviceList(siteConfig, siteId, {
      page,
      pageSize,
      type,
      floor,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/tree", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const build = String(req.query.build || "1");
    const floor = String(req.query.floor || "1");
    const data = await getDeviceTree(siteConfig, siteId, {
      build,
      floor,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/:deviceId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const deviceId = String(req.params.deviceId || "");
    const build = String(req.query.build || "1");
    const floor = String(req.query.floor || "1");
    const data = await getDeviceDetail(siteConfig, siteId, deviceId, {
      build,
      floor,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/recommendations", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId);
    const overview = await getDashboardOverview(siteConfig, siteId, anomalies, requestContext);
    const data = await getRecommendations(siteConfig, siteId, overview, anomalies);
    res.json(data);
  });

  router.post("/sites/:siteId/optimize", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const validation = validateOptimizeDraftRequest(req.body || {});

    if (!validation.ok) {
      res.status(400).json({
        ok: false,
        code: validation.code,
        error: validation.error,
        requestId: `req-${Date.now()}`,
        details: validation.details
      });
      return;
    }

    const anomalies = await getAnomalySummary(siteConfig, siteId);
    const overview = await getDashboardOverview(
      siteConfig,
      siteId,
      anomalies,
      readRealtimeRequestContext(req)
    );
    const recommendations = await getRecommendations(siteConfig, siteId, overview, anomalies);
    const data = await buildOptimizeDraftResponse(siteConfig, siteId, validation.request, {
      overview,
      anomalies,
      recommendations
    });
    res.status(501).json({
      ok: false,
      code: "NOT_IMPLEMENTED",
      error: "Optimize engine is not implemented yet; returning a context-backed draft",
      requestId: `req-${Date.now()}`,
      details: data
    });
  });

  router.post("/sites/:siteId/assistant/query", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const startedAt = Date.now();
    const requestContext = readRealtimeRequestContext(req);
    const bodyContext = req.body && typeof req.body === "object" ? req.body.context : {};
    const rawLocale = typeof bodyContext?.locale === "string" ? bodyContext.locale : "zh-CN";
    const rawSurface = typeof bodyContext?.surface === "string" ? bodyContext.surface : "legacy-home-chat";
    const promptOrigin = normalizeAssistantPromptOrigin(bodyContext?.promptOrigin);

    logAssistantEvent("assistant.query.received", {
      siteId,
      locale: rawLocale,
      surface: rawSurface,
      promptOrigin,
      userId: requestContext.userId || null,
      projectKey: requestContext.projectKey || null
    });

    const validation = validateAssistantQueryRequest(req.body || {}, siteId);

    if (!validation.ok) {
      logAssistantEvent("assistant.query.bad_request", {
        siteId,
        locale: rawLocale,
        surface: rawSurface,
        promptOrigin,
        code: validation.code,
        error: validation.error,
        requestMs: Date.now() - startedAt
      });
      res.status(400).json({
        ok: false,
        code: validation.code,
        error: validation.error,
        requestId: `req-${Date.now()}`,
        details: validation.details
      });
      return;
    }

    const legacyBaseUrlOverride = readLegacyBaseUrlOverride(req);
    const siteConfig = getRequestSiteConfig(req, config);
    const effectiveConfig = legacyBaseUrlOverride
      ? {
          ...siteConfig,
          legacyBaseUrl: legacyBaseUrlOverride
        }
      : siteConfig;

    try {
      const data = await buildAssistantQueryResponse(
        effectiveConfig,
        siteId,
        validation.request,
        requestContext
      );
      logAssistantEvent("assistant.query.responded", {
        siteId,
        locale: validation.request.locale,
        surface: validation.request.surface,
        promptOrigin: validation.request.promptOrigin,
        kind: data?.answer?.kind || "unknown",
        knowledgeHit: data?.answer?.kind === "knowledge",
        freshnessLabel: data?.freshness?.label || "unknown",
        sourceOverall: data?.sourceStatus?.overall || "failed",
        stale: data?.freshness?.stale === true,
        nextStepsCount: Array.isArray(data?.answer?.nextSteps) ? data.answer.nextSteps.length : 0,
        requestMs: Date.now() - startedAt
      });
      res.json(data);
    } catch (error) {
      logAssistantEvent("assistant.query.upstream_failed", {
        siteId,
        locale: validation.request.locale,
        surface: validation.request.surface,
        promptOrigin: validation.request.promptOrigin,
        kind: "unknown",
        knowledgeHit: false,
        freshnessLabel: "unknown",
        sourceOverall: "failed",
        stale: false,
        nextStepsCount: 0,
        requestMs: Date.now() - startedAt,
        error: String(error?.message || error || "unknown error")
      });
      res.status(502).json({
        ok: false,
        code: "UPSTREAM_UNAVAILABLE",
        error: String(error?.message || error || "Assistant upstream unavailable"),
        requestId: `req-${Date.now()}`
      });
    }
  });

  return router;
}
