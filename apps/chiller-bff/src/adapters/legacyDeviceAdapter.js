import { deepArrayProbe, fetchLegacyJson } from "../lib/http.js";

const DEVICE_LIST_PAGE_SIZE = 200;
const DEVICE_DETAIL_RUNTIME_PAGE_SIZE = 200;
const ACTIVE_FREQUENCY_FALLBACK_THRESHOLD_HZ = 5;
const STATUS_TEXT_RUNNING = "\u8fd0\u884c\u4e2d";
const STATUS_TEXT_STOPPED = "\u5df2\u505c\u6b62";
const STATUS_TEXT_ALARM = "\u62a5\u8b66\u4e2d";
const STATUS_TEXT_NORMAL = "\u6b63\u5e38";
const ALARM_TEXT_PATTERN =
  /(?:alarm|fault|error|trip|fail|warning|protect|interlock|\u62a5\u8b66|\u544a\u8b66|\u6545\u969c|\u5f02\u5e38|\u5931\u8d25|\u8df3\u95f8|\u4fdd\u62a4|\u8054\u9501|\u901a\u8baf)/i;
const NORMAL_TEXT_PATTERN =
  /(?:normal|ok|healthy|clear|resolved|\u6b63\u5e38|\u5df2\u6062\u590d|\u65e0\u544a\u8b66|\u4e0d\u62a5\u8b66)/i;
const RUNNING_TEXT_PATTERN = /(?:running|run|start|on|\u8fd0\u884c|\u542f\u52a8|\u5f00\u542f)/i;
const STOPPED_TEXT_PATTERN = /(?:stopp|shutdown|off|idle|standby|\u505c\u6b62|\u505c\u673a|\u5f85\u673a)/i;
const PLACEHOLDER_DEVICE_COUNTS = {
  chiller: 3,
  chilledPump: 3,
  coolingPump: 3,
  coolingTower: 4
};
const PLACEHOLDER_SYSTEM_ORDER = ["chiller", "chilledPump", "coolingPump", "coolingTower"];
const PLACEHOLDER_DEVICE_META = {
  chiller: {
    labelPrefix: "\u51b7\u673a",
    deviceTypeId: "placeholder-chiller",
    deviceTypeName: "\u51b7\u6c34\u673a\u7ec4",
    usageType: "\u51b7\u6c34\u673a\u7ec4"
  },
  chilledPump: {
    labelPrefix: "\u51b7\u51bb\u6cf5",
    deviceTypeId: "placeholder-chilled-pump",
    deviceTypeName: "\u51b7\u51bb\u6c34\u6cf5",
    usageType: "\u51b7\u51bb\u6c34\u6cf5"
  },
  coolingPump: {
    labelPrefix: "\u51b7\u5374\u6cf5",
    deviceTypeId: "placeholder-cooling-pump",
    deviceTypeName: "\u51b7\u5374\u6c34\u6cf5",
    usageType: "\u51b7\u5374\u6c34\u6cf5"
  },
  coolingTower: {
    labelPrefix: "\u51b7\u5374\u5854",
    deviceTypeId: "placeholder-cooling-tower",
    deviceTypeName: "\u51b7\u5374\u5854",
    usageType: "\u51b7\u5374\u5854"
  }
};

