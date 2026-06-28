import { runtimeConfig } from "../config/runtimeConfig";
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "../utils/browserStorage";
import {
  clearStoredProjectSelection,
  getStoredProjectSiteId,
  setStoredProjectSelection
} from "./projectSession";
import { appendSiteIdToPath, readSiteIdFromSearch, siteIdsEquivalent } from "./siteRouting";

export const AUTH_STORAGE_KEY = "chiller-shell-auth-v1";
const PROJECT_ACCOUNT_MIN_ALLOWED_COUNT = 3;
const PROJECT_ACCOUNT_POLICY_ERROR = "当前账号项目数量过少，请使用 30 项目账号登录。";

export type AuthRole = "edit" | "user";

export type AuthProject = {
  projectId?: string;
  siteId: string;
  siteName: string;
  siteCode?: string;
  databaseKey: string;
  groupId?: string;
  modelKey?: string;
  parentProjectId?: string;
  template?: string;
  username?: string;
  userId?: string;
  city?: string;
  appExplain?: string;
  parentProjectLabel?: string;
  control?: string;
  ipAddress?: string;
  port?: string;
};

export type AuthSession = {
  username: string;
  token: string;
  userId?: string;
  role?: AuthRole;
  projectCount?: number;
  defaultProjectKey?: string;
  defaultProjectTemplate?: string;
  projects?: AuthProject[];
  currentProjectId?: string;
  loginAt: string;
};

type AuthProjectDisplayCandidate = Pick<AuthProject, "siteId" | "siteName" | "siteCode" | "appExplain">;

type LegacyLoginResult = {
  status: string;
  msg: string;
  token: string;
  username: string;
  userId?: string;
  role?: string;
};

type LegacyAppUserGroup = {
  appid?: string | number | null;
  appName?: string | null;
  parentLabel?: string | null;
  parentKey?: string | number | null;
  level?: number | null;
  appuserground?: string | number | null;
  key?: string | number | null;
  template?: string | number | null;
  username?: string | null;
  userid?: string | number | null;
  city?: string | null;
  appexplain?: string | null;
  control?: string | null;
  ipaddr?: string | null;
  appport?: string | number | null;
};

type LegacyUserInfoPayload = {
  id?: string | number | null;
  username?: string | null;
  role?: string | number | null;
  appusergroup?: unknown;
};

type LegacyUserInfoResponse = {
  data?: LegacyUserInfoPayload | null;
};

type LegacyProjectQueryConfig = {
  pathname: string;
  userParam: string;
};

export type AuthDestination =
  | {
      kind: "internal";
      path: string;
    }
  | {
      kind: "external";
      path: string;
    };

function readText(node: Element | null, selector: string): string {
  return node?.querySelector(selector)?.textContent?.trim() || "";
}

function readChildText(node: Element | null, tagName: string): string {
  return Array.from(node?.children || []).find((child) => child.tagName === tagName)?.textContent?.trim() || "";
}

