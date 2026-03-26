<template>
<!-- 热量 -->
  <div class="index front-box-show">
    <div class="electric_page front-box-show">
      <div class="Echart_box">
        <TabpieEchart id="pie2" style="width: 100%; height: 100%" :lindata="lindata" class="lllbox"/>
      </div>

      <div class="line_echart">
        <TabLineEchart id="line" style="width: 100%; height: 100%" :xLabel="xLabel" :xData="xData"/>
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
        <el-table-column
          class-name="front-column"
          prop="drName"
          label="设备名称"
        >
        </el-table-column>
        <el-table-column
          class-name="front-column"
          prop="drTypeName"
          label="设备类型"
        >
        </el-table-column>
        <el-table-column class-name="front-column" prop="energyValue" label="热量">
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import TabpieEchart from "./components/TabpieEchart.vue";
import TabLineEchart from "./components/TabLineEchart.vue";

export default {
  components: {
    TabpieEchart,
    TabLineEchart,
  },
  props: {
    table:{
      type:Array,
      default:[]
    },
    xData:{
      type:Array,
      default:[]
    },
    xLabel:{
      type:Array,
      default:[]
    },
    lindata:Object
  },
  data() {
    return {
        dataY: [
        5, 10, 15, 30, 15, 10, 15, 20, 10, 5, 5, 23, 23, 12, 16, 15, 18, 30, 20,
        32, 40, 10, 5, 30, 20,
      ],
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
.lllbox{
  margin-left: -110px;
}
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
  #pie2 {
    width: 100%;
    height: 100%;
  }
}

.line_echart {
  width: 60%;
  height: 100%;
  // background:red;

  #line2 {
    width: 50%;
    height: 100%;
  }
}
.table_list {
  p{
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