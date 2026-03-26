type StatusTone = "neutral" | "good" | "warn" | "danger";

export default function StatusPill({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}
