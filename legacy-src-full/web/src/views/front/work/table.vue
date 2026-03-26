<template>
  <el-table
    :data="tableDatas"
    style="width: 100%"
    max-height="750"
    :fit="true"
    class="report-search-tabel"
    @selection-change="handleSelectionChange"
  >
    <!-- <el-table-column
      type="selection"
      fixed
      width="55"
      class-name="front-column"
    /> -->
    <el-table-column
      prop="id"
      label="Id"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column
      prop="drtypename"
      label="设备类型"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column
      prop="drname"
      label="设备"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column
      prop="worktime"
      label="派单时间"
      width="220"
      class-name="front-column"
    >
    <template slot-scope="scope">
        {{getTime(scope.row.worktime)}}
    </template>
    </el-table-column>
    <el-table-column
      prop="workuser"
      label="派单人"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column
      prop="worklevel"
      label="工单级别"
      min-width="140"
      class-name="front-column"
    >
     <template slot-scope="scope">
        {{getlevel(scope.row.worklevel)}}
    </template>
    </el-table-column>
    <el-table-column
      prop="executeuser"
      label="接单人"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column
      prop="executetime"
      label="工单处理时间"
      width="220"
      class-name="front-column"
    >
     <template slot-scope="scope">
        {{getTime(scope.row.worktime)}}
    </template>
    </el-table-column>
    <el-table-column
      prop="finishtime"
      label="工单完成时间"
      width="220"
      class-name="front-column"
    >
     <template slot-scope="scope">
        {{getTime(scope.row.worktime)}}
    </template>
    </el-table-column>
    <el-table-column
      prop="state"
      label="工单状态"
      min-width="140"
      class-name="front-column"
    >
        <template slot-scope="scope">
        {{getstate(scope.row.state)}}
    </template>
    </el-table-column>
    <el-table-column
      prop="workexplain"
      label="工单描述"
      min-width="140"
      class-name="front-column"
    />
    <el-table-column label="操作" width="180px">
      <template slot-scope="scope">
        <el-button
          size="mini"
          type="primary"
          @click="handleEdit(scope.$index, scope.row)"
          >编辑</el-button
        >
        <el-button
          size="mini"
          type="danger"
          @click="handleDelete(scope.$index, scope.row)"
          >删除</el-button
        >
      </template>
    </el-table-column>
  </el-table>
</template>

<script>
import {

  deleteOrder
} from "@/api/usersetting/deviceoperation/ordermanage";
import { mapGetters } from 'vuex';
import dayjs from 'dayjs'
export default {
  props: ["tableDatas"],
  data() {
    return {
         orderLevelOptions: [
        {
          id: 1,
          value: "紧急",
        },
        {
          id: 2,
          value: "中等",
        },
        {
          id: 3,
          value: "一般",
        },
      ], // 工单级别选项
      orderStatusOptions: [
        {
          id: 1,
          value: "待处理",
        },
        {
          id: 2,
          value: "处理中",
        },
        {
          id: 3,
          value: "已完成",
        },
      ],
      orderIds: [], // 批量删除工单id
    };
  },
  computed:{
      ...mapGetters(['path'])
  },
  methods: {
    // 删除
    handleDelete(index, row) {
      deleteOrder(this.path, row.id)
        .then((res) => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("删除成功!");
            this.$emit('reload');
          }
        })
        .catch(console.log);
    },
    getlevel(level){
        let iy =  this.orderLevelOptions.find(item=>item.id == level)
        return iy?iy.value:''
    },
    getTime(time){
        if(!time){
            return '--'
        }else{
            return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
        }
    },
    getstate(level){
        let iy =  this.orderStatusOptions.find(item=>item.id == level)
        return iy?iy.value:''
    },
    handleEdit(row){
        this.$emit('edit',this.tableDatas[row])
    },
    handleSelectionChange(val){
        this.$emit('slectlist',val)
    }
  },
};
</script>

<style>
.report-search-tabel{
border: 1px solid #264F7C;

}
</style>
