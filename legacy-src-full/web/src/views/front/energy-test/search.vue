<template>
  <div class="energy-analysis-view">
    <section class="legacy-front-toolbar energy-analysis-toolbar">
      <div class="energy-analysis-toolbar__meta">
        <div class="energy-analysis-toolbar__copy">
          <strong>能效查询</strong>
          <span>按设备对象、时间区间和时间粒度查询能效趋势，先看摘要，再聚焦主对象曲线和设备结果。</span>
        </div>
        <div class="legacy-front-chip">当前对象：{{ searchinfo.drNameList.length }} 组</div>
      </div>
      <form-search
        @handleSearch="handleSearch"
        :searchinfo="searchinfo"
        @exportform="exportform"
      />
    </section>

    <section class="energy-analysis-summary-grid">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="energy-analysis-summary-card"
      >
        <div class="energy-analysis-summary-card__label">{{ card.label }}</div>
        <div
          class="energy-analysis-summary-card__value"
          :class="{ 'energy-analysis-summary-card__value--text': card.textValue }"
        >
          {{ card.value }}
          <span v-if="card.suffix">{{ card.suffix }}</span>
        </div>
        <div class="energy-analysis-summary-card__meta">{{ card.meta }}</div>
      </article>
    </section>

    <section class="legacy-front-tab-shell">
      <div class="legacy-front-section-title">
        <strong>对象趋势分析</strong>
        <span>默认按整体值排序展示主对象，可通过图例滚动查看更多曲线。</span>
      </div>
      <analysis-workbench-tab
        :breakdown-data="breakdownData"
        :breakdown-meta="breakdownMeta"
        breakdown-title="对象构成"
        trend-title="对象趋势"
        trend-meta="默认展示当前筛选下整体值最高的对象曲线"
        table-title="查询结果"
        :table-head-meta="`${tableData.length} 个对象已纳入本次能效查询`"
        :empty-text="'当前筛选下暂无能效查询结果'"
        :x-label="xLabel"
        :x-data="normalizedSeries"
        :table="normalizedTable"
        amount-label="能效"
        :unit-label="unitLabel"
        name-field="object"
        meta-field="__meta"
        value-field="wholeValue"
        name-column-label="设备对象"
        value-column-label="整体值"
        fallback-meta="当前筛选对象"
        :extra-columns="extraColumns"
      />
    </section>
  </div>
</template>

<script>
import formSearch from "./components/formSearch.vue";
import { findEnergySearch } from "@/api/front/energytest";
import { mapGetters } from "vuex";
import dayjs from "dayjs";
import AnalysisWorkbenchTab from "@/views/front/consumption/tabs/AnalysisWorkbenchTab.vue";

