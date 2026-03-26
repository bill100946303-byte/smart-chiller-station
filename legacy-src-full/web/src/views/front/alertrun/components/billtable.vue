<template >
  <el-table
    ref="multipleTable"
    :data="tableData"
    tooltip-effect="dark"
    style="width: 100%"
    @selection-change="handleSelectionChange"
  >
    <el-table-column class-name="front-column" type="selection" width="55">
    </el-table-column>
    <el-table-column prop="deviceIdentify" class-name="front-column" :label="$t('alertrun_bill.deviceIdentification')" min-width="120">
    </el-table-column>
    <el-table-column prop="deviceCode" class-name="front-column" :label="$t('alertrun_bill.equipmentNumber')" min-width="120">
    </el-table-column>
    <el-table-column prop="deviceName" class-name="front-column" :label="$t('alertrun_bill.deviceName')" min-width="120">
    </el-table-column>
    <el-table-column prop="installPosition" class-name="front-column" :label="$t('alertrun_bill.installationPosition')" min-width="120">
    </el-table-column>
    <el-table-column prop="belongSystem" class-name="front-column" :label="$t('alertrun_bill.belongingSystem')" min-width="120">
    </el-table-column>
    <el-table-column class-name="front-column" :label="$t('alertrun_bill.operate')" min-width="220">
      <template slot-scope="scope">
        <el-button type="success" size="mini" @click="editComSort(scope.$index, scope.row)">{{$t('alertrun_bill.edit')}}</el-button>
        <el-button type="danger" size="mini" @click="seeComSort(scope.$index, scope.row)">{{$t('alertrun_bill.details')}}</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script>
export default {
  props: {
    tableData: {
      type: Array,
      default: []
    }
  },
  methods: {
    editComSort (index, val) {
      this.$emit('edittable', val)
    },
    seeComSort (index, val) {
      this.$emit('seetable', val)
    },
    handleSelectionChange (val) {
      let arr = val.reduce((pre, next) => {
        pre.push(next.id)
        return pre
      }, [])
      this.$emit('chooseItem', arr)
    }
  },
}
</script>
<style lang="">
</style>