import { randomBytes } from "node:crypto";
import path from "node:path";

import { config as appConfig } from "../src/config.js";
import { createAdminStore } from "../src/lib/admin-db.js";

const PROFILE_B25_COLD_ONLY = "b25-cold-only";
const PROFILE_OFFICE_ALL_SYSTEMS_DEMO = "office-all-systems-demo";
const LEGACY_PROFILE_COLD_AIR = "cold-air";

const CONFIGURABLE_SUBSYSTEMS = [
  "chilled_plant",
  "power_monitoring",
  "compressed_air",
  "boiler_room",
  "hvac_terminal"
];

const OFFICE_FCU_WHITELIST = [
  "BGS01",
  "BGS02",
  "BGS03",
  "BGS04",
  "BGS05",
  "BGS06",
  "CWS",
  "DHYS",
  "DTT",
  "GCBGQ01",
  "GCBGQ02",
  "GCBGQ03",
  "JDS",
  "LZBGS",
  "QT01",
  "QT02",
  "QTS",
  "SYS",
  "TNFBQ01",
  "TNFBQ02",
  "WSJ01",
  "WSJ02",
  "XZBGS",
  "YFBGQ01",
  "YFBGQ02",
  "YFBGQ03",
  "YFBGQ04",
  "ZHYS",
  "ZZBGS"
];

const OFFICE_FCU_CONTROL_POLICY = {
  enabled: true,
  defaultMode: "enforced",
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
  dispatchAdapter: "legacy-scene-command",
  whitelist: OFFICE_FCU_WHITELIST,
  deviceOverrides: {}
};

