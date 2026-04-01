import test from "node:test";
import assert from "node:assert/strict";

import { readRealtimeRequestContext } from "./v1.js";

function buildRequest(options = {}) {
  const headers = options.headers || {};
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );
  return {
    params: {
      siteId: options.siteId || "btwentyfive"
    },
    body: options.body ?? null,
    siteRuntimeConfig: options.siteRuntimeConfig ?? null,
    get(name) {
      return normalizedHeaders.get(String(name).toLowerCase());
    }
  };
}

test("readRealtimeRequestContext prefers runtime modelKey when header project key equals route siteId", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "btwentyfive"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice",
        databaseKey: "140观澜B25",
        template: "1"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "126lnoffice");
  assert.equal(context.template, "1");
});

test("readRealtimeRequestContext preserves explicit header project key when it differs from route siteId", () => {
  const request = buildRequest({
    headers: {
      "x-chiller-project-key": "custom-project-key"
    },
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice",
        databaseKey: "140观澜B25"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "custom-project-key");
});

test("readRealtimeRequestContext falls back to runtime modelKey when header is missing", () => {
  const request = buildRequest({
    siteRuntimeConfig: {
      siteSourceConfig: {
        modelKey: "126lnoffice"
      }
    }
  });

  const context = readRealtimeRequestContext(request);

  assert.equal(context.projectKey, "126lnoffice");
});
