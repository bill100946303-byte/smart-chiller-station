<template>
  <div class="legacy-front-page metering-reading-page">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Meter Reading</div>
        <h1 class="legacy-front-page__title">能耗抄表</h1>
        <div class="legacy-front-page__meta">按时间区间查询抄表数据，并支持导出当前结果。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Columns</div>
          <div class="legacy-front-stat__value">{{ tableTitle.length }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Rows</div>
          <div class="legacy-front-stat__value">{{ tableDatas.length }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>{{ $t('public.search') }}</strong>
        <span>选择时间范围后刷新结果，也可以直接导出当前数据</span>
      </div>
      <el-form
        ref="forminline"
        :inline="true"
        :model="formInline"
        class="demo-form-inline legacy-front-toolbar__form"
      >
        <el-form-item
          :label="$t('public.timeperiodSelection')"
          prop="time">
          <el-date-picker
            v-model="formInline.time"
            :clearable="false"
            :end-placeholder="$t('meterReading.endTime')"
            :picker-options="pickerOptions"
            :start-placeholder="$t('meterReading.startTime')"
            prefix-icon="al_element-icons al_icona-huaban1"
            range-separator="-"
            type="datetimerange"
          />
        </el-form-item>
        <el-form-item>
          <el-button class="energy-btn" type="primary" @click="search">
            <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>
          <el-button class="energy-btn" type="primary" @click="clickExportData">
            <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
            {{ $t('public.exportData') }}
          </el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>抄表结果</strong>
          <span>{{ tableDatas.length ? `${tableDatas.length} rows` : '暂无数据' }}</span>
        </div>
      </div>
      <el-table
        v-loading="loading"
        :data="tableDatas"
        :fit="true"
        :header-cell-style="{
          background: '#122739',
          color: '#fff',
        }"
        class="report-search-tabel"
        element-loading-background="rgba(4, 11, 19, 0.72)"
        style="width: 100%"
      >
        <el-table-column
          v-for="(item, i) in tableTitle"
          :key="i"
          :label="item"
          class-name="front-column"
        >
          <template slot-scope="scope">
            <p>{{ scope.row[item] }}</p>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>
<script>
import {mapGetters} from "vuex";
import {findEnergyCoolingCapacity, exportCoolingCapacity} from '@/api/front/energytest'
import dayjs from "dayjs";
import {exportExcel} from "@/utils/excel";

export default {
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      loading: true,
      formInline: {
        time: [dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'), dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')],
        startTime: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        endTime: dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
      },
      tableDatas: [],
      tableTitle: [],
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        },
        shortcuts: [{
          text: this.$t('meterReading.lastWeek'),
          onClick(picker) {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
            picker.$emit('pick', [start, end]);
          }
        }, {
          text: this.$t('meterReading.lastMonth'),
          onClick(picker) {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
            picker.$emit('pick', [start, end]);
          }
        }, {
          text: this.$t('meterReading.lastThreeMonths'),
          onClick(picker) {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
            picker.$emit('pick', [start, end]);
          }
        }]
      },
    }
  },
  created() {
    this.search()
  },
  methods: {
    search() {
      this.tableTitle = []
      this.tableDatas = []
      this.loading = true;
      this.formInline.startTime = dayjs(this.formInline.time[0]).format('YYYY-MM-DD HH:mm:ss')
      this.formInline.endTime = dayjs(this.formInline.time[1]).format('YYYY-MM-DD HH:mm:ss')
      findEnergyCoolingCapacity(this.path, this.formInline).then(res => {
        this.loading = false;
        const records = res && res.data && res.data.records ? res.data.records : [];
        if (records.length) {
          for (const key in records[0]) {
            this.tableTitle.push(key)
          }
        }
        this.$nextTick(() => {
          this.tableDatas = records;
        })
      }).catch(() => {
        setTimeout(() => {
          this.loading = false;
        }, 300)
      })
    },
    clickExportData() {
      exportCoolingCapacity(this.path, this.formInline).then(res => {
        const filename = "能耗抄表.xls";
        exportExcel(res, filename);
      })
    },
  },
};
</script>
<style lang="scss" scoped>
.metering-reading-page {
  ::v-deep .legacy-front-toolbar__form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    align-items: flex-end;
  }

  ::v-deep .el-form-item {
    margin-bottom: 0;
  }

  ::v-deep .el-form-item__label {
    color: rgba(223, 236, 245, 0.82);
  }

  ::v-deep .el-input__inner,
  ::v-deep .el-range-editor.el-input__inner {
    min-height: 42px;
    border-radius: 12px;
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 251, 255, 0.96);
  }

  ::v-deep .el-range-separator,
  ::v-deep .el-input__icon {
    color: rgba(191, 220, 236, 0.72);
  }
}

.energy-btn {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  border-color: rgba(107, 202, 245, 0.48);
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  color: #fff;
}

.energy-btn__icon {
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 15px;
}
</style>
