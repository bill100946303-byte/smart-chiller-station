<template>
  <div class="energy-analysis-view">
    <section class="legacy-front-toolbar energy-analysis-toolbar">
      <div class="energy-analysis-toolbar__meta">
        <div class="energy-analysis-toolbar__copy">
          <strong>能效对比</strong>
          <span>围绕不同时间组的整体值、平均值与最优最差表现做对照，先看摘要，再读曲线，最后比结果对象。</span>
        </div>
        <div class="legacy-front-chip">当前时段：{{ searchinfo.timeList.length }} 组</div>
      </div>
      <compare-search
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
        <strong>时间组对比</strong>
        <span>将已选择时间组映射为对比曲线，突出峰值时间、整体值差异和对象平均表现。</span>
      </div>
      <analysis-workbench-tab
        :breakdown-data="breakdownData"
        :breakdown-meta="breakdownMeta"
        breakdown-title="对象构成"
        trend-title="时间组趋势"
        trend-meta="默认显示对比结果中整体值最高的时间组曲线"
        table-title="对比结果"
        :table-head-meta="`${tableData.length} 个对象完成本次时间组对比`"
        :empty-text="'当前筛选下暂无能效对比结果'"
        :x-label="chartXAxis"
        :x-data="normalizedSeries"
        :table="normalizedTable"
        amount-label="对比值"
        :unit-label="unitLabel"
        name-field="object"
        meta-field="__meta"
        value-field="wholeValue"
        name-column-label="对象"
        value-column-label="整体值"
        fallback-meta="当前对比对象"
        :extra-columns="extraColumns"
      />
    </section>
  </div>
</template>

<script>
import CompareSearch from "./components/compareSearch.vue";
import { findEnergyContrast } from "@/api/front/energytest";
import { mapGetters } from "vuex";
import dayjs from "dayjs";
import AnalysisWorkbenchTab from "@/views/front/consumption/tabs/AnalysisWorkbenchTab.vue";

export default {
  name: "EnergyTestCompare",
  components: {
    CompareSearch,
    AnalysisWorkbenchTab
  },
  data() {
    return {
      searchinfo: {
        drName: "CoolingStation",
        timeList: [dayjs().format("YYYY-MM-DD")],
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
    chartXAxis() {
      if (this.xLabel && this.xLabel.length) {
        return this.xLabel;
      }
      return this.totalEnergyDataY.length
        ? (this.totalEnergyDataY[0].data || []).map(item => item.time)
        : [];
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
      return topEntry.name ? `主导对象：${topEntry.name}` : "当前筛选下暂无可分析对象";
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
          key: "times",
          label: "对比时段",
          value: String(this.searchinfo.timeList.length),
          suffix: "组",
          meta: "当前已选时间组数量"
        },
        {
          key: "objects",
          label: "对象数",
          value: String(this.tableData.length),
          suffix: "个",
          meta: "纳入本次时间组对比的对象数量"
        },
        {
          key: "peak",
          label: "峰值时段",
          value: this.getPeakPoint().time || "暂无",
          suffix: "",
          meta: this.getPeakPoint().time ? `峰值 ${this.formatValue(this.getPeakPoint().value)} ${this.unitLabel}` : "当前暂无峰值时间",
          textValue: true
        },
        {
          key: "leader",
          label: "最佳对象",
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
    getPeakPoint() {
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
      return peak;
    },
    handleSearch(info) {
      this.searchinfo = Object.assign({}, this.searchinfo, info, {
        timeList: (info.timeList || []).slice()
      });
      const query = Object.assign({}, info, {
        timeList: (info.timeList || []).join(",")
      });
      return findEnergyContrast(this.path, query).then(res => {
        this.tableData = res.data.tableList || [];
        this.totalEnergyDataY = res.data.curveList || [];
        this.xLabel = this.totalEnergyDataY.find(item => (item.data || []).length === 24)
          ? this.totalEnergyDataY.find(item => (item.data || []).length === 24).data.map(item => item.time)
          : [];
      });
    },
    exportform() {
      if (!this.totalEnergyDataY.length) {
        this.$message.warning(this.$t("prompt.pleaseSelectDataExporting"));
        return;
      }
      const tHeader = this.totalEnergyDataY.reduce((pre, next) => {
        pre.push(next.title);
        return pre;
      }, [this.$t("logrizi.time")]);
      const len = tHeader.length;
      const xAxis = this.chartXAxis;
      const arr = new Array(xAxis.length).fill(0).map(() => []);
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < len; j++) {
          if (j === 0) {
            arr[i][j] = xAxis[i];
          } else {
            arr[i][j] = this.totalEnergyDataY[j - 1].data[i].cop;
          }
        }
      }
      import("@/vender/Export2Excel").then(excel => {
        excel.export_json_to_excel({
          header: tHeader,
          data: arr,
          filename: this.$t("route.compare")
        });
      });
    }
  }
};
</script>
