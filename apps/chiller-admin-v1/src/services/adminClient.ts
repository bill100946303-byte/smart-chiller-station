import { runtimeConfig } from "../config/runtimeConfig";
import {
  createMockMe,
  createMockMember,
  createMockSite,
  deleteMockMember,
  getMockAuditLogs,
  getMockPointRoleImportPreview,
  getMockPointRoleMappings,
  getMockRuntimeConfig,
  getMockSite,
  listMockStationInstances,
  getMockSiteSubsystems,
  getMockSites,
  getMockSourceConfig,
  getMockSubsystemRegistry,
  listMockConfigVersions,
  listMockMembers,
  publishMockConfigVersion,
  rollbackMockConfigVersion,
  updateMockMember,
  updateMockPointRoleMappings,
  updateMockRuntimeConfig,
  updateMockSite,
  updateMockStationInstances,
  updateMockSiteSubsystems,
  updateMockSourceConfig
} from "./adminMocks";
import type {
  AdminAuditLog,
  AdminBackendHealth,
  AdminConfigVersion,
  AdminConfigVersionResult,
  AdminDeviceDataInterface,
  AdminDeviceDataQuery,
  AdminEffectiveSourceConfig,
  AdminFcuControlPolicy,
  AdminFcuFieldRemediationRefreshResult,
  AdminFcuFieldRemediationStatus,
  AdminFcuFieldArmPackageResult,
  AdminFcuFieldRemediationSignoffPreview,
  AdminFcuFieldRemediationSignoffPromoteResult,
  AdminFcuSignoffRowRecord,
  AdminFcuSignoffRowSaveResult,
  AdminFcuSignoffCleanPromoteResult,
  AdminMember,
  AdminMe,
  AdminMemberStatus,
  AdminRole,
  AdminRoleClaims,
  AdminRuntimeConfig,
  AdminScopeType,
  AdminSiteDetail,
  AdminSiteSummary,
  AdminSourceStatus,
  AdminStationInstance,
  AdminStationInstanceList,
  AdminStationRuntimeBinding,
  AdminStationRuntimeBindingState,
  AdminStationRuntimeBindingStatus,
  AdminStationRuntimeBindingValidation,
  AdminPointRoleImportPreview,
  AdminPointRoleMapping,
  AdminSourceConfig,
  AdminSourceConfigBundle,
  AdminSiteSubsystemCapability,
  AdminSubsystemRegistryItem
} from "./adminTypes";

export type {
  AdminAuditLog,
  AdminBackendHealth,
  AdminAdvisorPluginBinding,
  AdminConfigVersion,
  AdminConfigVersionResult,
  AdminControlBoundary,
  AdminControlBoundaryMode,
  AdminDeviceDataInterface,
  AdminDeviceDataQuery,
  AdminEffectiveSourceConfig,
  AdminFcuFieldAuthorization,
  AdminFcuControlPolicy,
  AdminFcuFieldRemediationRefreshResult,
  AdminFcuFieldRemediationStatus,
  AdminFcuFieldArmPackageResult,
  AdminFcuFieldRemediationSignoffPreview,
  AdminFcuFieldRemediationSignoffPromoteResult,
  AdminFcuSignoffRowRecord,
  AdminFcuSignoffRowSaveResult,
  AdminFcuSignoffCleanPromoteResult,
  AdminMember,
  AdminMe,
  AdminMemberStatus,
  AdminRole,
  AdminRoleClaims,
  AdminRuntimeConfig,
  AdminScopeType,
  AdminPointRoleImportPreview,
  AdminPointRoleMapping,
  AdminPointRoleKind,
  AdminSiteDetail,
  AdminSiteStatus,
  AdminSiteSummary,
  AdminStationInstance,
  AdminStationInstanceList,
  AdminStationRuntimeBinding,
  AdminStationRuntimeBindingState,
  AdminStationRuntimeBindingStatus,
  AdminStationRuntimeBindingValidation,
  AdminSiteSubsystemCapability,
  AdminSourceConfig,
  AdminSourceConfigBundle,
  AdminSubsystemRegistryItem,
  AdminSubsystemMode,
  AdminSubsystemStatus
} from "./adminTypes";

type QueryValue = string | number | boolean | null | undefined;

export const ADMIN_AUTH_EXPIRED_EVENT = "chiller-admin-auth-expired";

const PHYSICAL_STATION_PARENT_SUBSYSTEM_TYPES = new Set([
  "chilled_plant",
  "compressed_air",
  "boiler_room"
]);

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  userId?: string;
  body?: unknown;
  query?: Record<string, QueryValue>;
  allowMockFallback?: boolean;
};

export class AdminApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;
  originalMessage: string;

  constructor(status: number, message: string, code?: string, payload?: unknown) {
    super(formatAdminApiErrorMessage(status, message, code));
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.originalMessage = message;
  }
}

function formatAdminApiErrorMessage(status: number, message: string, code?: string): string {
  const normalized = `${code || ""} ${message}`.trim().toLowerCase();
  if (status === 401 || /invalid or expired.*token|token.*expired|unauthorized/.test(normalized)) {
    return "登录凭证已失效，请重新登录。";
  }
  if (status === 403 || /forbidden|permission denied/.test(normalized)) {
    return "当前账号没有此操作权限。";
  }
  if (status === 404) {
    return "请求的后台资源不存在，请核对站点与配置范围。";
  }
  if (status === 0 || /failed to fetch|network error/.test(normalized)) {
    return "后台服务连接失败，请检查管理接口是否可用。";
  }
  if (/request failed/.test(normalized)) {
    return "后台请求失败，请稍后重试或查看服务日志。";
  }
  return message;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, runtimeConfig.adminApiBaseUrl);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function parseJsonOrText(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function shouldFallback(error: unknown): boolean {
  if (runtimeConfig.useMockData) {
    return true;
  }
  if (error instanceof AdminApiError) {
    return [0, 404, 405, 500, 501, 502, 503].includes(error.status);
  }
  return error instanceof TypeError;
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const headers = new Headers({
    Accept: "application/json"
  });
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  if (options.userId) {
    headers.set("x-chiller-user-id", options.userId);
  }
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body
  });
  const rawText = await response.text();
  const payload = parseJsonOrText(rawText);
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    let code: string | undefined;
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      if (record.error !== undefined) {
        message = String(record.error || message);
      }
      if (record.code !== undefined) {
        code = String(record.code || "");
      }
    }
    if (response.status === 401 && options.token && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT));
    }
    throw new AdminApiError(response.status, message, code, payload);
  }
  return payload as T;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.items ?? record.data ?? record.results ?? record.list;
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }
  return [];
}

function unwrapRecord<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate =
      record.item ??
      record.data ??
      record.result ??
      record.site ??
      record.member ??
      record.config ??
      record.sourceConfig ??
      record.runtimeConfig;
    if (candidate && typeof candidate === "object") {
      return candidate as T;
    }
    if (record.ok === true && !Array.isArray(payload)) {
      return payload as T;
    }
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as T;
  }
  return null;
}

async function requestOrMock<T>(
  path: string,
  options: RequestOptions & { fallback: () => T | Promise<T> }
): Promise<T> {
  if (runtimeConfig.useMockData) {
    return await options.fallback();
  }
  try {
    return await requestJson<T>(path, options);
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error;
    }
    return await options.fallback();
  }
}

function currentUserIdentity(sessionToken?: string, userId?: string): string {
  const value = `${userId || ""}:${sessionToken || ""}`.trim();
  return value || "admin";
}

function normalizeFcuFieldAuthorization(value: Partial<AdminFcuControlPolicy["fieldAuthorization"]> = {}): AdminFcuControlPolicy["fieldAuthorization"] {
  const status =
    value.siteAuthorizationStatus === "requested" ||
    value.siteAuthorizationStatus === "approved" ||
    value.siteAuthorizationStatus === "revoked"
      ? value.siteAuthorizationStatus
      : "not_started";
  return {
    siteAuthorizationStatus: status,
    siteAuthorizationBy: String(value.siteAuthorizationBy || ""),
    siteAuthorizationWindowStart: String(value.siteAuthorizationWindowStart || ""),
    siteAuthorizationWindowEnd: String(value.siteAuthorizationWindowEnd || ""),
    baWriteConfirmArmed: value.baWriteConfirmArmed === true,
    finalRolloutConfirmArmed: value.finalRolloutConfirmArmed === true,
    commissioningOwner: String(value.commissioningOwner || ""),
    baOwner: String(value.baOwner || ""),
    notes: String(value.notes || "")
  };
}

