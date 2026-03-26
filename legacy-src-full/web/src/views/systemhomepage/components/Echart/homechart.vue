<template>
  <div ref="chart" id="linechart" />
</template>

<script>
import echarts from "echarts";

export default {
  props: ["id", "totalEnergyDataX", "totalEnergyDataY"],
  data() {
    return {
      chartInstance: null,
    };
  },
  watch: {
    totalEnergyDataY: {
      deep: true,
      immediate: true,
      handler() {
        this.$nextTick(() => {
          this.initChart();
        });
      },
    },
  },
  mounted() {
    window.addEventListener("resize", this.resizeChart);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeChart);
    if (this.chartInstance) {
      this.chartInstance.dispose();
      this.chartInstance = null;
    }
  },
  methods: {
    resizeChart() {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    },
    initChart() {
      if (!this.$refs.chart) {
        return;
      }
      if (!this.chartInstance) {
        this.chartInstance = echarts.init(this.$refs.chart);
      }

      const values = (this.totalEnergyDataY || []).map((value) => {
        const numeric = Number(value) / 1000;
        return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
      });

      this.chartInstance.setOption({
        color: ["#63e8ff"],
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(10, 24, 40, 0.94)",
          borderColor: "rgba(122, 190, 255, 0.18)",
          textStyle: { color: "#eef7ff" },
        },
        grid: {
          top: 22,
          left: 34,
          right: 12,
          bottom: 30,
        },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: this.totalEnergyDataX,
            axisTick: { show: false },
            axisLabel: {
              color: "rgba(193, 220, 236, 0.66)",
              fontSize: 11,
              margin: 12,
            },
            axisLine: {
              lineStyle: {
                color: "rgba(107, 161, 211, 0.22)",
              },
            },
          },
        ],
        yAxis: [
          {
            name: "mwh",
            nameTextStyle: {
              color: "rgba(193, 220, 236, 0.72)",
              fontSize: 11,
              padding: [0, 0, 0, -10],
            },
            splitNumber: 4,
            type: "value",
            axisTick: { show: false },
            axisLine: { show: false },
            splitLine: {
              lineStyle: {
                type: "dashed",
                color: "rgba(107, 161, 211, 0.16)",
              },
            },
            axisLabel: {
              color: "rgba(193, 220, 236, 0.64)",
              fontSize: 11,
            },
          },
        ],
        series: [
          {
            symbolSize: 0,
            smooth: true,
            type: "line",
            data: values,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(99, 232, 255, 0.42)" },
                { offset: 1, color: "rgba(63, 124, 255, 0.02)" },
              ]),
            },
            lineStyle: {
              color: "#63e8ff",
              shadowColor: "rgba(99, 232, 255, 0.36)",
              shadowBlur: 12,
              width: 3,
            },
            emphasis: {
              focus: "series",
            },
          },
        ],
      });
    },
  },
};
</script>

<style lang="scss" scoped>
#linechart {
  width: 100%;
  height: 100%;
}
</style>
