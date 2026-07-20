function normalizeLegacyBaseUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

const RT_TO_KW = 3.5168525;

function rtToKw(rt) {
  return Number((rt * RT_TO_KW).toFixed(1));
}

const B25_CHILLER_STAGING_CONFIG = {
  source: "user_provided_site_140_equipment_context",
  basis: "rated_capacity_for_margin_empirical_combination_for_ranking",
  capacityBasis:
    "组合容量余量按主机名义规格计算；CH7 的 1700RT 只作为现场可达上限备注，不作为常规额定容量承诺。",
  notes: [
    "CH1-CH4 为 1100RT 旧机，其中 CH2、CH4 状况好于 CH1、CH3。",
    "CH5 为 1300RT 次新机。",
    "CH7 为 1500RT 规格新机，现场可跑到 1700RT；第一版容量余量仍按 1500RT 额定规格计算。",
    "CH6 当前停机，容量规格待确认，默认不进入候选组合。"
  ],
  chillers: [
    {
      id: "CH1",
      label: "CH1 旧机",
      generation: "old",
      conditionLevel: "old_fair",
      ratedCapacityRt: 1100,
      ratedCapacityKw: rtToKw(1100),
      conditionNote: "旧机，状况低于 CH2/CH4。",
      available: true
    },
    {
      id: "CH2",
      label: "CH2 旧机",
      generation: "old",
      conditionLevel: "old_better",
      ratedCapacityRt: 1100,
      ratedCapacityKw: rtToKw(1100),
      conditionNote: "旧机，状况好于 CH1/CH3。",
      available: true
    },
    {
      id: "CH3",
      label: "CH3 旧机",
      generation: "old",
      conditionLevel: "old_fair",
      ratedCapacityRt: 1100,
      ratedCapacityKw: rtToKw(1100),
      conditionNote: "旧机，状况低于 CH2/CH4。",
      available: true
    },
    {
      id: "CH4",
      label: "CH4 旧机",
      generation: "old",
      conditionLevel: "old_better",
      ratedCapacityRt: 1100,
      ratedCapacityKw: rtToKw(1100),
      conditionNote: "旧机，状况好于 CH1/CH3。",
      available: true
    },
    {
      id: "CH5",
      label: "CH5 次新机",
      generation: "near_new",
      conditionLevel: "near_new",
      ratedCapacityRt: 1300,
      ratedCapacityKw: rtToKw(1300),
      conditionNote: "1300RT 次新机。",
      available: true
    },
    {
      id: "CH6",
      label: "CH6 停机",
      generation: "unknown",
      conditionLevel: "stopped",
      conditionNote: "当前停机状态，容量规格待确认，第一版不进入候选组合。",
      available: false,
      lockedByOperator: true
    },
    {
      id: "CH7",
      label: "CH7 新机",
      generation: "new",
      conditionLevel: "new",
      ratedCapacityRt: 1500,
      ratedCapacityKw: rtToKw(1500),
      maxPracticalCapacityRt: 1700,
      maxPracticalCapacityKw: rtToKw(1700),
      conditionNote: "1500RT 规格新机，现场可跑到 1700RT；常规容量余量按 1500RT 额定规格计算。",
      available: true
    }
  ],
  chillerCapacityKw: {
    CH1: rtToKw(1100),
    CH2: rtToKw(1100),
    CH3: rtToKw(1100),
    CH4: rtToKw(1100),
    CH5: rtToKw(1300),
    CH7: rtToKw(1500)
  },
  unavailableChillerIds: ["CH6"],
  candidateCombinations: [
    ["CH4", "CH5", "CH7"],
    ["CH2", "CH5", "CH7"],
    ["CH1", "CH5", "CH7"],
    ["CH3", "CH5", "CH7"],
    ["CH2", "CH4", "CH7"],
    ["CH2", "CH4", "CH5"],
    ["CH4", "CH7"],
    ["CH5", "CH7"]
  ]
};

const B25_OPERATIONAL_DIAGNOSTICS_POINT_DICTIONARY = {
  source: "builtin_site_140_b25_operational_diagnostics_dictionary",
  deviceSelectors: {
    chilledPumps: {
      codePatterns: ["^CHP\\d+$"],
      namePatterns: ["^\\d+#冷冻泵$", "^\\d+#冷冻水泵$"],
      excludeNamePatterns: ["阀|阀门|流量计|水表|总管|支路|旁通"]
    },
    coolingPumps: {
      codePatterns: ["^CWP\\d+$"],
      namePatterns: ["^\\d+#冷却泵$", "^\\d+#冷却水泵$"],
      excludeNamePatterns: ["阀|阀门|流量计|水表|总管|支路|旁通"]
    },
    coolingTowers: {
      codePatterns: ["^CT\\d+$"],
      namePatterns: ["^\\d+#冷却塔$", "^\\d+#冷却塔风机$", "^\\d+#塔风机$"],
      typePatterns: ["冷却塔风机|塔风机"],
      excludeNamePatterns: ["阀|阀门|流量计|水表|总管|开到位|关到位"]
    }
  },
  branchLabels: {
    allowedNamePatterns: ["支路\\s*\\d+", "\\bB\\d{1,2}\\b"],
    excludePatterns: ["累计", "冷却塔", "冷却泵", "冷冻泵", "主机"]
  },
  coolingTowerCellLabels: {
    allowedNamePatterns: ["^CT\\d+\\b", "\\d+\\s*#?\\s*冷却塔"],
    excludePatterns: ["阀|阀门|开到位|关到位"]
  }
};