function normalizeLegacyRole(value: unknown): AuthRole | undefined {
  if (value === "edit" || value === 1 || value === "1") {
    return "edit";
  }
  if (value === "user" || value === 0 || value === "0") {
    return "user";
  }
  return undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    return String(value);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

const GENERIC_PROJECT_NAME_SET = new Set(["榛樿", "default", "none", "null", "n/a", "na", "-", "--"]);

function hasChineseChars(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function scoreProjectName(value: string): number {
  if (GENERIC_PROJECT_NAME_SET.has(value.trim().toLowerCase())) {
    return 1;
  }
  if (hasChineseChars(value)) {
    return 4;
  }
  return 2;
}

function pickPreferredProjectName(...candidates: Array<string | undefined>): string | undefined {
  let bestName: string | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    const normalized = toOptionalString(candidate);
    if (!normalized) {
      continue;
    }
    const score = scoreProjectName(normalized);
    if (!bestName || score > bestScore) {
      bestName = normalized;
      bestScore = score;
    }
  }
  return bestName;
}

export function resolveAuthProjectDisplayName(
  project: Partial<AuthProjectDisplayCandidate> | null | undefined,
  fallback = ""
): string {
  if (!project) {
    return fallback;
  }
  const appExplain = toOptionalString(project.appExplain);
  if (appExplain) {
    return appExplain;
  }
  const siteName = toOptionalString(project.siteName);
  if (siteName) {
    return siteName;
  }
  const siteCode = toOptionalString(project.siteCode);
  if (siteCode) {
    return siteCode;
  }
  return toOptionalString(project.siteId) || fallback;
}

export function resolveEnergyConfigSiteId(
  project: Partial<AuthProject> | null | undefined,
  fallback = runtimeConfig.siteId
): string {
  const siteId = toOptionalString(project?.siteId);
  const candidates = [
    siteId,
    toOptionalString(project?.siteCode),
    toOptionalString(project?.siteName),
    toOptionalString(project?.appExplain),
    toOptionalString(project?.databaseKey),
    toOptionalString(project?.modelKey),
    toOptionalString(project?.projectId)
  ];
  if (siteId === "126") {
    return "126lnoffice";
  }
  if (siteId && !siteId.startsWith("126lnoffice")) {
    return siteId;
  }
  if (candidates.some((item) => item?.startsWith("126lnoffice"))) {
    return "126lnoffice";
  }
  if (candidates.some((item) => item?.includes("盛世绿能") || item?.toLowerCase().includes("lnoffice"))) {
    return "126lnoffice";
  }
  return siteId || fallback;
}

function deriveSiteCodeFromModelKey(siteId?: string, modelKey?: string): string {
  const normalizedSiteId = toOptionalString(siteId) || "";
  const normalizedModelKey = toOptionalString(modelKey) || "";
  if (!normalizedSiteId || !normalizedModelKey || !normalizedModelKey.startsWith(normalizedSiteId)) {
    return "";
  }
  return (normalizedModelKey.slice(normalizedSiteId.length).replace(/-\d+$/, "") || "").trim();
}

function buildAuthProjectId(input: Partial<AuthProject>): string {
  const siteId = toOptionalString(input.siteId) || "";
  const modelKey = toOptionalString(input.modelKey) || "";
  const template = toOptionalString(input.template) || "";
  const groupId = toOptionalString(input.groupId) || "";
  const siteCode = toOptionalString(input.siteCode) || "";
  const parentProjectLabel = toOptionalString(input.parentProjectLabel) || "";
  const displayName = resolveAuthProjectDisplayName(input, siteId);
  return [siteId, modelKey, template, groupId, siteCode, parentProjectLabel, displayName].join("::");
}

export function resolveAuthProjectId(project: Partial<AuthProject> | null | undefined): string {
  if (!project) {
    return "";
  }
  const explicitProjectId = toOptionalString(project.projectId);
  if (explicitProjectId) {
    return explicitProjectId;
  }
  return buildAuthProjectId(project);
}

const DEFAULT_INTERMEDIATE_PROJECT_LABELS = new Set(["榛樿", "default"]);

function isDefaultIntermediateProjectLabel(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return DEFAULT_INTERMEDIATE_PROJECT_LABELS.has(value.trim().toLowerCase());
}

function inferParentProjectLabel(input: {
  parentProjectLabel?: string | null;
  appExplain?: string | null;
  siteName?: string | null;
  siteCode?: string | null;
  siteId?: string | null;
}): string | undefined {
  const explicitParent = toOptionalString(input.parentProjectLabel);
  if (explicitParent) {
    return explicitParent;
  }
  return undefined;
}

function collectParentProjectIds(projects: AuthProject[]): Set<string> {
  const projectByModelKey = new Map<string, AuthProject>();
  projects.forEach((project) => {
    const modelKey = toOptionalString(project.modelKey);
    if (modelKey && !projectByModelKey.has(modelKey)) {
      projectByModelKey.set(modelKey, project);
    }
  });
  const displayNameEntries = projects.map((project) => ({
    project,
    displayName: resolveAuthProjectDisplayName(project, project.siteId)
  }));
  const projectByDisplayName = new Map<string, AuthProject>();
  displayNameEntries.forEach((entry) => {
    if (!projectByDisplayName.has(entry.displayName)) {
      projectByDisplayName.set(entry.displayName, entry.project);
    }
  });

  const parentProjectIds = new Set<string>();
  displayNameEntries.forEach((entry) => {
    const explicitParentProjectId = toOptionalString(entry.project.parentProjectId);
    if (explicitParentProjectId) {
      const parentProject = projectByModelKey.get(explicitParentProjectId);
      if (parentProject) {
        parentProjectIds.add(resolveAuthProjectId(parentProject));
        return;
      }
    }
    const explicitParentLabel = toOptionalString(entry.project.parentProjectLabel);
    if (explicitParentLabel) {
      const parentProject = projectByDisplayName.get(explicitParentLabel);
      if (parentProject) {
        parentProjectIds.add(resolveAuthProjectId(parentProject));
      }
    }
  });
  return parentProjectIds;
}

function resolveChildProjectForParent(projects: AuthProject[], parentProjectId: string): AuthProject | null {
  const parentProject = projects.find((project) => resolveAuthProjectId(project) === parentProjectId) || null;
  if (!parentProject) {
    return null;
  }
  const parentModelKey = toOptionalString(parentProject.modelKey);
  const parentDisplayName = resolveAuthProjectDisplayName(parentProject, parentProject.siteId);
  for (const project of projects) {
    if (resolveAuthProjectId(project) === parentProjectId) {
      continue;
    }
    if (parentModelKey && toOptionalString(project.parentProjectId) === parentModelKey) {
      return project;
    }
    if (toOptionalString(project.parentProjectLabel) === parentDisplayName) {
      return project;
    }
  }
  return null;
}

export function getSwitchableProjects(projects: AuthProject[] | null | undefined): AuthProject[] {
  if (!Array.isArray(projects) || projects.length === 0) {
    return [];
  }
  const parentProjectIds = collectParentProjectIds(projects);
  if (parentProjectIds.size === 0) {
    return projects;
  }
  return projects.filter((project) => !parentProjectIds.has(resolveAuthProjectId(project)));
}

function scoreProjectSelectionCandidate(project: AuthProject, preferredModelKey?: string): number {
  const normalizedModelKey = toOptionalString(project.modelKey) || "";
  const normalizedTemplate = toOptionalString(project.template) || "";
  const normalizedPreferredModelKey = toOptionalString(preferredModelKey) || "";
  const displayName = resolveAuthProjectDisplayName(project, project.siteId);
  let score = 0;
  if (normalizedPreferredModelKey && normalizedModelKey === normalizedPreferredModelKey) {
    score += 1000;
  }
  if (normalizedModelKey) {
    score += 300;
  }
  if (normalizedTemplate) {
    score += 100;
  }
  if (hasChineseChars(displayName)) {
    score += 30;
  }
  if (toOptionalString(project.appExplain)) {
    score += 10;
  }
  return score;
}

function pickBestProjectCandidate(projects: AuthProject[], preferredModelKey?: string): AuthProject | null {
  if (!projects.length) {
    return null;
  }
  return projects
    .slice()
    .sort((left, right) => {
      const scoreDiff =
        scoreProjectSelectionCandidate(right, preferredModelKey) -
        scoreProjectSelectionCandidate(left, preferredModelKey);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const leftLabel = resolveAuthProjectDisplayName(left, left.siteId);
      const rightLabel = resolveAuthProjectDisplayName(right, right.siteId);
      const labelDiff = leftLabel.localeCompare(rightLabel, "zh-CN");
      if (labelDiff !== 0) {
        return labelDiff;
      }
      const leftModelKeyLength = (toOptionalString(left.modelKey) || "").length;
      const rightModelKeyLength = (toOptionalString(right.modelKey) || "").length;
      return rightModelKeyLength - leftModelKeyLength;
    })[0] || null;
}

function sanitizeProjectCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function violatesProjectAccountPolicy(projectCount: number): boolean {
  return projectCount < PROJECT_ACCOUNT_MIN_ALLOWED_COUNT;
}

function sanitizeInternalRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (value === "/" || value.startsWith("/login")) {
    return null;
  }
  return value;
}

