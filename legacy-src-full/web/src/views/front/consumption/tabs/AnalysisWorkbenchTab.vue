<template>
  <div class="consumption-tab-shell">
    <div class="consumption-tab-shell__charts">
      <section class="legacy-front-card consumption-chart-card consumption-chart-card--breakdown">
        <div class="legacy-front-section-title">
          <strong>{{ breakdownTitle }}</strong>
          <span>{{ resolvedBreakdownMeta }}</span>
        </div>
        <div class="consumption-chart-card__body">
          <consumption-breakdown-chart
            :dataset="breakdownData"
            :metric-label="amountLabel"
            :unit-label="unitLabel"
          />
        </div>
      </section>

      <section class="legacy-front-card consumption-chart-card consumption-chart-card--trend">
        <div class="legacy-front-section-title">
          <strong>{{ trendTitle }}</strong>
          <span>{{ trendMeta }}</span>
        </div>
        <div class="consumption-chart-card__body">
          <consumption-trend-chart
            :series-data="xData"
            :x-label="xLabel"
            :metric-label="amountLabel"
            :unit-label="unitLabel"
            :visible-count="trendVisibleCount"
          />
        </div>
      </section>
    </div>

    <section class="legacy-front-table-card consumption-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>{{ tableTitle }}</strong>
          <span>{{ resolvedTableHeadMeta }}</span>
        </div>
      </div>
      <el-table
        :data="tableRows"
        :default-sort="{ prop: valueField, order: 'descending' }"
        :header-cell-style="{
          background: 'rgba(8, 24, 40, 0.96)',
          color: 'rgba(214, 231, 243, 0.72)'
        }"
        :empty-text="emptyText"
        style="width: 100%"
      >
        <el-table-column width="78" align="center" label="排序">
          <template slot-scope="{ $index }">
            <span :class="['energy-analysis-rank', { 'is-top': $index < 3 }]">{{ $index + 1 }}</span>
          </template>
        </el-table-column>

        <el-table-column class-name="front-column" min-width="290" :label="nameColumnLabel">
          <template slot-scope="{ row }">
            <div class="consumption-device-cell">
              <div class="consumption-device-cell__name">{{ row[nameField] || "--" }}</div>
              <div class="consumption-device-cell__meta">{{ row[metaField] || fallbackMeta }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column class-name="front-column" align="right" min-width="160" :label="resolvedValueColumnLabel">
          <template slot-scope="{ row }">
            <div class="consumption-metric-cell">
              <strong>{{ formatValue(row[valueField]) }}</strong>
              <span>{{ unitLabel }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column class-name="front-column" align="right" min-width="120" label="占比">
          <template slot-scope="{ row }">
            {{ formatPercent(row.__share) }}
          </template>
        </el-table-column>

        <el-table-column
          v-for="column in normalizedExtraColumns"
          :key="column.field"
          class-name="front-column"
          align="right"
          min-width="140"
          :label="column.label"
        >
          <template slot-scope="{ row }">
            {{ formatValue(row[column.field], column.decimals) }}
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script>
import ConsumptionBreakdownChart from "./components/ConsumptionBreakdownChart.vue";
import ConsumptionTrendChart from "./components/ConsumptionTrendChart.vue";

export default {
  name: "AnalysisWorkbenchTab",
  components: {
    ConsumptionBreakdownChart,
    ConsumptionTrendChart
  },
  props: {
    breakdownData: {
      type: Object,
      default() {
        return {};
      }
    },
    xData: {
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
    table: {
      type: Array,
      default() {
        return [];
      }
    },
    amountLabel: {
      type: String,
      default: "能耗"
    },
    unitLabel: {
      type: String,
      default: "kWh"
    },
    extraMetricLabel: {
      type: String,
      default: ""
    },
    extraMetricField: {
      type: String,
      default: ""
    },
    breakdownTitle: {
      type: String,
      default: "总量构成"
    },
    breakdownMeta: {
      type: String,
      default: ""
    },
    trendTitle: {
      type: String,
      default: "趋势分析"
    },
    trendMeta: {
      type: String,
      default: "默认展开主要对象曲线，可通过图例滚动查看更多设备"
    },
    tableTitle: {
      type: String,
      default: "设备明细"
    },
    tableHeadMeta: {
      type: String,
      default: ""
    },
    emptyText: {
      type: String,
      default: "当前筛选下暂无设备数据"
    },
    nameField: {
      type: String,
      default: "drName"
    },
    metaField: {
      type: String,
      default: "drTypeName"
    },
    valueField: {
      type: String,
      default: "energyValue"
    },
    nameColumnLabel: {
      type: String,
      default: "设备对象"
    },
    valueColumnLabel: {
      type: String,
      default: ""
    },
    fallbackMeta: {
      type: String,
      default: "未分类设备"
    },
    extraColumns: {
      type: Array,
      default() {
        return [];
      }
    },
    trendVisibleCount: {
      type: Number,
      default: 4
    }
  },
  computed: {
    tableRows() {
      const total = this.table.reduce((sum, row) => sum + this.toNumber(row[this.valueField]), 0);
      return this.table
        .map(row => {
          const share = total ? (this.toNumber(row[this.valueField]) / total) * 100 : 0;
          return Object.assign({}, row, {
            __share: share
          });
        })
        .sort((a, b) => this.toNumber(b[this.valueField]) - this.toNumber(a[this.valueField]));
    },
    resolvedBreakdownMeta() {
      if (this.breakdownMeta) {
        return this.breakdownMeta;
      }
      const topEntry = Object.keys(this.breakdownData || {})
        .map(key => {
          return {
            name: key,
            value: this.toNumber(this.breakdownData[key])
          };
        })
        .sort((a, b) => b.value - a.value)[0];

      if (!topEntry || !topEntry.value) {
        return "当前筛选下暂无可分析构成";
      }
      return `主导对象：${topEntry.name}`;
    },
    resolvedTableHeadMeta() {
      if (this.tableHeadMeta) {
        return this.tableHeadMeta;
      }
      return `${this.tableRows.length} 台设备已纳入当前 ${this.amountLabel} 统计`;
    },
    normalizedExtraColumns() {
      const columns = this.extraColumns.slice();
      if (this.extraMetricLabel && this.extraMetricField) {
        columns.unshift({
          label: this.extraMetricLabel,
          field: this.extraMetricField
        });
      }
      return columns;
    },
    resolvedValueColumnLabel() {
      return this.valueColumnLabel || `${this.amountLabel}数值`;
    }
  },
  methods: {
    toNumber(value) {
      const number = Number(value);
      return isNaN(number) ? 0 : number;
    },
    formatValue(value, withDecimals) {
      const number = this.toNumber(value);
      if (!number) {
        return "0";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: withDecimals === false ? 0 : typeof withDecimals === "number" ? withDecimals : number >= 100 ? 0 : 1,
        minimumFractionDigits: withDecimals === false ? 0 : typeof withDecimals === "number" ? 0 : number >= 100 ? 0 : 1
      });
    },
    formatPercent(value) {
      const number = Number(value);
      if (isNaN(number) || number <= 0) {
        return "0%";
      }
      return number.toFixed(1) + "%";
    }
  }
};
</script>

<style lang="scss" scoped>
.consumption-tab-shell {
  margin-top: 6px;
}

.consumption-tab-shell__charts {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 8px;
}

.consumption-chart-card {
  height: 100%;
}

.consumption-chart-card__body {
  margin-top: 4px;
}

.consumption-table-card {
  margin-top: 6px;
}

.consumption-device-cell__name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(241, 248, 255, 0.96);
}

.consumption-device-cell__meta {
  margin-top: 1px;
  font-size: 9px;
  color: rgba(178, 205, 224, 0.68);
}

.consumption-metric-cell {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.consumption-metric-cell strong {
  font-size: 16px;
  font-weight: 700;
  color: #7bf0ff;
}

.consumption-metric-cell span {
  font-size: 11px;
  color: rgba(180, 207, 225, 0.68);
}

.energy-analysis-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(132, 187, 255, 0.1);
  color: rgba(206, 228, 239, 0.82);
  font-size: 10px;
  font-weight: 700;
}

.energy-analysis-rank.is-top {
  background: linear-gradient(135deg, rgba(45, 134, 255, 0.24) 0%, rgba(28, 162, 218, 0.2) 100%);
  border-color: rgba(102, 197, 245, 0.26);
  color: rgba(244, 250, 255, 0.98);
}

::v-deep .el-table__row > td {
  border: none;
}

::v-deep .el-table::before {
  height: 0;
}

::v-deep .el-table tr {
  background-color: rgba(7, 19, 33, 0.9);
}

::v-deep .el-table th.is-leaf,
::v-deep .el-table td {
  border-bottom: 1px solid rgba(132, 187, 255, 0.08);
}

::v-deep .el-table td .cell,
::v-deep .el-table th .cell {
  padding-top: 6px;
  padding-bottom: 6px;
}

@media (max-width: 1480px) {
  .consumption-tab-shell__charts {
    grid-template-columns: 1fr;
  }
}
</style>