function normalizeFcuControlPolicy(value: Partial<AdminFcuControlPolicy> = {}): AdminFcuControlPolicy {
  const mode = value.defaultMode === "assisted" || value.defaultMode === "enforced" ? value.defaultMode : "shadow";
  const targetLowC = Number.isFinite(Number(value.targetLowC)) ? Number(value.targetLowC) : 24.5;
  const targetHighC = Math.max(targetLowC + 0.5, Number.isFinite(Number(value.targetHighC)) ? Number(value.targetHighC) : 26.5);
  return {
    enabled: value.enabled !== false,
    defaultMode: mode,
    targetLowC,
    targetHighC,
    minSetpointC: Number.isFinite(Number(value.minSetpointC)) ? Number(value.minSetpointC) : 22,
    maxSetpointC: Number.isFinite(Number(value.maxSetpointC)) ? Number(value.maxSetpointC) : 28,
    setpointStepC: Number.isFinite(Number(value.setpointStepC)) ? Number(value.setpointStepC) : 0.5,
    setpointDwellMinutes: Number.isFinite(Number(value.setpointDwellMinutes)) ? Number(value.setpointDwellMinutes) : 15,
    startStopDwellMinutes: Number.isFinite(Number(value.startStopDwellMinutes)) ? Number(value.startStopDwellMinutes) : 30,
    dailyMaxSetpointShiftC: Number.isFinite(Number(value.dailyMaxSetpointShiftC)) ? Number(value.dailyMaxSetpointShiftC) : 2,
    validTempMinC: Number.isFinite(Number(value.validTempMinC)) ? Number(value.validTempMinC) : 5,
    validTempMaxC: Number.isFinite(Number(value.validTempMaxC)) ? Number(value.validTempMaxC) : 45,
    feedbackTimeoutSeconds: Number.isFinite(Number(value.feedbackTimeoutSeconds)) ? Number(value.feedbackTimeoutSeconds) : 120,
    rollbackLockoutMinutes: Number.isFinite(Number(value.rollbackLockoutMinutes)) ? Number(value.rollbackLockoutMinutes) : 60,
    allowStartStop: value.allowStartStop !== false,
    allowSetpoint: value.allowSetpoint !== false,
    allowFanSpeed: value.allowFanSpeed !== false,
    occupied: value.occupied !== false,
    dispatchAdapter: String(value.dispatchAdapter || "none"),
    fieldAuthorization: normalizeFcuFieldAuthorization(value.fieldAuthorization),
    whitelist: Array.isArray(value.whitelist) ? value.whitelist.map((item) => String(item).trim()).filter(Boolean) : [],
    deviceOverrides: value.deviceOverrides && typeof value.deviceOverrides === "object" ? value.deviceOverrides : {}
  };
}

function buildFallbackFcuFieldRemediationStatus(siteId: string): AdminFcuFieldRemediationStatus {
  return {
    site: { siteId },
    subsystemType: "hvac_terminal",
    equipmentType: "fan_coil",
    controlMutation: false,
    dispatch: false,
    summary: {
      totalWorkOrders: 8,
      openWorkOrders: 8,
      openP0Devices: 8,
      signoffComplete: false,
      signoffCompleteRows: 0,
      signoffExpectedRows: 8,
      finalGatePassed: false,
      finalGatePassedCount: 0,
      finalGateCount: 8,
      canaryReady: false
    },
    workOrders: {
      ok: false,
      items: [
        { workOrderId: "FCU-P0-BGS03", priority: "P0", deviceCode: "BGS03", deviceName: "办公室03", status: "open" },
        { workOrderId: "FCU-P0-BGS04", priority: "P0", deviceCode: "BGS04", deviceName: "办公室04", status: "open" },
        { workOrderId: "FCU-P0-BGS06", priority: "P0", deviceCode: "BGS06", deviceName: "办公室06", status: "open" }
      ]
    },
    executionPack: {
      ok: false,
      reasonCounts: {
        communication_alarm: 8,
        zero_temperature: 4,
        setpoint_feedback_out_of_bounds: 6
      },
      executionOrder: [
        { phase: "restore_communication", deviceCount: 8, deviceCodes: ["BGS03", "BGS04", "BGS06"] },
        { phase: "onsite_signoff", deviceCount: 8, deviceCodes: ["BGS03", "BGS04", "BGS06"] }
      ]
    },
    signoff: {
      ok: false,
      openRecords: [
        { workOrderId: "FCU-P0-BGS03", deviceCode: "BGS03", issues: ["handledBy_missing"] }
      ]
    },
    returnTemplate: {
      ok: true,
      summary: {
        deviceCount: 8,
        communicationBlocked: 8,
        temperatureBlocked: 4,
        setpointBlocked: 6,
        signoffCompleteRows: 0,
        signoffExpectedRows: 8,
        canaryBlockedUntil: ["全部现场回填 release", "重跑 signoff", "重跑实时 closeout", "重跑 final-control gates"]
      },
      devices: [
        {
          workOrderId: "FCU-P0-BGS03",
          deviceCode: "BGS03",
          deviceName: "办公室03",
          currentEvidence: {
            reasonLabels: ["通讯报警未恢复", "温度点为0°C", "设定反馈越界"]
          },
          requiredValues: {
            communicationAlarmAfter: "必填：0",
            zoneTemperatureAfterC: "必填：5-45",
            setpointFeedbackAfterC: "必填：10-32"
          }
        }
      ],
      outputs: {
        json: "docs/fcu-field-remediation-return-template-latest.json",
        markdown: "docs/fcu-field-remediation-return-template-latest.md",
        csv: "docs/fcu-field-remediation-return-template-latest.csv"
      },
      controlMutation: false,
      dispatch: false
    },
    handoff: {
      ok: false,
      conclusion: "最终门禁未通过，本包只用于现场消缺和签核，不允许真实 BA/PLC 写入。",
      summary: {
        totalWorkOrders: 8,
        openP0Devices: 8,
        staleSignoffRows: 1,
        signoffCompleteRows: 0,
        signoffExpectedRows: 8,
        finalGatePassed: false,
        canaryReady: false,
        nextAllowedStep: "先清理过期签核行，生成 current-only 输入表。"
      },
      devices: [
        { workOrderId: "FCU-P0-BGS03", deviceCode: "BGS03", deviceName: "办公室03", owner: "BA/自控工程师", reasonLabels: ["通讯报警"], todayAction: "先恢复通讯报警，再做温度和设定反馈复核。" },
        { workOrderId: "FCU-P0-BGS04", deviceCode: "BGS04", deviceName: "办公室04", owner: "BA/自控工程师", reasonLabels: ["通讯报警"], todayAction: "先恢复通讯报警，再做温度和设定反馈复核。" }
      ],
      outputFiles: {
        json: "docs/fcu-field-handoff-pack-latest.json",
        markdown: "docs/fcu-field-handoff-pack-latest.md",
        csv: "docs/fcu-field-handoff-pack-latest.csv"
      },
      safetyBoundary: ["本交接包不产生 BA/PLC 写入。"],
      controlMutation: false,
      dispatch: false
    },
    finalControlGates: {
      ok: false,
      blockers: [
        { label: "现场签字", value: "0/8", blocker: "现场签字未完成" },
        { label: "Canary readiness", value: "canary_blocked", blocker: "Canary 总门禁阻断" }
      ],
      nextActions: [
        { priority: "P0", phase: "field_signoff", action: "补齐 FCU 现场消缺签字" }
      ],
      controlMutation: false
    },
    reportStatuses: {}
  };
}

function normalizeSiteSummary(value: Partial<AdminSiteSummary>): AdminSiteSummary {
  const record = value as Partial<AdminSiteSummary> & {
    sourceConfig?: { updatedAt?: string | null };
    runtimeConfig?: { updatedAt?: string | null };
    members?: unknown[];
  };
  return {
    siteId: String(value.siteId || "").trim(),
    siteName: String(value.siteName || value.siteId || "").trim(),
    siteCode: value.siteCode || undefined,
    city: value.city || undefined,
    status: value.status || "active",
    ownerName: value.ownerName || undefined,
    remark: value.remark || undefined,
    sourceStatus: normalizeSiteSourceStatus(value.sourceStatus),
    runtimeStatus: normalizeSiteSourceStatus(value.runtimeStatus),
    sourceUpdatedAt: value.sourceUpdatedAt || record.sourceConfig?.updatedAt || undefined,
    runtimeUpdatedAt: value.runtimeUpdatedAt || record.runtimeConfig?.updatedAt || undefined,
    memberCount: value.memberCount || (Array.isArray(record.members) ? record.members.length : 0),
    updatedAt: value.updatedAt || undefined
  };
}

