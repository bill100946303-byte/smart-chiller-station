import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type OperationRecordDeviceOptionDto,
  type OperationRecordDeviceOptionsDto,
  type OperationRecordDeviceTypeDto,
  type OperationRecordDeviceTypeNodeDto,
  type ReportRecordDto,
  type ReportRecordRegOptionDto,
  type ReportRecordRegOptionsDto,
  exportReportRecords,
  fetchOperationRecordDeviceTypes,
  fetchOperationRecordDevices,
  fetchReportRecordRegOptions,
  fetchReportRecords
} from "../services/bffClient";

type FilterState = {
  date: string;
  drTypeId: string;
  drId: string;
  regIds: string[];
};

type QueryState = {
  startTime: string;
  endTime: string;
  drTypeId: string;
  drId: string;
  regIds: string[];
} | null;

type TypeSelectOption = {
  id: string;
  label: string;
};

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQuery(filters: FilterState): QueryState {
  return {
    startTime: `${filters.date} 00:00:00`,
    endTime: `${filters.date} 23:59:59`,
    drTypeId: filters.drTypeId,
    drId: filters.drId,
    regIds: [...filters.regIds]
  };
}

function flattenTypeOptions(nodes: OperationRecordDeviceTypeNodeDto[], depth = 0): TypeSelectOption[] {
  const prefix = depth > 0 ? `${"  ".repeat(Math.max(depth - 1, 0))}${depth === 1 ? "└ " : "└└ "}` : "";
  return nodes.flatMap((node) => {
    const id = String(node.id || "");
    const label = `${prefix}${node.label || id}`;
    const current = id ? [{ id, label }] : [];
    const children = Array.isArray(node.children) ? flattenTypeOptions(node.children, depth + 1) : [];
    return [...current, ...children];
  });
}

