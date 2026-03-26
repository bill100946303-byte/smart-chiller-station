<template>
  <metric-band
    class="metric-widget metric-widget--wide"
    :title="$t('defaultpage.thermalUnbalanceRate')"
    eyebrow="THERMAL INDEX"
    :compact="true"
    :value="thermalUnbalanceRate"
    unit="%"
    :min="-15"
    :max="15"
    :bands="bands"
    :ticks="ticks"
    :digits="1"
    :show-legend="false"
    :show-marker-label="false"
  />
</template>

<script>
import { mapGetters } from "vuex";
import MetricBand from "./MetricBand.vue";
import { METRIC_TONES, buildTicks } from "./metricBand";

export default {
  components: {
    MetricBand,
  },
  computed: {
    ...mapGetters(["thermalUnbalanceRate"]),
    bands() {
      return [
        { label: "< -10", start: -15, end: -10, color: METRIC_TONES.needsImprovement },
        { label: "-10 ~ -5", start: -10, end: -5, color: METRIC_TONES.average },
        { label: "-5 ~ 0", start: -5, end: 0, color: METRIC_TONES.good },
        { label: "0 ~ 5", start: 0, end: 5, color: METRIC_TONES.good },
        { label: "5 ~ 10", start: 5, end: 10, color: METRIC_TONES.average },
        { label: "> 10", start: 10, end: 15, color: METRIC_TONES.needsImprovement },
      ];
    },
    ticks() {
      return buildTicks([-15, -10, -5, 0, 5, 10, 15], (value) => `${value}`);
    },
  },
};
</script>

<style lang="scss" scoped>
.metric-widget {
  width: 100%;
}

.metric-widget--wide {
  padding-top: 2px;
}
</style>
