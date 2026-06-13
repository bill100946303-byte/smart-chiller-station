import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { runtimeConfig } from "../config/runtimeConfig";
import useAiDigest from "../hooks/useAiDigest";
import useRecommendationDiagnostics from "../hooks/useRecommendationDiagnostics";
import { getAuthSession, getCurrentProject } from "../services/auth";
import {
  getRiskCopy,
  getRuleCopy,
  getSeverityCopy,
  preferChineseText
} from "../i18n/hvacCopybook";
import { zhCN } from "../i18n/zhCN";
import {
  type AiDigestDto,
  type AnomalyListDto,
  type AnomalySummaryDto,
  type DashboardOverviewDto,
  type DashboardTrendSeriesDto,
  type DashboardTrendsDto,
  type DeviceDetailDto,
  type DeviceListDto,
  type EnvironmentBuildingListDto,
  type EnvironmentConditionListDto,
  type RecommendationDto,
  type SourceStatusDto,
  type WorkOrderListDto,
  fetchAnomalyList,
  fetchAnomalySummary,
  fetchDashboardOverview,
  fetchDashboardTrends,
  fetchDeviceDetails,
  fetchDeviceList,
  fetchEnvironmentBuildings,
  fetchEnvironmentConditions,
  fetchWorkOrders
} from "../services/bffClient";
import { getDisplayAnomalySource, getDisplayAnomalyTitle } from "../utils/anomalyPresentation";
import { safeLocalStorageGet, safeLocalStorageSet } from "../utils/browserStorage";

type Tone = "good" | "warn" | "neutral";
type TrendRange = "24h" | "7d" | "30d";
type SystemType = "chiller" | "chilledPump" | "coolingPump" | "coolingTower";

type ControlSignalView = {
  key: string;
  label: string;
  value: string;
  active: boolean;
  tone: Tone;
};

type MainLoopDeviceView = {
  deviceId: string;
  name: string;
  systemType: string;
  runStatusText: string | null;
  alarmStatusText: string | null;
  latestUpdateAt: string | null;
  controlSignals: ControlSignalView[];
};

type MainLoopStageView = {
  key: SystemType;
  title: string;
  total: number;
  running: number;
  runningDisplay: string;
  stopped: number;
  alarm: number;
  attention: number;
  runningEstimated: boolean;
  latestUpdateAt: string | null;
  note: string;
};

type ComfortRoomView = {
  id: string;
  name: string;
  temperature: number | null;
  setpoint: number | null;
  deviation: number | null;
  supplyAir: number | null;
  returnAir: number | null;
  cooledAir: boolean;
};

type RecommendationItem = {
  id: string;
  title: string;
  description: string;
  impact: string;
  scope: string;
  risk: string;
  tone: Tone;
  to: string;
};

type AnomalyQueueItem = {
  id: string;
  title: string;
  severity: string;
  tone: Tone;
  impactLabel: string;
  occurredAt: string;
  source: string | null;
  summary: string;
  to: string;
};

type TrendMetricView = {
  key: string;
  label: string;
  unit: string;
  latest: number | null;
  min: number | null;
  max: number | null;
  points: Array<{ time: string | null; label: string; value: number | null }>;
};

type OpsMetric = {
  key: string;
  label: string;
  value: string;
  tone: Tone;
  hint: string;
  assessment?: string;
  thresholdHint?: string;
  group?: "scale" | "diagnostic";
  isMissing?: boolean;
  stageLabel?: string;
};

type FocusItem = {
  label: string;
  value: string;
  tone: Tone;
  hint?: string;
};

type HandoverItem = {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  to?: string;
};

type Verdict = {
  title: string;
  description: string;
  tone: Tone;
  focusItems: FocusItem[];
};

type ProjectModeView = {
  mode: "process" | "spatial";
  label: string;
  note: string;
};

type SparkPointView = {
  time: string | null;
  label: string;
  value: number;
  x: number;
  y: number;
};

type SparkModelView = {
  leadPath: string;
  path: string;
  plottedPoints: SparkPointView[];
  domainMin: number | null;
  domainMax: number | null;
  plotTop: number;
  plotBottom: number;
};

type TrendSparkCardProps = {
  card: TrendMetricView;
  hoverTime: string | null;
  onHoverTime: (time: string | null) => void;
};

type DashboardOverviewSnapshotPayload = {
  version: 1;
  siteId: string;
  capturedAt: string;
  overview: DashboardOverviewDto;
};

type DashboardTrendsSnapshotPayload = {
  version?: 1;
  siteId?: string;
  capturedAt?: string;
  trends?: DashboardTrendsDto;
};

type DashboardTrendsHistoryPayload = {
  version: 1;
  siteId: string;
  range: "24h";
  capturedAt: string;
  series: DashboardTrendSeriesDto[];
};

type TowerApproachMeasurement = {
  value: number | null;
  rawValue: number | null;
  plausible: boolean;
};

const TREND_SPARK_WIDTH = 180;
const TREND_SPARK_HEIGHT = 48;
const FEATURED_TREND_SPARK_WIDTH = 380;
const FEATURED_TREND_SPARK_HEIGHT = 220;
const FEATURED_COP_MIN_DOMAIN_SPAN = 1.2;
const TOWER_APPROACH_MAX_PLAUSIBLE_C = 20;
const DASHBOARD_AUTO_REFRESH_MS = 10_000;
const DASHBOARD_RECOVERY_RETRY_MS = 5_000;
const DASHBOARD_OVERVIEW_SNAPSHOT_KEY_PREFIX = "chiller-dashboard-overview-snapshot-v1";
const DASHBOARD_TRENDS_SNAPSHOT_KEY_PREFIX = "chiller-dashboard-trends-snapshot-v2";
const DASHBOARD_TRENDS_HISTORY_KEY_PREFIX = "chiller-dashboard-trends-history-v2";
const TREND_WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const TREND_NEAR_FULL_24H_COVERAGE_MS = 23 * 60 * 60 * 1000;
const DASHBOARD_PENDING_REVIEW_LABEL = "待复核";
const DASHBOARD_NOT_RETURNED_LABEL = "未传回";

const DASHBOARD_TEXT = {
  commandCenter: "值班总判台",
  dutyFocus: "当前值守重点",
  mainLoop: "主链路状态带",
  alarmQueue: "告警影响队列",
  alarmQueueHint: "先处理已经影响主链路供冷的事件。",
  controlWatchHint: "先复核就地、手动、禁用等接管信号。",
  comfortResult: "舒适结果",
  efficiencyTrend: "效率趋势",
  deltaTrend: "换热温差趋势",
  actionCenter: "可执行处置中心",
  controlWatch: "人工接管观察",
  handover: "交接班条带",
  domainBoards: "安全 / 运行 / 效率判断",
  opsBoard: "值班判断板",
  opsBoardHint: "先看效率表现，再看主链路连续性，最后复核风险与本地接管。",
  opsEfficiencyTitle: "效率表现",
  opsEfficiencyHint: "把 COP、功率结构、关键水温和温差放到最前面，先看当前冷站效率质量。",
  opsContinuityTitle: "主链路连续性",
  opsContinuityHint: "先确认冷机、冷冻泵、冷却泵、冷却塔是否仍在稳定供冷。",
  opsRiskTitle: "风险与本地接管总览",
  opsRiskHint: "把本地/手动、主链路报警、高等级异常和数据可信度压成一条告警总览。",
  opsCoverageSummary: "运行覆盖",
  opsCoverageSummaryHint: "已回传运行态、告警态或控制信号的主设备占比",
  opsSourceStatus: "数据状态",
  opsSourceStatusOk: "可直接判断",
  opsSourceStatusWarn: "部分数据待复核",
  opsUpdatedAtHint: "最近聚合",
  safety: "安全",
  comfort: "舒适",
  processHealth: "运行态",
  efficiency: "效率",
  focusUpdatedAt: "最近聚合",
  focusSite: "站点",
  focusProjectMode: "项目模式",
  focusCooledRooms: "供冷中房间",
  focusWorkOrders: "待跟进工单",
  focusSupplyChain: "主链路",
  projectModeProcess: "工艺型项目",
  projectModeSpatial: "空间型项目",
  projectModePending: "模式识别中",
  projectModePendingNote: "项目组织方式识别中，请先按当前数据状态判断。",
  projectModeProcessNote: "当前按工艺设备组织，优先看主机、泵、塔等主链路状态。",
  projectModeSpatialNote: "当前带有空间层级，可继续联动楼栋、楼层与末端空间查看。",
  processSummary: "工艺型项目先看主设备运行台数、运行态覆盖和接管风险。",
  processCoverage: "运行态覆盖",
  processRunningUnits: "当前运行设备",
  processAttention: "接管关注",
  processCoverageHint: "已回传运行态、告警态或控制信号的主设备",
  processRunningHint: "按冷机、泵、塔主链路聚合",
  processAttentionHint: "就地 / 手动 / 禁用等接管信号",
  processSection: "工艺运行面",
  processSectionHint: "工艺型项目不按空间舒适度判断，优先看主设备运行覆盖和接管风险。",
  processStageTitle: "主设备链路",
  processStageEmpty: "当前主链路还没有可展示的运行设备。",
  safetyHigh: "高等级异常",
  safetyLoopAlarm: "主链路告警设备",
  safetyManual: "人工接管关注",
  comfortCompliance: "舒适达标率",
  comfortOutOfRange: "越限房间数",
  comfortCooledRooms: "供冷中房间",
  efficiencyCop: "当前 COP",
  efficiencyStationCop: "冷站COP",
  efficiencyChillerCop: "主机COP",
  efficiencyCoolingCapacity: "总制冷量",
  efficiencyPower: "总站功率",
  efficiencyChilledPumpCoefficient: "冷冻泵输送比",
  efficiencyCoolingPumpCoefficient: "冷却泵输送比",
  efficiencyCoolingTowerCoefficient: "冷却塔输送比",
  efficiencyHeatBalance: "热平衡偏差",
  efficiencyDelta: "冷冻/冷却温差",
  efficiencyWaterTemp: "关键水温",
  metricExcellent: "优秀",
  metricGood: "良好",
  metricImprove: "需改善",
  controlClear: "主链路暂未发现就地、手动或禁用信号。",
  controlFallback: "暂无接管信号",
  handoverNoOps: "若当前没有新增操作，交接时先沿本班结论与待接续事项逐条确认。",
  handoverRuleHint: "规则引擎与建议链路同步展示在此，便于交接时确认当前策略侧风险。",
  comfortCompatibleHint: "舒适达标按设定温度偏差 ±1°C 判断，供冷中房间按当前运行状态统计。",
  comfortEmpty: "环境点位尚未回传，当前无法计算房间舒适结果。",
  anomalyEmpty: "当前没有需要优先排队的高影响事件。",
  actionEmpty: "当前没有可执行建议，可以先看规则提示和数据状态。",
  impactSupply: "影响供冷",
  impactComfort: "影响舒适",
  impactOperation: "需值守关注",
  verdictDataSoftTitle: "核心数据已到位，少量数据待复核",
  verdictDataSoftDesc: "关键功率、COP 与温差已回传，当前判断可以继续，少量数据建议顺手复核。",
  verdictTakeoverTitle: "需人工接管，先稳住主链路",
  verdictTakeoverDesc: "主链路已出现高等级异常、告警设备或人工接管信号，首页优先把供冷连续性放在第一位。",
  verdictComfortTitle: "舒适风险上升，先看末端偏差",
  verdictComfortDesc: "系统仍在供冷，但房间温度偏差已经扩大，建议先处理最差房间与供冷覆盖面。",
  verdictEfficiencyTitle: "运行稳定，可转入能效优化",
  verdictEfficiencyDesc: "主链路稳定，优先跟踪 COP 与优化建议。",
  verdictDataTitle: "关键数据待确认，先稳住当前判断",
  verdictDataDesc: "数据延迟或缺口，先核对现场/原始页。",
  verdictStableTitle: "系统稳定供冷，可维持当前策略",
  verdictStableDesc: "首屏暂未发现主链路失稳或舒适越限高压，建议继续值守并跟踪能效变化。",
  trendLatest: "最新",
  trendMin: "最小",
  trendMax: "最大",
  trendEmpty: "当前指标没有连续有效点。",
  trendHint: "鼠标悬停后四张曲线按同一时刻联动。",
  actionWhyNow: "为什么先看",
  actionBenefit: "直接收益",
  actionScope: "涉及范围",
  actionEntry: "打开处置页",
  actionScopeFallback: "当前建议未返回明确影响范围",
  actionRelatedPrefix: "关联设备",
  alarmOccurred: "发生于",
  mainLoopAttention: "接管关注",
  mainLoopRunning: "运行",
  mainLoopStopped: "停机",
  mainLoopAlarm: "报警",
  mainLoopTotal: "总数",
  comfortRank: "偏差最差房间",
  controlLocation: "控制位置",
  controlMode: "频率模式",
  signalUnavailable: "未回传",
  supplyCompatible: "供冷判断",
  handoverAction: "待闭环事项",
  handoverRecommendation: "高风险建议",
  handoverManual: "人工接管",
  handoverWorkOrder: "开放工单",
  handoverOpenPage: "打开页面"
};

const MAIN_LOOP_ORDER: SystemType[] = ["chiller", "chilledPump", "coolingPump", "coolingTower"];

