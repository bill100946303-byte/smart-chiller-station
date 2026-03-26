<template>
  <el-table
    :id="id"
    :data="orderTableData"
    class="fix-defend-table"
    header-row-class-name="table-header"
    :row-class-name="tableRowClassName"
    max-height="600"
  >
    <af-table-column align="center" prop="time" label="派发时间" />
    <af-table-column align="center" prop="user" label="处理人" />
    <af-table-column align="center" prop="status" label="状态" />
  </el-table>
</template>
<script>
export default {
  props: ["id", "orderTableData"],
  data() {
    return {

    };
  },
  methods: {
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
.fix-defend-table {
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
.fix-defend-table::before {
  background: transparent;
}
</style>