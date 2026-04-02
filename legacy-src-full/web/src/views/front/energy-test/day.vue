<template>
  <div class="day-front energy-analysis-view">
    <section class="legacy-front-toolbar energy-analysis-toolbar energy-analysis-toolbar--calendar">
      <div class="energy-analysis-toolbar__meta energy-analysis-toolbar__meta--calendar">
        <div class="energy-analysis-toolbar__copy">
          <strong>能效日历</strong>
          <span>按月查看日能效与分项构成</span>
        </div>
        <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form energy-analysis-toolbar__form--calendar">
          <el-form-item label="月份">
            <el-date-picker
              v-model="time"
              :clearable="true"
              placeholder="选择日期"
              prefix-icon="al_element-icons al_icona-huaban1"
              popper-class="legacy-front-picker-popper"
              type="month"
              value-format="yyyy-MM"
              @change="pickerchange"
            />
          </el-form-item>
        </el-form>
        <div class="energy-analysis-chip-list energy-analysis-chip-list--calendar">
          <div v-for="chip in legendChips" :key="chip.label" class="energy-analysis-chip">
            <strong>{{ chip.label }}</strong>
            <span>{{ chip.text }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="energy-analysis-summary-grid energy-analysis-summary-grid--calendar">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="energy-analysis-summary-card"
      >
        <div class="energy-analysis-summary-card__label">{{ card.label }}</div>
        <div
          class="energy-analysis-summary-card__value"
          :class="{ 'energy-analysis-summary-card__value--text': card.textValue }"
        >
          {{ card.value }}
          <span v-if="card.suffix">{{ card.suffix }}</span>
        </div>
        <div class="energy-analysis-summary-card__meta">{{ card.meta }}</div>
      </article>
    </section>

    <section class="energy-analysis-grid energy-analysis-grid--calendar">
      <article class="energy-analysis-card">
        <div class="energy-analysis-card__header">
          <div>
            <div class="energy-analysis-card__eyebrow">日历分析</div>
            <div class="energy-analysis-card__title">月度能效日历</div>
          </div>
          <div class="energy-analysis-card__meta">点击日历中的某一天可查看对应的日视图指标和分项构成。</div>
        </div>
        <div class="energy-analysis-card__body energy-analysis-card__body--tight">
          <el-calendar ref="calendar" :first-day-of-week="7">
            <template slot="dateCell" slot-scope="{ date, data }">
              <div :class="getCalendarCellClass(data.day)" @click="chooseday(date, data)">
                <div class="energy-calendar-cell__top">
                  <p class="day-time">{{ getDay(data.day) }}</p>
                  <span v-if="isBestDate(data.day)" class="energy-calendar-cell__badge">最佳</span>
                  <span v-else-if="isToday(data.day)" class="energy-calendar-cell__badge is-today">今日</span>
                </div>
                <div v-if="getmonth(data.day) && isBeforeToday(data.day)" class="flex-end">
                  <div class="energy-calendar-metrics">
                    <p :class="[getEclass(getE(getDay(data.day))), 'e-box', 'energy-calendar-metrics__primary']">
                      {{ formatCalendarMetric('E', getEfficiencyValue(getDay(data.day))) }}
                    </p>
                    <div class="energy-calendar-metrics__pair">
                      <p class="p-box">{{ formatCalendarMetric('P', getMetricValue(getDay(data.day), 'p')) }}</p>
                      <p class="c-box">{{ formatCalendarMetric('C', getMetricValue(getDay(data.day), 'c')) }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-calendar>
        </div>
      </article>

      <div class="energy-analysis-side-stack energy-analysis-side-stack--calendar">
        <article class="energy-analysis-card energy-analysis-card--primary-insight">
          <div class="energy-analysis-card__header">
            <div>
              <div class="energy-analysis-card__eyebrow">趋势分析</div>
              <div class="energy-analysis-card__title">能效等级走势</div>
            </div>
          <div class="energy-analysis-card__meta">{{ currentViewMeta }}</div>
          </div>
          <div class="energy-analysis-card__body energy-analysis-card__body--tight">
            <linebox
              @groupchange="groupchange"
              :time="time"
              ref="linebox"
              :num="energynum"
              :energynumRT="energynumRT"
              :info="boxinfo"
              :getMShow="getMShow"
            />
          </div>
        </article>

        <article class="energy-analysis-card energy-analysis-card--secondary-insight">
          <div class="energy-analysis-card__header">
            <div>
              <div class="energy-analysis-card__eyebrow">构成分析</div>
              <div class="energy-analysis-card__title">分项构成</div>
            </div>
            <div class="energy-analysis-card__meta">识别主导耗能对象</div>
          </div>
          <div class="energy-analysis-card__body">
            <div class="energy-analysis-chart-box energy-analysis-chart-box--compact energy-analysis-chart-box--breakdown">
              <electricTabEchart
                id="heat1"
                style="width: 100%; height: 100%"
                :echartdata="piedata"
              />
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script>
import Linebox from "./components/linebox.vue";
import electricTabEchart from "./components/electricTabEchart.vue";
import { findEnergyCalendar, findMonthEnergy } from "@/api/front/energytest";
import dayjs from "dayjs";
import { mapGetters } from "vuex";
import { getEnergyAnalysisPie } from "@/api/front/consumption";

export default {
  name: "EnergyTestDay",
  components: {
    Linebox,
    electricTabEchart
  },
  data() {
    return {
      time: dayjs().format("YYYY-MM-DD"),
      datalist: [],
      range: [],
      piedata: {},
      dateType: 2,
      daylist: {
        月: 3,
        日: 2
      },
      energynum: 0,
      energynumRT: 0,
      boxinfo: {},
      getMShow: true
    };
  },
  props: {
    num: Number
  },
  computed: {
    ...mapGetters(["id", "path", "unitSelete"]),
    month() {
      return dayjs(this.time).month() + 1;
    },
    year() {
      return dayjs(this.time).year();
    },
    legendChips() {
      const items = [
        {
          label: "E",
          text: "运行能效"
        },
        {
          label: "C",
          text: "日冷量"
        },
        {
          label: "P",
          text: "日耗电"
        }
      ];
      if (this.getMShow) {
        items.push({
          label: "M",
          text: "冷量单价"
        });
      }
      return items;
    },
    summaryCards() {
      const bestDay = this.getBestDay();
      return [
        {
          key: "efficiency",
          label: "系统能效",
          value: this.formatValue(this.energynum),
          suffix: `${this.unitSelete}/${this.unitSelete}`,
          meta: "当前视图结果"
        },
        {
          key: "electric",
          label: "日电量",
          value: this.formatValue(this.boxinfo.p),
          suffix: "KW*h",
          meta: "当前日结果"
        },
        {
          key: "cooling",
          label: "日冷量",
          value: this.formatValue(this.boxinfo.c),
          suffix: `${this.unitSelete}*h`,
          meta: "当前日结果"
        },
        {
          key: "best",
          label: "最佳日",
          value: bestDay.label || "暂无",
          suffix: "",
          meta: bestDay.label ? `能效 ${this.formatValue(bestDay.value)} ${this.unitSelete}/${this.unitSelete}` : "当月暂无数据",
          textValue: true
        }
      ];
    },
    selectedDateText() {
      return this.dateType === 2 ? dayjs(this.time).format("YYYY-MM-DD") : dayjs(this.time).format("YYYY-MM");
    },
    currentViewMeta() {
      return `${this.dateType === 2 ? "日视图" : "月视图"} · ${this.selectedDateText}`;
    }
  },
  created() {
    this.handleSearch().then(() => {
      this.getdaydata();
    });
    this.getPie();
  },
  mounted() {
    const ref = this.$refs.calendar;
    const target = this.$refs.calendar.$el;
    target.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      ref.pickDay(this.time);
    });
  },
  methods: {
    toNumber(value) {
      const number = Number(String(value || "").replace(/,/g, ""));
      return isNaN(number) ? 0 : number;
    },
    formatValue(value) {
      const number = this.toNumber(value);
      if (!number) {
        return "0";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: number >= 100 ? 0 : 1
      });
    },
    getBestDay() {
      return this.datalist
        .map(item => {
          return {
            label: `${this.month}月${item.date}日`,
            value: this.toNumber(item.rte)
          };
        })
        .sort((a, b) => b.value - a.value)[0] || { label: "", value: 0 };
    },
    isToday(day) {
      return dayjs(day).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");
    },
    isSelectedDate(day) {
      return this.dateType === 2 && dayjs(day).format("YYYY-MM-DD") === dayjs(this.time).format("YYYY-MM-DD");
    },
    isBestDate(day) {
      const bestDay = this.getBestDay();
      return !!bestDay.label && bestDay.label === `${this.month}月${this.getDay(day)}日`;
    },
    hasDayData(day) {
      return this.datalist.some(item => item.date === this.getDay(day));
    },
    getCalendarCellClass(day) {
      return {
        "energy-calendar-cell": true,
        "is-selected": this.isSelectedDate(day),
        "is-best": this.isBestDate(day),
        "is-empty": !this.hasDayData(day),
        "is-today": this.isToday(day)
      };
    },
    isBeforeToday(date) {
      return dayjs(date).isBefore(dayjs().add(1, "day"), "day");
    },
    chooseday(day, data) {
      const str = data.day.split("-")[1];
      if (str == this.month) {
        this.time = dayjs(day).format("YYYY-MM-DD");
        this.dateType = this.daylist["日"];
        if (this.$refs.linebox) {
          this.$refs.linebox.type = this.$t("public.day");
        }
        this.getdaydata();
        this.getPie();
      }
    },
    findMonthEnergys() {
      findMonthEnergy(this.path, { date: this.time }).then(res => {
        this.boxinfo = res.data || {};
        this.energynum = Number(res.data.rte) || 0;
        this.energynumRT = Number(res.data.e);
      });
    },
    getDay(day) {
      return dayjs(day).format("DD");
    },
    groupchange(val) {
      this.dateType = this.daylist[val];
      if (val === "月") {
        this.time = dayjs(this.time).format("YYYY-MM");
        this.findMonthEnergys();
      } else {
        this.time = dayjs(this.time).format("YYYY-MM-DD");
        this.getdaydata();
      }
      this.getPie();
    },
    getdaydata() {
      const el = this.datalist.find(item => item.date === dayjs(this.time).format("DD"));
      if (!el) {
        this.energynum = 0;
        this.energynumRT = 0;
        this.boxinfo = {};
        return;
      }
      this.energynum = Number(el.rte) || 0;
      this.energynumRT = Number(el.e);
      this.boxinfo = el;
    },
    pickerchange() {
      this.dateType = this.daylist["月"];
      if (this.$refs.linebox) {
        this.$refs.linebox.type = "月";
      }
      this.handleSearch();
      this.findMonthEnergys();
      this.getPie();
    },
    getrange() {
      this.$nextTick(() => {
        this.$refs.calendar.pickDay(dayjs(this.time).format("YYYY-MM-DD"));
      });
    },
    handleSearch() {
      this.getrange();
      const obj = {
        appId: this.id,
        month: this.month,
        year: this.year
      };
      return findEnergyCalendar(obj).then(res => {
        this.datalist = (res.data || []).map(item => {
          const date = item.date.split("号")[0];
          item.date = date.length == 2 ? date : "0" + date;
          item.evalue = Number(item.e);
          return item;
        });
      });
    },
    getPie() {
      const info = {
        appId: this.id,
        date: this.dateType === 2 ? dayjs(this.time).format("YYYY-MM-DD") : dayjs(this.time).format("YYYY-MM"),
        dateType: this.dateType,
        energyType: 1
      };
      getEnergyAnalysisPie(info).then(res => {
        this.piedata = res.data || {};
      });
    },
    getEclass(datas) {
      if (datas) {
        const datasplit = datas.split(":");
        if (datasplit) {
          const data = Number(datasplit[3]) || 0;
          if (data >= 5.0) {
            return "first-cs";
          } else if (data >= 4.1) {
            return "two-cs";
          } else if (data >= 3.5) {
            return "three-cs";
          } else if ((data > 0 || data < 0) && this.ifdatasplit(datasplit[2])) {
            return "four-cs";
          } else if (this.ifdatasplit(datasplit[2])) {
            return "five-cs";
          }
        }
      }
    },
    ifdatasplit(e) {
      return dayjs(dayjs(this.year + "-" + this.month + "-" + e).format("YYYY-MM-DD")).unix() <=
        dayjs(dayjs().startOf("day").format("YYYY-MM-DD")).unix();
    },
    getE(day) {
      const arr = this.datalist.filter(item => item.date === day);
      if (arr.length) {
        const rteValue = parseFloat(String(arr[0].rte).replace(/,/g, ""));
        return "E:" + rteValue + ":" + arr[0].date + ":" + arr[0].e;
      }
      return null;
    },
    getP(day) {
      const arr = this.datalist.filter(item => item.date === day);
      return arr.length ? this.$t("energytest_day.P") + ": " + arr[0].p : null;
    },
    getMetricValue(day, field) {
      const arr = this.datalist.filter(item => item.date === day);
      if (!arr.length) {
        return null;
      }
      return arr[0][field];
    },
    getEfficiencyValue(day) {
      const arr = this.datalist.filter(item => item.date === day);
      return arr.length ? arr[0].rte : null;
    },
    getC(day) {
      const arr = this.datalist.filter(item => item.date === day);
      return arr.length ? this.$t("energytest_day.C") + ": " + arr[0].c : null;
    },
    getM(day) {
      const arr = this.datalist.filter(item => item.date === day);
      if (arr.length) {
        this.getMShow = arr[0].m !== "-1";
        return this.$t("energytest_day.M") + ": " + arr[0].m;
      }
      return null;
    },
    getmonth(day) {
      return day.split("-")[1] == this.month;
    },
    compactMetricValue(value) {
      if (value === undefined || value === null || value === "" || value === "-1") {
        return "--";
      }
      const number = Number(String(value).replace(/,/g, ""));
      if (isNaN(number)) {
        return String(value);
      }
      if (Math.abs(number) >= 10000) {
        return `${(number / 10000).toFixed(1)}万`;
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: 0
      });
    },
    formatCalendarMetric(label, value) {
      return `${label} ${this.compactMetricValue(value)}`;
    }
  }
};
</script>

