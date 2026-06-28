const CONTROL_MODES = new Set(["shadow", "assisted", "enforced"]);
const FAN_SPEED_COMMANDS = new Set(["auto", "low", "medium", "high"]);
const DEFAULT_POLICY = {
  enabled: true,
  defaultMode: "shadow",
  targetLowC: 24.5,
  targetHighC: 26.5,
  minSetpointC: 22,
  maxSetpointC: 28,
  setpointStepC: 0.5,
  setpointDwellMinutes: 15,
  startStopDwellMinutes: 30,
  dailyMaxSetpointShiftC: 2,
  validTempMinC: 5,
  validTempMaxC: 45,
  feedbackTimeoutSeconds: 120,
  rollbackLockoutMinutes: 60,
  allowStartStop: true,
  allowSetpoint: true,
  allowFanSpeed: true,
  occupied: true,
  dispatchAdapter: "none",
  fieldAuthorization: {
    siteAuthorizationStatus: "not_started",
    siteAuthorizationBy: "",
    siteAuthorizationWindowStart: "",
    siteAuthorizationWindowEnd: "",
    baWriteConfirmArmed: false,
    finalRolloutConfirmArmed: false,
    commissioningOwner: "",
    baOwner: "",
    notes: ""
  },
  whitelist: [],
  deviceOverrides: {}
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function normalizeMode(value, fallback = "shadow") {
  const normalized = normalizeText(value).toLowerCase();
  return CONTROL_MODES.has(normalized) ? normalized : fallback;
}

function normalizeFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFcuFieldAuthorization(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = normalizeText(source.siteAuthorizationStatus || source.status).toLowerCase();
  const allowedStatus = new Set(["not_started", "requested", "approved", "revoked"]);
  return {
    siteAuthorizationStatus: allowedStatus.has(status) ? status : DEFAULT_POLICY.fieldAuthorization.siteAuthorizationStatus,
    siteAuthorizationBy: normalizeText(source.siteAuthorizationBy),
    siteAuthorizationWindowStart: normalizeText(source.siteAuthorizationWindowStart),
    siteAuthorizationWindowEnd: normalizeText(source.siteAuthorizationWindowEnd),
    baWriteConfirmArmed: normalizeBoolean(source.baWriteConfirmArmed, false),
    finalRolloutConfirmArmed: normalizeBoolean(source.finalRolloutConfirmArmed, false),
    commissioningOwner: normalizeText(source.commissioningOwner),
    baOwner: normalizeText(source.baOwner),
    notes: normalizeText(source.notes)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}

function uniqueTextList(value, limit = 200) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const items = [];
  for (const item of value) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    items.push(text);
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

export function normalizeFcuControlPolicy(policy = {}) {
  const source = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
  const merged = {
    ...DEFAULT_POLICY,
    ...source
  };
  const setpointStepC = normalizeFiniteNumber(merged.setpointStepC, DEFAULT_POLICY.setpointStepC);
  const targetLowC = normalizeFiniteNumber(merged.targetLowC, DEFAULT_POLICY.targetLowC);
  const targetHighC = Math.max(
    targetLowC + setpointStepC,
    normalizeFiniteNumber(merged.targetHighC, DEFAULT_POLICY.targetHighC)
  );
  const minSetpointC = normalizeFiniteNumber(merged.minSetpointC, DEFAULT_POLICY.minSetpointC);
  const maxSetpointC = Math.max(minSetpointC + setpointStepC, normalizeFiniteNumber(merged.maxSetpointC, DEFAULT_POLICY.maxSetpointC));
  return {
    enabled: normalizeBoolean(merged.enabled, true),
    defaultMode: normalizeMode(merged.defaultMode, DEFAULT_POLICY.defaultMode),
    targetLowC,
    targetHighC,
    minSetpointC,
    maxSetpointC,
    setpointStepC,
    setpointDwellMinutes: Math.max(1, normalizeFiniteNumber(merged.setpointDwellMinutes, DEFAULT_POLICY.setpointDwellMinutes)),
    startStopDwellMinutes: Math.max(1, normalizeFiniteNumber(merged.startStopDwellMinutes, DEFAULT_POLICY.startStopDwellMinutes)),
    dailyMaxSetpointShiftC: Math.max(0, normalizeFiniteNumber(merged.dailyMaxSetpointShiftC, DEFAULT_POLICY.dailyMaxSetpointShiftC)),
    validTempMinC: normalizeFiniteNumber(merged.validTempMinC, DEFAULT_POLICY.validTempMinC),
    validTempMaxC: normalizeFiniteNumber(merged.validTempMaxC, DEFAULT_POLICY.validTempMaxC),
    feedbackTimeoutSeconds: Math.max(15, normalizeFiniteNumber(merged.feedbackTimeoutSeconds, DEFAULT_POLICY.feedbackTimeoutSeconds)),
    rollbackLockoutMinutes: Math.max(1, normalizeFiniteNumber(merged.rollbackLockoutMinutes, DEFAULT_POLICY.rollbackLockoutMinutes)),
    allowStartStop: normalizeBoolean(merged.allowStartStop, true),
    allowSetpoint: normalizeBoolean(merged.allowSetpoint, true),
    allowFanSpeed: normalizeBoolean(merged.allowFanSpeed, true),
    occupied: normalizeBoolean(merged.occupied, true),
    dispatchAdapter: normalizeText(merged.dispatchAdapter).toLowerCase() || "none",
    fieldAuthorization: normalizeFcuFieldAuthorization(merged.fieldAuthorization),
    whitelist: uniqueTextList(merged.whitelist),
    deviceOverrides:
      merged.deviceOverrides && typeof merged.deviceOverrides === "object" && !Array.isArray(merged.deviceOverrides)
        ? merged.deviceOverrides
        : {}
  };
}

export function buildDefaultFcuControlPolicy() {
  return normalizeFcuControlPolicy(DEFAULT_POLICY);
}

export function isFcuControlWriteAdapterConfigured(policy) {
  const adapter = normalizeText(policy?.dispatchAdapter).toLowerCase();
  return adapter && adapter !== "none" && adapter !== "shadow";
}

function readLatestRecord(records, deviceCode, actionKind = "") {
  const normalizedCode = normalizeText(deviceCode);
  return (Array.isArray(records) ? records : []).find((record) => {
    if (record?.dryRun === true || record?.payload?.dryRun === true) {
      return false;
    }
    if (normalizeText(record.deviceCode) !== normalizedCode) {
      return false;
    }
    if (!actionKind) {
      return true;
    }
    if (normalizeText(record.actionKind) === actionKind) {
      return true;
    }
    const commandTypes = Array.isArray(record.commands)
      ? record.commands.map((item) => normalizeText(item?.commandType))
      : [];
    if (actionKind === "setpoint") {
      return commandTypes.includes("setpoint");
    }
    if (actionKind === "start_stop") {
      return commandTypes.includes("start") || commandTypes.includes("stop");
    }
    return false;
  }) || null;
}

function minutesSince(value, nowMs) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }
  return (nowMs - timestamp) / 60000;
}

