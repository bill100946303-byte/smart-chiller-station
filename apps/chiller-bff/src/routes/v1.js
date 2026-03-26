import { Router } from "express";
import { getAnomalyList, getAnomalySummary } from "../services/anomalyService.js";
import { getColdStationLog } from "../services/coldStationLogService.js";
import { getDashboardOverview, getDashboardTrends } from "../services/dashboardService.js";
import { getDeviceDetail, getDeviceList, getDeviceTree } from "../services/deviceService.js";
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

function readRealtimeRequestContext(req) {
  const userIdHeader = req.get("x-chiller-user-id");
  const projectKeyHeader = req.get("x-chiller-project-key");
  const templateHeader = req.get("x-chiller-project-template");
  return {
    userId: typeof userIdHeader === "string" ? userIdHeader.trim() : "",
    projectKey: typeof projectKeyHeader === "string" ? projectKeyHeader.trim() : "",
    template: typeof templateHeader === "string" ? templateHeader.trim() : ""
  };
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

export function buildV1Router(config) {
  const router = Router();
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

  router.get("/sites/:siteId/dashboard/overview", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const anomalies = await getAnomalySummary(config, siteId);
    const data = await getDashboardOverview(
      config,
      siteId,
      anomalies,
      readRealtimeRequestContext(req)
    );
    res.json(data);
  });

  router.get("/sites/:siteId/dashboard/trends", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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
    const data = await getDashboardTrends(config, siteId, range, readRealtimeRequestContext(req));
    res.json(data);
  });

  router.get("/sites/:siteId/cold-station-logs", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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
    const data = await getColdStationLog(config, siteId, date);
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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
    const data = await getOperationRecords(config, siteId, {
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
    const data = await getOperationRecordDeviceTypes(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records/devices", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId : "0";
    const data = await getOperationRecordDevices(config, siteId, drTypeId);
    res.json(data);
  });

  router.get("/sites/:siteId/energy-parameters", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getEnergyParameters(config, siteId);
    res.json(data);
  });

  router.put("/sites/:siteId/energy-parameters", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const payload = req.body || {};
    const result = await updateEnergyParameters(config, siteId, payload);

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
    const data = await getKnowledgeDocuments(config, siteId, { page, pageSize });
    res.json(data);
  });

  router.get("/sites/:siteId/knowledge/device-types", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getKnowledgeDeviceTypes(config, siteId);
    res.json(data);
  });

  router.post("/sites/:siteId/knowledge/documents", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const body = await readRequestBodyBuffer(req);
    const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
    const result = await createKnowledgeDocument(config, siteId, {
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
    const result = await updateKnowledgeDocument(config, siteId, {
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
    const result = await deleteKnowledgeDocument(config, siteId, documentId);

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
    const data = await getWorkOrders(config, siteId, {
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
    const data = await getWorkOrderAssignees(config, siteId);
    res.json(data);
  });

  router.post("/sites/:siteId/work-orders", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const result = await createWorkOrder(config, siteId, req.body || {});

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
    const result = await updateWorkOrder(config, siteId, payload);

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
    const result = await deleteWorkOrder(config, siteId, orderId);

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
    const file = await getWorkOrderExport(config, siteId);

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
    const data = await getEnvironmentBuildings(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/environment/conditions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const buildingId = typeof req.query.buildingId === "string" ? req.query.buildingId : "";
    const cooledAir = typeof req.query.cooledAir === "string" ? req.query.cooledAir : "";
    const monitoringSite = typeof req.query.monitoringSite === "string" ? req.query.monitoringSite : "";
    const data = await getEnvironmentConditions(config, siteId, {
      buildingId,
      cooledAir,
      monitoringSite
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis/tree", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getEnergyAnalysisTree(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyAnalysisReport(config, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate)),
      dateType,
      deviceIds
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/search", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencySearch(config, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate)),
      timeSpace,
      deviceKeys
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/calendar", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencyCalendar(config, siteId, { month });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/calendar/pie", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencyCalendarPie(config, siteId, { date, dateType });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/compare", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencyCompare(config, siteId, {
      deviceKey,
      dates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/proportion", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencyProportion(config, siteId, {
      date,
      dateType
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/imbalance", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getEnergyEfficiencyImbalance(config, siteId, {
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate))
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const data = await getMeterReadings(config, siteId, {
      startTime: normalizeDateTimeQuery(startTime, "start"),
      endTime: normalizeDateTimeQuery(endTime, "end")
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const file = await getMeterReadingExport(config, siteId, {
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

    const data = await getPerformanceReport(config, siteId, {
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

    const file = await getPerformanceReportExport(config, siteId, {
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

    const data = await getReportRecordRegOptions(config, siteId, { drTypeId, drId });
    res.json(data);
  });

  router.get("/sites/:siteId/report-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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
    const data = await getReportRecords(config, siteId, {
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

    const file = await getReportRecordExport(config, siteId, {
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
    const data = await getAnomalySummary(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/anomalies/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "20");
    const severity = typeof req.query.severity === "string" ? req.query.severity : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const data = await getAnomalyList(config, siteId, {
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
    const data = await getTopology(config, siteId, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/system/diagram", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const layoutMode = typeof req.query.layoutMode === "string" ? req.query.layoutMode : "auto";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "full";
    const data = await getSystemDiagram(config, siteId, {
      layoutMode,
      scope,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/legacy-trend", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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
    const data = await getSceneLegacyTrend(config, siteId, {
      tagname,
      title,
      unit,
      date: rawDate || null
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/online-monitor", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const data = await getSceneOnlineMonitor(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/devices/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "12");
    const type = typeof req.query.type === "string" ? req.query.type : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const data = await getDeviceList(config, siteId, {
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
    const requestContext = readRealtimeRequestContext(req);
    const build = String(req.query.build || "1");
    const floor = String(req.query.floor || "1");
    const data = await getDeviceTree(config, siteId, {
      build,
      floor,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/:deviceId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const deviceId = String(req.params.deviceId || "");
    const build = String(req.query.build || "1");
    const floor = String(req.query.floor || "1");
    const data = await getDeviceDetail(config, siteId, deviceId, {
      build,
      floor,
      projectKey: requestContext.projectKey
    });
    res.json(data);
  });

  router.get("/sites/:siteId/recommendations", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const anomalies = await getAnomalySummary(config, siteId);
    const overview = await getDashboardOverview(config, siteId, anomalies, requestContext);
    const data = await getRecommendations(config, siteId, overview, anomalies);
    res.json(data);
  });

  router.post("/sites/:siteId/optimize", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
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

    const anomalies = await getAnomalySummary(config, siteId);
    const overview = await getDashboardOverview(
      config,
      siteId,
      anomalies,
      readRealtimeRequestContext(req)
    );
    const recommendations = await getRecommendations(config, siteId, overview, anomalies);
    const data = buildOptimizeDraftResponse(config, siteId, validation.request, {
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

  return router;
}
