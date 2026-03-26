import { startTransition, useEffect, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type MeterReadingDto,
  exportMeterReadings,
  fetchMeterReadings
} from "../services/bffClient";

type FilterState = {
  startTime: string;
  endTime: string;
};

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatStartOfDayInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00`;
}

function toLegacyDateTime(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length === 16 ? `${normalized.replace("T", " ")}:00` : normalized.replace("T", " ");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return zhCN.common.timeUnknown;
  }
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function buildSummaryCards(data: MeterReadingDto | null, query: FilterState): SummaryCard[] {
  const total = typeof data?.total === "number" ? data.total : 0;
  const columns = Array.isArray(data?.columns) ? data.columns.length : 0;
  const sourceReady = data?.sourceStatus?.overall === "ok";
  return [
    {
      title: zhCN.meterReadingPage.summaryTotal,
      value: String(total),
      unit: zhCN.meterReadingPage.unitRows,
      delta: zhCN.meterReadingPage.summaryFilterHint,
      tone: total > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.meterReadingPage.summaryColumns,
      value: String(columns),
      unit: zhCN.meterReadingPage.unitColumns,
      delta: zhCN.meterReadingPage.rangeColumns,
      tone: columns > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.meterReadingPage.summaryRange,
      value: `${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`,
      unit: "",
      delta: zhCN.meterReadingPage.summaryFilterHint,
      tone: "neutral"
    },
    {
      title: zhCN.meterReadingPage.summaryState,
      value: sourceReady ? zhCN.meterReadingPage.stateReady : zhCN.meterReadingPage.stateFallback,
      unit: "",
      delta: zhCN.meterReadingPage.summaryStateHint,
      tone: sourceReady ? "good" : "warn"
    }
  ];
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }
  return String(value);
}

export default function MeterReadingPage() {
  const now = new Date();
  const initialFilters = {
    startTime: formatStartOfDayInput(now),
    endTime: formatDateTimeInput(now)
  };
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<FilterState>(initialFilters);
  const [data, setData] = useState<MeterReadingDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const result = await fetchMeterReadings(runtimeConfig.siteId, {
          startTime: toLegacyDateTime(query.startTime),
          endTime: toLegacyDateTime(query.endTime)
        });
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
          setLoadError(zhCN.meterReadingPage.degraded);
          setLoading(false);
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [query]);

  const sourceSummary = summarizeSourceStatus([data?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([data?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines([data?.sourceStatus], {
    labelMode: "short"
  });
  const summaryCards = buildSummaryCards(data, query);
  const columns = data?.columns || [];
  const rows = data?.items || [];
  const bannerText = exportError
    || loadError
    || (loading ? zhCN.meterReadingPage.loading : sourceSummary.text);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
  }

  function handleSearch() {
    setQuery(filters);
    setExportError(null);
  }

  function handleReset() {
    setFilters(initialFilters);
    setQuery(initialFilters);
    setExportError(null);
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const file = await exportMeterReadings(runtimeConfig.siteId, {
        startTime: toLegacyDateTime(query.startTime),
        endTime: toLegacyDateTime(query.endTime)
      });
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || "meter-reading.xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setExportError(zhCN.meterReadingPage.exportFailed);
      });
    }
  }

  return (
    <div className="meter-reading-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(loadError || exportError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="meter-reading-header">
        <h2>{zhCN.meterReadingPage.heading}</h2>
        <p>{zhCN.meterReadingPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.meterReadingPage.sectionFilters}>
        <div className="meter-reading-filter-grid">
          <label className="meter-reading-field">
            <span>{zhCN.meterReadingPage.filterStartTime}</span>
            <input
              type="datetime-local"
              value={filters.startTime}
              max={filters.endTime}
              onChange={(event) => updateFilter("startTime", event.target.value)}
            />
          </label>
          <label className="meter-reading-field">
            <span>{zhCN.meterReadingPage.filterEndTime}</span>
            <input
              type="datetime-local"
              value={filters.endTime}
              min={filters.startTime}
              onChange={(event) => updateFilter("endTime", event.target.value)}
            />
          </label>
        </div>
        <div className="meter-reading-actions">
          <button type="button" className="meter-reading-button is-primary" onClick={handleSearch}>
            {zhCN.meterReadingPage.search}
          </button>
          <button type="button" className="meter-reading-button" onClick={handleReset} disabled={loading || exporting}>
            {zhCN.meterReadingPage.reset}
          </button>
          <button type="button" className="meter-reading-button" onClick={handleExport} disabled={loading || exporting}>
            {exporting ? zhCN.meterReadingPage.exporting : zhCN.meterReadingPage.export}
          </button>
        </div>
      </SectionCard>

      <div className="meter-reading-summary-grid">
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

      <SectionCard title={zhCN.meterReadingPage.sectionTable}>
        <div className="meter-reading-meta">
          <span>{`${zhCN.meterReadingPage.rangeSelected} ${query.startTime.replace("T", " ")} ~ ${query.endTime.replace("T", " ")}`}</span>
          <span>{`${zhCN.meterReadingPage.rangeColumns} ${columns.length}${zhCN.meterReadingPage.unitColumns}`}</span>
          <span>{`${zhCN.meterReadingPage.rangeLatestFetch} ${formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp)}`}</span>
        </div>

        {rows.length > 0 && columns.length > 0 ? (
          <div className="meter-reading-table-shell">
            <table className="meter-reading-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`meter-reading-${index + 1}`}>
                    {columns.map((column) => (
                      <td key={`${index + 1}-${column}`}>{formatCellValue(row[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="meter-reading-empty">
            {loading ? zhCN.meterReadingPage.loading : zhCN.meterReadingPage.empty}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
