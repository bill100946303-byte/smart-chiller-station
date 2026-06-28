import { runtimeConfig } from "../config/runtimeConfig";
import type {
  AdminAuditLog,
  AdminConfigVersion,
  AdminConfigVersionResult,
  AdminMember,
  AdminMemberStatus,
  AdminMe,
  AdminPointRoleImportPreview,
  AdminPointRoleMapping,
  AdminRole,
  AdminRuntimeConfig,
  AdminScopeType,
  AdminSiteDetail,
  AdminSiteSubsystemCapability,
  AdminSiteStatus,
  AdminSourceConfig,
  AdminSourceStatus,
  AdminSubsystemRegistryItem
} from "./adminTypes";

type MockStore = {
  mockVersion?: string;
  sites: AdminSiteDetail[];
  sourceConfigs: Record<string, AdminSourceConfig>;
  runtimeConfigs: Record<string, AdminRuntimeConfig>;
  subsystemRegistry: AdminSubsystemRegistryItem[];
  siteSubsystems: Record<string, AdminSiteSubsystemCapability[]>;
  pointRoleMappings: Record<string, AdminPointRoleMapping[]>;
  configVersions: Record<string, AdminConfigVersion & { payload?: unknown }>;
  members: Record<string, AdminMember[]>;
  auditLogs: AdminAuditLog[];
  nextBindingId: number;
  nextAuditId: number;
};

const STORAGE_KEY = "chiller-admin-v1-mock-store";
const MOCK_STORE_VERSION = "energy-config-center-v7";

function nowIso(): string {
  return new Date().toISOString();
}

function requestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedSourceConfig(siteId: string, overrides: Partial<AdminSourceConfig> = {}): AdminSourceConfig {
  return {
    legacyBaseUrl: runtimeConfig.legacyBaseUrl,
    ipAddress: "",
    port: "",
    databaseKey: `${siteId}-db`,
    modelKey: `${siteId}-model`,
    preferredProjectKey: "",
    template: "1",
    controlMode: "auto",
    status: "connected",
    note: "",
    ...overrides
  };
}

function seedRuntimeConfig(
  siteId: string,
  overrides: Partial<AdminRuntimeConfig> = {}
): AdminRuntimeConfig {
  return {
    energyParamsJson: JSON.stringify(
      {
        siteId,
        dailyTargetCop: 5.5,
        alarmDelayMinutes: 15
      },
      null,
      2
    ),
    ruleThresholdsJson: JSON.stringify(
      {
        lowDeltaT: 2.0,
        highDeltaT: 6.5,
        towerApproach: {
          minCondenserInletTempC: 30,
          minCondenserInletTempCByModel: {
            "YK-01": 29.8
          },
          minCondenserInletTempCByChiller: {
            "ch-01": 30.2
          }
        }
      },
      null,
      2
    ),
    featureFlagsJson: JSON.stringify(
      {
        enableOptimization: true,
        enableAuditTrail: true
      },
      null,
      2
    ),
    version: "v1",
    updatedAt: nowIso(),
    updatedBy: "system",
    ...overrides
  };
}

function seedSubsystemRegistry(): AdminSubsystemRegistryItem[] {
  return [
    {
      subsystemType: "chilled_plant",
      displayName: "冷站系统",
      category: "core",
      description: "冷水机组、水泵、冷却塔与冷站群控。",
      defaultStatus: "enabled",
      reserved: false,
      sortOrder: 10,
      pointRoles: [
        { role: "power", label: "冷站总功率", required: true, unit: "kW" },
        { role: "temperature", label: "冷冻/冷却水温度", required: true, unit: "°C" },
        { role: "flow", label: "冷冻/冷却水流量", required: true, unit: "m3/h" },
        { role: "status", label: "设备状态", required: true },
        { role: "alarm", label: "设备告警", required: true }
      ]
    },
    {
      subsystemType: "power_monitoring",
      displayName: "电力监控",
      category: "power",
      description: "总功率、今日用电、最大需量、功率因数和馈线分项。",
      defaultStatus: "not_configured",
      reserved: false,
      sortOrder: 20,
      pointRoles: [
        { role: "power", label: "总有功功率", required: true, unit: "kW" },
        { role: "feedback", label: "今日用电", required: true, unit: "kWh" },
        { role: "feedback", label: "最大需量", required: true, unit: "kW" },
        { role: "feedback", label: "功率因数", required: true }
      ]
    },
    {
      subsystemType: "compressed_air",
      displayName: "空压站",
      category: "process",
      description: "空压机、干燥机、储气罐、压力优化、泄漏和单耗。",
      defaultStatus: "not_configured",
      reserved: false,
      sortOrder: 30,
      pointRoles: [
        { role: "power", label: "空压站总功率", required: true, unit: "kW" },
        { role: "pressure", label: "管网压力", required: true, unit: "bar" },
        { role: "flow", label: "供气流量", required: true, unit: "Nm3/min" },
        { role: "status", label: "运行/加载状态", required: true },
        { role: "alarm", label: "空压站告警", required: true },
        { role: "temperature", label: "干燥机露点", required: false, unit: "°C" },
        { role: "feedback", label: "单耗/泄漏诊断派生", required: false }
      ]
    },
    {
      subsystemType: "boiler_room",
      displayName: "锅炉房",
      category: "thermal",
      description: "锅炉、热媒温压流量、燃气/蒸汽与效率。",
      defaultStatus: "not_configured",
      reserved: false,
      sortOrder: 40,
      pointRoles: [
        { role: "temperature", label: "供回水温度", required: true, unit: "°C" },
        { role: "pressure", label: "系统压力", required: true, unit: "MPa" },
        { role: "flow", label: "热媒流量", required: true, unit: "m3/h" }
      ]
    },
    {
      subsystemType: "hvac_terminal",
      displayName: "空调末端",
      category: "terminal",
      description: "AHU、PAU、FCU、VAV 和区域温湿度。",
      defaultStatus: "not_configured",
      reserved: false,
      sortOrder: 50,
      pointRoles: [
        { role: "temperature", label: "区域温度", required: true, unit: "°C" },
        { role: "status", label: "末端状态", required: true }
      ]
    },
    ...[
      ["photovoltaic_storage", "光伏储能"],
      ["water_treatment", "水处理"],
      ["ev_charging", "充电桩"],
      ["steam_network", "蒸汽管网"]
    ].map(([subsystemType, displayName], index) => ({
      subsystemType,
      displayName,
      category: "reserved",
      description: "预留扩展子系统。",
      defaultStatus: "not_applicable" as const,
      reserved: true,
      sortOrder: 70 + index * 10,
      pointRoles: []
    }))
  ];
}

