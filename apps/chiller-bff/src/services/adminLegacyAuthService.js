import { unauthorized } from "../lib/admin-errors.js";

function nowMs() {
  return Date.now();
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function readFirstTag(xmlText, tagName) {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i").exec(xmlText);
  return match ? normalizeText(match[1]) : "";
}

function readAllTagContents(xmlText, tagName) {
  return Array.from(
    xmlText.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "gi")),
    (match) => match[1]
  );
}

function parseLegacyUserInfoXml(xmlText) {
  const status = readFirstTag(xmlText, "status");
  if (status !== "20000") {
    return null;
  }

  const dataContent = readFirstTag(xmlText, "data");
  if (!dataContent) {
    return null;
  }

  return {
    userId: readFirstTag(dataContent, "id"),
    username: readFirstTag(dataContent, "username"),
    role: readFirstTag(dataContent, "role")
  };
}

function isLocalDevAuthEnabled(config) {
  if (config?.adminDevAuth !== true) {
    return false;
  }
  const appMode = normalizeText(config?.appMode).toLowerCase();
  return !appMode || ["local", "test", "development"].includes(appMode);
}

function parseDevAuthUser(config, token, hintedUserId = "") {
  if (!isLocalDevAuthEnabled(config)) {
    return null;
  }
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return null;
  }
  const configuredToken = normalizeText(config?.adminDevAuthToken);
  const acceptsConfiguredToken = configuredToken && normalizedToken === configuredToken;
  const mockMatch = /^mock-token-(.+)$/i.exec(normalizedToken);
  const devMatch = /^dev-admin(?:-(.+))?$/i.exec(normalizedToken);
  if (!acceptsConfiguredToken && !mockMatch && !devMatch) {
    return null;
  }
  const username =
    normalizeText(hintedUserId) ||
    normalizeText(mockMatch?.[1]) ||
    normalizeText(devMatch?.[1]) ||
    "admin";
  return {
    userId: username,
    username,
    role: "platform_admin",
    token: normalizedToken
  };
}

function parseLegacyProjectBlocks(xmlText) {
  const status = readFirstTag(xmlText, "status");
  if (status && status !== "20000") {
    return [];
  }

  const blocks = readAllTagContents(xmlText, "data");
  return blocks
    .map((block) => {
      const siteId = readFirstTag(block, "appid");
      if (!siteId) {
        return null;
      }

      const siteCode = readFirstTag(block, "appName");
      const siteName = readFirstTag(block, "appexplain") || readFirstTag(block, "appexplainCNEN") || siteCode || siteId;
      return {
        siteId,
        siteCode: siteCode || null,
        siteName,
        city: readFirstTag(block, "city") || null,
        databaseKey: `${siteId}${siteCode || siteName || siteId}`,
        modelKey: readFirstTag(block, "key") || null,
        template: readFirstTag(block, "template") || null,
        controlMode: readFirstTag(block, "control") || null,
        ipAddress: readFirstTag(block, "ipaddr") || null,
        port: readFirstTag(block, "appport") || null
      };
    })
    .filter(Boolean);
}

function dedupeProjects(projects) {
  const merged = new Map();
  for (const project of projects) {
    if (!project?.siteId) {
      continue;
    }

    const current = merged.get(project.siteId);
    if (!current) {
      merged.set(project.siteId, project);
      continue;
    }

    merged.set(project.siteId, {
      siteId: project.siteId,
      siteCode: current.siteCode || project.siteCode || null,
      siteName: current.siteName || project.siteName || project.siteId,
      city: current.city || project.city || null,
      databaseKey: current.databaseKey || project.databaseKey,
      modelKey: current.modelKey || project.modelKey || null,
      template: current.template || project.template || null,
      controlMode: current.controlMode || project.controlMode || null,
      ipAddress: current.ipAddress || project.ipAddress || null,
      port: current.port || project.port || null
    });
  }
  return Array.from(merged.values());
}

async function fetchLegacyText(url, token) {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ZSQY_TEST: token
    }
  });

  return {
    ok: response.ok,
    contentType: response.headers.get("content-type") || "",
    text: await response.text()
  };
}

function parseLegacyUserInfoPayload(raw) {
  if (raw.contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw.text);
      const data = parsed?.data;
      if (!data) {
        return null;
      }
      return {
        userId: normalizeText(String(data.id ?? "")),
        username: normalizeText(data.username),
        role: normalizeText(String(data.role ?? ""))
      };
    } catch (_error) {
      return null;
    }
  }
  return parseLegacyUserInfoXml(raw.text);
}

