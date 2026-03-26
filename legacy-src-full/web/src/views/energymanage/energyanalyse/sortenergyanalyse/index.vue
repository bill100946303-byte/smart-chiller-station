<template>
  <div class="page-shell energy-analysis-shell">
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">趋势分析</p>
          <h2 class="panel-title">分类能耗分析</h2>
          <div class="panel-summary">对比分项能耗在两个时间点上的日/月/年变化。</div>
        </div>
        <div class="toolbar">
          <div class="toolbar-field">
            <span>时间1</span>
            <el-date-picker v-model="dateTime1" type="date" placeholder="选择时间" />
          </div>
          <div class="toolbar-field">
            <span>时间2</span>
            <el-date-picker v-model="dateTime2" type="date" placeholder="选择时间" />
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="leadOutTwo">导出报表</el-button>
            <el-button type="primary" @click="searchEnergy(3)">日能耗</el-button>
            <el-button type="primary" @click="searchEnergy(2)">月能耗</el-button>
            <el-button type="primary" @click="searchEnergy(1)">年能耗</el-button>
            <el-button type="primary" @click="showCharts">图表表格切换</el-button>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <el-tabs v-model="activeName" class="analysis-tabs">
          <el-tab-pane
            v-for="(chart, i) in chartsData1"
            :key="i"
            :label="chart.energytypename"
            :name="String(i)"
          >
            <div v-if="chartsVisible" class="chart-stage">
              <MultifunctionalChart
                :id="'multifunctionalchart-' + i"
                :chartData1="chart"
                :chartData2="chartsData2[i]"
                class="chart-panel"
              />
            </div>
            <div v-if="tableVisible" class="comparison-grid">
              <el-table
                :ref="getTableRef(1, i)"
                :data="tableDatas1[i]"
                border
                stripe
                class="analysis-table"
              >
                <el-table-column prop="date" label="日期" width="180" />
                <el-table-column prop="regName" label="能耗类型名称" width="180" />
                <el-table-column prop="value" label="能耗值" />
              </el-table>
              <el-table
                :ref="getTableRef(2, i)"
                :data="tableDatas2[i]"
                border
                stripe
                class="analysis-table"
              >
                <el-table-column prop="date" label="日期" width="180" />
                <el-table-column prop="regName" label="能耗类型名称" width="180" />
                <el-table-column prop="value" label="能耗值" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
        <div v-if="chartsData1.length === 0" class="empty-state">
          暂无可展示的数据
        </div>
      </div>
    </main>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import MultifunctionalChart from "@/components/Charts/MultifunctionalChartTotal";
import { findChartsData } from "@/api/usersetting/energymange/sortenergy";
import { formatDay } from "@/utils/index";

export default {
  components: {
    MultifunctionalChart
  },
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      activeSelect: "",
      activeName: "0",
      dateTime1: "",
      dateTime2: "",
      chartsData1: [],
      chartsData2: [],
      tableDatas1: [],
      tableDatas2: [],
      chartsVisible: true,
      tableVisible: false
    };
  },
  created() {
    this.searchEnergy(3);
  },
  methods: {
    getActiveIndex() {
      const index = Number(this.activeName);
      return Number.isNaN(index) ? 0 : index;
    },
    getTableRef(slot, index) {
      return `exportTab${slot}-${index}`;
    },
    fetchChartsData(path, type, date) {
      const formData = new FormData();
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
        if (this.chartsData1.length === 0) {
          this.$message.error("访问超时");
          loading.close();
        }
      }, 30000);
      findChartsData(path, formData)
        .then(res => {
          loading.close();
          if (this.chartsData1.length === 0) {
            this.chartsData1 = res.data;
          } else {
            this.chartsData2 = res.data;
          }
          const tableDatas = [];
          res.data.forEach(ele => {
            const arr = [];
            for (const key in ele.energyQeuryMap) {
              arr.push({
                date: ele.dateStr + key,
                regName: ele.energytypename,
                value: ele.energyQeuryMap[key]
              });
            }
            tableDatas.push(arr);
          });
          if (this.tableDatas1.length === 0) {
            this.tableDatas1 = tableDatas;
          } else {
            this.tableDatas2 = tableDatas;
          }
        })
        .catch(() => {
          loading.close();
        });
    },
    async leadOutTwo() {
      const day = new Date();
      day.setTime(day.getTime() - 24 * 60 * 60 * 1000);
      await this.leadOut(
        1,
        this.dateTime1 != ""
          ? formatDay(this.dateTime1.getTime())
          : formatDay(new Date().getTime())
      );
      await this.leadOut(
        2,
        this.dateTime2 != ""
          ? formatDay(this.dateTime2.getTime())
          : formatDay(day)
      );
    },
    async leadOut(slot, date) {
      if (this.tableVisible === false) {
        this.$message.error("请切换成表格形式再进行导出操作！");
        return null;
      }
      const currentIndex = this.getActiveIndex();
      const currentChart = this.chartsData1[currentIndex] || {};
      const refName = this.getTableRef(slot, currentIndex);
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
        const tableName = `${currentChart.energytypename || "能耗"}${this.activeSelect || "日能耗"}${date}`;
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
      this.chartsData1 = [];
      this.chartsData2 = [];
      this.tableDatas1 = [];
      this.tableDatas2 = [];
      this.activeName = "0";
      if (this.dateTime1 != "") {
        this.fetchChartsData(this.path, type, this.dateTime1);
      } else {
        this.fetchChartsData(this.path, type, new Date());
      }
      if (this.dateTime2 != "") {
        this.fetchChartsData(this.path, type, this.dateTime2);
      } else {
        const day = new Date();
        day.setTime(day.getTime() - 24 * 60 * 60 * 1000);
        this.fetchChartsData(this.path, type, new Date(day));
      }
    },
    showCharts() {
      this.chartsVisible = !this.chartsVisible;
      this.tableVisible = !this.tableVisible;
    }
  }
};
</script>
<style lang="scss" scoped>
.page-shell {
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
  font-size: 26px;
  font-weight: 600;
  color: rgba(244, 250, 255, 0.98);
}

.panel-summary {
  margin-top: 10px;
  font-size: 13px;
  color: rgba(222, 235, 255, 0.7);
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
  color: rgba(222, 235, 255, 0.7);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-body {
  min-width: 0;
}

.analysis-tabs {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}

::v-deep .analysis-tabs > .el-tabs__header {
  margin: 0;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(132, 187, 255, 0.12);
}

::v-deep .analysis-tabs > .el-tabs__header .el-tabs__item {
  color: rgba(222, 235, 255, 0.7);
}

::v-deep .analysis-tabs > .el-tabs__header .el-tabs__item.is-active {
  color: #5cc8ff;
}

::v-deep .analysis-tabs > .el-tabs__content {
  padding: 20px;
}

.chart-stage {
  width: 100%;
  overflow-x: auto;
}

.chart-panel {
  width: 100%;
  min-height: 420px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.analysis-table {
  width: 100%;
}

.empty-state {
  margin-top: 16px;
  padding: 32px 20px;
  text-align: center;
  border-radius: 16px;
  border: 1px dashed rgba(132, 187, 255, 0.2);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(222, 235, 255, 0.6);
}

@media (max-width: 1200px) {
  .comparison-grid {
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
