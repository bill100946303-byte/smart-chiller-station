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
        const chartHeight = this.$refs.chart ? this.$refs.chart.clientHeight : 0;
        const range = buildValueRange(yData, chartHeight);
        const colors = this.resolveGradientColors();

        chart.setOption(
          {
            animationDuration: 400,
            animationDurationUpdate: 400,
            backgroundColor: "transparent",
            color: [this.lineColor],
            grid: {
              top: 10,
              left: range.compact ? 24 : 30,
              right: 10,
              bottom: range.compact ? 18 : 22,
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
                  fontSize: range.compact ? 7 : 8,
                  margin: range.compact ? 6 : 8,
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
                interval: range.interval,
                splitNumber: range.splitNumber,
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
                  fontSize: range.compact ? 7 : 8,
                  margin: range.compact ? 6 : 10,
                  showMaxLabel: true,
                  showMinLabel: true,
                  formatter(value) {
                    const decimals = range.interval >= 1 ? 0 : 1;
                    return formatMetricValue(value, decimals);
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

function buildValueRange(values, chartHeight = 0) {
  const compact = chartHeight > 0 && chartHeight < 92;
  if (!values.length) {
    return {
      min: 0,
      max: 1,
      interval: 1,
      splitNumber: compact ? 1 : 2,
      compact,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return {
      min: Math.floor(min) - 1,
      max: Math.ceil(max) + 1,
      interval: 1,
      splitNumber: compact ? 1 : 2,
      compact,
    };
  }

  const span = max - min;
  let interval;
  let rangeMin;
  let rangeMax;

  // Compact temperature cards need broader, integer-aligned ranges.
  // Narrow ranges with 0.2/0.5 steps produce overlapping labels after page zoom.
  if (span < 6) {
    interval = compact && span > 2 ? 2 : 1;
    rangeMin = Math.floor(min / interval) * interval;
    rangeMax = Math.ceil(max / interval) * interval;
  } else if (span < 20) {
    interval = 2;
    rangeMin = Math.floor(min / interval) * interval;
    rangeMax = Math.ceil(max / interval) * interval;
  } else {
    interval = resolveAxisInterval(span, max);
    rangeMin = Math.floor(min / interval) * interval;
    rangeMax = Math.ceil(max / interval) * interval;
  }

  while (rangeMax - rangeMin < interval * 2) {
    rangeMax += interval;
  }

  // In compact mini-cards, keep only top/bottom ticks to avoid label overlap.
  if (compact) {
    const totalSpan = normalizeAxisNumber(rangeMax - rangeMin);
    if (totalSpan > 0) {
      interval = totalSpan;
    }
  }

  return {
    min: normalizeAxisNumber(rangeMin),
    max: normalizeAxisNumber(rangeMax),
    interval,
    splitNumber: compact ? 1 : 2,
    compact,
  };
}

function resolveAxisInterval(span, maxValue) {
  const absMax = Math.max(Math.abs(maxValue), span);

  if (absMax >= 100) {
    return 10;
  }

  if (absMax >= 30) {
    return 2;
  }

  if (absMax >= 10) {
    return 1;
  }

  return 1;
}

function normalizeAxisNumber(value) {
  return Number(value.toFixed(2));
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
