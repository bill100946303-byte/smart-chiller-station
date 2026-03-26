import { startTransition, useEffect, useMemo, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type OperationRecordDeviceOptionDto,
  type OperationRecordDeviceOptionsDto,
  type OperationRecordDeviceTypeDto,
  type OperationRecordDeviceTypeNodeDto,
  type OperationRecordListDto,
  type OperationRecordListItemDto,
  fetchOperationRecordDeviceTypes,
  fetchOperationRecordDevices,
  fetchOperationRecords
} from "../services/bffClient";

type FilterState = {
  startDate: string;
  endDate: string;
  drTypeId: string;
  drId: string;
};

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

function findTypeLabel(options: TypeSelectOption[], id: string): string {
  return options.find((item) => item.id === id)?.label || zhCN.operationRecordPage.filterAll;
}

function findDeviceLabel(options: OperationRecordDeviceOptionDto[], id: string): string {
  return options.find((item) => String(item.id || "") === id)?.label || zhCN.operationRecordPage.filterAll;
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

function resultTone(value: string | undefined): "good" | "warn" | "neutral" {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("成功") || normalized.includes("success") || normalized.includes("完成")) {
    return "good";
  }
  if (normalized.includes("失败") || normalized.includes("error") || normalized.includes("异常")) {
    return "warn";
  }
  return "neutral";
}

function buildSummaryCards(
  records: OperationRecordListDto | null,
  typeOptions: TypeSelectOption[],
  deviceOptions: OperationRecordDeviceOptionDto[],
  query: FilterState
): SummaryCard[] {
  const total = typeof records?.total === "number" ? records.total : 0;
  const page = typeof records?.page === "number" ? records.page : 1;
  return [
    {
      title: zhCN.operationRecordPage.summaryTotal,
      value: String(total),
      unit: zhCN.common.unitItem,
      delta: zhCN.operationRecordPage.summaryPagePrefix + page,
      tone: total > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.operationRecordPage.summaryType,
      value: findTypeLabel(typeOptions, query.drTypeId),
      unit: "",
      delta: zhCN.operationRecordPage.summaryFilterHint,
      tone: "neutral"
    },
    {
      title: zhCN.operationRecordPage.summaryDevice,
      value: findDeviceLabel(deviceOptions, query.drId),
      unit: "",
      delta: zhCN.operationRecordPage.summaryFilterHint,
      tone: "neutral"
    },
    {
      title: zhCN.operationRecordPage.summaryRange,
      value: `${query.startDate} ~ ${query.endDate}`,
      unit: "",
      delta: zhCN.operationRecordPage.summaryRangeHint,
      tone: "neutral"
    }
  ];
}

