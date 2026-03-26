<template>
  <div class="page-shell energy-review-shell">
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">能耗回顾</p>
          <h2 class="panel-title">能耗趋势</h2>
          <div class="panel-summary">支持日、月、年能耗趋势查看，并可下钻到设备历史曲线。</div>
        </div>
        <div class="toolbar">
          <div class="toolbar-field">
            <span>时间</span>
            <el-date-picker v-model="dateTime" type="date" placeholder="选择时间" />
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="searchEnergy(3)">日能耗</el-button>
            <el-button type="primary" @click="searchEnergy(2)">月能耗</el-button>
            <el-button type="primary" @click="searchEnergy(1)">年能耗</el-button>
            <el-button v-if="!chartsVisible" plain type="primary" @click="backToCharts">
              返回总览
            </el-button>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <el-tabs v-if="chartsData.length !== 0" v-model="activeName" class="analysis-tabs">
          <el-tab-pane
            v-for="(chart, i) in chartsData"
            :key="i"
            :label="chart.energytypename"
            :name="String(i)"
          >
            <div v-if="chartsVisible" class="chart-stage">
              <MultifunctionalChart
                :id="'multifunctionalchart-' + i"
                :chartData="chart"
                :energyType="energyType"
                :class="['chart-panel']"
                @drid="getTagInfo"
              />
            </div>

            <div v-else class="history-stack">
              <div v-if="lineData.length === 0" class="empty-state">暂无历史曲线</div>
              <div v-for="(line, lineIndex) in lineData" :key="lineIndex" class="history-card">
                <HistoryLine
                  :id="'hisline-' + lineIndex"
                  :hislineData="line"
                  class="chart-panel"
                />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div v-else class="empty-state">
          暂无可展示的数据
        </div>
      </div>
    </main>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import MultifunctionalChart from "@/components/Charts/MultifunctionalChartReview";
import HistoryLine from "@/views/usermodel/components/HistoryLine";
import {
  findTotalEnergy,
  findChartsData
} from "@/api/usersetting/energymange/totalenergy";
import { findRegDatas } from "@/api/usersetting/runlog/datatable";
import { formatDate } from "@/utils/index";
export default {
  components: {
    MultifunctionalChart,
    HistoryLine
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
      tableVisible: false, // 控制表格展示
      energyType: "", // 能耗类型
      lineData: [], //
      count: 0
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
    // 查询图表数据
    findChartsData(path, type, date) {
      this.energyType = type;
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
        .catch(()=>{
          loading.close();
        });
    },
    // 查询日,月，年能耗
    searchEnergy(type) {
      this.backToCharts();
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
    backToCharts() {
      this.chartsVisible = true;
      this.lineData = [];
      this.count = 0;
    },
    getTagInfo(drid, startTime, endTime) {
      if (drid != undefined && drid != undefined && drid != undefined) {
        this.count++;
        if (this.count === 1) {
          let formData = new FormData();
          formData.append("startTime", new Date(startTime));
          formData.append("endTime", new Date(endTime));
          formData.append("drid", drid);
          findRegDatas(this.path, formData)
            .then(res => {
              this.lineData = res.data;
              this.lineData.forEach(line => {
                for (const key in line) {
                  line[key].forEach(ele => {
                    ele.time = formatDate(ele.time);
                  });
                }
              });
              this.chartsVisible = false;
              this.count = 0;
            })
            .catch(console.log);
        }
      }
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
  font-size: 22px;
  color: #f4faff;
}

.panel-summary {
  margin-top: 8px;
  color: rgba(210, 229, 244, 0.72);
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

.analysis-tabs {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.chart-stage,
.history-card,
.empty-state {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.chart-stage,
.history-card {
  padding: 16px;
}

.chart-panel {
  width: 100%;
  min-height: 400px;
}

.history-stack {
  display: grid;
  gap: 16px;
}

.empty-state {
  padding: 32px 16px;
  text-align: center;
  color: rgba(215, 232, 244, 0.7);
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
