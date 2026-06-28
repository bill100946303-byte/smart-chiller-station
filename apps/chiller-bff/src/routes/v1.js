import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { resolveSiteRuntimeConfig } from "../lib/site-runtime-config.js";
import { computeFreshnessState } from "../services/freshness.js";
import { buildSourceStatus } from "../services/sourceStatusService.js";
import { getAnomalyList, getAnomalySummary } from "../services/anomalyService.js";
import { getColdStationLog } from "../services/coldStationLogService.js";
import { getDashboardOverview, getDashboardTrends } from "../services/dashboardService.js";
import {
  getFanCoilTerminalSnapshot,
  getChillerStagingRuntimeContext,
  getDeviceDetail,
  getDeviceDetails,
  getDeviceList,
  getDeviceTree,
  getRuntimePointSummary
} from "../services/deviceService.js";
import {
  buildDefaultFcuControlPolicy,
  dispatchFcuControlCycle,
  evaluateFcuControlCycle,
  evaluateFcuDeviceCommissioningStatus,
  evaluateManualFcuControlCommand,
  isFcuControlWriteAdapterConfigured,
  normalizeFcuControlPolicy,
  persistFcuControlCycle,
  verifyFcuControlRecordFeedback
} from "../services/fcuControlService.js";
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
import { buildByxPowerAssignmentCsv, getByxPowerMonitoring } from "../adapters/byxPowerAdapter.js";
import {
  appendByxPowerHistorySnapshot,
  getByxPowerHistory
} from "../services/byxPowerHistoryService.js";
import { checkByxPowerAssignments } from "../services/byxPowerAssignmentCheckService.js";
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

function resolveHvacTerminalSiteId(req, defaultSiteId) {
  const siteId = resolveSiteId(req, defaultSiteId);
  return siteId === "126" ? "126lnoffice" : siteId;
}

function resolveConfigCenterRuntimeSiteId(req, defaultSiteId) {
  const siteId = resolveSiteId(req, defaultSiteId);
  return siteId === "126" ? "126lnoffice" : siteId;
}

function buildHvacTerminalDataContext(siteId, requestContext = {}) {
  return {
    databaseKey: siteId,
    databaseKeyCandidates: dedupeProjectKeys([
      siteId,
      requestContext.databaseKey,
      ...(Array.isArray(requestContext.databaseKeyCandidates) ? requestContext.databaseKeyCandidates : [])
    ]),
    projectKey: siteId,
    projectKeyCandidates: dedupeProjectKeys([
      siteId,
      requestContext.projectKey,
      ...(Array.isArray(requestContext.projectKeyCandidates) ? requestContext.projectKeyCandidates : [])
    ])
  };
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

function readJsonReportFile(fileUrl, label) {
  const filePath = fileURLToPath(fileUrl);
  try {
    if (!fs.existsSync(fileUrl)) {
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
      payload: JSON.parse(fs.readFileSync(fileUrl, "utf8")),
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

function readFcuFinalControlEvidence(overrides = {}) {
  return {
    finalControlGates: overrides.finalControlGatesJson
      ? readJsonReportPath(overrides.finalControlGatesJson, "FCU final control gates")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-gates-latest.json", import.meta.url),
          "FCU final control gates"
        ),
    finalRollout: readJsonReportFile(
      new URL("../../../../docs/fcu-final-control-rollout-latest.json", import.meta.url),
      "FCU final control rollout"
    ),
    finalCompletion: overrides.finalCompletionJson
      ? readJsonReportPath(overrides.finalCompletionJson, "FCU final control completion")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-completion-latest.json", import.meta.url),
          "FCU final control completion"
        ),
    qualityRemediation: overrides.qualityRemediationJson
      ? readJsonReportPath(overrides.qualityRemediationJson, "FCU quality remediation")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-quality-remediation-latest.json", import.meta.url),
          "FCU quality remediation"
        ),
    canaryExecutionPackage: overrides.canaryExecutionPackageJson
      ? readJsonReportPath(overrides.canaryExecutionPackageJson, "FCU canary execution package")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-canary-execution-package-latest.json", import.meta.url),
          "FCU canary execution package"
        ),
    baWriteAdapterReadiness: overrides.baWriteAdapterReadinessJson
      ? readJsonReportPath(overrides.baWriteAdapterReadinessJson, "FCU BA write adapter readiness")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-ba-write-adapter-readiness-latest.json", import.meta.url),
          "FCU BA write adapter readiness"
        ),
    canaryFeedbackMonitor: overrides.canaryFeedbackMonitorJson
      ? readJsonReportPath(overrides.canaryFeedbackMonitorJson, "FCU canary feedback monitor")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-canary-feedback-monitor-latest.json", import.meta.url),
          "FCU canary feedback monitor"
        ),
    canaryWindow: overrides.canaryWindowJson
      ? readJsonReportPath(overrides.canaryWindowJson, "FCU canary window")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-canary-window-latest.json", import.meta.url),
          "FCU canary window"
        ),
    fieldArmPackage: overrides.fieldArmPackageJson
      ? readJsonReportPath(overrides.fieldArmPackageJson, "FCU field arm package")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-field-arm-package-latest.json", import.meta.url),
          "FCU field arm package"
        ),
    rolloutPlan: overrides.allDevicePlanJson
      ? readJsonReportPath(overrides.allDevicePlanJson, "FCU all-device dispatch plan")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-all-device-dispatch-plan-latest.json", import.meta.url),
          "FCU all-device dispatch plan"
        ),
    finalWorklist: overrides.finalWorklistJson
      ? readJsonReportPath(overrides.finalWorklistJson, "FCU final control worklist")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-worklist-latest.json", import.meta.url),
          "FCU final control worklist"
        ),
    finalRunbook: overrides.finalRunbookJson
      ? readJsonReportPath(overrides.finalRunbookJson, "FCU final control runbook")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-runbook-latest.json", import.meta.url),
          "FCU final control runbook"
        ),
    finalControlFieldExecutionPack: overrides.finalControlFieldExecutionPackJson
      ? readJsonReportPath(overrides.finalControlFieldExecutionPackJson, "FCU final control field execution pack")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-field-execution-pack-latest.json", import.meta.url),
          "FCU final control field execution pack"
        ),
    evidenceConsistency: overrides.evidenceConsistencyJson
      ? readJsonReportPath(overrides.evidenceConsistencyJson, "FCU final control evidence consistency")
      : readJsonReportFile(
          new URL("../../../../docs/fcu-final-control-evidence-consistency-latest.json", import.meta.url),
          "FCU final control evidence consistency"
        )
  };
}

function buildFcuFinalDispatchGate(evidence) {
  const finalControlGates = evidence?.finalControlGates || {};
  const evidenceConsistency = evidence?.evidenceConsistency || {};
  const payload = finalControlGates.payload || {};
  const evidencePayload = evidenceConsistency.payload || {};
  const summary = payload.summary || {};
  const conditions = [
    {
      key: "final_control_gates_report_available",
      label: "最终控制总门禁报告可用",
      ok: finalControlGates.status === "ok",
      evidence: finalControlGates.sourceFile || null
    },
    {
      key: "final_control_gates_passed",
      label: "最终控制总门禁通过",
      ok: payload.ok === true,
      evidence: `passed=${summary.passed ?? "--"}/${summary.gateCount ?? "--"} blocked=${summary.blocked ?? "--"}`
    },
    {
      key: "final_canary_ready",
      label: "Canary 已放行",
      ok: summary.canaryReady === true,
      evidence: `canaryReady=${summary.canaryReady === true}`
    },
    {
      key: "final_control_evidence_consistent",
      label: "最终控制证据一致",
      ok: evidenceConsistency.status === "ok" && evidencePayload.ok === true,
      evidence: evidencePayload.summary
        ? `issues=${evidencePayload.summary.issueCount ?? "--"} stale=${evidencePayload.summary.staleSignoffRows ?? "--"}`
        : evidenceConsistency.sourceFile || null
    }
  ];
  const blockedReasons = conditions.filter((item) => item.ok !== true).map((item) => item.key);
  return {
    ready: blockedReasons.length === 0,
    dispatchAllowed: blockedReasons.length === 0,
    conditions,
    blockedReasons,
    sourceFile: finalControlGates.sourceFile || null,
    summary
  };
}

function normalizeRouteText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function slugifyFcuDeviceCode(value) {
  return normalizeRouteText(value).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase() || "unknown";
}

function buildFcuCanaryWindowFilePaths(deviceCode, outputDir = "") {
  const slug = slugifyFcuDeviceCode(deviceCode);
  const docsDir = outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url));
  return {
    json: path.join(docsDir, `fcu-canary-window-${slug}.json`),
    markdown: path.join(docsDir, `fcu-canary-window-${slug}.md`),
    executionPackageJson: path.join(docsDir, `fcu-canary-execution-package-${slug}.json`),
    executionPackageMd: path.join(docsDir, `fcu-canary-execution-package-${slug}.md`),
    executionPackageCsv: path.join(docsDir, `fcu-canary-execution-package-${slug}.csv`),
    adapterReadinessJson: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.json`),
    adapterReadinessMd: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.md`),
    adapterReadinessCsv: path.join(docsDir, `fcu-ba-write-adapter-readiness-${slug}.csv`),
    canaryDispatchJson: path.join(docsDir, `fcu-canary-dispatch-${slug}.json`),
    canaryDispatchMd: path.join(docsDir, `fcu-canary-dispatch-${slug}.md`),
    feedbackMonitorJson: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.json`),
    feedbackMonitorMd: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.md`),
    feedbackMonitorCsv: path.join(docsDir, `fcu-canary-feedback-monitor-${slug}.csv`),
    finalCompletionJson: path.join(docsDir, "fcu-final-control-completion-latest.json"),
    finalCompletionMd: path.join(docsDir, "fcu-final-control-completion-latest.md"),
    finalWorklistJson: path.join(docsDir, "fcu-final-control-worklist-latest.json"),
    finalWorklistMd: path.join(docsDir, "fcu-final-control-worklist-latest.md")
  };
}

function buildFcuCanaryDispatchFilePaths(deviceCode, outputDir = "") {
  const slug = slugifyFcuDeviceCode(deviceCode);
  const docsDir = outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url));
  return {
    json: path.join(docsDir, `fcu-canary-dispatch-${slug}.json`),
    markdown: path.join(docsDir, `fcu-canary-dispatch-${slug}.md`)
  };
}

function buildFcuFieldArmPackageFilePaths(deviceCode, outputDir = "") {
  const slug = slugifyFcuDeviceCode(deviceCode);
  const docsDir = outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url));
  return {
    json: path.join(docsDir, `fcu-field-arm-package-${slug}.json`),
    markdown: path.join(docsDir, `fcu-field-arm-package-${slug}.md`),
    csv: path.join(docsDir, `fcu-field-arm-package-${slug}.csv`)
  };
}

function buildFcuFinalControlRefreshFilePaths(outputDir) {
  const docsDir = outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url));
  return {
    finalControlGatesJson: path.join(docsDir, "fcu-final-control-gates-latest.json"),
    finalControlGatesMd: path.join(docsDir, "fcu-final-control-gates-latest.md"),
    finalCompletionJson: path.join(docsDir, "fcu-final-control-completion-latest.json"),
    finalCompletionMd: path.join(docsDir, "fcu-final-control-completion-latest.md"),
    finalWorklistJson: path.join(docsDir, "fcu-final-control-worklist-latest.json"),
    finalWorklistMd: path.join(docsDir, "fcu-final-control-worklist-latest.md"),
    finalRunbookJson: path.join(docsDir, "fcu-final-control-runbook-latest.json"),
    finalRunbookMd: path.join(docsDir, "fcu-final-control-runbook-latest.md"),
    finalControlFieldExecutionPackJson: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.json"),
    finalControlFieldExecutionPackMd: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.md"),
    finalControlFieldExecutionPackCsv: path.join(docsDir, "fcu-final-control-field-execution-pack-latest.csv"),
    evidenceConsistencyJson: path.join(docsDir, "fcu-final-control-evidence-consistency-latest.json"),
    evidenceConsistencyMd: path.join(docsDir, "fcu-final-control-evidence-consistency-latest.md"),
    canaryReadinessJson: path.join(docsDir, "fcu-canary-readiness-latest.json"),
    canaryReadinessMd: path.join(docsDir, "fcu-canary-readiness-latest.md"),
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
    fieldRemediationSignoffCsv: path.join(docsDir, "fcu-field-remediation-signoff-latest.csv"),
    fieldRemediationSignoffReleaseMatrixCsv: path.join(docsDir, "fcu-field-remediation-signoff-latest-release-matrix.csv"),
    fieldRemediationSignoffCleanJson: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.json"),
    fieldRemediationSignoffCleanMd: path.join(docsDir, "fcu-field-remediation-signoff-clean-input-latest.md"),
    fieldRemediationSignoffCleanCurrentCsv: path.join(docsDir, "fcu-field-remediation-signoff-current-only-latest.csv"),
    fieldRemediationSignoffCleanStaleCsv: path.join(docsDir, "fcu-field-remediation-signoff-stale-rows-latest.csv"),
    fieldRemediationSignoffPromoteJson: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.json"),
    fieldRemediationSignoffPromoteMd: path.join(docsDir, "fcu-field-remediation-signoff-promote-latest.md"),
    fieldHandoffJson: path.join(docsDir, "fcu-field-handoff-pack-latest.json"),
    fieldHandoffMd: path.join(docsDir, "fcu-field-handoff-pack-latest.md"),
    fieldHandoffCsv: path.join(docsDir, "fcu-field-handoff-pack-latest.csv"),
    fieldReturnTemplateJson: path.join(docsDir, "fcu-field-remediation-return-template-latest.json"),
    fieldReturnTemplateMd: path.join(docsDir, "fcu-field-remediation-return-template-latest.md"),
    fieldReturnTemplateCsv: path.join(docsDir, "fcu-field-remediation-return-template-latest.csv"),
    qualityRemediationJson: path.join(docsDir, "fcu-quality-remediation-latest.json"),
    qualityRemediationMd: path.join(docsDir, "fcu-quality-remediation-latest.md"),
    qualityRemediationCsv: path.join(docsDir, "fcu-quality-remediation-latest.csv"),
    allDevicePlanJson: path.join(docsDir, "fcu-all-device-dispatch-plan-latest.json"),
    allDevicePlanMd: path.join(docsDir, "fcu-all-device-dispatch-plan-latest.md"),
    goLivePreflightJson: path.join(docsDir, "fcu-go-live-preflight-latest.json"),
    goLivePreflightMd: path.join(docsDir, "fcu-go-live-preflight-latest.md"),
    fieldArmCheckJson: path.join(docsDir, "fcu-field-arm-check-latest.json"),
    fieldArmCheckMd: path.join(docsDir, "fcu-field-arm-check-latest.md"),
    canaryExecutionPackageJson: path.join(docsDir, "fcu-canary-execution-package-latest.json"),
    canaryExecutionPackageMd: path.join(docsDir, "fcu-canary-execution-package-latest.md"),
    canaryExecutionPackageCsv: path.join(docsDir, "fcu-canary-execution-package-latest.csv"),
    baWriteAdapterReadinessJson: path.join(docsDir, "fcu-ba-write-adapter-readiness-latest.json"),
    baWriteAdapterReadinessMd: path.join(docsDir, "fcu-ba-write-adapter-readiness-latest.md"),
    baWriteAdapterReadinessCsv: path.join(docsDir, "fcu-ba-write-adapter-readiness-latest.csv"),
    canaryFeedbackMonitorJson: path.join(docsDir, "fcu-canary-feedback-monitor-latest.json"),
    canaryFeedbackMonitorMd: path.join(docsDir, "fcu-canary-feedback-monitor-latest.md"),
    canaryFeedbackMonitorCsv: path.join(docsDir, "fcu-canary-feedback-monitor-latest.csv"),
    canaryWindowJson: path.join(docsDir, "fcu-canary-window-latest.json"),
    canaryWindowMd: path.join(docsDir, "fcu-canary-window-latest.md"),
    fieldArmPackageJson: path.join(docsDir, "fcu-field-arm-package-latest.json"),
    fieldArmPackageMd: path.join(docsDir, "fcu-field-arm-package-latest.md"),
    fieldArmPackageCsv: path.join(docsDir, "fcu-field-arm-package-latest.csv")
  };
}

