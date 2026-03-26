<template>
  <div class="page-shell">
    <aside class="panel-card variable-rail">
      <div class="panel-card__header">
        <div>
          <p class="panel-eyebrow">变量选择</p>
          <h2 class="panel-title">选择统计的能耗</h2>
        </div>
        <el-button type="primary" @click="selectReg">选择变量</el-button>
      </div>
      <div class="selected-stack">
        <div v-for="(reg, i) in regs" :key="i" class="selected-card">
          <p>设备类型: {{ reg.drtypename }}</p>
          <p>设备名: {{ reg.drname }}</p>
          <p>变量名: {{ reg.regName }}</p>
        </div>
      </div>
      <el-dialog title="变量选择" :visible.sync="dialogVisible" width="50%">
        <el-steps class="tips" space="40%" :active="active">
          <el-step title="步骤 1" description="选择设备类型查看设备"></el-step>
          <el-step title="步骤 2" description="选择设备查看变量"></el-step>
          <el-step title="步骤 3" description="选择所需变量"></el-step>
        </el-steps>
        <div class="device-data">
          <div class="device-type">
            <el-tree :data="deviceType" :props="deviceTypeProps" @node-click="selectDeviceType" />
          </div>
          <div class="device-name">
            <el-tree :data="deviceName" :props="deviceProps" @node-click="selectDevice" />
          </div>
          <div class="reg-name">
            <el-tree
              ref="regTree"
              :data="regName"
              :props="regProps"
              show-checkbox
              @check-change="selectRegs"
            />
          </div>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="dialogVisible = false">确 定</el-button>
        </span>
      </el-dialog>
    </aside>
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">趋势分析</p>
          <h2 class="panel-title">总能耗分析</h2>
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
        <el-tabs v-model="activeName" v-if="chartsData2.length != 0" class="analysis-tabs">
          <el-tab-pane :label="reg.regName" :name="String(i)" v-for="(reg, i) in regs" :key="i">
            <div class="chart-stage" v-if="chartsVisible">
              <MultifunctionalChart
                id="multifunctionalchart"
                :chartData1="chartsData1[i]"
                :chartData2="chartsData2[i]"
                class="chart-panel"
              />
            </div>
            <div class="tables" v-if="tableVisible">
              <el-table
                :ref="getTableRef(1, i)"
                :data="tableDatas1[i]"
                border
                stripe
                class="analysis-table"
              >
                <el-table-column prop="date" label="日期" width="180"></el-table-column>
                <el-table-column prop="regName" label="能耗类型名称" width="180"></el-table-column>
                <el-table-column prop="value" label="能耗值"></el-table-column>
              </el-table>
              <el-table
                :ref="getTableRef(2, i)"
                :data="tableDatas2[i]"
                border
                stripe
                class="analysis-table"
              >
                <el-table-column prop="date" label="日期" width="180"></el-table-column>
                <el-table-column prop="regName" label="能耗类型名称" width="180"></el-table-column>
                <el-table-column prop="value" label="能耗值"></el-table-column>
              </el-table>
            </div>
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
  findDeviceType,
  findDevice,
  findReg,
  exportReg
} from "@/api/usersetting/runlog/datatable";
import { searchSubitemEnergy } from "@/api/usersetting/energymange/subitemenergy";
import { formatDay } from "@/utils/index";
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
      active: 1, // 步骤
      regs: [], // 变量名
      dialogVisible: false,
      activeSelect: "", // 记录点击的按钮
      activeName: "0", // 选项卡选中的名字
      dateTime1: "", // 时间1
      dateTime2: "", // 时间2
      chartsData1: [], // 曲线数据1
      chartsData2: [], // 曲线数据2
      tableDatas1: [], // 表格数据1
      tableDatas2: [], // 表格数据2
      chartsVisible: true, // 控制图表展示
      tableVisible: false, // 控制表格展示
      deviceType: [], // 设备类型树形图数据
      deviceName: [], // 设备名树形图数据
      regName: [], // 变量名树形图数据
      deviceTypeProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      },
      deviceProps: {
        label: "drname"
      },
      regProps: {
        label: "regName"
      }
    };
  },
  created() {
    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceType = res.data;
      })
      .catch(console.log);
  },
  methods: {
    getActiveIndex() {
      const index = Number(this.activeName);
      return Number.isNaN(index) ? 0 : index;
    },
    getTableRef(slot, index) {
      return `exportTab${slot}-${index}`;
    },
    // 查询图表数据
    searchSubitemEnergy(path, tagname, regname, type, date) {
      var formData = new FormData();
      formData.append("tagname", tagname);
      formData.append("regname", regname);
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
      searchSubitemEnergy(path, formData)
        .then(res => {
          loading.close();
          if (this.chartsData1.length === 0) {
            this.chartsData1 = res.data;
          } else {
            this.chartsData2 = res.data;
          }
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
    // 选择变量
    selectReg() {
      this.dialogVisible = true;
    },
    // 选择设备类型,查询所有设备
    selectDeviceType(data) {
      this.active = 2;
      if (data.drtypeinfoList.length === 0) {
        findDevice(this.path, data.drtypeid)
          .then(res => {
            this.deviceName = res.data;
          })
          .catch(console.log);
      }
    },
    // 选择设备，查询变量
    selectDevice(data) {
      this.active = 3;
      findReg(this.path, data.drid, 1)
        .then(res => {
          this.regName = res.data;
        })
        .catch(console.log);
    },
    // 选择所需变量
    selectRegs(data) {
      this.regs = this.$refs.regTree.getCheckedNodes();
    },
    // 导出两次
    leadOutTwo() {
      let day = new Date();
      day.setTime(day.getTime() - 24 * 60 * 60 * 1000);
      this.leadOut(
        1,
        this.dateTime1 != ""
          ? formatDay(this.dateTime1.getTime())
          : formatDay(new Date().getTime())
      );
      this.leadOut(
        2,
        this.dateTime2 != ""
          ? formatDay(this.dateTime2.getTime())
          : formatDay(day)
      );
    },
    // 导出报表
    async leadOut(slot, date) {
      if (this.tableVisible === false) {
        this.$message.error("请切换成表格形式再进行导出操作！");
      } else {
        const currentIndex = this.getActiveIndex();
        const currentChart = this.chartsData1[currentIndex] || this.chartsData1[0] || {};
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
            tableName = currentChart.energytypename + this.activeSelect + date;
          } else {
            tableName = currentChart.energytypename + "日能耗" + date;
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
      let tagname = [];
      this.regs.forEach(ele => {
        tagname.push(ele.tagName);
      });
      let regname = [];
      this.regs.forEach(ele => {
        regname.push(ele.regName);
      });
      this.chartsData1 = [];
      this.chartsData2 = [];
      this.tableDatas1 = [];
      this.tableDatas2 = [];
      this.activeName = "0";
      // 如果dateTime1为空，默认查今天
      if (this.dateTime1 != "") {
        this.searchSubitemEnergy(
          this.path,
          tagname,
          regname.join(","),
          type,
          this.dateTime1
        );
      } else {
        this.searchSubitemEnergy(
          this.path,
          tagname,
          regname.join(","),
          type,
          new Date()
        );
      }
      // 如果dateTime2为空，默认查昨天
      if (this.dateTime2 != "") {
        this.searchSubitemEnergy(
          this.path,
          tagname,
          regname.join(","),
          type,
          this.dateTime2
        );
      } else {
        let day = new Date();
        day.setTime(day.getTime() - 24 * 60 * 60 * 1000);
        this.searchSubitemEnergy(
          this.path,
          tagname,
          regname.join(","),
          type,
          new Date(day)
        );
      }
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

.variable-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-stack {
  display: grid;
  gap: 12px;
}

.selected-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.selected-card p {
  margin: 0;
  line-height: 1.6;
  color: #374151;
}

.device-data {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.device-type,
.device-name,
.reg-name {
  min-width: 0;
  max-height: 560px;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
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

.chart-stage {
  width: 100%;
  overflow-x: auto;
  margin-bottom: 16px;
}

.chart-panel {
  width: 100%;
  min-height: 400px;
}

.tables {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.analysis-table {
  width: 100%;
}

@media (max-width: 1200px) {
  .page-shell {
    grid-template-columns: 1fr;
  }

  .device-data,
  .tables {
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
