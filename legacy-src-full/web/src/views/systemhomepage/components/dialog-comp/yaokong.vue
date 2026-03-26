<template>
  <div class="table-panel">
    <div class="table-panel__header">
      <div>
        <div class="table-panel__eyebrow">Operation Log</div>
        <div class="table-panel__title">操作记录</div>
      </div>
      <div class="table-panel__summary">
        <div class="table-panel__count">{{ tableData.length }}</div>
        <div class="table-panel__meta">
          <span class="table-panel__chip">{{ operatorsCount }} operators</span>
          <span class="table-panel__chip">{{ latestOperationTime }}</span>
        </div>
      </div>
    </div>

    <el-table
      :data="tableData"
      class="table-panel__table"
      style="width: 100%"
      :row-class-name="tableRowClassName"
      :cell-style="{'text-align':'center'}"
      :header-cell-style="{
        background: 'rgba(18, 39, 57, 0.9)',
        color: '#eef7ff',
        'text-align':'center',
        borderBottom:'1px solid rgba(124, 202, 255, 0.12)'
      }"
    >
      <el-table-column prop="details" :label="$t('dialog.operationContent')" />
      <el-table-column prop="operationResult" :label="$t('dialog.operationResults')" />
      <el-table-column prop="operationPerson" :label="$t('dialog.operator')" width="140" />
      <el-table-column :label="$t('dialog.operationTime')" width="220">
        <template slot-scope="scope">
          <div>{{ getNowTime(scope.row.date) }}</div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { formatDate } from "@/utils/index";
import {findByDrId} from '@/api/front/home'
import { mapGetters } from 'vuex';

export default {
  props:['drId'],
  data () {
    return {
      tableData: []
    }
  },
  computed:{
    ...mapGetters(['path']),
    operatorsCount() {
      return new Set(this.tableData.map(item => item.operationPerson).filter(Boolean)).size;
    },
    latestOperationTime() {
      if (!this.tableData.length) {
        return "暂无记录";
      }
      return this.getNowTime(this.tableData[0].date);
    },
  },
  created(){
    this.initData()
  },
  methods: {
    initData(){
      findByDrId(this.path,{drid:this.drId}).then(res=>{
        this.tableData = res.data;
      })
    },
    getNowTime (time) {
      return formatDate(time ? time : new Date().getTime());
    },
    tableRowClassName ({ rowIndex }) {
      return rowIndex % 2 ? 'table-row--alt' : 'table-row--base';
    },
  },
}
</script>

<style lang="scss">
.table-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  color: rgba(234, 244, 250, 0.94);
}

.table-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 0;
}

.table-panel__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.table-panel__title {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.table-panel__count {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(128, 210, 255, 0.18);
  background: rgba(120, 214, 255, 0.08);
  color: #84e7ff;
  font-size: 12px;
}

.table-panel__summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.table-panel__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.table-panel__chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(124, 202, 255, 0.12);
  color: rgba(196, 220, 239, 0.74);
  font-size: 12px;
}

.table-panel__table {
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
  border: 1px solid rgba(124, 202, 255, 0.12);
}

.table-panel__table .el-table__body-wrapper {
  background: transparent;
}

.table-panel__table .cell {
  padding: 0 12px;
}

.table-panel__table td {
  border-bottom: 1px solid rgba(124, 202, 255, 0.08);
  background: transparent;
}

.table-panel__table .el-table__body tr:hover > td {
  background: rgba(255, 255, 255, 0.04);
}

.table-panel__table .table-row--base td {
  background: rgba(255, 255, 255, 0.02);
}

.table-panel__table .table-row--alt td {
  background: rgba(255, 255, 255, 0.04);
}

.table-panel__table .el-table__empty-block {
  background: transparent;
}
</style>