function parseLegacyProjectPayload(raw) {
  if (raw.contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw.text);
      const items = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
      return dedupeProjects(
        items.map((item) => {
          const siteId = normalizeText(String(item?.appid ?? ""));
          if (!siteId) {
            return null;
          }
          const siteCode = normalizeText(item?.appName);
          const siteName = normalizeText(item?.appexplain || item?.appexplainCNEN) || siteCode || siteId;
          return {
            siteId,
            siteCode: siteCode || null,
            siteName,
            city: normalizeText(item?.city) || null,
            databaseKey: `${siteId}${siteCode || siteName || siteId}`,
            modelKey: normalizeText(String(item?.key ?? "")) || null,
            template: normalizeText(String(item?.template ?? "")) || null,
            controlMode: normalizeText(item?.control) || null,
            ipAddress: normalizeText(item?.ipaddr) || null,
            port: normalizeText(String(item?.appport ?? "")) || null
          };
        })
      );
    } catch (_error) {
      return [];
    }
  }
  return dedupeProjects(parseLegacyProjectBlocks(raw.text));
}

export function createAdminLegacyAuthService(config, options = {}) {
  const cacheTtlMs = Number(options.cacheTtlMs || 5 * 60 * 1000);
  const cache = new Map();

  function cleanupCache() {
    const current = nowMs();
    for (const [token, entry] of cache.entries()) {
      if (!entry || entry.expiresAt <= current) {
        cache.delete(token);
      }
    }
  }

  async function fetchUserInfo(token) {
    const infoUrl = new URL("/user/dologin", config.legacyBaseUrl);
    infoUrl.searchParams.set("token", token);
    infoUrl.searchParams.set("language", "zh");
    infoUrl.searchParams.set("unit", "0");
    infoUrl.searchParams.set("template", "1");
    const raw = await fetchLegacyText(infoUrl, token);
    if (!raw.ok) {
      return null;
    }
    return parseLegacyUserInfoPayload(raw);
  }

  async function authenticateToken(token, hintedUserId = "") {
    cleanupCache();
    const cached = cache.get(token);
    if (cached && cached.expiresAt > nowMs()) {
      return cached.user;
    }

    const devUser = parseDevAuthUser(config, token, hintedUserId);
    if (devUser) {
      cache.set(token, {
        user: devUser,
        expiresAt: nowMs() + cacheTtlMs
      });
      return devUser;
    }

    let user = null;
    try {
      user = await fetchUserInfo(token);
    } catch (_error) {
      user = null;
    }
    const effectiveUserId = normalizeText(user?.userId) || normalizeText(hintedUserId);
    const effectiveUsername = normalizeText(user?.username);
    if (!effectiveUserId || !effectiveUsername) {
      throw unauthorized("Invalid or expired admin token");
    }

    const nextUser = {
      userId: effectiveUserId,
      username: effectiveUsername,
      role: normalizeText(user?.role) || null,
      token
    };
    cache.set(token, {
      user: nextUser,
      expiresAt: nowMs() + cacheTtlMs
    });
    return nextUser;
  }

  async function fetchProjectRoster(token, userId) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) {
      return [];
    }
    if (parseDevAuthUser(config, token, normalizedUserId)) {
      return [];
    }

    const queries = [
      { pathname: "/zsqy/manager/findAllByCondition", userParam: "userId" },
      { pathname: "/zsqy/appusergroup/findObjectByProvinces", userParam: "userid" }
    ];

    const results = await Promise.allSettled(
      queries.map(async ({ pathname, userParam }) => {
        const queryUrl = new URL(pathname, config.legacyBaseUrl);
        queryUrl.searchParams.set(userParam, normalizedUserId);
        queryUrl.searchParams.set("language", "zh");
        queryUrl.searchParams.set("unit", "0");
        queryUrl.searchParams.set("template", "1");
        const raw = await fetchLegacyText(queryUrl, token);
        if (!raw.ok) {
          return [];
        }
        return parseLegacyProjectPayload(raw);
      })
    );

    return dedupeProjects(
      results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    );
  }

  return {
    authenticateToken,
    fetchProjectRoster
  };
}
