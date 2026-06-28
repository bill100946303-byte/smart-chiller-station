import { runtimeConfig } from "../config/runtimeConfig";
import { getAdminMe } from "./adminClient";
import { getMockSites } from "./adminMocks";
import type { AdminRole, AdminSiteSummary, AdminMe, LegacyLoginResult } from "./adminTypes";

export const ADMIN_AUTH_STORAGE_KEY = "chiller-admin-auth-v1";

export type AdminSession = {
  username: string;
  token: string;
  userId?: string;
  role: AdminRole;
  visibleSites: AdminSiteSummary[];
  loginAt: string;
  bootstrap: boolean;
};

export type AdminDestination =
  | {
      kind: "internal";
      path: string;
    }
  | {
      kind: "external";
      path: string;
    };

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readText(node: Element | null, selector: string): string {
  return node?.querySelector(selector)?.textContent?.trim() || "";
}

function normalizeRole(value: unknown): AdminRole {
  if (value === "platform_admin" || value === "site_admin" || value === "auditor") {
    return value;
  }
  if (value === 1 || value === "1" || value === "edit") {
    return "platform_admin";
  }
  return "site_admin";
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
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

function createMockLogin(username: string): LegacyLoginResult {
  return {
    status: "20000",
    msg: "mock login ok",
    token: `mock-token-${username || "admin"}`,
    username: username || "admin",
    userId: username || "admin",
    role: "1"
  };
}

function parseSession(value: unknown): AdminSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<AdminSession>;
  const token = sanitizeString(candidate.token);
  const username = sanitizeString(candidate.username);
  const role = normalizeRole(candidate.role);
  if (!token || !username) {
    return null;
  }
  const visibleSites = Array.isArray(candidate.visibleSites)
    ? candidate.visibleSites
        .filter((site): site is AdminSiteSummary => Boolean(site && typeof site === "object"))
        .map((site) => ({
          siteId: sanitizeString(site.siteId) || "",
          siteName: sanitizeString(site.siteName) || sanitizeString(site.siteId) || "",
          siteCode: sanitizeString(site.siteCode),
          city: sanitizeString(site.city),
          status: site.status || "active",
          ownerName: sanitizeString(site.ownerName),
          remark: sanitizeString(site.remark),
          sourceStatus: site.sourceStatus || "ok",
          runtimeStatus: site.runtimeStatus || "ok",
          sourceUpdatedAt: sanitizeString(site.sourceUpdatedAt),
          runtimeUpdatedAt: sanitizeString(site.runtimeUpdatedAt),
          memberCount: typeof site.memberCount === "number" ? site.memberCount : 0,
          updatedAt: sanitizeString(site.updatedAt)
        }))
        .filter((site) => Boolean(site.siteId))
    : [];

  return {
    username,
    token,
    userId: sanitizeString(candidate.userId),
    role,
    visibleSites,
    loginAt: sanitizeString(candidate.loginAt) || new Date().toISOString(),
    bootstrap: Boolean(candidate.bootstrap)
  };
}

function buildLegacyUrl(path: string): URL {
  return new URL(path, runtimeConfig.legacyBaseUrl);
}

async function fetchLogin(username: string, password: string): Promise<LegacyLoginResult> {
  const loginUrl = buildLegacyUrl("/user/login");
  loginUrl.searchParams.set("username", username);
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
  return result;
}

function persistAdminSession(session: AdminSession): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getAdminSession(): AdminSession | null {
  if (!isBrowser()) {
    return null;
  }
  const raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const session = parseSession(JSON.parse(raw));
    if (!session || !runtimeConfig.useMockData) {
      return session;
    }
    const refreshed = {
      ...session,
      visibleSites: getMockSites()
    };
    persistAdminSession(refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAdminSession()?.token);
}

export function clearAdminSession(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
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

export function resolveAdminDestination(
  session: AdminSession,
  requestedPath?: string | null
): AdminDestination {
  const internalPath = sanitizeInternalRedirectPath(requestedPath);
  if (internalPath) {
    return {
      kind: "internal",
      path: internalPath
    };
  }
  return {
    kind: "internal",
    path:
      session.visibleSites.length === 1 && session.visibleSites[0]?.siteId
        ? `/sites/${session.visibleSites[0].siteId}`
        : "/sites"
  };
}

export async function loginWithLegacy(username: string, password: string): Promise<LegacyLoginResult> {
  const normalizedUsername = username.trim();
  if (runtimeConfig.useMockData) {
    return createMockLogin(normalizedUsername);
  }
  try {
    return await fetchLogin(normalizedUsername, password);
  } catch (error) {
    if (!runtimeConfig.useMockData && !runtimeConfig.devLogin) {
      throw error instanceof Error ? error : new Error("Login failed");
    }
    return createMockLogin(normalizedUsername);
  }
}

export async function completeAdminLogin(loginResult: LegacyLoginResult): Promise<AdminSession> {
  const me: AdminMe = await getAdminMe(loginResult.token, loginResult.userId || loginResult.username, loginResult.username);
  const session: AdminSession = {
    username: me.username || loginResult.username,
    token: loginResult.token,
    userId: me.userId || loginResult.userId,
    role: me.role || normalizeRole(loginResult.role),
    visibleSites: me.visibleSites || [],
    loginAt: new Date().toISOString(),
    bootstrap: Boolean(me.bootstrap)
  };
  persistAdminSession(session);
  return session;
}

export function restoreAdminSession(session: AdminSession): AdminSession | null {
  const parsed = parseSession(session);
  if (!parsed) {
    return null;
  }
  return parsed;
}
