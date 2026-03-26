<template>
  <section class="metric-pair">
    <metric-band
      class="metric-pair__primary"
      :title="$t('defaultpage.hostEnergyEfficiency')"
      eyebrow="CHILLER COP"
      :compact="true"
      :value="resolvedChillerCop"
      :min="4.7"
      :max="6"
      :bands="bands"
      :ticks="ticks"
      :digits="2"
      :show-legend="false"
      :show-marker-label="false"
      :empty-when-non-positive="true"
    />
    <line4 class="metric-pair__secondary" />
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import MetricBand from "./MetricBand.vue";
import line4 from "./line4.vue";
import { METRIC_TONES, buildTicks, toNumber } from "./metricBand";

export default {
  components: {
    MetricBand,
    line4,
  },
  computed: {
    ...mapGetters(["chillerCop", "chillerCopRT", "unitSelete"]),
    resolvedChillerCop() {
      const value = this.unitSelete === "RT"
        ? toNumber(this.chillerCopRT, 0)
        : toNumber(this.chillerCop, 0);
      return value > 0 ? value : null;
    },
    bands() {
      return [
        { label: this.$t("defaultpage.needsImprovement"), start: 4.7, end: 5.2, color: METRIC_TONES.needsImprovement },
        { label: this.$t("defaultpage.average"), start: 5.2, end: 5.7, color: METRIC_TONES.average },
        { label: this.$t("defaultpage.good"), start: 5.7, end: 6.0, color: METRIC_TONES.good },
      ];
    },
    ticks() {
      return buildTicks([4.7, 5.2, 5.7, 6.0], (value) => `${value}`);
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

.metric-pair__primary,
.metric-pair__secondary {
  min-width: 0;
}
</style>
