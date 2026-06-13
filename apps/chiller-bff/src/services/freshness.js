export function computeFreshnessState(isoTimestamp, thresholdHours) {
  if (!isoTimestamp) {
    return {
      latestTimestamp: null,
      stale: true,
      ageHours: null
    };
  }

  const ts = Date.parse(isoTimestamp);
  if (!Number.isFinite(ts)) {
    return {
      latestTimestamp: null,
      stale: true,
      ageHours: null
    };
  }

  const rawAgeHours = (Date.now() - ts) / (1000 * 60 * 60);
  const ageHours = Math.max(rawAgeHours, 0);
  return {
    latestTimestamp: new Date(ts).toISOString(),
    stale: rawAgeHours > thresholdHours,
    ageHours: Number(ageHours.toFixed(2))
  };
}
