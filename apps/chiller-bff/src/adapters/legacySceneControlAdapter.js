import { deepArrayProbe, fetchLegacyJson, toIsoTimestamp } from "../lib/http.js";

function asTrimmedString(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

const MOJIBAKE_MARKERS = [
  "\ufffd",
  "\u9422",
  "\u9359",
  "\u509b",
  "\u669f",
  "\u6fb6",
  "\u93c8",
  "\u558e",
  "\u9350",
  "\u8bf2",
  "\u95b2",
  "\u69db",
  "\u7490",
  "\u59dd",
  "\u749e"
];

function scoreReadableText(value) {
  const text = asTrimmedString(value);
  if (!text) {
    return Number.POSITIVE_INFINITY;
  }
  const markerPenalty = MOJIBAKE_MARKERS.reduce(
    (total, marker) => total + (text.includes(marker) ? 100 : 0),
    0
  );
  const replacementPenalty = (text.match(/\ufffd/g) || []).length * 120;
  const cjkReward = (text.match(/[\u4e00-\u9fff]/g) || []).length * 2;
  return markerPenalty + replacementPenalty - cjkReward;
}

function pickReadableText(values, fallback = "") {
  const candidates = values
    .map((value, index) => ({
      text: asTrimmedString(value),
      score: scoreReadableText(value) + index * 0.01
    }))
    .filter((item) => item.text);
  if (candidates.length === 0) {
    return fallback;
  }
  candidates.sort((left, right) => left.score - right.score);
  return candidates[0].text || fallback;
}

function asNullableNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMessage(payload, fallback = null) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const raw = payload.msg ?? payload.message ?? payload.statusText;
  return raw == null ? fallback : String(raw);
}

function buildIdentifierCandidates(
  siteId,
  projectKey,
  projectKeyCandidates = [],
  databaseKey = "",
  databaseKeyCandidates = []
) {
  const dbCandidates = Array.isArray(databaseKeyCandidates) ? databaseKeyCandidates : [];
  const extraCandidates = Array.isArray(projectKeyCandidates) ? projectKeyCandidates : [];
  return Array.from(
    new Set(
      [...dbCandidates, databaseKey, ...extraCandidates, projectKey, siteId]
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )
  );
}

function normalizeCurvePoints(rows) {
  return rows
    .map((row, index) => {
      const label = asTrimmedString(
        row?.name ?? row?.time ?? row?.createTime ?? row?.savetime ?? row?.updateTime,
        `#${index + 1}`
      );
      const timestamp = toIsoTimestamp(
        row?.time ?? row?.name ?? row?.createTime ?? row?.savetime ?? row?.updateTime
      );
      const value = asNullableNumber(
        row?.value ?? row?.tagValue ?? row?.tagvalue ?? row?.metricValue ?? row?.val
      );
      return {
        label,
        timestamp,
        value,
        _index: index
      };
    })
    .filter((item) => item.value !== null)
    .sort((a, b) => {
      const at = a.timestamp ? Date.parse(a.timestamp) : Number.NaN;
      const bt = b.timestamp ? Date.parse(b.timestamp) : Number.NaN;
      if (Number.isFinite(at) && Number.isFinite(bt)) {
        return at - bt;
      }
      return a._index - b._index;
    })
    .map(({ _index, ...item }) => item);
}

function buildSceneLegacyTrendEndpoint(siteId, options) {
  const search = new URLSearchParams();
  if (options?.title) {
    search.set("title", options.title);
  }
  if (options?.tagname) {
    search.set("tagname", options.tagname);
  }
  if (options?.date) {
    search.set("date", options.date);
  }
  const suffix = search.toString();
  return `/zsqy/homepage/${siteId}/getRunParamsCurveByTagName${suffix ? `?${suffix}` : ""}`;
}

function buildSceneOnlineMonitorEndpoint(siteId) {
  return `/zsqy/monitor/${siteId}/getData`;
}

function buildSceneFloorModelsEndpoint(options = {}) {
  const search = new URLSearchParams();
  search.set("userId", asTrimmedString(options.userId));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "RT"));
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/manager/findAllFloorModel?${search.toString()}`;
}

function buildSceneDeviceParametersEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("userId", asTrimmedString(options.userId, "150"));
  search.set("drId", asTrimmedString(options.drId));
  search.set("isEnergy", "false");
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", asTrimmedString(options.unit, "RT"));
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/reg/${projectKey}/findRegBasicParametersByDrid?${search.toString()}`;
}

function buildSceneDeviceStandingBookEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  const drId = encodeURIComponent(asTrimmedString(options.drId));
  return `/zsqy/devicestandingbook/${projectKey}/findByDrId/${drId}?${search.toString()}`;
}

function buildSceneDeviceInfoSettingEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("drId", asTrimmedString(options.drId));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/drInfoSetting/${projectKey}/findByDrTypeIdAndDrId?${search.toString()}`;
}

function buildSceneDeviceInfoVisibilityEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("userId", asTrimmedString(options.userId, "150"));
  search.set("drId", asTrimmedString(options.drId));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/reg/${projectKey}/findDevice2DModelUrlByDrId?${search.toString()}`;
}

function buildSceneDeviceOperationRecordsEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("drid", asTrimmedString(options.drId));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/runrecords/${projectKey}/findByDrId?${search.toString()}`;
}

function buildSceneDeviceAlarmRecordsEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("drId", asTrimmedString(options.drId));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/qsAlarmlog/${projectKey}/findByDrId?${search.toString()}`;
}

function buildSceneDeviceCommandEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("userId", asTrimmedString(options.userId, "150"));
  search.set("appId", asTrimmedString(options.appId));
  search.set("drTypeId", asTrimmedString(options.drTypeId));
  search.set("drId", asTrimmedString(options.drId));
  search.set("msg", asTrimmedString(options.msg));
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/qstag/${projectKey}/doimplements?${search.toString()}`;
}

function buildSceneSubInfoEndpoint(projectKey, options = {}) {
  const search = new URLSearchParams();
  search.set("language", asTrimmedString(options.language, "zh"));
  search.set("unit", "KW");
  search.set("modelKey", asTrimmedString(options.projectKey));
  search.set("template", asTrimmedString(options.template, "1"));
  return `/zsqy/subinfo/${projectKey}/findAll?${search.toString()}`;
}

function normalizeSceneModelUrl(value) {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  return `http://${raw}`;
}

function normalizeSceneDeviceImageUrl(value, baseUrl = "") {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  try {
    const origin = new URL(baseUrl).origin;
    return new URL(raw, `${origin}/`).toString();
  } catch {
    return raw;
  }
}

function normalizeSceneFloorModelItem(row, parentKey = "") {
  if (!row || typeof row !== "object") {
    return null;
  }
  const key = asTrimmedString(row.key ?? row.modelKey ?? row.appKey);
  const model2dUrl = normalizeSceneModelUrl(row.model2dIp ?? row.model2DIp ?? row.model2dUrl ?? row.model2DUrl);
  const model3dUrl = normalizeSceneModelUrl(row.modelIp ?? row.model3dIp ?? row.model3DIp ?? row.modelUrl ?? row.model3DUrl);
  if (!key && !model2dUrl && !model3dUrl) {
    return null;
  }
  return {
    key,
    name: asTrimmedString(row.name ?? row.appName ?? row.appexplain ?? row.appExplain),
    parentKey,
    model2dUrl,
    model3dUrl
  };
}

function collectSceneFloorModelItems(input, bucket = [], parentKey = "") {
  if (!input) {
    return bucket;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectSceneFloorModelItems(item, bucket, parentKey));
    return bucket;
  }

  if (typeof input !== "object") {
    return bucket;
  }

  const item = normalizeSceneFloorModelItem(input, parentKey);
  const currentKey = item?.key || parentKey;
  if (item) {
    bucket.push(item);
  }

  const childLists = [
    input.appmanagerList,
    input.appManagerList,
    input.children,
    input.list
  ].filter(Boolean);
  childLists.forEach((children) => collectSceneFloorModelItems(children, bucket, currentKey));
  return bucket;
}

function extractSceneFloorModelRoot(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}

function findLatestTimestamp(points) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]?.timestamp) {
      return points[index].timestamp;
    }
  }
  return null;
}

function extractOnlineRoot(payload) {
  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload && typeof payload === "object" ? payload : {};
}

function parseEmbeddedJson(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || (!normalized.startsWith("{") && !normalized.startsWith("["))) {
    return null;
  }
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function extractSceneDeviceParameterRoot(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const embeddedData = parseEmbeddedJson(payload.data);
  if (embeddedData) {
    return embeddedData;
  }
  const embeddedResult = parseEmbeddedJson(payload.result);
  if (embeddedResult) {
    return embeddedResult;
  }
  return payload;
}

function extractScenePayloadDataObject(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const embeddedData = parseEmbeddedJson(payload.data);
  if (embeddedData && typeof embeddedData === "object" && !Array.isArray(embeddedData)) {
    return embeddedData;
  }
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}

