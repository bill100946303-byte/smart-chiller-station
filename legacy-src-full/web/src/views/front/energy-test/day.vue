<template>
  <div class="day-front">
    <el-row :gutter="18" style="margin: 0">
      <el-col :md="24" :lg="15" :xl="15">
        <div class="grid-left grid-content panel-card panel-card--calendar">
          <div class="panel-card__header">
            <div>
              <div class="panel-card__eyebrow">CALENDAR</div>
              <div class="panel-card__title">能效日历</div>
            </div>
            <div class="nav-top__meta">
              <el-date-picker
                  v-model="time"
                  :clearable="true"
                  placeholder="选择日期"
                  prefix-icon="al_element-icons al_icona-huaban1"
                  type="month"
                  value-format="yyyy-MM"
                  @change="pickerchange"
              >
              </el-date-picker>
            </div>
          </div>
          <div class="panel-card__legend">
            <span>E（{{ $t('energytest_day.operationalEnergyEfficiency') }}）</span>
            <span>C（{{ $t('energytest_day.dailyCoolingCapacity') }}）</span>
            <span>P（{{ $t('energytest_day.dailyPowerConsumption') }}）KW*h</span>
            <span v-show="getMShow">M（{{ $t('energytest_day.coldUnitPrice') }}）</span>
          </div>
          <el-calendar ref="calendar" :first-day-of-week="7">
            <!-- 这里使用的是 2.5 slot 语法，对于新项目请使用 2.6 slot 语法-->
            <template slot="dateCell" slot-scope="{ date, data }">
              <div
                  @click="chooseday(date, data)"
                  style="height: 100%; display: flex; flex-direction: column"
              >
                <p class="day-time">
                  {{ getDay(data.day) }}
                  <!-- .split("-")
                    .slice(2)
                    .join("") -->
                </p>
                <div v-if="getmonth(data.day) && isBeforeToday(data.day)" class="flex-end">
                  <p :class="[getEclass(getE(getDay(data.day))), 'e-box']">
                    <!--                    {{ getE(getDay(data.day)) }}-->
                    <!--                    {{ getE(getDay(data.day)) == null ? '' : getE(getDay(data.day)).slice(0, -3) }}-->
                    <!--                    E:{{ getE(getDay(data.day)) == null ? '' : getE(getDay(data.day)).match(/E:(-?[\d.]+):/)[1] }}-->
                    {{ $t('energytest_day.E') }}:
                    &nbsp;{{ getE(getDay(data.day)) == null ? '' : getE(getDay(data.day)).match(/E:(-?[\d.]+):/)[1] }}
                  </p>
                  <p class="p-box">{{ getP(getDay(data.day)) }}</p>
                  <p class="c-box">{{ getC(getDay(data.day)) }}</p>
                  <!--                  <p class="m-box" v-show="getMShowFun(getDay(data.day))">{{ getM(getDay(data.day)) }}</p>-->
                  <p class="m-box" v-if="getMShow">{{ getM(getDay(data.day)) }}</p>
                </div>
              </div>
            </template>
          </el-calendar>
        </div>
      </el-col>
      <el-col :md="24" :lg="9" :xl="9">
        <div class="grid-right grid-content">
          <div class="line panel-card panel-card--line">
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
        </div>
        <div class="grid-content pic-box panel-card panel-card--pie">
          <div class="panel-card__header panel-card__header--compact">
            <div>
              <div class="panel-card__eyebrow">PIE CHART</div>
              <div class="panel-card__title">{{ $t('energytest_day.itemizedChart') }}</div>
            </div>
          </div>
          <electricTabEchart
              id="heat1"
              style="width: 100%; height: 100%"
              :echartdata="piedata"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>
<script>
import Linebox from "./components/linebox.vue";
import electricTabEchart from "./components/electricTabEchart.vue";
import {findEnergyCalendar, findMonthEnergy} from "@/api/front/energytest";
import dayjs from "dayjs";
import {mapGetters} from "vuex";
import {getEnergyAnalysisPie} from "@/api/front/consumption";

