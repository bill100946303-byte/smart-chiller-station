import { requestLegacy } from "../lib/http.js";

const DISPATCH_MODES = new Set(["off", "shadow", "assisted", "enforced"]);
const LEGACY_COMMAND_STRATEGIES = new Set(["device-reg-command", "multi-step-command"]);
const DEFAULT_TIMEOUT_MS = 8000;

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getByPath(source, path) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) {
    return undefined;
  }
  return normalizedPath.split(".").reduce((current, segment) => {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function formatNumber(value, digits) {
  const parsed = normalizeNumber(value);
  if (parsed === null) {
    return null;
  }
  return Number(parsed.toFixed(digits)).toFixed(digits);
}

function interpolateTemplate(template, context) {
  return normalizeText(template).replace(/\{([^{}]+)\}/g, (_match, key) => {
    const value = getByPath(context, key);
    if (value == null) {
      return "";
    }
    return String(value);
  });
}

function normalizeDispatchMode(value, fallback = "off") {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "read_only" || normalized === "readonly") {
    return "off";
  }
  return DISPATCH_MODES.has(normalized) ? normalized : fallback;
}

function normalizeDispatchTimeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 60_000);
}

function parseAbsoluteEndpoint(value) {
  const endpoint = normalizeText(value);
  if (!endpoint) {
    return null;
  }

  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return {
      baseUrl: `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, ""),
      path: `${parsed.pathname || "/"}${parsed.search || ""}`,
      endpoint: parsed.toString()
    };
  } catch (_error) {
    return null;
  }
}

function resolveRequestTarget(legacyBaseUrl, endpoint) {
  const absolute = parseAbsoluteEndpoint(endpoint);
  if (absolute) {
    return absolute;
  }

  const baseUrl = normalizeText(legacyBaseUrl).replace(/\/+$/, "");
  const path = normalizeText(endpoint);
  if (!baseUrl || !path) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return {
    baseUrl,
    path: normalizedPath,
    endpoint: `${baseUrl}${normalizedPath}`
  };
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

export function resolveTowerApproachDispatchConfig(siteConfig = {}) {
  const featureFlags =
    siteConfig?.siteRuntimeAdminConfig?.featureFlags &&
    typeof siteConfig.siteRuntimeAdminConfig.featureFlags === "object"
      ? siteConfig.siteRuntimeAdminConfig.featureFlags
      : {};
  const dispatchConfig =
    siteConfig?.towerApproach?.dispatch && typeof siteConfig.towerApproach.dispatch === "object"
      ? siteConfig.towerApproach.dispatch
      : {};
  const controlTargets =
    siteConfig?.towerApproach?.controlTargets && typeof siteConfig.towerApproach.controlTargets === "object"
      ? siteConfig.towerApproach.controlTargets
      : {};
  const approveTarget =
    controlTargets.approve && typeof controlTargets.approve === "object" ? controlTargets.approve : {};
  const rollbackTarget =
    controlTargets.rollback && typeof controlTargets.rollback === "object" ? controlTargets.rollback : {};

  const mode = normalizeDispatchMode(
    pickFirstNonEmpty(
      featureFlags.towerApproachDispatchMode,
      dispatchConfig.mode,
      process.env.TOWER_APPROACH_DISPATCH_MODE
    ) || "off"
  );

  const genericEndpoint = pickFirstNonEmpty(
    featureFlags.towerApproachDispatchEndpoint,
    dispatchConfig.endpoint,
    process.env.TOWER_APPROACH_DISPATCH_ENDPOINT
  );
  const approveEndpoint = pickFirstNonEmpty(
    featureFlags.towerApproachDispatchApproveEndpoint,
    dispatchConfig.approveEndpoint,
    process.env.TOWER_APPROACH_DISPATCH_APPROVE_ENDPOINT,
    approveTarget.endpoint,
    genericEndpoint
  );
  const rollbackEndpoint = pickFirstNonEmpty(
    featureFlags.towerApproachDispatchRollbackEndpoint,
    dispatchConfig.rollbackEndpoint,
    process.env.TOWER_APPROACH_DISPATCH_ROLLBACK_ENDPOINT,
    rollbackTarget.endpoint,
    genericEndpoint
  );

  return {
    mode,
    approveEndpoint: approveEndpoint || null,
    rollbackEndpoint: rollbackEndpoint || null,
    timeoutMs: normalizeDispatchTimeoutMs(
      pickFirstNonEmpty(
        String(featureFlags.towerApproachDispatchTimeoutMs ?? ""),
        String(dispatchConfig.timeoutMs ?? ""),
        process.env.TOWER_APPROACH_DISPATCH_TIMEOUT_MS
      ) || DEFAULT_TIMEOUT_MS
    )
  };
}

function nowIso() {
  return new Date().toISOString();
}

function buildSkippedReceipt({
  operation,
  mode,
  code,
  message,
  endpoint = null
}) {
  const timestamp = nowIso();
  return {
    operation,
    mode,
    status: "skipped",
    code,
    message,
    endpoint,
    submittedAt: timestamp,
    completedAt: timestamp,
    httpStatus: null,
    response: null
  };
}

function buildFailureReceipt({
  operation,
  mode,
  code,
  message,
  endpoint = null,
  submittedAt,
  httpStatus = null,
  response = null
}) {
  return {
    operation,
    mode,
    status: "failed",
    code,
    message,
    endpoint,
    submittedAt,
    completedAt: nowIso(),
    httpStatus,
    response
  };
}

function buildSuccessReceipt({
  operation,
  mode,
  endpoint,
  submittedAt,
  httpStatus,
  response,
  message = "tower approach dispatch completed"
}) {
  return {
    operation,
    mode,
    status: "succeeded",
    code: "DISPATCH_OK",
    message,
    endpoint,
    submittedAt,
    completedAt: nowIso(),
    httpStatus,
    response
  };
}

export function resolvePumpDeltaTDispatchConfig(siteConfig = {}) {
  const featureFlags =
    siteConfig?.siteRuntimeAdminConfig?.featureFlags &&
    typeof siteConfig.siteRuntimeAdminConfig.featureFlags === "object"
      ? siteConfig.siteRuntimeAdminConfig.featureFlags
      : {};
  const pumpDeltaT =
    siteConfig?.pumpDeltaT && typeof siteConfig.pumpDeltaT === "object"
      ? siteConfig.pumpDeltaT
      : {};
  const dispatchConfig =
    pumpDeltaT.dispatch && typeof pumpDeltaT.dispatch === "object"
      ? pumpDeltaT.dispatch
      : {};
  const rawMode = normalizeDispatchMode(
    pickFirstNonEmpty(
      featureFlags.pumpDeltaTDispatchMode,
      dispatchConfig.mode,
      pumpDeltaT.dispatchMode,
      process.env.PUMP_DELTA_T_DISPATCH_MODE
    ) || "shadow",
    "shadow"
  );
  const mode = rawMode === "enforced" ? "assisted" : rawMode;
  const genericEndpoint = pickFirstNonEmpty(
    featureFlags.pumpDeltaTDispatchEndpoint,
    dispatchConfig.endpoint,
    process.env.PUMP_DELTA_T_DISPATCH_ENDPOINT
  );
  const approveEndpoint = pickFirstNonEmpty(
    featureFlags.pumpDeltaTDispatchApproveEndpoint,
    dispatchConfig.approveEndpoint,
    process.env.PUMP_DELTA_T_DISPATCH_APPROVE_ENDPOINT,
    genericEndpoint
  );
  const rollbackEndpoint = pickFirstNonEmpty(
    featureFlags.pumpDeltaTDispatchRollbackEndpoint,
    dispatchConfig.rollbackEndpoint,
    process.env.PUMP_DELTA_T_DISPATCH_ROLLBACK_ENDPOINT,
    genericEndpoint
  );

  return {
    mode,
    rawMode,
    approveEndpoint: approveEndpoint || null,
    rollbackEndpoint: rollbackEndpoint || null,
    timeoutMs: normalizeDispatchTimeoutMs(
      pickFirstNonEmpty(
        String(featureFlags.pumpDeltaTDispatchTimeoutMs ?? ""),
        String(dispatchConfig.timeoutMs ?? ""),
        process.env.PUMP_DELTA_T_DISPATCH_TIMEOUT_MS
      ) || DEFAULT_TIMEOUT_MS
    )
  };
}

function buildShadowReceipt({
  operation,
  mode,
  execution
}) {
  const timestamp = nowIso();
  return {
    operation,
    mode,
    status: "succeeded",
    code: "DISPATCH_SHADOW_RECORDED",
    message: "tower approach shadow dispatch recorded; no PLC command sent",
    endpoint: null,
    submittedAt: timestamp,
    completedAt: timestamp,
    httpStatus: null,
    response: {
      shadow: true,
      command: buildDispatchCommand(execution, operation)
    }
  };
}

function buildDispatchCommand(execution = {}, operation = "approve") {
  const executionPayload = execution?.execution && typeof execution.execution === "object" ? execution.execution : {};
  const rollbackTarget =
    executionPayload?.rollbackTarget && typeof executionPayload.rollbackTarget === "object"
      ? executionPayload.rollbackTarget
      : null;
  return {
    executionType: executionPayload.type || null,
    targetApproachC: executionPayload.targetApproachC ?? null,
    targetTcwsC: executionPayload.targetTcwsC ?? null,
    rollbackTarget:
      rollbackTarget
      ? {
          mode: rollbackTarget.mode || null,
          targetApproachC: rollbackTarget.targetApproachC ?? null,
          targetTcwsC: rollbackTarget.targetTcwsC ?? null,
          reason: rollbackTarget.reason || null
        }
      : null,
    operationCommand: operation === "rollback" ? "rollback_tower_approach" : "apply_tower_approach"
  };
}

function buildPumpDeltaTDispatchCommand(execution = {}, operation = "approve") {
  const executionPayload = execution?.execution && typeof execution.execution === "object" ? execution.execution : {};
  const rollbackTarget =
    executionPayload?.rollbackTarget && typeof executionPayload.rollbackTarget === "object"
      ? executionPayload.rollbackTarget
      : null;
  return {
    executionType: executionPayload.type || null,
    targetPoints: {
      chilledPump: "AI_ChwpFreqTrim_Hz",
      coolingPump: "AI_CwpFreqTrim_Hz"
    },
    targetChwpFreqTrimHz: executionPayload.targetChwpFreqTrimHz ?? null,
    targetCwpFreqTrimHz: executionPayload.targetCwpFreqTrimHz ?? null,
    ttlSeconds: executionPayload.ttlSeconds ?? 300,
    holdMinutes: executionPayload.holdMinutes ?? 5,
    rollbackLockoutMinutes: executionPayload.rollbackLockoutMinutes ?? 15,
    rollbackTarget:
      rollbackTarget
      ? {
          mode: rollbackTarget.mode || null,
          targetChwpFreqTrimHz: rollbackTarget.targetChwpFreqTrimHz ?? 0,
          targetCwpFreqTrimHz: rollbackTarget.targetCwpFreqTrimHz ?? 0,
          reason: rollbackTarget.reason || null
        }
      : {
          mode: "zero-trim",
          targetChwpFreqTrimHz: 0,
          targetCwpFreqTrimHz: 0,
          reason: "rollback pump trim to 0 Hz"
        },
    operationCommand: operation === "rollback" ? "rollback_pump_delta_t_trim" : "apply_pump_delta_t_trim"
  };
}

function buildPumpDeltaTShadowReceipt({
  operation,
  mode,
  execution
}) {
  const timestamp = nowIso();
  return {
    operation,
    mode,
    status: "succeeded",
    code: mode === "assisted" ? "DISPATCH_ASSISTED_RECORDED" : "DISPATCH_SHADOW_RECORDED",
    message:
      mode === "assisted"
        ? "pump delta-t assisted dispatch recorded; no PLC command sent without downstream endpoint"
        : "pump delta-t shadow dispatch recorded; no PLC command sent",
    endpoint: null,
    submittedAt: timestamp,
    completedAt: timestamp,
    httpStatus: null,
    response: {
      shadow: mode !== "assisted",
      command: buildPumpDeltaTDispatchCommand(execution, operation)
    }
  };
}

function isLegacyDointerfacesEndpoint(endpoint) {
  return /\/zsqy\/qstag\/[^/?]+\/doimplements(?:\?|$)/i.test(normalizeText(endpoint));
}

function resolveLegacyProjectKey(siteConfig = {}, siteId = "") {
  const sourceConfig = isPlainObject(siteConfig.siteSourceConfig) ? siteConfig.siteSourceConfig : {};
  return pickFirstNonEmpty(
    sourceConfig.databaseKey,
    sourceConfig.deviceDataProjectKey,
    sourceConfig.projectKey,
    sourceConfig.preferredProjectKey,
    sourceConfig.modelKey,
    siteConfig.databaseKey,
    siteConfig.projectKey,
    siteId
  );
}

function resolveLegacyAppId(siteConfig = {}, siteId = "") {
  const sourceConfig = isPlainObject(siteConfig.siteSourceConfig) ? siteConfig.siteSourceConfig : {};
  return pickFirstNonEmpty(
    sourceConfig.legacyAppId,
    sourceConfig.appId,
    siteConfig.legacyAppId,
    siteConfig.appId,
    siteId
  );
}

function resolveLegacyTemplate(siteConfig = {}) {
  const sourceConfig = isPlainObject(siteConfig.siteSourceConfig) ? siteConfig.siteSourceConfig : {};
  return pickFirstNonEmpty(sourceConfig.template, siteConfig.template, "1");
}

function resolveControlTargetMapping(siteConfig = {}, operation = "approve") {
  const towerApproach = isPlainObject(siteConfig.towerApproach) ? siteConfig.towerApproach : {};
  const controlTargets = isPlainObject(towerApproach.controlTargets) ? towerApproach.controlTargets : {};
  const mappedOperation = operation === "rollback" ? "rollback" : "approve";
  const target = isPlainObject(controlTargets[mappedOperation]) ? controlTargets[mappedOperation] : null;
  return {
    mappedOperation,
    target
  };
}

function normalizeCommandList(target) {
  if (!isPlainObject(target)) {
    return [];
  }
  const commands = [];
  if (Array.isArray(target.preCommands)) {
    commands.push(...target.preCommands.filter(isPlainObject));
  }
  if (Array.isArray(target.commands) && target.commands.length > 0) {
    commands.push(...target.commands.filter(isPlainObject));
  } else if (
    normalizeText(target.drTypeId) ||
    normalizeText(target.drId) ||
    normalizeText(target.tagName) ||
    normalizeText(target.valueSource)
  ) {
    commands.push(target);
  }
  if (Array.isArray(target.postCommands)) {
    commands.push(...target.postCommands.filter(isPlainObject));
  }
  return commands;
}

function appendSearchParams(path, values) {
  const normalizedPath = normalizeText(path);
  const [pathname, searchText = ""] = normalizedPath.split("?");
  const search = new URLSearchParams(searchText);
  Object.entries(values).forEach(([key, value]) => {
    if (value != null) {
      search.set(key, String(value));
    }
  });
  const serialized = search.toString();
  return `${pathname || "/"}${serialized ? `?${serialized}` : ""}`;
}

function resolveCommandValue(rawValue, command = {}) {
  const transform = normalizeText(command.valueTransform) || "identity";
  if (rawValue == null || rawValue === "") {
    return {
      ok: false,
      value: null,
      message: `valueSource=${normalizeText(command.valueSource) || "--"} 没有可用值`
    };
  }
  if (transform === "round1") {
    const rounded = formatNumber(rawValue, 1);
    return rounded === null
      ? { ok: false, value: null, message: `${normalizeText(command.valueSource)} 不是数值` }
      : { ok: true, value: rounded, message: null };
  }
  if (transform === "round0") {
    const rounded = formatNumber(rawValue, 0);
    return rounded === null
      ? { ok: false, value: null, message: `${normalizeText(command.valueSource)} 不是数值` }
      : { ok: true, value: rounded, message: null };
  }
  if (transform === "clamp") {
    const parsed = normalizeNumber(rawValue);
    if (parsed === null) {
      return { ok: false, value: null, message: `${normalizeText(command.valueSource)} 不是数值` };
    }
    const minValue = normalizeNumber(command.minValue);
    const maxValue = normalizeNumber(command.maxValue);
    const decimalPlaces = normalizeNumber(command.decimalPlaces);
    const clamped = Math.min(maxValue ?? parsed, Math.max(minValue ?? parsed, parsed));
    if (decimalPlaces !== null) {
      return { ok: true, value: formatNumber(clamped, Math.max(0, Math.min(6, decimalPlaces))), message: null };
    }
    return { ok: true, value: String(clamped), message: null };
  }
  return {
    ok: true,
    value: String(rawValue),
    message: null
  };
}

function buildLegacyInterpolationContext({
  siteConfig,
  siteId,
  execution,
  operation,
  actorUserId,
  requestId,
  command = {},
  value = null
}) {
  const executionPayload = isPlainObject(execution?.execution) ? execution.execution : {};
  const projectKey = resolveLegacyProjectKey(siteConfig, siteId);
  const appId = resolveLegacyAppId(siteConfig, siteId);
  const rollbackTarget = isPlainObject(executionPayload.rollbackTarget) ? { ...executionPayload.rollbackTarget } : {};
  const executionContext = {
    ...executionPayload,
    rollbackTarget
  };
  return {
    siteId: projectKey,
    requestedSiteId: normalizeText(siteId),
    projectKey,
    databaseKey: projectKey,
    appId,
    legacyAppId: appId,
    executionId: normalizeText(execution?.executionId),
    actorUserId: normalizeText(actorUserId),
    requestId: normalizeText(requestId),
    operation,
    execution: executionContext,
    targetApproachC: executionContext.targetApproachC ?? null,
    targetTcwsC: executionContext.targetTcwsC ?? null,
    rollbackTarget,
    command,
    deviceName: normalizeText(command.deviceName || command.drName || command.drTypeName || command.tagName),
    drTypeId: normalizeText(command.drTypeId),
    drTypeName: normalizeText(command.drTypeName),
    drId: normalizeText(command.drId),
    drName: normalizeText(command.drName),
    tagName: normalizeText(command.tagName),
    value,
    valueId: value,
    targetValue: value
  };
}

function applyResolvedValueToContext(context, valueSource, value) {
  const normalized = normalizeText(valueSource);
  if (!normalized || value == null) {
    return context;
  }
  if (normalized === "targetTcwsC" || normalized === "execution.targetTcwsC") {
    context.targetTcwsC = value;
    context.execution.targetTcwsC = value;
    return context;
  }
  if (normalized === "targetApproachC" || normalized === "execution.targetApproachC") {
    context.targetApproachC = value;
    context.execution.targetApproachC = value;
    return context;
  }
  if (
    normalized === "rollbackTarget.targetTcwsC" ||
    normalized === "execution.rollbackTarget.targetTcwsC"
  ) {
    context.rollbackTarget.targetTcwsC = value;
    context.execution.rollbackTarget.targetTcwsC = value;
    return context;
  }
  if (
    normalized === "rollbackTarget.targetApproachC" ||
    normalized === "execution.rollbackTarget.targetApproachC"
  ) {
    context.rollbackTarget.targetApproachC = value;
    context.execution.rollbackTarget.targetApproachC = value;
    return context;
  }
  return context;
}

function resolveLegacyControlEndpoint({
  endpoint,
  dispatchConfig,
  siteConfig,
  siteId,
  operation
}) {
  const fallback = operation === "rollback" ? dispatchConfig.rollbackEndpoint : dispatchConfig.approveEndpoint;
  const rawEndpoint = pickFirstNonEmpty(endpoint, fallback);
  const context = buildLegacyInterpolationContext({
    siteConfig,
    siteId,
    execution: {},
    operation
  });
  return interpolateTemplate(rawEndpoint, context);
}

export function buildTowerApproachLegacyControlRequests(options = {}) {
  const operation = normalizeOperation(options.operation) || "approve";
  const siteConfig = isPlainObject(options.siteConfig) ? options.siteConfig : {};
  const execution = isPlainObject(options.execution) ? options.execution : {};
  const siteId = normalizeText(options.siteId);
  const dispatchConfig = options.dispatchConfig || resolveTowerApproachDispatchConfig(siteConfig);
  const { mappedOperation, target } = resolveControlTargetMapping(siteConfig, operation);
  const endpoint = resolveLegacyControlEndpoint({
    endpoint: target?.endpoint,
    dispatchConfig,
    siteConfig,
    siteId,
    operation
  });
  const strategy = normalizeText(target?.strategy);
  const blockers = [];

  if (!isPlainObject(target)) {
    blockers.push(`${mappedOperation} 映射缺失`);
  }
  if (!endpoint) {
    blockers.push(`${mappedOperation}.endpoint 缺失`);
  }
  if (!strategy) {
    blockers.push(`${mappedOperation}.strategy 缺失`);
  } else if (!LEGACY_COMMAND_STRATEGIES.has(strategy)) {
    blockers.push(`${mappedOperation}.strategy=${strategy} 不能用于 legacy doimplements`);
  }

  const commands = normalizeCommandList(target);
  if (commands.length === 0) {
    blockers.push(`${mappedOperation}.commands 缺失`);
  }

  const requestTarget = resolveRequestTarget(siteConfig.legacyBaseUrl, endpoint);
  if (!requestTarget) {
    blockers.push(`${mappedOperation}.endpoint 无法解析为可请求地址`);
  }

  const projectKey = resolveLegacyProjectKey(siteConfig, siteId);
  const appId = resolveLegacyAppId(siteConfig, siteId);
  const sourceConfig = isPlainObject(siteConfig.siteSourceConfig) ? siteConfig.siteSourceConfig : {};
  const userId = pickFirstNonEmpty(
    target?.userId,
    target?.requiredValues?.userId,
    sourceConfig.legacyUserId,
    siteConfig.legacyUserId,
    "150"
  );
  const template = pickFirstNonEmpty(target?.template, resolveLegacyTemplate(siteConfig), "1");
  const commandTemplate =
    normalizeText(target?.commandTemplate) || normalizeText(target?.msgTemplate) || normalizeText(target?.msg);
  if (!commandTemplate) {
    blockers.push(`${mappedOperation}.commandTemplate/msgTemplate 缺失`);
  }

  const requests = commands.map((command, index) => {
    const fieldPrefix = `${mappedOperation}.commands[${index}]`;
    const valueSource = normalizeText(command.valueSource);
    const rawValue =
      valueSource
        ? getByPath(
            buildLegacyInterpolationContext({
              siteConfig,
              siteId,
              execution,
              operation,
              actorUserId: options.actorUserId,
              requestId: options.requestId,
              command
            }),
            valueSource
          )
        : command.fixedValue;
    const valueResult = resolveCommandValue(rawValue, command);
    if (!normalizeText(command.drTypeId)) {
      blockers.push(`${fieldPrefix}.drTypeId 缺失`);
    }
    if (!normalizeText(command.drId)) {
      blockers.push(`${fieldPrefix}.drId 缺失`);
    }
    if (!normalizeText(command.tagName)) {
      blockers.push(`${fieldPrefix}.tagName 缺失`);
    }
    if (!valueSource && command.fixedValue == null) {
      blockers.push(`${fieldPrefix}.valueSource 缺失`);
    }
    if (!valueResult.ok) {
      blockers.push(`${fieldPrefix}.${valueResult.message}`);
    }

    const context = applyResolvedValueToContext(buildLegacyInterpolationContext({
      siteConfig,
      siteId,
      execution,
      operation,
      actorUserId: options.actorUserId,
      requestId: options.requestId,
      command,
      value: valueResult.value
    }), valueSource, valueResult.value);
    const msg = interpolateTemplate(
      normalizeText(command.commandTemplate) ||
        normalizeText(command.msgTemplate) ||
        normalizeText(command.msg) ||
        commandTemplate,
      context
    );
    const path = requestTarget
      ? appendSearchParams(requestTarget.path, {
          userId,
          appId,
          drTypeId: normalizeText(command.drTypeId),
          drId: normalizeText(command.drId),
          msg,
          language: normalizeText(command.language) || normalizeText(target?.language) || "zh",
          unit: normalizeText(command.unit) || normalizeText(target?.unit) || "KW",
          modelKey: projectKey,
          template
        })
      : null;

    return {
      index,
      baseUrl: requestTarget?.baseUrl || null,
      path,
      endpoint: requestTarget && path ? `${requestTarget.baseUrl}${path}` : null,
      command: {
        drTypeId: normalizeText(command.drTypeId),
        drId: normalizeText(command.drId),
        drName: normalizeText(command.drName) || null,
        tagName: normalizeText(command.tagName),
        valueSource: valueSource || null,
        value: valueResult.value,
        msg
      }
    };
  });

  return {
    ok: blockers.length === 0,
    code: blockers.length === 0 ? "OK" : "DISPATCH_CONTROL_MAPPING_INCOMPLETE",
    strategy: strategy || "device-reg-command",
    endpoint: requestTarget?.endpoint || endpoint || null,
    blockers,
    requests
  };
}

async function postDispatchRequest(target, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await requestLegacy(target.baseUrl, target.path, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return response;
  } catch (error) {
    return {
      ok: false,
      status: null,
      payload: null,
      error: `dispatch request failed: ${String(error)}`,
      url: target.endpoint
    };
  } finally {
    clearTimeout(timer);
  }
}

async function getLegacyControlRequest(target, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await requestLegacy(target.baseUrl, target.path, {
      signal: controller.signal
    });
    return response;
  } catch (error) {
    return {
      ok: false,
      status: null,
      payload: null,
      error: `dispatch request failed: ${String(error)}`,
      url: target.endpoint
    };
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchLegacyControlRequests(plan, timeoutMs) {
  const results = [];
  for (const request of plan.requests) {
    const response = await getLegacyControlRequest(request, timeoutMs);
    const responsePayload = response?.payload || null;
    results.push({
      index: request.index,
      endpoint: request.endpoint,
      command: request.command,
      ok: Boolean(response?.ok) && isDispatchAccepted(responsePayload),
      status: response?.status ?? null,
      error: response?.ok ? null : response?.error || null,
      response: responsePayload
    });
    if (!response?.ok || !isDispatchAccepted(responsePayload)) {
      break;
    }
  }
  const failed = results.find((item) => !item.ok);
  return {
    ok: !failed && results.length === plan.requests.length,
    failed,
    results
  };
}

function isDispatchAccepted(responsePayload) {
  if (!responsePayload || typeof responsePayload !== "object") {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(responsePayload, "ok")) {
    return responsePayload.ok !== false;
  }
  if (Object.prototype.hasOwnProperty.call(responsePayload, "success")) {
    return responsePayload.success !== false;
  }
  return true;
}

function normalizeOperation(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "approve" || normalized === "dispatch" || normalized === "rollback") {
    return normalized;
  }
  return null;
}

export async function dispatchTowerApproachExecution(options = {}) {
  const operation = normalizeOperation(options.operation);
  const execution = options.execution && typeof options.execution === "object" ? options.execution : null;
  const dispatchConfig = resolveTowerApproachDispatchConfig(options.siteConfig || {});
  const mode = dispatchConfig.mode;

  if (!operation) {
    return buildSkippedReceipt({
      operation: null,
      mode,
      code: "DISPATCH_OPERATION_UNSUPPORTED",
      message: "dispatch operation must be approve, dispatch, or rollback"
    });
  }

  if (!execution || execution?.execution?.type !== "tower-approach") {
    return buildSkippedReceipt({
      operation,
      mode,
      code: "DISPATCH_NOT_APPLICABLE",
      message: "execution is not tower-approach"
    });
  }

  if (mode === "off") {
    return buildSkippedReceipt({
      operation,
      mode,
      code: "DISPATCH_DISABLED",
      message: "tower approach dispatch mode is off"
    });
  }

  if (mode === "shadow") {
    return buildShadowReceipt({
      operation,
      mode,
      execution
    });
  }

  const { target: controlTarget } = resolveControlTargetMapping(options.siteConfig || {}, operation);
  const endpoint = resolveLegacyControlEndpoint({
    endpoint: controlTarget?.endpoint,
    dispatchConfig,
    siteConfig: options.siteConfig || {},
    siteId: options.siteId,
    operation
  });
  const usesLegacyDointerfaces =
    isLegacyDointerfacesEndpoint(endpoint) ||
    LEGACY_COMMAND_STRATEGIES.has(normalizeText(controlTarget?.strategy));

  if (usesLegacyDointerfaces) {
    const plan = buildTowerApproachLegacyControlRequests({
      siteConfig: options.siteConfig || {},
      siteId: options.siteId,
      execution,
      operation,
      actorUserId: options.actorUserId,
      requestId: options.requestId,
      dispatchConfig
    });
    const submittedAt = nowIso();
    if (!plan.ok) {
      return buildFailureReceipt({
        operation,
        mode,
        code: "DISPATCH_CONTROL_MAPPING_INCOMPLETE",
        message: "tower approach control target mapping is incomplete",
        endpoint: plan.endpoint,
        submittedAt,
        response: {
          blockers: plan.blockers,
          strategy: plan.strategy
        }
      });
    }

    const dispatchResult = await dispatchLegacyControlRequests(plan, dispatchConfig.timeoutMs);
    if (!dispatchResult.ok) {
      return buildFailureReceipt({
        operation,
        mode,
        code: "DISPATCH_HTTP_ERROR",
        message: dispatchResult.failed?.error || "tower approach legacy control command failed",
        endpoint: dispatchResult.failed?.endpoint || plan.endpoint,
        submittedAt,
        httpStatus: dispatchResult.failed?.status ?? null,
        response: {
          strategy: plan.strategy,
          legacyDoimplements: true,
          blockers: [],
          results: dispatchResult.results
        }
      });
    }

    return buildSuccessReceipt({
      operation,
      mode,
      endpoint: plan.endpoint,
      submittedAt,
      httpStatus: dispatchResult.results.at(-1)?.status ?? null,
      response: {
        strategy: plan.strategy,
        legacyDoimplements: true,
        commandCount: plan.requests.length,
        results: dispatchResult.results
      }
    });
  }

  const target = resolveRequestTarget(options.siteConfig?.legacyBaseUrl, endpoint);
  if (!target) {
    return buildFailureReceipt({
      operation,
      mode,
      code: "DISPATCH_ENDPOINT_MISSING",
      message: "tower approach dispatch endpoint is not configured",
      endpoint: normalizeNullableText(endpoint),
      submittedAt: nowIso()
    });
  }

  const command = buildDispatchCommand(execution, operation);
  const payload = {
    siteId: normalizeNullableText(options.siteId),
    executionId: normalizeNullableText(execution.executionId),
    requestedAt: nowIso(),
    actorUserId: normalizeNullableText(options.actorUserId),
    requestId: normalizeNullableText(options.requestId),
    command
  };
  const submittedAt = nowIso();
  const response = await postDispatchRequest(target, payload, dispatchConfig.timeoutMs);
  const responsePayload = response?.payload || null;

  if (!response?.ok) {
    return buildFailureReceipt({
      operation,
      mode,
      code: "DISPATCH_HTTP_ERROR",
      message: response?.error || "tower approach dispatch request failed",
      endpoint: target.endpoint,
      submittedAt,
      httpStatus: response?.status ?? null,
      response: responsePayload
    });
  }

  if (!isDispatchAccepted(responsePayload)) {
    return buildFailureReceipt({
      operation,
      mode,
      code: "DISPATCH_REJECTED",
      message: "tower approach dispatch rejected by downstream endpoint",
      endpoint: target.endpoint,
      submittedAt,
      httpStatus: response.status ?? null,
      response: responsePayload
    });
  }

  return buildSuccessReceipt({
    operation,
    mode,
    endpoint: target.endpoint,
    submittedAt,
    httpStatus: response.status ?? null,
    response: responsePayload
  });
}

export async function dispatchPumpDeltaTExecution(options = {}) {
  const operation = normalizeOperation(options.operation);
  const execution = options.execution && typeof options.execution === "object" ? options.execution : null;
  const dispatchConfig = resolvePumpDeltaTDispatchConfig(options.siteConfig || {});
  const mode = dispatchConfig.mode;

  if (!operation) {
    return buildSkippedReceipt({
      operation: null,
      mode,
      code: "DISPATCH_OPERATION_UNSUPPORTED",
      message: "dispatch operation must be approve, dispatch, or rollback"
    });
  }

  if (!execution || execution?.execution?.type !== "pump-delta-t") {
    return buildSkippedReceipt({
      operation,
      mode,
      code: "DISPATCH_NOT_APPLICABLE",
      message: "execution is not pump-delta-t"
    });
  }

  if (mode === "off") {
    return buildSkippedReceipt({
      operation,
      mode,
      code: "DISPATCH_DISABLED",
      message: "pump delta-t dispatch mode is off"
    });
  }

  if (mode === "shadow") {
    return buildPumpDeltaTShadowReceipt({
      operation,
      mode,
      execution
    });
  }

  const endpoint = operation === "rollback" ? dispatchConfig.rollbackEndpoint : dispatchConfig.approveEndpoint;
  const target = resolveRequestTarget(options.siteConfig?.legacyBaseUrl, endpoint);
  if (!target) {
    return buildPumpDeltaTShadowReceipt({
      operation,
      mode,
      execution
    });
  }

  const command = buildPumpDeltaTDispatchCommand(execution, operation);
  const payload = {
    siteId: normalizeNullableText(options.siteId),
    executionId: normalizeNullableText(execution.executionId),
    requestedAt: nowIso(),
    actorUserId: normalizeNullableText(options.actorUserId),
    requestId: normalizeNullableText(options.requestId),
    command
  };
  const submittedAt = nowIso();
  const response = await postDispatchRequest(target, payload, dispatchConfig.timeoutMs);
  const responsePayload = response?.payload || null;

  if (!response?.ok) {
    return buildFailureReceipt({
      operation,
      mode,
      code: "DISPATCH_HTTP_ERROR",
      message: response?.error || "pump delta-t dispatch request failed",
      endpoint: target.endpoint,
      submittedAt,
      httpStatus: response?.status ?? null,
      response: responsePayload
    });
  }

  if (!isDispatchAccepted(responsePayload)) {
    return buildFailureReceipt({
      operation,
      mode,
      code: "DISPATCH_REJECTED",
      message: "pump delta-t dispatch rejected by downstream endpoint",
      endpoint: target.endpoint,
      submittedAt,
      httpStatus: response.status ?? null,
      response: responsePayload
    });
  }

  return buildSuccessReceipt({
    operation,
    mode,
    endpoint: target.endpoint,
    submittedAt,
    httpStatus: response.status ?? null,
    response: responsePayload,
    message: "pump delta-t dispatch completed"
  });
}
