import { getCurrentLocale } from "../i18n/zhCN";
import { getAuthSession, getCurrentProject, type AuthProject } from "./auth";

function resolveDefaultBffBaseUrl(): string {
  const configuredBaseUrl =
    typeof import.meta.env.VITE_BFF_BASE_URL === "string"
      ? import.meta.env.VITE_BFF_BASE_URL.trim()
      : "";
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }
  if (typeof window !== "undefined" && typeof window.location?.origin === "string") {
    return window.location.origin;
  }
  return "http://127.0.0.1:8787";
}

const DEFAULT_BFF_BASE_URL = resolveDefaultBffBaseUrl();
const LOCAL_BFF_FALLBACK_PORTS = [8787, 8788, 8789, 8790, 8791] as const;
const UI_BADGE_STATE_URL = import.meta.env.VITE_UI_BADGE_STATE_URL || "/ui-badge-state-v1.8.json";

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function buildBffBaseUrlCandidates(baseUrl: string): string[] {
  const normalized = normalizeBaseUrl(baseUrl);
  try {
    const parsed = new URL(normalized);
    if (!isLocalLoopbackHost(parsed.hostname)) {
      return [normalized];
    }
    return Array.from(
      new Set([
        normalized,
        ...LOCAL_BFF_FALLBACK_PORTS.map((port) => `${parsed.protocol}//${parsed.hostname}:${port}`)
      ])
    );
  } catch (_error) {
    return [normalized];
  }
}

const BFF_BASE_URL_CANDIDATES = buildBffBaseUrlCandidates(DEFAULT_BFF_BASE_URL);
let activeBffBaseUrl = BFF_BASE_URL_CANDIDATES[0] || DEFAULT_BFF_BASE_URL;
let lastFallbackLoggedAt = 0;
const pendingJsonRequests = new Map<string, Promise<unknown>>();

function buildBffUrl(baseUrl: string, path: string): string {
  return new URL(path, `${normalizeBaseUrl(baseUrl)}/`).toString();
}

function isLikelyTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror") ||
    message.includes("network request failed")
  );
}

function logLocalBffFallback(fromBaseUrl: string, toBaseUrl: string, error: unknown) {
  const now = Date.now();
  if (now - lastFallbackLoggedAt < 10_000) {
    return;
  }
  lastFallbackLoggedAt = now;
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn(`[bffClient] local BFF fallback: ${fromBaseUrl} -> ${toBaseUrl} (${errorMessage})`);
}

async function fetchFromBff(path: string, init?: RequestInit): Promise<Response> {
  const orderedCandidates = Array.from(
    new Set(
      [
        BFF_BASE_URL_CANDIDATES[0],
        activeBffBaseUrl,
        ...BFF_BASE_URL_CANDIDATES
      ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0)
    )
  );
  let lastError: unknown = null;
  let pendingFallbackLog: { fromBaseUrl: string; error: unknown } | null = null;
  for (let index = 0; index < orderedCandidates.length; index += 1) {
    const baseUrl = orderedCandidates[index];
    try {
      const response = await fetch(buildBffUrl(baseUrl, path), init);
      if (pendingFallbackLog && baseUrl !== pendingFallbackLog.fromBaseUrl) {
        logLocalBffFallback(pendingFallbackLog.fromBaseUrl, baseUrl, pendingFallbackLog.error);
      }
      activeBffBaseUrl = baseUrl;
      return response;
    } catch (error) {
      lastError = error;
      const hasAlternate = index < orderedCandidates.length - 1;
      if (!hasAlternate || !isLikelyTransportError(error)) {
        throw error;
      }
      if (!pendingFallbackLog) {
        pendingFallbackLog = { fromBaseUrl: baseUrl, error };
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`BFF request failed for ${path}`);
}

function buildJsonRequestDedupeKey(path: string, headers: Headers): string {
  const scopedHeaderKeys = [
    "x-chiller-site-id",
    "x-chiller-site-code",
    "x-chiller-project-database-key",
    "x-chiller-project-key",
    "x-chiller-project-template",
    "x-chiller-user-id"
  ];
  const scopedHeaderParts = scopedHeaderKeys.map(
    (key) => `${key}:${normalizeHeaderText(headers.get(key)) || ""}`
  );
  return `${path}::${scopedHeaderParts.join("|")}`;
}

export type SourceEndpointStatusDto = {
  key?: string;
  endpoint?: string;
  ok?: boolean;
  fallback?: boolean;
  reasonCode?: string | null;
  status?: number | null;
  message?: string | null;
  error?: string | null;
  rows?: number | null;
  baseUrl?: string | null;
  interfaceKind?: string | null;
  originLabel?: string | null;
};

export type SourceStatusDto = {
  overall?: "ok" | "partial" | "failed";
  sources?: SourceEndpointStatusDto[];
};

export type FreshnessDto = {
  label?: "fresh" | "stale" | "unknown" | string;
  latestTimestamp?: string | null;
  stale?: boolean;
  ageHours?: number | null;
};

export type ColdStationLogSummaryDto = {
  inputPower?: number | null;
  outputCoolingCapacity?: number | null;
  systemHeatDissipation?: number | null;
  systemEfficiency?: number | null;
  hostPower?: number | null;
  refrigeratingPumpPower?: number | null;
  coolingPumpPower?: number | null;
  coolingTowerPower?: number | null;
};

export type ColdStationLogItemDto = {
  id?: string;
  time?: string;
  timestamp?: string | null;
  systemCoolingCapacity?: number | null;
  systemPower?: number | null;
  hostPower?: number | null;
  refrigeratingPumpPower?: number | null;
  coolingPumpPower?: number | null;
  coolingTowerPower?: number | null;
  systemEfficiency?: number | null;
  hostEfficiency?: number | null;
  refrigerationPumpConveyingCoefficient?: number | null;
  coolingPumpConveyingCoefficient?: number | null;
  coolingTowerConveyingCoefficient?: number | null;
  chilledWaterInputTemperature?: number | null;
  chilledWaterOutputTemperature?: number | null;
  coolingWaterInputTemperature?: number | null;
  coolingWaterOutputTemperature?: number | null;
};

export type ColdStationLogDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  date?: string;
  summary?: ColdStationLogSummaryDto | null;
  items?: ColdStationLogItemDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type OperationRecordListItemDto = {
  id?: string;
  date?: string;
  timestamp?: string | null;
  details?: string;
  operationResult?: string;
  operationPerson?: string;
};

export type OperationRecordListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: OperationRecordListItemDto[];
  total?: number;
  page?: number;
  pageSize?: number;
  filters?: {
    startDate?: string | null;
    endDate?: string | null;
    drTypeId?: string | null;
    drId?: string | null;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type OperationRecordDeviceTypeNodeDto = {
  id?: string;
  label?: string;
  parentId?: string | null;
  children?: OperationRecordDeviceTypeNodeDto[];
};

export type OperationRecordDeviceTypeDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: OperationRecordDeviceTypeNodeDto[];
  sourceStatus?: SourceStatusDto;
};

export type OperationRecordDeviceOptionDto = {
  id?: string;
  label?: string;
};

export type OperationRecordDeviceOptionsDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  drTypeId?: string;
  items?: OperationRecordDeviceOptionDto[];
  sourceStatus?: SourceStatusDto;
};

export type KnowledgeDeviceTypeNodeDto = {
  id?: string;
  label?: string;
  parentId?: string | null;
  children?: KnowledgeDeviceTypeNodeDto[];
};

export type KnowledgeDeviceTypeDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: KnowledgeDeviceTypeNodeDto[];
  sourceStatus?: SourceStatusDto;
};

export type KnowledgeDocumentItemDto = {
  id?: string;
  name?: string;
  typeId?: string;
  typeName?: string;
  description?: string;
  filePath?: string;
  fileName?: string;
};

export type KnowledgeDocumentListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: KnowledgeDocumentItemDto[];
  total?: number;
  page?: number;
  pageSize?: number;
  sourceStatus?: SourceStatusDto;
};

export type KnowledgeMutationDto = {
  ok?: boolean;
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  message?: string;
};

export type EnergyParameterItemDto = {
  id?: string;
  schemeName?: string;
  startPeriod?: string;
  endPeriod?: string;
  peakPeriod?: string[];
  peakPrice?: string;
  averagePeriod?: string[];
  averagePrice?: string;
  valleyPeriod?: string[];
  valleyPrice?: string;
  sharpTime?: string[];
  sharpPrice?: string;
};

export type EnergyParameterDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  item?: EnergyParameterItemDto | null;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type MeterReadingCellValue = string | number | boolean | null;

export type MeterReadingRowDto = Record<string, MeterReadingCellValue>;

export type MeterReadingDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    startTime?: string;
    endTime?: string;
  };
  columns?: string[];
  items?: MeterReadingRowDto[];
  total?: number;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyAnalysisNodeDto = {
  id?: string;
  label?: string;
  nodeType?: "energy_category" | "device_type" | "device" | string;
  parentId?: string | null;
  typeId?: string | null;
  typeLabel?: string | null;
  deviceId?: string | null;
  deviceCount?: number | null;
  childCount?: number | null;
  children?: EnergyAnalysisNodeDto[];
};

export type EnergyAnalysisTreeDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: EnergyAnalysisNodeDto[];
  sourceStatus?: SourceStatusDto;
};

export type EnergyAnalysisSummaryRowDto = {
  id?: string;
  objectName?: string;
  sumValue?: number | null;
  maxValue?: number | null;
  maxTime?: string | null;
  minValue?: number | null;
  minTime?: string | null;
  average?: number | null;
  unit?: string | null;
};

export type EnergyAnalysisSeriesPointDto = {
  label?: string;
  value?: number | null;
};

export type EnergyAnalysisSeriesDto = {
  id?: string;
  name?: string;
  unit?: string | null;
  points?: EnergyAnalysisSeriesPointDto[];
};

export type EnergyAnalysisDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    dateType?: string;
    deviceIds?: string[];
  };
  summaries?: EnergyAnalysisSummaryRowDto[];
  series?: EnergyAnalysisSeriesDto[];
  axisLabels?: string[];
  unit?: string;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyEfficiencySeriesPointDto = {
  label?: string;
  value?: number | null;
};

export type EnergyEfficiencySeriesDto = {
  id?: string;
  name?: string;
  points?: EnergyEfficiencySeriesPointDto[];
};

export type EnergyEfficiencyTableRowDto = {
  id?: string;
  object?: string;
  wholeValue?: string | null;
  averageValue?: string | null;
  tenPercentGoodAverageValue?: string | null;
  tenPercentBadAverageValue?: string | null;
};

export type EnergyEfficiencyReportDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    timeSpace?: string;
    deviceKeys?: string[];
    deviceKey?: string;
    dates?: string[];
  };
  tableRows?: EnergyEfficiencyTableRowDto[];
  series?: EnergyEfficiencySeriesDto[];
  axisLabels?: string[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyEfficiencyProportionRowDto = {
  id?: string;
  rangeLabel?: string;
  loadRatioPct?: number | null;
  stationEfficiency?: number | null;
};

export type EnergyEfficiencyProportionDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    date?: string;
    dateType?: string;
  };
  rows?: EnergyEfficiencyProportionRowDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyEfficiencyCalendarDayDto = {
  id?: string;
  date?: string;
  day?: string;
  efficiency?: number | null;
  rawEfficiency?: number | null;
  power?: number | null;
  cooling?: number | null;
  unitPrice?: number | null;
  cost?: number | null;
  hasData?: boolean;
};

export type EnergyEfficiencyCalendarDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  month?: string;
  items?: EnergyEfficiencyCalendarDayDto[];
  monthSummary?: EnergyEfficiencyCalendarDayDto | null;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyEfficiencyCalendarPieSegmentDto = {
  id?: string;
  name?: string;
  value?: number | null;
};

export type EnergyEfficiencyCalendarPieDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    date?: string;
    dateType?: string;
  };
  segments?: EnergyEfficiencyCalendarPieSegmentDto[];
  total?: number | null;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type EnergyEfficiencyImbalancePointDto = {
  label?: string;
  value?: number | null;
};

export type EnergyEfficiencyImbalanceSeriesDto = {
  id?: string;
  name?: string;
  points?: EnergyEfficiencyImbalancePointDto[];
};

export type EnergyEfficiencyImbalanceStatisticRowDto = {
  id?: string;
  acquisitionValue?: string;
  scalar?: number | null;
  noScalar?: number | null;
  scalarRate?: number | null;
};

export type EnergyEfficiencyImbalanceDeviceRowDto = {
  id?: string;
  deviceName?: string;
  deviceTypeName?: string;
  scalarRate?: number | null;
};

export type EnergyEfficiencyImbalanceDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    dateType?: string;
    energyType?: string;
  };
  series?: EnergyEfficiencyImbalanceSeriesDto[];
  axisLabels?: string[];
  statisticsRows?: EnergyEfficiencyImbalanceStatisticRowDto[];
  deviceRows?: EnergyEfficiencyImbalanceDeviceRowDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type ReportRecordRegOptionDto = {
  id?: string;
  label?: string;
};

export type ReportRecordRegOptionsDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  drTypeId?: string;
  drId?: string;
  items?: ReportRecordRegOptionDto[];
  sourceStatus?: SourceStatusDto;
};

export type ReportRecordRowDto = Record<string, MeterReadingCellValue>;

export type ReportRecordDrRegDto = {
  drId: string | number;
  regIds: Array<string | number>;
};

export type ReportRecordChartSeriesDto = {
  name?: string;
  values?: Array<number | null>;
};

export type ReportRecordChartDto = {
  labels?: string[];
  series?: ReportRecordChartSeriesDto[];
};

export type ReportRecordDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    startTime?: string;
    endTime?: string;
    drTypeId?: string;
    drId?: string;
    regIds?: string[];
    dateType?: string;
    drRegList?: ReportRecordDrRegDto[];
  };
  columns?: string[];
  items?: ReportRecordRowDto[];
  summaryColumns?: string[];
  summaryItems?: ReportRecordRowDto[];
  chart?: ReportRecordChartDto;
  total?: number;
  page?: number;
  pageSize?: number;
  filenamePrefix?: string;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type PerformanceReportSummaryDto = {
  id?: string;
  tagName?: string;
  label?: string;
  average?: string;
  title?: string;
};

export type PerformanceReportSeriesPointDto = {
  label?: string;
  value?: number | null;
};

export type PerformanceReportSeriesDto = {
  id?: string;
  name?: string;
  points?: PerformanceReportSeriesPointDto[];
};

export type PerformanceReportDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    metric?: string;
    startTime?: string;
    endTime?: string;
    language?: string;
    unit?: string;
    modelKey?: string;
    template?: string;
  };
  summaries?: PerformanceReportSummaryDto[];
  series?: PerformanceReportSeriesDto[];
  axisLabels?: string[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DashboardOverviewDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  energyCards?: {
    currentCop?: number | null;
    totalPowerKw?: number | null;
    currentLoadRate?: number | null;
    totalElectricityKwh?: number | null;
    savingPotentialPct?: number | null;
    totalCoolingCapacity?: number | null;
    chilledDeltaT?: number | null;
    coolingDeltaT?: number | null;
    chillerPowerKw?: number | null;
    chilledPumpPowerKw?: number | null;
    coolingPumpPowerKw?: number | null;
    coolingTowerPowerKw?: number | null;
    chillerCop?: number | null;
    chilledPumpConveyingCoefficient?: number | null;
    coolingTowerConveyingCoefficient?: number | null;
    coolingPumpConveyingCoefficient?: number | null;
    thermalUnbalanceRate?: number | null;
    chilledSupplyTemp?: number | null;
    coolingReturnTemp?: number | null;
    outdoorTempC?: number | null;
    outdoorHumidityPct?: number | null;
    outdoorWetBulbC?: number | null;
    dewPointC?: number | null;
    activeAnomalyCount?: number | null;
  };
  deviceSummary?: {
    totalDevices?: number;
    chillerCount?: number;
    chilledPumpCount?: number;
    coolingPumpCount?: number;
    coolingTowerCount?: number;
  } | null;
  alarmSummary?: {
    total?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DashboardTrendSeriesDto = {
  metric?: string;
  label?: string;
  points?: Array<{
    t?: string;
    v?: number | null;
  }>;
};

export type DashboardTrendStatDto = {
  metric?: string;
  latest?: number | null;
  min?: number | null;
  max?: number | null;
};

export type DashboardTrendsDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  range?: "24h" | "7d" | "30d";
  series?: DashboardTrendSeriesDto[];
  stats?: DashboardTrendStatDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type TopologySummaryDto = {
  totalDevices?: number;
  chillerCount?: number;
  chilledPumpCount?: number;
  coolingPumpCount?: number;
  coolingTowerCount?: number;
};

export type TopologyGroupDto = {
  id?: string;
  name?: string;
  type?: string;
  floor?: string;
};

export type TopologyNodeDto = {
  id?: string;
  label?: string;
  count?: number | null;
  downstream?: string | null;
  status?: "running" | "stable" | "alert" | string | null;
  examples?: string[];
  exampleLines?: string[];
};

export type SystemTopologyDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  summary?: TopologySummaryDto;
  groups?: TopologyGroupDto[];
  nodes?: TopologyNodeDto[];
  sourceStatus?: SourceStatusDto;
};

export type SystemDiagramPointDto = {
  x?: number | null;
  y?: number | null;
  z?: number | null;
};

export type SystemDiagramPositionHintDto = SystemDiagramPointDto & {
  anchor?: string | null;
  column?: number | null;
  row?: number | null;
  lane?: number | null;
};

export type SystemDiagramRotationHintDto = {
  x?: number | null;
  y?: number | null;
  z?: number | null;
};

export type SystemDiagramStatusSummaryDto = {
  runStatus?: "run" | "stop" | "unknown" | string | null;
  alarmStatus?: "normal" | "alarm" | "unknown" | string | null;
  degraded?: boolean | null;
  latestUpdateAt?: string | null;
};

export type SystemDiagramNodeDto = {
  id?: string;
  nodeType?: "device" | "valve" | "header" | "load" | "sensor" | "virtual" | string;
  label?: string;
  systemType?: string | null;
  role?: string | null;
  group?: string | null;
  deviceIdRef?: string | null;
  deviceIds?: string[];
  modelCategory?: string | null;
  floor?: string | null;
  area?: string | null;
  positionHint?: SystemDiagramPositionHintDto | null;
  rotationHint?: SystemDiagramRotationHintDto | null;
  scaleHint?: number | null;
  statusSummary?: SystemDiagramStatusSummaryDto | null;
  metadata?: Record<string, unknown> | null;
};

export type SystemDiagramEdgeDto = {
  id?: string;
  from?: string;
  to?: string;
  edgeType?: "pipe" | "control" | "logical" | string;
  pipeClass?: "chilled_supply" | "chilled_return" | "cooling_supply" | "cooling_return" | "bypass" | string | null;
  routeHint?: {
    points?: SystemDiagramPointDto[];
  } | null;
  valveRefs?: string[];
  label?: string | null;
  direction?: string | null;
  branchGroup?: string | null;
};

export type SystemDiagramGroupDto = {
  id?: string;
  label?: string;
  groupType?: "loop" | "floor" | "area" | "header" | string;
  nodeIds?: string[];
};

export type SystemDiagramStatsDto = {
  totalNodes?: number | null;
  totalEdges?: number | null;
  deviceNodeCount?: number | null;
  virtualNodeCount?: number | null;
  degradedNodeCount?: number | null;
};

export type SystemDiagramDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  layoutMode?: "auto" | "fixed" | string;
  scope?: "main_loop" | "full" | string;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
  nodes?: SystemDiagramNodeDto[];
  edges?: SystemDiagramEdgeDto[];
  groups?: SystemDiagramGroupDto[];
  stats?: SystemDiagramStatsDto | null;
};

