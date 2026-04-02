<template>
  <metric-band
    class="metric-widget metric-widget--system"
    :title="$t('defaultpage.systemEnergyEfficiency')"
    eyebrow="SYSTEM COP"
    variant="hero"
    :value="resolvedColdStationCop"
    :min="metricConfig.min"
    :max="metricConfig.max"
    :bands="metricConfig.bands"
    :ticks="metricConfig.ticks"
    :digits="2"
    :show-legend="false"
    :show-ticks="false"
    :show-marker-label="false"
    :empty-when-non-positive="true"
  />
</template>

<script>
import { mapGetters } from "vuex";
import MetricBand from "./MetricBand.vue";
import { METRIC_TONES, buildTicks, toNumber } from "./metricBand";

export default {
  components: {
    MetricBand,
  },
  computed: {
    ...mapGetters(["coldStationCop", "coldStationCopRT", "unitSelete"]),
    resolvedColdStationCop() {
      const value = this.unitSelete === "RT"
        ? toNumber(this.coldStationCopRT, 0)
        : toNumber(this.coldStationCop, 0);
      return value > 0 ? value : null;
    },
    metricConfig() {
      if (this.unitSelete === "RT") {
        return {
          min: 0.55,
          max: 1.05,
          bands: [
            { label: this.$t("defaultpage.needsImprovement"), start: 0.55, end: 0.7, color: METRIC_TONES.needsImprovement },
            { label: this.$t("defaultpage.average"), start: 0.7, end: 0.85, color: METRIC_TONES.average },
            { label: this.$t("defaultpage.good"), start: 0.85, end: 1.0, color: METRIC_TONES.good },
            { label: this.$t("defaultpage.excellent"), start: 1.0, end: 1.05, color: METRIC_TONES.excellent },
          ],
          ticks: buildTicks([0.55, 0.7, 0.85, 1.0, 1.05], (value) => `${value}`),
        };
      }

      return {
        min: 2.5,
        max: 6.0,
        bands: [
          { label: this.$t("defaultpage.needsImprovement"), start: 2.5, end: 3.5, color: METRIC_TONES.needsImprovement },
          { label: this.$t("defaultpage.average"), start: 3.5, end: 4.15, color: METRIC_TONES.average },
          { label: this.$t("defaultpage.good"), start: 4.15, end: 5.0, color: METRIC_TONES.good },
          { label: this.$t("defaultpage.excellent"), start: 5.0, end: 6.0, color: METRIC_TONES.excellent },
        ],
        ticks: buildTicks([2.5, 3.5, 4.15, 5.0, 6.0], (value) => `${value}`),
      };
    },
  },
};
</script>

<style lang="scss" scoped>
.metric-widget {
  width: 100%;
}

.metric-widget--system {
  padding-top: 0;
}
</style>