function readJsonReportPath(filePath, label) {
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

function runFcuCanaryWindowPackage(siteId, deviceCode, options = {}) {
  const scriptPath = fileURLToPath(new URL("../../scripts/execute-fcu-canary-window.js", import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const files = buildFcuCanaryWindowFilePaths(deviceCode, options.outputDir);
  const refreshFiles = buildFcuFinalControlRefreshFilePaths(options.outputDir);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        SITE_ID: siteId,
        FCU_CANARY_DEVICE_CODE: deviceCode,
        BFF_BASE_URL: options.bffBaseUrl || process.env.BFF_BASE_URL || "http://127.0.0.1:8787",
        FCU_CANARY_WINDOW_JSON: files.json,
        FCU_CANARY_WINDOW_MD: files.markdown,
        FCU_CANARY_EXECUTION_PACKAGE_JSON: files.executionPackageJson,
        FCU_CANARY_EXECUTION_PACKAGE_MD: files.executionPackageMd,
        FCU_CANARY_EXECUTION_PACKAGE_CSV: files.executionPackageCsv,
        FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.adapterReadinessJson,
        FCU_BA_WRITE_ADAPTER_READINESS_MD: files.adapterReadinessMd,
        FCU_BA_WRITE_ADAPTER_READINESS_CSV: files.adapterReadinessCsv,
        FCU_CANARY_DISPATCH_JSON: files.canaryDispatchJson,
        FCU_CANARY_DISPATCH_MD: files.canaryDispatchMd,
        FCU_CANARY_FEEDBACK_MONITOR_JSON: files.feedbackMonitorJson,
        FCU_CANARY_FEEDBACK_MONITOR_MD: files.feedbackMonitorMd,
        FCU_CANARY_FEEDBACK_MONITOR_CSV: files.feedbackMonitorCsv,
        FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletionJson,
        FCU_FINAL_CONTROL_COMPLETION_MD: files.finalCompletionMd,
        FCU_FINAL_CONTROL_WORKLIST_JSON: files.finalWorklistJson,
        FCU_FINAL_CONTROL_WORKLIST_MD: files.finalWorklistMd,
        FCU_QUALITY_REMEDIATION_JSON: refreshFiles.qualityRemediationJson,
        FCU_QUALITY_REMEDIATION_MD: refreshFiles.qualityRemediationMd,
        FCU_QUALITY_REMEDIATION_CSV: refreshFiles.qualityRemediationCsv,
        FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: refreshFiles.allDevicePlanJson,
        FCU_ALL_DEVICE_DISPATCH_PLAN_MD: refreshFiles.allDevicePlanMd,
        FCU_GO_LIVE_PREFLIGHT_JSON: refreshFiles.goLivePreflightJson,
        FCU_GO_LIVE_PREFLIGHT_MD: refreshFiles.goLivePreflightMd,
        FCU_FIELD_ARM_CHECK_JSON: refreshFiles.fieldArmCheckJson,
        FCU_FIELD_ARM_CHECK_MD: refreshFiles.fieldArmCheckMd,
        FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: refreshFiles.fieldRemediationCloseoutJson,
        FCU_FIELD_REMEDIATION_CLOSEOUT_MD: refreshFiles.fieldRemediationCloseoutMd,
        FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: refreshFiles.fieldRemediationCloseoutCsv,
        FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: refreshFiles.fieldRemediationWorkOrdersJson,
        FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: refreshFiles.fieldRemediationWorkOrdersMd,
        FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: refreshFiles.fieldRemediationWorkOrdersCsv,
        FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: refreshFiles.fieldRemediationExecutionPackJson,
        FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: refreshFiles.fieldRemediationExecutionPackMd,
        FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: refreshFiles.fieldRemediationExecutionPackCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: refreshFiles.fieldRemediationSignoffInputCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_CSV: refreshFiles.fieldRemediationSignoffInputCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_JSON: refreshFiles.fieldRemediationSignoffJson,
        FCU_FIELD_REMEDIATION_SIGNOFF_MD: refreshFiles.fieldRemediationSignoffMd,
        FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: refreshFiles.fieldRemediationSignoffCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: refreshFiles.fieldRemediationSignoffReleaseMatrixCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: refreshFiles.fieldRemediationSignoffCleanJson,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: refreshFiles.fieldRemediationSignoffCleanMd,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: refreshFiles.fieldRemediationSignoffCleanCurrentCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: refreshFiles.fieldRemediationSignoffCleanStaleCsv,
        FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: refreshFiles.fieldRemediationSignoffPromoteJson,
        FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: refreshFiles.fieldRemediationSignoffPromoteMd,
        FCU_FIELD_HANDOFF_PACK_JSON: refreshFiles.fieldHandoffJson,
        FCU_FIELD_HANDOFF_PACK_MD: refreshFiles.fieldHandoffMd,
        FCU_FIELD_HANDOFF_PACK_CSV: refreshFiles.fieldHandoffCsv,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: refreshFiles.fieldReturnTemplateJson,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: refreshFiles.fieldReturnTemplateMd,
        FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: refreshFiles.fieldReturnTemplateCsv,
        FCU_CANARY_READINESS_JSON: refreshFiles.canaryReadinessJson,
        FCU_CANARY_READINESS_MD: refreshFiles.canaryReadinessMd,
        FCU_SMALL_BATCH_CONFIRM: "",
        FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      stdout = stdout.slice(-8000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      stderr = stderr.slice(-8000);
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 0,
        ok: status === 0,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: normalizeRouteText(stderr).slice(-4000),
        files,
        report: readJsonReportPath(files.json, `FCU canary window ${deviceCode}`)
      });
    });
    child.on("error", (error) => {
      resolve({
        status: 1,
        ok: false,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: error instanceof Error ? error.message : String(error),
        files,
        report: readJsonReportPath(files.json, `FCU canary window ${deviceCode}`)
      });
    });
  });
}

function runFcuCanaryDispatch(siteId, deviceCode, options = {}) {
  const scriptPath = fileURLToPath(new URL("../../scripts/execute-fcu-canary-dispatch.js", import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const files = buildFcuCanaryDispatchFilePaths(deviceCode, options.outputDir);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        SITE_ID: siteId,
        FCU_CANARY_DEVICE_CODE: deviceCode,
        FCU_CANARY_COMMAND_KIND: options.commandKind || "setpoint",
        BFF_BASE_URL: options.bffBaseUrl || process.env.BFF_BASE_URL || "http://127.0.0.1:8787",
        FCU_SMALL_BATCH_CONFIRM: options.confirmPhrase || ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      stdout = stdout.slice(-8000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      stderr = stderr.slice(-8000);
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 0,
        ok: status === 0,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: normalizeRouteText(stderr).slice(-4000),
        files,
        report: readJsonReportPath(files.json, `FCU canary dispatch ${deviceCode}`)
      });
    });
    child.on("error", (error) => {
      resolve({
        status: 1,
        ok: false,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: error instanceof Error ? error.message : String(error),
        files,
        report: readJsonReportPath(files.json, `FCU canary dispatch ${deviceCode}`)
      });
    });
  });
}

async function runFcuFieldArmPackage(siteId, deviceCode, options = {}) {
  const canaryWindowResult = await runFcuCanaryWindowPackage(siteId, deviceCode, options);
  const scriptPath = fileURLToPath(new URL("../../scripts/build-fcu-field-arm-package.js", import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const files = buildFcuFieldArmPackageFilePaths(deviceCode, options.outputDir);
  const canaryFiles = buildFcuCanaryWindowFilePaths(deviceCode, options.outputDir);
  const fieldPackageResult = await new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        SITE_ID: siteId,
        FCU_CANARY_DEVICE_CODE: deviceCode,
        FCU_CANARY_WINDOW_JSON: canaryFiles.json,
        FCU_CANARY_EXECUTION_PACKAGE_JSON: canaryFiles.executionPackageJson,
        FCU_BA_WRITE_ADAPTER_READINESS_JSON: canaryFiles.adapterReadinessJson,
        FCU_CANARY_FEEDBACK_MONITOR_JSON: canaryFiles.feedbackMonitorJson,
        FCU_FIELD_ARM_PACKAGE_JSON: files.json,
        FCU_FIELD_ARM_PACKAGE_MD: files.markdown,
        FCU_FIELD_ARM_PACKAGE_CSV: files.csv,
        FCU_SMALL_BATCH_CONFIRM: "",
        FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      stdout = stdout.slice(-8000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      stderr = stderr.slice(-8000);
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 0,
        ok: status === 0,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: normalizeRouteText(stderr).slice(-4000),
        files,
        report: readJsonReportPath(files.json, `FCU field arm package ${deviceCode}`)
      });
    });
    child.on("error", (error) => {
      resolve({
        status: 1,
        ok: false,
        stdout: normalizeRouteText(stdout).slice(-4000),
        stderr: error instanceof Error ? error.message : String(error),
        files,
        report: readJsonReportPath(files.json, `FCU field arm package ${deviceCode}`)
      });
    });
  });
  return {
    status: fieldPackageResult.status,
    ok: fieldPackageResult.ok,
    controlMutation: false,
    deviceCode,
    canaryWindow: canaryWindowResult,
    fieldPackage: fieldPackageResult,
    files
  };
}

function runFcuFinalControlStatusRefresh(siteId, options = {}) {
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const files = buildFcuFinalControlRefreshFilePaths(options.outputDir);
  const scripts = [
    {
      key: "finalCompletion",
      label: "FCU final control completion",
      scriptPath: fileURLToPath(new URL("../../scripts/check-fcu-final-control-completion.js", import.meta.url))
    },
    {
      key: "finalWorklist",
      label: "FCU final control worklist",
      scriptPath: fileURLToPath(new URL("../../scripts/build-fcu-final-control-worklist.js", import.meta.url))
    },
    {
      key: "fieldArmPackage",
      label: "FCU field arm package",
      scriptPath: fileURLToPath(new URL("../../scripts/build-fcu-field-arm-package.js", import.meta.url))
    },
    {
      key: "finalControlGates",
      label: "FCU final control gates",
      scriptPath: fileURLToPath(new URL("../../scripts/check-fcu-final-control-gates.js", import.meta.url))
    },
    {
      key: "finalRunbook",
      label: "FCU final control runbook",
      scriptPath: fileURLToPath(new URL("../../scripts/build-fcu-final-control-runbook.js", import.meta.url))
    },
    {
      key: "finalControlFieldExecutionPack",
      label: "FCU final control field execution pack",
      scriptPath: fileURLToPath(new URL("../../scripts/build-fcu-final-control-field-execution-pack.js", import.meta.url))
    },
    {
      key: "evidenceConsistency",
      label: "FCU final control evidence consistency",
      scriptPath: fileURLToPath(new URL("../../scripts/check-fcu-final-control-evidence-consistency.js", import.meta.url))
    }
  ];

  function runScript(script) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [script.scriptPath], {
        cwd,
        env: {
          ...process.env,
          SITE_ID: siteId,
          BFF_BASE_URL: options.bffBaseUrl || process.env.BFF_BASE_URL || "http://127.0.0.1:8787",
          FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletionJson,
          FCU_FINAL_CONTROL_COMPLETION_MD: files.finalCompletionMd,
          FCU_FINAL_CONTROL_WORKLIST_JSON: files.finalWorklistJson,
          FCU_FINAL_CONTROL_WORKLIST_MD: files.finalWorklistMd,
          FCU_FINAL_CONTROL_RUNBOOK_JSON: files.finalRunbookJson,
          FCU_FINAL_CONTROL_RUNBOOK_MD: files.finalRunbookMd,
          FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_JSON: files.finalControlFieldExecutionPackJson,
          FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_MD: files.finalControlFieldExecutionPackMd,
          FCU_FINAL_CONTROL_FIELD_EXECUTION_PACK_CSV: files.finalControlFieldExecutionPackCsv,
          FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_JSON: files.evidenceConsistencyJson,
          FCU_FINAL_CONTROL_EVIDENCE_CONSISTENCY_MD: files.evidenceConsistencyMd,
          FCU_FINAL_CONTROL_GATES_OUTPUT_DIR: options.outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url)),
          FCU_FINAL_CONTROL_GATES_JSON: files.finalControlGatesJson,
          FCU_FINAL_CONTROL_GATES_MD: files.finalControlGatesMd,
          FCU_CANARY_READINESS_JSON: files.canaryReadinessJson,
          FCU_CANARY_READINESS_MD: files.canaryReadinessMd,
          FCU_FIELD_REMEDIATION_CLOSEOUT_JSON: files.fieldRemediationCloseoutJson,
          FCU_FIELD_REMEDIATION_CLOSEOUT_MD: files.fieldRemediationCloseoutMd,
          FCU_FIELD_REMEDIATION_CLOSEOUT_CSV: files.fieldRemediationCloseoutCsv,
          FCU_FIELD_REMEDIATION_WORK_ORDERS_JSON: files.fieldRemediationWorkOrdersJson,
          FCU_FIELD_REMEDIATION_WORK_ORDERS_MD: files.fieldRemediationWorkOrdersMd,
          FCU_FIELD_REMEDIATION_WORK_ORDERS_CSV: files.fieldRemediationWorkOrdersCsv,
          FCU_FIELD_REMEDIATION_EXECUTION_PACK_JSON: files.fieldRemediationExecutionPackJson,
          FCU_FIELD_REMEDIATION_EXECUTION_PACK_MD: files.fieldRemediationExecutionPackMd,
          FCU_FIELD_REMEDIATION_EXECUTION_PACK_CSV: files.fieldRemediationExecutionPackCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_INPUT_CSV: files.fieldRemediationSignoffInputCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_CSV: files.fieldRemediationSignoffInputCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_JSON: files.fieldRemediationSignoffJson,
          FCU_FIELD_REMEDIATION_SIGNOFF_MD: files.fieldRemediationSignoffMd,
          FCU_FIELD_REMEDIATION_SIGNOFF_REPORT_CSV: files.fieldRemediationSignoffCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_RELEASE_MATRIX_CSV: files.fieldRemediationSignoffReleaseMatrixCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_JSON: files.fieldRemediationSignoffCleanJson,
          FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_MD: files.fieldRemediationSignoffCleanMd,
          FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_CURRENT_CSV: files.fieldRemediationSignoffCleanCurrentCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_CLEAN_STALE_CSV: files.fieldRemediationSignoffCleanStaleCsv,
          FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_JSON: files.fieldRemediationSignoffPromoteJson,
          FCU_FIELD_REMEDIATION_SIGNOFF_PROMOTE_MD: files.fieldRemediationSignoffPromoteMd,
          FCU_FIELD_HANDOFF_PACK_JSON: files.fieldHandoffJson,
          FCU_FIELD_HANDOFF_PACK_MD: files.fieldHandoffMd,
          FCU_FIELD_HANDOFF_PACK_CSV: files.fieldHandoffCsv,
          FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_JSON: files.fieldReturnTemplateJson,
          FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_MD: files.fieldReturnTemplateMd,
          FCU_FIELD_REMEDIATION_RETURN_TEMPLATE_CSV: files.fieldReturnTemplateCsv,
          FCU_QUALITY_REMEDIATION_JSON: files.qualityRemediationJson,
          FCU_QUALITY_REMEDIATION_MD: files.qualityRemediationMd,
          FCU_QUALITY_REMEDIATION_CSV: files.qualityRemediationCsv,
          FCU_ALL_DEVICE_DISPATCH_PLAN_JSON: files.allDevicePlanJson,
          FCU_ALL_DEVICE_DISPATCH_PLAN_MD: files.allDevicePlanMd,
          FCU_GO_LIVE_PREFLIGHT_JSON: files.goLivePreflightJson,
          FCU_GO_LIVE_PREFLIGHT_MD: files.goLivePreflightMd,
          FCU_FIELD_ARM_CHECK_JSON: files.fieldArmCheckJson,
          FCU_FIELD_ARM_CHECK_MD: files.fieldArmCheckMd,
          FCU_CANARY_EXECUTION_PACKAGE_JSON: files.canaryExecutionPackageJson,
          FCU_CANARY_EXECUTION_PACKAGE_MD: files.canaryExecutionPackageMd,
          FCU_CANARY_EXECUTION_PACKAGE_CSV: files.canaryExecutionPackageCsv,
          FCU_BA_WRITE_ADAPTER_READINESS_JSON: files.baWriteAdapterReadinessJson,
          FCU_BA_WRITE_ADAPTER_READINESS_MD: files.baWriteAdapterReadinessMd,
          FCU_BA_WRITE_ADAPTER_READINESS_CSV: files.baWriteAdapterReadinessCsv,
          FCU_CANARY_FEEDBACK_MONITOR_JSON: files.canaryFeedbackMonitorJson,
          FCU_CANARY_FEEDBACK_MONITOR_MD: files.canaryFeedbackMonitorMd,
          FCU_CANARY_FEEDBACK_MONITOR_CSV: files.canaryFeedbackMonitorCsv,
          FCU_CANARY_WINDOW_JSON: files.canaryWindowJson,
          FCU_CANARY_WINDOW_MD: files.canaryWindowMd,
          FCU_FIELD_ARM_PACKAGE_JSON: files.fieldArmPackageJson,
          FCU_FIELD_ARM_PACKAGE_MD: files.fieldArmPackageMd,
          FCU_FIELD_ARM_PACKAGE_CSV: files.fieldArmPackageCsv,
          FCU_SMALL_BATCH_CONFIRM: "",
          FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: ""
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
        stdout = stdout.slice(-8000);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
        stderr = stderr.slice(-8000);
      });
      child.on("close", (status) => {
        resolve({
          key: script.key,
          label: script.label,
          status: status ?? 0,
          ok: status === 0,
          stdout: normalizeRouteText(stdout).slice(-4000),
          stderr: normalizeRouteText(stderr).slice(-4000)
        });
      });
      child.on("error", (error) => {
        resolve({
          key: script.key,
          label: script.label,
          status: 1,
          ok: false,
          stdout: normalizeRouteText(stdout).slice(-4000),
          stderr: error instanceof Error ? error.message : String(error)
        });
      });
    });
  }

  return scripts.reduce(
    async (previous, script) => {
      const results = await previous;
      const result = await runScript(script);
      results.push(result);
      return results;
    },
    Promise.resolve([])
  ).then((results) => ({ results, files }));
}