function isSameLocalDay(value, nowMs) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs)) {
    return false;
  }
  const current = new Date(nowMs);
  const candidate = new Date(timestamp);
  return (
    current.getFullYear() === candidate.getFullYear() &&
    current.getMonth() === candidate.getMonth() &&
    current.getDate() === candidate.getDate()
  );
}

function readSetpointCommandValue(record) {
  const command = Array.isArray(record?.commands)
    ? record.commands.find((item) => normalizeText(item?.commandType) === "setpoint")
    : null;
  const value = Number(command?.value);
  return Number.isFinite(value) ? value : null;
}

function calculateDailySetpointShift(records, deviceCode, nowMs) {
  const normalizedCode = normalizeText(deviceCode);
  return (Array.isArray(records) ? records : []).reduce((total, record) => {
    if (
      normalizeText(record?.deviceCode) !== normalizedCode ||
      normalizeText(record?.actionKind) !== "setpoint" ||
      !isSameLocalDay(record?.createdAt, nowMs)
    ) {
      return total;
    }
    if (record?.dryRun === true || record?.payload?.dryRun === true) {
      return total;
    }
    const target = readSetpointCommandValue(record);
    const previous = Number(record?.snapshot?.setpointC);
    if (!Number.isFinite(target) || !Number.isFinite(previous)) {
      return total;
    }
    return total + Math.abs(target - previous);
  }, 0);
}

function exceedsDailySetpointShift(policy, records, item, nextSetpoint, currentSetpoint, nowMs) {
  if (!Number.isFinite(policy.dailyMaxSetpointShiftC) || policy.dailyMaxSetpointShiftC <= 0) {
    return false;
  }
  const currentCycleShift = Math.abs(nextSetpoint - currentSetpoint);
  const usedToday = calculateDailySetpointShift(records, item?.deviceCode, nowMs);
  return usedToday + currentCycleShift > policy.dailyMaxSetpointShiftC;
}

function isLocalManual(item) {
  const values = [
    item?.points?.panelMode?.value,
    item?.points?.mode?.value,
    item?.points?.thermostatMode?.value
  ].map((value) => normalizeText(value).toLowerCase());
  return values.some((value) => value.includes("手动") || value.includes("本地") || value.includes("manual") || value.includes("local"));
}

function isWhitelisted(policy, item) {
  const deviceCode = normalizeText(item?.deviceCode);
  const deviceId = normalizeText(item?.deviceId);
  const deviceName = normalizeText(item?.deviceName);
  const allowed = new Set(policy.whitelist);
  return Boolean(allowed.has(deviceCode) || allowed.has(deviceId) || allowed.has(deviceName));
}

function getDevicePolicy(policy, item) {
  const keys = [item?.deviceCode, item?.deviceId, item?.deviceName].map(normalizeText).filter(Boolean);
  for (const key of keys) {
    const override = policy.deviceOverrides?.[key];
    if (override && typeof override === "object") {
      return {
        mode: normalizeMode(override.mode, policy.defaultMode),
        allowStartStop: normalizeBoolean(override.allowStartStop, policy.allowStartStop),
        allowSetpoint: normalizeBoolean(override.allowSetpoint, policy.allowSetpoint),
        allowFanSpeed: normalizeBoolean(override.allowFanSpeed, policy.allowFanSpeed),
        locked: normalizeBoolean(override.locked, false),
        note: normalizeText(override.note)
      };
    }
  }
  return {
    mode: policy.defaultMode,
    allowStartStop: policy.allowStartStop,
    allowSetpoint: policy.allowSetpoint,
    allowFanSpeed: policy.allowFanSpeed,
    locked: false,
    note: ""
  };
}

function hasWritablePoint(item, key) {
  return item?.points?.[key]?.writable === true;
}

