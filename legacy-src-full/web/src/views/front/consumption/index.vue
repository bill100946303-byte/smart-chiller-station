<template>
  <div class="consumption_page legacy-front-page">
    <div class="legacy-front-page__hero consumption-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">能耗工作台</div>
        <h1 class="legacy-front-page__title">能耗分析</h1>
        <div class="legacy-front-page__meta">按日期、粒度和能耗类型查看总量构成、趋势变化与设备级明细。</div>
      </div>
      <div class="consumption-page__hero-meta">
        <div class="legacy-front-chip">当前维度：{{ currentEnergyConfig.label }}</div>
      </div>
    </div>

    <section class="legacy-front-toolbar consumption-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>分析条件</strong>
        <span>切换能耗类型、日期和粒度后更新下方构成、趋势和设备结果</span>
      </div>
      <div class="consumption-toolbar__content">
        <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form">
          <div class="flex">
            <el-form-item label="能耗类型">
              <el-radio-group v-model="energyType" class="consumption-energy-switch" @change="handleClick">
                <el-radio-button label="1">电量</el-radio-button>
                <el-radio-button label="2">热量</el-radio-button>
                <el-radio-button label="3">冷量</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="日期">
              <el-date-picker
                v-model="date"
                type="date"
                placeholder="选择日期时间"
                @change="handleClick"
                value-format="yyyy-MM-dd"
                ref="mydate"
              >
              </el-date-picker>
            </el-form-item>

            <el-form-item label="粒度">
              <el-radio-group v-model="type" @change="groupchange">
                <el-radio-button label="年"></el-radio-button>
                <el-radio-button label="月"></el-radio-button>
                <el-radio-button label="日"></el-radio-button>
              </el-radio-group>
            </el-form-item>
          </div>
        </el-form>

        <div class="consumption-toolbar__actions">
          <el-button class="energy-btn energy-btn--secondary" @click="handleClick">查询</el-button>
          <el-button type="primary" class="energy-btn" @click="exporttable">
            <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
            导出
          </el-button>
        </div>
      </div>
    </section>

    <section class="consumption-summary-grid">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="consumption-summary-card"
        :class="{ 'consumption-summary-card--wide': card.wide }"
      >
        <div class="consumption-summary-card__label">{{ card.label }}</div>
        <div class="consumption-summary-card__value" :class="{ 'consumption-summary-card__value--text': card.textValue }">
          {{ card.value }}
          <span v-if="card.suffix">{{ card.suffix }}</span>
        </div>
        <div class="consumption-summary-card__meta">{{ card.meta }}</div>
      </article>
    </section>

    <section class="legacy-front-tab-shell consumption-workbench">
      <div class="legacy-front-section-title">
        <strong>{{ currentEnergyConfig.panelTitle }}</strong>
        <span>{{ currentEnergyConfig.panelMeta }}</span>
      </div>

      <analysis-workbench-tab
        :breakdown-data="piedata"
        :x-label="xLabel"
        :x-data="xData"
        :table="table"
        :amount-label="currentEnergyConfig.label"
        :unit-label="currentEnergyConfig.unit"
        :extra-metric-label="currentEnergyConfig.extraMetricLabel"
        :extra-metric-field="currentEnergyConfig.extraMetricField"
      />
    </section>
  </div>
</template>

<script>
import {
  getEnergyAnalysisCurve,
  getEnergyAnalysisPie,
  getEnergyAnalysisDeviceList
} from "@/api/front/consumption";
import { mapGetters } from "vuex";
import dayjs from 'dayjs';
import AnalysisWorkbenchTab from "./tabs/AnalysisWorkbenchTab.vue";

