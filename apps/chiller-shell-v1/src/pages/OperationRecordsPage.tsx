import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { getCurrentLocale, zhCN } from "../i18n/zhCN";
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

type AuditMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "danger" | "blue";
};

type OperationRecordStage = {
  key: string;
  label: string;
  result: string;
  tone: "good" | "warn" | "neutral";
};

type OperationRecordPhase = "dispatch" | "execute" | "other";

type OperationRecordViewItem = {
  id: string;
  date?: string;
  timestamp?: string | null;
  details?: string;
  operationPerson?: string;
  stages: OperationRecordStage[];
  sourceItems: OperationRecordListItemDto[];
  hasDispatch: boolean;
  hasExecute: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, offsetDays: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + offsetDays);
  return next;
}

function flattenTypeOptions(nodes: OperationRecordDeviceTypeNodeDto[], depth = 0): TypeSelectOption[] {
  const prefix = depth > 0 ? `${"  ".repeat(Math.max(depth - 1, 0))}${depth === 1 ? "- " : "-- "}` : "";
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

function formatShortTime(value: string | null | undefined): string {
  if (!value) {
    return "--:--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = value.match(/\b\d{1,2}:\d{2}\b/);
    return match?.[0] || "--:--";
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function mapLegacyLanguage(): string {
  const locale = getCurrentLocale();
  if (locale === "en-US") {
    return "en";
  }
  if (locale === "vi-VN") {
    return "vie";
  }
  return "zh";
}

function normalizeResult(value: string | undefined): string {
  return String(value || "").trim();
}

function normalizeAuditText(value: string | null | undefined): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuditIdentity(value: string | null | undefined): string {
  return normalizeAuditText(value).replace(/\s+/g, "");
}

function getOperationMinuteBucket(value: string | null | undefined): string {
  const normalized = normalizeAuditText(value);
  if (!normalized) {
    return "time-unknown";
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hour = String(parsed.getHours()).padStart(2, "0");
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  const match = normalized.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].replace(/\//g, "-")} ${match[2].padStart(2, "0")}:${match[3]}`;
  }

  return normalized;
}

function classifyOperationPhase(result: string | undefined): OperationRecordPhase {
  const normalized = normalizeResult(result).toLowerCase();
  if (normalized.includes("下发") || normalized.includes("发送") || normalized.includes("dispatch")) {
    return "dispatch";
  }
  if (normalized.includes("执行") || normalized.includes("execute") || normalized.includes("executed")) {
    return "execute";
  }
  return "other";
}

function phaseLabel(phase: OperationRecordPhase): string {
  if (phase === "dispatch") {
    return "下发";
  }
  if (phase === "execute") {
    return "执行";
  }
  return "记录";
}

function phaseSortWeight(stage: OperationRecordStage): number {
  if (stage.key.startsWith("dispatch")) {
    return 1;
  }
  if (stage.key.startsWith("execute")) {
    return 2;
  }
  return 3;
}

function resultTone(value: string | undefined): "good" | "warn" | "neutral" {
  const normalized = normalizeResult(value).toLowerCase();
  if (
    normalized.includes("失败")
    || normalized.includes("error")
    || normalized.includes("异常")
    || normalized.includes("回退")
    || normalized.includes("拒绝")
  ) {
    return "warn";
  }
  if (
    normalized.includes("成功")
    || normalized.includes("success")
    || normalized.includes("完成")
    || normalized.includes("已记录")
    || normalized.includes("仅建议")
  ) {
    return "good";
  }
  return "neutral";
}

function isReviewRecord(item: OperationRecordListItemDto): boolean {
  const text = `${item.operationResult || ""} ${item.details || ""}`.toLowerCase();
  return ["失败", "error", "异常", "回退", "拒绝"].some((keyword) => text.includes(keyword));
}

function isReviewViewItem(item: OperationRecordViewItem): boolean {
  return item.sourceItems.some(isReviewRecord);
}

function isAdviceRecord(item: OperationRecordListItemDto): boolean {
  const text = `${item.operationResult || ""} ${item.details || ""}`;
  return text.includes("建议") || text.includes("影子") || /(?:^|\b)(ai|shadow)(?:\b|$)/i.test(text);
}

function isAdviceViewItem(item: OperationRecordViewItem): boolean {
  return item.sourceItems.some(isAdviceRecord);
}

function isCompleteRecord(item: OperationRecordListItemDto): boolean {
  return Boolean(item.date && item.details && item.operationResult && item.operationPerson);
}

function isCompleteViewItem(item: OperationRecordViewItem): boolean {
  return item.sourceItems.length > 0 && item.sourceItems.every(isCompleteRecord);
}

function formatStageResultLabel(value: string): string {
  return normalizeResult(value).replace(/[（(][^（）()]*[）)]/g, "").trim() || value;
}

function summarizeStageResults(item: OperationRecordViewItem): string {
  return item.stages.map((stage) => formatStageResultLabel(stage.result) || stage.label).join(" / ") || "已记录";
}

function mergeOperationRecordItems(sourceItems: OperationRecordListItemDto[]): OperationRecordViewItem[] {
  const groups = new Map<string, OperationRecordViewItem>();
  const orderedGroups: OperationRecordViewItem[] = [];

  sourceItems.forEach((item, index) => {
    const phase = classifyOperationPhase(item.operationResult);
    const result = normalizeResult(item.operationResult) || "--";
    const details = normalizeAuditIdentity(item.details);
    const person = normalizeAuditIdentity(item.operationPerson);
    const timeBucket = getOperationMinuteBucket(item.timestamp || item.date);
    const groupKey =
      phase === "dispatch" || phase === "execute"
        ? `${timeBucket}|${details}|${person}`
        : `${timeBucket}|${details}|${person}|${result}`;
    const existing = groups.get(groupKey);
    const group =
      existing
      || {
        id: item.id || `operation-record-group-${index + 1}`,
        date: item.date,
        timestamp: item.timestamp,
        details: item.details,
        operationPerson: item.operationPerson,
        stages: [],
        sourceItems: [],
        hasDispatch: false,
        hasExecute: false
      };

    group.sourceItems.push(item);
    group.date ||= item.date;
    group.timestamp ||= item.timestamp;
    group.details ||= item.details;
    group.operationPerson ||= item.operationPerson;
    group.hasDispatch = group.hasDispatch || phase === "dispatch";
    group.hasExecute = group.hasExecute || phase === "execute";

    const stageKey = phase === "other" ? `other-${result}` : phase;
    const hasSameStage = group.stages.some((stage) => stage.key === stageKey && stage.result === result);
    if (!hasSameStage) {
      group.stages.push({
        key: stageKey,
        label: phaseLabel(phase),
        result,
        tone: resultTone(result)
      });
      group.stages.sort((left, right) => phaseSortWeight(left) - phaseSortWeight(right));
    }

    if (!existing) {
      groups.set(groupKey, group);
      orderedGroups.push(group);
    }
  });

  return orderedGroups;
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return "--";
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default function OperationRecordsPage() {
  const requestLanguage = mapLegacyLanguage();
  const currentDate = new Date();
  const today = formatDateInput(currentDate);
  const defaultLookbackDays = 6;
  const defaultStartDate = formatDateInput(shiftDate(currentDate, -defaultLookbackDays));
  const initialFilters: FilterState = {
    startDate: defaultStartDate,
    endDate: today,
    drTypeId: "0",
    drId: "0"
  };
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [records, setRecords] = useState<OperationRecordListDto | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [types, setTypes] = useState<OperationRecordDeviceTypeDto | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [devices, setDevices] = useState<OperationRecordDeviceOptionsDto | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const deviceDropdownRef = useRef<HTMLDivElement | null>(null);

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
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setIsTypeDropdownOpen(false);
      }
      if (target && deviceDropdownRef.current && !deviceDropdownRef.current.contains(target)) {
        setIsDeviceDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTypeDropdownOpen(false);
        setIsDeviceDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
          drId: query.drId,
          language: requestLanguage
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
  }, [page, pageSize, query, requestLanguage]);

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
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [records?.sourceStatus, types?.sourceStatus, devices?.sourceStatus],
    {
      labelMode: "short"
    }
  );
  const rawItems = records?.items || [];
  const items = useMemo(() => mergeOperationRecordItems(rawItems), [rawItems]);
  const total = typeof records?.total === "number" ? records.total : rawItems.length;
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const pageReviewCount = items.filter(isReviewViewItem).length;
  const pageAdviceCount = items.filter(isAdviceViewItem).length;
  const pageCompleteCount = items.filter(isCompleteViewItem).length;
  const pageClosedLoopCount = items.filter((item) => item.hasDispatch && item.hasExecute).length;
  const activeTypeLabel = findTypeLabel(typeOptions, query.drTypeId);
  const activeDeviceLabel = findDeviceLabel(deviceOptions, query.drId);
  const editingTypeLabel = findTypeLabel(typeOptions, filters.drTypeId);
  const editingDeviceLabel = findDeviceLabel(deviceOptions, filters.drId);
  const latestFetchText = formatDateTime(records?.generatedAt || records?.freshness?.latestTimestamp);
  const latestShortTime = formatShortTime(records?.generatedAt || records?.freshness?.latestTimestamp);
  const statusDigestLines = Array.from(new Set(sourceStatusLinesCompact.filter(Boolean))).slice(0, 1);
  const emptyText = loading
    ? zhCN.operationRecordPage.loading
    : recordsError || typeError || deviceError || zhCN.operationRecordPage.empty;
  const bannerText = recordsError || typeError || deviceError || (loading ? zhCN.operationRecordPage.loading : sourceSummary.text);
  const auditStatusLabel = recordsError || typeError || deviceError ? "需检查" : sourceSummary.warn ? "部分回退" : "可追溯";
  const auditStatusTone = recordsError || typeError || deviceError || sourceSummary.warn ? "warn" : "good";
  const auditMetrics: AuditMetric[] = [
    {
      label: "记录总数",
      value: String(total),
      detail: `当前页 ${items.length} 条合并记录 / 完整 ${pageCompleteCount} 条 / 原始 ${rawItems.length} 条`,
      tone: "blue"
    },
    {
      label: "审计闭环率",
      value: formatPercent(pageClosedLoopCount, items.length),
      detail: `${pageClosedLoopCount} 条同时具备下发与执行结果`,
      tone: items.length > 0 && pageClosedLoopCount === items.length ? "good" : "warn"
    },
    {
      label: "待复核",
      value: String(pageReviewCount),
      detail: pageReviewCount > 0 ? "当前页含失败、异常或回退记录" : "当前页暂无复核项",
      tone: pageReviewCount > 0 ? "warn" : "good"
    },
    {
      label: "AI建议留痕",
      value: String(pageAdviceCount),
      detail: "仅统计当前页建议/影子模式相关记录",
      tone: "good"
    },
    {
      label: "最近拉取",
      value: latestShortTime,
      detail: latestFetchText,
      tone: "blue"
    }
  ];
  const appliedTags = [
    { label: zhCN.operationRecordPage.filterStartDate, value: query.startDate },
    { label: zhCN.operationRecordPage.filterEndDate, value: query.endDate },
    { label: zhCN.operationRecordPage.filterType, value: activeTypeLabel },
    { label: zhCN.operationRecordPage.filterDevice, value: activeDeviceLabel }
  ];
  const latestEvents = items.slice(0, 4);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function openDatePicker(input: HTMLInputElement) {
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (_error) {
        // Some browsers may reject showPicker without a valid user gesture.
      }
    }
  }

  function handleSearch() {
    setIsTypeDropdownOpen(false);
    setIsDeviceDropdownOpen(false);
    setPage(1);
    setQuery({
      ...filters
    });
  }

  function handleReset() {
    setIsTypeDropdownOpen(false);
    setIsDeviceDropdownOpen(false);
    setPage(1);
    setPageSize(20);
    setFilters(initialFilters);
    setQuery({
      ...initialFilters
    });
  }

  function renderRecordRow(item: OperationRecordViewItem, index: number) {
    return (
      <div key={item.id || `operation-record-${index + 1}`} className="operation-record-table-row">
        <span className="operation-record-cell operation-record-cell-time" data-label={zhCN.operationRecordPage.tableTime}>
          <strong>{formatShortTime(item.timestamp || item.date)}</strong>
          <small>{item.date || zhCN.common.timeUnknown}</small>
        </span>
        <span className="operation-record-cell operation-record-cell-detail" data-label="记录内容">
          {item.details || "--"}
        </span>
        <span className="operation-record-cell" data-label={zhCN.operationRecordPage.tableResult}>
          <span className="operation-record-result-stack" title={item.stages.map((stage) => stage.result).join(" / ")}>
            {item.stages.map((stage) => (
              <StatusPill
                key={`${item.id}-${stage.key}-${stage.result}`}
                label={formatStageResultLabel(stage.result)}
                tone={stage.tone}
              />
            ))}
          </span>
        </span>
        <span className="operation-record-cell" data-label={zhCN.operationRecordPage.tableOperator}>
          {item.operationPerson || "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="operation-record-page operation-record-page-v2 page-enter">
      <section className="operation-record-header operation-record-command-board subpage-command-board">
        <div className="subpage-command-copy operation-record-command-copy">
          <p className="operation-record-eyebrow">{runtimeConfig.appModeLabel || "运行审计"}</p>
          <h2>{zhCN.operationRecordPage.heading}</h2>
          <p>统一归档人工操作、AI建议、审批结果与 PLC 执行回执，形成可追溯审计链。</p>
          <div className="operation-record-command-tags" aria-label={zhCN.operationRecordPage.sectionFilters}>
            {appliedTags.map((item) => (
              <span key={`${item.label}-${item.value}`}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        </div>
        <div className="subpage-command-side operation-record-command-side">
          <span className="operation-record-command-side-label">审计状态</span>
          <strong>{auditStatusLabel}</strong>
          <p>本页仅提供记录查询、审计与分页追溯，不触发 PLC 写入或自动控制。</p>
          <div className="operation-record-status-list" aria-label="数据源状态">
            <span className={`operation-record-status-chip is-${auditStatusTone}`}>{bannerText}</span>
            {statusDigestLines.map((line, index) => (
              <span key={`operation-hero-status-${index + 1}-${line}`} className="operation-record-status-chip">
                {line}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="operation-record-metric-grid" aria-label="操作记录审计指标">
        {auditMetrics.map((item) => (
          <article key={item.label} className={`operation-record-metric-card${item.tone ? ` is-${item.tone}` : ""}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="operation-record-workspace" aria-label="操作记录工作区">
        <SectionCard
          title={zhCN.operationRecordPage.sectionFilters}
          action={<StatusPill label="已应用" tone={auditStatusTone} />}
        >
          <div className="operation-record-filter-stack">
            <label className="operation-record-field">
              <span>{zhCN.operationRecordPage.filterStartDate}</span>
              <input
                type="date"
                value={filters.startDate}
                max={filters.endDate}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                onClick={(event) => openDatePicker(event.currentTarget)}
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
                onClick={(event) => openDatePicker(event.currentTarget)}
              />
            </label>
            <label className="operation-record-field">
              <span>{zhCN.operationRecordPage.filterType}</span>
              <div className="operation-record-select" ref={typeDropdownRef}>
                <button
                  type="button"
                  className={`operation-record-select-trigger${isTypeDropdownOpen ? " is-open" : ""}`}
                  onClick={() => {
                    setIsTypeDropdownOpen((current) => !current);
                    setIsDeviceDropdownOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isTypeDropdownOpen}
                  aria-controls="operation-record-type-listbox"
                >
                  <span className="operation-record-select-trigger-text">{editingTypeLabel}</span>
                  <ChevronDown className="operation-record-select-caret" size={14} aria-hidden="true" />
                </button>
                {isTypeDropdownOpen ? (
                  <div
                    id="operation-record-type-listbox"
                    className="operation-record-select-menu"
                    role="listbox"
                    aria-label={zhCN.operationRecordPage.filterType}
                  >
                    {typeOptions.map((item) => {
                      const isActive = item.id === filters.drTypeId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`operation-record-select-option${isActive ? " is-active" : ""}`}
                          onClick={() => {
                            updateFilter("drTypeId", item.id);
                            updateFilter("drId", "0");
                            setIsTypeDropdownOpen(false);
                            setIsDeviceDropdownOpen(false);
                          }}
                          title={item.label}
                        >
                          <span className="operation-record-select-option-label">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </label>
            <label className="operation-record-field">
              <span>{zhCN.operationRecordPage.filterDevice}</span>
              <div className="operation-record-select" ref={deviceDropdownRef}>
                <button
                  type="button"
                  className={`operation-record-select-trigger${isDeviceDropdownOpen ? " is-open" : ""}`}
                  onClick={() => {
                    if (filters.drTypeId === "0") {
                      return;
                    }
                    setIsDeviceDropdownOpen((current) => !current);
                    setIsTypeDropdownOpen(false);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isDeviceDropdownOpen}
                  aria-controls="operation-record-device-listbox"
                  disabled={filters.drTypeId === "0"}
                >
                  <span className="operation-record-select-trigger-text">{editingDeviceLabel}</span>
                  <ChevronDown className="operation-record-select-caret" size={14} aria-hidden="true" />
                </button>
                {isDeviceDropdownOpen ? (
                  <div
                    id="operation-record-device-listbox"
                    className="operation-record-select-menu"
                    role="listbox"
                    aria-label={zhCN.operationRecordPage.filterDevice}
                  >
                    {deviceOptions.map((item) => {
                      const value = String(item.id || "0");
                      const label = item.label || zhCN.operationRecordPage.filterAll;
                      const isActive = value === filters.drId;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={`operation-record-select-option${isActive ? " is-active" : ""}`}
                          onClick={() => {
                            updateFilter("drId", value);
                            setIsDeviceDropdownOpen(false);
                          }}
                          title={label}
                        >
                          <span className="operation-record-select-option-label">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </label>
            <div className="operation-record-filter-actions operation-record-filter-actions-inline">
              <button type="button" className="operation-record-button is-primary" onClick={handleSearch}>
                <Search size={14} aria-hidden="true" />
                {zhCN.operationRecordPage.search}
              </button>
              <button type="button" className="operation-record-button" onClick={handleReset}>
                <RotateCcw size={14} aria-hidden="true" />
                {zhCN.operationRecordPage.reset}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={zhCN.operationRecordPage.sectionList}
          action={
            <div className="operation-record-list-toolbar">
              <span>{`${zhCN.operationRecordPage.rangeLatestFetch} ${latestFetchText}`}</span>
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
          <div className="operation-record-table-tabs" aria-label="当前页记录分类">
            <span className="is-active">全部 {items.length}</span>
            <span>待复核 {pageReviewCount}</span>
            <span>AI建议 {pageAdviceCount}</span>
            <span>闭环 {pageClosedLoopCount}</span>
            <span>完整留痕 {pageCompleteCount}</span>
            <span>原始 {rawItems.length}</span>
          </div>
          {items.length > 0 ? (
            <div className="operation-record-table">
              <div className="operation-record-table-head">
                <span>{zhCN.operationRecordPage.tableTime}</span>
                <span>记录内容</span>
                <span>{zhCN.operationRecordPage.tableResult}</span>
                <span>{zhCN.operationRecordPage.tableOperator}</span>
              </div>
              {items.map(renderRecordRow)}
            </div>
          ) : (
            <div className="operation-record-empty">
              {emptyText}
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

        <SectionCard title="最近事件链" action={<StatusPill label="证据链" tone={auditStatusTone} />}>
          {latestEvents.length > 0 ? (
            <div className="operation-record-event-list">
              {latestEvents.map((item, index) => (
                <article key={item.id || `operation-event-${index + 1}`} className="operation-record-event">
                  <time>{formatShortTime(item.timestamp || item.date)}</time>
                  <div>
                    <strong>{summarizeStageResults(item)}</strong>
                    <span>{item.details || "暂无记录内容"}</span>
                  </div>
                  <StatusPill
                    label={isReviewViewItem(item) ? "复核" : item.hasDispatch && item.hasExecute ? "闭环" : "记录"}
                    tone={isReviewViewItem(item) ? "warn" : "good"}
                  />
                </article>
              ))}
            </div>
          ) : (
            <div className="operation-record-empty is-compact">{emptyText}</div>
          )}
        </SectionCard>
      </section>

      <section className="operation-record-boundary-strip" aria-label="操作记录边界">
        <article>
          <span>当前边界</span>
          <strong>查询与审计只读，不触发 PLC 写入或自动控制</strong>
        </article>
        <article>
          <span>异常处理</span>
          <strong>{pageReviewCount > 0 ? `${pageReviewCount} 条待复核，优先看回退原因与人员确认` : "当前页暂无待复核记录"}</strong>
        </article>
        <article>
          <span>验收口径</span>
          <strong>记录源、设备源、时间戳、操作人与结果字段完整</strong>
        </article>
        <article>
          <span>展示重点</span>
          <strong>可追溯、可回退、可分页追查，支撑甲方验收</strong>
        </article>
      </section>
    </div>
  );
}