function readFcuSetpointFeedback(item) {
  const value = Number.isFinite(item?.setpointFeedbackC) ? item.setpointFeedbackC : item?.setpointC;
  return Number.isFinite(value) ? value : null;
}

function isSetpointFeedbackValid(item, policy) {
  const value = readFcuSetpointFeedback(item);
  if (value == null) {
    return false;
  }
  return value >= policy.minSetpointC && value <= policy.maxSetpointC;
}

function buildPointCommand(item, commandType, pointKey, value, unit = null) {
  const point = item?.points?.[pointKey] || {};
  return {
    commandType,
    pointKey,
    pointName: normalizeText(point.pointName || point.label || pointKey),
    tagName: normalizeText(point.tagName),
    value,
    unit
  };
}

function buildBlockedDecision({ item, policy, devicePolicy, records, nowMs }) {
  const reasons = [];
  const zoneTemperatureC = item?.zoneTemperatureC;
  if (!policy.enabled) {
    reasons.push("policy_disabled");
  }
  if (devicePolicy.locked) {
    reasons.push("device_locked");
  }
  if (item?.communicationAlarm === true) {
    reasons.push("communication_alarm");
  }
  if (item?.quality?.status === "invalid" || item?.quality?.flags?.includes("invalid_temperature")) {
    reasons.push("invalid_temperature");
  }
  if (!Number.isFinite(zoneTemperatureC) || zoneTemperatureC < policy.validTempMinC || zoneTemperatureC > policy.validTempMaxC || zoneTemperatureC === 0) {
    reasons.push("temperature_quality_guard");
  }
  if (!isSetpointFeedbackValid(item, policy)) {
    reasons.push("setpoint_feedback_out_of_bounds");
  }
  if (isLocalManual(item)) {
    reasons.push("local_manual_guard");
  }
  const rollbackRecord = readLatestRecord(records, item?.deviceCode);
  if (rollbackRecord?.status === "rolled_back" && minutesSince(rollbackRecord.rolledBackAt || rollbackRecord.updatedAt, nowMs) < policy.rollbackLockoutMinutes) {
    reasons.push("rollback_lockout");
  }
  if (devicePolicy.mode !== "shadow" && !isWhitelisted(policy, item)) {
    reasons.push("not_whitelisted");
  }
  return reasons;
}

function buildCommandDecision({ item, policy, devicePolicy, records, nowMs }) {
  const zoneTemperatureC = item.zoneTemperatureC;
  const currentSetpoint = readFcuSetpointFeedback(item);
  const lastSetpoint = readLatestRecord(records, item.deviceCode, "setpoint");
  const lastStartStop = readLatestRecord(records, item.deviceCode, "start_stop");
  const setpointDwellActive = minutesSince(lastSetpoint?.createdAt, nowMs) < policy.setpointDwellMinutes;
  const startStopDwellActive = minutesSince(lastStartStop?.createdAt, nowMs) < policy.startStopDwellMinutes;

  if (zoneTemperatureC > policy.targetHighC) {
    if (item.running === false && policy.occupied && devicePolicy.allowStartStop) {
      if (startStopDwellActive) {
        return { actionKind: "hold", reason: "start_stop_dwell_guard", commands: [] };
      }
      if (!hasWritablePoint(item, "manualStart")) {
        return { actionKind: "hold", reason: "start_point_missing_or_readonly", commands: [] };
      }
      return {
        actionKind: "start_stop",
        reason: "room_temp_high_start_fcu",
        commands: [buildPointCommand(item, "start", "manualStart", 1)]
      };
    }
    if (devicePolicy.allowSetpoint && Number.isFinite(currentSetpoint)) {
      if (setpointDwellActive) {
        return { actionKind: "hold", reason: "setpoint_dwell_guard", commands: [] };
      }
      if (!hasWritablePoint(item, "setpoint")) {
        return { actionKind: "hold", reason: "setpoint_missing_or_readonly", commands: [] };
      }
      const nextSetpoint = clamp(roundToStep(currentSetpoint - policy.setpointStepC, policy.setpointStepC), policy.minSetpointC, policy.maxSetpointC);
      if (exceedsDailySetpointShift(policy, records, item, nextSetpoint, currentSetpoint, nowMs)) {
        return { actionKind: "hold", reason: "daily_setpoint_shift_guard", commands: [] };
      }
      const commands = [buildPointCommand(item, "setpoint", "setpoint", nextSetpoint, "°C")];
      if (devicePolicy.allowFanSpeed && zoneTemperatureC > policy.targetHighC + 1 && hasWritablePoint(item, "fanSpeedMode")) {
        commands.push(buildPointCommand(item, "fan_speed", "fanSpeedMode", "auto"));
      }
      return {
        actionKind: "setpoint",
        reason: "room_temp_high_trim_setpoint",
        commands
      };
    }
  }

  if (zoneTemperatureC < policy.targetLowC) {
    if (devicePolicy.allowSetpoint && Number.isFinite(currentSetpoint)) {
      if (setpointDwellActive) {
        return { actionKind: "hold", reason: "setpoint_dwell_guard", commands: [] };
      }
      if (!hasWritablePoint(item, "setpoint")) {
        return { actionKind: "hold", reason: "setpoint_missing_or_readonly", commands: [] };
      }
      const nextSetpoint = clamp(roundToStep(currentSetpoint + policy.setpointStepC, policy.setpointStepC), policy.minSetpointC, policy.maxSetpointC);
      if (exceedsDailySetpointShift(policy, records, item, nextSetpoint, currentSetpoint, nowMs)) {
        return { actionKind: "hold", reason: "daily_setpoint_shift_guard", commands: [] };
      }
      return {
        actionKind: "setpoint",
        reason: "room_temp_low_raise_setpoint",
        commands: [buildPointCommand(item, "setpoint", "setpoint", nextSetpoint, "°C")]
      };
    }
    if (!policy.occupied && item.running === true && devicePolicy.allowStartStop) {
      if (startStopDwellActive) {
        return { actionKind: "hold", reason: "start_stop_dwell_guard", commands: [] };
      }
      if (!hasWritablePoint(item, "manualStop")) {
        return { actionKind: "hold", reason: "stop_point_missing_or_readonly", commands: [] };
      }
      return {
        actionKind: "start_stop",
        reason: "unoccupied_overcool_stop_fcu",
        commands: [buildPointCommand(item, "stop", "manualStop", 1)]
      };
    }
  }

  return {
    actionKind: "hold",
    reason: "comfort_band_hold",
    commands: []
  };
}