export type AnomalySummaryDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  counts?: {
    total?: number;
    critical?: number;
    major?: number;
    minor?: number;
    normal?: number;
  };
  latestEvents?: Array<{
    id?: string;
    title?: string | null;
    severity?: "critical" | "major" | "minor" | "normal";
    alarmLevel?: string | null;
    alarmTypeName?: string | null;
    state?: string | null;
    occurredAt?: string | null;
    source?: string | null;
    alarmExplain?: string | null;
    regId?: string | null;
    value?: string | null;
  }>;
  diagnosisFlags?: {
    staleAlarmFeed?: boolean;
    missingHighSeverity?: boolean;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type AnomalyListItemDto = {
  id?: string;
  title?: string | null;
  severity?: "critical" | "major" | "minor" | "normal" | null;
  alarmLevel?: string | null;
  alarmTypeName?: string | null;
  state?: string | null;
  occurredAt?: string | null;
  source?: string | null;
  alarmExplain?: string | null;
  regId?: string | null;
  value?: string | null;
};

export type AnomalyListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: AnomalyListItemDto[];
  page?: number;
  pageSize?: number;
  total?: number;
  filters?: {
    severity?: string | null;
    state?: string | null;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type RecommendationDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  summary?: {
    total?: number;
    highRisk?: number;
    criticalSeverity?: number;
  };
  cards?: Array<{
    id?: string;
    title?: string;
    priority?: "high" | "medium" | "low";
    category?: string;
    reason?: string;
    actions?: string[];
    evidence?: string[];
    severity?: "critical" | "major" | "minor";
    risk?: string;
    relatedDevices?: string[];
    ruleId?: string | null;
  }>;
  ruleEvaluation?: {
    rulesLoaded?: boolean;
    error?: string | null;
    ruleSetId?: string | null;
    version?: string | null;
    totalEnabledRules?: number;
    matchedRuleIds?: string[];
    skippedRuleIds?: string[];
    skippedRuleDetails?: Array<{
      ruleId?: string;
      reason?: string;
      missingMetrics?: Array<{
        metric?: string;
        category?: "upstream_unreachable" | "field_missing_or_invalid" | "unknown";
        message?: string | null;
      }>;
    }>;
    missingMetricPolicy?: string | null;
  };
  sourceStatus?: SourceStatusDto;
};

export type AiDigestIssueDto = {
  code?: string;
  domain?: string;
  level?: "blocked" | "caution" | string;
  message?: string;
};

export type AiDigestDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  summary?: {
    stage?: string;
    label?: string;
    headline?: string;
    summary?: string;
    tone?: "positive" | "caution" | "danger" | "neutral" | string;
    confidence?: "high" | "medium" | "low" | string;
  };
  operationsGate?: {
    level?: "ready" | "caution" | "blocked" | string;
    summary?: string;
    reasonCodes?: string[];
    blockers?: AiDigestIssueDto[];
    risks?: AiDigestIssueDto[];
  };
  governance?: {
    status?: "idle" | "pending" | "rollback-watch" | "approved-history" | string;
    summary?: string;
    outcomeClass?: string;
    pendingApprovalCount?: number | null;
    approvedCount?: number | null;
    rolledBackCount?: number | null;
    latestExecutionId?: string | null;
    latestExecutionStatus?: string | null;
    latestExecutionAt?: string | null;
    latestExecutionType?: string | null;
    latestDispatchStatus?: string | null;
    approveDispatchStatus?: string | null;
    approveDispatchCode?: string | null;
    approveDispatchMode?: string | null;
    rollbackDispatchStatus?: string | null;
    rollbackDispatchCode?: string | null;
    latestObservedSnapshot?: {
      phase?: string | null;
      capturedAt?: string | null;
      systemCop?: number | null;
      totalPowerKw?: number | null;
      activeAlarmCount?: number | null;
      thermalUnbalanceRate?: number | null;
    } | null;
    observedBaselineComparison?: {
      status?: string | null;
      summary?: string | null;
      systemCopDelta?: number | null;
      totalPowerDeltaKw?: number | null;
      activeAlarmDelta?: number | null;
      thermalUnbalanceDelta?: number | null;
    } | null;
    observedTargetComparison?: {
      status?: string | null;
      summary?: string | null;
      observedCopGap?: number | null;
      observedPowerGapKw?: number | null;
    } | null;
    signals?: string[];
  };
  nextAction?: {
    code?: string;
    label?: string;
    summary?: string;
    endpoint?: string;
  };
  blockers?: AiDigestIssueDto[];
  risks?: AiDigestIssueDto[];
  signals?: string[];
  metrics?: {
    systemCop?: number | null;
    totalPowerKw?: number | null;
    activeAlarmCount?: number | null;
    thermalUnbalanceRate?: number | null;
    recommendationCount?: number | null;
    highRiskRecommendationCount?: number | null;
    pendingApprovalCount?: number | null;
    approvedExecutionCount?: number | null;
    rolledBackExecutionCount?: number | null;
  };
  recommendations?: {
    total?: number | null;
    highRisk?: number | null;
    criticalSeverity?: number | null;
    primaryTitle?: string | null;
    primaryReason?: string | null;
    primaryActions?: string[];
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
  generatedAt?: string;
};

export type DeviceListItemDto = {
  deviceId?: string;
  deviceCode?: string;
  deviceName?: string;
  deviceTypeId?: string | null;
  deviceTypeName?: string | null;
  systemType?: "chiller" | "chilledPump" | "coolingPump" | "coolingTower" | "other" | string;
  floorName?: string;
  buildingName?: string;
  usageType?: string;
  iconPath?: string | null;
  isVirtual?: boolean | null;
  isPlaceholder?: boolean | null;
  status?: "online" | "offline" | "unknown" | string;
  lastReportAt?: string | null;
};

export type WorkOrderItemDto = {
  id?: string;
  deviceTypeId?: string;
  deviceTypeName?: string;
  deviceId?: string;
  deviceName?: string;
  workTime?: string;
  workTimestamp?: string | null;
  workUser?: string;
  workLevel?: number | null;
  executeUser?: string;
  executeTime?: string;
  executeTimestamp?: string | null;
  finishTime?: string;
  finishTimestamp?: string | null;
  state?: number | null;
  workExplain?: string;
};

export type WorkOrderListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: WorkOrderItemDto[];
  total?: number;
  page?: number;
  pageSize?: number;
  filters?: {
    id?: string | null;
    state?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type WorkOrderAssigneeDto = {
  id?: string;
  username?: string;
};

export type WorkOrderAssigneeListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: WorkOrderAssigneeDto[];
  sourceStatus?: SourceStatusDto;
};

export type WorkOrderMutationDto = {
  ok?: boolean;
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  message?: string;
};

export type EnvironmentBuildingItemDto = {
  id?: string;
  name?: string;
  description?: string;
  modelUrl?: string;
  template?: string;
};

export type EnvironmentBuildingListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: EnvironmentBuildingItemDto[];
  sourceStatus?: SourceStatusDto;
};

export type EnvironmentConditionItemDto = {
  id?: string;
  buildingId?: string;
  monitoringSite?: string;
  temperatureValue?: string;
  humidityValue?: string;
  temperatureSetting?: string;
  temperatureMax?: string;
  temperatureDeviation?: string;
  humiditySetting?: string;
  humidityMax?: string;
  humidityDeviation?: string;
  temperatureTagName?: string;
  humidityTagName?: string;
  supplyAirTagName?: string;
  returnAirTagName?: string;
  supplyAirValue?: string;
  returnAirValue?: string;
};

export type EnvironmentConditionListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  filters?: {
    buildingId?: string | null;
    cooledAir?: string | null;
    monitoringSite?: string | null;
  };
  items?: EnvironmentConditionItemDto[];
  sourceStatus?: SourceStatusDto;
};

export type DeviceListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: DeviceListItemDto[];
  page?: number;
  pageSize?: number;
  total?: number;
  filters?: {
    type?: string | null;
    floor?: string | null;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DeviceTreeNodeDto = {
  id?: string;
  label?: string;
  nodeType?: "root" | "group" | "device" | "point" | string;
  parentId?: string | null;
  deviceIdRef?: string | null;
  deviceCode?: string | null;
  deviceName?: string | null;
  systemType?: "chiller" | "chilledPump" | "coolingPump" | "coolingTower" | "other" | string | null;
  floorName?: string | null;
  buildingName?: string | null;
  status?: "online" | "offline" | "unknown" | string | null;
  lastReportAt?: string | null;
  childCount?: number | null;
  children?: DeviceTreeNodeDto[];
};

export type DeviceTreeDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  tree?: DeviceTreeNodeDto | null;
  filters?: {
    build?: number | null;
    floor?: number | null;
  };
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DeviceDetailDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  detail?: {
    deviceId?: string;
    deviceCode?: string;
    deviceName?: string;
    deviceTypeCode?: string | null;
    deviceTypeName?: string | null;
    floorName?: string;
    buildingName?: string;
    usageType?: string;
    iconPath?: string | null;
    isVirtual?: boolean | null;
    isPlaceholder?: boolean | null;
    runStatusText?: string | null;
    alarmStatusText?: string | null;
    latestUpdateAt?: string | null;
    controlSignals?: Array<{
      key?: string;
      label?: string;
      value?: string;
      active?: boolean;
      tone?: "good" | "warn" | "neutral" | string;
    }>;
    treeNodeType?: string | null;
    treeChildCount?: number | null;
    pointCount?: number | null;
  } | null;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DeviceDetailBatchItemDto = {
  deviceId?: string;
  detail?: DeviceDetailDto["detail"];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type DeviceDetailBatchDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: DeviceDetailBatchItemDto[];
  summary?: {
    requested?: number;
    resolved?: number;
    missing?: number;
  };
  sourceStatus?: SourceStatusDto;
};

export type SceneLegacyPointDto = {
  label?: string;
  timestamp?: string | null;
  value?: number | null;
};

export type SceneLegacyTrendDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  title?: string;
  unit?: string | null;
  filters?: {
    tagname?: string;
    title?: string;
    date?: string;
  };
  points?: SceneLegacyPointDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type SceneOnlineMonitorDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  title?: string;
  unit?: string | null;
  points?: SceneLegacyPointDto[];
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
};

export type SceneFloorModelItemDto = {
  key?: string;
  name?: string;
  parentKey?: string;
  model2dUrl?: string;
  model3dUrl?: string;
};

export type SceneFloorModelListDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  items?: SceneFloorModelItemDto[];
  sourceStatus?: SourceStatusDto;
};

export type SceneDeviceParameterItemDto = {
  id?: string;
  groupName?: string;
  label?: string;
  value?: string;
  unit?: string;
  displayValue?: string;
  regSub?: string;
  regName?: string;
  tagName?: string;
  drTypeId?: string;
  controlOptions?: Array<{
    value?: string;
    text?: string;
  }>;
  readWrite?: string;
  writable?: boolean;
};

export type SceneDeviceParameterGroupDto = {
  groupName?: string;
  items?: SceneDeviceParameterItemDto[];
};

export type SceneDeviceInfoItemDto = {
  name?: string;
  value?: string;
  unit?: string;
};

export type SceneDeviceInfoLayoutGroupDto = {
  index?: number;
  title?: string;
  items?: SceneDeviceInfoItemDto[];
};

export type SceneDeviceInfoDto = {
  visible?: boolean;
  isShowDrInfo?: string;
  imageUrl?: string;
  load?: string;
  runStatus?: string;
  standingItems?: SceneDeviceInfoItemDto[];
  layoutGroups?: SceneDeviceInfoLayoutGroupDto[];
};

export type SceneDeviceOperationRecordDto = {
  id?: string;
  details?: string;
  operationResult?: string;
  operationPerson?: string;
  date?: string;
};

export type SceneDeviceAlarmRecordDto = {
  id?: string;
  alarmTypeName?: string;
  alarmState?: string;
  alarmExplain?: string;
  time?: string;
};

export type SceneDeviceParametersDto = {
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  drId?: string;
  deviceName?: string;
  deviceInfo?: SceneDeviceInfoDto;
  groups?: SceneDeviceParameterGroupDto[];
  controlGroups?: SceneDeviceParameterGroupDto[];
  items?: SceneDeviceParameterItemDto[];
  operationRecords?: SceneDeviceOperationRecordDto[];
  alarmRecords?: SceneDeviceAlarmRecordDto[];
  sourceStatus?: SourceStatusDto;
};

export type SceneDeviceCommandResultDto = {
  ok?: boolean;
  message?: string | null;
  error?: string | null;
  command?: {
    drId?: string;
    drTypeId?: string;
    regName?: string;
    value?: string;
    tagName?: string;
    msg?: string;
  };
  sourceStatus?: SourceStatusDto;
};

export type UiBadgeLocaleTextDto = Partial<Record<"zh-CN" | "en-US" | "vi-VN", string>>;

export type UiBadgeDecisionDto = {
  pass?: boolean;
  text?: UiBadgeLocaleTextDto;
};

export type UiBadgeStateDto = {
  rule?: string;
  global?: UiBadgeDecisionDto;
  pages?: Record<string, UiBadgeDecisionDto | undefined>;
};

export type OptimizeDraftRequestDto = {
  context?: {
    siteId?: string;
  };
  inputs?: {
    loadKw?: number;
    loadSource?: "scenario" | "metered" | "live_meter" | string;
    outdoorTempC?: number;
    mode?: "cooling" | string;
    equipmentContext?: {
      activeChillerIds?: string[];
      activeChillerModels?: string[];
    };
  };
};

