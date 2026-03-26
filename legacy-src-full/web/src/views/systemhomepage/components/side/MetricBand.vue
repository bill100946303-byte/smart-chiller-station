<template>
  <section
    :class="[
      'metric-band',
      `metric-band--${orientation}`,
      { 'metric-band--compact': compact, 'metric-band--legend-only': !showHeader && !showTrack }
    ]"
  >
    <header v-if="showHeader" class="metric-band__header">
      <div class="metric-band__titles">
        <div class="metric-band__eyebrow" v-if="eyebrow">{{ eyebrow }}</div>
        <div class="metric-band__title">{{ title }}</div>
      </div>
      <div class="metric-band__value" :style="valueStyle">
        <span class="metric-band__value-number">{{ formattedValue }}</span>
        <span v-if="unit" class="metric-band__value-unit">{{ unit }}</span>
      </div>
    </header>

    <div v-if="showTrack" class="metric-band__rail">
      <div class="metric-band__track">
        <span
          v-for="(band, index) in normalizedBands"
          :key="`${band.label || index}-${band.start}-${band.end}`"
          class="metric-band__segment"
          :style="segmentStyle(band)"
        />
        <span class="metric-band__marker" :style="markerStyle">
          <span class="metric-band__marker-dot" />
          <span v-if="showMarkerLabel && activeBandLabel" class="metric-band__marker-label">
            {{ activeBandLabel }}
          </span>
        </span>
      </div>
      <div v-if="showTicks && ticks.length" class="metric-band__ticks">
        <span
          v-for="(tick, index) in ticks"
          :key="`${tick.value}-${index}`"
          :class="[
            'metric-band__tick',
            {
              'is-first': index === 0,
              'is-last': index === ticks.length - 1,
              'is-second': index === 1,
              'is-penultimate': index === ticks.length - 2,
            }
          ]"
          :style="tickStyle(tick)"
        >
          {{ tick.label }}
        </span>
      </div>
    </div>

    <div v-if="showLegend && normalizedBands.length" class="metric-band__legend">
      <span v-for="(band, index) in normalizedBands" :key="`${band.label || index}-legend`" class="metric-band__legend-item">
        <i class="metric-band__legend-swatch" :style="legendSwatchStyle(band)" />
        <span>{{ band.label }}</span>
      </span>
    </div>
  </section>
</template>

<script>
import {
  METRIC_TONES,
  clamp,
  formatMetricValue,
  getActiveBand,
  normalizeBands,
  toNumber,
  valueToPercent,
} from "./metricBand";

export default {
  name: "MetricBand",
  props: {
    title: {
      type: String,
      default: "",
    },
    eyebrow: {
      type: String,
      default: "",
    },
    value: {
      type: [Number, String],
      default: null,
    },
    unit: {
      type: String,
      default: "",
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
    bands: {
      type: Array,
      default: () => [],
    },
    ticks: {
      type: Array,
      default: () => [],
    },
    digits: {
      type: Number,
      default: 2,
    },
    orientation: {
      type: String,
      default: "horizontal",
    },
    compact: {
      type: Boolean,
      default: false,
    },
    reverse: {
      type: Boolean,
      default: false,
    },
    showHeader: {
      type: Boolean,
      default: true,
    },
    showTrack: {
      type: Boolean,
      default: true,
    },
    showLegend: {
      type: Boolean,
      default: true,
    },
    showTicks: {
      type: Boolean,
      default: true,
    },
    showMarkerLabel: {
      type: Boolean,
      default: true,
    },
    emptyWhenNonPositive: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    metricValue() {
      const numeric = toNumber(this.value, NaN);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      if (this.emptyWhenNonPositive && numeric <= 0) {
        return null;
      }
      return numeric;
    },
    hasValue() {
      return this.metricValue !== null;
    },
    normalizedBands() {
      return normalizeBands(this.bands, this.min, this.max);
    },
    formattedValue() {
      return this.hasValue ? formatMetricValue(this.metricValue, this.digits) : "--";
    },
    activeBand() {
      if (!this.hasValue) {
        return {
          label: "",
          color: "rgba(156, 186, 211, 0.62)",
        };
      }
      const defaultBand = {
        label: this.formattedValue,
        color: METRIC_TONES.average,
      };
      return getActiveBand(this.metricValue, this.normalizedBands, defaultBand);
    },
    activeBandLabel() {
      return this.activeBand && this.activeBand.label ? this.activeBand.label : "";
    },
    markerStyle() {
      const color = this.activeBand && this.activeBand.color ? this.activeBand.color : METRIC_TONES.average;
      const percent = this.hasValue
        ? valueToPercent(this.metricValue, this.min, this.max, this.reverse)
        : 50;
      const offset = this.reverse ? "translateX(50%)" : "translateX(-50%)";
      const base = {
        "--metric-band-color": color,
        left: `${percent}%`,
        transform: offset,
      };
      if (this.reverse) {
        base.right = `${100 - percent}%`;
        delete base.left;
      }
      return base;
    },
    valueStyle() {
      const color = this.activeBand && this.activeBand.color ? this.activeBand.color : METRIC_TONES.average;
      return {
        color,
        textShadow: this.hasValue ? `0 0 16px ${color}26` : "none",
      };
    },
  },
  methods: {
    segmentStyle(band) {
      const width = clamp(((band.end - band.start) / Math.max(this.max - this.min, 1)) * 100, 0, 100);
      return {
        "--metric-band-color": band.color || METRIC_TONES.average,
        flexBasis: `${width}%`,
      };
    },
    legendSwatchStyle(band) {
      return {
        "--metric-band-color": band.color || METRIC_TONES.average,
      };
    },
    tickStyle(tick) {
      const tickValue = toNumber(tick.value, this.min);
      const percent = valueToPercent(tickValue, this.min, this.max, this.reverse);
      const style = {
        left: `${percent}%`,
      };
      if (this.reverse) {
        style.right = `${100 - percent}%`;
        delete style.left;
      }
      return style;
    },
  },
};
</script>

<style lang="scss" scoped>
.metric-band {
  --metric-band-bg: rgba(9, 22, 36, 0.9);
  --metric-band-border: rgba(133, 208, 255, 0.12);
  --metric-band-text: rgba(238, 247, 255, 0.96);
  --metric-band-muted: rgba(173, 207, 235, 0.72);
  --metric-band-marker-size: 14px;
  --metric-band-marker-height: 34px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
  color: var(--metric-band-text);
}

.metric-band--compact {
  --metric-band-marker-size: 12px;
  --metric-band-marker-height: 28px;
  gap: 6px;
}

.metric-band--compact .metric-band__eyebrow {
  font-size: 9px;
}

.metric-band--compact .metric-band__title {
  font-size: 12px;
}

.metric-band--compact .metric-band__value-number {
  font-size: 18px;
}

.metric-band--compact .metric-band__value-unit {
  font-size: 10px;
}

.metric-band__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.metric-band__titles {
  min-width: 0;
}

.metric-band__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--metric-band-muted);
}

