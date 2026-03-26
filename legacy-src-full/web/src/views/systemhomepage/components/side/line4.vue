<template>
  <metric-band
    class="metric-widget metric-widget--secondary"
    :title="$t('defaultpage.refrigerationPump')"
    eyebrow="CHW PUMP"
    :compact="true"
    :value="resolvedChilledWaterPumpCop"
    :min="37.5"
    :max="50"
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
    ...mapGetters(["chilledWaterPumpCop", "chilledWaterPumpCopRT", "unitSelete"]),
    resolvedChilledWaterPumpCop() {
      const value = this.unitSelete === "RT"
        ? toNumber(this.chilledWaterPumpCopRT, 0)
        : toNumber(this.chilledWaterPumpCop, 0);
      return value > 0 ? value : null;
    },
    bands() {
      return [
        { label: this.$t("defaultpage.needsImprovement"), start: 37.5, end: 41.7, color: METRIC_TONES.needsImprovement },
        { label: this.$t("defaultpage.average"), start: 41.7, end: 45.9, color: METRIC_TONES.average },
        { label: this.$t("defaultpage.good"), start: 45.9, end: 50, color: METRIC_TONES.good },
      ];
    },
    ticks() {
      return buildTicks([37.5, 41.7, 45.9, 50], (value) => `${value}`);
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
