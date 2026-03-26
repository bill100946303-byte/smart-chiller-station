<template>
  <div class="base-panel">
    <div class="base-panel__grid">
      <section v-for="(item, index) in arr" :key="index" class="group-card">
        <div class="group-card__header">
          <div>
            <div class="group-card__eyebrow">Parameter Group</div>
            <h3 class="group-card__title">{{ item.groupNameCNEN }}</h3>
          </div>
          <div class="group-card__count">{{ item.data.length }}</div>
        </div>

        <div :class="[$i18n.locale == 'zh' ? 'detailZH' : 'detailEN', 'metric-grid']">
          <button
            v-for="(list, metricIndex) in item.data"
            :key="metricIndex"
            type="button"
            class="metric-card"
            @click="clickcurve(list)"
          >
            <div class="metric-card__label" :title="list.regNameCNEN">
              {{ list.regNameCNEN }}
            </div>
            <div class="metric-card__value" :title="`${list.tagValue}${list.regUnits ? list.regUnits : ''}`">
              <span>{{ list.tagValue }}</span>
              <small>{{ list.regUnits ? list.regUnits : '' }}</small>
            </div>
          </button>
        </div>
      </section>
    </div>

    <transition name="curve-fade">
      <section v-if="curveShow" class="curve-sheet">
        <div class="curve-sheet__header">
          <div>
            <div class="curve-sheet__eyebrow">{{ $t('public.timeperiodSelection') }}</div>
            <div class="curve-sheet__title">{{ curveTitle }}</div>
          </div>
          <button class="curve-sheet__close" type="button" @click="close">
            <i class="el-icon-close"></i>
          </button>
        </div>

        <div class="curve-sheet__toolbar">
          <el-date-picker
            v-model="time"
            type="date"
            value-format="yyyy-MM-dd"
            placeholder="选择日期"
            :clearable="false"
            class="curve-sheet__date"
            @change="changTime"
          />
          <el-button class="curve-sheet__export" @click="exportform">
            <i class="al_element-icons al_icondaochu"></i>
            {{ $t('public.exportData') }}
          </el-button>
        </div>

        <div class="curve-sheet__body">
          <curve
            v-if="curveValueList"
            :alarmValue="alarmValue"
            :curveTitle="curveTitle"
            :regUnits="regUnits"
            :xData="curveValueList"
            class="curve-sheet__chart"
          />
        </div>
      </section>
    </transition>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import curve from './curve';
import dayjs from "dayjs";
import { findRegHistoryByDrid, exportRegHistoryByDrid } from "@/api/front/home";
import { exportExcel } from "@/utils/excel";

