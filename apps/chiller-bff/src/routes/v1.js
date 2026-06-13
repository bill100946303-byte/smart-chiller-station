import { createHash } from "node:crypto";
import fs from "node:fs";
import { Router } from "express";
import { resolveSiteRuntimeConfig } from "../lib/site-runtime-config.js";
import { getAnomalyList, getAnomalySummary } from "../services/anomalyService.js";
import { getColdStationLog } from "../services/coldStationLogService.js";
import { getDashboardOverview, getDashboardTrends } from "../services/dashboardService.js";
import {
  getChillerStagingRuntimeContext,
  getDeviceDetail,
  getDeviceDetails,
  getDeviceList,
  getDeviceTree
} from "../services/deviceService.js";
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
  buildOptimizeExecutionFeedbackSnapshot,
  buildOptimizeDraftResponse,
  validateOptimizeDraftRequest
} from "../services/optimizeService.js";
import { buildSiteAiDigestResponse } from "../services/aiDigestService.js";
import {
  approveOptimizeExecution,
  createOptimizeExecution,
  dispatchOptimizeExecution,
  getOptimizeExecution,
  getOptimizeExecutionOverview,
  listOptimizeExecutions,
  rollbackOptimizeExecution,
  validateCreateOptimizeExecutionRequest
} from "../services/optimizeExecutionService.js";
import {
  dispatchPumpDeltaTExecution,
  dispatchTowerApproachExecution
} from "../services/optimizeExecutionDispatchService.js";
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
import {
  getSceneDeviceParameters,
  getSceneFloorModels,
  getSceneLegacyTrend,
  getSceneOnlineMonitor,
  submitSceneDeviceCommand
} from "../services/sceneControlService.js";
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

function ensureExecutionTypeMatches(res, execution, expectedType) {
  if (!execution) {
    res.status(404).json({
      ok: false,
      code: "NOT_FOUND",
      error: "Execution not found",
      requestId: `req-${Date.now()}`
    });
    return false;
  }
  if (execution?.execution?.type !== expectedType) {
    res.status(409).json({
      ok: false,
      code: "CONFLICT",
      error: `Execution is not a ${expectedType} execution`,
      requestId: `req-${Date.now()}`,
      details: {
        expectedType,
        actualType: execution?.execution?.type || null,
        executionId: execution?.executionId || null
      }
    });
    return false;
  }
  return true;
}