function toFixedOrDash(value: number | null | undefined, digits: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatFixedNumber(value: number, digits: number, useGrouping = false): string {
  if (!useGrouping) {
    return value.toFixed(digits);
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function shouldGroupMetricUnit(unit?: string): boolean {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  return ["kw", "kwh", "rt", "mw", "mwh"].includes(normalizedUnit);
}

function formatMetricValue(
  value: number | null | undefined,
  digits: number,
  unit?: string,
  missingLabel = DASHBOARD_PENDING_REVIEW_LABEL,
  useGrouping = shouldGroupMetricUnit(unit)
): string {
  if (!isFiniteNumber(value)) {
    return missingLabel;
  }
  const displayValue = formatFixedNumber(value, digits, useGrouping);
  return unit ? `${displayValue} ${unit}` : displayValue;
}

function formatMetricPairValue(
  left: number | null | undefined,
  right: number | null | undefined,
  digits: number,
  unit?: string,
  missingLabel = DASHBOARD_PENDING_REVIEW_LABEL
): string {
  const leftDisplay = isFiniteNumber(left) ? left.toFixed(digits) : missingLabel;
  const rightDisplay = isFiniteNumber(right) ? right.toFixed(digits) : missingLabel;
  return unit ? `${leftDisplay} / ${rightDisplay} ${unit}` : `${leftDisplay} / ${rightDisplay}`;
}

function formatPercentValue(
  value: number | null | undefined,
  digits = 0,
  missingLabel = DASHBOARD_PENDING_REVIEW_LABEL
): string {
  return isFiniteNumber(value) ? `${value.toFixed(digits)}%` : missingLabel;
}

function formatCountRatioValue(
  current: number | null | undefined,
  total: number | null | undefined,
  missingTotalLabel = DASHBOARD_PENDING_REVIEW_LABEL
): string {
  const currentDisplay = formatCountValue(current, missingTotalLabel);
  const totalDisplay =
    typeof total === "number" && Number.isFinite(total) && total > 0
      ? formatCountValue(total, missingTotalLabel)
      : missingTotalLabel;
  return `${currentDisplay}/${totalDisplay}`;
}

function formatCountValue(value: number | null | undefined, missingLabel = DASHBOARD_PENDING_REVIEW_LABEL): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return missingLabel;
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatCountDisplayValue(value: number | string | null | undefined, missingLabel = DASHBOARD_PENDING_REVIEW_LABEL): string {
  if (typeof value === "number") {
    return formatCountValue(value, missingLabel);
  }
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return missingLabel;
  }
  const estimatedMatch = normalized.match(/^(\d+)\+$/);
  if (estimatedMatch) {
    return `${formatCountValue(Number(estimatedMatch[1]), missingLabel)}+`;
  }
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    return formatCountValue(parsed, missingLabel);
  }
  return normalized;
}

function formatTemperatureValue(value: number | null | undefined, digits = 1, missingLabel = DASHBOARD_NOT_RETURNED_LABEL): string {
  return isFiniteNumber(value) ? `${value.toFixed(digits)}°C` : missingLabel;
}

function formatDeviationValue(value: number | null | undefined, digits = 1, missingLabel = DASHBOARD_NOT_RETURNED_LABEL): string {
  if (!isFiniteNumber(value)) {
    return missingLabel;
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}°C`;
}

function localizeDashboardAnomalyText(value: string | null | undefined, fallback: string): string {
  const preferred = preferChineseText(value ?? "", fallback).trim() || fallback;
  return preferred
    .replace(/\bAlarm event\b/gi, "高等级告警")
    .replace(/\bUnknown\b/gi, "来源待识别");
}

function buildDashboardAnomalySummary(options: {
  occurredAt: string;
  source: string | null;
  value: string | number | null | undefined;
}): string {
  const sourceLine =
    !options.source || options.source === "来源待识别"
      ? "来源待识别"
      : options.source.startsWith("来源 ")
        ? options.source
        : `来源 ${options.source}`;
  const parts = [
    options.occurredAt && options.occurredAt !== zhCN.common.timeUnknown ? `${DASHBOARD_TEXT.alarmOccurred}${options.occurredAt}` : null,
    sourceLine,
    options.value != null && String(options.value).trim() ? `当前值 ${localizeDashboardAnomalyText(String(options.value), String(options.value))}` : null
  ];
  return parts.filter(Boolean).join(" · ");
}

function splitMetricDisplay(value: string): { main: string; unit: string | null } {
  const trimmed = value.trim();
  const unitPatterns = [/^(.+?)\s*(kWh)$/i, /^(.+?)\s*(kW)$/i, /^(.+?)\s*(MW)$/i, /^(.+?)\s*(RT)$/i, /^(.+?)\s*(°C)$/i, /^(.+?)\s*(%)$/];

  for (const pattern of unitPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        main: match[1].trim(),
        unit: match[2].trim()
      };
    }
  }

  return { main: trimmed, unit: null };
}

function toPercentOrDash(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveTowerApproachMeasurement(
  tcwsC: number | null | undefined,
  wetBulbC: number | null | undefined
): TowerApproachMeasurement {
  if (!isFiniteNumber(tcwsC) || !isFiniteNumber(wetBulbC)) {
    return {
      value: null,
      rawValue: null,
      plausible: false
    };
  }
  const rawValue = Number((tcwsC - wetBulbC).toFixed(1));
  if (rawValue < 0 || rawValue > TOWER_APPROACH_MAX_PLAUSIBLE_C) {
    return {
      value: null,
      rawValue,
      plausible: false
    };
  }
  return {
    value: rawValue,
    rawValue,
    plausible: true
  };
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildOverviewSnapshotStorageKey(siteId: string, contextKey = ""): string {
  return `${DASHBOARD_OVERVIEW_SNAPSHOT_KEY_PREFIX}:${siteId || "default"}:${contextKey || "default"}`;
}

function hasUsableOverviewMetrics(overview: DashboardOverviewDto | null | undefined): boolean {
  const cards = overview?.energyCards;
  if (!cards) {
    return false;
  }
  const candidates = [
    cards.currentCop,
    cards.totalPowerKw,
    cards.totalCoolingCapacity,
    cards.chilledDeltaT,
    cards.coolingDeltaT,
    cards.chillerPowerKw,
    cards.chilledPumpPowerKw,
    cards.coolingPumpPowerKw,
    cards.coolingTowerPowerKw
  ];
  return candidates.some((value) => typeof value === "number" && Number.isFinite(value));
}

function readOverviewSnapshot(siteId: string, contextKey = ""): DashboardOverviewSnapshotPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = safeLocalStorageGet(buildOverviewSnapshotStorageKey(siteId, contextKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DashboardOverviewSnapshotPayload;
    if (
      parsed?.version !== 1 ||
      parsed?.siteId !== siteId ||
      !parsed?.overview ||
      !hasUsableOverviewMetrics(parsed.overview)
    ) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeOverviewSnapshot(siteId: string, overview: DashboardOverviewDto, capturedAt: string, contextKey = ""): void {
  if (typeof window === "undefined" || !hasUsableOverviewMetrics(overview)) {
    return;
  }
  const payload: DashboardOverviewSnapshotPayload = {
    version: 1,
    siteId,
    capturedAt,
    overview
  };
  try {
    safeLocalStorageSet(buildOverviewSnapshotStorageKey(siteId, contextKey), JSON.stringify(payload));
  } catch (_error) {
    // localStorage may be unavailable in private browsing or restricted environments.
  }
}

function buildTrendsSnapshotStorageKey(siteId: string, contextKey = ""): string {
  return `${DASHBOARD_TRENDS_SNAPSHOT_KEY_PREFIX}:${siteId || "default"}:${contextKey || "default"}`;
}

function buildTrendsHistoryStorageKey(siteId: string, contextKey = ""): string {
  return `${DASHBOARD_TRENDS_HISTORY_KEY_PREFIX}:${siteId || "default"}:${contextKey || "default"}`;
}

function shouldPersistLocalTrendHistory(range: TrendRange): boolean {
  return range === "24h";
}

function hasUsableTrendsMetrics(trends: DashboardTrendsDto | null | undefined): boolean {
  return Boolean(
    trends?.series?.some((item) => Array.isArray(item.points) && item.points.length > 0)
  );
}

function mergeTrendSeriesPoints(
  historySeries: DashboardTrendSeriesDto[] | undefined,
  incomingSeries: DashboardTrendSeriesDto[] | undefined,
  range: TrendRange
): DashboardTrendSeriesDto[] {
  if (!shouldPersistLocalTrendHistory(range)) {
    return incomingSeries || historySeries || [];
  }

  const seriesBuckets = new Map<
    string,
    {
      metric: string;
      label?: string;
      order: number;
      points: Map<string, { t: string; v: number | null }>;
    }
  >();
  let nextOrder = 0;

  function ingestSeries(seriesList: DashboardTrendSeriesDto[] | undefined) {
    (seriesList || []).forEach((series) => {
      const metric = typeof series.metric === "string" ? series.metric.trim() : "";
      if (!metric) {
        return;
      }

      let bucket = seriesBuckets.get(metric);
      if (!bucket) {
        bucket = {
          metric,
          label: series.label,
          order: nextOrder,
          points: new Map()
        };
        nextOrder += 1;
        seriesBuckets.set(metric, bucket);
      } else if (!bucket.label && series.label) {
        bucket.label = series.label;
      }

      (series.points || []).forEach((point: NonNullable<DashboardTrendSeriesDto["points"]>[number]) => {
        const timestamp = parseTrendTimestamp(point?.t);
        if (timestamp == null) {
          return;
        }
        const key = new Date(timestamp).toISOString();
        const value = typeof point?.v === "number" && Number.isFinite(point.v) ? point.v : null;
        const previous = bucket.points.get(key);
        if (!previous || value != null || previous.v == null) {
          bucket.points.set(key, { t: key, v: value });
        }
      });
    });
  }

  ingestSeries(historySeries);
  ingestSeries(incomingSeries);

  const allTimestamps = Array.from(seriesBuckets.values()).flatMap((bucket) =>
    Array.from(bucket.points.keys())
      .map((pointTime) => parseTrendTimestamp(pointTime))
      .filter((value): value is number => typeof value === "number")
  );
  if (!allTimestamps.length) {
    return incomingSeries || historySeries || [];
  }

  const endTs = Math.max(...allTimestamps);
  const startTs = endTs - 24 * 60 * 60 * 1000;

  return Array.from(seriesBuckets.values())
    .sort((left, right) => left.order - right.order)
    .map((bucket) => ({
      metric: bucket.metric,
      label: bucket.label,
      points: Array.from(bucket.points.values())
        .filter((point) => {
          const timestamp = parseTrendTimestamp(point.t);
          return timestamp != null && timestamp >= startTs && timestamp <= endTs;
        })
        .sort((left, right) => {
          const leftTs = parseTrendTimestamp(left.t) ?? 0;
          const rightTs = parseTrendTimestamp(right.t) ?? 0;
          return leftTs - rightTs;
        })
    }))
    .filter((series) => (series.points?.length ?? 0) > 0);
}

function mergeTrendsWithLocalHistory(
  trends: DashboardTrendsDto,
  historySeries: DashboardTrendSeriesDto[] | undefined,
  range: TrendRange
): DashboardTrendsDto {
  if (!shouldPersistLocalTrendHistory(range) || !historySeries?.length) {
    return trends;
  }
  return {
    ...trends,
    series: mergeTrendSeriesPoints(historySeries, trends.series, range)
  };
}

function buildTrendsFromHistory(siteId: string, history: DashboardTrendsHistoryPayload): DashboardTrendsDto | null {
  if (!history.series.length) {
    return null;
  }
  return {
    site: {
      siteId
    },
    generatedAt: history.capturedAt,
    range: history.range,
    series: history.series
  };
}

function readTrendsSnapshot(siteId: string, contextKey = ""): { siteId: string; capturedAt: string; trends: DashboardTrendsDto } | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = safeLocalStorageGet(buildTrendsSnapshotStorageKey(siteId, contextKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DashboardTrendsSnapshotPayload;
    if (
      (parsed?.version != null && parsed.version !== 1) ||
      !parsed?.siteId ||
      parsed.siteId !== siteId ||
      !parsed?.capturedAt ||
      !parsed?.trends ||
      !hasUsableTrendsMetrics(parsed.trends)
    ) {
      return null;
    }
    return {
      siteId: parsed.siteId,
      capturedAt: parsed.capturedAt,
      trends: parsed.trends
    };
  } catch (_error) {
    return null;
  }
}

function writeTrendsSnapshot(siteId: string, trends: DashboardTrendsDto, capturedAt: string, contextKey = ""): void {
  if (typeof window === "undefined" || !hasUsableTrendsMetrics(trends)) {
    return;
  }
  const payload: DashboardTrendsSnapshotPayload = {
    version: 1,
    siteId,
    capturedAt,
    trends
  };
  try {
    safeLocalStorageSet(buildTrendsSnapshotStorageKey(siteId, contextKey), JSON.stringify(payload));
  } catch (_error) {
    // localStorage may be unavailable in private browsing or restricted environments.
  }
}

function readTrendsHistory(siteId: string, range: TrendRange, contextKey = ""): DashboardTrendsHistoryPayload | null {
  if (typeof window === "undefined" || !shouldPersistLocalTrendHistory(range)) {
    return null;
  }
  try {
    const raw = safeLocalStorageGet(buildTrendsHistoryStorageKey(siteId, contextKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DashboardTrendsHistoryPayload;
    if (
      parsed?.version !== 1 ||
      parsed?.siteId !== siteId ||
      parsed?.range !== "24h" ||
      !parsed?.capturedAt ||
      !Array.isArray(parsed?.series)
    ) {
      return null;
    }
    return {
      version: 1,
      siteId: parsed.siteId,
      range: "24h",
      capturedAt: parsed.capturedAt,
      series: mergeTrendSeriesPoints(undefined, parsed.series, range)
    };
  } catch (_error) {
    return null;
  }
}

function writeTrendsHistory(
  siteId: string,
  trends: DashboardTrendsDto,
  capturedAt: string,
  range: TrendRange,
  contextKey = ""
): DashboardTrendsHistoryPayload | null {
  if (typeof window === "undefined" || !hasUsableTrendsMetrics(trends) || !shouldPersistLocalTrendHistory(range)) {
    return null;
  }
  const previous = readTrendsHistory(siteId, range, contextKey);
  const payload: DashboardTrendsHistoryPayload = {
    version: 1,
    siteId,
    range: "24h",
    capturedAt,
    series: mergeTrendSeriesPoints(previous?.series, trends.series, range)
  };
  try {
    safeLocalStorageSet(buildTrendsHistoryStorageKey(siteId, contextKey), JSON.stringify(payload));
  } catch (_error) {
    // localStorage may be unavailable in private browsing or restricted environments.
  }
  return payload;
}

function sumNumbers(values: Array<number | null | undefined>): number | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (finiteValues.length === 0) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0);
}

function divideOrNull(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  if (typeof numerator !== "number" || !Number.isFinite(numerator)) {
    return null;
  }
  if (typeof denominator !== "number" || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function assessThresholdMetric(
  value: number | null | undefined,
  excellentMin: number,
  goodMin: number
): { label: string; tone: Tone } | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value >= excellentMin) {
    return { label: DASHBOARD_TEXT.metricExcellent, tone: "good" };
  }
  if (value >= goodMin) {
    return { label: DASHBOARD_TEXT.metricGood, tone: "neutral" };
  }
  return { label: DASHBOARD_TEXT.metricImprove, tone: "warn" };
}

function assessHeatBalanceMetric(value: number | null | undefined): { label: string; tone: Tone } | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const distance = Math.abs(value);
  if (distance <= 5) {
    return { label: DASHBOARD_TEXT.metricExcellent, tone: "good" };
  }
  if (distance <= 10) {
    return { label: DASHBOARD_TEXT.metricGood, tone: "neutral" };
  }
  return { label: DASHBOARD_TEXT.metricImprove, tone: "warn" };
}

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return parsed.toLocaleString();
}

function formatShortDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return parsed.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatClockTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function formatRangeLabel(value: TrendRange): string {
  if (value === "7d") {
    return zhCN.range.button7d;
  }
  if (value === "30d") {
    return zhCN.range.button30d;
  }
  return zhCN.range.button24h;
}

function hasSourceFailure(sourceStatus: SourceStatusDto | null | undefined): boolean {
  return sourceStatus?.overall === "partial" || sourceStatus?.overall === "failed";
}

function findSourceEntry(sourceStatus: SourceStatusDto | null | undefined, key: string) {
  return sourceStatus?.sources?.find((source) => source.key === key) || null;
}

function isMeaningfulSpaceValue(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  const lowered = normalized.toLowerCase();
  return !["unknown", "未知", "默认", "0", "null", "undefined", "-", "--"].includes(lowered);
}

function detectProjectMode(
  deviceList: DeviceListDto | null,
  buildings: EnvironmentBuildingListDto | null
): ProjectModeView {
  const deviceHasSpace = Boolean(
    deviceList?.items?.some(
      (item) => isMeaningfulSpaceValue(item.floorName) || isMeaningfulSpaceValue(item.buildingName)
    )
  );
  const buildingHasSpace = Boolean(
    buildings?.items?.some(
      (item) => isMeaningfulSpaceValue(item.name) || isMeaningfulSpaceValue(item.description)
    )
  );

  if (deviceHasSpace || buildingHasSpace) {
    return {
      mode: "spatial",
      label: DASHBOARD_TEXT.projectModeSpatial,
      note: DASHBOARD_TEXT.projectModeSpatialNote
    };
  }

  return {
    mode: "process",
    label: DASHBOARD_TEXT.projectModeProcess,
    note: DASHBOARD_TEXT.projectModeProcessNote
  };
}

function toneFromSeverity(value: string | null | undefined): Tone {
  if (value === "critical" || value === "major") {
    return "warn";
  }
  if (value === "minor") {
    return "neutral";
  }
  return "good";
}

function classifyAnomalyImpact(title: string, source: string | undefined): { label: string; to: string; rank: number } {
  const haystack = `${title} ${source || ""}`;
  if (/冷机|冰机|主机|冷冻泵|冷却泵|冷却塔|供冷|停机|主链路|故障|机组/i.test(haystack)) {
    return { label: DASHBOARD_TEXT.impactSupply, to: "/scene-control", rank: 0 };
  }
  if (/房间|环境|温度|湿度|舒适|末端|风机盘管|盘管风机/i.test(haystack)) {
    return { label: DASHBOARD_TEXT.impactComfort, to: "/environment-conditions", rank: 1 };
  }
  return { label: DASHBOARD_TEXT.impactOperation, to: "/alarms", rank: 2 };
}

function severityRank(value: string | null | undefined): number {
  if (value === "critical") {
    return 0;
  }
  if (value === "major") {
    return 1;
  }
  if (value === "minor") {
    return 2;
  }
  return 3;
}

function metricUnit(metric: string): string {
  if (metric === "totalPowerKw") {
    return "kW";
  }
  if (metric === "chilledDeltaT" || metric === "coolingDeltaT") {
    return "°C";
  }
  return "";
}

function formatTrendLabel(value: string, range: TrendRange): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  if (range === "24h") {
    return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function formatTrendHoverLabel(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")} ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function parseTrendTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveObservedTrendBounds(
  points: Array<{ time: string | null; label: string; value: number | null }>
): { startTs: number; endTs: number; coveredSpan: number } | null {
  const timestamps = points
    .filter((point) => typeof point.value === "number" && Number.isFinite(point.value))
    .map((point) => parseTrendTimestamp(point.time))
    .filter((value): value is number => typeof value === "number");
  if (!timestamps.length) {
    return null;
  }

  const startTs = Math.min(...timestamps);
  const endTs = Math.max(...timestamps);
  return {
    startTs,
    endTs,
    coveredSpan: Math.max(endTs - startTs, 0)
  };
}

function resolveTrendTimeWindow(
  points: Array<{ time: string | null; label: string; value: number | null }>,
  range: TrendRange
): { startTs: number; endTs: number } | null {
  const observed = resolveObservedTrendBounds(points);
  if (!observed) {
    return null;
  }

  if (range === "24h") {
    const { endTs } = observed;
    return {
      startTs: endTs - TREND_WINDOW_24H_MS,
      endTs
    };
  }

  return {
    startTs: observed.startTs,
    endTs: observed.endTs
  };
}

function hasNearFull24hTrendCoverage(
  points: Array<{ time: string | null; label: string; value: number | null }> | undefined,
  range: TrendRange
): boolean {
  if (!points?.length || range !== "24h") {
    return false;
  }
  const observed = resolveObservedTrendBounds(points);
  return Boolean(observed && observed.coveredSpan >= TREND_NEAR_FULL_24H_COVERAGE_MS);
}

function smoothTrendSeries(values: number[]): number[] {
  if (values.length <= 2) {
    return values;
  }

  return values.map((currentValue, index) => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const candidate = values[index + offset];
      if (typeof candidate !== "number") {
        continue;
      }
      const distance = Math.abs(offset);
      const weight = distance === 0 ? 4 : distance === 1 ? 2 : 1;
      weightedSum += candidate * weight;
      weightTotal += weight;
    }
    if (weightTotal === 0) {
      return currentValue;
    }
    return weightedSum / weightTotal;
  });
}

function normalizeTrendPointsForRange(
  points: Array<{ time: string | null; label: string; value: number | null }>,
  range: TrendRange
): Array<{ time: string | null; label: string; value: number | null }> {
  if (points.length <= 1) {
    return points;
  }

  const ordered = [...points].sort((left, right) => {
    const leftTs = parseTrendTimestamp(left.time);
    const rightTs = parseTrendTimestamp(right.time);
    if (leftTs == null && rightTs == null) {
      return 0;
    }
    if (leftTs == null) {
      return 1;
    }
    if (rightTs == null) {
      return -1;
    }
    return leftTs - rightTs;
  });

  if (range !== "24h") {
    return ordered;
  }

  const window = resolveTrendTimeWindow(ordered, range);
  if (!window) {
    return ordered;
  }

  const trimmed = ordered.filter((point) => {
    const ts = parseTrendTimestamp(point.time);
    return ts != null && ts >= window.startTs && ts <= window.endTs;
  });

  return trimmed.length > 0 ? trimmed : ordered;
}

function buildTrendMetricView(
  trends: DashboardTrendsDto | null,
  metric: string,
  fallbackLabel: string,
  range: TrendRange
): TrendMetricView | null {
  const series = (trends?.series || []).find((item) => item.metric === metric);
  if (!series || (series.points?.length ?? 0) === 0) {
    return null;
  }

  const points =
    normalizeTrendPointsForRange(
      series.points?.map((point) => ({
        time: point.t || null,
        label: point.t ? formatTrendLabel(point.t, range) : "--",
        value: typeof point.v === "number" && Number.isFinite(point.v) ? point.v : null
      })) || [],
      range
    );
  const stats = (trends?.stats || []).find((item) => item.metric === metric);
  const numericValues = points.map((point) => point.value).filter((value): value is number => typeof value === "number");

  return {
    key: metric,
    label: fallbackLabel,
    unit: metricUnit(metric),
    latest: numericValues[numericValues.length - 1] ?? (typeof stats?.latest === "number" ? stats.latest : null),
    min: numericValues.length ? Math.min(...numericValues) : (typeof stats?.min === "number" ? stats.min : null),
    max: numericValues.length ? Math.max(...numericValues) : (typeof stats?.max === "number" ? stats.max : null),
    points
  };
}

function buildSparkModel(
  points: TrendMetricView["points"],
  range: TrendRange,
  width = TREND_SPARK_WIDTH,
  height = TREND_SPARK_HEIGHT,
  options: {
    paddingTop?: number;
    paddingBottom?: number;
    domainValues?: Array<number | null | undefined>;
    minDomainSpan?: number;
    domainPaddingRatio?: number;
  } = {}
): SparkModelView {
  const numeric = points
    .map((point, pointIndex) => ({ point, pointIndex }))
    .filter(
      (item): item is { point: { time: string | null; label: string; value: number }; pointIndex: number } =>
        typeof item.point.value === "number"
    );
  if (numeric.length < 2) {
    return { leadPath: "", path: "", plottedPoints: [], domainMin: null, domainMax: null, plotTop: 0, plotBottom: height };
  }

  const values = numeric.map((item) => item.point.value);
  const displayedValues = smoothTrendSeries(values);
  const referenceValues = (options.domainValues || []).filter(isFiniteNumber);
  const domainValues = [...displayedValues, ...referenceValues];
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const rawSpan = rawMax === rawMin ? Math.max(Math.abs(rawMax), 1) : rawMax - rawMin;
  const minDomainSpan = Math.max(0, options.minDomainSpan ?? 0);
  const domainCenter = (rawMax + rawMin) / 2;
  const domainSpan = Math.max(rawSpan, minDomainSpan);
  const domainPadding = domainSpan * Math.max(0, options.domainPaddingRatio ?? 0);
  const min = domainCenter - domainSpan / 2 - domainPadding;
  const max = domainCenter + domainSpan / 2 + domainPadding;
  const span = max === min ? Math.max(Math.abs(max), 1) : max - min;
  const plotTop = Math.max(0, Math.min(height - 1, options.paddingTop ?? 4));
  const plotBottom = Math.max(plotTop + 1, height - Math.max(0, options.paddingBottom ?? 4));
  const plotHeight = plotBottom - plotTop;
  const timeWindow = resolveTrendTimeWindow(points, range);
  const timeSpan = timeWindow ? Math.max(timeWindow.endTs - timeWindow.startTs, 1) : null;

  const plottedPoints = numeric.map(({ point, pointIndex }, numericIndex) => ({
    time: point.time,
    label: point.label,
    value: point.value,
    x: (() => {
      const timestamp = parseTrendTimestamp(point.time);
      if (timeWindow && timeSpan && timestamp != null) {
        return Math.min(Math.max(((timestamp - timeWindow.startTs) / timeSpan) * width, 0), width);
      }
      return points.length === 1 ? 0 : (pointIndex / (points.length - 1)) * width;
    })(),
    y: plotBottom - ((displayedValues[numericIndex] - min) / span) * plotHeight
  }));

  const leadPoint = plottedPoints[0];
  const leadPath =
    leadPoint && leadPoint.x > 8 ? `M0,${leadPoint.y.toFixed(1)} L${leadPoint.x.toFixed(1)},${leadPoint.y.toFixed(1)}` : "";

  return {
    leadPath,
    path: plottedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" "),
    plottedPoints,
    domainMin: min,
    domainMax: max,
    plotTop,
    plotBottom
  };
}

function projectSparkValueY(model: SparkModelView, value: number | null | undefined): number | null {
  if (!isFiniteNumber(value) || !isFiniteNumber(model.domainMin) || !isFiniteNumber(model.domainMax)) {
    return null;
  }
  const span = model.domainMax === model.domainMin ? Math.max(Math.abs(model.domainMax), 1) : model.domainMax - model.domainMin;
  return model.plotBottom - ((value - model.domainMin) / span) * (model.plotBottom - model.plotTop);
}

function buildSparkValueTicks(model: SparkModelView, digits = 1): Array<{ label: string; value: number; y: number }> {
  if (!isFiniteNumber(model.domainMin) || !isFiniteNumber(model.domainMax)) {
    return [];
  }
  const values = [model.domainMax, (model.domainMax + model.domainMin) / 2, model.domainMin];
  const seen = new Set<string>();
  return values
    .map((value) => {
      const label = value.toFixed(digits);
      const y = projectSparkValueY(model, value);
      return y == null ? null : { label, value, y };
    })
    .filter((item): item is { label: string; value: number; y: number } => {
      if (!item || seen.has(item.label)) {
        return false;
      }
      seen.add(item.label);
      return true;
    });
}

function describeTrendDelta(
  points: TrendMetricView["points"] | undefined,
  digits: number,
  positiveTone: Tone = "good",
  label = "较起点"
): { label: string; value: string; tone: Tone; delta: number } | null {
  if (!points || points.length === 0) {
    return null;
  }
  const numericPoints = points.filter(
    (point): point is { time: string | null; label: string; value: number } => typeof point.value === "number"
  );
  if (numericPoints.length < 2) {
    return null;
  }
  const first = numericPoints[0].value;
  const last = numericPoints[numericPoints.length - 1].value;
  const delta = last - first;
  const sign = delta > 0 ? "+" : "";
  const tone = delta === 0 ? "neutral" : delta > 0 ? positiveTone : positiveTone === "good" ? "warn" : "good";
  return {
    label,
    value: `${sign}${delta.toFixed(digits)}`,
    tone,
    delta
  };
}

function formatRelativeDayCue(value: Date, reference: Date): string {
  const valueDay = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const referenceDay = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const diff = Math.round((valueDay - referenceDay) / 86_400_000);
  if (diff === 0) {
    return "今日";
  }
  if (diff === -1) {
    return "昨日";
  }
  return `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`;
}

function formatFeaturedAxisTick(
  value: string | null | undefined,
  position: "start" | "middle" | "end",
  range: TrendRange,
  referenceValue?: string | null
): string {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  if (range === "24h") {
    if (position === "middle") {
      return `${hh}:${min}`;
    }
    if (referenceValue) {
      const reference = new Date(referenceValue);
      if (!Number.isNaN(reference.getTime())) {
        return `${formatRelativeDayCue(parsed, reference)} ${hh}:${min}`;
      }
    }
    return `${hh}:${min}`;
  }
  return `${mm}/${dd}`;
}

function buildTrendAxisTicks(
  points: TrendMetricView["points"] | undefined,
  width: number,
  range: TrendRange
): Array<{ label: string; x: number }> {
  if (!points || points.length === 0) {
    return [];
  }
  const usable = points
    .map((point, pointIndex) => ({ point, pointIndex }))
    .filter((item) => item.point.time && item.point.label && item.point.label !== "--");
  if (usable.length === 0) {
    return [];
  }
  const window = resolveTrendTimeWindow(points, range);
  if (window && range === "24h") {
    const referenceValue = new Date(window.endTs).toISOString();
    const midpoint = window.startTs + (window.endTs - window.startTs) / 2;
    const entries = [window.startTs, midpoint, window.endTs];
    return entries.map((timestamp, index) => ({
      label: formatFeaturedAxisTick(
        new Date(timestamp).toISOString(),
        index === 0 ? "start" : index === entries.length - 1 ? "end" : "middle",
        range,
        referenceValue
      ),
      x: index === 0 ? 0 : index === entries.length - 1 ? width : width / 2
    }));
  }
  const picks = [
    usable[0],
    usable[Math.floor((usable.length - 1) / 2)],
    usable[usable.length - 1]
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.pointIndex === item.pointIndex) === index);
  const referenceValue = usable[usable.length - 1]?.point.time ?? null;

  return picks.map(({ point, pointIndex }, index) => ({
    label: formatFeaturedAxisTick(
      point.time,
      index === 0 ? "start" : index === picks.length - 1 ? "end" : "middle",
      range,
      referenceValue
    ),
    x: points.length === 1 ? 0 : (pointIndex / (points.length - 1)) * width
  }));
}

function toneToAssessmentCopy(tone: Tone): string {
  if (tone === "good") {
    return "优秀";
  }
  if (tone === "warn") {
    return "待优化";
  }
  return "良好";
}

function findActiveTrendPoint(points: TrendMetricView["points"], hoverTime: string | null) {
  const numericPoints = points.filter(
    (point): point is { time: string | null; label: string; value: number } =>
      typeof point.value === "number"
  );
  if (numericPoints.length === 0) {
    return null;
  }
  if (!hoverTime) {
    return numericPoints[numericPoints.length - 1];
  }

  const exactMatch = numericPoints.find((point) => point.time === hoverTime);
  if (exactMatch) {
    return exactMatch;
  }

  const targetTs = Date.parse(hoverTime);
  if (!Number.isFinite(targetTs)) {
    return numericPoints[numericPoints.length - 1];
  }

  return numericPoints.reduce((best, current) => {
    const currentTs = current.time ? Date.parse(current.time) : Number.NaN;
    const bestTs = best.time ? Date.parse(best.time) : Number.NaN;
    if (!Number.isFinite(currentTs)) {
      return best;
    }
    if (!Number.isFinite(bestTs)) {
      return current;
    }
    return Math.abs(currentTs - targetTs) < Math.abs(bestTs - targetTs) ? current : best;
  }, numericPoints[numericPoints.length - 1]);
}

function pickNearestSparkPoint(
  plottedPoints: SparkPointView[],
  clientX: number,
  rect: DOMRect,
  width = TREND_SPARK_WIDTH
) {
  if (plottedPoints.length === 0 || rect.width <= 0) {
    return null;
  }
  const localX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const scaledX = (localX / rect.width) * width;
  return plottedPoints.reduce((best, current) =>
    Math.abs(current.x - scaledX) < Math.abs(best.x - scaledX) ? current : best
  );
}

function TrendSparkCard({ card, hoverTime, onHoverTime }: TrendSparkCardProps) {
  const spark = buildSparkModel(card.points, runtimeConfig.trendRange);
  const activePoint = findActiveTrendPoint(card.points, hoverTime);
  const activeSparkPoint =
    spark.plottedPoints.find((point) => point.time === activePoint?.time) ||
    spark.plottedPoints[spark.plottedPoints.length - 1] ||
    null;
  const displayValue = activePoint?.value ?? card.latest;
  const hoverActive = Boolean(hoverTime && activePoint);
  const useGroupedTrendValue = shouldGroupMetricUnit(card.unit);
  const displayValueLabel = formatMetricValue(displayValue, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, useGroupedTrendValue);
  const rangeLabel = `${formatMetricValue(card.min, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, useGroupedTrendValue)} ~ ${formatMetricValue(
    card.max,
    2,
    undefined,
    DASHBOARD_PENDING_REVIEW_LABEL,
    useGroupedTrendValue
  )}`;

  return (
    <article
      className={`dashboard-trend-card ${hoverActive ? "is-linked" : ""}`}
      onMouseLeave={() => onHoverTime(null)}
    >
      <div className="dashboard-trend-card-head">
        <div className="dashboard-trend-card-title">
          <span>{card.label}</span>
          <small>{hoverActive ? formatTrendHoverLabel(activePoint?.time) : "鼠标悬停联动查看"}</small>
        </div>
        <strong>
          {displayValueLabel}
          {card.unit && isFiniteNumber(displayValue) ? <em>{card.unit}</em> : null}
        </strong>
      </div>
      {spark.path ? (
        <svg
          viewBox={`0 0 ${TREND_SPARK_WIDTH} ${TREND_SPARK_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          onMouseMove={(event) => {
            const nearestPoint = pickNearestSparkPoint(
              spark.plottedPoints,
              event.clientX,
              event.currentTarget.getBoundingClientRect()
            );
            if (!nearestPoint?.time) {
              return;
            }
            startTransition(() => onHoverTime(nearestPoint.time));
          }}
        >
          {activeSparkPoint ? (
            <>
              <line
                className="dashboard-trend-crosshair"
                x1={activeSparkPoint.x}
                x2={activeSparkPoint.x}
                y1={0}
                y2={TREND_SPARK_HEIGHT}
              />
              <circle
                className="dashboard-trend-point"
                cx={activeSparkPoint.x}
                cy={activeSparkPoint.y}
                r={3.2}
              />
            </>
          ) : null}
          {spark.leadPath ? <path className="dashboard-trend-lead" d={spark.leadPath} /> : null}
          <path d={spark.path} />
        </svg>
      ) : (
        <p className="empty-hint">{DASHBOARD_TEXT.trendEmpty}</p>
      )}
      <div className="dashboard-trend-stats">
        {hoverActive ? (
          <>
            <small>{`时间 ${formatTrendHoverLabel(activePoint?.time)}`}</small>
            <small>{`当前 ${displayValueLabel}`}</small>
            <small>{`区间 ${rangeLabel}`}</small>
          </>
        ) : (
          <>
            <small>{DASHBOARD_TEXT.trendLatest} {formatMetricValue(card.latest, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, useGroupedTrendValue)}</small>
            <small>{DASHBOARD_TEXT.trendMin} {formatMetricValue(card.min, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, useGroupedTrendValue)}</small>
            <small>{DASHBOARD_TEXT.trendMax} {formatMetricValue(card.max, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, useGroupedTrendValue)}</small>
          </>
        )}
      </div>
    </article>
  );
}

