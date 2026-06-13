const EXECUTION_TYPES = new Set(["scheme", "tower-approach", "pump-delta-t"]);
const EXECUTION_STATUSES = new Set(["pending_approval", "approved", "rolled_back"]);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PUMP_FREQ_TRIM_MIN_HZ = -5;
const PUMP_FREQ_TRIM_MAX_HZ = 3;
const STORE = new Map();

function nowIso() {
  return new Date().toISOString();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeActions(value, maxLength = 8) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set();
  const items = [];
  for (const item of value) {
    if (items.length >= maxLength) {
      break;
    }
    const text = normalizeText(item);
    if (!text || unique.has(text)) {
      continue;
    }
    unique.add(text);
    items.push(text);
  }
  return items;
}

function normalizeTextList(value, maxLength = 12) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set();
  const items = [];
  for (const item of value) {
    if (items.length >= maxLength) {
      break;
    }
    const text = normalizeText(item);
    if (!text || unique.has(text)) {
      continue;
    }
    unique.add(text);
    items.push(text);
  }
  return items;
}

function normalizeGuardrailSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return {
    key: normalizeOptionalText(value.key),
    status: normalizeOptionalText(value.status),
    value:
      typeof value.value === "number" && Number.isFinite(value.value)
        ? value.value
        : normalizeOptionalText(value.value),
    message: normalizeOptionalText(value.message),
    resolvedBy: normalizeOptionalText(value.resolvedBy),
    matchedKeys: normalizeTextList(value.matchedKeys, 12)
  };
}

function normalizeEquipmentContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      activeChillerIds: [],
      activeChillerModels: []
    };
  }
  return {
    activeChillerIds: normalizeTextList(value.activeChillerIds, 12),
    activeChillerModels: normalizeTextList(value.activeChillerModels, 12)
  };
}

function normalizeRollbackTarget(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const mode = normalizeOptionalText(value.mode);
  const targetTcwsC = normalizeFiniteNumber(value.targetTcwsC);
  const targetApproachC = normalizeFiniteNumber(value.targetApproachC);
  const targetChwpFreqTrimHz = normalizeFiniteNumber(value.targetChwpFreqTrimHz);
  const targetCwpFreqTrimHz = normalizeFiniteNumber(value.targetCwpFreqTrimHz);
  const reason = normalizeOptionalText(value.reason);
  if (
    !mode &&
    targetTcwsC === null &&
    targetApproachC === null &&
    targetChwpFreqTrimHz === null &&
    targetCwpFreqTrimHz === null &&
    !reason
  ) {
    return null;
  }
  const target = {
    mode: mode || "manual",
    targetTcwsC,
    targetApproachC,
    reason
  };
  if (targetChwpFreqTrimHz !== null) {
    target.targetChwpFreqTrimHz = targetChwpFreqTrimHz;
  }
  if (targetCwpFreqTrimHz !== null) {
    target.targetCwpFreqTrimHz = targetCwpFreqTrimHz;
  }
  return target;
}

function normalizeDispatchReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const status = normalizeText(value.status).toLowerCase();
  if (status !== "succeeded" && status !== "failed" && status !== "skipped") {
    return null;
  }
  const operation = normalizeText(value.operation).toLowerCase();
  if (operation !== "approve" && operation !== "dispatch" && operation !== "rollback") {
    return null;
  }
  const mode = normalizeText(value.mode).toLowerCase();
  return {
    operation,
    mode: mode || "off",
    status,
    code: normalizeOptionalText(value.code),
    message: normalizeOptionalText(value.message),
    endpoint: normalizeOptionalText(value.endpoint),
    submittedAt: normalizeOptionalText(value.submittedAt),
    completedAt: normalizeOptionalText(value.completedAt),
    httpStatus:
      typeof value.httpStatus === "number" && Number.isFinite(value.httpStatus)
        ? value.httpStatus
        : normalizeFiniteNumber(value.httpStatus),
    response:
      value.response && typeof value.response === "object" && !Array.isArray(value.response)
        ? deepClone(value.response)
        : null
  };
}

function normalizeFeedbackSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const baseline = value.baseline && typeof value.baseline === "object" && !Array.isArray(value.baseline)
    ? deepClone(value.baseline)
    : {};
  const freshness = value.freshness && typeof value.freshness === "object" && !Array.isArray(value.freshness)
    ? deepClone(value.freshness)
    : {};
  const sourceStatus =
    value.sourceStatus && typeof value.sourceStatus === "object" && !Array.isArray(value.sourceStatus)
      ? deepClone(value.sourceStatus)
      : {};
  const phase = normalizeOptionalText(value.phase);
  const capturedAt = normalizeOptionalText(value.capturedAt);
  if (!phase && !capturedAt && !Object.keys(baseline).length && !Object.keys(freshness).length && !Object.keys(sourceStatus).length) {
    return null;
  }
  return {
    phase: phase || null,
    capturedAt: capturedAt || null,
    baseline,
    freshness,
    sourceStatus
  };
}

function normalizeDraftBaseline(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const baseline = {
    systemCop: normalizeFiniteNumber(value.systemCop),
    totalPowerKw: normalizeFiniteNumber(value.totalPowerKw),
    activeAlarmCount: normalizeFiniteNumber(value.activeAlarmCount),
    thermalUnbalanceRate: normalizeFiniteNumber(value.thermalUnbalanceRate)
  };
  if (Object.values(baseline).every((item) => item === null)) {
    return null;
  }
  return baseline;
}

function mergeExecutionDispatchState(existingExecution, stage, receipt, timestamp) {
  if (!receipt) {
    return existingExecution;
  }
  const execution = existingExecution && typeof existingExecution === "object" ? existingExecution : {};
  const previousDispatch =
    execution.dispatch && typeof execution.dispatch === "object" && !Array.isArray(execution.dispatch)
      ? execution.dispatch
      : {};
  const nextDispatch = {
    ...previousDispatch,
    updatedAt: timestamp
  };
  if (stage === "approve") {
    nextDispatch.lastApprove = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "applied" : "apply_pending";
  }
  if (stage === "dispatch") {
    nextDispatch.lastDispatch = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "applied" : "apply_pending";
  }
  if (stage === "rollback") {
    nextDispatch.lastRollback = receipt;
    nextDispatch.latestStatus = receipt.status === "succeeded" ? "rolled_back" : "rollback_pending";
  }
  return {
    ...execution,
    dispatch: nextDispatch
  };
}

