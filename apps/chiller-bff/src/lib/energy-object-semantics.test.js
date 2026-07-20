import assert from "node:assert/strict";
import test from "node:test";

import {
  PHYSICAL_STATION_PARENT_TYPES,
  isPhysicalStationParentType
} from "./energy-object-semantics.js";

test("physical station parent semantics exclude distribution and consumption systems", () => {
  assert.deepEqual(PHYSICAL_STATION_PARENT_TYPES, [
    "chilled_plant",
    "compressed_air",
    "boiler_room"
  ]);
  assert.equal(isPhysicalStationParentType(" chilled_plant "), true);
  assert.equal(isPhysicalStationParentType("compressed_air"), true);
  assert.equal(isPhysicalStationParentType("boiler_room"), true);
  assert.equal(isPhysicalStationParentType("power_monitoring"), false);
  assert.equal(isPhysicalStationParentType("hvac_terminal"), false);
  assert.equal(isPhysicalStationParentType(null), false);
});
