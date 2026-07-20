import { createContext, type ReactNode, useContext } from "react";
import type { EnergyStationType } from "../config/energyStationNavigation";
import type { RuntimeDataScopeDto } from "../services/bffClient";

export type StationRuntimeScope = {
  projectSiteId: string | null;
  runtimeBindingSiteId: string | null;
  selectedStationId: string | null;
  runtimeStationId: string | null;
  stationType: EnergyStationType | null;
  stationName: string | null;
  bindingState: string;
  bindingVersion: number | null;
  bindingPublished: boolean;
  scopeKey: string;
};

const EMPTY_SCOPE: StationRuntimeScope = {
  projectSiteId: null,
  runtimeBindingSiteId: null,
  selectedStationId: null,
  runtimeStationId: null,
  stationType: null,
  stationName: null,
  bindingState: "unconfigured",
  bindingVersion: null,
  bindingPublished: false,
  scopeKey: "site:none|station:none|binding:none"
};

const StationRuntimeScopeContext = createContext<StationRuntimeScope>(EMPTY_SCOPE);

type StationRuntimeScopeProviderProps = {
  value: StationRuntimeScope;
  children: ReactNode;
};

export function StationRuntimeScopeProvider({ value, children }: StationRuntimeScopeProviderProps) {
  return (
    <StationRuntimeScopeContext.Provider value={value}>
      {children}
    </StationRuntimeScopeContext.Provider>
  );
}

export function useStationRuntimeScope(): StationRuntimeScope {
  return useContext(StationRuntimeScopeContext);
}

export function isAppliedStationRuntimeScope(
  dataScope: RuntimeDataScopeDto | null | undefined,
  scope: Pick<StationRuntimeScope, "runtimeBindingSiteId" | "runtimeStationId" | "stationType" | "bindingVersion">
): boolean {
  return Boolean(
    dataScope?.applied === true &&
    dataScope.filterMode === "station_binding" &&
    dataScope.reason === "STATION_RUNTIME_BINDING_APPLIED" &&
    scope.runtimeBindingSiteId &&
    dataScope.siteId === scope.runtimeBindingSiteId &&
    scope.runtimeStationId &&
    dataScope.stationId === scope.runtimeStationId &&
    scope.stationType &&
    dataScope.requestedSubsystemType === scope.stationType &&
    dataScope.effectiveSubsystemType === scope.stationType &&
    scope.bindingVersion != null &&
    dataScope.bindingVersion === scope.bindingVersion
  );
}
