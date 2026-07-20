import type { RuntimeSubsystemCapabilityDto } from "../services/bffClient";

export type SubsystemStatusTone = "good" | "warn" | "neutral";
export type SubsystemStatusKind =
  | "live"
  | "demo"
  | "waiting"
  | "stale"
  | "error"
  | "not_configured"
  | "not_applicable"
  | "unknown";

export type SubsystemStatusPresentation = {
  kind: SubsystemStatusKind;
  compactLabel: string;
  detailLabel: string;
  dataLabel: string;
  tone: SubsystemStatusTone;
  participatesInKpi: boolean;
  realDataReady: boolean;
};

const LIVE_SOURCE_STATUSES = new Set(["ok", "fresh", "ready", "online", "available"]);
const WAITING_SOURCE_STATUSES = new Set([
  "waiting_points",
  "waiting_data",
  "pending",
  "mapping_pending",
  "not_ready"
]);
const STALE_SOURCE_STATUSES = new Set(["stale", "delayed", "expired"]);
const ERROR_SOURCE_STATUSES = new Set([
  "failed",
  "error",
  "offline",
  "unavailable",
  "disconnected",
  "degraded"
]);

function normalized(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function resolveSubsystemStatusKind(
  item: RuntimeSubsystemCapabilityDto | null | undefined
): SubsystemStatusKind {
  if (!item) return "unknown";

  const status = normalized(item.status);
  if (status === "not_configured") return "not_configured";
  if (status === "not_applicable") return "not_applicable";
  if (status !== "enabled") return "unknown";

  const sourceStatus = normalized(item.sourceStatus);
  const freshnessStatus = normalized(item.freshnessStatus);
  const statusSignals = [sourceStatus, freshnessStatus].filter(Boolean);

  // Never let one healthy-looking signal mask a more severe freshness or
  // transport signal. In particular, sourceStatus=ok + freshnessStatus=stale
  // must not render as live.
  if (statusSignals.includes("demo_data")) return "demo";
  if (statusSignals.some((value) => ERROR_SOURCE_STATUSES.has(value))) return "error";
  if (statusSignals.some((value) => STALE_SOURCE_STATUSES.has(value))) return "stale";
  if (statusSignals.some((value) => WAITING_SOURCE_STATUSES.has(value))) return "waiting";
  if (statusSignals.length > 0 && statusSignals.every((value) => LIVE_SOURCE_STATUSES.has(value))) return "live";
  return "unknown";
}

export function getSubsystemStatusPresentation(
  item: RuntimeSubsystemCapabilityDto | null | undefined
): SubsystemStatusPresentation {
  const kind = resolveSubsystemStatusKind(item);
  switch (kind) {
    case "live":
      return {
        kind,
        compactLabel: "已接入",
        detailLabel: "已接入实时",
        dataLabel: "实时正常",
        tone: "good",
        participatesInKpi: true,
        realDataReady: true
      };
    case "demo":
      return {
        kind,
        compactLabel: "演示数据",
        detailLabel: "演示数据 / 只读",
        dataLabel: "演示数据",
        tone: "neutral",
        participatesInKpi: false,
        realDataReady: false
      };
    case "waiting":
      return {
        kind,
        compactLabel: "待接实时",
        detailLabel: "配置已发布 / 待接实时",
        dataLabel: "待接现场点",
        tone: "warn",
        participatesInKpi: false,
        realDataReady: false
      };
    case "stale":
      return {
        kind,
        compactLabel: "数据陈旧",
        detailLabel: "实时数据陈旧",
        dataLabel: "数据陈旧",
        tone: "warn",
        participatesInKpi: false,
        realDataReady: false
      };
    case "error":
      return {
        kind,
        compactLabel: "链路异常",
        detailLabel: "实时链路异常",
        dataLabel: "链路异常",
        tone: "warn",
        participatesInKpi: false,
        realDataReady: false
      };
    case "not_configured":
      return {
        kind,
        compactLabel: "未配置",
        detailLabel: "未配置 / 可接入",
        dataLabel: "不参与",
        tone: "warn",
        participatesInKpi: false,
        realDataReady: false
      };
    case "not_applicable":
      return {
        kind,
        compactLabel: "不适用",
        detailLabel: "不适用",
        dataLabel: "不参与",
        tone: "neutral",
        participatesInKpi: false,
        realDataReady: false
      };
    default:
      return {
        kind,
        compactLabel: "状态待核",
        detailLabel: "已配置 / 状态待核",
        dataLabel: "待核对",
        tone: "warn",
        participatesInKpi: false,
        realDataReady: false
      };
  }
}

export function isSubsystemDemoData(item: RuntimeSubsystemCapabilityDto | null | undefined): boolean {
  return resolveSubsystemStatusKind(item) === "demo";
}

export function isSubsystemWaitingForRealData(
  item: RuntimeSubsystemCapabilityDto | null | undefined
): boolean {
  return resolveSubsystemStatusKind(item) === "waiting";
}

export function isSubsystemRealDataReady(
  item: RuntimeSubsystemCapabilityDto | null | undefined
): boolean {
  return resolveSubsystemStatusKind(item) === "live";
}
