<template>
  <section class="metric-pair metric-pair--reverse">
    <metric-band
      class="metric-pair__primary"
      :title="$t('defaultpage.coolingPump')"
      eyebrow="CW PUMP"
      :compact="true"
      :value="resolvedCoolingWaterPumpCop"
      :min="43.6"
      :max="58.5"
      :bands="bands"
      :ticks="ticks"
      :digits="2"
      :show-legend="false"
      :show-marker-label="false"
      :empty-when-non-positive="true"
    />
    <line5 class="metric-pair__secondary" />
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import MetricBand from "./MetricBand.vue";
import line5 from "./line5.vue";
import { METRIC_TONES, buildTicks, toNumber } from "./metricBand";

export default {
  components: {
    MetricBand,
    line5,
  },
  computed: {
    ...mapGetters(["coolingWaterPumpCop", "coolingWaterPumpCopRT", "unitSelete"]),
    resolvedCoolingWaterPumpCop() {
      const value = this.unitSelete === "RT"
        ? toNumber(this.coolingWaterPumpCopRT, 0)
        : toNumber(this.coolingWaterPumpCop, 0);
      return value > 0 ? value : null;
    },
    bands() {
      return [
        { label: this.$t("defaultpage.needsImprovement"), start: 43.6, end: 48.6, color: METRIC_TONES.needsImprovement },
        { label: this.$t("defaultpage.average"), start: 48.6, end: 53.5, color: METRIC_TONES.average },
        { label: this.$t("defaultpage.good"), start: 53.5, end: 58.5, color: METRIC_TONES.good },
      ];
    },
    ticks() {
      return buildTicks([43.6, 48.6, 53.5, 58.5], (value) => `${value}`);
    },
  },
};
</script>

<style lang="scss" scoped>
.metric-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  width: 100%;
  min-height: auto;
}

.metric-pair--reverse {
  direction: ltr;
}

.metric-pair__primary,
.metric-pair__secondary {
  min-width: 0;
}
</style>