function seedSiteSubsystems(siteId: string, registry: AdminSubsystemRegistryItem[]): AdminSiteSubsystemCapability[] {
  const enabledBySite: Record<string, Set<string>> = {
    "126lnoffice": new Set(["chilled_plant", "power_monitoring", "compressed_air", "boiler_room", "hvac_terminal"]),
    "140": new Set(["chilled_plant"])
  };
  const progressBySubsystem: Record<string, number> = {
    chilled_plant: 100,
    power_monitoring: 64,
    compressed_air: 100,
    boiler_room: 52,
    hvac_terminal: 46
  };
  return registry.map((item) => {
    const enabledSet = enabledBySite[siteId] || new Set(["chilled_plant"]);
    const enabled = enabledSet.has(item.subsystemType) && !item.reserved;
    const officeDemoData = siteId === "126lnoffice" && enabled;
    const status = enabled ? "enabled" : item.defaultStatus;
    return {
      siteId,
      subsystemType: item.subsystemType,
      displayName: item.displayName,
      category: item.category,
      description: item.description,
      status,
      mode: item.reserved ? "reserved" : item.subsystemType === "chilled_plant" ? "optimization_ready" : "monitoring",
      reserved: item.reserved,
      enabled,
      kpis: enabled ? [] : [],
      alarmCount: enabled ? 0 : null,
      freshnessStatus: officeDemoData ? "demo_data" : enabled ? "fresh" : "not_configured",
      sourceStatus: officeDemoData ? "demo_data" : enabled ? "ok" : "not_configured",
      pointMappingProgress: officeDemoData ? 100 : enabled ? progressBySubsystem[item.subsystemType] || 35 : 0,
      advisorPluginStatus: officeDemoData ? "demo_data" : enabled ? "available" : "not_configured",
      pageTemplateStatus: item.reserved ? "reserved" : "available",
      published: true,
      notes: officeDemoData
        ? "盛世绿能办公楼全系统演示数据，不代表真实现场接入。"
        : item.reserved
          ? "预留扩展能力。"
          : "",
      requiredPointRoles: item.pointRoles,
      advisorBindings: enabled
        ? [
            {
              pluginKey: `${item.subsystemType}_advisor`,
              status: officeDemoData ? "demo_data" : "available",
              mode: "monitoring",
              config: officeDemoData ? { demoData: true, advisoryOnly: true, plcWriteEnabled: false } : {}
            }
          ]
        : [],
      controlBoundary: {
        mode: "read_only",
        approvalRequired: true,
        plcProtectionRequired: true,
        rollbackRequired: true,
        writeEnabled: false,
        notes: officeDemoData ? "演示数据只读展示，不写 PLC。" : "第一版只读/影子运行。"
      }
    };
  });
}

