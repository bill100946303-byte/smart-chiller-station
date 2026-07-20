import { fetchLegacyJson } from "../lib/http.js";

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function normalizeDateInput(value, fallback = formatDate(new Date())) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function normalizeDateTypeInput(value, fallback = "1") {
  const normalized = asTrimmedString(value, fallback);
  return ["1", "2", "3", "4"].includes(normalized) ? normalized : fallback;
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => asTrimmedString(item, "")).filter(Boolean)));
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
  }
  return [];
}

function toNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = asTrimmedString(value, "").replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCurveEndpoint(appId, date, dateType) {
  const search = new URLSearchParams();
  search.set("appId", appId);
  search.set("date", date);
  search.set("dateType", dateType);
  search.set("energyType", "1");
  return `/zsqy/energyanalysis/getEnergyAnalysisCurve?${search.toString()}`;
}

function buildEnergyTypeEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/Drtypeinfo/${projectKey}/findAllDrTypeAndDrEnergy?${search.toString()}`;
}

function buildEnergyDeviceEndpoint(projectKey, drtypeid, options = {}) {
  const search = new URLSearchParams();
  search.set("drtypeid", drtypeid);
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/drinfo/${projectKey}/findAll?${search.toString()}`;
}

function buildEnergyCurveByDrEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("startTime", asTrimmedString(options.startDate, ""));
  search.set("endTime", asTrimmedString(options.endDate, ""));
  search.set("drIds", asArray(options.drIds).map((item) => asTrimmedString(item, "")).filter(Boolean).join(","));
  search.set("dateType", normalizeDateTypeInput(options.dateType, "1"));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "KW"));
  search.set("modelKey", asTrimmedString(options.modelKey, projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/energyanalysis/${projectKey}/getEnergyAnalysisCurveByDr?${search.toString().replace(/%2C/g, ",")}`;
}

const CATEGORY_SPECS = [
  {
    key: "chiller",
    seriesId: "energy-analysis:chiller",
    categoryNodeId: "type:chiller",
    deviceNodeId: "device:chiller-total",
    deviceId: "chiller",
    categoryLabel: "冷水主机",
    deviceLabel: "CH总电量",
    upstreamNames: ["chiller", "冷水主机", "冷机", "冰机", "冷水主机电量", "CH电量"]
  },
  {
    key: "coolingTower",
    seriesId: "energy-analysis:cooling-tower",
    categoryNodeId: "type:cooling-tower",
    deviceNodeId: "device:cooling-tower-total",
    deviceId: "coolingTower",
    categoryLabel: "冷却塔",
    deviceLabel: "CT总电量",
    upstreamNames: ["coolingtower", "coolingtowerfan", "冷却塔", "冷却塔电量", "CT电量"]
  },
  {
    key: "chilledWaterPump",
    seriesId: "energy-analysis:chilled-water-pump",
    categoryNodeId: "type:chilled-water-pump",
    deviceNodeId: "device:chilled-water-pump-total",
    deviceId: "chilledWaterPump",
    categoryLabel: "冷冻泵",
    deviceLabel: "CHP总电量",
    upstreamNames: ["chilledwaterpump", "chilledpump", "冷冻泵", "冷冻水泵", "冷冻泵电量", "CHP电量"]
  },
  {
    key: "condenserWaterPump",
    seriesId: "energy-analysis:condenser-water-pump",
    categoryNodeId: "type:condenser-water-pump",
    deviceNodeId: "device:condenser-water-pump-total",
    deviceId: "condenserWaterPump",
    categoryLabel: "冷却泵",
    deviceLabel: "CWP总电量",
    upstreamNames: ["condenserwaterpump", "condenserpump", "冷却泵", "冷却水泵", "冷却泵电量", "CWP电量"]
  }
];

const CATEGORY_BY_KEY = new Map(CATEGORY_SPECS.map((item) => [item.key, item]));
const CATEGORY_BY_DEVICE_ID = new Map(CATEGORY_SPECS.map((item) => [item.deviceId, item]));
const CATEGORY_NAME_INDEX = new Map(
  CATEGORY_SPECS.flatMap((item) => item.upstreamNames.map((name) => [normalizeLookup(name), item]))
);

function normalizeLookup(value) {
  return asTrimmedString(value, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === "") {
    return [];
  }
  return [value];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getTypeId(row) {
  return asTrimmedString(row?.drtypeid ?? row?.drTypeId ?? row?.id, "");
}

function getDeviceId(row) {
  return asTrimmedString(row?.drid ?? row?.drId ?? row?.id, "");
}

function getLocalizedName(row, baseKey, language, fallback = "") {
  const normalizedLanguage = asTrimmedString(language, "zh").toLowerCase();
  const baseValue = asTrimmedString(row?.[baseKey], "");
  const englishValue = asTrimmedString(row?.[`${baseKey}EN`], "");
  const mixedValue = asTrimmedString(row?.[`${baseKey}CNEN`], "");
  if (normalizedLanguage === "en") {
    return englishValue || mixedValue || baseValue || fallback;
  }
  return baseValue || mixedValue || englishValue || fallback;
}

function extractEnergyTypeRootRows(payload) {
  const candidates = [
    payload?.data?.data,
    payload?.data,
    payload?.rows,
    payload?.list
  ];
  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((row) => isPlainObject(row) && getTypeId(row));
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

function extractChildTypeRows(row) {
  const nested = row?.drtypeinfoList ?? row?.children ?? row?.childList;
  const candidates = [
    nested?.drtypeinfoList,
    nested?.data,
    nested
  ];
  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((item) => isPlainObject(item) && getTypeId(item));
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

function flattenTypeRows(rows) {
  const flattened = [];
  const seen = new Set();
  function visit(row) {
    const typeId = getTypeId(row);
    if (!typeId || seen.has(typeId)) {
      return;
    }
    seen.add(typeId);
    flattened.push(row);
    extractChildTypeRows(row).forEach(visit);
  }
  rows.forEach(visit);
  return flattened;
}

function extractEnergyDeviceRows(payload) {
  const candidates = [
    payload?.data?.data,
    payload?.data,
    payload?.rows,
    payload?.list
  ];
  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((row) => isPlainObject(row) && getDeviceId(row));
    if (rows.length > 0) {
      return rows;
    }
  }
  return [];
}

function resolveCategorySpecFromTypeRow(row) {
  const code = normalizeLookup(row?.drTypeCode ?? row?.drtypecode ?? row?.typeCode);
  if (code.includes("chpe")) {
    return CATEGORY_BY_KEY.get("chilledWaterPump") || null;
  }
  if (code.includes("cwpe")) {
    return CATEGORY_BY_KEY.get("condenserWaterPump") || null;
  }
  if (code.includes("cte") || code === "ct" || code.startsWith("ct")) {
    return CATEGORY_BY_KEY.get("coolingTower") || null;
  }
  if (code.includes("che")) {
    return CATEGORY_BY_KEY.get("chiller") || null;
  }
  return resolveCategorySpec(row?.drtypename || row?.drtypenameEN || row?.drtypenameCNEN);
}

function countDeviceLeaves(nodes) {
  return nodes.reduce((total, node) => {
    if (node?.nodeType === "device") {
      return total + 1;
    }
    return total + countDeviceLeaves(node?.children || []);
  }, 0);
}

function buildCloudDeviceNode(row, parentNodeId, typeRow, language) {
  const rawDeviceId = getDeviceId(row);
  return {
    id: `energy-device:${getTypeId(typeRow)}:${rawDeviceId}`,
    label: getLocalizedName(row, "drname", language, rawDeviceId),
    nodeType: "device",
    parentId: parentNodeId,
    typeId: getTypeId(typeRow),
    typeLabel: getLocalizedName(typeRow, "drtypename", language, getTypeId(typeRow)),
    deviceId: rawDeviceId,
    deviceCount: 1,
    childCount: 0,
    children: []
  };
}

function buildCloudTypeNode(row, parentId, devicesByTypeId, language) {
  const typeId = getTypeId(row);
  const nodeId = `energy-type:${typeId}`;
  const typeChildren = extractChildTypeRows(row).map((child) => buildCloudTypeNode(child, nodeId, devicesByTypeId, language));
  const deviceChildren = (devicesByTypeId.get(typeId) || []).map((device) => buildCloudDeviceNode(device, nodeId, row, language));
  const children = [...typeChildren, ...deviceChildren];
  return {
    id: nodeId,
    label: getLocalizedName(row, "drtypename", language, typeId),
    nodeType: parentId ? "device_type" : "energy_category",
    parentId,
    typeId,
    typeLabel: getLocalizedName(row, "drtypename", language, typeId),
    deviceId: null,
    deviceCount: countDeviceLeaves(children),
    childCount: children.length,
    children
  };
}

function buildBuiltInTree() {
  const rootId = "energy-analysis:root";
  const children = CATEGORY_SPECS.map((item) => ({
    id: item.categoryNodeId,
    label: item.categoryLabel,
    nodeType: "device_type",
    parentId: rootId,
    typeId: item.key,
    typeLabel: item.categoryLabel,
    deviceId: null,
    deviceCount: 1,
    childCount: 1,
    children: [
      {
        id: item.deviceNodeId,
        label: item.deviceLabel,
        nodeType: "device",
        parentId: item.categoryNodeId,
        typeId: item.key,
        typeLabel: item.categoryLabel,
        deviceId: item.deviceId,
        deviceCount: 1,
        childCount: 0,
        children: []
      }
    ]
  }));

  return {
    items: [
      {
        id: rootId,
        label: "电量对象",
        nodeType: "energy_category",
        parentId: null,
        typeId: "energy-analysis",
        typeLabel: "电量对象",
        deviceId: null,
        deviceCount: children.length,
        childCount: children.length,
        children
      }
    ],
    sourceStatus: {
      tree: {
        key: "energyAnalysisTree",
        endpoint: "builtin://energy-analysis/tree",
        ok: true,
        status: 200,
        message: "Built-in energy-analysis category tree",
        rows: 1,
        interfaceKind: "bff-builtin",
        originLabel: "BFF built-in catalog"
      },
      devices: {
        key: "energyAnalysisDevices",
        endpoint: "builtin://energy-analysis/devices",
        ok: true,
        status: 200,
        message: "4 virtual category devices",
        rows: children.length,
        interfaceKind: "bff-builtin",
        originLabel: "BFF built-in devices"
      }
    }
  };
}

function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asTrimmedString(value, ""));
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function toUtcTimestamp(year, month, day, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

function fromUtcTimestamp(timestamp) {
  const date = new Date(timestamp);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes()
  };
}

function addUtcDays(value, offset) {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + offset);
  return formatDate(next);
}

function enumerateDays(startDate, endDate) {
  const items = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    items.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return items;
}

function enumerateMonthStarts(startDate, endDate) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  if (!start || !end) {
    return [];
  }

  const items = [];
  let year = start.year;
  let month = start.month;
  while (year < end.year || (year === end.year && month <= end.month)) {
    items.push(`${year}-${pad(month)}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return items;
}

function enumerateYearStarts(startDate, endDate) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  if (!start || !end) {
    return [];
  }

  const items = [];
  for (let year = start.year; year <= end.year; year += 1) {
    items.push(`${year}-01-01`);
  }
  return items;
}

