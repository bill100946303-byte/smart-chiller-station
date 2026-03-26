<template>
  <el-table
    :id="id"
    :data="tableData"
    class="time-alarm-table"
    header-row-class-name="table-header"
    :row-class-name="tableRowClassName"
    max-height="600"
  >
    <af-table-column align="center" prop="time" label="时间" />
    <af-table-column align="center" prop="drname" label="设备名" />
    <af-table-column align="center" prop="alarmtypename" label="报警级别" />
  </el-table>
</template>
<script>
import { mapGetters } from "vuex";
import { getAlarmTableData } from "@/api/usersetting/devicemonitor/model1";
import { formatDate } from "@/utils/index";

export default {
  props: ["id", "alarmTableBdReg"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      tableData: [], // 实时报警列表数据
      alarmTime: null
    };
  },
  created() {
    if (this.alarmTableBdReg == "1") {
      // 实时报警列表
      this.findAlarmTime();
      this.alarmTime = setInterval(() => {
        this.findAlarmTime();
      }, 10000);
    } else if (this.alarmTableBdReg == "2") {
      // 历史报警数据
    }
  },
  destroyed() {
    clearInterval(this.alarmTime);
  },
  methods: {
    // 查询实时报警信息
    findAlarmTime() {
      getAlarmTableData(this.path, this.alarmTableBdReg)
        .then(res => {
          this.tableData = res.data;
          this.tableData.forEach(ele => {
            ele.time = formatDate(ele.time);
          });
        })
        .catch(console.log);
    },
    tableRowClassName({ row, rowIndex }) {
      if (rowIndex % 2 === 0) {
        return "danshu-row";
      } else if (rowIndex % 2 === 1) {
        return "shuangshu-row";
      }
      return "";
    }
  }
};
</script>
<style lang="scss">
.time-alarm-table {
  max-width: none;
  background: transparent;
  .table-header {
    background: transparent;
    color: #00e5ff;
    font-size: 14px;
    .is-center {
      padding: 0 !important;
      height: 30px;
      border: 0;
      background: transparent;
    }
  }
  .danshu-row {
    background: rgba(7, 12, 25, 0.3);
    color: var(--theme-color);
    font-size: 14px;
    .is-center {
      padding: 0 !important;
      height: 25px;
      border: 0;
      background: rgba(7, 12, 25, 0.3);
    }
  }
  .shuangshu-row {
    background: transparent;
    color: var(--theme-color);
    font-size: 14px;
    .is-center {
      padding: 0 !important;
      height: 25px;
      border: 0;
      background: transparent;
    }
  }
  .el-table__body tr:hover > td {
    background: transparent;
  }
  .time-column:hover, .drname-column:hover, .alarmtypename-column:hover {
    background-color: transparent !important;
  }
  // .el-table--striped .el-table__body tr.hover-row.el-table__row--striped > td,
  // .el-table__body tr.hover-row > td {
  //   background-color: #2a405b !important;
  // }
}
.time-alarm-table::before {
  background: transparent;
}
</style>