function buildDispatchState(mode, policy, commands) {
  if (!commands.length) {
    return {
      status: "not_required",
      controlMutation: false,
      message: "No FCU command required for this cycle."
    };
  }
  if (mode === "shadow") {
    return {
      status: "shadow_only",
      controlMutation: false,
      message: "Shadow mode only; command is not sent to BA/PLC."
    };
  }
  if (mode === "assisted") {
    return {
      status: "pending_approval",
      controlMutation: false,
      message: "Assisted mode requires operator approval before dispatch."
    };
  }
  if (!isFcuControlWriteAdapterConfigured(policy)) {
    return {
      status: "blocked",
      code: "dispatch_adapter_missing",
      controlMutation: false,
      message: "FCU BA write adapter is not configured; command was recorded but not sent."
    };
  }
  return {
    status: "ready",
    controlMutation: false,
    message: "FCU command is ready for the configured BA write adapter."
  };
}

function normalizeManualFcuCommand(input = {}, policy = DEFAULT_POLICY) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const errors = [];
  const command = {
    start: source.start === true,
    stop: source.stop === true,
    setpointC: null,
    fanSpeed: ""
  };

  if (command.start && command.stop) {
    errors.push("start_stop_conflict");
  }

  if (source.setpointC !== undefined && source.setpointC !== null && source.setpointC !== "") {
    const setpointC = Number(source.setpointC);
    if (!Number.isFinite(setpointC)) {
      errors.push("setpoint_invalid");
    } else if (setpointC < policy.minSetpointC || setpointC > policy.maxSetpointC) {
      errors.push("setpoint_out_of_bounds");
    } else {
      command.setpointC = roundToStep(setpointC, policy.setpointStepC);
    }
  }

  if (source.fanSpeed !== undefined && source.fanSpeed !== null && source.fanSpeed !== "") {
    const fanSpeed = normalizeText(source.fanSpeed).toLowerCase();
    if (!FAN_SPEED_COMMANDS.has(fanSpeed)) {
      errors.push("fan_speed_invalid");
    } else {
      command.fanSpeed = fanSpeed;
    }
  }

  if (!command.start && !command.stop && command.setpointC == null && !command.fanSpeed) {
    errors.push("manual_command_empty");
  }

  return {
    command,
    errors
  };
}

function buildManualFcuCommandDecision({ item, policy, devicePolicy, records, nowMs, manualCommand }) {
  const commands = [];
  const reasons = [];
  const currentSetpoint = readFcuSetpointFeedback(item);
  const lastSetpoint = readLatestRecord(records, item.deviceCode, "setpoint");
  const lastStartStop = readLatestRecord(records, item.deviceCode, "start_stop");
  const setpointDwellActive = minutesSince(lastSetpoint?.createdAt, nowMs) < policy.setpointDwellMinutes;
  const startStopDwellActive = minutesSince(lastStartStop?.createdAt, nowMs) < policy.startStopDwellMinutes;

  if (manualCommand.start || manualCommand.stop) {
    if (!devicePolicy.allowStartStop) {
      reasons.push("start_stop_not_allowed");
    } else if (startStopDwellActive) {
      reasons.push("start_stop_dwell_guard");
    } else {
      const pointKey = manualCommand.start ? "manualStart" : "manualStop";
      if (!hasWritablePoint(item, pointKey)) {
        reasons.push(manualCommand.start ? "start_point_missing_or_readonly" : "stop_point_missing_or_readonly");
      } else {
        commands.push(buildPointCommand(item, manualCommand.start ? "start" : "stop", pointKey, 1));
      }
    }
  }

  if (manualCommand.setpointC != null) {
    if (!devicePolicy.allowSetpoint) {
      reasons.push("setpoint_not_allowed");
    } else if (setpointDwellActive) {
      reasons.push("setpoint_dwell_guard");
    } else if (!hasWritablePoint(item, "setpoint")) {
      reasons.push("setpoint_missing_or_readonly");
    } else if (Number.isFinite(currentSetpoint) && exceedsDailySetpointShift(policy, records, item, manualCommand.setpointC, currentSetpoint, nowMs)) {
      reasons.push("daily_setpoint_shift_guard");
    } else {
      commands.push(buildPointCommand(item, "setpoint", "setpoint", manualCommand.setpointC, "°C"));
    }
  }

  if (manualCommand.fanSpeed) {
    if (!devicePolicy.allowFanSpeed) {
      reasons.push("fan_speed_not_allowed");
    } else if (!hasWritablePoint(item, "fanSpeedMode")) {
      reasons.push("fan_speed_point_missing_or_readonly");
    } else {
      commands.push(buildPointCommand(item, "fan_speed", "fanSpeedMode", manualCommand.fanSpeed));
    }
  }

  if (reasons.length > 0) {
    return {
      actionKind: "manual_command",
      reason: reasons[0],
      blockReasons: reasons,
      commands: []
    };
  }

  return {
    actionKind: commands.some((item) => item.commandType === "start" || item.commandType === "stop")
      ? "start_stop"
      : commands.some((item) => item.commandType === "setpoint")
        ? "setpoint"
        : "manual_command",
    reason: "operator_manual_command",
    blockReasons: [],
    commands
  };
}

