<template>
  <div class="page-shell energy-record-shell">
    <aside class="panel-card variable-rail">
      <div class="panel-card__header">
        <div>
          <p class="panel-eyebrow">变量选择</p>
          <h2 class="panel-title">选择统计的能耗</h2>
          <div class="panel-summary">按设备类型逐级选择变量，形成记录查询条件。</div>
        </div>
        <el-button type="primary" @click="selectReg">选择变量</el-button>
      </div>
      <div class="selected-stack">
        <div v-if="regs.length === 0" class="empty-state">
          尚未选择变量
        </div>
        <div v-for="(reg, i) in regs" :key="i" class="selected-card">
          <p>设备类型: {{ reg.drtypename }}</p>
          <p>设备名: {{ reg.drname }}</p>
          <p>变量名: {{ reg.regName }}</p>
        </div>
      </div>

      <el-dialog title="变量选择" :visible.sync="dialogVisible" width="50%">
        <el-steps class="tips" space="40%" :active="active">
          <el-step title="步骤 1" description="选择设备类型查看设备" />
          <el-step title="步骤 2" description="选择设备查看变量" />
          <el-step title="步骤 3" description="选择所需变量" />
        </el-steps>
        <div class="device-data">
          <div class="device-type">
            <el-tree
              :data="deviceType"
              :props="deviceTypeProps"
              @node-click="selectDeviceType"
            />
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
          <h2 class="panel-title">记录信息</h2>
          <div class="panel-summary">按时间范围查看变量曲线和历史记录表格。</div>
        </div>
        <div class="toolbar">
          <div class="toolbar-field">
            <span>开始时间</span>
            <el-date-picker v-model="startTime" type="datetime" placeholder="选择开始时间" clearable />
          </div>
          <div class="toolbar-field">
            <span>结束时间</span>
            <el-date-picker v-model="endTime" type="datetime" placeholder="选择结束时间" clearable />
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" @click="search">查询</el-button>
            <el-button type="primary" @click="showCharts">图表表格切换</el-button>
            <el-button type="primary" @click="leadOut">导出</el-button>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <el-tabs
          v-if="lineData.length != 0"
          v-model="activeName"
          class="analysis-tabs"
        >
          <el-tab-pane
            v-for="(reg, i) in regs"
            :key="i"
            :label="reg.regName"
            :name="String(i)"
          >
            <div v-if="lineVisible" class="chart-stage">
              <HistoryLine
                :id="'hisline-' + i"
                :hislineData="lineData[i]"
                class="chart-panel"
              />
            </div>
            <el-table
              v-if="tableVisible"
              :ref="getTableRef(i)"
              :data="tableDatas[i]"
              height="400"
              border
              class="analysis-table"
            >
              <el-table-column prop="time" label="时间" width="180" />
              <el-table-column prop="tagname" label="变量名" width="180" />
              <el-table-column prop="tagvalue" label="数值" width="180" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
        <div v-else class="empty-state">
          请选择变量后查询数据
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findDeviceType,
  findDevice,
  findReg
} from "@/api/usersetting/runlog/datatable";
import { findSubitemEnergy } from "@/api/usersetting/energymange/subitemenergy";
import { formatDate } from "@/utils/index";
import HistoryLine from "@/components/Charts/HistoryLine";

export default {
  computed: {
    ...mapGetters(["path"])
  },
  components: {
    HistoryLine
  },
  data() {
    return {
      active: 1,
      activeName: "0",
      lineData: [],
      tableDatas: [],
      startTime: "",
      endTime: "",
      dialogVisible: false,
      lineVisible: true,
      tableVisible: false,
      deviceType: [],
      deviceName: [],
      regName: [],
      regs: [],
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
    findDeviceType(this.path)
      .then(res => {
        this.deviceType = res.data;
      })
      .catch(console.log);
  },
  methods: {
    getTableRef(index) {
      return `exportTab-${index}`;
    },
    selectReg() {
      this.dialogVisible = true;
    },
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
    selectDevice(data) {
      this.active = 3;
      findReg(this.path, data.drid, 1)
        .then(res => {
          this.regName = res.data;
        })
        .catch(console.log);
    },
    selectRegs() {
      this.regs = this.$refs.regTree.getCheckedNodes();
    },
    search() {
      if (this.startTime === "" || this.endTime === "") {
        this.$message.error("请选择开始时间和结束时间后再进行查询！");
      } else {
        const tagname = [];
        this.regs.forEach(ele => {
          tagname.push(ele.tagName);
        });
        const formData = new FormData();
        formData.append("date1", this.startTime);
        formData.append("date2", this.endTime);
        formData.append("tagname", tagname.join(","));
        const loading = this.$loading({
          lock: true,
          text: "图表正在加载中，请稍后",
          spinner: "el-icon-loading",
          background: "rgba(0, 0, 0, 0.7)"
        });
        setTimeout(() => {
          if (this.tableDatas.length === 0) {
            this.$message.error("访问超时");
            loading.close();
          }
        }, 30000);
        findSubitemEnergy(this.path, formData)
          .then(res => {
            loading.close();
            this.lineData = res.data;
            this.tableDatas = res.data;
            this.activeName = "0";
            this.lineData.forEach(line => {
              line.forEach(ele => {
                ele.time = formatDate(ele.time);
              });
            });
          })
          .catch(() => {
            loading.close();
          });
      }
    },
    showCharts() {
      this.lineVisible = !this.lineVisible;
      this.tableVisible = !this.tableVisible;
    },
    async leadOut() {
      if (this.tableVisible === false) {
        this.$message.error("请切换成表格形式再进行导出操作！");
        return null;
      }
      const currentIndex = Number(this.activeName);
      const safeIndex = Number.isNaN(currentIndex) ? 0 : currentIndex;
      const currentReg = this.regs[safeIndex] || this.regs[0] || {};
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
        FileSaver.saveAs(
          new Blob([wbout], { type: "application/octet-stream" }),
          `${currentReg.regName || "变量记录"}.xlsx`
        );
      } catch (e) {
        if (typeof console !== "undefined") {
          console.log(e, wbout);
        }
      }
      return wbout;
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

.variable-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-stack {
  display: grid;
  gap: 12px;
}

.selected-card,
.empty-state {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(222, 235, 255, 0.7);
}

.selected-card p {
  margin: 0;
  line-height: 1.7;
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

.analysis-table {
  width: 100%;
}

.device-data {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.device-type,
.device-name,
.reg-name {
  min-height: 460px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  overflow: auto;
}

.tips {
  margin-bottom: 10px;
}

@media (max-width: 1200px) {
  .page-shell {
    grid-template-columns: 1fr;
  }

  .device-data {
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
