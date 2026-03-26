<template>
  <metric-band
    class="metric-widget metric-widget--secondary"
    :title="$t('defaultpage.coolingTower')"
    eyebrow="TOWER COP"
    :compact="true"
    :value="resolvedCoolingTowerCop"
    :min="88.6"
    :max="118"
    :bands="bands"
    :ticks="ticks"
    :digits="2"
    :show-legend="false"
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
    ...mapGetters(["coolingTowerCop", "coolingTowerCopRT", "unitSelete"]),
    resolvedCoolingTowerCop() {
      const value = this.unitSelete === "RT"
        ? toNumber(this.coolingTowerCopRT, 0)
        : toNumber(this.coolingTowerCop, 0);
      return value > 0 ? value : null;
    },
    bands() {
      return [
        { label: this.$t("defaultpage.needsImprovement"), start: 88.6, end: 98.6, color: METRIC_TONES.needsImprovement },
        { label: this.$t("defaultpage.average"), start: 98.6, end: 108.5, color: METRIC_TONES.average },
        { label: this.$t("defaultpage.good"), start: 108.5, end: 118, color: METRIC_TONES.good },
      ];
    },
    ticks() {
      return buildTicks([88.6, 98.6, 108.5, 118], (value) => `${value}`);
    },
  },
};
</script>

<style lang="scss" scoped>
.metric-widget {
  width: 100%;
}

.metric-widget--secondary {
  padding-top: 2px;
}
</style>