function resolveRequestedProject(projects: AuthProject[], requestedPath: string | null | undefined): AuthProject | null {
  const redirectTarget = sanitizeInternalRedirectPath(requestedPath);
  if (!redirectTarget) {
    return null;
  }

  try {
    const requestedUrl = new URL(redirectTarget, "http://localhost");
    const requestedSiteId = readSiteIdFromSearch(requestedUrl.search);
    if (!requestedSiteId) {
      return null;
    }
    const siteMatchedProjects = projects.filter((project) => siteIdsEquivalent(project.siteId, requestedSiteId));
    const requestedProject = pickBestProjectCandidate(siteMatchedProjects) || null;
    if (!requestedProject) {
      return null;
    }
    const switchableProjects = getSwitchableProjects(projects);
    const switchableSiteMatchedProject = pickBestProjectCandidate(
      switchableProjects.filter((project) => siteIdsEquivalent(project.siteId, requestedSiteId))
    );
    if (switchableSiteMatchedProject) {
      return switchableSiteMatchedProject;
    }
    return resolveChildProjectForParent(projects, resolveAuthProjectId(requestedProject)) || requestedProject;
  } catch {
    return null;
  }
}

function buildLegacyHashUrl(path: string): string {
  const url = new URL(runtimeConfig.legacyBaseUrl);
  url.hash = path.startsWith("/") ? path : `/${path}`;
  return url.toString();
}

function parseLegacyLogin(xmlText: string): LegacyLoginResult {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  const status = readText(document.documentElement, "status");
  const msg = readText(document.documentElement, "msg");
  const token = readText(document.documentElement, "token");
  const userNode = document.querySelector("data > user");
  return {
    status,
    msg,
    token,
    username: readText(userNode, "username"),
    userId: readText(userNode, "userId") || readText(userNode, "id") || undefined,
    role: readText(userNode, "roleId") || readText(userNode, "role") || undefined
  };
}

function resolveLegacyNodeDisplayName(input: {
  appexplain?: string | null;
  appName?: string | null;
  appid?: string | number | null;
}): string | undefined {
  return toOptionalString(input.appexplain) || toOptionalString(input.appName) || toOptionalString(input.appid);
}

function parseLegacyProjectNode(
  node: Element,
  parentLabel?: string,
  parentKey?: string,
  parentCity?: string
): LegacyAppUserGroup {
  const appid = readChildText(node, "appid") || undefined;
  const appName = readChildText(node, "appName") || undefined;
  const appexplain = readChildText(node, "appexplain") || readChildText(node, "appexplainCNEN") || undefined;
  const city = toOptionalString(readChildText(node, "city")) || toOptionalString(parentCity);
  return {
    appid,
    appName,
    parentLabel: parentLabel || undefined,
    parentKey: parentKey || undefined,
    appuserground: readChildText(node, "appuserground") || undefined,
    key: readChildText(node, "key") || undefined,
    template: readChildText(node, "template") || undefined,
    username: readChildText(node, "username") || undefined,
    userid: readChildText(node, "userid") || undefined,
    city,
    appexplain,
    control: readChildText(node, "control") || undefined,
    ipaddr: readChildText(node, "ipaddr") || undefined,
    appport: readChildText(node, "appport") || undefined
  };
}