function extractScenePayloadDataArray(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const embeddedData = parseEmbeddedJson(payload.data);
  if (Array.isArray(embeddedData)) {
    return embeddedData;
  }
  if (embeddedData && typeof embeddedData === "object") {
    return extractScenePayloadDataArray(embeddedData);
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.data && typeof payload.data === "object") {
    return extractScenePayloadDataArray(payload.data);
  }
  for (const key of ["list", "rows", "records", "items", "dataList"]) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }
  return [];
}

function hasSceneDeviceParameterShape(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }
  return Boolean(
    row.regId != null ||
      row.regid != null ||
      row.regNameCNEN != null ||
      row.regName != null ||
      row.regname != null ||
      row.qstagvalue != null ||
      row.tagValue != null ||
      row.newtagvalue != null ||
      row.regReadWrite != null
  );
}

function collectSceneDeviceParameterRows(input, inheritedGroupName = "", bucket = []) {
  if (!input) {
    return bucket;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectSceneDeviceParameterRows(item, inheritedGroupName, bucket));
    return bucket;
  }

  if (typeof input !== "object") {
    return bucket;
  }

  const groupName = pickReadableText(
    [input.groupNameCNEN, input.groupName, input.groupname, input.group, input.name],
    inheritedGroupName
  );
  if (hasSceneDeviceParameterShape(input)) {
    bucket.push({
      ...input,
      groupName: pickReadableText([input.groupNameCNEN, input.groupName, input.groupname], groupName)
    });
  }

  const childKeys = [
    "data",
    "data1",
    "data2",
    "data3",
    "records",
    "rows",
    "list",
    "result",
    "children",
    "reglist",
    "regList",
    "basicParameters",
    "parameters",
    "items"
  ];
  childKeys.forEach((key) => {
    const children = input[key];
    if (children && typeof children === "object") {
      collectSceneDeviceParameterRows(children, groupName, bucket);
    }
  });
  return bucket;
}

function buildSceneSubInfoLookupKey(subId, value) {
  const normalizedSubId = asTrimmedString(subId);
  const normalizedValue = asTrimmedString(value);
  return normalizedSubId && normalizedValue ? `${normalizedSubId}${normalizedValue}` : "";
}

function buildSceneSubInfoValueCandidates(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return [];
  }
  const candidates = [normalized];
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    candidates.push(String(numeric));
    if (Number.isInteger(numeric)) {
      candidates.push(`${numeric}.0`);
    }
  }
  return Array.from(new Set(candidates));
}

function normalizeSceneSubInfoDictionary(payload) {
  const rows = deepArrayProbe(payload).filter((row) => row && typeof row === "object");
  const dictionary = new Map();
  rows.forEach((row) => {
    const subId = asTrimmedString(row.subid ?? row.subId ?? row.id);
    const value = asTrimmedString(row.value ?? row.subValue ?? row.val);
    const text = pickReadableText(
      [row.textCNEN, row.textCnEn, row.textCN, row.textCn, row.text, row.name, row.label],
      ""
    );
    if (!subId || !value || !text) {
      return;
    }
    dictionary.set(buildSceneSubInfoLookupKey(subId, value), text);
  });
  return dictionary;
}

function normalizeSceneSubInfoOptionMap(payload) {
  const rows = deepArrayProbe(payload).filter((row) => row && typeof row === "object");
  const optionMap = new Map();
  rows.forEach((row) => {
    const subId = asTrimmedString(row.subid ?? row.subId ?? row.id);
    const value = asTrimmedString(row.value ?? row.subValue ?? row.val);
    const text = pickReadableText(
      [row.textCNEN, row.textCnEn, row.textCN, row.textCn, row.text, row.name, row.label],
      ""
    );
    if (!subId || !value || !text) {
      return;
    }
    if (!optionMap.has(subId)) {
      optionMap.set(subId, []);
    }
    const options = optionMap.get(subId);
    const dedupeKey = `${value}::${text}`;
    if (!options.some((item) => `${item.value}::${item.text}` === dedupeKey)) {
      options.push({ value, text });
    }
  });
  return optionMap;
}

function resolveSceneSubInfoDisplayValue(row, rawValue, subInfoDictionary) {
  const regSub = asTrimmedString(row?.regSub ?? row?.regsub ?? row?.subid ?? row?.subId);
  if (!regSub || !subInfoDictionary || subInfoDictionary.size === 0) {
    return "";
  }
  for (const valueCandidate of buildSceneSubInfoValueCandidates(rawValue)) {
    const translated = subInfoDictionary.get(buildSceneSubInfoLookupKey(regSub, valueCandidate));
    if (translated) {
      return translated;
    }
  }
  return "";
}

