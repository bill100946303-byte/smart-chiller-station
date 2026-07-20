import assert from "node:assert/strict";
import test from "node:test";

import { getKnowledgeDeviceTypes, getKnowledgeDocuments } from "./knowledgeService.js";

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

test("getKnowledgeDocuments remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/instructions/140btwentyfive/findObject")) {
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
    const result = await getKnowledgeDocuments(buildRuntimeConfig(), "btwentyfive", { page: 1, pageSize: 10 });

    assert.ok(
      requests.some((item) => item.includes("/zsqy/instructions/140btwentyfive/findObject")),
      "expected knowledge document request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.total, 0);
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getKnowledgeDeviceTypes remaps B25 siteId to runtime databaseKey", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/Drtypeinfo/140btwentyfive/findObject")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response(JSON.stringify({
      status: "20000",
      msg: "OK",
      ok: true,
      data: [
        {
          drtypeid: "72",
          drtypename: "智能楼宇系统"
        },
        {
          drtypeid: "167",
          drtypename: "电量记录"
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
    const result = await getKnowledgeDeviceTypes(buildRuntimeConfig(), "btwentyfive");

    assert.ok(
      requests.some((item) => item.includes("/zsqy/Drtypeinfo/140btwentyfive/findObject")),
      "expected knowledge device-type request to normalize B25 siteId to runtime databaseKey"
    );
    assert.equal(result.site.siteId, "btwentyfive");
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].label, "智能楼宇系统");
    assert.equal(result.sourceStatus.overall, "ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