function hasLegacyProjectIdentity(node: Element): boolean {
  return Boolean(readChildText(node, "appid") || readChildText(node, "appName"));
}

function collectLegacyProjectNodes(
  root: Element
): Array<{ node: Element; parentLabel?: string; parentKey?: string; parentCity?: string }> {
  const queue: Array<{ node: Element; parentLabel?: string; parentKey?: string; parentCity?: string }> = [{ node: root }];
  const collected: Array<{ node: Element; parentLabel?: string; parentKey?: string; parentCity?: string }> = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentNode = current.node;
    const currentHasIdentity = hasLegacyProjectIdentity(currentNode);
    const currentDisplayName = currentHasIdentity
      ? resolveLegacyNodeDisplayName({
          appid: readChildText(currentNode, "appid"),
          appName: readChildText(currentNode, "appName"),
          appexplain: readChildText(currentNode, "appexplain") || readChildText(currentNode, "appexplainCNEN")
        }) || current.parentLabel
      : current.parentLabel;
    const currentNodeKey = toOptionalString(readChildText(currentNode, "key"));
    const currentNodeCity = toOptionalString(readChildText(currentNode, "city"));
    const inheritedCity = currentNodeCity || toOptionalString(current.parentCity);
    if (currentHasIdentity) {
      collected.push({
        node: currentNode,
        parentLabel: current.parentLabel,
        parentKey: current.parentKey,
        parentCity: inheritedCity
      });
    }
    Array.from(currentNode.children)
      .filter((node): node is Element => node instanceof Element)
      .forEach((child) => {
        queue.push({
          node: child,
          parentLabel: currentDisplayName,
          parentKey: currentNodeKey || current.parentKey,
          parentCity: inheritedCity
        });
      });
  }
  return collected;
}

function parseLegacyUserInfoXml(xmlText: string): LegacyUserInfoPayload | null {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  const status = readText(document.documentElement, "status");
  if (status !== "20000") {
    return null;
  }

  const dataNode = document.querySelector("data");
  if (!dataNode) {
    return null;
  }

  const projectNodes = collectLegacyProjectNodes(dataNode);
  return {
    id: readChildText(dataNode, "id") || undefined,
    username: readChildText(dataNode, "username") || undefined,
    role: readChildText(dataNode, "role") || undefined,
    appusergroup: projectNodes.map((item) =>
      parseLegacyProjectNode(item.node, item.parentLabel, item.parentKey, item.parentCity)
    )
  };
}

function parseLegacyProjectListXml(xmlText: string): LegacyAppUserGroup[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  const status = readText(document.documentElement, "status");
  if (status !== "20000") {
    return [];
  }

  return collectLegacyProjectNodes(document.documentElement).map((item) =>
    parseLegacyProjectNode(item.node, item.parentLabel, item.parentKey, item.parentCity)
  );
}