export type OptimizeDraftDetailsDto = {
  site?: {
    siteId?: string;
  };
  decision?: {
    summary?: string;
    confidence?: string;
  };
  request?: {
    loadKw?: number;
    outdoorTempC?: number;
    mode?: string;
  };
  recommendation?: {
    systemCop?: number | null;
    totalPowerKw?: number | null;
    steps?: string[];
  };
  gate?: {
    level?: "ready" | "caution" | "blocked" | string;
    title?: string;
    reason?: string;
  };
  baseline?: {
    systemCop?: number | null;
    totalPowerKw?: number | null;
    chilledDeltaT?: number | null;
    coolingDeltaT?: number | null;
    chillerPowerKw?: number | null;
    chilledPumpPowerKw?: number | null;
    coolingPumpPowerKw?: number | null;
    coolingTowerPowerKw?: number | null;
    chilledSupplyTemp?: number | null;
    coolingReturnTemp?: number | null;
    thermalUnbalanceRate?: number | null;
    activeAlarmCount?: number | null;
  };
  historyBenchmark?: {
    status?: "ready" | "partial" | "unavailable" | string;
    mode?: "load-band" | string;
    ratedCoolingCapacityKw?: number | null;
    requestedLoadRatePct?: number | null;
    matchedBucketLabel?: string;
    matchingTier?: "load-wetbulb-strict" | "load-wetbulb-relaxed" | "load-only-fallback" | "unavailable" | string;
    fallbackLevel?: number | null;
    requestedWetBulbC?: number | null;
    matchedWetBulbBand?: string;
    matchedWetBulbBands?: string[];
    wetBulbToleranceC?: number | null;
    confidence?: "high" | "medium" | "low" | string;
    sampleWindow?: {
      defaultMonths?: string[];
      months?: string[];
      maxMonths?: number | null;
    } | string | string[];
    sampleCount?: number | null;
    referenceCop?: {
      low?: number | null;
      median?: number | null;
      high?: number | null;
    };
    currentGap?: {
      copDeltaToMedian?: number | null;
      powerDeltaKwToMedian?: number | null;
    };
    note?: string;
    links?: {
      proportionHref?: {
        href?: string;
        enabled?: boolean;
        label?: string;
      };
      compareHref?: {
        href?: string;
        enabled?: boolean;
        label?: string;
      };
    };
  };
  benefitEstimate?: {
    status?: "ready" | "partial" | "unavailable" | string;
    opportunityLevel?: "low" | "medium" | "high" | string;
    confidence?: "high" | "medium" | "low" | string;
    expectedTargetCop?: number | null;
    expectedTargetPowerKw?: number | null;
    expectedPowerDeltaKw?: number | null;
    expectedPowerDeltaPct?: number | null;
    expectedCopDelta?: number | null;
    basis?: {
      matchingTier?: string;
      fallbackLevel?: number | null;
      sampleCount?: number | null;
      monthCount?: number | null;
      matchedWetBulbBand?: string;
      matchedWetBulbBands?: string[];
      requestedWetBulbC?: number | null;
      wetBulbToleranceC?: number | null;
    };
    disclaimer?: string;
  };
  towerApproachAdvisor?: {
    status?: "ready" | "partial" | "unavailable" | string;
    currentApproachC?: number | null;
    currentTcwsC?: number | null;
    requestedWetBulbC?: number | null;
    targetApproachC?: number | null;
    targetTcwsC?: number | null;
    targetBandC?: {
      low?: number | null;
      high?: number | null;
      label?: string;
    };
    executionReady?: boolean;
    dispatchReady?: boolean;
    executionMode?: "read_only" | "shadow" | "assisted" | "enforced" | string;
    dispatchMode?: "off" | "shadow" | "assisted" | "enforced" | string;
    controlMode?: string;
    reason?: string;
    disclaimer?: string;
    blockers?: string[];
    warnings?: string[];
    inputSignals?: Array<{
      key?: string;
      label?: string;
      value?: number | string | null;
      unit?: string | null;
      required?: boolean;
      ok?: boolean;
      reason?: string | null;
    }>;
    outputTargets?: {
      targetApproachC?: number | null;
      targetTcwsC?: number | null;
      rawTargetApproachC?: number | null;
      currentApproachC?: number | null;
      currentTcwsC?: number | null;
      finalTargetApproachC?: number | null;
      finalTargetTcwsC?: number | null;
      nextStepTargetApproachC?: number | null;
      nextStepTargetTcwsC?: number | null;
      maxStepC?: number | null;
      deadbandC?: number | null;
      targetAdjustedByMinCondenserGuardrail?: boolean;
      stepLimited?: boolean;
      multiStepPlan?: {
        required?: boolean;
        reason?: string;
        finalTargetTcwsC?: number | null;
        finalTargetApproachC?: number | null;
        nextStepTargetTcwsC?: number | null;
        nextStepTargetApproachC?: number | null;
        stepCount?: number | null;
        maxStepC?: number | null;
        steps?: Array<{
          index?: number | null;
          targetTcwsC?: number | null;
          targetApproachC?: number | null;
        }>;
      } | null;
    };
    objective?: {
      key?: string;
      formula?: string;
      description?: string;
    };
    advisorResult?: {
      type?: string;
      status?: string;
      lifecycleMode?: string;
      execution?: {
        approvalRequired?: boolean;
        allowedToCreateExecution?: boolean;
        allowedToDispatch?: boolean;
        dispatchMode?: string;
        approveEndpointConfigured?: boolean;
        rollbackEndpointConfigured?: boolean;
        controlPointMapped?: boolean;
        rollbackMapped?: boolean;
      };
      savingsVerification?: {
        method?: string;
        metrics?: string[];
        acceptance?: string;
      };
      blockers?: string[];
      warnings?: string[];
    };
    guardrails?: Array<{
      key?: string;
      status?: "ready" | "missing" | "blocked" | string;
      value?: number | string | null;
      message?: string;
      resolvedBy?: "by-chiller" | "by-model" | "default" | "missing" | string;
      matchedKeys?: string[];
    }>;
  };
  pumpDeltaTAdvisor?: {
    status?: "ready" | "partial" | "unavailable" | string;
    executionReady?: boolean;
    dispatchReady?: boolean;
    executionMode?: "read_only" | "shadow" | "assisted" | string;
    dispatchMode?: "off" | "shadow" | "assisted" | string;
    controlMode?: string;
    current?: {
      chilledDeltaT?: number | null;
      coolingDeltaT?: number | null;
      chilledPumpPowerKw?: number | null;
      coolingPumpPowerKw?: number | null;
      chillerPowerKw?: number | null;
      totalPowerKw?: number | null;
      systemCop?: number | null;
      chilledSupplyTemp?: number | null;
      coolingReturnTemp?: number | null;
      outdoorWetBulbC?: number | null;
      currentApproachC?: number | null;
    };
    targetPoints?: {
      chilledPump?: string;
      coolingPump?: string;
      unit?: string;
      ttlSeconds?: number | null;
      trimRangeHz?: {
        min?: number | null;
        max?: number | null;
      };
    };
    targetBandsC?: {
      chilledDeltaT?: {
        low?: number | null;
        high?: number | null;
        label?: string;
      };
      coolingDeltaT?: {
        low?: number | null;
        high?: number | null;
        label?: string;
      };
    };
    outputTargets?: {
      chilledPumpFreqTrimHz?: number | null;
      coolingPumpFreqTrimHz?: number | null;
      rollbackTrimHz?: number | null;
      maxStepHz?: number | null;
      ttlSeconds?: number | null;
      holdMinutes?: number | null;
      rollbackLockoutMinutes?: number | null;
      trimRangeHz?: {
        min?: number | null;
        max?: number | null;
      };
    };
    reason?: string;
    disclaimer?: string;
    blockers?: string[];
    warnings?: string[];
    inputSignals?: Array<{
      key?: string;
      label?: string;
      value?: number | string | null;
      unit?: string | null;
      required?: boolean;
      ok?: boolean;
      reason?: string | null;
    }>;
    guardrails?: Array<{
      key?: string;
      status?: "ready" | "missing" | "blocked" | "locked" | string;
      value?: number | string | null;
      message?: string;
    }>;
    objective?: {
      key?: string;
      formula?: string;
      description?: string;
    };
    advisorResult?: {
      type?: string;
      status?: string;
      lifecycleMode?: string;
      execution?: {
        approvalRequired?: boolean;
        allowedToCreateExecution?: boolean;
        allowedToDispatch?: boolean;
        dispatchMode?: string;
        controlPointMapped?: boolean;
        rollbackMapped?: boolean;
        targetPoints?: string[];
        enforcedAllowed?: boolean;
      };
      savingsVerification?: {
        method?: string;
        metrics?: string[];
        acceptance?: string;
      };
      blockers?: string[];
      warnings?: string[];
    };
  };
  chillerStagingAdvisor?: {
    status?: "ready" | "partial" | "unavailable" | string;
    executionReady?: boolean;
    dispatchReady?: boolean;
    executionMode?: "read_only" | "shadow" | string;
    dispatchMode?: "off" | "shadow" | string;
    basis?: "combination_empirical_performance" | string;
    confidence?: "high" | "medium" | "low" | string;
    current?: {
      runningCombination?: string[];
      runningCount?: number | null;
      combinationCapacityKw?: number | null;
      systemCoolingLoadKw?: number | null;
      combinationPlrPct?: number | null;
      chillerPowerTotalKw?: number | null;
      stationPowerTotalKw?: number | null;
      comboCop?: number | null;
      stationCop?: number | null;
      kwPerRt?: number | null;
      sampleMinutes?: number | null;
      alarmCount?: number | null;
      source?: string | null;
      matchingTier?: string;
      sampleRole?: string;
      canLearnSingleChillerCop?: boolean;
      canLearnCombinationCop?: boolean;
      currentRunMinutes?: number | null;
    };
    recommendation?: {
      action?: "keep" | "switch_combination" | "add_one" | "remove_one" | "rebalance" | string;
      targetCombination?: string[];
      expectedTotalPowerDeltaKw?: number | null;
      expectedCopDelta?: number | null;
      reason?: string;
    };
	    evidence?: Record<string, unknown>;
	    sampleEvidence?: Record<string, unknown>;
	    sampleGovernance?: Record<string, unknown>;
	    candidates?: Array<{
      key?: string;
      combination?: string[];
      runningCount?: number | null;
      combinationCapacityKw?: number | null;
      combinationPlrPct?: number | null;
      capacityReservePct?: number | null;
      sampleCount?: number | null;
      confidence?: "high" | "medium" | "low" | string;
      stationCop?: number | null;
      comboCop?: number | null;
      kwPerRt?: number | null;
      sampleMinutes?: number | null;
      alarmCount?: number | null;
      source?: string | null;
      matchingTier?: string;
      sampleRole?: string;
      canLearnSingleChillerCop?: boolean;
      canLearnCombinationCop?: boolean;
      estimatedStationPowerKw?: number | null;
      expectedTotalPowerDeltaKw?: number | null;
      expectedPowerDeltaPct?: number | null;
      action?: string;
      blockers?: string[];
      warnings?: string[];
      isCurrent?: boolean;
    }>;
    reason?: string;
    disclaimer?: string;
    blockers?: string[];
    warnings?: string[];
    savingsVerification?: {
      method?: string;
      durationMinutes?: {
        min?: number | null;
        max?: number | null;
      };
      metrics?: string[];
      acceptance?: string;
    };
    advisorResult?: {
      type?: string;
      status?: string;
      lifecycleMode?: string;
      execution?: {
        approvalRequired?: boolean;
        allowedToCreateExecution?: boolean;
        allowedToDispatch?: boolean;
        dispatchMode?: string;
        controlPointMapped?: boolean;
        rollbackMapped?: boolean;
        enforcedAllowed?: boolean;
      };
      savingsVerification?: {
        method?: string;
        durationMinutes?: {
          min?: number | null;
          max?: number | null;
        };
        metrics?: string[];
        acceptance?: string;
      };
      blockers?: string[];
      warnings?: string[];
    };
  };
  reviewReadiness?: {
    status?: "ready" | "partial" | "unavailable" | string;
    score?: number | null;
    reason?: string;
    missingSignals?: string[];
    hints?: string[];
  };
  executionHub?: {
    status?: "idle" | "pending" | string;
    approvalRequired?: boolean;
    endpoint?: string;
    dispatchEndpoint?: string;
    pendingApprovalCount?: number | null;
    approvedCount?: number | null;
    rolledBackCount?: number | null;
    latestExecutionId?: string | null;
    latestExecutionStatus?: string | null;
    latestExecutionAt?: string | null;
    permissions?: {
      userId?: string | null;
      canApprove?: boolean;
      canRollback?: boolean;
      canDispatch?: boolean;
    };
    note?: string;
  };
  executionFeedback?: {
    status?: "idle" | "pending" | "rollback-watch" | "approved-history" | string;
    outcomeClass?:
      | "none"
      | "pending_approval"
      | "approved"
      | "approved_applied"
      | "approved_not_applied"
      | "rolled_back"
      | "rolled_back_after_apply"
      | "rolled_back_after_failed_apply"
      | string;
    summary?: string;
    signals?: string[];
    pendingApprovalCount?: number | null;
    approvedCount?: number | null;
    rolledBackCount?: number | null;
    latestExecutionId?: string | null;
    latestExecutionStatus?: string | null;
    latestExecutionAt?: string | null;
    latestExecutionType?: string | null;
    latestDispatchStatus?: string | null;
    approveDispatchStatus?: string | null;
    approveDispatchCode?: string | null;
    approveDispatchMode?: string | null;
    rollbackDispatchStatus?: string | null;
    rollbackDispatchCode?: string | null;
    latestObservedSnapshot?: {
      phase?: "approved" | "rolled_back" | string | null;
      capturedAt?: string | null;
      systemCop?: number | null;
      totalPowerKw?: number | null;
      activeAlarmCount?: number | null;
      thermalUnbalanceRate?: number | null;
    };
    observedBaselineComparison?: {
      status?: "improved" | "degraded" | "mixed" | "flat" | string | null;
      summary?: string | null;
      systemCopDelta?: number | null;
      totalPowerDeltaKw?: number | null;
      activeAlarmDelta?: number | null;
      thermalUnbalanceDelta?: number | null;
    };
    observedTargetComparison?: {
      status?: "met" | "partial" | "missed" | "unknown" | string | null;
      summary?: string | null;
      observedCopGap?: number | null;
      observedPowerGapKw?: number | null;
    };
    currentDraftComparison?: {
      status?: "same-target" | "changed-target" | "changed-scheme" | string;
      summary?: string;
      targetPowerDeltaKw?: number | null;
      targetCopDelta?: number | null;
    };
  };
  schemes?: Array<{
    key?: string;
    title?: string;
    status?: "ready" | "caution" | "blocked" | string;
    riskLevel?: "low" | "medium" | "high" | string;
    focus?: string;
    label?: string;
    targetPowerKw?: number | null;
    targetCop?: number | null;
    powerDeltaPct?: number | null;
    copDelta?: number | null;
    deviceActions?: Array<{
      system?: string;
      action?: string;
      target?: string;
      reason?: string;
      risk?: "low" | "medium" | "high" | string;
      priority?: "high" | "medium" | "low" | string;
      preconditions?: string[];
    }>;
    readiness?: {
      score?: number | null;
      level?: "ready" | "caution" | "blocked" | string;
      reason?: string;
      blockers?: string[];
      checkpoints?: string[];
    };
    actions?: string[];
    links?: {
      devices?: {
        href?: string;
        enabled?: boolean;
        label?: string;
      };
      trends?: {
        href?: string;
        enabled?: boolean;
        label?: string;
      };
      scene?: {
        href?: string;
        enabled?: boolean;
        label?: string;
      };
    };
  }>;
  ruleEvidence?: {
    matchedCount?: number;
    skippedCount?: number;
    matchedRuleIds?: string[];
    skippedRules?: Array<{
      ruleId?: string;
      reason?: string;
      missingMetrics?: Array<{
        metric?: string;
        category?: "upstream_unreachable" | "field_missing_or_invalid" | "unknown" | string;
        message?: string | null;
      }>;
    }>;
    primaryCards?: Array<{
      id?: string;
      title?: string;
      priority?: "high" | "medium" | "low" | string;
      category?: string;
      reason?: string;
      actions?: string[];
      evidence?: string[];
      severity?: "critical" | "major" | "minor" | string;
      risk?: string;
      relatedDevices?: string[];
      ruleId?: string | null;
    }>;
  };
  draftLabel?: string;
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
  diagnostics?: string[];
  generatedAt?: string;
};