function mergeExecutionFeedbackState(existingExecution, stage, snapshot) {
  const normalizedSnapshot = normalizeFeedbackSnapshot(snapshot);
  if (!normalizedSnapshot) {
    return existingExecution;
  }
  const execution = existingExecution && typeof existingExecution === "object" ? existingExecution : {};
  const previousFeedbackSnapshots =
    execution.feedbackSnapshots && typeof execution.feedbackSnapshots === "object" && !Array.isArray(execution.feedbackSnapshots)
      ? deepClone(execution.feedbackSnapshots)
      : {};
  const key = stage === "rollback" ? "rollback" : stage === "dispatch" ? "dispatch" : "approve";
  return {
    ...execution,
    feedbackSnapshots: {
      ...previousFeedbackSnapshots,
      [key]: normalizedSnapshot,
      latest: normalizedSnapshot
    }
  };
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeStatusFilter(value) {
  const normalized = normalizeText(value);
  if (!normalized || !EXECUTION_STATUSES.has(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeExecutionType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return "scheme";
  }
  return EXECUTION_TYPES.has(normalized) ? normalized : null;
}

function normalizeExecutionTypeFilter(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  return EXECUTION_TYPES.has(normalized) ? normalized : null;
}

function createExecutionId(siteId) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `opx-${normalizeText(siteId) || "site"}-${Date.now()}-${suffix}`;
}

function getSiteExecutionMap(siteId) {
  const normalizedSiteId = normalizeText(siteId) || "default";
  let map = STORE.get(normalizedSiteId);
  if (!map) {
    map = new Map();
    STORE.set(normalizedSiteId, map);
  }
  return map;
}

function listSorted(siteId) {
  const map = getSiteExecutionMap(siteId);
  return Array.from(map.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function normalizeActorUserId(context = {}) {
  return normalizeOptionalText(context.userId) || "unknown";
}

function resolveAdminStore(source = {}) {
  const store = source?.adminStore;
  return store && typeof store === "object" ? store : null;
}

function mapMutationError(error, fallbackMessage) {
  return {
    ok: false,
    status: typeof error?.status === "number" && Number.isFinite(error.status) ? error.status : 409,
    code: typeof error?.code === "string" && error.code ? error.code : "CONFLICT",
    error:
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : fallbackMessage || "optimize execution mutation failed",
    details: error?.details
  };
}

function buildExecutionRecord(siteId, request, context = {}) {
  const timestamp = nowIso();
  const actorUserId = normalizeActorUserId(context);
  const approvalRequired = request?.approval?.required !== false;
  return {
    executionId: createExecutionId(siteId),
    siteId: normalizeText(siteId),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: approvalRequired ? "pending_approval" : "approved",
    draft: {
      generatedAt: request?.draft?.generatedAt || null,
      gateLevel: request?.draft?.gateLevel || null,
      baseline: request?.draft?.baseline || null
    },
    execution: {
      type: request?.execution?.type || "scheme",
      schemeKey: request?.execution?.schemeKey || null,
      title: request?.execution?.title || null,
      targetCop: request?.execution?.targetCop ?? null,
      targetPowerKw: request?.execution?.targetPowerKw ?? null,
      targetApproachC: request?.execution?.targetApproachC ?? null,
      targetTcwsC: request?.execution?.targetTcwsC ?? null,
      targetChwpFreqTrimHz: request?.execution?.targetChwpFreqTrimHz ?? null,
      targetCwpFreqTrimHz: request?.execution?.targetCwpFreqTrimHz ?? null,
      ttlSeconds: request?.execution?.ttlSeconds ?? null,
      holdMinutes: request?.execution?.holdMinutes ?? null,
      rollbackLockoutMinutes: request?.execution?.rollbackLockoutMinutes ?? null,
      targetPoints: request?.execution?.targetPoints || null,
      equipmentContext: request?.execution?.equipmentContext || {
        activeChillerIds: [],
        activeChillerModels: []
      },
      guardrailSnapshot: request?.execution?.guardrailSnapshot || null,
      rollbackTarget: request?.execution?.rollbackTarget || null,
      reason: request?.execution?.reason || null,
      actions: Array.isArray(request?.execution?.actions) ? request.execution.actions : []
    },
    approval: {
      required: approvalRequired,
      status: approvalRequired ? "pending" : "approved",
      requestedAt: timestamp,
      approvedAt: approvalRequired ? null : timestamp,
      approverUserId: approvalRequired ? null : actorUserId,
      note: request?.approval?.note || null
    },
    rollback: {
      status: "none",
      reason: null,
      requestedBy: null,
      requestedAt: null,
      completedAt: null
    },
    approvedAt: approvalRequired ? null : timestamp,
    approvedBy: approvalRequired ? null : actorUserId,
    rolledBackAt: null,
    rolledBackBy: null,
    timeline: [
      {
        at: timestamp,
        actorUserId,
        action: "created",
        note: request?.approval?.note || null
      }
    ]
  };
}

export function validateCreateOptimizeExecutionRequest(body) {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: body must be an object",
      details: { field: "body" }
    };
  }

  const rawExecution = body.execution && typeof body.execution === "object" ? body.execution : null;
  if (!rawExecution) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: execution is required",
      details: { field: "execution" }
    };
  }

  const executionType = normalizeExecutionType(rawExecution.type);
  if (!executionType) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: `Invalid execution input: type=${rawExecution.type}`,
      details: {
        field: "execution.type",
        allowed: Array.from(EXECUTION_TYPES)
      }
    };
  }

  const schemeKey = normalizeOptionalText(rawExecution.schemeKey);
  const title = normalizeOptionalText(rawExecution.title);
  if (executionType === "scheme" && !schemeKey && !title) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: schemeKey or title is required for scheme execution",
      details: {
        field: "execution.schemeKey"
      }
    };
  }

  const targetApproachC = normalizeFiniteNumber(rawExecution.targetApproachC);
  const targetTcwsC = normalizeFiniteNumber(rawExecution.targetTcwsC);
  const targetChwpFreqTrimHz = normalizeFiniteNumber(
    rawExecution.targetChwpFreqTrimHz ?? rawExecution.chilledPumpFreqTrimHz
  );
  const targetCwpFreqTrimHz = normalizeFiniteNumber(
    rawExecution.targetCwpFreqTrimHz ?? rawExecution.coolingPumpFreqTrimHz
  );
  if (executionType === "tower-approach" && targetApproachC === null && targetTcwsC === null) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: tower-approach execution requires targetApproachC or targetTcwsC",
      details: {
        field: "execution.targetApproachC"
      }
    };
  }
  if (executionType === "pump-delta-t" && targetChwpFreqTrimHz === null && targetCwpFreqTrimHz === null) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: pump-delta-t execution requires targetChwpFreqTrimHz or targetCwpFreqTrimHz",
      details: {
        field: "execution.targetChwpFreqTrimHz"
      }
    };
  }
  if (
    executionType === "pump-delta-t" &&
    [targetChwpFreqTrimHz, targetCwpFreqTrimHz].some(
      (value) => value !== null && (value < PUMP_FREQ_TRIM_MIN_HZ || value > PUMP_FREQ_TRIM_MAX_HZ)
    )
  ) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      error: "Invalid execution input: pump-delta-t trim must be within -5~+3 Hz",
      details: {
        field: "execution.targetChwpFreqTrimHz",
        range: {
          min: PUMP_FREQ_TRIM_MIN_HZ,
          max: PUMP_FREQ_TRIM_MAX_HZ
        }
      }
    };
  }

  const equipmentContext = normalizeEquipmentContext(rawExecution.equipmentContext);
  const guardrailSnapshot = normalizeGuardrailSnapshot(rawExecution.guardrailSnapshot);
  const rollbackTarget = normalizeRollbackTarget(rawExecution.rollbackTarget);
  const ttlSeconds = normalizeFiniteNumber(rawExecution.ttlSeconds);
  const holdMinutes = normalizeFiniteNumber(rawExecution.holdMinutes);
  const rollbackLockoutMinutes = normalizeFiniteNumber(rawExecution.rollbackLockoutMinutes);

  const approvalRaw = body.approval && typeof body.approval === "object" ? body.approval : {};
  const approvalRequired = approvalRaw.required !== false;

  return {
    ok: true,
    request: {
      draft: {
        generatedAt: normalizeOptionalText(body?.draft?.generatedAt),
        gateLevel: normalizeOptionalText(body?.draft?.gateLevel),
        baseline: normalizeDraftBaseline(body?.draft?.baseline)
      },
      execution: {
        type: executionType,
        schemeKey,
        title: title || (schemeKey ? `scheme:${schemeKey}` : null),
        targetCop: normalizeFiniteNumber(rawExecution.targetCop),
        targetPowerKw: normalizeFiniteNumber(rawExecution.targetPowerKw),
        targetApproachC,
        targetTcwsC,
        targetChwpFreqTrimHz,
        targetCwpFreqTrimHz,
        ttlSeconds,
        holdMinutes,
        rollbackLockoutMinutes,
        targetPoints:
          rawExecution.targetPoints && typeof rawExecution.targetPoints === "object" && !Array.isArray(rawExecution.targetPoints)
            ? deepClone(rawExecution.targetPoints)
            : null,
        equipmentContext,
        guardrailSnapshot,
        rollbackTarget,
        reason: normalizeOptionalText(rawExecution.reason),
        actions: normalizeActions(rawExecution.actions)
      },
      approval: {
        required: approvalRequired,
        note: normalizeOptionalText(approvalRaw.note)
      }
    }
  };
}