function normalizeSceneDeviceParameterItem(row, index, subInfoDictionary = new Map(), subInfoOptionMap = new Map()) {
  const readWrite = asTrimmedString(row?.regReadWrite ?? row?.readWrite ?? row?.rw);
  const value = asTrimmedString(
    row?.qstagvalue ??
      row?.newtagvalue ??
      row?.tagValue ??
      row?.tagvalue ??
      row?.showStatus ??
      row?.value ??
      row?.val,
    "--"
  );
  const unit = asTrimmedString(row?.regUnits ?? row?.unit ?? row?.units);
  const regSub = asTrimmedString(row?.regSub ?? row?.regsub ?? row?.subid ?? row?.subId);
  const translatedValue = resolveSceneSubInfoDisplayValue(row, value, subInfoDictionary);
  const label = pickReadableText(
    [row?.regNameCNEN, row?.regName, row?.regname, row?.tagName, row?.name],
    `\u53c2\u6570 ${index + 1}`
  );
  return {
    id: asTrimmedString(row?.regId ?? row?.regid ?? row?.id, `reg-${index + 1}`),
    groupName: pickReadableText(
      [row?.groupNameCNEN, row?.groupName, row?.groupname],
      "\u672a\u5206\u7ec4"
    ),
    label,
    value,
    unit,
    displayValue: translatedValue || (unit && value !== "--" ? `${value} ${unit}` : value),
    regSub,
    regName: pickReadableText([row?.regNameCNEN, row?.regName, row?.regname], label),
    tagName: asTrimmedString(row?.tagName ?? row?.tagname ?? row?.tag ?? row?.code),
    drTypeId: asTrimmedString(row?.drTypeId ?? row?.drtypeid ?? row?.drtypeId ?? row?.typeId),
    controlOptions: regSub ? (subInfoOptionMap.get(regSub) || []) : [],
    readWrite,
    writable: readWrite === "2" || readWrite === "3",
    raw: row
  };
}

function normalizeSceneDeviceInfoItem(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const name = pickReadableText(
    [
      row.nameCNEN,
      row.nameCnEn,
      row.nameCN,
      row.nameCn,
      row.name,
      row.label,
      row.title,
      row.keyName,
      row.paramName,
      row.parameterName,
      row.fieldName,
      row.itemName,
      row.regNameCNEN,
      row.regName,
      row.regname,
      row.tagName,
      row.tagname,
      row.displayName
    ],
    `\u9879\u76ee ${index + 1}`
  );
  const value = asTrimmedString(
    row.tagValue ??
      row.tagvalue ??
      row.qstagvalue ??
      row.newtagvalue ??
      row.value ??
      row.val ??
      row.fieldValue ??
      row.itemValue ??
      row.dataValue ??
      row.showValue ??
      row.showStatus ??
      row.content ??
      row.text,
    "--"
  );
  const unit = asTrimmedString(row.units ?? row.unit ?? row.regUnits ?? row.regunits ?? row.unitName);
  if (!name && !value) {
    return null;
  }
  return { name, value, unit };
}

function readSceneInfoArray(root, keys) {
  if (!root || typeof root !== "object") {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(root[key])) {
      return root[key];
    }
    if (root[key] && typeof root[key] === "object") {
      return [root[key]];
    }
  }
  return [];
}

function hasSceneDeviceInfoItemShape(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }
  return Boolean(
    row.name != null ||
      row.nameCNEN != null ||
      row.nameCnEn != null ||
      row.nameCN != null ||
      row.label != null ||
      row.keyName != null ||
      row.paramName != null ||
      row.parameterName != null ||
      row.fieldName != null ||
      row.itemName != null ||
      row.regNameCNEN != null ||
      row.regName != null ||
      row.regname != null ||
      row.tagName != null ||
      row.tagname != null
  );
}

function readSceneStandingBookRows(root) {
  if (!root || typeof root !== "object") {
    return [];
  }
  const keys = [
    "data",
    "dataList",
    "list",
    "rows",
    "records",
    "items",
    "standingItems",
    "standingBookList",
    "deviceStandingBookList",
    "params",
    "parameters"
  ];
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (hasSceneDeviceInfoItemShape(value)) {
      return [value];
    }
  }
  return deepArrayProbe(root).filter(hasSceneDeviceInfoItemShape);
}

function flattenSceneInfoRows(value, nestedKeys = []) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenSceneInfoRows(item, nestedKeys));
  }
  if (typeof value !== "object") {
    return [];
  }
  const nestedRows = nestedKeys.flatMap((key) => flattenSceneInfoRows(value[key], nestedKeys));
  return nestedRows.length > 0 ? nestedRows : [value];
}

