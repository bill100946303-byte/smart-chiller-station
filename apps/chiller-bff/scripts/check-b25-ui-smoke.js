import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

const BFF_BASE_URL_HINT = process.env.BFF_BASE_URL || "";
const APP_BASE_URL_HINT = process.env.APP_BASE_URL || "";
const CDP_LIST_URL = process.env.CDP_LIST_URL || "http://127.0.0.1:61392/json/list";
const SITE_ID = process.env.SITE_ID || "btwentyfive";
const STRICT_UI_SMOKE = process.env.B25_UI_SMOKE_STRICT === "1";
const VERIFY_TOWER_APPROACH_CONTROLS = process.env.B25_UI_SMOKE_VERIFY_TOWER_APPROACH_CONTROLS === "1";
const REQUIRE_TOWER_APPROACH_CONTROLS = process.env.B25_UI_SMOKE_REQUIRE_TOWER_APPROACH_CONTROLS === "1";
const OPTIMIZE_DIAGNOSTIC_ONLY = process.env.B25_UI_SMOKE_OPTIMIZE_DIAGNOSTIC_ONLY === "1";
const LOGIN_USERNAME = process.env.SMOKE_USERNAME || "admin";
const LOGIN_PASSWORD = process.env.SMOKE_PASSWORD || "admin$888888$";
const LOGIN_PASSWORD_FALLBACK = process.env.SMOKE_PASSWORD_FALLBACK || "123456";
const REQUEST_PAYLOAD = {
  inputs: {
    loadKw: 1200,
    outdoorTempC: 27.6,
    mode: "cooling"
  }
};
const FIELD_COLLECTION_FORMAL_INPUT_PATHS = [
  "docs/field-data/optimize-demo-140/sensor-calibration-installation.csv",
  "docs/field-data/optimize-demo-140/control-command-feedback.csv",
  "docs/field-data/optimize-demo-140/start-stop-event.csv",
  "docs/field-data/optimize-demo-140/control-parameter.csv"
];
const OUTPUT_PATH = process.env.B25_SMOKE_OUTPUT_PATH || "";
const BFF_BASE_URL_CANDIDATES = Array.from(
  new Set([BFF_BASE_URL_HINT, "http://127.0.0.1:8787", "http://127.0.0.1:8788"].filter(Boolean))
);
const APP_BASE_URL_CANDIDATES = Array.from(
  new Set([APP_BASE_URL_HINT, "http://127.0.0.1:3006", "http://127.0.0.1:3001"].filter(Boolean))
);

function requestRaw(url, { method = "GET", headers = {}, body = "" } = {}) {
  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            status: Number(res.statusCode || 0),
            body: raw
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`request timeout after 30s: ${url}`));
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const response = await requestRaw(url, options);
  let payload = null;
  try {
    payload = JSON.parse(response.body);
  } catch (error) {
    throw new Error(`invalid json from ${url}: ${String(error)}`);
  }
  return {
    status: response.status,
    payload
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function resolveReachableAppBaseUrl() {
  for (const candidate of APP_BASE_URL_CANDIDATES) {
    try {
      const response = await requestRaw(candidate, { method: "GET" });
      if (response.status >= 200 && response.status < 500) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  return APP_BASE_URL_HINT || "http://127.0.0.1:3006";
}

async function resolveReachableBffBaseUrl() {
  for (const candidate of BFF_BASE_URL_CANDIDATES) {
    try {
      const response = await requestJson(`${candidate}/bff/v1/sites/${SITE_ID}/dashboard/overview`, {
        headers: {
          "x-chiller-project-key": SITE_ID
        }
      });
      if (response.status >= 200 && response.status < 500) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  return BFF_BASE_URL_HINT || "http://127.0.0.1:8787";
}

function buildCredentialCandidates() {
  return Array.from(
    new Map(
      [
        [LOGIN_USERNAME, LOGIN_PASSWORD],
        [LOGIN_USERNAME, LOGIN_PASSWORD_FALLBACK]
      ]
        .filter((item) => item[0] && item[1])
        .map((item) => [item.join("::"), { username: item[0], password: item[1] }])
    ).values()
  );
}

function buildProjectSelectionUrl(appBaseUrl, redirectPath) {
  const url = new URL("/projects", appBaseUrl);
  if (redirectPath) {
    url.searchParams.set("redirect", redirectPath);
  }
  return url.toString();
}

function normalizeSmokeText(value) {
  return String(value || "").trim();
}

function buildSmokeTargetProject(siteId) {
  const targetSiteId = normalizeSmokeText(siteId) || "140";
  const normalizedTarget = targetSiteId.toLowerCase();
  if (targetSiteId === "140" || normalizedTarget === "btwentyfive") {
    return {
      siteId: targetSiteId,
      siteName: "观澜B25",
      siteCode: "btwentyfive",
      appExplain: "观澜B25",
      databaseKey: "140btwentyfive",
      modelKey: "126lnoffice",
      template: "1"
    };
  }
  return {
    siteId: targetSiteId,
    siteName: targetSiteId,
    siteCode: targetSiteId,
    appExplain: targetSiteId,
    databaseKey: targetSiteId,
    modelKey: targetSiteId,
    template: "1"
  };
}

function buildSmokeSessionSeed(siteId) {
  const targetProject = buildSmokeTargetProject(siteId);
  const fallbackProjects = [
    {
      siteId: "126lnoffice",
      siteName: "126lnoffice",
      siteCode: "126lnoffice",
      databaseKey: "126lnoffice",
      modelKey: "126lnoffice",
      template: "1"
    },
    {
      siteId: "127",
      siteName: "127",
      siteCode: "127",
      databaseKey: "127",
      modelKey: "127",
      template: "1"
    }
  ];
  const seen = new Set();
  const projects = [targetProject, ...fallbackProjects].filter((project) => {
    const key = `${normalizeSmokeText(project.siteId)}::${normalizeSmokeText(project.modelKey)}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return {
    targetProject,
    session: {
      username: LOGIN_USERNAME || "admin",
      token: "smoke-token",
      userId: "1",
      role: "user",
      projectCount: projects.length,
      defaultProjectKey: targetProject.modelKey,
      defaultProjectTemplate: targetProject.template,
      currentProjectId: targetProject.siteId,
      projects
    },
    project: {
      siteId: targetProject.siteId,
      siteName: targetProject.siteName
    }
  };
}

async function fetchOptimizeExecutionList(bffBaseUrl, siteId) {
  const result = await requestJson(`${bffBaseUrl}/bff/v1/sites/${siteId}/optimize/executions?limit=12`);
  expect(result.status === 200, `optimize executions should return 200, got ${result.status}`);
  return Array.isArray(result.payload?.items) ? result.payload.items : [];
}

async function fetchOptimizeDraftDetails(bffBaseUrl, siteId, requestPayload = REQUEST_PAYLOAD) {
  const result = await requestJson(`${bffBaseUrl}/bff/v1/sites/${siteId}/optimize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chiller-project-key": siteId
    },
    body: JSON.stringify(requestPayload)
  });
  expect(result.status === 200, `optimize advisor should return 200, got ${result.status}`);
  expect(result.payload?.ok === true, `optimize advisor should return ok=true, got ${String(result.payload?.ok)}`);
  expect(result.payload?.details, "optimize draft should include details");
  return result.payload.details;
}

async function createTowerApproachExecutionForSmoke(bffBaseUrl, siteId, payload) {
  const result = await requestJson(`${bffBaseUrl}/bff/v1/sites/${siteId}/optimize/tower-approach/executions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chiller-project-key": siteId,
      "x-chiller-user-id": LOGIN_USERNAME
    },
    body: JSON.stringify(payload)
  });
  return {
    status: result.status,
    payload: result.payload
  };
}

function assertTowerApproachExecutionRecord(record) {
  expect(record?.execution?.type === "tower-approach", `tower-approach execution should persist type, got ${String(record?.execution?.type)}`);
  expect(
    typeof record?.execution?.targetApproachC === "number" || typeof record?.execution?.targetTcwsC === "number",
    `tower-approach execution should persist targetApproachC/targetTcwsC, got ${JSON.stringify(record?.execution)}`
  );
  expect(
    record?.execution?.guardrailSnapshot && typeof record.execution.guardrailSnapshot === "object",
    `tower-approach execution should persist guardrailSnapshot, got ${JSON.stringify(record?.execution?.guardrailSnapshot)}`
  );
  expect(
    typeof record?.execution?.guardrailSnapshot?.key === "string" &&
      record.execution.guardrailSnapshot.key.includes("chillerMinCondenserInletTempC"),
    `tower-approach execution guardrailSnapshot.key missing, got ${String(record?.execution?.guardrailSnapshot?.key)}`
  );
  expect(
    record?.execution?.rollbackTarget && typeof record.execution.rollbackTarget === "object",
    `tower-approach execution should persist rollbackTarget, got ${JSON.stringify(record?.execution?.rollbackTarget)}`
  );
  expect(
    Array.isArray(record?.execution?.actions) && record.execution.actions.length > 0,
    `tower-approach execution should persist actions, got ${JSON.stringify(record?.execution?.actions)}`
  );
  expect(
    record?.execution?.equipmentContext && typeof record.execution.equipmentContext === "object",
    `tower-approach execution should persist equipmentContext, got ${JSON.stringify(record?.execution?.equipmentContext)}`
  );
}

async function createCdpClient(targetWsUrl) {
  if (typeof WebSocket !== "function") {
    throw new Error("global WebSocket is unavailable in this Node runtime");
  }
  const ws = new WebSocket(targetWsUrl);
  const pending = new Map();
  let seq = 0;

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        const item = pending.get(id);
        if (!item) {
          return;
        }
        pending.delete(id);
        item.reject(new Error(`cdp timeout: ${method}`));
      }, 15_000);
    });
  }

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!Object.prototype.hasOwnProperty.call(message, "id")) {
      return;
    }
    const item = pending.get(message.id);
    if (!item) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      item.reject(new Error(JSON.stringify(message.error)));
      return;
    }
    item.resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", (error) => reject(error instanceof Error ? error : new Error(String(error))), {
      once: true
    });
  });

  await send("Page.enable");
  await send("Runtime.enable");

  return {
    send,
    close: () => ws.close()
  };
}

async function runApiChecks(bffBaseUrl) {
  const overviewWithSiteKey = await requestJson(
    `${bffBaseUrl}/bff/v1/sites/${SITE_ID}/dashboard/overview`,
    {
      headers: {
        "x-chiller-project-key": SITE_ID
      }
    }
  );
  expect(
    overviewWithSiteKey.status === 200,
    `dashboard overview should return 200, got ${overviewWithSiteKey.status}`
  );
  const energyCards = overviewWithSiteKey.payload?.energyCards || {};
  const hasAnyCoreValue = [
    energyCards.currentCop,
    energyCards.totalPowerKw,
    energyCards.totalCoolingCapacity,
    energyCards.chilledDeltaT,
    energyCards.coolingDeltaT
  ].some((value) => typeof value === "number" && Number.isFinite(value));
  expect(hasAnyCoreValue, "dashboard overview should contain at least one numeric core metric");

  const optimize = await requestJson(`${bffBaseUrl}/bff/v1/sites/${SITE_ID}/optimize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chiller-project-key": SITE_ID
    },
    body: JSON.stringify(REQUEST_PAYLOAD)
  });
  expect(optimize.status === 200, `optimize should return 200, got ${optimize.status}`);
  expect(optimize.payload?.details, "optimize response should include details");
  expect(
    optimize.payload?.code === "OK",
    `optimize code should be OK, got ${String(optimize.payload?.code)}`
  );
  const optimizeDetails = optimize.payload.details;
  expect(
    Array.isArray(optimizeDetails?.schemes) && optimizeDetails.schemes.length === 3,
    "optimize details should contain 3 schemes"
  );
  const chillerStagingAdvisor = optimizeDetails?.chillerStagingAdvisor || null;
  const fieldCollectionPackageEvidence =
    optimizeDetails?.operationalDiagnosticsAdvisor?.summary?.fieldCollectionPackageEvidence || null;
  expect(
    chillerStagingAdvisor && typeof chillerStagingAdvisor === "object",
    "optimize details should include chillerStagingAdvisor"
  );
  expect(
    chillerStagingAdvisor?.basis === "combination_empirical_performance",
    `chillerStagingAdvisor should use empirical combination basis, got ${String(chillerStagingAdvisor?.basis)}`
  );
  expect(
    ["read_only", "shadow"].includes(chillerStagingAdvisor?.executionMode),
    `chillerStagingAdvisor should stay read_only/shadow, got ${String(chillerStagingAdvisor?.executionMode)}`
  );
  expect(
    chillerStagingAdvisor?.advisorResult?.execution?.enforcedAllowed === false,
    "chillerStagingAdvisor should not allow enforced execution"
  );
  expect(
    !("singleChillerCop" in (chillerStagingAdvisor?.current || {})),
    "multi-chiller optimize draft must not expose current singleChillerCop"
  );
  expect(
    fieldCollectionPackageEvidence?.finalDecision === "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT",
    `field collection package evidence should be ready to collect, got ${String(
      fieldCollectionPackageEvidence?.finalDecision
    )}`
  );
  expect(
    Number(fieldCollectionPackageEvidence?.formalInputCount || 0) === 4,
    `field collection package should expose 4 formal inputs, got ${String(fieldCollectionPackageEvidence?.formalInputCount)}`
  );
  const formalInputPaths = (Array.isArray(fieldCollectionPackageEvidence?.formalInputs)
    ? fieldCollectionPackageEvidence.formalInputs
    : [])
    .map((item) => String(item?.path || ""));
  for (const expectedPath of FIELD_COLLECTION_FORMAL_INPUT_PATHS) {
    expect(
      formalInputPaths.includes(expectedPath),
      `field collection package should expose formal input path: ${expectedPath}`
    );
  }

  return {
    overview: {
      status: overviewWithSiteKey.status,
      currentCop: energyCards.currentCop ?? null,
      totalPowerKw: energyCards.totalPowerKw ?? null,
      totalCoolingCapacity: energyCards.totalCoolingCapacity ?? null,
      sourceOverall: overviewWithSiteKey.payload?.sourceStatus?.overall ?? "unknown"
    },
    optimize: {
      status: optimize.status,
      code: optimize.payload?.code ?? null,
      schemeCount: Array.isArray(optimize.payload?.details?.schemes)
        ? optimize.payload.details.schemes.length
        : 0,
      chillerStaging: {
        status: chillerStagingAdvisor?.status || null,
        executionMode: chillerStagingAdvisor?.executionMode || null,
        basis: chillerStagingAdvisor?.basis || null,
        enforcedAllowed: chillerStagingAdvisor?.advisorResult?.execution?.enforcedAllowed ?? null,
        exposesSingleChillerCop: "singleChillerCop" in (chillerStagingAdvisor?.current || {})
      },
      fieldCollectionPackage: {
        finalDecision: fieldCollectionPackageEvidence?.finalDecision || null,
        formalInputCount: fieldCollectionPackageEvidence?.formalInputCount ?? null,
        presentFormalInputCount: fieldCollectionPackageEvidence?.presentFormalInputCount ?? null,
        missingFormalInputCount: fieldCollectionPackageEvidence?.missingFormalInputCount ?? null,
        formalInputPaths
      }
    }
  };
}

async function pickCdpTarget(appBaseUrl) {
  const { payload } = await requestJson(CDP_LIST_URL);
  const targets = Array.isArray(payload) ? payload : [];
  const appOrigin = new URL(appBaseUrl).origin;
  const preferred = targets.find(
    (target) =>
      target?.type === "page" &&
      typeof target?.url === "string" &&
      target.url.startsWith(appOrigin) &&
      typeof target?.webSocketDebuggerUrl === "string"
  );
  if (preferred) {
    return preferred;
  }
  const fallback = targets.find(
    (target) => target?.type === "page" && typeof target?.webSocketDebuggerUrl === "string"
  );
  if (!fallback) {
    throw new Error("no CDP page target found, open a browser page first");
  }
  return fallback;
}

async function evaluateJson(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true
  });
  return JSON.parse(result?.result?.value || "{}");
}

