export type UnifiedStatusTone = "neutral" | "good" | "warn" | "danger";

const DANGER_KEYWORDS = [
  "critical",
  "danger",
  "failed",
  "failure",
  "error",
  "alarm",
  "alert",
  "alarming",
  "abnormal",
  "fault",
  "trip",
  "serious",
  "critical alarm",
  "failure state",
  "紧急",
  "严重",
  "故障",
  "失败",
  "异常中",
  "报警中",
  "告警中",
  "不可用",
  "阻断"
];

const WARN_KEYWORDS = [
  "warn",
  "warning",
  "caution",
  "partial",
  "offline",
  "stale",
  "pending",
  "degraded",
  "attention",
  "issue",
  "recovering",
  "待恢复",
  "待处理",
  "告警",
  "报警",
  "异常",
  "离线",
  "回退",
  "陈旧",
  "谨慎",
  "一般",
  "待机"
];

const GOOD_KEYWORDS = [
  "good",
  "ok",
  "normal",
  "healthy",
  "running",
  "online",
  "ready",
  "pass",
  "success",
  "stable",
  "connected",
  "recovered",
  "resolved",
  "已恢复",
  "正常",
  "运行中",
  "在线",
  "可用",
  "通过",
  "稳定",
  "连续",
  "不报警"
];

function includesAnyKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

export function resolveUnifiedStatusTone(value: string | null | undefined): UnifiedStatusTone {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "neutral";
  }

  if (includesAnyKeyword(normalized, DANGER_KEYWORDS)) {
    return "danger";
  }
  if (includesAnyKeyword(normalized, WARN_KEYWORDS)) {
    return "warn";
  }
  if (includesAnyKeyword(normalized, GOOD_KEYWORDS)) {
    return "good";
  }
  return "neutral";
}