export function evaluateFcuDeviceCommissioningStatus(snapshot, policyInput, records = [], options = {}) {
  const policy = normalizeFcuControlPolicy(policyInput);
  const now = options.now || nowIso();
  const nowMs = Date.parse(now);
  const item = Array.isArray(snapshot?.items) ? snapshot.items[0] || null : null;
  const executionGate = options.executionGate || null;
  const devicePolicy = item ? getDevicePolicy(policy, item) : null;
  const latestRecord = item ? readLatestRecord(records, item.deviceCode) : null;
  const latestStatus = normalizeText(latestRecord?.status);
  const feedbackLocked = ["feedback_mismatch_locked", "rollback_watch"].includes(latestStatus);
  const rollbackActive =
    latestStatus === "rolled_back" &&
    minutesSince(latestRecord?.rolledBackAt || latestRecord?.updatedAt, nowMs) < policy.rollbackLockoutMinutes;
  const blockReasons = item && devicePolicy
    ? buildBlockedDecision({ item, policy, devicePolicy, records, nowMs })
    : ["device_not_found"];

  const conditions = [
    {
      key: "device_found",
      label: "设备快照存在",
      ok: Boolean(item)
    },
    {
      key: "policy_enabled",
      label: "策略启用",
      ok: policy.enabled === true
    },
    {
      key: "device_mode_enforced",
      label: "单台自动闭环",
      ok: devicePolicy?.mode === "enforced"
    },
    {
      key: "whitelisted",
      label: "单台白名单",
      ok: item ? isWhitelisted(policy, item) : false
    },
    {
      key: "communication_ok",
      label: "通讯正常",
      ok: item ? item.communicationAlarm !== true : false
    },
    {
      key: "temperature_valid",
      label: "温度有效",
      ok: item
        ? Number.isFinite(item.zoneTemperatureC) &&
          item.zoneTemperatureC !== 0 &&
          item.zoneTemperatureC >= policy.validTempMinC &&
          item.zoneTemperatureC <= policy.validTempMaxC &&
          item?.quality?.status !== "invalid"
        : false
    },
    {
      key: "setpoint_feedback_valid",
      label: "设定反馈有效",
      ok: item ? isSetpointFeedbackValid(item, policy) : false
    },
    {
      key: "not_local_manual",
      label: "非本地手动",
      ok: item ? !isLocalManual(item) : false
    },
    {
      key: "start_writable",
      label: "启动写点",
      ok: item ? hasWritablePoint(item, "manualStart") : false
    },
    {
      key: "stop_writable",
      label: "停止写点",
      ok: item ? hasWritablePoint(item, "manualStop") : false
    },
    {
      key: "setpoint_writable",
      label: "设定写点",
      ok: item ? hasWritablePoint(item, "setpoint") : false
    },
    {
      key: "fan_speed_writable",
      label: "风速写点",
      ok: item ? hasWritablePoint(item, "fanSpeedMode") : false
    },
    {
      key: "feedback_unlocked",
      label: "反馈未锁定",
      ok: !feedbackLocked && !rollbackActive
    },
    {
      key: "global_execution_gate",
      label: "全局投运闸门",
      ok: executionGate?.dispatchAllowed === true
    }
  ];
  const deviceConditionKeys = new Set([
    "device_found",
    "policy_enabled",
    "device_mode_enforced",
    "whitelisted",
    "communication_ok",
    "temperature_valid",
    "setpoint_feedback_valid",
    "not_local_manual",
    "start_writable",
    "stop_writable",
    "setpoint_writable",
    "fan_speed_writable",
    "feedback_unlocked"
  ]);
  const deviceReady = conditions
    .filter((condition) => deviceConditionKeys.has(condition.key))
    .every((condition) => condition.ok);
  const blockedReasons = conditions.filter((condition) => !condition.ok).map((condition) => condition.key);
  return {
    site: snapshot?.site || null,
    generatedAt: now,
    equipmentType: "fan_coil",
    subsystemType: "hvac_terminal",
    device: item
      ? {
          deviceId: normalizeText(item.deviceId),
          drTypeId: normalizeText(item.deviceTypeId),
          deviceCode: normalizeText(item.deviceCode),
          deviceName: normalizeText(item.deviceName) || normalizeText(item.deviceCode),
          floorName: normalizeText(item.floorName),
          running: item.running ?? null,
          zoneTemperatureC: item.zoneTemperatureC ?? null,
          setpointC: item.setpointFeedbackC ?? item.setpointC ?? null,
          communicationAlarm: item.communicationAlarm ?? null,
          qualityStatus: item.quality?.status || null
        }
      : null,
    policyMode: devicePolicy?.mode || policy.defaultMode,
    deviceReady,
    canDispatch: deviceReady && executionGate?.dispatchAllowed === true,
    status: !item ? "not_found" : deviceReady && executionGate?.dispatchAllowed === true ? "ready" : deviceReady ? "environment_blocked" : "blocked",
    conditions,
    blockedReasons,
    controlBlockReasons: blockReasons,
    latestRecord: latestRecord
      ? {
          recordId: latestRecord.recordId || null,
          status: latestRecord.status || null,
          actionKind: latestRecord.actionKind || null,
          reason: latestRecord.reason || null,
          createdAt: latestRecord.createdAt || null,
          updatedAt: latestRecord.updatedAt || null,
          rolledBackAt: latestRecord.rolledBackAt || null
        }
      : null,
    executionGate
  };
}

