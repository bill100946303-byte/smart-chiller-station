<template>
  <div class="energy-pie-panel">
    <template v-if="normalizedItems.length">
      <div class="energy-pie-panel__chart-wrap">
        <div ref="chart" class="energy-pie-chart" />
      </div>
      <div class="energy-pie-panel__list">
        <div
          v-for="item in normalizedItems"
          :key="item.name"
          class="energy-pie-panel__item"
        >
          <span class="energy-pie-panel__swatch" :style="{ background: item.color }" />
          <div class="energy-pie-panel__copy" :title="item.name">
            <div class="energy-pie-panel__name">{{ item.name }}</div>
            <div class="energy-pie-panel__meta">{{ item.percent }}%</div>
          </div>
          <div class="energy-pie-panel__value">{{ item.valueText }}</div>
        </div>
      </div>
    </template>
    <div v-else class="energy-analysis-empty">当前视图下暂无分项构成</div>
  </div>
</template>
<script>
import echarts from "echarts";

export default {
  props: {
    id: {
      type: String,
      default: ""
    },
    echartdata: {
      type: Object,
      default() {
        return {};
      }
    }
  },

  data() {
    return {
      charts: null,
      colorPalette: [
        "rgba(15, 241, 185, 1)",
        "rgba(15, 227, 241, 1)",
        "#2292f0",
        "#99ffff",
        "#00FFFF",
        "#4AEAB0",
      ]
    };
  },
  computed: {
    normalizedItems() {
      const items = Object.keys(this.echartdata || {})
        .reduce((list, key) => {
          const value = this.toNumber(this.echartdata[key]);
          if (!value) {
            return list;
          }
          list.push({
            name: key,
            value
          });
          return list;
        }, [])
        .sort((a, b) => b.value - a.value);

      if (!items.length) {
        return [];
      }

      const topItems = items.slice(0, 4);
      const rest = items.slice(4);
      if (rest.length) {
        const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
        if (otherValue > 0) {
          topItems.push({
            name: "其他",
            value: otherValue
          });
        }
      }

      const total = topItems.reduce((sum, item) => sum + item.value, 0) || 1;
      return topItems.map((item, index) => ({
        ...item,
        color: this.colorPalette[index % this.colorPalette.length],
        percent: ((item.value / total) * 100).toFixed(2).replace(/\.00$/, ""),
        valueText: `${this.formatValue(item.value)} kWh`
      }));
    }
  },
  mounted() {
    window.addEventListener("resize", this.resizeChart);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeChart);
    this.disposeChart();
  },
  watch: {
    echartdata: {
      handler() {
        this.$nextTick(() => {
          this.initChart();
        });
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    toNumber(value) {
      const number = Number(String(value || "").replace(/,/g, ""));
      return isNaN(number) ? 0 : number;
    },
    formatValue(value) {
      const number = this.toNumber(value);
      if (!number) {
        return "0";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: 0,
      });
    },
    ensureChart() {
      if (!this.charts && this.$refs.chart) {
        this.charts = echarts.init(this.$refs.chart);
      }
    },
    disposeChart() {
      if (this.charts) {
        this.charts.dispose();
        this.charts = null;
      }
    },
    resizeChart() {
      if (this.charts) {
        this.charts.resize();
      }
    },
    initChart() {
      this.ensureChart();
      if (!this.charts) {
        return;
      }
      this.charts.clear();
      const arr = this.normalizedItems.map(item => ({
        name: item.name,
        value: item.value
      }));
      this.charts.setOption({
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(7, 18, 29, 0.95)",
          textStyle: {
            color: "rgba(245, 251, 255, 0.96)",
          },
          formatter: params => `${params.name}: ${this.formatValue(params.value)} kWh (${params.percent}%)`,
        },
        color: this.normalizedItems.map(item => item.color),
        graphic: arr.length ? [] : [{
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "当前视图下暂无分项构成",
            fill: "rgba(177, 201, 219, 0.68)",
            fontSize: 13
          }
        }],

        series: [
          {
            type: "pie",
            radius: ["52%", "72%"],
            center: ["50%", "52%"],
            data: arr,
            hoverAnimation: false,
            avoidLabelOverlap: true,
            minShowLabelAngle: 12,
            itemStyle: {
              normal: {
                borderWidth: 2,
              },
            },
            label: {
              show: false
            },
            labelLine: {
              show: false
            }
          },
        ],
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.energy-pie-panel {
  display: grid;
  grid-template-columns: minmax(132px, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.energy-pie-panel__chart-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  height: 100%;
}

.energy-pie-chart {
  width: 100%;
  height: 100%;
}

.energy-pie-panel__list {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.energy-pie-panel__item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.energy-pie-panel__swatch {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 10px rgba(103, 226, 255, 0.24);
}

.energy-pie-panel__copy {
  min-width: 0;
}

.energy-pie-panel__name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(245, 251, 255, 0.94);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.energy-pie-panel__meta {
  margin-top: 2px;
  font-size: 10px;
  color: rgba(171, 205, 225, 0.68);
}

.energy-pie-panel__value {
  font-size: 12px;
  font-weight: 700;
  color: rgba(124, 240, 255, 0.94);
  white-space: nowrap;
}
</style>
