import { ArrowUpRight } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReadinessBadge from "../components/common/ReadinessBadge";
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
import { buildSourceStatusLines } from "../i18n/sourceStatusCN";
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
  points: Array<{ label: string; value: number | null }>;
};

type DomainMetric = {
  label: string;
  value: string;
  tone: Tone;
  hint: string;
};

type DomainBoard = {
  title: string;
  tone: Tone;
  summary: string;
  metrics: DomainMetric[];
};

type FocusItem = {
  label: string;
  value: string;
  tone: Tone;
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

const DASHBOARD_TEXT = {
  commandCenter: "值班总判台",
  dutyFocus: "当前值守重点",
  mainLoop: "主链路状态带",
  alarmQueue: "告警影响队列",
  comfortResult: "舒适结果",
  efficiencyTrend: "效率趋势",
  deltaTrend: "换热温差趋势",
  actionCenter: "可执行处置中心",
  controlWatch: "人工接管观察",
  handover: "交接班条带",
  safety: "安全",
  comfort: "舒适",
  efficiency: "效率",
  focusUpdatedAt: "最近聚合",
  focusSite: "站点",
  focusCooledRooms: "供冷中房间",
  focusWorkOrders: "待跟进工单",
  focusSupplyChain: "主链路",
  safetyHigh: "高等级异常",
  safetyLoopAlarm: "主链路告警设备",
  safetyManual: "人工接管关注",
  comfortCompliance: "舒适达标率",
  comfortOutOfRange: "越限房间数",
  comfortCooledRooms: "供冷中房间",
  efficiencyCop: "当前 COP",
  efficiencyPower: "总站功率",
  efficiencyDelta: "冷冻/冷却温差",
  controlClear: "主链路暂未发现就地、手动或禁用信号。",
  controlFallback: "当前仅展示已接入设备详情的接管信号。",
  handoverNoOps: "操作记录源当前未回传，交接班先以下列未闭环事项为准。",
  handoverRuleHint: "规则引擎与建议链路同步展示在此，便于交接时确认当前策略侧风险。",
  comfortCompatibleHint: "舒适达标按设定温度偏差 ±1°C 兼容估算，供冷中房间来自兼容判据。",
  comfortEmpty: "环境点位尚未回传，当前无法计算房间舒适结果。",
  anomalyEmpty: "当前没有需要优先排队的异常事件。",
  actionEmpty: "当前没有可执行建议，建议先检查下方规则诊断与来源状态。",
  quickAccessHint: "值班页只保留高频入口，其他分析与配置继续放在左侧导航。",
  impactSupply: "影响供冷",
  impactComfort: "影响舒适",
  impactOperation: "需值守关注",
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
  trendHint: "首页已把不同单位拆成独立卡，不再混画。",
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

function buildSparkPath(points: Array<{ value: number | null }>): string {
  const numeric = points.map((point) => point.value).filter((value): value is number => typeof value === "number");
  if (numeric.length < 2) {
    return "";
  }

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const span = max === min ? Math.max(Math.abs(max), 1) : max - min;
  const width = 180;
  const height = 48;

  let index = 0;
  return points
    .map((point, pointIndex) => {
      if (typeof point.value !== "number") {
        return "";
      }
      const x = points.length === 1 ? 0 : (pointIndex / (points.length - 1)) * width;
      const y = height - ((point.value - min) / span) * height;
      const command = index === 0 ? "M" : "L";
      index += 1;
      return `${command}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
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
      title: DASHBOARD_TEXT.verdictDataTitle,
      description: DASHBOARD_TEXT.verdictDataDesc,
      tone: "neutral",
      focusItems: [
        { label: "来源状态", value: "存在回退或陈旧信号", tone: "neutral" },
        { label: zhCN.appShell.navAlarms, value: `${options.criticalCount}${zhCN.common.unitItem}高等级异常`, tone: options.criticalCount > 0 ? "warn" : "neutral" },
        { label: DASHBOARD_TEXT.actionCenter, value: `${options.recommendationCount}${zhCN.common.unitItem}待确认建议`, tone: "neutral" }
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
          tone: "warn"
        },
        {
          label: DASHBOARD_TEXT.controlWatch,
          value: `${options.manualAttentionCount}${zhCN.realtimeStatus.unitTai}存在就地、手动或禁用`,
          tone: options.manualAttentionCount > 0 ? "warn" : "neutral"
        },
        {
          label: zhCN.appShell.navSceneControl,
          value: "优先确认主机、泵组、塔组供冷连续性",
          tone: "neutral"
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
          tone: "warn"
        },
        {
          label: DASHBOARD_TEXT.comfortRank,
          value:
            options.comfortWorstRoom && options.comfortWorstRoom.deviation != null
              ? `${options.comfortWorstRoom.name} ${options.comfortWorstRoom.deviation > 0 ? "+" : ""}${options.comfortWorstRoom.deviation.toFixed(1)}°C`
              : "等待环境点位",
          tone: options.comfortWorstRoom ? comfortTone(options.comfortWorstRoom.deviation) : "neutral"
        },
        {
          label: DASHBOARD_TEXT.comfortCooledRooms,
          value: `${options.cooledRoomsCount}/${options.totalRoomsCount || "--"}`,
          tone: "neutral"
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
        { label: DASHBOARD_TEXT.efficiencyCop, value: toFixedOrDash(options.currentCop, 2), tone: "good" },
        { label: DASHBOARD_TEXT.actionCenter, value: `${options.recommendationCount}${zhCN.common.unitItem}可执行建议`, tone: "neutral" },
        { label: zhCN.appShell.navEnergyEfficiency, value: "优先查看 COP、温差与建议动作", tone: "neutral" }
      ]
    };
  }

  return {
    title: DASHBOARD_TEXT.verdictStableTitle,
    description: DASHBOARD_TEXT.verdictStableDesc,
    tone: "good",
    focusItems: [
      { label: zhCN.appShell.navSceneControl, value: "主链路暂未发现异常或接管信号", tone: "good" },
      { label: DASHBOARD_TEXT.comfortCooledRooms, value: `${options.cooledRoomsCount}${zhCN.common.unitItem}`, tone: "neutral" },
      { label: DASHBOARD_TEXT.actionCenter, value: `${options.recommendationCount}${zhCN.common.unitItem}建议待评估`, tone: "neutral" }
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

    async function load() {
      const failed: string[] = [];
      let buildingId = "1";
      let buildingResult: EnvironmentBuildingListDto | null = null;

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

      const normalizedDevices = mainLoopCatalog.map((item) => normalizeDeviceView(item, detailMap.get(item?.deviceId || "") || null));

      startTransition(() => {
        setOverview(overviewData);
        setTrends(trendsData);
        setAnomalySummary(anomalySummaryData);
        setAnomalyList(anomalyListData);
        setEnvironmentAll(environmentAllData);
        setEnvironmentCooled(environmentCooledData);
        setWorkOrders(workOrdersData);
        setDeviceSourceStatus(deviceListData?.sourceStatus || buildingResult?.sourceStatus || null);
        setMainLoopDevices(normalizedDevices);
        setLoadErrors(failed);
      });
    }

    load();
    return () => {
      active = false;
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
  const worstRooms = comfortRooms.slice(0, 5);

  const mainLoopStages = buildMainLoopStages(overview, mainLoopDevices);
  const manualAttentionDevices = mainLoopDevices.filter((item) => needsManualAttention(item));
  const manualAttentionCount = manualAttentionDevices.length;
  const mainLoopAlarmCount = mainLoopDevices.filter((item) => isAlarmStatus(item.alarmStatusText)).length;

  const anomalyQueue = buildAnomalyQueue(anomalySummary, anomalyList);
  const criticalCount = (anomalySummary?.counts?.critical ?? 0) + (anomalySummary?.counts?.major ?? 0);
  const currentCop = overview?.energyCards?.currentCop ?? null;
  const totalPower = overview?.energyCards?.totalPowerKw ?? null;
  const chilledDeltaT = overview?.energyCards?.chilledDeltaT ?? null;
  const coolingDeltaT = overview?.energyCards?.coolingDeltaT ?? null;
  const recommendationCount = recommendation?.summary?.total ?? Math.max(recommendationItems.filter((item) => item.id !== "rec-empty").length, 0);

  const sourceStatuses = [
    overview?.sourceStatus,
    trends?.sourceStatus,
    anomalySummary?.sourceStatus,
    anomalyList?.sourceStatus,
    environmentAll?.sourceStatus,
    environmentCooled?.sourceStatus,
    workOrders?.sourceStatus,
    deviceSourceStatus,
    recommendation?.sourceStatus
  ];
  const sourceWarnActive =
    loadErrors.length > 0 ||
    Boolean(recommendationLoadError) ||
    [overview?.freshness?.stale, trends?.freshness?.stale, anomalySummary?.freshness?.stale, anomalyList?.freshness?.stale].some(Boolean) ||
    sourceStatuses.some((item) => hasSourceFailure(item));

  const sourceBannerText =
    loadErrors.length > 0
      ? `${zhCN.dashboard.failedEndpointsPrefix}${loadErrors.map(formatFailedEndpoint).join("、")}${zhCN.dashboard.failedEndpointsSuffix}`
      : sourceWarnActive
        ? "值班数据已接通，但存在回退或陈旧信号。"
        : "值班数据已就绪，可直接用于首屏判断。";
  const sourceDetailLines = buildSourceStatusLines(sourceStatuses);
  const sourceDetailLinesCompact = buildSourceStatusLines(sourceStatuses, { labelMode: "short" });
  const mergedSourceDetailLines = Array.from(new Set([...sourceDetailLines, ...recommendationSourceStatusLines]));
  const mergedSourceDetailLinesCompact = Array.from(
    new Set([...sourceDetailLinesCompact, ...recommendationSourceStatusLinesCompact])
  );

  const verdict = deriveVerdict({
    sourceWarn: sourceWarnActive,
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

  const domainBoards: DomainBoard[] = [
    {
      title: DASHBOARD_TEXT.safety,
      tone: criticalCount > 0 || mainLoopAlarmCount > 0 || manualAttentionCount > 0 ? "warn" : "good",
      summary: "先判断系统是否还在稳定供冷，以及是否已经进入人工接管态。",
      metrics: [
        {
          label: DASHBOARD_TEXT.safetyHigh,
          value: `${criticalCount}${zhCN.common.unitItem}`,
          tone: criticalCount > 0 ? "warn" : "good",
          hint: "高等级异常优先于一般波动"
        },
        {
          label: DASHBOARD_TEXT.safetyLoopAlarm,
          value: `${mainLoopAlarmCount}${zhCN.realtimeStatus.unitTai}`,
          tone: mainLoopAlarmCount > 0 ? "warn" : "good",
          hint: "主机、泵、塔链路中的告警设备"
        },
        {
          label: DASHBOARD_TEXT.safetyManual,
          value: `${manualAttentionCount}${zhCN.realtimeStatus.unitTai}`,
          tone: manualAttentionCount > 0 ? "warn" : "neutral",
          hint: "就地 / 手动 / 禁用信号"
        }
      ]
    },
    {
      title: DASHBOARD_TEXT.comfort,
      tone: comfortRiskCount > 0 ? "warn" : "good",
      summary: DASHBOARD_TEXT.comfortCompatibleHint,
      metrics: [
        {
          label: DASHBOARD_TEXT.comfortCompliance,
          value: `${toPercentOrDash(comfortCompliancePct, 0)}%`,
          tone: comfortCompliancePct != null && comfortCompliancePct < 85 ? "warn" : "good",
          hint: "按设定偏差 ±1°C 估算"
        },
        {
          label: DASHBOARD_TEXT.comfortOutOfRange,
          value: `${comfortRiskCount}${zhCN.common.unitItem}`,
          tone: comfortRiskCount > 0 ? "warn" : "good",
          hint: "偏差大于 1°C 的房间"
        },
        {
          label: DASHBOARD_TEXT.comfortCooledRooms,
          value: `${cooledRoomsCount}${zhCN.common.unitItem}`,
          tone: cooledRoomsCount > 0 ? "neutral" : "warn",
          hint: DASHBOARD_TEXT.supplyCompatible
        }
      ]
    },
    {
      title: DASHBOARD_TEXT.efficiency,
      tone: currentCop != null && currentCop >= 3 ? "good" : "neutral",
      summary: "运行稳定后，值班视角再去看功率、COP 与换热温差。",
      metrics: [
        {
          label: DASHBOARD_TEXT.efficiencyCop,
          value: toFixedOrDash(currentCop, 2),
          tone: currentCop != null && currentCop >= 3 ? "good" : "neutral",
          hint: "主链路能效直观指标"
        },
        {
          label: DASHBOARD_TEXT.efficiencyPower,
          value: `${toFixedOrDash(totalPower, 1)} kW`,
          tone: totalPower != null ? "neutral" : "warn",
          hint: "当前聚合总功率"
        },
        {
          label: DASHBOARD_TEXT.efficiencyDelta,
          value: `${toFixedOrDash(chilledDeltaT, 1)} / ${toFixedOrDash(coolingDeltaT, 1)} °C`,
          tone: chilledDeltaT != null || coolingDeltaT != null ? "neutral" : "warn",
          hint: "冷冻 / 冷却侧温差"
        }
      ]
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

  const quickLinks = [
    {
      to: "/alarms",
      title: zhCN.appShell.navAlarms,
      description: "先看异常队列和高等级事件"
    },
    {
      to: "/scene-control",
      title: zhCN.appShell.navSceneControl,
      description: "处理主机、泵组、塔组运行链路"
    },
    {
      to: "/devices",
      title: zhCN.appShell.navDevices,
      description: "核查设备详情和接管信号"
    },
    {
      to: "/environment-conditions",
      title: zhCN.appShell.navEnvironment,
      description: "排查末端舒适与供冷覆盖"
    },
    {
      to: "/cold-station-logs",
      title: zhCN.appShell.navColdStationLog,
      description: "查运行记录与逐时明细"
    },
    {
      to: "/work-orders",
      title: zhCN.appShell.navWorkOrders,
      description: "交接工单和待处理事项"
    }
  ];

  const efficiencyTrendCards = [
    buildTrendMetricView(trends, "totalPowerKw", DASHBOARD_TEXT.efficiencyPower, runtimeConfig.trendRange),
    buildTrendMetricView(trends, "currentCop", DASHBOARD_TEXT.efficiencyCop, runtimeConfig.trendRange)
  ].filter((item): item is TrendMetricView => Boolean(item));

  const deltaTrendCards = [
    buildTrendMetricView(trends, "chilledDeltaT", "冷冻侧温差", runtimeConfig.trendRange),
    buildTrendMetricView(trends, "coolingDeltaT", "冷却侧温差", runtimeConfig.trendRange)
  ].filter((item): item is TrendMetricView => Boolean(item));

  const heroTitle = overview?.site?.siteName || zhCN.appShell.stationName;
  const heroGeneratedAt = formatGeneratedAt(overview?.generatedAt || trends?.generatedAt || workOrders?.generatedAt);

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
              <h1>{verdict.title}</h1>
              <p>{verdict.description}</p>
            </div>
            <ReadinessBadge pageKey="dashboard" />
          </div>

          <div className="dashboard-command-meta">
            <span className={sourceWarnActive ? "is-warn" : "is-good"}>{sourceWarnActive ? "数据需复核" : "可直接判断"}</span>
            <span>
              {DASHBOARD_TEXT.focusSite}
              {heroTitle}
            </span>
            <span>
              {DASHBOARD_TEXT.focusUpdatedAt}
              {heroGeneratedAt}
            </span>
            <span>
              {DASHBOARD_TEXT.focusCooledRooms}
              {cooledRoomsCount}
              {zhCN.common.unitItem}
            </span>
            <span>
              {DASHBOARD_TEXT.focusWorkOrders}
              {workOrders?.total ?? 0}
              {zhCN.common.unitItem}
            </span>
          </div>

          <div className="dashboard-domain-grid">
            {domainBoards.map((board) => (
              <article key={board.title} className={`dashboard-domain-card tone-${board.tone}`}>
                <header>
                  <div>
                    <span>{board.title}</span>
                    <strong>{board.summary}</strong>
                  </div>
                </header>
                <div className="dashboard-domain-metrics">
                  {board.metrics.map((metric) => (
                    <div key={metric.label} className={`dashboard-domain-metric tone-${metric.tone}`}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <small>{metric.hint}</small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="dashboard-command-side">
          <div className="dashboard-side-panel">
            <h3>{DASHBOARD_TEXT.dutyFocus}</h3>
            <ul className="dashboard-focus-list">
              {verdict.focusItems.map((item) => (
                <li key={item.label} className={`tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <SectionCard title={DASHBOARD_TEXT.mainLoop}>
        <div className="dashboard-loop-grid">
          {mainLoopStages.map((stage) => (
            <article key={stage.key} className={`dashboard-loop-card ${stage.attention > 0 || stage.alarm > 0 ? "is-warn" : "is-good"}`}>
              <div className="dashboard-loop-head">
                <span>{stage.title}</span>
                <strong>{stage.total}</strong>
              </div>
              <div className="dashboard-loop-stats">
                <small>
                  {DASHBOARD_TEXT.mainLoopRunning}
                  {stage.running}
                </small>
                <small>
                  {DASHBOARD_TEXT.mainLoopStopped}
                  {stage.stopped}
                </small>
                <small>
                  {DASHBOARD_TEXT.mainLoopAlarm}
                  {stage.alarm}
                </small>
                <small>
                  {DASHBOARD_TEXT.mainLoopAttention}
                  {stage.attention}
                </small>
              </div>
              <p>{stage.note}</p>
              <time>{formatShortDateTime(stage.latestUpdateAt)}</time>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.sceneControl.sectionQuickAccess} action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.quickAccessHint}</span>}>
        <div className="dashboard-duty-links">
          {quickLinks.map((item) => (
            <Link key={item.to} to={item.to} className="dashboard-duty-link">
              <span>{item.description}</span>
              <strong>{item.title}</strong>
              <small>
                <ArrowUpRight size={14} />
                {zhCN.dashboard.quickOpen}
              </small>
            </Link>
          ))}
        </div>
      </SectionCard>

      <section className="dashboard-duty-layout">
        <div className="dashboard-duty-main">
          <SectionCard title={DASHBOARD_TEXT.alarmQueue}>
            {anomalyQueue.length === 0 ? (
              <p className="empty-hint">{DASHBOARD_TEXT.anomalyEmpty}</p>
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
          </SectionCard>

          <SectionCard
            title={DASHBOARD_TEXT.comfortResult}
            action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.comfortCompatibleHint}</span>}
          >
            {comfortRooms.length === 0 ? (
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

          <SectionCard title={DASHBOARD_TEXT.efficiencyTrend} action={<button type="button" className="dashboard-utility-button">{formatRangeLabel(runtimeConfig.trendRange)}</button>}>
            <div className="dashboard-trend-grid">
              {efficiencyTrendCards.length === 0 ? (
                <p className="empty-hint">{zhCN.dashboard.trendEndpointUnavailable}</p>
              ) : (
                efficiencyTrendCards.map((card) => (
                  <article key={card.key} className="dashboard-trend-card">
                    <div className="dashboard-trend-card-head">
                      <span>{card.label}</span>
                      <strong>
                        {toFixedOrDash(card.latest, 2)}
                        {card.unit ? <em>{card.unit}</em> : null}
                      </strong>
                    </div>
                    {buildSparkPath(card.points) ? (
                      <svg viewBox="0 0 180 48" aria-hidden="true">
                        <path d={buildSparkPath(card.points)} />
                      </svg>
                    ) : (
                      <p className="empty-hint">{DASHBOARD_TEXT.trendEmpty}</p>
                    )}
                    <div className="dashboard-trend-stats">
                      <small>{DASHBOARD_TEXT.trendLatest} {toFixedOrDash(card.latest, 2)}</small>
                      <small>{DASHBOARD_TEXT.trendMin} {toFixedOrDash(card.min, 2)}</small>
                      <small>{DASHBOARD_TEXT.trendMax} {toFixedOrDash(card.max, 2)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title={DASHBOARD_TEXT.deltaTrend} action={<span className="dashboard-section-hint">{DASHBOARD_TEXT.trendHint}</span>}>
            <div className="dashboard-trend-grid">
              {deltaTrendCards.length === 0 ? (
                <p className="empty-hint">{zhCN.dashboard.trendEndpointUnavailable}</p>
              ) : (
                deltaTrendCards.map((card) => (
                  <article key={card.key} className="dashboard-trend-card">
                    <div className="dashboard-trend-card-head">
                      <span>{card.label}</span>
                      <strong>
                        {toFixedOrDash(card.latest, 2)}
                        {card.unit ? <em>{card.unit}</em> : null}
                      </strong>
                    </div>
                    {buildSparkPath(card.points) ? (
                      <svg viewBox="0 0 180 48" aria-hidden="true">
                        <path d={buildSparkPath(card.points)} />
                      </svg>
                    ) : (
                      <p className="empty-hint">{DASHBOARD_TEXT.trendEmpty}</p>
                    )}
                    <div className="dashboard-trend-stats">
                      <small>{DASHBOARD_TEXT.trendLatest} {toFixedOrDash(card.latest, 2)}</small>
                      <small>{DASHBOARD_TEXT.trendMin} {toFixedOrDash(card.min, 2)}</small>
                      <small>{DASHBOARD_TEXT.trendMax} {toFixedOrDash(card.max, 2)}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="dashboard-duty-side">
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

          <SectionCard title={DASHBOARD_TEXT.controlWatch}>
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
        warn={sourceWarnActive}
        detailLines={mergedSourceDetailLines}
        detailLinesCompact={mergedSourceDetailLinesCompact}
      />
    </div>
  );
}