.metric-band__title {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.15;
}

.metric-band__value {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}

.metric-band__value-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.metric-band__value-unit {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--metric-band-muted);
}

.metric-band__rail {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.metric-band--compact .metric-band__rail {
  gap: 5px;
}

.metric-band__track {
  position: relative;
  display: flex;
  align-items: stretch;
  height: 18px;
  padding: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid var(--metric-band-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 28px rgba(0, 0, 0, 0.14);
  overflow: visible;
}

.metric-band--compact .metric-band__track {
  height: 14px;
  padding: 2px 2px;
}

.metric-band__segment {
  flex: 1 1 0;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    linear-gradient(90deg, var(--metric-band-color), var(--metric-band-color));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  z-index: 1;
}

.metric-band__marker {
  position: absolute;
  top: calc(50% - var(--metric-band-marker-height) / 2);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  pointer-events: none;
  z-index: 2;
}

.metric-band__marker-dot {
  width: var(--metric-band-marker-size);
  height: var(--metric-band-marker-size);
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  background: var(--metric-band-color);
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.04), 0 0 18px var(--metric-band-color);
}

.metric-band__tick.is-first {
  transform: translateX(0);
  text-align: left;
}

.metric-band__tick.is-last {
  transform: translateX(-100%);
  text-align: right;
}

.metric-band__tick.is-second {
  transform: translateX(-36%);
}

.metric-band__tick.is-penultimate {
  transform: translateX(-64%);
}

.metric-band__marker-label {
  margin-top: 1px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(8, 18, 31, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--metric-band-text);
  font-size: 11px;
  white-space: nowrap;
}

.metric-band__ticks {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 18px;
}

.metric-band__tick {
  position: absolute;
  transform: translateX(-50%);
  font-size: 11px;
  line-height: 1;
  color: var(--metric-band-muted);
  white-space: nowrap;
}

.metric-band--compact .metric-band__tick {
  font-size: 9px;
}

.metric-band__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.metric-band--compact .metric-band__legend {
  gap: 8px 12px;
}

.metric-band__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--metric-band-muted);
  white-space: nowrap;
}

.metric-band--compact .metric-band__legend-item {
  gap: 6px;
  font-size: 11px;
}

.metric-band__legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    linear-gradient(90deg, var(--metric-band-color), var(--metric-band-color));
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.metric-band--compact .metric-band__legend-swatch {
  width: 10px;
  height: 10px;
}

.metric-band--legend-only {
  gap: 0;
}

.metric-band--legend-only .metric-band__legend {
  margin-top: 0;
}

@media (max-width: 1280px) {
  .metric-band__title {
    font-size: 15px;
  }

  .metric-band__value-number {
    font-size: 24px;
  }
}
</style>
