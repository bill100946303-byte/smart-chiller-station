import { startTransition, useEffect, useState } from "react";
import { runtimeConfig } from "../config/runtimeConfig";
import { formatSourceStatusLineCompact, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type MeterReadingDto,
  type MeterReadingRowDto,
  type SourceEndpointStatusDto,
  exportMeterReadings,
  fetchMeterReadings
} from "../services/bffClient";

type FilterState = {
  startTime: string;
  endTime: string;
};

type MetricCard = {
  title: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "neutral";
};

type MeterReadingSourceRow = {
  label: string;
  detail: string;
  state: string;
  ok: boolean;
};

const METER_READING_VALUE_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2
});
const METER_READING_COUNT_FORMATTER = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0
});

const METER_READING_DEGRADED_TEXT = "抄表接口暂不可用";
const METER_READING_EXPORT_FAILED_TEXT = "抄表导出失败";

const COLUMN_HEADER_RULES: Array<[RegExp, string]> = [
  [/^时间$|采集时间|抄表时间|time/i, "时间"],
  [/冷站总电量|总电量|total.*energy|energy.*total/i, "总电量"],
  [/系统冷量|总冷量|cooling/i, "冷量"],
  [/冷机|主机|chiller/i, "冷机"],
  [/冷冻.*泵|chilled.*pump|chwp/i, "冷冻泵"],
  [/冷却.*泵|cooling.*pump|condenser.*pump|cwp/i, "冷却泵"],
  [/冷却塔|tower|ctf/i, "冷却塔"],
  [/cop|能效/i, "COP"],
  [/数据来源|来源|source/i, "来源"],
  [/状态|质量|state|status/i, "状态"]
];

const COLUMN_UNIT_RULES: Array<[RegExp, string]> = [
  [/时间|time/i, "必填"],
  [/电量|kwh|energy/i, "kWh"],
  [/冷量|rt|cooling/i, "RT·h"],
  [/cop|能效/i, "计算列"],
  [/来源|source/i, "接口"],
  [/状态|质量|state|status/i, "质量"]
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatStartOfDayInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
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

function formatClock(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return METER_READING_VALUE_FORMATTER.format(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      const numericValue = Number(normalized);
      if (Number.isFinite(numericValue)) {
        return METER_READING_VALUE_FORMATTER.format(numericValue);
      }
    }
  }
  return String(value);
}

function formatValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  return METER_READING_VALUE_FORMATTER.format(value);
}

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return METER_READING_COUNT_FORMATTER.format(value);
}

function parseNumericCell(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      const numericValue = Number(normalized);
      return Number.isFinite(numericValue) ? numericValue : null;
    }
  }
  return null;
}

function getColumnHeader(column: string): string {
  const matched = COLUMN_HEADER_RULES.find(([pattern]) => pattern.test(column));
  return matched?.[1] || column;
}

function getColumnUnit(column: string): string {
  const matched = COLUMN_UNIT_RULES.find(([pattern]) => pattern.test(column));
  return matched?.[1] || "字段";
}

function findColumn(columns: string[], patterns: RegExp[]): string | null {
  return columns.find((column) => patterns.some((pattern) => pattern.test(column))) || null;
}

