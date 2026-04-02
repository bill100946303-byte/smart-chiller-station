<template>
  <div class="consumption-breakdown">
    <div ref="chart" class="consumption-breakdown__chart"></div>
    <div v-if="sortedItems.length" class="consumption-breakdown__legend">
      <div
        v-for="(item, index) in sortedItems.slice(0, 5)"
        :key="item.name"
        class="consumption-breakdown__legend-item"
      >
        <span
          class="consumption-breakdown__dot"
          :style="{ backgroundColor: colors[index % colors.length] }"
        ></span>
        <div class="consumption-breakdown__copy">
          <div class="consumption-breakdown__name">{{ item.name }}</div>
          <div class="consumption-breakdown__meta">
            <span>{{ formatNumber(item.value) }} {{ unitLabel }}</span>
            <span>{{ item.percent }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="consumption-breakdown__empty">当前筛选下暂无构成数据</div>
  </div>
</template>

<script>
import echarts from "echarts";

export default {
  name: "ConsumptionBreakdownChart",
  props: {
    dataset: {
      type: Object,
      default() {
        return {};
      }
    },
    metricLabel: {
      type: String,
      default: "总量"
    },
    unitLabel: {
      type: String,
      default: "kWh"
    }
  },
  data() {
    return {
      chart: null,
      colors: ["#61e8ff", "#4f8dff", "#9d7cff", "#4ed7a9", "#f0c46b", "#ef7f8d"]
    };
  },
  computed: {
    normalizedItems() {
      const raw = this.dataset || {};
      return Object.keys(raw).reduce((list, key) => {
        const value = Number(raw[key]);
        if (!isNaN(value) && value > 0) {
          list.push({
            name: key,
            value
          });
        }
        return list;
      }, []);
    },
    total() {
      return this.normalizedItems.reduce((sum, item) => sum + item.value, 0);
    },
    sortedItems() {
      const total = this.total;
      return this.normalizedItems
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(item => {
          return {
            name: item.name,
            value: item.value,
            percent: total ? ((item.value / total) * 100).toFixed(1) + "%" : "0%"
          };
        });
    }
  },
  watch: {
    dataset: {
      deep: true,
      immediate: true,
      handler() {
        this.$nextTick(() => {
          this.renderChart();
        });
      }
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
    formatNumber(value) {
      const number = Number(value);
      if (isNaN(number)) {
        return "--";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: number >= 100 ? 0 : 1
      });
    },
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

      const items = this.sortedItems;
      const totalText = this.total ? this.formatNumber(this.total) : "--";

      this.chart.clear();
      this.chart.setOption({
        backgroundColor: "transparent",
        color: this.colors,
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(7, 17, 29, 0.96)",
          borderColor: "rgba(122, 210, 255, 0.18)",
          borderWidth: 1,
          textStyle: {
            color: "#eef6ff"
          },
          formatter: params => {
            const percent = params.percent != null ? params.percent + "%" : "0%";
            return `${params.name}<br/>${this.formatNumber(params.value)} ${this.unitLabel}<br/>占比 ${percent}`;
          }
        },
        graphic: [
          {
            type: "text",
            left: "center",
            top: "42%",
            style: {
              text: this.metricLabel,
              fill: "rgba(185, 212, 231, 0.72)",
              fontSize: 13,
              fontFamily: "PingFang SC"
            }
          },
          {
            type: "text",
            left: "center",
            top: "52%",
            style: {
              text: totalText,
              fill: "#f2f8ff",
              fontSize: 30,
              fontWeight: 700,
              fontFamily: "SF Pro Display, PingFang SC"
            }
          },
          {
            type: "text",
            left: "center",
            top: "66%",
            style: {
              text: this.unitLabel,
              fill: "rgba(157, 184, 205, 0.72)",
              fontSize: 12,
              fontFamily: "PingFang SC"
            }
          }
        ],
        series: [
          {
            type: "pie",
            radius: ["52%", "70%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            label: {
              show: false
            },
            labelLine: {
              show: false
            },
            itemStyle: {
              borderColor: "rgba(7, 16, 28, 0.98)",
              borderWidth: 3,
              shadowBlur: 16,
              shadowColor: "rgba(0, 0, 0, 0.18)"
            },
            data: items.length ? items : [{ value: 1, name: "暂无数据", itemStyle: { color: "rgba(255,255,255,0.08)" } }]
          }
        ]
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.consumption-breakdown {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  height: 100%;
}

.consumption-breakdown__chart {
  height: 280px;
  min-height: 280px;
}

.consumption-breakdown__legend {
  display: grid;
  gap: 10px;
}

.consumption-breakdown__legend-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(132, 187, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.consumption-breakdown__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04);
}

.consumption-breakdown__copy {
  min-width: 0;
  flex: 1;
}

.consumption-breakdown__name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(240, 247, 255, 0.96);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.consumption-breakdown__meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  font-size: 12px;
  color: rgba(183, 209, 227, 0.72);
}

.consumption-breakdown__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border-radius: 18px;
  border: 1px dashed rgba(132, 187, 255, 0.12);
  color: rgba(177, 201, 219, 0.68);
}
</style>