export type OptimizeDraftErrorDto = {
  ok?: boolean;
  code?: string;
  error?: string;
  message?: string;
  requestId?: string;
  details?: Record<string, unknown> | OptimizeDraftDetailsDto;
};

export type OptimizeDraftResponseDto = OptimizeDraftErrorDto & {
  ok?: true;
  details?: OptimizeDraftDetailsDto;
};

export type OptimizeExecutionRecordDto = {
  executionId?: string;
  siteId?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rolledBackAt?: string | null;
  rolledBackBy?: string | null;
  status?: "pending_approval" | "approved" | "rolled_back" | string;
  draft?: {
    generatedAt?: string | null;
    gateLevel?: string | null;
    baseline?: {
      systemCop?: number | null;
      totalPowerKw?: number | null;
      activeAlarmCount?: number | null;
      thermalUnbalanceRate?: number | null;
    } | null;
  };
  execution?: {
    type?: "scheme" | "tower-approach" | "pump-delta-t" | string;
    schemeKey?: string | null;
    title?: string | null;
    targetCop?: number | null;
    targetPowerKw?: number | null;
    targetApproachC?: number | null;
    targetTcwsC?: number | null;
    targetChwpFreqTrimHz?: number | null;
    targetCwpFreqTrimHz?: number | null;
    ttlSeconds?: number | null;
    holdMinutes?: number | null;
    rollbackLockoutMinutes?: number | null;
    targetPoints?: Record<string, unknown> | null;
    equipmentContext?: {
      activeChillerIds?: string[];
      activeChillerModels?: string[];
    };
    guardrailSnapshot?: {
      key?: string | null;
      status?: string | null;
      value?: number | string | null;
      message?: string | null;
      resolvedBy?: string | null;
      matchedKeys?: string[];
    };
    rollbackTarget?: {
      mode?: string | null;
      targetTcwsC?: number | null;
      targetApproachC?: number | null;
      targetChwpFreqTrimHz?: number | null;
      targetCwpFreqTrimHz?: number | null;
      reason?: string | null;
    };
    reason?: string | null;
    actions?: string[];
  };
  approval?: {
    required?: boolean;
    status?: "pending" | "approved" | string;
    requestedAt?: string | null;
    approvedAt?: string | null;
    approverUserId?: string | null;
    note?: string | null;
  };
  rollback?: {
    status?: "none" | "completed" | string;
    reason?: string | null;
    requestedBy?: string | null;
    requestedAt?: string | null;
    completedAt?: string | null;
  };
  timeline?: Array<{
    at?: string;
    actorUserId?: string;
    action?: string;
    note?: string | null;
  }>;
};

export type OptimizeExecutionListDto = {
  site?: {
    siteId?: string;
  };
  generatedAt?: string;
  total?: number;
  items?: OptimizeExecutionRecordDto[];
};

export type OptimizeExecutionMutationDto = {
  ok?: boolean;
  requestId?: string;
  execution?: OptimizeExecutionRecordDto;
};

export type ShadowVerificationRecordDto = {
  recordId?: string;
  siteId?: string;
  executionId?: string | null;
  verificationType?: string;
  targetLabel?: string | null;
  outcome?: "improved" | "neutral" | "regressed" | "invalid" | "pending" | string;
  windowMinutes?: number | null;
  metrics?: {
    loadKw?: number | null;
    wetBulbC?: number | null;
    stationCop?: number | null;
    comboCop?: number | null;
    kwPerRt?: number | null;
    stationPowerKw?: number | null;
    chillerPowerKw?: number | null;
    alarmCount?: number | null;
  };
  note?: string | null;
  invalidReason?: string | null;
  sourceRecordId?: string | null;
  payload?: Record<string, unknown>;
  recordedAt?: string;
  createdAt?: string;
  recordedBy?: string | null;
  requestId?: string | null;
};

export type ShadowVerificationSummaryDto = {
  basis?: string;
  verificationType?: string;
  executionId?: string;
  total?: number;
  sampledCount?: number;
  pendingCount?: number;
  reviewedCount?: number;
  comparableCount?: number;
  improvedCount?: number;
  neutralCount?: number;
  regressedCount?: number;
  invalidCount?: number;
  latestOutcome?: string | null;
  latestReviewedAt?: string | null;
  archive?: {
    reportId?: string;
    checksumAlgorithm?: string;
    checksum?: string;
    checksumShort?: string;
    canonicalBasis?: string;
    recordCount?: number;
  } | null;
  byVerificationType?: Array<{
    verificationType?: string;
    total?: number;
    pendingCount?: number;
    reviewedCount?: number;
    comparableCount?: number;
    improvedCount?: number;
    neutralCount?: number;
    regressedCount?: number;
    invalidCount?: number;
  }>;
  controlMutation?: boolean;
  executionMutation?: boolean;
  acceptanceBoundary?: string;
};

export type ShadowVerificationRecordListDto = {
  site?: {
    siteId?: string;
  };
  generatedAt?: string;
  basis?: string;
  total?: number;
  summary?: ShadowVerificationSummaryDto;
  items?: ShadowVerificationRecordDto[];
};

export type ShadowVerificationRecordMutationDto = {
  ok?: boolean;
  requestId?: string;
  controlMutation?: boolean;
  record?: ShadowVerificationRecordDto;
};

function normalizeHeaderText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSiteCodeFromModelKey(siteId: string, modelKey: string): string {
  const normalizedSiteId = normalizeHeaderText(siteId);
  const normalizedModelKey = normalizeHeaderText(modelKey);
  if (!normalizedSiteId || !normalizedModelKey || !normalizedModelKey.startsWith(normalizedSiteId)) {
    return "";
  }
  const suffix = normalizedModelKey.slice(normalizedSiteId.length).replace(/-\d+$/, "");
  return normalizeHeaderText(suffix);
}

function scoreHeaderProjectCandidate(
  candidate: AuthProject,
  currentProject: AuthProject
): number {
  const currentModelKey = normalizeHeaderText(currentProject.modelKey);
  const currentAppExplain = normalizeHeaderText(currentProject.appExplain);
  const candidateSiteCode = normalizeHeaderText(candidate.siteCode);
  const candidateModelKey = normalizeHeaderText(candidate.modelKey);
  const candidateTemplate = normalizeHeaderText(candidate.template);
  const candidateDatabaseKey = normalizeHeaderText(candidate.databaseKey);
  const candidateSiteId = normalizeHeaderText(candidate.siteId);
  let score = 0;
  if (candidateSiteCode && candidateSiteCode !== candidateSiteId) {
    score += 400;
  }
  if (candidateModelKey) {
    score += 300;
  }
  if (candidateTemplate) {
    score += 120;
  }
  if (candidateDatabaseKey && candidateDatabaseKey !== `${candidateSiteId}${candidateSiteId}`) {
    score += 80;
  }
  if (normalizeHeaderText(candidate.appExplain)) {
    score += 40;
  }
  if (currentModelKey && candidateModelKey === currentModelKey) {
    score += 120;
  }
  if (currentAppExplain && normalizeHeaderText(candidate.appExplain) === currentAppExplain) {
    score += 60;
  }
  return score;
}