const B25_TOWER_APPROACH_CONFIG = {
  source: "builtin_site_140_b25_tower_approach_shadow_mapping",
  advisoryMode: "manual-only",
  boundaryBasis: "conservative_site_default_pending_vendor_confirmation",
  minCondenserInletTempC: 30,
  minCondenserInletTempCByChiller: {
    CH1: 30,
    CH2: 30,
    CH3: 30,
    CH4: 30,
    CH5: 30,
    CH7: 30
  },
  dispatch: {
    mode: "shadow",
    timeoutMs: 8000
  },
  controlTargets: {
    approve: {
      endpoint: "/zsqy/qstag/{siteId}/doimplements",
      strategy: "device-reg-command",
      requiredContext: ["userId", "appId", "drTypeId", "drId", "tagName"],
      commandTemplate: "{deviceName}|{targetTcwsC}|{tagName}",
      commands: [
        {
          drTypeId: "77",
          drId: "46",
          drTypeName: "系统控制",
          drName: "冰机参数设置",
          deviceName: "冷却回水手动值",
          tagName: "SY-1-509-41413",
          valueSource: "targetTcwsC",
          valueTransform: "round1"
        }
      ]
    },
    rollback: {
      endpoint: "/zsqy/qstag/{siteId}/doimplements",
      strategy: "device-reg-command",
      requiredContext: ["userId", "appId", "drTypeId", "drId", "tagName"],
      commandTemplate: "{deviceName}|{rollbackTarget.targetTcwsC}|{tagName}",
      commands: [
        {
          drTypeId: "77",
          drId: "46",
          drTypeName: "系统控制",
          drName: "冰机参数设置",
          deviceName: "冷却回水手动值",
          tagName: "SY-1-509-41413",
          valueSource: "rollbackTarget.targetTcwsC",
          valueTransform: "round1"
        }
      ]
    }
  },
  notes: [
    "最低冷凝器进水温 30C 为现场 shadow 演示保守默认值，仍需厂家/现场最终确认。",
    "当前可写候选点为冷却回水手动值，不是独立 AI_Tcws_Target；真实 assisted 前必须确认 PLC 采纳逻辑。"
  ]
};

const B25_PUMP_DELTA_T_CONFIG = {
  source: "builtin_site_140_b25_pump_delta_t_shadow_mapping",
  dispatchMode: "shadow",
  dispatch: {
    mode: "shadow",
    timeoutMs: 8000
  },
  controlTargets: {
    approve: {
      strategy: "json-command",
      requiredContext: ["siteId", "userId", "targetPoints", "ttlSeconds"],
      commandTemplate: "{B25_AI_ChwpFreqTrim_Hz}|{B25_AI_CwpFreqTrim_Hz}",
      commands: [
        {
          chwpTagName: "B25_AI_ChwpFreqTrim_Hz",
          valueSource: "targetChwpFreqTrimHz",
          valueTransform: "round1"
        },
        {
          cwpTagName: "B25_AI_CwpFreqTrim_Hz",
          valueSource: "targetCwpFreqTrimHz",
          valueTransform: "round1"
        }
      ]
    },
    rollback: {
      strategy: "json-command",
      requiredContext: ["siteId", "userId", "targetPoints", "rollbackTarget"],
      commandTemplate: "{B25_AI_ChwpFreqTrim_Hz}|{B25_AI_CwpFreqTrim_Hz}",
      commands: [
        {
          chwpTagName: "B25_AI_ChwpFreqTrim_Hz",
          valueSource: "rollbackTarget.targetChwpFreqTrimHz",
          valueTransform: "round1"
        },
        {
          cwpTagName: "B25_AI_CwpFreqTrim_Hz",
          valueSource: "rollbackTarget.targetCwpFreqTrimHz",
          valueTransform: "round1"
        }
      ]
    }
  },
  safetyInputs: {
    terminalDifferentialPressureReady: "TODO",
    terminalValvePositionReady: "TODO",
    representativeRoomTemperatureReady: "TODO",
    noTerminalColdComplaint: "TODO",
    plcPumpTrimProtected: "TODO",
    minFlowProtected: "TODO",
    pumpFrequencyFeedbackReady: "TODO"
  },
  notes: [
    "B25_AI_* 为影子点命名模板，需现场 PLC/SCADA 实配后才能进入 assisted 联调。",
    "safetyInputs 保留 TODO，Advisor 必须维持 assistedDispatchReady=false。"
  ]
};