function normalizeLegacyPath(siteId, options = {}) {
  const databaseKey =
    typeof options.databaseKey === "string" && options.databaseKey.trim()
      ? options.databaseKey.trim()
      : "";
  if (databaseKey) {
    return databaseKey;
  }
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

function parseBuildFloorFromProjectKey(projectKey) {
  const normalized = toTrimmedString(projectKey);
  if (!normalized) {
    return null;
  }
  const parts = normalized.split("-");
  if (parts.length === 1) {
    return { build: 1, floor: 0 };
  }
  const buildPart = toFiniteNumber(parts[1]);
  const floorPart = parts.length >= 3 ? toFiniteNumber(parts[2]) : 0;
  return {
    build: buildPart != null ? Math.max(0, Math.floor(buildPart)) : 1,
    floor: floorPart != null ? Math.max(0, Math.floor(floorPart)) : 0
  };
}

function resolveLegacyRegBuildFloor(options = {}) {
  const fromProjectKey = parseBuildFloorFromProjectKey(options.projectKey);
  if (fromProjectKey) {
    return fromProjectKey;
  }
  const build = Number.isFinite(Number(options.build)) ? Math.max(0, Number(options.build)) : 1;
  const floor = Number.isFinite(Number(options.floor)) ? Math.max(0, Number(options.floor)) : 0;
  return { build, floor };
}

function buildDeviceRealtimeCollectionEndpoint(siteId, options = {}) {
  const endpointKind = toTrimmedString(options.realtimeEndpointKind);
  if (!endpointKind) {
    return null;
  }

  const build = Number.isFinite(Number(options.build)) ? Math.max(0, Number(options.build)) : null;
  const floor = Number.isFinite(Number(options.floor)) ? Math.max(0, Number(options.floor)) : null;
  const query = new URLSearchParams();

  if (endpointKind === "api-device-data") {
    if (build !== null) {
      query.set("build", String(build));
    }
    if (floor !== null) {
      query.set("floor", String(floor));
    }
    if (options.mock === true) {
      query.set("mock", "1");
    } else if (options.mock === false) {
      query.set("mock", "0");
    }
    const search = query.toString();
    return `/api/device/${normalizeLegacyPath(siteId, options)}/data${search ? `?${search}` : ""}`;
  }

  if (endpointKind === "legacy-reg-findAllByDrTypeId") {
    const legacyBuildFloor = resolveLegacyRegBuildFloor(options);
    query.set("build", String(legacyBuildFloor.build));
    query.set("floor", String(legacyBuildFloor.floor));
    const search = query.toString();
    return `/zsqy/reg/${normalizeLegacyPath(siteId, options)}/findAllByDrTypeId${search ? `?${search}` : ""}`;
  }

  return null;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function normalizeSystemType(item) {
  const codeRaw = pickFirstNonEmptyText(item?.drcode, item?.drCode, item?.drTypeCode, item?.rawTypeCode).toUpperCase();
  const nameRaw = [
    item?.drtypename,
    item?.deviceTypeName,
    item?.drUseExplain,
    item?.assetstypename,
    item?.drname,
    item?.deviceName,
    item?.name
  ]
    .map((value) => toTrimmedString(value).toUpperCase())
    .filter(Boolean)
    .join(" ");
  const raw = `${codeRaw} ${nameRaw}`.trim();

  // Prefer device code mapping to avoid locale/encoding mismatches.
  if (/(?:\u9600|\u95f8|VALVE)/i.test(raw)) {
    return "valve";
  }
  if (codeRaw.startsWith("HWP")) {
    return "hotWaterPump";
  }
  if (codeRaw.startsWith("FM")) {
    return "valve";
  }
  if (codeRaw.startsWith("CHP")) {
    return "chilledPump";
  }
  if (codeRaw.startsWith("CWP")) {
    return "coolingPump";
  }
  if (codeRaw.startsWith("CTE") || codeRaw.startsWith("CTHDE")) {
    return "other";
  }
  if (
    codeRaw.startsWith("CTF")
    || /^CT\d+/.test(codeRaw)
    || codeRaw === "CT"
  ) {
    return "coolingTower";
  }
  if (
    codeRaw.startsWith("LCH")
    || codeRaw.startsWith("MCH")
    || codeRaw.startsWith("HCH")
    || codeRaw.startsWith("FCH")
  ) {
    return "chiller";
  }
  if (codeRaw.startsWith("CH")) {
    return "chiller";
  }

  if (raw.includes("HWP") || raw.includes("HOT WATER PUMP")) {
    return "hotWaterPump";
  }
  if (raw.includes("CHP")) {
    return "chilledPump";
  }
  if (raw.includes("CWP")) {
    return "coolingPump";
  }
  if (raw.includes("CTF") || /\bCT\d+\b/.test(raw)) {
    return "coolingTower";
  }
  if (raw.includes("COOLING TOWER")) {
    return "coolingTower";
  }
  if (
    raw.includes("LCH")
    || raw.includes("MCH")
    || raw.includes("HCH")
    || raw.includes("FCH")
  ) {
    return "chiller";
  }
  if (raw.includes("CH")) {
    return "chiller";
  }
  if (raw.includes("CHILLER")) {
    return "chiller";
  }
  if (raw.includes("CHILLED PUMP")) {
    return "chilledPump";
  }
  if (raw.includes("COOLING PUMP")) {
    return "coolingPump";
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
  const floorName = options.floorName == null ? "\u672a\u77e5\u697c\u5c42" : String(options.floorName);
  const buildingName = options.buildingName == null ? "\u9ed8\u8ba4" : String(options.buildingName);
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
      floorName: "\u672a\u77e5\u697c\u5c42",
      buildingName: "\u9ed8\u8ba4",
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
    status:
      pickFirstNonEmptyText(
        row?.status,
        row?.runStatus,
        row?.runstatus,
        row?.run_state,
        row?.runState,
        row?.drstatus,
        row?.drstate,
        row?.state,
        row?.workStatus,
        row?.workstatus,
        row?.deviceStatus,
        row?.device_state,
        row?.isRun,
        row?.isrun,
        row?.isRunning
      ) || "unknown",
    lastReportAt: pickFirstNonEmptyText(row?.lastReportAt) || null,
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
  const fingerprintUpper = fingerprint.toUpperCase();

  if (
    /\b(CHE|CHPE|CWPE|CTE|LZE|TBCC|FT|PT|TT|RH)\d*\b/.test(fingerprintUpper)
    || /(ELECTRIC|ENERGY|FLOW|TEMP|TEMPERATURE|PRESSURE|LEVEL|SENSOR|SETPOINT|PARAMETER|METER|KWH)/.test(fingerprintUpper)
  ) {
    return false;
  }

  if (row.systemType === "chiller") {
    return (
      /\b(CH|LCH|MCH|HCH|FCH)\d+\b/.test(fingerprintUpper)
      || fingerprintUpper.includes("CHILLER")
    );
  }
  if (row.systemType === "chilledPump") {
    return /\bCHP\d+\b/.test(fingerprintUpper) || fingerprintUpper.includes("CHILLED PUMP");
  }
  if (row.systemType === "coolingPump") {
    return /\bCWP\d+\b/.test(fingerprintUpper) || fingerprintUpper.includes("COOLING PUMP");
  }
  if (row.systemType === "hotWaterPump") {
    return /\bHWP\d+\b/.test(fingerprintUpper) || fingerprintUpper.includes("HOT WATER PUMP");
  }
  if (row.systemType === "coolingTower") {
    return (
      /\bCT\d+\b/.test(fingerprintUpper)
      || /\bCTF\d+\b/.test(fingerprintUpper)
      || fingerprintUpper.includes("COOLING TOWER")
    );
  }
  if (row.systemType === "valve") {
    return /\bFM\d+\b/.test(fingerprintUpper) || fingerprintUpper.includes("VALVE") || /(?:\u9600|\u95f8)/.test(fingerprint);
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

function pickFirstFiniteNumber(...values) {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
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

  const explicit = normalizeDisplayStatusText(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  if (numericValue != null) {
    return numericValue > 0 ? STATUS_TEXT_RUNNING : STATUS_TEXT_STOPPED;
  }

  return null;
}

function deriveAlarmStatusText(record) {
  if (!record) {
    return null;
  }

  const explicit = normalizeDisplayStatusText(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  if (numericValue != null) {
    return numericValue > 0 ? STATUS_TEXT_ALARM : STATUS_TEXT_NORMAL;
  }

  const alarmState = toFiniteNumber(record.tagAlarmState);
  if (alarmState != null) {
    return alarmState > 0 ? STATUS_TEXT_ALARM : STATUS_TEXT_NORMAL;
  }

  return null;
}

function deriveRuntimeText(record) {
  if (!record) {
    return null;
  }

  const explicit = normalizeDisplayStatusText(record.showStatus);
  if (explicit) {
    return explicit;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  return numericValue == null ? null : String(numericValue);
}

function normalizeDisplayStatusText(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    return "";
  }
  return /^-?\d+(\.\d+)?$/.test(normalized) ? "" : normalized;
}

function isRunningText(value) {
  const normalized = toTrimmedString(value);
  return Boolean(normalized) && RUNNING_TEXT_PATTERN.test(normalized) && !STOPPED_TEXT_PATTERN.test(normalized);
}

function isStoppedText(value) {
  const normalized = toTrimmedString(value);
  return Boolean(normalized) && STOPPED_TEXT_PATTERN.test(normalized) && !RUNNING_TEXT_PATTERN.test(normalized);
}

function isAlarmText(value) {
  const normalized = toTrimmedString(value);
  return Boolean(normalized) && ALARM_TEXT_PATTERN.test(normalized) && !NORMAL_TEXT_PATTERN.test(normalized);
}

function isNormalText(value) {
  const normalized = toTrimmedString(value);
  return Boolean(normalized) && NORMAL_TEXT_PATTERN.test(normalized);
}

function isAlarmIndicatorRecord(record) {
  if (!record || typeof record !== "object") {
    return false;
  }
  const regName = toTrimmedString(record.regName);
  const tagName = toTrimmedString(record.tagName);
  const alarmState = toFiniteNumber(record.tagAlarmState);
  const alarmLevel = toFiniteNumber(record.alarmLevel);
  const alarmTypeLevel = toFiniteNumber(record.alarmtypelevel);
  const isalarm = toTrimmedString(record.isalarm);

  return (
    /40170$/.test(tagName)
    || /40144$/.test(tagName)
    || /42321$/.test(tagName)
    || ALARM_TEXT_PATTERN.test(regName)
    || (alarmState != null && alarmState > 0)
    || (alarmLevel != null && alarmLevel > 0)
    || (alarmTypeLevel != null && alarmTypeLevel > 0)
    || isalarm === "1"
    || Boolean(toTrimmedString(record.alarmtype))
    || Boolean(toTrimmedString(record.alarmtypelevel))
  );
}

function deriveAlarmFlagByRequestedRule(record) {
  if (!record || typeof record !== "object") {
    return null;
  }
  const regDrShowType = pickFirstFiniteNumber(record.regDrShowType, record.regdrshowtype);
  const tagValue = pickFirstFiniteNumber(record.tagValue, record.newtagvalue, record.qstagvalue);
  const isAlarm = pickFirstFiniteNumber(record.isAlarm, record.isalarm);
  const tagAlarmState = pickFirstFiniteNumber(record.tagAlarmState, record.tagalarmstate);
  const explicitStatus = normalizeDisplayStatusText(record.showStatus);

  const hasLeftClause = regDrShowType != null && tagValue != null;
  const hasRightClause = isAlarm != null && tagAlarmState != null && tagValue != null;
  if (!hasLeftClause && !hasRightClause) {
    return null;
  }

  // Some sites expose isAlarm/tagAlarmState as alarm point metadata instead of active state.
  // Require active value bit for this branch to avoid false-positive alarm flooding.
  const rightClauseMatched = hasRightClause && isAlarm === 1 && tagAlarmState === 1 && tagValue === 1;

  return (
    (hasLeftClause && regDrShowType === 2 && tagValue === 1)
    || rightClauseMatched
    || (Boolean(explicitStatus) && isAlarm === 1 && tagAlarmState === 1 && isAlarmText(explicitStatus))
  );
}

function deriveAlarmFlagFromRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const requestedRuleResult = deriveAlarmFlagByRequestedRule(record);
  if (requestedRuleResult != null) {
    return requestedRuleResult;
  }

  const explicit = normalizeDisplayStatusText(record.showStatus);
  if (explicit) {
    if (isAlarmText(explicit)) {
      return true;
    }
    if (isNormalText(explicit)) {
      return false;
    }
  }

  const alarmState = toFiniteNumber(record.tagAlarmState);
  if (alarmState != null) {
    return alarmState > 0;
  }

  const alarmLevel = toFiniteNumber(record.alarmLevel);
  if (alarmLevel != null) {
    return alarmLevel > 0;
  }

  const alarmTypeLevel = toFiniteNumber(record.alarmtypelevel);
  if (alarmTypeLevel != null) {
    return alarmTypeLevel > 0;
  }

  const numericValue = toFiniteNumber(record.newtagvalue ?? record.tagValue ?? record.qstagvalue);
  if (numericValue != null && isAlarmIndicatorRecord(record)) {
    return numericValue > 0;
  }

  if (isAlarmIndicatorRecord(record)) {
    return false;
  }

  return null;
}

function deriveAlarmStatusFromRecords(records) {
  const runtimeRecords = Array.isArray(records) ? records : [];
  let observed = false;
  for (const record of runtimeRecords) {
    const alarmFlag = deriveAlarmFlagFromRecord(record);
    if (alarmFlag == null) {
      continue;
    }
    observed = true;
    if (alarmFlag) {
      return STATUS_TEXT_ALARM;
    }
  }
  return observed ? STATUS_TEXT_NORMAL : null;
}

function mergeAlarmStatusText(primary, secondary) {
  if (isAlarmText(primary) || isAlarmText(secondary)) {
    return STATUS_TEXT_ALARM;
  }
  if (primary) {
    return primary;
  }
  return secondary || null;
}

function pickLatestIsoDateTime(values, fallback = null) {
  const candidates = values.filter((value) => typeof value === "string" && value.trim());
  if (candidates.length === 0) {
    return fallback;
  }
  return candidates.reduce((current, candidate) => (candidate > current ? candidate : current), candidates[0]) || fallback;
}

function buildRuntimeSnapshot(records, fallbackLatestUpdateAt = null) {
  const runtimeRecords = Array.isArray(records) ? records : [];
  const runRecord = pickRuntimeRecord(runtimeRecords, (record) => {
    const regName = toTrimmedString(record.regName);
    const regNameLower = regName.toLowerCase();
    const tagName = toTrimmedString(record.tagName);
    return (
      /40169$/.test(tagName)
      || /40143$/.test(tagName)
      || regName === "\u8fd0\u884c"
      || regNameLower === "run"
      || /(?:^|\b)run(?:ning)?(?:$|\b)/.test(regNameLower)
    );
  });
  const alarmRecord = pickRuntimeRecord(runtimeRecords, (record) => {
    const regName = toTrimmedString(record.regName);
    const tagName = toTrimmedString(record.tagName);
    return /40170$|40144$|42321$/.test(tagName) || ALARM_TEXT_PATTERN.test(regName) || isAlarmIndicatorRecord(record);
  });
  const frequencyRecord =
    pickRuntimeRecord(runtimeRecords, (record) => toTrimmedString(record.regName) === "\u9891\u7387\u53cd\u9988") ||
    pickRuntimeRecord(runtimeRecords, (record) => {
      const regNameLower = toTrimmedString(record.regName).toLowerCase();
      return /42015$/.test(toTrimmedString(record.tagName)) || regNameLower.includes("frequency");
    });
  const runStatusText = deriveRunStatusText(runRecord);
  const alarmStatusText = mergeAlarmStatusText(
    deriveAlarmStatusText(alarmRecord),
    deriveAlarmStatusFromRecords(runtimeRecords)
  );
  const latestUpdateAt = deriveRuntimeLatestUpdateAt(runtimeRecords, fallbackLatestUpdateAt);
  const controlSignals = deriveControlSignals(runtimeRecords);
  const frequencyHz = toFiniteNumber(frequencyRecord?.newtagvalue ?? frequencyRecord?.tagValue ?? frequencyRecord?.qstagvalue);

  return {
    runStatusText,
    alarmStatusText,
    latestUpdateAt,
    controlSignals,
    frequencyHz,
    recordCount: runtimeRecords.length
  };
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
  const findByRegNames = (...names) =>
    pickRuntimeRecord(records, (record) => names.includes(toTrimmedString(record.regName)));

  const remoteRecord = findByRegNames("\u8fdc\u7a0b", "REMOTE");
  const manualModeRecord = findByRegNames("\u9891\u7387\u624b\u81ea\u52a8", "\u9891\u7387\u6a21\u5f0f", "AUTO/MANUAL");
  const manualStartRecord = findByRegNames("\u624b\u52a8\u542f\u52a8", "MANUAL START");
  const manualStopRecord = findByRegNames("\u624b\u52a8\u505c\u6b62", "MANUAL STOP");
  const disabledRecord = findByRegNames("\u8bbe\u5907\u7981\u7528", "\u7981\u7528", "DISABLED");
  const modeRecord = findByRegNames("\u8fd0\u884c\u6a21\u5f0f", "MODE");

  const remoteSignal = buildControlSignal(remoteRecord, {
    key: "remoteLocal",
    label: "\u63a7\u5236\u4f4d\u7f6e",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "\u8fdc\u7a0b" : "\u5c31\u5730";
    },
    resolveTone: (value) => (value.includes("\u8fdc\u7a0b") ? "good" : "warn")
  });

  const manualModeSignal = buildControlSignal(manualModeRecord, {
    key: "frequencyMode",
    label: "\u9891\u7387\u6a21\u5f0f",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "\u81ea\u52a8" : "\u624b\u52a8";
    },
    resolveTone: (value) => (value.includes("\u81ea\u52a8") ? "good" : "warn")
  });

  const manualStartSignal = buildControlSignal(manualStartRecord, {
    key: "manualStart",
    label: "\u624b\u52a8\u542f\u52a8",
    fromNumeric: (numericValue) => {
      if (numericValue == null || numericValue <= 0) {
        return "";
      }
      return "\u6709\u6548";
    },
    isActive: (_value, numericValue) => numericValue != null && numericValue > 0,
    resolveTone: (_value, _numericValue, active) => (active ? "warn" : "neutral")
  });

  const manualStopSignal = buildControlSignal(manualStopRecord, {
    key: "manualStop",
    label: "\u624b\u52a8\u505c\u6b62",
    fromNumeric: (numericValue) => {
      if (numericValue == null || numericValue <= 0) {
        return "";
      }
      return "\u6709\u6548";
    },
    isActive: (_value, numericValue) => numericValue != null && numericValue > 0,
    resolveTone: (_value, _numericValue, active) => (active ? "warn" : "neutral")
  });

  const disabledSignal = buildControlSignal(disabledRecord, {
    key: "deviceDisabled",
    label: "\u8bbe\u5907\u72b6\u6001",
    fromNumeric: (numericValue) => {
      if (numericValue == null) {
        return "";
      }
      return numericValue > 0 ? "\u7981\u7528" : "\u542f\u7528";
    },
    resolveTone: (value) => (value.includes("\u7981\u7528") ? "warn" : "good")
  });

  const operationModeSignal = buildControlSignal(modeRecord, {
    key: "operationMode",
    label: "\u8fd0\u884c\u6a21\u5f0f",
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

function extractCoolingTowerSequence(device) {
  const code = toTrimmedString(device?.deviceCode);
  const fromTowerCode = code.match(/^CT(\d+)$/i);
  if (fromTowerCode) {
    return fromTowerCode[1];
  }
  const fromFanCode = code.match(/^CTF(\d+)\d+$/i);
  if (fromFanCode) {
    return fromFanCode[1];
  }

  const fromName = pickFirstNonEmptyText(device?.deviceName, device?.usageType).match(/^(\d+)#/);
  if (fromName) {
    return fromName[1];
  }
  return "";
}

function findCoolingTowerProxyRows(realtimeRows, device) {
  if (!Array.isArray(realtimeRows) || realtimeRows.length === 0 || device?.systemType !== "coolingTower") {
    return [];
  }

  const towerSequence = extractCoolingTowerSequence(device);
  if (!towerSequence) {
    return [];
  }

  const codePattern = new RegExp("^CTF" + towerSequence + "\\d+$", "i");
  const codeMatches = realtimeRows.filter((row) =>
    codePattern.test(toTrimmedString(row?.drcode ?? row?.deviceCode ?? row?.drCode))
  );
  if (codeMatches.length > 0) {
    return codeMatches;
  }

  const namePrefix = towerSequence + "#";
  return realtimeRows.filter((row) => toTrimmedString(row?.drname ?? row?.deviceName).startsWith(namePrefix));
}

function buildCoolingTowerProxySnapshot(proxyRows, fallbackLatestUpdateAt = null) {
  if (!Array.isArray(proxyRows) || proxyRows.length === 0) {
    return null;
  }

  const snapshots = proxyRows.map((row) =>
    buildRuntimeSnapshot(getRuntimeRecords(row?.reglist), deriveRuntimeLatestUpdateAt(getRuntimeRecords(row?.reglist), row?.lastReportAt || null))
  );
  const runningCount = snapshots.filter((snapshot) => {
    if (isRunningText(snapshot.runStatusText)) {
      return true;
    }
    if (snapshot.runStatusText != null) {
      return false;
    }
    return snapshot.frequencyHz != null && snapshot.frequencyHz >= ACTIVE_FREQUENCY_FALLBACK_THRESHOLD_HZ;
  }).length;
  const explicitRunCount = snapshots.filter((snapshot) => snapshot.runStatusText != null).length;
  const alarmCount = snapshots.filter((snapshot) => isAlarmText(snapshot.alarmStatusText)).length;
  const explicitAlarmCount = snapshots.filter((snapshot) => snapshot.alarmStatusText != null).length;
  const latestUpdateAt = pickLatestIsoDateTime(
    [...snapshots.map((snapshot) => snapshot.latestUpdateAt), fallbackLatestUpdateAt],
    fallbackLatestUpdateAt
  );

  return {
    runStatusText:
      runningCount > 0
        ? "\u8fd0\u884c\u4e2d"
        : explicitRunCount > 0 && explicitRunCount === snapshots.length
          ? "\u5df2\u505c\u6b62"
          : null,
    alarmStatusText:
      alarmCount > 0
        ? "\u62a5\u8b66\u4e2d"
        : explicitAlarmCount > 0 && explicitAlarmCount === snapshots.length
          ? "\u6b63\u5e38"
          : null,
    latestUpdateAt,
    controlSignals: [],
    proxyRowsCount: proxyRows.length,
    runningCount
  };
}

async function loadDeviceCatalogRows(baseUrl, siteId, options = {}) {
  const endpoint = buildDeviceListEndpoint(siteId, options);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const rows = response.ok ? deepArrayProbe(response.payload) : [];
  return { endpoint, response, rows };
}

function deriveDeviceNodeStatus(runStatusText, alarmStatusText) {
  const alarmNumeric = toFiniteNumber(alarmStatusText);
  if (alarmNumeric != null) {
    return alarmNumeric > 0 ? "alarm" : "normal";
  }
  const runNumeric = toFiniteNumber(runStatusText);
  if (runNumeric != null) {
    return runNumeric > 0 ? "running" : "stopped";
  }
  if (isAlarmText(alarmStatusText)) {
    return "alarm";
  }
  if (isRunningText(runStatusText)) {
    return "running";
  }
  if (isStoppedText(runStatusText)) {
    return "stopped";
  }
  return "unknown";
}

function enrichRealtimeCollectionRow(row) {
  const runtimeRecords = getRuntimeRecords(row?.reglist);
  const snapshot = buildRuntimeSnapshot(runtimeRecords, null);

  return {
    ...row,
    status: deriveDeviceNodeStatus(snapshot.runStatusText, snapshot.alarmStatusText),
    lastReportAt: snapshot.latestUpdateAt
  };
}

function mergeCatalogRowsWithRealtime(catalogRows, realtimeRows) {
  if (!Array.isArray(catalogRows) || catalogRows.length === 0 || !Array.isArray(realtimeRows) || realtimeRows.length === 0) {
    return catalogRows;
  }

  const realtimeByDeviceId = new Map(
    realtimeRows.map((row) => [toTrimmedString(row?.drid ?? row?.deviceId ?? row?.id), row])
  );

  return catalogRows.map((row) => {
    const realtimeRow = realtimeByDeviceId.get(toTrimmedString(row?.drid ?? row?.deviceId ?? row?.id));
    if (!realtimeRow) {
      return row;
    }
    return {
      ...row,
      status: realtimeRow.status || row.status,
      lastReportAt: realtimeRow.lastReportAt || row.lastReportAt || null
    };
  });
}

function shouldTryRealtimeStatusFallback({ useRealtimeCollectionForTree, treeResponse, catalogRows }) {
  if (useRealtimeCollectionForTree) {
    return false;
  }
  if (!Array.isArray(catalogRows) || catalogRows.length === 0) {
    return false;
  }
  const treeUnavailable = !treeResponse || treeResponse.ok !== true;
  const statusAllUnknown = catalogRows.every((row) => toTrimmedString(row?.status).toLowerCase() === "unknown");
  return treeUnavailable || statusAllUnknown;
}

async function loadDeviceRealtimeCollectionRows(baseUrl, siteId, options = {}) {
  const endpoint = buildDeviceRealtimeCollectionEndpoint(siteId, options);
  if (!endpoint) {
    return null;
  }
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const rows = response.ok ? deepArrayProbe(response.payload).filter((item) => item && typeof item === "object") : [];
  return {
    endpoint,
    response,
    rows: rows.map(enrichRealtimeCollectionRow)
  };
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
        floor: item.floorName,
        typeName: item.deviceTypeName || item.usageType || null,
        code: item.deviceCode || null
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
    floor: row.floorName,
    typeName: row.deviceTypeName || row.usageType || row.rawTypeName || null,
    code: row.deviceCode || null
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
  const useRealtimeCollectionForTree = toTrimmedString(options.realtimeEndpointKind) === "legacy-reg-findAllByDrTypeId";
  const minQueryValue = useRealtimeCollectionForTree ? 0 : 1;
  const build = Number.isFinite(Number(options.build)) ? Math.max(minQueryValue, Number(options.build)) : 1;
  const floor = Number.isFinite(Number(options.floor)) ? Math.max(minQueryValue, Number(options.floor)) : 1;
  const mock = options.mock === true ? "true" : "false";
  const endpoint = `/api/device/${normalizeLegacyPath(siteId, options)}/data/tree?build=${build}&floor=${floor}&mock=${mock}`;
  const fetchedAt = new Date().toISOString();
  const [treeResponse, catalog, realtimeCollection] = await Promise.all([
    useRealtimeCollectionForTree ? Promise.resolve(null) : fetchLegacyJson(baseUrl, endpoint),
    loadDeviceCatalogRows(baseUrl, siteId, options),
    useRealtimeCollectionForTree ? loadDeviceRealtimeCollectionRows(baseUrl, siteId, options) : Promise.resolve(null)
  ]);
  let fallbackRealtimeCollection = null;
  const usePlaceholderFallback =
    options.placeholderFallback === true && catalog.response.ok && catalog.rows.length === 0;
  let mergedCatalogRows = useRealtimeCollectionForTree
    ? mergeCatalogRowsWithRealtime(catalog.rows, realtimeCollection?.rows || [])
    : catalog.rows;
  if (
    shouldTryRealtimeStatusFallback({
      useRealtimeCollectionForTree,
      treeResponse,
      catalogRows: mergedCatalogRows
    })
  ) {
    fallbackRealtimeCollection = await loadDeviceRealtimeCollectionRows(baseUrl, siteId, {
      ...options,
      realtimeEndpointKind: "legacy-reg-findAllByDrTypeId"
    });
    if (fallbackRealtimeCollection?.response?.ok && Array.isArray(fallbackRealtimeCollection.rows) && fallbackRealtimeCollection.rows.length > 0) {
      mergedCatalogRows = mergeCatalogRowsWithRealtime(mergedCatalogRows, fallbackRealtimeCollection.rows);
    }
  }
  const catalogRows = usePlaceholderFallback
    ? buildPlaceholderDeviceRows(siteId, {
        floorName: String(floor),
        buildingName: `濠德板€曢崥瀣偉?${build}`
      })
    : selectDisplayRows(mergedCatalogRows.map(normalizeDeviceRow));
  const catalogMap = buildDeviceCatalog(catalogRows);
  const normalizedTree = treeResponse?.ok
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
      : useRealtimeCollectionForTree
        ? realtimeCollection?.response?.ok
          ? realtimeCollection.rows.length > 0
            ? null
            : "Realtime collection payload unavailable"
          : realtimeCollection?.response?.error || "Realtime collection unavailable"
      : treeResponse.ok
        ? extractMessage(treeResponse.payload, "Legacy tree payload unavailable")
        : treeResponse.error;
  const treeMessage = treeHasDeviceNodes
    ? "OK"
    : useRealtimeCollectionForTree
      ? realtimeCollection?.response?.ok
        ? extractMessage(realtimeCollection.response.payload, "OK")
        : null
    : treeResponse.ok
      ? extractMessage(treeResponse.payload, "Legacy tree payload unavailable")
      : null;

  return {
    root,
    catalogRows,
    realtimeCollectionRows: realtimeCollection?.rows || fallbackRealtimeCollection?.rows || [],
    fetchedAt,
    filters: {
      build,
      floor
    },
    sourceStatus: {
      tree: {
        endpoint: useRealtimeCollectionForTree ? realtimeCollection?.endpoint || endpoint : endpoint,
        ok: useRealtimeCollectionForTree ? Boolean(realtimeCollection?.response?.ok && realtimeCollection.rows.length > 0) : treeHasDeviceNodes,
        status: useRealtimeCollectionForTree ? realtimeCollection?.response?.status ?? null : treeResponse.status ?? null,
        message: treeMessage,
        rows: useRealtimeCollectionForTree ? realtimeCollection?.rows?.length ?? null : treeHasDeviceNodes ? root?.childCount ?? null : null,
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
      runtime:
        fallbackRealtimeCollection?.endpoint
          ? {
              endpoint: fallbackRealtimeCollection.endpoint,
              ok: Boolean(fallbackRealtimeCollection?.response?.ok),
              status: fallbackRealtimeCollection?.response?.status ?? null,
              message: fallbackRealtimeCollection?.response?.ok
                ? extractMessage(fallbackRealtimeCollection.response.payload, "OK")
                : null,
              rows: Array.isArray(fallbackRealtimeCollection?.rows) ? fallbackRealtimeCollection.rows.length : null,
              error: fallbackRealtimeCollection?.response?.ok ? null : fallbackRealtimeCollection?.response?.error || null
            }
          : null,
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

async function resolveDeviceDetailFromTree(baseUrl, siteId, deviceId, tree, options = {}) {
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

  const normalizedRows = Array.isArray(tree.catalogRows) ? tree.catalogRows : [];
  const matched = normalizedRows.find((row) => row.deviceId === normalizedDeviceId) || null;
  const treeNode = findTreeNodeByDeviceId(tree.root, normalizedDeviceId);
  const realtimeCollectionRows = Array.isArray(tree.realtimeCollectionRows) ? tree.realtimeCollectionRows : [];
  const matchedRealtimeRow =
    realtimeCollectionRows.find((row) => toTrimmedString(row?.drid ?? row?.deviceId ?? row?.id) === normalizedDeviceId) || null;
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
  const runtimeSnapshot = buildRuntimeSnapshot(runtimeRecords, matched?.lastReportAt || null);
  const collectionSnapshot = matchedRealtimeRow
    ? buildRuntimeSnapshot(getRuntimeRecords(matchedRealtimeRow?.reglist), matchedRealtimeRow?.lastReportAt || null)
    : null;
  const coolingTowerProxyRows = findCoolingTowerProxyRows(realtimeCollectionRows, matched);
  const coolingTowerProxySnapshot =
    matched?.systemType === "coolingTower"
      ? buildCoolingTowerProxySnapshot(coolingTowerProxyRows, matched?.lastReportAt || null)
      : null;
  const proxyResolved =
    matched?.systemType === "coolingTower" &&
    !runtimeSnapshot.runStatusText &&
    !collectionSnapshot?.runStatusText &&
    Boolean(coolingTowerProxySnapshot?.runStatusText);
  const collectionResolved = !runtimeSnapshot.runStatusText && Boolean(collectionSnapshot?.runStatusText);
  const runStatusText =
    runtimeSnapshot.runStatusText ||
    collectionSnapshot?.runStatusText ||
    coolingTowerProxySnapshot?.runStatusText ||
    null;
  const alarmStatusText =
    runtimeSnapshot.alarmStatusText ||
    collectionSnapshot?.alarmStatusText ||
    coolingTowerProxySnapshot?.alarmStatusText ||
    null;
  const latestUpdateAt = pickLatestIsoDateTime(
    [
      runtimeSnapshot.latestUpdateAt,
      collectionSnapshot?.latestUpdateAt || null,
      coolingTowerProxySnapshot?.latestUpdateAt || null,
      matched?.lastReportAt || null
    ],
    matched?.lastReportAt || null
  );
  const controlSignals =
    runtimeSnapshot.controlSignals.length > 0
      ? runtimeSnapshot.controlSignals
      : collectionSnapshot?.controlSignals?.length > 0
        ? collectionSnapshot.controlSignals
        : [];
  const runtimeResolved = Boolean(runStatusText || alarmStatusText || controlSignals.length > 0 || latestUpdateAt);
  const runtimeSourceEndpoint = proxyResolved || collectionResolved
    ? tree.sourceStatus?.tree?.endpoint || runtimeEndpoint
    : runtimeEndpoint;
  const runtimeSourceMessage =
    matched?.isPlaceholder
      ? "Placeholder device has no runtime records"
      : proxyResolved
        ? `OK; cooling tower runtime mapped from ${coolingTowerProxySnapshot?.proxyRowsCount ?? 0} fan points`
        : collectionResolved
          ? "OK; runtime resolved from realtime collection"
          : runtime.ok && runtimeRecords.length > 0
            ? extractMessage(runtime.payload, "OK")
            : runtime.ok
              ? "No runtime records"
              : null;
  const runtimeSourceRows =
    proxyResolved
      ? coolingTowerProxySnapshot?.proxyRowsCount ?? null
      : collectionResolved
        ? collectionSnapshot?.recordCount ?? null
        : runtimeRecords.length;

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
          runStatusText: runStatusText || (matched.isPlaceholder ? "\u5360\u4f4d\u8bbe\u5907" : null),
          alarmStatusText: alarmStatusText || (matched.isPlaceholder ? "\u65e0\u5b9e\u65f6\u544a\u8b66" : null),
          latestUpdateAt,
          controlSignals,
          treeNodeType: treeNode?.nodeType || null,
          treeChildCount: treeNode?.childCount ?? null,
          pointCount: Array.isArray(treeNode?.children) ? treeNode.children.length : 0
        }
      : null,
    fetchedAt,
    sourceStatus: {
      catalog: tree.sourceStatus?.catalog || {
        endpoint: buildDeviceListEndpoint(siteId, options),
        ok: false,
        status: null,
        message: null,
        rows: normalizedRows.length,
        error: "Catalog source unavailable"
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
        endpoint: runtimeSourceEndpoint,
        ok: matched?.isPlaceholder ? true : runtimeResolved,
        status: runtime.status ?? null,
        message: runtimeSourceMessage,
        rows: runtimeSourceRows,
        error: matched?.isPlaceholder ? null : runtimeResolved ? null : runtime.error,
        fallback: proxyResolved || collectionResolved
      },
      placeholder: tree.sourceStatus?.placeholder || null
    }
  };
}

export async function loadDeviceDetail(baseUrl, siteId, deviceId, options = {}) {
  const tree = await loadDeviceTree(baseUrl, siteId, { ...options, placeholderFallback: true });
  return resolveDeviceDetailFromTree(baseUrl, siteId, deviceId, tree, options);
}

export async function loadDeviceDetails(baseUrl, siteId, deviceIds, options = {}) {
  const normalizedDeviceIds = Array.from(
    new Set(
      (Array.isArray(deviceIds) ? deviceIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
  const fetchedAt = new Date().toISOString();

  if (normalizedDeviceIds.length === 0) {
    return {
      fetchedAt,
      items: [],
      sourceStatus: null
    };
  }

  const tree = await loadDeviceTree(baseUrl, siteId, { ...options, placeholderFallback: true });
  const batchSize =
    Number.isFinite(Number(options.batchSize)) && Number(options.batchSize) > 0
      ? Math.max(1, Math.floor(Number(options.batchSize)))
      : 4;
  const items = [];

  for (let start = 0; start < normalizedDeviceIds.length; start += batchSize) {
    const batchDeviceIds = normalizedDeviceIds.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batchDeviceIds.map(async (deviceId) => ({
        deviceId,
        ...(await resolveDeviceDetailFromTree(baseUrl, siteId, deviceId, tree, options))
      }))
    );
    items.push(...batchResults);
  }

  return {
    fetchedAt,
    items,
    sourceStatus: tree.sourceStatus || null
  };
}