export default {
  components: {
    curve
  },
  props: ['drTypeId', 'drId'],
  computed: {
    ...mapGetters(['baseInfo', 'baseInfo2', 'subs', 'path', 'userid', 'id'])
  },
  data() {
    return {
      arr: [],
      curveShow: false,
      time: dayjs().format("YYYY-MM-DD"),
      curveValueList: [],
      regUnits: '',
      curveTitle: '',
      regId: '',
      alarmValue: ''
    }
  },
  watch: {
    baseInfo2: {
      handler(val) {
        this.handleData(JSON.parse(JSON.stringify(val)))
      },
      deep: true,
      immediate: true,
    }
  },
  methods: {
    close() {
      this.curveShow = false
    },
    clickcurve(value) {
      this.curveShow = true
      this.regUnits = value.regUnits == null ? '' : value.regUnits
      this.curveTitle = value.regNameCNEN
      this.regId = value.regId
      this.detailedTable()
    },
    changTime() {
      this.detailedTable()
    },
    detailedTable() {
      findRegHistoryByDrid(this.path, { dateType: 1, drId: this.drId, date: this.time, regId: this.regId }).then(res => {
        this.curveValueList = res.data.curveValueList
        this.alarmValue = res.data.alarmValue
      })
    },
    handleData(data) {
      this.arr = []
      this.readAndWriteParams = []

      data.forEach(item => {
        this.arr.push(item)
        this.mapArr2(item)
      })
    },
    handleParam(subid) {
      let arr = []
      this.subs.forEach((ele) => {
        if (ele.subid === parseInt(subid)) {
          arr.push({
            id: ele.value,
            value: ele.text,
          });
        }
      });
      return arr;
    },
    mapArr(arr) {
      return arr.data.map(item => {
        if (item.regName.includes(item.drname)) {
          item.regName = item.regName.slice(-(item.regName.length - item.drname.length - 1))
        }
        if (item.regSub) {
          item.tagValue = this.handlevalue(item)
          return item
        } else {
          item.tagValue = item.qstagvalue ? item.qstagvalue : item.tagValue
          return item
        }
      })
    },
    mapArr2(arr) {
      arr.data.map(item => {
        if (item.regSub) {
          item.tagValue = this.handlevalue(item)
        } else {
          item.tagValue = item.qstagvalue ? item.qstagvalue : item.tagValue
        }
      })
    },
    handlevalue(param) {
      let value;
      this.subs.forEach((sub) => {
        if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "1" &&
          param.qstagvalue == sub.value
        ) {
          value = (sub.text);
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "1" &&
          param.qstagvalue >= sub.valueMin &&
          param.qstagvalue <= sub.valueMax
        ) {
          value = (param.qstagvalue);
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "2" &&
          (param.qstagvalue < sub.valueMin ||
            param.qstagvalue > sub.valueMax)
        ) {
          value = (param.qstagvalue);
        }
      });
      return value
    },
    getvalue(item) {
      if (item.isSelect) {
        return item.arr.find(ele => ele.value == item.value).id
      } else {
        return item.value
      }
    },
    exportform() {
      exportRegHistoryByDrid(this.path, {
        dateType: 1,
        drId: this.drId,
        date: this.time,
        regId: this.regId
      }).then(res => {
        const filename = this.curveTitle + "记录.xls";
        exportExcel(res, filename);
      })
    },
    exportform_副本() {
      const tHeader = this.totalEnergyDataY.reduce(
        (pre, next) => {
          pre.push(next.title);
          return pre;
        },
        ["时间"]
      );
      console.log("tHeader", tHeader);
      let len = tHeader.length;
      const arr = new Array(this.xLabel.length).fill(0).map((item) => []);
      for (let i = 0; i < arr.length; i++) {
        let item = arr[i];
        for (let j = 0; j < len; j++) {
          if (j === 0) {
            item[j] = this.xLabel[i];
          } else {
            item[j] = this.totalEnergyDataY[j - 1].data[i]["cop"];
          }
        }
      }
      return
      import("@/vender/Export2Excel").then((excel) => {
        excel.export_json_to_excel({
          header: tHeader,
          data: arr,
          filename: "设备详情导出",
        });
      });
    }
  },
}
</script>

<style lang="scss" scoped>
.base-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  color: rgba(234, 244, 250, 0.94);
}

.base-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.group-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.group-card__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.group-card__title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(245, 250, 255, 0.98);
}

.group-card__count {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(128, 210, 255, 0.18);
  background: rgba(120, 214, 255, 0.08);
  color: #84e7ff;
  font-size: 12px;
}

.metric-grid {
  display: grid;
  gap: 12px;
}

.detailZH {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detailEN {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  padding: 14px 14px 12px;
  border-radius: 16px;
  border: 1px solid rgba(124, 202, 255, 0.1);
  background: linear-gradient(180deg, rgba(22, 50, 75, 0.56) 0%, rgba(12, 28, 44, 0.92) 100%);
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-1px);
  border-color: rgba(123, 213, 255, 0.24);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.14);
}

.metric-card__label {
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(208, 228, 241, 0.82);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.metric-card__value {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: #76e7ff;
}

.metric-card__value span {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.metric-card__value small {
  font-size: 12px;
  color: rgba(192, 222, 238, 0.8);
}

.curve-sheet {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(8, 21, 35, 0.96) 0%, rgba(12, 29, 45, 0.94) 100%);
}

.curve-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.curve-sheet__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.curve-sheet__title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.curve-sheet__close {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(239, 247, 252, 0.9);
}

.curve-sheet__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.curve-sheet__date {
  width: 220px;
}

.curve-sheet__export {
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #2d86ff 0%, #1ca2da 100%);
  color: #fff;
}

.curve-sheet__export i {
  margin-right: 6px;
}

.curve-sheet__body {
  min-height: 320px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(124, 202, 255, 0.1);
  background: rgba(4, 14, 24, 0.72);
}

.curve-sheet__chart {
  min-height: 320px;
}

.curve-fade-enter-active,
.curve-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.curve-fade-enter,
.curve-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 1280px) {
  .detailZH {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detailEN {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
