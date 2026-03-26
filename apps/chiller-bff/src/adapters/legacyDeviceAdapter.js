import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

const DEVICE_LIST_PAGE_SIZE = 200;
const DEVICE_DETAIL_RUNTIME_PAGE_SIZE = 200;
const PLACEHOLDER_DEVICE_COUNTS = {
  chiller: 3,
  chilledPump: 3,
  coolingPump: 3,
  coolingTower: 4
};
const PLACEHOLDER_SYSTEM_ORDER = ["chiller", "chilledPump", "coolingPump", "coolingTower"];
const PLACEHOLDER_DEVICE_META = {
  chiller: {
    labelPrefix: "冷机",
    deviceTypeId: "placeholder-chiller",
    deviceTypeName: "冷水机组",
    usageType: "冷水机组"
  },
  chilledPump: {
    labelPrefix: "冷冻泵",
    deviceTypeId: "placeholder-chilled-pump",
    deviceTypeName: "冷冻水泵",
    usageType: "冷冻水泵"
  },
  coolingPump: {
    labelPrefix: "冷却泵",
    deviceTypeId: "placeholder-cooling-pump",
    deviceTypeName: "冷却水泵",
    usageType: "冷却水泵"
  },
  coolingTower: {
    labelPrefix: "冷却塔",
    deviceTypeId: "placeholder-cooling-tower",
    deviceTypeName: "冷却塔",
    usageType: "冷却塔"
  }
};

function normalizeLegacyPath(siteId, options = {}) {
  const projectKey =
    typeof options.projectKey === "string" && options.projectKey.trim()
      ? options.projectKey.trim()
      : "";
  return projectKey || siteId;
}

function buildDeviceListEndpoint(siteId, options = {}) {
  return `/zsqy/drinfo/${normalizeLegacyPath(siteId, options)}/findObject?pageCurrent=1&pageSize=${DEVICE_LIST_PAGE_SIZE}`;
}

