<template>
  <div ref="chart" class="cop-box"></div>
</template>

<script>
import echarts from "echarts";

export default {
  props: {
    data: Array,
  },
  data() {
    return {
      chartInstance: null,
    };
  },
  watch: {
    data: {
      handler() {
        this.$nextTick(() => {
          this.initChart();
        });
      },
      deep: true,
      immediate: true,
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

      const rows = (this.data || [])
        .map((item) => ({
          name: item.name,
          value: Number(item.value) || 0,
        }))
        .slice(0, 10);

      const maxValue = rows.reduce((max, item) => Math.max(max, item.value), 0);

      this.chartInstance.setOption({
        backgroundColor: "transparent",
        grid: {
          left: 10,
          right: 36,
          bottom: 4,
          top: 4,
          containLabel: true,
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "rgba(10, 24, 40, 0.94)",
          borderColor: "rgba(122, 190, 255, 0.18)",
          textStyle: { color: "#eef7ff" },
        },
        xAxis: {
          type: "value",
          max: maxValue ? Math.ceil(maxValue + 1) : 10,
          axisTick: { show: false },
          axisLine: {
            lineStyle: { color: "rgba(107, 161, 211, 0.22)" },
          },
          axisLabel: {
            show: false,
          },
          splitLine: {
            lineStyle: {
              type: "dashed",
              color: "rgba(107, 161, 211, 0.08)",
            },
          },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: rows.map((item) => item.name),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "rgba(214, 231, 242, 0.82)",
            fontSize: 10,
            width: 94,
            overflow: "truncate",
            formatter(value, index) {
              const rank = String(index + 1).padStart(2, "0");
              const shortName = value.length > 7 ? `${value.slice(0, 7)}…` : value;
              return `{rank|${rank}}  {name|${shortName}}`;
            },
            rich: {
              rank: {
                color: "rgba(120, 187, 255, 0.72)",
                fontSize: 9,
                width: 18,
              },
              name: {
                color: "rgba(214, 231, 242, 0.84)",
                fontSize: 10,
              },
            },
          },
          splitLine: { show: false },
        },
        series: [
          {
            type: "bar",
            data: rows.map(() => maxValue ? Math.ceil(maxValue + 1) : 10),
            barWidth: 12,
            barGap: "-100%",
            silent: true,
            itemStyle: {
              color: "rgba(255, 255, 255, 0.05)",
              borderRadius: [0, 8, 8, 0],
            },
          },
          {
            type: "bar",
            data: rows.map((item) => item.value),
            barWidth: 12,
            itemStyle: {
              borderRadius: [0, 8, 8, 0],
              color(params) {
                if (params.dataIndex === 0) {
                  return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                    { offset: 0, color: "#6cf0ff" },
                    { offset: 1, color: "#4fa2ff" },
                  ]);
                }
                if (params.dataIndex < 3) {
                  return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                    { offset: 0, color: "#56dfff" },
                    { offset: 1, color: "#3d8bff" },
                  ]);
                }
                return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                  { offset: 0, color: "#4ec8ff" },
                  { offset: 1, color: "#2f7cff" },
                ]);
              },
            },
            label: {
              show: true,
              position: "right",
              color: "#eaf8ff",
              fontSize: 10,
              formatter: ({ value }) => `${value} COP`,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 16,
                shadowColor: "rgba(63, 208, 255, 0.28)",
              },
            },
          },
        ],
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.cop-box {
  width: 100%;
  height: 100%;
}
</style>
