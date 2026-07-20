export type PlantOverviewSiteProfile = {
  siteAliases: readonly string[];
  assetId: string;
  displayName: string;
  model2dAssetPath: string;
  model2dDisplayName: string;
  model2dPresentation: "physical-scada-2.5d";
  model2dEvidenceMode: "runtime-read-only-exact";
  bindingContractPath: string;
  bindingMode: "read-only-complete-core";
  expectedExplicitBindingCount: number;
  expectedAnimationCount: number;
  expectedRuntimeTargetCount: number;
};

const B25_SITE_ALIASES = ["140", "btwentyfive", "140btwentyfive"] as const;

const B25_PLANT_OVERVIEW_PROFILE: PlantOverviewSiteProfile = {
  siteAliases: B25_SITE_ALIASES,
  assetId: "plant-overview-latest-v2",
  displayName: "B25 冷站全站三维展示模型",
  model2dAssetPath: "/models/plant-overview/2d/chilled-water-plant-overview-latest-v2.svg",
  model2dDisplayName: "B25 冷站全站二维水力模型",
  model2dPresentation: "physical-scada-2.5d",
  model2dEvidenceMode: "runtime-read-only-exact",
  bindingContractPath: "/models/plant-overview/bindings/b25-plant-overview-binding-v2.json",
  bindingMode: "read-only-complete-core",
  expectedExplicitBindingCount: 54,
  expectedAnimationCount: 63,
  expectedRuntimeTargetCount: 62
};

function normalizeSiteAlias(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function getPlantOverviewProfile(
  ...siteCandidates: Array<string | null | undefined>
): PlantOverviewSiteProfile | null {
  const normalizedCandidates = new Set(siteCandidates.map(normalizeSiteAlias).filter(Boolean));
  const matchesB25 = B25_SITE_ALIASES.some((alias) => normalizedCandidates.has(alias));
  return matchesB25 ? B25_PLANT_OVERVIEW_PROFILE : null;
}