function normalizeSiteSourceStatus(value: unknown): AdminSourceStatus {
  return value === "ok" || value === "partial" || value === "failed" || value === "not_configured"
    ? value
    : "unknown";
}

function normalizeSiteDetail(value: Partial<AdminSiteDetail>): AdminSiteDetail {
  return {
    ...normalizeSiteSummary(value),
    createdAt: value.createdAt || undefined,
    updatedAt: value.updatedAt || undefined,
    createdBy: value.createdBy || undefined,
    updatedBy: value.updatedBy || undefined
  };
}

function normalizeSourceConfig(value: Partial<AdminSourceConfig>): AdminSourceConfig {
  return {
    legacyBaseUrl: value.legacyBaseUrl || runtimeConfig.legacyBaseUrl,
    ipAddress: value.ipAddress || "",
    port: value.port || "",
    databaseKey: value.databaseKey || "",
    modelKey: value.modelKey || "",
    preferredProjectKey: value.preferredProjectKey || "",
    template: value.template || "",
    controlMode: value.controlMode || "",
    status: value.status || "connected",
    note: value.note || "",
    createdAt: value.createdAt || undefined,
    updatedAt: value.updatedAt || undefined
  };
}

function normalizeDeviceDataQuery(value: Partial<AdminDeviceDataQuery> | null | undefined): AdminDeviceDataQuery | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const build =
    typeof record.build === "number" && Number.isFinite(record.build)
      ? record.build
      : typeof record.build === "string" && record.build.trim()
        ? Number(record.build)
        : undefined;
  const floor =
    typeof record.floor === "number" && Number.isFinite(record.floor)
      ? record.floor
      : typeof record.floor === "string" && record.floor.trim()
        ? Number(record.floor)
        : undefined;
  const mock =
    typeof record.mock === "boolean"
      ? record.mock
      : typeof record.mock === "string"
        ? record.mock.trim() === "true" || record.mock.trim() === "1"
        : undefined;
  const normalized: AdminDeviceDataQuery = {
    ...(typeof build === "number" && Number.isFinite(build) ? { build } : {}),
    ...(typeof floor === "number" && Number.isFinite(floor) ? { floor } : {}),
    ...(typeof mock === "boolean" ? { mock } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeDeviceDataInterface(value: Partial<AdminDeviceDataInterface>): AdminDeviceDataInterface | null {
  const projectKey = String(value.projectKey || "").trim();
  const label = String(value.label || "").trim();
  const endpointKind = String(value.endpointKind || "").trim();
  const endpoint = String(value.endpoint || "").trim();
  if (!projectKey || !label || !endpointKind || !endpoint) {
    return null;
  }
  return {
    projectKey,
    label,
    endpointKind,
    endpoint,
    ...(typeof value.build === "number" && Number.isFinite(value.build) ? { build: value.build } : {}),
    ...(typeof value.floor === "number" && Number.isFinite(value.floor) ? { floor: value.floor } : {}),
    ...(typeof value.mock === "boolean" ? { mock: value.mock } : {})
  };
}

function normalizeEffectiveSourceConfig(value: Partial<AdminEffectiveSourceConfig>): AdminEffectiveSourceConfig {
  const record = value as Partial<AdminEffectiveSourceConfig> & {
    deviceDataInterfaces?: unknown[];
  };
  return {
    ...normalizeSourceConfig(value),
    deviceDataProjectKey: value.deviceDataProjectKey || undefined,
    defaultDeviceQuery: normalizeDeviceDataQuery(value.defaultDeviceQuery),
    deviceDataInterfaces: Array.isArray(record.deviceDataInterfaces)
      ? record.deviceDataInterfaces
          .map((item) => normalizeDeviceDataInterface((item || {}) as Partial<AdminDeviceDataInterface>))
          .filter(Boolean) as AdminDeviceDataInterface[]
      : undefined
  };
}

function normalizeSourceConfigBundle(payload: unknown): AdminSourceConfigBundle {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const sourceConfig = normalizeSourceConfig(
      (record.sourceConfig && typeof record.sourceConfig === "object"
        ? record.sourceConfig
        : unwrapRecord<AdminSourceConfig>(payload)) || { legacyBaseUrl: runtimeConfig.legacyBaseUrl }
    );
    const effectiveCandidate =
      record.effectiveSourceConfig && typeof record.effectiveSourceConfig === "object"
        ? (record.effectiveSourceConfig as Partial<AdminEffectiveSourceConfig>)
        : sourceConfig;
    return {
      sourceConfig,
      effectiveSourceConfig: normalizeEffectiveSourceConfig(effectiveCandidate)
    };
  }
  const sourceConfig = normalizeSourceConfig({ legacyBaseUrl: runtimeConfig.legacyBaseUrl });
  return {
    sourceConfig,
    effectiveSourceConfig: normalizeEffectiveSourceConfig(sourceConfig)
  };
}

function normalizeRuntimeConfig(value: Partial<AdminRuntimeConfig>): AdminRuntimeConfig {
  const record = value as Partial<AdminRuntimeConfig> & {
    energyParams?: unknown;
    ruleThresholds?: unknown;
    featureFlags?: unknown;
    version?: string | number;
  };
  const serializeJson = (input: unknown, fallback = "{}"): string => {
    if (typeof input === "string") {
      return input || fallback;
    }
    if (input === undefined || input === null) {
      return fallback;
    }
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return fallback;
    }
  };
  return {
    energyParamsJson: value.energyParamsJson || serializeJson(record.energyParams),
    ruleThresholdsJson: value.ruleThresholdsJson || serializeJson(record.ruleThresholds),
    featureFlagsJson: value.featureFlagsJson || serializeJson(record.featureFlags),
    version:
      typeof record.version === "number"
        ? String(record.version)
        : value.version || undefined,
    updatedAt: value.updatedAt || undefined,
    updatedBy: value.updatedBy || undefined
  };
}

