import test from "node:test";
import assert from "node:assert/strict";

import { deriveLoadRatePct } from "./dashboardService.js";

test("deriveLoadRatePct returns percentage when cooling capacities are available", () => {
  assert.equal(deriveLoadRatePct(1200, 2400), 50);
  assert.equal(deriveLoadRatePct(750, 1000), 75);
});

test("deriveLoadRatePct returns null when rated cooling capacity is missing or invalid", () => {
  assert.equal(deriveLoadRatePct(1200, null), null);
  assert.equal(deriveLoadRatePct(null, 2400), null);
  assert.equal(deriveLoadRatePct(1200, 0), null);
});
