import StatusPill from "./StatusPill";

type Tone = "neutral" | "good" | "warn";

export default function StatCard({
  title,
  value,
  unit,
  delta,
  tone
}: {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: Tone;
}) {
  const pillTone = tone === "warn" ? "warn" : tone === "good" ? "good" : "neutral";

  return (
    <article className={`stat-card tone-${tone}`}>
      <p className="stat-title">{title}</p>
      <div className="stat-main">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <StatusPill label={delta} tone={pillTone} />
    </article>
  );
}