function flattenLegacyProjectCandidates(input: unknown): LegacyAppUserGroup[] {
  const collected: LegacyAppUserGroup[] = [];
  const visited = new Set<object>();

  function readNodeChildren(objectValue: Record<string, unknown>): unknown[] {
    const directList = objectValue.appusergroupList ?? objectValue.appusergrouplist;
    if (Array.isArray(directList)) {
      return directList;
    }
    if (directList && typeof directList === "object") {
      return [directList];
    }
    const nestedGroup = objectValue.appusergroup;
    if (Array.isArray(nestedGroup)) {
      return nestedGroup;
    }
    if (nestedGroup && typeof nestedGroup === "object") {
      return [nestedGroup];
    }
    return [];
  }

  function visitNode(
    value: unknown,
    parentLabel?: string,
    parentKey?: string,
    level = 1,
    parentCity?: string
  ): void {
    if (!value || typeof value !== "object") {
      return;
    }
    const objectValue = value as Record<string, unknown>;
    if (visited.has(objectValue)) {
      return;
    }
    visited.add(objectValue);

    const appid = objectValue.appid ?? objectValue.appId;
    const appName = objectValue.appName ?? objectValue.appname;
    const nodeKey = objectValue.key;
    const appexplain = (objectValue.appexplain ?? objectValue.appexplainCNEN) as string | null | undefined;
    const explicitParentLabel = toOptionalString(objectValue.parentLabel);
    const explicitParentKey = toOptionalString(objectValue.parentKey);
    const explicitCity = toOptionalString(objectValue.city);
    const resolvedCity = explicitCity || toOptionalString(parentCity);
    const normalizedParentLabel = parentLabel || explicitParentLabel;
    const normalizedParentKey = parentKey || explicitParentKey;
    const currentDisplayName = resolveLegacyNodeDisplayName({
      appid: appid as string | number | null | undefined,
      appName: appName as string | null | undefined,
      appexplain
    });
    const normalizedNodeKey = toOptionalString(nodeKey);
    const hasIdentity = Boolean(toOptionalString(appid) || toOptionalString(appName) || normalizedNodeKey);
    const shouldHideSecondLevelDefault =
      level === 2 &&
      isDefaultIntermediateProjectLabel(
        toOptionalString(appexplain) || toOptionalString(appName) || currentDisplayName
      );
    const shouldEmit = hasIdentity && !shouldHideSecondLevelDefault;

    if (shouldEmit) {
      collected.push({
        appid: appid as string | number | null | undefined,
        appName: appName as string | null | undefined,
        parentLabel: normalizedParentLabel || undefined,
        parentKey: normalizedParentKey || undefined,
        level,
        appuserground: objectValue.appuserground as string | number | null | undefined,
        key: nodeKey as string | number | null | undefined,
        template: objectValue.template as string | number | null | undefined,
        username: objectValue.username as string | null | undefined,
        userid: (objectValue.userid ?? objectValue.userId) as string | number | null | undefined,
        city: resolvedCity,
        appexplain,
        control: objectValue.control as string | null | undefined,
        ipaddr: (objectValue.ipaddr ?? objectValue.ipAddress) as string | null | undefined,
        appport: (objectValue.appport ?? objectValue.port) as string | number | null | undefined
      });
    }

    const nextParentLabel = shouldEmit
      ? (currentDisplayName || normalizedParentLabel)
      : (normalizedParentLabel || currentDisplayName);
    const nextParentKey = shouldEmit
      ? (normalizedNodeKey || normalizedParentKey)
      : normalizedParentKey;

    const children = readNodeChildren(objectValue);
    children.forEach((child) => visitNode(child, nextParentLabel, nextParentKey, level + 1, resolvedCity));
  }

  if (Array.isArray(input)) {
    input.forEach((item) => visitNode(item, undefined, undefined, 1, undefined));
    return collected;
  }

  if (input && typeof input === "object") {
    const root = input as Record<string, unknown>;
    const roots = readNodeChildren(root);
    if (roots.length > 0) {
      roots.forEach((item) => visitNode(item, undefined, undefined, 1, undefined));
    } else {
      visitNode(root, undefined, undefined, 1, undefined);
    }
  }

  return collected;
}

function mapLegacyProject(project: LegacyAppUserGroup): AuthProject | null {
  const siteId = toOptionalString(project.appid);
  if (!siteId) {
    return null;
  }

  const modelKey = toOptionalString(project.key);
  const appExplain = toOptionalString(project.appexplain);
  const siteCode = toOptionalString(project.appName) || deriveSiteCodeFromModelKey(siteId, modelKey);
  const siteName = siteCode || siteId;
  const parentProjectLabel = inferParentProjectLabel({
    parentProjectLabel: toOptionalString(project.parentLabel),
    appExplain,
    siteName,
    siteCode,
    siteId
  });
  const normalizedProject: AuthProject = {
    siteId,
    siteName,
    siteCode,
    databaseKey: `${siteId}${siteCode || siteName}`,
    groupId: toOptionalString(project.appuserground),
    modelKey,
    parentProjectId: toOptionalString(project.parentKey),
    template: toOptionalString(project.template),
    username: toOptionalString(project.username),
    userId: toOptionalString(project.userid),
    city: toOptionalString(project.city),
    appExplain,
    parentProjectLabel,
    control: toOptionalString(project.control),
    ipAddress: toOptionalString(project.ipaddr),
    port: toOptionalString(project.appport)
  };
  return {
    ...normalizedProject,
    projectId: buildAuthProjectId(normalizedProject)
  };
}

function sanitizeStoredProject(project: unknown): AuthProject | null {
  if (!project || typeof project !== "object") {
    return null;
  }

  const candidate = project as Partial<AuthProject>;
  const siteId = toOptionalString(candidate.siteId);
  if (!siteId) {
    return null;
  }
  const modelKey = toOptionalString(candidate.modelKey);
  const appExplain = toOptionalString(candidate.appExplain);
  const siteCode = toOptionalString(candidate.siteCode) || deriveSiteCodeFromModelKey(siteId, modelKey);
  const siteName = siteCode || toOptionalString(candidate.siteName) || siteId;
  const parentProjectLabel = inferParentProjectLabel({
    parentProjectLabel: toOptionalString(candidate.parentProjectLabel),
    appExplain,
    siteName,
    siteCode,
    siteId
  });

  const normalizedProject: AuthProject = {
    siteId,
    siteName,
    siteCode,
    databaseKey:
      toOptionalString(candidate.databaseKey) ||
      `${siteId}${siteCode || siteName || siteId}`,
    groupId: toOptionalString(candidate.groupId),
    modelKey,
    parentProjectId: toOptionalString(candidate.parentProjectId),
    template: toOptionalString(candidate.template),
    username: toOptionalString(candidate.username),
    userId: toOptionalString(candidate.userId),
    city: toOptionalString(candidate.city),
    appExplain,
    parentProjectLabel,
    control: toOptionalString(candidate.control),
    ipAddress: toOptionalString(candidate.ipAddress),
    port: toOptionalString(candidate.port)
  };
  return {
    ...normalizedProject,
    projectId: toOptionalString(candidate.projectId) || buildAuthProjectId(normalizedProject)
  };
}

