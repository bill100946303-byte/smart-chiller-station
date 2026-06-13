import test from "node:test";
import assert from "node:assert/strict";

import { annotateSourceEntry, buildSourceStatus } from "./sourceStatusService.js";

test("annotateSourceEntry attaches source origin metadata", () => {
  const result = annotateSourceEntry(
    {
      key: "devicesTree",
      endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
      ok: true
    },
    {
      baseUrl: "https://www.ssge.com.cn:8098/",
      interfaceKind: "legacy-reg-findAllByDrTypeId",
      originLabel: "云端文档接口"
    }
  );

  assert.deepEqual(result, {
    key: "devicesTree",
    endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
    ok: true,
    baseUrl: "https://www.ssge.com.cn:8098",
    interfaceKind: "legacy-reg-findAllByDrTypeId",
    originLabel: "云端文档接口"
  });
});

test("buildSourceStatus preserves optional source origin metadata", () => {
  const status = buildSourceStatus([
    annotateSourceEntry(
      {
        key: "devicesTree",
        endpoint: "/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0",
        ok: true,
        status: 200
      },
      {
        baseUrl: "https://www.ssge.com.cn:8098",
        interfaceKind: "legacy-reg-findAllByDrTypeId"
      }
    )
  ]);

  assert.equal(status.overall, "ok");
  assert.equal(status.sources[0]?.baseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(status.sources[0]?.interfaceKind, "legacy-reg-findAllByDrTypeId");
  assert.equal(status.sources[0]?.originLabel, null);
});
