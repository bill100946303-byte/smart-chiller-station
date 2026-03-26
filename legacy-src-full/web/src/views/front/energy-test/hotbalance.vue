<template >
  <div class="propor-page front-box-show">
    <div class="search_box panel-card">
      <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form">
        <div class="flex">
          <el-form-item :label="$t('public.timeperiodSelection')" prop="time">
            <el-date-picker
                v-model="time"
                :picker-options="pickerOptions"
                format="yyyy-MM-dd"
                placeholder="选择开始时间"
                type="daterange"
                value-format="yyyy-MM-dd"
                prefix-icon="al_element-icons al_icona-huaban1"
            />
          </el-form-item>
          <el-button class="energy-btn" type="primary" @click="handleClick">
            <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>


          <!--          <el-form-item>
                      <el-date-picker
                        v-model="date"
                        type="date"
                        placeholder="选择日期时间"
                        @change="handleClick"
                        value-format="yyyy-MM-dd"
                      >
                      </el-date-picker>
                    </el-form-item>

                    <el-radio-group v-model="type" @change="groupchange">
                      &lt;!&ndash; <el-radio-button label="年" ></el-radio-button> &ndash;&gt;
          &lt;!&ndash;            <el-radio-button label="月"></el-radio-button>&ndash;&gt;
          &lt;!&ndash;            <el-radio-button label="日"></el-radio-button>&ndash;&gt;
                      <el-radio-button :label="$t('public.month')"></el-radio-button>
                      <el-radio-button :label="$t('public.day')"></el-radio-button>
                      <el-radio-button :label="$t('public.Time')"></el-radio-button>
                    </el-radio-group>-->
        </div>
      </el-form>
    </div>
    <div class="chart-shell panel-card">
      <div class="panel-card__header">
        <div>
          <div class="panel-card__eyebrow">BALANCE</div>
          <div class="panel-card__title">热不平衡率</div>
        </div>
      </div>
      <heatbalanceTab :xData="xData" :xLabel="xLabel"  :dataStatisticsList="dataStatisticsList" :table="table"/>
    </div>
  </div>
</template>
<script>
import heatbalanceTab from "@/views/front/consumption/tabs/heatbalanceTab.vue";
import {
    getEnergyAnalysisCurve,
  getEnergyAnalysisDeviceList
} from "@/api/front/consumption";
import { mapGetters } from 'vuex'
import dayjs from 'dayjs'
export default {
  components: {
    heatbalanceTab
  },
  computed:{
    ...mapGetters(['path','id'])
  },
  data () {
    return {
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        }
      },
      date: dayjs().format('YYYY-MM-DD'),
      dateType: 0,
      // type:'日',
      type: this.$t('public.Time'),
      timelist: {
        // "年":3,
        "月": 2,
        "日": 1,
        "时": 0,
      },
      table: [],
      xData: [],
      xLabel: [],
      dataStatisticsList: [],
      energyType: 4,
      time: [dayjs().subtract(1, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    }
  },
  created(){
      this.getCur()
    this.gettable()
  },
  methods:{
      getCur() {
        console.log('1', this.time)
      let info = {
        appId: this.id,
        date: this.date,

        dateType: this.dateType,
        energyType: this.energyType,
        startTime: this.time[0],
        endTime: this.time[1]
      };
      getEnergyAnalysisCurve(info).then((res) => {
        if(res.data&&res.data.length){
          this.xLabel = res.data[0].curveValueList.map(item=>{
            return item.name
          })
          this.xData = res.data
        }
      });
    },
      handleClick() {
      this.getCur()
        this.gettable()
    },
    gettable(){
      let inof = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
        startTime: this.time[0],
        endTime: this.time[1]
      }
      getEnergyAnalysisDeviceList(this.path,inof).then(res=>{
         this.table = res.data[0].tableList
        this.dataStatisticsList = res.data[0].dataStatisticsList
        
      })
    },
    groupchange() {
      let val
      // if (this.type === 'month'){
      //   val = '月'
      // }else {
      //   val = '日'
      // }
      // this.dateType = this.timelist[val]
      this.dateType = this.timelist[this.type]
      this.handleClick();
    },
    async exporttable(){
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default || xlsxModule;
      const wb = XLSX.utils.book_new();
      this.xData.map(item=>{
        const sheet = item.curveValueList.map(ele=>{
          return [ele.name,ele.value]
        })
        sheet.unshift(['时间',this.energyTable[this.energyType]])
        var worksheet = XLSX.utils.aoa_to_sheet(sheet);
        XLSX.utils.book_append_sheet(wb, worksheet, item.title);
      })
      const workbookBlob = this.workbook2blob(wb, XLSX);
      this.openDownloadDialog(workbookBlob, `${this.energyTable[this.energyType]}${dayjs().format('YYYY-MM-DD')}.xlsx`);
    },
    workbook2blob(workbook, XLSX) {
          // 生成excel的配置项
          var wopts = {
            // 要生成的文件类型
            bookType: "xlsx",
            // // 是否生成Shared String Table，官方解释是，如果开启生成速度会下降，但在低版本IOS设备上有更好的兼容性
            bookSST: false,
            type: "binary"
          };
          var wbout = XLSX.write(workbook, wopts);
          // 将字符串转ArrayBuffer
          function s2ab(s) {
            var buf = new ArrayBuffer(s.length);
            var view = new Uint8Array(buf);
            for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
            return buf;
          }
          var blob = new Blob([s2ab(wbout)], {
            type: "application/octet-stream"
          });
          return blob;
        },
         openDownloadDialog(blob, fileName) {
          if (typeof blob == "object" && blob instanceof Blob) {
            blob = URL.createObjectURL(blob); // 创建blob地址
          }
          var aLink = document.createElement("a");
          aLink.href = blob;
          // HTML5新增的属性，指定保存文件名，可以不要后缀，注意，有时候 file:///模式下不会生效
          aLink.download = fileName || "";
          var event;
          if (window.MouseEvent) event = new MouseEvent("click");
          //   移动端
          else {
            event = document.createEvent("MouseEvents");
            event.initMouseEvent( "click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null );
          }
          aLink.dispatchEvent(event);
        }
  }
}
</script>
<style lang="scss" scoped>
.propor-page {
  padding: 0;
  display: grid;
  gap: 14px;

  .panel-card {
    padding: 16px 18px 18px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    border: 1px solid rgba(124, 202, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);
  }

  .chart-shell {
    min-height: 540px;
  }
}

::v-deep .legacy-front-toolbar__form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
}

::v-deep .el-form-item__label {
  color: rgba(223, 236, 245, 0.86);
}

::v-deep .el-input__inner {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(122, 210, 255, 0.14);
  color: rgba(245, 251, 255, 0.96);
}

.energy-btn {
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  border-color: rgba(75, 179, 233, 0.36);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  border-color: rgba(102, 197, 245, 0.48);
  color: #fff;
}

.energy-btn__icon {
  margin-right: 5px;
}
</style>