async function readPageState(client) {
  return evaluateJson(
    client,
    `JSON.stringify((() => ({
      href: location.href,
      pathname: location.pathname,
      loginError: (document.querySelector(".login-error")?.textContent || "").trim()
    }))())`
  );
}

async function submitLogin(client, username, password) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const usernameInput =
        document.querySelector('input[autocomplete="username"]') ||
        document.querySelector(".login-card input");
      const passwordInput =
        document.querySelector('input[autocomplete="current-password"]') ||
        document.querySelector('.login-card input[type="password"]');
      const submitButton = document.querySelector('.login-card button[type="submit"]');
      if (!usernameInput || !passwordInput || !submitButton) {
        return { ok: false, reason: "login_form_missing" };
      }
      usernameInput.value = ${JSON.stringify(username)};
      passwordInput.value = ${JSON.stringify(password)};
      usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      usernameInput.dispatchEvent(new Event("change", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
      submitButton.click();
      return { ok: true };
    })()`,
    returnByValue: true
  });
  return result?.result?.value || { ok: false, reason: "runtime_eval_failed" };
}

async function seedSmokeSession(client, appBaseUrl) {
  const smokeSeed = buildSmokeSessionSeed(SITE_ID);
  const seeded = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const authStorageKey = "chiller-shell-auth-v1";
      const projectStorageKey = "chiller-shell-project-v1";
      const now = new Date().toISOString();
      const seed = ${JSON.stringify(smokeSeed)};
      const session = {
        ...seed.session,
        loginAt: now,
        projects: seed.session.projects
      };
      const project = {
        ...seed.project,
        selectedAt: now
      };
      window.localStorage.setItem(authStorageKey, JSON.stringify(session));
      window.localStorage.setItem(projectStorageKey, JSON.stringify(project));
      return {
        ok: true,
        currentProjectId: session.currentProjectId,
        userId: session.userId,
        targetSiteId: seed.targetProject.siteId
      };
    })()`,
    returnByValue: true
  });
  const result = seeded?.result?.value || { ok: false, reason: "seed_auth_eval_failed" };
  expect(result.ok, `ui smoke seed session failed: ${JSON.stringify(result)}`);
  await client.send("Page.navigate", { url: `${appBaseUrl}/dashboard?siteId=${encodeURIComponent(smokeSeed.targetProject.siteId)}` });
  await sleep(2200);
  return result;
}

async function ensureAuthenticated(client, appBaseUrl) {
  await client.send("Page.navigate", { url: `${appBaseUrl}/dashboard` });
  await sleep(2600);

  let pageState = await readPageState(client);
  if (pageState.pathname !== "/login") {
    return { reusedSession: true, credentialTried: null };
  }

  const credentials = buildCredentialCandidates();
  for (const credential of credentials) {
    const submission = await submitLogin(client, credential.username, credential.password);
    if (!submission?.ok) {
      continue;
    }
    await sleep(2800);
    pageState = await readPageState(client);
    if (pageState.pathname !== "/login") {
      return {
        reusedSession: false,
        credentialTried: credential.username
      };
    }
  }
  const seededSession = await seedSmokeSession(client, appBaseUrl);
  pageState = await readPageState(client);
  if (pageState.pathname !== "/login") {
    return {
      reusedSession: false,
      seededSession: true,
      credentialTried: null,
      seed: seededSession
    };
  }

  throw new Error(`ui smoke login failed: ${pageState.loginError || "invalid credentials"}`);
}

async function readStoredProjectState(client) {
  return evaluateJson(
    client,
    `JSON.stringify((() => {
      const authStorageKey = "chiller-shell-auth-v1";
      const projectStorageKey = "chiller-shell-project-v1";
      let session = null;
      let storedProject = null;
      try {
        session = JSON.parse(window.localStorage.getItem(authStorageKey) || "null");
      } catch {
        session = null;
      }
      try {
        storedProject = JSON.parse(window.localStorage.getItem(projectStorageKey) || "null");
      } catch {
        storedProject = null;
      }
      return {
        currentProjectId: session?.currentProjectId || null,
        projectCount: Array.isArray(session?.projects) ? session.projects.length : 0,
        storedProjectId: storedProject?.siteId || null,
        storedProjectName: storedProject?.siteName || null
      };
    })())`
  );
}

async function readProjectSelectionState(client) {
  return evaluateJson(
    client,
    `JSON.stringify((() => {
      const cards = Array.from(document.querySelectorAll(".project-switch-card")).map((card, index) => {
        const button = card.querySelector(".project-switch-cta");
        return {
          index,
          projectId: card.getAttribute("data-project-id") || null,
          siteId: card.getAttribute("data-site-id") || button?.getAttribute("data-site-id") || null,
          siteName:
            card.getAttribute("data-site-name") ||
            card.querySelector(".project-switch-card-head strong")?.textContent?.trim() ||
            null,
          isCurrent: card.classList.contains("is-current"),
          disabled: Boolean(button?.disabled),
          buttonText: button?.textContent?.trim() || null
        };
      });
      const params = new URLSearchParams(location.search);
      return {
        href: location.href,
        pathname: location.pathname,
        redirect: params.get("redirect"),
        cards,
        openButtonVisible: Boolean(document.querySelector(".top-action-button")),
        topProjectValue: document.querySelector(".project-switcher select")?.value || null
      };
    })())`
  );
}