export default {
  data() {
    return {
      time: dayjs().format("YYYY-MM-DD"),
      datalist: [],
      range: [],
      piedata: {},
      dateType: 2,
      daylist: {
        月: 3,
        日: 2,
      },
      energynum: 0,
      energynumRT: 0,
      boxinfo: {},
      getMShow: true
    };
  },
  props: {
    num: Number,
  },
  components: {
    Linebox,
    electricTabEchart,
  },
  computed: {
    ...mapGetters(["id", "path"]),
    month() {
      return dayjs(this.time).month() + 1;
    },
    year() {
      return dayjs(this.time).year();
    },
  },
  created() {
    this.handleSearch().then((res) => {
      this.getdaydata();
    });
    this.getPie();
  },
  mounted() {
    let ref = this.$refs.calendar;
    let target = this.$refs.calendar.$el;
    let that = this;
    target.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      ref.pickDay(that.time);
    });
  },
  methods: {
    isBeforeToday(date) {
      return dayjs(date).isBefore(dayjs().add(1, 'day'), 'day');
    },
    chooseday(day, data) {
      let str = data.day.split("-")[1];
      // console.log(day, data, "data");
      if (str == this.month) {
        this.time = dayjs(day).format("YYYY-MM-DD");
        // console.log(this.time, "time");
        this.dateType = this.daylist["日"];
        // this.$refs.linebox.type = "日";
        this.$refs.linebox.type = this.$t('public.day');
        // this.energynum = this.getE(this.getDay(data.day));
        this.getdaydata();
        this.getPie();
      } else {
        return false;
      }
    },
    findMonthEnergys() {
      findMonthEnergy(this.path, {date: this.time}).then((res) => {
        console.log(res, "resinfo");
        this.boxinfo = res.data;
        this.energynum = Number(res.data.rte) || 0;
        // this.energynumRT = Number(el.e);
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
      let el = this.datalist.find(
          (item) => item.date === dayjs(this.time).format("DD")
      );
      this.energynum = Number(el.rte) || 0;
      /*
        RTE 是后端计算后的值，e是原始数据
        计算方式是 3.517/数据
      */
      // console.log('this.energynum', this.energynum)
      this.energynumRT = Number(el.e);
      this.boxinfo = el;
      // console.log(this.boxinfo, "<===boxinfo");
    },
    pickerchange() {
      this.dateType = this.daylist["月"];
      this.$refs.linebox.type = "月";
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
      let obj = {
        appId: this.id,
        month: this.month,
        year: this.year,
      };
      //查询日历
      return findEnergyCalendar(obj).then((res) => {
        this.datalist = res.data.map((item) => {
          let date = item.date.split("号")[0];
          item.date = date.length == 2 ? date : "0" + date;
          item.evalue = Number(item.e);
          return item;
        });
      });
    },
    getPie() {
      let info = {
        appId: this.id,
        date:
            this.dateType === 2
                ? dayjs(this.time).format("YYYY-MM-DD")
                : dayjs(this.time).format("YYYY-MM"),
        dateType: this.dateType,
        energyType: 1,
      };
      getEnergyAnalysisPie(info).then((res) => {
        this.piedata = res.data;
      });
    },
    getEclass(datas) {
      if (datas) {
        let datasplit = datas.split(':');
        if (datasplit) {
          let data = Number(datasplit[3]) || 0;
          // console.log(datasplit)
          // if (this.$store.getters.unitSelete === 'RT'){
          //   console.log('1111', )
          //   if (dayjs(this.time.substring(0,8)+datasplit[2]).isAfter(dayjs().format("YYYY-MM-DD")))return
          //   if (data <= 0.703) {
          //     return "first-cs";
          //   } else if (data <= 0.857) {
          //     console.log('2222',datasplit)
          //     return "two-cs";
          //   } else if (data <= 1.004) {
          //     console.log('3333',datasplit)
          //     return "three-cs";
          //   } else if (data > 1.004 && this.ifdatasplit(datasplit[2])) {
          //     console.log('444',datasplit)
          //     return "four-cs";
          //   } else if (this.ifdatasplit(datasplit[2])) {
          //     // console.log('data',datasplit,data)
          //     return "five-cs";
          //   }
          // }else {
          if (data >= 5.0) {
            return "first-cs";
          } else if (data >= 4.1) {
            return "two-cs";
          } else if (data >= 3.5) {
            return "three-cs";
          } else if (data > 0 || data < 0 && this.ifdatasplit(datasplit[2])) {
            return "four-cs";
          } else if (this.ifdatasplit(datasplit[2])) {
            return "five-cs";
          }
          // }
        }
      }
    },
    ifdatasplit(e) {
      if (dayjs(dayjs(this.year + '-' + this.month + '-' + e).format('YYYY-MM-DD')).unix() <=
          dayjs(dayjs().startOf('day').format('YYYY-MM-DD')).unix()) {
        // console.log('选择时间',dayjs(this.year+'-'+this.month+'-'+e).format('YYYY-MM-DD'))
        // console.log('当前时间',dayjs().startOf('day').format('YYYY-MM-DD'))
        return true
      }
      return false
    },
    getE(day) {
      let arr = this.datalist.filter((item) => item.date === day);
      if (arr.length) {
        // return 'E:' + arr[0].rte + ':' + arr[0].date + ':' + arr[0].e;
        let rteValue = parseFloat(arr[0].rte.replace(/,/g, ""));
        return 'E:' + rteValue + ':' + arr[0].date + ':' + arr[0].e;
      } else {
        return null;
      }
    },
    // getE(day) {
    //   let arr = this.datalist.filter((item) => item.date === day);
    //
    //   if (arr.length) {
    //     // this.boxinfo = arr[0];
    //     return 'E:' + arr[0].rte + ':' + arr[0].date + ':' + arr[0].e;
    //   } else {
    //     return null;
    //   }
    // },
    getP(day) {
      let arr = this.datalist.filter((item) => item.date === day);
      if (arr.length) {
        // return 'P:' + arr[0].p;
        return this.$t('energytest_day.P') + ': ' + arr[0].p;
      } else {
        return null;
      }
    },
    getC(day) {
      let arr = this.datalist.filter((item) => item.date === day);
      if (arr.length) {
        // return 'C:' + arr[0].c;
        return this.$t('energytest_day.C') + ': ' + arr[0].c;
      } else {
        return null;
      }
    },
    getM(day) {
      let arr = this.datalist.filter((item) => item.date === day);
      if (arr.length) {
        this.getMShow = arr[0].m !== '-1'
        // console.log('111', this.getMShow)
        // return 'M:' + arr[0].m;
        return this.$t('energytest_day.M') + ': ' + arr[0].m;
      } else {
        return null;
      }
    },
    getmonth(day) {
      let str = day.split("-")[1];
      return str == this.month ? true : false;
    },
  },
};
</script>
<style lang="scss" scoped>
.day-front {
  width: 100%;
  min-height: 0;
  overflow: hidden;

  .grid-content {
    min-height: 0;
  }

  .grid-left {
    min-height: 0;
  }

  .grid-right {
    height: 40vh;
    min-height: 0;
    padding-right: 0;
  }

  .pic-box {
    height: 40vh;
    padding-right: 0;
    margin-right: 0;
  }
}
</style>
<style lang="scss">
.day-front {
  .panel-card {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 14px 16px 16px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    border: 1px solid rgba(124, 202, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);
  }

  .panel-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .panel-card__header--compact {
    margin-bottom: 8px;
  }

  .panel-card__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(171, 205, 225, 0.66);
  }

  .panel-card__title {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
    color: rgba(245, 251, 255, 0.96);
  }

  .panel-card__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    margin-bottom: 10px;
    font-size: 12px;
    color: rgba(182, 211, 231, 0.76);
  }

  .panel-card__legend span {
    white-space: nowrap;
  }

  .nav-top__meta .el-date-picker {
    width: 168px;
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
    height: 120px;
    color: rgba(236, 245, 251, 0.9);
    font-size: 12px;
    padding: 8px 0;
    background: transparent;

    .flex-end {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 15px;

      p {
        padding-left: 5px;
      }
    }
  }

  .el-calendar-table__row {
    .day-time {
      text-align: right;
    }

      .current {
      .day-time {
        margin-bottom: 10px;
        font-size: 14px;
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