function parseEditableJsonObject(value: unknown, fieldLabel: string): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) {
      return {};
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`${fieldLabel} 不是合法 JSON`);
    }
  }
  if (parsed === undefined || parsed === null || parsed === "") {
    return {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

function normalizeMember(value: Partial<AdminMember>): AdminMember {
  const record = value as Partial<AdminMember> & {
    createdAt?: string;
  };
  return {
    bindingId: String(value.bindingId || "").trim(),
    userId: String(value.userId || "").trim(),
    username: String(value.username || "").trim(),
    role: (value.role as AdminRole) || "site_admin",
    scopeType: (value.scopeType as AdminScopeType) || "site",
    scopeId: value.scopeId || undefined,
    status: (value.status as AdminMemberStatus) || "active",
    joinedAt: value.joinedAt || record.createdAt || undefined,
    updatedAt: value.updatedAt || undefined
  };
}

function normalizeAuditLog(value: Partial<AdminAuditLog>): AdminAuditLog {
  const record = value as Partial<AdminAuditLog> & {
    auditId?: string | number;
    actorUsername?: string;
    actorUserId?: string;
    createdAt?: string;
    before?: unknown;
    after?: unknown;
  };
  const serializeJson = (input: unknown): string | undefined => {
    if (input === undefined || input === null) {
      return undefined;
    }
    if (typeof input === "string") {
      return input;
    }
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };
  return {
    id: String(value.id || record.auditId || "").trim(),
    ts: String(value.ts || record.createdAt || "").trim(),
    actor: String(value.actor || record.actorUsername || record.actorUserId || "").trim(),
    action: String(value.action || "").trim(),
    targetType: String(value.targetType || "").trim(),
    targetId: String(value.targetId || "").trim(),
    requestId: String(value.requestId || "").trim(),
    beforeJson: value.beforeJson || serializeJson(record.before),
    afterJson: value.afterJson || serializeJson(record.after),
    details: value.details || undefined
  };
}

function normalizeConfigVersion(value: Partial<AdminConfigVersion>): AdminConfigVersion {
  return {
    versionId: String(value.versionId || "").trim(),
    siteId: String(value.siteId || "").trim(),
    status: String(value.status || "draft").trim(),
    summary: value.summary ?? null,
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
    createdBy: value.createdBy ?? null,
    updatedBy: value.updatedBy ?? null,
    publishedAt: value.publishedAt ?? null,
    rolledBackAt: value.rolledBackAt ?? null
  };
}

function normalizeSubsystemRegistryItem(value: Partial<AdminSubsystemRegistryItem>): AdminSubsystemRegistryItem {
  return {
    subsystemType: String(value.subsystemType || "").trim(),
    displayName: String(value.displayName || value.subsystemType || "").trim(),
    category: String(value.category || "general"),
    description: value.description ?? null,
    defaultStatus: value.defaultStatus || "not_configured",
    reserved: Boolean(value.reserved),
    sortOrder: Number.isFinite(Number(value.sortOrder)) ? Number(value.sortOrder) : 999,
    pointRoles: Array.isArray(value.pointRoles) ? value.pointRoles : []
  };
}

function filterStationParentSubsystems(
  items: AdminSubsystemRegistryItem[]
): AdminSubsystemRegistryItem[] {
  return items.filter((item) => PHYSICAL_STATION_PARENT_SUBSYSTEM_TYPES.has(item.subsystemType));
}

function normalizeSiteSubsystemCapability(value: Partial<AdminSiteSubsystemCapability>): AdminSiteSubsystemCapability {
  const enabled = value.status === "enabled";
  return {
    siteId: String(value.siteId || "").trim(),
    subsystemType: String(value.subsystemType || "").trim(),
    displayName: String(value.displayName || value.subsystemType || "").trim(),
    category: String(value.category || "general"),
    description: value.description ?? null,
    status: value.status || "not_configured",
    mode: value.mode || (value.reserved ? "reserved" : "monitoring"),
    reserved: Boolean(value.reserved),
    enabled,
    kpis: enabled && Array.isArray(value.kpis) ? value.kpis : [],
    alarmCount: enabled && typeof value.alarmCount === "number" ? value.alarmCount : null,
    freshnessStatus: String(value.freshnessStatus || (enabled ? "unknown" : "not_configured")),
    sourceStatus: String(value.sourceStatus || (enabled ? "unknown" : "not_configured")),
    pointMappingProgress: Math.max(0, Math.min(100, Math.round(Number(value.pointMappingProgress || 0)))),
    advisorPluginStatus: enabled ? String(value.advisorPluginStatus || "not_configured") : "not_configured",
    pageTemplateStatus: String(value.pageTemplateStatus || "not_configured"),
    published: value.published !== false,
    notes: value.notes ?? null,
    requiredPointRoles: Array.isArray(value.requiredPointRoles) ? value.requiredPointRoles : [],
    advisorBindings: enabled && Array.isArray(value.advisorBindings) ? value.advisorBindings : [],
    controlBoundary: value.controlBoundary || {
      mode: "read_only",
      approvalRequired: true,
      plcProtectionRequired: true,
      rollbackRequired: true,
      writeEnabled: false,
      notes: "第一版只读/影子运行。"
    },
    updatedAt: value.updatedAt || null
  };
}

function normalizeStationInstance(
  value: Partial<AdminStationInstance>,
  fallbackSiteId = ""
): AdminStationInstance {
  const status =
    value.status === "enabled" || value.status === "not_applicable"
      ? value.status
      : "not_configured";
  const enabled = status === "enabled";
  const alarmCount = Number(value.alarmCount);
  const sortOrder = Number(value.sortOrder);
  const bindingState = value.bindingState === "draft"
    || value.bindingState === "validated"
    || value.bindingState === "published"
    || value.bindingState === "superseded"
    || value.bindingState === "disabled"
    ? value.bindingState
    : "unconfigured";
  const normalizeBindingVersion = (candidate: unknown): number | null => {
    const version = Number(candidate);
    return Number.isSafeInteger(version) && version > 0 ? version : null;
  };
  return {
    siteId: String(value.siteId || fallbackSiteId).trim(),
    stationId: String(value.stationId || "").trim(),
    stationName: String(value.stationName || value.stationId || "").trim(),
    parentSubsystemType: String(value.parentSubsystemType || "").trim(),
    status,
    enabled,
    sourceStatus: enabled ? String(value.sourceStatus || "unknown") : "not_configured",
    freshnessStatus: enabled ? String(value.freshnessStatus || "unknown") : "not_configured",
    alarmCount: enabled && Number.isFinite(alarmCount) ? Math.max(0, Math.round(alarmCount)) : null,
    bindingState,
    bindingVersion: normalizeBindingVersion(value.bindingVersion),
    draftBindingVersion: normalizeBindingVersion(value.draftBindingVersion),
    publishedBindingVersion: normalizeBindingVersion(value.publishedBindingVersion),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : 999,
    published: value.published === true,
    notes: value.notes ?? null,
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
    createdBy: value.createdBy ?? null,
    updatedBy: value.updatedBy ?? null
  };
}

const STATION_RUNTIME_BINDING_STATUSES = new Set<AdminStationRuntimeBindingStatus>([
  "draft",
  "validated",
  "published",
  "superseded",
  "disabled"
]);

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
}

function normalizeStationRuntimeBindingValidation(
  value: unknown
): AdminStationRuntimeBindingValidation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const matched = record.matched && typeof record.matched === "object" && !Array.isArray(record.matched)
    ? record.matched as Record<string, unknown>
    : {};
  const unmatched = record.unmatched && typeof record.unmatched === "object" && !Array.isArray(record.unmatched)
    ? record.unmatched as Record<string, unknown>
    : {};
  const ambiguous = record.ambiguous && typeof record.ambiguous === "object" && !Array.isArray(record.ambiguous)
    ? record.ambiguous as Record<string, unknown>
    : {};
  return {
    ok: record.ok === true,
    payloadHash: typeof record.payloadHash === "string" ? record.payloadHash : null,
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : null,
    selectorMode: typeof record.selectorMode === "string" ? record.selectorMode : null,
    matchAll: record.matchAll === true,
    matched: {
      deviceCount: Number.isSafeInteger(Number(matched.deviceCount)) ? Number(matched.deviceCount) : 0,
      devices: Array.isArray(matched.devices)
        ? matched.devices.filter((item): item is { deviceId?: string; deviceCode?: string; deviceName?: string } => (
            Boolean(item && typeof item === "object" && !Array.isArray(item))
          ))
        : [],
      pointCount: Number.isSafeInteger(Number(matched.pointCount)) ? Number(matched.pointCount) : 0,
      points: Array.isArray(matched.points) ? matched.points : []
    },
    unmatched: {
      deviceIds: normalizeStringList(unmatched.deviceIds),
      deviceCodes: normalizeStringList(unmatched.deviceCodes),
      pointCodes: normalizeStringList(unmatched.pointCodes)
    },
    ambiguous: {
      deviceIds: normalizeStringList(ambiguous.deviceIds),
      pointCodes: normalizeStringList(ambiguous.pointCodes)
    },
    errors: normalizeStringList(record.errors),
    catalogHash: typeof record.catalogHash === "string" ? record.catalogHash : null,
    sourceEvidence: record.sourceEvidence && typeof record.sourceEvidence === "object" && !Array.isArray(record.sourceEvidence)
      ? record.sourceEvidence as Record<string, unknown>
      : undefined
  };
}

function normalizeStationRuntimeBinding(
  value: unknown,
  expectedSiteId: string,
  expectedStationId: string
): AdminStationRuntimeBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const source = record.source && typeof record.source === "object" && !Array.isArray(record.source)
    ? record.source as Record<string, unknown>
    : {};
  const selectors = record.selectors && typeof record.selectors === "object" && !Array.isArray(record.selectors)
    ? record.selectors as Record<string, unknown>
    : {};
  const status = STATION_RUNTIME_BINDING_STATUSES.has(record.status as AdminStationRuntimeBindingStatus)
    ? record.status as AdminStationRuntimeBindingStatus
    : "draft";
  const bindingVersion = Number(record.bindingVersion);
  const siteId = String(record.siteId || "").trim();
  const stationId = String(record.stationId || "").trim();
  if (
    siteId !== expectedSiteId ||
    stationId !== expectedStationId ||
    !Number.isSafeInteger(bindingVersion) ||
    bindingVersion <= 0
  ) {
    throw new AdminApiError(
      502,
      "Station runtime binding response identity or version is invalid",
      "STATION_RUNTIME_BINDING_CONTRACT_INVALID",
      value
    );
  }
  return {
    siteId,
    stationId,
    stationName: typeof record.stationName === "string" ? record.stationName : null,
    parentSubsystemType: typeof record.parentSubsystemType === "string" ? record.parentSubsystemType : null,
    stationStatus: typeof record.stationStatus === "string" ? record.stationStatus : null,
    stationPublished: record.stationPublished === true,
    status,
    bindingVersion,
    source: {
      databaseKey: typeof source.databaseKey === "string" ? source.databaseKey : null,
      projectKey: typeof source.projectKey === "string" ? source.projectKey : null,
      template: typeof source.template === "string" ? source.template : null
    },
    selectors: {
      deviceIds: normalizeStringList(selectors.deviceIds),
      deviceCodes: normalizeStringList(selectors.deviceCodes),
      pointCodes: normalizeStringList(selectors.pointCodes)
    },
    payloadHash: typeof record.payloadHash === "string" ? record.payloadHash : null,
    validatedHash: typeof record.validatedHash === "string" ? record.validatedHash : null,
    validation: normalizeStationRuntimeBindingValidation(record.validation),
    checkedAt: typeof record.checkedAt === "string" ? record.checkedAt : null,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
    publishedBy: typeof record.publishedBy === "string" ? record.publishedBy : null,
    notes: typeof record.notes === "string" ? record.notes : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    createdBy: typeof record.createdBy === "string" ? record.createdBy : null,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : null
  };
}

