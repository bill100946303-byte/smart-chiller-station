export const METRIC_TONES = {
  excellent: "#4b7cfe",
  good: "#35d0b8",
  average: "#e0af33",
  needsImprovement: "#e03d75",
};

export function toNumber(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatMetricValue(value, digits = 2) {
  const number = toNumber(value, NaN);
  if (!Number.isFinite(number)) {
    return "--";
  }

  const fixed = number.toFixed(Math.max(0, digits));
  return digits > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
}

export function normalizeBands(bands = [], min = 0, max = 1) {
  const ordered = bands
    .map((band, index) => {
      const start = toNumber(
        band.start != null ? band.start : band.min != null ? band.min : index === 0 ? min : min
      );
      const end = toNumber(
        band.end != null ? band.end : band.max != null ? band.max : index === bands.length - 1 ? max : max
      );
      return {
        ...band,
        start: Number.isFinite(start) ? start : min,
        end: Number.isFinite(end) ? end : max,
        color: band.color || METRIC_TONES.average,
      };
    })
    .filter((band) => Number.isFinite(band.start) && Number.isFinite(band.end))
    .map((band) => ({
      ...band,
      start: Math.min(band.start, band.end),
      end: Math.max(band.start, band.end),
    }))
    .filter((band) => band.end > band.start)
    .sort((a, b) => a.start - b.start);

  return ordered;
}

export function getActiveBand(value, bands = [], fallback = null) {
  const numericValue = toNumber(value, NaN);
  if (!Number.isFinite(numericValue) || !bands.length) {
    return fallback;
  }

  const match = bands.find((band) => numericValue >= band.start && numericValue < band.end);
  if (match) {
    return match;
  }

  if (numericValue < bands[0].start) {
    return bands[0];
  }

  return bands[bands.length - 1] || fallback;
}

export function valueToPercent(value, min, max, reverse = false) {
  const start = toNumber(min, 0);
  const end = toNumber(max, 1);
  const span = end - start;
  if (!Number.isFinite(span) || span <= 0) {
    return reverse ? 0 : 100;
  }

  const numericValue = clamp(toNumber(value, start), start, end);
  const percent = ((numericValue - start) / span) * 100;
  return reverse ? 100 - percent : percent;
}

export function buildTicks(values = [], formatter = formatMetricValue) {
  const seen = new Set();

  return values
    .map((value) => ({
      value: toNumber(value, value),
      label: formatter(value),
    }))
    .filter((tick) => {
      const key = `${tick.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}
