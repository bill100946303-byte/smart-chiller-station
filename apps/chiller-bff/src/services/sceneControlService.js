import {
  executeSceneDeviceCommand,
  loadSceneDeviceParameters,
  loadSceneFloorModels,
  loadSceneLegacyTrend,
  loadSceneOnlineMonitor
} from "../adapters/legacySceneControlAdapter.js";
import { computeFreshnessState } from "./freshness.js";
import { applyFieldNullStrategy, buildGeneratedAt } from "./fieldPolicyService.js";
import { buildSourceStatus } from "./sourceStatusService.js";

const B25_READ_ONLY_SCENE_ALIASES = new Set([
  "140",
  "b25",
  "140b25",
  "btwentyfive",
  "140btwentyfive"
]);

function normalizeSceneScopeToken(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function appendSceneScopeCandidates(candidates, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => appendSceneScopeCandidates(candidates, item));
    return;
  }
  candidates.push(value);
}

function resolveB25ReadOnlySceneScope(siteId, options = {}) {
  const candidates = [siteId];
  const identityFields = [
    "siteId",
    "siteCode",
    "appId",
    "projectKey",
    "projectKeyCandidates",
    "databaseKey",
    "databaseKeyCandidates",
    "preferredProjectKey",
    "modelKey"
  ];
  for (const field of identityFields) {
    appendSceneScopeCandidates(candidates, options?.[field]);
  }
  return candidates
    .map(normalizeSceneScopeToken)
    .find((candidate) => B25_READ_ONLY_SCENE_ALIASES.has(candidate)) || null;
}

function mapSite(config, siteId) {
  return {
    siteId: applyFieldNullStrategy(config, "site_id", siteId, siteId),
    siteName: applyFieldNullStrategy(config, "site_name", siteId, siteId)
  };
}

export async function getSceneLegacyTrend(config, siteId, options = {}) {
  const report = await loadSceneLegacyTrend(config.legacyBaseUrl, siteId, options);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    title: report.title,
    unit: report.unit,
    filters: report.filters,
    points: report.points,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "sceneLegacyTrend", ...(report.sourceStatus || {}) }])
  };
}

export async function getSceneOnlineMonitor(config, siteId, options = {}) {
  const report = await loadSceneOnlineMonitor(config.legacyBaseUrl, siteId, options);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    title: report.title,
    unit: report.unit,
    points: report.points,
    freshness: computeFreshnessState(report.latestTimestamp, config.staleThresholdHours),
    sourceStatus: buildSourceStatus([{ key: "sceneOnlineMonitor", ...(report.sourceStatus || {}) }])
  };
}

export async function getSceneFloorModels(config, siteId, options = {}) {
  const report = await loadSceneFloorModels(config.legacyBaseUrl, options);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    items: report.items,
    sourceStatus: buildSourceStatus([{ key: "sceneFloorModels", ...(report.sourceStatus || {}) }])
  };
}

export async function getSceneDeviceParameters(config, siteId, options = {}) {
  const report = await loadSceneDeviceParameters(config.legacyBaseUrl, siteId, options);
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    drId: report.drId,
    deviceName: report.deviceName,
    deviceInfo: report.deviceInfo,
    groups: report.groups,
    controlGroups: report.controlGroups,
    items: report.items,
    operationRecords: report.operationRecords,
    alarmRecords: report.alarmRecords,
    sourceStatus: buildSourceStatus([
      { key: "sceneDeviceSubInfo", ...(report.subInfoSourceStatus || {}) },
      { key: "sceneDeviceInfoVisibility", ...(report.infoVisibilitySourceStatus || {}) },
      { key: "sceneDeviceStandingBook", ...(report.standingBookSourceStatus || {}) },
      { key: "sceneDeviceInfoSetting", ...(report.infoSettingSourceStatus || {}) },
      { key: "sceneDeviceOperationRecords", ...(report.operationRecordsSourceStatus || {}) },
      { key: "sceneDeviceAlarmRecords", ...(report.alarmRecordsSourceStatus || {}) },
      { key: "sceneDeviceParameters", ...(report.sourceStatus || {}) }
    ])
  };
}

export async function submitSceneDeviceCommand(config, siteId, request = {}, options = {}) {
  const regName = typeof request.regName === "string" ? request.regName.trim() : "";
  const value = request.value == null ? "" : String(request.value).trim();
  const tagName = typeof request.tagName === "string" ? request.tagName.trim() : "";
  const msg = `${regName}|${value}|${tagName}`;
  const command = {
    drId: request.drId == null ? "" : String(request.drId),
    drTypeId: request.drTypeId == null ? "" : String(request.drTypeId),
    regName,
    value,
    tagName,
    msg
  };
  const blockedScope = resolveB25ReadOnlySceneScope(siteId, options);
  if (blockedScope) {
    const error = "B25冷站数字孪生仅允许只读监测，禁止下发BA/PLC场景控制指令。";
    return {
      site: mapSite(config, siteId),
      generatedAt: buildGeneratedAt(config),
      ok: false,
      code: "B25_READ_ONLY_SCOPE",
      status: 403,
      message: null,
      error,
      payload: null,
      controlMutation: false,
      dispatch: false,
      command,
      sourceStatus: buildSourceStatus([{
        key: "sceneDeviceCommand",
        endpoint: "",
        ok: false,
        status: 403,
        reasonCode: "B25_READ_ONLY_SCOPE",
        error,
        rows: null
      }])
    };
  }
  const report = await executeSceneDeviceCommand(config.legacyBaseUrl, siteId, {
    ...options,
    drId: request.drId,
    drTypeId: request.drTypeId,
    appId: options.appId || siteId,
    msg
  });
  return {
    site: mapSite(config, siteId),
    generatedAt: buildGeneratedAt(config),
    ok: report.ok,
    message: report.message,
    error: report.error,
    payload: report.payload,
    command,
    sourceStatus: buildSourceStatus([{ key: "sceneDeviceCommand", ...(report.sourceStatus || {}) }])
  };
}
