import StatusPill from "./StatusPill";

type Tone = "neutral" | "good" | "warn" | "danger";

export default function StatCard({
  title,
  value,
  unit,
  delta,
  tone = "neutral"
}: {
  title: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: Tone;
}) {
  const pillTone = tone === "warn" ? "warn" : tone === "good" ? "good" : tone === "danger" ? "danger" : "neutral";

  return (
    <article className={`admin-stat-card tone-${tone}`}>
      <p className="stat-title">{title}</p>
      <div className="stat-main">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      {delta ? <StatusPill label={delta} tone={pillTone} /> : null}
    </article>
  );
}
