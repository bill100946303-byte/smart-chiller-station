<template>
  <div class="table-panel">
    <div class="table-panel__header">
      <div>
        <div class="table-panel__eyebrow">Alarm Log</div>
        <div class="table-panel__title">报警记录</div>
      </div>
      <div class="table-panel__summary">
        <div class="table-panel__count">{{ tableData.length }}</div>
        <div class="table-panel__meta">
          <span class="table-panel__chip">待恢复 {{ pendingCount }}</span>
          <span class="table-panel__chip">{{ latestAlarmTime }}</span>
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
      <el-table-column prop="alarmtypename" :label="$t('dialog.level')" width="110" />
      <el-table-column :label="$t('dialog.status')" width="110">
        <template slot-scope="scope">
          <span :class="['state-pill', scope.row.alarmstate == '1' ? 'state-pill--pending' : 'state-pill--restore']">
            {{ scope.row.alarmstate == '1' ? '待恢复' : '已恢复' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="alarmexplain" :label="$t('dialog.alarmContent')" />
      <el-table-column :label="$t('dialog.alarmTime')" width="220">
        <template slot-scope="scope">
          <div>{{ getTime(scope.row.time) }}</div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { AlarmlogfindByDrId } from "@/api/front/home";
import { mapGetters } from "vuex";
import dayjs from "dayjs";

export default {
  props: ["drId"],
  data() {
    return {
      tableData: [],
    };
  },
  computed: {
    ...mapGetters(["path"]),
    pendingCount() {
      return this.tableData.filter(item => `${item.alarmstate}` === "1").length;
    },
    latestAlarmTime() {
      if (!this.tableData.length) {
        return "暂无记录";
      }
      return this.getTime(this.tableData[0].time);
    },
  },
  created() {
    this.initData();
  },
  methods: {
    initData() {
      AlarmlogfindByDrId(this.path, this.drId).then((res) => {
        this.tableData = res.data;
      });
    },
    getTime(time) {
      if (time) {
        return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
      }
      return "--";
    },
    tableRowClassName({ rowIndex }) {
      return rowIndex % 2 ? "table-row--alt" : "table-row--base";
    },
  },
};
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

.state-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.state-pill--pending {
  color: #ffb28f;
  background: rgba(255, 178, 143, 0.12);
  border: 1px solid rgba(255, 178, 143, 0.14);
}

.state-pill--restore {
  color: #7edcff;
  background: rgba(126, 220, 255, 0.12);
  border: 1px solid rgba(126, 220, 255, 0.14);
}

.table-panel__table .el-table__empty-block {
  background: transparent;
}
</style>