function resolveHeaderProjectContext(
  currentProject: AuthProject | null,
  sessionProjects: AuthProject[]
): {
  siteId: string;
  siteCode: string;
  projectKey: string;
  databaseKey: string;
  template: string;
} {
  if (!currentProject) {
    return {
      siteId: "",
      siteCode: "",
      projectKey: "",
      databaseKey: "",
      template: ""
    };
  }

  const siteId = normalizeHeaderText(currentProject.siteId);
  const sameSiteCandidates = sessionProjects
    .filter((candidate) => normalizeHeaderText(candidate.siteId) === siteId)
    .slice()
    .sort((left, right) => scoreHeaderProjectCandidate(right, currentProject) - scoreHeaderProjectCandidate(left, currentProject));
  const bestCandidate = sameSiteCandidates[0] || null;

  const projectKey = normalizeHeaderText(currentProject.modelKey) || normalizeHeaderText(bestCandidate?.modelKey);
  let siteCode = normalizeHeaderText(currentProject.siteCode) || normalizeHeaderText(bestCandidate?.siteCode);
  if (!siteCode || siteCode === siteId) {
    siteCode = deriveSiteCodeFromModelKey(siteId, projectKey);
  }

  const currentDatabaseKey = normalizeHeaderText(currentProject.databaseKey);
  const candidateDatabaseKey = normalizeHeaderText(bestCandidate?.databaseKey);
  const invalidDatabaseKey = (value: string) => !value || (siteId ? value === `${siteId}${siteId}` : false);
  const databaseKey = (siteId && siteCode)
    ? `${siteId}${siteCode}`
    : (!invalidDatabaseKey(currentDatabaseKey)
        ? currentDatabaseKey
        : (!invalidDatabaseKey(candidateDatabaseKey) ? candidateDatabaseKey : ""));

  return {
    siteId,
    siteCode,
    projectKey,
    databaseKey,
    template: normalizeHeaderText(currentProject.template) || normalizeHeaderText(bestCandidate?.template)
  };
}

function resolveScopedHeaderProjectContext(
  project: Pick<AuthProject, "siteId" | "siteCode" | "modelKey" | "databaseKey" | "template">
): {
  siteId: string;
  siteCode: string;
  projectKey: string;
  databaseKey: string;
  template: string;
} {
  const siteId = normalizeHeaderText(project.siteId);
  const projectKey = normalizeHeaderText(project.modelKey);
  let siteCode = normalizeHeaderText(project.siteCode);
  if (!siteCode || siteCode === siteId) {
    siteCode = deriveSiteCodeFromModelKey(siteId, projectKey);
  }
  const explicitDatabaseKey = normalizeHeaderText(project.databaseKey);
  const databaseKey = (siteId && siteCode)
    ? `${siteId}${siteCode}`
    : explicitDatabaseKey;
  return {
    siteId,
    siteCode,
    projectKey,
    databaseKey,
    template: normalizeHeaderText(project.template)
  };
}

function buildBffHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  const session = getAuthSession();
  const currentProject = getCurrentProject(session);
  const resolvedContext = resolveHeaderProjectContext(currentProject, session?.projects || []);
  const effectiveSiteId = resolvedContext.siteId;
  const effectiveSiteCode = resolvedContext.siteCode;
  const effectiveProjectKey = resolvedContext.projectKey || normalizeHeaderText(session?.defaultProjectKey);
  const effectiveDatabaseKey = resolvedContext.databaseKey;
  const actorUserId =
    normalizeHeaderText(session?.userId) ||
    normalizeHeaderText(session?.username);
  if (actorUserId) {
    merged.set("x-chiller-user-id", actorUserId);
  }
  if (effectiveSiteId) {
    merged.set("x-chiller-site-id", effectiveSiteId);
  }
  if (effectiveSiteCode) {
    merged.set("x-chiller-site-code", effectiveSiteCode);
  }
  if (effectiveDatabaseKey) {
    merged.set("x-chiller-project-database-key", effectiveDatabaseKey);
  }
  if (effectiveProjectKey) {
    merged.set("x-chiller-project-key", effectiveProjectKey);
  }
  if (resolvedContext.template) {
    merged.set("x-chiller-project-template", resolvedContext.template);
  } else if (normalizeHeaderText(session?.defaultProjectTemplate)) {
    merged.set("x-chiller-project-template", normalizeHeaderText(session?.defaultProjectTemplate));
  }
  return merged;
}

function buildProjectScopedHeaders(
  project: Pick<AuthProject, "siteId" | "siteCode" | "modelKey" | "databaseKey" | "template">
): Headers {
  const merged = new Headers();
  const session = getAuthSession();
  const resolvedContext = resolveScopedHeaderProjectContext(project);
  const effectiveProjectKey = resolvedContext.projectKey;
  const effectiveDatabaseKey = resolvedContext.databaseKey;
  const actorUserId =
    normalizeHeaderText(session?.userId) ||
    normalizeHeaderText(session?.username);
  if (actorUserId) {
    merged.set("x-chiller-user-id", actorUserId);
  }
  if (resolvedContext.siteId) {
    merged.set("x-chiller-site-id", resolvedContext.siteId);
  }
  if (resolvedContext.siteCode) {
    merged.set("x-chiller-site-code", resolvedContext.siteCode);
  }
  if (effectiveDatabaseKey) {
    merged.set("x-chiller-project-database-key", effectiveDatabaseKey);
  }
  if (effectiveProjectKey) {
    merged.set("x-chiller-project-key", effectiveProjectKey);
  }
  if (resolvedContext.template) {
    merged.set("x-chiller-project-template", resolvedContext.template);
  } else if (normalizeHeaderText(session?.defaultProjectTemplate)) {
    merged.set("x-chiller-project-template", normalizeHeaderText(session?.defaultProjectTemplate));
  }
  return merged;
}

function getLegacyLanguageFromLocale(): "zh" | "en" | "vie" {
  const locale = getCurrentLocale();
  if (locale === "en-US") {
    return "en";
  }
  if (locale === "vi-VN") {
    return "vie";
  }
  return "zh";
}