export function evaluateFcuControlCycle(snapshot, policyInput, records = []) {
  const policy = normalizeFcuControlPolicy(policyInput);
  const now = nowIso();
  const nowMs = Date.parse(now);
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const decisions = items.map((item) => {
    const devicePolicy = getDevicePolicy(policy, item);
    const blockReasons = buildBlockedDecision({ item, policy, devicePolicy, records, nowMs });
    if (blockReasons.length > 0) {
      return {
        recordId: null,
        siteId: snapshot?.site?.siteId || null,
        deviceId: normalizeText(item.deviceId),
        drTypeId: normalizeText(item.deviceTypeId),
        deviceCode: normalizeText(item.deviceCode),
        deviceName: normalizeText(item.deviceName) || normalizeText(item.deviceCode),
        mode: devicePolicy.mode,
        status: "blocked",
        actionKind: "hold",
        reason: blockReasons[0],
        blockReasons,
        commands: [],
        dispatch: {
          status: "blocked",
          controlMutation: false,
          message: blockReasons.join(", ")
        },
        snapshot: {
          zoneTemperatureC: item.zoneTemperatureC ?? null,
          setpointC: item.setpointFeedbackC ?? item.setpointC ?? null,
          running: item.running ?? null,
          communicationAlarm: item.communicationAlarm ?? null,
          qualityStatus: item.quality?.status || null
        },
        createdAt: now
      };
    }

    const commandDecision = buildCommandDecision({ item, policy, devicePolicy, records, nowMs });
    const dispatch = buildDispatchState(devicePolicy.mode, policy, commandDecision.commands);
    return {
      recordId: null,
      siteId: snapshot?.site?.siteId || null,
      deviceId: normalizeText(item.deviceId),
      drTypeId: normalizeText(item.deviceTypeId),
      deviceCode: normalizeText(item.deviceCode),
      deviceName: normalizeText(item.deviceName) || normalizeText(item.deviceCode),
      mode: devicePolicy.mode,
      status:
        commandDecision.actionKind === "hold"
          ? "held"
          : dispatch.status === "blocked"
            ? "blocked"
            : devicePolicy.mode === "shadow"
              ? "shadow"
              : dispatch.status === "pending_approval"
                ? "pending_approval"
                : "ready",
      actionKind: commandDecision.actionKind,
      reason: commandDecision.reason,
      blockReasons: [],
      commands: commandDecision.commands,
      dispatch,
      snapshot: {
        zoneTemperatureC: item.zoneTemperatureC ?? null,
        setpointC: item.setpointFeedbackC ?? item.setpointC ?? null,
        running: item.running ?? null,
        communicationAlarm: item.communicationAlarm ?? null,
        qualityStatus: item.quality?.status || null
      },
      createdAt: now
    };
  });

  const commandCount = decisions.filter((item) => item.commands.length > 0).length;
  const blockedCount = decisions.filter((item) => item.status === "blocked").length;
  return {
    site: snapshot?.site || null,
    generatedAt: now,
    equipmentType: "fan_coil",
    subsystemType: "hvac_terminal",
    policy,
    summary: {
      total: decisions.length,
      commandCount,
      blockedCount,
      shadowCount: decisions.filter((item) => item.status === "shadow").length,
      pendingApprovalCount: decisions.filter((item) => item.status === "pending_approval").length,
      heldCount: decisions.filter((item) => item.status === "held").length,
      readyCount: decisions.filter((item) => item.status === "ready").length,
      controlMutation: false
    },
    decisions
  };
}

