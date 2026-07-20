import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import useAiDigest from "../hooks/useAiDigest";
import { runtimeConfig } from "../config/runtimeConfig";
import { buildSourceStatusLines, summarizeSourceStatus } from "../i18n/sourceStatusCN";
import { zhCN } from "../i18n/zhCN";
import {
  type AiDigestDto,
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
import { siteIdsEquivalent } from "../services/siteRouting";
import "./WorkOrdersExtracted.css";
import "./WorkOrderAlarmContext.css";
import "./WorkOrdersMobile.css";

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

type ChecklistCard = {
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warn";
};

type SelectOption = {
  id: string;
  label: string;
};

type AlarmDraftContext = {
  sourceSiteId: string;
  alarmId: string;
  regId: string;
  title: string;
  severity: string;
  occurredAt: string;
  detail: string;
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

function readAlarmDraftContext(searchParams: URLSearchParams, activeSiteId: string): AlarmDraftContext | null {
  if (searchParams.get("source") !== "alarm" || searchParams.get("create") !== "1") {
    return null;
  }
  const sourceSiteId = String(searchParams.get("alarmSiteId") || "").trim();
  if (!sourceSiteId || !siteIdsEquivalent(sourceSiteId, activeSiteId)) {
    return null;
  }
  const title = String(searchParams.get("alarmTitle") || "").trim();
  const regId = String(searchParams.get("regId") || "").trim();
  if (!title && !regId) {
    return null;
  }
  return {
    sourceSiteId,
    alarmId: String(searchParams.get("alarmId") || "").trim(),
    regId,
    title: title || "未命名告警",
    severity: String(searchParams.get("alarmSeverity") || "").trim(),
    occurredAt: String(searchParams.get("alarmOccurredAt") || "").trim(),
    detail: String(searchParams.get("alarmDetail") || "").trim()
  };
}

function resolveAlarmWorkLevel(severity: string): string {
  if (severity === "critical") {
    return "1";
  }
  if (severity === "major") {
    return "2";
  }
  return "3";
}

function buildAlarmDraftDescription(context: AlarmDraftContext): string {
  return [
    "[告警转工单草稿]",
    context.title,
    context.regId ? `点位 ${context.regId}` : "",
    context.alarmId ? `告警ID ${context.alarmId}` : "",
    context.occurredAt ? `发生时间 ${context.occurredAt}` : "",
    context.detail
  ].filter(Boolean).join("；");
}

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

function buildChecklistCards(rows: WorkOrderItemDto[], total: number, query: FilterState): ChecklistCard[] {
  const completedCount = rows.filter((item) => String(item.state || "") === "3").length;
  const activeCount = rows.filter((item) => String(item.state || "") === "1" || String(item.state || "") === "2").length;
  const state = total === 0
    ? zhCN.workOrderPage.checklistStateEmpty
    : completedCount > 0
      ? zhCN.workOrderPage.checklistStateReady
      : zhCN.workOrderPage.checklistStatePending;
  const next = completedCount > 0
    ? zhCN.workOrderPage.checklistNextReady
    : activeCount > 0
      ? zhCN.workOrderPage.checklistNextPending
      : zhCN.workOrderPage.checklistNextEmpty;

  return [
    {
      title: zhCN.workOrderPage.checklistStateTitle,
      value: state,
      detail: `${zhCN.workOrderPage.summaryTotal} ${total}${zhCN.common.unitItem}`,
      tone: completedCount > 0 ? "good" : total > 0 ? "warn" : "neutral"
    },
    {
      title: zhCN.workOrderPage.checklistFieldsTitle,
      value: zhCN.workOrderPage.checklistFields,
      detail: `${zhCN.workOrderPage.filterStartDate} ${query.startDate || "--"} ~ ${query.endDate || "--"}`,
      tone: "neutral"
    },
    {
      title: zhCN.workOrderPage.checklistNextTitle,
      value: next,
      detail: completedCount > 0 ? zhCN.workOrderPage.checklistNextDetailReady : zhCN.workOrderPage.checklistNextDetailPending,
      tone: completedCount > 0 ? "good" : total > 0 ? "warn" : "neutral"
    }
  ];
}

function getAiDigestSummaryText(digest: AiDigestDto | null): string | null {
  return digest?.summary?.label || digest?.summary?.headline || digest?.summary?.summary || null;
}

function getAiDigestNextActionText(digest: AiDigestDto | null): string | null {
  return digest?.nextAction?.summary || digest?.nextAction?.label || null;
}

function getAiDigestFreshnessLabel(digest: AiDigestDto | null): string | null {
  const freshness = digest?.freshness;
  if (!freshness) {
    return null;
  }
  if (freshness.stale || freshness.label === "stale") {
    return "AI摘要已过期";
  }
  if (freshness.label === "fresh" || freshness.latestTimestamp) {
    return "AI摘要已更新";
  }
  return "AI摘要待确认";
}

function getAiDigestBlockerText(digest: AiDigestDto | null): string | null {
  return digest?.operationsGate?.summary || digest?.operationsGate?.blockers?.[0]?.message || null;
}

function buildDigestChecklistCards(
  digest: AiDigestDto | null,
  fallback: ChecklistCard[]
): ChecklistCard[] {
  if (!digest) {
    return fallback;
  }

  const summaryText = getAiDigestSummaryText(digest) || fallback[0]?.value || zhCN.workOrderPage.checklistStatePending;
  const nextActionText = getAiDigestNextActionText(digest) || fallback[2]?.value || zhCN.workOrderPage.checklistNextPending;
  const freshnessLabel = getAiDigestFreshnessLabel(digest) || zhCN.workOrderPage.checklistNextDetailPending;
  const blockerText = getAiDigestBlockerText(digest) || fallback[1]?.value || zhCN.workOrderPage.checklistFields;

  return [
    {
      ...fallback[0],
      value: summaryText,
      detail: digest.operationsGate?.summary || freshnessLabel,
      tone: digest.operationsGate?.level === "blocked" ? "warn" : digest.operationsGate?.level === "caution" ? "warn" : "good"
    },
    {
      ...fallback[1],
      value: blockerText,
      detail: digest.operationsGate?.reasonCodes?.length
        ? digest.operationsGate.reasonCodes.join(" · ")
        : digest.operationsGate?.risks?.[0]?.message || freshnessLabel,
      tone: digest.operationsGate?.level === "blocked" ? "warn" : "neutral"
    },
    {
      ...fallback[2],
      value: nextActionText,
      detail: digest.nextAction?.summary || freshnessLabel,
      tone: "good"
    }
  ];
}

function buildFilterSummary(query: FilterState): string {
  const parts = [
    query.startDate ? `起始 ${query.startDate}` : "",
    query.endDate ? `截止 ${query.endDate}` : "",
    query.id ? `单号 ${query.id}` : "",
    query.state ? `状态 ${mapOptionLabel(WORK_STATE_OPTIONS, query.state)}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "当前筛选：全部工单";
}

export default function WorkOrdersPage() {
  const [searchParams] = useSearchParams();
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
  const { aiDigest } = useAiDigest(runtimeConfig.siteId);
  const activeSiteId = runtimeConfig.siteId;
  const alarmDraftRequested = searchParams.get("source") === "alarm" && searchParams.get("create") === "1";
  const alarmDraftSourceSiteId = String(searchParams.get("alarmSiteId") || "").trim();
  const alarmDraftContext = useMemo(
    () => readAlarmDraftContext(searchParams, activeSiteId),
    [activeSiteId, searchParams]
  );
  const alarmDraftRejected = alarmDraftRequested && !alarmDraftContext;

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
  }, [activeSiteId, page, pageSize, query]);

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
  }, [activeSiteId]);

  const deviceRows = devices?.items || [];
  const typeOptions = useMemo(() => buildTypeOptions(deviceRows), [deviceRows]);
  const dialogDeviceOptions = useMemo(
    () => buildDeviceOptions(deviceRows, dialog?.deviceTypeId || ""),
    [deviceRows, dialog?.deviceTypeId]
  );
  const sourceSummary = summarizeSourceStatus([orders?.sourceStatus, assignees?.sourceStatus, devices?.sourceStatus]);
  const sourceStatusLinesCompact = buildSourceStatusLines(
    [orders?.sourceStatus, assignees?.sourceStatus, devices?.sourceStatus],
    { labelMode: "short" }
  );
  const aiDigestSummaryText = getAiDigestSummaryText(aiDigest);
  const aiDigestNextActionText = getAiDigestNextActionText(aiDigest);
  const aiDigestFreshnessLabel = getAiDigestFreshnessLabel(aiDigest);
  const rows = orders?.items || [];
  const total = typeof orders?.total === "number" ? orders.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const checklistCards = buildDigestChecklistCards(aiDigest, buildChecklistCards(rows, total, query));
  const sourceSummaryText =
    actionState?.message ||
    loadError ||
    assigneeError ||
    deviceError ||
    aiDigestSummaryText ||
    (loading ? zhCN.workOrderPage.loading : sourceSummary.text);
  const statusDigestLines = Array.from(
    new Set(
      [
        aiDigestFreshnessLabel,
        ...sourceStatusLinesCompact
      ].filter(Boolean)
    )
  ).slice(0, 4);
  const latestFetchText = formatDateTime(orders?.generatedAt || orders?.freshness?.latestTimestamp);
  const activeStateLabel = query.state ? mapOptionLabel(WORK_STATE_OPTIONS, query.state) : zhCN.workOrderPage.filterStateAll;
  const filterSummary = buildFilterSummary(query);
  const summaryStateText = aiDigestSummaryText || activeStateLabel;
  const filterPanelToneClass =
    actionState?.kind === "error" || loadError || assigneeError || deviceError || sourceSummary.warn
      ? " is-warn"
      : actionState?.kind === "success" || total > 0
        ? " is-good"
        : "";
  const commandTags = [
    { label: zhCN.workOrderPage.filterStartDate, value: query.startDate || "--" },
    { label: zhCN.workOrderPage.filterEndDate, value: query.endDate || "--" },
    { label: zhCN.workOrderPage.filterState, value: activeStateLabel },
    { label: zhCN.workOrderPage.filterOrderId, value: query.id || "--" }
  ];
  const commandStats = [
    {
      title: zhCN.workOrderPage.summaryTotal,
      value: `${total}${zhCN.common.unitItem}`,
      detail: zhCN.workOrderPage.summaryTotalHint
    },
    {
      title: zhCN.workOrderPage.summaryAssignees,
      value: `${assignees?.items?.length || 0}${zhCN.common.unitPerson}`,
      detail: zhCN.workOrderPage.summaryAssigneesHint
    },
    {
      title: zhCN.workOrderPage.summaryDevices,
      value: `${deviceRows.length}${zhCN.common.unitItem}`,
      detail: zhCN.workOrderPage.summaryDevicesHint
    },
    {
      title: zhCN.workOrderPage.summaryState,
      value: summaryStateText,
      detail: aiDigestNextActionText || aiDigestFreshnessLabel || latestFetchText
    }
  ];
  const filterMeta = [
    `${zhCN.workOrderPage.summaryTotal} ${total}${zhCN.common.unitItem}`,
    aiDigestFreshnessLabel
      ? `${zhCN.workOrderPage.latestFetch} ${latestFetchText} · ${aiDigestFreshnessLabel}`
      : `${zhCN.workOrderPage.latestFetch} ${latestFetchText}`,
    `${zhCN.workOrderPage.pageInfo} ${page}/${pageCount}`,
    filterSummary
  ];
  const listStageMeta = [
    aiDigestFreshnessLabel
      ? `${zhCN.workOrderPage.latestFetch} ${latestFetchText} · ${aiDigestFreshnessLabel}`
      : `${zhCN.workOrderPage.latestFetch} ${latestFetchText}`,
    `${zhCN.workOrderPage.pageInfo} ${page}/${pageCount}`,
    `${zhCN.workOrderPage.pageSizeLabel} ${pageSize}`,
    filterSummary
  ];

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

  function openCreateDialog(context: AlarmDraftContext | null = null) {
    const initialTypeId = typeOptions[0]?.id || "";
    const initialDeviceOptions = buildDeviceOptions(deviceRows, initialTypeId);
    const initialEditor = buildEditorState("create", currentUsername, typeOptions, initialDeviceOptions);
    setDialog(context ? {
      ...initialEditor,
      workTime: toDateTimeInput(context.occurredAt),
      workLevel: resolveAlarmWorkLevel(context.severity),
      state: "1",
      workExplain: buildAlarmDraftDescription(context)
    } : initialEditor);
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
      <section className="work-order-header subpage-command-board">
        <div className="subpage-command-copy work-order-command-copy">
          <p className="work-order-eyebrow">{runtimeConfig.appModeLabel}</p>
          <h1>{zhCN.workOrderPage.heading}</h1>
          <p>先筛选再导出，编辑和删除保留在表格内处理，减少在列表和弹窗之间来回跳转。</p>
          <div className="work-order-command-tags" aria-label={zhCN.workOrderPage.sectionFilters}>
            {commandTags.map((item) => (
              <span key={`${item.label}-${item.value}`}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
          <div className="work-order-command-summary-grid">
            {commandStats.map((item) => (
              <article key={`${item.title}-${item.value}`} className="work-order-command-stat">
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="subpage-command-side work-order-command-side">
          <span className="work-order-command-side-label">{zhCN.workOrderPage.summaryState}</span>
          <strong>{summaryStateText}</strong>
          <p>{sourceSummaryText}</p>
          {statusDigestLines.length > 0 ? (
            <div className="work-order-status-list" aria-label={zhCN.workOrderPage.summaryState}>
              {statusDigestLines.map((line, index) => (
                <span key={`work-order-status-${index + 1}-${line}`} className="work-order-status-chip">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {alarmDraftContext ? (
        <section className="work-order-alarm-context" aria-labelledby="work-order-alarm-context-title">
          <div className="work-order-alarm-context-copy">
            <span>告警处置上下文</span>
            <strong id="work-order-alarm-context-title">{alarmDraftContext.title}</strong>
            <p>
              告警信息仅用于预填工单草稿；设备、执行人、处置时间和关闭证据必须人工核对。
              {runtimeConfig.readOnlyMode ? " 当前为只读模式，不能提交。" : " 提交前仍需人工确认。"}
            </p>
            <div className="work-order-alarm-context-meta">
              <span>{`点位 ${alarmDraftContext.regId || "待确认"}`}</span>
              <span>{`等级 ${alarmDraftContext.severity || "待确认"}`}</span>
              <span>{`时间 ${alarmDraftContext.occurredAt || "待确认"}`}</span>
            </div>
          </div>
          <button
            type="button"
            className="work-order-button is-primary"
            onClick={() => openCreateDialog(alarmDraftContext)}
            disabled={submitting}
          >
            检查预填草稿
          </button>
        </section>
      ) : null}

      {alarmDraftRejected ? (
        <section className="work-order-alarm-context is-rejected" role="alert">
          <div className="work-order-alarm-context-copy">
            <span>告警草稿已停止预填</span>
            <strong>来源站点与当前项目不一致</strong>
            <p>
              {alarmDraftSourceSiteId
                ? `来源站点 ${alarmDraftSourceSiteId}，当前站点 ${activeSiteId}；为防止跨项目误派单，旧告警内容已隐藏。`
                : "当前链接缺少告警来源站点证明；为防止跨项目误派单，告警内容已隐藏。"}
            </p>
          </div>
          <Link className="work-order-button" to={`/alarms?siteId=${encodeURIComponent(activeSiteId)}`}>
            返回当前站点告警
          </Link>
        </section>
      ) : null}

      <SectionCard
        title={zhCN.workOrderPage.sectionFilters}
        action={<span className="dashboard-section-hint">先筛选再导出，新增和编辑留在列表内处理</span>}
      >
        <div className="work-order-filter-layout">
          <div className="work-order-filter-main">
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
            <div className="work-order-filter-footer">
              <div className="work-order-filter-meta">
                {filterMeta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="work-order-actions">
                <button type="button" className="work-order-button is-primary" onClick={handleSearch}>
                  {zhCN.workOrderPage.search}
                </button>
                <button type="button" className="work-order-button is-primary" onClick={() => openCreateDialog()} disabled={submitting || deviceRows.length === 0 || assigneeError !== null}>
                  {zhCN.workOrderPage.create}
                </button>
                <button type="button" className="work-order-button" onClick={handleExport} disabled={loading || submitting || exporting}>
                  {exporting ? zhCN.workOrderPage.exporting : zhCN.workOrderPage.export}
                </button>
                <button type="button" className="work-order-button" onClick={handleReset} disabled={loading || submitting || exporting}>
                  {zhCN.workOrderPage.reset}
                </button>
              </div>
            </div>
          </div>
          <aside className={`work-order-filter-panel${filterPanelToneClass}`}>
            <span>{zhCN.workOrderPage.sectionChecklist}</span>
            <strong>{checklistCards[0]?.value || summaryStateText || zhCN.workOrderPage.checklistStateEmpty}</strong>
            <p>{sourceSummaryText}</p>
            {statusDigestLines.length > 0 ? (
              <div className="work-order-status-list" aria-label={zhCN.workOrderPage.sectionChecklist}>
                {statusDigestLines.map((line, index) => (
                  <span key={`work-order-filter-status-${index + 1}-${line}`} className="work-order-status-chip">
                    {line}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="work-order-filter-panel-grid">
              {checklistCards.map((item) => (
                <article key={`${item.title}-${item.value}`} className={`strategy-audit-card tone-${item.tone}`}>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </SectionCard>

      <SectionCard title={zhCN.workOrderPage.sectionTable}>
        <div className="work-order-table-stage">
          <div className="work-order-table-stage-copy">
            <strong>{zhCN.workOrderPage.sectionTable}</strong>
            <p>{filterSummary}</p>
          </div>
          <div className="work-order-table-stage-meta">
            {listStageMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="work-order-table-shell" role="region" aria-label="运维工单列表，可横向滚动查看更多字段" tabIndex={0}>
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
                      <td>
                        <span title={item.workExplain || "--"}>{item.workExplain || "--"}</span>
                      </td>
                      <td>
                        <div className="work-order-row-actions">
                          <button
                            type="button"
                            title={zhCN.workOrderPage.actionEdit}
                            onClick={() => openEditDialog(item)}
                            disabled={isDeleting || submitting || runtimeConfig.readOnlyMode}
                          >
                            {zhCN.workOrderPage.actionEdit}
                          </button>
                          <button
                            type="button"
                            title={zhCN.workOrderPage.actionDelete}
                            onClick={() => handleDelete(item)}
                            disabled={isDeleting || submitting || runtimeConfig.readOnlyMode}
                          >
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
            <strong>{loading ? zhCN.workOrderPage.loading : zhCN.workOrderPage.empty}</strong>
            <p>{loading ? "正在加载当前筛选结果。" : "可以先放宽筛选条件，或者直接新建一条工单。"} </p>
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
              <button type="button" className="work-order-button is-primary" onClick={handleSubmit} disabled={submitting || runtimeConfig.readOnlyMode}>
                {runtimeConfig.readOnlyMode
                  ? "只读模式不可提交"
                  : submitting
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
