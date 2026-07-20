import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import "./DeviceOverviewShared.css";
import OperationalTruthBadges, {
  resolveOperationalDataState
} from "../components/common/OperationalTruthBadges";
import {
  isAppliedStationRuntimeScope,
  useStationRuntimeScope
} from "../context/StationRuntimeScopeContext";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import LazyDeviceModelPreview from "../components/device/LazyDeviceModelPreview";
import { type DeviceModelRuntimeVariant } from "../config/modelRegistry";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  ENERGY_STATION_INSTANCE_QUERY_KEY,
  ENERGY_STATION_QUERY_KEY
} from "../config/energyStationNavigation";
import useAiDigest from "../hooks/useAiDigest";
import { summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, zhCN } from "../i18n/zhCN";
import {
  type DashboardOverviewDto,
  type DeviceDetailDto,
  type DeviceListDto,
  type DeviceListItemDto,
  type SourceStatusDto,
  type DeviceTreeDto,
  type DeviceTreeNodeDto,
  type SystemTopologyDto,
  fetchDashboardOverview,
  fetchDeviceDetail,
  fetchDeviceDetails,
  fetchDeviceList,
  fetchDeviceTree,
  fetchSystemTopology
} from "../services/bffClient";
import { SITE_ID_QUERY_KEY } from "../services/siteRouting";
import { resolveUnifiedStatusTone } from "../utils/statusTone";

type FloorGroup = {
  floor: string;
  count: number;
};

type DevicePageTabKey = "navigation" | "list";

type DeviceDetailRecord = {
  label: string;
  deviceCode: string;
  systemType: string;
  floorName: string;
  buildingName: string;
  lastReportAt: string;
  nodeType: string;
  childCount: string;
  pointCount: string;
  deviceIdRef: string;
  runStatusText: string;
  alarmStatusText: string;
  usageType: string;
  isVirtual: string;
};

type DeviceRuntimeState = "running" | "stopped" | "unknown";

type DeviceGroupSummary = {
  id: string;
  label: string;
  meta: string;
  total: number;
  running: number;
  stopped: number;
  unknown: number;
  nodes: DeviceTreeNodeDto[];
};

type AssetTypeSummary = {
  label: string;
  count: number;
};

type SourceLinkRow = {
  label: string;
  state: string;
  detail: string;
  tone: "good" | "warn" | "neutral" | "danger";
};

const DEVICE_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0
});

const ASSET_TYPE_ORDER = ["主机", "冷冻水泵", "冷却水泵", "冷却塔组", "冷却塔风机", "开关阀门"];

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSizeParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return parsed === 8 || parsed === 12 || parsed === 20 ? parsed : fallback;
}

function parseOptionalSceneMode(value: string | null): "2d" | "3d" | null {
  if (value === "2d" || value === "3d") {
    return value;
  }
  return null;
}

