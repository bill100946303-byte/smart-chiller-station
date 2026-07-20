import assert from "node:assert/strict";
import test from "node:test";

import { getWorkOrderAssignees, getWorkOrders } from "./workOrderService.js";

function buildRuntimeConfig() {
  return {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    staleThresholdHours: 6,
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive"
    }
  };
}

test("getWorkOrders remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/qsworkorder/140btwentyfive/findObject")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: {
        currentPage: 1,
        pageSize: 10,
        rowCount: 0,
        pageCount: 1,
        records: []
      }
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getWorkOrders(buildRuntimeConfig(), "btwentyfive", { page: 1, pageSize: 10 });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/qsworkorder/140btwentyfive/findObject")),
      "expected work-order list request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.total, 0);
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getWorkOrders prefers request databaseKey over request projectKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/qsworkorder/117cseven/findObject")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: {
        currentPage: 1,
        pageSize: 10,
        rowCount: 0,
        pageCount: 1,
        records: []
      }
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getWorkOrders({
      ...buildRuntimeConfig(),
      siteSourceConfig: {
        ...buildRuntimeConfig().siteSourceConfig,
        databaseKey: "117legacy"
      }
    }, "117", {
      page: 1,
      pageSize: 10,
      databaseKey: "117cseven",
      projectKey: "117cseven-1"
    });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/qsworkorder/117cseven/findObject")),
      "expected work-order list request to prefer request databaseKey"
    );
    assert.equal(result.site.siteId, "117");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getWorkOrderAssignees remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/appuser/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: [
        {
          userid: "315",
          username: "B25"
        }
      ]
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await getWorkOrderAssignees(buildRuntimeConfig(), "btwentyfive");

    assert.ok(
      requests.some((item) => item.includes("/zsqy/appuser/140btwentyfive/findAll")),
      "expected work-order assignee request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].username, "B25");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
