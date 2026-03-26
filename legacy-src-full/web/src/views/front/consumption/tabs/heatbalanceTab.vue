<template>
  <!--热不平衡 -->
  <div class="index front-box-show">
    <div class="electric_page front-box-show">
      <div class="line_echart">
        <lineEchart
          id="line4"
          :xData="xData" :xLabel="xLabel"
          style="width: 100%; height: 100%"
        />
      </div>
    </div>

 

    <div class="table_list">
      <el-table
        :data="dataStatisticsList"
        :header-cell-style="{
       /*   background: 'rgba(5, 24, 45, 1)',
          color: 'rgba(153, 153, 153, 1)',*/
          background: 'rgba(19, 115, 153, 1)',
          color: '#fff',
        }"
        style="width: 100%"
      >
<!--        <el-table-column class-name="front-column" prop="acquisitionValue" label="采集值">-->
        <el-table-column class-name="front-column" prop="acquisitionValue" :label="$t('energytest_hotbalance.collectionValue')">
        </el-table-column>
<!--        <el-table-column class-name="front-column" prop="scalar" label="达标量（-5%-5%）">-->
        <el-table-column class-name="front-column" prop="scalar" :label="$t('energytest_hotbalance.reachingStandardQuantity') +'（-5%-5%）'">
        </el-table-column>
<!--        <el-table-column class-name="front-column" prop="noScalar" label="不达标量">-->
        <el-table-column class-name="front-column" prop="noScalar" :label="$t('energytest_hotbalance.notMeetingTheStandardQuantity')">
        </el-table-column>

<!--        <el-table-column class-name="front-column" prop="scalarRate" label="达标率">-->
        <el-table-column class-name="front-column" prop="scalarRate" :label="$t('energytest_hotbalance.ComplianceRate')">
        </el-table-column>
      </el-table>
    </div>

    <!-- <div class="table_list" style="margin-top: 106px">
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

        <el-table-column
          class-name="front-column"
          prop="scalarRate"
          label="达标率"
        >
        </el-table-column>
      </el-table>
    </div> -->
  </div>
</template>

<script>
import electricTabEchart from "./components/electricTabEchart.vue";
import lineEchart from "./components/lineEchart.vue";

export default {
  components: {
    electricTabEchart,
    lineEchart,
  },
  props: {
    xData:{
      type:Array,
      default:[]
    },
    xLabel:{
      type:Array,
      default:[]
    },
    dataStatisticsList:{
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
      totalEnergyDataY: [
        10, 14, 12, 5, 2, 14, -6, 11, 13, -8, 4, -10, 11, 11, 10, -9, 13, 15, 8,
        13, 12, 5, 6, 8, -9,
      ]
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
  //height: 500px;
  height: 50vh;
}

.line_echart {
  width: 100%;
  height: 100%;
  // background:red;
}

.table_list {
  margin-top: 75px;
}

::v-deep .el-table__row > td {
  border: none;
}
::v-deep .el-table::before {
  //去掉最下面的那一条线
  height: 0px;
}

::v-deep.el-table tr {
  //background-color: rgba(5, 27, 51, 1);
}
</style>