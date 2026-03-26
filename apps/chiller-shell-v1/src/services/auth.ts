import { runtimeConfig } from "../config/runtimeConfig";
import {
  clearStoredProjectSelection,
  getStoredProjectSiteId,
  setStoredProjectSelection
} from "./projectSession";

export const AUTH_STORAGE_KEY = "chiller-shell-auth-v1";

export type AuthRole = "edit" | "user";

export type AuthProject = {
  siteId: string;
  siteName: string;
  siteCode?: string;
  databaseKey: string;
  groupId?: string;
  modelKey?: string;
  template?: string;
  username?: string;
  userId?: string;
  city?: string;
  appExplain?: string;
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
  appusergroup?: LegacyAppUserGroup[] | null;
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

function sanitizeProjectCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
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

function parseLegacyProjectNode(node: Element): LegacyAppUserGroup {
  return {
    appid: readChildText(node, "appid") || undefined,
    appName: readChildText(node, "appName") || undefined,
    appuserground: readChildText(node, "appuserground") || undefined,
    key: readChildText(node, "key") || undefined,
    template: readChildText(node, "template") || undefined,
    username: readChildText(node, "username") || undefined,
    userid: readChildText(node, "userid") || undefined,
    city: readChildText(node, "city") || undefined,
    appexplain: readChildText(node, "appexplain") || readChildText(node, "appexplainCNEN") || undefined,
    control: readChildText(node, "control") || undefined,
    ipaddr: readChildText(node, "ipaddr") || undefined,
    appport: readChildText(node, "appport") || undefined
  };
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

  const projectNodes = Array.from(document.querySelectorAll("data > appusergroup > appusergroup"));
  return {
    id: readChildText(dataNode, "id") || undefined,
    username: readChildText(dataNode, "username") || undefined,
    role: readChildText(dataNode, "role") || undefined,
    appusergroup: projectNodes.map(parseLegacyProjectNode)
  };
}

function parseLegacyProjectListXml(xmlText: string): LegacyAppUserGroup[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  const status = readText(document.documentElement, "status");
  if (status !== "20000") {
    return [];
  }

  return Array.from(document.documentElement.children)
    .filter((node): node is Element => node instanceof Element && node.tagName === "data")
    .filter((node) => Boolean(readChildText(node, "appid") || readChildText(node, "appName")))
    .map(parseLegacyProjectNode);
}

function mapLegacyProject(project: LegacyAppUserGroup): AuthProject | null {
  const siteId = toOptionalString(project.appid);
  if (!siteId) {
    return null;
  }

  const siteCode = toOptionalString(project.appName);
  const siteName = toOptionalString(project.appexplain) || siteCode || siteId;
  return {
    siteId,
    siteName,
    siteCode,
    databaseKey: `${siteId}${siteCode || siteName}`,
    groupId: toOptionalString(project.appuserground),
    modelKey: toOptionalString(project.key),
    template: toOptionalString(project.template),
    username: toOptionalString(project.username),
    userId: toOptionalString(project.userid),
    city: toOptionalString(project.city),
    appExplain: toOptionalString(project.appexplain),
    control: toOptionalString(project.control),
    ipAddress: toOptionalString(project.ipaddr),
    port: toOptionalString(project.appport)
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

  return {
    siteId,
    siteName: toOptionalString(candidate.siteName) || siteId,
    siteCode: toOptionalString(candidate.siteCode),
    databaseKey:
      toOptionalString(candidate.databaseKey) ||
      `${siteId}${toOptionalString(candidate.siteCode) || toOptionalString(candidate.siteName) || siteId}`,
    groupId: toOptionalString(candidate.groupId),
    modelKey: toOptionalString(candidate.modelKey),
    template: toOptionalString(candidate.template),
    username: toOptionalString(candidate.username),
    userId: toOptionalString(candidate.userId),
    city: toOptionalString(candidate.city),
    appExplain: toOptionalString(candidate.appExplain),
    control: toOptionalString(candidate.control),
    ipAddress: toOptionalString(candidate.ipAddress),
    port: toOptionalString(candidate.port)
  };
}

function sanitizeStoredProjects(value: unknown): AuthProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((item) => {
    const normalized = sanitizeStoredProject(item);
    if (!normalized || seen.has(normalized.siteId)) {
      return [];
    }
    seen.add(normalized.siteId);
    return [normalized];
  });
}

function mapLegacyProjects(value: unknown): AuthProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((item) => {
    const normalized = mapLegacyProject(item as LegacyAppUserGroup);
    if (!normalized || seen.has(normalized.siteId)) {
      return [];
    }
    seen.add(normalized.siteId);
    return [normalized];
  });
}

