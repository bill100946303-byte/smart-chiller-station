import { ArrowUpRight } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import RuleSkipDetails from "../components/dashboard/RuleSkipDetails";
import { runtimeConfig } from "../config/runtimeConfig";
import useRecommendationDiagnostics from "../hooks/useRecommendationDiagnostics";
import {
  getRiskCopy,
  getRuleCopy,
  getSeverityCopy,
  preferChineseText
} from "../i18n/hvacCopybook";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type AnomalyListDto,
  type AnomalySummaryDto,
  type DashboardOverviewDto,
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
  fetchDeviceDetail,
  fetchDeviceList,
  fetchEnvironmentBuildings,
  fetchEnvironmentConditions,
  fetchWorkOrders
} from "../services/bffClient";

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
  stopped: number;
  alarm: number;
  attention: number;
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
  source: string;
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

const TREND_SPARK_WIDTH = 180;
const TREND_SPARK_HEIGHT = 48;
const DASHBOARD_AUTO_REFRESH_MS = 20_000;
const DASHBOARD_RECOVERY_RETRY_MS = 5_000;
const DASHBOARD_OVERVIEW_SNAPSHOT_KEY_PREFIX = "chiller-dashboard-overview-snapshot-v1";

const DASHBOARD_TEXT = {
  commandCenter: "值班总判台",
  dutyFocus: "当前值守重点",
  mainLoop: "主链路状态带",
  alarmQueue: "告警影响队列",
  alarmQueueHint: "先处理已经影响主链路供冷的事件，再看一般运行波动。",
  controlWatchHint: "二次复核就地、手动、禁用等人为介入信号。",
  comfortResult: "舒适结果",
  efficiencyTrend: "效率趋势",
  deltaTrend: "换热温差趋势",
  actionCenter: "可执行处置中心",
  controlWatch: "人工接管观察",
  handover: "交接班条带",
  domainBoards: "安全 / 运行 / 效率判断",
  opsBoard: "值班判断板",
  opsBoardHint: "先看效率表现，再看主链路连续性，最后复核风险与接管。",
  opsEfficiencyTitle: "1. 效率表现",
  opsEfficiencyHint: "把 COP、功率结构、关键水温和温差放到最前面，先看当前冷站效率质量。",
  opsContinuityTitle: "2. 主链路连续性",
  opsContinuityHint: "先确认冷机、冷冻泵、冷却泵、冷却塔是否仍在稳定供冷。",
  opsRiskTitle: "3. 风险与接管总览",
  opsRiskHint: "把接管、主链路报警、高等级异常和数据可信度压成一条告警总览。",
  opsCoverageSummary: "运行覆盖",
  opsCoverageSummaryHint: "已回传运行态、告警态或控制信号的主设备占比",
  opsSourceStatus: "来源状态",
  opsSourceStatusOk: "可直接判断",
  opsSourceStatusWarn: "部分来源待复核",
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
  projectModePendingNote: "项目组织方式识别中，请先按当前来源状态判断。",
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
  controlFallback: "当前仅展示已接入设备详情的接管信号。",
  handoverNoOps: "操作记录源当前未回传，交接班先以下列未闭环事项为准。",
  handoverRuleHint: "规则引擎与建议链路同步展示在此，便于交接时确认当前策略侧风险。",
  comfortCompatibleHint: "舒适达标按设定温度偏差 ±1°C 兼容估算，供冷中房间来自兼容判据。",
  comfortEmpty: "环境点位尚未回传，当前无法计算房间舒适结果。",
  anomalyEmpty: "当前没有需要优先排队的异常事件。",
  actionEmpty: "当前没有可执行建议，建议先检查下方规则诊断与来源状态。",
  impactSupply: "影响供冷",
  impactComfort: "影响舒适",
  impactOperation: "需值守关注",
  verdictDataSoftTitle: "核心值可用，来源待复核",
  verdictDataSoftDesc: "关键功率、COP 与温差已回传，部分接口走兼容链路或更新偏旧，请结合来源状态复核。",
  verdictTakeoverTitle: "需人工接管，先稳住主链路",
  verdictTakeoverDesc: "主链路已出现高等级异常、告警设备或人工接管信号，首页优先把供冷连续性放在第一位。",
  verdictComfortTitle: "舒适风险上升，先看末端偏差",
  verdictComfortDesc: "系统仍在供冷，但房间温度偏差已经扩大，建议先处理最差房间与供冷覆盖面。",
  verdictEfficiencyTitle: "运行稳定，可转入能效优化",
  verdictEfficiencyDesc: "主链路目前稳定，告警和接管压力不高，当前更值得去盯 COP、功率与优化建议。",
  verdictDataTitle: "数据回退中，先确认来源状态",
  verdictDataDesc: "关键来源里存在回退或陈旧信号，值班判断应先确认数据可信度，再决定是否调整策略。",
  verdictStableTitle: "系统稳定供冷，可维持当前策略",
  verdictStableDesc: "首屏暂未发现主链路失稳或舒适越限高压，建议继续值守并跟踪能效变化。",
  trendLatest: "最新",
  trendMin: "最小",
  trendMax: "最大",
  trendEmpty: "当前指标没有连续有效点。",
  trendHint: "鼠标悬停后四张曲线按同一时刻联动。",
  actionWhyNow: "为什么现在做",
  actionBenefit: "预期收益",
  actionScope: "影响范围",
  actionEntry: "进入处置页",
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
  supplyCompatible: "兼容判据",
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

function toPercentOrDash(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function buildOverviewSnapshotStorageKey(siteId: string): string {
  return `${DASHBOARD_OVERVIEW_SNAPSHOT_KEY_PREFIX}:${siteId || "default"}`;
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

function readOverviewSnapshot(siteId: string): DashboardOverviewSnapshotPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(buildOverviewSnapshotStorageKey(siteId));
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

function writeOverviewSnapshot(siteId: string, overview: DashboardOverviewDto, capturedAt: string): void {
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
    window.localStorage.setItem(buildOverviewSnapshotStorageKey(siteId), JSON.stringify(payload));
  } catch (_error) {
    // localStorage may be unavailable in private browsing or restricted environments.
  }
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

function formatFailedEndpoint(value: string): string {
  if (value === "overview") {
    return zhCN.endpoint.overview;
  }
  if (value === "trends") {
    return zhCN.endpoint.trends;
  }
  if (value === "anomalySummary" || value === "anomalyList") {
    return zhCN.endpoint.anomalies;
  }
  if (value === "environment") {
    return DASHBOARD_TEXT.comfortResult;
  }
  if (value === "workOrders") {
    return zhCN.appShell.navWorkOrders;
  }
  if (value === "devices") {
    return zhCN.appShell.navDevices;
  }
  return value;
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
  if (/冷机|冷冻泵|冷却泵|冷却塔|供冷|停机|主链路|故障|机组/i.test(haystack)) {
    return { label: DASHBOARD_TEXT.impactSupply, to: "/scene-control", rank: 0 };
  }
  if (/房间|环境|温度|湿度|舒适|末端/i.test(haystack)) {
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
    series.points?.map((point) => ({
      time: point.t || null,
      label: point.t ? formatTrendLabel(point.t, range) : "--",
      value: typeof point.v === "number" && Number.isFinite(point.v) ? point.v : null
    })) || [];
  const stats = (trends?.stats || []).find((item) => item.metric === metric);
  const numericValues = points.map((point) => point.value).filter((value): value is number => typeof value === "number");

  return {
    key: metric,
    label: series.label || fallbackLabel,
    unit: metricUnit(metric),
    latest: typeof stats?.latest === "number" ? stats.latest : numericValues[numericValues.length - 1] ?? null,
    min: typeof stats?.min === "number" ? stats.min : numericValues.length ? Math.min(...numericValues) : null,
    max: typeof stats?.max === "number" ? stats.max : numericValues.length ? Math.max(...numericValues) : null,
    points
  };
}

function buildSparkModel(points: TrendMetricView["points"]): {
  path: string;
  plottedPoints: SparkPointView[];
} {
  const numeric = points
    .map((point, pointIndex) => ({ point, pointIndex }))
    .filter(
      (item): item is { point: { time: string | null; label: string; value: number }; pointIndex: number } =>
        typeof item.point.value === "number"
    );
  if (numeric.length < 2) {
    return { path: "", plottedPoints: [] };
  }

  const values = numeric.map((item) => item.point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max === min ? Math.max(Math.abs(max), 1) : max - min;

  const plottedPoints = numeric.map(({ point, pointIndex }) => ({
    time: point.time,
    label: point.label,
    value: point.value,
    x: points.length === 1 ? 0 : (pointIndex / (points.length - 1)) * TREND_SPARK_WIDTH,
    y: TREND_SPARK_HEIGHT - ((point.value - min) / span) * TREND_SPARK_HEIGHT
  }));

  return {
    path: plottedPoints
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" "),
    plottedPoints
  };
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
  rect: DOMRect
) {
  if (plottedPoints.length === 0 || rect.width <= 0) {
    return null;
  }
  const localX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const scaledX = (localX / rect.width) * TREND_SPARK_WIDTH;
  return plottedPoints.reduce((best, current) =>
    Math.abs(current.x - scaledX) < Math.abs(best.x - scaledX) ? current : best
  );
}

function TrendSparkCard({ card, hoverTime, onHoverTime }: TrendSparkCardProps) {
  const spark = buildSparkModel(card.points);
  const activePoint = findActiveTrendPoint(card.points, hoverTime);
  const activeSparkPoint =
    spark.plottedPoints.find((point) => point.time === activePoint?.time) ||
    spark.plottedPoints[spark.plottedPoints.length - 1] ||
    null;
  const displayValue = activePoint?.value ?? card.latest;
  const hoverActive = Boolean(hoverTime && activePoint);

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
          {toFixedOrDash(displayValue, 2)}
          {card.unit ? <em>{card.unit}</em> : null}
        </strong>
      </div>
      {spark.path ? (
        <svg
          viewBox={`0 0 ${TREND_SPARK_WIDTH} ${TREND_SPARK_HEIGHT}`}
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
          <path d={spark.path} />
        </svg>
      ) : (
        <p className="empty-hint">{DASHBOARD_TEXT.trendEmpty}</p>
      )}
      <div className="dashboard-trend-stats">
        {hoverActive ? (
          <>
            <small>{`时间 ${formatTrendHoverLabel(activePoint?.time)}`}</small>
            <small>{`当前 ${toFixedOrDash(displayValue, 2)}`}</small>
            <small>{`区间 ${toFixedOrDash(card.min, 2)} ~ ${toFixedOrDash(card.max, 2)}`}</small>
          </>
        ) : (
          <>
            <small>{DASHBOARD_TEXT.trendLatest} {toFixedOrDash(card.latest, 2)}</small>
            <small>{DASHBOARD_TEXT.trendMin} {toFixedOrDash(card.min, 2)}</small>
            <small>{DASHBOARD_TEXT.trendMax} {toFixedOrDash(card.max, 2)}</small>
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
    const running = group.filter((item) => isRunningStatus(item.runStatusText)).length;
    const stopped = group.filter((item) => item.runStatusText && !isRunningStatus(item.runStatusText)).length;
    const alarm = group.filter((item) => isAlarmStatus(item.alarmStatusText)).length;
    const attention = group.filter((item) => needsManualAttention(item)).length;
    const latestUpdateAt = group
      .map((item) => item.latestUpdateAt)
      .filter((item): item is string => Boolean(item))
      .sort()
      .slice(-1)[0] || null;

    let note = "运行态待进一步确认";
    if (total === 0) {
      note = "当前未识别到该类设备。";
    } else if (attention > 0) {
      note = `${attention}${zhCN.realtimeStatus.unitTai}存在就地、手动或禁用信号。`;
    } else if (alarm > 0) {
      note = `${alarm}${zhCN.realtimeStatus.unitTai}处于报警态。`;
    } else if (running > 0) {
      note = `${running}${zhCN.realtimeStatus.unitTai}当前参与运行。`;
    } else if (stopped === total) {
      note = "当前采样显示该链路全部停机。";
    }

    return {
      key,
      title: systemTypeTitle(key),
      total,
      running,
      stopped,
      alarm,
      attention,
      latestUpdateAt,
      note
    };
  });
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
          title: item.title || zhCN.dashboard.alarmEvent,
          severity: getSeverityCopy(item.severity || null),
          severityRaw: item.severity || null,
          occurredAt: formatShortDateTime(item.occurredAt),
          occurredAtRaw: item.occurredAt || null,
          source: item.source || zhCN.dashboard.unknownSource,
          value: item.value || null
        }))
      : (anomalySummary?.latestEvents || []).map((item, index) => ({
          id: item.id || `anomaly-${index + 1}`,
          title: item.title || zhCN.dashboard.alarmEvent,
          severity: getSeverityCopy(item.severity || null),
          severityRaw: item.severity || null,
          occurredAt: formatShortDateTime(item.occurredAt),
          occurredAtRaw: item.occurredAt || null,
          source: item.source || zhCN.dashboard.unknownSource,
          value: null
        }));

  return baseItems
    .map((item) => {
      const impact = classifyAnomalyImpact(item.title, item.source);
      return {
        id: item.id,
        title: item.title,
        severity: item.severity,
        tone: toneFromSeverity(item.severityRaw),
        impactLabel: impact.label,
        occurredAt: item.occurredAt,
        source: item.source,
        summary: `${DASHBOARD_TEXT.alarmOccurred} ${item.occurredAt} · ${item.source}${item.value ? ` · ${item.value}` : ""}`,
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
          label: "来源状态",
          value: options.hasCoreMetrics ? "核心值已回传，部分接口需复核" : "存在回退或陈旧信号",
          tone: "neutral",
          hint: options.hasCoreMetrics ? "先用功率、COP 和温差判断，再复核来源条。" : "先确认来源状态，再做值班判断。"
        },
        {
          label: zhCN.appShell.navAlarms,
          value: `${options.criticalCount}${zhCN.common.unitItem}高等级异常`,
          tone: options.criticalCount > 0 ? "warn" : "neutral",
          hint: "先确认是否已经影响主链路供冷。"
        },
        {
          label: DASHBOARD_TEXT.actionCenter,
          value: `${options.recommendationCount}${zhCN.common.unitItem}待确认建议`,
          tone: "neutral",
          hint: "建议只作为辅助，不替代现场判断。"
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
          value: `${options.criticalCount}${zhCN.common.unitItem}高等级异常 / ${options.mainLoopAlarmCount}${zhCN.realtimeStatus.unitTai}主链路报警`,
          tone: "warn",
          hint: "先看主机、泵组、塔组是否还在连续供冷。"
        },
        {
          label: DASHBOARD_TEXT.controlWatch,
          value: `${options.manualAttentionCount}${zhCN.realtimeStatus.unitTai}存在就地、手动或禁用`,
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
          value: `${options.comfortRiskCount}${zhCN.common.unitItem}`,
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
          value: `${options.cooledRoomsCount}/${options.totalRoomsCount || "--"}`,
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
          value: toFixedOrDash(options.currentCop, 2),
          tone: "good",
          hint: "主链路稳定后再看能效更有意义。"
        },
        {
          label: DASHBOARD_TEXT.actionCenter,
          value: `${options.recommendationCount}${zhCN.common.unitItem}可执行建议`,
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
        value: `${options.cooledRoomsCount}${zhCN.common.unitItem}`,
        tone: "neutral",
        hint: "继续跟踪末端覆盖面变化。"
      },
      {
        label: DASHBOARD_TEXT.actionCenter,
        value: `${options.recommendationCount}${zhCN.common.unitItem}建议待评估`,
        tone: "neutral",
        hint: "稳定期更适合做能效微调。"
      }
    ]
  };
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [trends, setTrends] = useState<DashboardTrendsDto | null>(null);
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummaryDto | null>(null);
  const [anomalyList, setAnomalyList] = useState<AnomalyListDto | null>(null);
  const [environmentAll, setEnvironmentAll] = useState<EnvironmentConditionListDto | null>(null);
  const [environmentCooled, setEnvironmentCooled] = useState<EnvironmentConditionListDto | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderListDto | null>(null);
  const [deviceSourceStatus, setDeviceSourceStatus] = useState<SourceStatusDto | null>(null);
  const [mainLoopDevices, setMainLoopDevices] = useState<MainLoopDeviceView[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [projectMode, setProjectMode] = useState<ProjectModeView | null>(null);
  const [linkedTrendHoverTime, setLinkedTrendHoverTime] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [refreshFeedbackTick, setRefreshFeedbackTick] = useState(0);
  const [overviewSnapshotAt, setOverviewSnapshotAt] = useState<string | null>(null);
  const [overviewUsingSnapshot, setOverviewUsingSnapshot] = useState(false);
  const latestUsableOverviewRef = useRef<DashboardOverviewDto | null>(null);
  const latestUsableOverviewAtRef = useRef<string | null>(null);

  const {
    recommendation,
    ruleEvaluation,
    diagnosticHint,
    sourceStatusLines: recommendationSourceStatusLines,
    sourceStatusLinesCompact: recommendationSourceStatusLinesCompact,
    loading: recommendationLoading,
    loadError: recommendationLoadError
  } = useRecommendationDiagnostics(runtimeConfig.siteId);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshTimer: number | null = null;
    const cachedOverviewSnapshot = readOverviewSnapshot(runtimeConfig.siteId);
    if (cachedOverviewSnapshot) {
      latestUsableOverviewRef.current = cachedOverviewSnapshot.overview;
      latestUsableOverviewAtRef.current = cachedOverviewSnapshot.capturedAt;
      startTransition(() => {
        setOverview(cachedOverviewSnapshot.overview);
        setOverviewSnapshotAt(cachedOverviewSnapshot.capturedAt);
        setOverviewUsingSnapshot(true);
      });
    } else {
      latestUsableOverviewRef.current = null;
      latestUsableOverviewAtRef.current = null;
      startTransition(() => {
        setOverviewSnapshotAt(null);
        setOverviewUsingSnapshot(false);
      });
    }

    function scheduleRefreshWithDelay(delayMs: number) {
      if (!active) {
        return;
      }
      refreshTimer = window.setTimeout(() => {
        void load();
      }, delayMs);
    }

    async function load() {
      if (refreshing) {
        return;
      }
      refreshing = true;
      const failed: string[] = [];
      let buildingId = "1";
      let buildingResult: EnvironmentBuildingListDto | null = null;

      try {
        try {
          buildingResult = await fetchEnvironmentBuildings(runtimeConfig.siteId);
          buildingId = buildingResult.items?.[0]?.id || "1";
        } catch {
          failed.push("environment");
        }

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
          fetchDashboardOverview(runtimeConfig.siteId),
          fetchDashboardTrends(runtimeConfig.siteId, runtimeConfig.trendRange),
          fetchAnomalySummary(runtimeConfig.siteId),
          fetchAnomalyList(runtimeConfig.siteId, { page: 1, pageSize: 10 }),
          fetchEnvironmentConditions(runtimeConfig.siteId, { buildingId, cooledAir: "0" }),
          fetchEnvironmentConditions(runtimeConfig.siteId, { buildingId, cooledAir: "1" }),
          fetchWorkOrders(runtimeConfig.siteId, { page: 1, pageSize: 5 }),
          fetchDeviceList(runtimeConfig.siteId, { page: 1, pageSize: 200 })
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
        const environmentAllData = environmentAllResult.status === "fulfilled" ? environmentAllResult.value : null;
        const environmentCooledData = environmentCooledResult.status === "fulfilled" ? environmentCooledResult.value : null;
        const workOrdersData = workOrdersResult.status === "fulfilled" ? workOrdersResult.value : null;
        const deviceListData = deviceListResult.status === "fulfilled" ? deviceListResult.value : null;
        const liveOverviewAvailable = hasUsableOverviewMetrics(overviewData);
        if (liveOverviewAvailable && overviewData) {
          const snapshotAt = overviewData.generatedAt || new Date().toISOString();
          latestUsableOverviewRef.current = overviewData;
          latestUsableOverviewAtRef.current = snapshotAt;
          writeOverviewSnapshot(runtimeConfig.siteId, overviewData, snapshotAt);
        }
        const fallbackOverview =
          !liveOverviewAvailable && hasUsableOverviewMetrics(latestUsableOverviewRef.current)
            ? latestUsableOverviewRef.current
            : null;
        const fallbackOverviewAt = fallbackOverview ? latestUsableOverviewAtRef.current : null;
        const usingSnapshotOverview = Boolean(fallbackOverview && !liveOverviewAvailable);

        const mainLoopCatalog =
          (deviceListData?.items || []).filter(
            (item) => item?.deviceId && !item?.isVirtual && isMainLoopSystemType(item.systemType || undefined)
          ) || [];

        const detailResults = await Promise.allSettled(
          mainLoopCatalog.map((item) => fetchDeviceDetail(runtimeConfig.siteId, item?.deviceId || ""))
        );

        if (!active) {
          return;
        }

        const detailMap = new Map<string, DeviceDetailDto>();
        detailResults.forEach((result, index) => {
          const catalogItem = mainLoopCatalog[index];
          if (result.status === "fulfilled" && catalogItem?.deviceId) {
            detailMap.set(catalogItem.deviceId, result.value);
          }
        });

        const normalizedDevices = mainLoopCatalog.map((item) =>
          normalizeDeviceView(item, detailMap.get(item?.deviceId || "") || null)
        );
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
          setTrends((previous) => trendsData ?? previous);
          setAnomalySummary((previous) => anomalySummaryData ?? previous);
          setAnomalyList((previous) => anomalyListData ?? previous);
          setEnvironmentAll((previous) => environmentAllData ?? previous);
          setEnvironmentCooled((previous) => environmentCooledData ?? previous);
          setWorkOrders((previous) => workOrdersData ?? previous);
          setDeviceSourceStatus((previous) => deviceListData?.sourceStatus || buildingResult?.sourceStatus || previous);
          setMainLoopDevices((previous) => (deviceListData ? normalizedDevices : previous));
          setLoadErrors(failed);
          setProjectMode((previous) =>
            deviceListData || buildingResult ? detectProjectMode(deviceListData, buildingResult) : previous
          );
          setOverviewUsingSnapshot(usingSnapshotOverview);
          setOverviewSnapshotAt(usingSnapshotOverview ? fallbackOverviewAt : null);
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
      if (refreshTimer != null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [runtimeConfig.siteId, runtimeConfig.trendRange]);

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
  const worstRooms = comfortRooms.slice(0, 5);

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
  const extensionSourceStatuses = [
    anomalyList?.sourceStatus,
    workOrders?.sourceStatus,
    deviceSourceStatus,
    recommendation?.sourceStatus,
    ...(projectMode?.mode === "spatial" ? [environmentAll?.sourceStatus, environmentCooled?.sourceStatus] : [])
  ];
  const coreSourceStatuses = [overview?.sourceStatus, trends?.sourceStatus, alarmBannerSourceStatus];
  const coreSourceWarnActive =
    [overview?.freshness?.stale, trends?.freshness?.stale, anomalySummary?.diagnosisFlags?.staleAlarmFeed].some(Boolean) ||
    coreSourceStatuses.some((item) => hasSourceFailure(item));
  const extensionFreshnessFlags = [
    anomalyList?.freshness?.stale,
    workOrders?.freshness?.stale
  ];
  const extensionWarnActive =
    loadErrors.length > 0 ||
    Boolean(recommendationLoadError) ||
    extensionFreshnessFlags.some(Boolean) ||
    extensionSourceStatuses.some((item) => hasSourceFailure(item));
  const bannerSourceStatuses = coreSourceWarnActive
    ? [...coreSourceStatuses, ...extensionSourceStatuses]
    : extensionWarnActive
      ? extensionSourceStatuses
      : [];
  const extensionSourceSummary = summarizeSourceStatus(extensionSourceStatuses);
  const overviewSnapshotClock = overviewSnapshotAt ? formatClockTime(overviewSnapshotAt) : "";
  const overviewSnapshotSummary = overviewUsingSnapshot
    ? `实时数据暂不可用，已回退到最近可用快照${overviewSnapshotClock ? `（${overviewSnapshotClock}）` : ""}。`
    : "";

  const sourceBannerBaseText =
    coreRealtimeUnavailable
      ? `${zhCN.dashboard.coreDataUnavailableBanner} ${zhCN.dashboard.coreDataUnavailableHint.replace("{seconds}", String(Math.round(DASHBOARD_RECOVERY_RETRY_MS / 1000)))}`
      : loadErrors.length > 0
      ? coreSourceWarnActive
        ? `${zhCN.dashboard.failedEndpointsPrefix}${loadErrors.map(formatFailedEndpoint).join("、")}${zhCN.dashboard.failedEndpointsSuffix}`
        : `首屏判断已就绪，但部分扩展模块请求未返回。`
      : coreSourceWarnActive
        ? "首页关键链路待复核，请结合来源状态判断。"
        : extensionWarnActive
          ? `${extensionSourceSummary.text.replace(zhCN.sourceBanner.summaryPrefix, "扩展模块来源：")}，不影响首页首屏判断。`
          : "值班数据已就绪，可直接用于首屏判断。";
  const sourceBannerText = overviewSnapshotSummary ? `${overviewSnapshotSummary} ${sourceBannerBaseText}` : sourceBannerBaseText;
  const sourceDetailLines = buildSourceStatusLines(bannerSourceStatuses);
  const sourceDetailLinesCompact = buildSourceStatusLines(bannerSourceStatuses, { labelMode: "short", limit: 4 });
  const snapshotDetailLine = overviewUsingSnapshot
    ? `快照回退：当前展示最近可用首页核心值${overviewSnapshotClock ? `（${overviewSnapshotClock}）` : ""}`
    : "";
  const mergedSourceDetailLines = Array.from(
    new Set([snapshotDetailLine, ...sourceDetailLines, ...recommendationSourceStatusLines].filter(Boolean))
  );
  const mergedSourceDetailLinesCompact = Array.from(
    new Set([snapshotDetailLine, ...sourceDetailLinesCompact, ...recommendationSourceStatusLinesCompact].filter(Boolean))
  );
  const heroGeneratedAt = formatGeneratedAt(overview?.generatedAt || trends?.generatedAt || workOrders?.generatedAt);

  const verdict = deriveVerdict({
    sourceWarn: coreSourceWarnActive,
    hasCoreMetrics,
    criticalCount,
    mainLoopAlarmCount,
    manualAttentionCount,
    comfortRiskCount,
    comfortWorstRoom: worstRooms[0] || null,
    currentCop,
    recommendationCount,
    cooledRoomsCount,
    totalRoomsCount: comfortRooms.length
  });

  const opsRiskCards: OpsMetric[] = [
    {
      key: "manual",
      label: DASHBOARD_TEXT.processAttention,
      value: `${manualAttentionCount}${zhCN.realtimeStatus.unitTai}`,
      tone: manualAttentionCount > 0 ? "warn" : "good",
      hint: "就地 / 手动 / 禁用等接管信号"
    },
    {
      key: "loopAlarm",
      label: DASHBOARD_TEXT.safetyLoopAlarm,
      value: `${mainLoopAlarmCount}${zhCN.realtimeStatus.unitTai}`,
      tone: mainLoopAlarmCount > 0 ? "warn" : "good",
      hint: "主机、泵、塔链路中的告警设备"
    },
    {
      key: "critical",
      label: DASHBOARD_TEXT.safetyHigh,
      value: `${criticalCount}${zhCN.common.unitItem}`,
      tone: criticalCount > 0 ? "warn" : "good",
      hint: "高等级异常优先于一般波动"
    },
    {
      key: "source",
      label: DASHBOARD_TEXT.opsSourceStatus,
      value: coreSourceWarnActive ? DASHBOARD_TEXT.opsSourceStatusWarn : DASHBOARD_TEXT.opsSourceStatusOk,
      tone: coreSourceWarnActive ? "warn" : "good",
      hint: `${DASHBOARD_TEXT.opsUpdatedAtHint}${heroGeneratedAt}`
    }
  ];

  const alarmOverviewCards: OpsMetric[] = [
    {
      key: "critical",
      label: DASHBOARD_TEXT.safetyHigh,
      value: `${criticalCount}${zhCN.common.unitItem}`,
      tone: criticalCount > 0 ? "warn" : "good",
      hint: criticalCount > 0 ? "需要优先确认是否影响供冷连续性" : "当前没有高等级异常"
    },
    {
      key: "loopAlarm",
      label: DASHBOARD_TEXT.safetyLoopAlarm,
      value: `${mainLoopAlarmCount}${zhCN.realtimeStatus.unitTai}`,
      tone: mainLoopAlarmCount > 0 ? "warn" : "good",
      hint: mainLoopAlarmCount > 0 ? "主机、泵、塔主链路存在告警设备" : "当前主链路没有告警设备"
    },
    {
      key: "queueTotal",
      label: "待处理事件",
      value: `${anomalyQueue.length}${zhCN.common.unitItem}`,
      tone: anomalyQueue.length > 0 ? "neutral" : "good",
      hint: anomalyQueue.length > 0 ? "按影响供冷、舒适、运维顺序处理" : "当前没有需要立即跟进的事件"
    }
  ];

  const opsEfficiencyCards: OpsMetric[] = [
    {
      key: "cop",
      label: DASHBOARD_TEXT.efficiencyStationCop,
      value: toFixedOrDash(currentCop, 2),
      tone: stationCopAssessment?.tone ?? "neutral",
      hint: "沿用旧冷站效率口径，先看系统整体能效。",
      assessment: stationCopAssessment?.label
    },
    {
      key: "chillerCop",
      label: DASHBOARD_TEXT.efficiencyChillerCop,
      value: toFixedOrDash(chillerCop, 2),
      tone: chillerCopAssessment?.tone ?? "neutral",
      hint: `总制冷量 ${toFixedOrDash(totalCoolingCapacity, 1)} ÷ 主机总功率 ${toFixedOrDash(chillerPowerKw, 1)}`,
      assessment: chillerCopAssessment?.label
    },
    {
      key: "chilledPumpCoefficient",
      label: DASHBOARD_TEXT.efficiencyChilledPumpCoefficient,
      value: toFixedOrDash(chilledPumpConveyingCoefficient, 2),
      tone: chilledPumpAssessment?.tone ?? "neutral",
      hint: `总制冷量 ${toFixedOrDash(totalCoolingCapacity, 1)} ÷ 冷冻泵功率 ${toFixedOrDash(chilledPumpPowerKw, 1)}`,
      assessment: chilledPumpAssessment?.label
    },
    {
      key: "coolingPumpCoefficient",
      label: DASHBOARD_TEXT.efficiencyCoolingPumpCoefficient,
      value: toFixedOrDash(coolingPumpConveyingCoefficient, 2),
      tone: coolingPumpAssessment?.tone ?? "neutral",
      hint: `总制冷量 ${toFixedOrDash(totalCoolingCapacity, 1)} ÷ 冷却泵功率 ${toFixedOrDash(coolingPumpPowerKw, 1)}`,
      assessment: coolingPumpAssessment?.label
    },
    {
      key: "coolingTowerCoefficient",
      label: DASHBOARD_TEXT.efficiencyCoolingTowerCoefficient,
      value: toFixedOrDash(coolingTowerConveyingCoefficient, 2),
      tone: coolingTowerAssessment?.tone ?? "neutral",
      hint: `总制冷量 ${toFixedOrDash(totalCoolingCapacity, 1)} ÷ 冷却塔功率 ${toFixedOrDash(coolingTowerPowerKw, 1)}`,
      assessment: coolingTowerAssessment?.label
    },
    {
      key: "heatBalance",
      label: DASHBOARD_TEXT.efficiencyHeatBalance,
      value: `${toFixedOrDash(thermalUnbalanceRate, 1)} %`,
      tone: heatBalanceAssessment?.tone ?? "neutral",
      hint: "当前先沿用旧系统热不平衡率口径，绝对值越接近 0 越稳。",
      assessment: heatBalanceAssessment?.label
    },
    {
      key: "coolingCapacity",
      label: DASHBOARD_TEXT.efficiencyCoolingCapacity,
      value: `${toFixedOrDash(totalCoolingCapacity, 1)} kW`,
      tone: totalCoolingCapacity != null ? "neutral" : "warn",
      hint: "当前新壳按旧系统默认 KW 口径展示，优先使用实时总冷量，缺测时再兼容推导"
    },
    {
      key: "power",
      label: DASHBOARD_TEXT.efficiencyPower,
      value: `${toFixedOrDash(totalPower, 1)} kW`,
      tone: totalPower != null ? "neutral" : "warn",
      hint: `主机 ${toFixedOrDash(chillerPowerKw, 1)} kW · 辅机 ${toFixedOrDash(auxiliaryPowerKw, 1)} kW`
    },
    {
      key: "delta",
      label: DASHBOARD_TEXT.efficiencyDelta,
      value: `${toFixedOrDash(chilledDeltaT, 1)} / ${toFixedOrDash(coolingDeltaT, 1)} °C`,
      tone: chilledDeltaT != null || coolingDeltaT != null ? "neutral" : "warn",
      hint: `冷冻出水 ${toFixedOrDash(chilledSupplyTemp, 1)}°C · 冷却回水 ${toFixedOrDash(coolingReturnTemp, 1)}°C`
    }
  ];

  const handoverItems: HandoverItem[] = [
    {
      label: DASHBOARD_TEXT.handoverAction,
      value: `${anomalySummary?.counts?.total ?? anomalyQueue.length}${zhCN.common.unitItem}`,
      hint: "当前异常与事件待闭环",
      tone: (anomalySummary?.counts?.total ?? 0) > 0 ? "warn" : "good",
      to: "/alarms"
    },
    {
      label: DASHBOARD_TEXT.handoverRecommendation,
      value: `${recommendation?.summary?.highRisk ?? 0}${zhCN.common.unitItem}`,
      hint: "需要人工确认的高风险建议",
      tone: (recommendation?.summary?.highRisk ?? 0) > 0 ? "warn" : "neutral",
      to: "/system-overview"
    },
    {
      label: DASHBOARD_TEXT.handoverManual,
      value: `${manualAttentionCount}${zhCN.realtimeStatus.unitTai}`,
      hint: "就地 / 手动 / 禁用信号",
      tone: manualAttentionCount > 0 ? "warn" : "good",
      to: "/scene-control"
    },
    {
      label: DASHBOARD_TEXT.handoverWorkOrder,
      value: `${workOrders?.total ?? 0}${zhCN.common.unitItem}`,
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

  const efficiencyTrendCards = [
    buildTrendMetricView(trends, "totalPowerKw", DASHBOARD_TEXT.efficiencyPower, runtimeConfig.trendRange),
    buildTrendMetricView(trends, "currentCop", DASHBOARD_TEXT.efficiencyCop, runtimeConfig.trendRange)
  ].filter((item): item is TrendMetricView => Boolean(item));

  const deltaTrendCards = [
    buildTrendMetricView(trends, "chilledDeltaT", "冷冻侧温差", runtimeConfig.trendRange),
    buildTrendMetricView(trends, "coolingDeltaT", "冷却侧温差", runtimeConfig.trendRange)
  ].filter((item): item is TrendMetricView => Boolean(item));

  const heroMetaItems = [
    {
      key: "source",
      className: coreSourceWarnActive ? "is-warn" : "is-good",
      value: coreSourceWarnActive ? "核心值待复核" : "可直接判断"
    },
    {
      key: "auto-refresh",
      className: "is-info",
      value: coreRealtimeUnavailable
        ? `每${Math.round(DASHBOARD_RECOVERY_RETRY_MS / 1000)}秒自动重试`
        : `每${Math.round(DASHBOARD_AUTO_REFRESH_MS / 1000)}秒自动刷新`
    },
    lastRefreshAt
      ? {
          key: `refreshed-${refreshFeedbackTick}`,
          className: "is-info is-refresh-flash",
          value: `刚刷新 ${formatClockTime(lastRefreshAt)}`
        }
      : null,
    (workOrders?.total ?? 0) > 0
      ? {
          key: "workorders",
          className: "is-warn",
          value: `${DASHBOARD_TEXT.focusWorkOrders}${workOrders?.total ?? 0}${zhCN.common.unitItem}`
        }
      : null
  ].filter((item): item is { key: string; className: string; value: string } => Boolean(item));

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

  return (
    <div className="dashboard-duty page-enter">
      <section className={`dashboard-command-board tone-${verdict.tone}`}>
        <div className="dashboard-command-motif" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="dashboard-command-main">
          <div className="dashboard-command-header">
            <div className="dashboard-command-copy">
              <p className="system-hero-eyebrow">{DASHBOARD_TEXT.commandCenter}</p>
              <p className="dashboard-command-summary">
                {verdict.description || verdict.title}
              </p>
            </div>
          </div>

          <div className="dashboard-command-meta">
            {heroMetaItems.map((item) => (
              <span key={item.key} className={item.className || undefined}>
                {item.value}
              </span>
            ))}
          </div>
          <p className="dashboard-command-note">{projectMode?.note || DASHBOARD_TEXT.projectModePendingNote}</p>

        </div>
      </section>

      <SectionCard title={DASHBOARD_TEXT.opsBoard} action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.opsBoardHint}</span>}>
        <div className="dashboard-ops-board">
          <section className="dashboard-ops-rail dashboard-ops-rail-efficiency">
            <div className="dashboard-ops-head">
              <div>
                <h4>{DASHBOARD_TEXT.opsEfficiencyTitle}</h4>
                <small>{DASHBOARD_TEXT.opsEfficiencyHint}</small>
              </div>
            </div>
            {efficiencyStatusNote ? (
              <div className={`dashboard-ops-status-note tone-${efficiencyStatusNote.tone}`}>
                <strong>{efficiencyStatusNote.title}</strong>
                <small>{efficiencyStatusNote.hint}</small>
              </div>
            ) : null}
            <div className="dashboard-ops-card-grid dashboard-ops-card-grid-efficiency">
              {opsEfficiencyCards.map((item) => (
                <article
                  key={item.key}
                  className={`dashboard-ops-card tone-${item.tone} ${item.key === "cop" ? "is-featured" : ""}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {item.assessment ? (
                    <em className={`dashboard-ops-assessment tone-${item.tone}`}>{item.assessment}</em>
                  ) : null}
                  <small>{item.hint}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-ops-section">
            <div className="dashboard-ops-head">
              <div>
                <h4>{DASHBOARD_TEXT.opsContinuityTitle}</h4>
                <small>{DASHBOARD_TEXT.opsContinuityHint}</small>
              </div>
              <div className="dashboard-ops-summary">
                <article className={`tone-${runningMainLoopCount > 0 ? "good" : "neutral"}`}>
                  <span>{DASHBOARD_TEXT.processRunningUnits}</span>
                  <strong>{`${runningMainLoopCount}/${mainLoopTotalCount || "--"}`}</strong>
                  <small>{DASHBOARD_TEXT.processRunningHint}</small>
                </article>
                <article
                  className={`tone-${
                    processCoveragePct != null && processCoveragePct < 60
                      ? "warn"
                      : processCoveragePct != null
                        ? "good"
                        : "neutral"
                  }`}
                >
                  <span>{DASHBOARD_TEXT.opsCoverageSummary}</span>
                  <strong>{mainLoopDevices.length > 0 ? `${toPercentOrDash(processCoveragePct, 0)}%` : "--"}</strong>
                  <small>{`${processCoverageCount}/${mainLoopDevices.length || "--"} ${DASHBOARD_TEXT.opsCoverageSummaryHint}`}</small>
                </article>
              </div>
            </div>

            <div className="dashboard-loop-grid">
              {mainLoopStages.map((stage) => (
                <article key={stage.key} className={`dashboard-loop-card ${stage.attention > 0 || stage.alarm > 0 ? "is-warn" : "is-good"}`}>
                  <div className="dashboard-loop-head">
                    <div>
                      <span>{stage.title}</span>
                      <small>{DASHBOARD_TEXT.mainLoopTotal}{stage.total}</small>
                    </div>
                    <strong>{stage.running}</strong>
                  </div>
                  <div className="dashboard-loop-stats">
                    <small className="is-primary">
                      <span>{DASHBOARD_TEXT.mainLoopRunning}</span>
                      <strong>{stage.running}</strong>
                    </small>
                    <small className={stage.attention > 0 ? "is-alert" : "is-quiet"}>
                      <span>{DASHBOARD_TEXT.mainLoopAttention}</span>
                      <strong>{stage.attention}</strong>
                    </small>
                    <small className={stage.alarm > 0 ? "is-alert" : "is-muted"}>
                      <span>{DASHBOARD_TEXT.mainLoopAlarm}</span>
                      <strong>{stage.alarm}</strong>
                    </small>
                    <small className="is-muted">
                      <span>{DASHBOARD_TEXT.mainLoopStopped}</span>
                      <strong>{stage.stopped}</strong>
                    </small>
                  </div>
                  <p>{stage.note}</p>
                  <time>{formatShortDateTime(stage.latestUpdateAt)}</time>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-ops-rail dashboard-ops-rail-risk">
            <div className="dashboard-ops-head">
              <div>
                <h4>{DASHBOARD_TEXT.opsRiskTitle}</h4>
                <small>{DASHBOARD_TEXT.opsRiskHint}</small>
              </div>
            </div>
            <div className="dashboard-ops-card-grid dashboard-ops-card-grid-risk">
              {opsRiskCards.map((item) => (
                <article key={item.key} className={`dashboard-ops-card tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.hint}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </SectionCard>

      <section className="dashboard-duty-layout">
        <div className="dashboard-duty-main">
          <SectionCard title={DASHBOARD_TEXT.alarmQueue} action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.alarmQueueHint}</span>}>
            <div className="dashboard-anomaly-board">
              <div className="dashboard-anomaly-summary">
                {alarmOverviewCards.map((item) => (
                  <article key={item.key} className={`dashboard-anomaly-summary-card tone-${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.hint}</small>
                  </article>
                ))}
              </div>
              {anomalyQueue.length === 0 ? (
                <article className="dashboard-anomaly-empty">
                  <strong>{DASHBOARD_TEXT.anomalyEmpty}</strong>
                  <p>当前没有进入首页优先队列的高影响事件，可以继续复核接管信号和效率波动。</p>
                </article>
              ) : (
                <div className="dashboard-anomaly-queue">
                  {anomalyQueue.map((item) => (
                    <Link key={item.id} to={item.to} className={`dashboard-anomaly-card tone-${item.tone}`}>
                      <div className="dashboard-anomaly-top">
                        <span>{item.impactLabel}</span>
                        <strong>{item.severity}</strong>
                      </div>
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title={DASHBOARD_TEXT.controlWatch} action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.controlWatchHint}</span>}>
            <div className="dashboard-control-summary">
              <article className={`tone-${manualAttentionCount > 0 ? "warn" : "good"}`}>
                <span>{DASHBOARD_TEXT.handoverManual}</span>
                <strong>{manualAttentionCount}</strong>
                <small>主链路里存在接管信号的设备</small>
              </article>
              <article className={`tone-${mainLoopAlarmCount > 0 ? "warn" : "good"}`}>
                <span>{DASHBOARD_TEXT.safetyLoopAlarm}</span>
                <strong>{mainLoopAlarmCount}</strong>
                <small>告警设备与接管风险一起看</small>
              </article>
            </div>
            {manualAttentionDevices.length === 0 ? <p className="empty-hint">{DASHBOARD_TEXT.controlClear}</p> : null}
            <div className="dashboard-control-list">
              {(manualAttentionDevices.length > 0 ? manualAttentionDevices : mainLoopDevices.slice(0, 4)).map((device) => (
                <article key={device.deviceId} className={`dashboard-control-card ${needsManualAttention(device) ? "is-warn" : ""}`}>
                  <div className="dashboard-control-head">
                    <div>
                      <strong>{device.name}</strong>
                      <p>
                        {device.runStatusText || "运行态未回传"} · {device.alarmStatusText || "告警态未回传"}
                      </p>
                    </div>
                    <time>{formatShortDateTime(device.latestUpdateAt)}</time>
                  </div>
                  <div className="dashboard-control-signals">
                    {device.controlSignals.length === 0 ? (
                      <span className="tone-neutral">{DASHBOARD_TEXT.controlFallback}</span>
                    ) : (
                      device.controlSignals.map((signal) => (
                        <span key={`${device.deviceId}-${signal.key}`} className={`tone-${signal.tone}`}>
                          {signal.label}
                          {signal.value}
                        </span>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={DASHBOARD_TEXT.efficiencyTrend}
            action={
              <div className="dashboard-trend-action">
                <span className="dashboard-section-hint">
                  {linkedTrendHoverTime
                    ? `联动时间 ${formatTrendHoverLabel(linkedTrendHoverTime)}`
                    : DASHBOARD_TEXT.trendHint}
                </span>
                <button type="button" className="dashboard-utility-button">{formatRangeLabel(runtimeConfig.trendRange)}</button>
              </div>
            }
          >
            <div className="dashboard-trend-grid">
              {efficiencyTrendCards.length === 0 ? (
                <p className="empty-hint">{zhCN.dashboard.trendEndpointUnavailable}</p>
              ) : (
                efficiencyTrendCards.map((card) => (
                  <TrendSparkCard
                    key={card.key}
                    card={card}
                    hoverTime={linkedTrendHoverTime}
                    onHoverTime={setLinkedTrendHoverTime}
                  />
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={DASHBOARD_TEXT.deltaTrend}
            action={
              <div className="dashboard-trend-action">
                <span className="dashboard-section-hint">
                  {linkedTrendHoverTime
                    ? `联动时间 ${formatTrendHoverLabel(linkedTrendHoverTime)}`
                    : DASHBOARD_TEXT.trendHint}
                </span>
              </div>
            }
          >
            <div className="dashboard-trend-grid">
              {deltaTrendCards.length === 0 ? (
                <p className="empty-hint">{zhCN.dashboard.trendEndpointUnavailable}</p>
              ) : (
                deltaTrendCards.map((card) => (
                  <TrendSparkCard
                    key={card.key}
                    card={card}
                    hoverTime={linkedTrendHoverTime}
                    onHoverTime={setLinkedTrendHoverTime}
                  />
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="dashboard-duty-side">
          <SectionCard
            title={projectMode?.mode === "process" ? DASHBOARD_TEXT.processSection : DASHBOARD_TEXT.comfortResult}
            action={
              <span className="dashboard-section-hint">
                {projectMode?.mode === "process" ? DASHBOARD_TEXT.processSectionHint : DASHBOARD_TEXT.comfortCompatibleHint}
              </span>
            }
          >
            {projectMode?.mode === "process" ? (
              mainLoopTotalCount === 0 ? (
                <p className="empty-hint">{DASHBOARD_TEXT.processStageEmpty}</p>
              ) : (
                <div className="dashboard-comfort-board">
                  <div className="dashboard-comfort-summary">
                    <article className={`tone-${mainLoopTotalCount > 0 ? "good" : "neutral"}`}>
                      <span>{DASHBOARD_TEXT.mainLoop}</span>
                      <strong>{mainLoopTotalCount}</strong>
                      <small>主设备总数</small>
                    </article>
                    <article className={`tone-${runningMainLoopCount > 0 ? "good" : "neutral"}`}>
                      <span>{DASHBOARD_TEXT.processRunningUnits}</span>
                      <strong>{runningMainLoopCount}</strong>
                      <small>{DASHBOARD_TEXT.processRunningHint}</small>
                    </article>
                    <article
                      className={`tone-${
                        processCoveragePct != null && processCoveragePct < 60
                          ? "warn"
                          : processCoveragePct != null
                            ? "good"
                            : "neutral"
                      }`}
                    >
                      <span>{DASHBOARD_TEXT.processCoverage}</span>
                      <strong>{mainLoopDevices.length > 0 ? `${toPercentOrDash(processCoveragePct, 0)}%` : "--"}</strong>
                      <small>{`${processCoverageCount}/${mainLoopDevices.length || "--"} ${DASHBOARD_TEXT.processCoverageHint}`}</small>
                    </article>
                  </div>

                  <div className="dashboard-comfort-list">
                    {processStageItems.map((stage) => (
                      <Link
                        key={stage.key}
                        to="/scene-control"
                        className={`dashboard-comfort-room tone-${stage.attention > 0 || stage.alarm > 0 ? "warn" : stage.running > 0 ? "good" : "neutral"}`}
                      >
                        <div>
                          <span>{stage.title}</span>
                          <strong>{`${stage.running}/${stage.total}`}</strong>
                        </div>
                        <small>{stage.note}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            ) : comfortRooms.length === 0 ? (
              <p className="empty-hint">{DASHBOARD_TEXT.comfortEmpty}</p>
            ) : (
              <div className="dashboard-comfort-board">
                <div className="dashboard-comfort-summary">
                  <article className={`tone-${comfortCompliancePct != null && comfortCompliancePct < 85 ? "warn" : "good"}`}>
                    <span>{DASHBOARD_TEXT.comfortCompliance}</span>
                    <strong>{toPercentOrDash(comfortCompliancePct, 0)}%</strong>
                    <small>{monitoredRooms.length} 个房间有有效温度点位</small>
                  </article>
                  <article className={`tone-${comfortRiskCount > 0 ? "warn" : "good"}`}>
                    <span>{DASHBOARD_TEXT.comfortOutOfRange}</span>
                    <strong>{comfortRiskCount}</strong>
                    <small>偏差大于 1°C</small>
                  </article>
                  <article className={`tone-${cooledRoomsCount > 0 ? "neutral" : "warn"}`}>
                    <span>{DASHBOARD_TEXT.comfortCooledRooms}</span>
                    <strong>{cooledRoomsCount}</strong>
                    <small>{DASHBOARD_TEXT.supplyCompatible}</small>
                  </article>
                </div>

                <div className="dashboard-comfort-list">
                  {worstRooms.map((room, index) => (
                    <Link key={room.id} to="/environment-conditions" className={`dashboard-comfort-room tone-${comfortTone(room.deviation)}`}>
                      <div>
                        <span>{index + 1}. {room.name}</span>
                        <strong>
                          {room.deviation == null ? "--" : `${room.deviation > 0 ? "+" : ""}${room.deviation.toFixed(1)}°C`}
                        </strong>
                      </div>
                      <small>
                        室温 {room.temperature == null ? "--" : room.temperature.toFixed(1)}°C · 设定 {room.setpoint == null ? "--" : room.setpoint.toFixed(1)}°C
                      </small>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={DASHBOARD_TEXT.actionCenter}>
            <div className="dashboard-action-list">
              {recommendationItems.map((item) => (
                <article key={item.id} className={`dashboard-action-card tone-${item.tone}`}>
                  <div className="dashboard-action-top">
                    <strong>{item.title}</strong>
                    <span>{item.risk}</span>
                  </div>
                  <div className="dashboard-action-meta">
                    <p>
                      <span>{DASHBOARD_TEXT.actionWhyNow}</span>
                      {item.description}
                    </p>
                    <p>
                      <span>{DASHBOARD_TEXT.actionBenefit}</span>
                      {item.impact}
                    </p>
                    <p>
                      <span>{DASHBOARD_TEXT.actionScope}</span>
                      {item.scope}
                    </p>
                  </div>
                  <Link to={item.to} className="dashboard-action-link">
                    {DASHBOARD_TEXT.actionEntry}
                    <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="dashboard-rule-panel">
              <h4>{zhCN.dashboard.sectionRuleSkip}</h4>
              <p className="empty-hint">{diagnosticHint}</p>
              <p className="empty-hint">{DASHBOARD_TEXT.handoverRuleHint}</p>
              <RuleSkipDetails ruleEvaluation={ruleEvaluation} />
            </div>
          </SectionCard>
        </aside>
      </section>

      <SectionCard title={DASHBOARD_TEXT.handover}>
        <div className="dashboard-handover-footer">
          <div className="dashboard-handover-grid">
            {handoverItems.map((item) =>
              item.to ? (
                <Link key={item.label} to={item.to} className={`dashboard-handover-card tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.hint}</small>
                </Link>
              ) : (
                <article key={item.label} className={`dashboard-handover-card tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.hint}</small>
                </article>
              )
            )}
          </div>
          <p className="empty-hint">{DASHBOARD_TEXT.handoverNoOps}</p>
        </div>
      </SectionCard>

      <SourceStatusBanner
        summary={recommendationLoadError ? `${sourceBannerText} · ${zhCN.dashboard.recommendationsUnavailable}` : sourceBannerText}
        warn={coreSourceWarnActive || overviewUsingSnapshot}
        detailLines={mergedSourceDetailLines}
        detailLinesCompact={mergedSourceDetailLinesCompact}
        hideDetailsUntilExpanded
      />
    </div>
  );
}
