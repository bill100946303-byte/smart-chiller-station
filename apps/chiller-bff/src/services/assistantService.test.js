import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssistantQueryResponse,
  buildDeviceAnswer,
  buildRecommendationAnswer,
  buildReliabilityAnswer,
  buildStrategyAnswer,
  buildStatusAnswer,
  classifyAssistantQuery,
  validateAssistantQueryRequest
} from "./assistantService.js";

const sampleOverview = {
  energyCards: {
    totalPowerKw: null,
    currentCop: null,
    chilledDeltaT: 2.2,
    coolingDeltaT: null
  },
  deviceSummary: {
    totalDevices: 6,
    chillerCount: 1,
    chilledPumpCount: 2,
    coolingPumpCount: 2,
    coolingTowerCount: 1
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "overview", ok: true }]
  }
};

const sampleAnomalies = {
  counts: {
    total: 2,
    critical: 1,
    major: 1,
    minor: 0
  },
  latestEvents: [
    {
      title: "冷却泵异常",
      severity: "major",
      occurredAt: "2026-03-31T10:00:00.000Z",
      source: "冷却泵A"
    }
  ],
  diagnosisFlags: {
    staleAlarmFeed: false
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "anomalies", ok: true }]
  }
};

const sampleRecommendations = {
  summary: {
    total: 1,
    highRisk: 1,
    criticalSeverity: 0
  },
  cards: [
    {
      title: "检查冷却泵",
      priority: "high",
      risk: "high",
      severity: "major",
      reason: "冷却泵频率偏高且效果一般",
      actions: ["先检查冷却泵频率", "再核对冷却水温差"],
      evidence: ["冷却泵频率高", "冷却水温差偏低"]
    }
  ],
  ruleEvaluation: {
    matchedRuleIds: ["rule.cooling-pump"],
    skippedRuleIds: []
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "recommendations", ok: true }]
  }
};

const sampleDeviceList = {
  total: 6,
  items: [
    { status: "online", deviceTypeName: "冷水机组" },
    { status: "online", deviceTypeName: "冷冻水泵" },
    { status: "offline", deviceTypeName: "冷却水泵" },
    { status: "unknown", deviceTypeName: "冷却塔" }
  ],
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "devices", ok: true }]
  }
};

const sampleDigest = {
  summary: {
    stage: "await-approval",
    label: "待审批",
    headline: "当前已有待审批治理动作",
    summary: "先处理审批，再推进下一轮优化。",
    tone: "caution",
    confidence: "medium"
  },
  nextAction: {
    label: "先处理待审批治理动作",
    summary: "当前已有 1 条待审批治理动作，应先处理审批结果。",
    endpoint: "/bff/v1/sites/demo-site/optimize/executions"
  },
  blockers: [
    {
      domain: "governance",
      level: "blocked",
      message: "当前已有 1 条待审批治理动作，应先处理审批结果。"
    }
  ],
  risks: [
    {
      domain: "operations",
      level: "caution",
      message: "当前仍有 2 条活动告警，建议带着观察边界推进。"
    }
  ],
  signals: [
    "当前首要建议：检查冷却泵频率。",
    "当前 AI 参考数据最新时间为 2026-04-13T10:00:00.000Z。"
  ],
  freshness: {
    label: "fresh",
    latestTimestamp: "2026-04-13T10:00:00.000Z",
    stale: false
  },
  sourceStatus: {
    overall: "ok",
    sources: [{ key: "dashboardOverview", ok: true }]
  }
};

const staleFreshness = {
  label: "stale",
  latestTimestamp: "2026-03-31T10:00:00.000Z",
  stale: true
};

const config = {
  fieldDictionaryFile: "",
  legacyBaseUrl: "http://127.0.0.1:8098",
  staleThresholdHours: 6
};