function runFcuFinalControlRollout(siteId, options = {}) {
  const scriptPath = fileURLToPath(new URL("../../scripts/execute-fcu-final-control-rollout.js", import.meta.url));
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const files = buildFcuFinalControlRefreshFilePaths(options.outputDir);
  const rolloutJson = path.join(options.outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url)), "fcu-final-control-rollout-latest.json");
  const rolloutMd = path.join(options.outputDir || fileURLToPath(new URL("../../../../docs/", import.meta.url)), "fcu-final-control-rollout-latest.md");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: {
        ...process.env,
        SITE_ID: siteId,
        BFF_BASE_URL: options.bffBaseUrl || process.env.BFF_BASE_URL || "http://127.0.0.1:8787",
        FCU_SMALL_BATCH_CONFIRM: options.smallBatchConfirm || "",
        FCU_FINAL_CONTROL_ROLLOUT_CONFIRM: options.finalRolloutConfirm || "",
        FCU_FINAL_CONTROL_ROLLOUT_JSON: rolloutJson,
        FCU_FINAL_CONTROL_ROLLOUT_MD: rolloutMd,
        FCU_FINAL_CONTROL_COMPLETION_JSON: files.finalCompletionJson,
        FCU_FINAL_CONTROL_COMPLETION_MD: files.finalCompletionMd,
        FCU_FINAL_CONTROL_WORKLIST_JSON: files.finalWorklistJson,
        FCU_FINAL_CONTROL_WORKLIST_MD: files.finalWorklistMd
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      stdout = stdout.slice(-10000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      stderr = stderr.slice(-10000);
    });
    child.on("close", (status) => {
      resolve({
        status: status ?? 0,
        ok: status === 0,
        stdout: normalizeRouteText(stdout).slice(-5000),
        stderr: normalizeRouteText(stderr).slice(-5000),
        files: {
          ...files,
          finalRolloutJson: rolloutJson,
          finalRolloutMd: rolloutMd
        },
        report: readJsonReportPath(rolloutJson, "FCU final control rollout")
      });
    });
    child.on("error", (error) => {
      resolve({
        status: 1,
        ok: false,
        stdout: normalizeRouteText(stdout).slice(-5000),
        stderr: error instanceof Error ? error.message : String(error),
        files: {
          ...files,
          finalRolloutJson: rolloutJson,
          finalRolloutMd: rolloutMd
        },
        report: readJsonReportPath(rolloutJson, "FCU final control rollout")
      });
    });
  });
}

