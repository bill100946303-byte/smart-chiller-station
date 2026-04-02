<template>
  <div class="energy-analysis-view heatbalance-workbench">
    <section class="legacy-front-card">
      <div class="legacy-front-section-title">
        <strong>热不平衡率曲线</strong>
        <span>统一使用深色趋势图语法，优先显示主要曲线并在缩放时稳定重排。</span>
      </div>
      <div class="heatbalance-workbench__chart">
        <consumption-trend-chart
          :series-data="xData"
          :x-label="xLabel"
          metric-label="热不平衡率"
          unit-label="%"
        />
      </div>
    </section>

    <section class="legacy-front-table-card energy-analysis-table-card">
      <div class="energy-analysis-table-card__head">
        <div class="legacy-front-section-title">
          <strong>达标统计</strong>
          <span>{{ dataStatisticsList.length }} 条统计结果</span>
        </div>
      </div>
      <el-table
        :data="sortedStatisticsList"
        :header-cell-style="{
          background: 'rgba(8, 24, 40, 0.96)',
          color: 'rgba(214, 231, 243, 0.72)'
        }"
        empty-text="当前筛选下暂无热不平衡率统计"
        style="width: 100%"
      >
        <el-table-column class-name="front-column" min-width="180" prop="acquisitionValue" :label="$t('energytest_hotbalance.collectionValue')"/>
        <el-table-column class-name="front-column" min-width="180" prop="scalar" :label="$t('energytest_hotbalance.reachingStandardQuantity') +'（-5%-5%）'"/>
        <el-table-column class-name="front-column" min-width="160" prop="noScalar" :label="$t('energytest_hotbalance.notMeetingTheStandardQuantity')"/>
        <el-table-column class-name="front-column" min-width="140" prop="scalarRate" :label="$t('energytest_hotbalance.ComplianceRate')"/>
      </el-table>
    </section>

    <section class="legacy-front-table-card energy-analysis-table-card">
      <div class="energy-analysis-table-card__head">
        <div class="legacy-front-section-title">
          <strong>对象明细</strong>
          <span>{{ table.length }} 台设备已纳入本次热不平衡率分析</span>
        </div>
      </div>
      <el-table
        :data="sortedTable"
        :default-sort="{ prop: 'scalarRate', order: 'descending' }"
        empty-text="当前筛选下暂无对象明细"
        :header-cell-style="{
          background: 'rgba(8, 24, 40, 0.96)',
          color: 'rgba(214, 231, 243, 0.72)'
        }"
        style="width: 100%"
      >
        <el-table-column class-name="front-column" min-width="260" label="对象">
          <template slot-scope="{ row }">
            <div class="energy-analysis-object">
              <div class="energy-analysis-object__name">{{ row.drName || '--' }}</div>
              <div class="energy-analysis-object__meta">{{ row.drTypeName || '未分类设备' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column class-name="front-column" min-width="160" align="right" label="达标率">
          <template slot-scope="{ row }">
            <div class="energy-analysis-state">
              <strong>{{ normalizedRate(row.scalarRate) }}</strong>
              <span>%</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script>
import ConsumptionTrendChart from "./components/ConsumptionTrendChart.vue";

export default {
  name: "HeatBalanceTab",
  components: {
    ConsumptionTrendChart
  },
  props: {
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
    dataStatisticsList: {
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
    }
  },
  computed: {
    sortedStatisticsList() {
      return (this.dataStatisticsList || []).slice().sort((a, b) => {
        return this.toNumber(b.scalarRate) - this.toNumber(a.scalarRate);
      });
    },
    sortedTable() {
      return (this.table || []).slice().sort((a, b) => {
        return this.toNumber(b.scalarRate) - this.toNumber(a.scalarRate);
      });
    }
  },
  methods: {
    toNumber(value) {
      const number = Number(String(value).replace("%", ""));
      return isNaN(number) ? 0 : number;
    },
    normalizedRate(value) {
      const number = this.toNumber(value);
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 2,
        minimumFractionDigits: 0
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.heatbalance-workbench__chart {
  margin-top: 10px;
}

::v-deep .el-table__row > td {
  border: none;
}

::v-deep .el-table::before {
  height: 0;
}
</style>