<style lang="scss" scoped>
.day-front {
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.energy-calendar-cell {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 2px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.energy-calendar-cell__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.energy-calendar-cell__badge {
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(45, 134, 255, 0.18);
  border: 1px solid rgba(102, 197, 245, 0.18);
  color: rgba(244, 250, 255, 0.9);
  font-size: 8px;
  line-height: 1.2;
}

.energy-calendar-metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.energy-calendar-metrics__primary {
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
}

.energy-calendar-metrics__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 3px;
}

.energy-calendar-cell__badge.is-today {
  background: rgba(92, 200, 255, 0.16);
  color: rgba(124, 240, 255, 0.92);
}
</style>

<style lang="scss">
.day-front {
  .energy-analysis-toolbar--calendar {
    padding-top: 5px;
    padding-bottom: 5px;
  }

  .energy-analysis-toolbar__meta--calendar {
    align-items: center;
    gap: 8px;
  }

  .energy-analysis-toolbar__form--calendar {
    margin-left: auto;
  }

  .energy-analysis-chip-list--calendar {
    justify-content: flex-end;
    max-width: 360px;
  }

  .energy-analysis-summary-grid--calendar {
    gap: 3px;
  }

  .el-calendar__header {
    display: none;
  }

  .el-calendar {
    background: transparent;
  }

  .el-calendar-table {
    thead {
      background: transparent;

      th {
        color: rgba(181, 209, 226, 0.72);
        font-weight: 600;
        border-right: 1px solid rgba(125, 202, 255, 0.08);
        border-top: 1px solid rgba(125, 202, 255, 0.08);
        background: rgba(255, 255, 255, 0.02);
      }
    }

    td {
      border-bottom: 1px solid rgba(125, 202, 255, 0.08);
      border-right: 1px solid rgba(125, 202, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);

      &.is-selected {
        background: linear-gradient(180deg, rgba(26, 47, 70, 0.98), rgba(15, 30, 46, 0.98)) !important;
        background-color: rgba(15, 30, 46, 0.98) !important;
        box-shadow: inset 0 0 0 1px rgba(124, 240, 255, 0.22) !important;

        .el-calendar-day {
          background: transparent !important;
          color: rgba(245, 251, 255, 0.96) !important;
        }

        .day-time,
        p,
        span {
          color: rgba(245, 251, 255, 0.96) !important;
        }
      }
    }

    tr {
      &:first-child {
        td {
          border-top: 1px solid rgba(125, 202, 255, 0.08);
        }
      }

      td {
        &:first-child {
          border-left: 1px solid rgba(125, 202, 255, 0.08);
        }
      }
    }
  }

  .el-calendar-day {
    display: flex;
    flex-direction: column;
    height: 80px;
    color: rgba(236, 245, 251, 0.9);
    font-size: 9px;
    padding: 2px 0;
    background: transparent;

    &:hover {
      background: transparent !important;
    }

    .flex-end {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      font-size: 10px;

      p {
        padding-left: 1px;
        margin: 0;
        line-height: 1.2;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  .energy-calendar-cell.is-selected {
    background: linear-gradient(180deg, rgba(44, 80, 122, 0.42), rgba(21, 40, 63, 0.32)) !important;
    border-color: rgba(102, 197, 245, 0.24) !important;
    box-shadow: inset 0 0 0 1px rgba(124, 240, 255, 0.08) !important;
  }

  .el-calendar-table td.is-selected .energy-calendar-cell {
    background: linear-gradient(180deg, rgba(44, 80, 122, 0.42), rgba(21, 40, 63, 0.32)) !important;
    border-color: rgba(102, 197, 245, 0.24) !important;
    box-shadow: inset 0 0 0 1px rgba(124, 240, 255, 0.08) !important;
  }

  .el-calendar-table td.is-selected,
  .el-calendar-table td.is-selected:hover,
  .el-calendar-table td.is-selected:focus {
    background: linear-gradient(180deg, rgba(26, 47, 70, 0.98), rgba(15, 30, 46, 0.98)) !important;
    background-color: rgba(15, 30, 46, 0.98) !important;
  }

  .el-calendar-table td.is-selected .el-calendar-day,
  .el-calendar-table td.is-selected .el-calendar-day:hover,
  .el-calendar-table td.is-selected .el-calendar-day:focus {
    background: transparent !important;
    background-color: transparent !important;
  }

  .el-calendar-table td.is-selected .energy-calendar-cell__top,
  .el-calendar-table td.is-selected .energy-calendar-metrics,
  .el-calendar-table td.is-selected .energy-calendar-metrics__pair,
  .el-calendar-table td.is-selected .day-time,
  .el-calendar-table td.is-selected .e-box,
  .el-calendar-table td.is-selected .p-box,
  .el-calendar-table td.is-selected .c-box {
    color: rgba(245, 251, 255, 0.96) !important;
  }

  .energy-calendar-cell.is-best:not(.is-selected) {
    background: rgba(92, 200, 255, 0.06);
    border-color: rgba(102, 197, 245, 0.16);
  }

  .energy-calendar-cell.is-empty {
    opacity: 0.64;
  }

  .el-calendar-table__row {
      .day-time {
        text-align: right;
        margin-bottom: 2px;
      }

    .current {
      .day-time {
        font-size: 12px;
        color: rgba(245, 251, 255, 0.95);
      }

      .first-cs {
        background: rgba(91, 145, 229, 1);
      }

      .two-cs {
        background: rgba(75, 215, 198, 1);
      }

      .three-cs {
        background: rgba(227, 184, 88, 1);
      }

      .four-cs {
        background: rgba(236, 82, 133, 1);
      }

      .five-cs {
        background: rgb(196, 191, 193, 1);
      }
    }
  }
}
</style>