const B25_READ_ONLY_RUNTIME_ENRICHMENT_CONFIG = {
  enabled: true,
  mode: "read-only",
  allowedMethod: "GET",
  endpointKind: "legacy-reg-findObject-all",
  pageSize: 5000,
  mergeKeyFields: ["deviceId", "tagName"],
  exactDeviceCodes: [
    "CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7",
    "CHP1", "CHP2", "CHP3", "CHP4", "CHP5", "CHP6", "CHP7",
    "CWP1", "CWP2", "CWP3", "CWP4", "CWP5", "CWP6", "CWP7",
    "CTF11", "CTF12", "CTF13", "CTF14", "CTF15", "CTF16",
    "CTF21", "CTF22", "CTF23", "CTF24", "CTF25", "CTF26",
    "CTF31", "CTF32", "CTF33", "CTF34", "CTF35", "CTF36",
    "CTF41", "CTF42", "CTF43", "CTF44", "CTF45", "CTF46",
    "CTF51", "CTF52", "CTF53", "CTF54", "CTF55", "CTF56",
    "CTF61", "CTF62", "CTF63"
  ],
  exactSignalRegisterNames: {
    running: "运行",
    faultActive: "故障",
    remoteEnabled: "远程",
    frequencyHz: "频率反馈"
  },
  exactTagNamesByDeviceCode: {
    "CH1": {"running":"SY-1-509-40950","faultActive":"SY-1-509-40952","remoteEnabled":"SY-1-509-40951"},
    "CH2": {"running":"SY-1-509-40953","faultActive":"SY-1-509-40955","remoteEnabled":"SY-1-509-40954"},
    "CH3": {"running":"SY-1-509-40956","faultActive":"SY-1-509-40958","remoteEnabled":"SY-1-509-40957"},
    "CH4": {"running":"SY-1-509-40959","faultActive":"SY-1-509-40961","remoteEnabled":"SY-1-509-40960"},
    "CH5": {"running":"SY-1-509-40962","faultActive":"SY-1-509-40964","remoteEnabled":"SY-1-509-40963"},
    "CH6": {"running":"SY-1-509-40965","faultActive":"SY-1-509-40967","remoteEnabled":"SY-1-509-40966"},
    "CH7": {"running":"SY-1-509-40968","faultActive":"SY-1-509-40970","remoteEnabled":"SY-1-509-40969"},
    "CHP1": {"running":"SY-1-509-40005","faultActive":"SY-1-509-40006","remoteEnabled":"SY-1-509-40004","frequencyHz":"SY-1-509-42001"},
    "CHP2": {"running":"SY-1-509-40021","faultActive":"SY-1-509-40022","remoteEnabled":"SY-1-509-40020","frequencyHz":"SY-1-509-42002"},
    "CHP3": {"running":"SY-1-509-40037","faultActive":"SY-1-509-40038","remoteEnabled":"SY-1-509-40036","frequencyHz":"SY-1-509-42003"},
    "CHP4": {"running":"SY-1-509-40053","faultActive":"SY-1-509-40054","remoteEnabled":"SY-1-509-40052","frequencyHz":"SY-1-509-42004"},
    "CHP5": {"running":"SY-1-509-40069","faultActive":"SY-1-509-40070","remoteEnabled":"SY-1-509-40068","frequencyHz":"SY-1-509-42005"},
    "CHP6": {"running":"SY-1-509-40085","faultActive":"SY-1-509-40086","remoteEnabled":"SY-1-509-40084","frequencyHz":"SY-1-509-42006"},
    "CHP7": {"running":"SY-1-509-40971","faultActive":"SY-1-509-40973","remoteEnabled":"SY-1-509-40972","frequencyHz":"SY-1-509-42990"},
    "CWP1": {"running":"SY-1-509-40008","faultActive":"SY-1-509-40009","remoteEnabled":"SY-1-509-40007","frequencyHz":"SY-1-509-42007"},
    "CWP2": {"running":"SY-1-509-40024","faultActive":"SY-1-509-40025","remoteEnabled":"SY-1-509-40023","frequencyHz":"SY-1-509-42008"},
    "CWP3": {"running":"SY-1-509-40040","faultActive":"SY-1-509-40041","remoteEnabled":"SY-1-509-40039","frequencyHz":"SY-1-509-42009"},
    "CWP4": {"running":"SY-1-509-40056","faultActive":"SY-1-509-40057","remoteEnabled":"SY-1-509-40055","frequencyHz":"SY-1-509-42010"},
    "CWP5": {"running":"SY-1-509-40072","faultActive":"SY-1-509-40073","remoteEnabled":"SY-1-509-40071","frequencyHz":"SY-1-509-42011"},
    "CWP6": {"running":"SY-1-509-40088","faultActive":"SY-1-509-40089","remoteEnabled":"SY-1-509-40087","frequencyHz":"SY-1-509-42012"},
    "CWP7": {"running":"SY-1-509-40974","faultActive":"SY-1-509-40976","remoteEnabled":"SY-1-509-40975","frequencyHz":"SY-1-509-43002"},
    "CTF11": {"running":"SY-1-509-40131","faultActive":"SY-1-509-40132","remoteEnabled":"SY-1-509-40129","frequencyHz":"SY-1-509-42013"},
    "CTF12": {"running":"SY-1-509-40137","faultActive":"SY-1-509-40138","remoteEnabled":"SY-1-509-40135","frequencyHz":"SY-1-509-42014"},
    "CTF13": {"running":"SY-1-509-40143","faultActive":"SY-1-509-40144","remoteEnabled":"SY-1-509-40141","frequencyHz":"SY-1-509-42015"},
    "CTF14": {"running":"SY-1-509-40149","faultActive":"SY-1-509-40150","remoteEnabled":"SY-1-509-40147","frequencyHz":"SY-1-509-42016"},
    "CTF15": {"running":"SY-1-509-40155","faultActive":"SY-1-509-40156","remoteEnabled":"SY-1-509-40153","frequencyHz":"SY-1-509-42017"},
    "CTF16": {"running":"SY-1-509-40163","faultActive":"SY-1-509-40164","remoteEnabled":"SY-1-509-40161","frequencyHz":"SY-1-509-42018"},
    "CTF21": {"running":"SY-1-509-40169","faultActive":"SY-1-509-40170","remoteEnabled":"SY-1-509-40167","frequencyHz":"SY-1-509-42019"},
    "CTF22": {"running":"SY-1-509-40175","faultActive":"SY-1-509-40176","remoteEnabled":"SY-1-509-40173","frequencyHz":"SY-1-509-42020"},
    "CTF23": {"running":"SY-1-509-40181","faultActive":"SY-1-509-40182","remoteEnabled":"SY-1-509-40179","frequencyHz":"SY-1-509-42021"},
    "CTF24": {"running":"SY-1-509-40187","faultActive":"SY-1-509-40188","remoteEnabled":"SY-1-509-40185","frequencyHz":"SY-1-509-42022"},
    "CTF25": {"running":"SY-1-509-40195","faultActive":"SY-1-509-40196","remoteEnabled":"SY-1-509-40193","frequencyHz":"SY-1-509-42023"},
    "CTF26": {"running":"SY-1-509-40201","faultActive":"SY-1-509-40202","remoteEnabled":"SY-1-509-40199","frequencyHz":"SY-1-509-42024"},
    "CTF31": {"running":"SY-1-509-40207","faultActive":"SY-1-509-40208","remoteEnabled":"SY-1-509-40205","frequencyHz":"SY-1-509-42025"},
    "CTF32": {"running":"SY-1-509-40213","faultActive":"SY-1-509-40214","remoteEnabled":"SY-1-509-40211","frequencyHz":"SY-1-509-42026"},
    "CTF33": {"running":"SY-1-509-40219","faultActive":"SY-1-509-40220","remoteEnabled":"SY-1-509-40217","frequencyHz":"SY-1-509-42027"},
    "CTF34": {"running":"SY-1-509-40227","faultActive":"SY-1-509-40228","remoteEnabled":"SY-1-509-40225","frequencyHz":"SY-1-509-42028"},
    "CTF35": {"running":"SY-1-509-40233","faultActive":"SY-1-509-40234","remoteEnabled":"SY-1-509-40231","frequencyHz":"SY-1-509-42029"},
    "CTF36": {"running":"SY-1-509-40239","faultActive":"SY-1-509-40240","remoteEnabled":"SY-1-509-40237","frequencyHz":"SY-1-509-42030"},
    "CTF41": {"running":"SY-1-509-40245","faultActive":"SY-1-509-40246","remoteEnabled":"SY-1-509-40243","frequencyHz":"SY-1-509-42031"},
    "CTF42": {"running":"SY-1-509-40251","faultActive":"SY-1-509-40252","remoteEnabled":"SY-1-509-40249","frequencyHz":"SY-1-509-42032"},
    "CTF43": {"running":"SY-1-509-40259","faultActive":"SY-1-509-40260","remoteEnabled":"SY-1-509-40257","frequencyHz":"SY-1-509-42033"},
    "CTF44": {"running":"SY-1-509-40265","faultActive":"SY-1-509-40266","remoteEnabled":"SY-1-509-40263","frequencyHz":"SY-1-509-42034"},
    "CTF45": {"running":"SY-1-509-40271","faultActive":"SY-1-509-40272","remoteEnabled":"SY-1-509-40269","frequencyHz":"SY-1-509-42035"},
    "CTF46": {"running":"SY-1-509-40277","faultActive":"SY-1-509-40278","remoteEnabled":"SY-1-509-40275","frequencyHz":"SY-1-509-42036"},
    "CTF51": {"running":"SY-1-509-40283","faultActive":"SY-1-509-40284","remoteEnabled":"SY-1-509-40281","frequencyHz":"SY-1-509-42037"},
    "CTF52": {"running":"SY-1-509-40291","faultActive":"SY-1-509-40292","remoteEnabled":"SY-1-509-40289","frequencyHz":"SY-1-509-42038"},
    "CTF53": {"running":"SY-1-509-40297","faultActive":"SY-1-509-40298","remoteEnabled":"SY-1-509-40295","frequencyHz":"SY-1-509-42039"},
    "CTF54": {"running":"SY-1-509-40303","faultActive":"SY-1-509-40304","remoteEnabled":"SY-1-509-40301","frequencyHz":"SY-1-509-42040"},
    "CTF55": {"running":"SY-1-509-40309","faultActive":"SY-1-509-40310","remoteEnabled":"SY-1-509-40307","frequencyHz":"SY-1-509-42041"},
    "CTF56": {"running":"SY-1-509-40315","faultActive":"SY-1-509-40316","remoteEnabled":"SY-1-509-40313","frequencyHz":"SY-1-509-42042"},
    "CTF61": {"running":"SY-1-509-40323","faultActive":"SY-1-509-40324","remoteEnabled":"SY-1-509-40321","frequencyHz":"SY-1-509-42043"},
    "CTF62": {"running":"SY-1-509-40329","faultActive":"SY-1-509-40330","remoteEnabled":"SY-1-509-40327","frequencyHz":"SY-1-509-42044"},
    "CTF63": {"running":"SY-1-509-40335","faultActive":"SY-1-509-40336","remoteEnabled":"SY-1-509-40333","frequencyHz":"SY-1-509-42045"}
  },
  exactTagAliasRule: {
    transform: "replace-leading-prefix-only",
    sourcePrefix: "SY-",
    runtimePrefixTemplate: "{deviceCode}-"
  },
  expectedSignalCounts: {
    running: 54,
    faultActive: 54,
    remoteEnabled: 54,
    frequencyHz: 47
  },
  expectedEquipmentCount: 54,
  notes: [
    "仅对 B25 54 台核心设备补齐只读运行状态证据；禁止写 BA/PLC。",
    "设备身份只认 exactDeviceCodes，信号只认 exactSignalRegisterNames，并按 exactTagNamesByDeviceCode + 显式前缀别名规则核验，不用中文模糊匹配决定身份。",
    "receivedAt 只表示 BFF 收到快照的时间，不得冒充单点 observedAt。"
  ]
};

