export type AdminRole = "platform_admin" | "site_admin" | "auditor";

export type AdminScopeType = "platform" | "site";

export type AdminSiteStatus = "active" | "paused" | "disabled" | "pending" | "error";

export type AdminSourceStatus = "ok" | "partial" | "failed";

export type AdminMemberStatus = "active" | "invited" | "disabled";

export type AdminSiteSummary = {
  siteId: string;
  siteName: string;
  siteCode?: string;
  city?: string;
  status?: AdminSiteStatus;
  ownerName?: string;
  remark?: string;
  sourceStatus?: AdminSourceStatus;
  runtimeStatus?: AdminSourceStatus;
  sourceUpdatedAt?: string;
  runtimeUpdatedAt?: string;
  memberCount?: number;
  updatedAt?: string;
};

export type AdminSiteDetail = AdminSiteSummary & {
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type AdminSourceConfig = {
  legacyBaseUrl: string;
  ipAddress: string;
  port: string;
  databaseKey: string;
  modelKey: string;
  preferredProjectKey: string;
  template: string;
  controlMode: string;
  status: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminDeviceDataQuery = {
  build?: number;
  floor?: number;
  mock?: boolean;
};

export type AdminDeviceDataInterface = {
  projectKey: string;
  label: string;
  endpointKind: string;
  endpoint: string;
  build?: number;
  floor?: number;
  mock?: boolean;
};

export type AdminEffectiveSourceConfig = AdminSourceConfig & {
  deviceDataProjectKey?: string;
  deviceDataInterfaces?: AdminDeviceDataInterface[];
  defaultDeviceQuery?: AdminDeviceDataQuery;
};

export type AdminSourceConfigBundle = {
  sourceConfig: AdminSourceConfig;
  effectiveSourceConfig: AdminEffectiveSourceConfig;
};

export type AdminRuntimeConfig = {
  energyParamsJson: string;
  ruleThresholdsJson: string;
  featureFlagsJson: string;
  version?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type AdminMember = {
  bindingId: string;
  userId: string;
  username: string;
  role: AdminRole;
  scopeType: AdminScopeType;
  scopeId?: string;
  status: AdminMemberStatus;
  joinedAt?: string;
  updatedAt?: string;
};

export type AdminAuditLog = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  beforeJson?: string;
  afterJson?: string;
  details?: string;
};

export type AdminMe = {
  userId: string;
  username: string;
  role: AdminRole;
  visibleSites: AdminSiteSummary[];
  bootstrap: boolean;
};

export type LegacyLoginResult = {
  status: string;
  msg: string;
  token: string;
  username: string;
  userId?: string;
  role?: string;
};

export type AdminSubsystemStatus = "enabled" | "not_configured" | "not_applicable";

export type AdminSubsystemMode = "monitoring" | "optimization_ready" | "reserved";

export type AdminControlBoundaryMode = "read_only" | "shadow" | "assisted" | "enforced";

export type AdminPointRoleKind =
  | "power"
  | "temperature"
  | "pressure"
  | "flow"
  | "status"
  | "alarm"
  | "setpoint"
  | "command"
  | "feedback";

export type AdminSubsystemRegistryPointRole = {
  role: AdminPointRoleKind;
  label: string;
  required?: boolean;
  unit?: string;
};

export type AdminSubsystemRegistryItem = {
  siteId?: string;
  subsystemType: string;
  displayName: string;
  category: string;
  description?: string | null;
  defaultStatus: AdminSubsystemStatus;
  reserved: boolean;
  sortOrder: number;
  pointRoles: AdminSubsystemRegistryPointRole[];
};

export type AdminControlBoundary = {
  siteId?: string;
  subsystemType?: string;
  mode: AdminControlBoundaryMode;
  approvalRequired: boolean;
  plcProtectionRequired: boolean;
  rollbackRequired: boolean;
  writeEnabled: boolean;
  notes?: string | null;
};

export type AdminFcuFieldAuthorization = {
  siteAuthorizationStatus: "not_started" | "requested" | "approved" | "revoked";
  siteAuthorizationBy: string;
  siteAuthorizationWindowStart: string;
  siteAuthorizationWindowEnd: string;
  baWriteConfirmArmed: boolean;
  finalRolloutConfirmArmed: boolean;
  commissioningOwner: string;
  baOwner: string;
  notes: string;
};

export type AdminFcuControlPolicy = {
  enabled: boolean;
  defaultMode: "shadow" | "assisted" | "enforced";
  targetLowC: number;
  targetHighC: number;
  minSetpointC: number;
  maxSetpointC: number;
  setpointStepC: number;
  setpointDwellMinutes: number;
  startStopDwellMinutes: number;
  dailyMaxSetpointShiftC: number;
  validTempMinC: number;
  validTempMaxC: number;
  feedbackTimeoutSeconds: number;
  rollbackLockoutMinutes: number;
  allowStartStop: boolean;
  allowSetpoint: boolean;
  allowFanSpeed: boolean;
  occupied: boolean;
  dispatchAdapter: string;
  fieldAuthorization: AdminFcuFieldAuthorization;
  whitelist: string[];
  deviceOverrides?: Record<string, unknown>;
};

export type AdminFcuFieldRemediationStatus = {
  site?: {
    siteId?: string;
  };
  subsystemType?: "hvac_terminal" | string;
  equipmentType?: "fan_coil" | string;
  controlMutation: boolean;
  dispatch: boolean;
  summary?: {
    totalWorkOrders?: number | null;
    openWorkOrders?: number | null;
    openP0Devices?: number | null;
    signoffComplete?: boolean;
    signoffCompleteRows?: number | null;
    signoffExpectedRows?: number | null;
    finalGatePassed?: boolean;
    finalGatePassedCount?: number | null;
    finalGateCount?: number | null;
    canaryReady?: boolean;
  };
  workOrders?: {
    ok?: boolean;
    summary?: Record<string, unknown> | null;
    items?: Array<{
      workOrderId?: string;
      priority?: string;
      deviceCode?: string;
      deviceName?: string;
      owner?: string;
      status?: string;
      plannedAction?: string[];
      releaseCriteria?: string[];
      currentEvidence?: {
        zoneTemperatureC?: number | null;
        setpointC?: number | null;
        communicationAlarm?: boolean | null;
        qualityStatus?: string;
        reasons?: string[];
      };
      fieldVerification?: Record<string, string>;
      signoff?: {
        handledBy?: string;
        handledAt?: string;
        reviewedBy?: string;
        reviewedAt?: string;
        notes?: string;
      };
    }>;
    outputs?: Record<string, string> | null;
  };
  executionPack?: {
    ok?: boolean;
    summary?: Record<string, unknown> | null;
    reasonCounts?: Record<string, number>;
    executionOrder?: Array<{
      phase?: string;
      deviceCount?: number | null;
      deviceCodes?: string[];
      acceptance?: string;
    }>;
    outputs?: Record<string, string> | null;
  };
  signoff?: {
    ok?: boolean;
    summary?: Record<string, unknown> | null;
    openRecords?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      issues?: string[];
    }>;
    releaseMatrix?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      signoffComplete?: boolean;
      onsiteCanaryCandidate?: boolean;
      canEnterCanary?: boolean;
      canaryBlockReason?: string;
      missingFields?: string[];
      requiredValues?: string[];
      nextActions?: string[];
      releaseCriteria?: string[];
      verificationTarget?: string;
      rerunCommand?: string;
    }>;
    onsiteReleasePrecheck?: {
      ok?: boolean;
      onsiteReleaseReadyCount?: number | null;
      onsiteReleaseBlockedCount?: number | null;
      onsiteCanaryCandidateCount?: number | null;
      canaryCandidateCount?: number | null;
      canaryStillBlockedCount?: number | null;
      blockFieldCounts?: Record<string, number>;
      nextGlobalActions?: string[];
      devices?: Array<{
        workOrderId?: string;
        deviceCode?: string;
        deviceName?: string;
        onsiteReleaseReady?: boolean;
        onsiteCanaryCandidate?: boolean;
        canEnterCanary?: boolean;
        canaryBlockReason?: string;
        nextBlockingFields?: string[];
        nextAction?: string;
      }>;
    } | null;
    outputs?: Record<string, string> | null;
  };
  returnTemplate?: {
    ok?: boolean;
    summary?: {
      deviceCount?: number | null;
      communicationBlocked?: number | null;
      temperatureBlocked?: number | null;
      setpointBlocked?: number | null;
      draftSuggestibleDevices?: number | null;
      draftTemperatureSuggestions?: number | null;
      draftSetpointSuggestions?: number | null;
      signoffCompleteRows?: number | null;
      signoffExpectedRows?: number | null;
      canaryBlockedUntil?: string[];
    } | null;
    devices?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      currentEvidence?: {
        communicationAlarm?: boolean | null;
        zoneTemperatureC?: number | null;
        setpointC?: number | null;
        qualityStatus?: string | null;
        reasons?: string[];
        reasonLabels?: string[];
      };
      requiredValues?: Record<string, string>;
      reviewDraft?: {
        releaseDecisionDefault?: string;
        suggestedValues?: Record<string, string>;
        blockedAutoFillFields?: string[];
        manualOnlyFields?: string[];
        canSuggestAnyValue?: boolean;
        cannotReleaseReasons?: string[];
        safetyBoundary?: string;
      } | null;
      missingFields?: string[];
    }>;
    outputs?: Record<string, string> | null;
    requiredColumns?: string[];
    rerunCommands?: string[];
    safetyBoundary?: string[];
    controlMutation?: boolean;
    dispatch?: boolean;
  };
  handoff?: {
    ok?: boolean;
    summary?: {
      totalWorkOrders?: number | null;
      openP0Devices?: number | null;
      staleSignoffRows?: number | null;
      signoffCompleteRows?: number | null;
      signoffExpectedRows?: number | null;
      finalGatePassed?: boolean;
      canaryReady?: boolean;
      nextAllowedStep?: string;
    } | null;
    conclusion?: string | null;
    todaySequence?: Array<{
      phase?: string;
      deviceCount?: number | null;
      deviceCodes?: string[];
      owners?: string[];
      acceptance?: string;
    }>;
    staleSignoffRows?: Array<Record<string, unknown>>;
    devices?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      owner?: string;
      reasonLabels?: string[];
      todayAction?: string;
      requiredReturnFields?: Record<string, string>;
    }>;
    outputFiles?: {
      json?: string | null;
      markdown?: string | null;
      csv?: string | null;
      signoffInputCsv?: string | null;
      currentOnlyCsv?: string | null;
      staleCsv?: string | null;
    } | null;
    safetyBoundary?: string[];
    controlMutation?: boolean;
    dispatch?: boolean;
  };
  fieldRemediationPlaybook?: {
    fieldReady?: boolean;
    firstCanary?: string | null;
    canaryBlockedByField?: boolean;
    deviceCount?: number | null;
    reasonGroups?: Array<{
      reason?: string;
      devices?: string[];
    }>;
    missingFieldCounts?: Record<string, number>;
    recommendedOrder?: string[];
    acceptance?: string[];
    devices?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      reasons?: string[];
      reasonLabels?: string[];
      missingFields?: string[];
      fieldPriority?: string[];
      releaseCriteria?: string[];
    }>;
  } | null;
  canaryReadiness?: {
    markdown?: string;
    json?: string;
    verdict?: string | null;
    canaryReady?: boolean;
    blockedCount?: number | null;
    firstCanary?: string | null;
    readinessPlaybook?: {
      canExecuteCanary?: boolean;
      readyGateCount?: number | null;
      blockedGateCount?: number | null;
      firstBlockedPhase?: string | null;
      firstBlockedOwner?: string | null;
      firstBlockedAction?: string | null;
      fieldBlocked?: boolean;
      baBlocked?: boolean;
      canaryPackageBlocked?: boolean;
      safetyBlocked?: boolean;
      phasePlan?: Array<{
        key?: string;
        phase?: string;
        owner?: string;
        ready?: boolean;
        blocking?: boolean;
        evidence?: string;
        sourceFile?: string;
        nextAction?: string;
      }>;
      safetyBoundary?: string[];
    } | null;
  } | null;
  finalControlFieldExecutionPack?: {
    ok?: boolean;
    summary?: {
      totalDevices?: number | null;
      openDevices?: number | null;
      onsiteCanaryCandidateDevices?: number | null;
      canaryReadyDevices?: number | null;
      signoffCompleteRows?: number | null;
      signoffExpectedRows?: number | null;
      finalGatePassed?: boolean;
      canaryReady?: boolean;
      finalReleaseChecklistReady?: number | null;
      finalReleaseChecklistTotal?: number | null;
      firstBlocker?: string;
      nextAction?: string;
    } | null;
    outputFiles?: {
      json?: string | null;
      markdown?: string | null;
      csv?: string | null;
    } | null;
    finalReleaseChecklist?: Array<{
      key?: string;
      label?: string;
      ok?: boolean;
      detail?: string;
      action?: string;
    }>;
    deviceQueue?: Array<{
      sequence?: number | null;
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      owner?: string;
      canEnterCanary?: boolean;
      signoffComplete?: boolean;
      onsiteCanaryCandidate?: boolean;
      reasons?: string[];
      missingFields?: string[];
      todayAction?: string;
      canaryBlockReason?: string;
    }>;
    safetyBoundary?: string[];
    controlMutation?: boolean;
    dispatch?: boolean;
  } | null;
  finalControlGates?: {
    ok?: boolean;
    summary?: Record<string, unknown> | null;
    blockers?: Array<{
      label?: string;
      value?: string;
      blocker?: string;
    }>;
    nextActions?: Array<{
      priority?: string;
      phase?: string;
      action?: string;
      target?: string;
    }>;
    outputs?: Record<string, string> | null;
    controlMutation?: boolean;
  };
  reportStatuses?: Record<string, {
    status?: string;
    sourceFile?: string;
    error?: string | null;
  }>;
};