export function createOptimizeExecution(siteId, request, context = {}) {
  const record = buildExecutionRecord(siteId, request, context);
  const adminStore = resolveAdminStore(context);
  if (adminStore?.createOptimizeExecution) {
    return adminStore.createOptimizeExecution(
      siteId,
      record,
      {
        userId: normalizeOptionalText(context.userId),
        username: normalizeOptionalText(context.username)
      },
      {
        requestId: normalizeOptionalText(context.requestId)
      }
    );
  }
  const siteMap = getSiteExecutionMap(siteId);
  siteMap.set(record.executionId, record);
  return deepClone(record);
}

export function listOptimizeExecutions(siteId, options = {}) {
  const type = normalizeExecutionTypeFilter(options.type);
  const adminStore = resolveAdminStore(options);
  if (adminStore?.listOptimizeExecutions) {
    return adminStore.listOptimizeExecutions(siteId, {
      status: normalizeStatusFilter(options.status),
      type,
      limit: normalizeLimit(options.limit)
    });
  }

  const status = normalizeStatusFilter(options.status);
  const limit = normalizeLimit(options.limit);
  const filtered = listSorted(siteId).filter((item) => {
    if (status && item.status !== status) {
      return false;
    }
    if (type && item?.execution?.type !== type) {
      return false;
    }
    return true;
  });
  const items = filtered.slice(0, limit).map((item) => deepClone(item));

  return {
    siteId: normalizeText(siteId),
    total: filtered.length,
    items
  };
}