function parseStringOption(name, fallback = "") {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const value = arg.slice(name.length + 3).trim();
  return value || fallback;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeProfile(value) {
  const normalized = normalizeText(value, PROFILE_B25_COLD_ONLY).toLowerCase();
  if (normalized === LEGACY_PROFILE_COLD_AIR) {
    return PROFILE_OFFICE_ALL_SYSTEMS_DEMO;
  }
  if ([PROFILE_B25_COLD_ONLY, PROFILE_OFFICE_ALL_SYSTEMS_DEMO].includes(normalized)) {
    return normalized;
  }
  throw new Error(
    `Unknown profile: ${normalized}. Expected ${PROFILE_B25_COLD_ONLY} or ${PROFILE_OFFICE_ALL_SYSTEMS_DEMO}.`
  );
}

const CHILLED_PLANT_POINT_ROLE_MAPPINGS = [
  {
    pointRole: "power",
    pointName: "冷站总功率",
    pointCode: "dashboard.metrics.totalPowerKw",
    unit: "kW",
    required: true,
    source: "legacy_bff_runtime"
  },
  {
    pointRole: "temperature",
    pointName: "冷冻/冷却水供回水温度",
    pointCode: "runtimeSummary.keySignals.waterTemperatures",
    unit: "°C",
    required: true,
    source: "legacy_bff_runtime"
  },
  {
    pointRole: "flow",
    pointName: "冷冻/冷却水流量",
    pointCode: "runtimeSummary.groups.pumps.flowM3h",
    unit: "m3/h",
    required: true,
    source: "legacy_bff_runtime"
  },
  {
    pointRole: "status",
    pointName: "冷机/水泵/冷却塔运行状态",
    pointCode: "runtimeSummary.groups.equipment.status",
    required: true,
    source: "legacy_bff_runtime"
  },
  {
    pointRole: "alarm",
    pointName: "冷站告警与事件",
    pointCode: "alarmSummary.activeEvents",
    required: true,
    source: "legacy_bff_runtime"
  }
];

const POINT_ROLE_MAPPINGS_BY_SUBSYSTEM = {
  chilled_plant: CHILLED_PLANT_POINT_ROLE_MAPPINGS,
  power_monitoring: [
    {
      pointRole: "power",
      pointName: "总进线有功功率",
      pointCode: "DEMO_PWR_MAIN_KW",
      unit: "kW",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "feedback",
      pointName: "今日用电/最大需量/功率因数",
      pointCode: "DEMO_PWR_ENERGY_DEMAND_PF",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "status",
      pointName: "馈线运行状态",
      pointCode: "DEMO_PWR_FEEDER_STATUS",
      required: false,
      source: "office_demo_package"
    },
    {
      pointRole: "alarm",
      pointName: "电力告警",
      pointCode: "DEMO_PWR_ALARM",
      required: false,
      source: "office_demo_package"
    }
  ],
  compressed_air: [
    {
      pointRole: "power",
      pointName: "空压站总功率",
      pointCode: "AIR_TOTAL_KW",
      unit: "kW",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "pressure",
      pointName: "管网压力",
      pointCode: "AIR_NET_BAR",
      unit: "bar",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "flow",
      pointName: "供气流量",
      pointCode: "AIR_FLOW_NM3_MIN",
      unit: "Nm3/min",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "status",
      pointName: "空压机加载状态",
      pointCode: "AIR_COMP_LOAD_STATUS",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "alarm",
      pointName: "空压站故障报警",
      pointCode: "AIR_ALARM_STATUS",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "temperature",
      pointName: "干燥机露点",
      pointCode: "AIR_DRYER_DEW_TEMP",
      unit: "°C",
      required: false,
      source: "office_demo_package"
    },
    {
      pointRole: "feedback",
      pointName: "空压单耗",
      pointCode: "AIR_SPECIFIC_KWH_NM3",
      unit: "kWh/Nm3",
      required: false,
      source: "office_demo_package"
    }
  ],
  boiler_room: [
    {
      pointRole: "temperature",
      pointName: "锅炉供回水/蒸汽温度",
      pointCode: "DEMO_BOILER_TEMP",
      unit: "°C",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "pressure",
      pointName: "锅炉系统压力",
      pointCode: "DEMO_BOILER_PRESSURE",
      unit: "MPa",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "flow",
      pointName: "热媒流量",
      pointCode: "DEMO_BOILER_FLOW",
      unit: "m3/h",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "status",
      pointName: "锅炉运行状态",
      pointCode: "DEMO_BOILER_STATUS",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "power",
      pointName: "锅炉房电功率",
      pointCode: "DEMO_BOILER_KW",
      unit: "kW",
      required: false,
      source: "office_demo_package"
    }
  ],
  hvac_terminal: [
    {
      pointRole: "temperature",
      pointName: "办公区平均温度/送回风温度",
      pointCode: "DEMO_AHU_TEMP",
      unit: "°C",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "status",
      pointName: "末端运行状态",
      pointCode: "DEMO_AHU_STATUS",
      required: true,
      source: "office_demo_package"
    },
    {
      pointRole: "feedback",
      pointName: "阀门/风阀反馈",
      pointCode: "DEMO_AHU_VALVE_FEEDBACK",
      unit: "%",
      required: false,
      source: "office_demo_package"
    },
    {
      pointRole: "setpoint",
      pointName: "区域温度设定",
      pointCode: "DEMO_AHU_ZONE_SETPOINT",
      unit: "°C",
      required: false,
      source: "office_demo_package"
    },
    {
      pointRole: "alarm",
      pointName: "末端告警",
      pointCode: "DEMO_AHU_ALARM",
      required: false,
      source: "office_demo_package"
    }
  ]
};

function buildReadOnlyBoundary(notes) {
  return {
    mode: "read_only",
    approvalRequired: true,
    plcProtectionRequired: true,
    rollbackRequired: true,
    writeEnabled: false,
    notes
  };
}

function buildOfficeFcuControlBoundary() {
  return {
    mode: "enforced",
    approvalRequired: false,
    plcProtectionRequired: true,
    rollbackRequired: true,
    writeEnabled: true,
    notes: "仅空调末端 FCU 单台白名单启用自动闭环；真实写入必须经过 BA 适配器、数据质量门槛、最小保持时间、审计和回退保护。"
  };
}

function buildAdvisorBinding(subsystemType, demoData) {
  return {
    pluginKey: `${subsystemType}_advisor`,
    status: demoData ? "demo_data" : "available",
    mode: "monitoring",
    config: {
      advisoryOnly: true,
      demoData,
      outputBoundary: "recommendation_only",
      plcWriteEnabled: false
    }
  };
}

function buildCapabilityItem(subsystemType, enabled, profile) {
  const demoData = profile === PROFILE_OFFICE_ALL_SYSTEMS_DEMO;
  const names = {
    chilled_plant: "冷站系统",
    power_monitoring: "电力监控",
    compressed_air: "空压站",
    boiler_room: "锅炉房",
    hvac_terminal: "空调末端"
  };
  const disabledNotes = subsystemType === "chilled_plant"
    ? "冷站作为当前项目核心子系统。"
    : "B25 当前项目未配置该子系统，不显示 KPI、不参与统计、不生成 Advisor 建议。";
  if (!enabled) {
    return {
      subsystemType,
      status: "not_configured",
      mode: "monitoring",
      kpis: [],
      published: true,
      freshnessStatus: "not_configured",
      sourceStatus: "not_configured",
      advisorPluginStatus: "not_configured",
      pageTemplateStatus: "available",
      notes: disabledNotes,
      controlBoundary: buildReadOnlyBoundary("未配置子系统仅保留可接入入口，不写 PLC。")
    };
  }

  return {
    subsystemType,
    status: "enabled",
    mode: subsystemType === "chilled_plant" && !demoData ? "optimization_ready" : "monitoring",
    kpis: [],
    published: true,
    freshnessStatus: demoData ? "demo_data" : "fresh",
    sourceStatus: demoData ? "demo_data" : "ok",
    advisorPluginStatus: demoData ? "demo_data" : "available",
    pageTemplateStatus: "available",
    notes: demoData
      ? `${names[subsystemType]}用于盛世绿能办公楼全系统演示，数据边界为演示数据，不代表真实现场接入。`
      : "B25 真实项目边界：只保留冷站已接入，其他子系统未配置。",
    controlBoundary:
      demoData && subsystemType === "hvac_terminal"
        ? buildOfficeFcuControlBoundary()
        : buildReadOnlyBoundary(
            demoData
              ? "全系统演示默认只输出只读建议和界面样例；不开放 PLC 写点。"
              : "B25 冷站仍按只读/影子边界运行，不改变现场闭环逻辑。"
          ),
    advisorBinding: buildAdvisorBinding(subsystemType, demoData)
  };
}

function ensureSite(adminStore, profile, siteId, actor) {
  const existing = adminStore.getSite(siteId);
  if (profile === PROFILE_OFFICE_ALL_SYSTEMS_DEMO) {
    const sitePatch = {
      siteName: "盛世绿能办公楼",
      city: "上海",
      status: "active",
      ownerName: "演示运维组",
      remark: "全子系统演示项目；所有非冷站扩展均为演示数据，不代表真实现场接入。"
    };
    if (existing) {
      return adminStore.updateSite(siteId, sitePatch, actor, {
        requestId: `ensure-energy-demo-site-${siteId}`
      });
    }
    return adminStore.createSite(
      {
        siteId,
        siteCode: "126OFF",
        ...sitePatch
      },
      actor,
      {
        requestId: `ensure-energy-demo-site-${siteId}`
      }
    );
  }
  if (!existing) {
    throw new Error(`Site not found: ${siteId}. Create/import the B25 site before applying the cold-only profile.`);
  }
  return existing;
}

function buildGeneratedVersionId(profile) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const scope = profile === PROFILE_OFFICE_ALL_SYSTEMS_DEMO ? "office-all-systems" : "b25-cold-only";
  return `energy-demo-${scope}-${timestamp}-${randomBytes(4).toString("hex")}`;
}

