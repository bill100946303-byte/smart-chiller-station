import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type ColdStationLogDto,
  type ColdStationLogItemDto,
  fetchColdStationLogs
} from "../services/bffClient";

type SummaryMetricCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type LogColumn = {
  key: keyof ColdStationLogItemDto | "time";
  label: string;
  unit?: string;
  digits?: number;
};

const LOG_COLUMNS: LogColumn[] = [
  { key: "time", label: zhCN.coldStationLogPage.tableTime },
  { key: "systemCoolingCapacity", label: zhCN.coldStationLogPage.tableSystemCoolingCapacity, unit: "RT*h", digits: 1 },
  { key: "systemPower", label: zhCN.coldStationLogPage.tableSystemPower, unit: "kWh", digits: 1 },
  { key: "hostPower", label: zhCN.coldStationLogPage.tableHostPower, unit: "kWh", digits: 1 },
  { key: "refrigeratingPumpPower", label: zhCN.coldStationLogPage.tableChilledPumpPower, unit: "kWh", digits: 1 },
  { key: "coolingPumpPower", label: zhCN.coldStationLogPage.tableCoolingPumpPower, unit: "kWh", digits: 1 },
  { key: "coolingTowerPower", label: zhCN.coldStationLogPage.tableCoolingTowerPower, unit: "kWh", digits: 1 },
  { key: "systemEfficiency", label: zhCN.coldStationLogPage.tableSystemEfficiency, unit: "kW/RT", digits: 2 },
  { key: "hostEfficiency", label: zhCN.coldStationLogPage.tableHostEfficiency, unit: "kW/RT", digits: 2 },
  {
    key: "refrigerationPumpConveyingCoefficient",
    label: zhCN.coldStationLogPage.tableChilledPumpCoefficient,
    digits: 2
  },
  { key: "coolingPumpConveyingCoefficient", label: zhCN.coldStationLogPage.tableCoolingPumpCoefficient, digits: 2 },
  { key: "coolingTowerConveyingCoefficient", label: zhCN.coldStationLogPage.tableCoolingTowerCoefficient, digits: 2 },
  { key: "chilledWaterInputTemperature", label: zhCN.coldStationLogPage.tableChilledWaterIn, unit: "°C", digits: 1 },
  { key: "chilledWaterOutputTemperature", label: zhCN.coldStationLogPage.tableChilledWaterOut, unit: "°C", digits: 1 },
  { key: "coolingWaterInputTemperature", label: zhCN.coldStationLogPage.tableCoolingWaterIn, unit: "°C", digits: 1 },
  { key: "coolingWaterOutputTemperature", label: zhCN.coldStationLogPage.tableCoolingWaterOut, unit: "°C", digits: 1 }
];

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function buildSummaryCards(data: ColdStationLogDto | null, selectedDate: string): SummaryMetricCard[] {
  const summary = data?.summary;
  return [
    {
      title: zhCN.coldStationLogPage.summaryInputPower,
      value: formatNumber(summary?.inputPower, 1),
      unit: "kWh",
      delta: selectedDate,
      tone: summary?.inputPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryOutputCoolingCapacity,
      value: formatNumber(summary?.outputCoolingCapacity, 1),
      unit: "RT*h",
      delta: zhCN.coldStationLogPage.cardDateHint,
      tone: summary?.outputCoolingCapacity != null ? "good" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryHeatDissipation,
      value: formatNumber(summary?.systemHeatDissipation, 1),
      unit: "RT",
      delta: zhCN.coldStationLogPage.cardDateHint,
      tone: summary?.systemHeatDissipation != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summarySystemEfficiency,
      value: formatNumber(summary?.systemEfficiency, 2),
      unit: "kW/RT",
      delta: zhCN.coldStationLogPage.cardStatusHint,
      tone: summary?.systemEfficiency != null ? "good" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryHostPower,
      value: formatNumber(summary?.hostPower, 1),
      unit: "kWh",
      delta: zhCN.coldStationLogPage.cardHourlyHint,
      tone: summary?.hostPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryChilledPumpPower,
      value: formatNumber(summary?.refrigeratingPumpPower, 1),
      unit: "kWh",
      delta: zhCN.coldStationLogPage.cardHourlyHint,
      tone: summary?.refrigeratingPumpPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryCoolingPumpPower,
      value: formatNumber(summary?.coolingPumpPower, 1),
      unit: "kWh",
      delta: zhCN.coldStationLogPage.cardHourlyHint,
      tone: summary?.coolingPumpPower != null ? "neutral" : "warn"
    },
    {
      title: zhCN.coldStationLogPage.summaryCoolingTowerPower,
      value: formatNumber(summary?.coolingTowerPower, 1),
      unit: "kWh",
      delta: zhCN.coldStationLogPage.cardHourlyHint,
      tone: summary?.coolingTowerPower != null ? "neutral" : "warn"
    }
  ];
}

export default function ColdStationLogPage() {
  const today = formatDateInput(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [data, setData] = useState<ColdStationLogDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await fetchColdStationLogs(runtimeConfig.siteId, selectedDate);
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(result);
          setLoadError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setData(null);
          setLoadError(zhCN.coldStationLogPage.degraded);
          setLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadSeed, selectedDate]);

  const sourceSummary = summarizeSourceStatus([data?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([data?.sourceStatus], {
    labelMode: "short"
  });
  const summaryCards = buildSummaryCards(data, selectedDate);
  const items = data?.items || [];
  const bannerText = loadError
    ? loadError
    : loading
      ? zhCN.coldStationLogPage.readinessLoading
      : sourceSummary.text;

  return (
    <div className="cold-station-log-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(loadError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="cold-log-header">
        <div>
          <h2>{zhCN.coldStationLogPage.heading}</h2>
          <p>{zhCN.coldStationLogPage.subtitle}</p>
        </div>
      </section>

      <SectionCard
        title={zhCN.coldStationLogPage.sectionSummary}
        action={
          <div className="cold-log-toolbar">
            <label>
              <span>{zhCN.coldStationLogPage.filterDate}</span>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => setReloadSeed((value) => value + 1)} disabled={loading}>
              {loading ? zhCN.coldStationLogPage.refreshLoading : zhCN.coldStationLogPage.refresh}
            </button>
          </div>
        }
      >
        <div className="cold-log-meta">
          <span>{`${zhCN.coldStationLogPage.rangeSelectedDate} ${selectedDate}`}</span>
          <span>{`${zhCN.coldStationLogPage.rangeRowCount} ${items.length}${zhCN.common.unitItem}`}</span>
          <span>{`${zhCN.coldStationLogPage.rangeLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
        </div>
        <div className="cold-log-summary-grid">
          {summaryCards.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              unit={item.unit}
              delta={item.delta}
              tone={item.tone}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title={zhCN.coldStationLogPage.sectionHourly}>
        {items.length > 0 ? (
          <div className="cold-log-table-shell">
            <table className="cold-log-table">
              <thead>
                <tr>
                  {LOG_COLUMNS.map((column) => (
                    <th key={String(column.key)}>
                      {column.label}
                      {column.unit ? <small>{column.unit}</small> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || `${selectedDate}-${item.time}`}>
                    {LOG_COLUMNS.map((column) => {
                      if (column.key === "time") {
                        return <td key={`${item.id || item.time}-time`}>{item.time || "--"}</td>;
                      }
                      return (
                        <td key={`${item.id || item.time}-${String(column.key)}`}>
                          {formatNumber(item[column.key] as number | null | undefined, column.digits ?? 1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cold-log-empty">
            {loading ? zhCN.coldStationLogPage.readinessLoading : zhCN.coldStationLogPage.empty}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
