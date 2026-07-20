export const PHYSICAL_STATION_PARENT_TYPES = Object.freeze([
  "chilled_plant",
  "compressed_air",
  "boiler_room"
]);

const PHYSICAL_STATION_PARENT_TYPE_SET = new Set(PHYSICAL_STATION_PARENT_TYPES);

export function isPhysicalStationParentType(value) {
  return PHYSICAL_STATION_PARENT_TYPE_SET.has(String(value || "").trim());
}