function hasSceneInfoSettingGroupShape(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }
  return Boolean(
    row.index != null ||
      row.idx != null ||
      row.position != null ||
      row.pos != null ||
      row.location != null ||
      row.title != null ||
      row.titleCNEN != null ||
      row.titleCN != null ||
      row.groupName != null ||
      row.formItem != null ||
      row.formitem != null ||
      row.formItems != null ||
      row.formItemList != null
  );
}

function collectSceneInfoSettingGroups(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSceneInfoSettingGroups(item));
  }
  if (typeof value !== "object") {
    return [];
  }
  if (hasSceneInfoSettingGroupShape(value)) {
    return [value];
  }
  return [
    "data",
    "dataList",
    "list",
    "rows",
    "records",
    "items",
    "settingList",
    "drInfoSettingList"
  ].flatMap((key) => collectSceneInfoSettingGroups(value[key]));
}

function normalizeSceneDeviceStandingBook(payload, baseUrl = "") {
  const root = extractScenePayloadDataObject(payload);
  if (!root || typeof root !== "object") {
    return {
      imageUrl: "",
      load: "",
      runStatus: "",
      standingItems: []
    };
  }
  const rows = readSceneStandingBookRows(root);
  return {
    imageUrl: normalizeSceneDeviceImageUrl(
      root.deviceImg ?? root.deviceImage ?? root.img ?? root.image,
      baseUrl
    ),
    load: asTrimmedString(root.load ?? root.loadRate ?? root.loadingRate),
    runStatus: asTrimmedString(root.runStatus ?? root.runningStatus),
    standingItems: rows
      .map((row, index) => normalizeSceneDeviceInfoItem(row, index))
      .filter(Boolean)
  };
}

function normalizeSceneDeviceInfoSetting(payload) {
  const root = extractScenePayloadDataObject(payload);
  if (!root || typeof root !== "object") {
    return [];
  }
  const rows = collectSceneInfoSettingGroups(root);
  const layoutRows = rows.length > 0
    ? rows
    : deepArrayProbe(root).filter(hasSceneInfoSettingGroupShape);
  return layoutRows
    .map((row) => {
      const rawIndex = row.index ?? row.idx ?? row.position ?? row.pos ?? row.location;
      const index = Number(asTrimmedString(rawIndex));
      const title = pickReadableText(
        [row.titleCNEN, row.titleCnEn, row.titleCN, row.title, row.groupNameCNEN, row.groupName, row.name],
        ""
      );
      const formItems = readSceneInfoArray(row, [
        "formItem",
        "formitem",
        "formItems",
        "formItemList",
        "formList",
        "fields",
        "fieldList",
        "items",
        "children",
        "data"
      ]);
      const normalizedFormItems = flattenSceneInfoRows(formItems, [
        "formItem",
        "formitem",
        "formItems",
        "formItemList",
        "formList",
        "fields",
        "fieldList",
        "items",
        "children",
        "data"
      ]);
      const normalizedItems = normalizedFormItems
        .map((item, itemIndex) => normalizeSceneDeviceInfoItem(item, itemIndex))
        .filter(Boolean);
      return {
        index: Number.isFinite(index) ? index : 0,
        title,
        items: normalizedItems
      };
    })
    .filter((group) => group.items.length > 0);
}

function normalizeSceneDeviceInfoVisibility(payload) {
  const root = extractScenePayloadDataObject(payload);
  const rawValue = asTrimmedString(
    root?.isShowDrInfo ?? root?.isShowdrinfo ?? root?.isShowDrinfo ?? root?.showDrInfo ?? root?.showDeviceInfo,
    ""
  );
  if (rawValue === "0") {
    return {
      visible: false,
      isShowDrInfo: rawValue
    };
  }
  if (rawValue === "1") {
    return {
      visible: true,
      isShowDrInfo: rawValue
    };
  }
  return {
    visible: true,
    isShowDrInfo: rawValue
  };
}

function normalizeSceneDeviceOperationRecords(payload) {
  return extractScenePayloadDataArray(payload)
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => ({
      id: asTrimmedString(row.id ?? row.recordId ?? row.runRecordId, `operation-${index + 1}`),
      details: asTrimmedString(row.details ?? row.detail ?? row.operationContent ?? row.content, "--"),
      operationResult: asTrimmedString(row.operationResult ?? row.result ?? row.status, "--"),
      operationPerson: asTrimmedString(row.operationPerson ?? row.person ?? row.operator ?? row.username, "--"),
      date: asTrimmedString(row.date ?? row.time ?? row.createTime ?? row.savetime ?? row.updateTime, "--")
    }));
}