function buildRequestBaseUrl(req) {
  const protocol = req.protocol || "http";
  const host = req.get?.("host") || `127.0.0.1:${req.socket?.localPort || 8787}`;
  return `${protocol}://${host}`;
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

  function buildConfigCenterRuntimePayload(siteId, payload, kind) {
    const generatedAt = payload?.generatedAt || new Date().toISOString();
    const freshnessBase = computeFreshnessState(generatedAt, config.staleThresholdHours || 6);
    const freshness = {
      label: freshnessBase.stale ? "stale" : "fresh",
      ...freshnessBase
    };
    const items = Array.isArray(payload?.items)
      ? payload.items.map((item) => {
          const enabled = item.status === "enabled";
          return {
            ...item,
            kpis: enabled ? item.kpis || [] : [],
            alarmCount: enabled ? item.alarmCount ?? 0 : null,
            advisorBindings: enabled ? item.advisorBindings || [] : []
          };
        })
      : [];
    const site = adminStore?.getSite ? adminStore.getSite(siteId) : null;
    return {
      site: {
        siteId,
        siteName: site?.siteName || siteId
      },
      generatedAt,
      kind,
      items,
      total: items.length,
      freshness,
      sourceStatus: buildSourceStatus([
        {
          key: "configurationCenter",
          endpoint: `/admin/v1/sites/${siteId}/${kind}`,
          ok: true,
          fallback: false,
          rows: items.length,
          message: "Published subsystem configuration"
        }
      ])
    };
  }

  router.get("/sites/:siteId/capabilities", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    if (!adminStore?.getSiteCapabilities) {
      res.status(503).json({
        ok: false,
        code: "CONFIG_CENTER_UNAVAILABLE",
        error: "Configuration center store is unavailable",
        requestId: `req-${Date.now()}`
      });
      return;
    }
    const payload = adminStore.getSiteCapabilities(siteId, {
      publishedOnly: true
    });
    res.json(buildConfigCenterRuntimePayload(siteId, payload, "capabilities"));
  });

  router.get("/sites/:siteId/subsystems", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    if (!adminStore?.listSiteSubsystems) {
      res.status(503).json({
        ok: false,
        code: "CONFIG_CENTER_UNAVAILABLE",
        error: "Configuration center store is unavailable",
        requestId: `req-${Date.now()}`
      });
      return;
    }
    const payload = adminStore.listSiteSubsystems(siteId, {
      publishedOnly: true
    });
    res.json(buildConfigCenterRuntimePayload(siteId, payload, "subsystems"));
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

  router.get("/sites/:siteId/power-monitoring/byx", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    const data = await getByxPowerMonitoring(config, siteId);
    res.json(data);
  });

  router.get("/sites/:siteId/power-monitoring/byx/assignment.csv", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    const data = await getByxPowerMonitoring(config, siteId);
    if (!data.ok) {
      res.status(data.configured === false ? 400 : 502).json(data);
      return;
    }
    const csv = buildByxPowerAssignmentCsv(data);
    const filename = `byx-power-assignment-${siteId}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(`\uFEFF${csv}`);
  });

  router.get("/sites/:siteId/power-monitoring/byx/assignment-check", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    const result = await checkByxPowerAssignments(config, siteId, {
      minConfirmed: req.query.minConfirmed
    });
    res.json(result);
  });

  router.get("/sites/:siteId/power-monitoring/byx/history", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    res.json(getByxPowerHistory(config, siteId, { limit: req.query.limit }));
  });

  router.post("/sites/:siteId/power-monitoring/byx/history/snapshots", async (req, res) => {
    const siteId = resolveConfigCenterRuntimeSiteId(req, config.defaultSiteId);
    const data = await getByxPowerMonitoring(config, siteId);
    if (!data.ok) {
      res.status(data.configured === false ? 400 : 502).json(data);
      return;
    }
    res.json(appendByxPowerHistorySnapshot(config, siteId, data, {
      limit: req.body?.limit,
      responseLimit: req.body?.responseLimit
    }));
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

  router.get("/sites/:siteId/hvac-terminal/fan-coils", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const minIntervalSeconds =
      typeof req.query.sampleMinIntervalSec === "string" ? Number(req.query.sampleMinIntervalSec) : undefined;
    const data = await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    });
    let historySampling = {
      enabled: false,
      status: "unavailable",
      reason: "admin sample store is not enabled"
    };
    if (req.query.sample !== "0" && adminStore?.appendHvacTerminalSnapshotSamples) {
      try {
        historySampling = {
          enabled: true,
          ...adminStore.appendHvacTerminalSnapshotSamples(
            siteId,
            data,
            { userId: requestContext.userId, username: requestContext.username },
            {
              floor,
              minIntervalSeconds,
              requestId: req.requestId,
              audit: false
            }
          )
        };
      } catch (error) {
        historySampling = {
          enabled: true,
          status: "failed",
          reason: error instanceof Error ? error.message : "hvac terminal sample append failed"
        };
      }
    }
    res.json({
      ...data,
      historySampling
    });
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/history", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 240;
    if (!adminStore?.listHvacTerminalSampleTimeline) {
      res.json({
        site: {
          siteId,
          siteName: siteId
        },
        generatedAt: new Date().toISOString(),
        subsystemType: "hvac_terminal",
        equipmentType: "fan_coil",
        floor,
        floorName: floor === "1" ? "10楼" : `${floor}楼`,
        items: [],
        totalSamples: 0,
        sourceStatus: {
          overall: "unavailable",
          entries: []
        }
      });
      return;
    }
    const history = adminStore.listHvacTerminalSampleTimeline(siteId, {
      floor,
      limit
    });
    res.json({
      site: {
        siteId,
        siteName: siteId
      },
      generatedAt: new Date().toISOString(),
      subsystemType: "hvac_terminal",
      equipmentType: "fan_coil",
      building: "盛世绿能办公楼",
      floor,
      floorName: floor === "1" ? "10楼" : `${floor}楼`,
      ...history,
      sourceStatus: {
        overall: "ok",
        entries: [
          {
            key: "fanCoilSampleHistory",
            ok: true,
            status: "ok",
            message: "FCU append-only samples from admin-db"
          }
        ]
      }
    });
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/control-policy", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const record = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(record?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const finalDispatchGate = buildFcuFinalDispatchGate(
      readFcuFinalControlEvidence(buildFcuFinalControlRefreshFilePaths(config.fcuFinalControlOutputDir))
    );
    res.json({
      site: {
        siteId
      },
      generatedAt: new Date().toISOString(),
      subsystemType: "hvac_terminal",
      equipmentType: "fan_coil",
      policy,
      executionGate,
      finalDispatchGate,
      persisted: Boolean(record),
      sourceStatus: {
        overall: record ? "ok" : "default",
        entries: [
          {
            key: "fcuControlPolicy",
            ok: true,
            status: record ? "ok" : "default",
            message: record ? "FCU control policy from admin-db" : "Default FCU shadow policy"
          }
        ]
      }
    });
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/control-records", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const list = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          deviceCode: typeof req.query.deviceCode === "string" ? req.query.deviceCode : "",
          status: typeof req.query.status === "string" ? req.query.status : "",
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
      subsystemType: "hvac_terminal",
      equipmentType: "fan_coil",
      ...list
    });
  });

  function readFcuDeviceCode(req) {
    const value = req.body?.deviceCode ?? req.body?.device ?? req.query.deviceCode ?? req.query.device;
    if (typeof value !== "string" && typeof value !== "number") {
      return "";
    }
    return String(value).trim();
  }

  function filterFanCoilSnapshotByDevice(snapshot, deviceCode) {
    const normalizedDeviceCode = String(deviceCode || "").trim();
    if (!normalizedDeviceCode) {
      return snapshot;
    }
    const normalizedTarget = normalizedDeviceCode.toLowerCase();
    const items = Array.isArray(snapshot?.items)
      ? snapshot.items.filter((item) =>
          [item?.deviceCode, item?.deviceId, item?.deviceName]
            .map((value) => String(value || "").trim().toLowerCase())
            .includes(normalizedTarget)
        )
      : [];
    return {
      ...snapshot,
      items,
      summary: {
        ...(snapshot?.summary || {}),
        total: items.length
      },
      targetDeviceCode: normalizedDeviceCode
    };
  }

  function readHvacTerminalCapability(siteId) {
    if (!adminStore?.getSiteCapabilities) {
      return null;
    }
    const payload = adminStore.getSiteCapabilities(siteId, {
      publishedOnly: true
    });
    return payload?.items?.find((item) => item.subsystemType === "hvac_terminal") || null;
  }

  function buildFcuAuthorizationWindowState(authorization) {
    const startText = normalizeRouteText(authorization?.siteAuthorizationWindowStart);
    const endText = normalizeRouteText(authorization?.siteAuthorizationWindowEnd);
    const startMs = Date.parse(startText);
    const endMs = Date.parse(endText);
    const nowMs = Date.now();
    const configured = Boolean(startText && endText);
    const valid = configured && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
    return {
      configured,
      valid,
      active: valid && nowMs >= startMs && nowMs <= endMs,
      start: startText || null,
      end: endText || null,
      now: new Date(nowMs).toISOString()
    };
  }

  function buildFcuExecutionGate(policy, capability) {
    const normalizedPolicy = normalizeFcuControlPolicy(policy || {});
    const boundary = capability?.controlBoundary || null;
    const adapterConfigured = isFcuControlWriteAdapterConfigured(normalizedPolicy);
    const authorization = normalizedPolicy.fieldAuthorization || {};
    const authorizationOwnerReady = Boolean(
      normalizeRouteText(authorization.siteAuthorizationBy) &&
        normalizeRouteText(authorization.commissioningOwner) &&
        normalizeRouteText(authorization.baOwner)
    );
    const authorizationWindow = buildFcuAuthorizationWindowState(authorization);
    const conditions = [
      {
        key: "policy_enabled",
        label: "FCU策略启用",
        ok: normalizedPolicy.enabled === true
      },
      {
        key: "mode_enforced",
        label: "控制模式为自动闭环",
        ok: normalizedPolicy.defaultMode === "enforced"
      },
      {
        key: "subsystem_write_enabled",
        label: "空调末端子系统写总闸",
        ok: boundary?.writeEnabled === true
      },
      {
        key: "dispatch_adapter_configured",
        label: "BA写适配器已配置",
        ok: adapterConfigured
      },
      {
        key: "whitelist_not_empty",
        label: "单台白名单非空",
        ok: normalizedPolicy.whitelist.length > 0
      },
      {
        key: "site_authorization_approved",
        label: "现场授权已批准",
        ok: authorization.siteAuthorizationStatus === "approved"
      },
      {
        key: "site_authorization_owner_recorded",
        label: "现场授权责任人已记录",
        ok: authorizationOwnerReady
      },
      {
        key: "site_authorization_window_configured",
        label: "现场授权窗口已配置",
        ok: authorizationWindow.configured && authorizationWindow.valid
      },
      {
        key: "site_authorization_window_active",
        label: "现场授权窗口当前有效",
        ok: authorizationWindow.active
      },
      {
        key: "ba_write_confirm_armed",
        label: "BA写入确认已装载",
        ok: authorization.baWriteConfirmArmed === true
      },
      {
        key: "final_rollout_confirm_armed",
        label: "最终控制总确认已装载",
        ok: authorization.finalRolloutConfirmArmed === true
      },
      {
        key: "backend_not_readonly",
        label: "后端环境允许真实写入",
        ok: config.readOnlyMode !== true
      }
    ];
    const blockedReasons = conditions.filter((item) => !item.ok).map((item) => item.key);
    return {
      ready: blockedReasons.length === 0,
      dispatchAllowed: blockedReasons.length === 0,
      readOnlyMode: config.readOnlyMode === true,
      subsystemWriteEnabled: boundary?.writeEnabled === true,
      boundaryMode: boundary?.mode || "read_only",
      policyMode: normalizedPolicy.defaultMode,
      adapterConfigured,
      whitelistCount: normalizedPolicy.whitelist.length,
      authorizationStatus: authorization.siteAuthorizationStatus,
      authorizationOwnerReady,
      authorizationWindowConfigured: authorizationWindow.configured && authorizationWindow.valid,
      authorizationWindowActive: authorizationWindow.active,
      authorizationWindowStart: authorizationWindow.start,
      authorizationWindowEnd: authorizationWindow.end,
      authorizationWindowNow: authorizationWindow.now,
      baWriteConfirmArmed: authorization.baWriteConfirmArmed === true,
      finalRolloutConfirmArmed: authorization.finalRolloutConfirmArmed === true,
      sourceStatus: capability?.sourceStatus || capability?.freshnessStatus || null,
      conditions,
      blockedReasons
    };
  }

  function buildFcuCommissioningReport(commissioningItems, executionGate) {
    const items = Array.isArray(commissioningItems) ? commissioningItems : [];
    const conditionCounts = new Map();
    for (const item of items) {
      for (const condition of Array.isArray(item?.conditions) ? item.conditions : []) {
        if (condition.ok) {
          continue;
        }
        const key = condition.key || "unknown";
        const current = conditionCounts.get(key) || {
          key,
          label: condition.label || key,
          count: 0,
          deviceCodes: []
        };
        current.count += 1;
        const deviceCode = item?.device?.deviceCode || item?.device?.deviceId || item?.device?.deviceName || "";
        if (deviceCode && current.deviceCodes.length < 20) {
          current.deviceCodes.push(deviceCode);
        }
        conditionCounts.set(key, current);
      }
    }
    const deviceReadyItems = items.filter((item) => item.deviceReady === true);
    const deviceBlockedItems = items.filter((item) => item.status === "blocked");
    const canDispatchItems = items.filter((item) => item.canDispatch === true);
    const nextActions = [];
    if (deviceBlockedItems.length > 0) {
      nextActions.push({
        priority: "P0",
        action: "处理单台质量阻断",
        target: `${deviceBlockedItems.length}台 FCU`,
        reason: "通讯报警、温度无效、写点缺失或反馈锁定会阻断自动/手动确认下发。"
      });
    }
    if (executionGate?.dispatchAllowed !== true) {
      nextActions.push({
        priority: deviceReadyItems.length > 0 ? "P0" : "P1",
        action: "打开全局投运闸门",
        target: "后端只读总闸 / 子系统写总闸 / BA适配器",
        reason: (executionGate?.blockedReasons || []).join(" / ") || "全局投运条件未满足。"
      });
    }
    if (canDispatchItems.length > 0) {
      nextActions.push({
        priority: "P1",
        action: "逐台小批量确认下发",
        target: `${canDispatchItems.length}台 FCU`,
        reason: "先选 1-2 台低风险区域执行设定值或风速命令，完成反馈校验后再扩大白名单。"
      });
    }
    if (nextActions.length === 0) {
      nextActions.push({
        priority: "P2",
        action: "保持监测",
        target: "FCU 控制链路",
        reason: "当前没有可下发命令或阻断项，等待新的控制周期建议。"
      });
    }
    const verdict =
      items.length === 0
        ? "no_devices"
        : canDispatchItems.length > 0
          ? "ready_for_control"
          : deviceReadyItems.length > 0
            ? "environment_blocked"
            : "device_commissioning_required";
    return {
      verdict,
      generatedAt: new Date().toISOString(),
      summaryText:
        verdict === "ready_for_control"
          ? `${canDispatchItems.length}台 FCU 已具备真实下发条件，建议先小批量投运。`
          : verdict === "environment_blocked"
            ? `${deviceReadyItems.length}台 FCU 设备侧就绪，但全局投运闸门仍阻断真实写入。`
            : verdict === "device_commissioning_required"
              ? `${deviceBlockedItems.length}台 FCU 仍需处理单台通讯、温度或写点问题。`
              : "未读取到 FCU 设备，不能进入投运。",
      conditionBlockers: Array.from(conditionCounts.values()).sort((a, b) => b.count - a.count),
      releaseCandidateDeviceCodes: deviceReadyItems
        .map((item) => item.device?.deviceCode || item.device?.deviceId || item.device?.deviceName)
        .filter(Boolean),
      blockedDeviceCodes: deviceBlockedItems
        .map((item) => item.device?.deviceCode || item.device?.deviceId || item.device?.deviceName)
        .filter(Boolean),
      nextActions
    };
  }

  function pushFcuArmCheck(checks, key, label, ok, severity, message, detail = {}) {
    checks.push({
      key,
      label,
      ok: ok === true,
      severity,
      message,
      ...detail
    });
  }

  function buildFcuFieldArmNextActions({ blockers, firstCanary, executionGate }) {
    const items = [];
    const blockerKeys = new Set((Array.isArray(blockers) ? blockers : []).map((item) => item.key));
    const blockedReasons = Array.isArray(executionGate?.blockedReasons) ? executionGate.blockedReasons : [];
    if (blockerKeys.has("backend_write_gate") || blockedReasons.includes("backend_not_readonly")) {
      items.push({
        priority: "P0",
        action: "关闭后端只读总闸并重启 BFF",
        target: "READ_ONLY_MODE / CHILLER_READ_ONLY_MODE",
        reason: "当前 BFF /healthz 仍显示 readOnlyMode=true，任何确认下发都只能被记录为只读保护。"
      });
    }
    if (blockerKeys.has("execution_gate_open") && blockedReasons.includes("subsystem_write_enabled")) {
      items.push({
        priority: "P0",
        action: "打开空调末端子系统写总闸",
        target: "hvac_terminal controlBoundary.writeEnabled",
        reason: "子系统写边界未打开时，即使后端非只读也不能向 BA 下发。"
      });
    }
    if (blockerKeys.has("execution_gate_open") && blockedReasons.includes("dispatch_adapter_configured")) {
      items.push({
        priority: "P0",
        action: "配置 BA 写适配器",
        target: "dispatchAdapter",
        reason: "没有写适配器时不能把 FCU 命令转换为上位机/BA 执行请求。"
      });
    }
    if (blockerKeys.has("execution_gate_open") && blockedReasons.includes("whitelist_not_empty")) {
      items.push({
        priority: "P0",
        action: "配置单台 FCU 白名单",
        target: "fcuControlPolicy.whitelist",
        reason: "最终控制必须逐台授权，不能对未知设备批量开放。"
      });
    }
    if (firstCanary) {
      items.push({
        priority: blockerKeys.size > 0 ? "P1" : "P0",
        action: blockerKeys.size > 0 ? "重跑 Arm-Check 后执行 Canary 首台" : "执行 Canary 首台真实下发",
        target: firstCanary,
        reason: "只允许先下发单台设定或风速命令；反馈校验通过后再进入下一台。"
      });
    }
    items.push({
      priority: "P0",
      action: "反馈校验与失败回退",
      target: "control-record verify-feedback / rollback",
      reason: "真实下发后必须在 60-120 秒内校验设定反馈；不一致时锁定设备并回退。"
    });
    return items;
  }

  function buildFcuGateActionPlan({ blockingItems, executionGate, authorizationGate, fieldArmCheck, targetDeviceCode }) {
    const items = [];
    const blockers = Array.isArray(blockingItems) ? blockingItems : [];
    const blockerKeys = new Set(blockers.map((item) => item.key));
    const blockedReasons = Array.isArray(executionGate?.blockedReasons) ? executionGate.blockedReasons : [];
    const push = (key, patch) => {
      if (items.some((item) => item.key === key)) {
        return;
      }
      items.push({
        key,
        priority: "P0",
        phase: "authorization",
        owner: "平台工程师",
        action: key,
        target: targetDeviceCode || "FCU",
        reason: "",
        acceptance: "",
        writesControl: false,
        ...patch
      });
    };

    if (blockerKeys.has("site_authorization_approved") || blockedReasons.includes("site_authorization_approved")) {
      push("site_authorization_approved", {
        phase: "authorization",
        owner: "现场负责人 / 值班长",
        action: "在 3002 批准 FCU 现场授权",
        target: "fieldAuthorization.siteAuthorizationStatus=approved",
        reason: "未批准现场授权时，平台不能进入真实 BA 写入流程。",
        acceptance: "BFF control-policy authorizationStatus=approved，field-preflight authorizationGate.ready 不再因现场授权阻断。"
      });
    }
    if (blockerKeys.has("site_authorization_owner_recorded") || blockedReasons.includes("site_authorization_owner_recorded")) {
      push("site_authorization_owner_recorded", {
        phase: "authorization",
        owner: "现场负责人 / 平台工程师 / BA工程师",
        action: "在 3002 补齐授权确认人、投运负责人和 BA 负责人",
        target: "fieldAuthorization.siteAuthorizationBy / commissioningOwner / baOwner",
        reason: "最终控制必须能追溯现场授权、平台执行和 BA 写点责任人。",
        acceptance: "BFF executionGate.authorizationOwnerReady=true，field-preflight 不再因责任人缺失阻断。"
      });
    }
    if (blockerKeys.has("site_authorization_window_configured") || blockedReasons.includes("site_authorization_window_configured")) {
      push("site_authorization_window_configured", {
        phase: "authorization",
        owner: "现场负责人 / 平台工程师",
        action: "在 3002 配置 FCU 真实写入授权窗口",
        target: "fieldAuthorization.siteAuthorizationWindowStart / siteAuthorizationWindowEnd",
        reason: "真实 BA 写入必须限定现场值守窗口，不能长期裸开。",
        acceptance: "BFF executionGate.authorizationWindowConfigured=true，且返回授权窗口起止时间。"
      });
    }
    if (blockerKeys.has("site_authorization_window_active") || blockedReasons.includes("site_authorization_window_active")) {
      push("site_authorization_window_active", {
        phase: "authorization",
        owner: "现场负责人 / 平台工程师",
        action: "调整或等待 FCU 真实写入授权窗口生效",
        target: "fieldAuthorization.siteAuthorizationWindowStart / siteAuthorizationWindowEnd",
        reason: "真实 BA 写入只能在现场值守授权窗口内执行。",
        acceptance: "BFF executionGate.authorizationWindowActive=true，field-preflight 不再因窗口未生效阻断。"
      });
    }
    if (blockerKeys.has("ba_write_confirm_armed") || blockedReasons.includes("ba_write_confirm_armed")) {
      push("ba_write_confirm_armed", {
        phase: "authorization",
        owner: "BA工程师 / 平台工程师",
        action: "在 3002 记录 BA 写入确认已装载",
        target: "fieldAuthorization.baWriteConfirmArmed=true",
        reason: "真实写入确认短语不入库，但系统必须记录确认短语已由现场安全装载。",
        acceptance: "BFF executionGate.baWriteConfirmArmed=true，Canary 执行仍需请求体提供确认短语。",
        writesControl: false
      });
    }
    if (blockerKeys.has("final_rollout_confirm_armed") || blockedReasons.includes("final_rollout_confirm_armed")) {
      push("final_rollout_confirm_armed", {
        phase: "authorization",
        owner: "项目负责人 / 平台工程师",
        action: "在 3002 记录最终控制总确认已装载",
        target: "fieldAuthorization.finalRolloutConfirmArmed=true",
        reason: "全量最终控制编排必须二次确认，避免越过 Canary/小批量顺序。",
        acceptance: "BFF executionGate.finalRolloutConfirmArmed=true，final-control-rollout 仍需请求体提供总确认短语。"
      });
    }
    if (blockerKeys.has("backend_write_gate") || blockedReasons.includes("backend_not_readonly")) {
      push("backend_write_gate", {
        phase: "environment",
        owner: "平台运维 / 自控工程师",
        action: "在现场值守窗口关闭 BFF 只读总闸并重启",
        target: "READ_ONLY_MODE=false / CHILLER_READ_ONLY_MODE=false",
        reason: "当前后端只读，所有确认下发都会被阻断，不会产生 BA/PLC 写入。",
        acceptance: "BFF /healthz 或 final-control-status 显示 readOnlyMode=false，fieldArmCheck backend_write_gate=true。"
      });
    }
    if (blockerKeys.has("subsystem_write_enabled") || blockedReasons.includes("subsystem_write_enabled")) {
      push("subsystem_write_enabled", {
        phase: "environment",
        owner: "配置管理员",
        action: "打开空调末端子系统写总闸",
        target: "hvac_terminal.controlBoundary.writeEnabled=true",
        reason: "子系统写边界关闭时，即使后端非只读也不能下发 FCU 命令。",
        acceptance: "BFF executionGate.subsystemWriteEnabled=true。"
      });
    }
    if (blockerKeys.has("dispatch_adapter_configured") || blockedReasons.includes("dispatch_adapter_configured")) {
      push("dispatch_adapter_configured", {
        phase: "environment",
        owner: "BA工程师 / 平台工程师",
        action: "配置并验证 BA 写适配器",
        target: "fcuControlPolicy.dispatchAdapter",
        reason: "没有适配器时，平台命令不能转换为 BA/上位机写点请求。",
        acceptance: "dispatchAdapter=legacy-scene-command，BA 写适配器自检包 verdict=adapter_ready。"
      });
    }
    if (blockerKeys.has("whitelist_not_empty") || blockedReasons.includes("whitelist_not_empty")) {
      push("whitelist_not_empty", {
        phase: "authorization",
        owner: "配置管理员 / 暖通工程师",
        action: "补齐 FCU 单台白名单",
        target: "fcuControlPolicy.whitelist",
        reason: "最终控制必须逐台授权，不能对未知 FCU 批量开放。",
        acceptance: "control-policy whitelistCount 覆盖目标 FCU，commissioning-status 不再出现 not_whitelisted。"
      });
    }
    if (blockerKeys.has("execution_gate_open")) {
      push("execution_gate_open", {
        phase: "field_arm",
        owner: "平台工程师",
        action: "重跑现场 Arm-Check",
        target: fieldArmCheck?.firstCanary || targetDeviceCode || "首台 Canary",
        reason: "授权、确认短语和环境总闸变化后必须重新计算现场开闸状态。",
        acceptance: "field-preflight verdict=canary_ready 或 fieldArmCheck.verdict=field_arm_ready。"
      });
    }
    if (blockerKeys.has("device_readiness") || blockerKeys.has("communication_ok") || blockerKeys.has("temperature_valid")) {
      push("device_readiness", {
        phase: "device_quality",
        owner: "BA工程师 / 现场值班",
        action: "处理当前 FCU 通讯、温度或写点质量阻断",
        target: targetDeviceCode || "当前 FCU",
        reason: "通讯报警、0°C/越界温度、写点缺失或反馈锁定会阻断单台确认下发。",
        acceptance: "commissioningStatus.deviceReady=true，blockedReasons 为空。"
      });
    }
    if (authorizationGate?.ready === true && executionGate?.dispatchAllowed === true && fieldArmCheck?.ok === true) {
      push("execute_canary", {
        priority: "P0",
        phase: "canary",
        owner: "平台工程师 + 现场值班",
        action: "执行首台 Canary 真实下发并校验反馈",
        target: fieldArmCheck?.firstCanary || targetDeviceCode || "首台 FCU",
        reason: "最终控制必须先完成单台真实下发和反馈确认，再扩大到小批量。",
        acceptance: "control-record status=feedback_confirmed，final-control-status canary.ok=true。",
        writesControl: true
      });
    }
    return items;
  }

  function buildFcuFieldArmCheck({ policy, executionGate, commissioningSummary, firstCanary }) {
    const checks = [];
    const normalizedPolicy = normalizeFcuControlPolicy(policy || {});
    const authorizationWindow = buildFcuAuthorizationWindowState(normalizedPolicy.fieldAuthorization);
    pushFcuArmCheck(checks, "backend_write_gate", "后端写入总闸", config.readOnlyMode !== true, "P0", config.readOnlyMode === true ? "当前后端处于只读模式。" : "后端允许真实写入。");
    pushFcuArmCheck(checks, "policy_enforced", "FCU策略自动闭环", normalizedPolicy.enabled === true && normalizedPolicy.defaultMode === "enforced", "P0", `enabled=${normalizedPolicy.enabled}, mode=${normalizedPolicy.defaultMode}`);
    pushFcuArmCheck(checks, "adapter_configured", "BA写适配器", isFcuControlWriteAdapterConfigured(normalizedPolicy), "P0", `dispatchAdapter=${normalizedPolicy.dispatchAdapter || "none"}`);
    pushFcuArmCheck(checks, "whitelist_present", "白名单覆盖", normalizedPolicy.whitelist.length > 0, "P0", `白名单 ${normalizedPolicy.whitelist.length} 台。`);
    pushFcuArmCheck(checks, "site_authorization_approved", "现场授权批准", normalizedPolicy.fieldAuthorization.siteAuthorizationStatus === "approved", "P0", `authorization=${normalizedPolicy.fieldAuthorization.siteAuthorizationStatus}`);
    pushFcuArmCheck(
      checks,
      "site_authorization_owner_recorded",
      "授权责任人记录",
      Boolean(
        normalizeRouteText(normalizedPolicy.fieldAuthorization.siteAuthorizationBy) &&
          normalizeRouteText(normalizedPolicy.fieldAuthorization.commissioningOwner) &&
          normalizeRouteText(normalizedPolicy.fieldAuthorization.baOwner)
      ),
      "P0",
      "必须记录授权确认人、投运负责人和 BA 负责人。"
    );
    pushFcuArmCheck(
      checks,
      "site_authorization_window_configured",
      "授权窗口配置",
      Boolean(
        authorizationWindow.configured && authorizationWindow.valid
      ),
      "P0",
      "必须配置现场值守授权窗口开始和结束时间。"
    );
    pushFcuArmCheck(
      checks,
      "site_authorization_window_active",
      "授权窗口当前有效",
      authorizationWindow.active,
      "P0",
      authorizationWindow.active ? "当前时间处于授权窗口内。" : `当前时间不在授权窗口内：now=${authorizationWindow.now}, start=${authorizationWindow.start || "--"}, end=${authorizationWindow.end || "--"}`
    );
    pushFcuArmCheck(checks, "ba_write_confirm_armed", "BA确认短语装载", normalizedPolicy.fieldAuthorization.baWriteConfirmArmed === true, "P0", normalizedPolicy.fieldAuthorization.baWriteConfirmArmed ? "BA写入确认状态已记录。" : "3002 未记录 BA 写入确认短语已装载。");
    pushFcuArmCheck(checks, "final_rollout_confirm_armed", "总确认短语装载", normalizedPolicy.fieldAuthorization.finalRolloutConfirmArmed === true, "P0", normalizedPolicy.fieldAuthorization.finalRolloutConfirmArmed ? "最终控制总确认状态已记录。" : "3002 未记录最终控制总确认短语已装载。");
    pushFcuArmCheck(checks, "commissioning_has_ready_devices", "设备侧就绪", (commissioningSummary.deviceReady || 0) > 0, "P0", `设备侧就绪 ${commissioningSummary.deviceReady || 0}/${commissioningSummary.total || 0} 台。`);
    pushFcuArmCheck(checks, "execution_gate_open", "全局投运闸门", executionGate?.dispatchAllowed === true, "P0", executionGate?.dispatchAllowed === true ? "全局投运闸门已打开。" : `未打开：${(executionGate?.blockedReasons || []).join(" / ") || "unknown"}`);
    pushFcuArmCheck(checks, "canary_selected", "首台Canary", Boolean(firstCanary), "P0", firstCanary ? `首台 ${firstCanary}。` : "未找到可作为 Canary 的设备。");
    pushFcuArmCheck(checks, "feedback_rule_required", "反馈后再扩大", true, "P0", "执行策略要求单台反馈校验通过后再扩大。");
    const blockers = checks.filter((item) => !item.ok && item.severity === "P0");
    const warnings = checks.filter((item) => !item.ok && item.severity !== "P0");
    const nextActions = buildFcuFieldArmNextActions({
      blockers,
      firstCanary,
      executionGate
    });
    return {
      ok: blockers.length === 0,
      generatedAt: new Date().toISOString(),
      verdict: blockers.length === 0 ? "field_arm_ready" : "field_arm_blocked",
      firstCanary: firstCanary || null,
      controlMutation: false,
      checks,
      blockingItems: blockers,
      warningItems: warnings,
      nextActions,
      policy: {
        enabled: normalizedPolicy.enabled,
        defaultMode: normalizedPolicy.defaultMode,
        dispatchAdapter: normalizedPolicy.dispatchAdapter,
        whitelistCount: normalizedPolicy.whitelist.length
      },
      commissioningSummary,
      executionGate
    };
  }

  function normalizeFcuDeviceKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildFcuDeviceFinalControlGate({ commissioningStatus, executionGate, fieldArmCheck, finalPayload, recentRecords }) {
    const deviceCode =
      commissioningStatus?.device?.deviceCode ||
      commissioningStatus?.device?.deviceId ||
      commissioningStatus?.device?.deviceName ||
      "";
    const normalizedDeviceCode = normalizeFcuDeviceKey(deviceCode);
    const milestones = finalPayload?.milestones || {};
    const canaryDeviceCode = milestones.canary?.deviceCode || finalPayload?.firstCanary || finalPayload?.canaryDevice || "";
    const isCurrentCanary = Boolean(normalizedDeviceCode && normalizeFcuDeviceKey(canaryDeviceCode) === normalizedDeviceCode);
    const confirmedDeviceCodes = Array.isArray(milestones.allDevice?.confirmedDeviceCodes)
      ? milestones.allDevice.confirmedDeviceCodes.map(normalizeFcuDeviceKey)
      : [];
    const selectedDeviceRecords = (Array.isArray(recentRecords) ? recentRecords : []).filter((record) =>
      [record?.deviceCode, record?.deviceId, record?.deviceName]
        .map(normalizeFcuDeviceKey)
        .includes(normalizedDeviceCode)
    );
    const latestRecord = selectedDeviceRecords[0] || commissioningStatus?.latestRecord || null;
    const hasFeedbackConfirmed =
      confirmedDeviceCodes.includes(normalizedDeviceCode) ||
      selectedDeviceRecords.some((record) => record?.status === "feedback_confirmed");
    const backendWriteGateOpen =
      executionGate?.dispatchAllowed === true ||
      executionGate?.conditions?.find((item) => item.key === "backend_not_readonly")?.ok === true;
    const finalBlockingItems = Array.isArray(finalPayload?.blockingItems) ? finalPayload.blockingItems : [];
    const items = [
      {
        key: "device_readiness",
        label: "本机点位质量",
        ok: commissioningStatus?.deviceReady === true,
        value: commissioningStatus?.deviceReady ? "通过" : "阻断",
        note: commissioningStatus?.deviceReady
          ? "白名单/通讯/温度/写点已通过。"
          : (commissioningStatus?.blockedReasons || commissioningStatus?.controlBlockReasons || []).slice(0, 3).join(" / ") || "本机投运条件未通过。"
      },
      {
        key: "backend_write_gate",
        label: "后端写总闸",
        ok: backendWriteGateOpen,
        value: executionGate?.dispatchAllowed ? "允许" : executionGate?.readOnlyMode ? "后端只读" : "未打开",
        note: (executionGate?.blockedReasons || []).join(" / ") || "后端环境允许真实 BA 写入。"
      },
      {
        key: "field_arm",
        label: "现场 Arm-Check",
        ok: fieldArmCheck?.ok === true,
        value: fieldArmCheck?.ok ? "通过" : "禁止",
        note: fieldArmCheck?.ok
          ? "允许进入首台 Canary。"
          : (fieldArmCheck?.blockingItems || []).slice(0, 3).map((item) => item.message || item.label || item.key).join(" / ") || "现场投运门禁未通过。"
      },
      {
        key: "canary_sequence",
        label: "Canary顺序",
        ok: milestones.canary?.ok === true,
        value: milestones.canary?.ok ? "完成" : isCurrentCanary ? "首台待执行" : "等待首台",
        note: isCurrentCanary ? "该 FCU 是当前首台 Canary 候选。" : `首台 Canary 候选 ${canaryDeviceCode || "未配置"}。`
      },
      {
        key: "device_feedback",
        label: "本机反馈确认",
        ok: hasFeedbackConfirmed,
        value: hasFeedbackConfirmed ? "已确认" : "未确认",
        note: latestRecord
          ? `${latestRecord.createdAt || "--"} · ${latestRecord.status || "--"}`
          : "暂无本机真实下发反馈记录。"
      },
      {
        key: "final_acceptance",
        label: "最终验收",
        ok: finalPayload?.ok === true,
        value: finalPayload?.ok ? "完成" : "未完成",
        note: finalBlockingItems.length
          ? finalBlockingItems.slice(0, 2).map((item) => item.label || item.key).join(" / ")
          : "等待最终验收证据。"
      }
    ];
    const blockingItems = items.filter((item) => !item.ok).map((item) => ({
      key: item.key,
      label: item.label,
      message: item.note
    }));
    const verdict =
      items.every((item) => item.ok)
        ? "final_control_ready"
        : commissioningStatus?.deviceReady !== true
          ? "device_blocked"
          : executionGate?.dispatchAllowed !== true
            ? "environment_blocked"
            : milestones.canary?.ok !== true
              ? "awaiting_canary"
              : !hasFeedbackConfirmed
                ? "awaiting_device_feedback"
                : "final_acceptance_blocked";
    return {
      ok: blockingItems.length === 0,
      verdict,
      deviceCode: deviceCode || null,
      isCurrentCanary,
      canaryDeviceCode: canaryDeviceCode || null,
      controlMutation: finalPayload?.controlMutation === true,
      generatedAt: new Date().toISOString(),
      items,
      blockingItems,
      latestRecord: latestRecord
        ? {
            recordId: latestRecord.recordId || null,
            status: latestRecord.status || null,
            createdAt: latestRecord.createdAt || null,
            updatedAt: latestRecord.updatedAt || null
          }
        : null
    };
  }

  router.get("/sites/:siteId/hvac-terminal/fan-coils/commissioning-status", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const deviceCode = readFcuDeviceCode(req);
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const snapshot = filterFanCoilSnapshotByDevice(await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    }), deviceCode);
    const recentRecords = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          deviceCode,
          limit: 500
        }).items
      : [];
    const baseCommissioningItems = (Array.isArray(snapshot?.items) ? snapshot.items : []).map((item) =>
      evaluateFcuDeviceCommissioningStatus({
        ...snapshot,
        items: [item],
        summary: {
          ...(snapshot?.summary || {}),
          total: 1
        }
      }, policy, recentRecords, {
        executionGate
      })
    );
    const baseCommissioningStatus = deviceCode ? baseCommissioningItems[0] || evaluateFcuDeviceCommissioningStatus(snapshot, policy, recentRecords, {
      executionGate
    }) : null;
    const commissioningSummary = {
      total: baseCommissioningItems.length,
      ready: baseCommissioningItems.filter((item) => item.status === "ready").length,
      environmentBlocked: baseCommissioningItems.filter((item) => item.status === "environment_blocked").length,
      deviceBlocked: baseCommissioningItems.filter((item) => item.status === "blocked").length,
      notFound: baseCommissioningItems.filter((item) => item.status === "not_found").length,
      deviceReady: baseCommissioningItems.filter((item) => item.deviceReady === true).length,
      canDispatch: baseCommissioningItems.filter((item) => item.canDispatch === true).length
    };
    const firstCanary =
      baseCommissioningItems.find((item) => item.deviceReady === true)?.device?.deviceCode ||
      policy.whitelist?.[0] ||
      "";
    const armCheck = buildFcuFieldArmCheck({
      policy,
      executionGate,
      commissioningSummary,
      firstCanary
    });
    const finalEvidence = readFcuFinalControlEvidence();
    const finalPayload = finalEvidence.finalCompletion.payload || {};
    const commissioningItems = baseCommissioningItems.map((item) => ({
      ...item,
      finalGate: buildFcuDeviceFinalControlGate({
        commissioningStatus: item,
        executionGate,
        fieldArmCheck: armCheck,
        finalPayload,
        recentRecords
      })
    }));
    const commissioningStatus = baseCommissioningStatus
      ? {
          ...baseCommissioningStatus,
          finalGate: buildFcuDeviceFinalControlGate({
            commissioningStatus: baseCommissioningStatus,
            executionGate,
            fieldArmCheck: armCheck,
            finalPayload,
            recentRecords
          })
        }
      : null;
    const commissioningReport = buildFcuCommissioningReport(commissioningItems, executionGate);
    res.json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      targetDeviceCode: deviceCode || null,
      executionGate,
      fieldArmCheck: armCheck,
      commissioningStatus,
      summary: commissioningSummary,
      items: commissioningItems,
      report: commissioningReport
    });
  });

  function buildFcuAuthorizationGate(policy) {
    const normalizedPolicy = normalizeFcuControlPolicy(policy || {});
    const authorization = normalizedPolicy.fieldAuthorization || {};
    const authorizationWindow = buildFcuAuthorizationWindowState(authorization);
    const checks = [
      {
        key: "site_authorization_approved",
        label: "现场授权批准",
        ok: authorization.siteAuthorizationStatus === "approved",
        value: authorization.siteAuthorizationStatus || "not_started",
        message: authorization.siteAuthorizationStatus === "approved" ? "现场授权已批准。" : "3002 尚未批准现场授权。"
      },
      {
        key: "site_authorization_owner_recorded",
        label: "授权责任人记录",
        ok: Boolean(
          normalizeRouteText(authorization.siteAuthorizationBy) &&
            normalizeRouteText(authorization.commissioningOwner) &&
            normalizeRouteText(authorization.baOwner)
        ),
        value: normalizeRouteText(authorization.siteAuthorizationBy) && normalizeRouteText(authorization.commissioningOwner) && normalizeRouteText(authorization.baOwner) ? "recorded" : "missing",
        message: "必须记录授权确认人、投运负责人和 BA 负责人。"
      },
      {
        key: "site_authorization_window_configured",
        label: "授权窗口配置",
        ok: Boolean(
          authorizationWindow.configured && authorizationWindow.valid
        ),
        value: authorizationWindow.configured && authorizationWindow.valid ? "configured" : "missing",
        message: "必须配置现场值守授权窗口开始和结束时间。"
      },
      {
        key: "site_authorization_window_active",
        label: "授权窗口当前有效",
        ok: authorizationWindow.active,
        value: authorizationWindow.active ? "active" : "inactive",
        message: authorizationWindow.active ? "当前时间处于授权窗口内。" : "当前时间不在授权窗口内。"
      },
      {
        key: "ba_write_confirm_armed",
        label: "BA写入确认装载",
        ok: authorization.baWriteConfirmArmed === true,
        value: authorization.baWriteConfirmArmed === true ? "armed" : "not_armed",
        message: authorization.baWriteConfirmArmed === true ? "BA写入确认状态已记录。" : "3002 未记录 BA 写入确认已装载。"
      },
      {
        key: "final_rollout_confirm_armed",
        label: "最终控制总确认装载",
        ok: authorization.finalRolloutConfirmArmed === true,
        value: authorization.finalRolloutConfirmArmed === true ? "armed" : "not_armed",
        message: authorization.finalRolloutConfirmArmed === true ? "最终控制总确认状态已记录。" : "3002 未记录最终控制总确认已装载。"
      }
    ];
    return {
      ready: checks.every((item) => item.ok),
      status: authorization.siteAuthorizationStatus || "not_started",
      baWriteConfirmArmed: authorization.baWriteConfirmArmed === true,
      finalRolloutConfirmArmed: authorization.finalRolloutConfirmArmed === true,
      commissioningOwner: authorization.commissioningOwner || "",
      baOwner: authorization.baOwner || "",
      windowStart: authorization.siteAuthorizationWindowStart || null,
      windowEnd: authorization.siteAuthorizationWindowEnd || null,
      checks,
      blockingItems: checks.filter((item) => !item.ok).map((item) => ({
        key: item.key,
        label: item.label,
        severity: "P0",
        message: item.message
      }))
    };
  }

  function buildFcuFieldPreflightVerdict({ authorizationGate, executionGate, fieldArmCheck, commissioningStatus, finalGate }) {
    if (authorizationGate?.ready !== true) {
      return "authorization_blocked";
    }
    if (executionGate?.dispatchAllowed !== true) {
      return "execution_gate_blocked";
    }
    if (fieldArmCheck?.ok !== true) {
      return "field_arm_blocked";
    }
    if (!commissioningStatus || commissioningStatus.status === "not_found") {
      return "device_not_found";
    }
    if (commissioningStatus.deviceReady !== true) {
      return "device_commissioning_blocked";
    }
    if (commissioningStatus.canDispatch !== true) {
      return "device_dispatch_blocked";
    }
    if (finalGate?.ok === true) {
      return "final_control_complete";
    }
    return "canary_ready";
  }

  router.get("/sites/:siteId/hvac-terminal/fan-coils/field-preflight", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const deviceCode = readFcuDeviceCode(req);
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const authorizationGate = buildFcuAuthorizationGate(policy);
    const snapshot = filterFanCoilSnapshotByDevice(await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    }), deviceCode);
    const recentRecords = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          deviceCode,
          limit: 500
        }).items
      : [];
    const commissioningItems = (Array.isArray(snapshot?.items) ? snapshot.items : []).map((item) =>
      evaluateFcuDeviceCommissioningStatus({
        ...snapshot,
        items: [item],
        summary: {
          ...(snapshot?.summary || {}),
          total: 1
        }
      }, policy, recentRecords, {
        executionGate
      })
    );
    const commissioningSummary = {
      total: commissioningItems.length,
      ready: commissioningItems.filter((item) => item.status === "ready").length,
      environmentBlocked: commissioningItems.filter((item) => item.status === "environment_blocked").length,
      deviceBlocked: commissioningItems.filter((item) => item.status === "blocked").length,
      notFound: commissioningItems.filter((item) => item.status === "not_found").length,
      deviceReady: commissioningItems.filter((item) => item.deviceReady === true).length,
      canDispatch: commissioningItems.filter((item) => item.canDispatch === true).length
    };
    const firstCanary =
      commissioningItems.find((item) => item.deviceReady === true)?.device?.deviceCode ||
      policy.whitelist?.[0] ||
      "";
    const armCheck = buildFcuFieldArmCheck({
      policy,
      executionGate,
      commissioningSummary,
      firstCanary
    });
    const finalEvidence = readFcuFinalControlEvidence();
    const finalPayload = finalEvidence.finalCompletion.payload || {};
    const commissioningStatus = commissioningItems[0] || (deviceCode ? evaluateFcuDeviceCommissioningStatus(snapshot, policy, recentRecords, {
      executionGate
    }) : null);
    const commissioningStatusWithGate = commissioningStatus
      ? {
          ...commissioningStatus,
          finalGate: buildFcuDeviceFinalControlGate({
            commissioningStatus,
            executionGate,
            fieldArmCheck: armCheck,
            finalPayload,
            recentRecords
          })
        }
      : null;
    const report = buildFcuCommissioningReport(
      commissioningItems.map((item) => ({
        ...item,
        finalGate: buildFcuDeviceFinalControlGate({
          commissioningStatus: item,
          executionGate,
          fieldArmCheck: armCheck,
          finalPayload,
          recentRecords
        })
      })),
      executionGate
    );
    const finalGate = commissioningStatusWithGate?.finalGate || null;
    const blockingItems = [
      ...authorizationGate.blockingItems,
      ...((executionGate?.conditions || [])
        .filter((item) => !item.ok)
        .map((item) => ({
          key: item.key,
          label: item.label,
          severity: "P0",
          message: item.label
        }))),
      ...((armCheck?.blockingItems || []).map((item) => ({
        key: item.key,
        label: item.label,
        severity: item.severity || "P0",
        message: item.message
      }))),
      ...((commissioningStatusWithGate?.conditions || [])
        .filter((item) => !item.ok)
        .map((item) => ({
          key: item.key,
          label: item.label,
          severity: "P0",
          message: item.label
        }))),
      ...((finalGate?.blockingItems || []).map((item) => ({
        key: item.key,
        label: item.label,
        severity: "P1",
        message: item.message || item.label
      })))
    ];
    const dedupedBlockingItems = Array.from(new Map(blockingItems.map((item) => [item.key || item.label, item])).values());
    const verdict = buildFcuFieldPreflightVerdict({
      authorizationGate,
      executionGate,
      fieldArmCheck: armCheck,
      commissioningStatus: commissioningStatusWithGate,
      finalGate
    });
    const actionPlan = buildFcuGateActionPlan({
      blockingItems: dedupedBlockingItems,
      executionGate,
      authorizationGate,
      fieldArmCheck: armCheck,
      targetDeviceCode: deviceCode || firstCanary || ""
    });
    res.json({
      ok: verdict === "canary_ready" || verdict === "final_control_complete",
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      generatedAt: new Date().toISOString(),
      build,
      floor,
      targetDeviceCode: deviceCode || null,
      controlMutation: false,
      verdict,
      policy: {
        enabled: policy.enabled,
        defaultMode: policy.defaultMode,
        dispatchAdapter: policy.dispatchAdapter,
        whitelist: policy.whitelist,
        fieldAuthorization: policy.fieldAuthorization
      },
      authorizationGate,
      executionGate,
      fieldArmCheck: armCheck,
      commissioningStatus: commissioningStatusWithGate,
      summary: commissioningSummary,
      items: commissioningItems,
      report,
      finalGate,
      recentRecords: recentRecords.slice(0, 20),
      blockingItems: dedupedBlockingItems,
      actionPlan,
      nextActions: actionPlan.length > 0 ? actionPlan : report.nextActions || [],
      sourceStatus: {
        overall: "ok",
        entries: [
          {
            key: "fcuFieldPreflight",
            ok: true,
            status: "ok",
            message: `verdict=${verdict}`
          }
        ]
      }
    });
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/field-arm-check", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const snapshot = await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    });
    const recentRecords = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          limit: 500
        }).items
      : [];
    const commissioningItems = (Array.isArray(snapshot?.items) ? snapshot.items : []).map((item) =>
      evaluateFcuDeviceCommissioningStatus({
        ...snapshot,
        items: [item],
        summary: {
          ...(snapshot?.summary || {}),
          total: 1
        }
      }, policy, recentRecords, {
        executionGate
      })
    );
    const commissioningSummary = {
      total: commissioningItems.length,
      ready: commissioningItems.filter((item) => item.status === "ready").length,
      environmentBlocked: commissioningItems.filter((item) => item.status === "environment_blocked").length,
      deviceBlocked: commissioningItems.filter((item) => item.status === "blocked").length,
      notFound: commissioningItems.filter((item) => item.status === "not_found").length,
      deviceReady: commissioningItems.filter((item) => item.deviceReady === true).length,
      canDispatch: commissioningItems.filter((item) => item.canDispatch === true).length
    };
    const firstCanary =
      commissioningItems.find((item) => item.deviceReady === true)?.device?.deviceCode ||
      policy.whitelist?.[0] ||
      "";
    const armCheck = buildFcuFieldArmCheck({
      policy,
      executionGate,
      commissioningSummary,
      firstCanary
    });
    res.json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      site: {
        siteId
      },
      build,
      floor,
      subsystemType: "hvac_terminal",
      equipmentType: "fan_coil",
      ...armCheck
    });
  });

  router.get("/sites/:siteId/hvac-terminal/fan-coils/final-control-status", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const evidence = readFcuFinalControlEvidence();
    const rolloutPayload = evidence.finalRollout.payload || {};
    const gatesPayload = evidence.finalControlGates.payload || {};
    const finalPayload = evidence.finalCompletion.payload || {};
    const qualityPayload = evidence.qualityRemediation.payload || {};
    const canaryPackagePayload = evidence.canaryExecutionPackage.payload || {};
    const adapterReadinessPayload = evidence.baWriteAdapterReadiness.payload || {};
    const canaryFeedbackPayload = evidence.canaryFeedbackMonitor.payload || {};
    const canaryWindowPayload = evidence.canaryWindow.payload || {};
    const fieldArmPackagePayload = evidence.fieldArmPackage.payload || {};
    const planPayload = evidence.rolloutPlan.payload || {};
    const worklistPayload = evidence.finalWorklist.payload || {};
    const runbookPayload = evidence.finalRunbook.payload || {};
    const finalControlFieldExecutionPackPayload = evidence.finalControlFieldExecutionPack.payload || {};
    const evidenceConsistencyPayload = evidence.evidenceConsistency.payload || {};
    const reportStatuses = Object.fromEntries(
      Object.entries(evidence).map(([key, item]) => [
        key,
        {
          status: item.status,
          sourceFile: item.sourceFile,
          error: item.error
        }
      ])
    );
    res.json({
      ok: evidence.finalCompletion.status === "ok",
      requestId: req.requestId || `req-${Date.now()}`,
      site: {
        siteId
      },
      generatedAt: new Date().toISOString(),
      subsystemType: "hvac_terminal",
      equipmentType: "fan_coil",
      controlMutation: false,
      scope: finalPayload.scope || "fcu_all_device_final_control",
      verdict: finalPayload.verdict || "final_control_status_unavailable",
      finalControlGates: {
        ok: gatesPayload.ok === true,
        generatedAt: gatesPayload.generatedAt || null,
        siteId: gatesPayload.siteId || siteId,
        summary: gatesPayload.summary || null,
        gates: Array.isArray(gatesPayload.gates) ? gatesPayload.gates : [],
        blockers: Array.isArray(gatesPayload.blockers) ? gatesPayload.blockers : [],
        nextActions: Array.isArray(gatesPayload.nextActions) ? gatesPayload.nextActions : [],
        outputs: gatesPayload.outputs || null,
        controlMutation: gatesPayload.controlMutation === true
      },
      finalRollout: {
        ok: rolloutPayload.ok === true,
        generatedAt: rolloutPayload.generatedAt || null,
        mode: rolloutPayload.mode || null,
        controlMutation: rolloutPayload.controlMutation === true,
        confirm: rolloutPayload.confirm || null,
        phases: Array.isArray(rolloutPayload.phases) ? rolloutPayload.phases : [],
        skipped: Array.isArray(rolloutPayload.skipped) ? rolloutPayload.skipped : [],
        blockers: Array.isArray(rolloutPayload.blockers) ? rolloutPayload.blockers : [],
        nextActions: Array.isArray(rolloutPayload.nextActions) ? rolloutPayload.nextActions : []
      },
      finalCompletion: {
        ok: finalPayload.ok === true,
        generatedAt: finalPayload.generatedAt || null,
        milestones: finalPayload.milestones || null,
        blockingItems: finalPayload.blockingItems || [],
        nextActions: finalPayload.nextActions || [],
        firstCanary: finalPayload.firstCanary || finalPayload.canaryDevice || null,
        canaryRecordId: finalPayload.canaryRecordId || null,
        canaryVerificationStatus: finalPayload.canaryVerificationStatus || null
      },
      rolloutPlan: {
        ok: planPayload.ok === true || finalPayload.rolloutPlan?.ok === true,
        generatedAt: planPayload.generatedAt || null,
        summary: planPayload.summary || finalPayload.rolloutPlan || null,
        firstCanary: planPayload.firstCanary || finalPayload.rolloutPlan?.firstCanary || null,
        waves: Array.isArray(planPayload.waves) ? planPayload.waves : [],
        blockedDevices: Array.isArray(planPayload.blockedDevices) ? planPayload.blockedDevices : []
      },
      qualityRemediation: {
        ok: qualityPayload.ok === true || finalPayload.qualityRemediation?.ok === true,
        generatedAt: qualityPayload.generatedAt || null,
        summary: qualityPayload.summary || {
          remediationCount: finalPayload.qualityRemediation?.remediationCount || 0,
          p0Count: finalPayload.qualityRemediation?.p0Count || 0,
          canCompleteFinalControl: finalPayload.qualityRemediation?.canCompleteFinalControl === true
        },
        reasonCounts: qualityPayload.reasonCounts || finalPayload.qualityRemediation?.reasonCounts || [],
        devices: Array.isArray(qualityPayload.devices) ? qualityPayload.devices : []
      },
      canaryExecutionPackage: {
        ok: canaryPackagePayload.ok === true,
        generatedAt: canaryPackagePayload.generatedAt || null,
        verdict: canaryPackagePayload.verdict || null,
        canary: canaryPackagePayload.canary || null,
        requiredEnv: canaryPackagePayload.requiredEnv || null,
        preconditions: Array.isArray(canaryPackagePayload.preconditions) ? canaryPackagePayload.preconditions : [],
        blockers: Array.isArray(canaryPackagePayload.blockers) ? canaryPackagePayload.blockers : [],
        feedbackChecks: Array.isArray(canaryPackagePayload.feedbackChecks) ? canaryPackagePayload.feedbackChecks : [],
        rollbackTriggers: Array.isArray(canaryPackagePayload.rollbackTriggers) ? canaryPackagePayload.rollbackTriggers : [],
        outputs: canaryPackagePayload.outputs || null
      },
      baWriteAdapterReadiness: {
        ok: adapterReadinessPayload.ok === true,
        generatedAt: adapterReadinessPayload.generatedAt || null,
        verdict: adapterReadinessPayload.verdict || null,
        canary: adapterReadinessPayload.canary || null,
        checks: Array.isArray(adapterReadinessPayload.checks) ? adapterReadinessPayload.checks : [],
        blockingItems: Array.isArray(adapterReadinessPayload.blockingItems) ? adapterReadinessPayload.blockingItems : [],
        nextActions: Array.isArray(adapterReadinessPayload.nextActions) ? adapterReadinessPayload.nextActions : [],
        outputs: adapterReadinessPayload.outputs || null
      },
      canaryFeedbackMonitor: {
        ok: canaryFeedbackPayload.ok === true,
        generatedAt: canaryFeedbackPayload.generatedAt || null,
        verdict: canaryFeedbackPayload.verdict || null,
        canary: canaryFeedbackPayload.canary || null,
        checks: Array.isArray(canaryFeedbackPayload.checks) ? canaryFeedbackPayload.checks : [],
        nextActions: Array.isArray(canaryFeedbackPayload.nextActions) ? canaryFeedbackPayload.nextActions : [],
        outputs: canaryFeedbackPayload.outputs || null
      },
      canaryWindow: {
        ok: canaryWindowPayload.ok === true,
        generatedAt: canaryWindowPayload.generatedAt || null,
        mode: canaryWindowPayload.mode || null,
        verdict: canaryWindowPayload.verdict || null,
        controlMutation: canaryWindowPayload.controlMutation === true,
        canary: canaryWindowPayload.canary || null,
        phases: Array.isArray(canaryWindowPayload.phases) ? canaryWindowPayload.phases : [],
        skipped: Array.isArray(canaryWindowPayload.skipped) ? canaryWindowPayload.skipped : [],
        evidence: canaryWindowPayload.evidence || null,
        nextActions: Array.isArray(canaryWindowPayload.nextActions) ? canaryWindowPayload.nextActions : [],
        outputs: canaryWindowPayload.outputs || null
      },
      fieldArmPackage: {
        ok: fieldArmPackagePayload.ok === true,
        generatedAt: fieldArmPackagePayload.generatedAt || null,
        verdict: fieldArmPackagePayload.verdict || null,
        deviceCode: fieldArmPackagePayload.deviceCode || null,
        controlMutation: fieldArmPackagePayload.controlMutation === true,
        canary: fieldArmPackagePayload.canary || null,
        requiredEnv: fieldArmPackagePayload.requiredEnv || null,
        checklist: Array.isArray(fieldArmPackagePayload.checklist) ? fieldArmPackagePayload.checklist : [],
        blockers: Array.isArray(fieldArmPackagePayload.blockers) ? fieldArmPackagePayload.blockers : [],
        feedbackChecks: Array.isArray(fieldArmPackagePayload.feedbackChecks) ? fieldArmPackagePayload.feedbackChecks : [],
        rollbackTriggers: Array.isArray(fieldArmPackagePayload.rollbackTriggers) ? fieldArmPackagePayload.rollbackTriggers : [],
        acceptanceRecords: Array.isArray(fieldArmPackagePayload.acceptanceRecords) ? fieldArmPackagePayload.acceptanceRecords : [],
        outputs: fieldArmPackagePayload.outputs || null
      },
      finalWorklist: {
        ok: worklistPayload.ok === true,
        generatedAt: worklistPayload.generatedAt || null,
        verdict: worklistPayload.verdict || null,
        firstCanary: worklistPayload.firstCanary || null,
        targetDevices: worklistPayload.targetDevices || null,
        confirmedDevices: worklistPayload.confirmedDevices || null,
        summary: worklistPayload.summary || null,
        fieldPackages: worklistPayload.fieldPackages || null,
        phases: Array.isArray(worklistPayload.phases) ? worklistPayload.phases : [],
        actions: Array.isArray(worklistPayload.actions) ? worklistPayload.actions : [],
        remediationDevices: Array.isArray(worklistPayload.remediationDevices) ? worklistPayload.remediationDevices : []
      },
      finalRunbook: {
        ok: runbookPayload.ok === true,
        generatedAt: runbookPayload.generatedAt || null,
        verdict: runbookPayload.verdict || null,
        summary: runbookPayload.summary || null,
        nextActions: Array.isArray(runbookPayload.nextActions) ? runbookPayload.nextActions : [],
        outputs: runbookPayload.outputs || null,
        controlMutation: runbookPayload.controlMutation === true,
        dispatch: runbookPayload.dispatch === true
      },
      finalControlFieldExecutionPack: {
        ok: finalControlFieldExecutionPackPayload.ok === true,
        generatedAt: finalControlFieldExecutionPackPayload.generatedAt || null,
        summary: finalControlFieldExecutionPackPayload.summary || null,
        outputFiles: finalControlFieldExecutionPackPayload.outputFiles || null,
        finalReleaseChecklist: Array.isArray(finalControlFieldExecutionPackPayload.finalReleaseChecklist)
          ? finalControlFieldExecutionPackPayload.finalReleaseChecklist
          : [],
        deviceQueue: Array.isArray(finalControlFieldExecutionPackPayload.deviceQueue)
          ? finalControlFieldExecutionPackPayload.deviceQueue
          : [],
        safetyBoundary: Array.isArray(finalControlFieldExecutionPackPayload.safetyBoundary)
          ? finalControlFieldExecutionPackPayload.safetyBoundary
          : [],
        controlMutation: finalControlFieldExecutionPackPayload.controlMutation === true,
        dispatch: finalControlFieldExecutionPackPayload.dispatch === true
      },
      evidenceConsistency: {
        ok: evidenceConsistencyPayload.ok === true,
        generatedAt: evidenceConsistencyPayload.generatedAt || null,
        verdict: evidenceConsistencyPayload.verdict || null,
        summary: evidenceConsistencyPayload.summary || null,
        issues: Array.isArray(evidenceConsistencyPayload.issues) ? evidenceConsistencyPayload.issues : [],
        sourceFiles: evidenceConsistencyPayload.sourceFiles || null,
        controlMutation: evidenceConsistencyPayload.controlMutation === true,
        dispatch: evidenceConsistencyPayload.dispatch === true
      },
      reportStatuses,
      sourceStatus: {
        overall: evidence.finalCompletion.status === "ok" ? "ok" : "partial",
        entries: Object.entries(reportStatuses).map(([key, item]) => ({
          key,
          ok: item.status === "ok",
          status: item.status,
          message: item.error || item.sourceFile
        }))
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/final-control-status/refresh", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const refreshResult = await runFcuFinalControlStatusRefresh(siteId, {
      bffBaseUrl: buildRequestBaseUrl(req),
      outputDir: config.fcuFinalControlOutputDir
    });
    const refreshResults = refreshResult.results;
    const evidence = readFcuFinalControlEvidence(refreshResult.files);
    const gatesPayload = evidence.finalControlGates.payload || {};
    const finalPayload = evidence.finalCompletion.payload || {};
    const worklistPayload = evidence.finalWorklist.payload || {};
    const runbookPayload = evidence.finalRunbook.payload || {};
    const finalControlFieldExecutionPackPayload = evidence.finalControlFieldExecutionPack.payload || {};
    const evidenceConsistencyPayload = evidence.evidenceConsistency.payload || {};
    const fieldArmPackagePayload = evidence.fieldArmPackage.payload || {};
    const reportStatuses = Object.fromEntries(
      Object.entries(evidence).map(([key, item]) => [
        key,
        {
          status: item.status,
          sourceFile: item.sourceFile,
          error: item.error
        }
      ])
    );
    const scriptFailures = refreshResults.filter((item) => item.status !== 0 && item.status !== 2);
    res.status(scriptFailures.length > 0 ? 500 : 201).json({
      ok: scriptFailures.length === 0,
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      generatedAt: new Date().toISOString(),
      controlMutation: false,
      verdict: finalPayload.verdict || "final_control_status_unavailable",
      finalControlGates: {
        ok: gatesPayload.ok === true,
        generatedAt: gatesPayload.generatedAt || null,
        siteId: gatesPayload.siteId || siteId,
        summary: gatesPayload.summary || null,
        gates: Array.isArray(gatesPayload.gates) ? gatesPayload.gates : [],
        blockers: Array.isArray(gatesPayload.blockers) ? gatesPayload.blockers : [],
        nextActions: Array.isArray(gatesPayload.nextActions) ? gatesPayload.nextActions : [],
        outputs: gatesPayload.outputs || null,
        controlMutation: gatesPayload.controlMutation === true
      },
      finalCompletion: {
        ok: finalPayload.ok === true,
        generatedAt: finalPayload.generatedAt || null,
        milestones: finalPayload.milestones || null,
        blockingItems: finalPayload.blockingItems || [],
        nextActions: finalPayload.nextActions || [],
        firstCanary: finalPayload.firstCanary || finalPayload.canaryDevice || null
      },
      finalWorklist: {
        ok: worklistPayload.ok === true,
        generatedAt: worklistPayload.generatedAt || null,
        verdict: worklistPayload.verdict || null,
        summary: worklistPayload.summary || null,
        phases: Array.isArray(worklistPayload.phases) ? worklistPayload.phases : [],
        actions: Array.isArray(worklistPayload.actions) ? worklistPayload.actions : []
      },
      finalRunbook: {
        ok: runbookPayload.ok === true,
        generatedAt: runbookPayload.generatedAt || null,
        verdict: runbookPayload.verdict || null,
        summary: runbookPayload.summary || null,
        nextActions: Array.isArray(runbookPayload.nextActions) ? runbookPayload.nextActions : [],
        outputs: runbookPayload.outputs || null,
        controlMutation: runbookPayload.controlMutation === true,
        dispatch: runbookPayload.dispatch === true
      },
      finalControlFieldExecutionPack: {
        ok: finalControlFieldExecutionPackPayload.ok === true,
        generatedAt: finalControlFieldExecutionPackPayload.generatedAt || null,
        summary: finalControlFieldExecutionPackPayload.summary || null,
        outputFiles: finalControlFieldExecutionPackPayload.outputFiles || null,
        finalReleaseChecklist: Array.isArray(finalControlFieldExecutionPackPayload.finalReleaseChecklist)
          ? finalControlFieldExecutionPackPayload.finalReleaseChecklist
          : [],
        deviceQueue: Array.isArray(finalControlFieldExecutionPackPayload.deviceQueue)
          ? finalControlFieldExecutionPackPayload.deviceQueue
          : [],
        safetyBoundary: Array.isArray(finalControlFieldExecutionPackPayload.safetyBoundary)
          ? finalControlFieldExecutionPackPayload.safetyBoundary
          : [],
        controlMutation: finalControlFieldExecutionPackPayload.controlMutation === true,
        dispatch: finalControlFieldExecutionPackPayload.dispatch === true
      },
      evidenceConsistency: {
        ok: evidenceConsistencyPayload.ok === true,
        generatedAt: evidenceConsistencyPayload.generatedAt || null,
        verdict: evidenceConsistencyPayload.verdict || null,
        summary: evidenceConsistencyPayload.summary || null,
        issues: Array.isArray(evidenceConsistencyPayload.issues) ? evidenceConsistencyPayload.issues : [],
        sourceFiles: evidenceConsistencyPayload.sourceFiles || null,
        controlMutation: evidenceConsistencyPayload.controlMutation === true,
        dispatch: evidenceConsistencyPayload.dispatch === true
      },
      fieldArmPackage: {
        ok: fieldArmPackagePayload.ok === true,
        generatedAt: fieldArmPackagePayload.generatedAt || null,
        verdict: fieldArmPackagePayload.verdict || null,
        deviceCode: fieldArmPackagePayload.deviceCode || null,
        controlMutation: fieldArmPackagePayload.controlMutation === true,
        blockers: Array.isArray(fieldArmPackagePayload.blockers) ? fieldArmPackagePayload.blockers : [],
        checklist: Array.isArray(fieldArmPackagePayload.checklist) ? fieldArmPackagePayload.checklist : [],
        outputs: fieldArmPackagePayload.outputs || null
      },
      refresh: {
        status: scriptFailures.length > 0 ? "failed" : "completed",
        scripts: refreshResults,
        outputs: refreshResult.files,
        acceptedExitCodes: [0, 2],
        note: "exit 2 means final control remains blocked; it is accepted for read-only status refresh."
      },
      reportStatuses,
      sourceStatus: {
        overall: scriptFailures.length > 0 ? "error" : "ok",
        entries: refreshResults.map((item) => ({
          key: item.key,
          ok: item.status === 0 || item.status === 2,
          status: item.status === 0 ? "ok" : item.status === 2 ? "blocked" : "error",
          message: item.stderr || item.stdout || item.label
        }))
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/final-control-rollout", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const confirmPhrase = normalizeRouteText(req.body?.confirmPhrase || req.query.confirmPhrase);
    const finalRolloutConfirmPhrase = normalizeRouteText(
      req.body?.finalRolloutConfirmPhrase ||
      req.body?.finalConfirmPhrase ||
      req.query.finalRolloutConfirmPhrase ||
      req.query.finalConfirmPhrase
    );
    const requiredConfirmPhrase = "I_UNDERSTAND_REAL_BA_WRITE";
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const blockers = [];
    if (config.readOnlyMode === true) {
      blockers.push({
        key: "backend_read_only",
        label: "后端只读总闸",
        severity: "P0"
      });
    }
    if (confirmPhrase !== requiredConfirmPhrase) {
      blockers.push({
        key: "ba_confirm_phrase_missing",
        label: "BA 写入确认短语",
        severity: "P0"
      });
    }
    if (finalRolloutConfirmPhrase !== requiredConfirmPhrase) {
      blockers.push({
        key: "final_rollout_confirm_phrase_missing",
        label: "最终控制总确认短语",
        severity: "P0"
      });
    }
    if (executionGate.dispatchAllowed !== true) {
      blockers.push(
        ...executionGate.conditions
          .filter((item) => item.ok !== true)
          .map((item) => ({
            key: item.key,
            label: item.label,
            severity: "P0"
          }))
      );
    }
    const dedupedBlockers = Array.from(new Map(blockers.map((item) => [item.key, item])).values());
    if (dedupedBlockers.length > 0) {
      res.status(409).json({
        ok: false,
        code: config.readOnlyMode === true ? "READ_ONLY_MODE" : "FINAL_CONTROL_ROLLOUT_BLOCKED",
        error: "FCU 最终控制编排门禁未满足。",
        requestId: req.requestId || `req-${Date.now()}`,
        site: { siteId },
        dispatchRequested: true,
        dispatchAllowed: false,
        controlMutation: false,
        requiredConfirmPhrase,
        executionGate,
        blockers: dedupedBlockers
      });
      return;
    }
    const result = await runFcuFinalControlRollout(siteId, {
      bffBaseUrl: buildRequestBaseUrl(req),
      outputDir: config.fcuFinalControlOutputDir,
      smallBatchConfirm: confirmPhrase,
      finalRolloutConfirm: finalRolloutConfirmPhrase
    });
    const reportPayload = result.report.payload || {};
    res.status(201).json({
      ok: result.report.status === "ok" && reportPayload.ok === true,
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      generatedAt: new Date().toISOString(),
      dispatchRequested: true,
      dispatchAllowed: true,
      controlMutation: reportPayload.controlMutation === true,
      verdict: reportPayload.ok === true ? "final_control_complete" : reportPayload.mode || "final_control_rollout_attempted",
      finalRollout: {
        ok: reportPayload.ok === true,
        generatedAt: reportPayload.generatedAt || null,
        mode: reportPayload.mode || null,
        controlMutation: reportPayload.controlMutation === true,
        confirm: reportPayload.confirm || null,
        phases: Array.isArray(reportPayload.phases) ? reportPayload.phases : [],
        skipped: Array.isArray(reportPayload.skipped) ? reportPayload.skipped : [],
        blockers: Array.isArray(reportPayload.blockers) ? reportPayload.blockers : [],
        nextActions: Array.isArray(reportPayload.nextActions) ? reportPayload.nextActions : []
      },
      evidence: reportPayload.evidence || null,
      outputs: {
        json: result.files.finalRolloutJson,
        markdown: result.files.finalRolloutMd,
        finalCompletionJson: result.files.finalCompletionJson,
        finalWorklistJson: result.files.finalWorklistJson
      },
      execution: {
        status: result.status,
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr
      },
      sourceStatus: {
        overall: result.report.status === "ok" ? "ok" : result.report.status,
        entries: [
          {
            key: "finalControlRollout",
            ok: result.report.status === "ok",
            status: result.report.status,
            message: result.report.error || result.files.finalRolloutJson
          }
        ]
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/control-cycle", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const actor = readRealtimeRequestContext(req);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const deviceCode = readFcuDeviceCode(req);
    const dispatchRequested = req.body?.dispatch === true || req.body?.confirmDispatch === true;
    if (dispatchRequested && !deviceCode) {
      res.status(409).json({
        ok: false,
        code: "SINGLE_DEVICE_REQUIRED",
        error: "FCU 真实确认下发必须指定单台 deviceCode；全量投运请走小批量/全量编排流程。",
        requestId: req.requestId || `req-${Date.now()}`,
        site: { siteId },
        dispatchRequested: true,
        dispatchAllowed: false,
        controlMutation: false,
        blockers: [
          {
            key: "single_device_required",
            label: "必须指定单台 FCU",
            severity: "P0"
          }
        ]
      });
      return;
    }
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const finalDispatchGate = buildFcuFinalDispatchGate(
      readFcuFinalControlEvidence(buildFcuFinalControlRefreshFilePaths(config.fcuFinalControlOutputDir))
    );
    const dispatchAllowed = dispatchRequested && executionGate.dispatchAllowed === true && finalDispatchGate.dispatchAllowed === true;
    const snapshot = filterFanCoilSnapshotByDevice(await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    }), deviceCode);
    const recentRecords = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          deviceCode,
          limit: 500
        }).items
      : [];
    const cycle = evaluateFcuControlCycle(snapshot, policy, recentRecords);
    const dispatchedCycle = await dispatchFcuControlCycle(cycle, {
      readOnlyMode: !dispatchAllowed,
      dispatchCommand: async (command) =>
        submitSceneDeviceCommand(siteConfig, siteId, command, {
          userId: requestContext.userId || actor.userId || "150",
          appId: requestContext.siteId || siteId,
          language: "zh",
          databaseKey: dataContext.databaseKey,
          databaseKeyCandidates: dataContext.databaseKeyCandidates,
          projectKey: dataContext.projectKey,
          projectKeyCandidates: dataContext.projectKeyCandidates,
          template: requestContext.template || "1"
        })
    });
    const persisted = persistFcuControlCycle(adminStore, siteId, dispatchedCycle, actor, {
      dryRun: !dispatchAllowed,
      requestId: req.requestId
    });
    res.status(201).json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      dispatchRequested,
      dispatchAllowed,
      executionGate,
      finalDispatchGate,
      targetDeviceCode: deviceCode || null,
      controlMutation: persisted.summary?.controlMutation === true,
      ...persisted
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/canary-window", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const deviceCode = normalizeRouteText(req.body?.deviceCode || req.query.deviceCode || readFcuDeviceCode(req));
    if (!deviceCode) {
      res.status(400).json({
        ok: false,
        code: "DEVICE_CODE_REQUIRED",
        error: "deviceCode is required to generate a single-FCU canary window.",
        requestId: req.requestId || `req-${Date.now()}`
      });
      return;
    }
    const result = await runFcuCanaryWindowPackage(siteId, deviceCode, {
      bffBaseUrl: buildRequestBaseUrl(req),
      outputDir: config.fcuFinalControlOutputDir
    });
    const reportPayload = result.report.payload || {};
    res.status(201).json({
      ok: result.report.status === "ok",
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      deviceCode,
      controlMutation: false,
      mode: reportPayload.mode || null,
      verdict: reportPayload.verdict || null,
      canary: reportPayload.canary || null,
      nextActions: Array.isArray(reportPayload.nextActions) ? reportPayload.nextActions : [],
      phases: Array.isArray(reportPayload.phases) ? reportPayload.phases : [],
      skipped: Array.isArray(reportPayload.skipped) ? reportPayload.skipped : [],
      evidence: reportPayload.evidence || null,
      outputs: reportPayload.outputs || {
        json: result.files.json,
        markdown: result.files.markdown
      },
      command: `FCU_CANARY_DEVICE_CODE=${deviceCode} npm --prefix apps/chiller-bff run execute:fcu-canary-window`,
      execution: {
        status: result.status,
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr
      },
      sourceStatus: {
        overall: result.report.status === "ok" ? "ok" : result.report.status,
        entries: [
          {
            key: "canaryWindow",
            ok: result.report.status === "ok",
            status: result.report.status,
            message: result.report.error || result.files.json
          }
        ]
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/field-arm-package", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const deviceCode = readFcuDeviceCode(req);
    if (!deviceCode) {
      res.status(400).json({
        ok: false,
        code: "FCU_DEVICE_CODE_REQUIRED",
        error: "deviceCode is required to generate a single-FCU field arm package.",
        controlMutation: false
      });
      return;
    }
    const result = await runFcuFieldArmPackage(siteId, deviceCode, {
      bffBaseUrl: buildRequestBaseUrl(req),
      outputDir: config.fcuFinalControlOutputDir
    });
    const payload = result.fieldPackage.report.payload || {};
    const scriptFailures = [result.canaryWindow.status, result.fieldPackage.status].filter((status) => status !== 0 && status !== 2);
    res.status(scriptFailures.length > 0 ? 500 : 201).json({
      ok: scriptFailures.length === 0 && payload.ok === true,
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      generatedAt: new Date().toISOString(),
      deviceCode,
      controlMutation: false,
      verdict: payload.verdict || "field_arm_package_unavailable",
      fieldArmPackage: {
        ok: payload.ok === true,
        generatedAt: payload.generatedAt || null,
        verdict: payload.verdict || null,
        deviceCode: payload.deviceCode || deviceCode,
        controlMutation: payload.controlMutation === true,
        canary: payload.canary || null,
        requiredEnv: payload.requiredEnv || null,
        checklist: Array.isArray(payload.checklist) ? payload.checklist : [],
        blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
        feedbackChecks: Array.isArray(payload.feedbackChecks) ? payload.feedbackChecks : [],
        rollbackTriggers: Array.isArray(payload.rollbackTriggers) ? payload.rollbackTriggers : [],
        acceptanceRecords: Array.isArray(payload.acceptanceRecords) ? payload.acceptanceRecords : [],
        outputs: payload.outputs || result.files
      },
      refresh: {
        status: scriptFailures.length > 0 ? "failed" : "completed",
        acceptedExitCodes: [0, 2],
        scripts: [
          {
            key: "canaryWindow",
            status: result.canaryWindow.status,
            ok: result.canaryWindow.status === 0,
            stdout: result.canaryWindow.stdout,
            stderr: result.canaryWindow.stderr
          },
          {
            key: "fieldArmPackage",
            status: result.fieldPackage.status,
            ok: result.fieldPackage.status === 0,
            stdout: result.fieldPackage.stdout,
            stderr: result.fieldPackage.stderr
          }
        ],
        outputs: result.files,
        note: "exit 2 means field arm package was generated but current site remains blocked."
      },
      sourceStatus: {
        overall: scriptFailures.length > 0 ? "error" : "ok",
        entries: [
          {
            key: "canaryWindow",
            ok: result.canaryWindow.status === 0 || result.canaryWindow.status === 2,
            status: result.canaryWindow.status === 0 ? "ok" : result.canaryWindow.status === 2 ? "blocked" : "error",
            message: result.canaryWindow.stderr || result.canaryWindow.stdout || "canary window"
          },
          {
            key: "fieldArmPackage",
            ok: result.fieldPackage.status === 0 || result.fieldPackage.status === 2,
            status: result.fieldPackage.status === 0 ? "ok" : result.fieldPackage.status === 2 ? "blocked" : "error",
            message: result.fieldPackage.stderr || result.fieldPackage.stdout || "field arm package"
          }
        ]
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/canary-dispatch", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const deviceCode = normalizeRouteText(req.body?.deviceCode || req.query.deviceCode || readFcuDeviceCode(req));
    const confirmPhrase = normalizeRouteText(req.body?.confirmPhrase || req.query.confirmPhrase);
    const commandKind = normalizeRouteText(req.body?.commandKind || req.query.commandKind || "setpoint") || "setpoint";
    const confirmOk = confirmPhrase === "I_UNDERSTAND_REAL_BA_WRITE";
    if (!deviceCode) {
      res.status(400).json({
        ok: false,
        code: "DEVICE_CODE_REQUIRED",
        error: "deviceCode is required to execute canary dispatch.",
        requestId: req.requestId || `req-${Date.now()}`,
        controlMutation: false
      });
      return;
    }
    if (config.readOnlyMode === true || !confirmOk) {
      res.status(409).json({
        ok: false,
        code: config.readOnlyMode === true ? "READ_ONLY_MODE" : "CONFIRM_PHRASE_REQUIRED",
        error: config.readOnlyMode === true
          ? "当前 BFF 处于 read-only，禁止真实 BA 写入。"
          : "必须输入真实 BA 写入确认短语后才允许 Canary 下发。",
        requestId: req.requestId || `req-${Date.now()}`,
        site: { siteId },
        deviceCode,
        commandKind,
        dispatchRequested: true,
        dispatchAllowed: false,
        controlMutation: false,
        requiredConfirmPhrase: "I_UNDERSTAND_REAL_BA_WRITE",
        blockers: [
          ...(config.readOnlyMode === true ? [{ key: "backend_read_only", label: "后端只读总闸", severity: "P0" }] : []),
          ...(!confirmOk ? [{ key: "confirm_phrase_missing", label: "BA 写入确认短语", severity: "P0" }] : [])
        ]
      });
      return;
    }
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    if (executionGate.dispatchAllowed !== true) {
      res.status(409).json({
        ok: false,
        code: "EXECUTION_GATE_BLOCKED",
        error: "FCU 真实 Canary 下发门禁未满足。",
        requestId: req.requestId || `req-${Date.now()}`,
        site: { siteId },
        deviceCode,
        commandKind,
        dispatchRequested: true,
        dispatchAllowed: false,
        controlMutation: false,
        executionGate,
        blockers: executionGate.conditions
          .filter((item) => item.ok !== true)
          .map((item) => ({
            key: item.key,
            label: item.label,
            severity: "P0"
          }))
      });
      return;
    }
    const result = await runFcuCanaryDispatch(siteId, deviceCode, {
      bffBaseUrl: buildRequestBaseUrl(req),
      outputDir: config.fcuFinalControlOutputDir,
      confirmPhrase,
      commandKind
    });
    const reportPayload = result.report.payload || {};
    res.status(201).json({
      ok: result.report.status === "ok" && reportPayload.ok === true,
      requestId: req.requestId || `req-${Date.now()}`,
      site: { siteId },
      deviceCode,
      commandKind,
      dispatchRequested: true,
      dispatchAllowed: true,
      controlMutation: reportPayload.controlMutation === true,
      mode: reportPayload.mode || null,
      canary: reportPayload.canary || null,
      dispatch: reportPayload.dispatch || null,
      verification: reportPayload.verification || null,
      rollback: reportPayload.rollback || null,
      blockingItems: Array.isArray(reportPayload.blockingItems) ? reportPayload.blockingItems : [],
      outputs: {
        json: result.files.json,
        markdown: result.files.markdown
      },
      execution: {
        status: result.status,
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr
      }
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/control-command", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const actor = readRealtimeRequestContext(req);
    const build = typeof req.query.build === "string" ? req.query.build : "1";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "1";
    const deviceCode = readFcuDeviceCode(req);
    const dispatchRequested = req.body?.dispatch === true || req.body?.confirmDispatch === true;
    if (!deviceCode) {
      res.status(400).json({
        ok: false,
        code: "DEVICE_CODE_REQUIRED",
        error: "deviceCode is required for single FCU command.",
        requestId: req.requestId || `req-${Date.now()}`
      });
      return;
    }
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const executionGate = buildFcuExecutionGate(policy, readHvacTerminalCapability(siteId));
    const finalDispatchGate = buildFcuFinalDispatchGate(
      readFcuFinalControlEvidence(buildFcuFinalControlRefreshFilePaths(config.fcuFinalControlOutputDir))
    );
    const dispatchAllowed = dispatchRequested && executionGate.dispatchAllowed === true && finalDispatchGate.dispatchAllowed === true;
    const snapshot = filterFanCoilSnapshotByDevice(await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    }), deviceCode);
    const recentRecords = adminStore?.listFcuControlRecords
      ? adminStore.listFcuControlRecords(siteId, {
          deviceCode,
          limit: 500
        }).items
      : [];
    const cycle = evaluateManualFcuControlCommand(snapshot, policy, recentRecords, req.body?.command || req.body || {});
    const dispatchedCycle = await dispatchFcuControlCycle(cycle, {
      readOnlyMode: !dispatchAllowed,
      dispatchCommand: async (command) =>
        submitSceneDeviceCommand(siteConfig, siteId, command, {
          userId: requestContext.userId || actor.userId || "150",
          appId: requestContext.siteId || siteId,
          language: "zh",
          databaseKey: dataContext.databaseKey,
          databaseKeyCandidates: dataContext.databaseKeyCandidates,
          projectKey: dataContext.projectKey,
          projectKeyCandidates: dataContext.projectKeyCandidates,
          template: requestContext.template || "1"
        })
    });
    const persisted = persistFcuControlCycle(adminStore, siteId, dispatchedCycle, actor, {
      dryRun: !dispatchAllowed,
      requestId: req.requestId
    });
    res.status(201).json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      dispatchRequested,
      dispatchAllowed,
      executionGate,
      finalDispatchGate,
      targetDeviceCode: deviceCode,
      commandMode: "manual",
      controlMutation: persisted.summary?.controlMutation === true,
      ...persisted
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/control-records/:recordId/verify-feedback", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const dataContext = buildHvacTerminalDataContext(siteId, requestContext);
    const actor = readRealtimeRequestContext(req);
    const recordId = String(req.params.recordId || "").trim();
    const build = typeof req.query.build === "string" ? req.query.build : String(req.body?.build || "1");
    const floor = typeof req.query.floor === "string" ? req.query.floor : String(req.body?.floor || "1");
    if (!adminStore?.getFcuControlRecord || !adminStore?.verifyFcuControlRecordFeedback) {
      res.status(503).json({
        ok: false,
        code: "UNAVAILABLE",
        error: "FCU control record store is unavailable",
        requestId: req.requestId || `req-${Date.now()}`
      });
      return;
    }
    const record = adminStore.getFcuControlRecord(siteId, recordId);
    if (!record) {
      res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        error: "FCU control record not found",
        requestId: req.requestId || `req-${Date.now()}`
      });
      return;
    }
    const policyRecord = adminStore?.getFcuControlPolicy ? adminStore.getFcuControlPolicy(siteId) : null;
    const policy = normalizeFcuControlPolicy(policyRecord?.policy || buildDefaultFcuControlPolicy());
    const snapshot = await getFanCoilTerminalSnapshot(siteConfig, siteId, {
      build,
      floor,
      databaseKey: dataContext.databaseKey,
      databaseKeyCandidates: dataContext.databaseKeyCandidates,
      projectKey: dataContext.projectKey,
      projectKeyCandidates: dataContext.projectKeyCandidates
    });
    const verification = verifyFcuControlRecordFeedback(record, snapshot, policy);
    const updated = adminStore.verifyFcuControlRecordFeedback(siteId, recordId, verification, actor, {
      requestId: req.requestId
    });
    res.json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      controlMutation: false,
      record: updated,
      feedback: updated.feedback || verification.feedback || null
    });
  });

  router.post("/sites/:siteId/hvac-terminal/fan-coils/control-records/:recordId/rollback", async (req, res) => {
    const siteId = resolveHvacTerminalSiteId(req, config.defaultSiteId);
    const recordId = String(req.params.recordId || "").trim();
    const actor = readRealtimeRequestContext(req);
    if (!adminStore?.rollbackFcuControlRecord) {
      res.status(503).json({
        ok: false,
        code: "UNAVAILABLE",
        error: "FCU control record store is unavailable",
        requestId: req.requestId || `req-${Date.now()}`
      });
      return;
    }
    const record = adminStore.rollbackFcuControlRecord(siteId, recordId, req.body || {}, actor, {
      requestId: req.requestId
    });
    res.json({
      ok: true,
      requestId: req.requestId || `req-${Date.now()}`,
      controlMutation: false,
      record
    });
  });

  router.get("/sites/:siteId/runtime/summary", async (req, res) => {
    const siteId = resolveSiteId(req, config.defaultSiteId);
    const siteConfig = getRequestSiteConfig(req, config);
    const requestContext = readProjectDataRequestContext(req);
    const build = typeof req.query.build === "string" ? req.query.build : "";
    const floor = typeof req.query.floor === "string" ? req.query.floor : "";
    const mock = typeof req.query.mock === "string" ? req.query.mock : "";
    const data = await getRuntimePointSummary(siteConfig, siteId, {
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