export function getOptimizeExecution(siteId, executionId, options = {}) {
  const adminStore = resolveAdminStore(options);
  if (adminStore?.getOptimizeExecution) {
    return adminStore.getOptimizeExecution(siteId, executionId);
  }

  const siteMap = getSiteExecutionMap(siteId);
  const record = siteMap.get(normalizeText(executionId));
  return record ? deepClone(record) : null;
}

export function approveOptimizeExecution(siteId, executionId, payload = {}, context = {}) {
  const adminStore = resolveAdminStore(context);
  if (adminStore?.approveOptimizeExecution) {
    try {
      const execution = adminStore.approveOptimizeExecution(
        siteId,
        executionId,
        payload,
        {
          userId: normalizeOptionalText(context.userId),
          username: normalizeOptionalText(context.username)
        },
        {
          requestId: normalizeOptionalText(context.requestId)
        }
      );
      return {
        ok: true,
        execution
      };
    } catch (error) {
      return mapMutationError(error, "approve failed");
    }
  }

  const siteMap = getSiteExecutionMap(siteId);
  const normalizedExecutionId = normalizeText(executionId);
  const existing = siteMap.get(normalizedExecutionId);
  if (!existing) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: `Execution not found: ${normalizedExecutionId}`
    };
  }
  if (!existing.approval?.required) {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "Execution does not require approval"
    };
  }
  if (existing.status === "approved") {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "Execution is already approved"
    };
  }
  if (existing.status === "rolled_back") {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "Execution is already rolled back"
    };
  }

  const timestamp = nowIso();
  const actorUserId = normalizeOptionalText(payload.approverUserId) || normalizeActorUserId(context);
  const note = normalizeOptionalText(payload.note);
  const dispatchReceipt = normalizeDispatchReceipt(payload.dispatch);
  const feedbackSnapshot = normalizeFeedbackSnapshot(payload.feedbackSnapshot);
  existing.status = "approved";
  existing.updatedAt = timestamp;
  existing.approvedAt = timestamp;
  existing.approvedBy = actorUserId;
  existing.execution = mergeExecutionFeedbackState(
    mergeExecutionDispatchState(existing.execution, "approve", dispatchReceipt, timestamp),
    "approve",
    feedbackSnapshot
  );
  existing.approval.status = "approved";
  existing.approval.approverUserId = actorUserId;
  existing.approval.approvedAt = timestamp;
  if (note) {
    existing.approval.note = note;
  }
  existing.timeline.push({
    at: timestamp,
    actorUserId,
    action: "approved",
    note: note || null
  });

  siteMap.set(normalizedExecutionId, existing);
  return {
    ok: true,
    execution: deepClone(existing)
  };
}