function findDeviceLabel(options: OperationRecordDeviceOptionDto[], id: string): string {
  return options.find((item) => String(item.id || "") === id)?.label || zhCN.reportRecordPage.filterSelectDevice;
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

function formatCellValue(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function buildSummaryCards(
  report: ReportRecordDto | null,
  deviceOptions: OperationRecordDeviceOptionDto[],
  query: QueryState,
  regOptions: ReportRecordRegOptionDto[]
): SummaryCard[] {
  const total = typeof report?.total === "number" ? report.total : 0;
  const columns = report?.columns?.length || 0;
  const selectedRegCount = query?.regIds.length || 0;
  const deviceLabel = query ? findDeviceLabel(deviceOptions, query.drId) : zhCN.reportRecordPage.filterSelectDevice;
  return [
    {
      title: zhCN.reportRecordPage.summaryTotal,
      value: String(total),
      unit: zhCN.reportRecordPage.unitRows,
      delta: zhCN.reportRecordPage.summaryTotalHint,
      tone: total > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.reportRecordPage.summaryColumns,
      value: String(columns),
      unit: zhCN.reportRecordPage.unitColumns,
      delta: zhCN.reportRecordPage.summaryColumnsHint,
      tone: columns > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.reportRecordPage.summaryPoints,
      value: selectedRegCount > 0 ? String(selectedRegCount) : zhCN.reportRecordPage.pointAll,
      unit: selectedRegCount > 0 ? zhCN.reportRecordPage.unitPoints : "",
      delta:
        selectedRegCount > 0
          ? zhCN.reportRecordPage.summaryPointsSelected
          : `${zhCN.reportRecordPage.summaryPointsAll} ${regOptions.length}`,
      tone: regOptions.length > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.reportRecordPage.summaryDevice,
      value: deviceLabel,
      unit: "",
      delta: query ? `${query.startTime} ~ ${query.endTime}` : zhCN.reportRecordPage.summaryRangeHint,
      tone: query ? "neutral" : "warn"
    }
  ];
}

export default function ReportRecordsPage() {
  const today = formatDateInput(new Date());
  const [filters, setFilters] = useState<FilterState>({
    date: today,
    drTypeId: "0",
    drId: "0",
    regIds: []
  });
  const [query, setQuery] = useState<QueryState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [report, setReport] = useState<ReportRecordDto | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [types, setTypes] = useState<OperationRecordDeviceTypeDto | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<OperationRecordDeviceOptionsDto | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [regs, setRegs] = useState<ReportRecordRegOptionsDto | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const initialAutoLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadTypes() {
      try {
        const result = await fetchOperationRecordDeviceTypes(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(result);
          setTypeError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setTypes(null);
          setTypeError(zhCN.reportRecordPage.typeLoadFailed);
        });
      }
    }

    loadTypes();
    return () => {
      active = false;
    };
  }, []);

  const typeOptions = useMemo(() => flattenTypeOptions(types?.items || []), [types]);

  useEffect(() => {
    const firstTypeId = typeOptions[0]?.id;
    if (!firstTypeId) {
      return;
    }
    setFilters((current) => (current.drTypeId === "0" ? { ...current, drTypeId: firstTypeId } : current));
  }, [typeOptions]);

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      if (filters.drTypeId === "0") {
        startTransition(() => {
          setDevices({
            items: [
              {
                id: "0",
                label: zhCN.reportRecordPage.filterSelectDevice
              }
            ]
          });
          setRegs(null);
          setDeviceError(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            drId: "0",
            regIds: []
          }));
        });
        return;
      }

      try {
        const result = await fetchOperationRecordDevices(runtimeConfig.siteId, filters.drTypeId);
        if (!active) {
          return;
        }
        const items = [
          {
            id: "0",
            label: zhCN.reportRecordPage.filterSelectDevice
          },
          ...(result.items || [])
        ];
        const firstActualId = String(items.find((item) => String(item.id || "") !== "0")?.id || "0");
        const nextDrId = items.some((item) => String(item.id || "") === filters.drId) ? filters.drId : firstActualId;
        const nextFilters: FilterState = {
          ...filters,
          drId: nextDrId,
          regIds: nextDrId === filters.drId ? filters.regIds : []
        };

        startTransition(() => {
          setDevices({
            ...result,
            items
          });
          setDeviceError(null);
          setFilters((current) => ({
            ...current,
            drId: items.some((item) => String(item.id || "") === current.drId) ? current.drId : firstActualId,
            regIds: items.some((item) => String(item.id || "") === current.drId) ? current.regIds : []
          }));
          if (!initialAutoLoadedRef.current && nextDrId !== "0") {
            setQuery(buildQuery(nextFilters));
            initialAutoLoadedRef.current = true;
          }
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDevices({
            items: [
              {
                id: "0",
                label: zhCN.reportRecordPage.filterSelectDevice
              }
            ]
          });
          setDeviceError(zhCN.reportRecordPage.deviceLoadFailed);
          setRegs(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            drId: "0",
            regIds: []
          }));
        });
      }
    }

    loadDevices();
    return () => {
      active = false;
    };
  }, [filters.drTypeId]);

  useEffect(() => {
    let active = true;

    async function loadRegs() {
      if (filters.drTypeId === "0" || filters.drId === "0") {
        startTransition(() => {
          setRegs(null);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            regIds: []
          }));
        });
        return;
      }

      try {
        const result = await fetchReportRecordRegOptions(runtimeConfig.siteId, {
          drTypeId: filters.drTypeId,
          drId: filters.drId
        });
        if (!active) {
          return;
        }
        const allowedIds = new Set((result.items || []).map((item) => String(item.id || "")));
        startTransition(() => {
          setRegs(result);
          setRegError(null);
          setFilters((current) => ({
            ...current,
            regIds: current.regIds.filter((item) => allowedIds.has(item))
          }));
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setRegs(null);
          setRegError(zhCN.reportRecordPage.regLoadFailed);
          setFilters((current) => ({
            ...current,
            regIds: []
          }));
        });
      }
    }

    loadRegs();
    return () => {
      active = false;
    };
  }, [filters.drTypeId, filters.drId]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      if (!query) {
        startTransition(() => {
          setLoading(false);
        });
        return;
      }

      setLoading(true);
      try {
        const result = await fetchReportRecords(runtimeConfig.siteId, {
          page,
          pageSize,
          ...query
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setReport(result);
          setReportError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setReport(null);
          setReportError(zhCN.reportRecordPage.degraded);
          setLoading(false);
        });
      }
    }

    loadReport();
    return () => {
      active = false;
    };
  }, [page, pageSize, query]);

  const deviceOptions = devices?.items || [
    {
      id: "0",
      label: zhCN.reportRecordPage.filterSelectDevice
    }
  ];
  const regOptions = regs?.items || [];
  const displayQuery = query || (filters.drId !== "0" ? buildQuery(filters) : null);
  const summaryCards = buildSummaryCards(report, deviceOptions, displayQuery, regOptions);
  const sourceSummary = summarizeSourceStatus([types?.sourceStatus, devices?.sourceStatus, regs?.sourceStatus, report?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([types?.sourceStatus, devices?.sourceStatus, regs?.sourceStatus, report?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [types?.sourceStatus, devices?.sourceStatus, regs?.sourceStatus, report?.sourceStatus],
    {
      labelMode: "short"
    }
  );
  const bannerText =
    exportError ||
    reportError ||
    typeError ||
    deviceError ||
    regError ||
    (loading ? zhCN.reportRecordPage.loading : sourceSummary.text);
  const items = report?.items || [];
  const columns = report?.columns || [];
  const total = typeof report?.total === "number" ? report.total : items.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    setExportError(null);
  }

  function toggleReg(regId: string) {
    setFilters((current) => {
      const exists = current.regIds.includes(regId);
      return {
        ...current,
        regIds: exists
          ? current.regIds.filter((item) => item !== regId)
          : [...current.regIds, regId]
      };
    });
  }

  function handleSearch() {
    if (filters.drId === "0") {
      setReportError(zhCN.reportRecordPage.deviceRequired);
      return;
    }
    setPage(1);
    setReportError(null);
    setExportError(null);
    setQuery(buildQuery(filters));
  }

  function handleReset() {
    const firstTypeId = typeOptions[0]?.id || "0";
    setPage(1);
    setPageSize(10);
    setReport(null);
    setReportError(null);
    setExportError(null);
    setQuery(null);
    setFilters({
      date: today,
      drTypeId: firstTypeId,
      drId: "0",
      regIds: []
    });
  }

  async function handleExport() {
    if (!query) {
      setExportError(zhCN.reportRecordPage.deviceRequired);
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const file = await exportReportRecords(runtimeConfig.siteId, query);
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || `${report?.filenamePrefix || "report-record"}${zhCN.reportRecordPage.exportFileSuffix}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setExportError(zhCN.reportRecordPage.exportFailed);
      });
    }
  }

  return (
    <div className="report-record-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(exportError || reportError || typeError || deviceError || regError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="report-record-header">
        <h2>{zhCN.reportRecordPage.heading}</h2>
        <p>{zhCN.reportRecordPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.reportRecordPage.sectionFilters}>
        <div className="report-record-filter-grid">
          <label className="report-record-field">
            <span>{zhCN.reportRecordPage.filterDate}</span>
            <input
              type="date"
              value={filters.date}
              max={today}
              onChange={(event) => updateFilter("date", event.target.value)}
            />
          </label>
          <label className="report-record-field">
            <span>{zhCN.reportRecordPage.filterType}</span>
            <select
              value={filters.drTypeId}
              onChange={(event) => {
                updateFilter("drTypeId", event.target.value);
                updateFilter("drId", "0");
                updateFilter("regIds", []);
              }}
            >
              <option value="0">{zhCN.reportRecordPage.filterSelectType}</option>
              {typeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="report-record-field">
            <span>{zhCN.reportRecordPage.filterDevice}</span>
            <select
              value={filters.drId}
              onChange={(event) => {
                updateFilter("drId", event.target.value);
                updateFilter("regIds", []);
              }}
              disabled={filters.drTypeId === "0"}
            >
              {deviceOptions.map((item) => (
                <option key={String(item.id || "0")} value={String(item.id || "0")}>
                  {item.label || zhCN.reportRecordPage.filterSelectDevice}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-record-actions">
          <button type="button" className="report-record-button is-primary" onClick={handleSearch}>
            {zhCN.reportRecordPage.search}
          </button>
          <button type="button" className="report-record-button" onClick={handleReset}>
            {zhCN.reportRecordPage.reset}
          </button>
          <button
            type="button"
            className="report-record-button"
            onClick={handleExport}
            disabled={exporting || !query || total === 0}
          >
            {exporting ? zhCN.reportRecordPage.exporting : zhCN.reportRecordPage.export}
          </button>
        </div>
      </SectionCard>

      <div className="report-record-summary-grid">
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

      <SectionCard
        title={zhCN.reportRecordPage.sectionRegs}
        action={
          <div className="report-record-reg-actions">
            <button
              type="button"
              className="report-record-button"
              onClick={() => updateFilter("regIds", regOptions.map((item) => String(item.id || "")))}
              disabled={regOptions.length === 0}
            >
              {zhCN.reportRecordPage.selectAllRegs}
            </button>
            <button
              type="button"
              className="report-record-button"
              onClick={() => updateFilter("regIds", [])}
              disabled={regOptions.length === 0 || filters.regIds.length === 0}
            >
              {zhCN.reportRecordPage.clearRegs}
            </button>
          </div>
        }
      >
        <p className="report-record-reg-hint">{zhCN.reportRecordPage.regHint}</p>
        {regOptions.length > 0 ? (
          <div className="report-record-reg-grid">
            {regOptions.map((item) => {
              const regId = String(item.id || "");
              const active = filters.regIds.includes(regId);
              return (
                <button
                  key={regId}
                  type="button"
                  className={`report-record-reg-chip${active ? " is-active" : ""}`}
                  onClick={() => toggleReg(regId)}
                >
                  {item.label || regId}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="report-record-empty">
            {regError || (filters.drId === "0" ? zhCN.reportRecordPage.regEmptyIdle : zhCN.reportRecordPage.regEmpty)}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={zhCN.reportRecordPage.sectionTable}
        action={
          <div className="report-record-list-toolbar">
            <span>{`${zhCN.reportRecordPage.rangeLatestFetch} ${formatDateTime(report?.generatedAt || report?.freshness?.latestTimestamp)}`}</span>
            <label>
              {zhCN.reportRecordPage.pageSizeLabel}
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
              >
                {PAGE_SIZE_OPTIONS.map((item) => (
                  <option key={item} value={String(item)}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {items.length > 0 && columns.length > 0 ? (
          <div className="report-record-table-shell">
            <table className="report-record-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, rowIndex) => (
                  <tr key={`report-row-${rowIndex + 1}`}>
                    {columns.map((column) => (
                      <td key={`${column}-${rowIndex + 1}`}>{formatCellValue(item[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="report-record-empty">
            {loading ? zhCN.reportRecordPage.loading : zhCN.reportRecordPage.empty}
          </div>
        )}

        <div className="report-record-pagination">
          <span>{`${zhCN.reportRecordPage.pageLabel} ${page}/${pageCount}`}</span>
          <span>{`${zhCN.reportRecordPage.summaryTotal} ${total}${zhCN.reportRecordPage.unitRows}`}</span>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            {zhCN.reportRecordPage.pagePrev}
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
          >
            {zhCN.reportRecordPage.pageNext}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
