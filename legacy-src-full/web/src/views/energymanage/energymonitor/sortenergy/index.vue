<template>
  <div class="page-shell sort-energy-shell">
    <aside class="panel-card summary-rail">
      <div class="panel-card__header">
        <div>
          <p class="panel-eyebrow">能耗概览</p>
          <h2 class="panel-title">分类能耗摘要</h2>
          <div class="panel-summary">同时查看总量与当日分类能耗分布。</div>
        </div>
      </div>

      <div class="summary-stack">
        <section class="summary-card">
          <div class="summary-card__head">
            <strong>总分类能耗</strong>
            <span>累计分布</span>
          </div>
          <PieChart id="totalPieChart" :chartData="pieData" class="pie-card__chart" />
          <div class="summary-metric-list">
            <div v-for="(card, index) in cardData" :key="'total-' + index" class="summary-metric">
              <template v-if="card[0]">
                <div class="summary-metric__label">{{ card[0].energytypename }}</div>
                <div
                  v-for="(value, key) in card[0].energyQeuryMap"
                  :key="key"
                  class="summary-metric__row"
                >
                  <div class="summary-metric__value">
                    <count-to :start-val="0" :end-val="value" :duration="2200" />
                  </div>
                  <span class="summary-metric__unit">kwh</span>
                  <p class="summary-metric__time">采集时间：{{ key }}</p>
                </div>
              </template>
            </div>
          </div>
        </section>

        <section class="summary-card">
          <div class="summary-card__head">
            <strong>当日分类能耗</strong>
            <span>今日分布</span>
          </div>
          <PieChart id="dayPieChart" :chartData="pieDayData" class="pie-card__chart" />
          <div class="summary-metric-list">
            <div v-for="(card, index) in cardData" :key="'day-' + index" class="summary-metric">
              <template v-if="card[1]">
                <div class="summary-metric__label">{{ card[1].energytypename }}</div>
                <div
                  v-for="(value, key) in card[1].energyQeuryMap"
                  :key="key"
                  class="summary-metric__row"
                >
                  <div class="summary-metric__value">
                    <count-to :start-val="0" :end-val="value" :duration="2200" />
                  </div>
                  <span class="summary-metric__unit">kwh</span>
                  <p class="summary-metric__time">采集时间：{{ key }}</p>
                </div>
              </template>
            </div>
          </div>
        </section>
      </div>
    </aside>

    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">趋势分析</p>
          <h2 class="panel-title">分类能耗趋势</h2>
          <div class="panel-summary">按日、月、年查看分类能耗的变化曲线或表格。</div>
        </div>
        <div class="toolbar">
          <div class="toolbar-field">
            <span>时间</span>
            <el-date-picker v-model="dateTime" type="date" placeholder="选择时间" />
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="leadOut">导出报表</el-button>
            <el-button type="primary" @click="searchEnergy(3)">日能耗</el-button>
            <el-button type="primary" @click="searchEnergy(2)">月能耗</el-button>
            <el-button type="primary" @click="searchEnergy(1)">年能耗</el-button>
            <el-button type="primary" @click="showCharts">图表表格切换</el-button>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="chartsVisible && multifunctionData.length !== 0" class="chart-stage">
          <MultifunctionalChart
            id="multifunctionalchart"
            :chartData="multifunctionData"
            class="chart-panel"
          />
        </div>

        <el-tabs v-if="tableVisible" v-model="activeName" class="analysis-tabs">
          <el-tab-pane
            v-for="(tableData, i) in tableDatas"
            :key="i"
            :label="tableData[0] ? tableData[0].regName : '分类数据'"
            :name="String(i)"
          >
            <el-table
              :ref="getTableRef(i)"
              :data="tableData"
              border
              stripe
              class="analysis-table"
            >
              <el-table-column prop="date" label="日期" width="180"></el-table-column>
              <el-table-column prop="regName" label="能耗类型名称" width="180"></el-table-column>
              <el-table-column prop="value" label="能耗值"></el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>

        <div v-if="multifunctionData.length === 0" class="empty-state">
          暂无可展示的数据
        </div>
      </div>
    </main>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import CountTo from "vue-count-to";
