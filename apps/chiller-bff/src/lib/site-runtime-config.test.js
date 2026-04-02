import test from "node:test";
import assert from "node:assert/strict";

import { resolveSiteRuntimeConfig } from "./site-runtime-config.js";

test("resolveSiteRuntimeConfig falls back to base config when no site override exists", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "site-a"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "site-a");
  assert.equal(result.legacyBaseUrl, "http://127.0.0.1:8098");
});

test("resolveSiteRuntimeConfig prefers site-level legacy base url override", () => {
  const baseConfig = {
    legacyBaseUrl: "http://127.0.0.1:8098",
    defaultSiteId: "site-a"
  };
  const adminStore = {
    getSiteSourceConfig(siteId) {
      if (siteId === "site-a") {
        return {
          legacyBaseUrl: "https://legacy.example.com/station-a/"
        };
      }
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "site-a");
  assert.equal(result.legacyBaseUrl, "https://legacy.example.com/station-a");
});

test("resolveSiteRuntimeConfig exposes builtin source mapping when site needs a legacy project key", () => {
  const baseConfig = {
    legacyBaseUrl: "https://www.ssge.com.cn:8098",
    defaultSiteId: "126lnoffice"
  };
  const adminStore = {
    getSiteSourceConfig() {
      return null;
    }
  };

  const result = resolveSiteRuntimeConfig(baseConfig, adminStore, "btwentyfive");
  assert.equal(result.legacyBaseUrl, "https://www.ssge.com.cn:8098");
  assert.equal(result.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.legacyAppId, "140");
  assert.equal(result.siteSourceConfig?.modelKey, "126lnoffice");
  assert.equal(result.siteSourceConfig?.template, "1");
  assert.equal(result.siteSourceConfig?.ratedCoolingCapacityKw, 8440.8);
  assert.equal(result.ratedCoolingCapacityKw, 8440.8);
});