function mergeAuthProjectRecord(base: AuthProject, incoming: AuthProject): AuthProject {
  return {
    siteId: base.siteId,
    siteName: base.siteName || incoming.siteName || base.siteId,
    siteCode: base.siteCode || incoming.siteCode,
    databaseKey:
      base.databaseKey ||
      incoming.databaseKey ||
      `${base.siteId}${base.siteCode || incoming.siteCode || base.siteName || incoming.siteName || base.siteId}`,
    groupId: base.groupId || incoming.groupId,
    modelKey: base.modelKey || incoming.modelKey,
    template: base.template || incoming.template,
    username: base.username || incoming.username,
    userId: base.userId || incoming.userId,
    city: base.city || incoming.city,
    appExplain: base.appExplain || incoming.appExplain,
    control: base.control || incoming.control,
    ipAddress: base.ipAddress || incoming.ipAddress,
    port: base.port || incoming.port
  };
}

function mergeAuthProjects(...lists: AuthProject[][]): AuthProject[] {
  const merged = new Map<string, AuthProject>();
  lists.forEach((projects) => {
    projects.forEach((project) => {
      const current = merged.get(project.siteId);
      if (!current) {
        merged.set(project.siteId, project);
        return;
      }
      merged.set(project.siteId, mergeAuthProjectRecord(current, project));
    });
  });
  return Array.from(merged.values());
}

function resolveCurrentProjectId(projects: AuthProject[], preferredProjectId?: string): string | undefined {
  const candidates = [preferredProjectId, getStoredProjectSiteId()];
  for (const candidate of candidates) {
    if (candidate && projects.some((item) => item.siteId === candidate)) {
      return candidate;
    }
  }

  if (projects.length === 1) {
    return projects[0]?.siteId;
  }
  return undefined;
}

function getProjectFromList(projects: AuthProject[], projectId?: string): AuthProject | null {
  if (!projectId) {
    return projects.length === 1 ? projects[0] || null : null;
  }
  return projects.find((item) => item.siteId === projectId) || null;
}

function hydrateSession(session: Partial<AuthSession>): AuthSession | null {
  if (!session.username || !session.token || !session.loginAt) {
    return null;
  }

  const projects = sanitizeStoredProjects(session.projects);
  const currentProjectId = resolveCurrentProjectId(projects, toOptionalString(session.currentProjectId));
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
    defaultProjectKey: currentProject?.modelKey || toOptionalString(session.defaultProjectKey),
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
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
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

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    return hydrateSession(parsed);
  } catch {
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
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  clearStoredProjectSelection();
}

export function selectAuthProject(projectId: string): AuthSession | null {
  const session = getAuthSession();
  if (!session) {
    return null;
  }

  const projects = session.projects || [];
  const currentProject = getProjectFromList(projects, projectId);
  if (!currentProject) {
    return session;
  }

  const nextSession = hydrateSession({
    ...session,
    currentProjectId: currentProject.siteId,
    defaultProjectKey: currentProject.modelKey,
    defaultProjectTemplate: currentProject.template
  });

  if (!nextSession) {
    return null;
  }

  persistAuthSession(nextSession);
  setStoredProjectSelection(currentProject.siteId, currentProject.siteName);
  return nextSession;
}

export function resolveAuthDestination(
  session: AuthSession,
  requestedPath?: string | null
): AuthDestination {
  if (session.role === "edit") {
    return {
      kind: "external",
      path: buildLegacyHashUrl("/basesetting/objectmanage")
    };
  }

  const currentProject = getCurrentProject(session);
  if ((session.projects?.length || 0) > 1 && !currentProject) {
    const redirectTarget = sanitizeInternalRedirectPath(requestedPath);
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
    path: sanitizeInternalRedirectPath(requestedPath) || "/dashboard"
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
    currentProjectId: currentProject?.siteId,
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
