import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

const BFF_BASE_URL = process.env.BFF_BASE_URL || "http://127.0.0.1:8787";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3006";
const CDP_LIST_URL = process.env.CDP_LIST_URL || "http://127.0.0.1:61392/json/list";
const SITE_ID = process.env.SITE_ID || "btwentyfive";
const REQUEST_PAYLOAD = {
  inputs: {
    loadKw: 1200,
    outdoorTempC: 27.6,
    mode: "cooling"
  }
};
const OUTPUT_PATH = process.env.B25_SMOKE_OUTPUT_PATH || "";

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
    req.setTimeout(15_000, () => {
      req.destroy(new Error("request timeout after 15s"));
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

async function runApiChecks() {
  const overviewWithSiteKey = await requestJson(
    `${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/dashboard/overview`,
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

  const optimize = await requestJson(`${BFF_BASE_URL}/bff/v1/sites/${SITE_ID}/optimize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chiller-project-key": SITE_ID
    },
    body: JSON.stringify(REQUEST_PAYLOAD)
  });
  expect(optimize.status === 501, `optimize should return 501, got ${optimize.status}`);
  expect(optimize.payload?.details, "optimize response should include details");
  expect(
    optimize.payload?.code === "NOT_IMPLEMENTED",
    `optimize code should be NOT_IMPLEMENTED, got ${String(optimize.payload?.code)}`
  );
  expect(
    Array.isArray(optimize.payload?.details?.schemes) && optimize.payload.details.schemes.length === 3,
    "optimize details should contain 3 schemes"
  );

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
        : 0
    }
  };
}

async function pickCdpTarget() {
  const { payload } = await requestJson(CDP_LIST_URL);
  const targets = Array.isArray(payload) ? payload : [];
  const appOrigin = new URL(APP_BASE_URL).origin;
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

async function runUiChecks() {
  const target = await pickCdpTarget();
  const client = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    await client.send("Page.navigate", { url: `${APP_BASE_URL}/dashboard` });
    await sleep(3500);

    const dashboardState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const text = document.body?.innerText || "";
        const cardValues = Array.from(document.querySelectorAll(".dashboard-ops-card strong, .dashboard-ops-card .stat-value, .dashboard-card-value"))
          .map((node) => (node.textContent || "").trim())
          .filter(Boolean);
        const dashOnlyCount = cardValues.filter((value) => value.includes("--")).length;
        const sourceBanner = document.body?.innerText?.includes("快照回退") || document.body?.innerText?.includes("最近可用快照");
        return {
          url: location.href,
          onLoginPage: location.pathname === "/login",
          hasOpsBoard: text.includes("值班判断板"),
          hasEfficiencyBlock: text.includes("1. 效率表现"),
          hasSourceObservableField: text.includes("首页数据来源"),
          cardCount: cardValues.length,
          allDash: cardValues.length > 0 ? dashOnlyCount === cardValues.length : false,
          sampleValues: cardValues.slice(0, 12),
          hasSnapshotHint: sourceBanner
        };
      })())`
    );
    expect(!dashboardState.onLoginPage, "dashboard check failed because browser is on login page");
    expect(dashboardState.hasOpsBoard, "dashboard should render ops board");
    expect(dashboardState.hasEfficiencyBlock, "dashboard should render efficiency section");
    expect(dashboardState.hasSourceObservableField, "dashboard should render source observable field");
    expect(!dashboardState.allDash, "dashboard cards should not all be '--'");

    await client.send("Page.navigate", { url: `${APP_BASE_URL}/optimize-demo` });
    await sleep(2500);

    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const numberInputs = Array.from(document.querySelectorAll('input[type="number"]'));
        if (numberInputs[0]) numberInputs[0].value = "1200";
        if (numberInputs[1]) numberInputs[1].value = "27.6";
        for (const input of numberInputs) {
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) submitButton.click();
      })()`,
      returnByValue: true
    });
    await sleep(2800);

    const optimizeState = await evaluateJson(
      client,
      `JSON.stringify((() => {
        const text = document.body?.innerText || "";
        return {
          url: location.href,
          onLoginPage: location.pathname === "/login",
          schemeCardCount: document.querySelectorAll(".optimize-scheme-card").length,
          readinessCount: document.querySelectorAll(".optimize-readiness").length,
          hasHistorySection: text.includes("历史对标"),
          hasBenefitSection: text.includes("草案收益"),
          hasDraftBoundaryHint: text.includes("不执行真实控制") || text.includes("context-backed draft"),
          hasNoWhiteScreen: !!document.querySelector(".optimize-page")
        };
      })())`
    );
    expect(!optimizeState.onLoginPage, "optimize-demo check failed because browser is on login page");
    expect(optimizeState.schemeCardCount === 3, `optimize-demo should render 3 schemes, got ${optimizeState.schemeCardCount}`);
    expect(optimizeState.readinessCount >= 3, `optimize-demo should render scheme readiness blocks, got ${optimizeState.readinessCount}`);
    expect(optimizeState.hasHistorySection, "optimize-demo should contain history benchmark section");
    expect(optimizeState.hasBenefitSection, "optimize-demo should contain benefit estimate section");
    expect(optimizeState.hasNoWhiteScreen, "optimize-demo should render root page container");

    return {
      dashboard: dashboardState,
      optimizeDemo: optimizeState
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
  const output = {
    checkedAt: new Date().toISOString(),
    siteId: SITE_ID,
    bffBaseUrl: BFF_BASE_URL,
    appBaseUrl: APP_BASE_URL,
    cdpListUrl: CDP_LIST_URL,
    api: null,
    ui: null
  };

  output.api = await runApiChecks();
  output.ui = await runUiChecks();
  writeOutputIfNeeded(output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`b25 ui smoke failed: ${message}\n`);
  process.exit(1);
});