export type AdminFcuFieldRemediationSignoffPreview = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  persisted: boolean;
  mode?: "preview" | string;
  script?: {
    status?: number;
    accepted?: boolean;
    stdout?: string;
    stderr?: string;
  };
  summary?: {
    expectedWorkOrders?: number;
    csvRows?: number;
    signoffComplete?: boolean;
    completeRows?: number;
    openRows?: number;
    missingColumns?: string[];
    missingWorkOrders?: string[];
    ignoredRows?: number;
    stillRequiresRealtimeCloseout?: boolean;
  } | null;
  records?: Array<{
    workOrderId?: string;
    deviceCode?: string;
    deviceName?: string;
    signoffComplete?: boolean;
    issues?: string[];
    missingChecklist?: Array<{
      issue?: string;
      field?: string;
      requiredValue?: string;
      action?: string;
    }>;
  }>;
  releaseMatrix?: AdminFcuFieldRemediationStatus["signoff"] extends infer Signoff
    ? Signoff extends { releaseMatrix?: infer Matrix }
      ? Matrix
      : never
    : never;
  onsiteReleasePrecheck?: AdminFcuFieldRemediationStatus["signoff"] extends infer Signoff
    ? Signoff extends { onsiteReleasePrecheck?: infer Precheck }
      ? Precheck
      : never
    : never;
  ignoredRecords?: Array<{
    workOrderId?: string;
    deviceCode?: string;
    reason?: string;
  }>;
};

