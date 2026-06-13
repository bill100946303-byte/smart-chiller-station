import assert from "node:assert/strict";
import test from "node:test";

import { computeFreshnessState } from "./freshness.js";

test("computeFreshnessState clamps future timestamps to zero age", () => {
  const futureTimestamp = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const result = computeFreshnessState(futureTimestamp, 6);

  assert.equal(result.latestTimestamp, futureTimestamp);
  assert.equal(result.stale, false);
  assert.equal(result.ageHours, 0);
});