const BUILTIN_SITE_SOURCE_CONFIGS = {
  "122": {
    legacyAppId: "122",
    databaseKey: "122eightgw",
    modelKey: "122eightgw",
    preferredProjectKey: "122eightgw",
    template: "1"
  },
  "140": {
    legacyAppId: "140",
    databaseKey: "140btwentyfive",
    modelKey: "126lnoffice",
    preferredProjectKey: "126lnoffice",
    template: "1",
    ratedCoolingCapacityKw: 25322.4,
    chillerStaging: B25_CHILLER_STAGING_CONFIG,
    operationalDiagnosticsPointDictionary: B25_OPERATIONAL_DIAGNOSTICS_POINT_DICTIONARY,
    readOnlyRuntimeEnrichment: B25_READ_ONLY_RUNTIME_ENRICHMENT_CONFIG,
    towerApproach: B25_TOWER_APPROACH_CONFIG,
    pumpDeltaT: B25_PUMP_DELTA_T_CONFIG
  },
  btwentyfive: {
    legacyAppId: "140",
    databaseKey: "140btwentyfive",
    modelKey: "126lnoffice",
    preferredProjectKey: "126lnoffice",
    template: "1",
    ratedCoolingCapacityKw: 25322.4,
    chillerStaging: B25_CHILLER_STAGING_CONFIG,
    operationalDiagnosticsPointDictionary: B25_OPERATIONAL_DIAGNOSTICS_POINT_DICTIONARY,
    readOnlyRuntimeEnrichment: B25_READ_ONLY_RUNTIME_ENRICHMENT_CONFIG,
    towerApproach: B25_TOWER_APPROACH_CONFIG,
    pumpDeltaT: B25_PUMP_DELTA_T_CONFIG
  }
};