export type AdminFcuFieldRemediationSignoffPromoteResult = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  persisted: boolean;
  mode?: "promote" | string;
  confirmRequired?: string;
  scripts?: Record<string, {
    script?: string;
    status?: number;
    accepted?: boolean;
    stdout?: string;
    stderr?: string;
  }>;
  preview?: AdminFcuFieldRemediationSignoffPreview;
  clean?: {
    ok?: boolean;
    summary?: Record<string, unknown> | null;
    outputs?: Record<string, string> | null;
    staleRecords?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      reason?: string;
    }>;
  };
  promote?: {
    ok?: boolean;
    mode?: string | null;
    summary?: Record<string, unknown> | null;
    target?: {
      signoffInputCsv?: string;
      backupCsv?: string;
    } | null;
    promoted?: {
      backupWritten?: boolean;
      targetWritten?: boolean;
    } | null;
    fileMutation?: boolean;
  };
  signoff?: AdminFcuFieldRemediationStatus["signoff"];
  finalControlGates?: AdminFcuFieldRemediationStatus["finalControlGates"];
  finalControlRunbook?: {
    ok?: boolean;
    verdict?: string | null;
    summary?: Record<string, unknown> | null;
    controlMutation?: boolean;
    dispatch?: boolean;
  };
  evidenceConsistency?: {
    ok?: boolean;
    verdict?: string | null;
    summary?: Record<string, unknown> | null;
    issues?: Array<Record<string, unknown>>;
    controlMutation?: boolean;
    dispatch?: boolean;
  };
  refreshedStatus?: AdminFcuFieldRemediationStatus;
};