function toLegacyInteger(value: string | number | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toLegacyIntegerList(values: Array<string | number> | undefined): number[] {
  return (values || [])
    .map((item) => toLegacyInteger(item, Number.NaN))
    .filter((item) => Number.isFinite(item));
}

async function fetchJson<T>(path: string): Promise<T> {
  const headers = buildBffHeaders();
  const dedupeKey = buildJsonRequestDedupeKey(path, headers);
  const pending = pendingJsonRequests.get(dedupeKey);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = (async () => {
    const response = await fetchFromBff(path, {
      headers,
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`${path} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  })();

  pendingJsonRequests.set(dedupeKey, request as Promise<unknown>);
  try {
    return await request;
  } finally {
    if (pendingJsonRequests.get(dedupeKey) === request) {
      pendingJsonRequests.delete(dedupeKey);
    }
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchFromBff(path, {
    method: "POST",
    headers: buildBffHeaders({
      "content-type": "application/json"
    }),
    body: JSON.stringify(body)
  });
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw Object.assign(new Error(`${path} failed with ${response.status}`), {
      status: response.status,
      payload: json
    });
  }
  return json;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchFromBff(path, {
    method: "PUT",
    headers: buildBffHeaders({
      "content-type": "application/json"
    }),
    body: JSON.stringify(body)
  });
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw Object.assign(new Error(`${path} failed with ${response.status}`), {
      status: response.status,
      payload: json
    });
  }
  return json;
}

async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetchFromBff(path, {
    method: "DELETE",
    headers: buildBffHeaders()
  });
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw Object.assign(new Error(`${path} failed with ${response.status}`), {
      status: response.status,
      payload: json
    });
  }
  return json;
}

async function submitFormData<T>(path: string, method: "POST" | "PUT", body: FormData): Promise<T> {
  const response = await fetchFromBff(path, {
    method,
    headers: buildBffHeaders(),
    body
  });
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw Object.assign(new Error(`${path} failed with ${response.status}`), {
      status: response.status,
      payload: json
    });
  }
  return json;
}

function parseFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch (_error) {
      return utfMatch[1];
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || null;
}

async function fetchFile(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetchFromBff(path, {
    headers: buildBffHeaders()
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return {
    blob: await response.blob(),
    filename: parseFileName(response.headers.get("content-disposition"))
  };
}

export async function fetchDashboardOverview(siteId: string): Promise<DashboardOverviewDto> {
  return fetchJson<DashboardOverviewDto>(`/bff/v1/sites/${siteId}/dashboard/overview`);
}

export async function fetchDashboardOverviewForProject(
  project: Pick<AuthProject, "siteId" | "modelKey" | "databaseKey" | "template">
): Promise<DashboardOverviewDto> {
  const response = await fetchFromBff(`/bff/v1/sites/${project.siteId}/dashboard/overview`, {
    headers: buildProjectScopedHeaders(project),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`/bff/v1/sites/${project.siteId}/dashboard/overview failed with ${response.status}`);
  }
  return (await response.json()) as DashboardOverviewDto;
}

export async function fetchDashboardTrends(
  siteId: string,
  range: "24h" | "7d" | "30d" = "24h"
): Promise<DashboardTrendsDto> {
  return fetchJson<DashboardTrendsDto>(`/bff/v1/sites/${siteId}/dashboard/trends?range=${range}`);
}

export async function fetchAnomalySummary(siteId: string): Promise<AnomalySummaryDto> {
  return fetchJson<AnomalySummaryDto>(`/bff/v1/sites/${siteId}/anomalies/summary`);
}

export async function fetchAiDigest(siteId: string): Promise<AiDigestDto> {
  return fetchJson<AiDigestDto>(`/bff/v1/sites/${siteId}/ai/digest`);
}

export async function fetchColdStationLogs(siteId: string, date: string): Promise<ColdStationLogDto> {
  const search = new URLSearchParams();
  search.set("date", date);
  return fetchJson<ColdStationLogDto>(`/bff/v1/sites/${siteId}/cold-station-logs?${search.toString()}`);
}

export async function fetchOperationRecords(
  siteId: string,
  options: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    drTypeId?: string;
    drId?: string;
    language?: string;
  } = {}
): Promise<OperationRecordListDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 10));
  if (options.startDate) {
    search.set("startDate", options.startDate);
  }
  if (options.endDate) {
    search.set("endDate", options.endDate);
  }
  if (options.drTypeId) {
    search.set("drTypeId", options.drTypeId);
  }
  if (options.drId) {
    search.set("drId", options.drId);
  }
  if (options.language) {
    search.set("language", options.language);
  }
  return fetchJson<OperationRecordListDto>(`/bff/v1/sites/${siteId}/operation-records?${search.toString()}`);
}

export async function fetchOperationRecordDeviceTypes(siteId: string): Promise<OperationRecordDeviceTypeDto> {
  const search = new URLSearchParams();
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<OperationRecordDeviceTypeDto>(`/bff/v1/sites/${siteId}/operation-records/device-types?${search.toString()}`);
}

export async function fetchOperationRecordDevices(
  siteId: string,
  drTypeId: string
): Promise<OperationRecordDeviceOptionsDto> {
  const search = new URLSearchParams();
  search.set("drTypeId", drTypeId);
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<OperationRecordDeviceOptionsDto>(
    `/bff/v1/sites/${siteId}/operation-records/devices?${search.toString()}`
  );
}

export async function fetchKnowledgeDocuments(
  siteId: string,
  options: {
    page?: number;
    pageSize?: number;
  } = {}
): Promise<KnowledgeDocumentListDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 10));
  return fetchJson<KnowledgeDocumentListDto>(`/bff/v1/sites/${siteId}/knowledge/documents?${search.toString()}`);
}

export async function fetchKnowledgeDeviceTypes(siteId: string): Promise<KnowledgeDeviceTypeDto> {
  return fetchJson<KnowledgeDeviceTypeDto>(`/bff/v1/sites/${siteId}/knowledge/device-types`);
}

export async function createKnowledgeDocument(siteId: string, formData: FormData): Promise<KnowledgeMutationDto> {
  return submitFormData<KnowledgeMutationDto>(`/bff/v1/sites/${siteId}/knowledge/documents`, "POST", formData);
}

export async function updateKnowledgeDocument(siteId: string, formData: FormData): Promise<KnowledgeMutationDto> {
  return submitFormData<KnowledgeMutationDto>(`/bff/v1/sites/${siteId}/knowledge/documents`, "PUT", formData);
}

export async function deleteKnowledgeDocument(siteId: string, documentId: string): Promise<KnowledgeMutationDto> {
  return deleteJson<KnowledgeMutationDto>(`/bff/v1/sites/${siteId}/knowledge/documents/${encodeURIComponent(documentId)}`);
}

export async function fetchReportRecordRegOptions(
  siteId: string,
  options: {
    drTypeId: string;
    drId: string;
  }
): Promise<ReportRecordRegOptionsDto> {
  const search = new URLSearchParams();
  search.set("drTypeId", options.drTypeId);
  search.set("drId", options.drId);
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<ReportRecordRegOptionsDto>(`/bff/v1/sites/${siteId}/report-records/reg-options?${search.toString()}`);
}

export async function fetchEnergyParameters(siteId: string): Promise<EnergyParameterDto> {
  return fetchJson<EnergyParameterDto>(`/bff/v1/sites/${siteId}/energy-parameters`);
}

export async function fetchEnergyAnalysisTree(
  siteId: string,
  options: {
    language?: string;
  } = {}
): Promise<EnergyAnalysisTreeDto> {
  const search = new URLSearchParams();
  if (options.language) {
    search.set("language", options.language);
  }
  const query = search.toString();
  return fetchJson<EnergyAnalysisTreeDto>(`/bff/v1/sites/${siteId}/energy-analysis/tree${query ? `?${query}` : ""}`);
}

export async function fetchEnergyAnalysis(
  siteId: string,
  options: {
    startDate: string;
    endDate: string;
    dateType: string;
    deviceIds: string[];
    language?: string;
  }
): Promise<EnergyAnalysisDto> {
  const search = new URLSearchParams();
  search.set("startDate", options.startDate);
  search.set("endDate", options.endDate);
  search.set("dateType", options.dateType);
  search.set("deviceIds", options.deviceIds.join(","));
  if (options.language) {
    search.set("language", options.language);
  }
  return fetchJson<EnergyAnalysisDto>(`/bff/v1/sites/${siteId}/energy-analysis?${search.toString()}`);
}

export async function fetchEnergyEfficiencySearch(
  siteId: string,
  options: {
    startDate: string;
    endDate: string;
    timeSpace: string;
    deviceKeys: string[];
  }
): Promise<EnergyEfficiencyReportDto> {
  const search = new URLSearchParams();
  search.set("startDate", options.startDate);
  search.set("endDate", options.endDate);
  search.set("timeSpace", options.timeSpace);
  search.set("deviceKeys", options.deviceKeys.join(","));
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<EnergyEfficiencyReportDto>(`/bff/v1/sites/${siteId}/energy-efficiency/search?${search.toString()}`);
}

export async function fetchEnergyEfficiencyCalendar(
  siteId: string,
  options: {
    month: string;
  }
): Promise<EnergyEfficiencyCalendarDto> {
  const search = new URLSearchParams();
  search.set("month", options.month);
  return fetchJson<EnergyEfficiencyCalendarDto>(
    `/bff/v1/sites/${siteId}/energy-efficiency/calendar?${search.toString()}`
  );
}

export async function fetchEnergyEfficiencyCalendarPie(
  siteId: string,
  options: {
    date: string;
    dateType: "1" | "2";
  }
): Promise<EnergyEfficiencyCalendarPieDto> {
  const search = new URLSearchParams();
  search.set("date", options.date);
  search.set("dateType", options.dateType);
  return fetchJson<EnergyEfficiencyCalendarPieDto>(
    `/bff/v1/sites/${siteId}/energy-efficiency/calendar/pie?${search.toString()}`
  );
}

export async function fetchEnergyEfficiencyCompare(
  siteId: string,
  options: {
    deviceKey: string;
    dates: string[];
  }
): Promise<EnergyEfficiencyReportDto> {
  const search = new URLSearchParams();
  search.set("deviceKey", options.deviceKey);
  search.set("dates", options.dates.join(","));
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<EnergyEfficiencyReportDto>(`/bff/v1/sites/${siteId}/energy-efficiency/compare?${search.toString()}`);
}

export async function fetchEnergyEfficiencyProportion(
  siteId: string,
  options: {
    date: string;
    dateType: string;
  }
): Promise<EnergyEfficiencyProportionDto> {
  const search = new URLSearchParams();
  search.set("date", options.date);
  search.set("dateType", options.dateType);
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<EnergyEfficiencyProportionDto>(
    `/bff/v1/sites/${siteId}/energy-efficiency/proportion?${search.toString()}`
  );
}

export async function fetchEnergyEfficiencyImbalance(
  siteId: string,
  options: {
    startDate: string;
    endDate: string;
  }
): Promise<EnergyEfficiencyImbalanceDto> {
  const search = new URLSearchParams();
  search.set("startDate", options.startDate);
  search.set("endDate", options.endDate);
  return fetchJson<EnergyEfficiencyImbalanceDto>(
    `/bff/v1/sites/${siteId}/energy-efficiency/imbalance?${search.toString()}`
  );
}

export async function updateEnergyParameters(siteId: string, body: EnergyParameterItemDto): Promise<{
  ok?: boolean;
  site?: {
    siteId?: string;
    siteName?: string;
  };
  generatedAt?: string;
  message?: string;
}> {
  return putJson(`/bff/v1/sites/${siteId}/energy-parameters`, body);
}

export async function fetchMeterReadings(
  siteId: string,
  options: {
    startTime: string;
    endTime: string;
  }
): Promise<MeterReadingDto> {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("language", getLegacyLanguageFromLocale());
  return fetchJson<MeterReadingDto>(`/bff/v1/sites/${siteId}/meter-readings?${search.toString()}`);
}

export async function exportMeterReadings(
  siteId: string,
  options: {
    startTime: string;
    endTime: string;
  }
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("language", getLegacyLanguageFromLocale());
  return fetchFile(`/bff/v1/sites/${siteId}/meter-readings/export?${search.toString()}`);
}

export async function fetchReportRecords(
  siteId: string,
  options: {
    page?: number;
    pageSize?: number;
    startTime: string;
    endTime: string;
    drTypeId: string;
    drId: string;
    dateType?: string;
    regIds?: string[];
    drRegList?: ReportRecordDrRegDto[];
  }
): Promise<ReportRecordDto> {
  const drRegList = (options.drRegList || [])
    .map((item) => ({
      drId: toLegacyInteger(item.drId, 0),
      regIds: toLegacyIntegerList(item.regIds)
    }))
    .filter((item) => item.drId > 0 && item.regIds.length > 0);
  return postJson<ReportRecordDto>(`/bff/v1/sites/${siteId}/report-records`, {
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 10,
    startTime: options.startTime,
    endTime: options.endTime,
    drTypeId: toLegacyInteger(options.drTypeId, 0),
    drId: toLegacyInteger(options.drId, 0),
    dateType: toLegacyInteger(options.dateType ?? "4", 4),
    regIds: toLegacyIntegerList(options.regIds),
    drRegList,
    language: getLegacyLanguageFromLocale(),
    unit: "KW"
  });
}

export async function exportReportRecords(
  siteId: string,
  options: {
    startTime: string;
    endTime: string;
    drTypeId: string;
    drId: string;
    regIds?: string[];
  }
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("drTypeId", options.drTypeId);
  search.set("drId", options.drId);
  if ((options.regIds?.length ?? 0) > 0) {
    search.set("regIds", (options.regIds || []).join(","));
  }
  return fetchFile(`/bff/v1/sites/${siteId}/report-records/export?${search.toString()}`);
}

export async function fetchPerformanceReport(
  siteId: string,
  options: {
    metric: string;
    startTime: string;
    endTime: string;
    language?: string;
    unit?: string;
    modelKey?: string;
    template?: string;
  }
): Promise<PerformanceReportDto> {
  const search = new URLSearchParams();
  search.set("metric", options.metric);
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  if (options.language) {
    search.set("language", options.language);
  }
  if (options.unit) {
    search.set("unit", options.unit);
  }
  if (options.modelKey) {
    search.set("modelKey", options.modelKey);
  }
  if (options.template) {
    search.set("template", options.template);
  }
  return fetchJson<PerformanceReportDto>(`/bff/v1/sites/${siteId}/performance-reports?${search.toString()}`);
}

export async function exportPerformanceReport(
  siteId: string,
  options: {
    startTime: string;
    endTime: string;
    language?: string;
    unit?: string;
    modelKey?: string;
    template?: string;
  }
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  if (options.language) {
    search.set("language", options.language);
  }
  if (options.unit) {
    search.set("unit", options.unit);
  }
  if (options.modelKey) {
    search.set("modelKey", options.modelKey);
  }
  if (options.template) {
    search.set("template", options.template);
  }
  return fetchFile(`/bff/v1/sites/${siteId}/performance-reports/export?${search.toString()}`);
}

export async function fetchAnomalyList(
  siteId: string,
  options: { page?: number; pageSize?: number; severity?: string; state?: string } = {}
): Promise<AnomalyListDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 20));
  if (options.severity) {
    search.set("severity", options.severity);
  }
  if (options.state) {
    search.set("state", options.state);
  }
  return fetchJson<AnomalyListDto>(`/bff/v1/sites/${siteId}/anomalies/list?${search.toString()}`);
}

export async function fetchRecommendations(siteId: string): Promise<RecommendationDto> {
  return fetchJson<RecommendationDto>(`/bff/v1/sites/${siteId}/recommendations`);
}

export async function fetchSystemTopology(siteId: string): Promise<SystemTopologyDto> {
  return fetchJson<SystemTopologyDto>(`/bff/v1/sites/${siteId}/system/topology`);
}

export async function fetchSystemDiagram(
  siteId: string,
  options: { layoutMode?: "auto" | "fixed"; scope?: "main_loop" | "full" } = {}
): Promise<SystemDiagramDto> {
  const search = new URLSearchParams();
  search.set("layoutMode", options.layoutMode ?? "auto");
  search.set("scope", options.scope ?? "full");
  return fetchJson<SystemDiagramDto>(`/bff/v1/sites/${siteId}/system/diagram?${search.toString()}`);
}

export async function fetchSceneLegacyTrend(
  siteId: string,
  options: { tagname: string; title?: string; unit?: string; date?: string | null }
): Promise<SceneLegacyTrendDto> {
  const search = new URLSearchParams();
  search.set("tagname", options.tagname);
  if (options.title) {
    search.set("title", options.title);
  }
  if (options.unit) {
    search.set("unit", options.unit);
  }
  if (options.date) {
    search.set("date", options.date);
  }
  return fetchJson<SceneLegacyTrendDto>(`/bff/v1/sites/${siteId}/scene/legacy-trend?${search.toString()}`);
}

export async function fetchSceneOnlineMonitor(siteId: string): Promise<SceneOnlineMonitorDto> {
  return fetchJson<SceneOnlineMonitorDto>(`/bff/v1/sites/${siteId}/scene/online-monitor`);
}

export async function fetchSceneFloorModels(siteId: string): Promise<SceneFloorModelListDto> {
  const search = new URLSearchParams();
  search.set("language", getLegacyLanguageFromLocale());
  search.set("unit", "RT");
  return fetchJson<SceneFloorModelListDto>(`/bff/v1/sites/${siteId}/scene/floor-models?${search.toString()}`);
}

export async function fetchSceneDeviceParameters(
  siteId: string,
  drId: string | number
): Promise<SceneDeviceParametersDto> {
  const search = new URLSearchParams();
  search.set("drId", String(drId));
  search.set("language", getLegacyLanguageFromLocale());
  search.set("unit", "RT");
  return fetchJson<SceneDeviceParametersDto>(
    `/bff/v1/sites/${siteId}/scene/device-parameters?${search.toString()}`
  );
}

export async function submitSceneDeviceCommand(
  siteId: string,
  payload: {
    drId: string | number;
    drTypeId: string | number;
    regName: string;
    value: string | number;
    tagName: string;
  }
): Promise<SceneDeviceCommandResultDto> {
  const search = new URLSearchParams();
  search.set("language", getLegacyLanguageFromLocale());
  return postJson<SceneDeviceCommandResultDto>(
    `/bff/v1/sites/${siteId}/scene/device-command?${search.toString()}`,
    payload
  );
}

export async function fetchEnvironmentBuildings(siteId: string): Promise<EnvironmentBuildingListDto> {
  return fetchJson<EnvironmentBuildingListDto>(`/bff/v1/sites/${siteId}/environment/buildings`);
}

export async function fetchEnvironmentConditions(
  siteId: string,
  options: {
    buildingId?: string;
    cooledAir?: string;
    monitoringSite?: string;
  } = {}
): Promise<EnvironmentConditionListDto> {
  const search = new URLSearchParams();
  if (options.buildingId) {
    search.set("buildingId", options.buildingId);
  }
  if (options.cooledAir) {
    search.set("cooledAir", options.cooledAir);
  }
  if (options.monitoringSite) {
    search.set("monitoringSite", options.monitoringSite);
  }
  return fetchJson<EnvironmentConditionListDto>(
    `/bff/v1/sites/${siteId}/environment/conditions${search.toString() ? `?${search.toString()}` : ""}`
  );
}

export async function fetchWorkOrders(
  siteId: string,
  options: {
    page?: number;
    pageSize?: number;
    id?: string;
    state?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<WorkOrderListDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 10));
  if (options.id) {
    search.set("id", options.id);
  }
  if (options.state) {
    search.set("state", options.state);
  }
  if (options.startDate) {
    search.set("startDate", options.startDate);
  }
  if (options.endDate) {
    search.set("endDate", options.endDate);
  }
  return fetchJson<WorkOrderListDto>(`/bff/v1/sites/${siteId}/work-orders?${search.toString()}`);
}

export async function fetchWorkOrderAssignees(siteId: string): Promise<WorkOrderAssigneeListDto> {
  return fetchJson<WorkOrderAssigneeListDto>(`/bff/v1/sites/${siteId}/work-orders/assignees`);
}

export async function createWorkOrder(
  siteId: string,
  body: Record<string, unknown>
): Promise<WorkOrderMutationDto> {
  return postJson<WorkOrderMutationDto>(`/bff/v1/sites/${siteId}/work-orders`, body);
}

export async function updateWorkOrder(
  siteId: string,
  orderId: string,
  body: Record<string, unknown>
): Promise<WorkOrderMutationDto> {
  return putJson<WorkOrderMutationDto>(`/bff/v1/sites/${siteId}/work-orders/${encodeURIComponent(orderId)}`, body);
}

export async function deleteWorkOrder(siteId: string, orderId: string): Promise<WorkOrderMutationDto> {
  return deleteJson<WorkOrderMutationDto>(`/bff/v1/sites/${siteId}/work-orders/${encodeURIComponent(orderId)}`);
}

export async function exportWorkOrders(siteId: string): Promise<{ blob: Blob; filename: string | null }> {
  return fetchFile(`/bff/v1/sites/${siteId}/work-orders/export`);
}

export async function fetchDeviceList(
  siteId: string,
  options: { page?: number; pageSize?: number; type?: string; floor?: string } = {}
): Promise<DeviceListDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 12));
  if (options.type) {
    search.set("type", options.type);
  }
  if (options.floor) {
    search.set("floor", options.floor);
  }
  return fetchJson<DeviceListDto>(`/bff/v1/sites/${siteId}/devices/list?${search.toString()}`);
}

export async function fetchDeviceTree(
  siteId: string,
  options: { build?: number; floor?: number; mock?: boolean } = {}
): Promise<DeviceTreeDto> {
  const search = new URLSearchParams();
  if (options.build != null) {
    search.set("build", String(options.build));
  }
  if (options.floor != null) {
    search.set("floor", String(options.floor));
  }
  if (typeof options.mock === "boolean") {
    search.set("mock", options.mock ? "1" : "0");
  }
  return fetchJson<DeviceTreeDto>(
    `/bff/v1/sites/${siteId}/devices/tree${search.toString() ? `?${search.toString()}` : ""}`
  );
}

export async function fetchDeviceDetail(
  siteId: string,
  deviceId: string,
  options: { build?: number; floor?: number; mock?: boolean } = {}
): Promise<DeviceDetailDto> {
  const search = new URLSearchParams();
  if (options.build != null) {
    search.set("build", String(options.build));
  }
  if (options.floor != null) {
    search.set("floor", String(options.floor));
  }
  if (typeof options.mock === "boolean") {
    search.set("mock", options.mock ? "1" : "0");
  }
  return fetchJson<DeviceDetailDto>(
    `/bff/v1/sites/${siteId}/devices/${encodeURIComponent(deviceId)}${search.toString() ? `?${search.toString()}` : ""}`
  );
}

export async function fetchDeviceDetails(
  siteId: string,
  deviceIds: string[],
  options: { build?: number; floor?: number; mock?: boolean } = {}
): Promise<DeviceDetailBatchDto> {
  const normalizedIds = Array.from(new Set(deviceIds.map((item) => String(item || "").trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return {
      site: {
        siteId
      },
      items: [],
      summary: {
        requested: 0,
        resolved: 0,
        missing: 0
      }
    };
  }
  const search = new URLSearchParams();
  search.set("ids", normalizedIds.join(","));
  if (options.build != null) {
    search.set("build", String(options.build));
  }
  if (options.floor != null) {
    search.set("floor", String(options.floor));
  }
  if (typeof options.mock === "boolean") {
    search.set("mock", options.mock ? "1" : "0");
  }
  return fetchJson<DeviceDetailBatchDto>(`/bff/v1/sites/${siteId}/devices/details?${search.toString()}`);
}

export async function fetchUiBadgeState(url: string = UI_BADGE_STATE_URL): Promise<UiBadgeStateDto> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`badge state failed with ${response.status}`);
  }
  return (await response.json()) as UiBadgeStateDto;
}

export async function postOptimizeDraft(
  siteId: string,
  body: OptimizeDraftRequestDto
): Promise<OptimizeDraftResponseDto> {
  return postJson<OptimizeDraftResponseDto>(`/bff/v1/sites/${siteId}/optimize`, body);
}

export async function fetchOptimizeExecutions(
  siteId: string,
  options: { status?: string; type?: string; limit?: number } = {}
): Promise<OptimizeExecutionListDto> {
  const search = new URLSearchParams();
  if (options.status) {
    search.set("status", options.status);
  }
  if (options.type) {
    search.set("type", options.type);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchJson<OptimizeExecutionListDto>(`/bff/v1/sites/${siteId}/optimize/executions${suffix}`);
}

export async function fetchTowerApproachExecutions(
  siteId: string,
  options: { status?: string; limit?: number } = {}
): Promise<OptimizeExecutionListDto> {
  const search = new URLSearchParams();
  if (options.status) {
    search.set("status", options.status);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchJson<OptimizeExecutionListDto>(`/bff/v1/sites/${siteId}/optimize/tower-approach/executions${suffix}`);
}

export async function createOptimizeExecution(
  siteId: string,
  body: Record<string, unknown>
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(`/bff/v1/sites/${siteId}/optimize/executions`, body);
}

export async function createTowerApproachExecution(
  siteId: string,
  body: Record<string, unknown>
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(`/bff/v1/sites/${siteId}/optimize/tower-approach/executions`, body);
}

export async function approveTowerApproachExecution(
  siteId: string,
  executionId: string,
  body: Record<string, unknown> = {}
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/tower-approach/executions/${encodeURIComponent(executionId)}/approve`,
    body
  );
}

export async function rollbackTowerApproachExecution(
  siteId: string,
  executionId: string,
  body: Record<string, unknown> = {}
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/tower-approach/executions/${encodeURIComponent(executionId)}/rollback`,
    body
  );
}

export async function approveOptimizeExecution(
  siteId: string,
  executionId: string,
  body: Record<string, unknown> = {}
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/executions/${encodeURIComponent(executionId)}/approve`,
    body
  );
}

export async function rollbackOptimizeExecution(
  siteId: string,
  executionId: string,
  body: Record<string, unknown> = {}
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/executions/${encodeURIComponent(executionId)}/rollback`,
    body
  );
}

export async function dispatchOptimizeExecution(
  siteId: string,
  executionId: string,
  body: Record<string, unknown> = {}
): Promise<OptimizeExecutionMutationDto> {
  return postJson<OptimizeExecutionMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/executions/${encodeURIComponent(executionId)}/dispatch`,
    body
  );
}

export async function fetchShadowVerificationRecords(
  siteId: string,
  options: { executionId?: string; verificationType?: string; limit?: number } = {}
): Promise<ShadowVerificationRecordListDto> {
  const search = new URLSearchParams();
  if (options.executionId) {
    search.set("executionId", options.executionId);
  }
  if (options.verificationType) {
    search.set("verificationType", options.verificationType);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchJson<ShadowVerificationRecordListDto>(
    `/bff/v1/sites/${siteId}/optimize/shadow-verification-records${suffix}`
  );
}

export async function exportShadowVerificationRecords(
  siteId: string,
  options: { executionId?: string; verificationType?: string; limit?: number } = {}
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  if (options.executionId) {
    search.set("executionId", options.executionId);
  }
  if (options.verificationType) {
    search.set("verificationType", options.verificationType);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchFile(`/bff/v1/sites/${siteId}/optimize/shadow-verification-records/export${suffix}`);
}

export async function exportShadowVerificationReviewReport(
  siteId: string,
  options: { executionId: string; verificationType?: string; limit?: number }
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  search.set("executionId", options.executionId);
  if (options.verificationType) {
    search.set("verificationType", options.verificationType);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  return fetchFile(`/bff/v1/sites/${siteId}/optimize/shadow-verification-records/report?${search.toString()}`);
}

export async function exportShadowVerificationReviewPrintPage(
  siteId: string,
  options: { executionId: string; verificationType?: string; limit?: number }
): Promise<{ blob: Blob; filename: string | null }> {
  const search = new URLSearchParams();
  search.set("executionId", options.executionId);
  if (options.verificationType) {
    search.set("verificationType", options.verificationType);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    search.set("limit", String(Math.round(options.limit)));
  }
  return fetchFile(`/bff/v1/sites/${siteId}/optimize/shadow-verification-records/report/print?${search.toString()}`);
}

export async function createShadowVerificationRecord(
  siteId: string,
  body: Record<string, unknown>
): Promise<ShadowVerificationRecordMutationDto> {
  return postJson<ShadowVerificationRecordMutationDto>(
    `/bff/v1/sites/${siteId}/optimize/shadow-verification-records`,
    body
  );
}
