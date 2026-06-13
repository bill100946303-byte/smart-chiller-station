import StatusPill from "./StatusPill";

type Tone = "neutral" | "good" | "warn";

export default function StatCard({
  title,
  value,
  unit,
  delta,
  tone,
  className = ""
}: {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: Tone;
  className?: string;
}) {
  const pillTone = tone === "warn" ? "warn" : tone === "good" ? "good" : "neutral";
  const normalizedDelta = delta.trim();
  const cardClassName = ["stat-card", `tone-${tone}`, className].filter(Boolean).join(" ");

  return (
    <article className={cardClassName} aria-label={title}>
      <p className="stat-title" title={title}>
        {title}
      </p>
      <div className="stat-main">
        <strong title={value}>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      {normalizedDelta ? <StatusPill label={normalizedDelta} tone={pillTone} /> : null}
    </article>
  );
}
