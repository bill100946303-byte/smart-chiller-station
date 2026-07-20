import "./OperationalTruthBadges.css";

export type OperationalDataState = "live" | "stale" | "degraded" | "offline" | "sample" | "unknown";

export type OperationalTruthInput = {
  requestFailed?: boolean;
  sourceWarn?: boolean;
  stale?: boolean;
  hasData?: boolean;
  sample?: boolean;
};

type OperationalTruthBadgesProps = {
  state: OperationalDataState;
  sourceTime?: string | null;
  sourceTimePendingLabel?: string;
  controlMode: string;
  message?: string;
  className?: string;
};

const DATA_STATE_META: Record<OperationalDataState, { label: string; tone: string }> = {
  live: { label: "数据：实时已确认", tone: "good" },
  stale: { label: "数据：历史快照", tone: "warn" },
  degraded: { label: "数据：链路降级", tone: "warn" },
  offline: { label: "数据：实时离线", tone: "danger" },
  sample: { label: "数据：样本预览", tone: "neutral" },
  unknown: { label: "数据：状态待确认", tone: "neutral" }
};

export function resolveOperationalDataState({
  requestFailed = false,
  sourceWarn = false,
  stale = false,
  hasData = false,
  sample = false
}: OperationalTruthInput): OperationalDataState {
  if (sample) {
    return "sample";
  }
  if (requestFailed && !hasData) {
    return "offline";
  }
  if (stale) {
    return "stale";
  }
  if (requestFailed || sourceWarn) {
    return "degraded";
  }
  if (hasData) {
    return "live";
  }
  return "unknown";
}

export default function OperationalTruthBadges({
  state,
  sourceTime,
  sourceTimePendingLabel = "待确认",
  controlMode,
  message,
  className = ""
}: OperationalTruthBadgesProps) {
  const stateMeta = DATA_STATE_META[state];
  const normalizedSourceTime = String(sourceTime || "").trim();
  const sourceTimeText = normalizedSourceTime
    ? `源时间：${normalizedSourceTime}`
    : `源时间：${sourceTimePendingLabel}`;
  const accessibleText = [stateMeta.label, sourceTimeText, `控制：${controlMode}`, message]
    .filter(Boolean)
    .join("；");

  return (
    <div
      className={`operational-truth-badges ${className}`.trim()}
      data-operational-data-state={state}
      data-operational-source-time={normalizedSourceTime ? "reported" : "unverified"}
      role="status"
      aria-label={accessibleText}
      title={message || accessibleText}
    >
      <span className={`operational-truth-badge tone-${stateMeta.tone}`}>{stateMeta.label}</span>
      <span className="operational-truth-badge tone-neutral">
        {sourceTimeText}
      </span>
      <span className={`operational-truth-badge ${controlMode.includes("只读") ? "tone-warn" : "tone-neutral"}`}>
        {`控制：${controlMode}`}
      </span>
    </div>
  );
}