export default {
  name: "EnergyTestSearch",
  components: {
    formSearch,
    AnalysisWorkbenchTab
  },
  data() {
    return {
      searchinfo: {
        drNameList: ["CoolingStation"],
        endTime: dayjs().format("YYYY-MM-DD"),
        startTime: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
        timeSpace: 1
      },
      totalEnergyDataY: [],
      tableData: [],
      xLabel: []
    };
  },
  computed: {
    ...mapGetters(["path", "unitSelete"]),
    unitLabel() {
      return `${this.unitSelete}/${this.unitSelete}`;
    },
    normalizedSeries() {
      return (this.totalEnergyDataY || []).map(item => {
        return {
          title: item.title,
          curveValueList: (item.data || []).map(point => {
            return {
              name: point.time,
              value: this.toNumber(point.cop)
            };
          })
        };
      });
    },
    normalizedTable() {
      return (this.tableData || []).map(row => {
        return Object.assign({}, row, {
          __meta: `平均值 ${this.formatValue(row.averageValue)} · 最优 ${this.formatValue(row.tenPercentGoodAverageValue)}`
        });
      });
    },
    breakdownData() {
      return this.tableData.reduce((acc, row) => {
        acc[row.object] = this.toNumber(row.wholeValue);
        return acc;
      }, {});
    },
    breakdownMeta() {
      const topEntry = this.getTopEntry();
      return topEntry.name ? `整体值最高：${topEntry.name}` : "当前筛选下暂无可分析对象";
    },
    extraColumns() {
      return [
        {
          label: "平均值",
          field: "averageValue"
        },
        {
          label: "10%最优均值",
          field: "tenPercentGoodAverageValue"
        },
        {
          label: "10%最差均值",
          field: "tenPercentBadAverageValue"
        }
      ];
    },
    summaryCards() {
      return [
        {
          key: "objects",
          label: "对象数",
          value: String(this.tableData.length),
          suffix: "个",
          meta: "当前筛选下参与查询的对象数量"
        },
        {
          key: "peak",
          label: "趋势峰值",
          value: this.formatValue(this.getPeakValue()),
          suffix: this.unitLabel,
          meta: this.getPeakLabel()
        },
        {
          key: "average",
          label: "整体均值",
          value: this.formatValue(this.getAverageValue()),
          suffix: this.unitLabel,
          meta: "按结果对象整体值求平均"
        },
        {
          key: "leader",
          label: "主导对象",
          value: this.getTopEntry().name || "暂无",
          suffix: "",
          meta: this.getTopEntry().name ? `整体值 ${this.formatValue(this.getTopEntry().value)} ${this.unitLabel}` : "当前暂无可分析对象",
          textValue: true
        }
      ];
    }
  },
  created() {
    this.handleSearch(this.searchinfo);
  },
  methods: {
    toNumber(value) {
      const number = Number(value);
      return isNaN(number) ? 0 : number;
    },
    formatValue(value) {
      const number = this.toNumber(value);
      if (!number) {
        return "0";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: number >= 100 ? 0 : 1
      });
    },
    getAverageValue() {
      if (!this.tableData.length) {
        return 0;
      }
      const total = this.tableData.reduce((sum, row) => sum + this.toNumber(row.wholeValue), 0);
      return total / this.tableData.length;
    },
    getPeakValue() {
      let max = 0;
      (this.totalEnergyDataY || []).forEach(item => {
        (item.data || []).forEach(point => {
          const value = this.toNumber(point.cop);
          if (value > max) {
            max = value;
          }
        });
      });
      return max;
    },
    getPeakLabel() {
      let peak = {
        time: "",
        value: 0
      };
      (this.totalEnergyDataY || []).forEach(item => {
        (item.data || []).forEach(point => {
          const value = this.toNumber(point.cop);
          if (value > peak.value) {
            peak = {
              time: point.time,
              value
            };
          }
        });
      });
      return peak.time ? `峰值出现在 ${peak.time}` : "当前暂无峰值时间";
    },
    getTopEntry() {
      return this.tableData
        .map(row => {
          return {
            name: row.object,
            value: this.toNumber(row.wholeValue)
          };
        })
        .sort((a, b) => b.value - a.value)[0] || { name: "", value: 0 };
    },
    handleSearch(info) {
      this.searchinfo = Object.assign({}, this.searchinfo, info);
      const query = Object.assign({}, info, {
        drNameList: (info.drNameList || []).join(",")
      });
      return findEnergySearch(this.path, query).then(res => {
        this.tableData = res.data.tableList || [];
        this.totalEnergyDataY = res.data.curveList || [];
        this.xLabel = this.totalEnergyDataY.length
          ? (this.totalEnergyDataY[0].data || []).map(item => item.time)
          : [];
      });
    },
    exportform() {
      if (!this.tableData.length) {
        this.$message.warning(this.$t("prompt.pleaseSelectDataExporting"));
        return;
      }

      const tHeader = this.totalEnergyDataY.reduce((pre, next) => {
        pre.push(next.title);
        return pre;
      }, [this.$t("logrizi.time")]);
      const len = tHeader.length;
      const arr = new Array(this.xLabel.length).fill(0).map(() => []);
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < len; j++) {
          if (j === 0) {
            arr[i][j] = this.xLabel[i];
          } else {
            arr[i][j] = this.totalEnergyDataY[j - 1].data[i].cop;
          }
        }
      }

      import("@/vender/Export2Excel").then(excel => {
        excel.export_json_to_excel({
          header: tHeader,
          data: arr,
          filename: this.$t("route.search")
        });
      });
    }
  }
};
</script>
