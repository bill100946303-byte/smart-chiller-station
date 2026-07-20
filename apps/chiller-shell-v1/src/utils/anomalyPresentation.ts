import { zhCN } from "../i18n/zhCN";

type AnomalyPresentationInput = {
  title?: string | null;
  source?: string | null;
  regId?: string | null;
  value?: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeLoweredText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function isGenericAnomalyTitle(value: string | null | undefined): boolean {
  const normalized = normalizeLoweredText(value);
  return normalized === "alarm event" || normalized === "alarmevent" || normalized === "event";
}

function isGenericAnomalySource(value: string | null | undefined): boolean {
  const normalized = normalizeLoweredText(value);
  return normalized === "unknown" || normalized === "unknown source";
}

export function getDisplayAnomalyTitle(item: Pick<AnomalyPresentationInput, "title" | "regId">): string {
  const title = normalizeText(item.title);
  if (title && !isGenericAnomalyTitle(title)) {
    return title;
  }
  const regId = normalizeText(item.regId);
  if (regId) {
    return `${zhCN.dashboard.alarmEvent} #${regId}`;
  }
  return zhCN.dashboard.alarmEvent;
}

export function getDisplayAnomalySource(source: string | null | undefined): string | null {
  const normalized = normalizeText(source);
  if (!normalized || isGenericAnomalySource(normalized)) {
    return null;
  }
  return normalized;
}

export function getDisplayAnomalySourceLabel(source: string | null | undefined): string {
  return getDisplayAnomalySource(source) || "来源未标注";
}

export function getDisplayAnomalyValue(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (["0", "1", "true", "false", "null", "undefined", "-", "--"].includes(lowered)) {
    return null;
  }

  return normalized;
}

export function buildAnomalySummaryLine(options: {
  occurredAt: string;
  source?: string | null;
  value?: string | null;
}): string {
  const parts = [`${zhCN.dashboard.occurredPrefix} ${options.occurredAt}`];
  const source = getDisplayAnomalySource(options.source);
  const value = getDisplayAnomalyValue(options.value);

  if (source) {
    parts.push(source);
  }
  if (value) {
    parts.push(value);
  }

  return parts.join(" · ");
}
