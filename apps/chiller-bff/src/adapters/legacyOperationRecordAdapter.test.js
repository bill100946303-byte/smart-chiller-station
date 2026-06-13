import assert from "node:assert/strict";
import test from "node:test";

import {
  loadOperationRecords,
  loadOperationRecordDeviceTypes,
  loadOperationRecordDevices
} from "./legacyOperationRecordAdapter.js";

function buildRuntimeConfig() {
  return {
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive",
      deviceDataInterfaces: [
        {
          projectKey: "140btwentyfive",
          endpointKind: "legacy-reg-findAllByDrTypeId",
          build: 1,
          floor: 0,
          label: "观澜B25"
        }
      ],
      defaultDeviceQuery: {
        build: 1,
        floor: 0
      }
    }
  };
}

function buildRuntimeCatalogPayload() {
  return {
    status: "20000",
    msg: "OK",
    ok: true,
    data: [
      {
        drid: 127,
        drnameCNEN: "冷站总管",
        drtypeid: 187,
        drtypenameCNEN: "累计量",
        reglist: {
          reglist: [
            {
              regId: 914,
              regName: "冷站总电量"
            },
            {
              regId: 915,
              regName: "冷站总冷量"
            }
          ]
        }
      },
      {
        drid: 93,
        drnameCNEN: "冷冻供水",
        drtypeid: 156,
        drtypenameCNEN: "温度传感器",
        reglist: {
          reglist: [
            {
              regId: 880,
              regName: "实时值"
            }
          ]
        }
      }
    ]
  };
}

test("loadOperationRecords appends legacy context params and parses XML nested records", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (!target.includes("/zsqy/runrecords/119csix/findAll")) {
      throw new Error(`Unexpected fetch: ${target}`);
    }
    const payload = `
      <SysResult>
        <status>20000</status>
        <msg>OK</msg>
        <data>
          <currentPage>1</currentPage>
          <pageSize>10</pageSize>
          <rowCount>2</rowCount>
          <records>
            <records>
              <id>1</id>
              <date>2026-04-20 08:10:11</date>
              <details>alpha</details>
              <operationResult>success</operationResult>
              <operationPerson>admin</operationPerson>
            </records>
            <records>
              <id>2</id>
              <date>2026-04-20 09:10:11</date>
              <details>beta</details>
              <operationResult>success</operationResult>
              <operationPerson>root</operationPerson>
            </records>
          </records>
        </data>
      </SysResult>
    `;
    return new Response(payload, {
      status: 200,
      headers: {
        "content-type": "application/xml"
      }
    });
  };

  try {
    const result = await loadOperationRecords(
      "https://www.ssge.com.cn:8098",
      "119csix",
      {
        page: 1,
        pageSize: 10,
        startDate: "2026-04-12",
        endDate: "2026-04-20",
        drTypeId: "0",
        drId: "0",
        runtimeConfig: {
          siteSourceConfig: {
            modelKey: "119csix",
            template: "1"
          }
        }
      }
    );

    assert.equal(result.total, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].details, "alpha");
    assert.equal(result.items[1].operationPerson, "root");

    const request = requests[0] || "";
    assert.ok(request.includes("language=zh"));
    assert.ok(request.includes("unit=KW"));
    assert.ok(request.includes("modelKey=119csix"));
    assert.ok(request.includes("template=1"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("operation-record device endpoints fall back to runtime device collection when legacy payload is semantically failed", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    requests.push(target);
    if (target.includes("/zsqy/Drtypeinfo/btwentyfive/findAllDrtypeOfDevice")) {
      return new Response(JSON.stringify({ status: "50009", msg: "失败", ok: false }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }
    if (target.includes("/zsqy/drinfo/btwentyfive/findAll?drtypeid=187")) {
      return new Response(JSON.stringify({ status: "50009", msg: "查询失败", ok: false }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }
    if (target.includes("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")) {
      return new Response(JSON.stringify(buildRuntimeCatalogPayload()), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const types = await loadOperationRecordDeviceTypes(
      "https://www.ssge.com.cn:8098",
      "btwentyfive",
      {
        runtimeConfig: buildRuntimeConfig()
      }
    );
    const devices = await loadOperationRecordDevices(
      "https://www.ssge.com.cn:8098",
      "btwentyfive",
      "187",
      {
        runtimeConfig: buildRuntimeConfig()
      }
    );

    assert.equal(types.items.length, 2);
    assert.equal(types.items[0].id, "187");
    assert.equal(types.items[0].label, "累计量");
    assert.equal(types.sourceStatuses?.length, 2);
    assert.equal(types.sourceStatuses?.[0]?.ok, false);
    assert.equal(types.sourceStatuses?.[1]?.ok, true);
    assert.equal(types.sourceStatuses?.[1]?.originLabel, "观澜B25");

    assert.equal(devices.items.length, 1);
    assert.deepEqual(devices.items[0], {
      id: "127",
      label: "冷站总管"
    });
    assert.equal(devices.sourceStatuses?.length, 2);
    assert.equal(devices.sourceStatuses?.[0]?.ok, false);
    assert.equal(devices.sourceStatuses?.[1]?.ok, true);

    assert.equal(
      requests.filter((item) => item.includes("/zsqy/reg/140btwentyfive/findAllByDrTypeId?build=1&floor=0")).length,
      2
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