function normalizeControlSignals(detail: DeviceDetailDto["detail"]): ControlSignalView[] {
  return (detail?.controlSignals || [])
    .filter((signal) => Boolean(signal?.value))
    .map((signal) => ({
      key: signal.key || "signal",
      label: signal.label || DASHBOARD_TEXT.signalUnavailable,
      value: signal.value || DASHBOARD_TEXT.signalUnavailable,
      active: signal.active === true,
      tone:
        signal.tone === "good" || signal.tone === "warn" || signal.tone === "neutral"
          ? signal.tone
          : "neutral"
    }));
}

function isMainLoopSystemType(value: string | undefined): value is SystemType {
  return value === "chiller" || value === "chilledPump" || value === "coolingPump" || value === "coolingTower";
}

function isRunningStatus(value: string | null | undefined): boolean {
  const normalized = String(value || "");
  return /运行|启动|开启/.test(normalized) && !/停止|停机/.test(normalized);
}

function isAlarmStatus(value: string | null | undefined): boolean {
  const normalized = String(value || "");
  return /报警|故障/.test(normalized) && !/正常/.test(normalized);
}

function isAttentionSignal(signal: ControlSignalView): boolean {
  return signal.active && (signal.tone === "warn" || /就地|手动|禁用/.test(signal.value));
}

function needsManualAttention(device: MainLoopDeviceView): boolean {
  return device.controlSignals.some(isAttentionSignal);
}

function normalizeDeviceView(
  catalogItem: NonNullable<DeviceListDto["items"]>[number],
  detailDto: DeviceDetailDto | null
): MainLoopDeviceView {
  const detail = detailDto?.detail || null;
  return {
    deviceId: detail?.deviceId || catalogItem?.deviceId || "unknown",
    name: detail?.deviceName || catalogItem?.deviceName || zhCN.common.unknown,
    systemType: catalogItem?.systemType || "other",
    runStatusText: detail?.runStatusText || null,
    alarmStatusText: detail?.alarmStatusText || null,
    latestUpdateAt: detail?.latestUpdateAt || catalogItem?.lastReportAt || null,
    controlSignals: normalizeControlSignals(detail)
  };
}

function systemTypeTitle(value: SystemType): string {
  if (value === "chiller") {
    return zhCN.realtimeStatus.chiller;
  }
  if (value === "chilledPump") {
    return zhCN.realtimeStatus.chilledPump;
  }
  if (value === "coolingPump") {
    return zhCN.realtimeStatus.coolingPump;
  }
  return zhCN.realtimeStatus.coolingTower;
}

function getAggregatePowerKwForSystem(
  overview: DashboardOverviewDto | null,
  systemType: SystemType
): number | null {
  if (systemType === "chiller") {
    return overview?.energyCards?.chillerPowerKw ?? null;
  }
  if (systemType === "chilledPump") {
    return overview?.energyCards?.chilledPumpPowerKw ?? null;
  }
  if (systemType === "coolingPump") {
    return overview?.energyCards?.coolingPumpPowerKw ?? null;
  }
  return overview?.energyCards?.coolingTowerPowerKw ?? null;
}

function buildMainLoopStages(overview: DashboardOverviewDto | null, devices: MainLoopDeviceView[]): MainLoopStageView[] {
  const expectedTotals = {
    chiller: overview?.deviceSummary?.chillerCount ?? 0,
    chilledPump: overview?.deviceSummary?.chilledPumpCount ?? 0,
    coolingPump: overview?.deviceSummary?.coolingPumpCount ?? 0,
    coolingTower: overview?.deviceSummary?.coolingTowerCount ?? 0
  };

  return MAIN_LOOP_ORDER.map((key) => {
    const group = devices.filter((item) => item.systemType === key);
    const total = Math.max(group.length, expectedTotals[key]);
    const explicitRunning = group.filter((item) => isRunningStatus(item.runStatusText)).length;
    const stopped = group.filter((item) => item.runStatusText && !isRunningStatus(item.runStatusText)).length;
    const alarm = group.filter((item) => isAlarmStatus(item.alarmStatusText)).length;
    const attention = group.filter((item) => needsManualAttention(item)).length;
    const aggregatePowerKw = getAggregatePowerKwForSystem(overview, key);
    const missingRuntimeTelemetry = total > 0 && group.every((item) => !item.runStatusText);
    const runningEstimated = explicitRunning === 0 && missingRuntimeTelemetry && isFiniteNumber(aggregatePowerKw) && aggregatePowerKw > 0;
    const running = runningEstimated ? 1 : explicitRunning;
    const runningDisplay = runningEstimated ? "1+" : String(running);
    const latestUpdateAt = group
      .map((item) => item.latestUpdateAt)
      .filter((item): item is string => Boolean(item))
      .sort()
      .slice(-1)[0] || null;

    let note = "运行态待进一步确认";
    if (total === 0) {
      note = "当前未识别到该类设备。";
    } else if (attention > 0) {
      note = `${formatCountValue(attention)}${zhCN.realtimeStatus.unitTai}存在就地、手动或禁用信号。`;
    } else if (alarm > 0) {
      note = `${formatCountValue(alarm)}${zhCN.realtimeStatus.unitTai}处于报警态。`;
    } else if (runningEstimated) {
      note = `聚合功率 ${formatMetricValue(aggregatePowerKw, 1, "kW", "--")} 显示该链路有负载，单机运行态未回传。`;
    } else if (running > 0) {
      note = `${formatCountValue(running)}${zhCN.realtimeStatus.unitTai}当前参与运行。`;
    } else if (stopped === total) {
      note = "当前采样显示该链路全部停机。";
    }

    return {
      key,
      title: systemTypeTitle(key),
      total,
      running,
      runningDisplay,
      stopped,
      alarm,
      attention,
      runningEstimated,
      latestUpdateAt,
      note
    };
  });
}

const COMFORT_TERMINAL_KEYWORD_PATTERN =
  /(?:\u98ce\u673a\u76d8\u7ba1|\u76d8\u7ba1\u98ce\u673a|\u98ce\u76d8|\u7a7a\u8c03\u7bb1|\u65b0\u98ce|\u672b\u7aef|\u6e29\u6e7f\u5ea6|FCU|FAN\s*COIL|COIL\s*FAN|AIR\s*HANDLING|AHU|TERMINAL)/i;