export type AdminFcuFieldRemediationRefreshResult = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  fileMutation?: boolean;
  mode?: "refresh" | string;
  scripts?: Record<string, {
    script?: string;
    status?: number;
    accepted?: boolean;
    stdout?: string;
    stderr?: string;
  }>;
  status?: AdminFcuFieldRemediationStatus;
};

export type AdminFcuSignoffRowRecord = {
  workOrderId: string;
  deviceCode: string;
  handledBy?: string;
  handledAt?: string;
  communicationAlarmAfter?: string;
  zoneTemperatureAfterC?: string;
  setpointFeedbackAfterC?: string;
  writePointMappingChecked?: string;
  twoSampleNormal?: string;
  localManualLockout?: string;
  releaseDecision?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
};

export type AdminFcuSignoffRowSaveResult = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  fileMutation?: boolean;
  mode?: "row_save" | string;
  record?: AdminFcuSignoffRowRecord;
  csvUpdate?: {
    rowCount?: number;
    updatedExisting?: boolean;
  };
  scripts?: Record<string, {
    script?: string;
    status?: number;
    accepted?: boolean;
  }>;
  signoff?: AdminFcuFieldRemediationStatus["signoff"];
  finalControlGates?: AdminFcuFieldRemediationStatus["finalControlGates"];
  refreshedStatus?: AdminFcuFieldRemediationStatus;
};

