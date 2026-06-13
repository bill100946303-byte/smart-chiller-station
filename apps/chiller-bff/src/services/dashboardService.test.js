import test from "node:test";
import assert from "node:assert/strict";

import { deriveLoadRatePct, normalizeEfficiencyMetric, shouldUseRequestedB25CloudHistory } from "./dashboardService.js";

test("deriveLoadRatePct returns percentage when cooling capacities are available", () => {
  assert.equal(deriveLoadRatePct(1200, 2400), 50);
  assert.equal(deriveLoadRatePct(750, 1000), 75);
});

test("deriveLoadRatePct returns null when rated cooling capacity is missing or invalid", () => {
  assert.equal(deriveLoadRatePct(1200, null), null);
  assert.equal(deriveLoadRatePct(null, 2400), null);
  assert.equal(deriveLoadRatePct(1200, 0), null);
});

test("normalizeEfficiencyMetric treats non-positive values as unavailable", () => {
  assert.equal(normalizeEfficiencyMetric(5.2), 5.2);
  assert.equal(normalizeEfficiencyMetric(0), null);
  assert.equal(normalizeEfficiencyMetric(-1), null);
  assert.equal(normalizeEfficiencyMetric(null), null);
});

test("shouldUseRequestedB25CloudHistory only enables B25 cloud history when request context explicitly carries B25 key", () => {
  const config = {
    siteSourceConfig: {
      databaseKey: "140btwentyfive",
      deviceDataProjectKey: "140btwentyfive"
    }
  };

  assert.equal(
    shouldUseRequestedB25CloudHistory(config, "140", {
      projectKey: "126lnoffice",
      projectKeyCandidates: ["126lnoffice", "140"]
    }),
    false
  );

  assert.equal(
    shouldUseRequestedB25CloudHistory(config, "140", {
      projectKey: "140btwentyfive",
      projectKeyCandidates: ["140btwentyfive", "140"]
    }),
    true
  );
});
