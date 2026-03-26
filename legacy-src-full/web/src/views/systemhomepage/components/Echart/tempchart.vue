<template>
  <div ref="chart" :id="id" class="linechart" />
</template>

<script>
import echarts from "echarts";
import dayjs from "dayjs";
import { mapGetters } from "vuex";
import { formatMetricValue, toNumber } from "../side/metricBand";

export default {
  props: ["id", "totalEnergyDataX", "totalEnergyDataY", "info"],
  computed: {
    ...mapGetters(["websocket", "userid"]),
    lineColor() {
      return this.info && this.info.length ? this.info[0] : "#58d0ff";
    },
  },
  data() {
    return {
      charts: null,
      resizeHandler: null,
    };
  },
  watch: {
    id: {
      immediate: true,
      handler() {
        this.rebuildChart();
      },
    },
    totalEnergyDataY: {
      deep: true,
      immediate: true,
      handler() {
        this.rebuildChart();
      },
    },
    info: {
      deep: true,
      handler() {
        this.rebuildChart();
      },
    },
  },
  mounted() {
    this.resizeHandler = () => {
      if (this.charts) {
        this.charts.resize();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
    this.$nextTick(() => {
      this.rebuildChart();
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

      if (this.charts) {
        return this.charts;
      }

      this.charts = echarts.getInstanceByDom(el) || echarts.init(el);
      return this.charts;
    },
    disposeChart() {
      if (this.charts) {
        this.charts.dispose();
      }
      this.charts = null;
    },
    rebuildChart() {
      this.$nextTick(() => {
        const chart = this.ensureChart();
        if (!chart) {
          return;
        }

        const seriesData = Array.isArray(this.totalEnergyDataY) ? this.totalEnergyDataY : [];
        const prepared = seriesData.map((item) => ({
          name: item.name,
          value: toNumber(item.value, 0),
        }));
        const xData = prepared.map((item) => formatTimestamp(item.name));
        const yData = prepared.map((item) => item.value);
        const range = buildValueRange(yData);
        const colors = this.resolveGradientColors();

        chart.setOption(
          {
            animationDuration: 400,
            animationDurationUpdate: 400,
            backgroundColor: "transparent",
            color: [this.lineColor],
            grid: {
              top: 14,
              left: 34,
              right: 12,
              bottom: 24,
              containLabel: true,
            },
            tooltip: {
              trigger: "axis",
              confine: true,
              backgroundColor: "rgba(5, 16, 28, 0.96)",
              borderColor: "rgba(124, 205, 255, 0.18)",
              borderWidth: 1,
              textStyle: {
                color: "#eef7ff",
              },
              axisPointer: {
                lineStyle: {
                  color: "rgba(122, 212, 255, 0.72)",
                  width: 1,
                },
              },
              formatter(params) {
                const item = Array.isArray(params) ? params[0] : params;
                if (!item) {
                  return "";
                }
                return [
                  `<div style="font-size:12px;color:rgba(225,240,255,.78);margin-bottom:6px;">${item.axisValue || ""}</div>`,
                  `<div style="font-size:14px;font-weight:600;color:#fff;">${formatMetricValue(item.data, 2)} ℃</div>`,
                ].join("");
              },
            },
            xAxis: [
              {
                type: "category",
                boundaryGap: false,
                data: xData,
                axisTick: {
                  show: false,
                },
                axisLabel: {
                  color: "rgba(200, 222, 241, 0.72)",
                  fontSize: 8,
                  margin: 8,
                  hideOverlap: true,
                  interval: getLabelInterval(xData.length),
                  formatter(value) {
                    return compactTimeLabel(value);
                  },
                },
                axisLine: {
                  lineStyle: {
                    color: "rgba(120, 185, 233, 0.18)",
                    width: 1,
                  },
                },
              },
            ],
            yAxis: [
              {
                type: "value",
                min: range.min,
                max: range.max,
                splitNumber: 3,
                axisTick: {
                  show: false,
                },
                splitLine: {
                  lineStyle: {
                    type: "dashed",
                    color: "rgba(129, 153, 173, 0.14)",
                    width: 1,
                  },
                },
                axisLabel: {
                  color: "rgba(200, 222, 241, 0.64)",
                  fontSize: 8,
                  margin: 10,
                  showMaxLabel: false,
                  formatter(value) {
                    return formatMetricValue(value, 1);
                  },
                },
                axisLine: {
                  lineStyle: {
                    color: "rgba(120, 185, 233, 0.18)",
                    width: 1,
                  },
                },
              },
            ],
            series: [
              {
                name: this.info && this.info[2] ? this.info[2] : "trend",
                type: "line",
                data: yData,
                symbol: "circle",
                symbolSize: 4,
                smooth: true,
                showSymbol: false,
                lineStyle: {
                  width: 3,
                  color: colors.line,
                  shadowBlur: 12,
                  shadowColor: `${this.lineColor}40`,
                },
                itemStyle: {
                  color: colors.point,
                },
                areaStyle: {
                  color: colors.area,
                },
                markLine: buildZeroLine(range),
              },
            ],
          },
          true
        );

        chart.resize();
      });
    },
    resolveGradientColors() {
      const color = this.lineColor;
      return {
        line: color,
        point: color,
        area: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${color}4d` },
          { offset: 1, color: `${color}05` },
        ]),
      };
    },
  },
};

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  return text.length > 5 ? dayjs(text).format("MM/DD HH:mm") : text;
}

function buildValueRange(values) {
  if (!values.length) {
    return {
      min: 0,
      max: 1,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return {
      min: min - 1,
      max: max + 1,
    };
  }

  const padding = (max - min) * 0.15;
  return {
    min: min - padding,
    max: max + padding,
  };
}

function buildZeroLine(range) {
  if (range.min >= 0 || range.max <= 0) {
    return undefined;
  }

  return {
    silent: true,
    symbol: "none",
    lineStyle: {
      color: "rgba(140, 186, 214, 0.3)",
      type: "dashed",
      width: 1,
    },
    label: {
      show: false,
    },
    data: [{ yAxis: 0 }],
  };
}

function getLabelInterval(length) {
  if (length <= 3) {
    return 0;
  }

  if (length <= 6) {
    return 2;
  }

  return Math.max(2, Math.ceil(length / 4));
}

function compactTimeLabel(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  if (text.includes(" ")) {
    return text.slice(-5);
  }

  return text.length > 5 ? text.slice(-5) : text;
}
</script>

<style lang="scss" scoped>
.linechart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
