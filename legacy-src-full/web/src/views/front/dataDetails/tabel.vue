<template>
  <div class="table_list">
    <el-table
        :data="tableData"
        :header-cell-style="{
          background: 'rgba(19, 115, 153, 1)',
          color: '#fff',
        }"
        style="width: 100%"
    >
      <el-table-column
          class-name="front-column"
          label="对象"
          :label="$t('logrizi.object')"
          prop="objName"
      >
      </el-table-column>
      <el-table-column
          class-name="front-column"
          label="总值"
          :label="$t('consumption.totalValue')"
      >
        <template slot-scope="scope">
          <span style="margin-left: 10px">{{ scope.row.sumValue }}
<!--            {{scope.row.runParamsCurveVO.unit == null ? '' : scope.row.runParamsCurveVO.unit}}-->
            {{DetermineUnit(scope)}}
          </span>
        </template>
      </el-table-column>

      <el-table-column
          class-name="front-column"
          label="峰值"
          :label="$t('consumption.peakValue')"
      >
        <template slot-scope="scope">
          <span style="margin-left: 10px">{{ scope.row.maxValue }}
<!--            {{scope.row.runParamsCurveVO.unit == null ? '' : scope.row.runParamsCurveVO.unit}}-->
            {{DetermineUnit(scope)}}
          </span>
        </template>
      </el-table-column>

      <el-table-column
          class-name="front-column"
          label="出现时间"
          :label="$t('consumption.timeOfOccurrence')"
          prop="maxTime"
      >
      </el-table-column>
      <el-table-column
          class-name="front-column"
          label="谷值"
          :label="$t('consumption.valleyValue')"
      >
        <template slot-scope="scope">
          <span style="margin-left: 10px">{{ scope.row.minValue }}
<!--            {{scope.row.runParamsCurveVO.unit == null ? '' : scope.row.runParamsCurveVO.unit}}-->
            {{DetermineUnit(scope)}}
          </span>
        </template>
      </el-table-column>
      <el-table-column
          class-name="front-column"
          label="出现时间"
          :label="$t('consumption.timeOfOccurrence')"
          prop="minTime"
      >
      </el-table-column>
      <el-table-column
          class-name="front-column"
          label="平均值"
          :label="$t('consumption.averageValue')"
      >
        <template slot-scope="scope">
          <span style="margin-left: 10px">{{ scope.row.average }}
<!--            {{scope.row.runParamsCurveVO.unit == null ? '' : scope.row.runParamsCurveVO.unit}}-->
            {{DetermineUnit(scope)}}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script>
export default {
  props: {
    tableData: Array,
  },
  data() {
    return {
      loading: true
    }
  },
  watch: {
    tableData: {
      handler(val) {
        if (val.length) {
          this.loading = false;
        }
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    DetermineUnit(e){
      return e.row.runParamsCurveVO.unit === null ? '' : e.row.runParamsCurveVO.unit
    }
  }
}
</script>
<style lang="scss">
.report-search-tabel {
  border: 1px solid #264F7C;
}
</style>