export function evaluateManualFcuControlCommand(snapshot, policyInput, records = [], commandInput = {}) {
  const policy = normalizeFcuControlPolicy(policyInput);
  const now = nowIso();
  const nowMs = Date.parse(now);
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const item = items[0] || null;
  const { command: manualCommand, errors } = normalizeManualFcuCommand(commandInput, policy);

  if (!item) {
    return {
      site: snapshot?.site || null,
      generatedAt: now,
      equipmentType: "fan_coil",
      subsystemType: "hvac_terminal",
      policy,
      summary: {
        total: 0,
        commandCount: 0,
        blockedCount: 1,
        shadowCount: 0,
        pendingApprovalCount: 0,
        heldCount: 0,
        readyCount: 0,
        controlMutation: false
      },
      decisions: []
    };
  }

  const devicePolicy = getDevicePolicy(policy, item);
  const blockReasons = [
    ...errors,
    ...buildBlockedDecision({ item, policy, devicePolicy, records, nowMs })
  ];
  const commandDecision = blockReasons.length > 0
    ? {
        actionKind: "manual_command",
        reason: blockReasons[0],
        blockReasons,
        commands: []
      }
    : buildManualFcuCommandDecision({ item, policy, devicePolicy, records, nowMs, manualCommand });
  const dispatch = commandDecision.blockReasons?.length
    ? {
        status: "blocked",
        controlMutation: false,
        message: commandDecision.blockReasons.join(", ")
      }
    : buildDispatchState(devicePolicy.mode, policy, commandDecision.commands);
  const decision = {
    recordId: null,
    siteId: snapshot?.site?.siteId || null,
    deviceId: normalizeText(item.deviceId),
    drTypeId: normalizeText(item.deviceTypeId),
    deviceCode: normalizeText(item.deviceCode),
    deviceName: normalizeText(item.deviceName) || normalizeText(item.deviceCode),
    mode: devicePolicy.mode,
    status:
      commandDecision.blockReasons?.length
        ? "blocked"
        : dispatch.status === "blocked"
          ? "blocked"
          : devicePolicy.mode === "shadow"
            ? "shadow"
            : dispatch.status === "pending_approval"
              ? "pending_approval"
              : "ready",
    actionKind: commandDecision.actionKind,
    reason: commandDecision.reason,
    blockReasons: commandDecision.blockReasons || [],
    commands: commandDecision.commands,
    dispatch,
    manualCommand,
    snapshot: {
      zoneTemperatureC: item.zoneTemperatureC ?? null,
      setpointC: item.setpointFeedbackC ?? item.setpointC ?? null,
      running: item.running ?? null,
      communicationAlarm: item.communicationAlarm ?? null,
      qualityStatus: item.quality?.status || null
    },
    createdAt: now
  };

  return {
    site: snapshot?.site || null,
    generatedAt: now,
    equipmentType: "fan_coil",
    subsystemType: "hvac_terminal",
    policy,
    summary: {
      total: 1,
      commandCount: decision.commands.length > 0 ? 1 : 0,
      blockedCount: decision.status === "blocked" ? 1 : 0,
      shadowCount: decision.status === "shadow" ? 1 : 0,
      pendingApprovalCount: decision.status === "pending_approval" ? 1 : 0,
      heldCount: decision.status === "held" ? 1 : 0,
      readyCount: decision.status === "ready" ? 1 : 0,
      controlMutation: false
    },
    decisions: [decision]
  };
}

export async function dispatchFcuControlCycle(cycle, options = {}) {
  const policy = normalizeFcuControlPolicy(cycle?.policy || {});
  const dispatchCommand = options.dispatchCommand;
  const readOnlyMode = options.readOnlyMode === true;
  if (typeof dispatchCommand !== "function") {
    return cycle;
  }
  const shouldDispatch = policy.defaultMode === "enforced" && isFcuControlWriteAdapterConfigured(policy) && !readOnlyMode;
  const decisions = [];
  for (const decision of Array.isArray(cycle?.decisions) ? cycle.decisions : []) {
    if (!shouldDispatch || decision.status !== "ready" || !Array.isArray(decision.commands) || decision.commands.length === 0) {
      decisions.push(decision);
      continue;
    }
    const dispatchResults = [];
    let failed = false;
    for (const command of decision.commands) {
      if (!decision.deviceId || !decision.drTypeId || !command.pointName || !command.tagName) {
        failed = true;
        dispatchResults.push({
          ok: false,
          code: "missing_command_mapping",
          message: "FCU command requires deviceId, drTypeId, pointName and tagName."
        });
        continue;
      }
      try {
        const result = await dispatchCommand({
          drId: decision.deviceId,
          drTypeId: decision.drTypeId,
          regName: command.pointName,
          tagName: command.tagName,
          value: command.value,
          commandType: command.commandType,
          deviceCode: decision.deviceCode,
          deviceName: decision.deviceName
        });
        const ok = result?.ok === true;
        failed = failed || !ok;
        dispatchResults.push({
          ok,
          status: result?.status ?? null,
          message: result?.message || null,
          error: result?.error || null,
          command: result?.command || null,
          sourceStatus: result?.sourceStatus || null
        });
      } catch (error) {
        failed = true;
        dispatchResults.push({
          ok: false,
          code: "dispatch_exception",
          message: error instanceof Error ? error.message : "FCU command dispatch failed"
        });
      }
    }
    decisions.push({
      ...decision,
      status: failed ? "dispatch_failed" : "dispatched",
      dispatch: {
        status: failed ? "failed" : "succeeded",
        controlMutation: !failed,
        adapter: policy.dispatchAdapter,
        message: failed ? "One or more FCU commands failed." : "FCU commands were sent to BA adapter.",
        results: dispatchResults
      }
    });
  }
  return {
    ...cycle,
    summary: {
      ...(cycle.summary || {}),
      dispatchedCount: decisions.filter((item) => item.status === "dispatched").length,
      dispatchFailedCount: decisions.filter((item) => item.status === "dispatch_failed").length,
      controlMutation: decisions.some((item) => item.dispatch?.controlMutation === true)
    },
    decisions
  };
}

