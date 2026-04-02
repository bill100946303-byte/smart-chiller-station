import assert from "node:assert/strict";
import test from "node:test";
import { loadSceneLegacyTrend } from "./legacySceneControlAdapter.js";

test("loadSceneLegacyTrend falls back to projectKey when siteId legacy path fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (
      String(url).endsWith(
        "/zsqy/homepage/btwentyfive/getRunParamsCurveByTagName?title=%E6%B9%BF%E7%90%83%E6%B8%A9%E5%BA%A6&tagname=506-40689"
      )
    ) {
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

    if (
      String(url).endsWith(
        "/zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?title=%E6%B9%BF%E7%90%83%E6%B8%A9%E5%BA%A6&tagname=506-40689"
      )
    ) {
      return new Response(
        JSON.stringify([
          {
            time: "2026-04-01 08:00:00",
            value: 24.6
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
    const result = await loadSceneLegacyTrend("http://127.0.0.1:8098", "btwentyfive", {
      tagname: "506-40689",
      title: "湿球温度",
      projectKey: "126lnoffice"
    });

    assert.equal(result.sourceStatus?.ok, true);
    assert.equal(
      result.sourceStatus?.endpoint,
      "/zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?title=%E6%B9%BF%E7%90%83%E6%B8%A9%E5%BA%A6&tagname=506-40689"
    );
    assert.equal(result.points?.[0]?.value, 24.6);
    assert.equal(requests[0], "http://127.0.0.1:8098/zsqy/homepage/126lnoffice/getRunParamsCurveByTagName?title=%E6%B9%BF%E7%90%83%E6%B8%A9%E5%BA%A6&tagname=506-40689");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
