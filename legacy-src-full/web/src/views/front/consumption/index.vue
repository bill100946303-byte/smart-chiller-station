<template>
  <div class="consumption_page">
    <div class="search_box">
      <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form">
        <div class="flex">
          <el-form-item>
            <el-date-picker
              v-model="date"
              type="date"
              placeholder="选择日期时间"
              @change="handleClick"
              value-format= "yyyy-MM-dd"
              ref="mydate"
            >
            </el-date-picker>
          </el-form-item>

          <el-radio-group v-model="type" @change="groupchange">
            <el-radio-button label="年" ></el-radio-button>
            <el-radio-button label="月"></el-radio-button>
            <el-radio-button label="日"></el-radio-button>
          </el-radio-group>
        </div>
      </el-form>
    </div>

    <div class="analyse_box">
      <el-tabs v-model="energyType" @tab-click="handleClick">
        <el-tab-pane label="电量" name="1">
          <electricTab :echartdata="piedata" v-if="energyType === '1'" :xLabel="xLabel" :table="table" :xData="xData"/>
        </el-tab-pane>
        <el-tab-pane label="热量" name="2">
          <heatTab v-if="energyType === '2'" :table="table" :xData="xData" :xLabel="xLabel" :lindata="piedata"/>
        </el-tab-pane>
        <el-tab-pane label="冷量" name="3">
          <coldTab v-if="energyType === '3'" :table="table" :xData="xData" :xLabel="xLabel" :lindata="piedata"/>
        </el-tab-pane>
        <!-- <el-tab-pane label="热不平衡率" name="4">
          <heatbalanceTab v-if="energyType === '4'" :xData="xData" :xLabel="xLabel" :dataStatisticsList="dataStatisticsList" :table="table"/>
        </el-tab-pane> -->
      </el-tabs>
      <el-button type="primary" class="main-btn energy-btn" @click="exporttable" >
        <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
        导出
      </el-button>
    </div>
  </div>
</template>

<script>
import electricTab from "./tabs/electricTab.vue";
import heatTab from "./tabs/heatTab.vue";
import coldTab from "./tabs/coldTab.vue";
import heatbalanceTab from "./tabs/heatbalanceTab.vue";
import Device from "../components/device.vue";
import {
  getEnergyAnalysisCurve,
  getEnergyAnalysisPie,
  getEnergyAnalysisDeviceList
} from "@/api/front/consumption";
import { mapGetters } from "vuex";
import dayjs from 'dayjs';
export default {
  components: {
    electricTab,
    heatTab,
    coldTab,
    heatbalanceTab,
    Device,
  },
  computed: {
    ...mapGetters(["id","path"]),
  },
  props: {},
  data() {
    return {
      date: dayjs().format('YYYY-MM-DD'),
      dateType: 1,
      type:'日',
      energyType: "1",
      piedata: {},
      curdata:[],
      xLabel:[],
      timelist:{
        "年":3,
        "月":2,
        "日":1
      },
      energyTable:{
        1:'电量',
        2:'热量',
        3:'冷量',
        4:'热不平衡率'
      },
      table:[],
      xData:[],
      dataStatisticsList:[]
    };
  },
  watch: {},
  created() {
    this.getPie()
    this.getCur()
    this.gettable()
  },
  methods: {
    groupchange(){
      this.dateType = this.timelist[this.type]
      
      this.handleClick();




    },
    handleClick() {
      if(this.energyType !== "4"){
        this.getPie()
        this.getCur()
        this.gettable()
      }else{
        this.getCur()
        this.gettable()
      }
    },
    getPie() {
      let info = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
      };
      getEnergyAnalysisPie(info).then((res) => {
        this.piedata = res.data;
      });
    },
    getCur() {
      let info = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
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
    gettable(){
      let inof = {
        appId:this.id,
        date:this.date,
        dateType: this.dateType,
        energyType: this.energyType,
      }
      getEnergyAnalysisDeviceList(this.path,inof).then(res=>{
        if(this.energyType !== "4"){
          this.table = res.data ||[]
        }else{
          this.table = res.data[0].tableList
          this.dataStatisticsList = res.data[0].dataStatisticsList
        }
        
      })
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
  },

  mounted() {},
};
</script>
<style lang="scss" scoped>
.consumption_page {
  .search_box {
    width: 100%;
    padding: 18px 20px 12px;
    border: 1px solid rgba(124, 202, 255, 0.12);
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);

    .flex {
      display: flex;
      box-sizing: border-box;
      width: 100%;
      gap: 14px 18px;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: wrap;
    }
  }

  .demo-form-inline,
  ::v-deep .legacy-front-toolbar__form {
    display: flex;
    justify-content: space-between;
  }

  .analyse_box {
    position: relative;
    width: 100%;
    margin-top: 18px;
    padding: 24px 28px 18px;
    border: 1px solid rgba(124, 202, 255, 0.12);
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);

    .main-btn{
      position: absolute;
      top:24px;
      right:28px;
    }
  }

  ::v-deep .el-input__inner,
  ::v-deep .el-date-editor .el-input__inner {
    min-height: 42px;
    border-radius: 12px;
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 251, 255, 0.96);
  }

  ::v-deep .el-form-item__label,
  ::v-deep .el-radio-button__inner {
    color: rgba(223, 236, 245, 0.84);
  }

  ::v-deep .el-radio-button__inner {
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
  }

  ::v-deep .el-radio-button__orig-radio:checked + .el-radio-button__inner {
    background: linear-gradient(135deg, rgba(51, 138, 255, 0.9) 0%, rgba(70, 204, 255, 0.74) 100%);
    border-color: rgba(102, 197, 245, 0.48);
    box-shadow: none;
    color: #f8fcff;
  }

  ::v-deep.darkblue .el-tabs__nav-wrap::after {
    background-color: rgba(56, 64, 72, 1) !important;
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
<style lang="scss">
.el-tabs__nav-wrap{
  &::after{
    display: none !important;
  }
}
.el-tabs__nav{
  .el-tabs__item{
    position: relative;
    font-size: 18px;
    color:rgba(153, 153, 153, 1);

    &.is-active{
      color:rgba(47, 178, 247, 1);
    }
  }
}

</style>