function sanitizeStoredProjects(value: unknown): AuthProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((item) => {
    const normalized = sanitizeStoredProject(item);
    if (!normalized) {
      return [];
    }
    const projectId = resolveAuthProjectId(normalized);
    if (seen.has(projectId)) {
      return [];
    }
    seen.add(projectId);
    return [normalized];
  });
}

function mapLegacyProjects(value: unknown): AuthProject[] {
  const candidates = flattenLegacyProjectCandidates(value);
  const seen = new Set<string>();
  return candidates.flatMap((item) => {
    const normalized = mapLegacyProject(item as LegacyAppUserGroup);
    if (!normalized) {
      return [];
    }
    const projectId = resolveAuthProjectId(normalized);
    if (seen.has(projectId)) {
      return [];
    }
    seen.add(projectId);
    return [normalized];
  });
}

function mergeAuthProjectRecord(base: AuthProject, incoming: AuthProject): AuthProject {
  const siteName = base.siteCode || incoming.siteCode || base.siteName || incoming.siteName || base.siteId;
  const mergedProject: AuthProject = {
    siteId: base.siteId,
    siteName,
    siteCode: base.siteCode || incoming.siteCode,
    databaseKey:
      base.databaseKey ||
      incoming.databaseKey ||
      `${base.siteId}${base.siteCode || incoming.siteCode || siteName || base.siteId}`,
    groupId: base.groupId || incoming.groupId,
    modelKey: base.modelKey || incoming.modelKey,
    parentProjectId: base.parentProjectId || incoming.parentProjectId,
    template: base.template || incoming.template,
    username: base.username || incoming.username,
    userId: base.userId || incoming.userId,
    city: base.city || incoming.city,
    appExplain: pickPreferredProjectName(base.appExplain, incoming.appExplain) || base.appExplain || incoming.appExplain,
    parentProjectLabel:
      pickPreferredProjectName(base.parentProjectLabel, incoming.parentProjectLabel) ||
      base.parentProjectLabel ||
      incoming.parentProjectLabel,
    control: base.control || incoming.control,
    ipAddress: base.ipAddress || incoming.ipAddress,
    port: base.port || incoming.port
  };
  return {
    ...mergedProject,
    projectId: toOptionalString(base.projectId) || toOptionalString(incoming.projectId) || buildAuthProjectId(mergedProject)
  };
}

function mergeAuthProjects(...lists: AuthProject[][]): AuthProject[] {
  const merged = new Map<string, AuthProject>();
  lists.forEach((projects) => {
    projects.forEach((project) => {
      const projectId = resolveAuthProjectId(project);
      const current = merged.get(projectId);
      if (!current) {
        merged.set(projectId, {
          ...project,
          projectId
        });
        return;
      }
      merged.set(projectId, mergeAuthProjectRecord(current, project));
    });
  });
  return Array.from(merged.values());
}

function resolveCurrentProjectId(
  projects: AuthProject[],
  preferredProjectId?: string,
  preferredModelKey?: string
): string | undefined {
  const switchableProjects = getSwitchableProjects(projects);
  const candidates = [preferredProjectId, getStoredProjectSiteId()];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const exactProject =
      projects.find((item) => resolveAuthProjectId(item) === candidate) ||
      null;
    if (exactProject) {
      const exactProjectId = resolveAuthProjectId(exactProject);
      if (switchableProjects.some((item) => resolveAuthProjectId(item) === exactProjectId)) {
        return exactProjectId;
      }
      const childProject = resolveChildProjectForParent(projects, exactProjectId);
      if (childProject) {
        return resolveAuthProjectId(childProject);
      }
      continue;
    }
    const siteMatchedProjects = projects.filter((item) => siteIdsEquivalent(item.siteId, candidate));
    if (siteMatchedProjects.length === 0) {
      continue;
    }
    const switchableSiteMatchedProject = pickBestProjectCandidate(
      switchableProjects.filter((item) => siteIdsEquivalent(item.siteId, candidate)),
      preferredModelKey
    );
    if (switchableSiteMatchedProject) {
      return resolveAuthProjectId(switchableSiteMatchedProject);
    }
    const sitePreferredProject = pickBestProjectCandidate(siteMatchedProjects, preferredModelKey) || siteMatchedProjects[0];
    const childProject = resolveChildProjectForParent(projects, resolveAuthProjectId(sitePreferredProject));
    if (childProject) {
      return resolveAuthProjectId(childProject);
    }
    if (sitePreferredProject) {
      return resolveAuthProjectId(sitePreferredProject);
    }
  }

  if (switchableProjects.length === 1) {
    return resolveAuthProjectId(switchableProjects[0]);
  }
  if (projects.length === 1) {
    return resolveAuthProjectId(projects[0]);
  }
  return undefined;
}

