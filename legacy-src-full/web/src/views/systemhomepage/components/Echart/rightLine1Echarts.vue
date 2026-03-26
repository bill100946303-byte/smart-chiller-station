<template>
  <div ref="chart" id="rightLine1Echarts" class="right-line-gauge" />
</template>

<script>
import echarts from "echarts";
import { mapGetters } from "vuex";
import {
  METRIC_TONES,
  formatMetricValue,
  getActiveBand,
  normalizeBands,
  toNumber,
  valueToPercent,
} from "../side/metricBand";

const LABEL_TOLERANCE_FACTOR = 40;

export default {
  props: {
    value: {
      type: [Number, String],
      default: null,
    },
  },
  computed: {
    ...mapGetters(["coldStationCop", "coldStationCopRT", "unitSelete"]),
    resolvedValue() {
      if (this.value !== null && this.value !== undefined && this.value !== "") {
        return toNumber(this.value, 0);
      }
      return this.unitSelete === "RT"
        ? toNumber(this.coldStationCopRT, 0)
        : toNumber(this.coldStationCop, 0);
    },
    gaugeConfig() {
      const isRT = this.unitSelete === "RT";
      const min = isRT ? 0.55 : 2.5;
      const max = isRT ? 1.05 : 6;
      const bands = isRT
        ? [
            { start: 0.55, end: 0.7, label: this.$t("defaultpage.needsImprovement"), color: METRIC_TONES.needsImprovement },
            { start: 0.7, end: 0.85, label: this.$t("defaultpage.average"), color: METRIC_TONES.average },
            { start: 0.85, end: 1.0, label: this.$t("defaultpage.good"), color: METRIC_TONES.good },
            { start: 1.0, end: 1.05, label: this.$t("defaultpage.excellent"), color: METRIC_TONES.excellent },
          ]
        : [
            { start: 2.5, end: 3.5, label: this.$t("defaultpage.needsImprovement"), color: METRIC_TONES.needsImprovement },
            { start: 3.5, end: 4.15, label: this.$t("defaultpage.average"), color: METRIC_TONES.average },
            { start: 4.15, end: 5.0, label: this.$t("defaultpage.good"), color: METRIC_TONES.good },
            { start: 5.0, end: 6.0, label: this.$t("defaultpage.excellent"), color: METRIC_TONES.excellent },
          ];

      return {
        min,
        max,
        bands: normalizeBands(bands, min, max),
        labelMarks: isRT
          ? [
              { value: 0.7, label: "0.7", key: "average" },
              { value: 0.85, label: "0.85", key: "good" },
              { value: 1.0, label: "1.0", key: "excellent" },
            ]
          : [
              { value: 3.5, label: "3.5", key: "needsImprovement" },
              { value: 4.15, label: "4.15", key: "average" },
              { value: 5.0, label: "5.0", key: "good" },
            ],
      };
    },
    activeBand() {
      return getActiveBand(this.resolvedValue, this.gaugeConfig.bands, this.gaugeConfig.bands[0]);
    },
  },
  data() {
    return {
      chart: null,
      resizeHandler: null,
    };
  },
  watch: {
    resolvedValue: {
      immediate: true,
      handler() {
        this.renderChart();
      },
    },
    unitSelete() {
      this.renderChart();
    },
  },
  mounted() {
    this.resizeHandler = () => {
      if (this.chart) {
        this.chart.resize();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
    this.$nextTick(() => {
      this.renderChart();
    });
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeHandler);
    this.disposeChart();
  },
  methods: {
    ensureChart() {
      const el = this.$refs.chart;
      if (!el) {
        return null;
      }

      if (this.chart) {
        return this.chart;
      }

      this.chart = echarts.getInstanceByDom(el) || echarts.init(el);
      return this.chart;
    },
    disposeChart() {
      if (this.chart) {
        this.chart.dispose();
      }
      this.chart = null;
    },
    renderChart() {
      this.$nextTick(() => {
        const chart = this.ensureChart();
        if (!chart) {
          return;
        }

        const { min, max, bands, labelMarks } = this.gaugeConfig;
        const span = Math.max(max - min, 1);
        const activeLabel = this.activeBand && this.activeBand.label ? this.activeBand.label : "";
        const labelTolerance = span / LABEL_TOLERANCE_FACTOR;
        const axisLineColors = bands.map((band) => [
          clampToPercent(band.end, min, max),
          band.color,
        ]);

        chart.setOption(
          {
            animationDuration: 450,
            animationDurationUpdate: 450,
            backgroundColor: "transparent",
            series: [
              {
                type: "gauge",
                center: ["50%", "64%"],
                radius: "92%",
                min,
                max,
                startAngle: 220,
                endAngle: -40,
                splitNumber: 20,
                axisLine: {
                  lineStyle: {
                    width: 14,
                    color: axisLineColors,
                  },
                },
                axisTick: {
                  splitNumber: 5,
                  length: 6,
                  lineStyle: {
                    color: "rgba(255,255,255,0.18)",
                    width: 1,
                  },
                },
                splitLine: {
                  length: 14,
                  lineStyle: {
                    color: "rgba(255,255,255,0.3)",
                    width: 2,
                  },
                },
                axisLabel: {
                  color: "rgba(224, 240, 255, 0.8)",
                  distance: 12,
                  fontSize: 11,
                  formatter(value) {
                    const label = labelMarks.find((mark) => Math.abs(value - mark.value) <= labelTolerance);
                    if (!label) {
                      return "";
                    }
                    return `{${label.key}|${label.label}}`;
                  },
                  rich: {
                    needsImprovement: {
                      color: METRIC_TONES.needsImprovement,
                      fontWeight: 600,
                    },
                    average: {
                      color: METRIC_TONES.average,
                      fontWeight: 600,
                    },
                    good: {
                      color: METRIC_TONES.good,
                      fontWeight: 600,
                    },
                    excellent: {
                      color: METRIC_TONES.excellent,
                      fontWeight: 600,
                    },
                  },
                },
                pointer: {
                  width: 4,
                  length: "62%",
                  itemStyle: {
                    color: activeBand.color || METRIC_TONES.average,
                    shadowColor: activeBand.color || METRIC_TONES.average,
                    shadowBlur: 16,
                  },
                },
                title: {
                  show: false,
                },
                detail: {
                  valueAnimation: true,
                  offsetCenter: [0, "22%"],
                  color: activeBand.color || METRIC_TONES.average,
                  formatter(value) {
                    return [
                      `{value|${formatMetricValue(value, 2)}}`,
                      `{state|${activeLabel}}`,
                    ].join("\n");
                  },
                  rich: {
                    value: {
                      fontSize: 30,
                      fontWeight: 700,
                      color: activeBand.color || METRIC_TONES.average,
                      lineHeight: 34,
                    },
                    state: {
                      fontSize: 13,
                      color: "rgba(224, 240, 255, 0.82)",
                      lineHeight: 18,
                      fontWeight: 500,
                    },
                  },
                },
                data: [
                  {
                    value: this.resolvedValue,
                  },
                ],
              },
            ],
          },
          true
        );

        chart.resize();
      });
    },
  },
};

function clampToPercent(value, min, max) {
  const span = Math.max(max - min, 1);
  return valueToPercent(value, min, max) / 100;
}
</script>

<style lang="scss" scoped>
.right-line-gauge {
  width: 100%;
  height: 100%;
  min-height: 240px;
}
</style>