export default function OperationRecordsPage() {
  const today = formatDateInput(new Date());
  const initialFilters: FilterState = {
    startDate: today,
    endDate: today,
    drTypeId: "0",
    drId: "0"
  };
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [records, setRecords] = useState<OperationRecordListDto | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [types, setTypes] = useState<OperationRecordDeviceTypeDto | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<OperationRecordDeviceOptionsDto | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          setTypeError(zhCN.operationRecordPage.typeLoadFailed);
        });
      }
    }

    loadTypes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      if (filters.drTypeId === "0") {
        startTransition(() => {
          setDevices({
            items: [
              {
                id: "0",
                label: zhCN.operationRecordPage.filterAll
              }
            ]
          });
          setDeviceError(null);
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
            label: zhCN.operationRecordPage.filterAll
          },
          ...(result.items || [])
        ];
        startTransition(() => {
          setDevices({
            ...result,
            items
          });
          setDeviceError(null);
          setFilters((current) => {
            if (items.some((item) => String(item.id || "") === current.drId)) {
              return current;
            }
            return {
              ...current,
              drId: "0"
            };
          });
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
                label: zhCN.operationRecordPage.filterAll
              }
            ]
          });
          setDeviceError(zhCN.operationRecordPage.deviceLoadFailed);
          setFilters((current) => ({
            ...current,
            drId: "0"
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

    async function loadRecords() {
      setLoading(true);
      try {
        const result = await fetchOperationRecords(runtimeConfig.siteId, {
          page,
          pageSize,
          startDate: query.startDate,
          endDate: query.endDate,
          drTypeId: query.drTypeId,
          drId: query.drId
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setRecords(result);
          setRecordsError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setRecords(null);
          setRecordsError(zhCN.operationRecordPage.degraded);
          setLoading(false);
        });
      }
    }

    loadRecords();
    return () => {
      active = false;
    };
  }, [page, pageSize, query]);

  const typeOptions = useMemo(() => {
    const options = flattenTypeOptions(types?.items || []);
    return [
      {
        id: "0",
        label: zhCN.operationRecordPage.filterAll
      },
      ...options
    ];
  }, [types]);
  const deviceOptions = devices?.items || [
    {
      id: "0",
      label: zhCN.operationRecordPage.filterAll
    }
  ];

  const sourceSummary = summarizeSourceStatus([records?.sourceStatus, types?.sourceStatus, devices?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([records?.sourceStatus, types?.sourceStatus, devices?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [records?.sourceStatus, types?.sourceStatus, devices?.sourceStatus],
    {
      labelMode: "short"
    }
  );
  const summaryCards = buildSummaryCards(records, typeOptions, deviceOptions, query);
  const items = records?.items || [];
  const total = typeof records?.total === "number" ? records.total : items.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const bannerText = recordsError || typeError || deviceError || sourceSummary.text;

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleSearch() {
    setPage(1);
    setQuery(filters);
  }

  function handleReset() {
    setPage(1);
    setPageSize(10);
    setFilters(initialFilters);
    setQuery(initialFilters);
  }

  function renderRecordRow(item: OperationRecordListItemDto, index: number) {
    return (
      <div key={item.id || `operation-record-${index + 1}`} className="operation-record-table-row">
        <span className="operation-record-cell" data-label={zhCN.operationRecordPage.tableTime}>
          {item.date || zhCN.common.timeUnknown}
        </span>
        <span className="operation-record-cell operation-record-cell-detail" data-label={zhCN.operationRecordPage.tableContent}>
          {item.details || "--"}
        </span>
        <span className="operation-record-cell" data-label={zhCN.operationRecordPage.tableResult}>
          <StatusPill label={item.operationResult || "--"} tone={resultTone(item.operationResult)} />
        </span>
        <span className="operation-record-cell" data-label={zhCN.operationRecordPage.tableOperator}>
          {item.operationPerson || "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="operation-record-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={Boolean(recordsError || typeError || deviceError) || sourceSummary.warn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="operation-record-header">
        <h2>{zhCN.operationRecordPage.heading}</h2>
        <p>{zhCN.operationRecordPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.operationRecordPage.sectionFilters}>
        <div className="operation-record-filter-grid">
          <label className="operation-record-field">
            <span>{zhCN.operationRecordPage.filterStartDate}</span>
            <input
              type="date"
              value={filters.startDate}
              max={filters.endDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </label>
          <label className="operation-record-field">
            <span>{zhCN.operationRecordPage.filterEndDate}</span>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              max={today}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </label>
          <label className="operation-record-field">
            <span>{zhCN.operationRecordPage.filterType}</span>
            <select
              value={filters.drTypeId}
              onChange={(event) => {
                updateFilter("drTypeId", event.target.value);
                updateFilter("drId", "0");
              }}
            >
              {typeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="operation-record-field">
            <span>{zhCN.operationRecordPage.filterDevice}</span>
            <select
              value={filters.drId}
              onChange={(event) => updateFilter("drId", event.target.value)}
              disabled={filters.drTypeId === "0"}
            >
              {deviceOptions.map((item) => (
                <option key={String(item.id || "0")} value={String(item.id || "0")}>
                  {item.label || zhCN.operationRecordPage.filterAll}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="operation-record-filter-actions">
          <button type="button" className="operation-record-button is-primary" onClick={handleSearch}>
            {zhCN.operationRecordPage.search}
          </button>
          <button type="button" className="operation-record-button" onClick={handleReset}>
            {zhCN.operationRecordPage.reset}
          </button>
        </div>
      </SectionCard>

      <div className="operation-record-summary-grid">
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
        title={zhCN.operationRecordPage.sectionList}
        action={
          <div className="operation-record-list-toolbar">
            <span>{`${zhCN.operationRecordPage.rangeLatestFetch} ${formatDateTime(records?.generatedAt || records?.freshness?.latestTimestamp)}`}</span>
            <label>
              {zhCN.operationRecordPage.pageSizeLabel}
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
        {items.length > 0 ? (
          <div className="operation-record-table">
            <div className="operation-record-table-head">
              <span>{zhCN.operationRecordPage.tableTime}</span>
              <span>{zhCN.operationRecordPage.tableContent}</span>
              <span>{zhCN.operationRecordPage.tableResult}</span>
              <span>{zhCN.operationRecordPage.tableOperator}</span>
            </div>
            {items.map(renderRecordRow)}
          </div>
        ) : (
          <div className="operation-record-empty">
            {loading ? zhCN.operationRecordPage.loading : zhCN.operationRecordPage.empty}
          </div>
        )}

        <div className="operation-record-pagination">
          <span>{`${zhCN.operationRecordPage.pageLabel} ${page}/${pageCount}`}</span>
          <span>{`${zhCN.operationRecordPage.summaryTotal} ${total}${zhCN.common.unitItem}`}</span>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            {zhCN.operationRecordPage.pagePrev}
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
          >
            {zhCN.operationRecordPage.pageNext}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