function normalizeSceneDeviceAlarmRecords(payload) {
  return extractScenePayloadDataArray(payload)
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => ({
      id: asTrimmedString(row.id ?? row.alarmId ?? row.regId, `alarm-${index + 1}`),
      alarmTypeName: pickReadableText([row.alarmtypename, row.alarmTypeName, row.alarmtypeName], "--"),
      alarmState: asTrimmedString(row.alarmstate ?? row.alarmState, ""),
      alarmExplain: asTrimmedString(row.alarmexplain ?? row.alarmExplain ?? row.explain ?? row.content, "--"),
      time: asTrimmedString(row.time ?? row.alarmTime ?? row.createTime ?? row.savetime, "--")
    }));
}

function groupSceneDeviceParameters(items) {
  const groupMap = new Map();
  items.forEach((item) => {
    const groupName = item.groupName || "\u672a\u5206\u7ec4";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName).push(item);
  });
  return Array.from(groupMap.entries()).map(([groupName, groupItems]) => ({
    groupName,
    items: groupItems
  }));
}

export async function loadSceneLegacyTrend(baseUrl, siteId, options = {}) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  let selectedEndpoint = buildSceneLegacyTrendEndpoint(siteId, options);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let rows = [];

  for (const identifier of identifiers) {
    const endpoint = buildSceneLegacyTrendEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedEndpoint = endpoint;
    selectedResponse = response;
    rows = response.ok ? deepArrayProbe(response.payload) : [];
    if (response.ok) {
      break;
    }
  }

  const points = selectedResponse.ok ? normalizeCurvePoints(rows) : [];
  const firstRow = rows.find((row) => row && typeof row === "object") || null;

  return {
    title: asTrimmedString(options.title || firstRow?.tagName || firstRow?.title || firstRow?.name, ""),
    unit: asTrimmedString(options.unit || firstRow?.unit || firstRow?.units, null),
    filters: {
      tagname: asTrimmedString(options.tagname, ""),
      title: asTrimmedString(options.title, ""),
      date: asTrimmedString(options.date, "")
    },
    points,
    latestTimestamp: findLatestTimestamp(points),
    sourceStatus: {
      endpoint: selectedEndpoint,
      ok: selectedResponse.ok,
      status: selectedResponse.status ?? null,
      message: selectedResponse.ok ? extractMessage(selectedResponse.payload, "OK") : null,
      error: selectedResponse.ok ? null : selectedResponse.error,
      rows: rows.length
    }
  };
}

export async function loadSceneOnlineMonitor(baseUrl, siteId, options = {}) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  let selectedEndpoint = buildSceneOnlineMonitorEndpoint(siteId);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };

  for (const identifier of identifiers) {
    const endpoint = buildSceneOnlineMonitorEndpoint(identifier);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedEndpoint = endpoint;
    selectedResponse = response;
    if (response.ok) {
      break;
    }
  }

  const root = selectedResponse.ok ? extractOnlineRoot(selectedResponse.payload) : {};
  const rows = selectedResponse.ok
    ? deepArrayProbe(root?.curveValueList ? { data: root.curveValueList } : root)
    : [];
  const points = selectedResponse.ok ? normalizeCurvePoints(rows) : [];

  return {
    title: asTrimmedString(root?.title, ""),
    unit: asTrimmedString(root?.unit, ""),
    points,
    latestTimestamp: findLatestTimestamp(points),
    sourceStatus: {
      endpoint: selectedEndpoint,
      ok: selectedResponse.ok,
      status: selectedResponse.status ?? null,
      message: selectedResponse.ok ? extractMessage(selectedResponse.payload, "OK") : null,
      error: selectedResponse.ok ? null : selectedResponse.error,
      rows: rows.length
    }
  };
}