export default {
  components: {
    AnalysisWorkbenchTab
  },
  computed: {
    ...mapGetters(["id","path"]),
    currentEnergyConfig() {
      return {
        1: {
          label: "电量",
          unit: "kWh",
          panelTitle: "电量分析工作台",
          panelMeta: "查看电量构成、核心对象趋势与设备级费用结果",
          extraMetricLabel: "电费",
          extraMetricField: "money"
        },
        2: {
          label: "热量",
          unit: "kWh",
          panelTitle: "热量分析工作台",
          panelMeta: "查看热量构成、趋势变化与设备级统计结果",
          extraMetricLabel: "",
          extraMetricField: ""
        },
        3: {
          label: "冷量",
          unit: "kWh",
          panelTitle: "冷量分析工作台",
          panelMeta: "查看冷量构成、趋势变化与设备级统计结果",
          extraMetricLabel: "",
          extraMetricField: ""
        }
      }[this.energyType];
    },
    summaryCards() {
      const topContributor = this.getTopContributor();
      return [
        {
          key: "total",
          label: `${this.currentEnergyConfig.label}总量`,
          value: this.formatNumber(this.getTotalValue()),
          suffix: this.currentEnergyConfig.unit,
          meta: "按当前筛选对象汇总",
          wide: false
        },
        {
          key: "peak",
          label: "趋势峰值",
          value: this.formatNumber(this.getPeakValue()),
          suffix: this.currentEnergyConfig.unit,
          meta: "所有曲线中的最大值",
          wide: false
        },
        {
          key: "devices",
          label: "设备数",
          value: String(this.table.length),
          suffix: "台",
          meta: "纳入当前统计结果",
          wide: false
        },
        {
          key: "leader",
          label: "占比最高对象",
          value: topContributor.name || "暂无",
          suffix: "",
          meta: topContributor.name ? `占比 ${topContributor.percent}` : "当前暂无构成数据",
          wide: true,
          textValue: true
        }
      ];
    }
  },
  props: {},
  data() {
    return {
      date: dayjs().format('YYYY-MM-DD'),
      dateType: 1,
      type:'日',
      energyType: "1",
      piedata: {},
      xLabel:[],
      timelist:{
        "年":3,
        "月":2,
        "日":1
      },
      energyTable:{
        1:'电量',
        2:'热量',
        3:'冷量'
      },
      table:[],
      xData:[]
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
      this.getPie()
      this.getCur()
      this.gettable()
    },
    getPie() {
      let info = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
      };
      getEnergyAnalysisPie(info).then((res) => {
        this.piedata = res.data || {};
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
        } else {
          this.xLabel = [];
          this.xData = [];
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
        this.table = res.data ||[]
      })
    },
    toNumber(value) {
      const number = Number(value);
      return isNaN(number) ? 0 : number;
    },
    getTotalValue() {
      return Object.keys(this.piedata || {}).reduce((sum, key) => {
        return sum + this.toNumber(this.piedata[key]);
      }, 0);
    },
    getPeakValue() {
      let max = 0;
      (this.xData || []).forEach(item => {
        (item.curveValueList || []).forEach(point => {
          const value = this.toNumber(point.value);
          if (value > max) {
            max = value;
          }
        });
      });
      return max;
    },
    getTopContributor() {
      const items = Object.keys(this.piedata || {}).map(key => {
        return {
          name: key,
          value: this.toNumber(this.piedata[key])
        };
      }).sort((a, b) => b.value - a.value);
      const total = this.getTotalValue();
      if (!items.length || !items[0].value) {
        return {
          name: "",
          percent: "0%"
        };
      }
      return {
        name: items[0].name,
        percent: total ? ((items[0].value / total) * 100).toFixed(1) + "%" : "0%"
      };
    },
    formatNumber(value) {
      const number = this.toNumber(value);
      if (!number) {
        return "0";
      }
      return number.toLocaleString("zh-CN", {
        maximumFractionDigits: number >= 100 ? 0 : 1,
        minimumFractionDigits: number >= 100 ? 0 : 1
      });
    },
    async exporttable(){
      if (!this.xData.length) {
        this.$message.warning("当前筛选下暂无可导出的趋势数据");
        return;
      }
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
  .consumption-page__hero {
    margin-bottom: 18px;
  }

  .consumption-page__hero-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .consumption-toolbar__content {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }

  .consumption-toolbar__actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .flex {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    gap: 14px 18px;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
  }

  .consumption-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(240px, 1.15fr);
    gap: 14px;
    margin-bottom: 18px;
  }

  .consumption-summary-card {
    padding: 18px 20px;
    border-radius: 22px;
    border: 1px solid rgba(124, 202, 255, 0.12);
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);
  }

  .consumption-summary-card__label {
    font-size: 12px;
    color: rgba(190, 214, 232, 0.7);
  }

  .consumption-summary-card__value {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    margin-top: 10px;
    font-size: 30px;
    line-height: 1;
    font-weight: 700;
    color: #eff7ff;
  }

  .consumption-summary-card__value span {
    font-size: 13px;
    color: rgba(181, 206, 224, 0.68);
  }

  .consumption-summary-card__value--text {
    font-size: 24px;
    line-height: 1.15;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .consumption-summary-card__meta {
    margin-top: 10px;
    font-size: 12px;
    color: rgba(181, 206, 224, 0.68);
  }

  .consumption-workbench {
    padding: 20px 22px 24px;
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

@media (max-width: 1480px) {
  .consumption-toolbar__content {
    flex-direction: column;
    align-items: stretch;
  }

  .consumption-toolbar__actions {
    justify-content: flex-end;
  }

  .consumption-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .consumption-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