function normalizeStationRuntimeBindingState(
  payload: unknown,
  expectedSiteId: string,
  expectedStationId: string
): AdminStationRuntimeBindingState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AdminApiError(
      502,
      "Station runtime binding state response is invalid",
      "STATION_RUNTIME_BINDING_CONTRACT_INVALID",
      payload
    );
  }
  const record = payload as Record<string, unknown>;
  const siteId = String(record.siteId || "").trim();
  const stationId = String(record.stationId || "").trim();
  if (siteId !== expectedSiteId || stationId !== expectedStationId) {
    throw new AdminApiError(
      502,
      "Station runtime binding response does not match the requested station",
      "STATION_RUNTIME_BINDING_CONTRACT_INVALID",
      payload
    );
  }
  const normalizeVersion = (value: unknown): number | null => {
    const version = Number(value);
    return Number.isSafeInteger(version) && version > 0 ? version : null;
  };
  const draftBinding = normalizeStationRuntimeBinding(record.draftBinding, siteId, stationId);
  const publishedBinding = normalizeStationRuntimeBinding(record.publishedBinding, siteId, stationId);
  const binding = normalizeStationRuntimeBinding(record.binding, siteId, stationId)
    || draftBinding
    || publishedBinding;
  const draftVersion = normalizeVersion(record.draftVersion);
  const publishedVersion = normalizeVersion(record.publishedVersion);
  if (
    (draftBinding !== null && draftBinding.bindingVersion !== draftVersion) ||
    (publishedBinding !== null && publishedBinding.bindingVersion !== publishedVersion)
  ) {
    throw new AdminApiError(
      502,
      "Station runtime binding head/version mismatch",
      "STATION_RUNTIME_BINDING_CONTRACT_INVALID",
      payload
    );
  }
  return {
    siteId,
    stationId,
    binding,
    draftBinding,
    publishedBinding,
    draftVersion,
    publishedVersion,
    configured: record.configured === true || Boolean(binding),
    validation: normalizeStationRuntimeBindingValidation(record.validation)
      || draftBinding?.validation
      || null
  };
}

function assertStationInstanceListContract(
  payload: unknown,
  expectedSiteId: string,
  requiredStationIds: string[] = []
): AdminStationInstanceList {
  const record = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  const responseSiteId = String(record.siteId || "").trim();
  const rawItems = Array.isArray(record.items)
    ? record.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  const total = Number(record.total);
  const stableIdPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
  const rawItemInvalid =
    !Array.isArray(record.items) ||
    rawItems.length !== record.items.length ||
    rawItems.some((item) => {
      const status = item.status;
      const enabled = status === "enabled";
      const alarmCountValid = item.alarmCount === null || (
        enabled && typeof item.alarmCount === "number" && Number.isInteger(item.alarmCount) && item.alarmCount >= 0
      );
      const bindingStateValid = item.bindingState === "unconfigured"
        || item.bindingState === "draft"
        || item.bindingState === "validated"
        || item.bindingState === "published"
        || item.bindingState === "superseded"
        || item.bindingState === "disabled";
      const bindingVersionValid = [
        item.bindingVersion,
        item.draftBindingVersion,
        item.publishedBindingVersion
      ].every((version) => version === null || (
        typeof version === "number" && Number.isSafeInteger(version) && version > 0
      ));
      return (
        typeof item.siteId !== "string" || item.siteId.trim() !== expectedSiteId ||
        typeof item.stationId !== "string" || !stableIdPattern.test(item.stationId.trim()) ||
        typeof item.stationName !== "string" || !item.stationName.trim() ||
        typeof item.parentSubsystemType !== "string" || !item.parentSubsystemType.trim() ||
        (status !== "enabled" && status !== "not_configured" && status !== "not_applicable") ||
        typeof item.enabled !== "boolean" || item.enabled !== enabled ||
        typeof item.sourceStatus !== "string" || !item.sourceStatus.trim() ||
        typeof item.freshnessStatus !== "string" || !item.freshnessStatus.trim() ||
        !alarmCountValid ||
        !bindingStateValid ||
        !bindingVersionValid ||
        typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder) || item.sortOrder < 0 ||
        typeof item.published !== "boolean" ||
        (item.notes !== null && item.notes !== undefined && typeof item.notes !== "string")
      );
    });
  const items = rawItems.map((item) => normalizeStationInstance(item as Partial<AdminStationInstance>));
  const ids = items.map((item) => item.stationId);
  const invalid =
    responseSiteId !== expectedSiteId ||
    typeof record.generatedAt !== "string" || !record.generatedAt.trim() ||
    !Number.isInteger(total) ||
    total !== items.length ||
    rawItemInvalid ||
    new Set(ids).size !== ids.length ||
    items.some((item) => (
      item.siteId !== expectedSiteId ||
      !item.stationId ||
      !item.stationName ||
      !item.parentSubsystemType
    )) ||
    requiredStationIds.some((stationId) => !ids.includes(stationId));
  if (invalid) {
    throw new AdminApiError(
      502,
      "Physical station registry response did not match the requested site or submitted identities",
      "STATION_REGISTRY_CONTRACT_INVALID",
      payload
    );
  }
  return {
    siteId: responseSiteId,
    generatedAt: String(record.generatedAt || ""),
    items,
    total
  };
}

function normalizeAdminRoleClaims(value: unknown): AdminRoleClaims | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const platformRole =
    record.platformRole === "platform_admin" || record.platformRole === "auditor"
      ? record.platformRole
      : null;
  const siteRoles = Array.isArray(record.siteRoles)
    ? record.siteRoles
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          scopeId: String(item.scopeId || "").trim(),
          role: item.role === "site_admin" ? "site_admin" as const : "auditor" as const
        }))
        .filter((item) => Boolean(item.scopeId))
    : [];
  return {
    platformRole,
    siteRoles
  };
}

function normalizePointRoleMapping(value: Partial<AdminPointRoleMapping>): AdminPointRoleMapping {
  return {
    mappingId: value.mappingId ? String(value.mappingId) : undefined,
    siteId: value.siteId,
    subsystemType: String(value.subsystemType || "chilled_plant"),
    pointRole: value.pointRole || "feedback",
    pointName: String(value.pointName || value.pointCode || ""),
    pointCode: value.pointCode ?? "",
    unit: value.unit || "",
    dataType: value.dataType || "",
    direction: value.direction || "read",
    required: Boolean(value.required),
    writable: false,
    source: value.source || "manual",
    notes: value.notes ?? null
  };
}

function normalizePointRoleImportPreview(value: Partial<AdminPointRoleImportPreview>): AdminPointRoleImportPreview {
  return {
    siteId: String(value.siteId || ""),
    generatedAt: String(value.generatedAt || ""),
    totalRows: Number(value.totalRows || 0),
    acceptedRows: Number(value.acceptedRows || 0),
    writableCandidates: Number(value.writableCandidates || 0),
    items: Array.isArray(value.items)
      ? value.items.map((item) => ({
          ...normalizePointRoleMapping(item),
          rowNumber: Number(item.rowNumber || 0),
          confidence: Number(item.confidence || 0),
          reason: String(item.reason || ""),
          warnings: Array.isArray(item.warnings) ? item.warnings : []
        }))
      : [],
    summary: value.summary || {
      message: "导入预览不会写入真实控制点。",
      blocked: false
    }
  };
}