function parseNumericValue(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  const text = String(raw || "").replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRealtimePowerKw(detail: DeviceDetailDto["detail"] | null | undefined): number | null {
  if (!detail) {
    return null;
  }

  const directCandidates = [
    (detail as { realtimePowerKw?: unknown }).realtimePowerKw,
    (detail as { currentPowerKw?: unknown }).currentPowerKw,
    (detail as { powerKw?: unknown }).powerKw,
    (detail as { currentPower?: unknown }).currentPower,
    (detail as { power?: unknown }).power
  ];
  for (const candidate of directCandidates) {
    const parsed = parseNumericValue(candidate as string | number | null | undefined);
    if (parsed != null) {
      return parsed;
    }
  }

  const signals = detail.controlSignals || [];
  const preferred = signals.filter((signal) => {
    const label = String(signal?.label || "").toLowerCase();
    const key = String(signal?.key || "").toLowerCase();
    const text = `${label} ${key}`;
    return /power|kw|kilowatt|load|\u529f\u7387|\u8d1f\u8377/.test(text);
  });
  const fallback = signals.filter((signal) => !preferred.includes(signal));

  for (const signal of [...preferred, ...fallback]) {
    const parsed = parseNumericValue(signal?.value as string | number | null | undefined);
    if (parsed != null) {
      return parsed;
    }
  }

  return null;
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return DEVICE_COUNT_FORMATTER.format(value);
}

function mapSystemTypeLabel(value: string | null | undefined): string {
  if (value === "chiller") {
    return zhCN.devicePage.systemTypeChiller;
  }
  if (value === "chilledPump") {
    return zhCN.devicePage.systemTypeChilledPump;
  }
  if (value === "coolingPump") {
    return zhCN.devicePage.systemTypeCoolingPump;
  }
  if (value === "coolingTower") {
    return zhCN.devicePage.systemTypeCoolingTower;
  }
  return zhCN.devicePage.systemTypeOther;
}

function containsChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function normalizeStatusValue(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isUnknownStatus(value: string): boolean {
  return ["", "-", "--", "unknown", "n/a", "na", "null", "undefined"].includes(value);
}

function parseNumericStatus(value: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRunningStatus(value: string): boolean {
  return [
    "online",
    "running",
    "run",
    "active",
    "open",
    "opened",
    "start",
    "started",
    "on",
    "normal",
    "healthy",
    "ready"
  ].some((token) => value.includes(token));
}

function isStoppedStatus(value: string): boolean {
  return [
    "offline",
    "stopped",
    "stop",
    "shutdown",
    "down",
    "inactive",
    "close",
    "closed",
    "off"
  ].some((token) => value.includes(token));
}

function isAlarmStatus(value: string): boolean {
  return [
    "alarm",
    "alert",
    "fault",
    "error",
    "trip",
    "abnormal",
    "warning",
    "warn",
    "failed",
    "failure"
  ].some((token) => value.includes(token));
}

function isStandbyStatus(value: string): boolean {
  return ["standby", "idle", "waiting", "wait"].some((token) => value.includes(token));
}

function isMaintenanceStatus(value: string): boolean {
  return ["maintenance", "repair", "service", "servicing"].some((token) => value.includes(token));
}

function isNormalStatus(value: string): boolean {
  return [
    "normal",
    "ok",
    "healthy",
    "clear",
    "resolved",
    "recover",
    "stable",
    "safe",
    "no alarm",
    "normal state",
    "正常",
    "已恢复",
    "无报警",
    "不报警"
  ].some((token) => value.includes(token));
}

function mapDeviceStatusLabel(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const normalized = normalizeStatusValue(value);
  if (isUnknownStatus(normalized)) {
    return zhCN.devicePage.statusUnknown;
  }
  const numericStatus = parseNumericStatus(normalized);
  if (numericStatus != null) {
    if (numericStatus <= 0) {
      return "离线";
    }
    if (numericStatus >= 2) {
      return "告警";
    }
    return "在线";
  }
  if (isRunningStatus(normalized)) {
    return "在线";
  }
  if (isStoppedStatus(normalized)) {
    return "离线";
  }
  if (isAlarmStatus(normalized)) {
    return "告警";
  }
  if (isStandbyStatus(normalized)) {
    return "待机";
  }
  if (isMaintenanceStatus(normalized)) {
    return "检修";
  }
  if (containsChineseText(raw)) {
    return raw;
  }
  return zhCN.devicePage.statusUnknown;
}

function mapDeviceRuntimeStatusLabel(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const normalized = normalizeStatusValue(value);
  if (isUnknownStatus(normalized)) {
    return zhCN.devicePage.statusUnknown;
  }
  const numericStatus = parseNumericStatus(normalized);
  if (numericStatus != null) {
    if (numericStatus <= 0) {
      return "已停止";
    }
    if (numericStatus >= 2) {
      return "告警中";
    }
    return "运行中";
  }
  if (isRunningStatus(normalized)) {
    return "运行中";
  }
  if (isStoppedStatus(normalized)) {
    return "已停止";
  }
  if (isAlarmStatus(normalized)) {
    return "告警中";
  }
  if (isStandbyStatus(normalized)) {
    return "待机";
  }
  if (isMaintenanceStatus(normalized)) {
    return "检修中";
  }
  if (containsChineseText(raw)) {
    return raw;
  }
  return zhCN.devicePage.statusUnknown;
}

function mapDeviceAlarmStatusLabel(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  const normalized = normalizeStatusValue(value);
  if (isUnknownStatus(normalized)) {
    return zhCN.devicePage.statusUnknown;
  }
  const numericStatus = parseNumericStatus(normalized);
  if (numericStatus != null) {
    return numericStatus > 0 ? "告警中" : "正常";
  }
  if (isAlarmStatus(normalized)) {
    return "告警中";
  }
  if (isNormalStatus(normalized)) {
    return "正常";
  }
  if (containsChineseText(raw)) {
    if (/报警|告警|故障/.test(raw)) {
      return "告警中";
    }
    if (/正常|恢复|无报警|不报警/.test(raw)) {
      return "正常";
    }
    return raw;
  }
  return zhCN.devicePage.statusUnknown;
}

function composeRuntimeAlarmStatusLabel(
  runtimeValue: string | null | undefined,
  alarmValue: string | null | undefined
): string {
  const runtimeStatusLabel = mapDeviceRuntimeStatusLabel(runtimeValue);
  const alarmStatusLabel = mapDeviceAlarmStatusLabel(alarmValue);
  const isRunning = runtimeStatusLabel === "运行中";
  const hasAlarm =
    alarmStatusLabel === "告警中"
    || alarmStatusLabel === "报警中"
    || alarmStatusLabel === "故障中";
  if (hasAlarm) {
    return isRunning ? "运行中/报警中" : "已停止/报警中";
  }
  return isRunning ? "运行中" : "已停止";
}

function resolveRuntimeVariantFromStatusText(value: string | null | undefined): DeviceModelRuntimeVariant | null {
  const text = String(value || "").toLowerCase();
  if (!text) {
    return null;
  }
  if (/故障|报警|告警|alarm|fault|error|alert|trip|abnormal|failed|failure/.test(text)) {
    return "fault";
  }
  if (/运行|在线|running|run|online|active|open|start|on/.test(text)) {
    return "running";
  }
  if (/停止|离线|待机|offline|stopped|stop|shutdown|down|inactive|off|standby|idle/.test(text)) {
    return "idle";
  }
  return null;
}

function resolveRuntimeVariantFromTreeNodeStatus(node: DeviceTreeNodeDto | null | undefined): DeviceModelRuntimeVariant | null {
  if (!node || node.nodeType !== "device") {
    return null;
  }

  const mappedLabel = mapDeviceRuntimeStatusLabel(node.status);
  return resolveRuntimeVariantFromStatusText(`${String(node.status || "")} ${mappedLabel}`);
}

function mapTreeNodeTypeLabel(value: string | null | undefined): string {
  if (value === "root") {
    return zhCN.devicePage.treeNodeRoot;
  }
  if (value === "group") {
    return zhCN.devicePage.treeNodeGroup;
  }
  if (value === "device") {
    return zhCN.devicePage.treeNodeDevice;
  }
  return zhCN.devicePage.treeNodePoint;
}

function withGroupSuffixIfNeeded(label: string | null | undefined, nodeType: string | null | undefined): string {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) {
    return zhCN.common.unknown;
  }
  if (nodeType !== "group") {
    return normalizedLabel;
  }

  const locale = getCurrentLocale();
  if (locale !== "zh-CN") {
    return normalizedLabel;
  }

  const match = /^(.+?)(\s*\(.*\))?$/.exec(normalizedLabel);
  const base = String(match?.[1] || normalizedLabel).trim();
  const suffix = match?.[2] || "";
  if (base.endsWith("组")) {
    return `${base}${suffix}`;
  }
  return `${base}组${suffix}`;
}

function isMeaningfulSpaceValue(value: string | null | undefined): boolean {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  const lowered = normalized.toLowerCase();
  return !["unknown", "未知", "默认", "0", "null", "undefined", "-", "--"].includes(lowered);
}

function getDisplaySpaceValue(value: string | null | undefined, fallback: string): string {
  return isMeaningfulSpaceValue(value) ? String(value).trim() : fallback;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTimeToSecond(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw || raw === zhCN.common.timeUnknown) {
    return zhCN.common.timeUnknown;
  }

  const directDate = new Date(raw);
  let date = Number.isNaN(directDate.getTime()) ? null : directDate;

  if (!date) {
    const normalized = raw
      .replace(/\//g, "-")
      .replace(" ", "T")
      .replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/, "$1:00");
    const nextDate = new Date(normalized);
    date = Number.isNaN(nextDate.getTime()) ? null : nextDate;
  }

  if (!date) {
    return raw;
  }

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDateTimeCompact(value: string | null | undefined): string {
  const full = formatDateTimeToSecond(value);
  if (full === zhCN.common.timeUnknown) {
    return full;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(full);
  return match ? `${Number(match[2])}/${Number(match[3])} ${match[4]}:${match[5]}` : full;
}

function hasFallbackSource(sourceStatus: SourceStatusDto | null | undefined): boolean {
  return Boolean(sourceStatus?.sources?.some((item) => item.fallback === true));
}

function buildFloorGroups(topology: SystemTopologyDto | null): FloorGroup[] {
  const grouped = new Map<string, number>();
  for (const item of topology?.groups || []) {
    const floor = getDisplaySpaceValue(item.floor, "");
    if (!floor) {
      continue;
    }
    grouped.set(floor, (grouped.get(floor) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([floor, count]) => ({ floor, count }))
    .sort((left, right) => right.count - left.count);
}

function getGeneratedAtLabel(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const formatted = formatDateTimeToSecond(candidate);
    if (formatted && formatted !== zhCN.common.timeUnknown) {
      return formatted;
    }
  }
  return zhCN.common.timeUnknown;
}

function classifyRuntimeState(label: string | null | undefined): DeviceRuntimeState {
  const normalized = String(label || "").trim();
  if (!normalized || normalized === zhCN.devicePage.statusUnknown || normalized === zhCN.devicePage.detailValuePending) {
    return "unknown";
  }
  if (/运行|在线|running|online|active/i.test(normalized)) {
    return "running";
  }
  if (/停止|离线|待机|stopped|offline|idle|standby|off/i.test(normalized)) {
    return "stopped";
  }
  return "unknown";
}

function collectDeviceNodes(node: DeviceTreeNodeDto | null | undefined): DeviceTreeNodeDto[] {
  if (!node) {
    return [];
  }
  const result: DeviceTreeNodeDto[] = [];
  function walk(current: DeviceTreeNodeDto | null | undefined) {
    if (!current) {
      return;
    }
    if (current.nodeType === "device") {
      result.push(current);
    }
    for (const child of current.children || []) {
      walk(child);
    }
  }
  walk(node);
  return result;
}

function getRuntimeLabelForTreeNode(node: DeviceTreeNodeDto, runtimeStatusByDeviceId: Map<string, string>): string {
  const override = node.deviceIdRef ? runtimeStatusByDeviceId.get(node.deviceIdRef) : null;
  return override || mapDeviceRuntimeStatusLabel(node.status);
}

function normalizeGroupLabel(label: string | null | undefined): string {
  const value = withGroupSuffixIfNeeded(label, "group");
  if (/冷却塔|cooling tower/i.test(value)) {
    return "冷却塔及风机";
  }
  if (/冷冻水泵|chilled/i.test(value)) {
    return "冷冻水泵";
  }
  if (/冷却水泵|cooling pump/i.test(value)) {
    return "冷却水泵";
  }
  if (/冷水机组|冷机|chiller/i.test(value)) {
    return "冷水机组";
  }
  return value;
}

function getGroupMeta(label: string, total: number): string {
  if (label === "冷水机组") {
    return `${formatCount(total)}项 · 主供冷设备`;
  }
  if (label === "冷冻水泵") {
    return `${formatCount(total)}项 · 输送侧`;
  }
  if (label === "冷却水泵") {
    return `${formatCount(total)}项 · 冷却侧`;
  }
  if (label === "冷却塔及风机") {
    return `${formatCount(total)}项 · 含塔组与风机`;
  }
  return `${formatCount(total)}项`;
}

function buildDeviceGroupSummaries(
  root: DeviceTreeNodeDto | null | undefined,
  runtimeStatusByDeviceId: Map<string, string>
): DeviceGroupSummary[] {
  const groups = (root?.children || [])
    .map((node) => {
      const deviceNodes = collectDeviceNodes(node);
      if (deviceNodes.length === 0) {
        return null;
      }
      const counts = deviceNodes.reduce(
        (acc, deviceNode) => {
          const state = classifyRuntimeState(getRuntimeLabelForTreeNode(deviceNode, runtimeStatusByDeviceId));
          acc[state] += 1;
          return acc;
        },
        { running: 0, stopped: 0, unknown: 0 }
      );
      const label = normalizeGroupLabel(node.label);
      return {
        id: node.id || label,
        label,
        meta: getGroupMeta(label, deviceNodes.length),
        total: deviceNodes.length,
        running: counts.running,
        stopped: counts.stopped,
        unknown: counts.unknown,
        nodes: deviceNodes
      };
    })
    .filter((item): item is DeviceGroupSummary => Boolean(item));

  const order = ["冷水机组", "冷冻水泵", "冷却水泵", "冷却塔及风机"];
  return groups.sort((left, right) => {
    const leftIndex = order.indexOf(left.label);
    const rightIndex = order.indexOf(right.label);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}

function findDefaultDeviceNode(
  root: DeviceTreeNodeDto | null | undefined,
  runtimeStatusByDeviceId: Map<string, string>
): DeviceTreeNodeDto | null {
  const groups = buildDeviceGroupSummaries(root, runtimeStatusByDeviceId);
  const orderedNodes = groups.flatMap((group) => group.nodes);
  const runningNode = orderedNodes.find(
    (node) => classifyRuntimeState(getRuntimeLabelForTreeNode(node, runtimeStatusByDeviceId)) === "running"
  );
  return runningNode || orderedNodes[0] || null;
}

function formatAssetTypeLabel(item: DeviceListItemDto): string {
  const raw = `${item.deviceTypeName || ""} ${item.deviceName || ""} ${item.usageType || ""}`;
  if (/阀|valve/i.test(raw)) {
    return "开关阀门";
  }
  if (/冷却塔风机|塔风机|风机|fan/i.test(raw)) {
    return "冷却塔风机";
  }
  if (/冷却塔|tower/i.test(raw)) {
    return "冷却塔组";
  }
  if (item.systemType === "chiller" || /主机|冷水机|冷机|chiller/i.test(raw)) {
    return "主机";
  }
  if (item.systemType === "chilledPump" || /冷冻水泵|chilled/i.test(raw)) {
    return "冷冻水泵";
  }
  if (item.systemType === "coolingPump" || /冷却水泵|cooling pump/i.test(raw)) {
    return "冷却水泵";
  }
  return item.deviceTypeName || mapSystemTypeLabel(item.systemType);
}

function buildAssetTypeSummaries(items: DeviceListItemDto[]): AssetTypeSummary[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = formatAssetTypeLabel(item);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      const leftIndex = ASSET_TYPE_ORDER.indexOf(left.label);
      const rightIndex = ASSET_TYPE_ORDER.indexOf(right.label);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      }
      return right.count - left.count;
    });
}

function isSourceStatusOk(sourceStatus: SourceStatusDto | null | undefined): boolean {
  return Boolean(sourceStatus && sourceStatus.overall !== "failed" && sourceStatus.sources?.some((item) => item.ok !== false));
}

function findSources(sourceStatuses: Array<SourceStatusDto | null | undefined>, matcher: RegExp) {
  return sourceStatuses.flatMap((status) =>
    (status?.sources || []).filter((source) => matcher.test(String(source.key || source.endpoint || "")))
  );
}

function buildSourceLinkRows(
  deviceList: DeviceListDto | null,
  deviceTree: DeviceTreeDto | null,
  pageSourceStatuses: Array<SourceStatusDto | null | undefined>
): SourceLinkRow[] {
  const realtimeSources = findSources(pageSourceStatuses, /realtime|runtime|parameter/i);
  const realtimeHealthy = realtimeSources.length > 0 && realtimeSources.every((source) => source.ok !== false);
  const realtimeState = realtimeHealthy ? "正常" : "待恢复";
  const realtimeDetail = realtimeHealthy ? "实时参数可用" : "实时参数需复核";
  const treeDeviceCount = collectDeviceNodes(deviceTree?.tree).length;
  return [
    {
      label: "设备清单",
      state: isSourceStatusOk(deviceList?.sourceStatus) ? "正常" : "待恢复",
      detail: `${formatCount(deviceList?.total)}项${deviceList?.sourceStatus?.sources?.[0]?.rows ? ` · rows ${formatCount(deviceList.sourceStatus.sources[0].rows)}` : ""}`,
      tone: isSourceStatusOk(deviceList?.sourceStatus) ? "good" : "warn"
    },
    {
      label: "设备树",
      state: isSourceStatusOk(deviceTree?.sourceStatus) ? "正常" : "待恢复",
      detail: `核心设备 ${formatCount(treeDeviceCount)}项`,
      tone: isSourceStatusOk(deviceTree?.sourceStatus) ? "good" : "warn"
    },
    {
      label: "实时参数",
      state: realtimeState,
      detail: realtimeDetail,
      tone: realtimeHealthy ? "good" : "warn"
    },
    {
      label: "模型库",
      state: "已接入",
      detail: "展示与识别",
      tone: "neutral"
    }
  ];
}

function flattenTree(root: DeviceTreeNodeDto | null | undefined) {
  const nodes: DeviceTreeNodeDto[] = [];
  const index = new Map<string, DeviceTreeNodeDto>();

  function walk(node: DeviceTreeNodeDto | null | undefined) {
    if (!node?.id) {
      return;
    }
    nodes.push(node);
    index.set(node.id, node);
    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(root);
  return { nodes, index };
}

function findFirstDeviceNode(root: DeviceTreeNodeDto | null | undefined): DeviceTreeNodeDto | null {
  if (!root) {
    return null;
  }
  if (root.nodeType === "device") {
    return root;
  }
  for (const child of root.children || []) {
    const found = findFirstDeviceNode(child);
    if (found) {
      return found;
    }
  }
  return null;
}

function buildDeviceDetailRecord(
  node: DeviceTreeNodeDto | null,
  currentPageItems: DeviceListItemDto[],
  detailDto: DeviceDetailDto | null
): DeviceDetailRecord | null {
  if (!node) {
    return null;
  }

  const matchedDevice =
    currentPageItems.find((item) => item.deviceId && item.deviceId === node.deviceIdRef) || null;
  const detail = detailDto?.detail || null;
  const merged = {
    deviceName: detail?.deviceName || matchedDevice?.deviceName || node.deviceName || node.label || zhCN.common.unknown,
    deviceCode: detail?.deviceCode || matchedDevice?.deviceCode || node.deviceCode || zhCN.common.unknown,
    systemType: matchedDevice?.systemType || node.systemType || null,
    floorName: detail?.floorName || matchedDevice?.floorName || node.floorName || "",
    buildingName: detail?.buildingName || matchedDevice?.buildingName || node.buildingName || "",
    status: mapDeviceStatusLabel(matchedDevice?.status || node.status || zhCN.devicePage.statusUnknown),
    lastReportAt: formatDateTimeToSecond(
      detail?.latestUpdateAt || matchedDevice?.lastReportAt || node.lastReportAt || zhCN.common.timeUnknown
    ),
    runStatusText: detail?.runStatusText || zhCN.devicePage.detailValuePending,
    alarmStatusText: detail?.alarmStatusText || zhCN.devicePage.detailValuePending,
    usageType: detail?.usageType || matchedDevice?.usageType || zhCN.common.unknown,
    isVirtual:
      detail?.isVirtual == null
        ? zhCN.devicePage.detailValuePending
        : detail.isVirtual
          ? zhCN.devicePage.detailVirtualYes
          : zhCN.devicePage.detailVirtualNo,
    deviceIdRef: node.deviceIdRef || zhCN.common.unknown
  };

  return {
    label: merged.deviceName,
    deviceCode: merged.deviceCode,
    systemType: mapSystemTypeLabel(merged.systemType),
    floorName: merged.floorName,
    buildingName: merged.buildingName,
    lastReportAt: merged.lastReportAt,
    nodeType: mapTreeNodeTypeLabel(node.nodeType),
    childCount: formatCount(node.childCount),
    pointCount: formatCount(detail?.pointCount ?? node.childCount),
    deviceIdRef: merged.deviceIdRef,
    runStatusText: merged.runStatusText,
    alarmStatusText: merged.alarmStatusText,
    usageType: merged.usageType,
    isVirtual: merged.isVirtual
  };
}

function renderDeviceRow(
  item: DeviceListItemDto,
  index: number,
  isSelected: boolean,
  onSelect: (deviceId: string | undefined) => void,
  spaceHierarchyEnabled: boolean,
  runtimeStatusLabelOverride?: string | null
) {
  const floorText = getDisplaySpaceValue(item.floorName, zhCN.devicePage.processViewValue);
  const buildingText = getDisplaySpaceValue(
    item.buildingName,
    spaceHierarchyEnabled ? zhCN.common.unknown : zhCN.devicePage.processViewCompact
  );
  const runtimeStatusLabel =
    runtimeStatusLabelOverride && runtimeStatusLabelOverride !== zhCN.devicePage.statusUnknown
      ? runtimeStatusLabelOverride
      : mapDeviceRuntimeStatusLabel(item.status);
  const runtimeStatusTone = resolveUnifiedStatusTone(runtimeStatusLabel);
  return (
    <button
      key={item.deviceId || `device-row-${index + 1}`}
      type="button"
      className={isSelected ? "device-table-row is-selected" : "device-table-row"}
      onClick={() => onSelect(item.deviceId)}
    >
      <span className="device-cell device-cell-primary" data-label={zhCN.devicePage.sectionList}>
        <strong>{item.deviceName || zhCN.common.unknown}</strong>
        <small>
          {item.deviceCode || zhCN.common.unknown}
          {item.isPlaceholder ? ` 路 ${zhCN.devicePage.placeholderLabel}` : ""}
        </small>
      </span>
      <span className="device-cell" data-label={zhCN.devicePage.filterType}>{mapSystemTypeLabel(item.systemType)}</span>
      <span className="device-cell" data-label={spaceHierarchyEnabled ? zhCN.devicePage.filterFloor : zhCN.devicePage.tableUsageType}>
        {spaceHierarchyEnabled ? floorText : item.usageType || mapSystemTypeLabel(item.systemType)}
      </span>
      <span className="device-cell" data-label={spaceHierarchyEnabled ? zhCN.devicePage.detailBuilding : zhCN.devicePage.tableView}>
        {spaceHierarchyEnabled ? buildingText : zhCN.devicePage.processViewCompact}
      </span>
      <span className="device-cell" data-label={zhCN.devicePage.detailStatus}>
        <StatusPill label={runtimeStatusLabel} tone={runtimeStatusTone} />
      </span>
    </button>
  );
}

export default function DeviceOverviewPage() {
  const stationRuntimeScope = useStationRuntimeScope();
  const siteId = stationRuntimeScope.projectSiteId || runtimeConfig.siteId;
  const { aiDigest } = useAiDigest(siteId);
  const runtimeStationId = stationRuntimeScope.runtimeStationId;
  const stationDataSiteId = runtimeStationId
    ? stationRuntimeScope.runtimeBindingSiteId || siteId
    : siteId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [topology, setTopology] = useState<SystemTopologyDto | null>(null);
  const [deviceList, setDeviceList] = useState<DeviceListDto | null>(null);
  const [assetDeviceList, setAssetDeviceList] = useState<DeviceListDto | null>(null);
  const [deviceTree, setDeviceTree] = useState<DeviceTreeDto | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<DeviceDetailDto | null>(null);
  const [treeRuntimeStatusByDeviceId, setTreeRuntimeStatusByDeviceId] = useState<Map<string, string>>(() => new Map());
  const [listError, setListError] = useState<string | null>(null);
  const [, setDetailError] = useState<string | null>(null);
  const [baseFailedCount, setBaseFailedCount] = useState<number | null>(null);
  const [listFailed, setListFailed] = useState<boolean | null>(null);
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page"), 1));
  const [pageSize, setPageSize] = useState(() => parsePageSizeParam(searchParams.get("pageSize"), 8));
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") || "");
  const [floorFilter, setFloorFilter] = useState(() => searchParams.get("floor") || "");
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [forcedModelRuntimeVariant, setForcedModelRuntimeVariant] = useState<DeviceModelRuntimeVariant | null>(null);
  const [activeTab, setActiveTab] = useState<DevicePageTabKey>("navigation");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isFloorDropdownOpen, setIsFloorDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const floorDropdownRef = useRef<HTMLDivElement | null>(null);
  const requestedDeviceId = searchParams.get("deviceId");
  const requestedSceneMode = parseOptionalSceneMode(searchParams.get("sceneMode"));
  const requestedSceneNodeId = searchParams.get("sceneNodeId") || "";

  useEffect(() => {
    setDeviceList(null);
    setAssetDeviceList(null);
    setDeviceTree(null);
    setDeviceDetail(null);
    setTreeRuntimeStatusByDeviceId(new Map());
    setSelectedTreeNodeId(null);
    setBaseFailedCount(null);
    setListFailed(null);
    setListError(null);
    setDetailError(null);
    setPage(1);
  }, [stationRuntimeScope.scopeKey]);

  useEffect(() => {
    let active = true;

    async function loadBaseData() {
      const [overviewResult, topologyResult, treeResult] = await Promise.allSettled([
        runtimeStationId ? Promise.resolve(null) : fetchDashboardOverview(siteId),
        runtimeStationId ? Promise.resolve(null) : fetchSystemTopology(siteId),
        fetchDeviceTree(stationDataSiteId, { stationId: runtimeStationId }).then((payload) => {
          if (runtimeStationId && !isAppliedStationRuntimeScope(payload.dataScope, stationRuntimeScope)) {
            throw new Error("Device tree did not prove the selected physical-station scope");
          }
          return payload;
        })
      ]);

      if (!active) {
        return;
      }

      startTransition(() => {
        const overviewData = overviewResult.status === "fulfilled" ? overviewResult.value : null;
        const topologyData = topologyResult.status === "fulfilled" ? topologyResult.value : null;
        const treeData = treeResult.status === "fulfilled" ? treeResult.value : null;
        const failed = runtimeStationId
          ? (treeData == null ? 1 : 0)
          : [overviewData, topologyData, treeData].filter((item) => item == null).length;

        setOverview(overviewData);
        setTopology(topologyData);
        setDeviceTree(treeData);
        setBaseFailedCount(failed);
      });
    }

    loadBaseData();
    return () => {
      active = false;
    };
  }, [runtimeStationId, siteId, stationDataSiteId, stationRuntimeScope.scopeKey]);

  useEffect(() => {
    let active = true;

    async function loadListData() {
      try {
        const listData = await fetchDeviceList(stationDataSiteId, {
          page,
          pageSize,
          type: typeFilter || undefined,
          floor: floorFilter || undefined,
          stationId: runtimeStationId
        });
        if (runtimeStationId && !isAppliedStationRuntimeScope(listData.dataScope, stationRuntimeScope)) {
          throw new Error("Device list did not prove the selected physical-station scope");
        }

        if (!active) {
          return;
        }

        startTransition(() => {
          setDeviceList(listData);
          setListError(null);
          setListFailed(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDeviceList(null);
          setListError(zhCN.devicePage.listLoadFailed);
          setListFailed(true);
        });
      }
    }

    loadListData();
    return () => {
      active = false;
    };
  }, [floorFilter, page, pageSize, runtimeStationId, stationDataSiteId, stationRuntimeScope.scopeKey, typeFilter]);

  useEffect(() => {
    let active = true;

    async function loadAssetDeviceList() {
      try {
        const listData = await fetchDeviceList(stationDataSiteId, {
          page: 1,
          pageSize: 200,
          stationId: runtimeStationId
        });
        if (runtimeStationId && !isAppliedStationRuntimeScope(listData.dataScope, stationRuntimeScope)) {
          throw new Error("Asset list did not prove the selected physical-station scope");
        }
        if (!active) {
          return;
        }
        startTransition(() => setAssetDeviceList(listData));
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => setAssetDeviceList(null));
      }
    }

    loadAssetDeviceList();
    return () => {
      active = false;
    };
  }, [runtimeStationId, stationDataSiteId, stationRuntimeScope.scopeKey]);

  const loadError = useMemo(() => {
    if (baseFailedCount == null && listFailed == null) {
      return null;
    }
    const failedCount = (baseFailedCount ?? 0) + (listFailed ? 1 : 0);
    if (failedCount >= (runtimeStationId ? 2 : 4)) {
      return zhCN.devicePage.degraded;
    }
    if (failedCount > 0) {
      return zhCN.dashboard.partialDataset;
    }
    return null;
  }, [baseFailedCount, listFailed, runtimeStationId]);

  const items = deviceList?.items || [];
  const total = typeof deviceList?.total === "number" ? deviceList.total : items.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const treeRoot = deviceTree?.tree || null;
  const treeState = useMemo(() => flattenTree(treeRoot), [treeRoot]);
  const treeNodeRuntimeStatusByDeviceId = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const node of treeState.nodes) {
      if (node.nodeType !== "device" || !node.deviceIdRef) {
        continue;
      }
      const label = mapDeviceRuntimeStatusLabel(node.status);
      if (label !== zhCN.devicePage.statusUnknown || !mapping.has(node.deviceIdRef)) {
        mapping.set(node.deviceIdRef, label);
      }
    }
    return mapping;
  }, [treeState.nodes]);
  useEffect(() => {
    let active = true;
    const deviceIds = Array.from(
      new Set(
        treeState.nodes
          .filter((node) => node.nodeType === "device" && Boolean(node.deviceIdRef))
          .map((node) => String(node.deviceIdRef || ""))
          .filter(Boolean)
      )
    );

    async function loadTreeRuntimeStatus() {
      if (deviceIds.length === 0) {
        setTreeRuntimeStatusByDeviceId(new Map());
        return;
      }
      try {
        const chunkSize = 80;
        const chunks: string[][] = [];
        for (let index = 0; index < deviceIds.length; index += chunkSize) {
          chunks.push(deviceIds.slice(index, index + chunkSize));
        }
        const results = await Promise.allSettled(chunks.map((ids) => (
          fetchDeviceDetails(stationDataSiteId, ids, { stationId: runtimeStationId })
        )));
        if (!active) {
          return;
        }
        const mapping = new Map<string, string>();
        for (const result of results) {
          if (result.status !== "fulfilled") {
            continue;
          }
          if (runtimeStationId && !isAppliedStationRuntimeScope(result.value.dataScope, stationRuntimeScope)) {
            continue;
          }
          for (const item of result.value.items || []) {
            const deviceId = String(item.deviceId || "").trim();
            if (!deviceId) {
              continue;
            }
            const statusLabel = composeRuntimeAlarmStatusLabel(
              item.detail?.runStatusText,
              item.detail?.alarmStatusText
            );
            if (statusLabel !== zhCN.devicePage.statusUnknown || !mapping.has(deviceId)) {
              mapping.set(deviceId, statusLabel);
            }
          }
        }
        setTreeRuntimeStatusByDeviceId(mapping);
      } catch (_error) {
        if (!active) {
          return;
        }
        setTreeRuntimeStatusByDeviceId(new Map());
      }
    }

    loadTreeRuntimeStatus();
    return () => {
      active = false;
    };
  }, [runtimeStationId, stationDataSiteId, stationRuntimeScope.scopeKey, treeState.nodes]);
  const runtimeStatusByDeviceId = useMemo(() => {
    const mapping = new Map(treeNodeRuntimeStatusByDeviceId);
    for (const [deviceId, statusLabel] of treeRuntimeStatusByDeviceId) {
      if (statusLabel !== zhCN.devicePage.statusUnknown || !mapping.has(deviceId)) {
        mapping.set(deviceId, statusLabel);
      }
    }
    return mapping;
  }, [treeNodeRuntimeStatusByDeviceId, treeRuntimeStatusByDeviceId]);
  const defaultDeviceNode = useMemo(
    () => findDefaultDeviceNode(treeRoot, runtimeStatusByDeviceId) || findFirstDeviceNode(treeRoot),
    [runtimeStatusByDeviceId, treeRoot]
  );
  const selectedTreeNode =
    (selectedTreeNodeId ? treeState.index.get(selectedTreeNodeId) : null) || defaultDeviceNode || treeRoot;
  const selectedDeviceId = selectedTreeNode?.deviceIdRef || null;
  const sceneContextDeviceId = selectedDeviceId || requestedDeviceId || null;
  const pageSourceStatuses = runtimeStationId
    ? [
        assetDeviceList?.sourceStatus || deviceList?.sourceStatus,
        deviceTree?.sourceStatus,
        selectedDeviceId ? deviceDetail?.sourceStatus : null
      ]
    : [
        overview?.sourceStatus,
        topology?.sourceStatus,
        assetDeviceList?.sourceStatus || deviceList?.sourceStatus,
        deviceTree?.sourceStatus,
        selectedDeviceId ? deviceDetail?.sourceStatus : null
      ];
  const sourceSummary = summarizeSourceStatus(pageSourceStatuses);

  const partialActive = !loadError && sourceSummary.warn;
  const listPlaceholderActive = hasFallbackSource(deviceList?.sourceStatus);
  const summary = runtimeStationId ? null : overview?.deviceSummary || topology?.summary || null;
  const freshness = runtimeStationId
    ? assetDeviceList?.freshness || deviceList?.freshness || deviceTree?.freshness || deviceDetail?.freshness
    : aiDigest?.freshness || overview?.freshness;
  const floorGroups = useMemo(
    () => runtimeStationId ? [] : buildFloorGroups(topology),
    [runtimeStationId, topology]
  );
  const detailRecordWithDto = buildDeviceDetailRecord(selectedTreeNode || null, items, deviceDetail);
  const assetItems = assetDeviceList?.items || deviceList?.items || [];
  const deviceGroups = useMemo(
    () => buildDeviceGroupSummaries(treeRoot, runtimeStatusByDeviceId),
    [runtimeStatusByDeviceId, treeRoot]
  );
  const coreDeviceTotal = deviceGroups.reduce((sum, group) => sum + group.total, 0);
  const runningDeviceTotal = deviceGroups.reduce((sum, group) => sum + group.running, 0);
  const stoppedDeviceTotal = deviceGroups.reduce((sum, group) => sum + group.stopped, 0);
  const unknownDeviceTotal = deviceGroups.reduce((sum, group) => sum + group.unknown, 0);
  const chillerGroup = deviceGroups.find((group) => group.label === "冷水机组") || null;
  const runningDeviceRows = deviceGroups.flatMap((group) =>
    group.nodes
      .filter((node) => classifyRuntimeState(getRuntimeLabelForTreeNode(node, runtimeStatusByDeviceId)) === "running")
      .slice(0, group.label === "冷水机组" ? 3 : 1)
  ).slice(0, 3);
  const towerPendingCount =
    deviceGroups.find((group) => group.label === "冷却塔及风机")?.unknown || 0;
  const assetTypeSummaries = useMemo(() => buildAssetTypeSummaries(assetItems), [assetItems]);
  const maxAssetTypeCount = Math.max(1, ...assetTypeSummaries.map((item) => item.count));
  const sourceLinkRows = buildSourceLinkRows(assetDeviceList || deviceList, deviceTree, pageSourceStatuses);
  const deviceCatalogHealthy = isSourceStatusOk(assetDeviceList?.sourceStatus || deviceList?.sourceStatus);
  const deviceTreeHealthy = isSourceStatusOk(deviceTree?.sourceStatus);
  const stationCatalogScopeApplied = !runtimeStationId || isAppliedStationRuntimeScope(
    (assetDeviceList || deviceList)?.dataScope,
    stationRuntimeScope
  );
  const stationTreeScopeApplied = !runtimeStationId || isAppliedStationRuntimeScope(
    deviceTree?.dataScope,
    stationRuntimeScope
  );
  const stationScopeEvidenceReady = stationCatalogScopeApplied && stationTreeScopeApplied;
  const realtimeParameterHealthy = sourceLinkRows.find((row) => row.label === "实时参数")?.state === "正常";
  const deviceAccessReady = deviceCatalogHealthy
    && deviceTreeHealthy
    && realtimeParameterHealthy
    && stationScopeEvidenceReady;
  const deviceAccessHeadline = deviceCatalogHealthy
    ? deviceAccessReady
      ? "可用"
      : "受限"
    : "待恢复";
  const deviceAccessPrimaryText = deviceCatalogHealthy
    ? deviceTreeHealthy
      ? "清单/设备树正常"
      : "清单正常 · 树待恢复"
    : "清单待恢复";
  const deviceAccessSecondaryText = realtimeParameterHealthy
    ? "参数正常 · PLC/SCADA"
    : "参数待恢复 · PLC/SCADA";
  const generatedAtLabel = getGeneratedAtLabel(
    assetDeviceList?.generatedAt,
    deviceList?.generatedAt,
    deviceTree?.generatedAt,
    runtimeStationId ? undefined : overview?.generatedAt,
    freshness?.latestTimestamp
  );
  const activeAlarmCount = !runtimeStationId && typeof overview?.alarmSummary?.total === "number"
      ? overview.alarmSummary.total
      : !runtimeStationId && typeof overview?.energyCards?.activeAnomalyCount === "number"
        ? overview.energyCards.activeAnomalyCount
        : 0;
  const hasKnownActiveAlarmCount =
    !runtimeStationId && (
      typeof overview?.alarmSummary?.total === "number" ||
      typeof overview?.energyCards?.activeAnomalyCount === "number"
    );
  const deviceDataState = resolveOperationalDataState({
    requestFailed: Boolean(loadError),
    sourceWarn: partialActive || !deviceAccessReady || !stationScopeEvidenceReady,
    stale: Boolean(freshness?.stale),
    hasData: runtimeStationId
      ? Boolean(assetDeviceList || deviceList || deviceTree)
      : Boolean(overview || topology || assetDeviceList || deviceList || deviceTree)
  });
  const deviceTruthMessage = runtimeStationId && stationScopeEvidenceReady
    ? `设备目录与设备树已按 ${stationRuntimeScope.stationName || runtimeStationId} 过滤；所选设备详情逐响应校验，项目概览与拓扑不参与本站汇总。`
    : runtimeStationId
      ? `尚未取得与 ${stationRuntimeScope.stationName || runtimeStationId}、绑定版本 ${stationRuntimeScope.bindingVersion ?? "-"} 一致的运行作用域证据。`
      : deviceDataState === "live"
      ? "设备主数据、设备树与实时参数链路已通过当前校验。"
      : deviceDataState === "stale"
        ? "当前设备状态已陈旧，不能据此执行巡检结论。"
        : deviceDataState === "offline"
          ? "设备链路不可用，运行与告警状态不可判定。"
          : "设备链路部分降级，绿色状态仅在来源恢复后显示。";
  const selectedRealtimePowerKw = useMemo(
    () => extractRealtimePowerKw(deviceDetail?.detail),
    [deviceDetail?.detail]
  );
  const spaceHierarchyEnabled = useMemo(() => {
    if (floorGroups.length > 0) {
      return true;
    }
    if (items.some((item) => isMeaningfulSpaceValue(item.floorName) || isMeaningfulSpaceValue(item.buildingName))) {
      return true;
    }
    if (
      isMeaningfulSpaceValue(deviceDetail?.detail?.floorName) ||
      isMeaningfulSpaceValue(deviceDetail?.detail?.buildingName)
    ) {
      return true;
    }
    return false;
  }, [deviceDetail?.detail?.buildingName, deviceDetail?.detail?.floorName, floorGroups.length, items]);
  const typeOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const group of topology?.groups || []) {
      if (typeof group.type === "string" && group.type.trim().length > 0) {
        keys.add(group.type);
      }
    }
    return Array.from(keys);
  }, [topology]);
  const floorOptions = useMemo(() => floorGroups.map((item) => item.floor), [floorGroups]);
  const activeTypeLabel = typeFilter ? mapSystemTypeLabel(typeFilter) : zhCN.devicePage.filterAll;
  const activeFloorLabel = spaceHierarchyEnabled ? floorFilter || zhCN.devicePage.filterAll : zhCN.devicePage.processViewCompact;
  useEffect(() => {
    if (!spaceHierarchyEnabled && floorFilter) {
      setFloorFilter("");
      setPage(1);
    }
  }, [floorFilter, spaceHierarchyEnabled]);

  useEffect(() => {
    if (spaceHierarchyEnabled) {
      return;
    }
    setIsFloorDropdownOpen(false);
  }, [spaceHierarchyEnabled]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setIsTypeDropdownOpen(false);
      }
      if (target && floorDropdownRef.current && !floorDropdownRef.current.contains(target)) {
        setIsFloorDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTypeDropdownOpen(false);
        setIsFloorDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    const scopedSiteId = searchParams.get(SITE_ID_QUERY_KEY);
    if (scopedSiteId) {
      nextParams.set(SITE_ID_QUERY_KEY, scopedSiteId);
    }
    for (const stationContextKey of [
      ENERGY_STATION_QUERY_KEY,
      ENERGY_STATION_INSTANCE_QUERY_KEY
    ]) {
      const stationContextValue = searchParams.get(stationContextKey)?.trim();
      if (stationContextValue) {
        nextParams.set(stationContextKey, stationContextValue);
      }
    }
    if (floorFilter) {
      nextParams.set("floor", floorFilter);
    }
    if (typeFilter) {
      nextParams.set("type", typeFilter);
    }
    if (page > 1) {
      nextParams.set("page", String(page));
    }
    if (pageSize !== 8) {
      nextParams.set("pageSize", String(pageSize));
    }
    if (sceneContextDeviceId) {
      nextParams.set("deviceId", sceneContextDeviceId);
    }
    if (requestedSceneMode) {
      nextParams.set("sceneMode", requestedSceneMode);
    }
    if (requestedSceneNodeId) {
      nextParams.set("sceneNodeId", requestedSceneNodeId);
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    setSearchParams(nextParams, { replace: true });
  }, [
    floorFilter,
    page,
    pageSize,
    requestedSceneMode,
    requestedSceneNodeId,
    searchParams,
    sceneContextDeviceId,
    setSearchParams,
    typeFilter
  ]);

  useEffect(() => {
    const hasSelectedNode = Boolean(selectedTreeNodeId && treeState.index.has(selectedTreeNodeId));

    // Only hydrate from URL when no local selection is active, to avoid selection ping-pong.
    if (!hasSelectedNode && requestedDeviceId) {
      const requestedNode = treeState.nodes.find((node) => node.deviceIdRef === requestedDeviceId);
      if (requestedNode?.id) {
        setSelectedTreeNodeId(requestedNode.id);
        return;
      }
    }

    if (!hasSelectedNode && defaultDeviceNode?.id) {
      setSelectedTreeNodeId(defaultDeviceNode.id);
      return;
    }

    if (selectedTreeNodeId && !treeState.index.has(selectedTreeNodeId) && defaultDeviceNode?.id) {
      setSelectedTreeNodeId(defaultDeviceNode.id);
    }
  }, [defaultDeviceNode?.id, requestedDeviceId, selectedTreeNodeId, treeState.index, treeState.nodes]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!selectedDeviceId) {
        setDeviceDetail(null);
        setDetailError(null);
        return;
      }
      try {
        const result = await fetchDeviceDetail(stationDataSiteId, selectedDeviceId, {
          stationId: runtimeStationId
        });
        if (runtimeStationId && !isAppliedStationRuntimeScope(result.dataScope, stationRuntimeScope)) {
          throw new Error("Device detail did not prove the selected physical-station scope");
        }
        if (!active) {
          return;
        }
        startTransition(() => {
          setDeviceDetail(result);
          setDetailError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDeviceDetail(null);
          setDetailError(zhCN.devicePage.detailLoadFailed);
        });
      }
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [runtimeStationId, selectedDeviceId, stationDataSiteId, stationRuntimeScope.scopeKey]);

  useEffect(() => {
    if (!selectedTreeNodeId) {
      return;
    }
    const node = treeState.index.get(selectedTreeNodeId);
    const overrideStatus = node?.deviceIdRef ? runtimeStatusByDeviceId.get(node.deviceIdRef) || null : null;
    const autoVariant =
      resolveRuntimeVariantFromStatusText(`${String(node?.status || "")} ${String(overrideStatus || "")}`)
      || resolveRuntimeVariantFromTreeNodeStatus(node);
    setForcedModelRuntimeVariant(autoVariant);
  }, [runtimeStatusByDeviceId, selectedTreeNodeId, treeState.index]);

  function onChangeTypeFilter(value: string) {
    setIsTypeDropdownOpen(false);
    setTypeFilter(value);
    setPage(1);
  }

  function onChangeFloorFilter(value: string) {
    setIsFloorDropdownOpen(false);
    setFloorFilter(value);
    setPage(1);
  }

  function onSelectDevice(deviceId: string | undefined) {
    if (!deviceId) {
      return;
    }
    const matchedNode = treeState.nodes.find((node) => node.deviceIdRef === deviceId);
    if (matchedNode?.id) {
      setSelectedTreeNodeId(matchedNode.id);
    }
  }

  const selectedRuntimeLabel =
    selectedTreeNode?.nodeType === "device"
      ? getRuntimeLabelForTreeNode(selectedTreeNode, runtimeStatusByDeviceId)
      : detailRecordWithDto?.runStatusText || zhCN.devicePage.statusUnknown;
  const selectedAlarmLabel =
    detailRecordWithDto?.alarmStatusText && detailRecordWithDto.alarmStatusText !== zhCN.devicePage.detailValuePending
      ? detailRecordWithDto.alarmStatusText
      : selectedRuntimeLabel === "运行中"
        ? "正常"
        : zhCN.devicePage.detailValuePending;
  const selectedPointCount = realtimeParameterHealthy ? detailRecordWithDto?.pointCount || zhCN.devicePage.detailValuePending : "待恢复";
  const selectedLastReport = realtimeParameterHealthy
    ? formatDateTimeCompact(detailRecordWithDto?.lastReportAt)
    : "参数待恢复";

  return (
    <div className="device-page device-overview-page page-enter">
      <section className="device-ops-header" aria-label="设备资产与运行总览">
        <div className="device-ops-title">
          <p>{runtimeConfig.appModeLabel} / 设备管理</p>
          <h1>设备资产与运行总览</h1>
          <span>{`更新：${generatedAtLabel}`}</span>
        </div>
        <div className="device-ops-source-pills" aria-label="数据状态">
          <OperationalTruthBadges
            state={deviceDataState}
            sourceTime={generatedAtLabel}
            controlMode={runtimeConfig.readOnlyMode ? "只读监视" : "待服务端授权"}
            message={deviceTruthMessage}
          />
          {runtimeStationId ? (
            <StatusPill
              label={stationScopeEvidenceReady
                ? `${stationRuntimeScope.stationName || runtimeStationId} · 站房筛选已验证`
                : `${stationRuntimeScope.stationName || runtimeStationId} · 站房筛选待核`}
              tone={stationScopeEvidenceReady ? "good" : "warn"}
            />
          ) : null}
          <StatusPill label="模型库已接入" tone="neutral" />
        </div>
      </section>

      <section className="device-ops-kpis" aria-label="设备总览指标">
        <article className="device-ops-kpi">
          <span>设备清单</span>
          <strong>{`${formatCount(assetDeviceList?.total ?? summary?.totalDevices ?? total)}项`}</strong>
          <small>主机/泵/塔/阀门</small>
        </article>
        <article className="device-ops-kpi">
          <span>核心设备</span>
          <strong>{`${formatCount(runningDeviceTotal)}/${formatCount(coreDeviceTotal)}`}</strong>
          <small>{`停止${formatCount(stoppedDeviceTotal)} · 待确认${formatCount(unknownDeviceTotal)}`}</small>
        </article>
        <article className="device-ops-kpi">
          <span>冷机运行</span>
          <strong>{`${formatCount(chillerGroup?.running || 0)}/${formatCount(chillerGroup?.total || summary?.chillerCount || 0)}`}</strong>
          <small>
            {runningDeviceRows
              .filter((node) => /chiller|冷机|冷水机/i.test(`${node.systemType || ""} ${node.label || ""}`))
              .map((node) => node.deviceCode || node.deviceName || node.label)
              .filter(Boolean)
              .slice(0, 3)
              .join(" / ") || selectedTreeNode?.deviceCode || "--"}
          </small>
        </article>
        <article className={`device-ops-kpi${hasKnownActiveAlarmCount && activeAlarmCount === 0 ? " is-good" : ""}`}>
          <span>当前告警</span>
          <strong>{hasKnownActiveAlarmCount ? `${formatCount(activeAlarmCount)}项` : "--"}</strong>
          <small>
            {hasKnownActiveAlarmCount
              ? activeAlarmCount > 0
                ? "存在活动告警"
                : "当前链路确认无活动告警"
              : "告警数据待恢复"}
          </small>
        </article>
        <article className={`device-ops-kpi device-ops-access${deviceAccessReady ? "" : " is-warn"}`}>
          <div>
            <span>数据准入</span>
            <strong>{deviceAccessHeadline}</strong>
          </div>
          <div className="device-ops-access-copy">
            <span>{deviceAccessPrimaryText}</span>
            <em>{deviceAccessSecondaryText}</em>
          </div>
          <div className="device-ops-actions">
            <button type="button" onClick={() => setActiveTab("list")}>设备列表</button>
            <button
              type="button"
              className={deviceAccessReady ? "primary" : undefined}
              onClick={() => setActiveTab("navigation")}
            >
              {deviceAccessReady ? "进入巡检" : "查看待恢复项"}
            </button>
          </div>
        </article>
      </section>

      {activeTab === "navigation" ? (
        <div id="device-tab-panel-navigation" role="tabpanel" aria-labelledby="device-tab-navigation" className="device-page-tab-panel">
          <div className="device-ops-grid">
            <section className="device-ops-panel device-ops-group-panel">
              <header>
                <h3>设备分组运行队列</h3>
                <StatusPill label={deviceTreeHealthy ? "设备树正常" : "设备树待恢复"} tone={deviceTreeHealthy ? "good" : "warn"} />
              </header>
              <p className="device-ops-panel-kicker">核心设备树口径</p>
              <div className="device-ops-group-list">
                {deviceGroups.slice(0, 4).map((group, index) => {
                  const runningPct = group.total > 0 ? (group.running / group.total) * 100 : 0;
                  const stoppedPct = group.total > 0 ? (group.stopped / group.total) * 100 : 0;
                  const unknownPct = group.total > 0 ? (group.unknown / group.total) * 100 : 0;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`device-ops-group-row${index === 0 ? " is-active" : ""}`}
                      onClick={() => {
                        const nextNode = group.nodes.find(
                          (node) => classifyRuntimeState(getRuntimeLabelForTreeNode(node, runtimeStatusByDeviceId)) === "running"
                        ) || group.nodes[0];
                        setSelectedTreeNodeId(nextNode?.id || null);
                      }}
                    >
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.meta}</small>
                      </span>
                      <em>{`${formatCount(group.running)}/${formatCount(group.total)} 运行`}</em>
                      <i aria-hidden>
                        <b style={{ width: `${runningPct}%` }} />
                        <b className="is-stopped" style={{ width: `${stoppedPct}%` }} />
                        <b className="is-unknown" style={{ width: `${unknownPct}%` }} />
                      </i>
                    </button>
                  );
                })}
              </div>
              <div className="device-ops-running-list">
                <div>
                  <strong>运行设备</strong>
                  <button type="button" onClick={() => setActiveTab("list")}>更多</button>
                </div>
                {runningDeviceRows.length > 0 ? (
                  runningDeviceRows.map((node) => (
                    <button
                      key={node.id || node.deviceIdRef || node.label}
                      type="button"
                      className={selectedTreeNode?.id === node.id ? "is-selected" : ""}
                      onClick={() => setSelectedTreeNodeId(node.id || null)}
                    >
                      <span>{node.deviceCode || node.deviceIdRef || "--"}</span>
                      <strong>{node.deviceName || node.label || zhCN.common.unknown}</strong>
                      <StatusPill label={getRuntimeLabelForTreeNode(node, runtimeStatusByDeviceId)} tone="good" />
                    </button>
                  ))
                ) : (
                  <p className="empty-hint">{zhCN.devicePage.empty}</p>
                )}
              </div>
              {towerPendingCount > 0 ? (
                <div className="device-ops-pending-card">
                  <strong>状态待确认</strong>
                  <span>{`CT1-CT6 · 冷却塔状态映射`}</span>
                  <StatusPill label={`${formatCount(towerPendingCount)}项`} tone="warn" />
                </div>
              ) : null}
            </section>

            <section className="device-ops-panel device-ops-detail-panel">
              <header>
                <h3>设备详情与模型联动</h3>
                <StatusPill label="模型就绪" tone="neutral" />
              </header>
              {detailRecordWithDto ? (
                <>
                  <div className="device-ops-selected">
                    <div>
                      <strong>{detailRecordWithDto.label}</strong>
                      <p>{`${detailRecordWithDto.deviceCode} · ${detailRecordWithDto.systemType} · ${getDisplaySpaceValue(detailRecordWithDto.floorName, "默认楼层")}`}</p>
                    </div>
                    <div>
                      <StatusPill label={selectedRuntimeLabel} tone={resolveUnifiedStatusTone(selectedRuntimeLabel)} />
                      <span>识别与巡检</span>
                      <em>PLC/SCADA 为准</em>
                    </div>
                  </div>
                  <div className="device-ops-model-wrap">
                    <LazyDeviceModelPreview
                      deviceName={detailRecordWithDto.label}
                      systemType={detailRecordWithDto.systemType}
                      systemTypeRaw={selectedTreeNode?.systemType || null}
                      runtimeStatusText={deviceDetail?.detail?.runStatusText || selectedTreeNode?.status || null}
                      alarmStatusText={deviceDetail?.detail?.alarmStatusText || null}
                      realtimePowerKw={selectedRealtimePowerKw}
                      forcedRuntimeVariant={forcedModelRuntimeVariant}
                    />
                  </div>
                  <div className="device-ops-detail-metrics">
                    {[
                      { label: "运行状态", value: selectedRuntimeLabel, tone: resolveUnifiedStatusTone(selectedRuntimeLabel) },
                      { label: "告警状态", value: selectedAlarmLabel, tone: resolveUnifiedStatusTone(selectedAlarmLabel) },
                      { label: "设备编号", value: detailRecordWithDto.deviceCode, tone: "neutral" },
                      { label: "设备类型", value: detailRecordWithDto.systemType, tone: "neutral" },
                      { label: "点位数量", value: selectedPointCount, tone: realtimeParameterHealthy ? "neutral" : "warn" },
                      { label: "最近上报", value: selectedLastReport, tone: realtimeParameterHealthy ? "neutral" : "warn" },
                      { label: "下级节点", value: detailRecordWithDto.childCount, tone: "neutral" },
                      { label: "虚拟设备", value: detailRecordWithDto.isVirtual, tone: "neutral" }
                    ].map((item) => (
                      <article key={item.label} className={`device-ops-detail-metric tone-${item.tone}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="device-detail-card">
                  <LazyDeviceModelPreview
                    deviceName={zhCN.devicePage.systemTypeChiller}
                    systemType={zhCN.devicePage.systemTypeChiller}
                    systemTypeRaw="chiller"
                    forcedCategory="chiller"
                    forcedRuntimeVariant={forcedModelRuntimeVariant}
                  />
                  <p className="empty-hint">{zhCN.devicePage.detailEmpty}</p>
                </div>
              )}
            </section>

            <aside className="device-ops-side">
              <section className="device-ops-panel device-ops-asset-panel">
                <header>
                  <h3>资产类型分布</h3>
                  <StatusPill label="清单正常" tone="good" />
                </header>
                <div className="device-ops-asset-bars">
                  {assetTypeSummaries.slice(0, 6).map((item) => (
                    <div key={item.label} className="device-ops-asset-row">
                      <span>{item.label}</span>
                      <strong>{formatCount(item.count)}</strong>
                      <i aria-hidden><b style={{ width: `${(item.count / maxAssetTypeCount) * 100}%` }} /></i>
                    </div>
                  ))}
                </div>
              </section>

              <section className="device-ops-panel device-ops-source-panel">
                <header>
                  <h3>数据链路</h3>
                  <StatusPill label="准入" tone="neutral" />
                </header>
                <div className="device-ops-source-list">
                  {sourceLinkRows.map((row) => (
                    <div key={row.label} className="device-ops-source-row">
                      <span>{row.label}</span>
                      <StatusPill label={row.state} tone={row.tone} />
                      <strong>{row.detail}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="device-ops-panel device-ops-priority-panel">
                <span>巡检优先级</span>
                <strong>{`运行冷机 ${runningDeviceRows.map((node) => node.deviceCode || node.label).filter(Boolean).slice(0, 3).join(" / ") || "--"}`}</strong>
                {towerPendingCount > 0 ? <em>{`冷却塔 CT1-CT6 状态映射待确认`}</em> : null}
              </section>
            </aside>
          </div>

          <section className="device-ops-footer" aria-label="设备运行口径">
            <span>{`设备清单 ${formatCount(assetDeviceList?.total ?? summary?.totalDevices ?? total)}`}</span>
            <span>{`核心设备 ${formatCount(coreDeviceTotal)}`}</span>
            <span className="is-good">{`运行 ${formatCount(runningDeviceTotal)}`}</span>
            <span>{`停止 ${formatCount(stoppedDeviceTotal)}`}</span>
            <span className="is-warn">{`待确认 ${formatCount(unknownDeviceTotal)}`}</span>
            <span className="is-warn">{realtimeParameterHealthy ? "实时参数正常" : "实时参数待恢复"}</span>
            <span>控制状态以 PLC/SCADA 为准</span>
            <span>{`更新时间 ${generatedAtLabel === zhCN.common.timeUnknown ? "--" : generatedAtLabel.slice(-8)}`}</span>
          </section>
        </div>
      ) : null}

      {activeTab === "list" ? (
        <div id="device-tab-panel-list" role="tabpanel" aria-labelledby="device-tab-list" className="device-page-tab-panel">
          <SectionCard title={zhCN.devicePage.sectionList} action={<span className="dashboard-section-hint">{"\u7B5B\u9009\u4F1A\u76F4\u63A5\u5F71\u54CD\u5F53\u524D\u5217\u8868"}</span>}>
        <div className="device-table-stage">
          <div
            className="device-table-stage-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "nowrap",
              width: "100%"
            }}
          >
            <div className="device-table-stage-copy">
              <strong>{zhCN.devicePage.sectionList}</strong>
              <p>
                {listPlaceholderActive
                  ? zhCN.devicePage.placeholderNote
                  : partialActive
                    ? zhCN.devicePage.partial
                    : zhCN.devicePage.listHint}
              </p>
            </div>
            <div
              className="device-table-stage-toolbar"
              style={{
                marginLeft: "auto",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                flexWrap: "nowrap"
              }}
            >
              <div className="device-filter-group">
                <label>
                  <span>{zhCN.devicePage.filterType}</span>
                  <div className="device-filter-select" ref={typeDropdownRef}>
                    <button
                      type="button"
                      className={`device-filter-select-trigger${isTypeDropdownOpen ? " is-open" : ""}`}
                      onClick={() => {
                        setIsTypeDropdownOpen((current) => !current);
                        setIsFloorDropdownOpen(false);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={isTypeDropdownOpen}
                      aria-controls="device-list-type-listbox"
                    >
                      <span className="device-filter-select-trigger-text">{activeTypeLabel}</span>
                      <ChevronDown className="device-filter-select-caret" size={14} aria-hidden="true" />
                    </button>
                    {isTypeDropdownOpen ? (
                      <div
                        id="device-list-type-listbox"
                        className="device-filter-select-menu"
                        role="listbox"
                        aria-label={zhCN.devicePage.filterType}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={typeFilter === ""}
                          className={`device-filter-select-option${typeFilter === "" ? " is-active" : ""}`}
                          onClick={() => onChangeTypeFilter("")}
                          title={zhCN.devicePage.filterAll}
                        >
                          <span className="device-filter-select-option-label">{zhCN.devicePage.filterAll}</span>
                        </button>
                        {typeOptions.map((type) => {
                          const label = mapSystemTypeLabel(type);
                          const isActive = typeFilter === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`device-filter-select-option${isActive ? " is-active" : ""}`}
                              onClick={() => onChangeTypeFilter(type)}
                              title={label}
                            >
                              <span className="device-filter-select-option-label">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </label>
                {spaceHierarchyEnabled ? (
                  <label>
                    <span>{zhCN.devicePage.filterFloor}</span>
                    <div className="device-filter-select" ref={floorDropdownRef}>
                      <button
                        type="button"
                        className={`device-filter-select-trigger${isFloorDropdownOpen ? " is-open" : ""}`}
                        onClick={() => {
                          setIsFloorDropdownOpen((current) => !current);
                          setIsTypeDropdownOpen(false);
                        }}
                        aria-haspopup="listbox"
                        aria-expanded={isFloorDropdownOpen}
                        aria-controls="device-list-floor-listbox"
                      >
                        <span className="device-filter-select-trigger-text">{activeFloorLabel}</span>
                        <ChevronDown className="device-filter-select-caret" size={14} aria-hidden="true" />
                      </button>
                      {isFloorDropdownOpen ? (
                        <div
                          id="device-list-floor-listbox"
                          className="device-filter-select-menu"
                          role="listbox"
                          aria-label={zhCN.devicePage.filterFloor}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={floorFilter === ""}
                            className={`device-filter-select-option${floorFilter === "" ? " is-active" : ""}`}
                            onClick={() => onChangeFloorFilter("")}
                            title={zhCN.devicePage.filterAll}
                          >
                            <span className="device-filter-select-option-label">{zhCN.devicePage.filterAll}</span>
                          </button>
                          {floorOptions.map((floor) => {
                            const isActive = floorFilter === floor;
                            return (
                              <button
                                key={floor}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                className={`device-filter-select-option${isActive ? " is-active" : ""}`}
                                onClick={() => onChangeFloorFilter(floor)}
                                title={floor}
                              >
                                <span className="device-filter-select-option-label">{floor}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </label>
                ) : (
                  <div className="empty-hint">{zhCN.devicePage.noSpatialHierarchyHint}</div>
                )}
              </div>

              <div className="device-pagination-meta">
                <span>{`${zhCN.devicePage.summaryTotal} ${formatCount(total)}${zhCN.common.unitItem}`}</span>
                <div className="device-page-size">
                  {[8, 12, 20].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={pageSize === size ? "alarm-filter-button active" : "alarm-filter-button"}
                      onClick={() => {
                        setIsTypeDropdownOpen(false);
                        setIsFloorDropdownOpen(false);
                        if (pageSize === size && page === 1) {
                          return;
                        }
                        setPageSize(size);
                        setPage(1);
                      }}
                    >
                      {`${size}${zhCN.common.unitItem}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="device-table">
            <div className="device-table-head">
              <span>{zhCN.devicePage.tableDevice}</span>
              <span>{zhCN.devicePage.tableType}</span>
              <span>{spaceHierarchyEnabled ? zhCN.devicePage.tableFloor : zhCN.devicePage.tableUsageType}</span>
              <span>{spaceHierarchyEnabled ? zhCN.devicePage.tableBuilding : zhCN.devicePage.tableView}</span>
              <span>{zhCN.devicePage.detailStatus}</span>
            </div>
            {items.map((item, index) =>
              renderDeviceRow(
                item,
                index,
                Boolean(selectedTreeNode?.deviceIdRef && selectedTreeNode.deviceIdRef === item.deviceId),
                onSelectDevice,
                spaceHierarchyEnabled,
                runtimeStatusByDeviceId.get(item.deviceId || "") || null
              )
            )}
            <div className="alarm-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                {zhCN.devicePage.pagePrev}
              </button>
              <span>{`${zhCN.devicePage.pageLabel} ${formatCount(page)}/${formatCount(pageCount)}`}</span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                {zhCN.devicePage.pageNext}
              </button>
            </div>
          </div>
        ) : listError || loadError ? (
          <p className="empty-hint">{zhCN.devicePage.degraded}</p>
        ) : typeFilter || floorFilter ? (
          <p className="empty-hint">{zhCN.devicePage.filteredEmpty}</p>
        ) : (
          <p className="empty-hint">{zhCN.devicePage.empty}</p>
        )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