const COMFORT_TERMINAL_EXCLUDE_PATTERN =
  /(?:\u51b0\u673a|\u51b7\u673a|\u4e3b\u673a|\u51b7\u6c34\u673a\u7ec4|\u5236\u51b7\u673a|\u51b7\u51bb\u6c34\u6cf5|\u51b7\u51bb\u6cf5|\u51b7\u5374\u6c34\u6cf5|\u51b7\u5374\u6cf5|\u70ed\u6c34\u6cf5|\u6c34\u6cf5|\u51b7\u5374\u5854\u98ce\u673a|\u51b7\u5854\u98ce\u673a|\u5854\u98ce\u673a|\u51b7\u5374\u5854|\u51b7\u5854|\u5ba4\u5916|\u5929\u6c14|CHILLER|CHILLED\s*PUMP|COOLING\s*PUMP|WATER\s*PUMP|COOLING\s*TOWER|OUTDOOR|WEATHER|CHP|CWP|CTF)/i;

function isComfortTerminalDevice(item: NonNullable<DeviceListDto["items"]>[number]): boolean {
  const haystack = [
    item.deviceName,
    item.deviceTypeName,
    item.usageType,
    item.deviceCode
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  if (!haystack || COMFORT_TERMINAL_EXCLUDE_PATTERN.test(haystack)) {
    return false;
  }
  return COMFORT_TERMINAL_KEYWORD_PATTERN.test(haystack);
}

function detectComfortTerminalAvailable(deviceList: DeviceListDto | null): boolean {
  return Boolean(deviceList?.items?.some(isComfortTerminalDevice));
}

function buildComfortRooms(
  allConditions: EnvironmentConditionListDto | null,
  cooledConditions: EnvironmentConditionListDto | null
): ComfortRoomView[] {
  const cooledRoomSet = new Set(
    (cooledConditions?.items || [])
      .map((item) => item.monitoringSite?.trim())
      .filter((item): item is string => Boolean(item))
  );

  return (allConditions?.items || [])
    .map((item, index) => {
      const name = item.monitoringSite?.trim() || `空间 ${index + 1}`;
      const temperature = toFiniteNumber(item.temperatureValue);
      const setpoint = toFiniteNumber(item.temperatureSetting);
      const deviationRaw = toFiniteNumber(item.temperatureDeviation);
      const deviation = deviationRaw ?? (temperature != null && setpoint != null ? temperature - setpoint : null);

      return {
        id: `${name}-${index + 1}`,
        name,
        temperature,
        setpoint,
        deviation,
        supplyAir: toFiniteNumber(item.supplyAirValue),
        returnAir: toFiniteNumber(item.returnAirValue),
        cooledAir: cooledRoomSet.has(name)
      };
    })
    .sort((a, b) => Math.abs(b.deviation ?? 0) - Math.abs(a.deviation ?? 0));
}

function comfortTone(value: number | null): Tone {
  const deviation = Math.abs(value ?? 0);
  if (deviation > 2) {
    return "warn";
  }
  if (deviation > 1) {
    return "neutral";
  }
  return "good";
}

function buildRecommendationRoute(item: NonNullable<RecommendationDto["cards"]>[number]): string {
  const category = String(item?.category || item?.ruleId || item?.title || "");
  if (/告警|alarm|anomaly/i.test(category)) {
    return "/alarms";
  }
  if (/场景|control|scene/i.test(category)) {
    return "/scene-control";
  }
  if (/能效|cop|efficiency|delta/i.test(category)) {
    return "/energy-efficiency";
  }
  if (/环境|comfort|temperature/i.test(category)) {
    return "/environment-conditions";
  }
  return "/system-overview";
}

function buildRecommendationScope(item: NonNullable<RecommendationDto["cards"]>[number]): string {
  if ((item?.relatedDevices?.length ?? 0) > 0) {
    return `${DASHBOARD_TEXT.actionRelatedPrefix} ${item?.relatedDevices?.length}${zhCN.realtimeStatus.unitTai}`;
  }
  if (item?.category) {
    return String(item.category);
  }
  return DASHBOARD_TEXT.actionScopeFallback;
}

function mapRecommendations(recommendation: RecommendationDto | null, fallbackReason: string): RecommendationItem[] {
  if (!recommendation || !recommendation.cards || recommendation.cards.length === 0) {
    return [
      {
        id: "rec-empty",
        title: zhCN.dashboard.noActiveRecommendation,
        description: fallbackReason,
        impact: zhCN.dashboard.noActiveRecommendationImpact,
        scope: DASHBOARD_TEXT.actionScopeFallback,
        risk: zhCN.severity.low,
        tone: "good",
        to: "/system-overview"
      }
    ];
  }

  return recommendation.cards.slice(0, 4).map((item, index) => {
    const ruleCopy = getRuleCopy(item.ruleId);
    const risk = getRiskCopy(item.risk);
    const tone = risk.includes(zhCN.severity.high) ? "warn" : risk.includes(zhCN.severity.medium) ? "neutral" : "good";

    return {
      id: item.id || `recommendation-${index + 1}`,
      title: preferChineseText(item.title, ruleCopy?.nameZh || zhCN.dashboard.recommendationTitleFallback),
      description: preferChineseText(
        item.reason || item.evidence?.[0],
        ruleCopy?.descriptionZh || zhCN.dashboard.recommendationReasonFallback
      ),
      impact: preferChineseText(
        item.actions?.[0],
        ruleCopy?.opsAdviceZh || zhCN.dashboard.recommendationActionFallback
      ),
      scope: buildRecommendationScope(item),
      risk,
      tone,
      to: buildRecommendationRoute(item)
    };
  });
}

function buildAnomalyQueue(
  anomalySummary: AnomalySummaryDto | null,
  anomalyList: AnomalyListDto | null
): AnomalyQueueItem[] {
  const baseItems =
    anomalyList?.items && anomalyList.items.length > 0
      ? anomalyList.items.map((item, index) => ({
          id: item.id || `anomaly-${index + 1}`,
          title: getDisplayAnomalyTitle({ title: item.title, regId: item.regId }),
          severity: getSeverityCopy(item.severity || null),
          severityRaw: item.severity || null,
          occurredAt: formatShortDateTime(item.occurredAt),
          occurredAtRaw: item.occurredAt || null,
          source: getDisplayAnomalySource(item.source),
          value: item.value || null
        }))
      : (anomalySummary?.latestEvents || []).map((item, index) => ({
          id: item.id || `anomaly-${index + 1}`,
          title: getDisplayAnomalyTitle({ title: item.title, regId: item.regId }),
          severity: getSeverityCopy(item.severity || null),
          severityRaw: item.severity || null,
          occurredAt: formatShortDateTime(item.occurredAt),
          occurredAtRaw: item.occurredAt || null,
          source: getDisplayAnomalySource(item.source),
          value: item.value || null
        }));

  return baseItems
    .map((item) => {
      const localizedTitle = localizeDashboardAnomalyText(item.title, "高等级告警");
      const localizedSource = localizeDashboardAnomalyText(item.source, "来源待识别");
      const impact = classifyAnomalyImpact(item.title, item.source || undefined);
      return {
        id: item.id,
        title: localizedTitle,
        severity: item.severity,
        tone: toneFromSeverity(item.severityRaw),
        impactLabel: impact.label,
        occurredAt: item.occurredAt,
        source: localizedSource,
        summary: buildDashboardAnomalySummary({
          occurredAt: item.occurredAt,
          source: localizedSource,
          value: item.value
        }),
        to: impact.to,
        _severityRank: severityRank(item.severityRaw),
        _impactRank: impact.rank,
        _occurredAtRaw: item.occurredAtRaw
      };
    })
    .sort((a, b) => a._severityRank - b._severityRank || a._impactRank - b._impactRank || String(b._occurredAtRaw || "").localeCompare(String(a._occurredAtRaw || "")))
    .slice(0, 6)
    .map(({ _severityRank, _impactRank, _occurredAtRaw, ...item }) => item);
}

function deriveVerdict(options: {
  sourceWarn: boolean;
  hasCoreMetrics: boolean;
  criticalCount: number;
  mainLoopAlarmCount: number;
  manualAttentionCount: number;
  comfortRiskCount: number;
  comfortWorstRoom: ComfortRoomView | null;
  currentCop: number | null;
  recommendationCount: number;
  cooledRoomsCount: number;
  totalRoomsCount: number;
}): Verdict {
  if (options.sourceWarn) {
    return {
      title: options.hasCoreMetrics ? DASHBOARD_TEXT.verdictDataSoftTitle : DASHBOARD_TEXT.verdictDataTitle,
      description: options.hasCoreMetrics ? DASHBOARD_TEXT.verdictDataSoftDesc : DASHBOARD_TEXT.verdictDataDesc,
      tone: "neutral",
      focusItems: [
        {
          label: "数据状态",
          value: options.hasCoreMetrics ? "核心值已回传，少量数据待复核" : "当前存在延迟或缺口",
          tone: "neutral",
          hint: options.hasCoreMetrics ? "先看功率、COP 和温差，再补看明细数据。" : "先确认数据稳定，再做值班判断。"
        },
        {
          label: zhCN.appShell.navAlarms,
          value: `${formatCountValue(options.criticalCount)}${zhCN.common.unitItem}高等级异常`,
          tone: options.criticalCount > 0 ? "warn" : "neutral",
          hint: "先确认是否已经影响主链路供冷。"
        },
        {
          label: DASHBOARD_TEXT.actionCenter,
          value: `${formatCountValue(options.recommendationCount)}${zhCN.common.unitItem}待确认建议`,
          tone: "neutral",
          hint: "建议仅作辅助，不替代现场判断。"
        }
      ]
    };
  }

  if (options.criticalCount > 0 || options.mainLoopAlarmCount > 0 || options.manualAttentionCount > 0) {
    return {
      title: DASHBOARD_TEXT.verdictTakeoverTitle,
      description: DASHBOARD_TEXT.verdictTakeoverDesc,
      tone: "warn",
      focusItems: [
        {
          label: zhCN.appShell.navAlarms,
          value: `${formatCountValue(options.criticalCount)}${zhCN.common.unitItem}高等级异常 / ${formatCountValue(options.mainLoopAlarmCount)}${zhCN.realtimeStatus.unitTai}主链路报警`,
          tone: "warn",
          hint: "先看主机、泵组、塔组是否还在连续供冷。"
        },
        {
          label: DASHBOARD_TEXT.controlWatch,
          value: `${formatCountValue(options.manualAttentionCount)}${zhCN.realtimeStatus.unitTai}存在就地、手动或禁用`,
          tone: options.manualAttentionCount > 0 ? "warn" : "neutral",
          hint: "这些设备优先确认是否需要人工接手。"
        },
        {
          label: zhCN.appShell.navSceneControl,
          value: "优先确认主机、泵组、塔组供冷连续性",
          tone: "neutral",
          hint: "先稳住主链路，再回头处理策略细节。"
        }
      ]
    };
  }

  if (options.comfortRiskCount > 0) {
    return {
      title: DASHBOARD_TEXT.verdictComfortTitle,
      description: DASHBOARD_TEXT.verdictComfortDesc,
      tone: "neutral",
      focusItems: [
        {
          label: DASHBOARD_TEXT.comfortOutOfRange,
          value: `${formatCountValue(options.comfortRiskCount)}${zhCN.common.unitItem}`,
          tone: "warn",
          hint: "越限房间优先于一般波动。"
        },
        {
          label: DASHBOARD_TEXT.comfortRank,
          value:
            options.comfortWorstRoom && options.comfortWorstRoom.deviation != null
              ? `${options.comfortWorstRoom.name} ${options.comfortWorstRoom.deviation > 0 ? "+" : ""}${options.comfortWorstRoom.deviation.toFixed(1)}°C`
              : "等待环境点位",
          tone: options.comfortWorstRoom ? comfortTone(options.comfortWorstRoom.deviation) : "neutral",
          hint: "先处理偏差最大的房间。"
        },
        {
          label: DASHBOARD_TEXT.comfortCooledRooms,
          value: formatCountRatioValue(options.cooledRoomsCount, options.totalRoomsCount),
          tone: "neutral",
          hint: "结合供冷覆盖面看舒适风险。"
        }
      ]
    };
  }

  if ((options.currentCop ?? 0) > 0 && options.recommendationCount > 0) {
    return {
      title: DASHBOARD_TEXT.verdictEfficiencyTitle,
      description: DASHBOARD_TEXT.verdictEfficiencyDesc,
      tone: "good",
      focusItems: [
        {
          label: DASHBOARD_TEXT.efficiencyCop,
          value: formatMetricValue(options.currentCop, 2),
          tone: "good",
          hint: "主链路稳定后再看能效更有意义。"
        },
        {
          label: DASHBOARD_TEXT.actionCenter,
          value: `${formatCountValue(options.recommendationCount)}${zhCN.common.unitItem}可执行建议`,
          tone: "neutral",
          hint: "先挑高收益、低风险的动作。"
        },
        {
          label: zhCN.appShell.navEnergyEfficiency,
          value: "优先查看 COP、温差与建议动作",
          tone: "neutral",
          hint: "把值班判断转成优化动作。"
        }
      ]
    };
  }

  return {
    title: DASHBOARD_TEXT.verdictStableTitle,
    description: DASHBOARD_TEXT.verdictStableDesc,
    tone: "good",
    focusItems: [
      {
        label: zhCN.appShell.navSceneControl,
        value: "主链路暂未发现异常或接管信号",
        tone: "good",
        hint: "可以继续保持当前运行策略。"
      },
      {
        label: DASHBOARD_TEXT.comfortCooledRooms,
        value: `${formatCountValue(options.cooledRoomsCount)}${zhCN.common.unitItem}`,
        tone: "neutral",
        hint: "继续跟踪末端覆盖面变化。"
      },
      {
        label: DASHBOARD_TEXT.actionCenter,
        value: `${formatCountValue(options.recommendationCount)}${zhCN.common.unitItem}建议待评估`,
        tone: "neutral",
        hint: "稳定期更适合做能效微调。"
      }
    ]
  };
}

function mapAiDigestTone(tone: string | undefined): Tone {
  if (tone === "positive") {
    return "good";
  }
  if (tone === "danger" || tone === "caution") {
    return "warn";
  }
  return "neutral";
}

function buildAiDigestVerdict(aiDigest: AiDigestDto | null): Verdict | null {
  if (!aiDigest?.summary?.headline && !aiDigest?.summary?.summary) {
    return null;
  }

  const blockers = Array.isArray(aiDigest.blockers) ? aiDigest.blockers : [];
  const risks = Array.isArray(aiDigest.risks) ? aiDigest.risks : [];
  const signals = Array.isArray(aiDigest.signals) ? aiDigest.signals : [];
  const governanceSummary = aiDigest.governance?.summary || "当前没有治理反馈。";
  const nextActionLabel = aiDigest.nextAction?.label || "继续观察";
  const nextActionSummary = aiDigest.nextAction?.summary || "当前没有额外下一步提示。";

  return {
    title: aiDigest.summary?.headline || aiDigest.summary?.label || DASHBOARD_TEXT.verdictStableTitle,
    description: aiDigest.summary?.summary || aiDigest.summary?.headline || DASHBOARD_TEXT.verdictStableDesc,
    tone: mapAiDigestTone(aiDigest.summary?.tone),
    focusItems: [
      {
        label: "运行门槛",
        value: aiDigest.operationsGate?.summary || "当前没有额外门槛提示。",
        tone: aiDigest.operationsGate?.level === "blocked" ? "warn" : mapAiDigestTone(aiDigest.summary?.tone),
        hint: blockers[0]?.message || "先看系统是否允许推进优化。"
      },
      {
        label: "治理状态",
        value: governanceSummary,
        tone: aiDigest.governance?.status === "pending" || aiDigest.governance?.status === "rollback-watch" ? "warn" : "neutral",
        hint: risks[0]?.message || signals[0] || "先看最近治理动作，再决定是否继续推进。"
      },
      {
        label: DASHBOARD_TEXT.actionCenter,
        value: nextActionLabel,
        tone: mapAiDigestTone(aiDigest.summary?.tone),
        hint: nextActionSummary
      }
    ]
  };
}

function cleanDashboardDutyText(value: string): string {
  return value
    .replace(/当前关键数据已陈旧，先核对原始页面或现场，再决定是否发起新一轮优化。?/g, "数据陈旧，先核对现场/原始页。")
    .replace(/最近治理记录进入回退观察/g, "最近治理动作处于回退观察")
    .replace(/治理记录进入回退观察/g, "治理动作处于回退观察")
    .replace(/admin\s+rollback\s+smoke/gi, "人工回退")
    .replace(/rollback\s+smoke/gi, "测试回退")
    .replace(/保守方案回退，待复核链路/g, "治理动作已回退，待复核主链路");
}

export default function DashboardPage() {
  const authSession = getAuthSession();
  const currentProject = getCurrentProject(authSession);
  const activeSiteId = currentProject?.siteId || runtimeConfig.siteId;
  const activeProjectKey =
    currentProject?.modelKey || authSession?.defaultProjectKey || activeSiteId || currentProject?.databaseKey;
  const activeProjectTemplate = currentProject?.template || authSession?.defaultProjectTemplate || "";
  const dashboardProjectScopeKey = `${activeSiteId}|${activeProjectKey || "default"}|${activeProjectTemplate || "default"}`;
  const { aiDigest } = useAiDigest(activeSiteId);
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsDto | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummaryDto | null>(null);
  const [anomalyList, setAnomalyList] = useState<AnomalyListDto | null>(null);
  const [environmentAll, setEnvironmentAll] = useState<EnvironmentConditionListDto | null>(null);
  const [environmentCooled, setEnvironmentCooled] = useState<EnvironmentConditionListDto | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderListDto | null>(null);
  const [, setDeviceSourceStatus] = useState<SourceStatusDto | null>(null);
  const [mainLoopDevices, setMainLoopDevices] = useState<MainLoopDeviceView[]>([]);
  const [comfortTerminalAvailable, setComfortTerminalAvailable] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [, setProjectMode] = useState<ProjectModeView | null>(null);
  const [linkedTrendHoverTime, setLinkedTrendHoverTime] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [refreshFeedbackTick, setRefreshFeedbackTick] = useState(0);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshCountdownSeconds, setRefreshCountdownSeconds] = useState(
    Math.round(DASHBOARD_AUTO_REFRESH_MS / 1000)
  );
  const [, setOverviewSnapshotAt] = useState<string | null>(null);
  const [, setTrendsSnapshotAt] = useState<string | null>(null);
  const [overviewUsingSnapshot, setOverviewUsingSnapshot] = useState(false);
  const [, setOverviewDataUsingSnapshot] = useState(false);
  const [, setTrendsDataUsingSnapshot] = useState(false);
  const latestUsableOverviewRef = useRef<DashboardOverviewDto | null>(null);
  const latestUsableOverviewAtRef = useRef<string | null>(null);
  const latestUsableTrendsRef = useRef<DashboardTrendsDto | null>(null);
  const latestUsableTrendsAtRef = useRef<string | null>(null);
  const dutyMainRef = useRef<HTMLDivElement | null>(null);
  const [comfortCardHeight, setComfortCardHeight] = useState<number | null>(null);

  const {
    recommendation,
    diagnosticHint,
    loading: recommendationLoading,
    loadError: recommendationLoadError
  } = useRecommendationDiagnostics(activeSiteId);

  const fallbackRefreshSeconds = Math.round(
    (loadErrors.includes("overview") || loadErrors.includes("trends")
      ? DASHBOARD_RECOVERY_RETRY_MS
      : DASHBOARD_AUTO_REFRESH_MS) / 1000
  );

  useEffect(() => {
    if (nextRefreshAt == null) {
      setRefreshCountdownSeconds(fallbackRefreshSeconds);
      return;
    }
    const refreshDeadline = nextRefreshAt;

    function syncCountdown() {
      const remainingSeconds = Math.max(0, Math.ceil((refreshDeadline - Date.now()) / 1000));
      setRefreshCountdownSeconds(remainingSeconds);
    }

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [nextRefreshAt, fallbackRefreshSeconds]);

  const refreshCountdownLabel = nextRefreshAt == null ? "刷新中" : `${refreshCountdownSeconds}s`;

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshTimer: number | null = null;
    startTransition(() => {
      setEnvironmentAll(null);
      setEnvironmentCooled(null);
      setComfortTerminalAvailable(false);
    });
    const cachedOverviewSnapshot = readOverviewSnapshot(activeSiteId, dashboardProjectScopeKey);
    if (cachedOverviewSnapshot) {
      latestUsableOverviewRef.current = cachedOverviewSnapshot.overview;
      latestUsableOverviewAtRef.current = cachedOverviewSnapshot.capturedAt;
      startTransition(() => {
        setOverview(cachedOverviewSnapshot.overview);
        setOverviewSnapshotAt(cachedOverviewSnapshot.capturedAt);
        setOverviewUsingSnapshot(true);
        setOverviewDataUsingSnapshot(true);
      });
    } else {
      latestUsableOverviewRef.current = null;
      latestUsableOverviewAtRef.current = null;
      startTransition(() => {
        setOverviewSnapshotAt(null);
        setOverviewUsingSnapshot(false);
        setOverviewDataUsingSnapshot(false);
      });
    }
    const cachedTrendsHistory = readTrendsHistory(activeSiteId, runtimeConfig.trendRange, dashboardProjectScopeKey);
    const cachedTrendsSnapshot = readTrendsSnapshot(activeSiteId, dashboardProjectScopeKey);
    if (cachedTrendsSnapshot) {
      const mergedCachedTrends = mergeTrendsWithLocalHistory(
        cachedTrendsSnapshot.trends,
        cachedTrendsHistory?.series,
        runtimeConfig.trendRange
      );
      latestUsableTrendsRef.current = mergedCachedTrends;
      latestUsableTrendsAtRef.current = cachedTrendsSnapshot.capturedAt;
      startTransition(() => {
        setTrends(mergedCachedTrends);
        setTrendsSnapshotAt(cachedTrendsSnapshot.capturedAt);
        setTrendsDataUsingSnapshot(true);
        setOverviewUsingSnapshot(true);
      });
    } else if (cachedTrendsHistory) {
      const historyOnlyTrends = buildTrendsFromHistory(activeSiteId, cachedTrendsHistory);
      latestUsableTrendsRef.current = historyOnlyTrends;
      latestUsableTrendsAtRef.current = cachedTrendsHistory.capturedAt;
      startTransition(() => {
        setTrends(historyOnlyTrends);
        setTrendsSnapshotAt(cachedTrendsHistory.capturedAt);
        setTrendsDataUsingSnapshot(true);
        setOverviewUsingSnapshot(true);
      });
    } else {
      latestUsableTrendsRef.current = null;
      latestUsableTrendsAtRef.current = null;
      startTransition(() => {
        setTrendsSnapshotAt(null);
        setTrendsDataUsingSnapshot(false);
      });
    }

    function scheduleRefreshWithDelay(delayMs: number) {
      if (!active) {
        return;
      }
      const nextAt = Date.now() + delayMs;
      setNextRefreshAt(nextAt);
      setRefreshCountdownSeconds(Math.max(0, Math.ceil(delayMs / 1000)));
      refreshTimer = window.setTimeout(() => {
        setNextRefreshAt(null);
        void load();
      }, delayMs);
    }

    async function load() {
      if (refreshing) {
        return;
      }
      refreshing = true;
      const failed: string[] = [];
      let buildingId: string | null = null;
      let buildingResult: EnvironmentBuildingListDto | null = null;

      try {
        try {
          buildingResult = await fetchEnvironmentBuildings(activeSiteId);
          const firstBuildingId = String(buildingResult.items?.[0]?.id || "").trim();
          buildingId = firstBuildingId || null;
        } catch {
          failed.push("environment");
        }

        const baseEnvironmentOptions = buildingId ? { buildingId } : {};

        const [
          overviewResult,
          trendsResult,
          anomalySummaryResult,
          anomalyListResult,
          environmentAllResult,
          environmentCooledResult,
          workOrdersResult,
          deviceListResult
        ] = await Promise.allSettled([
          fetchDashboardOverview(activeSiteId),
          fetchDashboardTrends(activeSiteId, runtimeConfig.trendRange),
          fetchAnomalySummary(activeSiteId),
          fetchAnomalyList(activeSiteId, { page: 1, pageSize: 10 }),
          fetchEnvironmentConditions(activeSiteId, { ...baseEnvironmentOptions, cooledAir: "0" }),
          fetchEnvironmentConditions(activeSiteId, { ...baseEnvironmentOptions, cooledAir: "1" }),
          fetchWorkOrders(activeSiteId, { page: 1, pageSize: 5 }),
          fetchDeviceList(activeSiteId, { page: 1, pageSize: 200 })
        ]);

        if (!active) {
          return;
        }

        if (overviewResult.status !== "fulfilled") {
          failed.push("overview");
        }
        if (trendsResult.status !== "fulfilled") {
          failed.push("trends");
        }
        if (anomalySummaryResult.status !== "fulfilled") {
          failed.push("anomalySummary");
        }
        if (anomalyListResult.status !== "fulfilled") {
          failed.push("anomalyList");
        }
        if (environmentAllResult.status !== "fulfilled" && !failed.includes("environment")) {
          failed.push("environment");
        }
        if (workOrdersResult.status !== "fulfilled") {
          failed.push("workOrders");
        }
        if (deviceListResult.status !== "fulfilled") {
          failed.push("devices");
        }

        const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
        const trendsData = trendsResult.status === "fulfilled" ? trendsResult.value : null;
        const anomalySummaryData = anomalySummaryResult.status === "fulfilled" ? anomalySummaryResult.value : null;
        const anomalyListData = anomalyListResult.status === "fulfilled" ? anomalyListResult.value : null;
        let environmentAllData = environmentAllResult.status === "fulfilled" ? environmentAllResult.value : null;
        let environmentCooledData = environmentCooledResult.status === "fulfilled" ? environmentCooledResult.value : null;

        const needEnvironmentRetryWithoutBuildingId =
          Boolean(buildingId) &&
          environmentAllResult.status === "fulfilled" &&
          environmentCooledResult.status === "fulfilled" &&
          (environmentAllData?.items?.length || 0) === 0 &&
          (environmentCooledData?.items?.length || 0) === 0;

        if (needEnvironmentRetryWithoutBuildingId) {
          try {
            const [retryAll, retryCooled] = await Promise.all([
              fetchEnvironmentConditions(activeSiteId, { cooledAir: "0" }),
              fetchEnvironmentConditions(activeSiteId, { cooledAir: "1" })
            ]);
            environmentAllData = retryAll;
            environmentCooledData = retryCooled;
          } catch {
            // Keep initial environment results when retry fails.
          }
        }
        const workOrdersData = workOrdersResult.status === "fulfilled" ? workOrdersResult.value : null;
        const deviceListData = deviceListResult.status === "fulfilled" ? deviceListResult.value : null;
        const liveOverviewAvailable = hasUsableOverviewMetrics(overviewData);
        const liveTrendsAvailable = hasUsableTrendsMetrics(trendsData);
        let mergedTrendsData: DashboardTrendsDto | null = null;
        if (liveOverviewAvailable && overviewData) {
          const snapshotAt = overviewData.generatedAt || new Date().toISOString();
          latestUsableOverviewRef.current = overviewData;
          latestUsableOverviewAtRef.current = snapshotAt;
          writeOverviewSnapshot(activeSiteId, overviewData, snapshotAt, dashboardProjectScopeKey);
        }
        if (liveTrendsAvailable && trendsData) {
          const snapshotAt = trendsData.generatedAt || new Date().toISOString();
          const historyPayload = writeTrendsHistory(
            activeSiteId,
            trendsData,
            snapshotAt,
            runtimeConfig.trendRange,
            dashboardProjectScopeKey
          );
          mergedTrendsData = mergeTrendsWithLocalHistory(
            trendsData,
            historyPayload?.series,
            runtimeConfig.trendRange
          );
          latestUsableTrendsRef.current = mergedTrendsData;
          latestUsableTrendsAtRef.current = snapshotAt;
          writeTrendsSnapshot(activeSiteId, trendsData, snapshotAt, dashboardProjectScopeKey);
        }
        const fallbackOverview =
          !liveOverviewAvailable && hasUsableOverviewMetrics(latestUsableOverviewRef.current)
            ? latestUsableOverviewRef.current
            : null;
        const fallbackOverviewAt = fallbackOverview ? latestUsableOverviewAtRef.current : null;
        const usingSnapshotOverview = Boolean(fallbackOverview && !liveOverviewAvailable);
        const fallbackTrends =
          !liveTrendsAvailable && hasUsableTrendsMetrics(latestUsableTrendsRef.current)
            ? latestUsableTrendsRef.current
            : null;
        const fallbackTrendsAt = fallbackTrends ? latestUsableTrendsAtRef.current : null;
        const usingSnapshotTrends = Boolean(fallbackTrends && !liveTrendsAvailable);

        const mainLoopCatalog =
          (deviceListData?.items || []).filter(
            (item) => item?.deviceId && !item?.isVirtual && isMainLoopSystemType(item.systemType || undefined)
          ) || [];

        let detailBatchResult: Awaited<ReturnType<typeof fetchDeviceDetails>> | null = null;
        try {
          detailBatchResult = await fetchDeviceDetails(
            activeSiteId,
            mainLoopCatalog.map((item) => item?.deviceId || "")
          );
        } catch {
          failed.push("deviceDetails");
        }

        if (!active) {
          return;
        }

        const detailMap = new Map<string, DeviceDetailDto>();
        const detailBatchItems = detailBatchResult?.items || [];
        detailBatchItems.forEach((item) => {
          const deviceId = item?.deviceId || item?.detail?.deviceId || "";
          if (!deviceId) {
            return;
          }
          detailMap.set(deviceId, {
            detail: item?.detail || null,
            freshness: item?.freshness,
            sourceStatus: item?.sourceStatus
          });
        });

        const normalizedDevices = mainLoopCatalog.map((item) =>
          normalizeDeviceView(item, detailMap.get(item?.deviceId || "") || null)
        );
        const nextComfortTerminalAvailable = detectComfortTerminalAvailable(deviceListData);
        const refreshedAt = new Date().toISOString();
        const hasFreshPayload = Boolean(
          overviewData ||
            trendsData ||
            anomalySummaryData ||
            anomalyListData ||
            environmentAllData ||
            environmentCooledData ||
            workOrdersData ||
            deviceListData ||
            detailBatchResult ||
            buildingResult
        );

        startTransition(() => {
          setOverview((previous) => {
            if (liveOverviewAvailable && overviewData) {
              return overviewData;
            }
            if (fallbackOverview) {
              return fallbackOverview;
            }
            return overviewData ?? previous;
          });
          setTrends((previous) => {
            if (liveTrendsAvailable && mergedTrendsData) {
              return mergedTrendsData;
            }
            if (fallbackTrends) {
              return fallbackTrends;
            }
            return mergedTrendsData ?? trendsData ?? previous;
          });
          setAnomalySummary((previous) => anomalySummaryData ?? previous);
          setAnomalyList((previous) => anomalyListData ?? previous);
          setEnvironmentAll((previous) => environmentAllData ?? previous);
          setEnvironmentCooled((previous) => environmentCooledData ?? previous);
          setComfortTerminalAvailable((previous) =>
            deviceListData || environmentAllData || environmentCooledData ? nextComfortTerminalAvailable : previous
          );
          setWorkOrders((previous) => workOrdersData ?? previous);
          setDeviceSourceStatus(
            (previous) =>
              detailBatchResult?.sourceStatus ||
              deviceListData?.sourceStatus ||
              buildingResult?.sourceStatus ||
              previous
          );
          setMainLoopDevices((previous) => (deviceListData && detailBatchResult ? normalizedDevices : previous));
          setLoadErrors(failed);
          setProjectMode((previous) =>
            deviceListData || buildingResult ? detectProjectMode(deviceListData, buildingResult) : previous
          );
          const usingSnapshot = usingSnapshotOverview || usingSnapshotTrends;
          setOverviewUsingSnapshot(usingSnapshot);
          setOverviewDataUsingSnapshot(usingSnapshotOverview);
          setTrendsDataUsingSnapshot(usingSnapshotTrends);
          setOverviewSnapshotAt(usingSnapshotOverview ? fallbackOverviewAt : null);
          setTrendsSnapshotAt(usingSnapshotTrends ? fallbackTrendsAt : null);
          if (hasFreshPayload) {
            setLastRefreshAt(refreshedAt);
            setRefreshFeedbackTick((value) => value + 1);
          }
        });
      } finally {
        refreshing = false;
        scheduleRefreshWithDelay(
          failed.includes("overview") || failed.includes("trends")
            ? DASHBOARD_RECOVERY_RETRY_MS
            : DASHBOARD_AUTO_REFRESH_MS
        );
      }
    }

    void load();
    return () => {
      active = false;
      setNextRefreshAt(null);
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [activeSiteId, dashboardProjectScopeKey, runtimeConfig.trendRange]);

  useLayoutEffect(() => {
    const mainElement = dutyMainRef.current;
    if (!mainElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const syncComfortHeight = () => {
      const nextHeight = Math.round(mainElement.getBoundingClientRect().height);
      setComfortCardHeight((previous) => (previous === nextHeight ? previous : nextHeight));
    };

    syncComfortHeight();
    const observer = new ResizeObserver(syncComfortHeight);
    observer.observe(mainElement);
    window.addEventListener("resize", syncComfortHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncComfortHeight);
    };
  }, []);

  const recommendationItems = recommendationLoading
    ? [
        {
          id: "recommendation-loading",
          title: zhCN.dashboard.sectionRecommendations,
          description: zhCN.dashboard.loadingBff,
          impact: zhCN.dashboard.loadingBff,
          scope: DASHBOARD_TEXT.actionScopeFallback,
          risk: zhCN.severity.unknown,
          tone: "neutral" as Tone,
          to: "/system-overview"
        }
      ]
    : mapRecommendations(
        recommendation,
        recommendationLoadError ? zhCN.dashboard.recommendationEndpointUnavailable : zhCN.dashboard.recommendationEmpty
      );

  const comfortRooms = buildComfortRooms(environmentAll, environmentCooled);
  const monitoredRooms = comfortRooms.filter((item) => item.deviation != null);
  const cooledRoomsCount = comfortRooms.filter((item) => item.cooledAir).length;
  const comfortCompliantCount = monitoredRooms.filter((item) => Math.abs(item.deviation || 0) <= 1).length;
  const comfortRiskCount = monitoredRooms.filter((item) => Math.abs(item.deviation || 0) > 1).length;
  const comfortCompliancePct = monitoredRooms.length > 0 ? (comfortCompliantCount / monitoredRooms.length) * 100 : null;
  const comfortDisplayRooms = comfortRooms;
  const worstComfortRoom = comfortRooms[0] || null;
  const shouldShowComfortResult = comfortTerminalAvailable && comfortRooms.length > 0;

  const mainLoopStages = buildMainLoopStages(overview, mainLoopDevices);
  const manualAttentionDevices = mainLoopDevices.filter((item) => needsManualAttention(item));
  const manualAttentionCount = manualAttentionDevices.length;
  const mainLoopAlarmCount = mainLoopDevices.filter((item) => isAlarmStatus(item.alarmStatusText)).length;
  const runningMainLoopCount = mainLoopStages.reduce((sum, stage) => sum + stage.running, 0);
  const mainLoopTotalCount = mainLoopStages.reduce((sum, stage) => sum + stage.total, 0);
  const processCoverageCount = mainLoopDevices.filter(
    (item) => Boolean(item.runStatusText || item.alarmStatusText || item.controlSignals.length > 0)
  ).length;
  const processCoveragePct =
    mainLoopDevices.length > 0 ? (processCoverageCount / mainLoopDevices.length) * 100 : null;

  const anomalyQueue = buildAnomalyQueue(anomalySummary, anomalyList);
  const criticalCount = (anomalySummary?.counts?.critical ?? 0) + (anomalySummary?.counts?.major ?? 0);
  const currentCop = overview?.energyCards?.currentCop ?? null;
  const totalPower = overview?.energyCards?.totalPowerKw ?? null;
  const totalCoolingCapacity = overview?.energyCards?.totalCoolingCapacity ?? null;
  const chilledDeltaT = overview?.energyCards?.chilledDeltaT ?? null;
  const coolingDeltaT = overview?.energyCards?.coolingDeltaT ?? null;
  const chillerPowerKw = overview?.energyCards?.chillerPowerKw ?? null;
  const chilledPumpPowerKw = overview?.energyCards?.chilledPumpPowerKw ?? null;
  const coolingPumpPowerKw = overview?.energyCards?.coolingPumpPowerKw ?? null;
  const coolingTowerPowerKw = overview?.energyCards?.coolingTowerPowerKw ?? null;
  const chillerCopRaw = overview?.energyCards?.chillerCop ?? null;
  const chilledPumpConveyingCoefficientRaw =
    overview?.energyCards?.chilledPumpConveyingCoefficient ?? null;
  const coolingTowerConveyingCoefficientRaw =
    overview?.energyCards?.coolingTowerConveyingCoefficient ?? null;
  const coolingPumpConveyingCoefficientRaw =
    overview?.energyCards?.coolingPumpConveyingCoefficient ?? null;
  const thermalUnbalanceRate = overview?.energyCards?.thermalUnbalanceRate ?? null;
  const savingPotentialPct = overview?.energyCards?.savingPotentialPct ?? null;
  const chilledSupplyTemp = overview?.energyCards?.chilledSupplyTemp ?? null;
  const coolingReturnTemp = overview?.energyCards?.coolingReturnTemp ?? null;
  const auxiliaryPowerKw = sumNumbers([chilledPumpPowerKw, coolingPumpPowerKw, coolingTowerPowerKw]);
  const chillerCop = chillerCopRaw ?? divideOrNull(totalCoolingCapacity, chillerPowerKw);
  const chilledPumpConveyingCoefficient =
    chilledPumpConveyingCoefficientRaw ?? divideOrNull(totalCoolingCapacity, chilledPumpPowerKw);
  const coolingPumpConveyingCoefficient =
    coolingPumpConveyingCoefficientRaw ?? divideOrNull(totalCoolingCapacity, coolingPumpPowerKw);
  const coolingTowerConveyingCoefficient =
    coolingTowerConveyingCoefficientRaw ?? divideOrNull(totalCoolingCapacity, coolingTowerPowerKw);
  const unitCoolingPower = divideOrNull(totalPower, totalCoolingCapacity);
  const baselinePowerKw =
    isFiniteNumber(totalPower) && isFiniteNumber(savingPotentialPct) && savingPotentialPct < 99
      ? totalPower / (1 - savingPotentialPct / 100)
      : null;
  const baselineCop =
    isFiniteNumber(totalCoolingCapacity) && isFiniteNumber(baselinePowerKw) && baselinePowerKw > 0
      ? totalCoolingCapacity / baselinePowerKw
      : null;
  const copBenchmarkDeltaPct =
    isFiniteNumber(currentCop) && isFiniteNumber(baselineCop) && baselineCop > 0
      ? ((currentCop - baselineCop) / baselineCop) * 100
      : null;
  const savingPowerKw =
    isFiniteNumber(baselinePowerKw) && isFiniteNumber(totalPower) ? Math.max(baselinePowerKw - totalPower, 0) : null;
  const stationCopAssessment = assessThresholdMetric(currentCop, 5, 4.15);
  const chillerCopAssessment = assessThresholdMetric(chillerCop, 5.7, 5.2);
  const chilledPumpAssessment = assessThresholdMetric(chilledPumpConveyingCoefficient, 45.9, 41.7);
  const coolingPumpAssessment = assessThresholdMetric(coolingPumpConveyingCoefficient, 53.5, 48.6);
  const coolingTowerAssessment = assessThresholdMetric(coolingTowerConveyingCoefficient, 108.5, 98.6);
  const heatBalanceAssessment = assessHeatBalanceMetric(thermalUnbalanceRate);
  const recommendationCount = recommendation?.summary?.total ?? Math.max(recommendationItems.filter((item) => item.id !== "rec-empty").length, 0);
  const hasCoreMetrics = [currentCop, totalPower, chilledDeltaT, coolingDeltaT].some((item) => item != null);
  const coreRealtimeUnavailable = loadErrors.includes("overview") || loadErrors.includes("trends");
  const nearIdleSnapshot =
    !coreRealtimeUnavailable &&
    isFiniteNumber(totalPower) &&
    totalPower <= 1 &&
    isFiniteNumber(totalCoolingCapacity) &&
    totalCoolingCapacity === 0 &&
    isFiniteNumber(currentCop) &&
    currentCop <= 0;
  const missingCoolingTelemetry =
    !coreRealtimeUnavailable &&
    isFiniteNumber(totalPower) &&
    totalPower > 1 &&
    isFiniteNumber(totalCoolingCapacity) &&
    totalCoolingCapacity === 0;

  const alarmFeedSource = findSourceEntry(anomalySummary?.sourceStatus, "latestAlarmLog");
  const alarmBannerSourceStatus: SourceStatusDto | null = alarmFeedSource
    ? {
        overall:
          alarmFeedSource.ok && !anomalySummary?.diagnosisFlags?.staleAlarmFeed ? "ok" : "partial",
        sources: [alarmFeedSource]
      }
    : null;
  const coreSourceStatuses = [overview?.sourceStatus, trends?.sourceStatus, alarmBannerSourceStatus];
  const coreSourceWarnActive =
    [overview?.freshness?.stale, trends?.freshness?.stale, anomalySummary?.diagnosisFlags?.staleAlarmFeed].some(Boolean) ||
    coreSourceStatuses.some((item) => hasSourceFailure(item));
  const heroGeneratedAt = formatGeneratedAt(overview?.generatedAt || trends?.generatedAt || workOrders?.generatedAt);

  const localVerdict = deriveVerdict({
    sourceWarn: coreSourceWarnActive,
    hasCoreMetrics,
    criticalCount,
    mainLoopAlarmCount,
    manualAttentionCount,
    comfortRiskCount,
    comfortWorstRoom: worstComfortRoom,
    currentCop,
    recommendationCount,
    cooledRoomsCount,
    totalRoomsCount: comfortRooms.length
  });
  const verdict = buildAiDigestVerdict(aiDigest) || localVerdict;

  const opsRiskRibbonItems: Array<{ key: string; label: string; value: string; tone: Tone; hint: string }> = [
    {
      key: "manual",
      label: DASHBOARD_TEXT.processAttention,
      value: `${formatCountValue(manualAttentionCount)}${zhCN.realtimeStatus.unitTai}`,
      tone: manualAttentionCount > 0 ? "warn" : "good",
      hint: "就地 / 手动 / 禁用等接管信号"
    },
    {
      key: "loopAlarm",
      label: DASHBOARD_TEXT.safetyLoopAlarm,
      value: `${formatCountValue(mainLoopAlarmCount)}${zhCN.realtimeStatus.unitTai}`,
      tone: mainLoopAlarmCount > 0 ? "warn" : "good",
      hint: "主机、泵、塔链路中的告警设备"
    },
    {
      key: "critical",
      label: DASHBOARD_TEXT.safetyHigh,
      value: `${formatCountValue(criticalCount)}${zhCN.common.unitItem}`,
      tone: criticalCount > 0 ? "warn" : "good",
      hint: "高等级异常优先于一般波动"
    },
    {
      key: "source",
      label: DASHBOARD_TEXT.opsSourceStatus,
      value: coreSourceWarnActive ? DASHBOARD_TEXT.opsSourceStatusWarn : DASHBOARD_TEXT.opsSourceStatusOk,
      tone: coreSourceWarnActive ? "warn" : "good",
      hint: `${DASHBOARD_TEXT.opsUpdatedAtHint}${heroGeneratedAt}`
    },
    {
      key: "queue",
      label: "待处理事件",
      value: `${formatCountValue(anomalyQueue.length)}${zhCN.common.unitItem}`,
      tone: anomalyQueue.length > 0 ? "neutral" : "good",
      hint: anomalyQueue.length > 0 ? "按供冷、舒适、运维顺序处理" : "当前没有需要立即跟进的事件"
    }
  ];

  const efficiencyFeaturedCard: OpsMetric = {
    key: "cop",
    label: DASHBOARD_TEXT.efficiencyStationCop,
    value: formatMetricValue(currentCop, 2),
    tone: stationCopAssessment?.tone ?? "neutral",
    hint: "整体能效主指标",
    assessment: stationCopAssessment?.label,
    thresholdHint: "优秀 >= 5.0，良好 >= 4.15",
    isMissing: currentCop == null
  };

  const efficiencyChainCards: OpsMetric[] = [
    {
      key: "chillerCop",
      label: DASHBOARD_TEXT.efficiencyChillerCop,
      value: formatMetricValue(chillerCop, 2, undefined, DASHBOARD_NOT_RETURNED_LABEL),
      tone: chillerCopAssessment?.tone ?? "neutral",
      hint: "主机效率核心值",
      assessment: chillerCopAssessment?.label,
      thresholdHint: "优秀 >= 5.7，良好 >= 5.2",
      stageLabel: "主机段",
      isMissing: chillerCop == null
    },
    {
      key: "chilledPumpCoefficient",
      label: DASHBOARD_TEXT.efficiencyChilledPumpCoefficient,
      value: formatMetricValue(chilledPumpConveyingCoefficient, 2, undefined, DASHBOARD_NOT_RETURNED_LABEL),
      tone: chilledPumpAssessment?.tone ?? "neutral",
      hint: "输送侧效率",
      assessment: chilledPumpAssessment?.label,
      thresholdHint: "优秀 >= 45.9，良好 >= 41.7",
      stageLabel: "冷冻输送",
      isMissing: chilledPumpConveyingCoefficient == null
    },
    {
      key: "coolingPumpCoefficient",
      label: DASHBOARD_TEXT.efficiencyCoolingPumpCoefficient,
      value: formatMetricValue(coolingPumpConveyingCoefficient, 2, undefined, DASHBOARD_NOT_RETURNED_LABEL),
      tone: coolingPumpAssessment?.tone ?? "neutral",
      hint: "输送侧效率",
      assessment: coolingPumpAssessment?.label,
      thresholdHint: "优秀 >= 53.5，良好 >= 48.6",
      stageLabel: "冷却输送",
      isMissing: coolingPumpConveyingCoefficient == null
    },
    {
      key: "coolingTowerCoefficient",
      label: DASHBOARD_TEXT.efficiencyCoolingTowerCoefficient,
      value: formatMetricValue(coolingTowerConveyingCoefficient, 2, undefined, DASHBOARD_NOT_RETURNED_LABEL),
      tone: coolingTowerAssessment?.tone ?? "neutral",
      hint: "散热端效率",
      assessment: coolingTowerAssessment?.label,
      thresholdHint: "优秀 >= 108.5，良好 >= 98.6",
      stageLabel: "散热末端",
      isMissing: coolingTowerConveyingCoefficient == null
    }
  ];

  const efficiencySupportCards: OpsMetric[] = [
    {
      key: "coolingCapacity",
      label: DASHBOARD_TEXT.efficiencyCoolingCapacity,
      value: formatMetricValue(totalCoolingCapacity, 1, "kW"),
      tone: totalCoolingCapacity != null ? "neutral" : "warn",
      hint: "当前系统冷量规模",
      group: "scale",
      isMissing: totalCoolingCapacity == null
    },
    {
      key: "power",
      label: DASHBOARD_TEXT.efficiencyPower,
      value: formatMetricValue(totalPower, 1, "kW"),
      tone: totalPower != null ? "neutral" : "warn",
      hint: `主机 ${formatMetricValue(chillerPowerKw, 1, "kW", DASHBOARD_NOT_RETURNED_LABEL)} · 辅机 ${formatMetricValue(auxiliaryPowerKw, 1, "kW", DASHBOARD_NOT_RETURNED_LABEL)}`,
      group: "scale",
      isMissing: totalPower == null
    },
    {
      key: "delta",
      label: DASHBOARD_TEXT.efficiencyDelta,
      value: formatMetricPairValue(chilledDeltaT, coolingDeltaT, 1, "°C"),
      tone: chilledDeltaT != null || coolingDeltaT != null ? "neutral" : "warn",
      hint: "换热侧关键温差信号",
      group: "diagnostic",
      isMissing: chilledDeltaT == null && coolingDeltaT == null
    },
    {
      key: "chilledSupplyTemp",
      label: "冷冻出水温度",
      value: formatMetricValue(chilledSupplyTemp, 1, "°C", DASHBOARD_NOT_RETURNED_LABEL),
      tone: chilledSupplyTemp != null ? "neutral" : "warn",
      hint: "冷冻侧关键供水温度",
      group: "diagnostic",
      isMissing: chilledSupplyTemp == null
    },
    {
      key: "coolingReturnTemp",
      label: "冷却回水温度",
      value: formatMetricValue(coolingReturnTemp, 1, "°C", DASHBOARD_NOT_RETURNED_LABEL),
      tone: coolingReturnTemp != null ? "neutral" : "warn",
      hint: "冷却侧关键回水温度",
      group: "diagnostic",
      isMissing: coolingReturnTemp == null
    },
    {
      key: "heatBalance",
      label: DASHBOARD_TEXT.efficiencyHeatBalance,
      value: thermalUnbalanceRate != null ? formatMetricValue(thermalUnbalanceRate, 1, "%") : DASHBOARD_PENDING_REVIEW_LABEL,
      tone: heatBalanceAssessment?.tone ?? "neutral",
      hint: thermalUnbalanceRate != null ? "越接近 0 越稳定" : "等待热平衡链路回传",
      assessment: thermalUnbalanceRate != null ? heatBalanceAssessment?.label : undefined,
      thresholdHint: thermalUnbalanceRate != null ? "优秀 |偏差| <= 5%，良好 |偏差| <= 10%" : undefined,
      group: "diagnostic",
      isMissing: thermalUnbalanceRate == null
    }
  ];

  const copTrendCard = buildTrendMetricView(trends, "currentCop", DASHBOARD_TEXT.efficiencyCop, runtimeConfig.trendRange);
  const totalPowerTrendCard = buildTrendMetricView(trends, "totalPowerKw", DASHBOARD_TEXT.efficiencyPower, runtimeConfig.trendRange);
  const featuredCopSpark = copTrendCard
    ? buildSparkModel(copTrendCard.points, runtimeConfig.trendRange, FEATURED_TREND_SPARK_WIDTH, FEATURED_TREND_SPARK_HEIGHT, {
      paddingTop: 10,
      paddingBottom: 18,
        domainValues: [baselineCop, currentCop],
        minDomainSpan: FEATURED_COP_MIN_DOMAIN_SPAN,
        domainPaddingRatio: 0.08
      })
    : buildSparkModel([], runtimeConfig.trendRange, FEATURED_TREND_SPARK_WIDTH, FEATURED_TREND_SPARK_HEIGHT);
  const featuredCopHasFull24hCoverage = hasNearFull24hTrendCoverage(copTrendCard?.points, runtimeConfig.trendRange);
  const loadFluctuationPct =
    totalPowerTrendCard?.max != null && totalPowerTrendCard?.min != null && totalPowerTrendCard.latest
      ? ((totalPowerTrendCard.max - totalPowerTrendCard.min) / totalPowerTrendCard.latest) * 100
      : null;
  const featuredCopDelta = describeTrendDelta(
    copTrendCard?.points,
    2,
    "good",
    runtimeConfig.trendRange === "24h"
      ? featuredCopHasFull24hCoverage
        ? "24小时较昨日"
        : "24小时窗口较起点"
      : `${formatRangeLabel(runtimeConfig.trendRange)}较起点`
  );
  const featuredCopActivePoint = copTrendCard ? findActiveTrendPoint(copTrendCard.points, linkedTrendHoverTime) : null;
  const featuredCopActiveSparkPoint =
    featuredCopSpark.plottedPoints.find((point) => point.time === featuredCopActivePoint?.time) ||
    featuredCopSpark.plottedPoints[featuredCopSpark.plottedPoints.length - 1] ||
    null;
  const featuredCopHoverActive = Boolean(linkedTrendHoverTime && featuredCopActivePoint && featuredCopActiveSparkPoint);
  const featuredCopAxisTicks = buildTrendAxisTicks(
    copTrendCard?.points,
    FEATURED_TREND_SPARK_WIDTH,
    runtimeConfig.trendRange
  );
  const featuredCopValueTicks = buildSparkValueTicks(featuredCopSpark, 1);
  const featuredCopBenchmarkY = projectSparkValueY(featuredCopSpark, baselineCop);
  const featuredCopBenchmarkVisible =
    featuredCopBenchmarkY != null &&
    featuredCopBenchmarkY >= featuredCopSpark.plotTop - 1 &&
    featuredCopBenchmarkY <= featuredCopSpark.plotBottom + 1;
  const copBenchmarkDeltaCopy = isFiniteNumber(copBenchmarkDeltaPct)
    ? `${copBenchmarkDeltaPct >= 0 ? "优于" : "低于"}基准 ${copBenchmarkDeltaPct >= 0 ? "+" : ""}${copBenchmarkDeltaPct.toFixed(1)}%`
    : null;
  const copBenchmarkStatusCopy =
    copBenchmarkDeltaCopy ||
    (!isFiniteNumber(baselineCop)
      ? "缺同工况样本"
      : !isFiniteNumber(currentCop)
        ? "缺实时COP"
        : "基准待复核");
  const featuredCopBadgeTone: Tone =
    isFiniteNumber(copBenchmarkDeltaPct) ? (copBenchmarkDeltaPct >= 0 ? "good" : "warn") : efficiencyFeaturedCard.tone;
  const featuredCopBadgeText =
    copBenchmarkDeltaCopy || efficiencyFeaturedCard.assessment || toneToAssessmentCopy(efficiencyFeaturedCard.tone);
  const featuredCopActiveValue = featuredCopActivePoint?.value ?? currentCop;
  const featuredCopActiveValueLabel = formatMetricValue(featuredCopActiveValue, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, false);
  const featuredCopHoverTimeLabel = featuredCopHoverActive ? formatTrendHoverLabel(featuredCopActivePoint?.time) : "";
  const featuredCopHoverValueLabel = featuredCopHoverActive ? `COP ${featuredCopActiveValueLabel}` : "";
  const featuredCopHoverTooltipWidth = Math.min(
    Math.max(
      featuredCopHoverTimeLabel.length * 4.6 + 18,
      featuredCopHoverValueLabel.length * 7 + 20,
      82
    ),
    140
  );
  const featuredCopHoverTooltipHeight = 30;
  const featuredCopHoverTooltipX = featuredCopHoverActive && featuredCopActiveSparkPoint
    ? Math.min(
        Math.max(featuredCopActiveSparkPoint.x - featuredCopHoverTooltipWidth / 2, 4),
        FEATURED_TREND_SPARK_WIDTH - featuredCopHoverTooltipWidth - 4
      )
    : null;
  const featuredCopHoverTooltipY = featuredCopHoverActive && featuredCopActiveSparkPoint
    ? Math.min(
        Math.max(featuredCopActiveSparkPoint.y - featuredCopHoverTooltipHeight - 8, 4),
        FEATURED_TREND_SPARK_HEIGHT - featuredCopHoverTooltipHeight - 4
      )
    : null;
  const featuredCopBandNote = `当前位于${efficiencyFeaturedCard.assessment || toneToAssessmentCopy(efficiencyFeaturedCard.tone)}区间`;
  const efficiencyScaleCards = [
    ...efficiencySupportCards.filter((item) => item.group === "scale"),
    {
      key: "runningUnits",
      label: DASHBOARD_TEXT.processRunningUnits,
      value: formatCountRatioValue(runningMainLoopCount, mainLoopTotalCount),
      tone: (runningMainLoopCount > 0 ? "good" : "neutral") as Tone,
      hint: DASHBOARD_TEXT.processRunningHint
    },
    {
      key: "coverage",
      label: DASHBOARD_TEXT.opsCoverageSummary,
      value: mainLoopDevices.length > 0 ? formatPercentValue(processCoveragePct, 0) : DASHBOARD_PENDING_REVIEW_LABEL,
      tone:
        (processCoveragePct != null && processCoveragePct < 60
          ? "warn"
          : processCoveragePct != null
            ? "good"
            : "neutral") as Tone,
      hint: `${formatCountRatioValue(processCoverageCount, mainLoopDevices.length)} ${DASHBOARD_TEXT.opsCoverageSummaryHint}`
    }
  ];
  const efficiencyDiagnosticCards = efficiencySupportCards.filter((item) => item.group === "diagnostic");

  const handoverItems: HandoverItem[] = [
    {
      label: DASHBOARD_TEXT.handoverAction,
      value: `${formatCountValue(anomalySummary?.counts?.total ?? anomalyQueue.length)}${zhCN.common.unitItem}`,
      hint: "当前异常与事件待闭环",
      tone: (anomalySummary?.counts?.total ?? 0) > 0 ? "warn" : "good",
      to: "/alarms"
    },
    {
      label: DASHBOARD_TEXT.handoverRecommendation,
      value: `${formatCountValue(recommendation?.summary?.highRisk ?? 0)}${zhCN.common.unitItem}`,
      hint: "需要人工确认的高风险建议",
      tone: (recommendation?.summary?.highRisk ?? 0) > 0 ? "warn" : "neutral",
      to: "/system-overview"
    },
    {
      label: DASHBOARD_TEXT.handoverManual,
      value: `${formatCountValue(manualAttentionCount)}${zhCN.realtimeStatus.unitTai}`,
      hint: "就地 / 手动 / 禁用信号",
      tone: manualAttentionCount > 0 ? "warn" : "good",
      to: "/scene-control"
    },
    {
      label: DASHBOARD_TEXT.handoverWorkOrder,
      value: `${formatCountValue(workOrders?.total ?? 0)}${zhCN.common.unitItem}`,
      hint: "开放工单",
      tone: (workOrders?.total ?? 0) > 0 ? "neutral" : "good",
      to: "/work-orders"
    }
  ];

  const processStageItems = [...mainLoopStages]
    .sort((left, right) => {
      const leftScore = left.attention * 100 + left.alarm * 10 + left.running;
      const rightScore = right.attention * 100 + right.alarm * 10 + right.running;
      return rightScore - leftScore;
    })
    .slice(0, 4);
  const continuitySummary =
    processCoveragePct != null && processCoveragePct < 60
      ? `当前主链路覆盖率仅 ${toPercentOrDash(processCoveragePct, 0)}%，优先补看未纳入连续性判断的设备。`
      : mainLoopAlarmCount > 0
        ? `主链路里有 ${formatCountValue(mainLoopAlarmCount)} 台设备处于告警态，建议先看对应阶段卡再下钻明细。`
        : `主链路当前运行 ${formatCountRatioValue(runningMainLoopCount, mainLoopTotalCount)} 台设备，连续性整体稳定。`;

  const refreshMetaItems = [
    {
      key: "auto-refresh",
      className: "is-info",
      value: coreRealtimeUnavailable
        ? `每${Math.round(DASHBOARD_RECOVERY_RETRY_MS / 1000)}秒自动重试（${refreshCountdownLabel}）`
        : `每${Math.round(DASHBOARD_AUTO_REFRESH_MS / 1000)}秒自动刷新（${refreshCountdownLabel}）`
    },
    lastRefreshAt
      ? {
          key: `refreshed-${refreshFeedbackTick}`,
          className: "is-info is-refresh-flash",
          value: `刚刷新 ${formatClockTime(lastRefreshAt)}`
        }
      : null
  ].filter((item): item is { key: string; className: string; value: string } => Boolean(item));
  const actionCenterHint = cleanDashboardDutyText(aiDigest?.nextAction?.summary || "先查看控制边界，再进入优化复核");

  const efficiencyStatusNote = coreRealtimeUnavailable
    ? {
        tone: "warn" as Tone,
        title: zhCN.dashboard.opsCoreUnavailable,
        hint: zhCN.dashboard.opsCoreUnavailableHint.replace(
          "{seconds}",
          String(Math.round(DASHBOARD_RECOVERY_RETRY_MS / 1000))
        )
      }
    : nearIdleSnapshot
      ? {
          tone: "neutral" as Tone,
          title: zhCN.dashboard.opsIdleSnapshot,
          hint: zhCN.dashboard.opsIdleSnapshotHint
        }
      : missingCoolingTelemetry
        ? {
            tone: "warn" as Tone,
            title: zhCN.dashboard.opsCoolingMissing,
            hint: zhCN.dashboard.opsCoolingMissingHint
          }
        : null;
  const dutyConclusionTitle = cleanDashboardDutyText(efficiencyStatusNote?.title || verdict.title);
  const dutyConclusionHint = cleanDashboardDutyText(efficiencyStatusNote?.hint || verdict.description);

  const chainMetricByKey = new Map(efficiencyChainCards.map((item) => [item.key, item]));
  const scaleMetricByKey = new Map(efficiencyScaleCards.map((item) => [item.key, item]));
  const diagnosticMetricByKey = new Map(efficiencyDiagnosticCards.map((item) => [item.key, item]));
  const stageByKey = new Map(mainLoopStages.map((stage) => [stage.key, stage]));
  const chillerStage = stageByKey.get("chiller");
  const chilledPumpStage = stageByKey.get("chilledPump");
  const coolingPumpStage = stageByKey.get("coolingPump");
  const coolingTowerStage = stageByKey.get("coolingTower");
  const outdoorTemp = overview?.energyCards?.outdoorTempC ?? null;
  const outdoorWetBulb = overview?.energyCards?.outdoorWetBulbC ?? null;
  const outdoorHumidity = overview?.energyCards?.outdoorHumidityPct ?? null;
  const chilledReturnTemp =
    isFiniteNumber(chilledSupplyTemp) && isFiniteNumber(chilledDeltaT) ? chilledSupplyTemp + chilledDeltaT : null;
  const coolingTowerOutletTemp = isFiniteNumber(coolingReturnTemp) ? coolingReturnTemp : null;
  const coolingTowerInletTemp =
    isFiniteNumber(coolingTowerOutletTemp) && isFiniteNumber(coolingDeltaT) ? coolingTowerOutletTemp + coolingDeltaT : null;
  const coolingApproachMeasurement = resolveTowerApproachMeasurement(coolingTowerOutletTemp, outdoorWetBulb);
  const coolingApproach = coolingApproachMeasurement.value;
  const coolingApproachDisplay =
    coolingApproachMeasurement.rawValue !== null && !coolingApproachMeasurement.plausible
      ? "异常"
      : formatTemperatureValue(coolingApproach);
  const compactCoolingApproachDisplay =
    coolingApproachMeasurement.rawValue !== null && !coolingApproachMeasurement.plausible
      ? "异常"
      : formatTemperatureValue(coolingApproach, 1, "--");
  const outdoorBoundarySummary =
    !isFiniteNumber(outdoorWetBulb) && !isFiniteNumber(outdoorTemp) && coolingApproachMeasurement.rawValue === null
      ? "湿球/干球/接近未传回"
      : `湿球${formatTemperatureValue(outdoorWetBulb)} · 干球${formatTemperatureValue(outdoorTemp)} · 接近${coolingApproachDisplay}`;
  const coolingApproachLow = isFiniteNumber(coolingApproach) && coolingApproach < 3;
  const coolingApproachHigh = isFiniteNumber(coolingApproach) && coolingApproach > 4.5;
  const coolingApproachOutOfBand = coolingApproachLow || coolingApproachHigh;
  const coolingApproachConstraintText = coolingApproachLow
    ? "接近度偏低，不加塔/不增风机"
    : coolingApproachHigh
      ? "接近度偏高，复核塔泵协同"
      : "塔侧边界正常";
  const activeAlarmCount =
    anomalySummary?.counts?.total ??
    overview?.energyCards?.activeAnomalyCount ??
    overview?.alarmSummary?.total ??
    anomalyQueue.length;
  const activeEventCount = anomalyQueue.length;
  const p2AlarmCount = overview?.alarmSummary?.medium ?? Math.max(activeAlarmCount - criticalCount, 0);
  const dataIssueCount = loadErrors.length + (overviewUsingSnapshot ? 1 : 0);
  const dataAbnormalCount = coreSourceWarnActive ? 1 : 0;
  const serviceChainWarnActive =
    coreRealtimeUnavailable || overviewUsingSnapshot || coreSourceWarnActive || Boolean(recommendationLoadError);
  const serviceChainLabel = coreRealtimeUnavailable
    ? "主链路重试"
    : recommendationLoadError
      ? "建议链路降级"
      : overviewUsingSnapshot
        ? "快照兜底"
        : coreSourceWarnActive
          ? "来源待复核"
          : "链路正常";
  const dataIntegrityValue = mainLoopDevices.length > 0
    ? formatPercentValue(processCoveragePct, 0)
    : coreSourceWarnActive
      ? "需复核"
      : "可用";
  const riskHighestLevelLabel =
    criticalCount > 0
      ? "高"
      : activeAlarmCount > 0 || activeEventCount > 0 || manualAttentionCount > 0
        ? "中"
        : "低";
  const autoRemoteCount = mainLoopDevices.filter((device) =>
    device.controlSignals.some((signal) => /自动|远程/.test(`${signal.label}${signal.value}`))
  ).length;
  const localManualCount = manualAttentionCount;
  const faultIsolationCount = mainLoopAlarmCount;
  const inefficientAreaCount = [
    chilledPumpAssessment?.tone === "warn",
    coolingPumpAssessment?.tone === "warn",
    coolingTowerAssessment?.tone === "warn",
    heatBalanceAssessment?.tone === "warn"
  ].filter(Boolean).length;
  const stageSummaryItems = processStageItems.length > 0 ? processStageItems : mainLoopStages.slice(0, 4);
  const lowEfficiencyScopeText =
    inefficientAreaCount > 0 ? `${stageSummaryItems[0]?.title || "泵/塔协同"}待复核` : "无低效设备";
  const boundaryAttentionCount = inefficientAreaCount + (coolingApproachOutOfBand ? 1 : 0);
  const boundaryAttentionScopeText = coolingApproachOutOfBand ? coolingApproachConstraintText : lowEfficiencyScopeText;
  const returnCoverageReady = mainLoopDevices.length > 0 && isFiniteNumber(processCoveragePct);
  const returnCoverageComplete = returnCoverageReady && (processCoveragePct ?? 0) >= 95;
  const returnCoverageStatus = returnCoverageComplete ? "完整" : "待复核";
  const returnCoverageTone: Tone = returnCoverageComplete ? "good" : "neutral";
  const returnCoverageValue = returnCoverageReady ? formatPercentValue(processCoveragePct, 0) : DASHBOARD_PENDING_REVIEW_LABEL;
  const returnCoverageNote = returnCoverageReady
    ? `${formatCountRatioValue(processCoverageCount, mainLoopDevices.length)}在线`
    : "状态待回传";

  const resolveStageStatus = (stage: MainLoopStageView | undefined): { text: string; tone: Tone } => {
    if (!stage) {
      return { text: DASHBOARD_PENDING_REVIEW_LABEL, tone: "neutral" };
    }
    if (stage.alarm > 0) {
      return { text: "告警", tone: "warn" };
    }
    if (stage.attention > 0) {
      return { text: "待确认", tone: "warn" };
    }
    if (stage.running > 0) {
      return { text: "运行", tone: "good" };
    }
    return { text: "待确认", tone: "neutral" };
  };

  const resolveStageControlValue = (systemType: SystemType, fallback: string): string => {
    const group = mainLoopDevices.filter((device) => device.systemType === systemType);
    const frequencySignal = group
      .flatMap((device) => device.controlSignals)
      .find((signal) => {
        const keyLabel = `${signal.key}${signal.label}`;
        const value = `${signal.value || ""}`.trim();
        if (!value || !/\d/.test(value) || /模式|状态|mode|status/i.test(keyLabel)) {
          return false;
        }
        return /频率|频次|freq|hz/i.test(keyLabel) || /hz|赫兹|rpm|r\/min/i.test(value);
      });
    if (frequencySignal?.value) {
      return frequencySignal.value;
    }
    return fallback;
  };

  const resolveStageShortNote = (stage: MainLoopStageView | undefined, fallback: string): string => {
    if (!stage) {
      return fallback;
    }
    if (stage.alarm > 0) {
      return `${formatCountValue(stage.alarm)}台告警`;
    }
    if (stage.attention > 0) {
      return `${formatCountValue(stage.attention)}台需确认`;
    }
    if (stage.runningEstimated) {
      return "估算运行";
    }
    return fallback;
  };

  const resolveStageSubline = (systemType: SystemType, stage: MainLoopStageView | undefined, fallback: string): string => {
    const ratio = formatCountRatioValue(stage?.running, stage?.total);
    const controlValue = resolveStageControlValue(systemType, ratio);
    const shortNote = resolveStageShortNote(stage, fallback);
    return controlValue === ratio ? shortNote : `${ratio} · ${shortNote}`;
  };

  const renderValueParts = (value: string, className = "dashboard-cockpit-value") => {
    const parts = splitMetricDisplay(value);
    return (
      <strong className={className}>
        <bdi>{parts.main}</bdi>
        {parts.unit ? <em>{parts.unit}</em> : null}
      </strong>
    );
  };

  const recommendationPrimary = recommendationItems[0];
  const recommendationFallbackText = "AI仅输出建议值，人工审批后由 PLC 安全边界决定是否执行。";
  const isRecommendationPending = recommendationPrimary?.id === "recommendation-loading";
  const hasExecutableRecommendation = Boolean(recommendationPrimary && recommendationPrimary.id !== "rec-empty" && !isRecommendationPending);
  const aiApprovalStateText = isRecommendationPending ? "建议同步中" : hasExecutableRecommendation ? "待审批" : "无待审建议";
  const aiApprovalTone: Tone = hasExecutableRecommendation ? "warn" : "good";
  const aiBadgeText = hasExecutableRecommendation ? "AI建议待审批" : isRecommendationPending ? "AI建议同步" : "AI观察中";
  const aiSuggestionText =
    isRecommendationPending
      ? "建议服务同步中，保持当前控制边界。"
      : hasExecutableRecommendation
      ? recommendationPrimary.impact
      : recommendationFallbackText;
  const aiBenefitText =
    isFiniteNumber(savingPowerKw) || isFiniteNumber(savingPotentialPct)
      ? `预计节能潜力 ${formatMetricValue(savingPowerKw, 1, "kW", "--")} / ${formatPercentValue(savingPotentialPct, 1, "--")}`
      : isRecommendationPending
        ? "节能测算待回传"
        : hasExecutableRecommendation
        ? recommendationPrimary?.description || "等待优化建议与节能测算回传。"
        : "暂无可执行建议";
  const aiRiskText = isRecommendationPending ? "待评估" : hasExecutableRecommendation ? recommendationPrimary?.risk || "待班长确认" : "低";
  const aiPriorityActionText = actionCenterHint || aiSuggestionText;
  const aiBoundaryActionLabel = "查看控制边界";
  const aiReviewActionLabel = hasExecutableRecommendation ? "复核待审建议" : "进入优化复核";
  const aiReviewActionClassName = `dashboard-cockpit-action-button ${hasExecutableRecommendation ? "is-primary" : "is-secondary"}`;
  const aiStateCards = [
    { label: "输出边界", value: "仅建议值", tone: "good" as Tone },
    { label: "审批状态", value: aiApprovalStateText, tone: aiApprovalTone },
    { label: "预计收益", value: aiBenefitText, tone: "neutral" as Tone },
    { label: "风险等级", value: aiRiskText, tone: recommendationPrimary?.tone === "warn" ? "warn" as Tone : "good" as Tone }
  ];
  const buildSiteScopedRoute = (route: string): string => {
    if (!route.startsWith("/") || route.includes("siteId=")) {
      return route;
    }
    return `${route}${route.includes("?") ? "&" : "?"}siteId=${encodeURIComponent(activeSiteId)}`;
  };
  const emptyAlarmItem: AnomalyQueueItem = {
    id: "empty",
    severity: "低",
    title: "当前无高优先级告警",
    impactLabel: "值班",
    tone: "good",
    to: "/alarms",
    occurredAt: "",
    source: null,
    summary: "观察主链路与接管信号"
  };
  const topAlarmRows = (anomalyQueue.length > 0 ? anomalyQueue : [emptyAlarmItem]).reduce<
    Array<AnomalyQueueItem & { repeatCount: number }>
  >((rows, item) => {
    const existing = rows.find(
      (row) => row.title === item.title && row.severity === item.severity && row.impactLabel === item.impactLabel
    );
    if (existing) {
      existing.repeatCount += 1;
      return rows;
    }
    if (rows.length < 3) {
      rows.push({ ...item, repeatCount: 1 });
    }
    return rows;
  }, []);
  const diagnosticDutyText =
    !recommendationLoading && diagnosticHint !== zhCN.diagnostics.loading
      ? diagnosticHint
      : aiDigest?.governance?.summary || "治理诊断待回传，保持人工复核";
  const handoverRows = [
    {
      label: "15:23",
      text: dataIssueCount > 0 ? `数据刷新完成，缺测${dataIssueCount}项` : "数据刷新完成",
      status: dataIssueCount > 0 ? "复核" : "正常",
      tone: dataIssueCount > 0 ? "warn" : "good"
    },
    {
      label: "AI",
      text: cleanDashboardDutyText(diagnosticDutyText),
      status: "复核",
      tone: "warn"
    },
    {
      label: "交接",
      text: handoverItems[0]?.hint || "运行覆盖率维持当前状态",
      status: handoverItems[0]?.value || "稳定",
      tone: handoverItems[0]?.tone || "good"
    }
  ];

  void toFixedOrDash;
  void formatCountDisplayValue;
  void formatDeviationValue;
  void TrendSparkCard;
  void comfortCompliancePct;
  void comfortDisplayRooms;
  void shouldShowComfortResult;
  void opsRiskRibbonItems;
  void continuitySummary;

  return (
    <div
      className="dashboard-duty dashboard-cockpit-v2 page-enter"
      data-main-height={comfortCardHeight ?? undefined}
    >
      <header className="dashboard-cockpit-topbar">
        <div className="dashboard-cockpit-title-row">
          <h1>能源站值班驾驶舱</h1>
          <span className="dashboard-cockpit-badge is-good">云端实时</span>
          <span className={`dashboard-cockpit-badge ${aiApprovalTone === "warn" ? "is-warn" : "is-good"}`}>{aiBadgeText}</span>
          <span className="dashboard-cockpit-badge">PLC保护在线</span>
        </div>
        <div className="dashboard-cockpit-toolbar">
          <span className="dashboard-cockpit-badge">{heroGeneratedAt}</span>
          {refreshMetaItems.map((item) => (
            <span key={item.key} className={`dashboard-cockpit-badge ${item.className}`}>
              {item.value.replace(/^每/, "").replace(/自动/, "")}
            </span>
          ))}
        </div>
      </header>

      <section className="dashboard-cockpit-status-strip">
        <article className="dashboard-cockpit-status">
          <span>值班结论</span>
          <strong>{dutyConclusionTitle}</strong>
          <small>{dutyConclusionHint}</small>
        </article>
        <article className="dashboard-cockpit-status">
          <span>室外工况边界</span>
          <strong>{outdoorBoundarySummary}</strong>
          <small>湿度 {formatPercentValue(outdoorHumidity, 0)} · 塔控按接近度约束</small>
        </article>
        <article className="dashboard-cockpit-status">
          <span>风险与本地接管</span>
          <strong className={activeAlarmCount > 0 || activeEventCount > 0 || manualAttentionCount > 0 ? "is-warn" : "is-good"}>
            P1 {formatCountValue(criticalCount)}项 · 告警{formatCountValue(activeAlarmCount)}条 · 事件{formatCountValue(activeEventCount)}项
          </strong>
          <small>最高 {riskHighestLevelLabel} · 本地/手动 {formatCountValue(manualAttentionCount)}台</small>
        </article>
        <article className="dashboard-cockpit-status">
          <span>数据完整率</span>
          <strong className={serviceChainWarnActive ? "is-warn" : "is-good"}>{dataIntegrityValue}</strong>
          <small>链路 {serviceChainLabel} · 缺测{formatCountValue(dataIssueCount, "0")} · 异常{formatCountValue(dataAbnormalCount, "0")}</small>
        </article>
      </section>

      <section className="dashboard-cockpit-kpis">
        <article className="dashboard-cockpit-kpi">
          <span>冷站COP</span>
          {renderValueParts(efficiencyFeaturedCard.value)}
          <small>{featuredCopDelta ? `${featuredCopDelta.label} ${featuredCopDelta.value}` : featuredCopBandNote}</small>
        </article>
        <article className="dashboard-cockpit-kpi">
          <span>节能复核状态</span>
          {renderValueParts(formatPercentValue(savingPotentialPct, 1))}
          <small>{isFiniteNumber(savingPowerKw) ? `较基线省功率 ${formatMetricValue(savingPowerKw, 1, "kW")}` : copBenchmarkStatusCopy}</small>
        </article>
        <article className="dashboard-cockpit-kpi">
          <span>总制冷量</span>
          {renderValueParts(scaleMetricByKey.get("coolingCapacity")?.value || formatMetricValue(totalCoolingCapacity, 1, "kW"))}
          <small>{scaleMetricByKey.get("coolingCapacity")?.hint || "负荷规模"}</small>
        </article>
        <article className="dashboard-cockpit-kpi">
          <span>总站功率</span>
          {renderValueParts(scaleMetricByKey.get("power")?.value || formatMetricValue(totalPower, 1, "kW"))}
          <small>{scaleMetricByKey.get("power")?.hint || `主机 ${formatMetricValue(chillerPowerKw, 1, "kW", "--")}`}</small>
        </article>
        <article className="dashboard-cockpit-kpi">
          <span>主链路运行</span>
          {renderValueParts(formatCountRatioValue(runningMainLoopCount, mainLoopTotalCount))}
          <small>远程 {formatCountValue(autoRemoteCount)}台 · 本地/手动 {formatCountValue(localManualCount)}台</small>
        </article>
        <article className="dashboard-cockpit-kpi">
          <span>告警 / 事件</span>
          {renderValueParts(`${formatCountValue(activeAlarmCount)} / ${formatCountValue(activeEventCount)}`, `dashboard-cockpit-value ${activeAlarmCount > 0 || activeEventCount > 0 ? "is-warn" : "is-good"}`)}
          <small>P1 {formatCountValue(criticalCount)} · P2 {formatCountValue(p2AlarmCount)} · 事件 {formatCountValue(activeEventCount)}</small>
        </article>
      </section>

      <section className="dashboard-cockpit-workbench" ref={dutyMainRef}>
        <article className="dashboard-cockpit-panel dashboard-cockpit-trend">
          <div className="dashboard-cockpit-panel-head">
            <h2>冷站COP趋势与对标</h2>
            <span className={`dashboard-cockpit-badge ${featuredCopBadgeTone === "good" ? "is-good" : featuredCopBadgeTone === "warn" ? "is-warn" : ""}`}>
              {featuredCopBadgeText}
            </span>
          </div>
          <div className="dashboard-cockpit-panel-body">
            <div className="dashboard-cockpit-chart">
              {featuredCopSpark.path ? (
                <svg
                  viewBox={`0 0 ${FEATURED_TREND_SPARK_WIDTH} ${FEATURED_TREND_SPARK_HEIGHT}`}
                  preserveAspectRatio="none"
                  onMouseMove={(event) => {
                    const nearestPoint = pickNearestSparkPoint(
                      featuredCopSpark.plottedPoints,
                      event.clientX,
                      event.currentTarget.getBoundingClientRect(),
                      FEATURED_TREND_SPARK_WIDTH
                    );
                    if (nearestPoint?.time) {
                      startTransition(() => setLinkedTrendHoverTime(nearestPoint.time));
                    }
                  }}
                  onMouseLeave={() => setLinkedTrendHoverTime(null)}
                >
                  {featuredCopValueTicks.map((item) => (
                    <g key={`cop-y-${item.label}`}>
                      <line className="dashboard-cockpit-axis-grid" x1={0} x2={FEATURED_TREND_SPARK_WIDTH} y1={item.y} y2={item.y} />
                      <text className="dashboard-cockpit-axis-y" x={8} y={Math.max(item.y - 3, 9)}>
                        {item.label}
                      </text>
                    </g>
                  ))}
                  {featuredCopBenchmarkVisible && featuredCopBenchmarkY != null ? (
                    <g>
                      <line className="dashboard-cockpit-target-line" x1={0} x2={FEATURED_TREND_SPARK_WIDTH} y1={featuredCopBenchmarkY} y2={featuredCopBenchmarkY} />
                      <text className="dashboard-cockpit-target-label" x={FEATURED_TREND_SPARK_WIDTH - 8} y={Math.max(featuredCopBenchmarkY - 4, 9)} textAnchor="end">
                        同负荷基准 {formatMetricValue(baselineCop, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, false)}
                      </text>
                    </g>
                  ) : null}
                  {featuredCopSpark.leadPath ? <path className="dashboard-cockpit-trend-lead" d={featuredCopSpark.leadPath} /> : null}
                  <path className="dashboard-cockpit-trend-line" d={featuredCopSpark.path} />
                  {featuredCopAxisTicks.map((item, index) => (
                    <text
                      key={`${item.label}-${index}`}
                      className="dashboard-cockpit-axis-x"
                      x={Math.min(Math.max(item.x, 28), FEATURED_TREND_SPARK_WIDTH - 28)}
                      y={FEATURED_TREND_SPARK_HEIGHT - 5}
                      textAnchor={index === 0 ? "start" : index === featuredCopAxisTicks.length - 1 ? "end" : "middle"}
                    >
                      {item.label}
                    </text>
                  ))}
                  {featuredCopActiveSparkPoint ? (
                    <>
                      {featuredCopHoverActive ? (
                        <line
                          className="dashboard-cockpit-hover-line"
                          x1={featuredCopActiveSparkPoint.x}
                          x2={featuredCopActiveSparkPoint.x}
                          y1={featuredCopSpark.plotTop}
                          y2={featuredCopSpark.plotBottom}
                        />
                      ) : null}
                      {featuredCopHoverActive ? (
                        <circle className="dashboard-cockpit-trend-current" cx={featuredCopActiveSparkPoint.x} cy={featuredCopActiveSparkPoint.y} r={2} />
                      ) : null}
                      {featuredCopHoverActive && featuredCopHoverTooltipX != null && featuredCopHoverTooltipY != null ? (
                        <g className="dashboard-cockpit-hover-tooltip">
                          <rect
                            x={featuredCopHoverTooltipX}
                            y={featuredCopHoverTooltipY}
                            width={featuredCopHoverTooltipWidth}
                            height={featuredCopHoverTooltipHeight}
                            rx={3}
                          />
                          <text
                            className="dashboard-cockpit-hover-tooltip-time"
                            x={featuredCopHoverTooltipX + featuredCopHoverTooltipWidth / 2}
                            y={featuredCopHoverTooltipY + 10}
                            textAnchor="middle"
                          >
                            {featuredCopHoverTimeLabel}
                          </text>
                          <text
                            className="dashboard-cockpit-hover-tooltip-value"
                            x={featuredCopHoverTooltipX + featuredCopHoverTooltipWidth / 2}
                            y={featuredCopHoverTooltipY + 24}
                            textAnchor="middle"
                          >
                            {featuredCopHoverValueLabel}
                          </text>
                        </g>
                      ) : null}
                    </>
                  ) : null}
                </svg>
              ) : (
                <p className="empty-hint">{DASHBOARD_TEXT.trendEmpty}</p>
              )}
            </div>
            <div className="dashboard-cockpit-trend-facts">
              <article>
                <span>当前COP</span>
                <strong>{formatMetricValue(currentCop, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, false)}</strong>
                <small>单位电耗 {formatMetricValue(unitCoolingPower, 3, "kW/kW", "--", false)}</small>
              </article>
              <article>
                <span>同负荷基准</span>
                <strong>{formatMetricValue(baselineCop, 2, undefined, DASHBOARD_PENDING_REVIEW_LABEL, false)}</strong>
                <small>{copBenchmarkStatusCopy}</small>
              </article>
              <article>
                <span>负荷波动</span>
                <strong>{formatPercentValue(loadFluctuationPct, 1)}</strong>
                <small>{isFiniteNumber(loadFluctuationPct) && loadFluctuationPct > 20 ? "负荷波动偏大，需按同工况对标" : "负荷波动可控"}</small>
              </article>
            </div>
          </div>
        </article>

        <article className="dashboard-cockpit-panel dashboard-cockpit-chain">
          <div className="dashboard-cockpit-panel-head">
            <h2>设备控制链路</h2>
            <span className="dashboard-cockpit-badge">蓝：冷冻水 · 绿：冷却水</span>
          </div>
          <div className="dashboard-cockpit-panel-body">
            <div className="dashboard-cockpit-flow">
              <div className="dashboard-cockpit-water-tag is-chilled">冷冻供/回 {formatTemperatureValue(chilledSupplyTemp, 1, "--")}/{formatTemperatureValue(chilledReturnTemp, 1, "--")} · ΔT {formatMetricValue(chilledDeltaT, 1, "°C", "--")}</div>
              <div className="dashboard-cockpit-water-tag is-cooling">冷却出/进 {formatTemperatureValue(coolingTowerOutletTemp, 1, "--")}/{formatTemperatureValue(coolingTowerInletTemp, 1, "--")} · 接近 {compactCoolingApproachDisplay}</div>
              <article className="dashboard-cockpit-equip is-chiller">
                <b>冷机 <span className={`tone-${resolveStageStatus(chillerStage).tone}`}>{resolveStageStatus(chillerStage).text}</span></b>
                <strong>{formatCountRatioValue(chillerStage?.running, chillerStage?.total)}</strong>
                <small>主机COP {chainMetricByKey.get("chillerCop")?.value || "--"}</small>
              </article>
              <article className="dashboard-cockpit-equip is-cooling-pump">
                <b>冷却泵 <span className={`tone-${resolveStageStatus(coolingPumpStage).tone}`}>{resolveStageStatus(coolingPumpStage).text}</span></b>
                <strong>{resolveStageControlValue("coolingPump", formatCountRatioValue(coolingPumpStage?.running, coolingPumpStage?.total))}</strong>
                <small>{resolveStageSubline("coolingPump", coolingPumpStage, "协同")}</small>
              </article>
              <article className="dashboard-cockpit-equip is-tower">
                <b>冷却塔 <span className={`tone-${resolveStageStatus(coolingTowerStage).tone}`}>{resolveStageStatus(coolingTowerStage).text}</span></b>
                <strong>{resolveStageControlValue("coolingTower", formatCountRatioValue(coolingTowerStage?.running, coolingTowerStage?.total))}</strong>
                <small>{resolveStageSubline("coolingTower", coolingTowerStage, "风机")}</small>
              </article>
              <article className="dashboard-cockpit-equip is-load">
                <b>负荷侧 <span className="tone-good">稳定</span></b>
                <strong>{formatMetricValue(totalCoolingCapacity, 0, "kW")}</strong>
                <small>覆盖 {formatPercentValue(processCoveragePct, 0)}</small>
              </article>
              <article className="dashboard-cockpit-equip is-chilled-pump">
                <b>冷冻泵 <span className={`tone-${resolveStageStatus(chilledPumpStage).tone}`}>{resolveStageStatus(chilledPumpStage).text}</span></b>
                <strong>{resolveStageControlValue("chilledPump", formatCountRatioValue(chilledPumpStage?.running, chilledPumpStage?.total))}</strong>
                <small>{resolveStageSubline("chilledPump", chilledPumpStage, "ΔP待接入")}</small>
              </article>
              <article className="dashboard-cockpit-equip is-return">
                <b>回传 <span className={`tone-${returnCoverageTone}`}>{returnCoverageStatus}</span></b>
                <strong>{returnCoverageValue}</strong>
                <small>{returnCoverageNote}</small>
              </article>
            </div>
            <div className="dashboard-cockpit-control-row">
              <article><span>远程权限</span><strong>{formatCountValue(autoRemoteCount)}台</strong><small>远程/自动</small></article>
              <article><span>本地/手动</span><strong>{formatCountValue(localManualCount)}台</strong><small>人工确认</small></article>
              <article><span>故障隔离</span><strong>{formatCountValue(faultIsolationCount)}台</strong><small>隔离调度</small></article>
              <article><span>约束提示</span><strong>{formatCountValue(boundaryAttentionCount)}项</strong><small>{boundaryAttentionScopeText}</small></article>
            </div>
          </div>
        </article>

        <article className="dashboard-cockpit-panel dashboard-cockpit-ai">
          <div className="dashboard-cockpit-panel-head">
            <h2>AI建议与审批</h2>
            <span className="dashboard-cockpit-badge is-warn">仅输出建议值</span>
          </div>
          <div className="dashboard-cockpit-panel-body dashboard-cockpit-ai-stack">
            <div className="dashboard-cockpit-ai-status-grid">
              {aiStateCards.map((item) => (
                <section key={item.label} className="dashboard-cockpit-ai-state">
                  <h3>{item.label}</h3>
                  <strong className={`tone-${item.tone}`}>{item.value}</strong>
                </section>
              ))}
            </div>
            <section className="dashboard-cockpit-ai-row">
              <h3>回退条件</h3>
              <p>10分钟 COP下降&gt;0.15 / 冷冻出水&gt;9.2°C / 告警升级 / 设备切本地</p>
            </section>
            <section className="dashboard-cockpit-ai-row">
              <h3>优先动作</h3>
              <p>{aiPriorityActionText}</p>
            </section>
            <div className="dashboard-cockpit-ai-actions">
              <Link to={buildSiteScopedRoute("/system-overview")} className="dashboard-cockpit-action-button is-secondary">{aiBoundaryActionLabel}</Link>
              <Link to={buildSiteScopedRoute("/optimize-demo")} className={aiReviewActionClassName}>{aiReviewActionLabel}</Link>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-cockpit-bottom-grid">
        <article className="dashboard-cockpit-panel">
          <div className="dashboard-cockpit-panel-head">
            <h2>关键约束阈值</h2>
            <span className="dashboard-cockpit-badge is-good">PLC保护</span>
          </div>
          <div className="dashboard-cockpit-list">
            <div><span>冷冻出水</span><b>{diagnosticMetricByKey.get("chilledSupplyTemp")?.value || formatTemperatureValue(chilledSupplyTemp)}</b><small>目标 8.5-9.0°C，上限 9.2°C</small></div>
            <div><span>冷却接近度</span><b className={coolingApproachOutOfBand ? "is-warn" : "is-good"}>{formatTemperatureValue(coolingApproach)}</b><small>{coolingApproachConstraintText}</small></div>
            <div><span>频率下限</span><b>{inefficientAreaCount > 0 ? "受限" : "正常"}</b><small>泵 ≥35Hz，塔风机 ≥30Hz</small></div>
          </div>
        </article>
        <article className="dashboard-cockpit-panel">
          <div className="dashboard-cockpit-panel-head">
            <h2>待处理事件 Top3</h2>
            <span className={`dashboard-cockpit-badge ${activeAlarmCount > 0 || activeEventCount > 0 ? "is-warn" : "is-good"}`}>
              事件{formatCountValue(activeEventCount)} · 告警{formatCountValue(activeAlarmCount)}
            </span>
          </div>
          <div className="dashboard-cockpit-list">
            {topAlarmRows.map((item) => (
              <Link key={item.id} to={buildSiteScopedRoute(item.to)} className="dashboard-cockpit-row-link">
                <span>{item.severity}</span>
                <small>{item.repeatCount > 1 ? `${item.title} · ${item.repeatCount}条` : item.title}</small>
                <b className={item.tone === "warn" ? "is-warn" : item.tone === "good" ? "is-good" : ""}>{item.impactLabel}</b>
              </Link>
            ))}
          </div>
        </article>
        <article className="dashboard-cockpit-panel">
          <div className="dashboard-cockpit-panel-head">
            <h2>交接班条带</h2>
            <span className="dashboard-cockpit-badge">最近事件</span>
          </div>
          <div className="dashboard-cockpit-list">
            {handoverRows.map((item) => (
              <div key={`${item.label}-${item.text}`}>
                <span>{item.label}</span>
                <small>{item.text}</small>
                <b className={item.tone === "warn" ? "is-warn" : item.tone === "good" ? "is-good" : ""}>{item.status}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