export async function loadSceneFloorModels(baseUrl, options = {}) {
  const endpoint = buildSceneFloorModelsEndpoint(options);
  const response = await fetchLegacyJson(baseUrl, endpoint);
  const root = response.ok ? extractSceneFloorModelRoot(response.payload) : [];
  const rawItems = response.ok ? collectSceneFloorModelItems(root) : [];
  const seen = new Set();
  const items = rawItems.filter((item) => {
    const dedupeKey = `${item.key}::${item.model2dUrl}::${item.model3dUrl}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });

  return {
    items,
    sourceStatus: {
      endpoint,
      ok: response.ok,
      status: response.status ?? null,
      message: response.ok ? extractMessage(response.payload, "OK") : null,
      error: response.ok ? null : response.error,
      rows: items.length
    }
  };
}

export async function loadSceneDeviceParameters(baseUrl, siteId, options = {}) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  let selectedEndpoint = buildSceneDeviceParametersEndpoint(identifiers[0] || siteId, options);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedSubInfoEndpoint = buildSceneSubInfoEndpoint(identifiers[0] || siteId, options);
  let selectedSubInfoResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedStandingBookEndpoint = buildSceneDeviceStandingBookEndpoint(identifiers[0] || siteId, options);
  let selectedStandingBookResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedInfoSettingEndpoint = buildSceneDeviceInfoSettingEndpoint(identifiers[0] || siteId, options);
  let selectedInfoSettingResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedInfoVisibilityEndpoint = buildSceneDeviceInfoVisibilityEndpoint(identifiers[0] || siteId, options);
  let selectedInfoVisibilityResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedOperationRecordsEndpoint = buildSceneDeviceOperationRecordsEndpoint(identifiers[0] || siteId, options);
  let selectedOperationRecordsResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let selectedAlarmRecordsEndpoint = buildSceneDeviceAlarmRecordsEndpoint(identifiers[0] || siteId, options);
  let selectedAlarmRecordsResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };
  let subInfoDictionary = new Map();
  let subInfoOptionMap = new Map();

  for (const identifier of identifiers) {
    const endpoint = buildSceneSubInfoEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedSubInfoEndpoint = endpoint;
    selectedSubInfoResponse = response;
    if (response.ok) {
      subInfoDictionary = normalizeSceneSubInfoDictionary(response.payload);
      subInfoOptionMap = normalizeSceneSubInfoOptionMap(response.payload);
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceParametersEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedEndpoint = endpoint;
    selectedResponse = response;
    if (response.ok) {
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceInfoVisibilityEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedInfoVisibilityEndpoint = endpoint;
    selectedInfoVisibilityResponse = response;
    if (response.ok) {
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceStandingBookEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedStandingBookEndpoint = endpoint;
    selectedStandingBookResponse = response;
    if (response.ok) {
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceInfoSettingEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedInfoSettingEndpoint = endpoint;
    selectedInfoSettingResponse = response;
    if (response.ok) {
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceOperationRecordsEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedOperationRecordsEndpoint = endpoint;
    selectedOperationRecordsResponse = response;
    if (response.ok) {
      break;
    }
  }

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceAlarmRecordsEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedAlarmRecordsEndpoint = endpoint;
    selectedAlarmRecordsResponse = response;
    if (response.ok) {
      break;
    }
  }

  const root = selectedResponse.ok ? extractSceneDeviceParameterRoot(selectedResponse.payload) : null;
  const probeRows = selectedResponse.ok ? collectSceneDeviceParameterRows(root) : [];
  const fallbackRows = selectedResponse.ok && probeRows.length === 0
    ? deepArrayProbe(root).filter(hasSceneDeviceParameterShape)
    : [];
  const items = (probeRows.length > 0 ? probeRows : fallbackRows).map((row, index) =>
    normalizeSceneDeviceParameterItem(row, index, subInfoDictionary, subInfoOptionMap)
  );
  const deviceName = pickReadableText(
    items.flatMap((item) => [item.raw?.drnameCNEN, item.raw?.drname, item.raw?.deviceName]),
    ""
  );
  const groups = groupSceneDeviceParameters(items);
  const controlGroups = groupSceneDeviceParameters(items.filter((item) => item.writable));
  const standingBook = selectedStandingBookResponse.ok
    ? normalizeSceneDeviceStandingBook(selectedStandingBookResponse.payload, baseUrl)
    : normalizeSceneDeviceStandingBook(null, baseUrl);
  const layoutGroups = selectedInfoSettingResponse.ok
    ? normalizeSceneDeviceInfoSetting(selectedInfoSettingResponse.payload)
    : [];
  const infoVisibility = selectedInfoVisibilityResponse.ok
    ? normalizeSceneDeviceInfoVisibility(selectedInfoVisibilityResponse.payload)
    : normalizeSceneDeviceInfoVisibility(null);
  const operationRecords = selectedOperationRecordsResponse.ok
    ? normalizeSceneDeviceOperationRecords(selectedOperationRecordsResponse.payload)
    : [];
  const alarmRecords = selectedAlarmRecordsResponse.ok
    ? normalizeSceneDeviceAlarmRecords(selectedAlarmRecordsResponse.payload)
    : [];

  return {
    drId: asTrimmedString(options.drId),
    deviceName,
    deviceInfo: {
      ...standingBook,
      ...infoVisibility,
      layoutGroups
    },
    groups,
    controlGroups,
    items,
    operationRecords,
    alarmRecords,
    sourceStatus: {
      endpoint: selectedEndpoint,
      ok: selectedResponse.ok,
      status: selectedResponse.status ?? null,
      message: selectedResponse.ok ? extractMessage(selectedResponse.payload, "OK") : null,
      error: selectedResponse.ok ? null : selectedResponse.error,
      rows: items.length
    },
    standingBookSourceStatus: {
      endpoint: selectedStandingBookEndpoint,
      ok: selectedStandingBookResponse.ok,
      status: selectedStandingBookResponse.status ?? null,
      message: selectedStandingBookResponse.ok ? extractMessage(selectedStandingBookResponse.payload, "OK") : null,
      error: selectedStandingBookResponse.ok ? null : selectedStandingBookResponse.error,
      rows: standingBook.standingItems.length
    },
    infoSettingSourceStatus: {
      endpoint: selectedInfoSettingEndpoint,
      ok: selectedInfoSettingResponse.ok,
      status: selectedInfoSettingResponse.status ?? null,
      message: selectedInfoSettingResponse.ok ? extractMessage(selectedInfoSettingResponse.payload, "OK") : null,
      error: selectedInfoSettingResponse.ok ? null : selectedInfoSettingResponse.error,
      rows: layoutGroups.reduce((total, group) => total + group.items.length, 0)
    },
    infoVisibilitySourceStatus: {
      endpoint: selectedInfoVisibilityEndpoint,
      ok: selectedInfoVisibilityResponse.ok,
      status: selectedInfoVisibilityResponse.status ?? null,
      message: selectedInfoVisibilityResponse.ok ? extractMessage(selectedInfoVisibilityResponse.payload, "OK") : null,
      error: selectedInfoVisibilityResponse.ok ? null : selectedInfoVisibilityResponse.error,
      rows: selectedInfoVisibilityResponse.ok ? 1 : 0
    },
    subInfoSourceStatus: {
      endpoint: selectedSubInfoEndpoint,
      ok: selectedSubInfoResponse.ok,
      status: selectedSubInfoResponse.status ?? null,
      message: selectedSubInfoResponse.ok ? extractMessage(selectedSubInfoResponse.payload, "OK") : null,
      error: selectedSubInfoResponse.ok ? null : selectedSubInfoResponse.error,
      rows: subInfoDictionary.size
    },
    operationRecordsSourceStatus: {
      endpoint: selectedOperationRecordsEndpoint,
      ok: selectedOperationRecordsResponse.ok,
      status: selectedOperationRecordsResponse.status ?? null,
      message: selectedOperationRecordsResponse.ok ? extractMessage(selectedOperationRecordsResponse.payload, "OK") : null,
      error: selectedOperationRecordsResponse.ok ? null : selectedOperationRecordsResponse.error,
      rows: operationRecords.length
    },
    alarmRecordsSourceStatus: {
      endpoint: selectedAlarmRecordsEndpoint,
      ok: selectedAlarmRecordsResponse.ok,
      status: selectedAlarmRecordsResponse.status ?? null,
      message: selectedAlarmRecordsResponse.ok ? extractMessage(selectedAlarmRecordsResponse.payload, "OK") : null,
      error: selectedAlarmRecordsResponse.ok ? null : selectedAlarmRecordsResponse.error,
      rows: alarmRecords.length
    }
  };
}

export async function executeSceneDeviceCommand(baseUrl, siteId, options = {}) {
  const identifiers = buildIdentifierCandidates(
    siteId,
    options.projectKey,
    options.projectKeyCandidates,
    options.databaseKey,
    options.databaseKeyCandidates
  );
  let selectedEndpoint = buildSceneDeviceCommandEndpoint(identifiers[0] || siteId, options);
  let selectedResponse = {
    ok: false,
    status: null,
    error: null,
    payload: null
  };

  for (const identifier of identifiers) {
    const endpoint = buildSceneDeviceCommandEndpoint(identifier, options);
    const response = await fetchLegacyJson(baseUrl, endpoint);
    selectedEndpoint = endpoint;
    selectedResponse = response;
    if (response.ok) {
      break;
    }
  }

  return {
    ok: selectedResponse.ok,
    status: selectedResponse.status ?? null,
    message: selectedResponse.ok ? extractMessage(selectedResponse.payload, "OK") : null,
    error: selectedResponse.ok ? null : selectedResponse.error,
    payload: selectedResponse.payload,
    sourceStatus: {
      endpoint: selectedEndpoint,
      ok: selectedResponse.ok,
      status: selectedResponse.status ?? null,
      message: selectedResponse.ok ? extractMessage(selectedResponse.payload, "OK") : null,
      error: selectedResponse.ok ? null : selectedResponse.error,
      rows: null
    }
  };
}