function getProjectFromList(projects: AuthProject[], projectId?: string): AuthProject | null {
  if (!projectId) {
    return projects.length === 1 ? projects[0] || null : null;
  }
  const exactProject = projects.find((item) => resolveAuthProjectId(item) === projectId);
  if (exactProject) {
    return exactProject;
  }
  const siteMatchedProjects = projects.filter((item) => siteIdsEquivalent(item.siteId, projectId));
  if (siteMatchedProjects.length === 1) {
    return siteMatchedProjects[0];
  }
  return null;
}

function hydrateSession(session: Partial<AuthSession>): AuthSession | null {
  if (!session.username || !session.token || !session.loginAt) {
    return null;
  }

  const storedDefaultProjectKey = toOptionalString(session.defaultProjectKey);
  const projects = sanitizeStoredProjects(session.projects);
  const currentProjectId = resolveCurrentProjectId(
    projects,
    toOptionalString(session.currentProjectId),
    storedDefaultProjectKey
  );
  if (violatesProjectAccountPolicy(projects.length)) {
    return null;
  }
  const currentProject = getProjectFromList(projects, currentProjectId);

  if (currentProject) {
    setStoredProjectSelection(currentProject.siteId, currentProject.siteName);
  } else {
    clearStoredProjectSelection();
  }

  return {
    username: session.username,
    token: session.token,
    userId: toOptionalString(session.userId),
    role: normalizeLegacyRole(session.role),
    projectCount: sanitizeProjectCount(projects.length),
    defaultProjectKey: currentProject?.modelKey || storedDefaultProjectKey,
    defaultProjectTemplate: currentProject?.template || toOptionalString(session.defaultProjectTemplate),
    projects,
    currentProjectId,
    loginAt: session.loginAt
  };
}

function persistAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }
  safeLocalStorageSet(AUTH_STORAGE_KEY, JSON.stringify(session));
}

async function fetchLegacyUserInfo(token: string): Promise<LegacyUserInfoPayload | null> {
  const infoUrl = new URL("/user/dologin", runtimeConfig.legacyBaseUrl);
  infoUrl.searchParams.set("token", token);
  infoUrl.searchParams.set("language", "zh");
  infoUrl.searchParams.set("unit", "0");
  infoUrl.searchParams.set("template", "1");

  try {
    const response = await fetch(infoUrl.toString(), {
      method: "GET",
      credentials: "include",
      headers: {
        ZSQY_TEST: token
      }
    });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    if (contentType.includes("application/json")) {
      try {
        const result = JSON.parse(rawText) as LegacyUserInfoResponse;
        return result?.data ?? null;
      } catch {
        return null;
      }
    }

    return parseLegacyUserInfoXml(rawText);
  } catch {
    return null;
  }
}

async function fetchLegacyProjectRoster(token: string, userId?: string): Promise<LegacyAppUserGroup[]> {
  if (!userId) {
    return [];
  }

  const projectQueries: LegacyProjectQueryConfig[] = [
    { pathname: "/zsqy/manager/findAllByCondition", userParam: "userId" },
    { pathname: "/zsqy/appusergroup/findObjectByProvinces", userParam: "userid" }
  ];

  const results = await Promise.allSettled(
    projectQueries.map(async ({ pathname, userParam }) => {
      const queryUrl = new URL(pathname, runtimeConfig.legacyBaseUrl);
      queryUrl.searchParams.set(userParam, userId);
      queryUrl.searchParams.set("language", "zh");
      queryUrl.searchParams.set("unit", "0");
      queryUrl.searchParams.set("template", "1");

      const response = await fetch(queryUrl.toString(), {
        method: "GET",
        credentials: "include",
        headers: {
          ZSQY_TEST: token
        }
      });

      if (!response.ok) {
        return [];
      }

      return parseLegacyProjectListXml(await response.text());
    })
  );

  const merged = new Map<string, LegacyAppUserGroup>();
  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      return;
    }
    result.value.forEach((project) => {
      const projectId = toOptionalString(project.appid);
      if (!projectId || merged.has(projectId)) {
        return;
      }
      merged.set(projectId, project);
    });
  });

  return Array.from(merged.values());
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = safeLocalStorageGet(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const hydrated = hydrateSession(parsed);
    if (!hydrated) {
      clearAuthSession();
      return null;
    }
    return hydrated;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getCurrentProject(session: AuthSession | null = getAuthSession()): AuthProject | null {
  if (!session) {
    return null;
  }
  return getProjectFromList(session.projects || [], session.currentProjectId);
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthSession()?.token);
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  safeLocalStorageRemove(AUTH_STORAGE_KEY);
  clearStoredProjectSelection();
}