async function ensureTargetProject(client, appBaseUrl, preferredSiteId) {
  await client.send("Page.navigate", {
    url: buildProjectSelectionUrl(appBaseUrl, "/dashboard")
  });
  await sleep(2600);

  const preferred = String(preferredSiteId || "").trim().toLowerCase();
  let beforeState = await readProjectSelectionState(client);
  if (beforeState.pathname !== "/projects") {
    const existingState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const params = new URLSearchParams(location.search);
        const authStorageKey = "chiller-shell-auth-v1";
        const projectStorageKey = "chiller-shell-project-v1";
        let session = null;
        let storedProject = null;
        try {
          session = JSON.parse(window.localStorage.getItem(authStorageKey) || "null");
        } catch {
          session = null;
        }
        try {
          storedProject = JSON.parse(window.localStorage.getItem(projectStorageKey) || "null");
        } catch {
          storedProject = null;
        }
        return {
          href: location.href,
          pathname: location.pathname,
          siteIdParam: params.get("siteId"),
          currentProjectId: session?.currentProjectId || null,
          storedProjectId: storedProject?.siteId || null,
          topProjectValue: document.querySelector(".project-switcher select")?.value || null
        };
      })())`
    );
    expect(
      existingState.pathname !== "/login",
      `project switch fallback should not land on /login, got ${existingState.pathname}`
    );
    const existingMatchesPreferred =
      !preferred ||
      [
        existingState.currentProjectId,
        existingState.storedProjectId,
        existingState.siteIdParam,
        existingState.topProjectValue
      ].some((value) => String(value || "").trim().toLowerCase() === preferred);
    if (!existingMatchesPreferred) {
      const seededSession = await seedSmokeSession(client, appBaseUrl);
      const seededState = await evaluateJson(
        client,
        `JSON.stringify((() => {
          const params = new URLSearchParams(location.search);
          const authStorageKey = "chiller-shell-auth-v1";
          const projectStorageKey = "chiller-shell-project-v1";
          let session = null;
          let storedProject = null;
          try {
            session = JSON.parse(window.localStorage.getItem(authStorageKey) || "null");
          } catch {
            session = null;
          }
          try {
            storedProject = JSON.parse(window.localStorage.getItem(projectStorageKey) || "null");
          } catch {
            storedProject = null;
          }
          return {
            href: location.href,
            pathname: location.pathname,
            siteIdParam: params.get("siteId"),
            currentProjectId: session?.currentProjectId || null,
            storedProjectId: storedProject?.siteId || null,
            topProjectValue: document.querySelector(".project-switcher select")?.value || null
          };
        })())`
      );
      return {
        before: beforeState,
        clicked: {
          ok: true,
          siteId: seededSession.targetSiteId || preferredSiteId || SITE_ID,
          seeded: true
        },
        after: seededState
      };
    }
    const fallbackSiteId =
      existingState.currentProjectId ||
      existingState.storedProjectId ||
      existingState.siteIdParam ||
      String(preferredSiteId || "").trim() ||
      SITE_ID;
    return {
      before: beforeState,
      clicked: {
        ok: true,
        siteId: fallbackSiteId,
        bypassed: true
      },
      after: {
        ...existingState,
        siteIdParam: existingState.siteIdParam || fallbackSiteId
      }
    };
  }
  expect(beforeState.cards.length > 0, "project switch page should render at least one project card");

  if (
    preferred &&
    !beforeState.cards.some((card) =>
      [card.siteId, card.projectId].some((value) => String(value || "").trim().toLowerCase() === preferred)
    )
  ) {
    await seedSmokeSession(client, appBaseUrl);
    await client.send("Page.navigate", {
      url: buildProjectSelectionUrl(appBaseUrl, "/dashboard")
    });
    await sleep(2600);
    beforeState = await readProjectSelectionState(client);
    expect(
      beforeState.cards.some((card) =>
        [card.siteId, card.projectId].some((value) => String(value || "").trim().toLowerCase() === preferred)
      ),
      `project switch should expose preferred site ${String(preferredSiteId)}, state=${JSON.stringify(beforeState)}`
    );
  }

  const targetCard =
    beforeState.cards.find(
      (card) =>
        [card.siteId, card.projectId].some((value) => String(value || "").trim().toLowerCase() === preferred) &&
        !card.disabled
    ) ||
    beforeState.cards.find((card) => !card.isCurrent && !card.disabled) ||
    beforeState.cards.find((card) => !card.disabled) ||
    null;

  expect(targetCard, `project switch should expose a clickable target card, state=${JSON.stringify(beforeState)}`);

  const clickResult = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const target = Array.from(document.querySelectorAll(".project-switch-card"))
        .find((card) => (card.getAttribute("data-site-id") || "") === ${JSON.stringify(targetCard.siteId || "")});
      const button = target?.querySelector(".project-switch-cta");
      if (!target || !button) {
        return { ok: false, reason: "target_button_missing" };
      }
      button.click();
      return {
        ok: true,
        projectId: target.getAttribute("data-project-id") || null,
        siteId: target.getAttribute("data-site-id") || button.getAttribute("data-site-id") || null,
        siteName: target.getAttribute("data-site-name") || null
      };
    })()`,
    returnByValue: true
  });

  const clicked = clickResult?.result?.value || { ok: false, reason: "project_switch_eval_failed" };
  expect(clicked.ok, `project switch click should succeed, got ${JSON.stringify(clicked)}`);

  let afterState = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    afterState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const params = new URLSearchParams(location.search);
        const authStorageKey = "chiller-shell-auth-v1";
        const projectStorageKey = "chiller-shell-project-v1";
        let session = null;
        let storedProject = null;
        try {
          session = JSON.parse(window.localStorage.getItem(authStorageKey) || "null");
        } catch {
          session = null;
        }
        try {
          storedProject = JSON.parse(window.localStorage.getItem(projectStorageKey) || "null");
        } catch {
          storedProject = null;
        }
        return {
          href: location.href,
          pathname: location.pathname,
          siteIdParam: params.get("siteId"),
          currentProjectId: session?.currentProjectId || null,
          storedProjectId: storedProject?.siteId || null,
          topProjectValue: document.querySelector(".project-switcher select")?.value || null
        };
      })())`
    );
    if (afterState.pathname !== "/projects" && afterState.currentProjectId === clicked.siteId) {
      break;
    }
    await sleep(800);
  }

  expect(
    afterState.pathname !== "/login" && afterState.pathname !== "/projects",
    `project switch should leave auth/project selection pages, got ${afterState.pathname}`
  );
  expect(
    afterState.siteIdParam === clicked.siteId,
    `dashboard url should carry siteId=${String(clicked.siteId)}, got ${String(afterState.siteIdParam)}`
  );
  const clickedProjectId = clicked.projectId || clicked.siteId;
  expect(
    afterState.currentProjectId === clickedProjectId || afterState.currentProjectId === clicked.siteId,
    `auth session should switch to ${String(clickedProjectId)}, got ${String(afterState.currentProjectId)}`
  );
  expect(
    afterState.storedProjectId === clicked.siteId,
    `stored project should switch to ${String(clicked.siteId)}, got ${String(afterState.storedProjectId)}`
  );

  return {
    before: beforeState,
    clicked,
    after: afterState
  };
}

async function readExecutionHubState(client) {
  return evaluateJson(
    client,
    `JSON.stringify((() => {
      const text = document.body?.innerText || "";
      return {
        href: location.href,
        pathname: location.pathname,
        siteIdParam: new URLSearchParams(location.search).get("siteId"),
        latestExecutionId:
          document.querySelector('.optimize-response-card strong')?.textContent?.trim() || null,
        latestStatusText:
          Array.from(document.querySelectorAll(".optimize-response-card"))
            .find((card) => (card.textContent || "").includes("最新状态"))
            ?.querySelector("strong")
            ?.textContent
            ?.trim() || null,
        pendingApproveEnabled: Boolean(
          document.querySelector('[data-execution-action="approve"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="approve-pump-delta-t"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="approve-tower-approach"]:not(:disabled)')
        ),
        pendingTowerApproachApproveEnabled: Boolean(
          document.querySelector('[data-execution-action="approve-tower-approach"]:not(:disabled)')
        ),
        rollbackEnabled: Boolean(
          document.querySelector('[data-execution-action="rollback"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="rollback-pump-delta-t"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="rollback-tower-approach"]:not(:disabled)')
        ),
        towerApproachRollbackEnabled: Boolean(
          document.querySelector('[data-execution-action="rollback-tower-approach"]:not(:disabled)')
        ),
        pendingPumpDeltaTApproveEnabled: Boolean(
          document.querySelector('[data-execution-action="approve-pump-delta-t"]:not(:disabled)')
        ),
        pumpDeltaTRollbackEnabled: Boolean(
          document.querySelector('[data-execution-action="rollback-pump-delta-t"]:not(:disabled)')
        ),
        hasHistory: Boolean(document.querySelector(".optimize-execution-history-item")),
        text
      };
    })())`
  );
}

async function runUiChecks(bffBaseUrl, appBaseUrl) {
  let target = null;
  try {
    target = await pickCdpTarget(appBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (STRICT_UI_SMOKE) {
      throw error;
    }
    return {
      skipped: true,
      reason: `cdp unavailable: ${message}`,
      strictMode: STRICT_UI_SMOKE
    };
  }

  const client = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    const authState = await ensureAuthenticated(client, appBaseUrl);
    const projectState = await ensureTargetProject(client, appBaseUrl, SITE_ID);

    await client.send("Page.navigate", { url: `${appBaseUrl}/dashboard` });
    await sleep(3200);

    const dashboardState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const text = document.body?.innerText || "";
        const cardValues = Array.from(document.querySelectorAll(".dashboard-ops-card strong, .dashboard-ops-card .stat-value, .dashboard-card-value"))
          .map((node) => (node.textContent || "").trim())
          .filter(Boolean);
        const dashOnlyCount = cardValues.filter((value) => value.includes("--")).length;
        const sourceBanner = document.body?.innerText?.includes("快照回退") || document.body?.innerText?.includes("最近可用快照");
        const hasOpsBoardBySelector = Boolean(document.querySelector(".dashboard-ops-board"));
        const hasEfficiencyRailBySelector = Boolean(document.querySelector(".dashboard-ops-rail-efficiency"));
        const hasDutyCockpitCopy = text.includes("能源站值班驾驶舱") && text.includes("值班结论");
        const hasEfficiencyCopy =
          text.includes("1. 效率表现") ||
          text.includes("冷站COP趋势与对标") ||
          text.includes("当前COP");
        const hasSourceObservableCopy =
          text.includes("首页数据来源") ||
          text.includes("数据完整率") ||
          text.includes("云端实时");
        return {
          url: location.href,
          siteIdParam: new URLSearchParams(location.search).get("siteId"),
          onLoginPage: location.pathname === "/login",
          hasOpsBoard: hasOpsBoardBySelector || text.includes("值班判断板") || hasDutyCockpitCopy,
          hasEfficiencyBlock: hasEfficiencyRailBySelector || hasEfficiencyCopy,
          hasSourceObservableField: hasSourceObservableCopy,
          cardCount: cardValues.length,
          allDash: cardValues.length > 0 ? dashOnlyCount === cardValues.length : false,
          sampleValues: cardValues.slice(0, 12),
          hasSnapshotHint: sourceBanner
        };
      })())`
    );
    expect(!dashboardState.onLoginPage, "dashboard check failed because browser is on login page");
    expect(dashboardState.siteIdParam, "dashboard should expose siteId in url");
    expect(dashboardState.hasOpsBoard, "dashboard should render ops board");
    expect(dashboardState.hasEfficiencyBlock, "dashboard should render efficiency section");
    expect(dashboardState.hasSourceObservableField, "dashboard should render source observable field");
    expect(!dashboardState.allDash, "dashboard cards should not all be '--'");

    await client.send("Page.navigate", { url: `${appBaseUrl}/optimize-demo` });
    await sleep(2500);

    let optimizeState = null;
    for (let round = 0; round < 3; round += 1) {
      await client.send("Runtime.evaluate", {
        expression: `(() => {
          const numberInputs = Array.from(document.querySelectorAll('.optimize-form input[type="number"]'));
          const setNativeValue = (input, value) => {
            const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
            if (descriptor && typeof descriptor.set === "function") {
              descriptor.set.call(input, value);
              return;
            }
            input.value = value;
          };
          if (numberInputs[0]) setNativeValue(numberInputs[0], "1200");
          if (numberInputs[1]) setNativeValue(numberInputs[1], "27.6");
          for (const input of numberInputs) {
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        })()`,
        returnByValue: true
      });
      await sleep(500);

      await client.send("Runtime.evaluate", {
        expression: `(() => {
          const submitButton = document.querySelector('.optimize-form button[type="submit"]');
          const form = document.querySelector(".optimize-form");
          if (form && typeof form.requestSubmit === "function") {
            form.requestSubmit();
            return { submitted: true, via: "requestSubmit" };
          }
          if (submitButton) {
            submitButton.click();
            return { submitted: true, via: "buttonClick" };
          }
          return { submitted: false, via: "missing_submit" };
        })()`,
        returnByValue: true
      });

      for (let attempt = 0; attempt < 30; attempt += 1) {
        optimizeState = await evaluateJson(
          client,
          `JSON.stringify((() => {
            const visibleText = document.body?.innerText || "";
            const text = visibleText + "\\n" + (document.body?.textContent || "");
            return {
              url: location.href,
              siteIdParam: new URLSearchParams(location.search).get("siteId"),
              onLoginPage: location.pathname === "/login",
              schemeCardCount: document.querySelectorAll(".optimize-scheme-card").length,
              responseCardCount: document.querySelectorAll(".optimize-response-card").length,
              readinessCount: document.querySelectorAll(".optimize-readiness").length,
              submitDisabled: Boolean(document.querySelector('.optimize-form button[type="submit"]')?.disabled),
              loadInputValue:
                document.querySelector('.optimize-form input[type="number"]')?.value || null,
              wetBulbInputValue:
                document.querySelectorAll('.optimize-form input[type="number"]')[1]?.value || null,
              sourceSummary:
                document.querySelector(".source-banner > div")?.textContent?.trim() || null,
              hasHistorySection: text.includes("历史对标") || text.includes("主机组合样本") || text.includes("主机组合优化"),
              hasChillerStagingAdvisorSection: text.includes("主机组合优化"),
              hasChillerCurrentCombination: text.includes("当前运行组合"),
              hasChillerTargetCombination: text.includes("推荐目标组合"),
              hasChillerEmpiricalPerformance: text.includes("组合实测性能"),
              hasChillerShadowVerification: text.includes("影子验证") || text.includes("shadow 验证"),
              hasChillerNoSingleCop:
                text.includes("不计算多机单台 COP") ||
                text.includes("不计算多机单台COP") ||
                text.includes("多机无单台流量时只评价组合 COP / 冷站 COP"),
              hasFieldCollectionPackageReadiness:
                text.includes("现场采集包") && text.includes("FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT"),
              hasFormalCsvReadiness:
                text.includes("正式 CSV") && /0\\s*已投放\\s*\\/\\s*4\\s*未投放/.test(text),
              hasFormalCsvMissingDetails:
                ${JSON.stringify(FIELD_COLLECTION_FORMAL_INPUT_PATHS)}.every((expectedPath) => text.includes(expectedPath)),
              hasBenefitSection: text.includes("草案收益") || text.includes("节能估算"),
              hasApproachSection:
                text.includes("接近度执行前检查") ||
                text.includes("接近度影子审批") ||
                text.includes("Approach Pre-Execution Check") ||
                text.includes("Kiểm tra approach trước thực thi"),
              hasPumpDeltaTSection: text.includes("泵频率修正影子审批") || text.includes("提交泵频审批"),
              hasOperationalDiagnosticsSection: text.includes("运行诊断 Advisor"),
              hasClientDemoReadinessSection: text.includes("甲方演示 readiness"),
              hasClientDemoReadinessDecision: text.includes("CLIENT_DEMO_READY_SHADOW_PENDING"),
              hasClientDemoReadinessNoMutation: text.includes("NO_CONTROL_MUTATION"),
              hasClientDemoReadinessScope: text.includes("read-only / shadow"),
              hasDiagnosticReadinessSection: text.includes("数据资源与诊断可行性"),
              hasDiagnosticReadinessCanDo: text.includes("可做 V1"),
              hasDiagnosticReadinessDirectional: text.includes("只能疑似判断"),
              hasDiagnosticReadinessPointGap: text.includes("暂不能做"),
              hasDiagnosticReadinessNoFault: text.includes("不判定设备故障"),
              hasDiagnosticReadinessNoPlc:
                text.includes("不写 PLC") ||
                text.includes("真实 PLC 下发锁定") ||
                text.includes("不新增 PLC 下发能力"),
              hasDiagnosticReadinessNoAutoDispatch:
                !text.includes("自动下发") &&
                !text.includes("真实 PLC 下发已开启"),
              hasFieldVerificationChecklist: text.includes("现场复核清单"),
              hasFieldVerificationReadonlyBoundary:
                text.includes("只读点位/资料补齐") ||
                text.includes("不触发审批、dispatch 或 PLC 写入"),
              hasFieldVerificationP0: text.includes("P0") && text.includes("补传感器校准与安装位置台账"),
              hasInstrumentDriftV1: text.includes("仪表偏移 V1"),
              hasInstrumentDriftNoAutoCorrection: text.includes("不自动修正测点"),
              hasInstrumentDriftReviewBoundary: text.includes("不判定仪表故障"),
              hasInstrumentDriftCrossChecks:
                text.includes("仪表交叉校验") ||
                text.includes("总功率/分项功率闭合"),
              hasInstrumentDriftFieldTargets:
                text.includes("仪表现场复核对象") ||
                text.includes("建立仪表校准与安装位置基线"),
              hasHydraulicBalanceV1: text.includes("水力平衡 V1"),
              hasHydraulicNoAutoPumpDown: text.includes("不自动降泵"),
              hasHydraulicNoTerminalFault: text.includes("不直接判定末端阀门故障"),
              hasHydraulicRiskIndicators:
                text.includes("水力风险指示") ||
                text.includes("低温差持续性") ||
                text.includes("支路流量离散"),
              hasHydraulicFieldTargets:
                text.includes("水力现场复核对象") ||
                text.includes("闭合末端安全信号") ||
                text.includes("补支路水力历史趋势"),
              hasControlOscillationV1: text.includes("控制震荡 V1"),
              hasControlNoAutoPid: text.includes("不自动改 PID"),
              hasControlNoAutoStartStop: text.includes("不自动启停设备") || text.includes("不自动启停"),
              hasControlOscillationRiskIndicators:
                text.includes("控制风险指示") ||
                text.includes("冷冻水温差锯齿波") ||
                text.includes("冷站总功率 hunting"),
              hasControlOscillationFieldTargets:
                text.includes("控制震荡现场复核对象") ||
                text.includes("补控制命令/反馈高频趋势") ||
                text.includes("补设备启停事件"),
              hasControlLedgerImport: text.includes("台账导入") && (text.includes("台账 READY") || text.includes("台账 PARTIAL") || text.includes("未接入")),
              hasControlFieldDataPreflight:
                text.includes("现场CSV预检") &&
                (text.includes("预检 READY") || text.includes("预检 PARTIAL") || text.includes("等待 CSV") || text.includes("预检 BLOCKED")),
              hasControlFieldDataPromote:
                text.includes("正式导入Gate") &&
                (text.includes("导入 READY") || text.includes("导入 PARTIAL") || text.includes("等待预检") || text.includes("导入 BLOCKED")),
              diagnosticReadinessText:
                (() => {
                  const index = text.indexOf("数据资源与诊断可行性");
                  return index >= 0 ? text.slice(index, index + 1600) : "";
                })(),
              hasPointDictionaryCopy: text.includes("点位识别") && text.includes("站点字典已应用"),
              hasCoolingTowerGroupCopy: text.includes("冷却塔组"),
              hasCoolingTowerFanCopy: text.includes("塔风机"),
              towerSubmitVisible: Boolean(document.querySelector('[data-execution-action="submit-tower-approach"]')),
              towerSubmitDisabled: Boolean(document.querySelector('[data-execution-action="submit-tower-approach"]')?.disabled),
              towerSubmitEnabled: Boolean(
                document.querySelector('[data-execution-action="submit-tower-approach"]:not(:disabled)')
              ),
              towerSubmitLabel:
                document.querySelector('[data-execution-action="submit-tower-approach"]')?.textContent?.trim() || null,
              towerApproachReasonText:
                document
                  .querySelector('[data-execution-action="submit-tower-approach"]')
                  ?.closest(".optimize-response")
                  ?.querySelector(".optimize-response-header p")
                  ?.textContent
                  ?.trim() || null,
              hasDraftBoundaryHint:
                text.includes("不执行真实控制") ||
                text.includes("context-backed draft") ||
                text.includes("真实PLC锁定") ||
                text.includes("不新增 PLC 下发能力"),
              hasNoWhiteScreen: !!document.querySelector(".optimize-page")
            };
          })())`
        );
        const hasGeneratedAdvisorCards =
          optimizeState.schemeCardCount >= 3 ||
          (
            optimizeState.hasOperationalDiagnosticsSection &&
            optimizeState.hasBenefitSection &&
            optimizeState.responseCardCount >= 8
          );
        const hasRequiredDemoEvidence =
          optimizeState.hasChillerCurrentCombination &&
          optimizeState.hasChillerTargetCombination &&
          optimizeState.hasFieldCollectionPackageReadiness &&
          optimizeState.hasFormalCsvReadiness &&
          optimizeState.hasFormalCsvMissingDetails;
        if (hasGeneratedAdvisorCards && hasRequiredDemoEvidence) {
          break;
        }
        await sleep(1000);
      }

      const hasGeneratedAdvisorCards =
        optimizeState?.schemeCardCount >= 3 ||
        (
          optimizeState?.hasOperationalDiagnosticsSection &&
          optimizeState?.hasBenefitSection &&
          optimizeState?.responseCardCount >= 8
        );
      const hasRequiredDemoEvidence =
        optimizeState?.hasChillerCurrentCombination &&
        optimizeState?.hasChillerTargetCombination &&
        optimizeState?.hasFieldCollectionPackageReadiness &&
        optimizeState?.hasFormalCsvReadiness &&
        optimizeState?.hasFormalCsvMissingDetails;
      if (hasGeneratedAdvisorCards && hasRequiredDemoEvidence) {
        break;
      }
      if (!optimizeState?.submitDisabled || round === 2) {
        break;
      }

      await client.send("Page.navigate", { url: `${appBaseUrl}/optimize-demo` });
      await sleep(2600);
    }
    expect(!optimizeState.onLoginPage, "optimize-demo check failed because browser is on login page");
    expect(
      optimizeState.schemeCardCount === 3 ||
        (
          optimizeState.responseCardCount >= 8 &&
          optimizeState.hasOperationalDiagnosticsSection &&
          optimizeState.hasBenefitSection
        ),
      `optimize-demo should render generated advisor cards, state=${JSON.stringify(optimizeState)}`
    );
    expect(
      optimizeState.readinessCount >= 3 || optimizeState.hasHistorySection || optimizeState.hasPumpDeltaTSection,
      `optimize-demo should render readiness or advisor evidence blocks, got readiness=${optimizeState.readinessCount}, state=${JSON.stringify(optimizeState)}`
    );
    expect(optimizeState.hasHistorySection, "optimize-demo should contain history benchmark section");
    expect(optimizeState.hasChillerStagingAdvisorSection, "optimize-demo should show chiller staging optimization card");
    expect(optimizeState.hasChillerCurrentCombination, "chiller staging card should show current running combination");
    expect(optimizeState.hasChillerTargetCombination, "chiller staging card should show target combination");
    expect(optimizeState.hasChillerEmpiricalPerformance, "chiller staging copy should state empirical combination performance basis");
    expect(optimizeState.hasChillerShadowVerification, "chiller staging copy should show shadow verification");
    expect(optimizeState.hasChillerNoSingleCop, "chiller staging copy should prohibit multi-chiller single-unit COP ranking");
    expect(optimizeState.hasFieldCollectionPackageReadiness, "client demo readiness should show field collection package status");
    expect(optimizeState.hasFormalCsvReadiness, "client demo readiness should show formal CSV delivery status");
    expect(optimizeState.hasFormalCsvMissingDetails, "client demo readiness should list missing formal CSV files");
    expect(optimizeState.hasBenefitSection, "optimize-demo should contain benefit estimate section");
    expect(optimizeState.hasApproachSection, "optimize-demo should contain tower-approach pre-execution section");
    expect(optimizeState.hasOperationalDiagnosticsSection, "optimize-demo should contain operational diagnostics section");
    expect(optimizeState.hasClientDemoReadinessSection, "optimize-demo should contain client demo readiness section");
    expect(optimizeState.hasClientDemoReadinessDecision, "optimize-demo should show client demo readiness decision");
    expect(optimizeState.hasClientDemoReadinessNoMutation, "optimize-demo should show no control mutation readiness evidence");
    expect(optimizeState.hasClientDemoReadinessScope, "optimize-demo should show read-only / shadow execution scope");
    expect(optimizeState.hasDiagnosticReadinessSection, "optimize-demo should contain diagnostic readiness section");
    expect(optimizeState.hasDiagnosticReadinessCanDo, "optimize-demo should show diagnostic can-do V1 bucket");
    expect(optimizeState.hasDiagnosticReadinessDirectional, "optimize-demo should show directional diagnostic bucket");
    expect(optimizeState.hasDiagnosticReadinessPointGap, "optimize-demo should show point-gap diagnostic bucket");
    expect(optimizeState.hasDiagnosticReadinessNoFault, "optimize-demo should state that it does not diagnose equipment faults");
    expect(optimizeState.hasDiagnosticReadinessNoPlc, "optimize-demo should state that diagnostic readiness does not write PLC");
    expect(
      optimizeState.hasDiagnosticReadinessNoAutoDispatch,
      "optimize-demo diagnostic readiness copy should not imply automatic dispatch"
    );
    expect(optimizeState.hasFieldVerificationChecklist, "optimize-demo should show field verification checklist");
    expect(
      optimizeState.hasFieldVerificationReadonlyBoundary,
      "field verification checklist should stay read-only and avoid dispatch/PLC writes"
    );
    expect(optimizeState.hasFieldVerificationP0, "field verification checklist should expose P0 field tasks");
    expect(optimizeState.hasInstrumentDriftV1, "optimize-demo should show instrument drift V1 section");
    expect(
      optimizeState.hasInstrumentDriftNoAutoCorrection,
      "instrument drift V1 should state that points are not automatically corrected"
    );
    expect(
      optimizeState.hasInstrumentDriftReviewBoundary,
      "instrument drift V1 should state that it does not diagnose equipment faults"
    );
    expect(optimizeState.hasInstrumentDriftCrossChecks, "instrument drift V1 should expose cross-check evidence");
    expect(optimizeState.hasInstrumentDriftFieldTargets, "instrument drift V1 should expose field review targets");
    expect(optimizeState.hasHydraulicBalanceV1, "optimize-demo should show hydraulic balance V1 section");
    expect(optimizeState.hasHydraulicNoAutoPumpDown, "hydraulic balance V1 should state that it does not automatically reduce pump frequency");
    expect(
      optimizeState.hasHydraulicNoTerminalFault,
      "hydraulic balance V1 should state that it does not directly diagnose terminal valve faults"
    );
    expect(optimizeState.hasHydraulicRiskIndicators, "hydraulic balance V1 should expose risk indicators");
    expect(optimizeState.hasHydraulicFieldTargets, "hydraulic balance V1 should expose field review targets");
    expect(optimizeState.hasControlOscillationV1, "optimize-demo should show control oscillation V1 section");
    expect(optimizeState.hasControlNoAutoPid, "control oscillation V1 should state that it does not automatically change PID");
    expect(
      optimizeState.hasControlNoAutoStartStop,
      "control oscillation V1 should state that it does not automatically start/stop equipment"
    );
    expect(optimizeState.hasControlOscillationRiskIndicators, "control oscillation V1 should expose risk indicators");
    expect(optimizeState.hasControlOscillationFieldTargets, "control oscillation V1 should expose field review targets");
    expect(optimizeState.hasControlLedgerImport, "control oscillation V1 should expose control ledger import status");
    expect(optimizeState.hasControlFieldDataPreflight, "control oscillation V1 should expose field data preflight status");
    expect(optimizeState.hasControlFieldDataPromote, "control oscillation V1 should expose field data promote gate status");
    expect(optimizeState.hasPointDictionaryCopy, "optimize-demo should show site point dictionary evidence");
    expect(optimizeState.hasCoolingTowerGroupCopy, "optimize-demo should show cooling tower group count copy");
    expect(optimizeState.hasCoolingTowerFanCopy, "optimize-demo should show cooling tower fan count copy");
    expect(optimizeState.hasNoWhiteScreen, "optimize-demo should render root page container");

    const executionSiteId =
      optimizeState.siteIdParam || projectState.after?.siteIdParam || projectState.after?.currentProjectId || SITE_ID;
    const optimizeDraftDetails = await fetchOptimizeDraftDetails(bffBaseUrl, executionSiteId);
    const towerApproachAdvisor = optimizeDraftDetails?.towerApproachAdvisor || null;
    const chillerStagingAdvisor = optimizeDraftDetails?.chillerStagingAdvisor || null;
    const operationalDiagnosticsAdvisor = optimizeDraftDetails?.operationalDiagnosticsAdvisor || null;
    const towerApproachMinGuardrail = Array.isArray(towerApproachAdvisor?.guardrails)
      ? towerApproachAdvisor.guardrails.find((item) => item?.key === "chillerMinCondenserInletTempC") || null
      : null;
    expect(towerApproachAdvisor && typeof towerApproachAdvisor === "object", "optimize draft should include towerApproachAdvisor");
    expect(
      chillerStagingAdvisor && typeof chillerStagingAdvisor === "object",
      "optimize draft should include chillerStagingAdvisor"
    );
    expect(
      chillerStagingAdvisor?.basis === "combination_empirical_performance",
      `chillerStagingAdvisor should use empirical combination basis, got ${String(chillerStagingAdvisor?.basis)}`
    );
    expect(
      ["read_only", "shadow"].includes(chillerStagingAdvisor?.executionMode),
      `chillerStagingAdvisor should remain read_only/shadow, got ${String(chillerStagingAdvisor?.executionMode)}`
    );
    expect(
      chillerStagingAdvisor?.advisorResult?.execution?.enforcedAllowed === false,
      "chillerStagingAdvisor should prohibit enforced execution"
    );
    expect(
      !("singleChillerCop" in (chillerStagingAdvisor?.current || {})),
      "multi-chiller draft should not expose singleChillerCop"
    );
    expect(
      operationalDiagnosticsAdvisor?.summary?.pointDictionary?.applied === true,
      "optimize draft should expose applied operational point dictionary"
    );
    expect(
      Number.isFinite(operationalDiagnosticsAdvisor?.summary?.pointCoverage?.coolingTowerFanCount),
      "optimize draft should expose coolingTowerFanCount"
    );
    const diagnosticReadinessMatrix = operationalDiagnosticsAdvisor?.summary?.diagnosticReadinessMatrix || null;
    expect(
      diagnosticReadinessMatrix?.controlBoundary === "read_only_or_shadow_only",
      `optimize draft should expose read-only diagnostic readiness boundary, got ${String(diagnosticReadinessMatrix?.controlBoundary)}`
    );
    expect(
      Number(diagnosticReadinessMatrix?.readyNowCount || 0) >= 1,
      `optimize draft should expose at least one can-do diagnostic item, got ${String(diagnosticReadinessMatrix?.readyNowCount)}`
    );
    expect(
      Number(diagnosticReadinessMatrix?.directionalCount || 0) >= 1,
      `optimize draft should expose at least one directional diagnostic item, got ${String(diagnosticReadinessMatrix?.directionalCount)}`
    );
    expect(
      Number(diagnosticReadinessMatrix?.pointGapCount || 0) >= 1,
      `optimize draft should expose at least one point-gap diagnostic item, got ${String(diagnosticReadinessMatrix?.pointGapCount)}`
    );
    const fieldVerificationChecklist = operationalDiagnosticsAdvisor?.summary?.fieldVerificationChecklist || null;
    expect(
      fieldVerificationChecklist?.controlBoundary === "read_only_point_verification_only",
      `optimize draft should expose read-only field verification boundary, got ${String(fieldVerificationChecklist?.controlBoundary)}`
    );
    expect(
      Number(fieldVerificationChecklist?.p0Count || 0) >= 4,
      `optimize draft should expose P0 field verification tasks, got ${String(fieldVerificationChecklist?.p0Count)}`
    );
    const fieldCollectionPackageEvidence = operationalDiagnosticsAdvisor?.summary?.fieldCollectionPackageEvidence || null;
    expect(
      fieldCollectionPackageEvidence?.finalDecision === "FIELD_COLLECTION_PACKAGE_READY_TO_COLLECT",
      `optimize draft should expose field collection package readiness, got ${String(
        fieldCollectionPackageEvidence?.finalDecision
      )}`
    );
    expect(
      Number(fieldCollectionPackageEvidence?.formalInputCount || 0) === 4,
      `optimize draft should expose 4 formal field CSV inputs, got ${String(fieldCollectionPackageEvidence?.formalInputCount)}`
    );
    const runtimeFormalInputPaths = (Array.isArray(fieldCollectionPackageEvidence?.formalInputs)
      ? fieldCollectionPackageEvidence.formalInputs
      : [])
      .map((item) => String(item?.path || ""));
    for (const expectedPath of FIELD_COLLECTION_FORMAL_INPUT_PATHS) {
      expect(
        runtimeFormalInputPaths.includes(expectedPath),
        `optimize draft should expose formal input path: ${expectedPath}`
      );
    }
    const instrumentDiagnostic = Array.isArray(operationalDiagnosticsAdvisor?.items)
      ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "instrumentDataQuality")
      : null;
    const instrumentCurrent = instrumentDiagnostic?.current || {};
    const hydraulicDiagnostic = Array.isArray(operationalDiagnosticsAdvisor?.items)
      ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "chilledHydraulicBalance")
      : null;
    const hydraulicCurrent = hydraulicDiagnostic?.current || {};
    const controlOscillationDiagnostic = Array.isArray(operationalDiagnosticsAdvisor?.items)
      ? operationalDiagnosticsAdvisor.items.find((item) => item?.key === "controlOscillation")
      : null;
    const controlOscillationCurrent = controlOscillationDiagnostic?.current || {};
    expect(
      Array.isArray(instrumentCurrent.driftCandidates) && instrumentCurrent.driftCandidates.length >= 1,
      "optimize draft should expose instrument drift candidates"
    );
    expect(
      Array.isArray(instrumentCurrent.crossChecks) && instrumentCurrent.crossChecks.length >= 3,
      "optimize draft should expose instrument drift cross-checks"
    );
    expect(
      String(instrumentCurrent.reviewBoundary || "").includes("不自动修正测点"),
      "instrument drift boundary should prohibit automatic point correction"
    );
    expect(
      Array.isArray(hydraulicCurrent.riskIndicators) && hydraulicCurrent.riskIndicators.length >= 1,
      "optimize draft should expose hydraulic risk indicators"
    );
    expect(
      Array.isArray(hydraulicCurrent.fieldReviewTargets) && hydraulicCurrent.fieldReviewTargets.length >= 1,
      "optimize draft should expose hydraulic field review targets"
    );
    expect(
      String(hydraulicCurrent.reviewBoundary || "").includes("不自动降泵"),
      "hydraulic balance boundary should prohibit automatic pump-down"
    );
    expect(
      String(hydraulicCurrent.reviewBoundary || "").includes("不直接判定末端阀门故障"),
      "hydraulic balance boundary should prohibit direct terminal valve fault diagnosis"
    );
    expect(
      Array.isArray(controlOscillationCurrent.riskIndicators) && controlOscillationCurrent.riskIndicators.length >= 1,
      "optimize draft should expose control oscillation risk indicators"
    );
    expect(
      Array.isArray(controlOscillationCurrent.fieldReviewTargets) && controlOscillationCurrent.fieldReviewTargets.length >= 1,
      "optimize draft should expose control oscillation field review targets"
    );
    expect(
      String(controlOscillationCurrent.reviewBoundary || "").includes("不自动改 PID"),
      "control oscillation boundary should prohibit automatic PID changes"
    );
    expect(
      String(controlOscillationCurrent.reviewBoundary || "").includes("不自动启停"),
      "control oscillation boundary should prohibit automatic start/stop"
    );
    expect(
      ["ready", "partial", "waiting", "blocked", "unavailable"].includes(
        controlOscillationCurrent.ledgerEvidence?.preflight?.status || "unavailable"
      ),
      "optimize draft should expose field data preflight status"
    );
    expect(
      String(controlOscillationCurrent.ledgerEvidence?.preflight?.controlBoundary || "").includes("不写真实 PLC"),
      "field data preflight boundary should prohibit PLC mutation"
    );
    expect(
      ["ready", "partial", "waiting", "blocked", "unavailable"].includes(
        controlOscillationCurrent.ledgerEvidence?.promotion?.status || "unavailable"
      ),
      "optimize draft should expose field data promote gate status"
    );
    expect(
      String(controlOscillationCurrent.ledgerEvidence?.promotion?.controlBoundary || "").includes("不写真实 PLC"),
      "field data promote gate boundary should prohibit PLC mutation"
    );
    if (OPTIMIZE_DIAGNOSTIC_ONLY) {
      return {
        auth: authState,
        project: projectState,
        dashboard: dashboardState,
        optimizeDemo: optimizeState,
        optimizeExecution: {
          siteId: executionSiteId,
          skipped: true,
          reason: "diagnostic_readiness_only",
          noSubmitApproveDispatchRollback: true
        },
        diagnosticReadiness: {
          finalDecision: "UI_DIAGNOSTIC_READINESS_READY",
          readyNowCount: diagnosticReadinessMatrix.readyNowCount ?? null,
          directionalCount: diagnosticReadinessMatrix.directionalCount ?? null,
          pointGapCount: diagnosticReadinessMatrix.pointGapCount ?? null,
          total: diagnosticReadinessMatrix.total ?? null,
          controlBoundary: diagnosticReadinessMatrix.controlBoundary || null,
          fieldVerificationP0Count: fieldVerificationChecklist?.p0Count ?? null,
          fieldVerificationP1Count: fieldVerificationChecklist?.p1Count ?? null,
          fieldVerificationBoundary: fieldVerificationChecklist?.controlBoundary || null,
          instrumentDriftCandidateCount: Array.isArray(instrumentCurrent.driftCandidates)
            ? instrumentCurrent.driftCandidates.length
            : null,
          instrumentCrossCheckCount: Array.isArray(instrumentCurrent.crossChecks)
            ? instrumentCurrent.crossChecks.length
            : null,
          instrumentReviewBoundary: instrumentCurrent.reviewBoundary || null,
          hydraulicRiskIndicatorCount: Array.isArray(hydraulicCurrent.riskIndicators)
            ? hydraulicCurrent.riskIndicators.length
            : null,
          hydraulicFieldReviewTargetCount: Array.isArray(hydraulicCurrent.fieldReviewTargets)
            ? hydraulicCurrent.fieldReviewTargets.length
            : null,
          hydraulicReviewBoundary: hydraulicCurrent.reviewBoundary || null,
          controlOscillationRiskIndicatorCount: Array.isArray(controlOscillationCurrent.riskIndicators)
            ? controlOscillationCurrent.riskIndicators.length
            : null,
          controlOscillationFieldReviewTargetCount: Array.isArray(controlOscillationCurrent.fieldReviewTargets)
            ? controlOscillationCurrent.fieldReviewTargets.length
            : null,
          controlOscillationReviewBoundary: controlOscillationCurrent.reviewBoundary || null,
          controlFieldDataPreflightStatus: controlOscillationCurrent.ledgerEvidence?.preflight?.status || null,
          controlFieldDataPreflightMissingInputCount:
            controlOscillationCurrent.ledgerEvidence?.preflight?.missingInputCount ?? null,
          controlFieldDataPromoteStatus: controlOscillationCurrent.ledgerEvidence?.promotion?.status || null,
          controlFieldDataPromoteFormalImportReady:
            controlOscillationCurrent.ledgerEvidence?.promotion?.formalImportReady ?? null,
          textExcerpt: optimizeState.diagnosticReadinessText || null
        }
      };
    }
    expect(optimizeState.towerSubmitVisible, "optimize-demo should render tower-approach submit button");
    const executionListBefore = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
    const latestBeforeId = executionListBefore[0]?.executionId || null;

    const submitExecutionResult = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const button =
          document.querySelector('[data-execution-action="submit-scheme"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="submit-pump-delta-t"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="submit-tower-approach"]:not(:disabled)');
        if (!button) {
          return { ok: false, reason: "submit_advisor_button_missing" };
        }
        button.click();
        return {
          ok: true,
          action: button.getAttribute("data-execution-action") || null,
          schemeKey: button.getAttribute("data-scheme-key") || null
        };
      })()`,
      returnByValue: true
    });
    const submitExecutionState = submitExecutionResult?.result?.value || { ok: false, reason: "submit_scheme_eval_failed" };
    expect(
      submitExecutionState.ok,
      `optimize execution submit should click a scheme button, got ${JSON.stringify(submitExecutionState)}`
    );

    let pendingExecution = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
      const latest = executionList[0] || null;
      if (latest?.executionId && latest.executionId !== latestBeforeId && latest.status === "pending_approval") {
        pendingExecution = latest;
        break;
      }
      await sleep(800);
    }
    expect(
      pendingExecution?.status === "pending_approval",
      `optimize execution should enter pending_approval, got ${JSON.stringify(pendingExecution)}`
    );

    let executionHubState = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      executionHubState = await readExecutionHubState(client);
      if (executionHubState.pendingApproveEnabled) {
        break;
      }
      await sleep(500);
    }
    expect(executionHubState.pendingApproveEnabled, "optimize execution approve button should become enabled");

    const approveResult = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const button =
          document.querySelector('[data-execution-action="approve"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="approve-pump-delta-t"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="approve-tower-approach"]:not(:disabled)');
        if (!button) {
          return { ok: false, reason: "approve_button_missing" };
        }
        button.click();
        return {
          ok: true,
          action: button.getAttribute("data-execution-action") || null
        };
      })()`,
      returnByValue: true
    });
    const approveState = approveResult?.result?.value || { ok: false, reason: "approve_eval_failed" };
    expect(approveState.ok, `optimize execution approve should click, got ${JSON.stringify(approveState)}`);

    let approvedExecution = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
      approvedExecution =
        executionList.find((item) => item?.executionId === pendingExecution.executionId) ||
        executionList[0] ||
        null;
      if (approvedExecution?.executionId === pendingExecution.executionId && approvedExecution.status === "approved") {
        break;
      }
      await sleep(800);
    }
    expect(
      approvedExecution?.status === "approved",
      `optimize execution should become approved, got ${JSON.stringify(approvedExecution)}`
    );

    let rollbackReadyState = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      rollbackReadyState = await readExecutionHubState(client);
      if (rollbackReadyState.rollbackEnabled) {
        break;
      }
      await sleep(500);
    }
    expect(rollbackReadyState.rollbackEnabled, "optimize execution rollback button should become enabled");

    const rollbackResult = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const button =
          document.querySelector('[data-execution-action="rollback"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="rollback-pump-delta-t"]:not(:disabled)') ||
          document.querySelector('[data-execution-action="rollback-tower-approach"]:not(:disabled)');
        if (!button) {
          return { ok: false, reason: "rollback_button_missing" };
        }
        button.click();
        return {
          ok: true,
          action: button.getAttribute("data-execution-action") || null
        };
      })()`,
      returnByValue: true
    });
    const rollbackState = rollbackResult?.result?.value || { ok: false, reason: "rollback_eval_failed" };
    expect(rollbackState.ok, `optimize execution rollback should click, got ${JSON.stringify(rollbackState)}`);

    let rolledBackExecution = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
      rolledBackExecution =
        executionList.find((item) => item?.executionId === pendingExecution.executionId) ||
        executionList[0] ||
        null;
      if (rolledBackExecution?.executionId === pendingExecution.executionId && rolledBackExecution.status === "rolled_back") {
        break;
      }
      await sleep(800);
    }
    expect(
      rolledBackExecution?.status === "rolled_back",
      `optimize execution should become rolled_back, got ${JSON.stringify(rolledBackExecution)}`
    );

    let towerApproachExecution = null;
    let approvedTowerApproachExecution = null;
    let rolledBackTowerApproachExecution = null;
    let towerApproachSkipReason = null;
    let towerApproachFlow = "ui-disabled";
    let towerApproachControlsVerified = false;
    let towerApproachApproveAction = null;
    let towerApproachRollbackAction = null;
    const latestBeforeTowerId = rolledBackExecution?.executionId || approvedExecution?.executionId || pendingExecution?.executionId || latestBeforeId;
    let towerSubmitState = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      towerSubmitState = await evaluateJson(
        client,
        `JSON.stringify((() => {
          const button = document.querySelector('[data-execution-action="submit-tower-approach"]');
          if (!button) {
            return { visible: false, enabled: false, reason: "button_missing" };
          }
          if (button.disabled) {
            return { visible: true, enabled: false, reason: "button_disabled" };
          }
          return { visible: true, enabled: true, reason: null };
        })())`
      );
      if (towerSubmitState?.enabled) {
        break;
      }
      await sleep(500);
    }

    if (towerApproachAdvisor?.executionReady !== true) {
      expect(
        towerSubmitState?.visible,
        `tower-approach submit button should stay visible when executionReady=false, got ${JSON.stringify(towerSubmitState)}`
      );
      expect(
        !towerSubmitState?.enabled && optimizeState.towerSubmitDisabled,
        `tower-approach submit button should be disabled when executionReady=false, ui=${JSON.stringify({
          optimizeState,
          towerSubmitState
        })}, advisor=${JSON.stringify(towerApproachAdvisor)}`
      );
      expect(
        typeof towerApproachAdvisor?.reason === "string" && towerApproachAdvisor.reason.trim().length > 0,
        `tower-approach advisor should explain why execution is blocked, got ${JSON.stringify(towerApproachAdvisor)}`
      );
      const towerApproachReasonCandidates = [
        towerApproachAdvisor?.reason,
        ...(Array.isArray(towerApproachAdvisor?.blockers) ? towerApproachAdvisor.blockers : []),
        ...(Array.isArray(towerApproachAdvisor?.warnings) ? towerApproachAdvisor.warnings : []),
        ...(Array.isArray(towerApproachAdvisor?.guardrails)
          ? towerApproachAdvisor.guardrails.map((item) => item?.message)
          : []),
        ...(Array.isArray(towerApproachAdvisor?.inputSignals)
          ? towerApproachAdvisor.inputSignals.map((item) => item?.reason)
          : [])
      ].filter((item) => typeof item === "string" && item.trim().length > 0);
      expect(
        optimizeState.towerApproachReasonText === null ||
          towerApproachReasonCandidates.some(
            (reason) =>
              optimizeState.towerApproachReasonText.includes(reason) ||
              reason.includes(optimizeState.towerApproachReasonText)
          ),
        `tower-approach reason text should stay aligned between UI and BFF, ui=${String(
          optimizeState.towerApproachReasonText
        )}, advisor=${JSON.stringify(towerApproachReasonCandidates)}`
      );
      expect(
        towerApproachMinGuardrail && typeof towerApproachMinGuardrail === "object",
        `tower-approach advisor should include minimum condenser guardrail, got ${JSON.stringify(towerApproachAdvisor)}`
      );
      if (
        typeof towerApproachAdvisor?.targetTcwsC === "number" &&
        typeof towerApproachMinGuardrail?.value === "number" &&
        towerApproachAdvisor.targetTcwsC < towerApproachMinGuardrail.value
      ) {
        expect(
          towerApproachAdvisor.reason.includes("最低温约束"),
          `tower-approach advisor should identify min-temperature guardrail when targetTcwsC=${towerApproachAdvisor.targetTcwsC} < ${towerApproachMinGuardrail.value}, got ${String(
            towerApproachAdvisor.reason
          )}`
        );
      }
      const executionListAfterDisabledTower = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
      expect(
        (executionListAfterDisabledTower[0]?.executionId || null) === latestBeforeTowerId,
        `tower-approach should not create execution when UI is disabled, latestBefore=${String(
          latestBeforeTowerId
        )}, latestAfter=${String(executionListAfterDisabledTower[0]?.executionId || null)}`
      );
      towerApproachSkipReason = towerSubmitState?.reason || "tower_submit_unavailable";
      if (!VERIFY_TOWER_APPROACH_CONTROLS) {
        towerApproachFlow = "ui-disabled";
      } else {
        const fallbackTargetApproachC =
          typeof towerApproachAdvisor?.targetApproachC === "number" ? towerApproachAdvisor.targetApproachC : 2.0;
        const fallbackTargetTcwsC =
          typeof towerApproachAdvisor?.targetTcwsC === "number"
            ? towerApproachAdvisor.targetTcwsC
            : typeof towerApproachMinGuardrail?.value === "number"
              ? towerApproachMinGuardrail.value + 0.5
              : 30.0;
        const seedPayload = {
        draft: {
          generatedAt: optimizeDraftDetails?.generatedAt || new Date().toISOString(),
          gateLevel: optimizeDraftDetails?.gate?.level || null
        },
        execution: {
          type: "tower-approach",
          title:
            typeof towerApproachAdvisor?.targetTcwsC === "number"
              ? `冷却塔接近度执行草案（Tcws ${towerApproachAdvisor.targetTcwsC.toFixed(1)} °C）`
              : "冷却塔接近度执行草案",
          targetApproachC: fallbackTargetApproachC,
          targetTcwsC: fallbackTargetTcwsC,
          equipmentContext: {
            activeChillerIds:
              Array.isArray(towerApproachMinGuardrail?.matchedKeys) && towerApproachMinGuardrail?.resolvedBy === "by-chiller"
                ? towerApproachMinGuardrail.matchedKeys
                : [],
            activeChillerModels:
              Array.isArray(towerApproachMinGuardrail?.matchedKeys) && towerApproachMinGuardrail?.resolvedBy === "by-model"
                ? towerApproachMinGuardrail.matchedKeys
                : []
          },
          guardrailSnapshot: {
            key: towerApproachMinGuardrail?.key || "chillerMinCondenserInletTempC",
            status: towerApproachMinGuardrail?.status || "missing",
            value: towerApproachMinGuardrail?.value ?? null,
            message: towerApproachMinGuardrail?.message || "smoke seeded guardrail snapshot",
            resolvedBy: towerApproachMinGuardrail?.resolvedBy || "default",
            matchedKeys: Array.isArray(towerApproachMinGuardrail?.matchedKeys) ? towerApproachMinGuardrail.matchedKeys : []
          },
          rollbackTarget: {
            mode: "manual",
            targetTcwsC: towerApproachAdvisor?.currentTcwsC ?? null,
            targetApproachC: towerApproachAdvisor?.currentApproachC ?? null,
            reason: "回退到提交前现态"
          },
          reason: towerApproachAdvisor?.reason || "tower-approach smoke seeded execution",
          actions: [
            typeof towerApproachAdvisor?.targetApproachC === "number"
              ? `目标接近度 ${towerApproachAdvisor.targetApproachC.toFixed(1)} °C`
              : "目标接近度待确认",
            typeof towerApproachAdvisor?.targetTcwsC === "number"
              ? `目标冷却供水温 ${towerApproachAdvisor.targetTcwsC.toFixed(1)} °C`
              : "目标冷却供水温待确认"
          ]
        },
        approval: {
          required: true
        }
        };

        const seedResult = await createTowerApproachExecutionForSmoke(bffBaseUrl, executionSiteId, seedPayload);
        const seedCode = String(seedResult?.payload?.code || "");
        if (seedResult.status === 403 && seedCode === "READ_ONLY_MODE") {
          expect(
            !REQUIRE_TOWER_APPROACH_CONTROLS,
            "tower-approach dedicated controls are required, but smoke seed was blocked by READ_ONLY_MODE"
          );
          towerApproachFlow = "ui-disabled-read-only";
          towerApproachSkipReason = "seed_blocked_read_only_mode";
        } else {
          expect(
            seedResult.status === 201 && seedResult.payload?.ok === true,
            `tower-approach smoke seed should return 201/ok=true, got ${seedResult.status} ${JSON.stringify(seedResult.payload)}`
          );
          const seededTowerApproachExecution = seedResult.payload?.execution || null;
          expect(
            seededTowerApproachExecution?.executionId,
            `tower-approach smoke seed should return executionId, got ${JSON.stringify(seededTowerApproachExecution)}`
          );
          towerApproachExecution = seededTowerApproachExecution;
          towerApproachFlow = "seeded-dedicated-controls";
          towerApproachControlsVerified = true;
          assertTowerApproachExecutionRecord(towerApproachExecution);

          await client.send("Runtime.evaluate", {
            expression: `(() => {
              const button = document.querySelector('[data-execution-action="refresh"]:not(:disabled)');
              if (button) {
                button.click();
                return { ok: true };
              }
              return { ok: false, reason: "refresh_button_missing" };
            })()`,
            returnByValue: true
          });
          await sleep(1000);

          let towerApproveReadyState = null;
          for (let attempt = 0; attempt < 12; attempt += 1) {
            towerApproveReadyState = await readExecutionHubState(client);
            if (towerApproveReadyState.pendingTowerApproachApproveEnabled) {
              break;
            }
            await sleep(500);
          }
          expect(
            towerApproveReadyState.pendingTowerApproachApproveEnabled,
            "seeded tower-approach approve button should become enabled"
          );

          const towerApproveResult = await client.send("Runtime.evaluate", {
            expression: `(() => {
              const button = document.querySelector('[data-execution-action="approve-tower-approach"]:not(:disabled)');
              if (!button) {
                return { ok: false, reason: "tower_approve_button_missing" };
              }
              button.click();
              return {
                ok: true,
                action: button.getAttribute("data-execution-action") || null
              };
            })()`,
            returnByValue: true
          });
          const towerApproveState =
            towerApproveResult?.result?.value || { ok: false, reason: "tower_approve_eval_failed" };
          expect(
            towerApproveState.ok,
            `seeded tower-approach approve should click, got ${JSON.stringify(towerApproveState)}`
          );
          towerApproachApproveAction = towerApproveState.action || null;

          for (let attempt = 0; attempt < 20; attempt += 1) {
            const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
            approvedTowerApproachExecution =
              executionList.find((item) => item?.executionId === towerApproachExecution.executionId) || executionList[0] || null;
            if (
              approvedTowerApproachExecution?.executionId === towerApproachExecution.executionId &&
              approvedTowerApproachExecution.status === "approved"
            ) {
              break;
            }
            await sleep(800);
          }
          expect(
            approvedTowerApproachExecution?.status === "approved",
            `seeded tower-approach execution should become approved, got ${JSON.stringify(approvedTowerApproachExecution)}`
          );
          assertTowerApproachExecutionRecord(approvedTowerApproachExecution);

          let towerRollbackReadyState = null;
          for (let attempt = 0; attempt < 12; attempt += 1) {
            towerRollbackReadyState = await readExecutionHubState(client);
            if (towerRollbackReadyState.towerApproachRollbackEnabled) {
              break;
            }
            await sleep(500);
          }
          expect(
            towerRollbackReadyState.towerApproachRollbackEnabled,
            "seeded tower-approach rollback button should become enabled"
          );

          const towerRollbackResult = await client.send("Runtime.evaluate", {
            expression: `(() => {
              const button = document.querySelector('[data-execution-action="rollback-tower-approach"]:not(:disabled)');
              if (!button) {
                return { ok: false, reason: "tower_rollback_button_missing" };
              }
              button.click();
              return {
                ok: true,
                action: button.getAttribute("data-execution-action") || null
              };
            })()`,
            returnByValue: true
          });
          const towerRollbackState =
            towerRollbackResult?.result?.value || { ok: false, reason: "tower_rollback_eval_failed" };
          expect(
            towerRollbackState.ok,
            `seeded tower-approach rollback should click, got ${JSON.stringify(towerRollbackState)}`
          );
          towerApproachRollbackAction = towerRollbackState.action || null;

          for (let attempt = 0; attempt < 20; attempt += 1) {
            const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
            rolledBackTowerApproachExecution =
              executionList.find((item) => item?.executionId === towerApproachExecution.executionId) || executionList[0] || null;
            if (
              rolledBackTowerApproachExecution?.executionId === towerApproachExecution.executionId &&
              rolledBackTowerApproachExecution.status === "rolled_back"
            ) {
              break;
            }
            await sleep(800);
          }
          expect(
            rolledBackTowerApproachExecution?.status === "rolled_back",
            `seeded tower-approach execution should become rolled_back, got ${JSON.stringify(rolledBackTowerApproachExecution)}`
          );
          assertTowerApproachExecutionRecord(rolledBackTowerApproachExecution);
        }
      }
    } else {
      towerApproachFlow = "submitted";
      towerApproachControlsVerified = true;
      expect(
        towerSubmitState?.enabled,
        `tower-approach executionReady=true should expose enabled submit button, ui=${JSON.stringify({
          optimizeState,
          towerSubmitState
        })}, advisor=${JSON.stringify(towerApproachAdvisor)}`
      );
      const submitTowerExecutionResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const button = document.querySelector('[data-execution-action="submit-tower-approach"]:not(:disabled)');
          if (!button) {
            return { ok: false, reason: "submit_tower_button_missing" };
          }
          button.click();
          return { ok: true };
        })()`,
        returnByValue: true
      });
      const submitTowerExecutionState =
        submitTowerExecutionResult?.result?.value || { ok: false, reason: "submit_tower_eval_failed" };
      expect(
        submitTowerExecutionState.ok,
        `tower-approach execution submit should click, got ${JSON.stringify(submitTowerExecutionState)}`
      );

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
        const latest = executionList[0] || null;
        if (
          latest?.executionId &&
          latest.executionId !== latestBeforeTowerId &&
          latest.status === "pending_approval" &&
          latest.execution?.type === "tower-approach"
        ) {
          towerApproachExecution = latest;
          break;
        }
        await sleep(800);
      }
      expect(
        towerApproachExecution?.status === "pending_approval",
        `tower-approach execution should enter pending_approval, got ${JSON.stringify(towerApproachExecution)}`
      );
      assertTowerApproachExecutionRecord(towerApproachExecution);

      let towerApproveReadyState = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        towerApproveReadyState = await readExecutionHubState(client);
        if (towerApproveReadyState.pendingTowerApproachApproveEnabled || towerApproveReadyState.pendingApproveEnabled) {
          break;
        }
        await sleep(500);
      }
      expect(
        towerApproveReadyState.pendingTowerApproachApproveEnabled || towerApproveReadyState.pendingApproveEnabled,
        "tower-approach approve button should become enabled"
      );

      const towerApproveResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const button =
            document.querySelector('[data-execution-action="approve-tower-approach"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="approve"]:not(:disabled)');
          if (!button) {
            return { ok: false, reason: "tower_approve_button_missing" };
          }
          button.click();
          return {
            ok: true,
            action: button.getAttribute("data-execution-action") || null
          };
        })()`,
        returnByValue: true
      });
      const towerApproveState =
        towerApproveResult?.result?.value || { ok: false, reason: "tower_approve_eval_failed" };
      expect(towerApproveState.ok, `tower-approach approve should click, got ${JSON.stringify(towerApproveState)}`);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
        approvedTowerApproachExecution =
          executionList.find((item) => item?.executionId === towerApproachExecution.executionId) || executionList[0] || null;
        if (
          approvedTowerApproachExecution?.executionId === towerApproachExecution.executionId &&
          approvedTowerApproachExecution.status === "approved"
        ) {
          break;
        }
        await sleep(800);
      }
      expect(
        approvedTowerApproachExecution?.status === "approved",
        `tower-approach execution should become approved, got ${JSON.stringify(approvedTowerApproachExecution)}`
      );
      assertTowerApproachExecutionRecord(approvedTowerApproachExecution);

      let towerRollbackReadyState = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        towerRollbackReadyState = await readExecutionHubState(client);
        if (towerRollbackReadyState.towerApproachRollbackEnabled || towerRollbackReadyState.rollbackEnabled) {
          break;
        }
        await sleep(500);
      }
      expect(
        towerRollbackReadyState.towerApproachRollbackEnabled || towerRollbackReadyState.rollbackEnabled,
        "tower-approach rollback button should become enabled"
      );

      const towerRollbackResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const button =
            document.querySelector('[data-execution-action="rollback-tower-approach"]:not(:disabled)') ||
            document.querySelector('[data-execution-action="rollback"]:not(:disabled)');
          if (!button) {
            return { ok: false, reason: "tower_rollback_button_missing" };
          }
          button.click();
          return {
            ok: true,
            action: button.getAttribute("data-execution-action") || null
          };
        })()`,
        returnByValue: true
      });
      const towerRollbackState =
        towerRollbackResult?.result?.value || { ok: false, reason: "tower_rollback_eval_failed" };
      expect(towerRollbackState.ok, `tower-approach rollback should click, got ${JSON.stringify(towerRollbackState)}`);

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const executionList = await fetchOptimizeExecutionList(bffBaseUrl, executionSiteId);
        rolledBackTowerApproachExecution =
          executionList.find((item) => item?.executionId === towerApproachExecution.executionId) || executionList[0] || null;
        if (
          rolledBackTowerApproachExecution?.executionId === towerApproachExecution.executionId &&
          rolledBackTowerApproachExecution.status === "rolled_back"
        ) {
          break;
        }
        await sleep(800);
      }
      expect(
        rolledBackTowerApproachExecution?.status === "rolled_back",
        `tower-approach execution should become rolled_back, got ${JSON.stringify(rolledBackTowerApproachExecution)}`
      );
      assertTowerApproachExecutionRecord(rolledBackTowerApproachExecution);
    }

    const finalExecutionHubState = await readExecutionHubState(client);
    expect(finalExecutionHubState.hasHistory, "optimize execution history should render after submit/approve/rollback");

    await client.send("Page.navigate", { url: `${appBaseUrl}/trend-analysis?metric=currentCop&range=7d` });
    await sleep(2600);

    const trendValidState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const params = new URLSearchParams(location.search);
        const activeRangeButton = document.querySelector(".trend-range-switch button.is-active");
        const activeMetricButton = document.querySelector(".trend-metric-filter-row button.is-active");
        return {
          url: location.href,
          onLoginPage: location.pathname === "/login",
          hasTrendHeader: (document.body?.innerText || "").includes("趋势"),
          metricParam: params.get("metric"),
          rangeParam: params.get("range"),
          activeRangeLabel: activeRangeButton ? activeRangeButton.textContent?.trim() : null,
          activeMetricLabel: activeMetricButton ? activeMetricButton.textContent?.trim() : null
        };
      })())`
    );
    expect(!trendValidState.onLoginPage, "trend-analysis valid-url check failed because browser is on login page");
    expect(trendValidState.hasTrendHeader, "trend-analysis valid-url should render trend page header");
    expect(
      trendValidState.metricParam === "currentCop",
      `trend-analysis valid-url should keep metric=currentCop, got ${String(trendValidState.metricParam)}`
    );
    expect(
      trendValidState.rangeParam === "7d",
      `trend-analysis valid-url should keep range=7d, got ${String(trendValidState.rangeParam)}`
    );

    await client.send("Page.navigate", { url: `${appBaseUrl}/trend-analysis?metric=invalidMetric&range=invalidRange` });
    await sleep(2600);

    const trendFallbackState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const params = new URLSearchParams(location.search);
        const rangeParam = params.get("range");
        const metricParam = params.get("metric");
        const validRanges = ["24h", "7d", "30d"];
        const validMetrics = ["totalPowerKw", "currentCop", "chilledDeltaT", "coolingDeltaT"];
        return {
          url: location.href,
          onLoginPage: location.pathname === "/login",
          rangeParam,
          metricParam,
          rangeRecovered: validRanges.includes(String(rangeParam || "")),
          metricRecovered: metricParam === null || validMetrics.includes(String(metricParam))
        };
      })())`
    );
    expect(!trendFallbackState.onLoginPage, "trend-analysis fallback check failed because browser is on login page");
    expect(
      trendFallbackState.rangeRecovered,
      `trend-analysis invalid range should recover to a valid value, got ${String(trendFallbackState.rangeParam)}`
    );
    expect(
      trendFallbackState.metricRecovered,
      `trend-analysis invalid metric should recover to valid/empty value, got ${String(trendFallbackState.metricParam)}`
    );

    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const rangeButton = Array.from(document.querySelectorAll(".trend-range-switch button, button"))
          .find((button) => (button.textContent || "").includes("30"));
        if (rangeButton) {
          rangeButton.click();
        }
        const metricButton = Array.from(document.querySelectorAll(".trend-metric-filter-row button, button"))
          .find((button) => {
            const text = (button.textContent || "").trim();
            return text === "冷站 COP" || text === "当前COP" || text === "COP" || text.includes("冷站 COP");
          });
        if (metricButton) {
          metricButton.click();
        }
      })()`,
      returnByValue: true
    });
    await sleep(1800);

    const trendInteractionState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const params = new URLSearchParams(location.search);
        return {
          url: location.href,
          rangeParam: params.get("range"),
          metricParam: params.get("metric")
        };
      })())`
    );
    expect(
      trendInteractionState.rangeParam === "30d",
      `trend-analysis interaction should sync range=30d, got ${String(trendInteractionState.rangeParam)}`
    );
    expect(
      trendInteractionState.metricParam === "currentCop",
      `trend-analysis interaction should sync metric=currentCop, got ${String(trendInteractionState.metricParam)}`
    );

    return {
      auth: authState,
      project: projectState,
      dashboard: dashboardState,
      optimizeDemo: optimizeState,
      optimizeExecution: {
        siteId: executionSiteId,
        submittedSchemeKey: submitExecutionState.schemeKey || null,
        pendingExecutionId: pendingExecution?.executionId || null,
        approvedStatus: approvedExecution?.status || null,
        rolledBackStatus: rolledBackExecution?.status || null,
        towerApproachExecutionId: towerApproachExecution?.executionId || null,
        towerApproachApprovedStatus: approvedTowerApproachExecution?.status || null,
        towerApproachRolledBackStatus: rolledBackTowerApproachExecution?.status || null,
        towerApproachFlow,
        towerApproachControlsVerified,
        towerApproachSkipReason,
        towerApproachApproveAction,
        towerApproachRollbackAction,
        verifyTowerApproachControls: VERIFY_TOWER_APPROACH_CONTROLS,
        requireTowerApproachControls: REQUIRE_TOWER_APPROACH_CONTROLS,
        towerApproachExecutionReady: towerApproachAdvisor?.executionReady === true,
        towerApproachStatus: towerApproachAdvisor?.status || null,
        towerApproachReason: towerApproachAdvisor?.reason || null,
        towerApproachTargetTcwsC: towerApproachAdvisor?.targetTcwsC ?? null,
        towerApproachMinCondenserInletTempC: towerApproachMinGuardrail?.value ?? null,
        towerApproachGuardrailResolvedBy:
          rolledBackTowerApproachExecution?.execution?.guardrailSnapshot?.resolvedBy ||
          towerApproachMinGuardrail?.resolvedBy ||
          null,
        finalHub: finalExecutionHubState
      },
      trendAnalysis: {
        validUrl: trendValidState,
        invalidUrlFallback: trendFallbackState,
        interactionSync: trendInteractionState
      }
    };
  } finally {
    client.close();
  }
}

function writeOutputIfNeeded(payload) {
  if (!OUTPUT_PATH) {
    return;
  }
  const absolute = path.resolve(OUTPUT_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(payload, null, 2));
}

async function main() {
  const bffBaseUrl = await resolveReachableBffBaseUrl();
  const appBaseUrl = await resolveReachableAppBaseUrl();
  const output = {
    checkedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl,
    appBaseUrl,
    cdpListUrl: CDP_LIST_URL,
    api: null,
    ui: null
  };

  output.api = await runApiChecks(bffBaseUrl);
  output.ui = await runUiChecks(bffBaseUrl, appBaseUrl);
  writeOutputIfNeeded(output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`b25 ui smoke failed: ${message}\n`);
  process.exit(1);
});