function buildAppIdCandidates(siteId, options = {}) {
  const candidates = [];
  if (Array.isArray(options.appIdCandidates)) {
    candidates.push(...options.appIdCandidates);
  }
  if (typeof options.appId === "string") {
    candidates.push(options.appId);
  }
  candidates.push(siteId);
  return Array.from(new Set(candidates.map((item) => asTrimmedString(item, "")).filter(Boolean)));
}

function resolveCategorySpec(value) {
  if (!value) {
    return null;
  }
  return CATEGORY_NAME_INDEX.get(normalizeLookup(value)) || null;
}

function extractPointRows(item) {
  const nested =
    item?.curveValueList?.curveValueList ||
    item?.runParamsCurveVO?.curveValueList?.curveValueList ||
    item?.runParamsCurveVO?.curveValueList ||
    item?.curveValueList ||
    item?.data;
  return Array.isArray(nested) ? nested : [];
}

function extractSeriesRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const candidates = [
    payload?.data?.curveList,
    payload?.curveList,
    payload?.data?.data,
    payload?.data,
    payload
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    const matched = candidate.filter((item) => resolveCategorySpec(item?.title || item?.name || item?.objName));
    if (matched.length > 0) {
      return matched;
    }
    const curveRows = candidate.filter((item) => extractPointRows(item).length > 0);
    if (curveRows.length > 0) {
      return curveRows;
    }
  }

  return [];
}