export function selectAuthProject(projectId: string): AuthSession | null {
  const session = getAuthSession();
  if (!session) {
    return null;
  }

  const projects = session.projects || [];
  const switchableProjects = getSwitchableProjects(projects);
  const preferredModelKey = toOptionalString(session.defaultProjectKey);
  const selectedByExactOptionId =
    projects.find((project) => resolveAuthProjectId(project) === projectId) ||
    null;
  const switchableMatchBySiteId = pickBestProjectCandidate(
    switchableProjects.filter((project) => siteIdsEquivalent(project.siteId, projectId)),
    preferredModelKey
  );
  const fullMatchBySiteId = pickBestProjectCandidate(
    projects.filter((project) => siteIdsEquivalent(project.siteId, projectId)),
    preferredModelKey
  );
  const currentProject =
    getProjectFromList(switchableProjects, projectId) ||
    switchableMatchBySiteId ||
    resolveChildProjectForParent(projects, projectId) ||
    getProjectFromList(projects, projectId) ||
    fullMatchBySiteId;
  if (!currentProject) {
    return session;
  }
  const normalizedCurrentProject =
    selectedByExactOptionId || toOptionalString(currentProject.modelKey)
      ? currentProject
      : (
          pickBestProjectCandidate(
            switchableProjects.filter((project) => siteIdsEquivalent(project.siteId, currentProject.siteId)),
            preferredModelKey
          ) ||
          currentProject
        );

  const nextSession = hydrateSession({
    ...session,
    currentProjectId: resolveAuthProjectId(normalizedCurrentProject),
    defaultProjectKey: normalizedCurrentProject.modelKey,
    defaultProjectTemplate: normalizedCurrentProject.template
  });

  if (!nextSession) {
    return null;
  }

  persistAuthSession(nextSession);
  setStoredProjectSelection(normalizedCurrentProject.siteId, normalizedCurrentProject.siteName);
  return nextSession;
}

export function resolveAuthDestination(
  session: AuthSession,
  requestedPath?: string | null
): AuthDestination {
  const redirectTarget = sanitizeInternalRedirectPath(requestedPath);
  if (session.role === "edit") {
    return {
      kind: "external",
      path: buildLegacyHashUrl("/basesetting/objectmanage")
    };
  }

  const currentProject = getCurrentProject(session);
  const requestedProject = resolveRequestedProject(session.projects || [], redirectTarget);
  if ((session.projects?.length || 0) > 1 && !currentProject) {
    if (redirectTarget && requestedProject) {
      return {
        kind: "internal",
        path: appendSiteIdToPath(redirectTarget, requestedProject.siteId)
      };
    }

    return {
      kind: "internal",
      path:
        redirectTarget && redirectTarget !== "/projects" && !redirectTarget.startsWith("/projects?")
          ? `/projects?redirect=${encodeURIComponent(redirectTarget)}`
          : "/projects"
    };
  }

  if (currentProject) {
    setStoredProjectSelection(currentProject.siteId, currentProject.siteName);
  }

  return {
    kind: "internal",
    path: appendSiteIdToPath(redirectTarget || "/scene-control", currentProject?.siteId)
  };
}

export async function loginWithLegacy(username: string, password: string): Promise<AuthSession> {
  const normalizedUsername = username.trim();
  const loginUrl = new URL("/user/login", runtimeConfig.legacyBaseUrl);
  loginUrl.searchParams.set("username", normalizedUsername);
  loginUrl.searchParams.set("password", password);

  const response = await fetch(loginUrl.toString(), {
    method: "GET",
    credentials: "include"
  });
  const xmlText = await response.text();
  const result = parseLegacyLogin(xmlText);

  if (!response.ok || result.status !== "20000" || !result.token) {
    throw new Error(result.msg || "Login failed");
  }

  const profile = await fetchLegacyUserInfo(result.token);
  const legacyProjects = mapLegacyProjects(profile?.appusergroup);
  const rosterProjects = mapLegacyProjects(await fetchLegacyProjectRoster(result.token, toOptionalString(profile?.id) || result.userId));
  const projects = mergeAuthProjects(legacyProjects, rosterProjects);
  if (violatesProjectAccountPolicy(projects.length)) {
    clearAuthSession();
    throw new Error(PROJECT_ACCOUNT_POLICY_ERROR);
  }
  const currentProjectId = resolveCurrentProjectId(projects);
  const currentProject = getProjectFromList(projects, currentProjectId);

  const session = hydrateSession({
    username: toOptionalString(profile?.username) || result.username || normalizedUsername,
    token: result.token,
    userId: toOptionalString(profile?.id) || result.userId,
    role: normalizeLegacyRole(profile?.role) || normalizeLegacyRole(result.role) || "user",
    projectCount: projects.length,
    defaultProjectKey: currentProject?.modelKey,
    defaultProjectTemplate: currentProject?.template,
    projects,
    currentProjectId: currentProject ? resolveAuthProjectId(currentProject) : undefined,
    loginAt: new Date().toISOString()
  });

  if (!session) {
    throw new Error("Unable to initialize login session");
  }

  persistAuthSession(session);
  if (currentProject) {
    setStoredProjectSelection(currentProject.siteId, currentProject.siteName);
  } else {
    clearStoredProjectSelection();
  }
  return session;
}
