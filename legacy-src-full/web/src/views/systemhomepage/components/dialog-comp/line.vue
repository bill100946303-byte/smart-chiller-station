<template>
  <div ref="chart" class="line-chart"/>
</template>

<script>
import echarts from "echarts";

export default {
  props: ["xData"],
  data() {
    return {
      charts: null,
    };
  },
  watch: {
    xData: {
      handler() {
        this.$nextTick(() => {
          this.renderChart();
        });
      },
      deep: true,
      immediate: true,
    },
  },
  mounted() {
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
    if (this.charts) {
      this.charts.dispose();
      this.charts = null;
    }
  },
  methods: {
    handleResize() {
      if (this.charts) {
        this.charts.resize();
      }
    },
    renderChart() {
      if (!this.$refs.chart) {
        return;
      }

      if (!this.charts) {
        this.charts = echarts.init(this.$refs.chart);
      }

      const source = Array.isArray(this.xData) ? this.xData : [];
      const xLabel = source.map(item => item.name || "--");
      const values = source.map(item => Number(item.value) || 0);

      this.charts.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(7, 18, 31, 0.94)",
          borderColor: "rgba(118, 231, 255, 0.18)",
          textStyle: {
            color: "#eef8ff",
          },
          axisPointer: {
            lineStyle: {
              color: "rgba(118, 231, 255, 0.38)",
            },
          },
        },
        grid: {
          top: 32,
          left: 56,
          right: 24,
          bottom: 32,
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          axisLine: {
            lineStyle: {
              color: "rgba(123, 188, 229, 0.16)",
            },
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            color: "rgba(196, 220, 239, 0.72)",
            fontSize: 12,
          },
          splitLine: {
            show: false,
          },
          data: xLabel,
        },
        yAxis: {
          type: "value",
          min: function(value) {
            return value.min > 0 ? 0 : Math.floor(value.min);
          },
          name: `${this.$t("public.unit")} : KWH`,
          nameTextStyle: {
            color: "rgba(196, 220, 239, 0.72)",
            fontSize: 12,
            padding: [0, 0, 0, 10],
          },
          splitLine: {
            lineStyle: {
              type: "dashed",
              color: "rgba(123, 188, 229, 0.12)",
            },
          },
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            color: "rgba(196, 220, 239, 0.72)",
            fontSize: 12,
          },
        },
        series: [
          {
            type: "line",
            data: values,
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            showSymbol: false,
            lineStyle: {
              width: 3,
              color: "#63ebff",
            },
            itemStyle: {
              color: "#63ebff",
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(99, 235, 255, 0.26)" },
                { offset: 1, color: "rgba(99, 235, 255, 0.03)" },
              ]),
            },
          },
        ],
      }, true);
    },
  },
};
</script>

<style lang="scss" scoped>
.line-chart {
  width: 100%;
  min-height: 360px;
}
</style>