function buildDeviceDetailRuntimeEndpoint(siteId, deviceId, options = {}) {
  return `/zsqy/reg/${normalizeLegacyPath(siteId, options)}/findObject?pageCurrent=1&pageSize=${DEVICE_DETAIL_RUNTIME_PAGE_SIZE}&drId=${encodeURIComponent(deviceId)}`;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function normalizeSystemType(item) {
  const raw = String(item?.drtypename || item?.typeYT || item?.drTypeCode || "").toUpperCase();
  if (raw.includes("CH")) {
    return "chiller";
  }
  if (raw.includes("CHP")) {
    return "chilledPump";
  }
  if (raw.includes("CWP")) {
    return "coolingPump";
  }
  if (raw.includes("CT") || raw.includes("CTF") || raw.includes("CTE") || raw.includes("CTHDE")) {
    return "coolingTower";
  }
  if (raw.includes("主机") || raw.includes("冷机")) {
    return "chiller";
  }
  if (raw.includes("冷冻水泵") || raw.includes("冷冻泵")) {
    return "chilledPump";
  }
  if (raw.includes("冷却水泵") || raw.includes("冷却泵")) {
    return "coolingPump";
  }
  if (raw.includes("冷却塔")) {
    return "coolingTower";
  }
  return "other";
}

function buildPlaceholderSourceStatus(siteId, kind, count) {
  return {
    endpoint: `placeholder://device-${kind}/${siteId}`,
    ok: true,
    fallback: true,
    status: 200,
    message: "Legacy device catalog empty, using placeholder fallback",
    rows: count,
    error: null
  };
}

function buildPlaceholderDeviceRows(siteId, options = {}) {
  const floorName = options.floorName == null ? "未知楼层" : String(options.floorName);
  const buildingName = options.buildingName == null ? "占位拓扑" : String(options.buildingName);
  const rows = [];
  for (const systemType of PLACEHOLDER_SYSTEM_ORDER) {
    const meta = PLACEHOLDER_DEVICE_META[systemType];
    const count = PLACEHOLDER_DEVICE_COUNTS[systemType] || 0;
    for (let index = 0; index < count; index += 1) {
      const sequence = index + 1;
      rows.push({
        deviceId: `placeholder-${systemType}-${sequence}`,
        deviceCode: `${siteId}-${systemType}-${sequence}`,
        deviceName: `${meta.labelPrefix}${sequence}`,
        deviceTypeId: meta.deviceTypeId,
        deviceTypeName: meta.deviceTypeName,
        systemType,
        floorName,
        buildingName,
        usageType: meta.usageType,
        iconPath: null,
        status: "unknown",
        lastReportAt: null,
        rawTypeCode: meta.deviceTypeId,
        rawTypeName: meta.deviceTypeName,
        isVirtual: true,
        isPlaceholder: true
      });
    }
  }
  return rows;
}

function buildPlaceholderTree(siteId, items) {
  const children = PLACEHOLDER_SYSTEM_ORDER.map((systemType) => {
    const groupChildren = items
      .filter((item) => item.systemType === systemType)
      .map((item) => ({
        id: `${siteId}/${item.deviceId}`,
        label: item.deviceName,
        nodeType: "device",
        parentId: `${siteId}/group/${systemType}`,
        deviceIdRef: item.deviceId,
        deviceCode: item.deviceCode,
        deviceName: item.deviceName,
        systemType: item.systemType,
        floorName: item.floorName,
        buildingName: item.buildingName,
        status: item.status,
        lastReportAt: item.lastReportAt,
        childCount: 0,
        children: []
      }));
    return {
      id: `${siteId}/group/${systemType}`,
      label: PLACEHOLDER_DEVICE_META[systemType]?.deviceTypeName || systemType,
      nodeType: "group",
      parentId: siteId,
      deviceIdRef: null,
      deviceCode: null,
      deviceName: null,
      systemType,
      floorName: "未知楼层",
      buildingName: "占位拓扑",
      status: "unknown",
      lastReportAt: null,
      childCount: groupChildren.length,
      children: groupChildren
    };
  });

  return {
    id: siteId,
    label: siteId,
    nodeType: "root",
    parentId: null,
    deviceIdRef: null,
    deviceCode: null,
    deviceName: null,
    systemType: null,
    floorName: null,
    buildingName: null,
    status: "unknown",
    lastReportAt: null,
    childCount: children.length,
    children
  };
}

function pickFirstNonEmptyText(...values) {
  for (const value of values) {
    const normalized = toTrimmedString(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function normalizeDeviceRow(row, index) {
  const normalizedDeviceId = row?.deviceId ?? row?.drid ?? row?.id ?? row?.drCode ?? `device-${index + 1}`;
  const normalizedDeviceCode = row?.deviceCode ?? row?.drcode ?? row?.drCode ?? row?.drid ?? normalizedDeviceId;
  const normalizedDeviceName = pickFirstNonEmptyText(
    row?.deviceName,
    row?.drname,
    row?.name,
    row?.deviceTypeName,
    row?.drtypename,
    "Device"
  );
  const normalizedDeviceTypeName = pickFirstNonEmptyText(row?.deviceTypeName, row?.drtypename) || null;
  const normalizedSystemType =
    row?.systemType != null && String(row.systemType).trim()
      ? String(row.systemType).trim()
      : normalizeSystemType(row);
  const normalizedFloorName = pickFirstNonEmptyText(row?.floorName, row?.floor_name) || "unknown";
  const normalizedBuildingName =
    pickFirstNonEmptyText(row?.buildingName, row?.buildname, row?.buildName, row?.building) || "unknown";
  const normalizedUsageType =
    pickFirstNonEmptyText(row?.usageType, row?.drUseExplain, row?.drtypename, row?.assetstypename) ||
    "unknown";

  return {
    deviceId: String(normalizedDeviceId),
    deviceCode: String(normalizedDeviceCode),
    deviceName: String(normalizedDeviceName),
    deviceTypeId: row?.drtypeid == null ? null : String(row.drtypeid),
    deviceTypeName: normalizedDeviceTypeName == null ? null : String(normalizedDeviceTypeName),
    systemType: normalizedSystemType,
    floorName: String(normalizedFloorName),
    buildingName: String(normalizedBuildingName),
    usageType: String(normalizedUsageType),
    iconPath: row?.iconpath == null ? null : String(row.iconpath || ""),
    status: "unknown",
    lastReportAt: null,
    rawTypeCode:
      row?.rawTypeCode != null
        ? String(row.rawTypeCode)
        : row?.drTypeCode == null
          ? null
          : String(row.drTypeCode || ""),
    rawTypeName:
      row?.rawTypeName != null
        ? String(row.rawTypeName)
        : normalizedDeviceTypeName == null
          ? null
          : String(normalizedDeviceTypeName),
    isVirtual:
      row?.isVirtual != null
        ? Boolean(row.isVirtual)
        : row?.typeYT == null || String(row.typeYT).trim() === ""
          ? null
          : String(row.typeYT).trim() !== "1",
    isPlaceholder: row?.isPlaceholder === true
  };
}

function buildEquipmentFingerprint(row) {
  return [
    row?.deviceName,
    row?.deviceTypeName,
    row?.usageType,
    row?.rawTypeName,
    row?.deviceCode
  ]
    .map((value) => toTrimmedString(value))
    .filter(Boolean)
    .join(" ");
}

function isPrimaryEquipmentRow(row) {
  if (!row) {
    return false;
  }
  if (row.isPlaceholder === true) {
    return true;
  }
  if (row.isVirtual === true) {
    return false;
  }

  const fingerprint = buildEquipmentFingerprint(row);
  if (!fingerprint) {
    return false;
  }

  if (/(电量|流量|温度|压力|液位|制冷量|湿度|参数设置|电动阀|阀门|液位计|风机)/.test(fingerprint)) {
    return false;
  }

  if (row.systemType === "chiller") {
    return /(冷水机组|冷机|主机)/.test(fingerprint);
  }
  if (row.systemType === "chilledPump") {
    return /冷冻泵/.test(fingerprint);
  }
  if (row.systemType === "coolingPump") {
    return /冷却泵/.test(fingerprint);
  }
  if (row.systemType === "coolingTower") {
    return /冷却塔/.test(fingerprint);
  }
  return false;
}

function selectDisplayRows(rows) {
  const primaryRows = rows.filter((row) => isPrimaryEquipmentRow(row));
  return primaryRows.length > 0 ? primaryRows : rows;
}

function hasUsableFloorInfo(row) {
  const floorName = toTrimmedString(row?.floorName);
  return Boolean(floorName && floorName !== "unknown" && floorName !== "0");
}

function buildDeviceCatalog(rows) {
  return new Map(
    rows.map((row, index) => {
      const normalized = normalizeDeviceRow(row, index);
      return [normalized.deviceId, normalized];
    })
  );
}

function inferTreeNodeType(rawNode, depth, deviceCatalog) {
  const rawId = rawNode?.id;
  const id = rawId == null ? "" : String(rawId);
  if (depth === 0) {
    return "root";
  }
  if (deviceCatalog.has(id)) {
    return "device";
  }
  if (Array.isArray(rawNode?.children) && rawNode.children.length > 0) {
    return "group";
  }
  return "point";
}

function normalizeTreeNode(rawNode, options) {
  const {
    depth,
    parentId,
    inheritedDeviceId,
    siteId,
    deviceCatalog
  } = options;
  const rawLookupId = rawNode?.id == null ? `${siteId}-node-${depth}` : String(rawNode.id);
  const stableId = parentId ? `${parentId}/${rawLookupId}` : `${siteId}/${rawLookupId}`;
  const catalogDevice = deviceCatalog.get(rawLookupId) || null;
  const nodeType = inferTreeNodeType(rawNode, depth, deviceCatalog);
  const deviceIdRef = nodeType === "device" ? rawLookupId : inheritedDeviceId;
  const children = Array.isArray(rawNode?.children)
    ? rawNode.children.map((child) =>
        normalizeTreeNode(child, {
          depth: depth + 1,
          parentId: stableId,
          inheritedDeviceId: deviceIdRef,
          siteId,
          deviceCatalog
        })
      )
    : [];

  return {
    id: stableId,
    label: String(rawNode?.name || catalogDevice?.deviceName || rawLookupId),
    nodeType,
    parentId: parentId || null,
    deviceIdRef: deviceIdRef || null,
    deviceCode: catalogDevice?.deviceCode || null,
    deviceName: catalogDevice?.deviceName || null,
    systemType: catalogDevice?.systemType || null,
    floorName: catalogDevice?.floorName || null,
    buildingName: catalogDevice?.buildingName || null,
    status: catalogDevice?.status || "unknown",
    lastReportAt: catalogDevice?.lastReportAt || null,
    childCount: children.length,
    children
  };
}

function normalizeDeviceTree(payload, siteId, deviceCatalog) {
  const roots = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? [payload] : [];
  const first = roots[0] || null;
  const firstId = first?.id == null ? null : String(first.id);
  const firstIsDevice = firstId ? deviceCatalog.has(firstId) : false;
  const useLegacyRoot = roots.length === 1 && Array.isArray(first?.children) && !firstIsDevice;
  const rootLabel = useLegacyRoot ? String(first?.name || siteId) : siteId;
  const rawChildren = useLegacyRoot ? first.children : roots;

  return {
    id: siteId,
    label: rootLabel,
    nodeType: "root",
    parentId: null,
    deviceIdRef: null,
    deviceCode: null,
    deviceName: null,
    systemType: null,
    floorName: null,
    buildingName: null,
    status: "unknown",
    lastReportAt: null,
    childCount: rawChildren.length,
    children: rawChildren.map((child) =>
      normalizeTreeNode(child, {
        depth: 1,
        parentId: siteId,
        inheritedDeviceId: null,
        siteId,
        deviceCatalog
      })
    )
  };
}

function countDeviceTreeNodes(node) {
  if (!node) {
    return 0;
  }
  let count = node.nodeType === "device" ? 1 : 0;
  for (const child of node.children || []) {
    count += countDeviceTreeNodes(child);
  }
  return count;
}

function asArray(value) {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function toTrimmedString(value) {
  return value == null ? "" : String(value).trim();
}

function toFiniteNumber(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikeDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(toTrimmedString(value));
}

function toIsoDateTime(value) {
  const normalized = toTrimmedString(value);
  if (!looksLikeDateTime(normalized)) {
    return null;
  }
  const isoReady = normalized.replace(" ", "T");
  const parsed = new Date(`${isoReady}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getRuntimeRecords(payload) {
  return deepArrayProbe(payload).filter((item) => item && typeof item === "object");
}

function pickRuntimeRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function collectAlarmLogTimes(value, bucket = []) {
  if (!value) {
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAlarmLogTimes(item, bucket));
    return bucket;
  }
  if (typeof value === "object") {
    const timeValue = toIsoDateTime(value.time);
    if (timeValue) {
      bucket.push(timeValue);
    }
    Object.values(value).forEach((child) => collectAlarmLogTimes(child, bucket));
  }
  return bucket;
}

function deriveRuntimeLatestUpdateAt(records, fallback = null) {
  const bucket = [];
  records.forEach((record) => {
    const directTime = toIsoDateTime(record.tagTime);
    if (directTime) {
      bucket.push(directTime);
    }
    collectAlarmLogTimes(record.regalarminfoslist, bucket);
  });

  if (bucket.length === 0) {
    return fallback;
  }

  const latest = bucket.reduce((current, candidate) => (candidate > current ? candidate : current));
  return latest || fallback;
}

function deriveRunStatusText(record) {
  if (!record) {
    return null;
  }

  const explicit = toTrimmedString(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  if (numericValue != null) {
    return numericValue > 0 ? "运行中" : "已停止";
  }

  return null;
}

function deriveAlarmStatusText(record) {
  if (!record) {
    return null;
  }

  const explicit = toTrimmedString(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  if (numericValue != null) {
    return numericValue > 0 ? "报警中" : "正常";
  }

  const alarmState = toFiniteNumber(record.tagAlarmState);
  if (alarmState != null) {
    return alarmState > 0 ? "报警中" : "正常";
  }

  return null;
}

function deriveRuntimeText(record) {
  if (!record) {
    return null;
  }

  const explicit = toTrimmedString(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  return numericValue == null ? null : String(numericValue);
}

function buildControlSignal(record, options) {
  if (!record) {
    return null;
  }

  const explicit = toTrimmedString(record.showStatus);
  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  let value = explicit;
  if (!value && typeof options.fromNumeric === "function") {
    value = options.fromNumeric(numericValue);
  }

  if (!value) {
    return null;
  }

  const active = typeof options.isActive === "function" ? options.isActive(value, numericValue) : true;
  return {
    key: options.key,
    label: options.label,
    value,
    active,
    tone: typeof options.resolveTone === "function" ? options.resolveTone(value, numericValue, active) : "neutral"
  };
}

function deriveControlSignals(records) {
  const remoteRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "远程");
  const manualModeRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "频率手自动");
  const manualStartRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "手动启动");
  const manualStopRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "手动停止");
  const disabledRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "设备禁用");
  const modeRecord = pickRuntimeRecord(records, (record) => toTrimmedString(record.regName) === "运行模式");

  const remoteSignal = buildControlSignal(remoteRecord, {
    key: "remoteLocal",
    label: "控制位置",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "远程" : "就地";
    },
    resolveTone: (value) => (value.includes("远程") ? "good" : "warn")
  });

  const manualModeSignal = buildControlSignal(manualModeRecord, {
    key: "frequencyMode",
    label: "频率模式",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "自动" : "手动";
    },
    resolveTone: (value) => (value.includes("自动") ? "good" : "warn")
  });

  const manualStartSignal = buildControlSignal(manualStartRecord, {
    key: "manualStart",
    label: "手动启动",
    fromNumeric: (numericValue) => {
      if (numericValue == null || numericValue <= 0) {
        return "";
      }
      return "有效";
    },
    isActive: (_value, numericValue) => numericValue != null && numericValue > 0,
    resolveTone: (_value, _numericValue, active) => (active ? "warn" : "neutral")
  });

  const manualStopSignal = buildControlSignal(manualStopRecord, {
    key: "manualStop",
    label: "手动停止",
    fromNumeric: (numericValue) => {
      if (numericValue == null || numericValue <= 0) {
        return "";
      }
      return "有效";
    },
    isActive: (_value, numericValue) => numericValue != null && numericValue > 0,
    resolveTone: (_value, _numericValue, active) => (active ? "warn" : "neutral")
  });

  const disabledSignal = buildControlSignal(disabledRecord, {
    key: "deviceDisabled",
    label: "设备状态",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "已禁用" : "启用";
    },
    resolveTone: (value) => (value.includes("禁用") ? "warn" : "good")
  });

  const operationModeSignal = buildControlSignal(modeRecord, {
    key: "operationMode",
    label: "运行模式",
    fromNumeric: () => "",
    resolveTone: () => "neutral"
  });

  return [
    remoteSignal,
    manualModeSignal,
    disabledSignal,
    manualStartSignal,
    manualStopSignal,
    operationModeSignal
  ].filter(Boolean);
}

async function loadDeviceCatalogRows(baseUrl, siteId, options = {}) {
  const endpoint = buildDeviceListEndpoint(siteId, options);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const rows = response.ok ? deepArrayProbe(response.payload) : [];
  return { endpoint, response, rows };
}

export async function loadDeviceSummary(baseUrl, siteId, options = {}) {
  const { endpoint, response, rows } = await loadDeviceCatalogRows(baseUrl, siteId, options);
  if (!response.ok) {
    return {
      sourceStatus: {
        endpoint,
        ok: false,
        status: response.status ?? null,
        message: null,
        error: response.error
      },
      fallbackSourceStatus: null,
      summary: null,
      groups: []
    };
  }

  if (options.placeholderFallback === true && rows.length === 0) {
    const placeholderRows = buildPlaceholderDeviceRows(siteId);
    const grouped = placeholderRows.reduce(
      (acc, item) => {
        const key = item.systemType;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      sourceStatus: {
        endpoint,
        ok: true,
        status: response.status ?? null,
        message: `${extractMessage(response.payload, "OK")}; rows=0`,
        rows: rows.length
      },
      fallbackSourceStatus: buildPlaceholderSourceStatus(siteId, "summary", placeholderRows.length),
      summary: {
        totalDevices: placeholderRows.length,
        chillerCount: grouped.chiller || 0,
        chilledPumpCount: grouped.chilledPump || 0,
        coolingPumpCount: grouped.coolingPump || 0,
        coolingTowerCount: grouped.coolingTower || 0
      },
      groups: placeholderRows.map((item) => ({
        id: item.deviceId,
        name: item.deviceName,
        type: item.systemType,
        floor: item.floorName
      }))
    };
  }

  const normalizedRows = selectDisplayRows(rows.map(normalizeDeviceRow));
  const grouped = normalizedRows.reduce(
    (acc, item) => {
      const key = item.systemType || normalizeSystemType(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const summary = {
    totalDevices: normalizedRows.length,
    chillerCount: grouped.chiller || 0,
    chilledPumpCount: grouped.chilledPump || 0,
    coolingPumpCount: grouped.coolingPump || 0,
    coolingTowerCount: grouped.coolingTower || 0
  };

  const groups = normalizedRows.slice(0, 200).map((row) => ({
    id: row.deviceId,
    name: row.deviceName,
    type: row.systemType,
    floor: row.floorName
  }));

  return {
    sourceStatus: {
      endpoint,
      ok: true,
      status: response.status ?? null,
      message: extractMessage(response.payload, "OK"),
      rows: rows.length
    },
    fallbackSourceStatus: null,
    summary,
    groups
  };
}

export async function loadDeviceList(baseUrl, siteId, options = {}) {
  const page = Number.isFinite(Number(options.page)) ? Math.max(1, Number(options.page)) : 1;
  const pageSize = Number.isFinite(Number(options.pageSize))
    ? Math.max(1, Number(options.pageSize))
    : 20;
  const typeFilter = typeof options.type === "string" && options.type.trim() ? options.type.trim() : "";
  const floorFilter =
    typeof options.floor === "string" && options.floor.trim() ? options.floor.trim() : "";
  const endpoint = buildDeviceListEndpoint(siteId, options);
  const fetchedAt = new Date().toISOString();
  const { response, rows } = await loadDeviceCatalogRows(baseUrl, siteId, options);
  const usePlaceholderFallback = options.placeholderFallback === true && response.ok && rows.length === 0;
  const normalizedRows = usePlaceholderFallback
    ? buildPlaceholderDeviceRows(siteId, {
        floorName: floorFilter || "1"
      })
    : selectDisplayRows(rows.map(normalizeDeviceRow));
  const enforceFloorFilter = Boolean(floorFilter) && normalizedRows.some((row) => hasUsableFloorInfo(row));
  const filteredRows = normalizedRows.filter((row) => {
    if (typeFilter && row.systemType !== typeFilter) {
      return false;
    }
    if (enforceFloorFilter && row.floorName !== floorFilter) {
      return false;
    }
    return true;
  });

  const offset = (page - 1) * pageSize;
  const items = filteredRows.slice(offset, offset + pageSize);

  return {
    items,
    total: filteredRows.length,
    page,
    pageSize,
    fetchedAt,
    filters: {
      type: typeFilter || null,
      floor: floorFilter || null
    },
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      rows: response.ok ? rows.length : null,
      error: response.ok ? null : response.error
    },
    fallbackSourceStatus: usePlaceholderFallback
      ? buildPlaceholderSourceStatus(siteId, "list", normalizedRows.length)
      : null
  };
}

export async function loadDeviceTree(baseUrl, siteId, options = {}) {
  const build = Number.isFinite(Number(options.build)) ? Math.max(1, Number(options.build)) : 1;
  const floor = Number.isFinite(Number(options.floor)) ? Math.max(1, Number(options.floor)) : 1;
  const mock = options.mock === true ? "true" : "false";
  const endpoint = `/api/device/${normalizeLegacyPath(siteId, options)}/data/tree?build=${build}&floor=${floor}&mock=${mock}`;
  const fetchedAt = new Date().toISOString();

  const [treeResponse, catalog] = await Promise.all([
    fetchLegacyJson(baseUrl, endpoint),
    loadDeviceCatalogRows(baseUrl, siteId, options)
  ]);
  const usePlaceholderFallback =
    options.placeholderFallback === true && catalog.response.ok && catalog.rows.length === 0;
  const catalogRows = usePlaceholderFallback
    ? buildPlaceholderDeviceRows(siteId, {
        floorName: String(floor),
        buildingName: `楼栋 ${build}`
      })
    : selectDisplayRows(catalog.rows.map(normalizeDeviceRow));
  const catalogMap = buildDeviceCatalog(catalogRows);
  const normalizedTree = treeResponse.ok
    ? normalizeDeviceTree(treeResponse.payload, siteId, catalogMap)
    : null;
  const treeHasDeviceNodes = countDeviceTreeNodes(normalizedTree) > 0;
  const root = treeHasDeviceNodes
    ? normalizedTree
    : catalogRows.length > 0
      ? buildPlaceholderTree(siteId, Array.from(catalogMap.values()))
      : null;
  const treeError =
    treeHasDeviceNodes
      ? null
      : treeResponse.ok
        ? extractMessage(treeResponse.payload, "Legacy tree payload unavailable")
        : treeResponse.error;
  const treeMessage = treeHasDeviceNodes
    ? "OK"
    : treeResponse.ok
      ? extractMessage(treeResponse.payload, "Legacy tree payload unavailable")
      : null;

  return {
    root,
    fetchedAt,
    filters: {
      build,
      floor
    },
    sourceStatus: {
      tree: {
        endpoint,
        ok: treeHasDeviceNodes,
        status: treeResponse.status ?? null,
        message: treeMessage,
        rows: treeHasDeviceNodes ? root?.childCount ?? null : null,
        error: treeError
      },
      catalog: {
        endpoint: catalog.endpoint,
        ok: catalog.response.ok,
        status: catalog.response.status ?? null,
        message: catalog.response.ok ? extractMessage(catalog.response.payload, "OK") : null,
        rows: catalogRows.length,
        error: catalog.response.ok ? null : catalog.response.error
      },
      placeholder: usePlaceholderFallback
        ? buildPlaceholderSourceStatus(siteId, "tree", catalogRows.length)
        : null
    }
  };
}

function findTreeNodeByDeviceId(node, deviceId) {
  if (!node) {
    return null;
  }
  if (node.deviceIdRef === deviceId) {
    return node;
  }
  for (const child of node.children || []) {
    const found = findTreeNodeByDeviceId(child, deviceId);
    if (found) {
      return found;
    }
  }
  return null;
}

export async function loadDeviceDetail(baseUrl, siteId, deviceId, options = {}) {
  const normalizedDeviceId = String(deviceId || "").trim();
  const fetchedAt = new Date().toISOString();
  const build = Number.isFinite(Number(options.build)) ? Math.max(1, Number(options.build)) : 1;
  const floor = Number.isFinite(Number(options.floor)) ? Math.max(1, Number(options.floor)) : 1;
  const runtimeEndpoint = buildDeviceDetailRuntimeEndpoint(siteId, normalizedDeviceId, options);
  if (!normalizedDeviceId) {
    return {
      detail: null,
      fetchedAt,
      sourceStatus: {
        catalog: {
          endpoint: buildDeviceListEndpoint(siteId, options),
          ok: false,
          status: 400,
          message: null,
          rows: null,
          error: "Missing deviceId"
        },
        tree: {
          endpoint: `/api/device/${normalizeLegacyPath(siteId, options)}/data/tree?build=1&floor=1&mock=false`,
          ok: false,
          status: 400,
          message: null,
          rows: null,
          error: "Missing deviceId"
        },
        runtime: {
          endpoint: runtimeEndpoint,
          ok: false,
          status: 400,
          message: null,
          rows: null,
          error: "Missing deviceId"
        }
      }
    };
  }

  const [catalog, tree] = await Promise.all([
    loadDeviceCatalogRows(baseUrl, siteId, options),
    loadDeviceTree(baseUrl, siteId, { ...options, placeholderFallback: true })
  ]);

  const usePlaceholderFallback =
    options.placeholderFallback === true && catalog.response.ok && catalog.rows.length === 0;
  const normalizedRows = usePlaceholderFallback
    ? buildPlaceholderDeviceRows(siteId, {
        floorName: String(floor),
        buildingName: `楼栋 ${build}`
      })
    : catalog.rows.map(normalizeDeviceRow);
  const matched = normalizedRows.find((row) => row.deviceId === normalizedDeviceId) || null;
  const treeNode = findTreeNodeByDeviceId(tree.root, normalizedDeviceId);
  const runtime = matched?.isPlaceholder
    ? {
        ok: true,
        status: 200,
        payload: {
          msg: "Placeholder device detail"
        },
        error: null
      }
    : await fetchLegacyJson(baseUrl, runtimeEndpoint);
  const runtimeRecords = runtime.ok ? getRuntimeRecords(runtime.payload) : [];
  const runRecord =
    pickRuntimeRecord(runtimeRecords, (record) => toTrimmedString(record.regName) === "运行") ||
    pickRuntimeRecord(runtimeRecords, (record) => /40169$/.test(toTrimmedString(record.tagName)));
  const alarmRecord =
    pickRuntimeRecord(runtimeRecords, (record) => toTrimmedString(record.regName) === "通讯报警") ||
    pickRuntimeRecord(runtimeRecords, (record) => /40170$/.test(toTrimmedString(record.tagName))) ||
    pickRuntimeRecord(runtimeRecords, (record) => toTrimmedString(record.regName).includes("报警"));
  const runStatusText = deriveRunStatusText(runRecord);
  const alarmStatusText = deriveAlarmStatusText(alarmRecord);
  const latestUpdateAt = deriveRuntimeLatestUpdateAt(runtimeRecords, matched?.lastReportAt || null);
  const controlSignals = deriveControlSignals(runtimeRecords);

  return {
    detail: matched
      ? {
          deviceId: matched.deviceId,
          deviceCode: matched.deviceCode,
          deviceName: matched.deviceName,
          deviceTypeCode: matched.rawTypeCode,
          deviceTypeName: matched.rawTypeName || matched.usageType,
          floorName: matched.floorName,
          buildingName: matched.buildingName,
          usageType: matched.usageType,
          iconPath: matched.iconPath,
          isVirtual: matched.isVirtual,
          isPlaceholder: matched.isPlaceholder === true,
          runStatusText: runStatusText || (matched.isPlaceholder ? "占位设备" : null),
          alarmStatusText: alarmStatusText || (matched.isPlaceholder ? "无实时告警" : null),
          latestUpdateAt,
          controlSignals,
          treeNodeType: treeNode?.nodeType || null,
          treeChildCount: treeNode?.childCount ?? null,
          pointCount: Array.isArray(treeNode?.children) ? treeNode.children.length : 0
        }
      : null,
    fetchedAt,
    sourceStatus: {
      catalog: {
        endpoint: catalog.endpoint,
        ok: catalog.response.ok,
        status: catalog.response.status ?? null,
        message: catalog.response.ok ? extractMessage(catalog.response.payload, "OK") : null,
        rows: catalog.rows.length,
        error: catalog.response.ok ? null : catalog.response.error
      },
      tree: tree.sourceStatus?.tree || {
        endpoint: `/api/device/${normalizeLegacyPath(siteId, options)}/data/tree?build=1&floor=1&mock=false`,
        ok: false,
        status: null,
        message: null,
        rows: null,
        error: "Tree source unavailable"
      },
      runtime: {
        endpoint: runtimeEndpoint,
        ok: matched?.isPlaceholder ? true : runtime.ok && runtimeRecords.length > 0,
        status: runtime.status ?? null,
        message:
          matched?.isPlaceholder
            ? "Placeholder device has no runtime records"
            : runtime.ok && runtimeRecords.length > 0
            ? extractMessage(runtime.payload, "OK")
            : runtime.ok
              ? "No runtime records"
              : null,
        rows: runtimeRecords.length,
        error: matched?.isPlaceholder ? null : runtime.ok ? null : runtime.error
      },
      placeholder: usePlaceholderFallback
        ? buildPlaceholderSourceStatus(siteId, "detail", normalizedRows.length)
        : null
    }
  };
}
