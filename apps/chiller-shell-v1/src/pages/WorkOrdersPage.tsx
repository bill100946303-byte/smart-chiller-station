import { startTransition, useEffect, useMemo, useState } from "react";
import SectionCard from "../components/common/SectionCard";
import SourceStatusBanner from "../components/common/SourceStatusBanner";
import StatCard from "../components/common/StatCard";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type DeviceListDto,
  type DeviceListItemDto,
  type WorkOrderAssigneeDto,
  type WorkOrderAssigneeListDto,
  type WorkOrderItemDto,
  type WorkOrderListDto,
  createWorkOrder,
  deleteWorkOrder,
  exportWorkOrders,
  fetchDeviceList,
  fetchWorkOrderAssignees,
  fetchWorkOrders,
  updateWorkOrder
} from "../services/bffClient";
import { getAuthSession } from "../services/auth";

type FilterState = {
  startDate: string;
  endDate: string;
  id: string;
  state: string;
};

type EditorState = {
  mode: "create" | "edit";
  id: string;
  deviceTypeId: string;
  deviceId: string;
  workTime: string;
  workUser: string;
  workLevel: string;
  executeUser: string;
  executeTime: string;
  finishTime: string;
  state: string;
  workExplain: string;
};

type SummaryCard = {
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: "neutral" | "good" | "warn";
};

type SelectOption = {
  id: string;
  label: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const WORK_LEVEL_OPTIONS: SelectOption[] = [
  { id: "1", label: "紧急" },
  { id: "2", label: "中等" },
  { id: "3", label: "一般" }
];
const WORK_STATE_OPTIONS: SelectOption[] = [
  { id: "1", label: "待处理" },
  { id: "2", label: "处理中" },
  { id: "3", label: "已完成" }
];

function toDateTimeInput(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  const isoReady = normalized.replace(" ", "T");
  const date = new Date(isoReady);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
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
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return zhCN.common.timeUnknown;
  }
  return date.toLocaleString();
}

function mapOptionLabel(options: SelectOption[], value: number | string | null | undefined): string {
  return options.find((item) => item.id === String(value ?? ""))?.label || "--";
}