function parseTimestampFromPoint(label, upstreamDateType, requestDate) {
  const requestParts = parseDateParts(requestDate);
  if (!requestParts) {
    return null;
  }
  const normalizedLabel = asTrimmedString(label, "");

  const fullDateTime = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+|T)(\d{1,2}):(\d{1,2})$/.exec(normalizedLabel);
  if (fullDateTime) {
    return toUtcTimestamp(
      Number(fullDateTime[1]),
      Number(fullDateTime[2]),
      Number(fullDateTime[3]),
      Number(fullDateTime[4]),
      Number(fullDateTime[5])
    );
  }

  const fullDate = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalizedLabel);
  if (fullDate) {
    return toUtcTimestamp(Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]));
  }

  if (upstreamDateType === "1") {
    const match = /^(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})$/.exec(normalizedLabel);
    if (match) {
      return toUtcTimestamp(
        requestParts.year,
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4])
      );
    }
  }

  if (upstreamDateType === "2") {
    const monthDayMatch = /^(\d{1,2})[-/](\d{1,2})$/.exec(normalizedLabel);
    if (monthDayMatch) {
      return toUtcTimestamp(requestParts.year, Number(monthDayMatch[1]), Number(monthDayMatch[2]));
    }
    const chineseMonthDayMatch = /^(\d{1,2})月(\d{1,2})日?$/.exec(normalizedLabel);
    if (chineseMonthDayMatch) {
      return toUtcTimestamp(requestParts.year, Number(chineseMonthDayMatch[1]), Number(chineseMonthDayMatch[2]));
    }
    const mojibakeDayMatch = /^(\d{1,2})/.exec(normalizedLabel);
    if (mojibakeDayMatch && /[\u53f7\ufffd]/.test(normalizedLabel)) {
      return toUtcTimestamp(requestParts.year, requestParts.month, Number(mojibakeDayMatch[1]));
    }
  }

  const fullMonthMatch = /^(\d{4})-(\d{1,2})$/.exec(normalizedLabel);
  if (fullMonthMatch) {
    return toUtcTimestamp(Number(fullMonthMatch[1]), Number(fullMonthMatch[2]), 1);
  }

  const monthMatch = /^(\d{1,2})(?:月|鏈)/.exec(normalizedLabel);
  if (monthMatch) {
    return toUtcTimestamp(requestParts.year, Number(monthMatch[1]), 1);
  }

  const yearMatch = /^(\d{4})/.exec(normalizedLabel);
  if (yearMatch) {
    return toUtcTimestamp(Number(yearMatch[1]), 1, 1);
  }

  return null;
}
function formatPointLabel(timestamp, dateType) {
  const parts = fromUtcTimestamp(timestamp);
  if (dateType === "1") {
    return `${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
  }
  if (dateType === "2") {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }
  if (dateType === "3") {
    return `${parts.year}-${pad(parts.month)}`;
  }
  return `${parts.year}`;
}

function isWithinQueryRange(timestamp, startDate, endDate, dateType) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  if (!start || !end || !Number.isFinite(timestamp)) {
    return false;
  }

  if (dateType === "1" || dateType === "2") {
    const startTs = toUtcTimestamp(start.year, start.month, start.day, 0, 0);
    const endTs = toUtcTimestamp(end.year, end.month, end.day, 23, 59);
    return timestamp >= startTs && timestamp <= endTs;
  }

  const value = fromUtcTimestamp(timestamp);
  const currentMonthKey = value.year * 100 + value.month;
  const startMonthKey = start.year * 100 + start.month;
  const endMonthKey = end.year * 100 + end.month;
  return currentMonthKey >= startMonthKey && currentMonthKey <= endMonthKey;
}

function trimTrailingHourlyTail(points) {
  const ordered = points
    .filter((point) => point && Number.isFinite(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  const lastValidIndex = ordered.reduce((winner, point, index) => (
    typeof point.value === "number" ? index : winner
  ), -1);
  if (lastValidIndex < 0) {
    return {
      points: [],
      trimmedTailCount: 0
    };
  }

  const hasPlaceholderTail = ordered.slice(lastValidIndex + 1).some((point) => point.value == null);
  const validPoints = ordered.filter((point) => typeof point.value === "number");
  if (!hasPlaceholderTail || validPoints.length < 3) {
    return {
      points: validPoints,
      trimmedTailCount: 0
    };
  }

  const lastPoint = validPoints.at(-1);
  const baselineValues = validPoints.slice(Math.max(0, validPoints.length - 4), -1).map((point) => point.value);
  if (baselineValues.length < 2) {
    return {
      points: validPoints,
      trimmedTailCount: 0
    };
  }
  const baseline = baselineValues.reduce((total, value) => total + value, 0) / baselineValues.length;
  if (!(baseline > 0) || !(lastPoint.value < baseline * 0.5)) {
    return {
      points: validPoints,
      trimmedTailCount: 0
    };
  }
  return {
    points: validPoints.slice(0, -1),
    trimmedTailCount: 1
  };
}

function buildSummary(spec, points, unit) {
  const numericPoints = points.filter((point) => typeof point.value === "number");
  if (numericPoints.length === 0) {
    return null;
  }
  const sumValue = numericPoints.reduce((total, point) => total + point.value, 0);
  const maxPoint = numericPoints.reduce((winner, point) => (point.value > winner.value ? point : winner), numericPoints[0]);
  const minPoint = numericPoints.reduce((winner, point) => (point.value < winner.value ? point : winner), numericPoints[0]);
  return {
    id: spec.seriesId,
    objectName: spec.categoryLabel,
    sumValue,
    maxValue: maxPoint.value,
    maxTime: maxPoint.label,
    minValue: minPoint.value,
    minTime: minPoint.label,
    average: sumValue / numericPoints.length,
    unit
  };
}

function normalizeSelectedDrIds(deviceIds) {
  return Array.from(
    new Set(
      deviceIds
        .map((deviceId) => {
          const normalized = asTrimmedString(deviceId, "");
          if (!normalized || normalized.includes(":") || CATEGORY_BY_DEVICE_ID.has(normalized)) {
            return "";
          }
          return normalized;
        })
        .map((deviceId) => asTrimmedString(deviceId, ""))
        .filter(Boolean)
    )
  );
}

function extractDeviceCurveRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const candidates = [
    payload?.data?.data,
    payload?.data,
    payload?.rows,
    payload?.list,
    payload
  ];
  for (const candidate of candidates) {
    const rows = asArray(candidate).filter((item) => isPlainObject(item));
    if (rows.some((row) => extractPointRows(row).length > 0 || row?.objName || row?.runParamsCurveVO)) {
      return rows;
    }
  }
  return [];
}

function hasExplicitZeroAggregate(row) {
  const numericValues = [
    row?.sumValue,
    row?.runParamsCurveVO?.title,
    row?.maxValue,
    row?.minValue,
    row?.average
  ]
    .map((value) => toNullableNumber(value))
    .filter((value) => typeof value === "number");

  return numericValues.length > 0 && numericValues.every((value) => value === 0);
}

function normalizeCurvePoints(row, dateType, startDate, endDate, options = {}) {
  const points = extractPointRows(row)
    .map((point, index) => {
      const rawLabel = asTrimmedString(point?.name ?? point?.label ?? point?.time ?? point?.x, `point-${index + 1}`);
      const rawValue = point?.value ?? point?.y;
      const parsedValue = toNullableNumber(rawValue);
      const timestamp = parseTimestampFromPoint(rawLabel, dateType, startDate);
      return {
        label: rawLabel,
        value:
          typeof parsedValue === "number"
            ? parsedValue
            : (options.treatEmptyValuesAsZero && asTrimmedString(rawValue, "") === "" ? 0 : null),
        timestamp
      };
    })
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  const uniqueByTs = new Map();
  for (const point of points) {
    if (!uniqueByTs.has(point.timestamp)) {
      uniqueByTs.set(point.timestamp, point);
    }
  }
  const filtered = Array.from(uniqueByTs.values()).filter((point) => isWithinQueryRange(point.timestamp, startDate, endDate, dateType));
  const cleaned =
    dateType === "1"
      ? trimTrailingHourlyTail(filtered)
      : {
          points: filtered.filter((point) => typeof point.value === "number"),
          trimmedTailCount: 0
        };
  const finalPoints =
    dateType === "4"
      ? aggregateByYear(cleaned.points)
      : cleaned.points.map((point) => ({
          label: formatPointLabel(point.timestamp, dateType),
          value: point.value,
          timestamp: point.timestamp
        }));
  return {
    points: finalPoints,
    trimmedTailCount: cleaned.trimmedTailCount
  };
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (typeof parsed === "number") {
      return parsed;
    }
  }
  return null;
}

function buildDeviceSummary(row, points, unit, index) {
  const numericPoints = points.filter((point) => typeof point.value === "number");
  if (numericPoints.length === 0) {
    return null;
  }
  const computedSum = numericPoints.reduce((total, point) => total + point.value, 0);
  const maxPoint = numericPoints.reduce((winner, point) => (point.value > winner.value ? point : winner), numericPoints[0]);
  const minPoint = numericPoints.reduce((winner, point) => (point.value < winner.value ? point : winner), numericPoints[0]);
  const objectName = asTrimmedString(row?.objName ?? row?.name ?? row?.runParamsCurveVO?.title, `device-${index + 1}`);
  return {
    id: asTrimmedString(row?.drid ?? row?.drId ?? row?.id, `energy-device:${index + 1}`),
    objectName,
    sumValue: firstNumber(row?.sumValue, row?.runParamsCurveVO?.title, computedSum),
    maxValue: firstNumber(row?.maxValue, maxPoint.value),
    maxTime: asTrimmedString(row?.maxTime, maxPoint.label),
    minValue: firstNumber(row?.minValue, minPoint.value),
    minTime: asTrimmedString(row?.minTime, minPoint.label),
    average: firstNumber(row?.average, computedSum / numericPoints.length),
    unit
  };
}

function aggregateByYear(points) {
  const buckets = new Map();
  for (const point of points) {
    if (typeof point.value !== "number" || !Number.isFinite(point.timestamp)) {
      continue;
    }
    const year = fromUtcTimestamp(point.timestamp).year;
    const bucket = buckets.get(year) || {
      timestamp: toUtcTimestamp(year, 1, 1),
      label: String(year),
      value: 0
    };
    bucket.value += point.value;
    buckets.set(year, bucket);
  }
  return Array.from(buckets.values()).sort((left, right) => left.timestamp - right.timestamp);
}

async function fetchCurveForRequest(baseUrl, appIdCandidates, date, upstreamDateType) {
  let selectedAppId = appIdCandidates[0] || "";
  let selectedEndpoint = buildCurveEndpoint(selectedAppId, date, upstreamDateType);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedRows = [];

  for (const appId of appIdCandidates) {
    const endpoint = buildCurveEndpoint(appId, date, upstreamDateType);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    const payload = response.ok && response.payload && typeof response.payload === "object" ? response.payload : null;
    const rows = payload ? extractSeriesRows(payload) : [];
    selectedAppId = appId;
    selectedEndpoint = endpoint;
    selectedResponse = response;
    selectedRows = rows;
    if (response.ok && rows.length > 0) {
      break;
    }
  }

  return {
    appId: selectedAppId,
    endpoint: selectedEndpoint,
    response: selectedResponse,
    rows: selectedRows
  };
}

function normalizeSelectedCategorySpecs(deviceIds) {
  const mapped = deviceIds
    .map((deviceId) => {
      const normalized = asTrimmedString(deviceId, "");
      const categoryKey = normalized.includes(":") ? normalized.split(":")[0] : normalized;
      return CATEGORY_BY_DEVICE_ID.get(normalized) || CATEGORY_BY_DEVICE_ID.get(categoryKey);
    })
    .filter(Boolean);
  return mapped.length > 0 ? mapped : CATEGORY_SPECS;
}

function hasSelectedCategoryIds(deviceIds) {
  return deviceIds.some((deviceId) => {
    const normalized = asTrimmedString(deviceId, "");
    const categoryKey = normalized.includes(":") ? normalized.split(":")[0] : normalized;
    return CATEGORY_BY_DEVICE_ID.has(normalized) || CATEGORY_BY_DEVICE_ID.has(categoryKey);
  });
}

function hasOnlySelectedCategoryIds(deviceIds) {
  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return false;
  }
  return deviceIds.every((deviceId) => {
    const normalized = asTrimmedString(deviceId, "");
    const categoryKey = normalized.includes(":") ? normalized.split(":")[0] : normalized;
    return CATEGORY_BY_DEVICE_ID.has(normalized) || CATEGORY_BY_DEVICE_ID.has(categoryKey);
  });
}

function normalizeCategoryCurvePoints(row) {
  return extractPointRows(row)
    .map((point, index) => {
      const value = toNullableNumber(point?.value ?? point?.y);
      return {
        label: asTrimmedString(point?.name ?? point?.label ?? point?.time ?? point?.x, `point-${index + 1}`),
        value
      };
    })
    .filter((point) => typeof point.value === "number");
}

function buildCategoryCurveRequests(startDate, endDate, dateType, options = {}) {
  if (dateType === "1") {
    return enumerateDays(startDate, endDate).map((date) => ({ date, fetchDate: date, upstreamDateType: "1" }));
  }
  if (dateType === "2") {
    return enumerateMonthStarts(startDate, endDate).map((date) => ({
      date,
      fetchDate: options.categoryQueryDateFormat === "month" ? date.slice(0, 7) : date,
      upstreamDateType: "2"
    }));
  }
  return enumerateYearStarts(startDate, endDate).map((date) => ({ date, fetchDate: date, upstreamDateType: "3" }));
}

async function loadEnergyAnalysisByCategory(baseUrl, siteId, options = {}, deviceIds = []) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const dateType = normalizeDateTypeInput(options.dateType, "1");
  const appIdCandidates = buildAppIdCandidates(siteId, options);
  const selectedCategorySpecs = normalizeSelectedCategorySpecs(deviceIds);
  const fetchedAt = new Date().toISOString();
  const requests = buildCategoryCurveRequests(startDate, endDate, dateType, options);
  const responses = [];
  for (const request of requests) {
    responses.push({
      ...request,
      ...(await fetchCurveForRequest(baseUrl, appIdCandidates, request.fetchDate, request.upstreamDateType))
    });
  }

  const rawSeriesByKey = new Map(selectedCategorySpecs.map((item) => [item.key, []]));
  const unitByKey = new Map();

  for (const response of responses) {
    response.rows.forEach((row, index) => {
      const spec =
        resolveCategorySpec(row?.title || row?.name || row?.objName)
        || selectedCategorySpecs[index]
        || CATEGORY_SPECS[index];
      if (!spec || !rawSeriesByKey.has(spec.key)) {
        return;
      }

      extractPointRows(row)
        .map((point, pointIndex) => {
          const rawLabel = asTrimmedString(point?.name ?? point?.label ?? point?.time ?? point?.x, `point-${pointIndex + 1}`);
          return {
            label: rawLabel,
            value: toNullableNumber(point?.value ?? point?.y),
            timestamp: parseTimestampFromPoint(rawLabel, response.upstreamDateType, response.date)
          };
        })
        .filter((point) => Number.isFinite(point.timestamp))
        .forEach((point) => rawSeriesByKey.get(spec.key).push(point));

      if (!unitByKey.has(spec.key)) {
        const unit = asTrimmedString(row?.unit ?? row?.runParamsCurveVO?.unit, "kWh");
        unitByKey.set(spec.key, unit || "kWh");
      }
    });
  }

  const summaries = [];
  const series = [];
  let trimmedTailCount = 0;

  for (const spec of selectedCategorySpecs) {
    const ordered = (rawSeriesByKey.get(spec.key) || []).sort((left, right) => left.timestamp - right.timestamp);
    const uniqueByTs = new Map();
    for (const point of ordered) {
      if (!uniqueByTs.has(point.timestamp)) {
        uniqueByTs.set(point.timestamp, point);
      }
    }
    const filtered = Array.from(uniqueByTs.values()).filter((point) =>
      isWithinQueryRange(point.timestamp, startDate, endDate, dateType)
    );
    const cleaned =
      dateType === "1"
        ? trimTrailingHourlyTail(filtered)
        : {
            points: filtered.filter((point) => typeof point.value === "number"),
            trimmedTailCount: 0
          };
    trimmedTailCount += cleaned.trimmedTailCount;

    const finalPoints =
      dateType === "4"
        ? aggregateByYear(cleaned.points)
        : cleaned.points.map((point) => ({
            label: formatPointLabel(point.timestamp, dateType),
            value: point.value,
            timestamp: point.timestamp
          }));

    if (finalPoints.length === 0) {
      continue;
    }
    const unit = unitByKey.get(spec.key) || "kWh";
    const summary = buildSummary(spec, finalPoints, unit);
    if (summary) {
      summaries.push(summary);
    }
    series.push({
      id: spec.seriesId,
      name: spec.categoryLabel,
      unit,
      points: finalPoints.map((point) => ({
        label: point.label,
        value: point.value
      }))
    });
  }

  const successfulResponses = responses.filter((item) => item.response.ok).length;
  const partial = successfulResponses > 0 && successfulResponses < responses.length;
  let totalPointCount = 0;
  series.forEach((item) => {
    totalPointCount += item.points?.length || 0;
  });

  const axisLabels = series.reduce((winner, item) => (
    (item.points?.length || 0) > winner.length ? (item.points || []).map((point) => point.label || "") : winner
  ), []);

  return {
    filters: {
      startDate,
      endDate,
      dateType,
      deviceIds
    },
    summaries,
    series,
    axisLabels,
    unit: series[0]?.unit || "kWh",
    latestTimestamp: fetchedAt,
    sourceStatus: {
      key: "energyAnalysisCurve",
      endpoint: "/zsqy/energyanalysis/getEnergyAnalysisCurve",
      ok: successfulResponses > 0,
      fallback: partial,
      status: successfulResponses > 0 ? 200 : responses.at(-1)?.response.status ?? null,
      message:
        successfulResponses > 0
          ? `requests=${responses.length}; ok=${successfulResponses}/${responses.length}; series=${series.length}; points=${totalPointCount}${trimmedTailCount > 0 ? `; tailTrimmed=${trimmedTailCount}` : ""}`
          : extractMessage(responses.at(-1)?.response?.payload, null),
      rows: totalPointCount,
      error:
        successfulResponses > 0
          ? null
          : responses.find((item) => item.response.error)?.response.error || "Energy analysis category curve unavailable",
      interfaceKind: "legacy-energy-analysis-category-curve",
      originLabel: "Legacy energy category curve"
    }
  };
}

function resolveEnergyTreeOptions(siteId, options = {}) {
  const projectKey = asTrimmedString(
    options.databaseKey || options.projectDatabaseKey || options.pathProjectKey,
    asTrimmedString(siteId, "")
  );
  return {
    projectKey,
    language: asTrimmedString(options.language, "zh"),
    unit: asTrimmedString(options.unit, "KW"),
    modelKey: asTrimmedString(options.modelKey || options.projectKey, projectKey),
    template: asTrimmedString(options.template, "1")
  };
}

async function loadCloudEnergyAnalysisTree(baseUrl, siteId, options = {}) {
  const treeOptions = resolveEnergyTreeOptions(siteId, options);
  const typeEndpoint = buildEnergyTypeEndpoint(treeOptions.projectKey, treeOptions);
  const typeResponse = await fetchLegacyJson(baseUrl, typeEndpoint);
  const typeRootRows = typeResponse.ok ? extractEnergyTypeRootRows(typeResponse.payload) : [];
  const typeRows = flattenTypeRows(typeRootRows);

  if (typeRows.length === 0) {
    const fallback = buildBuiltInTree();
    return {
      ...fallback,
      sourceStatus: {
        ...fallback.sourceStatus,
        tree: {
          key: "energyAnalysisTree",
          endpoint: typeEndpoint,
          ok: false,
          fallback: true,
          status: typeResponse.status,
          message: extractMessage(typeResponse.payload, null),
          rows: 0,
          error: typeResponse.error || "Energy analysis type tree unavailable",
          interfaceKind: "legacy-energy-analysis-type-tree",
          originLabel: "Legacy energy type tree"
        },
        devices: {
          ...fallback.sourceStatus.devices,
          fallback: true
        }
      }
    };
  }

  const deviceResponses = await Promise.all(
    typeRows.map(async (typeRow) => {
      const typeId = getTypeId(typeRow);
      const endpoint = buildEnergyDeviceEndpoint(treeOptions.projectKey, typeId, treeOptions);
      const response = await fetchLegacyJson(baseUrl, endpoint);
      const rows = response.ok ? extractEnergyDeviceRows(response.payload) : [];
      return {
        typeId,
        endpoint,
        response,
        rows
      };
    })
  );

  const devicesByTypeId = new Map();
  for (const item of deviceResponses) {
    devicesByTypeId.set(item.typeId, item.rows);
  }

  const items = typeRootRows.map((row) => buildCloudTypeNode(row, null, devicesByTypeId, treeOptions.language));
  const totalDevices = countDeviceLeaves(items);
  const okDeviceResponses = deviceResponses.filter((item) => item.response.ok);
  const failedDeviceResponse = deviceResponses.find((item) => !item.response.ok);
  const firstDeviceEndpoint = deviceResponses[0]?.endpoint || buildEnergyDeviceEndpoint(treeOptions.projectKey, "{drtypeid}", treeOptions);

  return {
    items,
    sourceStatus: {
      tree: {
        key: "energyAnalysisTree",
        endpoint: typeEndpoint,
        ok: typeResponse.ok,
        status: typeResponse.status,
        message: extractMessage(typeResponse.payload, `types=${typeRows.length}`),
        rows: typeRows.length,
        error: typeResponse.error,
        interfaceKind: "legacy-energy-analysis-type-tree",
        originLabel: "Legacy energy type tree"
      },
      devices: {
        key: "energyAnalysisDevices",
        endpoint: firstDeviceEndpoint,
        ok: okDeviceResponses.length > 0 || deviceResponses.length === 0,
        fallback: okDeviceResponses.length > 0 && okDeviceResponses.length < deviceResponses.length,
        status: okDeviceResponses.length > 0 ? 200 : failedDeviceResponse?.response.status ?? null,
        message: `requests=${deviceResponses.length}; ok=${okDeviceResponses.length}/${deviceResponses.length}; devices=${totalDevices}`,
        rows: totalDevices,
        error: okDeviceResponses.length > 0 ? null : failedDeviceResponse?.response.error || null,
        interfaceKind: "legacy-energy-analysis-devices",
        originLabel: "Legacy energy devices"
      }
    }
  };
}

export async function loadEnergyAnalysisTree(baseUrl, siteId, options = {}) {
  if (Object.keys(options || {}).length === 0) {
    return buildBuiltInTree();
  }
  return loadCloudEnergyAnalysisTree(baseUrl, siteId, options);
}

async function loadEnergyAnalysisByDr(baseUrl, siteId, options = {}, drIds = []) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const dateType = normalizeDateTypeInput(options.dateType, "1");
  const treeOptions = resolveEnergyTreeOptions(siteId, options);
  const fetchedAt = new Date().toISOString();
  const endpoint = buildEnergyCurveByDrEndpoint(treeOptions.projectKey, {
    ...treeOptions,
    startDate,
    endDate,
    dateType,
    drIds
  });
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const rows = response.ok ? extractDeviceCurveRows(response.payload) : [];
  const series = [];
  const summaries = [];
  let trimmedTailCount = 0;

  const entries = rows.map((row, index) => ({
    row,
    index,
    unit: asTrimmedString(row?.unit ?? row?.runParamsCurveVO?.unit, "kWh") || "kWh",
    normalized: normalizeCurvePoints(row, dateType, startDate, endDate),
    isExplicitZeroAggregate: hasExplicitZeroAggregate(row)
  }));
  const referencePoints = entries.reduce((winner, entry) => (
    entry.normalized.points.length > winner.length ? entry.normalized.points : winner
  ), []);

  entries.forEach((entry) => {
    const { row, index, unit, isExplicitZeroAggregate } = entry;
    let normalized = entry.normalized;
    if (normalized.points.length === 0 && isExplicitZeroAggregate) {
      normalized = referencePoints.length > 0
        ? {
            points: referencePoints.map((point) => ({
              ...point,
              value: 0
            })),
            trimmedTailCount: 0
          }
        : normalizeCurvePoints(row, dateType, startDate, endDate, {
            treatEmptyValuesAsZero: true
          });
    }
    trimmedTailCount += normalized.trimmedTailCount;
    if (normalized.points.length === 0) {
      return;
    }
    const summary = buildDeviceSummary(row, normalized.points, unit, index);
    if (summary) {
      summaries.push(summary);
    }
    const name = summary?.objectName || asTrimmedString(row?.objName ?? row?.runParamsCurveVO?.title, `device-${index + 1}`);
    series.push({
      id: summary?.id || `energy-device:${index + 1}`,
      name,
      unit,
      points: normalized.points.map((point) => ({
        label: point.label,
        value: point.value
      }))
    });
  });

  const axisLabels = series.reduce((winner, item) => (
    (item.points?.length || 0) > winner.length ? (item.points || []).map((point) => point.label || "") : winner
  ), []);
  const totalPointCount = series.reduce((total, item) => total + (item.points?.length || 0), 0);

  return {
    filters: {
      startDate,
      endDate,
      dateType,
      deviceIds: drIds
    },
    summaries,
    series,
    axisLabels,
    unit: series[0]?.unit || "kWh",
    latestTimestamp: fetchedAt,
    sourceStatus: {
      key: "energyAnalysisCurve",
      endpoint,
      ok: response.ok,
      status: response.status,
      message: response.ok
        ? `drIds=${drIds.length}; series=${series.length}; points=${totalPointCount}${trimmedTailCount > 0 ? `; tailTrimmed=${trimmedTailCount}` : ""}`
        : extractMessage(response.payload, null),
      rows: totalPointCount,
      error: response.ok ? null : response.error || "Energy analysis curve by device unavailable",
      interfaceKind: "legacy-energy-analysis-curve-by-dr",
      originLabel: "Legacy energy curve by device"
    }
  };
}

export async function loadEnergyAnalysis(baseUrl, siteId, options = {}) {
  const startDate = normalizeDateInput(options.startDate);
  const endDate = normalizeDateInput(options.endDate, startDate);
  const dateType = normalizeDateTypeInput(options.dateType, "1");
  const deviceIds = normalizeIdList(options.deviceIds);
  const selectedDrIds = normalizeSelectedDrIds(deviceIds);
  if (selectedDrIds.length > 0) {
    return loadEnergyAnalysisByDr(baseUrl, siteId, options, selectedDrIds);
  }
  if (hasOnlySelectedCategoryIds(deviceIds)) {
    return loadEnergyAnalysisByCategory(baseUrl, siteId, options, deviceIds);
  }
  const fetchedAt = new Date().toISOString();
  return {
    filters: {
      startDate,
      endDate,
      dateType,
      deviceIds: []
    },
    summaries: [],
    series: [],
    axisLabels: [],
    unit: "kWh",
    latestTimestamp: fetchedAt,
    sourceStatus: {
      key: "energyAnalysisCurve",
      endpoint: "/zsqy/energyanalysis/{key}/getEnergyAnalysisCurveByDr",
      ok: false,
      status: null,
      message: "No concrete energy device drIds selected",
      rows: 0,
      error: "Energy analysis requires selected device drIds",
      interfaceKind: "legacy-energy-analysis-curve-by-dr",
      originLabel: "Legacy energy curve by device"
    }
  };
}