function buildProfileConfig(profile, siteId, explicitVersionId) {
  const versionId = explicitVersionId || buildGeneratedVersionId(profile);
  if (profile === PROFILE_OFFICE_ALL_SYSTEMS_DEMO) {
    return {
      profile,
      siteId: normalizeText(siteId, "126lnoffice"),
      versionId,
      summary: "盛世绿能办公楼全子系统演示配置",
      enabledTypes: new Set(CONFIGURABLE_SUBSYSTEMS)
    };
  }
  return {
    profile,
    siteId: normalizeText(siteId, "140"),
    versionId,
    summary: "B25 冷站单系统配置",
    enabledTypes: new Set(["chilled_plant"])
  };
}

function upsertProfileMappings(adminStore, siteId, profile, enabledTypes, actor) {
  const mappingRowsBySubsystem = {};
  for (const subsystemType of CONFIGURABLE_SUBSYSTEMS) {
    const enabled = enabledTypes.has(subsystemType);
    const items = enabled ? POINT_ROLE_MAPPINGS_BY_SUBSYSTEM[subsystemType] || [] : [];
    const result = adminStore.upsertPointRoleMappings(
      siteId,
      {
        subsystemType,
        items
      },
      actor,
      {
        requestId: `ensure-energy-demo-${profile}-${subsystemType}-mappings-${siteId}`
      }
    );
    mappingRowsBySubsystem[subsystemType] = result.items.length;
  }
  return mappingRowsBySubsystem;
}

function ensureOfficeFcuControlPolicy(adminStore, profile, siteId, actor) {
  if (profile !== PROFILE_OFFICE_ALL_SYSTEMS_DEMO) {
    return null;
  }
  if (typeof adminStore.upsertFcuControlPolicy !== "function") {
    return null;
  }
  return adminStore.upsertFcuControlPolicy(siteId, OFFICE_FCU_CONTROL_POLICY, actor, {
    requestId: `ensure-energy-demo-${profile}-fcu-control-policy-${siteId}`
  });
}

