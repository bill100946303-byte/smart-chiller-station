import { getAuthSession, getCurrentProject } from "./auth";

const BFF_BASE_URL = import.meta.env.VITE_BFF_BASE_URL || "http://127.0.0.1:8787";
const UI_BADGE_STATE_URL = import.meta.env.VITE_UI_BADGE_STATE_URL || "/ui-badge-state-v1.8.json";

export type SourceEndpointStatusDto = {
  key?: string;
  endpoint?: string;
  ok?: boolean;
  fallback?: boolean;
  status?: number | null;
  message?: string | null;
  error?: string | null;
  rows?: number | null;
};

export type SourceStatusDto = {
  overall?: "ok" | "partial" | "failed";
  sources?: SourceEndpointStatusDto[];
};

export type FreshnessDto = {
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
  };
  columns?: string[];
  items?: ReportRecordRowDto[];
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
    chilledDeltaT?: number | null;
    coolingDeltaT?: number | null;
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
    title?: string;
    severity?: "critical" | "major" | "minor" | "normal";
    occurredAt?: string | null;
    source?: string;
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
  title?: string;
  severity?: "critical" | "major" | "minor" | "normal" | null;
  state?: string | null;
  occurredAt?: string | null;
  source?: string;
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
    outdoorTempC?: number;
    mode?: "cooling" | string;
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
  freshness?: FreshnessDto;
  sourceStatus?: SourceStatusDto;
  diagnostics?: string[];
  generatedAt?: string;
};

export type OptimizeDraftErrorDto = {
  ok?: false;
  code?: string;
  error?: string;
  requestId?: string;
  details?: Record<string, unknown> | OptimizeDraftDetailsDto;
};

function buildBffHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  const session = getAuthSession();
  const currentProject = getCurrentProject(session);
  if (session?.userId) {
    merged.set("x-chiller-user-id", session.userId);
  }
  if (currentProject?.databaseKey) {
    merged.set("x-chiller-project-key", currentProject.databaseKey);
  }
  if (currentProject?.template) {
    merged.set("x-chiller-project-template", currentProject.template);
  } else if (session?.defaultProjectTemplate) {
    merged.set("x-chiller-project-template", session.defaultProjectTemplate);
  }
  return merged;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
    headers: buildBffHeaders(),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
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
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
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
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
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
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
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
  const response = await fetch(`${BFF_BASE_URL}${path}`, {
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

export async function fetchDashboardTrends(
  siteId: string,
  range: "24h" | "7d" | "30d" = "24h"
): Promise<DashboardTrendsDto> {
  return fetchJson<DashboardTrendsDto>(`/bff/v1/sites/${siteId}/dashboard/trends?range=${range}`);
}

export async function fetchAnomalySummary(siteId: string): Promise<AnomalySummaryDto> {
  return fetchJson<AnomalySummaryDto>(`/bff/v1/sites/${siteId}/anomalies/summary`);
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
  return fetchJson<OperationRecordListDto>(`/bff/v1/sites/${siteId}/operation-records?${search.toString()}`);
}

export async function fetchOperationRecordDeviceTypes(siteId: string): Promise<OperationRecordDeviceTypeDto> {
  return fetchJson<OperationRecordDeviceTypeDto>(`/bff/v1/sites/${siteId}/operation-records/device-types`);
}

export async function fetchOperationRecordDevices(
  siteId: string,
  drTypeId: string
): Promise<OperationRecordDeviceOptionsDto> {
  const search = new URLSearchParams();
  search.set("drTypeId", drTypeId);
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
  return fetchJson<ReportRecordRegOptionsDto>(`/bff/v1/sites/${siteId}/report-records/reg-options?${search.toString()}`);
}

export async function fetchEnergyParameters(siteId: string): Promise<EnergyParameterDto> {
  return fetchJson<EnergyParameterDto>(`/bff/v1/sites/${siteId}/energy-parameters`);
}

export async function fetchEnergyAnalysisTree(siteId: string): Promise<EnergyAnalysisTreeDto> {
  return fetchJson<EnergyAnalysisTreeDto>(`/bff/v1/sites/${siteId}/energy-analysis/tree`);
}

export async function fetchEnergyAnalysis(
  siteId: string,
  options: {
    startDate: string;
    endDate: string;
    dateType: string;
    deviceIds: string[];
  }
): Promise<EnergyAnalysisDto> {
  const search = new URLSearchParams();
  search.set("startDate", options.startDate);
  search.set("endDate", options.endDate);
  search.set("dateType", options.dateType);
  search.set("deviceIds", options.deviceIds.join(","));
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
    regIds?: string[];
  }
): Promise<ReportRecordDto> {
  const search = new URLSearchParams();
  search.set("page", String(options.page ?? 1));
  search.set("pageSize", String(options.pageSize ?? 10));
  search.set("startTime", options.startTime);
  search.set("endTime", options.endTime);
  search.set("drTypeId", options.drTypeId);
  search.set("drId", options.drId);
  if ((options.regIds?.length ?? 0) > 0) {
    search.set("regIds", (options.regIds || []).join(","));
  }
  return fetchJson<ReportRecordDto>(`/bff/v1/sites/${siteId}/report-records?${search.toString()}`);
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
  options: { build?: number; floor?: number } = {}
): Promise<DeviceTreeDto> {
  const search = new URLSearchParams();
  search.set("build", String(options.build ?? 1));
  search.set("floor", String(options.floor ?? 1));
  return fetchJson<DeviceTreeDto>(`/bff/v1/sites/${siteId}/devices/tree?${search.toString()}`);
}

export async function fetchDeviceDetail(
  siteId: string,
  deviceId: string,
  options: { build?: number; floor?: number } = {}
): Promise<DeviceDetailDto> {
  const search = new URLSearchParams();
  search.set("build", String(options.build ?? 1));
  search.set("floor", String(options.floor ?? 1));
  return fetchJson<DeviceDetailDto>(
    `/bff/v1/sites/${siteId}/devices/${encodeURIComponent(deviceId)}?${search.toString()}`
  );
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
): Promise<never> {
  return postJson<never>(`/bff/v1/sites/${siteId}/optimize`, body);
}
