import type { NavigationPerspective } from "./navigationPolicy";
import type { SubsystemStatusKind } from "../utils/subsystemStatus";

export type EnergyStationType =
  | "chilled_plant"
  | "compressed_air"
  | "boiler_room"
  | "power_monitoring"
  | "hvac_terminal";

export type EnergyStationIconKey = "chilled" | "compressed-air" | "boiler" | "power" | "terminal";
export type StationFunctionIconKey = "process" | "twin" | "overview";
export type StationCapabilityLoadState = "loading" | "ready" | "error";
export type StationWorkspaceModuleKey = "duty" | "analysis" | "ai" | "diagnostics";
export type StationWorkspaceDataScope = "site" | "station" | "device";
export type StationRuntimeBindingMode = "required" | "optional" | "unsupported";
export type EnergyObjectSemanticGroupKey = "supply_station" | "distribution_consumption";

export const ENERGY_STATION_QUERY_KEY = "station";
export const ENERGY_STATION_INSTANCE_QUERY_KEY = "stationId";

export const PHYSICAL_STATION_PARENT_TYPES = [
  "chilled_plant",
  "compressed_air",
  "boiler_room"
] as const satisfies readonly EnergyStationType[];

export function isPhysicalStationParentType(
  value: string | null | undefined
): value is (typeof PHYSICAL_STATION_PARENT_TYPES)[number] {
  return PHYSICAL_STATION_PARENT_TYPES.some((stationType) => stationType === value);
}

export function resolveUniqueStationInstanceId(
  instances: readonly { stationId: string }[]
): string | null {
  if (instances.length !== 1) {
    return null;
  }
  const stationId = instances[0]?.stationId.trim();
  return stationId || null;
}

export type EnergyStationFunctionDefinition = {
  to: string;
  labelKey:
    | "navStationProcessOverview"
    | "navStationOverview"
    | "navSystemOverview"
    | "navAutoTwin"
    | "navColdStationLog";
  iconKey: StationFunctionIconKey;
};

export type EnergyStationDefinition = {
  subsystemType: EnergyStationType;
  semanticGroup: EnergyObjectSemanticGroupKey;
  labelKey:
    | "navColdStationScene"
    | "navCompressedAir"
    | "navBoilerRoom"
    | "navPowerMonitoring"
    | "navHvacTerminal";
  summaryKey:
    | "navStationSummaryChilled"
    | "navStationSummaryCompressedAir"
    | "navStationSummaryBoiler"
    | "navStationSummaryPower"
    | "navStationSummaryHvacTerminal";
  iconKey: EnergyStationIconKey;
  defaultTo: string;
  functions: readonly EnergyStationFunctionDefinition[];
};

export const ENERGY_OBJECT_SEMANTIC_GROUPS = [
  { key: "supply_station", labelKey: "navEnergyGroupSupplyStations" },
  { key: "distribution_consumption", labelKey: "navEnergyGroupDistributionConsumption" }
] as const satisfies readonly {
  key: EnergyObjectSemanticGroupKey;
  labelKey: "navEnergyGroupSupplyStations" | "navEnergyGroupDistributionConsumption";
}[];

export type StationWorkspaceRoutePolicy = {
  route: string;
  moduleKey: StationWorkspaceModuleKey;
  dataScope: StationWorkspaceDataScope;
  supportedStationTypes?: readonly EnergyStationType[];
};

const CHILLED_PLANT_ONLY = ["chilled_plant"] as const satisfies readonly EnergyStationType[];

/**
 * Truth contract for shared workspaces.
 *
 * `dataScope: "site"` means the linked station is navigation context only and
 * the current BFF response still represents the whole project. Station-scoped
 * routes are exposed only for subsystem types whose page and data contract are
 * actually implemented. This prevents a compressed-air or boiler context from
 * opening a cold-plant COP/optimization page.
 */
