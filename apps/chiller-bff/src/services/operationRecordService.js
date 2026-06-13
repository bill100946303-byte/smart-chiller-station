import {
  loadOperationRecords,
  loadOperationRecordDeviceTypes,
  loadOperationRecordDevices
} from "../adapters/legacyOperationRecordAdapter.js";
import { listOptimizeExecutions } from "./optimizeExecutionService.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function resolveOperationRecordLegacySiteId(config, siteId) {
  return (
    normalizeOptionalText(config?.siteSourceConfig?.databaseKey)
    || normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey)
    || normalizeOptionalText(siteId)
  );
}

function resolveSourceInputs(result, fallbackKey) {
  if (Array.isArray(result?.sourceStatuses) && result.sourceStatuses.length > 0) {
    return result.sourceStatuses.map((item) => ({
      key: fallbackKey,
      ...item
    }));
  }
  return [{ key: fallbackKey, ...(result?.sourceStatus || {}) }];
}

function shouldUseB25ExecutionFallback(config, siteId) {
  const candidates = [
    normalizeOptionalText(siteId),
    normalizeOptionalText(config?.siteSourceConfig?.databaseKey),
    normalizeOptionalText(config?.siteSourceConfig?.deviceDataProjectKey)
  ].filter(Boolean);

  return candidates.includes("btwentyfive") || candidates.includes("140btwentyfive");
}

function isUnscopedOperationQuery(filters = {}) {
  const drTypeId = normalizeOptionalText(String(filters?.drTypeId ?? ""));
  const drId = normalizeOptionalText(String(filters?.drId ?? ""));
  return (!drTypeId || drTypeId === "0") && (!drId || drId === "0");
}

function parseLocalRangeBoundary(dateText, kind) {
  const normalized = normalizeOptionalText(dateText);
  if (!normalized) {
    return Number.NaN;
  }
  const clock = kind === "end" ? "23:59:59" : "00:00:00";
  return Date.parse(`${normalized}T${clock}+08:00`);
}

function pickExecutionTimestamp(item) {
  return (
    normalizeOptionalText(item?.rolledBackAt)
    || normalizeOptionalText(item?.approvedAt)
    || normalizeOptionalText(item?.updatedAt)
    || normalizeOptionalText(item?.createdAt)
    || null
  );
}

function formatExecutionStatus(status) {
  switch (normalizeOptionalText(status)) {
    case "approved":
      return "已批准";
    case "rolled_back":
      return "已回退";
    case "pending_approval":
      return "待审批";
    default:
      return "状态待确认";
  }
}

function buildExecutionDetail(item) {
  const title =
    normalizeOptionalText(item?.execution?.title)
    || normalizeOptionalText(item?.execution?.schemeKey)
    || normalizeOptionalText(item?.execution?.type)
    || "治理态执行记录";
  const reason =
    normalizeOptionalText(item?.rollback?.reason)
    || normalizeOptionalText(item?.execution?.reason)
    || normalizeOptionalText(item?.approval?.note)
    || normalizeOptionalText(item?.execution?.actions?.[0]);

  return reason ? `${title}：${reason}` : title;
}

function pickExecutionOperator(item) {
  return (
    normalizeOptionalText(item?.rolledBackBy)
    || normalizeOptionalText(item?.approvedBy)
    || normalizeOptionalText(item?.approval?.approverUserId)
    || normalizeOptionalText(item?.timeline?.at?.(-1)?.actorUserId)
    || normalizeOptionalText(item?.timeline?.[item?.timeline?.length - 1]?.actorUserId)
    || "--"
  );
}

function mapExecutionToOperationRecord(item, index) {
  const timestamp = pickExecutionTimestamp(item);
  return {
    id: normalizeOptionalText(item?.executionId) || `op-execution-${index + 1}`,
    date: timestamp ? new Date(timestamp).toLocaleString("zh-CN", { hour12: false }) : "--",
    timestamp,
    details: buildExecutionDetail(item),
    operationResult: formatExecutionStatus(item?.status),
    operationPerson: pickExecutionOperator(item)
  };
}

function buildExecutionFallbackResult(siteId, options, records, config) {
  const startMs = parseLocalRangeBoundary(records?.filters?.startDate, "start");
  const endMs = parseLocalRangeBoundary(records?.filters?.endDate, "end");
  const rawList = listOptimizeExecutions(siteId, {
    limit: 100,
    adminStore: config?.adminStore
  });
  const allItems = Array.isArray(rawList?.items) ? rawList.items : [];
  const selected = allItems
    .map((item) => ({
      item,
      timestamp: pickExecutionTimestamp(item)
    }))
    .filter(({ timestamp }) => {
      const ts = Date.parse(String(timestamp || ""));
      if (!Number.isFinite(ts)) {
        return false;
      }
      return ts >= startMs && ts <= endMs;
    })
    .sort((left, right) => Date.parse(String(right.timestamp || "")) - Date.parse(String(left.timestamp || "")));

  const page = records?.page || 1;
  const pageSize = records?.pageSize || 10;
  const offset = (page - 1) * pageSize;
  const paged = selected.slice(offset, offset + pageSize).map(({ item }, index) => mapExecutionToOperationRecord(item, offset + index));
  const latestTimestamp = selected[0]?.timestamp || null;
  const sourceStatus = {
    endpoint: `/bff/v1/sites/${siteId}/optimize/executions`,
    ok: true,
    status: 200,
    message:
      selected.length > 0
        ? `治理态执行留痕; rows=${selected.length}`
        : "治理态执行留痕当前范围内无记录",
    rows: selected.length,
    error: null,
    fallback: true,
    reasonCode: "optimize-execution-history-fallback",
    interfaceKind: "optimize-execution-history",
    originLabel: "治理态执行记录"
  };

  return {
    ...records,
    items: paged,
    total: selected.length,
    latestTimestamp,
    sourceStatus,
    sourceStatuses: [...(records?.sourceStatuses || []), sourceStatus]
  };
}

export async function getOperationRecords(config, siteId, options = {}) {
  const records = await loadOperationRecords(
    config.legacyBaseUrl,
    resolveOperationRecordLegacySiteId(config, siteId),
    {
    ...options,
    runtimeConfig: config
    }
  );

  const resolvedRecords =
    !records?.sourceStatus?.ok
    && shouldUseB25ExecutionFallback(config, siteId)
    && isUnscopedOperationQuery(records?.filters)
      ? buildExecutionFallbackResult(siteId, options, records, config)
      : records;

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: resolvedRecords.items,
    total: resolvedRecords.total,
    page: resolvedRecords.page,
    pageSize: resolvedRecords.pageSize,
    filters: resolvedRecords.filters,
    freshness: computeFreshnessState(resolvedRecords.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus(resolveSourceInputs(resolvedRecords, "operationRecords"))
  };
}

export async function getOperationRecordDeviceTypes(config, siteId, options = {}) {
  const types = await loadOperationRecordDeviceTypes(config.legacyBaseUrl, siteId, {
    ...options,
    runtimeConfig: config
  });

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: types.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(types, "operationRecordDeviceTypes"))
  };
}

export async function getOperationRecordDevices(config, siteId, drTypeId, options = {}) {
  const devices = await loadOperationRecordDevices(config.legacyBaseUrl, siteId, drTypeId, {
    ...options,
    runtimeConfig: config
  });

  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    drTypeId: devices.drTypeId,
    items: devices.items,
    sourceStatus: buildSourceStatus(resolveSourceInputs(devices, "operationRecordDevices"))
  };
}