export function persistFcuControlCycle(adminStore, siteId, cycle, actor = {}, options = {}) {
  if (!adminStore?.createFcuControlRecord) {
    return {
      ...cycle,
      persisted: {
        status: "unavailable",
        inserted: 0,
        reason: "admin store does not support FCU control records"
      }
    };
  }
  const records = [];
  for (const decision of cycle.decisions || []) {
    if (decision.status === "held" && decision.actionKind === "hold") {
      continue;
    }
    records.push(
      adminStore.createFcuControlRecord(siteId, {
        ...decision,
        dryRun: options.dryRun === true
      }, actor, {
        requestId: options.requestId
      })
    );
  }
  return {
    ...cycle,
    decisions: cycle.decisions.map((decision) => {
      const created = records.find((record) => record.deviceCode === decision.deviceCode && record.createdAt === decision.createdAt);
      return created || decision;
    }),
    persisted: {
      status: "recorded",
      inserted: records.length
    }
  };
}

function findSnapshotDevice(snapshot, record) {
  const keys = [record?.deviceCode, record?.deviceId, record?.deviceName]
    .map(normalizeText)
    .filter(Boolean);
  return (Array.isArray(snapshot?.items) ? snapshot.items : []).find((item) =>
    keys.some((key) => [item?.deviceCode, item?.deviceId, item?.deviceName].map(normalizeText).includes(key))
  ) || null;
}

function verifyCommandFeedback(command, item, policy) {
  const commandType = normalizeText(command?.commandType);
  if (commandType === "setpoint") {
    const target = Number(command?.value);
    const actual = Number.isFinite(item?.setpointFeedbackC) ? item.setpointFeedbackC : item?.setpointC;
    const tolerance = Math.max(0.2, policy.setpointStepC / 2);
    const matched = Number.isFinite(target) && Number.isFinite(actual) && Math.abs(actual - target) <= tolerance;
    return {
      commandType,
      pointKey: command?.pointKey || "setpoint",
      target,
      actual: Number.isFinite(actual) ? actual : null,
      matched,
      checkable: true,
      tolerance
    };
  }
  if (commandType === "start" || commandType === "stop") {
    const expectedRunning = commandType === "start";
    const actualRunning = typeof item?.running === "boolean" ? item.running : null;
    return {
      commandType,
      pointKey: command?.pointKey || (commandType === "start" ? "manualStart" : "manualStop"),
      target: expectedRunning,
      actual: actualRunning,
      matched: actualRunning === expectedRunning,
      checkable: true
    };
  }
  if (commandType === "fan_speed") {
    const actual = item?.points?.fanSpeedMode?.value ?? item?.fanSpeedMode ?? null;
    return {
      commandType,
      pointKey: command?.pointKey || "fanSpeedMode",
      target: command?.value ?? null,
      actual,
      matched: false,
      checkable: false,
      reason: "fan_speed_feedback_not_normalized"
    };
  }
  return {
    commandType: commandType || "unknown",
    pointKey: command?.pointKey || "",
    target: command?.value ?? null,
    actual: null,
    matched: false,
    checkable: false,
    reason: "unsupported_command_feedback"
  };
}

export function verifyFcuControlRecordFeedback(record, snapshot, policyInput = {}, options = {}) {
  const policy = normalizeFcuControlPolicy(policyInput);
  const now = options.now || nowIso();
  const nowMs = Date.parse(now);
  const createdMs = Date.parse(record?.createdAt || record?.updatedAt || "");
  const ageSeconds = Number.isFinite(createdMs) && Number.isFinite(nowMs) ? Math.max(0, (nowMs - createdMs) / 1000) : Number.POSITIVE_INFINITY;
  const timeoutExceeded = ageSeconds > policy.feedbackTimeoutSeconds;
  const commands = Array.isArray(record?.commands) ? record.commands : [];

  if (record?.dryRun === true || record?.payload?.dryRun === true || !commands.length || record?.status !== "dispatched") {
    return {
      ...record,
      status: record?.status || "held",
      feedback: {
        status: "not_required",
        checkedAt: now,
        timeoutExceeded: false,
        results: []
      }
    };
  }

  const item = findSnapshotDevice(snapshot, record);
  if (!item) {
    return {
      ...record,
      status: timeoutExceeded ? "feedback_mismatch_locked" : "feedback_pending",
      reason: timeoutExceeded ? "feedback_device_missing_timeout" : "feedback_device_missing",
      feedback: {
        status: timeoutExceeded ? "mismatch" : "pending",
        checkedAt: now,
        timeoutExceeded,
        results: [],
        message: "FCU feedback device was not found in latest snapshot."
      }
    };
  }

  const results = commands.map((command) => verifyCommandFeedback(command, item, policy));
  const checkable = results.filter((result) => result.checkable);
  const mismatches = checkable.filter((result) => result.matched !== true);
  const unsupported = results.filter((result) => result.checkable !== true);
  const status =
    checkable.length === 0
      ? "feedback_not_checkable"
      : mismatches.length === 0 && unsupported.length === 0
        ? "feedback_confirmed"
        : mismatches.length === 0
          ? "feedback_partial"
          : timeoutExceeded
            ? "feedback_mismatch_locked"
            : "feedback_pending";

  return {
    ...record,
    status,
    reason:
      status === "feedback_confirmed"
        ? "feedback_matched"
        : status === "feedback_pending"
          ? "feedback_waiting"
          : status === "feedback_mismatch_locked"
            ? "feedback_timeout_mismatch"
            : status,
    feedback: {
      status:
        status === "feedback_confirmed"
          ? "confirmed"
          : status === "feedback_mismatch_locked"
            ? "mismatch"
            : status === "feedback_pending"
              ? "pending"
              : "partial",
      checkedAt: now,
      timeoutExceeded,
      ageSeconds,
      results,
      unsupportedCount: unsupported.length
    }
  };
}
