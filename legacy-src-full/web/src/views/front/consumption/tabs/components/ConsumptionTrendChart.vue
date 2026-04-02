<template>
  <div ref="chart" class="consumption-trend-chart"></div>
</template>

<script>
import echarts from "echarts";

export default {
  name: "ConsumptionTrendChart",
  props: {
    seriesData: {
      type: Array,
      default() {
        return [];
      }
    },
    xLabel: {
      type: Array,
      default() {
        return [];
      }
    },
    metricLabel: {
      type: String,
      default: "能耗"
    },
    unitLabel: {
      type: String,
      default: "kWh"
    },
    visibleCount: {
      type: Number,
      default: 4
    }
  },
  data() {
    return {
      chart: null,
      colors: ["#61e8ff", "#4f8dff", "#9d7cff", "#4ed7a9", "#ef7f8d", "#f0c46b", "#4aead0", "#8dc4ff"]
    };
  },
  computed: {
    normalizedSeries() {
      return (this.seriesData || [])
        .map(item => {
          const points = (item.curveValueList || []).map(point => Number(point.value) || 0);
          const total = points.reduce((sum, value) => sum + value, 0);
          return {
            name: item.title || "未命名设备",
            total,
            data: points
          };
        })
        .sort((a, b) => b.total - a.total);
    },
    selectedLegendMap() {
      const selected = {};
      this.normalizedSeries.forEach((item, index) => {
        selected[item.name] = index < this.visibleCount;
      });
      return selected;
    },
    legendFormatter() {
      return name => {
        return name.length > 8 ? `${name.slice(0, 8)}…` : name;
      };
    },
    gridTop() {
      return this.normalizedSeries.length > 6 ? 76 : 64;
    }
  },
  watch: {
    seriesData: {
      deep: true,
      immediate: true,
      handler() {
        this.$nextTick(() => {
          this.renderChart();
        });
      }
    },
    xLabel() {
      this.$nextTick(() => {
        this.renderChart();
      });
    }
  },
  mounted() {
    window.addEventListener("resize", this.resizeChart);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeChart);
    this.disposeChart();
  },
  methods: {
    ensureChart() {
      if (!this.chart && this.$refs.chart) {
        this.chart = echarts.init(this.$refs.chart);
      }
    },
    disposeChart() {
      if (this.chart) {
        this.chart.dispose();
        this.chart = null;
      }
    },
    resizeChart() {
      if (this.chart) {
        this.chart.resize();
      }
    },
    renderChart() {
      this.ensureChart();
      if (!this.chart) {
        return;
      }

      const series = this.normalizedSeries.map((item, index) => {
        return {
          name: item.name,
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 0,
          showSymbol: false,
          data: item.data,
          lineStyle: {
            width: index < 3 ? 2.6 : 1.8,
            color: this.colors[index % this.colors.length]
          },
          itemStyle: {
            color: this.colors[index % this.colors.length]
          },
          areaStyle: index < 2 ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: this.hexToRgba(this.colors[index % this.colors.length], 0.24)
              },
              {
                offset: 1,
                color: this.hexToRgba(this.colors[index % this.colors.length], 0)
              }
            ])
          } : undefined,
          emphasis: {
            focus: "series"
          }
        };
      });

      this.chart.clear();
      this.chart.setOption({
        backgroundColor: "transparent",
        color: this.colors,
        animationDuration: 320,
        tooltip: {
          trigger: "axis",
          confine: true,
          backgroundColor: "rgba(7, 18, 30, 0.96)",
          borderColor: "rgba(122, 210, 255, 0.16)",
          borderWidth: 1,
          textStyle: {
            color: "#eef6ff"
          }
        },
        legend: {
          type: "scroll",
          top: 4,
          left: 4,
          right: 18,
          pageIconColor: "#6cd7ff",
          pageIconInactiveColor: "rgba(129, 168, 198, 0.36)",
          pageTextStyle: {
            color: "rgba(183, 209, 227, 0.72)"
          },
          itemWidth: 12,
          itemHeight: 6,
          itemGap: 12,
          textStyle: {
            color: "rgba(220, 236, 249, 0.84)",
            fontSize: 11
          },
          formatter: this.legendFormatter,
          selected: this.selectedLegendMap,
          data: this.normalizedSeries.map(item => item.name)
        },
        grid: {
          top: this.gridTop,
          left: 46,
          right: 20,
          bottom: 38
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: this.xLabel,
          axisTick: {
            show: false
          },
          axisLine: {
            lineStyle: {
              color: "rgba(117, 147, 173, 0.22)"
            }
          },
          axisLabel: {
            color: "rgba(197, 218, 235, 0.72)",
            fontSize: 11,
            hideOverlap: true
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(117, 147, 173, 0.1)",
              type: "dashed"
            }
          }
        },
        yAxis: {
          type: "value",
          name: this.unitLabel,
          nameGap: 16,
          nameTextStyle: {
            color: "rgba(183, 209, 227, 0.72)",
            fontSize: 11
          },
          axisTick: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisLabel: {
            color: "rgba(197, 218, 235, 0.72)",
            fontSize: 11
          },
          splitLine: {
            lineStyle: {
              color: "rgba(117, 147, 173, 0.14)",
              type: "dashed"
            }
          }
        },
        graphic: series.length ? [] : [{
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: `当前筛选下暂无${this.metricLabel}趋势`,
            fill: "rgba(177, 201, 219, 0.68)",
            fontSize: 14
          }
        }],
        series
      });
    },
    hexToRgba(color, alpha) {
      if (color.indexOf("#") !== 0) {
        return color;
      }
      const hex = color.replace("#", "");
      const size = hex.length === 3 ? 1 : 2;
      const values = [];
      for (let i = 0; i < 3; i++) {
        const segment = hex.substr(i * size, size);
        values.push(parseInt(size === 1 ? segment + segment : segment, 16));
      }
      return `rgba(${values.join(",")}, ${alpha})`;
    }
  }
};
</script>

<style lang="scss" scoped>
.consumption-trend-chart {
  width: 100%;
  min-height: 360px;
  height: 100%;
}
</style>