function buildTypeOptions(devices: DeviceListItemDto[]): SelectOption[] {
  const seen = new Set<string>();
  return devices.flatMap((item) => {
    const id = String(item.deviceTypeId || "").trim();
    const label = String(item.deviceTypeName || item.usageType || "").trim();
    if (!id || !label || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [{ id, label }];
  });
}

function buildDeviceOptions(devices: DeviceListItemDto[], deviceTypeId: string): SelectOption[] {
  return devices
    .filter((item) => String(item.deviceTypeId || "") === deviceTypeId)
    .map((item) => ({
      id: String(item.deviceId || ""),
      label: item.deviceName || item.deviceCode || String(item.deviceId || "")
    }));
}

function buildEditorState(
  mode: "create" | "edit",
  username: string,
  typeOptions: SelectOption[],
  deviceOptions: SelectOption[],
  item?: WorkOrderItemDto
): EditorState {
  if (mode === "edit" && item) {
    return {
      mode,
      id: String(item.id || ""),
      deviceTypeId: String(item.deviceTypeId || ""),
      deviceId: String(item.deviceId || ""),
      workTime: toDateTimeInput(item.workTime),
      workUser: item.workUser || username,
      workLevel: String(item.workLevel || ""),
      executeUser: item.executeUser === "--" ? "" : String(item.executeUser || ""),
      executeTime: toDateTimeInput(item.executeTime),
      finishTime: toDateTimeInput(item.finishTime),
      state: String(item.state || ""),
      workExplain: item.workExplain === "--" ? "" : String(item.workExplain || "")
    };
  }

  return {
    mode,
    id: "",
    deviceTypeId: typeOptions[0]?.id || "",
    deviceId: deviceOptions[0]?.id || "",
    workTime: "",
    workUser: username,
    workLevel: "",
    executeUser: "",
    executeTime: "",
    finishTime: "",
    state: "",
    workExplain: ""
  };
}

function buildSummaryCards(
  orders: WorkOrderListDto | null,
  assignees: WorkOrderAssigneeListDto | null,
  devices: DeviceListDto | null,
  query: FilterState
): SummaryCard[] {
  const total = typeof orders?.total === "number" ? orders.total : 0;
  const assigneeCount = assignees?.items?.length || 0;
  const deviceCount = devices?.items?.length || 0;
  const stateLabel = query.state ? mapOptionLabel(WORK_STATE_OPTIONS, query.state) : zhCN.workOrderPage.filterStateAll;
  return [
    {
      title: zhCN.workOrderPage.summaryTotal,
      value: String(total),
      unit: zhCN.common.unitItem,
      delta: zhCN.workOrderPage.summaryTotalHint,
      tone: total > 0 ? "good" : "neutral"
    },
    {
      title: zhCN.workOrderPage.summaryAssignees,
      value: String(assigneeCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.workOrderPage.summaryAssigneesHint,
      tone: assigneeCount > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.workOrderPage.summaryDevices,
      value: String(deviceCount),
      unit: zhCN.common.unitItem,
      delta: zhCN.workOrderPage.summaryDevicesHint,
      tone: deviceCount > 0 ? "neutral" : "warn"
    },
    {
      title: zhCN.workOrderPage.summaryState,
      value: stateLabel,
      unit: "",
      delta: `${query.startDate || "--"} ~ ${query.endDate || "--"}`,
      tone: query.state ? "good" : "neutral"
    }
  ];
}

export default function WorkOrdersPage() {
  const session = getAuthSession();
  const currentUsername = session?.username || zhCN.common.unknown;
  const initialFilters: FilterState = {
    startDate: "",
    endDate: "",
    id: "",
    state: ""
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [orders, setOrders] = useState<WorkOrderListDto | null>(null);
  const [assignees, setAssignees] = useState<WorkOrderAssigneeListDto | null>(null);
  const [devices, setDevices] = useState<DeviceListDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [dialog, setDialog] = useState<EditorState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      setLoading(true);
      try {
        const result = await fetchWorkOrders(runtimeConfig.siteId, {
          page,
          pageSize,
          id: query.id,
          state: query.state,
          startDate: query.startDate,
          endDate: query.endDate
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setOrders(result);
          setLoadError(null);
          setLoading(false);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setOrders(null);
          setLoadError(zhCN.workOrderPage.loadFailed);
          setLoading(false);
        });
      }
    }

    loadOrders();
    return () => {
      active = false;
    };
  }, [page, pageSize, query]);

  useEffect(() => {
    let active = true;

    async function loadAssignees() {
      try {
        const result = await fetchWorkOrderAssignees(runtimeConfig.siteId);
        if (!active) {
          return;
        }
        startTransition(() => {
          setAssignees(result);
          setAssigneeError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setAssignees(null);
          setAssigneeError(zhCN.workOrderPage.assigneeLoadFailed);
        });
      }
    }

    async function loadDevices() {
      try {
        const result = await fetchDeviceList(runtimeConfig.siteId, {
          page: 1,
          pageSize: 200
        });
        if (!active) {
          return;
        }
        startTransition(() => {
          setDevices(result);
          setDeviceError(null);
        });
      } catch (_error) {
        if (!active) {
          return;
        }
        startTransition(() => {
          setDevices(null);
          setDeviceError(zhCN.workOrderPage.deviceLoadFailed);
        });
      }
    }

    loadAssignees();
    loadDevices();
    return () => {
      active = false;
    };
  }, []);

  const deviceRows = devices?.items || [];
  const typeOptions = useMemo(() => buildTypeOptions(deviceRows), [deviceRows]);
  const dialogDeviceOptions = useMemo(
    () => buildDeviceOptions(deviceRows, dialog?.deviceTypeId || ""),
    [deviceRows, dialog?.deviceTypeId]
  );
  const summaryCards = buildSummaryCards(orders, assignees, devices, query);
  const sourceSummary = summarizeSourceStatus([orders?.sourceStatus, assignees?.sourceStatus, devices?.sourceStatus]);
  const sourceStatusLines = buildSourceStatusLines([orders?.sourceStatus, assignees?.sourceStatus, devices?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [orders?.sourceStatus, assignees?.sourceStatus, devices?.sourceStatus],
    { labelMode: "short" }
  );
  const rows = orders?.items || [];
  const total = typeof orders?.total === "number" ? orders.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const bannerText =
    actionState?.message ||
    loadError ||
    assigneeError ||
    deviceError ||
    (loading ? zhCN.workOrderPage.loading : sourceSummary.text);
  const bannerWarn = Boolean(loadError || assigneeError || deviceError || actionState?.kind === "error") || sourceSummary.warn;

  useEffect(() => {
    if (!dialog) {
      return;
    }
    if (dialog.deviceTypeId && dialogDeviceOptions.some((item) => item.id === dialog.deviceId)) {
      return;
    }
    setDialog((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        deviceTypeId: current.deviceTypeId || typeOptions[0]?.id || "",
        deviceId: dialogDeviceOptions[0]?.id || ""
      };
    });
  }, [dialog, dialogDeviceOptions, typeOptions]);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateDialog<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setDialog((current) => {
      if (!current) {
        return current;
      }
      const next = {
        ...current,
        [key]: value
      };
      if (key === "deviceTypeId") {
        const nextDeviceOptions = buildDeviceOptions(deviceRows, String(value || ""));
        next.deviceId = nextDeviceOptions[0]?.id || "";
      }
      return next;
    });
  }

  function handleSearch() {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setActionState({
        kind: "error",
        message: zhCN.workOrderPage.invalidRange
      });
      return;
    }
    setPage(1);
    setQuery(filters);
    setActionState(null);
  }

  function handleReset() {
    setFilters(initialFilters);
    setQuery(initialFilters);
    setPage(1);
    setActionState(null);
  }

  function openCreateDialog() {
    const initialTypeId = typeOptions[0]?.id || "";
    const initialDeviceOptions = buildDeviceOptions(deviceRows, initialTypeId);
    setDialog(buildEditorState("create", currentUsername, typeOptions, initialDeviceOptions));
    setActionState(null);
  }

  function openEditDialog(item: WorkOrderItemDto) {
    const options = buildDeviceOptions(deviceRows, String(item.deviceTypeId || ""));
    setDialog(buildEditorState("edit", currentUsername, typeOptions, options, item));
    setActionState(null);
  }

  function buildPayload(editor: EditorState) {
    return {
      drtypeid: editor.deviceTypeId,
      drid: editor.deviceId,
      worktime: toLegacyDateTime(editor.workTime),
      workuser: editor.workUser,
      worklevel: Number(editor.workLevel),
      executeuser: editor.executeUser,
      executetime: toLegacyDateTime(editor.executeTime),
      finishtime: toLegacyDateTime(editor.finishTime),
      state: Number(editor.state),
      workexplain: editor.workExplain.trim()
    };
  }

  function validateEditor(editor: EditorState): string | null {
    if (!editor.deviceTypeId) {
      return zhCN.workOrderPage.requiredDeviceType;
    }
    if (!editor.deviceId) {
      return zhCN.workOrderPage.requiredDevice;
    }
    if (!editor.workTime) {
      return zhCN.workOrderPage.requiredWorkTime;
    }
    if (!editor.workLevel) {
      return zhCN.workOrderPage.requiredWorkLevel;
    }
    if (!editor.executeUser) {
      return zhCN.workOrderPage.requiredExecuteUser;
    }
    if (!editor.executeTime) {
      return zhCN.workOrderPage.requiredExecuteTime;
    }
    if (!editor.finishTime) {
      return zhCN.workOrderPage.requiredFinishTime;
    }
    if (!editor.state) {
      return zhCN.workOrderPage.requiredState;
    }
    return null;
  }

  async function refreshCurrentPage() {
    try {
      const result = await fetchWorkOrders(runtimeConfig.siteId, {
        page,
        pageSize,
        id: query.id,
        state: query.state,
        startDate: query.startDate,
        endDate: query.endDate
      });
      startTransition(() => {
        setOrders(result);
        setLoadError(null);
      });
    } catch (_error) {
      startTransition(() => {
        setLoadError(zhCN.workOrderPage.loadFailed);
      });
    }
  }

  async function handleSubmit() {
    if (!dialog) {
      return;
    }
    if (runtimeConfig.readOnlyMode) {
      setActionState({
        kind: "error",
        message: zhCN.runtimeMode.writeBlocked
      });
      return;
    }
    const validationError = validateEditor(dialog);
    if (validationError) {
      setActionState({
        kind: "error",
        message: validationError
      });
      return;
    }

    setSubmitting(true);
    setActionState(null);
    try {
      if (dialog.mode === "create") {
        await createWorkOrder(runtimeConfig.siteId, buildPayload(dialog));
      } else {
        await updateWorkOrder(runtimeConfig.siteId, dialog.id, buildPayload(dialog));
      }

      startTransition(() => {
        setSubmitting(false);
        setDialog(null);
        setActionState({
          kind: "success",
          message: dialog.mode === "create" ? zhCN.workOrderPage.created : zhCN.workOrderPage.updated
        });
      });
      setPage(1);
      setQuery((current) => ({ ...current }));
    } catch (_error) {
      startTransition(() => {
        setSubmitting(false);
        setActionState({
          kind: "error",
          message: zhCN.workOrderPage.saveFailed
        });
      });
    }
  }

  async function handleDelete(item: WorkOrderItemDto) {
    const orderId = String(item.id || "");
    if (!orderId) {
      return;
    }
    if (runtimeConfig.readOnlyMode) {
      setActionState({
        kind: "error",
        message: zhCN.runtimeMode.writeBlocked
      });
      return;
    }
    const accepted = window.confirm(`${zhCN.workOrderPage.deleteConfirm} ${orderId}?`);
    if (!accepted) {
      return;
    }
    setDeletingId(orderId);
    setActionState(null);
    try {
      await deleteWorkOrder(runtimeConfig.siteId, orderId);
      startTransition(() => {
        setDeletingId(null);
        setActionState({
          kind: "success",
          message: zhCN.workOrderPage.deleted
        });
      });
      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await refreshCurrentPage();
      }
    } catch (_error) {
      startTransition(() => {
        setDeletingId(null);
        setActionState({
          kind: "error",
          message: zhCN.workOrderPage.deleteFailed
        });
      });
    }
  }

  async function handleExport() {
    setExporting(true);
    setActionState(null);
    try {
      const file = await exportWorkOrders(runtimeConfig.siteId);
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || "work-orders.xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExporting(false);
    } catch (_error) {
      startTransition(() => {
        setExporting(false);
        setActionState({
          kind: "error",
          message: zhCN.workOrderPage.exportFailed
        });
      });
    }
  }

  return (
    <div className="work-order-page page-enter">
      <SourceStatusBanner
        summary={bannerText}
        warn={bannerWarn}
        detailLines={sourceStatusLines}
        detailLinesCompact={sourceStatusLinesCompact}
      />

      <section className="work-order-header">
        <h2>{zhCN.workOrderPage.heading}</h2>
        <p>{zhCN.workOrderPage.subtitle}</p>
      </section>

      <SectionCard title={zhCN.workOrderPage.sectionFilters}>
        <div className="work-order-filter-grid">
          <label className="work-order-field">
            <span>{zhCN.workOrderPage.filterStartDate}</span>
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
          </label>
          <label className="work-order-field">
            <span>{zhCN.workOrderPage.filterEndDate}</span>
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
          </label>
          <label className="work-order-field">
            <span>{zhCN.workOrderPage.filterOrderId}</span>
            <input type="text" value={filters.id} onChange={(event) => updateFilter("id", event.target.value)} />
          </label>
          <label className="work-order-field">
            <span>{zhCN.workOrderPage.filterState}</span>
            <select value={filters.state} onChange={(event) => updateFilter("state", event.target.value)}>
              <option value="">{zhCN.workOrderPage.filterStateAll}</option>
              {WORK_STATE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="work-order-actions">
          <button type="button" className="work-order-button is-primary" onClick={handleSearch}>
            {zhCN.workOrderPage.search}
          </button>
          <button type="button" className="work-order-button" onClick={handleReset} disabled={loading || submitting || exporting}>
            {zhCN.workOrderPage.reset}
          </button>
          <button type="button" className="work-order-button" onClick={handleExport} disabled={loading || submitting || exporting}>
            {exporting ? zhCN.workOrderPage.exporting : zhCN.workOrderPage.export}
          </button>
          <button
            type="button"
            className="work-order-button is-primary"
            onClick={openCreateDialog}
            disabled={submitting || deviceRows.length === 0 || assigneeError !== null}
          >
            {zhCN.workOrderPage.create}
          </button>
        </div>
      </SectionCard>

      <div className="work-order-summary-grid">
        {summaryCards.map((item) => (
          <StatCard key={item.title} title={item.title} value={item.value} unit={item.unit} delta={item.delta} tone={item.tone} />
        ))}
      </div>

      <SectionCard title={zhCN.workOrderPage.sectionTable}>
        <div className="work-order-meta">
          <span>{`${zhCN.workOrderPage.latestFetch} ${formatDateTime(orders?.generatedAt || orders?.freshness?.latestTimestamp)}`}</span>
          <span>{`${zhCN.workOrderPage.pageInfo} ${page}/${pageCount}`}</span>
          <span>{`${zhCN.workOrderPage.pageSizeLabel} ${pageSize}`}</span>
        </div>

        {rows.length > 0 ? (
          <div className="work-order-table-shell">
            <table className="work-order-table">
              <thead>
                <tr>
                  <th>{zhCN.workOrderPage.tableId}</th>
                  <th>{zhCN.workOrderPage.tableDeviceType}</th>
                  <th>{zhCN.workOrderPage.tableDevice}</th>
                  <th>{zhCN.workOrderPage.tableWorkTime}</th>
                  <th>{zhCN.workOrderPage.tableWorkUser}</th>
                  <th>{zhCN.workOrderPage.tableLevel}</th>
                  <th>{zhCN.workOrderPage.tableExecuteUser}</th>
                  <th>{zhCN.workOrderPage.tableExecuteTime}</th>
                  <th>{zhCN.workOrderPage.tableFinishTime}</th>
                  <th>{zhCN.workOrderPage.tableState}</th>
                  <th>{zhCN.workOrderPage.tableDescription}</th>
                  <th>{zhCN.workOrderPage.tableActions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const orderId = String(item.id || "");
                  const isDeleting = deletingId === orderId;
                  return (
                    <tr key={orderId || `${item.deviceId}-${item.workTime}`}>
                      <td>{item.id || "--"}</td>
                      <td>{item.deviceTypeName || "--"}</td>
                      <td>{item.deviceName || "--"}</td>
                      <td>{formatDateTime(item.workTime)}</td>
                      <td>{item.workUser || "--"}</td>
                      <td>{mapOptionLabel(WORK_LEVEL_OPTIONS, item.workLevel)}</td>
                      <td>{item.executeUser || "--"}</td>
                      <td>{formatDateTime(item.executeTime)}</td>
                      <td>{formatDateTime(item.finishTime)}</td>
                      <td>{mapOptionLabel(WORK_STATE_OPTIONS, item.state)}</td>
                      <td>{item.workExplain || "--"}</td>
                      <td>
                        <div className="work-order-row-actions">
                          <button type="button" onClick={() => openEditDialog(item)} disabled={isDeleting || submitting}>
                            {zhCN.workOrderPage.actionEdit}
                          </button>
                          <button type="button" onClick={() => handleDelete(item)} disabled={isDeleting || submitting}>
                            {isDeleting ? zhCN.workOrderPage.deleting : zhCN.workOrderPage.actionDelete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="work-order-empty">
            {loading ? zhCN.workOrderPage.loading : zhCN.workOrderPage.empty}
          </div>
        )}

        <div className="work-order-pagination">
          <button
            type="button"
            className="work-order-button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
          >
            {zhCN.workOrderPage.prevPage}
          </button>
          <span>{`${zhCN.workOrderPage.pageInfo} ${page}/${pageCount}`}</span>
          <label className="work-order-page-size">
            <span>{zhCN.workOrderPage.pageSizeLabel}</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="work-order-button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount || loading}
          >
            {zhCN.workOrderPage.nextPage}
          </button>
        </div>
      </SectionCard>

      {dialog ? (
        <div className="work-order-modal-backdrop" role="presentation" onClick={() => !submitting && setDialog(null)}>
          <div className="work-order-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="work-order-modal-header">
              <h3>
                {dialog.mode === "create" ? zhCN.workOrderPage.sectionEditorCreate : zhCN.workOrderPage.sectionEditorEdit}
              </h3>
              <button type="button" className="work-order-modal-close" onClick={() => setDialog(null)} disabled={submitting}>
                ×
              </button>
            </div>
            <div className="work-order-form-grid">
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formDeviceType}</span>
                <select value={dialog.deviceTypeId} onChange={(event) => updateDialog("deviceTypeId", event.target.value)} disabled={submitting}>
                  <option value="">{zhCN.workOrderPage.formSelectDeviceType}</option>
                  {typeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formDevice}</span>
                <select value={dialog.deviceId} onChange={(event) => updateDialog("deviceId", event.target.value)} disabled={submitting}>
                  <option value="">{zhCN.workOrderPage.formSelectDevice}</option>
                  {dialogDeviceOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formWorkTime}</span>
                <input type="datetime-local" value={dialog.workTime} onChange={(event) => updateDialog("workTime", event.target.value)} disabled={submitting} />
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formWorkUser}</span>
                <input type="text" value={dialog.workUser} readOnly disabled />
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formLevel}</span>
                <select value={dialog.workLevel} onChange={(event) => updateDialog("workLevel", event.target.value)} disabled={submitting}>
                  <option value="">{zhCN.workOrderPage.formSelectLevel}</option>
                  {WORK_LEVEL_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formExecuteUser}</span>
                <select value={dialog.executeUser} onChange={(event) => updateDialog("executeUser", event.target.value)} disabled={submitting}>
                  <option value="">{zhCN.workOrderPage.formSelectExecuteUser}</option>
                  {(assignees?.items || []).map((item: WorkOrderAssigneeDto) => (
                    <option key={item.id || item.username} value={item.username || ""}>
                      {item.username || item.id || ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formExecuteTime}</span>
                <input type="datetime-local" value={dialog.executeTime} onChange={(event) => updateDialog("executeTime", event.target.value)} disabled={submitting} />
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formFinishTime}</span>
                <input type="datetime-local" value={dialog.finishTime} onChange={(event) => updateDialog("finishTime", event.target.value)} disabled={submitting} />
              </label>
              <label className="work-order-field">
                <span>{zhCN.workOrderPage.formState}</span>
                <select value={dialog.state} onChange={(event) => updateDialog("state", event.target.value)} disabled={submitting}>
                  <option value="">{zhCN.workOrderPage.formSelectState}</option>
                  {WORK_STATE_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-order-field is-full">
                <span>{zhCN.workOrderPage.formDescription}</span>
                <textarea rows={4} value={dialog.workExplain} onChange={(event) => updateDialog("workExplain", event.target.value)} disabled={submitting} />
              </label>
            </div>
            <div className="work-order-modal-actions">
              <button type="button" className="work-order-button" onClick={() => setDialog(null)} disabled={submitting}>
                {zhCN.workOrderPage.cancel}
              </button>
              <button type="button" className="work-order-button is-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? dialog.mode === "create"
                    ? zhCN.workOrderPage.creating
                    : zhCN.workOrderPage.saving
                  : dialog.mode === "create"
                    ? zhCN.workOrderPage.submitCreate
                    : zhCN.workOrderPage.submitUpdate}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