import MultifunctionalChart from "@/components/Charts/MultifunctionalChart";
import {
  findSortEnergy,
  findChartsData
} from "@/api/usersetting/energymange/sortenergy";
import PieChart from "@/components/Charts/PieChart";
export default {
  components: {
    CountTo,
    MultifunctionalChart,
    PieChart
  },
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      activeSelect: "", // 记录点击的按钮
      activeName: "0", // 选项卡选中的名字
      pieData: [], // 总饼图数据
      pieDayData: [], // 当日饼图数据
      cardData: [], // 卡片数据
      dateTime: "", // 时间
      multifunctionData: [], // 多功能图表数据
      tableDatas: [], // 表格数据
      chartsVisible: true, // 控制图表展示
      tableVisible: false // 控制表格展示
    };
  },
  created() {
    // 查询分类能耗
    findSortEnergy(this.path, 1)
      .then(res => {
        this.cardData = res.data;
        res.data.forEach(ele => {
          this.pieData.push(ele[0]);
          this.pieDayData.push(ele[1]);
        });
      })
      .catch(console.log);
    // 查询图表数据
    this.searchEnergy(3);
  },
  methods: {
    getTableRef(index) {
      return `exportTab-${index}`;
    },
    // 查询图表数据
    findChartsData(path, type, date) {
      var formData = new FormData();
      formData.append("type", type);
      if (date != "" && date != null) {
        formData.append("date", date);
      }
      const loading = this.$loading({
        lock: true,
        text: "图表正在加载中，请稍后",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      setTimeout(() => {
        if (this.multifunctionData.length === 0) {
          this.$message.error("访问超时");
          loading.close();
        }
      }, 30000);
      findChartsData(path, formData)
        .then(res => {
          loading.close();
          this.multifunctionData = res.data;
          let tableDatas = [];
          res.data.forEach(ele => {
            let arr = [];
            for (const key in ele.energyQeuryMap) {
              let obj = {
                date: ele.dateStr + key,
                regName: ele.energytypename,
                value: ele.energyQeuryMap[key]
              };
              arr.push(obj);
            }
            tableDatas.push(arr);
          });
          this.tableDatas = tableDatas;
        })
        .catch(()=>{
          loading.close();
        });
    },
    // 导出报表
    async leadOut() {
      if (this.tableVisible === false) {
        this.$message.error("请切换成表格形式再进行导出操作！");
        return null;
      }
      const currentIndex = Number(this.activeName);
      const safeIndex = Number.isNaN(currentIndex) ? 0 : currentIndex;
      const currentChart = this.multifunctionData[safeIndex] || {};
      const refName = this.getTableRef(safeIndex);
      const tableRef = this.$refs[refName];
      const tableComponent = Array.isArray(tableRef) ? tableRef[0] : tableRef;
      const tableEl = tableComponent && tableComponent.$el ? tableComponent.$el : tableComponent;
      if (!tableEl) {
        this.$message.error("未找到可导出的表格");
        return null;
      }

      const [xlsxModule, fileSaverModule] = await Promise.all([
        import("xlsx"),
        import("file-saver")
      ]);
      const XLSX = xlsxModule.default || xlsxModule;
      const FileSaver = fileSaverModule.default || fileSaverModule;
      const wb = XLSX.utils.table_to_book(tableEl, { raw: true });
      const wbout = XLSX.write(wb, {
        bookType: "xlsx",
        bookSST: true,
        type: "array"
      });
      try {
        const tableName = `${currentChart.energytypename || "分类能耗"}${this.activeSelect || "日能耗"}`;
        FileSaver.saveAs(
          new Blob([wbout], { type: "application/octet-stream" }),
          `${tableName}.xlsx`
        );
      } catch (e) {
        if (typeof console !== "undefined") {
          console.log(e, wbout);
        }
      }
      return wbout;
    },
    searchEnergy(type) {
      if (type === 1) {
        this.activeSelect = "年能耗";
      } else if (type === 2) {
        this.activeSelect = "月能耗";
      } else {
        this.activeSelect = "日能耗";
      }
      this.activeName = "0";
      this.findChartsData(this.path, type, this.dateTime);
    },
    // 图表表格切换
    showCharts() {
      this.chartsVisible = !this.chartsVisible;
      this.tableVisible = !this.tableVisible;
    }
  }
};
</script>
<style lang="scss" scoped>
.page-shell {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  gap: 20px;
  padding: 0 20px 20px;
}

.panel-card {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(8, 19, 32, 0.94) 100%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(168, 208, 235, 0.72);
}

.panel-title {
  margin: 0;
  font-size: 22px;
  color: #f4faff;
}

.panel-summary {
  margin-top: 8px;
  color: rgba(210, 229, 244, 0.72);
}

.summary-rail {
  display: flex;
  flex-direction: column;
}

.summary-stack {
  display: grid;
  gap: 16px;
}

.summary-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(132, 187, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.summary-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  color: rgba(244, 250, 255, 0.96);
}

.summary-card__head span {
  font-size: 12px;
  color: rgba(168, 208, 235, 0.72);
}

.pie-card__chart {
  width: 100%;
  height: 260px;
}

.summary-metric-list {
  display: grid;
  gap: 12px;
}

.summary-metric {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.summary-metric__label {
  margin-bottom: 8px;
  color: rgba(244, 250, 255, 0.92);
}

.summary-metric__row {
  display: grid;
  gap: 2px;
}

.summary-metric__value {
  font-size: 24px;
  font-weight: 600;
  color: #6ae7ff;
}

.summary-metric__unit,
.summary-metric__time {
  color: rgba(168, 208, 235, 0.7);
}

.summary-metric__time {
  margin: 0;
}

.workbench {
  min-width: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px 16px;
}

.toolbar-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
  color: rgba(215, 232, 244, 0.88);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-body {
  min-width: 0;
}

.chart-stage {
  border-radius: 18px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
}

.chart-panel {
  width: 100%;
  min-height: 400px;
}

.analysis-tabs {
  margin-top: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.analysis-table {
  width: 100%;
}

.empty-state {
  margin-top: 14px;
  padding: 32px 16px;
  border-radius: 18px;
  text-align: center;
  color: rgba(215, 232, 244, 0.7);
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 1200px) {
  .page-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-shell {
    padding: 0 12px 12px;
  }

  .panel-card {
    padding: 16px;
  }

  .panel-card__header,
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-field,
  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions .el-button {
    flex: 1 1 auto;
  }
}
</style>