function mockLegacyFetch(originalFetch) {
  const legacyBaseUrl = "http://127.0.0.1:8098/";

  return async (url, init) => {
    const target = String(url);

    if (!target.startsWith(legacyBaseUrl)) {
      return originalFetch(url, init);
    }

    if (target.endsWith("/140/getAllSubsystemInfo")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/qsAlarmlog/140/findNewAlarmLog")) {
      return new Response(
        JSON.stringify({
          ok: true,
          msg: "OK",
          data: []
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/drinfo/140/findObject?pageCurrent=1&pageSize=200")) {
      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            data: []
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/140/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-13 09:00:00",
            totalPower: 228.4,
            coldStationCop: 4.6,
            chilledWaterTemperatureDifference: 4.1,
            chilledOutWaterTemperatureDifference: 4.8,
            totalCoolingCapacity: 1056.2,
            chillerPower: 153.8,
            chilledPumpPower: 24.3,
            coolingPumpPower: 19.1,
            coolingTowerPower: 31.2,
            thermalUnbalanceRate: 0.12
          }
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/140/getEnergyStatisticsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/zsqy/homepage/140/getRunParamsCurve")) {
      return new Response(
        JSON.stringify([
          {
            title: "总功率",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 228.4 }]
            }
          },
          {
            title: "冷站COP",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.6 }]
            }
          },
          {
            title: "冷冻水温差",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.1 }]
            }
          },
          {
            title: "冷却水温差",
            curveValueList: {
              curveValueList: [{ time: "2026-04-13 09:00:00", value: 4.8 }]
            }
          }
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${target}`);
  };
}

test("validateAssistantQueryRequest rejects empty text", () => {
  const result = validateAssistantQueryRequest(
    {
      context: { siteId: "demo-site" },
      query: { text: "   " }
    },
    "demo-site"
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_REQUEST");
});

test("validateAssistantQueryRequest defaults promptOrigin to manual", () => {
  const result = validateAssistantQueryRequest(
    {
      context: { siteId: "demo-site", locale: "zh-CN" },
      query: { text: "当前冷站运行状况如何？" }
    },
    "demo-site"
  );
  assert.equal(result.ok, true);
  assert.equal(result.request.promptOrigin, "manual");
});

test("classifyAssistantQuery covers new kinds", () => {
  assert.equal(classifyAssistantQuery("当前数据新鲜吗？"), "reliability");
  assert.equal(classifyAssistantQuery("如果只检查一项，建议看哪台设备？"), "device");
  assert.equal(classifyAssistantQuery("这条建议是什么意思？"), "recommendation");
  assert.equal(classifyAssistantQuery("哪条异常最值得优先看？"), "anomaly");
  assert.equal(classifyAssistantQuery("这条优化草案为什么还要等审批？"), "strategy");
  assert.equal(classifyAssistantQuery("帮我开机"), "unsupported");
  assert.equal(classifyAssistantQuery("请把 setpoint 调到 7.5"), "unsupported");
  assert.equal(classifyAssistantQuery("当前冷站运行状况如何？"), "status");
});

test("buildStrategyAnswer summarizes digest-driven strategy state", () => {
  const answer = buildStrategyAnswer("zh", sampleDigest);

  assert.equal(answer.kind, "strategy");
  assert.match(answer.summary, /待审批/);
  assert.match(answer.details[0], /阶段：待审批/);
  assert.match(answer.details[1], /先处理待审批治理动作/);
  assert.ok(answer.details.some((line) => line.includes("阻塞项")));
  assert.ok(answer.details.some((line) => line.includes("风险")));
  assert.ok(answer.nextSteps[0].includes("待审批") || answer.nextSteps[0].includes("审批"));
  assert.ok(answer.pageHints.includes("优化执行"));
});

test("buildStatusAnswer returns action-oriented next steps", () => {
  const answer = buildStatusAnswer(
    "zh",
    sampleOverview,
    sampleAnomalies,
    sampleRecommendations,
    sampleDeviceList,
    staleFreshness
  );

  assert.equal(answer.kind, "status");
  assert.ok(answer.nextSteps.length >= 2);
  assert.match(answer.nextSteps[0], /原始页面|现场|采集时间/);
  assert.ok(answer.pageHints.includes("站点总览"));
});

test("buildRecommendationAnswer reuses card actions", () => {
  const answer = buildRecommendationAnswer(
    "zh",
    sampleRecommendations,
    sampleAnomalies,
    { label: "fresh", latestTimestamp: "2026-03-31T10:00:00.000Z", stale: false }
  );

  assert.equal(answer.kind, "recommendation");
  assert.equal(answer.nextSteps[0], "先检查冷却泵频率");
  assert.equal(answer.nextSteps[1], "再核对冷却水温差");
});

test("buildDeviceAnswer points to a device category when clues exist", () => {
  const answer = buildDeviceAnswer(
    "zh",
    sampleOverview,
    sampleAnomalies,
    sampleRecommendations,
    sampleDeviceList,
    { label: "fresh", latestTimestamp: "2026-03-31T10:00:00.000Z", stale: false }
  );

  assert.equal(answer.kind, "device");
  assert.match(answer.summary, /冷却泵|设备清单/);
  assert.ok(answer.pageHints.includes("设备清单"));
});

test("buildReliabilityAnswer warns first about verification when degraded", () => {
  const answer = buildReliabilityAnswer(
    "zh",
    sampleOverview,
    sampleAnomalies,
    sampleRecommendations,
    sampleDeviceList,
    staleFreshness,
    { overall: "partial" }
  );

  assert.equal(answer.kind, "reliability");
  assert.match(answer.nextSteps[0], /原始页面|现场|采集时间/);
});

test("buildAssistantQueryResponse returns structured knowledge answer without upstream calls", async () => {
  const response = await buildAssistantQueryResponse(
    config,
    "demo-site",
    {
      locale: "zh",
      text: "冷冻水温差偏低通常说明什么？"
    }
  );

  assert.equal(response.answer.kind, "knowledge");
  assert.ok(Array.isArray(response.answer.nextSteps));
  assert.ok(response.answer.nextSteps.length > 0);
});

test("buildAssistantQueryResponse returns unsupported answer without upstream calls", async () => {
  const response = await buildAssistantQueryResponse(
    config,
    "demo-site",
    {
      locale: "zh",
      text: "帮我开机"
    }
  );

  assert.equal(response.answer.kind, "unsupported");
  assert.equal(response.answer.citations.length, 0);
});

test("buildAssistantQueryResponse returns strategy answer from injected digest", async () => {
  const response = await buildAssistantQueryResponse(
    config,
    "demo-site",
    {
      locale: "zh",
      text: "这条优化草案为什么还要等审批？"
    },
    {
      aiDigest: sampleDigest
    }
  );

  assert.equal(response.answer.kind, "strategy");
  assert.match(response.answer.summary, /待审批/);
  assert.ok(response.answer.citations.some((citation) => citation.sourceKey === "optimizeExecutions"));
  assert.equal(response.freshness.label, "fresh");
  assert.equal(response.sourceStatus.overall, "ok");
});

test("buildAssistantQueryResponse loads live digest context for strategy queries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockLegacyFetch(originalFetch);

  try {
    const response = await buildAssistantQueryResponse(
      config,
      "140",
      {
        locale: "zh",
        text: "当前优化草案下一步是什么？"
      },
      {}
    );

    assert.equal(response.answer.kind, "strategy");
    assert.notEqual(response.sourceStatus.overall, "failed");
    assert.notEqual(response.freshness.label, "unknown");
    assert.ok(response.freshness.latestTimestamp);
    assert.ok(response.answer.details.some((line) => line.includes("阶段：")));
    assert.ok(response.answer.citations.some((citation) => citation.sourceKey === "optimizeExecutions"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