function main() {
  const profile = normalizeProfile(parseStringOption("profile", process.env.ENERGY_DEMO_PROFILE || PROFILE_B25_COLD_ONLY));
  const explicitSiteId = parseStringOption("site-id", process.env.SITE_ID || "");
  const explicitVersionId = normalizeText(parseStringOption("version-id", process.env.ENERGY_DEMO_VERSION_ID || ""));
  const profileConfig = buildProfileConfig(profile, explicitSiteId, explicitVersionId);
  const dbFile = path.resolve(parseStringOption("db-file", process.env.ADMIN_DB_FILE || appConfig.adminDbFile));
  const actor = {
    userId: normalizeText(
      parseStringOption("actor-user-id", process.env.ENERGY_DEMO_ACTOR_USER_ID || "energy-demo-config-bot"),
      "energy-demo-config-bot"
    ),
    username: normalizeText(
      parseStringOption("actor-username", process.env.ENERGY_DEMO_ACTOR_USERNAME || "energy-demo-config-bot"),
      "energy-demo-config-bot"
    )
  };

  const adminStore = createAdminStore({ dbFile });
  try {
    const site = ensureSite(adminStore, profileConfig.profile, profileConfig.siteId, actor);
    adminStore.getSiteCapabilities(profileConfig.siteId, { publishedOnly: true });

    adminStore.upsertSiteSubsystems(
      profileConfig.siteId,
      {
        items: CONFIGURABLE_SUBSYSTEMS.map((subsystemType) =>
          buildCapabilityItem(subsystemType, profileConfig.enabledTypes.has(subsystemType), profileConfig.profile)
        )
      },
      actor,
      {
        requestId: `ensure-energy-demo-subsystems-${profileConfig.profile}-${profileConfig.siteId}`
      }
    );

    const mappingRowsBySubsystem = upsertProfileMappings(
      adminStore,
      profileConfig.siteId,
      profileConfig.profile,
      profileConfig.enabledTypes,
      actor
    );
    const fcuControlPolicyRecord = ensureOfficeFcuControlPolicy(
      adminStore,
      profileConfig.profile,
      profileConfig.siteId,
      actor
    );

    const version = adminStore.publishConfigVersion(profileConfig.siteId, profileConfig.versionId, actor, {
      summary: profileConfig.summary
    });
    const capabilities = adminStore.getSiteCapabilities(profileConfig.siteId, { publishedOnly: true });
    const enabledSubsystems = capabilities.items
      .filter((item) => item.status === "enabled" && item.reserved !== true)
      .map((item) => item.subsystemType);
    const sourceStatusBySubsystem = Object.fromEntries(
      capabilities.items
        .filter((item) => CONFIGURABLE_SUBSYSTEMS.includes(item.subsystemType))
        .map((item) => [item.subsystemType, item.sourceStatus])
    );
    const writeEnabledBySubsystem = Object.fromEntries(
      capabilities.items
        .filter((item) => CONFIGURABLE_SUBSYSTEMS.includes(item.subsystemType))
        .map((item) => [item.subsystemType, item.controlBoundary?.writeEnabled === true])
    );
    const pointMappingProgressBySubsystem = Object.fromEntries(
      capabilities.items
        .filter((item) => CONFIGURABLE_SUBSYSTEMS.includes(item.subsystemType))
        .map((item) => [item.subsystemType, item.pointMappingProgress ?? null])
    );
    const fcuPolicy = fcuControlPolicyRecord?.policy || null;

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          dbFile,
          profile: profileConfig.profile,
          siteId: profileConfig.siteId,
          siteName: site.siteName,
          versionId: version.versionId,
          versionStatus: version.status,
          enabledSubsystems,
          sourceStatusBySubsystem,
          pointMappingProgressBySubsystem,
          mappingRowsBySubsystem,
          writeEnabledBySubsystem,
          fcuControlPolicy: fcuPolicy
            ? {
                enabled: fcuPolicy.enabled === true,
                defaultMode: fcuPolicy.defaultMode,
                dispatchAdapter: fcuPolicy.dispatchAdapter,
                whitelistCount: Array.isArray(fcuPolicy.whitelist) ? fcuPolicy.whitelist.length : 0,
                allowStartStop: fcuPolicy.allowStartStop === true,
                allowSetpoint: fcuPolicy.allowSetpoint === true,
                allowFanSpeed: fcuPolicy.allowFanSpeed === true
              }
            : null
        },
        null,
        2
      )}\n`
    );
  } finally {
    adminStore.close();
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
