<template>
  <div class="page-shell">
    <aside class="panel-card summary-rail">
      <div class="panel-card__header">
        <div>
          <p class="panel-eyebrow">能耗总览</p>
          <h2 class="panel-title">总能耗卡片</h2>
        </div>
      </div>
      <div class="summary-stack">
        <div v-for="(card, i) in cardData" :key="i" class="summary-card">
          <div class="card-panel">
            <div class="card-panel-icon-wrapper icon-people">
              <svg-icon icon-class="totalenergy" class-name="card-panel-icon" />
            </div>
            <div
              class="card-panel-description"
              v-for="(value, key, j) in card[0].energyQeuryMap"
              :key="j"
            >
              <div class="card-panel-text">{{ card[0].energytypename }}</div>
              <count-to :start-val="0" :end-val="value" :duration="2600" class="card-panel-num" />
              <span>kwh</span>
              <p class="time">采集时间: {{ key }}</p>
            </div>
            <div
              class="card-panel-description"
              v-for="(value, key, j) in card[1].energyQeuryMap"
              :key="j"
            >
              <div class="card-panel-text">{{ card[1].energytypename }}</div>
              <count-to :start-val="0" :end-val="value" :duration="3000" class="card-panel-num" />
              <span>kwh</span>
            </div>
          </div>
          <div class="card-panel-mei" v-for="(value, key, j) in card[0].energyQeuryMap" :key="j">
            <p class="number">{{ (value * 1.229).toFixed(3) }}</p>
            <p class="unit">吨标准煤</p>
            <div class="comparable">
              <span>上月同期</span>
              <span class="comparable-number">46.502% <img src="../../../../assets/up.png" /></span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">趋势分析</p>
          <h2 class="panel-title">能耗趋势</h2>
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
        <el-tabs v-model="activeName" class="analysis-tabs">
          <el-tab-pane
            :label="chart.energytypename"
            :name="String(i)"
            v-for="(chart, i) in chartsData"
            :key="i"
          >
            <div class="chart-wrap" v-if="chartsVisible">
              <MultifunctionalChart
                :id="'multifunctionalchart' + i"
                :chartData1="chart"
                class="chart-panel"
              />
            </div>
            <el-table
              :ref="getTableRef(i)"
              v-if="tableVisible"
              :data="tableDatas[i]"
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
      </div>
    </main>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import CountTo from "vue-count-to";
import MultifunctionalChart from "@/components/Charts/MultifunctionalChartTotal";
import {
  findTotalEnergy,
  findChartsData
} from "@/api/usersetting/energymange/totalenergy";
export default {
  components: {
    CountTo,
    MultifunctionalChart
  },
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      activeSelect: "", // 记录点击的按钮
      activeName: "0", // 选项卡选中的名字
      dateTime: "", // 时间
      cardData: {}, // 左边卡片的数据
      chartsData: [], // 曲线数据
      tableDatas: [], // 表格数据
      chartsVisible: true, // 控制图表展示
      tableVisible: false // 控制表格展示
    };
  },
  created() {
    // 查询总能耗
    findTotalEnergy(this.path, 1)
      .then(res => {
        this.cardData = res.data;
      })
      .catch(console.log);
    // 查询图表数据
    this.searchEnergy(3);
  },
  methods: {
    getActiveIndex() {
      const index = Number(this.activeName);
      return Number.isNaN(index) ? 0 : index;
    },
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
        if (this.chartsData.length === 0) {
          this.$message.error("访问超时");
          loading.close();
        }
      }, 30000);
      findChartsData(path, formData)
        .then(res => {
          loading.close();
          this.chartsData = res.data;
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
        .catch(() => {
          loading.close();
        });
    },
    // 导出报表
    async leadOut() {
      if (this.tableVisible === false) {
        this.$message.error("请切换成表格形式再进行导出操作！");
      } else {
        const currentIndex = this.getActiveIndex();
        const currentChart = this.chartsData[currentIndex] || {};
        const refName = this.getTableRef(currentIndex);
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
        var xlsxParam = { raw: true }; // 导出的内容只做解析，不进行格式转换
        var wb = XLSX.utils.table_to_book(tableEl, xlsxParam);
        /* get binary string as output */
        var wbout = XLSX.write(wb, {
          bookType: "xlsx",
          bookSST: true,
          type: "array"
        });
        try {
          let tableName = "";
          if (this.activeSelect != "") {
            tableName = currentChart.energytypename + this.activeSelect;
          } else {
            tableName = currentChart.energytypename + "日能耗";
          }
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
      }
    },
    // 查询日,月，年能耗
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
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 20px;
  padding: 0 20px 20px;
}

.panel-card {
  background: var(--theme-color);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
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
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.summary-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-stack {
  display: grid;
  gap: 16px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  overflow: hidden;
}

.card-panel {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
}

.card-panel-icon-wrapper {
  flex: 0 0 auto;
  padding: 14px;
  border-radius: 12px;
  background: rgba(64, 201, 198, 0.14);
  color: #40c9c6;
}

.card-panel-icon {
  font-size: 40px;
}

.card-panel-description {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
}

.card-panel-text {
  margin-bottom: 8px;
  line-height: 1.4;
  font-size: 15px;
  color: #374151;
}

.card-panel-num {
  font-size: 22px;
}

.time {
  margin: 8px 0 0;
  color: #6b7280;
}

.card-panel-mei {
  padding: 16px;
  text-align: center;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.number {
  margin: 0;
  color: rgb(68, 168, 235);
  font-size: 28px;
  font-weight: 600;
}

.unit {
  margin: 4px 0 0;
  color: #6b7280;
}

.comparable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  color: #6b7280;
}

.comparable-number {
  color: rgb(61, 148, 206);
}

.workbench {
  min-width: 0;
}

.workbench-header {
  margin-bottom: 12px;
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
  background: rgba(255, 255, 255, 0.36);
  border-radius: 12px;
  overflow: hidden;
}

.chart-wrap {
  width: 100%;
  overflow-x: auto;
}

.chart-panel {
  width: 100%;
  min-height: 400px;
}

.analysis-table {
  width: 100%;
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

  .card-panel {
    flex-direction: column;
  }
}
</style>