export function rollbackOptimizeExecution(siteId, executionId, payload = {}, context = {}) {
  const adminStore = resolveAdminStore(context);
  if (adminStore?.rollbackOptimizeExecution) {
    try {
      const execution = adminStore.rollbackOptimizeExecution(
        siteId,
        executionId,
        payload,
        {
          userId: normalizeOptionalText(context.userId),
          username: normalizeOptionalText(context.username)
        },
        {
          requestId: normalizeOptionalText(context.requestId)
        }
      );
      return {
        ok: true,
        execution
      };
    } catch (error) {
      return mapMutationError(error, "rollback failed");
    }
  }

  const siteMap = getSiteExecutionMap(siteId);
  const normalizedExecutionId = normalizeText(executionId);
  const existing = siteMap.get(normalizedExecutionId);
  if (!existing) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: `Execution not found: ${normalizedExecutionId}`
    };
  }
  if (existing.status !== "approved") {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "Execution must be approved before rollback"
    };
  }

  const timestamp = nowIso();
  const actorUserId = normalizeActorUserId(context);
  const reason = normalizeOptionalText(payload.reason) || "manual rollback";
  const dispatchReceipt = normalizeDispatchReceipt(payload.dispatch);
  const feedbackSnapshot = normalizeFeedbackSnapshot(payload.feedbackSnapshot);
  existing.status = "rolled_back";
  existing.updatedAt = timestamp;
  existing.rolledBackAt = timestamp;
  existing.rolledBackBy = actorUserId;
  existing.execution = mergeExecutionFeedbackState(
    mergeExecutionDispatchState(existing.execution, "rollback", dispatchReceipt, timestamp),
    "rollback",
    feedbackSnapshot
  );
  existing.rollback = {
    status: "completed",
    reason,
    requestedBy: actorUserId,
    requestedAt: timestamp,
    completedAt: timestamp
  };
  existing.timeline.push({
    at: timestamp,
    actorUserId,
    action: "rolled_back",
    note: reason
  });

  siteMap.set(normalizedExecutionId, existing);
  return {
    ok: true,
    execution: deepClone(existing)
  };
}

export function dispatchOptimizeExecution(siteId, executionId, payload = {}, context = {}) {
  const adminStore = resolveAdminStore(context);
  if (adminStore?.dispatchOptimizeExecution) {
    try {
      const execution = adminStore.dispatchOptimizeExecution(
        siteId,
        executionId,
        payload,
        {
          userId: normalizeOptionalText(context.userId),
          username: normalizeOptionalText(context.username)
        },
        {
          requestId: normalizeOptionalText(context.requestId)
        }
      );
      return {
        ok: true,
        execution
      };
    } catch (error) {
      return mapMutationError(error, "dispatch failed");
    }
  }

  const siteMap = getSiteExecutionMap(siteId);
  const normalizedExecutionId = normalizeText(executionId);
  const existing = siteMap.get(normalizedExecutionId);
  if (!existing) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: `Execution not found: ${normalizedExecutionId}`
    };
  }
  if (existing.status !== "approved") {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: "Execution must be approved before dispatch"
    };
  }

  const timestamp = nowIso();
  const actorUserId = normalizeActorUserId(context);
  const dispatchReceipt = normalizeDispatchReceipt(payload.dispatch);
  if (!dispatchReceipt) {
    return {
      ok: false,
      status: 400,
      code: "BAD_REQUEST",
      error: "dispatch receipt is required"
    };
  }
  const feedbackSnapshot = normalizeFeedbackSnapshot(payload.feedbackSnapshot);
  existing.updatedAt = timestamp;
  existing.execution = mergeExecutionFeedbackState(
    mergeExecutionDispatchState(existing.execution, "dispatch", dispatchReceipt, timestamp),
    "dispatch",
    feedbackSnapshot
  );
  existing.timeline.push({
    at: timestamp,
    actorUserId,
    action: "dispatched",
    note: dispatchReceipt.message || dispatchReceipt.code || null
  });

  siteMap.set(normalizedExecutionId, existing);
  return {
    ok: true,
    execution: deepClone(existing)
  };
}

export function getOptimizeExecutionOverview(siteId, options = {}) {
  const adminStore = resolveAdminStore(options);
  if (adminStore?.getOptimizeExecutionOverview) {
    return adminStore.getOptimizeExecutionOverview(siteId);
  }

  const items = listSorted(siteId);
  const pendingApprovalCount = items.filter((item) => item.status === "pending_approval").length;
  const approvedCount = items.filter((item) => item.status === "approved").length;
  const rolledBackCount = items.filter((item) => item.status === "rolled_back").length;
  const latest = items[0] || null;

  return {
    pendingApprovalCount,
    approvedCount,
    rolledBackCount,
    latestExecutionId: latest?.executionId || null,
    latestExecutionStatus: latest?.status || null,
    latestExecutionAt: latest?.updatedAt || latest?.createdAt || null
  };
}

export function __resetOptimizeExecutionStoreForTest() {
  STORE.clear();
}