function readControlLedgerImportReport(siteConfig, siteId) {
  const normalizedSiteId = String(siteId || "").trim();
  const filePath = String(siteConfig?.controlLedgerImportReportFile || "").trim();
  if (!filePath || !["140", "btwentyfive"].includes(normalizedSiteId)) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return {
        status: "CONTROL_LEDGER_IMPORT_UNAVAILABLE",
        sourceFile: filePath,
        blockers: [`控制震荡台账导入报告不存在：${filePath}`],
        warnings: [],
        summary: {
          tableCount: 0,
          totalRows: 0,
          acceptedRows: 0,
          blockersCount: 1,
          warningsCount: 0
        },
        tables: []
      };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...parsed,
      sourceFile: filePath
    };
  } catch (error) {
    return {
      status: "CONTROL_LEDGER_IMPORT_BLOCKED",
      sourceFile: filePath,
      blockers: [`控制震荡台账导入报告读取失败：${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      summary: {
        tableCount: 0,
        totalRows: 0,
        acceptedRows: 0,
        blockersCount: 1,
        warningsCount: 0
      },
      tables: []
    };
  }
}

function readFieldDataPreflightReport(siteConfig, siteId) {
  const normalizedSiteId = String(siteId || "").trim();
  const filePath = String(siteConfig?.fieldDataPreflightReportFile || "").trim();
  if (!filePath || !["140", "btwentyfive"].includes(normalizedSiteId)) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return {
        finalDecision: "FIELD_DATA_PREFLIGHT_WAITING_FOR_INPUTS",
        sourceFile: filePath,
        blockers: [`现场 CSV 预检报告不存在：${filePath}`],
        warnings: [],
        inputs: [],
        import: {
          status: "CONTROL_LEDGER_IMPORT_BLOCKED",
          acceptedRows: 0,
          totalRows: 0,
          blockersCount: 1,
          warningsCount: 0
        }
      };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...parsed,
      sourceFile: filePath
    };
  } catch (error) {
    return {
      finalDecision: "FIELD_DATA_PREFLIGHT_BLOCKED",
      sourceFile: filePath,
      blockers: [`现场 CSV 预检报告读取失败：${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      inputs: [],
      import: {
        status: "CONTROL_LEDGER_IMPORT_BLOCKED",
        acceptedRows: 0,
        totalRows: 0,
        blockersCount: 1,
        warningsCount: 0
      }
    };
  }
}

function readFieldDataPromoteReport(siteConfig, siteId) {
  const normalizedSiteId = String(siteId || "").trim();
  const filePath = String(siteConfig?.fieldDataPromoteReportFile || "").trim();
  if (!filePath || !["140", "btwentyfive"].includes(normalizedSiteId)) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return {
        finalDecision: "FIELD_DATA_PROMOTE_WAITING_FOR_PREFLIGHT",
        sourceFile: filePath,
        blockers: [`现场 CSV 正式导入 gate 报告不存在：${filePath}`],
        warnings: [],
        import: {
          status: "CONTROL_LEDGER_IMPORT_NOT_RUN",
          acceptedRows: 0,
          totalRows: 0,
          blockersCount: 1,
          warningsCount: 0
        }
      };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...parsed,
      sourceFile: filePath
    };
  } catch (error) {
    return {
      finalDecision: "FIELD_DATA_PROMOTE_BLOCKED",
      sourceFile: filePath,
      blockers: [`现场 CSV 正式导入 gate 报告读取失败：${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      import: {
        status: "CONTROL_LEDGER_IMPORT_BLOCKED",
        acceptedRows: 0,
        totalRows: 0,
        blockersCount: 1,
        warningsCount: 0
      }
    };
  }
}

function readSensorLedgerPreflightReport(siteConfig, siteId) {
  const normalizedSiteId = String(siteId || "").trim();
  const filePath = String(siteConfig?.sensorLedgerPreflightReportFile || "").trim();
  if (!filePath || !["140", "btwentyfive"].includes(normalizedSiteId)) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return {
        finalDecision: "SENSOR_LEDGER_PREFLIGHT_WAITING_FOR_INPUTS",
        sourceFile: filePath,
        blockers: [`传感器校准/安装位置台账预检报告不存在：${filePath}`],
        warnings: [],
        inputs: [],
        summary: {
          totalRows: 0,
          acceptedRows: 0,
          blockersCount: 1,
          warningsCount: 0
        }
      };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...parsed,
      sourceFile: filePath
    };
  } catch (error) {
    return {
      finalDecision: "SENSOR_LEDGER_PREFLIGHT_BLOCKED",
      sourceFile: filePath,
      blockers: [`传感器校准/安装位置台账预检报告读取失败：${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      inputs: [],
      summary: {
        totalRows: 0,
        acceptedRows: 0,
        blockersCount: 1,
        warningsCount: 0
      }
    };
  }
}

function readFieldCollectionPackageReport(siteConfig, siteId) {
  const normalizedSiteId = String(siteId || "").trim();
  const filePath = String(siteConfig?.fieldCollectionPackageReportFile || "").trim();
  if (!filePath || !["140", "btwentyfive"].includes(normalizedSiteId)) {
    return null;
  }
  try {
    if (!fs.existsSync(filePath)) {
      return {
        finalDecision: "FIELD_COLLECTION_PACKAGE_BLOCKED",
        sourceFile: filePath,
        blockers: [`现场采集包 readiness 报告不存在：${filePath}`],
        warnings: [],
        formalInputs: [],
        templates: []
      };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ...parsed,
      sourceFile: filePath
    };
  } catch (error) {
    return {
      finalDecision: "FIELD_COLLECTION_PACKAGE_BLOCKED",
      sourceFile: filePath,
      blockers: [`现场采集包 readiness 报告读取失败：${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      formalInputs: [],
      templates: []
    };
  }
}

function isDispatchBlockingFailure(dispatchReceipt) {
  return dispatchReceipt?.mode === "enforced" && dispatchReceipt?.status === "failed";
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildShadowVerificationRecordCsv(records) {
  const header = [
    "recordId",
    "siteId",
    "executionId",
    "verificationType",
    "targetLabel",
    "outcome",
    "windowMinutes",
    "loadKw",
    "wetBulbC",
    "stationCop",
    "comboCop",
    "kwPerRt",
    "stationPowerKw",
    "chillerPowerKw",
    "alarmCount",
    "recordedAt",
    "createdAt",
    "recordedBy",
    "sourceRecordId",
    "controlMutation",
    "appendOnly",
    "note",
    "invalidReason"
  ];
  const rows = Array.isArray(records) ? records : [];
  const body = rows.map((record) => {
    const metrics = record?.metrics && typeof record.metrics === "object" ? record.metrics : {};
    const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
    return [
      record?.recordId,
      record?.siteId,
      record?.executionId,
      record?.verificationType,
      record?.targetLabel,
      record?.outcome,
      record?.windowMinutes,
      metrics.loadKw,
      metrics.wetBulbC,
      metrics.stationCop,
      metrics.comboCop,
      metrics.kwPerRt,
      metrics.stationPowerKw,
      metrics.chillerPowerKw,
      metrics.alarmCount,
      record?.recordedAt,
      record?.createdAt,
      record?.recordedBy,
      record?.sourceRecordId || payload.sourceRecordId,
      payload.controlMutation === false ? "false" : payload.controlMutation ?? "",
      payload.appendOnly === true ? "true" : payload.appendOnly ?? "",
      record?.note,
      record?.invalidReason
    ].map(escapeCsvCell).join(",");
  });
  return `\uFEFF${[header.join(","), ...body].join("\r\n")}\r\n`;
}

const SHADOW_REVIEW_ARCHIVE_BASIS = "append_only_shadow_review_report_v1";

function normalizeShadowReviewArchiveValue(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeShadowReviewArchiveValue(item));
  }
  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((normalized, key) => {
      normalized[key] = normalizeShadowReviewArchiveValue(value[key]);
      return normalized;
    }, {});
}

function sanitizeShadowReviewArchivePart(value, fallback) {
  const text = String(value || fallback || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return text || fallback;
}

function buildShadowReviewArchiveMetadata({ siteId, executionId, verificationType, list }) {
  const items = Array.isArray(list?.items) ? list.items : [];
  const records = items
    .map((record) => {
      const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
      return {
        recordId: record?.recordId || null,
        sourceRecordId: record?.sourceRecordId || payload.sourceRecordId || null,
        executionId: record?.executionId || null,
        verificationType: record?.verificationType || null,
        targetLabel: record?.targetLabel || null,
        outcome: record?.outcome || null,
        windowMinutes: record?.windowMinutes ?? null,
        metrics: record?.metrics && typeof record.metrics === "object" ? record.metrics : null,
        recordedAt: record?.recordedAt || null,
        createdAt: record?.createdAt || null,
        recordedBy: record?.recordedBy || null,
        note: record?.note || null,
        invalidReason: record?.invalidReason || null
      };
    })
    .sort((left, right) => {
      const leftKey = `${left.recordId || ""}|${left.recordedAt || ""}|${left.createdAt || ""}`;
      const rightKey = `${right.recordId || ""}|${right.recordedAt || ""}|${right.createdAt || ""}`;
      return leftKey.localeCompare(rightKey);
    });
  const normalizedPayload = normalizeShadowReviewArchiveValue({
    basis: SHADOW_REVIEW_ARCHIVE_BASIS,
    siteId,
    executionId,
    verificationType: verificationType || "all",
    records
  });
  const checksum = createHash("sha256").update(JSON.stringify(normalizedPayload)).digest("hex");
  const safeSiteId = sanitizeShadowReviewArchivePart(siteId, "site");
  const safeExecutionId = sanitizeShadowReviewArchivePart(executionId, "execution");
  return {
    reportId: `shr-${safeSiteId}-${safeExecutionId}-${checksum.slice(0, 12)}`,
    checksumAlgorithm: "sha256",
    checksum,
    checksumShort: checksum.slice(0, 16),
    canonicalBasis: SHADOW_REVIEW_ARCHIVE_BASIS,
    recordCount: records.length
  };
}

function buildShadowVerificationRecordSummary(list) {
  const items = Array.isArray(list?.items) ? list.items : [];
  const verificationTypeFilter = typeof list?.verificationType === "string" && list.verificationType.trim()
    ? list.verificationType.trim()
    : "all";
  const executionIdFilter = typeof list?.executionId === "string" && list.executionId.trim()
    ? list.executionId.trim()
    : "all";
  const buildCounts = (sourceItems) => {
    const counts = {
      pending: 0,
      improved: 0,
      neutral: 0,
      regressed: 0,
      invalid: 0
    };
    for (const item of sourceItems) {
      const outcome = typeof item?.outcome === "string" ? item.outcome.trim().toLowerCase() : "";
      if (Object.prototype.hasOwnProperty.call(counts, outcome)) {
        counts[outcome] += 1;
      }
    }
    const reviewedCount = counts.improved + counts.neutral + counts.regressed + counts.invalid;
    const comparableCount = counts.improved + counts.neutral + counts.regressed;
    return {
      ...counts,
      reviewedCount,
      comparableCount
    };
  };
  const summarizeType = (verificationType, sourceItems) => {
    const counts = buildCounts(sourceItems);
    return {
      verificationType,
      total: sourceItems.length,
      pendingCount: counts.pending,
      reviewedCount: counts.reviewedCount,
      comparableCount: counts.comparableCount,
      improvedCount: counts.improved,
      neutralCount: counts.neutral,
      regressedCount: counts.regressed,
      invalidCount: counts.invalid
    };
  };
  const groups = new Map();
  for (const item of items) {
    const verificationType =
      typeof item?.verificationType === "string" && item.verificationType.trim()
        ? item.verificationType.trim()
        : "unknown";
    const group = groups.get(verificationType) || [];
    group.push(item);
    groups.set(verificationType, group);
  }
  const byVerificationType = Array.from(groups.entries())
    .map(([verificationType, groupItems]) => summarizeType(verificationType, groupItems))
    .sort((left, right) => left.verificationType.localeCompare(right.verificationType));
  const counts = buildCounts(items);
  const latestReviewed = items.find((item) => item?.outcome && item.outcome !== "pending") || null;
  const reviewedCount = counts.reviewedCount;
  const comparableCount = counts.comparableCount;
  const archive =
    executionIdFilter !== "all"
      ? buildShadowReviewArchiveMetadata({
          siteId: list?.siteId || "site",
          executionId: executionIdFilter,
          verificationType: verificationTypeFilter === "all" ? "" : verificationTypeFilter,
          list: {
            items
          }
        })
      : null;
  return {
    basis: "listed_append_only_shadow_verification_records",
    verificationType: verificationTypeFilter,
    executionId: executionIdFilter,
    total: typeof list?.total === "number" ? list.total : items.length,
    sampledCount: items.length,
    pendingCount: counts.pending,
    reviewedCount,
    comparableCount,
    improvedCount: counts.improved,
    neutralCount: counts.neutral,
    regressedCount: counts.regressed,
    invalidCount: counts.invalid,
    latestOutcome: latestReviewed?.outcome || null,
    latestReviewedAt: latestReviewed?.recordedAt || null,
    byVerificationType,
    archive,
    controlMutation: false,
    executionMutation: false,
    acceptanceBoundary: "shadow_verification_summary_only_not_savings_commitment"
  };
}

function escapeMarkdownCell(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim() || "-";
}

function escapeHtml(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMarkdownNumber(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(digits).replace(/\.0+$/, "");
}

function buildShadowVerificationReviewReport({ siteId, executionId, verificationType, list, generatedAt }) {
  const items = Array.isArray(list?.items) ? list.items : [];
  const summary = buildShadowVerificationRecordSummary({
    ...list,
    executionId,
    verificationType
  });
  const archive = summary.archive || buildShadowReviewArchiveMetadata({
    siteId,
    executionId,
    verificationType,
    list
  });
  const latestReviewed = items.find((item) => item?.outcome && item.outcome !== "pending") || null;
  const latestRecord = latestReviewed || items[0] || null;
  const typeSet = Array.from(
    new Set(
      items
        .map((item) => (typeof item?.verificationType === "string" && item.verificationType.trim() ? item.verificationType.trim() : "unknown"))
        .filter(Boolean)
    )
  );
  const reviewStatus = latestReviewed?.outcome || (items.length ? "pending" : "no_records");
  const metricRows = [
    ["站点", siteId],
    ["executionId", executionId],
    ["报告 ID", archive.reportId],
    ["校验码", `SHA256:${archive.checksumShort}`],
    ["Advisor 类型", typeSet.length ? typeSet.join(" / ") : verificationType || "all"],
    ["复盘状态", reviewStatus],
    ["记录数", `${summary.sampledCount || 0}`],
    ["已复核 / 待观察", `${summary.reviewedCount || 0} / ${summary.pendingCount || 0}`],
    ["改善 / 持平 / 退化 / 无效", `${summary.improvedCount || 0} / ${summary.neutralCount || 0} / ${summary.regressedCount || 0} / ${summary.invalidCount || 0}`],
    ["最新复核时间", summary.latestReviewedAt || "-"],
    ["最新目标", latestRecord?.targetLabel || "-"],
    ["冷站 COP", formatMarkdownNumber(latestRecord?.metrics?.stationCop, 2)],
    ["组合 COP", formatMarkdownNumber(latestRecord?.metrics?.comboCop, 2)],
    ["kW/RT", formatMarkdownNumber(latestRecord?.metrics?.kwPerRt, 3)],
    ["负荷 kW / 湿球 ℃", `${formatMarkdownNumber(latestRecord?.metrics?.loadKw, 0)} / ${formatMarkdownNumber(latestRecord?.metrics?.wetBulbC, 1)}`],
    ["控制副作用", summary.controlMutation === false ? "none" : "review_required"],
    ["执行单副作用", summary.executionMutation === false ? "none" : "review_required"]
  ];
  const recordLines = items.map((record) => {
    const metrics = record?.metrics && typeof record.metrics === "object" ? record.metrics : {};
    const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
    return [
      record?.recordedAt || record?.createdAt || "-",
      record?.outcome || "-",
      record?.verificationType || "-",
      record?.targetLabel || "-",
      formatMarkdownNumber(metrics.loadKw, 0),
      formatMarkdownNumber(metrics.wetBulbC, 1),
      formatMarkdownNumber(metrics.stationCop, 2),
      formatMarkdownNumber(metrics.comboCop, 2),
      formatMarkdownNumber(metrics.kwPerRt, 3),
      formatMarkdownNumber(metrics.stationPowerKw, 1),
      formatMarkdownNumber(metrics.chillerPowerKw, 1),
      formatMarkdownNumber(metrics.alarmCount, 0),
      record?.sourceRecordId || payload.sourceRecordId || "-",
      record?.note || "-"
    ].map(escapeMarkdownCell).join(" | ");
  });

  return [
    "# Shadow 复盘报告",
    "",
    "<style>",
    "@media print {",
    "  @page { size: A4 portrait; margin: 14mm; }",
    "  body { color: #111827; font-size: 11pt; line-height: 1.45; }",
    "  h1, h2 { page-break-after: avoid; }",
    "  table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }",
    "  th, td { border: 1px solid #9ca3af; padding: 4px 6px; vertical-align: top; }",
    "  .print-signature-table td { height: 28mm; }",
    "}",
    "</style>",
    "",
    `- 生成时间：${generatedAt}`,
    `- 站点：${siteId}`,
    `- executionId：${executionId}`,
    `- 报告 ID：${archive.reportId}`,
    `- 校验码：SHA256:${archive.checksum}`,
    `- 校验口径：${archive.canonicalBasis}；仅用于核对本次导出内容，不代表电子签名或归档写入。`,
    `- 数据口径：append-only shadow 验证记录`,
    `- 控制边界：只读复盘；不审批、不 dispatch、不 rollback、不写真实 PLC。`,
    `- 结算边界：不作为固定节能承诺，不作为节能结算依据。`,
    "",
    "## 复盘摘要",
    "",
    "| 项 | 值 |",
    "| --- | --- |",
    ...metricRows.map(([label, value]) => `| ${escapeMarkdownCell(label)} | ${escapeMarkdownCell(value)} |`),
    "",
    "## 记录明细",
    "",
    "| 时间 | 结果 | Advisor | 对象 | 负荷kW | 湿球℃ | 冷站COP | 组合COP | kW/RT | 冷站功率kW | 主机功率kW | 告警数 | sourceRecordId | 备注 |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...(recordLines.length ? recordLines.map((line) => `| ${line} |`) : ["| - | no_records | - | - | - | - | - | - | - | - | - | - | - | - |"]),
    "",
    "## 验收边界",
    "",
    "- 本报告只汇总人工保存和补录的 append-only shadow 记录。",
    "- 报告 ID 和校验码只用于核对导出件与页面单次复盘摘要是否一致。",
    "- 本报告不修改原始记录，不改变执行单状态。",
    "- 本报告不代表真实 PLC 下发、自动启停或 enforced 闭环已启用。",
    "- 多机并联且无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆分单台主机 COP。",
    "",
    "## 打印说明",
    "",
    "- 打印样式：A4 竖版，表格紧凑排版，签字区保留手写空间。",
    "- 打印前应确认 executionId、观察窗口、复核结果和告警数与现场记录一致。",
    "- 打印件仅作为 shadow 复盘附件，不代表批准真实 PLC 下发或自动控制。",
    "",
    "## 甲方/值班员签字确认区",
    "",
    "| 角色 | 姓名 | 签字 | 日期 | 备注 |",
    "| --- | --- | --- | --- | --- |",
    "| 甲方代表 |  |  |  | 仅确认记录完整性 |",
    "| 运行值班员 |  |  |  | 确认观察窗口内无异常人工干预 |",
    "| 节能工程师 |  |  |  | 确认复盘口径和数据边界 |",
    "| 项目负责人 |  |  |  | 确认是否进入下一轮 shadow |",
    "",
    "<table class=\"print-signature-table\"><tbody><tr><td>甲方代表签字：</td><td>运行值班员签字：</td></tr><tr><td>节能工程师签字：</td><td>项目负责人签字：</td></tr></tbody></table>",
    "",
    "> 签字仅确认本次 shadow 复盘记录完整，不代表批准 PLC 下发、自动启停、enforced 闭环或节能结算。",
    ""
  ].join("\n");
}

function buildShadowVerificationReviewPrintHtml({ siteId, executionId, verificationType, list, generatedAt }) {
  const items = Array.isArray(list?.items) ? list.items : [];
  const summary = buildShadowVerificationRecordSummary({
    ...list,
    executionId,
    verificationType
  });
  const archive = summary.archive || buildShadowReviewArchiveMetadata({
    siteId,
    executionId,
    verificationType,
    list
  });
  const latestReviewed = items.find((item) => item?.outcome && item.outcome !== "pending") || null;
  const latestRecord = latestReviewed || items[0] || null;
  const typeSet = Array.from(
    new Set(
      items
        .map((item) => (typeof item?.verificationType === "string" && item.verificationType.trim() ? item.verificationType.trim() : "unknown"))
        .filter(Boolean)
    )
  );
  const reviewStatus = latestReviewed?.outcome || (items.length ? "pending" : "no_records");
  const metricRows = [
    ["站点", siteId],
    ["executionId", executionId],
    ["报告 ID", archive.reportId],
    ["校验码", `SHA256:${archive.checksumShort}`],
    ["Advisor 类型", typeSet.length ? typeSet.join(" / ") : verificationType || "all"],
    ["复盘状态", reviewStatus],
    ["记录数", `${summary.sampledCount || 0}`],
    ["已复核 / 待观察", `${summary.reviewedCount || 0} / ${summary.pendingCount || 0}`],
    ["改善 / 持平 / 退化 / 无效", `${summary.improvedCount || 0} / ${summary.neutralCount || 0} / ${summary.regressedCount || 0} / ${summary.invalidCount || 0}`],
    ["最新复核时间", summary.latestReviewedAt || "-"],
    ["最新目标", latestRecord?.targetLabel || "-"],
    ["冷站 COP", formatMarkdownNumber(latestRecord?.metrics?.stationCop, 2)],
    ["组合 COP", formatMarkdownNumber(latestRecord?.metrics?.comboCop, 2)],
    ["kW/RT", formatMarkdownNumber(latestRecord?.metrics?.kwPerRt, 3)],
    ["负荷 kW / 湿球 ℃", `${formatMarkdownNumber(latestRecord?.metrics?.loadKw, 0)} / ${formatMarkdownNumber(latestRecord?.metrics?.wetBulbC, 1)}`],
    ["控制副作用", summary.controlMutation === false ? "none" : "review_required"],
    ["执行单副作用", summary.executionMutation === false ? "none" : "review_required"]
  ];
  const recordRows = items.map((record) => {
    const metrics = record?.metrics && typeof record.metrics === "object" ? record.metrics : {};
    const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
    return [
      record?.recordedAt || record?.createdAt || "-",
      record?.outcome || "-",
      record?.verificationType || "-",
      record?.targetLabel || "-",
      formatMarkdownNumber(metrics.loadKw, 0),
      formatMarkdownNumber(metrics.wetBulbC, 1),
      formatMarkdownNumber(metrics.stationCop, 2),
      formatMarkdownNumber(metrics.comboCop, 2),
      formatMarkdownNumber(metrics.kwPerRt, 3),
      formatMarkdownNumber(metrics.stationPowerKw, 1),
      formatMarkdownNumber(metrics.chillerPowerKw, 1),
      formatMarkdownNumber(metrics.alarmCount, 0),
      record?.sourceRecordId || payload.sourceRecordId || "-",
      record?.note || "-"
    ];
  });
  const metricHtml = metricRows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  const recordHtml = recordRows.length
    ? recordRows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")
    : "<tr><td colspan=\"14\">no_records</td></tr>";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Shadow 复盘报告 ${escapeHtml(executionId)}</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f3f4f6; color: #111827; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px; background: #fff; min-height: 100vh; }
    h1, h2 { margin: 0 0 12px; }
    h1 { font-size: 24px; }
    h2 { font-size: 16px; margin-top: 22px; }
    .meta, .boundary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 12px 0; }
    .meta span, .boundary span { border: 1px solid #d1d5db; padding: 8px; }
    .checksum { overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .actions { display: flex; gap: 8px; margin: 16px 0; }
    button { border: 1px solid #0f766e; background: #0f766e; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; }
    .records { font-size: 11px; }
    .signature-table td { height: 72px; }
    .note { color: #374151; font-size: 12px; }
    @media print {
      @page { size: A4 portrait; margin: 14mm; }
      body { background: white; font-size: 11pt; line-height: 1.45; }
      main { max-width: none; padding: 0; min-height: auto; }
      .no-print { display: none !important; }
      h1, h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
      th, td { border-color: #9ca3af; }
      .signature-table td { height: 28mm; }
    }
  </style>
</head>
<body>
  <main>
    <div class="actions no-print">
      <button type="button" onclick="window.print()">打印 / 另存 PDF</button>
    </div>
    <h1>Shadow 复盘报告</h1>
    <section class="meta">
      <span><strong>生成时间</strong><br>${escapeHtml(generatedAt)}</span>
      <span><strong>站点</strong><br>${escapeHtml(siteId)}</span>
      <span><strong>executionId</strong><br>${escapeHtml(executionId)}</span>
      <span><strong>报告 ID</strong><br>${escapeHtml(archive.reportId)}</span>
      <span><strong>校验码</strong><br><span class="checksum">SHA256:${escapeHtml(archive.checksum)}</span></span>
      <span><strong>校验口径</strong><br>${escapeHtml(archive.canonicalBasis)}</span>
      <span><strong>数据口径</strong><br>append-only shadow 验证记录</span>
    </section>
    <section class="boundary">
      <span><strong>控制边界</strong><br>只读复盘；不审批、不 dispatch、不 rollback、不写真实 PLC。</span>
      <span><strong>结算边界</strong><br>不作为固定节能承诺，不作为节能结算依据。</span>
    </section>
    <h2>复盘摘要</h2>
    <table><tbody>${metricHtml}</tbody></table>
    <h2>记录明细</h2>
    <table class="records">
      <thead>
        <tr><th>时间</th><th>结果</th><th>Advisor</th><th>对象</th><th>负荷kW</th><th>湿球℃</th><th>冷站COP</th><th>组合COP</th><th>kW/RT</th><th>冷站功率kW</th><th>主机功率kW</th><th>告警数</th><th>sourceRecordId</th><th>备注</th></tr>
      </thead>
      <tbody>${recordHtml}</tbody>
    </table>
    <h2>验收边界</h2>
    <ul>
      <li>本报告只汇总人工保存和补录的 append-only shadow 记录。</li>
      <li>报告 ID 和校验码只用于核对导出件与页面单次复盘摘要是否一致，不代表电子签名或归档写入。</li>
      <li>本报告不修改原始记录，不改变执行单状态。</li>
      <li>本报告不代表真实 PLC 下发、自动启停或 enforced 闭环已启用。</li>
      <li>多机并联且无单台冷冻水流量时，只评价组合 COP / 冷站 COP，不拆分单台主机 COP。</li>
    </ul>
    <h2>打印说明</h2>
    <ul>
      <li>打印样式：A4 竖版，表格紧凑排版，签字区保留手写空间。</li>
      <li>打印前应确认 executionId、观察窗口、复核结果和告警数与现场记录一致。</li>
      <li>打印件仅作为 shadow 复盘附件，不代表批准真实 PLC 下发或自动控制。</li>
    </ul>
    <h2>甲方/值班员签字确认区</h2>
    <table class="signature-table">
      <thead><tr><th>角色</th><th>姓名</th><th>签字</th><th>日期</th><th>备注</th></tr></thead>
      <tbody>
        <tr><td>甲方代表</td><td></td><td></td><td></td><td>仅确认记录完整性</td></tr>
        <tr><td>运行值班员</td><td></td><td></td><td></td><td>确认观察窗口内无异常人工干预</td></tr>
        <tr><td>节能工程师</td><td></td><td></td><td></td><td>确认复盘口径和数据边界</td></tr>
        <tr><td>项目负责人</td><td></td><td></td><td></td><td>确认是否进入下一轮 shadow</td></tr>
      </tbody>
    </table>
    <p class="note">签字仅确认本次 shadow 复盘记录完整，不代表批准 PLC 下发、自动启停、enforced 闭环或节能结算。</p>
  </main>
</body>
</html>`;
}

function normalizeChillerSampleText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeChillerSampleCombination(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[+,/，、\s]+/)
      : [];
  const seen = new Set();
  const items = [];
  for (const rawItem of source) {
    const item = normalizeChillerSampleText(rawItem);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    items.push(item);
  }
  return items.slice(0, 12);
}

function buildChillerSampleCombinationKey(value) {
  return normalizeChillerSampleCombination(value)
    .map((item) => item.toUpperCase())
    .sort((left, right) => left.localeCompare(right))
    .join("+");
}

function readPersistedChillerStagingSamples(adminStore, siteId) {
  if (!adminStore?.listChillerStagingSamples) {
    return [];
  }
  const list = adminStore.listChillerStagingSamples(siteId, {
    limit: 1000
  });
  return Array.isArray(list?.items)
    ? list.items
        .map((item) => item?.sample)
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .reverse()
    : [];
}

function minutesSince(timestamp, now = new Date()) {
  const parsed = Date.parse(String(timestamp || ""));
  if (!Number.isFinite(parsed)) {
    return Number.POSITIVE_INFINITY;
  }
  return (now.getTime() - parsed) / 60000;
}

function maybeCaptureChillerStagingSample({ adminStore, siteId, advisor, actorUserId, requestId }) {
  const liveSample = advisor?.evidence?.currentLiveSample || advisor?.sampleEvidence?.currentLiveSample;
  if (!adminStore?.createChillerStagingSample || !adminStore?.getLatestChillerStagingSample) {
    return {
      status: "skipped",
      reason: "样本库未启用。"
    };
  }
  if (!liveSample || liveSample.status !== "recordable") {
    return {
      status: "skipped",
      reason: "当前实时快照不可形成有效主机组合样本。"
    };
  }
  const combinationKey = buildChillerSampleCombinationKey(liveSample.combination);
  if (!combinationKey) {
    return {
      status: "skipped",
      reason: "当前样本缺运行组合。"
    };
  }
  const minIntervalMinutes =
    typeof liveSample.sampleMinutes === "number" && Number.isFinite(liveSample.sampleMinutes) && liveSample.sampleMinutes > 0
      ? liveSample.sampleMinutes
      : 5;
  try {
    const latest = adminStore.getLatestChillerStagingSample(siteId, {
      combinationKey
    });
    const elapsedMinutes = latest ? minutesSince(latest.capturedAt) : Number.POSITIVE_INFINITY;
    if (elapsedMinutes < minIntervalMinutes) {
      return {
        status: "skipped_recent",
        reason: `距离上一条 ${combinationKey} 样本不足 ${minIntervalMinutes} 分钟，跳过重复入库。`,
        combinationKey,
        latestSampleId: latest?.sampleId || null,
        latestSampleAt: latest?.capturedAt || null,
        minIntervalMinutes
      };
    }
    const created = adminStore.createChillerStagingSample(
      siteId,
      {
        ...liveSample,
        includedInHistory: true
      },
      {
        userId: actorUserId
      },
      {
        requestId,
        audit: false
      }
    );
    return {
      status: "recorded",
      reason: "当前实时快照已按 append-only 样本入库；本次草案仍使用入库前历史样本计算。",
      combinationKey,
      sampleId: created?.sampleId || null,
      capturedAt: created?.capturedAt || null,
      minIntervalMinutes
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "主机组合样本入库失败。",
      combinationKey,
      minIntervalMinutes
    };
  }
}

async function dispatchOptimizeExecutionByType({
  execution,
  siteConfig,
  siteId,
  operation,
  actorUserId,
  requestId
}) {
  if (execution?.execution?.type === "tower-approach") {
    return dispatchTowerApproachExecution({
      siteConfig,
      siteId,
      execution,
      operation,
      actorUserId,
      requestId
    });
  }
  if (execution?.execution?.type === "pump-delta-t") {
    return dispatchPumpDeltaTExecution({
      siteConfig,
      siteId,
      execution,
      operation,
      actorUserId,
      requestId
    });
  }
  return null;
}

async function captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, requestContext, phase) {
  try {
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
    const overview = await getDashboardOverview(siteConfig, siteId, anomalies, requestContext);
    return buildOptimizeExecutionFeedbackSnapshot(overview, anomalies, { phase });
  } catch (_error) {
    return null;
  }
}

function getRequestSiteConfig(req, baseConfig) {
  const runtimeConfig = req.siteRuntimeConfig || baseConfig;
  const requestContext = readRealtimeRequestContext(req);
  const adminStore = req?.app?.locals?.adminStore;
  const runtimeSourceConfig =
    runtimeConfig?.siteSourceConfig && typeof runtimeConfig.siteSourceConfig === "object"
      ? runtimeConfig.siteSourceConfig
      : {};
  const effectiveDatabaseKey = normalizeLegacyProjectKey(
    requestContext?.databaseKey
    || runtimeSourceConfig?.databaseKey
    || runtimeSourceConfig?.deviceDataProjectKey
  );
  const effectiveProjectKey = normalizeLegacyProjectKey(
    requestContext?.projectKey
    || runtimeSourceConfig?.modelKey
    || runtimeSourceConfig?.preferredProjectKey
  );
  const mergedSiteSourceConfig = {
    ...runtimeSourceConfig,
    ...(effectiveDatabaseKey
      ? {
          databaseKey: effectiveDatabaseKey,
          deviceDataProjectKey: effectiveDatabaseKey
        }
      : {}),
    ...(effectiveProjectKey
      ? {
          modelKey: effectiveProjectKey,
          preferredProjectKey: effectiveProjectKey
        }
      : {}),
    ...(requestContext?.siteId ? { legacyAppId: requestContext.siteId } : {})
  };
  return {
    ...runtimeConfig,
    siteSourceConfig: mergedSiteSourceConfig,
    legacyBaseUrl: baseConfig.legacyBaseUrl,
    adminStore: runtimeConfig?.adminStore || baseConfig?.adminStore || adminStore
  };
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

function normalizeLegacyLanguage(value, fallback = "zh") {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "zh" || normalized === "zh-cn" || normalized === "cn") {
    return "zh";
  }
  if (normalized === "en" || normalized === "en-us") {
    return "en";
  }
  if (normalized === "vie" || normalized === "vi" || normalized === "vi-vn") {
    return "vie";
  }
  return fallback;
}

function resolveLegacyCloudRequestOptions(siteConfig, requestContext, rawOptions = {}) {
  const language = typeof rawOptions.language === "string" ? rawOptions.language.trim() : "";
  const unit = typeof rawOptions.unit === "string" ? rawOptions.unit.trim() : "";
  const modelKey = typeof rawOptions.modelKey === "string" ? rawOptions.modelKey.trim() : "";
  const template = typeof rawOptions.template === "string" ? rawOptions.template.trim() : "";
  return {
    language: normalizeLegacyLanguage(language, "zh"),
    unit: unit || "KW",
    modelKey: modelKey || requestContext?.projectKey || siteConfig?.siteSourceConfig?.modelKey || "",
    template: template || requestContext?.template || siteConfig?.siteSourceConfig?.template || "1"
  };
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

function hasOptimizeExecutionWritePermission(adminStore, userId, siteId) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  const normalizedSiteId = typeof siteId === "string" ? siteId.trim() : "";
  if (!adminStore?.getAdminContext || !normalizedUserId || !normalizedSiteId) {
    return false;
  }
  const context = adminStore.getAdminContext(normalizedUserId);
  if (context?.platformRole === "platform_admin") {
    return true;
  }
  return Array.isArray(context?.siteRoles)
    && context.siteRoles.some((item) => item.scopeId === normalizedSiteId && item.role === "site_admin");
}

function normalizeLegacyProjectKey(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : "";
}

function dedupeProjectKeys(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeProjectAliasToken(value) {
  return normalizeLegacyProjectKey(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isB25ProjectAlias(value, routeSiteId, runtimeKeys = []) {
  const normalized = normalizeProjectAliasToken(value);
  if (!normalized) {
    return false;
  }
  const normalizedRouteSiteId = normalizeProjectAliasToken(routeSiteId);
  const hasB25RuntimeKey = runtimeKeys.some((item) => normalizeProjectAliasToken(item) === "140btwentyfive");
  if (!hasB25RuntimeKey || normalizedRouteSiteId !== "140") {
    return false;
  }
  return new Set(["140", "b25", "140b25", "btwentyfive", "140btwentyfive"]).has(normalized);
}

function isRuntimeProjectAlias(value, routeSiteId, runtimeKeys = []) {
  const normalized = normalizeProjectAliasToken(value);
  if (!normalized) {
    return false;
  }
  return runtimeKeys.some((item) => normalizeProjectAliasToken(item) === normalized)
    || isB25ProjectAlias(value, routeSiteId, runtimeKeys);
}

function readRuntimeDashboardProjectKeys(req) {
  const runtimeSourceConfig =
    req?.siteRuntimeConfig && typeof req.siteRuntimeConfig === "object"
      ? req.siteRuntimeConfig.siteSourceConfig
      : null;
  return dedupeProjectKeys([
    normalizeLegacyProjectKey(runtimeSourceConfig?.databaseKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.deviceDataProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.preferredProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.modelKey)
  ]);
}

function readRuntimeProjectDataKeys(req) {
  const runtimeSourceConfig =
    req?.siteRuntimeConfig && typeof req.siteRuntimeConfig === "object"
      ? req.siteRuntimeConfig.siteSourceConfig
      : null;
  return dedupeProjectKeys([
    normalizeLegacyProjectKey(runtimeSourceConfig?.deviceDataProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.databaseKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.preferredProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.modelKey)
  ]);
}

function readRuntimeDatabaseProjectKeys(req) {
  const runtimeSourceConfig =
    req?.siteRuntimeConfig && typeof req.siteRuntimeConfig === "object"
      ? req.siteRuntimeConfig.siteSourceConfig
      : null;
  return dedupeProjectKeys([
    normalizeLegacyProjectKey(runtimeSourceConfig?.databaseKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.deviceDataProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.preferredProjectKey),
    normalizeLegacyProjectKey(runtimeSourceConfig?.modelKey)
  ]);
}

function readRuntimeDashboardTemplate(req) {
  const runtimeSourceConfig =
    req?.siteRuntimeConfig && typeof req.siteRuntimeConfig === "object"
      ? req.siteRuntimeConfig.siteSourceConfig
      : null;
  return typeof runtimeSourceConfig?.template === "string" ? runtimeSourceConfig.template.trim() : "";
}

export function readDeviceIdsQuery(req) {
  const rawIds = req?.query?.ids;
  const values = Array.isArray(rawIds) ? rawIds : [rawIds];
  return Array.from(
    new Set(
      values
        .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export function readRealtimeRequestContext(req) {
  const userIdHeader = req.get("x-chiller-user-id");
  const siteIdHeader = req.get("x-chiller-site-id");
  const siteCodeHeader = req.get("x-chiller-site-code");
  const projectDatabaseKeyHeader = req.get("x-chiller-project-database-key");
  const projectKeyHeader = req.get("x-chiller-project-key");
  const templateHeader = req.get("x-chiller-project-template");
  const bodyContext = req.body && typeof req.body === "object" ? req.body.context : null;
  const routeSiteId =
    typeof req?.params?.siteId === "string" && req.params.siteId.trim() ? req.params.siteId.trim() : "";
  const bodyUserId =
    bodyContext && typeof bodyContext.userId === "string" ? bodyContext.userId.trim() : "";
  const bodyProjectKey = normalizeLegacyProjectKey(
    bodyContext && typeof bodyContext.projectKey === "string" ? bodyContext.projectKey : ""
  );
  const bodySiteId = normalizeLegacyProjectKey(
    bodyContext && typeof bodyContext.siteId === "string" ? bodyContext.siteId : ""
  );
  const bodySiteCode = normalizeLegacyProjectKey(
    bodyContext && typeof bodyContext.siteCode === "string" ? bodyContext.siteCode : ""
  );
  const bodyDatabaseKey = normalizeLegacyProjectKey(
    bodyContext && typeof bodyContext.databaseKey === "string" ? bodyContext.databaseKey : ""
  );
  const bodyTemplate =
    bodyContext && typeof bodyContext.template === "string" ? bodyContext.template.trim() : "";
  const normalizedHeaderProjectKey = normalizeLegacyProjectKey(projectKeyHeader);
  const normalizedHeaderSiteId = normalizeLegacyProjectKey(siteIdHeader);
  const normalizedHeaderSiteCode = normalizeLegacyProjectKey(siteCodeHeader);
  const normalizedHeaderDatabaseKey = normalizeLegacyProjectKey(projectDatabaseKeyHeader);
  const normalizedRouteSiteId = normalizeLegacyProjectKey(routeSiteId);
  const composedHeaderDatabaseKey = normalizeLegacyProjectKey(
    normalizedHeaderSiteId && normalizedHeaderSiteCode
      ? `${normalizedHeaderSiteId}${normalizedHeaderSiteCode}`
      : ""
  );
  const composedBodyDatabaseKey = normalizeLegacyProjectKey(
    bodySiteId && bodySiteCode
      ? `${bodySiteId}${bodySiteCode}`
      : ""
  );
  const selectedProjectKey =
    normalizedHeaderProjectKey || bodyProjectKey || normalizedRouteSiteId;
  const selectedDatabaseKey =
    normalizedHeaderDatabaseKey ||
    bodyDatabaseKey ||
    composedHeaderDatabaseKey ||
    composedBodyDatabaseKey;
  const projectKeyCandidates = dedupeProjectKeys([
    selectedProjectKey,
    normalizedHeaderProjectKey,
    bodyProjectKey,
    normalizedRouteSiteId
  ]);
  const databaseKeyCandidates = dedupeProjectKeys([
    selectedDatabaseKey,
    normalizedHeaderDatabaseKey,
    bodyDatabaseKey,
    composedHeaderDatabaseKey,
    composedBodyDatabaseKey,
    normalizedRouteSiteId
  ]);
  return {
    userId: typeof userIdHeader === "string" && userIdHeader.trim() ? userIdHeader.trim() : bodyUserId,
    siteId: normalizedHeaderSiteId || bodySiteId || normalizedRouteSiteId,
    siteCode: normalizedHeaderSiteCode || bodySiteCode,
    databaseKey: selectedDatabaseKey,
    databaseKeyCandidates,
    projectKey: selectedProjectKey,
    projectKeyCandidates,
    template:
      typeof templateHeader === "string" && templateHeader.trim()
        ? templateHeader.trim()
        : bodyTemplate
  };
}

export function readProjectDataRequestContext(req) {
  const baseContext = readRealtimeRequestContext(req);
  const explicitHeaderDatabaseKey = normalizeLegacyProjectKey(req.get("x-chiller-project-database-key"));
  const bodyContext = req.body && typeof req.body === "object" ? req.body.context : null;
  const explicitBodyDatabaseKey = normalizeLegacyProjectKey(
    bodyContext && typeof bodyContext.databaseKey === "string" ? bodyContext.databaseKey : ""
  );
  const hasExplicitDatabaseKey = Boolean(explicitHeaderDatabaseKey || explicitBodyDatabaseKey);
  const routeSiteId =
    typeof req?.params?.siteId === "string" && req.params.siteId.trim() ? req.params.siteId.trim() : "";
  const normalizedRouteSiteId = normalizeLegacyProjectKey(routeSiteId);
  const runtimeDatabaseKeys = readRuntimeDatabaseProjectKeys(req);
  const runtimeDatabaseKeySet = new Set(runtimeDatabaseKeys);
  const runtimeProjectKeys = readRuntimeProjectDataKeys(req);
  const runtimeProjectKeySet = new Set(runtimeProjectKeys);
  const databaseKeyIsRuntimeAlias = isRuntimeProjectAlias(baseContext.databaseKey, normalizedRouteSiteId, runtimeDatabaseKeys);
  const projectKeyIsRuntimeAlias = isRuntimeProjectAlias(baseContext.projectKey, normalizedRouteSiteId, runtimeProjectKeys);
  const hasExplicitCustomDatabaseKey = hasExplicitDatabaseKey && !databaseKeyIsRuntimeAlias;
  const shouldPreferRuntimeDatabaseKey =
    !hasExplicitCustomDatabaseKey &&
    runtimeDatabaseKeys.length > 0 &&
    (
      !baseContext.databaseKey ||
      baseContext.databaseKey === normalizedRouteSiteId ||
      runtimeDatabaseKeySet.has(baseContext.databaseKey) ||
      databaseKeyIsRuntimeAlias
    );
  const shouldPreferRuntimeProjectKey =
    runtimeProjectKeys.length > 0 &&
    (
      !baseContext.projectKey ||
      baseContext.projectKey === normalizedRouteSiteId ||
      runtimeProjectKeySet.has(baseContext.projectKey) ||
      projectKeyIsRuntimeAlias
    );

  if (!shouldPreferRuntimeProjectKey) {
    if (!shouldPreferRuntimeDatabaseKey) {
      return baseContext;
    }
    const preferredDatabaseKey = runtimeDatabaseKeys[0];
    return {
      ...baseContext,
      databaseKey: preferredDatabaseKey || baseContext.databaseKey,
      databaseKeyCandidates: dedupeProjectKeys([
        preferredDatabaseKey,
        ...runtimeDatabaseKeys,
        ...(Array.isArray(baseContext.databaseKeyCandidates) ? baseContext.databaseKeyCandidates : [])
      ])
    };
  }

  const preferredDatabaseKey = shouldPreferRuntimeDatabaseKey ? runtimeDatabaseKeys[0] : baseContext.databaseKey;
  const preferredProjectKey = runtimeProjectKeys[0];
  return {
    ...baseContext,
    databaseKey: preferredDatabaseKey || baseContext.databaseKey,
    databaseKeyCandidates: dedupeProjectKeys([
      preferredDatabaseKey,
      ...runtimeDatabaseKeys,
      ...(Array.isArray(baseContext.databaseKeyCandidates) ? baseContext.databaseKeyCandidates : [])
    ]),
    projectKey: preferredProjectKey,
    projectKeyCandidates: dedupeProjectKeys([
      preferredProjectKey,
      ...runtimeProjectKeys,
      ...(Array.isArray(baseContext.projectKeyCandidates) ? baseContext.projectKeyCandidates : [])
    ]),
    template: baseContext.template || readRuntimeDashboardTemplate(req)
  };
}

export function readDashboardRequestContext(req) {
  const baseContext = readRealtimeRequestContext(req);
  const routeSiteId =
    typeof req?.params?.siteId === "string" && req.params.siteId.trim() ? req.params.siteId.trim() : "";
  const normalizedRouteSiteId = normalizeLegacyProjectKey(routeSiteId);
  const runtimeProjectKeys = readRuntimeDashboardProjectKeys(req);
  const runtimeProjectKeySet = new Set(runtimeProjectKeys);
  const shouldPreferRuntimeDashboardKey =
    runtimeProjectKeys.length > 0 &&
    (
      !baseContext.projectKey ||
      baseContext.projectKey === normalizedRouteSiteId ||
      runtimeProjectKeySet.has(baseContext.projectKey)
    );

  if (!shouldPreferRuntimeDashboardKey) {
    return baseContext;
  }

  const preferredProjectKey = runtimeProjectKeys[0];
  return {
    ...baseContext,
    projectKey: preferredProjectKey || baseContext.projectKey,
    projectKeyCandidates: dedupeProjectKeys([
      preferredProjectKey,
      ...runtimeProjectKeys,
      ...(Array.isArray(baseContext.projectKeyCandidates) ? baseContext.projectKeyCandidates : []),
      normalizedRouteSiteId
    ]),
    template: baseContext.template || readRuntimeDashboardTemplate(req)
  };
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
    const requestContext = readRealtimeRequestContext(req);
    const dashboardContext = readDashboardRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
    const data = await getDashboardOverview(
      siteConfig,
      siteId,
      anomalies,
      dashboardContext
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
    const data = await getDashboardTrends(siteConfig, siteId, range, readDashboardRequestContext(req));
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
    const requestContext = readProjectDataRequestContext(req);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: req.query.language,
      unit: req.query.unit,
      modelKey: req.query.modelKey,
      template: req.query.template
    });

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
      drId,
      ...legacyCloudOptions
    });
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records/device-types", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
    const data = await getOperationRecordDeviceTypes(siteConfig, siteId, legacyCloudOptions);
    res.json(data);
  });

  router.get("/sites/:siteId/operation-records/devices", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
    const drTypeId = typeof req.query.drTypeId === "string" ? req.query.drTypeId : "0";
    const data = await getOperationRecordDevices(siteConfig, siteId, drTypeId, legacyCloudOptions);
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
    const requestContext = readProjectDataRequestContext(req);
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
      endDate,
      ...requestContext
    });
    res.json(data);
  });

  router.get("/sites/:siteId/work-orders/assignees", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const data = await getWorkOrderAssignees(getRequestSiteConfig(req, config), siteId, requestContext);
    res.json(data);
  });

  router.post("/sites/:siteId/work-orders", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const result = await createWorkOrder(
      getRequestSiteConfig(req, config),
      siteId,
      req.body || {},
      requestContext
    );

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
    const requestContext = readProjectDataRequestContext(req);
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const payload = {
      ...(req.body || {}),
      id: orderId
    };
    const result = await updateWorkOrder(getRequestSiteConfig(req, config), siteId, payload, requestContext);

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
    const requestContext = readProjectDataRequestContext(req);
    const orderId = typeof req.params.orderId === "string" ? req.params.orderId : "";
    const result = await deleteWorkOrder(getRequestSiteConfig(req, config), siteId, orderId, requestContext);

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
    const requestContext = readProjectDataRequestContext(req);
    const file = await getWorkOrderExport(getRequestSiteConfig(req, config), siteId, requestContext);

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
    const requestContext = readProjectDataRequestContext(req);
    const data = await getEnvironmentBuildings(getRequestSiteConfig(req, config), siteId, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/environment/conditions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const buildingId = typeof req.query.buildingId === "string" ? req.query.buildingId : "";
    const cooledAir = typeof req.query.cooledAir === "string" ? req.query.cooledAir : "";
    const monitoringSite = typeof req.query.monitoringSite === "string" ? req.query.monitoringSite : "";
    const data = await getEnvironmentConditions(getRequestSiteConfig(req, config), siteId, {
      ...requestContext,
      buildingId,
      cooledAir,
      monitoringSite
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis/tree", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const legacyOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
    const data = await getEnergyAnalysisTree(siteConfig, siteId, {
      ...requestContext,
      ...legacyOptions
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-analysis", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const legacyOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
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
      ...requestContext,
      ...legacyOptions,
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
    const requestContext = readProjectDataRequestContext(req);
    const legacyOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
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
      ...requestContext,
      ...legacyOptions,
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
    const requestContext = readProjectDataRequestContext(req);
    const legacyOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
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
      ...requestContext,
      ...legacyOptions,
      deviceKey,
      dates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/proportion", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const legacyOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
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
      ...requestContext,
      ...legacyOptions,
      date,
      dateType
    });
    res.json(data);
  });

  router.get("/sites/:siteId/energy-efficiency/imbalance", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
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
      ...requestContext,
      startDate: normalizeDateQuery(startDate),
      endDate: normalizeDateQuery(endDate, normalizeDateQuery(startDate))
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: req.query.language,
      unit: req.query.unit,
      modelKey: req.query.modelKey,
      template: req.query.template
    });

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
      endTime: normalizeDateTimeQuery(endTime, "end"),
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates,
      ...legacyCloudOptions
    });
    res.json(data);
  });

  router.get("/sites/:siteId/meter-readings/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: req.query.language,
      unit: req.query.unit,
      modelKey: req.query.modelKey,
      template: req.query.template
    });

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
      endTime: normalizeDateTimeQuery(endTime, "end"),
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates,
      ...legacyCloudOptions
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
    const requestContext = readProjectDataRequestContext(req);
    const metric = typeof req.query.metric === "string" ? req.query.metric.trim() : "systemEfficiency";
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: req.query.language,
      unit: req.query.unit,
      modelKey: req.query.modelKey,
      template: req.query.template
    });

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
      ...legacyCloudOptions
    });
    res.json(data);
  });

  router.get("/sites/:siteId/performance-reports/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: req.query.language,
      unit: req.query.unit,
      modelKey: req.query.modelKey,
      template: req.query.template
    });

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
      ...legacyCloudOptions
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
    const requestContext = readProjectDataRequestContext(req);
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, req.query);
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

    const data = await getReportRecordRegOptions(siteConfig, siteId, { drTypeId, drId, ...legacyCloudOptions });
    res.json(data);
  });

  router.post("/sites/:siteId/report-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const startTime = body.startTime;
    const endTime = body.endTime;
    const drTypeId = typeof body.drTypeId === "string" || typeof body.drTypeId === "number" ? String(body.drTypeId).trim() : "";
    const drId = typeof body.drId === "string" || typeof body.drId === "number" ? String(body.drId).trim() : "";
    const regIds = Array.isArray(body.regIds)
      ? body.regIds.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const drRegList = Array.isArray(body.drRegList) ? body.drRegList : [];
    const legacyCloudOptions = resolveLegacyCloudRequestOptions(siteConfig, requestContext, {
      language: body.language ?? req.query.language,
      unit: body.unit ?? req.query.unit,
      modelKey: body.modelKey ?? req.query.modelKey,
      template: body.template ?? req.query.template
    });

    if (
      (startTime != null && (typeof startTime !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startTime.trim()))) ||
      (endTime != null && (typeof endTime !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endTime.trim())))
    ) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Invalid startTime or endTime value",
        requestId: `req-${Date.now()}`,
        details: {
          fields: ["startTime", "endTime"],
          expected: "YYYY-MM-DD"
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

    const page = String(body.page || "1");
    const pageSize = String(body.pageSize || "10");
    const data = await getReportRecords(siteConfig, siteId, {
      page,
      pageSize,
      startTime: normalizeDateQuery(startTime),
      endTime: normalizeDateQuery(endTime, normalizeDateQuery(startTime)),
      drTypeId,
      drId,
      regIds,
      drRegList,
      dateType: body.dateType,
      ...legacyCloudOptions
    });
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
    const data = await getAnomalySummary(
      getRequestSiteConfig(req, config),
      siteId,
      readRealtimeRequestContext(req)
    );
    res.json(data);
  });

  router.get("/sites/:siteId/anomalies/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readRealtimeRequestContext(req);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "20");
    const severity = typeof req.query.severity === "string" ? req.query.severity : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const data = await getAnomalyList(getRequestSiteConfig(req, config), siteId, {
      ...requestContext,
      page,
      pageSize,
      severity,
      state
    });
    res.json(data);
  });

  router.get("/sites/:siteId/system/topology", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const data = await getTopology(getRequestSiteConfig(req, config), siteId, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/system/diagram", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const layoutMode = typeof req.query.layoutMode === "string" ? req.query.layoutMode : "auto";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "full";
    const data = await getSystemDiagram(siteConfig, siteId, {
      layoutMode,
      scope,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/legacy-trend", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
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
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/online-monitor", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const data = await getSceneOnlineMonitor(getRequestSiteConfig(req, config), siteId, {
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/floor-models", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const language = typeof req.query.language === "string" && req.query.language.trim()
      ? req.query.language.trim()
      : "zh";
    const unit = typeof req.query.unit === "string" && req.query.unit.trim()
      ? req.query.unit.trim()
      : "RT";
    const data = await getSceneFloorModels(getRequestSiteConfig(req, config), siteId, {
      userId: requestContext.userId,
      language,
      unit,
      projectKey: requestContext.projectKey,
      template: requestContext.template || "1"
    });
    res.json(data);
  });

  router.get("/sites/:siteId/scene/device-parameters", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const drId = typeof req.query.drId === "string" ? req.query.drId.trim() : "";
    if (!drId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Missing required drId",
        requestId: `req-${Date.now()}`,
        details: {
          field: "drId"
        }
      });
      return;
    }
    const language = typeof req.query.language === "string" && req.query.language.trim()
      ? req.query.language.trim()
      : "zh";
    const unit = typeof req.query.unit === "string" && req.query.unit.trim()
      ? req.query.unit.trim()
      : "RT";
    const data = await getSceneDeviceParameters(getRequestSiteConfig(req, config), siteId, {
      drId,
      userId: requestContext.userId || "150",
      language,
      unit,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates,
      template: requestContext.template || "1"
    });
    res.json(data);
  });

  router.post("/sites/:siteId/scene/device-command", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const requestContext = readProjectDataRequestContext(req);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const drId = payload.drId == null ? "" : String(payload.drId).trim();
    const drTypeId = payload.drTypeId == null ? "" : String(payload.drTypeId).trim();
    const regName = typeof payload.regName === "string" ? payload.regName.trim() : "";
    const tagName = typeof payload.tagName === "string" ? payload.tagName.trim() : "";
    const hasValue = payload.value != null && String(payload.value).trim() !== "";
    if (!drId || !drTypeId || !regName || !tagName || !hasValue) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Missing required scene device command fields",
        requestId: `req-${Date.now()}`,
        details: {
          required: ["drId", "drTypeId", "regName", "value", "tagName"],
          received: {
            drId,
            drTypeId,
            regName,
            value: payload.value,
            tagName
          }
        }
      });
      return;
    }
    const language = typeof req.query.language === "string" && req.query.language.trim()
      ? req.query.language.trim()
      : "zh";
    const data = await submitSceneDeviceCommand(getRequestSiteConfig(req, config), siteId, payload, {
      userId: requestContext.userId || "150",
      appId: requestContext.siteId || siteId,
      language,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates,
      template: requestContext.template || "1"
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/list", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const page = String(req.query.page || "1");
    const pageSize = String(req.query.pageSize || "12");
    const type = typeof req.query.type === "string" ? req.query.type : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const data = await getDeviceList(siteConfig, siteId, {
      page,
      pageSize,
      type,
      floor,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/device-data-interfaces", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const sourceConfig =
      siteConfig && typeof siteConfig === "object" ? siteConfig.siteSourceConfig : null;
    res.json({
      ok: true,
      requestId: req.requestId,
      siteId,
      projectKey: sourceConfig?.deviceDataProjectKey || null,
      defaultQuery: sourceConfig?.defaultDeviceQuery || null,
      items: Array.isArray(sourceConfig?.deviceDataInterfaces) ? sourceConfig.deviceDataInterfaces : [],
      sourceConfig
    });
  });

  router.get("/sites/:siteId/devices/tree", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const build = typeof req.query.build === "string" ? req.query.build : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const mock = typeof req.query.mock === "string" ? req.query.mock : "";
    const data = await getDeviceTree(siteConfig, siteId, {
      build,
      floor,
      mock,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/details", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const deviceIds = readDeviceIdsQuery(req);
    if (deviceIds.length === 0) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "Missing ids query parameter",
        requestId: `req-${Date.now()}`,
        details: {
          field: "ids"
        }
      });
      return;
    }
    const build = typeof req.query.build === "string" ? req.query.build : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const mock = typeof req.query.mock === "string" ? req.query.mock : "";
    const data = await getDeviceDetails(siteConfig, siteId, deviceIds, {
      build,
      floor,
      mock,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/devices/:deviceId", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const deviceId = String(req.params.deviceId || "");
    const build = typeof req.query.build === "string" ? req.query.build : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const mock = typeof req.query.mock === "string" ? req.query.mock : "";
    const data = await getDeviceDetail(siteConfig, siteId, deviceId, {
      build,
      floor,
      mock,
      databaseKey: requestContext.databaseKey,
      databaseKeyCandidates: requestContext.databaseKeyCandidates,
      projectKey: requestContext.projectKey,
      projectKeyCandidates: requestContext.projectKeyCandidates
    });
    res.json(data);
  });

  router.get("/sites/:siteId/recommendations", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
    const overview = await getDashboardOverview(siteConfig, siteId, anomalies, requestContext);
    const data = await getRecommendations(siteConfig, siteId, overview, anomalies, requestContext);
    res.json(data);
  });

  router.get("/sites/:siteId/ai/digest", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readRealtimeRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
    const overview = await getDashboardOverview(siteConfig, siteId, anomalies, requestContext);
    const recommendations = await getRecommendations(siteConfig, siteId, overview, anomalies, requestContext);
    const executionOverview = getOptimizeExecutionOverview(siteId, { adminStore });
    const recentExecutions = listOptimizeExecutions(siteId, {
      limit: 6,
      adminStore
    }).items;
    const data = await buildSiteAiDigestResponse(siteConfig, siteId, {
      overview,
      anomalies,
      recommendations,
      executionOverview,
      recentExecutions
    });
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

    const requestContext = readRealtimeRequestContext(req);
    const dashboardContext = readDashboardRequestContext(req);
    const projectDataContext = readProjectDataRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
	    const overview = await getDashboardOverview(
	      siteConfig,
	      siteId,
	      anomalies,
	      dashboardContext
	    );
	    let operationalDiagnosticsHistoryWindow = null;
	    try {
	      operationalDiagnosticsHistoryWindow = await getDashboardTrends(siteConfig, siteId, "24h", dashboardContext);
	    } catch (error) {
	      operationalDiagnosticsHistoryWindow = {
	        status: "unavailable",
	        range: "24h",
	        generatedAt: new Date().toISOString(),
	        error: error instanceof Error ? error.message : "dashboard trends unavailable",
	        series: []
	      };
	    }
	    const chillerStagingRuntimeContext = await getChillerStagingRuntimeContext(siteConfig, siteId, {
	      databaseKey: projectDataContext.databaseKey,
	      databaseKeyCandidates: projectDataContext.databaseKeyCandidates,
	      projectKey: projectDataContext.projectKey,
      projectKeyCandidates: projectDataContext.projectKeyCandidates
    });
    const recommendations = await getRecommendations(siteConfig, siteId, overview, anomalies, requestContext);
    const executionOverview = getOptimizeExecutionOverview(siteId, { adminStore });
    const recentExecutions = listOptimizeExecutions(siteId, {
      limit: 6,
      adminStore
    }).items;
    const persistedChillerStagingSamples = readPersistedChillerStagingSamples(adminStore, siteId);
    const controlLedgerImportReport = readControlLedgerImportReport(siteConfig, siteId);
    const fieldDataPreflightReport = readFieldDataPreflightReport(siteConfig, siteId);
    const fieldDataPromoteReport = readFieldDataPromoteReport(siteConfig, siteId);
    const sensorLedgerPreflightReport = readSensorLedgerPreflightReport(siteConfig, siteId);
    const fieldCollectionPackageReport = readFieldCollectionPackageReport(siteConfig, siteId);
    const data = await buildOptimizeDraftResponse(siteConfig, siteId, validation.request, {
      overview,
      anomalies,
	      recommendations,
	      chillerStagingRuntimeContext,
	      operationalDiagnosticsHistoryWindow,
		      controlLedgerImportReport,
		      fieldDataPreflightReport,
		      fieldDataPromoteReport,
		      sensorLedgerPreflightReport,
		      fieldCollectionPackageReport,
		      chillerRuntimeSamples: persistedChillerStagingSamples,
	      executionOverview,
	      recentExecutions
	    });
    if (data.chillerStagingAdvisor) {
      data.chillerStagingAdvisor.sampleCapture = maybeCaptureChillerStagingSample({
        adminStore,
        siteId,
        advisor: data.chillerStagingAdvisor,
        actorUserId: requestContext.userId,
        requestId: req.requestId || `req-${Date.now()}`
      });
    }
    const canWriteExecutions = hasOptimizeExecutionWritePermission(adminStore, requestContext.userId, siteId);
    data.executionHub = {
      status: executionOverview.pendingApprovalCount > 0 ? "pending" : "idle",
      approvalRequired: true,
      endpoint: `/bff/v1/sites/${siteId}/optimize/executions`,
      dispatchEndpoint: `/bff/v1/sites/${siteId}/optimize/executions/{executionId}/dispatch`,
      pendingApprovalCount: executionOverview.pendingApprovalCount,
      approvedCount: executionOverview.approvedCount,
      rolledBackCount: executionOverview.rolledBackCount,
      latestExecutionId: executionOverview.latestExecutionId,
      latestExecutionStatus: executionOverview.latestExecutionStatus,
      latestExecutionAt: executionOverview.latestExecutionAt,
      permissions: {
        userId: requestContext.userId || null,
        canApprove: canWriteExecutions,
        canRollback: canWriteExecutions,
        canDispatch: canWriteExecutions
      },
      note: "AI 只输出目标值；审批、下发、回退均受后端权限、执行模式和 PLC/SCADA 安全边界控制。"
    };
    res.json({
      ok: true,
      code: "OK",
      message: "chiller staging, tower approach and pump delta-t advisor result generated",
      requestId: `req-${Date.now()}`,
      details: data
    });
  });

  router.post("/sites/:siteId/optimize/tower-approach/advice", async (req, res) => {
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

    const requestContext = readRealtimeRequestContext(req);
    const dashboardContext = readDashboardRequestContext(req);
    const projectDataContext = readProjectDataRequestContext(req);
    const anomalies = await getAnomalySummary(siteConfig, siteId, requestContext);
    const overview = await getDashboardOverview(siteConfig, siteId, anomalies, dashboardContext);
    const chillerStagingRuntimeContext = await getChillerStagingRuntimeContext(siteConfig, siteId, {
      databaseKey: projectDataContext.databaseKey,
      databaseKeyCandidates: projectDataContext.databaseKeyCandidates,
      projectKey: projectDataContext.projectKey,
      projectKeyCandidates: projectDataContext.projectKeyCandidates
    });
    const recommendations = await getRecommendations(siteConfig, siteId, overview, anomalies, requestContext);
    const executionOverview = getOptimizeExecutionOverview(siteId, { adminStore });
    const recentExecutions = listOptimizeExecutions(siteId, {
      limit: 6,
      adminStore
    }).items;
    const persistedChillerStagingSamples = readPersistedChillerStagingSamples(adminStore, siteId);
    const details = await buildOptimizeDraftResponse(siteConfig, siteId, validation.request, {
      overview,
      anomalies,
      recommendations,
      chillerStagingRuntimeContext,
      chillerRuntimeSamples: persistedChillerStagingSamples,
      executionOverview,
      recentExecutions
    });
    const canWriteExecutions = hasOptimizeExecutionWritePermission(adminStore, requestContext.userId, siteId);
    details.executionHub = {
      status: executionOverview.pendingApprovalCount > 0 ? "pending" : "idle",
      approvalRequired: true,
      endpoint: `/bff/v1/sites/${siteId}/optimize/executions`,
      dispatchEndpoint: `/bff/v1/sites/${siteId}/optimize/executions/{executionId}/dispatch`,
      pendingApprovalCount: executionOverview.pendingApprovalCount,
      approvedCount: executionOverview.approvedCount,
      rolledBackCount: executionOverview.rolledBackCount,
      latestExecutionId: executionOverview.latestExecutionId,
      latestExecutionStatus: executionOverview.latestExecutionStatus,
      latestExecutionAt: executionOverview.latestExecutionAt,
      permissions: {
        userId: requestContext.userId || null,
        canApprove: canWriteExecutions,
        canRollback: canWriteExecutions,
        canDispatch: canWriteExecutions
      },
      note: "该接口只生成冷却塔接近度 AI 目标值；是否下发由执行单、审批和 dispatch 模式决定。"
    };

    res.json({
      ok: true,
      code: "OK",
      requestId: `req-${Date.now()}`,
      site: {
        siteId
      },
      advisorResult: details.towerApproachAdvisor?.advisorResult || null,
      towerApproachAdvisor: details.towerApproachAdvisor || null,
      details
    });
  });

  router.get("/sites/:siteId/optimize/chiller-staging/samples", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const combinationKey =
      typeof req.query.combinationKey === "string"
        ? req.query.combinationKey
        : buildChillerSampleCombinationKey(
            typeof req.query.combination === "string" ? req.query.combination : ""
          );
    const list = adminStore?.listChillerStagingSamples
      ? adminStore.listChillerStagingSamples(siteId, {
          combinationKey,
          limit: typeof req.query.limit === "string" ? req.query.limit : 100
        })
      : {
          siteId,
          total: 0,
          items: []
        };
    res.json({
      site: {
        siteId
      },
      generatedAt: new Date().toISOString(),
      basis: "append_only_chiller_staging_samples",
      total: list.total,
      items: list.items
    });
  });

  router.get("/sites/:siteId/optimize/executions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const list = listOptimizeExecutions(siteId, {
      status: typeof req.query.status === "string" ? req.query.status : "",
      type: typeof req.query.type === "string" ? req.query.type : "",
      limit: typeof req.query.limit === "string" ? req.query.limit : 20,
      adminStore
    });
    res.json({
      site: {
        siteId
      },
      generatedAt: new Date().toISOString(),
      total: list.total,
      items: list.items
    });
  });

  router.get("/sites/:siteId/optimize/tower-approach/executions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const list = listOptimizeExecutions(siteId, {
      status: typeof req.query.status === "string" ? req.query.status : "",
      type: "tower-approach",
      limit: typeof req.query.limit === "string" ? req.query.limit : 20,
      adminStore
    });
    res.json({
      site: {
        siteId
      },
      executionType: "tower-approach",
      generatedAt: new Date().toISOString(),
      total: list.total,
      items: list.items
    });
  });

  router.get("/sites/:siteId/optimize/shadow-verification-records/export", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const list = adminStore?.listShadowVerificationRecords
      ? adminStore.listShadowVerificationRecords(siteId, {
          executionId: typeof req.query.executionId === "string" ? req.query.executionId.trim() : "",
          verificationType: typeof req.query.verificationType === "string" ? req.query.verificationType.trim() : "",
          limit: typeof req.query.limit === "string" ? req.query.limit : 500
        })
      : {
          siteId,
          total: 0,
          items: []
        };
    const csv = buildShadowVerificationRecordCsv(list.items);
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(`shadow-verification-records-${siteId}.csv`)}`
    );
    res.send(csv);
  });

  router.get("/sites/:siteId/optimize/shadow-verification-records/report", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = typeof req.query.executionId === "string" ? req.query.executionId.trim() : "";
    const verificationType = typeof req.query.verificationType === "string" ? req.query.verificationType.trim() : "";
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required for a single shadow review report",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId",
          boundary: "single_shadow_review_report_requires_execution_id"
        }
      });
      return;
    }
    const list = adminStore?.listShadowVerificationRecords
      ? adminStore.listShadowVerificationRecords(siteId, {
          executionId,
          verificationType,
          limit: typeof req.query.limit === "string" ? req.query.limit : 500
        })
      : {
          siteId,
          total: 0,
          items: []
        };
    const generatedAt = new Date().toISOString();
    const archive = buildShadowReviewArchiveMetadata({
      siteId,
      executionId,
      verificationType,
      list
    });
    const markdown = buildShadowVerificationReviewReport({
      siteId,
      executionId,
      verificationType,
      list,
      generatedAt
    });
    const safeExecutionId = executionId.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 96) || "execution";
    res.setHeader("content-type", "text/markdown; charset=utf-8");
    res.setHeader("x-shadow-review-report-id", archive.reportId);
    res.setHeader("x-shadow-review-checksum", archive.checksum);
    res.setHeader("x-shadow-review-checksum-algorithm", archive.checksumAlgorithm);
    res.setHeader(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(`shadow-review-${siteId}-${safeExecutionId}.md`)}`
    );
    res.send(markdown);
  });

  router.get("/sites/:siteId/optimize/shadow-verification-records/report/print", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = typeof req.query.executionId === "string" ? req.query.executionId.trim() : "";
    const verificationType = typeof req.query.verificationType === "string" ? req.query.verificationType.trim() : "";
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required for a printable shadow review report",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId",
          boundary: "single_shadow_review_print_requires_execution_id"
        }
      });
      return;
    }
    const list = adminStore?.listShadowVerificationRecords
      ? adminStore.listShadowVerificationRecords(siteId, {
          executionId,
          verificationType,
          limit: typeof req.query.limit === "string" ? req.query.limit : 500
        })
      : {
          siteId,
          total: 0,
          items: []
        };
    const generatedAt = new Date().toISOString();
    const archive = buildShadowReviewArchiveMetadata({
      siteId,
      executionId,
      verificationType,
      list
    });
    const html = buildShadowVerificationReviewPrintHtml({
      siteId,
      executionId,
      verificationType,
      list,
      generatedAt
    });
    const safeExecutionId = executionId.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 96) || "execution";
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("x-shadow-review-report-id", archive.reportId);
    res.setHeader("x-shadow-review-checksum", archive.checksum);
    res.setHeader("x-shadow-review-checksum-algorithm", archive.checksumAlgorithm);
    res.setHeader(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(`shadow-review-${siteId}-${safeExecutionId}.html`)}`
    );
    res.send(html);
  });

  router.get("/sites/:siteId/optimize/shadow-verification-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const list = adminStore?.listShadowVerificationRecords
      ? adminStore.listShadowVerificationRecords(siteId, {
          executionId: typeof req.query.executionId === "string" ? req.query.executionId.trim() : "",
          verificationType: typeof req.query.verificationType === "string" ? req.query.verificationType.trim() : "",
          limit: typeof req.query.limit === "string" ? req.query.limit : 20
        })
      : {
          siteId,
          total: 0,
          items: []
        };
    res.json({
      site: {
        siteId
      },
      generatedAt: new Date().toISOString(),
      basis: "append_only_shadow_verification_records",
      total: list.total,
      summary: buildShadowVerificationRecordSummary({
        ...list,
        executionId: typeof req.query.executionId === "string" ? req.query.executionId.trim() : "",
        verificationType: typeof req.query.verificationType === "string" ? req.query.verificationType.trim() : ""
      }),
      items: list.items
    });
  });

  router.post("/sites/:siteId/optimize/shadow-verification-records", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    if (!adminStore?.createShadowVerificationRecord) {
      res.status(503).json({
        ok: false,
        code: "UNAVAILABLE",
        error: "Shadow verification record store is unavailable",
        requestId: `req-${Date.now()}`
      });
      return;
    }
    const actor = readRealtimeRequestContext(req);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const record = adminStore.createShadowVerificationRecord(
      siteId,
      body.record && typeof body.record === "object" ? body.record : body,
      {
        userId: actor.userId
      },
      {
        requestId: req.requestId
      }
    );
    res.status(201).json({
      ok: true,
      requestId: `req-${Date.now()}`,
      controlMutation: false,
      record
    });
  });

  router.post("/sites/:siteId/optimize/executions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const validation = validateCreateOptimizeExecutionRequest(req.body || {});
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

    const actor = readRealtimeRequestContext(req);
    const execution = createOptimizeExecution(siteId, validation.request, {
      userId: actor.userId,
      adminStore,
      requestId: req.requestId
    });
    res.status(201).json({
      ok: true,
      requestId: `req-${Date.now()}`,
      execution
    });
  });

  router.post("/sites/:siteId/optimize/tower-approach/executions", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const execution = body.execution && typeof body.execution === "object" ? body.execution : {};
    if (typeof execution.type === "string" && execution.type.trim() && execution.type !== "tower-approach") {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: `Invalid execution input: tower-approach endpoint requires execution.type=tower-approach, got ${execution.type}`,
        requestId: `req-${Date.now()}`,
        details: {
          field: "execution.type",
          expected: "tower-approach"
        }
      });
      return;
    }

    const validation = validateCreateOptimizeExecutionRequest({
      ...body,
      execution: {
        ...execution,
        type: "tower-approach"
      }
    });
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

    const actor = readRealtimeRequestContext(req);
    const created = createOptimizeExecution(siteId, validation.request, {
      userId: actor.userId,
      adminStore,
      requestId: req.requestId
    });
    res.status(201).json({
      ok: true,
      requestId: `req-${Date.now()}`,
      executionType: "tower-approach",
      execution: created
    });
  });

  router.post("/sites/:siteId/optimize/tower-approach/executions/:executionId/approve", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = String(req.params.executionId || "").trim();
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId"
        }
      });
      return;
    }

    const existing = getOptimizeExecution(siteId, executionId, { adminStore });
    if (!existing) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "Execution not found",
        requestId: `req-${Date.now()}`,
        details: {
          executionId
        }
      });
      return;
    }
    if (existing?.execution?.type !== "tower-approach" && existing?.execution?.type !== "pump-delta-t") {
      res.status(409).json({
        ok: false,
        code: "CONFLICT",
        error: "Execution type does not support dispatch",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          executionId,
          executionType: existing?.execution?.type || null,
          allowed: ["tower-approach", "pump-delta-t"]
        }
      });
      return;
    }

    const actor = readRealtimeRequestContext(req);
    if (!hasOptimizeExecutionWritePermission(adminStore, actor.userId, siteId)) {
      res.status(403).json({
        ok: false,
        code: "ADMIN_FORBIDDEN",
        error: "仅平台/站点管理员可审批或回退",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          requiredRoles: ["platform_admin", "site_admin"],
          siteId
        }
      });
      return;
    }

    const siteConfig = getRequestSiteConfig(req, config);
    const dispatchReceipt = await dispatchTowerApproachExecution({
      siteConfig,
      siteId,
      execution: existing,
      operation: "approve",
      actorUserId: actor.userId,
      requestId: req.requestId
    });
    if (isDispatchBlockingFailure(dispatchReceipt)) {
      res.status(502).json({
        ok: false,
        code: "OPTIMIZE_EXECUTION_DISPATCH_FAILED",
        error: "tower-approach execution dispatch failed before approval",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          siteId,
          executionId,
          dispatch: dispatchReceipt
        }
      });
      return;
    }

    const approvePayload = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      dispatch: dispatchReceipt,
      feedbackSnapshot: await captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, actor, "approved")
    };
    const approved = approveOptimizeExecution(
      siteId,
      executionId,
      approvePayload,
      {
        userId: actor.userId,
        adminStore,
        requestId: req.requestId
      }
    );

    if (!approved.ok) {
      res.status(approved.status || 409).json({
        ok: false,
        code: approved.code || "CONFLICT",
        error: approved.error || "approve failed",
        requestId: `req-${Date.now()}`,
        details: approved.details
      });
      return;
    }

    res.json({
      ok: true,
      requestId: `req-${Date.now()}`,
      executionType: "tower-approach",
      execution: approved.execution,
      dispatch: dispatchReceipt
    });
  });

  router.post("/sites/:siteId/optimize/tower-approach/executions/:executionId/rollback", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = String(req.params.executionId || "").trim();
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId"
        }
      });
      return;
    }

    const existing = getOptimizeExecution(siteId, executionId, { adminStore });
    if (!existing) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "Execution not found",
        requestId: `req-${Date.now()}`,
        details: {
          executionId
        }
      });
      return;
    }
    if (existing?.execution?.type !== "tower-approach" && existing?.execution?.type !== "pump-delta-t") {
      res.status(409).json({
        ok: false,
        code: "CONFLICT",
        error: "Execution type does not support dispatch",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          executionId,
          executionType: existing?.execution?.type || null,
          allowed: ["tower-approach", "pump-delta-t"]
        }
      });
      return;
    }

    const actor = readRealtimeRequestContext(req);
    if (!hasOptimizeExecutionWritePermission(adminStore, actor.userId, siteId)) {
      res.status(403).json({
        ok: false,
        code: "ADMIN_FORBIDDEN",
        error: "仅平台/站点管理员可审批或回退",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          requiredRoles: ["platform_admin", "site_admin"],
          siteId
        }
      });
      return;
    }

    const siteConfig = getRequestSiteConfig(req, config);
    const dispatchReceipt = await dispatchTowerApproachExecution({
      siteConfig,
      siteId,
      execution: existing,
      operation: "rollback",
      actorUserId: actor.userId,
      requestId: req.requestId
    });
    if (isDispatchBlockingFailure(dispatchReceipt)) {
      res.status(502).json({
        ok: false,
        code: "OPTIMIZE_EXECUTION_DISPATCH_FAILED",
        error: "tower-approach execution dispatch failed before rollback",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          siteId,
          executionId,
          dispatch: dispatchReceipt
        }
      });
      return;
    }

    const rollbackPayload = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      dispatch: dispatchReceipt,
      feedbackSnapshot: await captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, actor, "rolled_back")
    };
    const rolledBack = rollbackOptimizeExecution(
      siteId,
      executionId,
      rollbackPayload,
      {
        userId: actor.userId,
        adminStore,
        requestId: req.requestId
      }
    );

    if (!rolledBack.ok) {
      res.status(rolledBack.status || 409).json({
        ok: false,
        code: rolledBack.code || "CONFLICT",
        error: rolledBack.error || "rollback failed",
        requestId: `req-${Date.now()}`,
        details: rolledBack.details
      });
      return;
    }

    res.json({
      ok: true,
      requestId: `req-${Date.now()}`,
      executionType: "tower-approach",
      execution: rolledBack.execution,
      dispatch: dispatchReceipt
    });
  });

  router.post("/sites/:siteId/optimize/executions/:executionId/dispatch", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = String(req.params.executionId || "").trim();
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId"
        }
      });
      return;
    }

    const existing = getOptimizeExecution(siteId, executionId, { adminStore });
    if (!existing) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "Execution not found",
        requestId: `req-${Date.now()}`,
        details: {
          executionId
        }
      });
      return;
    }
    if (existing?.execution?.type !== "tower-approach" && existing?.execution?.type !== "pump-delta-t") {
      res.status(409).json({
        ok: false,
        code: "CONFLICT",
        error: "Execution type does not support dispatch",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          executionId,
          executionType: existing?.execution?.type || null,
          allowed: ["tower-approach", "pump-delta-t"]
        }
      });
      return;
    }
    if (existing.status !== "approved") {
      res.status(409).json({
        ok: false,
        code: "CONFLICT",
        error: "Execution must be approved before dispatch",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          executionId,
          status: existing.status
        }
      });
      return;
    }

    const actor = readRealtimeRequestContext(req);
    if (!hasOptimizeExecutionWritePermission(adminStore, actor.userId, siteId)) {
      res.status(403).json({
        ok: false,
        code: "ADMIN_FORBIDDEN",
        error: "仅平台/站点管理员可下发",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          requiredRoles: ["platform_admin", "site_admin"],
          siteId
        }
      });
      return;
    }

    const siteConfig = getRequestSiteConfig(req, config);
    const dispatchReceipt = await dispatchOptimizeExecutionByType({
      siteConfig,
      siteId,
      execution: existing,
      operation: "dispatch",
      actorUserId: actor.userId,
      requestId: req.requestId
    });
    if (isDispatchBlockingFailure(dispatchReceipt)) {
      res.status(502).json({
        ok: false,
        code: "OPTIMIZE_EXECUTION_DISPATCH_FAILED",
        error: "optimize execution dispatch failed",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          siteId,
          executionId,
          dispatch: dispatchReceipt
        }
      });
      return;
    }

    const dispatched = dispatchOptimizeExecution(
      siteId,
      executionId,
      {
        dispatch: dispatchReceipt,
        feedbackSnapshot: await captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, actor, "dispatched")
      },
      {
        userId: actor.userId,
        adminStore,
        requestId: req.requestId
      }
    );

    if (!dispatched.ok) {
      res.status(dispatched.status || 409).json({
        ok: false,
        code: dispatched.code || "CONFLICT",
        error: dispatched.error || "dispatch failed",
        requestId: req.requestId || `req-${Date.now()}`,
        details: dispatched.details
      });
      return;
    }

    res.json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      executionType: existing?.execution?.type || null,
      execution: dispatched.execution,
      dispatch: dispatchReceipt
    });
  });

  router.post("/sites/:siteId/optimize/executions/:executionId/approve", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = String(req.params.executionId || "").trim();
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId"
        }
      });
      return;
    }
    const actor = readRealtimeRequestContext(req);
    if (!hasOptimizeExecutionWritePermission(adminStore, actor.userId, siteId)) {
      res.status(403).json({
        ok: false,
        code: "ADMIN_FORBIDDEN",
        error: "仅平台/站点管理员可审批或回退",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          requiredRoles: ["platform_admin", "site_admin"],
          siteId
        }
      });
      return;
    }
    const existing = getOptimizeExecution(siteId, executionId, { adminStore });
    if (!existing) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "Execution not found",
        requestId: `req-${Date.now()}`,
        details: {
          executionId
        }
      });
      return;
    }

    const siteConfig = getRequestSiteConfig(req, config);
    const dispatchReceipt = await dispatchOptimizeExecutionByType({
      siteConfig,
      siteId,
      execution: existing,
      operation: "approve",
      actorUserId: actor.userId,
      requestId: req.requestId
    });
    if (isDispatchBlockingFailure(dispatchReceipt)) {
      res.status(502).json({
        ok: false,
        code: "OPTIMIZE_EXECUTION_DISPATCH_FAILED",
        error: "optimize execution dispatch failed before approval",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          siteId,
          executionId,
          dispatch: dispatchReceipt
        }
      });
      return;
    }

    const approvePayload = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      ...(dispatchReceipt ? { dispatch: dispatchReceipt } : {}),
      feedbackSnapshot: await captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, actor, "approved")
    };
    const approved = approveOptimizeExecution(
      siteId,
      executionId,
      approvePayload,
      {
        userId: actor.userId,
        adminStore,
        requestId: req.requestId
      }
    );

    if (!approved.ok) {
      res.status(approved.status || 409).json({
        ok: false,
        code: approved.code || "CONFLICT",
        error: approved.error || "approve failed",
        requestId: `req-${Date.now()}`,
        details: approved.details
      });
      return;
    }

    res.json({
      ok: true,
      requestId: `req-${Date.now()}`,
      execution: approved.execution,
      ...(dispatchReceipt ? { dispatch: dispatchReceipt } : {})
    });
  });

  router.post("/sites/:siteId/optimize/executions/:executionId/rollback", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const executionId = String(req.params.executionId || "").trim();
    if (!executionId) {
      res.status(400).json({
        ok: false,
        code: "BAD_REQUEST",
        error: "executionId is required",
        requestId: `req-${Date.now()}`,
        details: {
          field: "executionId"
        }
      });
      return;
    }

    const actor = readRealtimeRequestContext(req);
    if (!hasOptimizeExecutionWritePermission(adminStore, actor.userId, siteId)) {
      res.status(403).json({
        ok: false,
        code: "ADMIN_FORBIDDEN",
        error: "仅平台/站点管理员可审批或回退",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          requiredRoles: ["platform_admin", "site_admin"],
          siteId
        }
      });
      return;
    }
    const existing = getOptimizeExecution(siteId, executionId, { adminStore });
    if (!existing) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "Execution not found",
        requestId: `req-${Date.now()}`,
        details: {
          executionId
        }
      });
      return;
    }

    const siteConfig = getRequestSiteConfig(req, config);
    const dispatchReceipt = await dispatchOptimizeExecutionByType({
      siteConfig,
      siteId,
      execution: existing,
      operation: "rollback",
      actorUserId: actor.userId,
      requestId: req.requestId
    });
    if (isDispatchBlockingFailure(dispatchReceipt)) {
      res.status(502).json({
        ok: false,
        code: "OPTIMIZE_EXECUTION_DISPATCH_FAILED",
        error: "optimize execution dispatch failed before rollback",
        requestId: req.requestId || `req-${Date.now()}`,
        details: {
          siteId,
          executionId,
          dispatch: dispatchReceipt
        }
      });
      return;
    }

    const rollbackPayload = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      ...(dispatchReceipt ? { dispatch: dispatchReceipt } : {}),
      feedbackSnapshot: await captureOptimizeExecutionFeedbackSnapshot(siteConfig, siteId, actor, "rolled_back")
    };
    const rolledBack = rollbackOptimizeExecution(
      siteId,
      executionId,
      rollbackPayload,
      {
        userId: actor.userId,
        adminStore,
        requestId: req.requestId
      }
    );

    if (!rolledBack.ok) {
      res.status(rolledBack.status || 409).json({
        ok: false,
        code: rolledBack.code || "CONFLICT",
        error: rolledBack.error || "rollback failed",
        requestId: `req-${Date.now()}`,
        details: rolledBack.details
      });
      return;
    }

    res.json({
      ok: true,
      requestId: `req-${Date.now()}`,
      execution: rolledBack.execution,
      ...(dispatchReceipt ? { dispatch: dispatchReceipt } : {})
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

    const siteConfig = getRequestSiteConfig(req, config);

    try {
      const data = await buildAssistantQueryResponse(
        siteConfig,
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
