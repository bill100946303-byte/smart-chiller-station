<template>
  <div class="energy-analysis-view">
    <section class="legacy-front-toolbar energy-analysis-toolbar">
      <div class="energy-analysis-toolbar__meta">
        <div class="energy-analysis-toolbar__copy">
          <strong>热不平衡率</strong>
          <span>围绕时间区间查看热不平衡率曲线、达标统计和对象明细，不改变现有接口与导出方式。</span>
        </div>
        <div class="legacy-front-chip">时间区间：{{ time[0] }} 至 {{ time[1] }}</div>
      </div>
      <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form">
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
        <el-form-item>
          <el-button class="energy-btn" type="primary" @click="handleClick">
            <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>
          <el-button class="energy-btn energy-btn--secondary" type="primary" @click="exporttable">
            <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
            导出曲线
          </el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="energy-analysis-summary-grid">
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

    <section class="legacy-front-tab-shell">
      <div class="legacy-front-section-title">
        <strong>达标分析工作区</strong>
        <span>先看曲线，再看达标统计，最后查看对象明细。</span>
      </div>
      <heatbalance-tab
        :xData="xData"
        :xLabel="xLabel"
        :dataStatisticsList="dataStatisticsList"
        :table="table"
      />
    </section>
  </div>
</template>

<script>
import heatbalanceTab from "@/views/front/consumption/tabs/heatbalanceTab.vue";
import {
  getEnergyAnalysisCurve,
  getEnergyAnalysisDeviceList
} from "@/api/front/consumption";
import { mapGetters } from "vuex";
import dayjs from "dayjs";

export default {
  name: "EnergyTestHotBalance",
  components: {
    heatbalanceTab
  },
  computed: {
    ...mapGetters(["path", "id"]),
    summaryCards() {
      const averageRate = this.dataStatisticsList.length
        ? this.dataStatisticsList.reduce((sum, item) => sum + this.toNumber(item.scalarRate), 0) / this.dataStatisticsList.length
        : 0;
      const worstItem = this.dataStatisticsList
        .map(item => ({
          name: item.acquisitionValue,
          value: this.toNumber(item.scalarRate)
        }))
        .sort((a, b) => a.value - b.value)[0] || {};
      const abnormalTotal = this.dataStatisticsList.reduce((sum, item) => {
        return sum + this.toNumber(item.noScalar);
      }, 0);
      return [
        {
          key: "metrics",
          label: "统计项数",
          value: String(this.dataStatisticsList.length),
          suffix: "项",
          meta: "当前时间区间下的达标统计项"
        },
        {
          key: "rate",
          label: "平均达标率",
          value: this.formatValue(averageRate),
          suffix: "%",
          meta: "按当前统计结果求平均"
        },
        {
          key: "abnormal",
          label: "不达标总量",
          value: this.formatValue(abnormalTotal),
          suffix: "",
          meta: "所有统计项的不达标量汇总"
        },
        {
          key: "worst",
          label: "最低达标项",
          value: worstItem.name || "暂无",
          suffix: "",
          meta: worstItem.name ? `达标率 ${this.formatValue(worstItem.value)}%` : "当前暂无统计项",
          textValue: true
        }
      ];
    }
  },
  data() {
    return {
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        }
      },
      date: dayjs().format("YYYY-MM-DD"),
      dateType: 0,
      table: [],
      xData: [],
      xLabel: [],
      dataStatisticsList: [],
      energyType: 4,
      time: [dayjs().subtract(1, "day").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD")]
    };
  },
  created() {
    this.getCur();
    this.gettable();
  },
  methods: {
    toNumber(value) {
      const number = Number(String(value).replace("%", ""));
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
    getCur() {
      const info = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
        startTime: this.time[0],
        endTime: this.time[1]
      };
      getEnergyAnalysisCurve(info).then(res => {
        if (res.data && res.data.length) {
          this.xLabel = res.data[0].curveValueList.map(item => item.name);
          this.xData = res.data;
        } else {
          this.xData = [];
          this.xLabel = [];
        }
      });
    },
    handleClick() {
      this.getCur();
      this.gettable();
    },
    gettable() {
      const info = {
        appId: this.id,
        date: this.date,
        dateType: this.dateType,
        energyType: this.energyType,
        startTime: this.time[0],
        endTime: this.time[1]
      };
      getEnergyAnalysisDeviceList(this.path, info).then(res => {
        this.table = res.data[0] ? res.data[0].tableList : [];
        this.dataStatisticsList = res.data[0] ? res.data[0].dataStatisticsList : [];
      });
    },
    async exporttable() {
      if (!this.xData.length) {
        this.$message.warning(this.$t("prompt.pleaseSelectDataExporting"));
        return;
      }
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default || xlsxModule;
      const wb = XLSX.utils.book_new();
      this.xData.forEach(item => {
        const sheet = item.curveValueList.map(ele => {
          return [ele.name, ele.value];
        });
        sheet.unshift(["时间", "热不平衡率"]);
        const worksheet = XLSX.utils.aoa_to_sheet(sheet);
        XLSX.utils.book_append_sheet(wb, worksheet, item.title);
      });
      const workbookBlob = this.workbook2blob(wb, XLSX);
      this.openDownloadDialog(workbookBlob, `热不平衡率${dayjs().format("YYYY-MM-DD")}.xlsx`);
    },
    workbook2blob(workbook, XLSX) {
      const wopts = {
        bookType: "xlsx",
        bookSST: false,
        type: "binary"
      };
      const wbout = XLSX.write(workbook, wopts);
      function s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
        return buf;
      }
      return new Blob([s2ab(wbout)], {
        type: "application/octet-stream"
      });
    },
    openDownloadDialog(blob, fileName) {
      let target = blob;
      if (typeof blob === "object" && blob instanceof Blob) {
        target = URL.createObjectURL(blob);
      }
      const aLink = document.createElement("a");
      aLink.href = target;
      aLink.download = fileName || "";
      let event;
      if (window.MouseEvent) {
        event = new MouseEvent("click");
      } else {
        event = document.createEvent("MouseEvents");
        event.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      }
      aLink.dispatchEvent(event);
    }
  }
};
</script>