export const STATION_WORKSPACE_ROUTE_POLICIES: readonly StationWorkspaceRoutePolicy[] = [
  { route: "/alarms", moduleKey: "duty", dataScope: "site" },
  { route: "/operation-records", moduleKey: "duty", dataScope: "site" },
  { route: "/work-orders", moduleKey: "duty", dataScope: "site" },
  { route: "/trend-analysis", moduleKey: "analysis", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/energy-analysis", moduleKey: "analysis", dataScope: "device", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/energy-efficiency", moduleKey: "analysis", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/meter-readings", moduleKey: "analysis", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/performance-report", moduleKey: "analysis", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/report-records", moduleKey: "analysis", dataScope: "device", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/ai-overview", moduleKey: "ai", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/optimize-demo", moduleKey: "ai", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/devices", moduleKey: "diagnostics", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/video-monitor", moduleKey: "diagnostics", dataScope: "site" },
  { route: "/environment-conditions", moduleKey: "diagnostics", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY },
  { route: "/operational-diagnostics", moduleKey: "diagnostics", dataScope: "station", supportedStationTypes: CHILLED_PLANT_ONLY }
] as const;

export function resolveStationWorkspaceRoutePolicy(pathname: string): StationWorkspaceRoutePolicy | null {
  return STATION_WORKSPACE_ROUTE_POLICIES.find((policy) => policy.route === pathname) || null;
}

export function isStationWorkspaceRouteSupported(
  pathname: string,
  stationType: EnergyStationType
): boolean {
  const policy = resolveStationWorkspaceRoutePolicy(pathname);
  return !policy?.supportedStationTypes || policy.supportedStationTypes.includes(stationType);
}

const STATION_RUNTIME_REQUIRED_ROUTES = new Set([
  "/scene-control",
  "/compressed-air",
  "/boiler-room",
  "/devices",
  "/ai-overview"
]);

/**
 * Endpoint capability is intentionally separate from the page's display
 * scope. A page may keep a station as navigation context while all of its
 * current APIs are still project-wide.
 */
export function resolveStationRuntimeBindingMode(pathname: string): StationRuntimeBindingMode {
  if (STATION_RUNTIME_REQUIRED_ROUTES.has(pathname)) {
    return "required";
  }
  const workspacePolicy = resolveStationWorkspaceRoutePolicy(pathname);
  if (workspacePolicy?.dataScope === "site") {
    return "optional";
  }
  if (workspacePolicy || resolveEnergyStationForPath(pathname)) {
    return "unsupported";
  }
  return "optional";
}

/**
 * Physical station workspaces only. Cross-station capabilities such as alarms,
 * reports, AI and configuration intentionally live outside this registry.
 */
export const ENERGY_STATION_DEFINITIONS: readonly EnergyStationDefinition[] = [
  {
    subsystemType: "chilled_plant",
    semanticGroup: "supply_station",
    labelKey: "navColdStationScene",
    summaryKey: "navStationSummaryChilled",
    iconKey: "chilled",
    defaultTo: "/scene-control",
    functions: [
      { to: "/scene-control", labelKey: "navStationProcessOverview", iconKey: "process" },
      { to: "/system-overview", labelKey: "navSystemOverview", iconKey: "overview" },
      { to: "/auto-twin", labelKey: "navAutoTwin", iconKey: "twin" },
      { to: "/cold-station-logs", labelKey: "navColdStationLog", iconKey: "overview" }
    ]
  },
  {
    subsystemType: "compressed_air",
    semanticGroup: "supply_station",
    labelKey: "navCompressedAir",
    summaryKey: "navStationSummaryCompressedAir",
    iconKey: "compressed-air",
    defaultTo: "/compressed-air",
    functions: [
      { to: "/compressed-air", labelKey: "navStationOverview", iconKey: "overview" }
    ]
  },
  {
    subsystemType: "boiler_room",
    semanticGroup: "supply_station",
    labelKey: "navBoilerRoom",
    summaryKey: "navStationSummaryBoiler",
    iconKey: "boiler",
    defaultTo: "/boiler-room",
    functions: [
      { to: "/boiler-room", labelKey: "navStationOverview", iconKey: "overview" }
    ]
  },
  {
    subsystemType: "power_monitoring",
    semanticGroup: "distribution_consumption",
    labelKey: "navPowerMonitoring",
    summaryKey: "navStationSummaryPower",
    iconKey: "power",
    defaultTo: "/power-monitoring",
    functions: [
      { to: "/power-monitoring", labelKey: "navStationOverview", iconKey: "overview" }
    ]
  },
  {
    subsystemType: "hvac_terminal",
    semanticGroup: "distribution_consumption",
    labelKey: "navHvacTerminal",
    summaryKey: "navStationSummaryHvacTerminal",
    iconKey: "terminal",
    defaultTo: "/hvac-terminal",
    functions: [
      { to: "/hvac-terminal", labelKey: "navStationOverview", iconKey: "overview" }
    ]
  }
] as const;

export function resolveEnergyStationForPath(pathname: string): EnergyStationDefinition | null {
  return ENERGY_STATION_DEFINITIONS.find((station) =>
    station.functions.some((item) => item.to === pathname)
  ) || null;
}

export function readEnergyStationTypeFromSearch(search: string): EnergyStationType | null {
  const candidate = new URLSearchParams(search).get(ENERGY_STATION_QUERY_KEY);
  return ENERGY_STATION_DEFINITIONS.some((station) => station.subsystemType === candidate)
    ? candidate as EnergyStationType
    : null;
}

export function readEnergyStationIdFromSearch(search: string): string | null {
  const candidate = new URLSearchParams(search).get(ENERGY_STATION_INSTANCE_QUERY_KEY)?.trim();
  return candidate || null;
}

export function clearEnergyStationInstanceFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ENERGY_STATION_INSTANCE_QUERY_KEY);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function clearEnergyStationContextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ENERGY_STATION_QUERY_KEY);
  params.delete(ENERGY_STATION_INSTANCE_QUERY_KEY);
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function appendEnergyStationContextToPath(
  path: string,
  stationType: EnergyStationType | null | undefined,
  stationId?: string | null
): string {
  const [pathAndSearch, hash = ""] = path.split("#", 2);
  const [pathname = "", search = ""] = pathAndSearch.split("?", 2);
  const params = new URLSearchParams(search);

  if (stationType) {
    params.set(ENERGY_STATION_QUERY_KEY, stationType);
    if (stationId === null) {
      params.delete(ENERGY_STATION_INSTANCE_QUERY_KEY);
    } else if (stationId) {
      params.set(ENERGY_STATION_INSTANCE_QUERY_KEY, stationId);
    }
  } else {
    params.delete(ENERGY_STATION_QUERY_KEY);
    params.delete(ENERGY_STATION_INSTANCE_QUERY_KEY);
  }

  const nextSearch = params.toString();
  const nextHash = hash ? `#${hash}` : "";
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash}`;
}

export function isEnergyStationVisible(
  statusKind: SubsystemStatusKind,
  capabilityLoadState: StationCapabilityLoadState,
  perspective: NavigationPerspective
): boolean {
  // A transient or failed capability request must never erase the whole station
  // navigation. Keep entries visible and label their state as unverified.
  if (capabilityLoadState !== "ready") {
    return true;
  }
  if (statusKind === "not_applicable") {
    return false;
  }
  if (statusKind === "not_configured") {
    return perspective.canViewUnconfiguredStations;
  }
  return true;
}