export async function getAdminMe(token: string, userId?: string, username?: string): Promise<AdminMe> {
  const payload = runtimeConfig.useMockData
    ? createMockMe(userId || "admin", username || "admin")
    : await requestJson<unknown>("/admin/v1/me", { token, userId });
  const record = unwrapRecord<AdminMe>(payload);
  const rawRoles = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).roles || record?.roles
    : record?.roles;
  const roles = normalizeAdminRoleClaims(rawRoles);
  const normalizedRole = record?.role;
  if (
    !record ||
    !String(record.userId || "").trim() ||
    !String(record.username || "").trim() ||
    (normalizedRole !== "platform_admin" && normalizedRole !== "site_admin" && normalizedRole !== "auditor") ||
    !roles ||
    (!roles.platformRole && roles.siteRoles.length === 0)
  ) {
    throw new AdminApiError(
      502,
      "/admin/v1/me did not return explicit admin role claims",
      "ADMIN_ME_CONTRACT_INVALID",
      payload
    );
  }
  const visibleSource =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).visibleSites ||
        (payload as Record<string, unknown>).managedSites ||
        (payload as Record<string, unknown>).sites ||
        []
      : [];
  return {
    userId: String(record.userId),
    username: String(record.username),
    role: normalizedRole,
    roles,
    visibleSites: unwrapList<AdminSiteSummary>(visibleSource).map((site) => normalizeSiteSummary(site)),
    bootstrap: Boolean(record.bootstrap)
  };
}

export async function getAdminBackendHealth(): Promise<AdminBackendHealth> {
  const checkedAt = new Date().toISOString();
  if (runtimeConfig.useMockData) {
    const writeAllowed = runtimeConfig.readOnlyMode !== true;
    return {
      reachable: true,
      ok: true,
      readOnlyMode: runtimeConfig.readOnlyMode,
      writeAllowed,
      checkedAt,
      source: "mock",
      reason: writeAllowed ? "显式 mock 模式允许本地登记。" : "显式 mock 模式处于只读状态。"
    };
  }
  try {
    const payload = await requestJson<unknown>("/healthz");
    const record = payload && typeof payload === "object"
      ? payload as Record<string, unknown>
      : {};
    const ok = record.ok === true;
    const readOnlyMode = typeof record.readOnlyMode === "boolean" ? record.readOnlyMode : null;
    const writeAllowed = ok && readOnlyMode === false;
    return {
      reachable: true,
      ok,
      readOnlyMode,
      writeAllowed,
      checkedAt,
      source: "server",
      reason: writeAllowed
        ? "服务端健康且 readOnlyMode=false。"
        : readOnlyMode === true
          ? "服务端 readOnlyMode=true，所有管理写入均被总闸阻断。"
          : "服务端未返回明确的可写状态。"
    };
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      readOnlyMode: null,
      writeAllowed: false,
      checkedAt,
      source: "unavailable",
      reason: error instanceof Error ? error.message : "服务端健康状态不可用。"
    };
  }
}

export async function listAdminSites(
  token: string,
  userId?: string,
  query: { keyword?: string; status?: string } = {}
): Promise<AdminSiteSummary[]> {
  const payload = await requestOrMock("/admin/v1/sites", {
    token,
    userId,
    query,
    fallback: () => getMockSites()
  });
  return unwrapList<AdminSiteSummary>(payload).map((site) => normalizeSiteSummary(site));
}

export async function createAdminSite(
  token: string,
  userId: string | undefined,
  payload: Partial<AdminSiteDetail>
): Promise<AdminSiteDetail> {
  const record = await requestOrMock("/admin/v1/sites", {
    method: "POST",
    token,
    userId,
    body: payload,
    fallback: () => createMockSite(payload)
  });
  return normalizeSiteDetail(unwrapRecord<AdminSiteDetail>(record) || payload);
}

export async function getAdminSite(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminSiteDetail> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}`, {
    token,
    userId,
    fallback: () => getMockSite(siteId)
  });
  return normalizeSiteDetail(unwrapRecord<AdminSiteDetail>(payload) || { siteId, siteName: siteId });
}

export async function updateAdminSite(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: Partial<AdminSiteDetail>
): Promise<AdminSiteDetail> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}`, {
    method: "PUT",
    token,
    userId,
    body: payload,
    fallback: () => updateMockSite(siteId, payload, currentUserIdentity(token, userId))
  });
  return normalizeSiteDetail(unwrapRecord<AdminSiteDetail>(record) || { siteId, siteName: siteId });
}

export async function listSubsystemRegistry(
  token: string,
  userId?: string
): Promise<AdminSubsystemRegistryItem[]> {
  const payload = await requestOrMock("/admin/v1/subsystem-registry", {
    token,
    userId,
    fallback: () => getMockSubsystemRegistry()
  });
  return unwrapList<AdminSubsystemRegistryItem>(payload).map((item) => normalizeSubsystemRegistryItem(item));
}

export async function listSiteSubsystems(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminSiteSubsystemCapability[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/subsystems`, {
    token,
    userId,
    fallback: () => getMockSiteSubsystems(siteId)
  });
  return unwrapList<AdminSiteSubsystemCapability>(payload).map((item) => normalizeSiteSubsystemCapability(item));
}

export async function listStationParentSubsystems(
  token: string,
  userId?: string
): Promise<AdminSubsystemRegistryItem[]> {
  if (runtimeConfig.useMockData) {
    return filterStationParentSubsystems(
      getMockSubsystemRegistry().map((item) => normalizeSubsystemRegistryItem(item))
    );
  }
  const payload = await requestJson<unknown>("/admin/v1/subsystem-registry", {
    token,
    userId
  });
  return filterStationParentSubsystems(
    unwrapList<AdminSubsystemRegistryItem>(payload).map((item) => normalizeSubsystemRegistryItem(item))
  );
}

export async function listStationInstances(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminStationInstanceList> {
  if (runtimeConfig.useMockData) {
    return assertStationInstanceListContract(listMockStationInstances(siteId), siteId);
  }
  const payload = await requestJson<unknown>(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/stations`,
    { token, userId }
  );
  return assertStationInstanceListContract(payload, siteId);
}

export async function updateStationInstances(
  token: string,
  userId: string | undefined,
  siteId: string,
  items: Partial<AdminStationInstance>[]
): Promise<AdminStationInstanceList> {
  const requiredStationIds = items.map((item) => String(item.stationId || "").trim()).filter(Boolean);
  if (runtimeConfig.useMockData) {
    return assertStationInstanceListContract(
      updateMockStationInstances(siteId, items, currentUserIdentity(token, userId)),
      siteId,
      requiredStationIds
    );
  }
  const payload = await requestJson<unknown>(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/stations`,
    {
      method: "PUT",
      token,
      userId,
      body: { items }
    }
  );
  return assertStationInstanceListContract(payload, siteId, requiredStationIds);
}

export async function getStationRuntimeBinding(
  token: string,
  userId: string | undefined,
  siteId: string,
  stationId: string
): Promise<AdminStationRuntimeBindingState> {
  if (runtimeConfig.useMockData) {
    return {
      siteId,
      stationId,
      binding: null,
      draftBinding: null,
      publishedBinding: null,
      draftVersion: null,
      publishedVersion: null,
      configured: false,
      validation: null
    };
  }
  const payload = await requestJson<unknown>(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/stations/${encodeURIComponent(stationId)}/runtime-binding`,
    { token, userId }
  );
  return normalizeStationRuntimeBindingState(payload, siteId, stationId);
}

type SaveStationRuntimeBindingInput = {
  expectedVersion: number;
  source: {
    databaseKey: string | null;
    projectKey: string | null;
    template: string | null;
  };
  selectors: {
    deviceIds: string[];
    deviceCodes: string[];
    pointCodes: string[];
  };
  notes?: string | null;
};

function assertRealBindingMutationAvailable(): void {
  if (runtimeConfig.useMockData) {
    throw new AdminApiError(
      501,
      "Local mock mode cannot validate or publish a real station runtime binding",
      "STATION_RUNTIME_BINDING_MOCK_BLOCKED"
    );
  }
}