function seedPointRoleMappings(siteId: string): AdminPointRoleMapping[] {
  const chilled: AdminPointRoleMapping[] = [
    { siteId, subsystemType: "chilled_plant", pointRole: "power", pointName: "冷站总功率", pointCode: "CHP_TOTAL_KW", unit: "kW", required: true, writable: false },
    { siteId, subsystemType: "chilled_plant", pointRole: "temperature", pointName: "冷冻水供水温度", pointCode: "CHW_SUP_TEMP", unit: "°C", required: true, writable: false },
    { siteId, subsystemType: "chilled_plant", pointRole: "flow", pointName: "冷冻水流量", pointCode: "CHW_FLOW", unit: "m3/h", required: true, writable: false },
    { siteId, subsystemType: "chilled_plant", pointRole: "status", pointName: "冷站设备运行状态", pointCode: "CHP_RUN_STATUS", required: true, writable: false },
    { siteId, subsystemType: "chilled_plant", pointRole: "alarm", pointName: "冷站设备告警", pointCode: "CHP_ALARM_STATUS", required: true, writable: false }
  ];
  const allSystemDemoEnabled = siteId === "126lnoffice";
  const powerEnabled = allSystemDemoEnabled;
  const compressedAirEnabled = allSystemDemoEnabled;
  const fullEnabled = allSystemDemoEnabled;
  const power: AdminPointRoleMapping[] = powerEnabled
    ? [
        { siteId, subsystemType: "power_monitoring", pointRole: "power", pointName: "总进线有功功率", pointCode: "P_MAIN_KW", unit: "kW", required: true, writable: false },
        { siteId, subsystemType: "power_monitoring", pointRole: "feedback", pointName: "今日总用电", pointCode: "P_TODAY_KWH", unit: "kWh", required: true, writable: false }
      ]
    : [];
  const compressedAir: AdminPointRoleMapping[] = compressedAirEnabled
    ? [
        { siteId, subsystemType: "compressed_air", pointRole: "power", pointName: "空压站总功率", pointCode: "AIR_TOTAL_KW", unit: "kW", required: true, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "pressure", pointName: "管网压力", pointCode: "AIR_NET_BAR", unit: "bar", required: true, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "flow", pointName: "供气流量", pointCode: "AIR_FLOW_NM3_MIN", unit: "Nm3/min", required: true, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "status", pointName: "空压机加载状态", pointCode: "AIR_COMP_LOAD_STATUS", required: true, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "alarm", pointName: "空压站故障报警", pointCode: "AIR_ALARM_STATUS", required: true, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "temperature", pointName: "干燥机露点", pointCode: "AIR_DRYER_DEW_TEMP", unit: "°C", required: false, writable: false },
        { siteId, subsystemType: "compressed_air", pointRole: "feedback", pointName: "空压单耗", pointCode: "AIR_SPECIFIC_KWH_NM3", unit: "kWh/Nm3", required: false, writable: false }
      ]
    : [];
  const fullSystems: AdminPointRoleMapping[] = fullEnabled
    ? [
        { siteId, subsystemType: "boiler_room", pointRole: "temperature", pointName: "锅炉供水温度", pointCode: "BOILER_SUP_TEMP", unit: "°C", required: true, writable: false },
        { siteId, subsystemType: "boiler_room", pointRole: "pressure", pointName: "锅炉系统压力", pointCode: "BOILER_SYS_MPA", unit: "MPa", required: true, writable: false },
        { siteId, subsystemType: "hvac_terminal", pointRole: "temperature", pointName: "办公区平均温度", pointCode: "AHU_ZONE_AVG_TEMP", unit: "°C", required: true, writable: false },
        { siteId, subsystemType: "hvac_terminal", pointRole: "status", pointName: "末端运行状态", pointCode: "AHU_RUN_STATUS", required: true, writable: false }
      ]
    : [];
  return [...chilled, ...power, ...compressedAir, ...fullSystems].map((item, index) => ({
    mappingId: `mock-${siteId}-${index + 1}`,
    direction: "read",
    source: "mock",
    notes: "",
    ...item
  }));
}

function seedSite(
  siteId: string,
  siteName: string,
  overrides: Partial<AdminSiteDetail> = {}
): AdminSiteDetail {
  return {
    siteId,
    siteName,
    siteCode: overrides.siteCode || `${siteId.toUpperCase().slice(0, 6)}`,
    city: overrides.city || "上海",
    status: overrides.status || "active",
    ownerName: overrides.ownerName || "运维组",
    remark: overrides.remark || "",
    sourceStatus: overrides.sourceStatus || "ok",
    runtimeStatus: overrides.runtimeStatus || "ok",
    sourceUpdatedAt: nowIso(),
    runtimeUpdatedAt: nowIso(),
    memberCount: overrides.memberCount || 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: "system",
    updatedBy: "system",
    ...overrides
  };
}