const BUILTIN_REALTIME_BASE_URL = "https://www.ssge.com.cn:8098";

const BUILTIN_PROJECT_DATA_INTERFACES = {
  "124sanyatianyue": [
    { label: "三亚天悦城", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "139zhonghaimall": [
    { label: "中海商城", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "115pulihua": [
    { label: "佛山普立华", endpointKind: "legacy-reg-findAllByDrTypeId", build: 2, floor: 0, mock: false }
  ],
  "125longwantj": [
    { label: "南京龙湾天街", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "122eightgw": [
    { label: "江西晶科", endpointKind: "legacy-reg-findAllByDrTypeId", mock: false }
  ],
  "148liuyangjd": [
    { label: "浏阳通程国际大酒店", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "131szhkcooperation": [
    { label: "深港合作区(福田)-冰机板换", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 1, mock: false },
    { label: "深港合作区(福田)-热水", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 2, mock: false }
  ],
  "142yishengshun": [
    { label: "珠海邑升顺", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "126lnoffice": [
    { label: "盛世绿能办公楼-10楼", endpointKind: "api-device-data", build: 1, floor: 1, mock: true },
    { label: "盛世绿能办公楼-楼顶", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 2, mock: false }
  ],
  "145azeroone": [
    { label: "观澜A01", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "141afour": [
    { label: "观澜A04", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "144azerosix": [
    { label: "观澜A06", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "149bfive": [
    { label: "观澜B05", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "140btwentyfive": [
    { label: "观澜B25", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "119csix": [
    { label: "观澜C06", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "147cthirtythree": [
    { label: "观澜C33恒压供水-冰水站", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 2, mock: false },
    { label: "观澜C33恒压供水-恒压供水", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 1, mock: false }
  ],
  "127cfortyfour": [
    { label: "观澜C44", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "130vietnamgoer": [
    { label: "越南歌尔", endpointKind: "api-device-data", mock: true }
  ],
  "133dzeroone": [
    { label: "龙华D1-冰机", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false },
    { label: "龙华D1-能源", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 1, mock: false }
  ],
  "128feleven": [
    { label: "龙华F11", endpointKind: "legacy-reg-findAllByDrTypeId", mock: false }
  ],
  "129ftwelve": [
    { label: "龙华F12", endpointKind: "legacy-reg-findAllByDrTypeId", mock: false }
  ],
  "146hfive": [
    { label: "龙华H5", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 0, mock: false }
  ],
  "143hthree": [
    { label: "龙华附房空调监控平台-H1栋3层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 1, mock: false },
    { label: "龙华附房空调监控平台-H1栋4层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 2, mock: false },
    { label: "龙华附房空调监控平台-H3栋1.5层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 3, mock: false },
    { label: "龙华附房空调监控平台-H3栋2层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 4, mock: false },
    { label: "龙华附房空调监控平台-H3栋3层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 5, mock: false },
    { label: "龙华附房空调监控平台-H3栋4层", endpointKind: "legacy-reg-findAllByDrTypeId", build: 1, floor: 6, mock: false }
  ]
};

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function normalizeOptionalNonNegativeInteger(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function normalizeOptionalNumberMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeOptionalText(rawKey);
    const number = normalizeOptionalNumber(rawValue);
    if (!key || number === null) {
      continue;
    }
    normalized[key] = number;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function pickHighestOptionalNumber(...values) {
  const numbers = values
    .map((value) => normalizeOptionalNumber(value))
    .filter((value) => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function mergeConservativeNumberMaps(...values) {
  const merged = {};
  for (const value of values) {
    const normalized = normalizeOptionalNumberMap(value) || {};
    for (const [key, number] of Object.entries(normalized)) {
      merged[key] = Math.max(merged[key] ?? number, number);
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function normalizeOptionalTextList(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = [];
  const seen = new Set();
  for (const rawItem of value) {
    const item = normalizeOptionalText(rawItem);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    items.push(item);
  }
  return items.length > 0 ? items : undefined;
}

function normalizeOptionalJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

function buildProjectDataInterfaceEndpoint(projectKey, item) {
  const query = new URLSearchParams();
  if (item.endpointKind === "api-device-data") {
    if (typeof item.mock === "boolean") {
      query.set("mock", item.mock ? "1" : "0");
    }
    if (item.build != null) {
      query.set("build", String(item.build));
    }
    if (item.floor != null) {
      query.set("floor", String(item.floor));
    }
    const search = query.toString();
    return `/api/device/${projectKey}/data${search ? `?${search}` : ""}`;
  }
  if (item.build != null) {
    query.set("build", String(item.build));
  }
  if (item.floor != null) {
    query.set("floor", String(item.floor));
  }
  const search = query.toString();
  return `/zsqy/reg/${projectKey}/findAllByDrTypeId${search ? `?${search}` : ""}`;
}

function normalizeProjectDataInterfaces(projectKey, items) {
  if (!projectKey || !Array.isArray(items)) {
    return undefined;
  }
  const normalized = items
    .map((item) => {
      const label = normalizeOptionalText(item?.label);
      const endpointKind = normalizeOptionalText(item?.endpointKind);
      if (!label || !endpointKind) {
        return null;
      }
      const build = normalizeOptionalNonNegativeInteger(item?.build);
      const floor = normalizeOptionalNonNegativeInteger(item?.floor);
      const mock = normalizeOptionalBoolean(item?.mock);
      const pointEvidenceProfileId = normalizeOptionalText(item?.pointEvidenceProfileId);
      return {
        projectKey,
        label,
        endpointKind,
        endpoint: buildProjectDataInterfaceEndpoint(projectKey, {
          endpointKind,
          build,
          floor,
          mock
        }),
        ...(build !== null ? { build } : {}),
        ...(floor !== null ? { floor } : {}),
        ...(typeof mock === "boolean" ? { mock } : {}),
        ...(pointEvidenceProfileId ? { pointEvidenceProfileId } : {})
      };
    })
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function pickDefaultProjectDataInterface(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return undefined;
  }
  return (
    items.find((item) => item?.endpointKind === "api-device-data") ||
    items[0]
  );
}

function resolveBuiltinProjectDataAccess(siteId, sourceConfig) {
  const candidates = [
    sourceConfig?.databaseKey,
    sourceConfig?.modelKey,
    sourceConfig?.preferredProjectKey,
    siteId,
    sourceConfig?.legacyAppId
  ]
    .map((value) => normalizeOptionalText(value))
    .filter(Boolean);
  for (const candidate of candidates) {
    const items = normalizeProjectDataInterfaces(candidate, BUILTIN_PROJECT_DATA_INTERFACES[candidate]);
    if (!items) {
      continue;
    }
    const defaultItem = pickDefaultProjectDataInterface(items);
    return {
      projectKey: candidate,
      items,
      defaultQuery:
        defaultItem
          ? {
              ...(defaultItem.build != null ? { build: defaultItem.build } : {}),
              ...(defaultItem.floor != null ? { floor: defaultItem.floor } : {}),
              ...(typeof defaultItem.mock === "boolean" ? { mock: defaultItem.mock } : {})
            }
          : undefined
    };
  }
  return undefined;
}

function mergeJsonObjectMap(baseValue, overrideValue) {
  const base = normalizeOptionalJsonObject(baseValue) || {};
  const override = normalizeOptionalJsonObject(overrideValue) || {};
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = {
        ...merged[key],
        ...value
      };
      continue;
    }
    merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function readSiteRuntimeAdminConfig(adminStore, siteId) {
  if (!adminStore?.getSiteRuntimeConfig) {
    return null;
  }
  const runtimeConfig = adminStore.getSiteRuntimeConfig(siteId);
  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    return null;
  }
  const energyParams =
    runtimeConfig.energyParams && typeof runtimeConfig.energyParams === "object" ? runtimeConfig.energyParams : {};
  const ruleThresholds =
    runtimeConfig.ruleThresholds && typeof runtimeConfig.ruleThresholds === "object"
      ? runtimeConfig.ruleThresholds
      : {};
  const featureFlags =
    runtimeConfig.featureFlags && typeof runtimeConfig.featureFlags === "object" ? runtimeConfig.featureFlags : {};
  const chillerStaging =
    runtimeConfig.chillerStaging && typeof runtimeConfig.chillerStaging === "object" && !Array.isArray(runtimeConfig.chillerStaging)
      ? runtimeConfig.chillerStaging
      : {};
  const hasRuntimePayload =
    Boolean(runtimeConfig.createdAt) ||
    Object.keys(energyParams).length > 0 ||
    Object.keys(ruleThresholds).length > 0 ||
    Object.keys(featureFlags).length > 0 ||
    Object.keys(chillerStaging).length > 0;
  if (!hasRuntimePayload) {
    return null;
  }
  return {
    siteId,
    energyParams,
    ruleThresholds,
    featureFlags,
    ...(Object.keys(chillerStaging).length > 0 ? { chillerStaging } : {}),
    version: runtimeConfig.version ?? null,
    createdAt: runtimeConfig.createdAt ?? null,
    updatedAt: runtimeConfig.updatedAt ?? null
  };
}

function buildTowerApproachConfig(baseConfig, siteRuntimeAdminConfig, sourceConfig) {
  const baseTowerApproach =
    baseConfig?.towerApproach && typeof baseConfig.towerApproach === "object" ? baseConfig.towerApproach : {};
  const sourceTowerApproach =
    sourceConfig?.towerApproach && typeof sourceConfig.towerApproach === "object" ? sourceConfig.towerApproach : {};
  const runtimeThresholds =
    siteRuntimeAdminConfig?.ruleThresholds?.towerApproach &&
    typeof siteRuntimeAdminConfig.ruleThresholds.towerApproach === "object"
      ? siteRuntimeAdminConfig.ruleThresholds.towerApproach
      : {};
  const baseMinCondenserInletTempC = normalizeOptionalNumber(baseTowerApproach.minCondenserInletTempC);
  const sourceMinCondenserInletTempC = normalizeOptionalNumber(sourceTowerApproach.minCondenserInletTempC);
  const runtimeMinCondenserInletTempC = normalizeOptionalNumber(runtimeThresholds.minCondenserInletTempC);
  const mergedMinCondenserInletTempC = pickHighestOptionalNumber(
    baseMinCondenserInletTempC,
    sourceMinCondenserInletTempC,
    runtimeMinCondenserInletTempC
  );
  const mergedMinCondenserInletTempCByModel =
    mergeConservativeNumberMaps(
      baseTowerApproach.minCondenserInletTempCByModel,
      sourceTowerApproach.minCondenserInletTempCByModel,
      runtimeThresholds.minCondenserInletTempCByModel
    ) || {};
  const mergedMinCondenserInletTempCByChiller =
    mergeConservativeNumberMaps(
      baseTowerApproach.minCondenserInletTempCByChiller,
      sourceTowerApproach.minCondenserInletTempCByChiller,
      runtimeThresholds.minCondenserInletTempCByChiller
    ) || {};
  const activeChillerIds =
    normalizeOptionalTextList(runtimeThresholds.activeChillerIds) ||
    normalizeOptionalTextList(sourceTowerApproach.activeChillerIds) ||
    normalizeOptionalTextList(baseTowerApproach.activeChillerIds);
  const activeChillerModels =
    normalizeOptionalTextList(runtimeThresholds.activeChillerModels) ||
    normalizeOptionalTextList(sourceTowerApproach.activeChillerModels) ||
    normalizeOptionalTextList(baseTowerApproach.activeChillerModels);
  const mergedDispatch =
    mergeJsonObjectMap(mergeJsonObjectMap(baseTowerApproach.dispatch, sourceTowerApproach.dispatch), runtimeThresholds.dispatch) ||
    {};
  const mergedControlTargets =
    mergeJsonObjectMap(
      mergeJsonObjectMap(baseTowerApproach.controlTargets, sourceTowerApproach.controlTargets),
      runtimeThresholds.controlTargets
    ) || {};

  if (
    !Object.keys(baseTowerApproach).length &&
    !Object.keys(sourceTowerApproach).length &&
    mergedMinCondenserInletTempC === null &&
    Object.keys(mergedMinCondenserInletTempCByModel).length === 0 &&
    Object.keys(mergedMinCondenserInletTempCByChiller).length === 0 &&
    Object.keys(mergedDispatch).length === 0 &&
    Object.keys(mergedControlTargets).length === 0 &&
    !activeChillerIds &&
    !activeChillerModels
  ) {
    return undefined;
  }

  return {
    ...baseTowerApproach,
    ...sourceTowerApproach,
    ...runtimeThresholds,
    ...(mergedMinCondenserInletTempC !== null ? { minCondenserInletTempC: mergedMinCondenserInletTempC } : {}),
    ...(Object.keys(mergedMinCondenserInletTempCByModel).length > 0
      ? { minCondenserInletTempCByModel: mergedMinCondenserInletTempCByModel }
      : {}),
    ...(Object.keys(mergedMinCondenserInletTempCByChiller).length > 0
      ? { minCondenserInletTempCByChiller: mergedMinCondenserInletTempCByChiller }
      : {}),
    ...(Object.keys(mergedDispatch).length > 0 ? { dispatch: mergedDispatch } : {}),
    ...(Object.keys(mergedControlTargets).length > 0 ? { controlTargets: mergedControlTargets } : {}),
    ...(activeChillerIds ? { activeChillerIds } : {}),
    ...(activeChillerModels ? { activeChillerModels } : {})
  };
}

function buildPumpDeltaTConfig(baseConfig, siteRuntimeAdminConfig, sourceConfig) {
  const basePumpDeltaT =
    baseConfig?.pumpDeltaT && typeof baseConfig.pumpDeltaT === "object" ? baseConfig.pumpDeltaT : {};
  const sourcePumpDeltaT =
    sourceConfig?.pumpDeltaT && typeof sourceConfig.pumpDeltaT === "object" ? sourceConfig.pumpDeltaT : {};
  const runtimeThresholds =
    siteRuntimeAdminConfig?.ruleThresholds?.pumpDeltaT &&
    typeof siteRuntimeAdminConfig.ruleThresholds.pumpDeltaT === "object"
      ? siteRuntimeAdminConfig.ruleThresholds.pumpDeltaT
      : {};
  const mergedDispatch =
    mergeJsonObjectMap(mergeJsonObjectMap(basePumpDeltaT.dispatch, sourcePumpDeltaT.dispatch), runtimeThresholds.dispatch) || {};
  const mergedControlTargets =
    mergeJsonObjectMap(
      mergeJsonObjectMap(basePumpDeltaT.controlTargets, sourcePumpDeltaT.controlTargets),
      runtimeThresholds.controlTargets
    ) || {};
  const mergedSafetyInputs =
    mergeJsonObjectMap(
      mergeJsonObjectMap(basePumpDeltaT.safetyInputs, sourcePumpDeltaT.safetyInputs),
      runtimeThresholds.safetyInputs
    ) || {};
  const dispatchMode = normalizeOptionalText(
    runtimeThresholds.dispatchMode || sourcePumpDeltaT.dispatchMode || basePumpDeltaT.dispatchMode
  );

  if (
    !Object.keys(basePumpDeltaT).length &&
    !Object.keys(sourcePumpDeltaT).length &&
    !Object.keys(runtimeThresholds).length &&
    !Object.keys(mergedDispatch).length &&
    !Object.keys(mergedControlTargets).length &&
    !Object.keys(mergedSafetyInputs).length &&
    !dispatchMode
  ) {
    return undefined;
  }

  return {
    ...basePumpDeltaT,
    ...sourcePumpDeltaT,
    ...runtimeThresholds,
    ...(dispatchMode ? { dispatchMode } : {}),
    ...(Object.keys(mergedDispatch).length > 0 ? { dispatch: mergedDispatch } : {}),
    ...(Object.keys(mergedControlTargets).length > 0 ? { controlTargets: mergedControlTargets } : {}),
    ...(Object.keys(mergedSafetyInputs).length > 0 ? { safetyInputs: mergedSafetyInputs } : {})
  };
}

function buildChillerStagingConfig(baseConfig, siteRuntimeAdminConfig, sourceConfig) {
  const base = normalizeOptionalJsonObject(baseConfig?.chillerStaging) || {};
  const source = normalizeOptionalJsonObject(sourceConfig?.chillerStaging) || {};
  const runtime = normalizeOptionalJsonObject(siteRuntimeAdminConfig?.chillerStaging) || {};
  const merged = {
    ...base,
    ...source,
    ...runtime
  };
  const chillers = runtime.chillers || source.chillers || base.chillers;
  const candidateCombinations =
    runtime.candidateCombinations || source.candidateCombinations || base.candidateCombinations;
  const chillerCapacityKw =
    mergeJsonObjectMap(mergeJsonObjectMap(base.chillerCapacityKw, source.chillerCapacityKw), runtime.chillerCapacityKw) ||
    undefined;
  if (chillers) {
    merged.chillers = chillers;
  }
  if (candidateCombinations) {
    merged.candidateCombinations = candidateCombinations;
  }
  if (chillerCapacityKw) {
    merged.chillerCapacityKw = chillerCapacityKw;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeSourceConfig(siteId, sourceConfig) {
  const builtin = BUILTIN_SITE_SOURCE_CONFIGS[siteId] || null;
  const projectDataSource = {
    legacyAppId: normalizeOptionalText(sourceConfig?.legacyAppId) || normalizeOptionalText(builtin?.legacyAppId),
    databaseKey: normalizeOptionalText(sourceConfig?.databaseKey) || normalizeOptionalText(builtin?.databaseKey),
    modelKey: normalizeOptionalText(sourceConfig?.modelKey) || normalizeOptionalText(builtin?.modelKey),
    preferredProjectKey:
      normalizeOptionalText(sourceConfig?.preferredProjectKey) || normalizeOptionalText(builtin?.preferredProjectKey)
  };
  const builtinProjectDataAccess = resolveBuiltinProjectDataAccess(siteId, projectDataSource);
  const builtinRealtimeBaseUrl = builtinProjectDataAccess ? BUILTIN_REALTIME_BASE_URL : "";
  const merged = {
    siteId,
    legacyBaseUrl: normalizeOptionalText(
      sourceConfig?.legacyBaseUrl || builtin?.legacyBaseUrl || builtinRealtimeBaseUrl
    ),
    realtimeParamsBaseUrl: normalizeOptionalText(
      sourceConfig?.realtimeParamsBaseUrl || builtin?.realtimeParamsBaseUrl
    ),
    ipAddress: normalizeOptionalText(sourceConfig?.ipAddress),
    port: normalizeOptionalText(sourceConfig?.port),
    legacyAppId: normalizeOptionalText(sourceConfig?.legacyAppId || builtin?.legacyAppId),
    databaseKey: normalizeOptionalText(sourceConfig?.databaseKey || builtin?.databaseKey),
    modelKey: normalizeOptionalText(sourceConfig?.modelKey || builtin?.modelKey),
    preferredProjectKey: normalizeOptionalText(sourceConfig?.preferredProjectKey || builtin?.preferredProjectKey),
    template: normalizeOptionalText(sourceConfig?.template || builtin?.template),
    ratedCoolingCapacityKw: normalizeOptionalNumber(
      sourceConfig?.ratedCoolingCapacityKw || builtin?.ratedCoolingCapacityKw
    ),
    chillerStaging: normalizeOptionalJsonObject(sourceConfig?.chillerStaging || builtin?.chillerStaging),
    operationalDiagnosticsPointDictionary: normalizeOptionalJsonObject(
      sourceConfig?.operationalDiagnosticsPointDictionary || builtin?.operationalDiagnosticsPointDictionary
    ),
    readOnlyRuntimeEnrichment: normalizeOptionalJsonObject(builtin?.readOnlyRuntimeEnrichment),
    towerApproach: normalizeOptionalJsonObject(sourceConfig?.towerApproach || builtin?.towerApproach),
    pumpDeltaT: normalizeOptionalJsonObject(sourceConfig?.pumpDeltaT || builtin?.pumpDeltaT),
    deviceDataProjectKey: normalizeOptionalText(builtinProjectDataAccess?.projectKey),
    deviceDataInterfaces: builtinProjectDataAccess?.items,
    defaultDeviceQuery: builtinProjectDataAccess?.defaultQuery,
    controlMode: normalizeOptionalText(sourceConfig?.controlMode),
    status: normalizeOptionalText(sourceConfig?.status)
  };

  return Object.values(merged).some(Boolean) ? merged : null;
}

export function resolveSiteRuntimeConfig(baseConfig, adminStore, siteId) {
  if (!siteId) {
    return baseConfig;
  }

  const sourceConfig = adminStore?.getSiteSourceConfig ? adminStore.getSiteSourceConfig(siteId) : null;
  const siteRuntimeAdminConfig = readSiteRuntimeAdminConfig(adminStore, siteId);
  const mergedSourceConfig = mergeSourceConfig(siteId, sourceConfig);
  const overrideBaseUrl = normalizeLegacyBaseUrl(mergedSourceConfig?.legacyBaseUrl);
  const overrideRealtimeParamsBaseUrl = normalizeLegacyBaseUrl(mergedSourceConfig?.realtimeParamsBaseUrl);
  const towerApproach = buildTowerApproachConfig(baseConfig, siteRuntimeAdminConfig, mergedSourceConfig);
  const pumpDeltaT = buildPumpDeltaTConfig(baseConfig, siteRuntimeAdminConfig, mergedSourceConfig);
  const chillerStaging = buildChillerStagingConfig(baseConfig, siteRuntimeAdminConfig, mergedSourceConfig);
  if (
    !overrideBaseUrl &&
    !mergedSourceConfig &&
    !siteRuntimeAdminConfig &&
    !towerApproach &&
    !pumpDeltaT &&
    !chillerStaging
  ) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    legacyBaseUrl: overrideBaseUrl || baseConfig.legacyBaseUrl,
    realtimeParamsBaseUrl: overrideRealtimeParamsBaseUrl || baseConfig.realtimeParamsBaseUrl,
    legacyAppId: normalizeOptionalText(mergedSourceConfig?.legacyAppId) || normalizeOptionalText(baseConfig?.legacyAppId),
    ratedCoolingCapacityKw:
      normalizeOptionalNumber(mergedSourceConfig?.ratedCoolingCapacityKw) ??
      normalizeOptionalNumber(baseConfig?.ratedCoolingCapacityKw),
    ...(towerApproach ? { towerApproach } : {}),
    ...(pumpDeltaT ? { pumpDeltaT } : {}),
    ...(chillerStaging ? { chillerStaging } : {}),
    siteSourceConfig: mergedSourceConfig,
    siteRuntimeAdminConfig
  };
}
