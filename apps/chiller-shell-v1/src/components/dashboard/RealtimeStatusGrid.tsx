import type { DashboardOverviewDto } from "../../services/bffClient";
import { zhCN } from "../../i18n/zhCN";

type Tone = "good" | "warn" | "neutral";

type StatusCard = {
  title: string;
  value: string;
  note: string;
  tone: Tone;
};

function formatCount(value: number | undefined): string {
  return typeof value === "number" ? `${value}` : "--";
}

function buildAlarmNote(overview: DashboardOverviewDto): { note: string; tone: Tone } {
  const high = overview.alarmSummary?.high ?? 0;
  const medium = overview.alarmSummary?.medium ?? 0;
  const low = overview.alarmSummary?.low ?? 0;

  if (overview.alarmSummary == null) {
    return { note: zhCN.realtimeStatus.alarmUnavailable, tone: "neutral" };
  }

  if (high > 0) {
    return {
      note: `${zhCN.realtimeStatus.highMediumLowPrefix} ${high}${zhCN.realtimeStatus.highMediumMiddle} ${medium}${zhCN.realtimeStatus.highMediumLowSuffix} ${low}`,
      tone: "warn"
    };
  }

  return {
    note: `${zhCN.realtimeStatus.highMediumLowPrefix} ${high}${zhCN.realtimeStatus.highMediumMiddle} ${medium}${zhCN.realtimeStatus.highMediumLowSuffix} ${low}`,
    tone: "good"
  };
}

export default function RealtimeStatusGrid({ overview }: { overview: DashboardOverviewDto | null }) {
  const alarm = overview
    ? buildAlarmNote(overview)
    : { note: zhCN.realtimeStatus.waitingOverview, tone: "neutral" as Tone };

  const cards: StatusCard[] = [
    {
      title: zhCN.realtimeStatus.chiller,
      value: `${formatCount(overview?.deviceSummary?.chillerCount)} ${zhCN.realtimeStatus.unitTai}`,
      note: alarm.note,
      tone: alarm.tone
    },
    {
      title: zhCN.realtimeStatus.chilledPump,
      value: `${formatCount(overview?.deviceSummary?.chilledPumpCount)} ${zhCN.realtimeStatus.unitTai}`,
      note: alarm.note,
      tone: alarm.tone
    },
    {
      title: zhCN.realtimeStatus.coolingPump,
      value: `${formatCount(overview?.deviceSummary?.coolingPumpCount)} ${zhCN.realtimeStatus.unitTai}`,
      note: alarm.note,
      tone: alarm.tone
    },
    {
      title: zhCN.realtimeStatus.coolingTower,
      value: `${formatCount(overview?.deviceSummary?.coolingTowerCount)} ${zhCN.realtimeStatus.unitTai}`,
      note: alarm.note,
      tone: alarm.tone
    }
  ];

  return (
    <div className="system-summary-grid">
      {cards.map((item) => (
        <article key={item.title} className={`is-${item.tone}`}>
          <h4>{item.title}</h4>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </div>
  );
}
