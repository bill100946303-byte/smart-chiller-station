import {
  getAuthSession,
  getSwitchableProjects,
  resolveAuthProjectId,
  type AuthProject,
  type AuthSession
} from "./auth";
import { fetchSceneFloorModels, type SceneFloorModelItemDto, type SceneFloorModelListDto } from "./bffClient";
import { buildProjectDropdownEntries, flattenProjectDropdownTargets } from "./projectDropdownEntries";
import { safeLocalStorageGet, safeLocalStorageSet } from "../utils/browserStorage";

const SCENE_FLOOR_MODEL_CACHE_KEY = "chiller-shell-scene-floor-models-v1";

type SceneFloorModelCachePayload = {
  cachedAt: string;
  items: SceneFloorModelItemDto[];
};

let memoryItems: SceneFloorModelItemDto[] | null = null;

function normalizeText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim();
  }
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function readStoredItems(): SceneFloorModelItemDto[] {
  if (memoryItems) {
    return memoryItems;
  }
  const raw = safeLocalStorageGet(SCENE_FLOOR_MODEL_CACHE_KEY);
  if (!raw) {
    memoryItems = [];
    return memoryItems;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SceneFloorModelCachePayload>;
    memoryItems = Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    memoryItems = [];
  }
  return memoryItems;
}

export function getCachedSceneFloorModels(): SceneFloorModelItemDto[] {
  return readStoredItems();
}

export function storeSceneFloorModels(result: SceneFloorModelListDto | SceneFloorModelItemDto[]): SceneFloorModelItemDto[] {
  const nextItems = Array.isArray(result) ? result : result.items || [];
  memoryItems = nextItems;
  safeLocalStorageSet(
    SCENE_FLOOR_MODEL_CACHE_KEY,
    JSON.stringify({
      cachedAt: new Date().toISOString(),
      items: nextItems
    } satisfies SceneFloorModelCachePayload)
  );
  return nextItems;
}

export async function preloadSceneFloorModels(siteId: string): Promise<SceneFloorModelItemDto[]> {
  const result = await fetchSceneFloorModels(siteId);
  return storeSceneFloorModels(result);
}

function findProjectByOptionId(projects: AuthProject[], optionId: string): AuthProject | null {
  return projects.find((project) => resolveAuthProjectId(project) === optionId) || null;
}

function dedupeTexts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function stripProjectKeySuffix(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/-\d+(?:-\d+)*$/, "");
}

function buildDatabaseKeyCandidate(project: AuthProject | null | undefined): string {
  const explicitDatabaseKey = normalizeText(project?.databaseKey);
  if (explicitDatabaseKey) {
    return explicitDatabaseKey;
  }
  const siteId = normalizeText(project?.siteId);
  const siteCode = normalizeText(project?.siteCode);
  return siteId && siteCode ? `${siteId}${siteCode}` : "";
}

export function resolveSceneDropdownProjectKey(
  project: AuthProject | null | undefined,
  session: AuthSession | null = getAuthSession()
): string {
  const directProjectKey = normalizeText(project?.modelKey);
  if (!project || !session?.projects?.length) {
    return directProjectKey;
  }

  const currentOptionId = resolveAuthProjectId(project);
  const switchableProjects = getSwitchableProjects(session.projects);
  const dropdownTargets = flattenProjectDropdownTargets(
    buildProjectDropdownEntries(session.projects, switchableProjects, currentOptionId)
  );
  const matchedTarget = dropdownTargets.find((target) => target.optionId === currentOptionId) || null;
  const matchedProject = matchedTarget ? findProjectByOptionId(session.projects, matchedTarget.optionId) : null;
  const matchedProjectKey = normalizeText(matchedProject?.modelKey);
  if (matchedProjectKey) {
    return matchedProjectKey;
  }
  if (directProjectKey) {
    return directProjectKey;
  }

  const currentSiteId = normalizeText(project.siteId);
  const sameSiteTargetKeys = Array.from(
    new Set(
      dropdownTargets
        .map((target) => findProjectByOptionId(session.projects || [], target.optionId))
        .filter((candidate): candidate is AuthProject => Boolean(candidate))
        .filter((candidate) => normalizeText(candidate.siteId) === currentSiteId)
        .map((candidate) => normalizeText(candidate.modelKey))
        .filter(Boolean)
    )
  );
  return sameSiteTargetKeys.length === 1 ? sameSiteTargetKeys[0] : "";
}

export function buildSceneProjectKeyCandidates(project: AuthProject | null | undefined): string[] {
  const projectKey = resolveSceneDropdownProjectKey(project);
  const directProjectKey = normalizeText(project?.modelKey);
  const databaseKey = buildDatabaseKeyCandidate(project);
  return dedupeTexts([
    projectKey,
    directProjectKey,
    databaseKey,
    stripProjectKeySuffix(projectKey),
    stripProjectKeySuffix(directProjectKey),
    stripProjectKeySuffix(databaseKey)
  ]);
}

export function findSceneFloorModelForProject(
  project: AuthProject | null | undefined,
  items: SceneFloorModelItemDto[] = getCachedSceneFloorModels()
): SceneFloorModelItemDto | null {
  const candidates = buildSceneProjectKeyCandidates(project);
  if (candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const matchedWithUrl = items.find((item) => (
      normalizeText(item.key) === candidate &&
      (normalizeText(item.model2dUrl) || normalizeText(item.model3dUrl))
    ));
    if (matchedWithUrl) {
      return matchedWithUrl;
    }
  }

  for (const candidate of candidates) {
    const matched = items.find((item) => normalizeText(item.key) === candidate);
    if (matched) {
      return matched;
    }
  }

  return null;
}