function seedStore(): MockStore {
  const subsystemRegistry = seedSubsystemRegistry();
  const sites = [
    seedSite("126lnoffice", "盛世绿能办公楼", {
      city: "上海",
      ownerName: "王工",
      remark: "全子系统演示项目；冷站、空压、电力、锅炉、末端均为演示数据，不代表真实现场接入。"
    }),
    seedSite("140", "观澜 B25", {
      status: "active",
      sourceStatus: "partial",
      runtimeStatus: "partial",
      city: "深圳",
      ownerName: "李工",
      remark: "B25 真实边界为冷站单系统；空压、电力、锅炉、末端未配置，不显示 KPI。"
    })
  ];

  const sourceConfigs: Record<string, AdminSourceConfig> = {
    "126lnoffice": seedSourceConfig("126lnoffice", {
      ipAddress: "10.10.12.6",
      port: "8098",
      databaseKey: "126lnoffice-main",
      modelKey: "model-a",
      preferredProjectKey: "126lnoffice-main",
      template: "2",
      note: "主站点已同步"
    }),
    "140": seedSourceConfig("140", {
      ipAddress: "10.10.14.0",
      port: "8098",
      databaseKey: "140-b25",
      modelKey: "model-b25",
      preferredProjectKey: "140-b25",
      template: "1",
      controlMode: "manual"
    })
  };

  const runtimeConfigs: Record<string, AdminRuntimeConfig> = {
    "126lnoffice": seedRuntimeConfig("126lnoffice", {
      version: "v1.2.0",
      updatedBy: "system"
    }),
    "140": seedRuntimeConfig("140", {
      version: "v1.1.0",
      updatedBy: "system"
    })
  };

  const members: Record<string, AdminMember[]> = {
    "126lnoffice": [
      {
        bindingId: "bind-1",
        userId: "1001",
        username: "admin",
        role: "platform_admin",
        scopeType: "platform",
        status: "active",
        joinedAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        bindingId: "bind-2",
        userId: "1002",
        username: "ops",
        role: "site_admin",
        scopeType: "site",
        scopeId: "126lnoffice",
        status: "active",
        joinedAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    "140": [
      {
        bindingId: "bind-3",
        userId: "1003",
        username: "b25",
        role: "site_admin",
        scopeType: "site",
        scopeId: "140",
        status: "active",
        joinedAt: nowIso(),
        updatedAt: nowIso()
      }
    ]
  };

  const auditLogs: AdminAuditLog[] = [
    {
      id: "audit-1",
      ts: nowIso(),
      actor: "system",
      action: "seed_site",
      targetType: "site",
      targetId: "126lnoffice",
      requestId: requestId(),
      details: "Initial mock seed"
    }
  ];

  const siteSubsystems = Object.fromEntries(sites.map((site) => [site.siteId, seedSiteSubsystems(site.siteId, subsystemRegistry)]));
  const pointRoleMappings = Object.fromEntries(sites.map((site) => [site.siteId, seedPointRoleMappings(site.siteId)]));
  const configVersions = Object.fromEntries(
    sites.map((site) => {
      const versionId = "cfg-demo-baseline";
      return [
        `${site.siteId}:${versionId}`,
        {
          versionId,
          siteId: site.siteId,
          status: "published",
          summary: `${site.siteName} 初始已发布配置`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          createdBy: "system",
          updatedBy: "system",
          publishedAt: nowIso(),
          rolledBackAt: null,
          payload: {
            subsystems: siteSubsystems[site.siteId],
            pointRoleMappings: pointRoleMappings[site.siteId]
          }
        }
      ];
    })
  );

  return {
    mockVersion: MOCK_STORE_VERSION,
    sites,
    sourceConfigs,
    runtimeConfigs,
    subsystemRegistry,
    siteSubsystems,
    pointRoleMappings,
    configVersions,
    members,
    auditLogs,
    nextBindingId: 4,
    nextAuditId: 2
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadStore(): MockStore {
  if (!isBrowser()) {
    return seedStore();
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as MockStore;
    if (parsed.mockVersion !== MOCK_STORE_VERSION) {
      const seeded = seedStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    if (!Array.isArray(parsed.sites)) {
      throw new Error("invalid store");
    }
    if (!Array.isArray(parsed.subsystemRegistry)) {
      parsed.subsystemRegistry = seedSubsystemRegistry();
    }
    if (!parsed.siteSubsystems || typeof parsed.siteSubsystems !== "object") {
      parsed.siteSubsystems = Object.fromEntries(parsed.sites.map((site) => [site.siteId, seedSiteSubsystems(site.siteId, parsed.subsystemRegistry)]));
    }
    if (!parsed.pointRoleMappings || typeof parsed.pointRoleMappings !== "object") {
      parsed.pointRoleMappings = Object.fromEntries(parsed.sites.map((site) => [site.siteId, seedPointRoleMappings(site.siteId)]));
    }
    if (!parsed.configVersions || typeof parsed.configVersions !== "object") {
      parsed.configVersions = {};
    }
    return parsed;
  } catch {
    const seeded = seedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveStore(store: MockStore): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function touchSite(
  store: MockStore,
  siteId: string,
  changed: { source?: boolean; runtime?: boolean } = {}
): void {
  const site = store.sites.find((item) => item.siteId === siteId);
  if (!site) {
    return;
  }
  site.updatedAt = nowIso();
  site.memberCount = (store.members[siteId] || []).length;
  if (changed.source) {
    site.sourceUpdatedAt = nowIso();
  }
  if (changed.runtime) {
    site.runtimeUpdatedAt = nowIso();
  }
}

function logAudit(
  store: MockStore,
  entry: Omit<AdminAuditLog, "id" | "ts" | "requestId">
): AdminAuditLog {
  const log: AdminAuditLog = {
    ...entry,
    id: `audit-${store.nextAuditId++}`,
    ts: nowIso(),
    requestId: requestId()
  };
  store.auditLogs.unshift(log);
  return log;
}

function normalizeRole(value: string): AdminRole {
  if (value === "platform_admin" || value === "site_admin" || value === "auditor") {
    return value;
  }
  return "site_admin";
}

function normalizeStatus(value: string): AdminSiteStatus {
  if (value === "pending" || value === "disabled" || value === "error") {
    return value;
  }
  return "active";
}

function normalizeSourceStatus(value: string): AdminSourceStatus {
  if (value === "partial" || value === "failed") {
    return value;
  }
  return "ok";
}

function normalizeMemberStatus(value: string): AdminMemberStatus {
  if (value === "invited" || value === "disabled") {
    return value;
  }
  return "active";
}

export function createMockMe(userId: string, username: string): AdminMe {
  const store = loadStore();
  const bootstrapUsers = new Set(
    [
      ...runtimeConfig.bootstrapUserIds,
      ...runtimeConfig.bootstrapUsernames
    ].map((value) => value.trim()).filter(Boolean)
  );
  const matched =
    bootstrapUsers.has(userId.trim()) || bootstrapUsers.has(username.trim());
  return {
    userId,
    username,
    role: matched ? "platform_admin" : "site_admin",
    visibleSites: clone(store.sites),
    bootstrap: matched
  };
}

export function getMockSites(): AdminSiteDetail[] {
  return clone(loadStore().sites);
}

export function createMockSite(site: Partial<AdminSiteDetail>): AdminSiteDetail {
  const store = loadStore();
  const siteId = String(site.siteId || "").trim();
  if (!siteId) {
    throw new Error("siteId is required");
  }
  const existing = store.sites.find((item) => item.siteId === siteId);
  if (existing) {
    throw new Error("site already exists");
  }
  const record = seedSite(siteId, site.siteName || siteId, {
    siteCode: site.siteCode,
    city: site.city,
    status: normalizeStatus(String(site.status || "active")),
    ownerName: site.ownerName,
    remark: site.remark,
    sourceStatus: normalizeSourceStatus(String(site.sourceStatus || "ok")),
    runtimeStatus: normalizeSourceStatus(String(site.runtimeStatus || "ok")),
    memberCount: Number(site.memberCount || 0),
    updatedBy: site.updatedBy || "admin"
  });
  store.sites.unshift(record);
  store.sourceConfigs[siteId] = seedSourceConfig(siteId);
  store.runtimeConfigs[siteId] = seedRuntimeConfig(siteId);
  store.members[siteId] = [];
  logAudit(store, {
    actor: site.updatedBy || "admin",
    action: "create_site",
    targetType: "site",
    targetId: siteId,
    afterJson: JSON.stringify(record, null, 2)
  });
  saveStore(store);
  return clone(record);
}

export function updateMockSite(siteId: string, patch: Partial<AdminSiteDetail>, actor = "admin"): AdminSiteDetail {
  const store = loadStore();
  const site = store.sites.find((item) => item.siteId === siteId);
  if (!site) {
    throw new Error("site not found");
  }
  const before = clone(site);
  site.siteName = patch.siteName ?? site.siteName;
  site.siteCode = patch.siteCode ?? site.siteCode;
  site.city = patch.city ?? site.city;
  site.status = patch.status ? normalizeStatus(String(patch.status)) : site.status;
  site.ownerName = patch.ownerName ?? site.ownerName;
  site.remark = patch.remark ?? site.remark;
  site.sourceStatus = patch.sourceStatus
    ? normalizeSourceStatus(String(patch.sourceStatus))
    : site.sourceStatus;
  site.runtimeStatus = patch.runtimeStatus
    ? normalizeSourceStatus(String(patch.runtimeStatus))
    : site.runtimeStatus;
  site.memberCount = patch.memberCount ?? site.memberCount;
  site.updatedAt = nowIso();
  site.updatedBy = actor;
  logAudit(store, {
    actor,
    action: "update_site",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(site, null, 2)
  });
  saveStore(store);
  return clone(site);
}

export function getMockSite(siteId: string): AdminSiteDetail {
  const store = loadStore();
  const site = store.sites.find((item) => item.siteId === siteId);
  if (!site) {
    throw new Error("site not found");
  }
  return clone(site);
}

export function getMockSourceConfig(siteId: string): AdminSourceConfig {
  const store = loadStore();
  if (!store.sourceConfigs[siteId]) {
    store.sourceConfigs[siteId] = seedSourceConfig(siteId);
    saveStore(store);
  }
  return clone(store.sourceConfigs[siteId]);
}

export function updateMockSourceConfig(
  siteId: string,
  patch: Partial<AdminSourceConfig>,
  actor = "admin"
): AdminSourceConfig {
  const store = loadStore();
  const before = clone(getMockSourceConfig(siteId));
  const next = {
    ...before,
    ...patch
  };
  store.sourceConfigs[siteId] = next;
  touchSite(store, siteId, { source: true });
  logAudit(store, {
    actor,
    action: "update_source_config",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(next, null, 2)
  });
  saveStore(store);
  return clone(next);
}

export function getMockRuntimeConfig(siteId: string): AdminRuntimeConfig {
  const store = loadStore();
  if (!store.runtimeConfigs[siteId]) {
    store.runtimeConfigs[siteId] = seedRuntimeConfig(siteId);
    saveStore(store);
  }
  return clone(store.runtimeConfigs[siteId]);
}

export function updateMockRuntimeConfig(
  siteId: string,
  patch: Partial<AdminRuntimeConfig>,
  actor = "admin"
): AdminRuntimeConfig {
  const store = loadStore();
  const before = clone(getMockRuntimeConfig(siteId));
  const next = {
    ...before,
    ...patch,
    updatedAt: nowIso(),
    updatedBy: actor
  };
  store.runtimeConfigs[siteId] = next;
  touchSite(store, siteId, { runtime: true });
  logAudit(store, {
    actor,
    action: "update_runtime_config",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(next, null, 2)
  });
  saveStore(store);
  return clone(next);
}

export function listMockMembers(siteId: string): AdminMember[] {
  const store = loadStore();
  return clone(store.members[siteId] || []);
}

export function createMockMember(
  siteId: string,
  payload: {
    userId: string;
    username: string;
    role: AdminRole;
    scopeType: AdminScopeType;
    scopeId?: string;
    status?: string;
  },
  actor = "admin"
): AdminMember {
  const store = loadStore();
  const next: AdminMember = {
    bindingId: `bind-${store.nextBindingId++}`,
    userId: payload.userId,
    username: payload.username,
    role: normalizeRole(payload.role),
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    status: normalizeMemberStatus(payload.status || "active"),
    joinedAt: nowIso(),
    updatedAt: nowIso()
  };
  store.members[siteId] = [...(store.members[siteId] || []), next];
  touchSite(store, siteId);
  logAudit(store, {
    actor,
    action: "create_member",
    targetType: "site",
    targetId: siteId,
    afterJson: JSON.stringify(next, null, 2)
  });
  saveStore(store);
  return clone(next);
}

export function updateMockMember(
  siteId: string,
  bindingId: string,
  patch: Partial<AdminMember>,
  actor = "admin"
): AdminMember {
  const store = loadStore();
  const list = store.members[siteId] || [];
  const member = list.find((item) => item.bindingId === bindingId);
  if (!member) {
    throw new Error("member not found");
  }
  const before = clone(member);
  member.userId = patch.userId ?? member.userId;
  member.username = patch.username ?? member.username;
  member.role = patch.role ? normalizeRole(patch.role) : member.role;
  member.scopeType = patch.scopeType ?? member.scopeType;
  member.scopeId = patch.scopeId ?? member.scopeId;
  member.status = patch.status ? normalizeMemberStatus(patch.status) : member.status;
  member.updatedAt = nowIso();
  touchSite(store, siteId);
  logAudit(store, {
    actor,
    action: "update_member",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(member, null, 2)
  });
  saveStore(store);
  return clone(member);
}

export function deleteMockMember(siteId: string, bindingId: string, actor = "admin"): void {
  const store = loadStore();
  const list = store.members[siteId] || [];
  const index = list.findIndex((item) => item.bindingId === bindingId);
  if (index < 0) {
    throw new Error("member not found");
  }
  const [removed] = list.splice(index, 1);
  store.members[siteId] = list;
  touchSite(store, siteId);
  logAudit(store, {
    actor,
    action: "delete_member",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(removed, null, 2)
  });
  saveStore(store);
}

export function getMockAuditLogs(filters: {
  siteId?: string;
  keyword?: string;
  action?: string;
} = {}): AdminAuditLog[] {
  const store = loadStore();
  const keyword = filters.keyword?.trim().toLowerCase() || "";
  const action = filters.action?.trim().toLowerCase() || "";
  const siteId = filters.siteId?.trim() || "";
  return clone(
    store.auditLogs.filter((item) => {
      if (siteId && item.targetId !== siteId) {
        return false;
      }
      if (action && !item.action.toLowerCase().includes(action)) {
        return false;
      }
      if (keyword) {
        const haystack = `${item.actor} ${item.action} ${item.targetType} ${item.targetId} ${item.details || ""}`.toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }
      return true;
    })
  );
}

export function getMockSubsystemRegistry(): AdminSubsystemRegistryItem[] {
  return clone(loadStore().subsystemRegistry);
}

export function getMockSiteSubsystems(siteId: string): AdminSiteSubsystemCapability[] {
  const store = loadStore();
  if (!store.siteSubsystems[siteId]) {
    store.siteSubsystems[siteId] = seedSiteSubsystems(siteId, store.subsystemRegistry);
    saveStore(store);
  }
  return clone(store.siteSubsystems[siteId]);
}

export function updateMockSiteSubsystems(
  siteId: string,
  items: Partial<AdminSiteSubsystemCapability>[],
  actor = "admin"
): AdminSiteSubsystemCapability[] {
  const store = loadStore();
  const list = store.siteSubsystems[siteId] || seedSiteSubsystems(siteId, store.subsystemRegistry);
  const before = clone(list);
  items.forEach((patch) => {
    const subsystemType = String(patch.subsystemType || "").trim();
    const existing = list.find((item) => item.subsystemType === subsystemType);
    if (!existing) {
      return;
    }
    const enabled = patch.status ? patch.status === "enabled" : existing.enabled;
    existing.status = patch.status || existing.status;
    existing.enabled = enabled;
    existing.mode = patch.mode || existing.mode;
    existing.freshnessStatus = enabled ? patch.freshnessStatus || existing.freshnessStatus || "unknown" : "not_configured";
    existing.sourceStatus = enabled ? patch.sourceStatus || existing.sourceStatus || "unknown" : "not_configured";
    existing.advisorPluginStatus = enabled ? patch.advisorPluginStatus || existing.advisorPluginStatus || "available" : "not_configured";
    existing.alarmCount = enabled ? existing.alarmCount || 0 : null;
    existing.kpis = enabled ? existing.kpis || [] : [];
    existing.notes = patch.notes ?? existing.notes;
    existing.published = patch.published ?? existing.published;
    if (patch.controlBoundary) {
      existing.controlBoundary = {
        ...existing.controlBoundary,
        ...patch.controlBoundary,
        writeEnabled: false
      };
    }
  });
  store.siteSubsystems[siteId] = list;
  logAudit(store, {
    actor,
    action: "update_subsystems",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(list, null, 2)
  });
  saveStore(store);
  return clone(list);
}

export function getMockPointRoleMappings(siteId: string, subsystemType?: string): AdminPointRoleMapping[] {
  const store = loadStore();
  const list = store.pointRoleMappings[siteId] || seedPointRoleMappings(siteId);
  return clone(subsystemType ? list.filter((item) => item.subsystemType === subsystemType) : list);
}

export function updateMockPointRoleMappings(
  siteId: string,
  payload: { subsystemType?: string; items: Partial<AdminPointRoleMapping>[] },
  actor = "admin"
): AdminPointRoleMapping[] {
  const store = loadStore();
  const subsystemType = payload.subsystemType?.trim();
  const before = clone(store.pointRoleMappings[siteId] || []);
  const retained = subsystemType
    ? before.filter((item) => item.subsystemType !== subsystemType)
    : [];
  const nextItems = payload.items
    .filter((item) => item.pointName || item.pointCode)
    .map((item, index) => ({
      mappingId: `mock-${siteId}-${Date.now()}-${index}`,
      siteId,
      subsystemType: subsystemType || item.subsystemType || "chilled_plant",
      pointRole: item.pointRole || "feedback",
      pointName: String(item.pointName || item.pointCode || ""),
      pointCode: item.pointCode || "",
      unit: item.unit || "",
      dataType: item.dataType || "",
      direction: "read",
      required: Boolean(item.required),
      writable: false,
      source: "manual",
      notes: item.notes || ""
    }));
  store.pointRoleMappings[siteId] = [...retained, ...nextItems];
  logAudit(store, {
    actor,
    action: "update_point_role_mappings",
    targetType: "site",
    targetId: siteId,
    beforeJson: JSON.stringify(before, null, 2),
    afterJson: JSON.stringify(store.pointRoleMappings[siteId], null, 2)
  });
  saveStore(store);
  return clone(subsystemType ? nextItems : store.pointRoleMappings[siteId]);
}

export function getMockPointRoleImportPreview(
  siteId: string,
  payload: { subsystemType?: string; text?: string; rows?: unknown[] }
): AdminPointRoleImportPreview {
  const subsystemType = payload.subsystemType || "chilled_plant";
  const lines = (payload.text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items = lines.map((line, index) => {
    const [pointName, pointCode = "", unit = ""] = line.includes("\t") ? line.split("\t") : line.split(",");
    const haystack = `${pointName} ${pointCode}`.toLowerCase();
    const commandCandidate = haystack.includes("cmd") || haystack.includes("command") || haystack.includes("命令") || haystack.includes("指令") || haystack.includes("下发");
    const pointRole: AdminPointRoleMapping["pointRole"] = commandCandidate
      ? "command"
      : haystack.includes("告警") || haystack.includes("报警") || haystack.includes("alarm") || haystack.includes("fault") || haystack.includes("故障")
        ? "alarm"
        : haystack.includes("运行") || haystack.includes("状态") || haystack.includes("status") || haystack.includes("加载") || haystack.includes("卸载") || haystack.includes("load") || haystack.includes("unload")
          ? "status"
          : haystack.includes("单耗") || haystack.includes("比功率") || haystack.includes("泄漏率") || haystack.includes("kwh/nm3") || haystack.includes("kwh/nm³") || haystack.includes("kwh") || haystack.includes("用电") || haystack.includes("电量") || haystack.includes("累计")
            ? "feedback"
            : haystack.includes("露点") || haystack.includes("dew") || haystack.includes("温")
              ? "temperature"
              : haystack.includes("压力") || haystack.includes("压差") || haystack.includes("气压") || haystack.includes("bar") || haystack.includes("mpa")
                ? "pressure"
                : haystack.includes("流") || haystack.includes("flow") || haystack.includes("nm3")
                  ? "flow"
                  : haystack.includes("kw") || haystack.includes("功率")
                    ? "power"
                    : "feedback";
    const writableCandidate = commandCandidate || haystack.includes("控制") || haystack.includes("写");
    return {
      rowNumber: index + 1,
      siteId,
      subsystemType,
      pointRole,
      pointName: String(pointName || pointCode || "").trim(),
      pointCode: String(pointCode || "").trim(),
      unit: String(unit || "").trim(),
      dataType: "",
      direction: "read",
      required: true,
      writable: false,
      source: "import_preview",
      confidence: writableCandidate ? 0.58 : 0.76,
      reason: "mock 关键词识别",
      warnings: writableCandidate ? ["疑似写点/命令点，第一版只预览不启用写控制。"] : []
    } as AdminPointRoleImportPreview["items"][number];
  });
  return {
    siteId,
    generatedAt: nowIso(),
    totalRows: items.length,
    acceptedRows: items.filter((item) => item.warnings.length === 0).length,
    writableCandidates: items.filter((item) => item.warnings.length > 0).length,
    items,
    summary: {
      message: "导入预览不会写入真实控制点。",
      blocked: false
    }
  };
}

export function listMockConfigVersions(siteId: string): AdminConfigVersion[] {
  const store = loadStore();
  return Object.values(store.configVersions)
    .filter((item) => item.siteId === siteId)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    .map((item) => ({
      versionId: item.versionId,
      siteId: item.siteId,
      status: item.status,
      summary: item.summary ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      createdBy: item.createdBy ?? null,
      updatedBy: item.updatedBy ?? null,
      publishedAt: item.publishedAt ?? null,
      rolledBackAt: item.rolledBackAt ?? null
    }));
}

export function publishMockConfigVersion(
  siteId: string,
  versionId: string,
  summary = "",
  actor = "admin"
): AdminConfigVersionResult {
  const store = loadStore();
  const key = `${siteId}:${versionId}`;
  const version = {
    versionId,
    siteId,
    status: "published",
    summary: summary || `发布配置 ${versionId}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: actor,
    updatedBy: actor,
    publishedAt: nowIso(),
    rolledBackAt: null,
    payload: {
      subsystems: getMockSiteSubsystems(siteId),
      pointRoleMappings: getMockPointRoleMappings(siteId)
    }
  };
  store.configVersions[key] = version;
  logAudit(store, {
    actor,
    action: "publish_config_version",
    targetType: "site",
    targetId: siteId,
    afterJson: JSON.stringify(version, null, 2)
  });
  saveStore(store);
  return { version };
}

export function rollbackMockConfigVersion(siteId: string, versionId: string, actor = "admin"): AdminConfigVersionResult {
  const store = loadStore();
  const key = `${siteId}:${versionId}`;
  const version = store.configVersions[key] as
    | { versionId: string; siteId: string; status: string; summary?: string; payload?: { subsystems?: AdminSiteSubsystemCapability[]; pointRoleMappings?: AdminPointRoleMapping[] } }
    | undefined;
  if (version?.payload?.subsystems) {
    store.siteSubsystems[siteId] = clone(version.payload.subsystems);
  }
  if (version?.payload?.pointRoleMappings) {
    store.pointRoleMappings[siteId] = clone(version.payload.pointRoleMappings);
  }
  const nextVersion = {
    versionId,
    siteId,
    status: "rolled_back",
    summary: version?.summary || `回滚配置 ${versionId}`,
    updatedAt: nowIso(),
    updatedBy: actor,
    rolledBackAt: nowIso()
  };
  store.configVersions[key] = {
    ...version,
    ...nextVersion
  };
  logAudit(store, {
    actor,
    action: "rollback_config_version",
    targetType: "site",
    targetId: siteId,
    afterJson: JSON.stringify(nextVersion, null, 2)
  });
  saveStore(store);
  return {
    version: nextVersion,
    restored: {
      siteId,
      generatedAt: nowIso(),
      items: clone(store.siteSubsystems[siteId] || [])
    }
  };
}

export function getMockStoreSnapshot(): MockStore {
  return clone(loadStore());
}