export type AdminFcuFieldArmPackageResult = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  mode?: "field_arm_package" | string;
  deviceCode?: string;
  scripts?: Record<string, {
    script?: string;
    status?: number;
    accepted?: boolean;
  }>;
  canaryWindow?: {
    ok?: boolean;
    verdict?: string | null;
    canary?: Record<string, unknown> | null;
    blockers?: Array<Record<string, unknown>>;
    outputs?: Record<string, string> | null;
  };
  canaryExecutionPackage?: {
    ok?: boolean;
    verdict?: string | null;
    canary?: Record<string, unknown> | null;
    blockers?: Array<Record<string, unknown>>;
    conditions?: Array<{
      key?: string;
      label?: string;
      passed?: boolean;
      evidence?: string;
      action?: string;
    }>;
    outputs?: Record<string, string> | null;
  };
  baWriteAdapterReadiness?: {
    ok?: boolean;
    verdict?: string | null;
    blockingItems?: Array<Record<string, unknown>>;
    checks?: Array<Record<string, unknown>>;
    outputs?: Record<string, string> | null;
    controlMutation?: boolean;
  };
  canaryFeedbackMonitor?: {
    ok?: boolean;
    verdict?: string | null;
    feedbackStatus?: string | null;
    blockers?: Array<Record<string, unknown>>;
    outputs?: Record<string, string> | null;
    controlMutation?: boolean;
    dispatch?: boolean;
  };
  fieldArmPackage?: {
    ok?: boolean;
    verdict?: string | null;
    checklist?: Array<{
      key?: string;
      phase?: string;
      label?: string;
      status?: string;
      owner?: string;
      evidence?: string;
      action?: string;
      writesControl?: boolean;
    }>;
    blockers?: Array<{
      key?: string;
      label?: string;
      severity?: string;
      evidence?: string;
      action?: string;
    }>;
    canary?: Record<string, unknown> | null;
    outputs?: Record<string, string> | null;
  };
  refreshedStatus?: AdminFcuFieldRemediationStatus;
};