export async function saveStationRuntimeBindingDraft(
  token: string,
  userId: string | undefined,
  siteId: string,
  stationId: string,
  input: SaveStationRuntimeBindingInput
): Promise<AdminStationRuntimeBindingState> {
  assertRealBindingMutationAvailable();
  const payload = await requestJson<unknown>(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/stations/${encodeURIComponent(stationId)}/runtime-binding`,
    { method: "PUT", token, userId, body: input }
  );
  return normalizeStationRuntimeBindingState(payload, siteId, stationId);
}

export async function validateStationRuntimeBindingDraft(
  token: string,
  userId: string | undefined,
  siteId: string,
  stationId: string,
  expectedVersion: number
): Promise<AdminStationRuntimeBindingState> {
  assertRealBindingMutationAvailable();
  try {
    const payload = await requestJson<unknown>(
      `/admin/v1/sites/${encodeURIComponent(siteId)}/stations/${encodeURIComponent(stationId)}/runtime-binding/validate`,
      { method: "POST", token, userId, body: { expectedVersion } }
    );
    return normalizeStationRuntimeBindingState(payload, siteId, stationId);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 422 && error.payload) {
      return normalizeStationRuntimeBindingState(error.payload, siteId, stationId);
    }
    throw error;
  }
}

export async function publishStationRuntimeBindingDraft(
  token: string,
  userId: string | undefined,
  siteId: string,
  stationId: string,
  expectedVersion: number
): Promise<AdminStationRuntimeBindingState> {
  assertRealBindingMutationAvailable();
  const payload = await requestJson<unknown>(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/stations/${encodeURIComponent(stationId)}/runtime-binding/publish`,
    { method: "POST", token, userId, body: { expectedVersion } }
  );
  return normalizeStationRuntimeBindingState(payload, siteId, stationId);
}

export async function updateSiteSubsystems(
  token: string,
  userId: string | undefined,
  siteId: string,
  items: Partial<AdminSiteSubsystemCapability>[]
): Promise<AdminSiteSubsystemCapability[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/subsystems`, {
    method: "PUT",
    token,
    userId,
    body: { items },
    fallback: () => updateMockSiteSubsystems(siteId, items, currentUserIdentity(token, userId))
  });
  return unwrapList<AdminSiteSubsystemCapability>(payload).map((item) => normalizeSiteSubsystemCapability(item));
}

export async function getSiteCapabilities(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminSiteSubsystemCapability[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/capabilities`, {
    token,
    userId,
    fallback: () => getMockSiteSubsystems(siteId)
  });
  return unwrapList<AdminSiteSubsystemCapability>(payload).map((item) => normalizeSiteSubsystemCapability(item));
}

export async function listPointRoleMappings(
  token: string,
  userId: string | undefined,
  siteId: string,
  query: { subsystemType?: string } = {}
): Promise<AdminPointRoleMapping[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/point-role-mappings`, {
    token,
    userId,
    query,
    fallback: () => getMockPointRoleMappings(siteId, query.subsystemType)
  });
  return unwrapList<AdminPointRoleMapping>(payload).map((item) => normalizePointRoleMapping(item));
}

export async function getFcuControlPolicy(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminFcuControlPolicy> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/control-policy`, {
    token,
    userId,
    fallback: () => ({ policy: normalizeFcuControlPolicy() })
  });
  const source =
    payload && typeof payload === "object" && "policy" in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).policy
      : payload;
  return normalizeFcuControlPolicy((source || {}) as Partial<AdminFcuControlPolicy>);
}

export async function updateFcuControlPolicy(
  token: string,
  userId: string | undefined,
  siteId: string,
  policy: Partial<AdminFcuControlPolicy>
): Promise<AdminFcuControlPolicy> {
  const normalized = normalizeFcuControlPolicy(policy);
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/control-policy`, {
    method: "PUT",
    token,
    userId,
    body: { policy: normalized },
    fallback: () => ({ policy: normalized })
  });
  const source =
    payload && typeof payload === "object" && "policy" in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).policy
      : payload;
  return normalizeFcuControlPolicy((source || {}) as Partial<AdminFcuControlPolicy>);
}

export async function getFcuFieldRemediationStatus(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminFcuFieldRemediationStatus> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-status`, {
    token,
    userId,
    fallback: () => buildFallbackFcuFieldRemediationStatus(siteId)
  });
  const record =
    payload && typeof payload === "object" && "summary" in (payload as Record<string, unknown>)
      ? payload
      : buildFallbackFcuFieldRemediationStatus(siteId);
  return record as AdminFcuFieldRemediationStatus;
}

export async function refreshFcuFieldRemediationStatus(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminFcuFieldRemediationRefreshResult> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-status/refresh`, {
    method: "POST",
    token,
    userId,
    body: {},
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      fileMutation: false,
      mode: "refresh",
      scripts: {
        finalControlGates: {
          script: "check-fcu-final-control-gates.js",
          status: 2,
          accepted: true
        }
      },
      status: buildFallbackFcuFieldRemediationStatus(siteId)
    })
  });
  return payload as AdminFcuFieldRemediationRefreshResult;
}

export async function previewFcuFieldRemediationSignoff(
  token: string,
  userId: string | undefined,
  siteId: string,
  signoffCsvText: string
): Promise<AdminFcuFieldRemediationSignoffPreview> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-signoff/preview`, {
    method: "POST",
    token,
    userId,
    body: { signoffCsvText },
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      persisted: false,
      mode: "preview",
      summary: {
        expectedWorkOrders: 8,
        csvRows: 0,
        signoffComplete: false,
        completeRows: 0,
        openRows: 8,
        missingColumns: [],
        missingWorkOrders: ["FCU-P0-BGS03", "FCU-P0-BGS04"],
        ignoredRows: 0,
        stillRequiresRealtimeCloseout: true
      },
      records: [],
      releaseMatrix: [],
      ignoredRecords: []
    })
  });
  return payload as AdminFcuFieldRemediationSignoffPreview;
}

export async function promoteFcuFieldRemediationSignoff(
  token: string,
  userId: string | undefined,
  siteId: string,
  signoffCsvText: string,
  confirmPhrase: string
): Promise<AdminFcuFieldRemediationSignoffPromoteResult> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-signoff/promote`, {
    method: "POST",
    token,
    userId,
    body: { signoffCsvText, confirmPhrase },
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      persisted: false,
      mode: "promote",
      confirmRequired: "I_APPROVE_REPLACE_FCU_SIGNOFF_INPUT",
      signoff: {
        ok: false,
        summary: {
          expectedWorkOrders: 8,
          signoffComplete: false,
          completeRows: 0,
          openRows: 8
        },
        openRecords: [],
        releaseMatrix: []
      },
      finalControlGates: {
        ok: false,
        summary: {
          passed: 0,
          gateCount: 8,
          blocked: 8,
          canaryReady: false
        },
        blockers: [],
        nextActions: []
      },
      finalControlRunbook: {
        ok: false,
        verdict: "final_dispatch_blocked",
        summary: {
          finalGatePassed: false,
          signoffCompleteRows: 0,
          signoffExpectedRows: 8
        },
        controlMutation: false,
        dispatch: false
      },
      evidenceConsistency: {
        ok: true,
        verdict: "evidence_consistent",
        summary: {
          issueCount: 0
        },
        issues: [],
        controlMutation: false,
        dispatch: false
      },
      refreshedStatus: buildFallbackFcuFieldRemediationStatus(siteId)
    })
  });
  return payload as AdminFcuFieldRemediationSignoffPromoteResult;
}

export async function cleanPromoteFcuFieldRemediationSignoff(
  token: string,
  userId: string | undefined,
  siteId: string,
  confirmPhrase: string
): Promise<AdminFcuSignoffCleanPromoteResult> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-signoff/clean-promote`, {
    method: "POST",
    token,
    userId,
    body: { confirmPhrase },
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      fileMutation: false,
      mode: "clean_promote",
      clean: {
        ok: false,
        summary: {
          staleRows: 0,
          currentRows: 0
        },
        staleRecords: []
      },
      signoff: {
        ok: false,
        summary: {
          ignoredRows: 0,
          signoffComplete: false
        },
        ignoredRecords: []
      },
      refreshedStatus: buildFallbackFcuFieldRemediationStatus(siteId)
    })
  });
  return payload as AdminFcuSignoffCleanPromoteResult;
}

