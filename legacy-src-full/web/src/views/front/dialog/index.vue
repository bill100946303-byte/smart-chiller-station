<template>
  <div class="front-dialog-wrap front-box-show">
    <div class="nav-top">
<!--      <div class="left">{{ title }}</div>-->
      <div class="left">{{ titleLang }}</div>
      <router-link :to="{ name: 'systemhomepage' }">
        <!--        <div class="btn">{{$t('route.homepage')}}</div>-->
        <i class="al_element-icons2 al_icon2fanhui" style="font-size: 50px"></i>
      </router-link>
    </div>
    <div class="serach-form">
      <el-date-picker
          v-model="date"
          type="date"
          placeholder="选择日期时间"
          value-format="yyyy-MM-dd"
      >
      </el-date-picker>

      <!--      <div class="img-btn" @click="search">{{$t('public.search')}}</div>-->
      <!--      <div class="img-btn" @click="exporttable">{{$t('public.exportData')}}</div>-->

      <el-button style="margin-left: 30px" type="primary" @click="search">
        <i class="al_element-icons al_iconchaxun" style="margin-right: 5px"></i>
        {{ $t('public.search') }}
      </el-button>
      <el-button type="primary" @click="exporttable">
        <i class="al_element-icons al_icondaochu" style="margin-right: 5px;font-size:17px"></i>
        {{ $t('public.exportData') }}
      </el-button>
    </div>
    <div class="line_echart">
      <lineEchart
          :xData="totalEnergyDataY"
          :xLabel="xLabel"
          :unit="unit"
          style="width: 100%; height: 100%"
      />
    </div>
    <div class="table">
      <el-table
          :data="tableData"
          :header-cell-style="{
             background: '#08739a',
             color: '#fff',
           }"
          style="width: 100%"
      >
        <el-table-column prop="name" label="日期" :label="$t('logrizi.time')" class-name="front-column">
        </el-table-column>
        <el-table-column prop="value" :label="titleLang" class-name="front-column">
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import dayjs from "dayjs";
import {mapGetters} from "vuex";
import {toggleClass} from "@/utils";
import lineEchart from "./components/lineEchart.vue";
import {getRunParamsCurveByTagName} from "@/api/front/dialog";

