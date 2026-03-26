<template>
  <div class="index front-box-show">
    <div class="electric_page">
      <div class="Echart_box">
        <electricTabEchart id="heat1" style="width: 100%; height: 100%" :echartdata="echartdata"/>
      </div>

      <div class="line_echart">
        <electricTabLineEchart id="line" style="width: 100%; height: 100%" :xLabel="xLabel" :xData="xData"/>
      </div>
    </div>

    <div class="table_list">
      <p>设备列表</p>
      <el-table
        :header-cell-style="{
          background: 'rgba(5, 24, 45, 1)',
          color: 'rgba(153, 153, 153, 1)',
        }"
        :data="table"
        style="width: 100%"
      >
      <el-table-column class-name="front-column" prop="drName" label="设备名称">
      </el-table-column>
        <el-table-column class-name="front-column" prop="drTypeName" label="设备类型">
        </el-table-column>
        <el-table-column class-name="front-column" prop="energyValue" label="电量">
        </el-table-column>

        <el-table-column class-name="front-column" prop="money" label="电费">
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import electricTabEchart from "./components/electricTabEchart.vue";
import electricTabLineEchart from "./components/electricTabLineEchart .vue";

export default {
  components: {
    electricTabEchart,
    electricTabLineEchart,
  },
  props: {
    echartdata:{
      type:Object,
      default:{}
    },
    xLabel:{
      type:Array,
      default:[]
    },
    xData:{
      type:Array,
      default:[]
    },
    table:{
      type:Array,
      default:[]
    },
  },
  data() {
    return {
    };
  },
  watch: {},
  computed: {},
  methods: {},
  created() {},
  mounted() {},
};
</script>
<style lang="scss" scoped>
.electric_page {
  width: 100%;
  height: 500px;
  // background: red;
  display: flex;
  justify-content: space-between;
}
.Echart_box {
  width: 40%;
  height: 100%;
  // background: pink;
}

.line_echart {
  width: 60%;
  height: 100%;
  // background:red;
}

.table_list {
  p {
    font-size: 24px;
    font-family: PingFang SC;
    font-weight: 400;
    color: #ffffff;
    margin-bottom: 36px;
  }
}

::v-deep .el-table__row > td {
  border: none;
}
::v-deep .el-table::before {
  //去掉最下面的那一条线
  height: 0px;
}

::v-deep.el-table tr {
  background-color: rgba(5, 27, 51, 1);
}
</style>