function getColumnValues(rows: MeterReadingRowDto[], column: string | null): number[] {
  if (!column) {
    return [];
  }
  return rows
    .map((row) => parseNumericCell(row[column]))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function sumValues(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function averageValues(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function maxValue(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function resolveWindowLabel(query: FilterState): string {
  const startDate = String(query.startTime || "").slice(0, 10);
  const endDate = String(query.endTime || "").slice(0, 10);
  if (!startDate || !endDate) {
    return "--";
  }
  return startDate === endDate ? "当日窗口" : "跨日窗口";
}

function isInvalidRange(filters: FilterState): boolean {
  const startMs = Date.parse(filters.startTime);
  const endMs = Date.parse(filters.endTime);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs;
}

function openDateTimePicker(input: HTMLInputElement) {
  if (typeof input.showPicker === "function") {
    input.showPicker();
  }
}

function isSourceOk(source: SourceEndpointStatusDto): boolean {
  return source.ok !== false && source.fallback !== true;
}

function resolveSourceLabel(source: SourceEndpointStatusDto, index: number): string {
  const raw = `${source.originLabel || ""} ${source.interfaceKind || ""} ${source.key || ""}`.toLowerCase();
  if (/cloud|reg|云/.test(raw)) {
    return "云历史兜底";
  }
  if (/export|导出/.test(raw)) {
    return "抄表导出";
  }
  return source.originLabel || source.interfaceKind || (index === 0 ? "抄表查询" : `数据来源 ${index + 1}`);
}

function buildSourceRows(
  sources: SourceEndpointStatusDto[],
  rowsLength: number,
  exportError: string | null
): MeterReadingSourceRow[] {
  const mapped = sources.slice(0, 2).map((source, index) => ({
    label: formatSourceStatusLineCompact(source) || resolveSourceLabel(source, index),
    detail: typeof source.rows === "number" ? `${formatCount(source.rows)} 行` : "行数未知",
    state: isSourceOk(source) ? "正常" : "待检查",
    ok: isSourceOk(source)
  }));

  if (mapped.length === 0) {
    mapped.push({
      label: "抄表查询",
      detail: `${formatCount(rowsLength)} 行`,
      state: rowsLength > 0 ? "正常" : "待检查",
      ok: rowsLength > 0
    });
  }

  return [
    ...mapped,
    {
      label: "抄表导出",
      detail: "当前窗口",
      state: exportError ? "待检查" : "可用",
      ok: !exportError
    }
  ].slice(0, 3);
}

function getCellToneClass(column: string): string {
  if (/状态|质量|电量|冷量|cop/i.test(column)) {
    return "is-highlight";
  }
  if (/时间|time/i.test(column)) {
    return "is-time";
  }
  return "";
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
          setLoadError(METER_READING_DEGRADED_TEXT);
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
  const columns = data?.columns || [];
  const rows = data?.items || [];
  const sourceEntries = data?.sourceStatus?.sources || [];
  const sourceOkCount = sourceEntries.filter(isSourceOk).length || (rows.length > 0 ? 1 : 0);
  const sourceTotal = sourceEntries.length || (data ? 1 : 0);
  const sourceStateLabel = loading
    ? zhCN.meterReadingPage.loading
    : sourceSummary.warn
      ? zhCN.meterReadingPage.stateFallback
      : zhCN.meterReadingPage.stateReady;
  const latestFetchText = formatDateTime(data?.generatedAt || data?.freshness?.latestTimestamp);
  const latestFetchClock = formatClock(data?.generatedAt || data?.freshness?.latestTimestamp);
  const energyColumn = findColumn(columns, [/冷站总电量|总电量|总.*电量|energy/i]);
  const coolingColumn = findColumn(columns, [/系统冷量|总冷量|cooling|rt/i]);
  const copColumn = findColumn(columns, [/cop|能效/i]);
  const statusColumn = findColumn(columns, [/状态|质量|state|status/i]);
  const energyValues = getColumnValues(rows, energyColumn);
  const coolingValues = getColumnValues(rows, coolingColumn);
  const copValues = getColumnValues(rows, copColumn);
  const invalidRows = statusColumn
    ? rows.filter((row) => /异常|无效|错误|fail|invalid/i.test(String(row[statusColumn] || ""))).length
    : 0;
  const totalRows = typeof data?.total === "number" ? data.total : rows.length;
  const sourceRows = buildSourceRows(sourceEntries, rows.length, exportError);
  const metricCards: MetricCard[] = [
    {
      title: zhCN.meterReadingPage.summaryTotal,
      value: `${formatCount(totalRows)}${zhCN.meterReadingPage.unitRows}`,
      detail: "当前查询窗口",
      tone: "good"
    },
    {
      title: "动态列数",
      value: `${formatCount(columns.length)}${zhCN.meterReadingPage.unitColumns}`,
      detail: "后端字段顺序",
      tone: "neutral"
    },
    {
      title: "冷站总电量",
      value: formatValue(sumValues(energyValues)),
      detail: "kWh，当前窗口",
      tone: "good"
    },
    {
      title: "系统冷量",
      value: formatValue(sumValues(coolingValues)),
      detail: "RT·h，累计值",
      tone: "neutral"
    },
    {
      title: "峰值电量",
      value: formatValue(maxValue(energyValues)),
      detail: energyColumn || "--",
      tone: "warn"
    },
    {
      title: zhCN.meterReadingPage.rangeLatestFetch.replace(/[：:]$/, ""),
      value: latestFetchClock,
      detail: latestFetchText,
      tone: "neutral"
    }
  ];

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
    setLoadError(null);
  }

  function handleSearch() {
    if (isInvalidRange(filters)) {
      setLoadError("开始时间不能晚于结束时间");
      return;
    }
    setQuery(filters);
    setExportError(null);
    setLoadError(null);
  }

  function handleReset() {
    setFilters(initialFilters);
    setQuery(initialFilters);
    setExportError(null);
    setLoadError(null);
  }

  async function handleExport() {
    if (isInvalidRange(query)) {
      setExportError("开始时间不能晚于结束时间");
      return;
    }

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
        setExportError(METER_READING_EXPORT_FAILED_TEXT);
      });
    }
  }

  return (
    <div className="meter-reading-page meter-reading-compact-page-v2 page-enter">
      <section className="meter-reading-compact-hero">
        <div className="meter-reading-compact-hero-copy">
          <span className="meter-reading-compact-label">{runtimeConfig.appModeLabel}</span>
          <h2>{zhCN.meterReadingPage.heading}</h2>
          <div className="meter-reading-compact-tags" aria-label={zhCN.meterReadingPage.sectionFilters}>
            <article>
              <span>{zhCN.meterReadingPage.filterStartTime}</span>
              <strong>{toLegacyDateTime(query.startTime)}</strong>
            </article>
            <article>
              <span>{zhCN.meterReadingPage.filterEndTime}</span>
              <strong>{toLegacyDateTime(query.endTime)}</strong>
            </article>
            <article>
              <span>抄表范围</span>
              <strong>{resolveWindowLabel(query)}</strong>
            </article>
            <article>
              <span>导出格式</span>
              <strong>XLS / CSV</strong>
            </article>
          </div>
        </div>
        <aside className="meter-reading-compact-status" aria-label={zhCN.meterReadingPage.summaryState}>
          <span className="meter-reading-compact-label">{zhCN.meterReadingPage.summaryState}</span>
          <strong>{sourceStateLabel}</strong>
          <em>
            数据状态：
            {sourceTotal > 0 ? `${formatCount(sourceOkCount)}/${formatCount(sourceTotal)} 正常` : (loading ? zhCN.meterReadingPage.loading : "--")}
          </em>
        </aside>
      </section>

      <section className="meter-reading-compact-metrics" aria-label="抄表指标">
        {metricCards.map((item) => (
          <article key={item.title} className={`meter-reading-compact-metric is-${item.tone || "neutral"}`}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="meter-reading-compact-workspace" aria-label="能耗抄表工作台">
        <article className="meter-reading-compact-panel">
          <header className="meter-reading-compact-panel-head">
            <h3>查询与导出</h3>
            <span>只读</span>
          </header>
          <div className="meter-reading-compact-panel-body">
            <div className="meter-reading-compact-form-grid">
              <label className="meter-reading-compact-field">
                <span>{zhCN.meterReadingPage.filterStartTime}</span>
                <input
                  type="datetime-local"
                  step="1"
                  value={filters.startTime}
                  max={filters.endTime}
                  onClick={(event) => openDateTimePicker(event.currentTarget)}
                  onChange={(event) => updateFilter("startTime", event.target.value)}
                />
              </label>
              <label className="meter-reading-compact-field">
                <span>{zhCN.meterReadingPage.filterEndTime}</span>
                <input
                  type="datetime-local"
                  step="1"
                  value={filters.endTime}
                  min={filters.startTime}
                  onClick={(event) => openDateTimePicker(event.currentTarget)}
                  onChange={(event) => updateFilter("endTime", event.target.value)}
                />
              </label>
            </div>
            <div className="meter-reading-compact-actions">
              <button type="button" className="meter-reading-compact-button is-primary" onClick={handleSearch}>
                {zhCN.meterReadingPage.search}
              </button>
              <button type="button" className="meter-reading-compact-button" onClick={handleReset} disabled={loading || exporting}>
                {zhCN.meterReadingPage.reset}
              </button>
              <button type="button" className="meter-reading-compact-button" onClick={handleExport} disabled={loading || exporting}>
                {exporting ? zhCN.meterReadingPage.exporting : zhCN.meterReadingPage.export}
              </button>
            </div>
            {(loadError || exportError) ? (
              <div className="meter-reading-compact-inline-error">{exportError || loadError}</div>
            ) : null}
            <div className="meter-reading-compact-source-list">
              {sourceRows.map((item) => (
                <article key={`${item.label}-${item.detail}`} className="meter-reading-compact-source-row">
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <span className={item.ok ? "is-ok" : "is-warn"}>{item.state}</span>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="meter-reading-compact-panel meter-reading-compact-table-panel">
          <header className="meter-reading-compact-panel-head">
            <h3>{zhCN.meterReadingPage.sectionTable}</h3>
            <span>
              {`${zhCN.meterReadingPage.rangeLatestFetch} ${latestFetchText} · 汇总 ${formatCount(totalRows)}${zhCN.meterReadingPage.unitRows} · ${formatCount(columns.length)}${zhCN.meterReadingPage.unitColumns}`}
            </span>
          </header>
          <div className="meter-reading-compact-panel-body">
            <div className="meter-reading-compact-table-meta">
              <span>{`${zhCN.meterReadingPage.rangeSelected} ${toLegacyDateTime(query.startTime)} ~ ${toLegacyDateTime(query.endTime)}`}</span>
              <span>字段保持后端顺序</span>
            </div>
            <div className="meter-reading-compact-table-wrap">
              {rows.length > 0 && columns.length > 0 ? (
                <table className="meter-reading-compact-table">
                  <colgroup>
                    {columns.map((column) => (
                      <col key={`meter-reading-col-${column}`} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} title={column}>{getColumnHeader(column)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`meter-reading-${index + 1}`}>
                        {columns.map((column) => (
                          <td
                            key={`${index + 1}-${column}`}
                            className={getCellToneClass(column)}
                            title={formatCellValue(row[column])}
                          >
                            {formatCellValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="meter-reading-compact-empty">
                  {loading ? zhCN.meterReadingPage.loading : zhCN.meterReadingPage.empty}
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="meter-reading-compact-panel">
          <header className="meter-reading-compact-panel-head">
            <h3>字段与口径</h3>
            <span>完整</span>
          </header>
          <div className="meter-reading-compact-panel-body">
            <div className="meter-reading-compact-mini-grid">
              <article><span>有效记录</span><strong>{formatCount(Math.max(totalRows - invalidRows, 0))}</strong></article>
              <article><span>异常记录</span><strong>{formatCount(invalidRows)}</strong></article>
              <article><span>平均COP</span><strong>{formatValue(averageValues(copValues))}</strong></article>
              <article><span>导出文件</span><strong>XLS</strong></article>
            </div>
            <div className="meter-reading-compact-field-list">
              {(columns.length > 0 ? columns : ["时间", "冷站总电量(kWh)", "系统冷量(RT·h)", "冷机电量(kWh)", "冷冻泵电量(kWh)", "冷却泵电量(kWh)", "冷却塔电量(kWh)", "系统COP", "数据来源", "状态"]).map((column) => (
                <div key={column}>
                  <strong>{column}</strong>
                  <span>{getColumnUnit(column)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="meter-reading-compact-boundary" aria-label="抄表边界">
        <article><span>抄表口径</span><strong>动态列</strong></article>
        <article><span>查询边界</span><strong>时间范围有效</strong></article>
        <article><span>导出内容</span><strong>全字段</strong></article>
        <article><span>页面边界</span><strong>只读不下发</strong></article>
      </section>
    </div>
  );
}