export type AdminFcuSignoffCleanPromoteResult = {
  ok?: boolean;
  controlMutation: boolean;
  dispatch: boolean;
  fileMutation?: boolean;
  mode?: "clean_promote" | string;
  scripts?: Record<string, {
    script?: string;
    status?: number;
    accepted?: boolean;
  }>;
  clean?: {
    ok?: boolean;
    summary?: {
      expectedWorkOrders?: number;
      sourceRows?: number;
      currentRows?: number;
      staleRows?: number;
      generatedMissingRows?: number;
    } | null;
    staleRecords?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      deviceName?: string;
      reason?: string;
    }>;
    outputs?: Record<string, string> | null;
  };
  promote?: AdminFcuFieldRemediationSignoffPromoteResult["promote"];
  signoff?: AdminFcuFieldRemediationStatus["signoff"] & {
    ignoredRecords?: Array<{
      workOrderId?: string;
      deviceCode?: string;
      reason?: string;
    }>;
  };
  finalControlGates?: AdminFcuFieldRemediationStatus["finalControlGates"];
  refreshedStatus?: AdminFcuFieldRemediationStatus;
};

export type AdminAdvisorPluginBinding = {
  siteId?: string;
  subsystemType?: string;
  pluginKey: string;
  status: string;
  mode: AdminSubsystemMode;
  config?: Record<string, unknown>;
};

export type AdminSiteSubsystemCapability = {
  siteId: string;
  subsystemType: string;
  displayName: string;
  category: string;
  description?: string | null;
  status: AdminSubsystemStatus;
  mode: AdminSubsystemMode;
  reserved: boolean;
  enabled: boolean;
  kpis: unknown[];
  alarmCount: number | null;
  freshnessStatus: string;
  sourceStatus: string;
  pointMappingProgress: number;
  advisorPluginStatus: string;
  pageTemplateStatus: string;
  published: boolean;
  notes?: string | null;
  requiredPointRoles: AdminSubsystemRegistryPointRole[];
  advisorBindings: AdminAdvisorPluginBinding[];
  controlBoundary: AdminControlBoundary;
  updatedAt?: string | null;
};

export type AdminPointRoleMapping = {
  mappingId?: string;
  siteId?: string;
  subsystemType: string;
  pointRole: AdminPointRoleKind;
  pointName: string;
  pointCode?: string | null;
  unit?: string;
  dataType?: string;
  direction?: string;
  required?: boolean;
  writable?: boolean;
  source?: string;
  notes?: string | null;
};

export type AdminPointRoleImportPreviewItem = AdminPointRoleMapping & {
  rowNumber: number;
  confidence: number;
  reason: string;
  warnings: string[];
};

export type AdminPointRoleImportPreview = {
  siteId: string;
  generatedAt: string;
  totalRows: number;
  acceptedRows: number;
  writableCandidates: number;
  items: AdminPointRoleImportPreviewItem[];
  summary: {
    message: string;
    blocked: boolean;
  };
};

export type AdminConfigVersionResult = {
  version?: {
    versionId: string;
    siteId: string;
    status: string;
    summary?: string | null;
    publishedAt?: string | null;
    rolledBackAt?: string | null;
  };
  restored?: {
    siteId: string;
    generatedAt: string;
    items: AdminSiteSubsystemCapability[];
  };
};

export type AdminConfigVersion = {
  versionId: string;
  siteId: string;
  status: string;
  summary?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedAt?: string | null;
  rolledBackAt?: string | null;
};
