import assert from "node:assert/strict";
import test from "node:test";

import { getOperationRecords } from "./operationRecordService.js";

function buildRuntimeConfig(adminStore) {
  return {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    staleThresholdHours: 6,
    adminStore,
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive"
    }
  };
}

function buildExecutionList() {
  return {
    total: 3,
    items: [
      {
        executionId: "opx-1",
        siteId: "btwentyfive",
        createdAt: "2026-04-08T13:53:43.051Z",
        updatedAt: "2026-04-08T13:53:45.312Z",
        status: "rolled_back",
        execution: {
          type: "tower-approach",
          title: "冷却塔接近度执行草案",
          reason: "冷却塔接近度关键信号不足"
        },
        approval: {
          approverUserId: "admin"
        },
        rollback: {
          reason: "人工回退到保守运行"
        },
        approvedBy: "admin",
        rolledBackBy: "admin",
        approvedAt: "2026-04-08T13:53:44.536Z",
        rolledBackAt: "2026-04-08T13:53:45.312Z",
        timeline: [
          {
            at: "2026-04-08T13:53:45.312Z",
            actorUserId: "admin",
            action: "rolled_back",
            note: "人工回退到保守运行"
          }
        ]
      },
      {
        executionId: "opx-2",
        siteId: "btwentyfive",
        createdAt: "2026-04-08T13:53:36.150Z",
        updatedAt: "2026-04-08T13:53:37.060Z",
        status: "approved",
        execution: {
          type: "scheme",
          title: "保守方案",
          reason: "先稳住风险"
        },
        approval: {
          approverUserId: "admin",
          note: "值班审批通过"
        },
        approvedBy: "admin",
        approvedAt: "2026-04-08T13:53:37.060Z",
        timeline: [
          {
            at: "2026-04-08T13:53:37.060Z",
            actorUserId: "admin",
            action: "approved",
            note: "值班审批通过"
          }
        ]
      },
      {
        executionId: "opx-old",
        siteId: "btwentyfive",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:05:00.000Z",
        status: "approved",
        execution: {
          type: "scheme",
          title: "旧执行"
        },
        approval: {
          approverUserId: "admin"
        },
        approvedBy: "admin",
        approvedAt: "2026-04-01T10:05:00.000Z",
        timeline: []
      }
    ]
  };
}

test("getOperationRecords falls back to optimize execution history for unscoped B25 queries", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/runrecords/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response("Internal Server Error", {
      status: 500,
      headers: {
        "content-type": "text/plain"
      }
    });
  };

  try {
    const result = await getOperationRecords(
      buildRuntimeConfig({
        listOptimizeExecutions() {
          return buildExecutionList();
        }
      }),
      "btwentyfive",
      {
        startDate: "2026-04-05",
        endDate: "2026-04-11",
        page: 1,
        pageSize: 10,
        drTypeId: "0",
        drId: "0"
      }
    );

    assert.ok(
      requests.some((item) => item.includes("/zsqy/runrecords/140btwentyfive/findAll")),
      "expected legacy runrecords request first"
    );
    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, "opx-1");
    assert.equal(result.items[0].operationResult, "已回退");
    assert.equal(result.items[0].operationPerson, "admin");
    assert.match(result.items[0].details, /冷却塔接近度执行草案/);
    assert.equal(result.sourceStatus.overall, "partial");
    assert.equal(result.sourceStatus.sources?.[0]?.ok, false);
    assert.equal(result.sourceStatus.sources?.[1]?.originLabel, "治理态执行记录");
    assert.equal(result.sourceStatus.sources?.[1]?.interfaceKind, "optimize-execution-history");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getOperationRecords keeps scoped B25 queries failed when only site-level execution history is available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (!target.includes("/zsqy/runrecords/140btwentyfive/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    return new Response("Internal Server Error", {
      status: 500,
      headers: {
        "content-type": "text/plain"
      }
    });
  };

  try {
    const result = await getOperationRecords(
      buildRuntimeConfig({
        listOptimizeExecutions() {
          return buildExecutionList();
        }
      }),
      "btwentyfive",
      {
        startDate: "2026-04-05",
        endDate: "2026-04-11",
        page: 1,
        pageSize: 10,
        drTypeId: "75",
        drId: "7"
      }
    );

    assert.equal(result.total, 0);
    assert.equal(result.items.length, 0);
    assert.equal(result.sourceStatus.overall, "failed");
    assert.equal(result.sourceStatus.sources?.length, 1);
    assert.equal(result.sourceStatus.sources?.[0]?.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
