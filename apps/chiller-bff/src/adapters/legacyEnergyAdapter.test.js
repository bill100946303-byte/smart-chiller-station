import assert from "node:assert/strict";
import test from "node:test";
import { loadEnergyOverview, loadTrendSeries } from "./legacyEnergyAdapter.js";

test("loadEnergyOverview falls back to projectKey when siteId legacy path fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).endsWith("/zsqy/homepage/btwentyfive/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        "<Map><timestamp>1775023241976</timestamp><status>500</status><error>Internal Server Error</error></Map>",
        {
          status: 500,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    if (String(url).endsWith("/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-01 08:00:00",
            totalPower: 16.9,
            coldStationCop: 5.8,
            chilledWaterTemperatureDifference: 4.4,
            chilledOutWaterTemperatureDifference: 4.9
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadEnergyOverview("http://127.0.0.1:8098", "btwentyfive", {
      projectKey: "126lnoffice"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(result.sourceStatus?.endpoint, "/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
    assert.equal(result.metrics?.totalPowerKw, 16.9);
    assert.equal(result.metrics?.currentCop, 5.8);
    assert.equal(result.metrics?.chilledDeltaT, 4.4);
    assert.equal(result.metrics?.coolingDeltaT, 4.9);
    assert.equal(requests[0], "http://127.0.0.1:8098/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
    assert.ok(
      requests.includes("http://127.0.0.1:8098/api/homeData/126lnoffice/energyEfficiency"),
      "expected homeData fallback to reuse the projectKey path"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadEnergyOverview falls back from first candidate to second candidate", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).endsWith("/zsqy/homepage/140btwentyfive/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        "<Map><timestamp>1775023241976</timestamp><status>500</status><error>Internal Server Error</error></Map>",
        {
          status: 500,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    if (String(url).endsWith("/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve")) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-01 08:00:00",
            totalPower: 952.4,
            coldStationCop: 7.7,
            chilledWaterTemperatureDifference: 3.6,
            chilledOutWaterTemperatureDifference: 4.2
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

    throw new Error(`Unexpected URL: ${String(url)}`);
  };

  try {
    const result = await loadEnergyOverview("http://127.0.0.1:8098", "btwentyfive", {
      projectKey: "140btwentyfive",
      projectKeyCandidates: ["140btwentyfive", "126lnoffice"]
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(result.sourceStatus?.endpoint, "/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
    assert.equal(result.metrics?.totalPowerKw, 952.4);
    assert.equal(result.metrics?.currentCop, 7.7);
    assert.equal(requests[0], "http://127.0.0.1:8098/zsqy/homepage/140btwentyfive/getEquipmentEnergyStatisticsCurve");
    assert.equal(requests[1], "http://127.0.0.1:8098/zsqy/homepage/126lnoffice/getEquipmentEnergyStatisticsCurve");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadTrendSeries probes candidate identifiers for core curve endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  const runParamsPayload = [
    {
      title: "总功率",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 952.4 }]
      }
    },
    {
      title: "冷站COP",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 7.7 }]
      }
    },
    {
      title: "冷冻水温差",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 3.6 }]
      }
    },
    {
      title: "冷却水温差",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 4.2 }]
      }
    }
  ];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.endsWith("/zsqy/homepage/140/getEnergyStatisticsCurve")) {
      return new Response(
        "<Map><timestamp>1775023241976</timestamp><status>500</status><error>Internal Server Error</error></Map>",
        {
          status: 500,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/126lnoffice/getEnergyStatisticsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/zsqy/homepage/140/getRunParamsCurve")) {
      return new Response(
        "<Map><timestamp>1775023241976</timestamp><status>500</status><error>Internal Server Error</error></Map>",
        {
          status: 500,
          headers: {
            "content-type": "application/xml;charset=UTF-8"
          }
        }
      );
    }

    if (target.endsWith("/zsqy/homepage/126lnoffice/getRunParamsCurve")) {
      return new Response(JSON.stringify(runParamsPayload), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadTrendSeries("http://127.0.0.1:8098", "140", {
      projectKey: "140btwentyfive",
      projectKeyCandidates: ["140", "126lnoffice"]
    });

    const energySource = result.sourceStatus.find((item) => item.key === "energyCurve");
    const runParamsSource = result.sourceStatus.find((item) => item.key === "runParams");
    const totalPowerSeries = result.series.find((item) => item.metric === "totalPowerKw");
    const copSeries = result.series.find((item) => item.metric === "currentCop");

    assert.equal(energySource?.endpoint, "/zsqy/homepage/126lnoffice/getEnergyStatisticsCurve");
    assert.equal(runParamsSource?.endpoint, "/zsqy/homepage/126lnoffice/getRunParamsCurve");
    assert.equal(totalPowerSeries?.points?.[0]?.v, 952.4);
    assert.equal(copSeries?.points?.[0]?.v, 7.7);
    assert.ok(
      requests.includes("http://127.0.0.1:8098/zsqy/homepage/140/getEnergyStatisticsCurve"),
      "expected to probe first candidate energy curve"
    );
    assert.ok(
      requests.includes("http://127.0.0.1:8098/zsqy/homepage/140/getRunParamsCurve"),
      "expected to probe first candidate run params curve"
    );
    assert.ok(
      requests.includes("http://127.0.0.1:8098/zsqy/homepage/126lnoffice/getEnergyStatisticsCurve"),
      "expected to probe fallback candidate energy curve"
    );
    assert.ok(
      requests.some((item) => item.endsWith("/getRunParamsCurve") && item.includes("/126lnoffice/"))
        || requests.some((item) => item.endsWith("/getRunParamsCurve") && item.includes("/140btwentyfive/")),
      "expected to probe at least one fallback candidate run params curve"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadTrendSeries does not use chiller power as station total power", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  const runParamsPayload = [
    {
      title: "Chiller Total Power",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 320.5 }]
      }
    },
    {
      title: "Total Power",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 652.8 }]
      }
    },
    {
      title: "COP",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 5.6 }]
      }
    },
    {
      title: "chilledWaterTemperatureDifference",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 4.1 }]
      }
    },
    {
      title: "chilledOutWaterTemperatureDifference",
      curveValueList: {
        curveValueList: [{ time: "2026-04-01 08:00:00", value: 4.8 }]
      }
    }
  ];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.endsWith("/zsqy/homepage/119csix/getEnergyStatisticsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/zsqy/homepage/119csix/getRunParamsCurve")) {
      return new Response(JSON.stringify(runParamsPayload), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  try {
    const result = await loadTrendSeries("http://127.0.0.1:8098", "119csix");
    const totalPowerSeries = result.series.find((item) => item.metric === "totalPowerKw");

    assert.equal(totalPowerSeries?.label, "Total Power");
    assert.equal(totalPowerSeries?.points?.[0]?.v, 652.8);
    assert.ok(
      requests.includes("http://127.0.0.1:8098/zsqy/homepage/119csix/getRunParamsCurve"),
      "expected trend adapter to read run params curve"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loadTrendSeries fetches per-day tag curves for 7 day range", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);

    if (target.endsWith("/zsqy/homepage/119csix/getEnergyStatisticsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.endsWith("/zsqy/homepage/119csix/getRunParamsCurve")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (target.includes("/zsqy/homepage/119csix/getRunParamsCurveByTagName")) {
      const parsed = new URL(target);
      const date = parsed.searchParams.get("date");
      const tagname = parsed.searchParams.get("tagname");
      if (!date) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      const dayNumber = Number(date.slice(-2));
      const valueMap = {
        totalPower: 500 + dayNumber,
        TotalPower: 500 + dayNumber,
        coldStationCop: 5 + dayNumber / 100,
        cop: 5 + dayNumber / 100,
        chilledWaterTemperatureDifference: 4 + dayNumber / 100,
        chilledOutWaterTemperatureDifference: 3 + dayNumber / 100
      };

      return new Response(
        JSON.stringify([
          {
            time: `${date} 01:00:00`,
            value: valueMap[tagname] ?? 1
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

  try {
    const result = await loadTrendSeries("http://127.0.0.1:8098", "119csix", {
      range: "7d",
      trendEndDate: "2026-04-07"
    });
    const totalPowerSeries = result.series.find((item) => item.metric === "totalPowerKw");

    assert.equal(totalPowerSeries?.points?.length, 7);
    assert.equal(totalPowerSeries?.points?.[0]?.v, 501);
    assert.equal(totalPowerSeries?.points?.[6]?.v, 507);
    assert.ok(
      requests.some((item) => item.includes("date=2026-04-01")),
      "expected range query to request the first day"
    );
    assert.ok(
      requests.some((item) => item.includes("date=2026-04-07")),
      "expected range query to request the last day"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