export async function saveFcuFieldRemediationSignoffRow(
  token: string,
  userId: string | undefined,
  siteId: string,
  record: AdminFcuSignoffRowRecord,
  confirmPhrase: string
): Promise<AdminFcuSignoffRowSaveResult> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-remediation-signoff/row`, {
    method: "POST",
    token,
    userId,
    body: { record, confirmPhrase },
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      fileMutation: false,
      mode: "row_save",
      record,
      csvUpdate: {
        rowCount: 0,
        updatedExisting: false
      },
      signoff: {
        ok: false,
        summary: {
          signoffComplete: false,
          completeRows: 0,
          expectedWorkOrders: 8
        },
        openRecords: [],
        releaseMatrix: []
      },
      finalControlGates: {
        ok: false,
        summary: {
          passed: 0,
          gateCount: 8,
          canaryReady: false
        },
        blockers: [],
        nextActions: []
      },
      refreshedStatus: buildFallbackFcuFieldRemediationStatus(siteId)
    })
  });
  return payload as AdminFcuSignoffRowSaveResult;
}

export async function buildFcuFieldArmPackage(
  token: string,
  userId: string | undefined,
  siteId: string,
  deviceCode: string
): Promise<AdminFcuFieldArmPackageResult> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/hvac-terminal/fan-coils/field-arm-package`, {
    method: "POST",
    token,
    userId,
    body: { deviceCode },
    fallback: () => ({
      ok: false,
      controlMutation: false,
      dispatch: false,
      mode: "field_arm_package",
      deviceCode,
      fieldArmPackage: {
        ok: false,
        verdict: "field_arm_package_blocked",
        checklist: [],
        blockers: [{ key: "mock_blocked", label: "离线 mock 状态，不能生成真实开闸包", severity: "P0" }]
      },
      canaryExecutionPackage: {
        ok: false,
        verdict: "canary_package_blocked",
        blockers: []
      },
      canaryWindow: {
        ok: false,
        verdict: "canary_window_blocked",
        blockers: []
      }
    })
  });
  return payload as AdminFcuFieldArmPackageResult;
}

export async function updatePointRoleMappings(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: { subsystemType?: string; items: Partial<AdminPointRoleMapping>[] }
): Promise<AdminPointRoleMapping[]> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/point-role-mappings`, {
    method: "PUT",
    token,
    userId,
    body: payload,
    fallback: () => updateMockPointRoleMappings(siteId, payload, currentUserIdentity(token, userId))
  });
  return unwrapList<AdminPointRoleMapping>(record).map((item) => normalizePointRoleMapping(item));
}

export async function previewPointRoleMappingImport(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: { subsystemType?: string; text?: string; rows?: unknown[] }
): Promise<AdminPointRoleImportPreview> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/point-role-mappings/import-preview`, {
    method: "POST",
    token,
    userId,
    body: payload,
    fallback: () => getMockPointRoleImportPreview(siteId, payload)
  });
  const source =
    record && typeof record === "object" && "preview" in (record as Record<string, unknown>)
      ? (record as Record<string, unknown>).preview
      : record;
  return normalizePointRoleImportPreview((source || {}) as Partial<AdminPointRoleImportPreview>);
}

export async function listConfigVersions(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminConfigVersion[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/config-versions`, {
    token,
    userId,
    fallback: () => listMockConfigVersions(siteId)
  });
  return unwrapList<AdminConfigVersion>(payload).map((item) => normalizeConfigVersion(item));
}

export async function publishConfigVersion(
  token: string,
  userId: string | undefined,
  siteId: string,
  versionId: string,
  summary?: string
): Promise<AdminConfigVersionResult> {
  const record = await requestOrMock(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/config-versions/${encodeURIComponent(versionId)}/publish`,
    {
      method: "POST",
      token,
      userId,
      body: { summary },
      fallback: () => publishMockConfigVersion(siteId, versionId, summary, currentUserIdentity(token, userId))
    }
  );
  return unwrapRecord<AdminConfigVersionResult>(record) || (record as AdminConfigVersionResult);
}

export async function rollbackConfigVersion(
  token: string,
  userId: string | undefined,
  siteId: string,
  versionId: string
): Promise<AdminConfigVersionResult> {
  const record = await requestOrMock(
    `/admin/v1/sites/${encodeURIComponent(siteId)}/config-versions/${encodeURIComponent(versionId)}/rollback`,
    {
      method: "POST",
      token,
      userId,
      fallback: () => rollbackMockConfigVersion(siteId, versionId, currentUserIdentity(token, userId))
    }
  );
  return unwrapRecord<AdminConfigVersionResult>(record) || (record as AdminConfigVersionResult);
}

export async function getAdminSourceConfig(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminSourceConfig> {
  const bundle = await getAdminSourceConfigBundle(token, userId, siteId);
  return bundle.sourceConfig;
}

export async function getAdminSourceConfigBundle(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminSourceConfigBundle> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/source-config`, {
    token,
    userId,
    fallback: () => getMockSourceConfig(siteId)
  });
  return normalizeSourceConfigBundle(payload);
}

export async function updateAdminSourceConfig(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: Partial<AdminSourceConfig>
): Promise<AdminSourceConfig> {
  const bundle = await updateAdminSourceConfigBundle(token, userId, siteId, payload);
  return bundle.sourceConfig;
}

export async function updateAdminSourceConfigBundle(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: Partial<AdminSourceConfig>
): Promise<AdminSourceConfigBundle> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/source-config`, {
    method: "PUT",
    token,
    userId,
    body: payload,
    fallback: () => updateMockSourceConfig(siteId, payload, currentUserIdentity(token, userId))
  });
  return normalizeSourceConfigBundle(record);
}

export async function getAdminRuntimeConfig(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminRuntimeConfig> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/runtime-config`, {
    token,
    userId,
    fallback: () => getMockRuntimeConfig(siteId)
  });
  return normalizeRuntimeConfig(unwrapRecord<AdminRuntimeConfig>(payload) || {});
}

export async function updateAdminRuntimeConfig(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: Partial<AdminRuntimeConfig>
): Promise<AdminRuntimeConfig> {
  const requestBody = {
    energyParams: parseEditableJsonObject(payload.energyParamsJson, "energyParamsJson"),
    ruleThresholds: parseEditableJsonObject(payload.ruleThresholdsJson, "ruleThresholdsJson"),
    featureFlags: parseEditableJsonObject(payload.featureFlagsJson, "featureFlagsJson")
  };
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/runtime-config`, {
    method: "PUT",
    token,
    userId,
    body: requestBody,
    fallback: () => updateMockRuntimeConfig(siteId, payload, currentUserIdentity(token, userId))
  });
  return normalizeRuntimeConfig(unwrapRecord<AdminRuntimeConfig>(record) || payload);
}

export async function listAdminMembers(
  token: string,
  userId: string | undefined,
  siteId: string
): Promise<AdminMember[]> {
  const payload = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/members`, {
    token,
    userId,
    fallback: () => listMockMembers(siteId)
  });
  return unwrapList<AdminMember>(payload).map((member) => normalizeMember(member));
}

export async function createAdminMember(
  token: string,
  userId: string | undefined,
  siteId: string,
  payload: Partial<AdminMember>
): Promise<AdminMember> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/members`, {
    method: "POST",
    token,
    userId,
    body: payload,
    fallback: () =>
      createMockMember(
        siteId,
        {
          userId: String(payload.userId || "").trim(),
          username: String(payload.username || "").trim(),
          role: (payload.role || "site_admin") as AdminRole,
          scopeType: (payload.scopeType || "site") as AdminScopeType,
          scopeId: payload.scopeId,
          status: payload.status
        },
        currentUserIdentity(token, userId)
      )
  });
  return normalizeMember(unwrapRecord<AdminMember>(record) || payload);
}

export async function updateAdminMember(
  token: string,
  userId: string | undefined,
  siteId: string,
  bindingId: string,
  payload: Partial<AdminMember>
): Promise<AdminMember> {
  const record = await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/members/${encodeURIComponent(bindingId)}`, {
    method: "PUT",
    token,
    userId,
    body: payload,
    fallback: () => updateMockMember(siteId, bindingId, payload, currentUserIdentity(token, userId))
  });
  return normalizeMember(unwrapRecord<AdminMember>(record) || payload);
}

export async function deleteAdminMember(
  token: string,
  userId: string | undefined,
  siteId: string,
  bindingId: string
): Promise<void> {
  await requestOrMock(`/admin/v1/sites/${encodeURIComponent(siteId)}/members/${encodeURIComponent(bindingId)}`, {
    method: "DELETE",
    token,
    userId,
    fallback: () => {
      deleteMockMember(siteId, bindingId, currentUserIdentity(token, userId));
      return null;
    }
  });
}

export async function listAdminAuditLogs(
  token: string,
  userId: string | undefined,
  query: { siteId?: string; keyword?: string; action?: string } = {}
): Promise<AdminAuditLog[]> {
  const payload = await requestOrMock("/admin/v1/audit-logs", {
    token,
    userId,
    query: {
      siteId: query.siteId,
      action: query.action
    },
    fallback: () => getMockAuditLogs(query)
  });
  return unwrapList<AdminAuditLog>(payload).map((entry) => normalizeAuditLog(entry));
}