export default {
  data() {
    return {
      title: "",
      date: new Date(),
      totalEnergyDataY: [
        {
          data: [],
        },
      ],
      xLabel: [],
      tableData: [],
      unit: "kw",
      titleLang: ''
    };
  },
  computed: {
    ...mapGetters(["colortheme", "path"]),
  },
  components: {
    lineEchart,
  },
  created() {
    this.$store.commit("user/SET_THEME", "darkblue");
    this.title = this.$route.query.name;
    // this.titleLang = this.$route.query.name;
    console.log('跳转', this.$route.query)
    switch (this.$route.query.name) {
      case "湿球温度":
        this.titleLang = this.$t('defaultpage.wetBulb')
        break
      case "室外湿度":
        this.titleLang = this.$t('defaultpage.outdoorHumidity')
        break
      case "室外温度":
        this.titleLang = this.$t('defaultpage.outdoorTemperature')
        break
      case "露点温度":
        this.titleLang = this.$t('defaultpage.dewPoint')
        break
      case "冷冻水温差":
        this.titleLang = this.$t('defaultpage.run0')
        break
      case "冷却水温差":
        this.titleLang = this.$t('defaultpage.run1')
        break
      case "冷冻出水温度":
        this.titleLang = this.$t('defaultpage.run2')
        break
      case "冷却回水温度":
        this.titleLang = this.$t('defaultpage.run3')
        break
      case "实时总功率":
        this.titleLang = this.$t('defaultpage.totalPower')
        break
      case "实时总冷量":
        this.titleLang = this.$t('defaultpage.totalCoolingCapacity')
        break
      case "热站实时总功率":
        this.titleLang = this.$t('defaultpage.HotTotalPower')
        break
      case "热站实时总热量":
        this.titleLang = this.$t('defaultpage.HotTotalCoolingCapacity')
        break
      case "热水供水温度":
        this.titleLang = this.$t('defaultpage.run20')
        break
      case "热水回水温度":
        this.titleLang = this.$t('defaultpage.run21')
        break
      case "热水温差":
        this.titleLang = this.$t('defaultpage.run22')
        break
    }
    this.tagname = this.$route.query.tagname;
    console.log('已经跳转的', this.$route.query.tagname)
    this.unit = this.$route.query.unit ? this.$route.query.unit : this.unit;
    console.log('11111', this.title, this.tagname,this.$route.query.unit)
    if (this.title.indexOf('室外湿度') !== -1) this.unit = '%';// 由于百分号在路径上被转义了，所以特殊处理
    this.initData();
  },
  watch: {
    colortheme: {
      handler(val, oldval) {
        toggleClass(document.body, val);
      },
      immediate: true,
    },
  },
  methods: {
    isToday(date) {
      return (
          dayjs(new Date()).format("YYYY-MM-DD") ===
          dayjs(date).format("YYYY-MM-DD")
      );
    },
    search() {
      this.initData();
    },
    initData() {
      let info = {
        tagname: this.tagname,
        date: dayjs(this.date).format("YYYY-MM-DD"),
        title: this.title,
      };
      if (this.isToday(this.date)) {
        delete info.date;
      }
      getRunParamsCurveByTagName(this.path, info).then((res) => {
        this.tableData = res.data;
        this.xLabel = [];
        res.data.forEach((element) => {
          let time = dayjs(element.name).format("MM-DD HH:mm");
          this.xLabel.push(time);
          this.totalEnergyDataY[0].data.push({
            name: time,
            value: element.value,
          });
        });
        this.xLabel.reverse()
        this.totalEnergyDataY[0].data.reverse()
        // console.log('111', this.xLabel, this.totalEnergyDataY)
      });
    },
    exporttable() {
      if (this.tableData.length != 0) {
        import("@/vender/Export2Excel").then((excel) => {
          const tHeader = ["日期", this.title];
          const data = this.tableData.map((item) => {
            return [item.name, item.value + this.unit];
          });
          excel.export_json_to_excel({
            header: tHeader,
            data,
            filename: this.title + dayjs().format("YYYY-MM-DD"),
          });
        });
      } else {
        this.$message.warning("请选择数据后在导出");
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@mixin blue {
  font-size: 30px;
  font-family: Microsoft YaHei;
  //text-shadow: 0px 8px 10px rgba(0, 0, 0, 0.45);
  //background: linear-gradient(top, #fff 0%, rgba(0, 140, 255, 1) 100%);
  background: linear-gradient(top, #fff 0%, rgba(0, 140, 255, 1) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.front-dialog-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: scroll;
  //background-color: rgba(1, 17, 35, 1);
  background-color: #fff;

  .nav-top {
    padding: 0 30px 0 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(51, 123, 177, 0.6);
    background: #08739a;
  }

  .serach-form {
    flex-shrink: 0;
    margin-top: 5px;
    margin-left: 100px;
  }

  .left {
    //padding-bottom: 3px;
    @include blue;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96px;
    height: 40px;
    color: #fff;
    font-size: 16px;
    background: rgba(18, 70, 136, 0.58);
    box-shadow: inset 0px 0px 13px 0px #538ff6;
    opacity: 0.97;
    border-radius: 3px;
  }

  .img-btn {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 110px;
    //min-width: max-content;
    height: 46px;
    margin-left: 15px;
    background: url("../../../assets/buttonse.png") 0 0 / 100% 100% no-repeat;
  }

  .serach-form {
    //color: #fff;
    display: flex;
    align-items: center;
  }

  .table {
    overflow: hidden;
    flex: 1;
    margin: 20px 184px 0 136px;

  }

  .line_echart {
    margin: 20px 184px 0 136px;
    height: 180px;
  }

  .front-column {
    .cell {
      padding-left: 20%;
    }
  }
}
</style>
<style lang="scss">
.front-dialog-wrap {
  .front-column {
    height: 38px;

    .cell {
      padding-left: 30%;
    }
  }
}

.table {
  .el-table {
    height: 100%;

    .el-table__body-wrapper {
      overflow: scroll;
      height: calc(100% - 44px);
    }
  }

}
</style>
