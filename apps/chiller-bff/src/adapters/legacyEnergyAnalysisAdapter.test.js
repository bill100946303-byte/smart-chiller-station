import assert from "node:assert/strict";
import test from "node:test";

import { loadEnergyAnalysis, loadEnergyAnalysisTree } from "./legacyEnergyAnalysisAdapter.js";

function buildCurvePayload(series = []) {
  return JSON.stringify({
    ok: true,
    msg: "OK",
    data: {
      curveList: series.map((item) => ({
        title: item.title,
        unit: item.unit || "kWh",
        curveValueList: (item.points || []).map((point) => ({
          name: point.label,
          value: point.value
        }))
      }))
    }
  });
}

function responseOf(series) {
  return new Response(buildCurvePayload(series), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

test("loadEnergyAnalysisTree returns built-in category tree", async () => {
  const result = await loadEnergyAnalysisTree("https://www.ssge.com.cn:8098", "140");

  assert.equal(result.items?.length, 1);
  assert.equal(result.items?.[0]?.label, "电量对象");
  assert.deepEqual(
    (result.items?.[0]?.children || []).map((item) => item.label),
    ["冷水主机", "冷却塔", "冷冻泵", "冷却泵"]
  );
  assert.deepEqual(
    (result.items?.[0]?.children || []).map((item) => item.children?.[0]?.deviceId),
    ["chiller", "coolingTower", "chilledWaterPump", "condenserWaterPump"]
  );
  assert.equal(result.sourceStatus?.tree?.ok, true);
  assert.equal(result.sourceStatus?.devices?.rows, 4);
});

test("loadEnergyAnalysis stitches hourly curve points across days and filters selected categories", async () => {
  const originalFetch = globalThis.fetch;
  const requestKeys = [];

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const dateType = target.searchParams.get("dateType");
    const date = target.searchParams.get("date");
    const appId = target.searchParams.get("appId");
    requestKeys.push(`${dateType}:${date}`);
    assert.equal(appId, "140");
    assert.equal(dateType, "1");

    if (date === "2026-04-09") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "04-09 22:00", value: "10" },
            { label: "04-09 23:00", value: "12" }
          ]
        },
        {
          title: "Cooling Tower",
          points: [
            { label: "04-09 22:00", value: "4" },
            { label: "04-09 23:00", value: "5" }
          ]
        },
        {
          title: "Chilled Water Pump",
          points: [{ label: "04-09 22:00", value: "1" }]
        },
        {
          title: "Condenser Water Pump",
          points: [{ label: "04-09 22:00", value: "2" }]
        }
      ]);
    }

    if (date === "2026-04-10") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "04-10 00:00", value: "14" },
            { label: "04-10 01:00", value: "16" }
          ]
        },
        {
          title: "Cooling Tower",
          points: [
            { label: "04-10 00:00", value: "6" },
            { label: "04-10 01:00", value: "7" },
            { label: "04-10 02:00", value: "8" }
          ]
        },
        {
          title: "Chilled Water Pump",
          points: [{ label: "04-10 00:00", value: "3" }]
        },
        {
          title: "Condenser Water Pump",
          points: [{ label: "04-10 00:00", value: "4" }]
        }
      ]);
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadEnergyAnalysis("https://www.ssge.com.cn:8098", "140", {
      startDate: "2026-04-09",
      endDate: "2026-04-10",
      dateType: "1",
      deviceIds: ["chiller", "coolingTower"],
      appId: "140"
    });

    assert.deepEqual(requestKeys, ["1:2026-04-09", "1:2026-04-10"]);
    assert.equal(result.series?.length, 2);
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.label),
      ["04-09 22:00", "04-09 23:00", "04-10 00:00", "04-10 01:00"]
    );
    assert.deepEqual(
      result.series?.[1]?.points?.map((point) => point.label),
      ["04-09 22:00", "04-09 23:00", "04-10 00:00", "04-10 01:00", "04-10 02:00"]
    );
    assert.equal(result.summaries?.[0]?.sumValue, 52);
    assert.equal(result.summaries?.[1]?.sumValue, 30);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyAnalysis trims polluted hourly tail points when placeholders follow an abnormal drop", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    assert.equal(target.searchParams.get("dateType"), "1");
    assert.equal(target.searchParams.get("date"), "2026-04-10");
    assert.equal(target.searchParams.get("appId"), "140");

    return responseOf([
      {
        title: "Chiller",
        points: [
          { label: "04-10 18:00", value: "100" },
          { label: "04-10 19:00", value: "110" },
          { label: "04-10 20:00", value: "30" },
          { label: "04-10 21:00", value: "" },
          { label: "04-10 22:00", value: "" }
        ]
      },
      {
        title: "Cooling Tower",
        points: [{ label: "04-10 18:00", value: "50" }]
      }
    ]);
  };

  try {
    const result = await loadEnergyAnalysis("https://www.ssge.com.cn:8098", "140", {
      startDate: "2026-04-10",
      endDate: "2026-04-10",
      dateType: "1",
      deviceIds: ["chiller"],
      appId: "140"
    });

    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.label),
      ["04-10 18:00", "04-10 19:00"]
    );
    assert.equal(result.summaries?.[0]?.sumValue, 210);
    assert.match(result.sourceStatus?.message || "", /tailTrimmed=1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyAnalysis filters day labels across month requests for dateType=2", async () => {
  const originalFetch = globalThis.fetch;
  const requestKeys = [];

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const dateType = target.searchParams.get("dateType");
    const date = target.searchParams.get("date");
    requestKeys.push(`${dateType}:${date}`);
    assert.equal(target.searchParams.get("appId"), "140");
    assert.equal(dateType, "2");

    if (date === "2026-04-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "1号", value: "1" },
            { label: "10号", value: "10" },
            { label: "30号", value: "30" }
          ]
        }
      ]);
    }

    if (date === "2026-05-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "1号", value: "100" },
            { label: "2号", value: "200" },
            { label: "3号", value: "300" }
          ]
        }
      ]);
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadEnergyAnalysis("https://www.ssge.com.cn:8098", "140", {
      startDate: "2026-04-10",
      endDate: "2026-05-02",
      dateType: "2",
      deviceIds: ["chiller"],
      appId: "140"
    });

    assert.deepEqual(requestKeys, ["2:2026-04-01", "2:2026-05-01"]);
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.label),
      ["2026-04-10", "2026-04-30", "2026-05-01", "2026-05-02"]
    );
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.value),
      [10, 30, 100, 200]
    );
    assert.equal(result.summaries?.[0]?.sumValue, 340);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyAnalysis filters month labels across years for dateType=3", async () => {
  const originalFetch = globalThis.fetch;
  const requestKeys = [];

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const dateType = target.searchParams.get("dateType");
    const date = target.searchParams.get("date");
    requestKeys.push(`${dateType}:${date}`);
    assert.equal(target.searchParams.get("appId"), "140");
    assert.equal(dateType, "3");

    if (date === "2025-01-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "10月", value: "10" },
            { label: "11月", value: "11" },
            { label: "12月", value: "12" }
          ]
        }
      ]);
    }

    if (date === "2026-01-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "1月", value: "1" },
            { label: "2月", value: "2" },
            { label: "3月", value: "3" }
          ]
        }
      ]);
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadEnergyAnalysis("https://www.ssge.com.cn:8098", "140", {
      startDate: "2025-11-15",
      endDate: "2026-02-20",
      dateType: "3",
      deviceIds: ["chiller"],
      appId: "140"
    });

    assert.deepEqual(requestKeys, ["3:2025-01-01", "3:2026-01-01"]);
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.label),
      ["2025-11", "2025-12", "2026-01", "2026-02"]
    );
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.value),
      [11, 12, 1, 2]
    );
    assert.equal(result.summaries?.[0]?.sumValue, 26);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyAnalysis aggregates filtered month points by year for dateType=4", async () => {
  const originalFetch = globalThis.fetch;
  const requestKeys = [];

  globalThis.fetch = async (url) => {
    const target = new URL(String(url));
    const dateType = target.searchParams.get("dateType");
    const date = target.searchParams.get("date");
    requestKeys.push(`${dateType}:${date}`);
    assert.equal(target.searchParams.get("appId"), "140");
    assert.equal(dateType, "3");

    if (date === "2025-01-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "10月", value: "10" },
            { label: "11月", value: "20" },
            { label: "12月", value: "30" }
          ]
        }
      ]);
    }

    if (date === "2026-01-01") {
      return responseOf([
        {
          title: "Chiller",
          points: [
            { label: "1月", value: "40" },
            { label: "2月", value: "50" },
            { label: "3月", value: "60" }
          ]
        }
      ]);
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadEnergyAnalysis("https://www.ssge.com.cn:8098", "140", {
      startDate: "2025-11-15",
      endDate: "2026-02-28",
      dateType: "4",
      deviceIds: ["chiller"],
      appId: "140"
    });

    assert.deepEqual(requestKeys, ["3:2025-01-01", "3:2026-01-01"]);
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.label),
      ["2025", "2026"]
    );
    assert.deepEqual(
      result.series?.[0]?.points?.map((point) => point.value),
      [50, 90]
    );
    assert.equal(result.summaries?.[0]?.sumValue, 140);
    assert.equal(result.summaries?.[0]?.maxTime, "2026");
    assert.equal(result.summaries?.[0]?.minTime, "2025");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
