<template>
  <div class="energy-analysis-view">
    <section class="legacy-front-toolbar energy-analysis-toolbar">
      <div class="energy-analysis-toolbar__meta">
        <div class="energy-analysis-toolbar__copy">
          <strong>负荷比重</strong>
          <span>关注负荷区间占比和冷站效能的联动关系，快速定位高负荷区间的能效表现。</span>
        </div>
        <div class="legacy-front-chip">当前粒度：{{ type }}</div>
      </div>
      <el-form :inline="true" class="demo-form-inline legacy-front-toolbar__form">
        <el-form-item :label="$t('public.TimeSelection')">
          <el-radio-group v-model="type" class="energy-analysis-segmented" @change="groupchange">
            <el-radio-button :label="$t('public.year')"></el-radio-button>
            <el-radio-button :label="$t('public.month')"></el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('public.TimeSelection')">
          <el-date-picker
            v-model="date"
            :format="dateType === 2 ? 'yyyy-MM' : 'yyyy'"
            :type="pickerType"
            :value-format="dateType === 2 ? 'yyyy-MM' : 'yyyy'"
            prefix-icon="al_element-icons al_icona-huaban1"
          />
        </el-form-item>
        <el-form-item>
          <el-button class="energy-btn" type="primary" @click="onSubmit">
            <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>
          <el-button class="energy-btn energy-btn--secondary" type="primary" @click="exporttable">
            <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
            {{ $t('public.exportData') }}
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

    <section class="energy-analysis-card">
      <div class="energy-analysis-card__header">
        <div>
          <div class="energy-analysis-card__eyebrow">区间分析</div>
          <div class="energy-analysis-card__title">负荷比重趋势</div>
        </div>
        <div class="energy-analysis-card__meta">保留单图主导结构，但将区间占比与冷站效能放进同一分析语境。</div>
      </div>
      <div class="energy-analysis-card__body">
        <div class="energy-analysis-chart-box">
          <PersentEchart :info="echartData" :status="status"/>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import PersentEchart from "./components/persentEchart.vue";
import { findLoadSpecificGravity } from "@/api/front/energytest";
import { mapGetters } from "vuex";
import dayjs from "dayjs";

export default {
  name: "EnergyTestProportion",
  components: {
    PersentEchart
  },
  computed: {
    ...mapGetters(["path"]),
    summaryCards() {
      const items = this.normalizedData;
      const topRatio = items.slice().sort((a, b) => b.ratio - a.ratio)[0] || {};
      const topEfficiency = items.slice().sort((a, b) => b.efficiency - a.efficiency)[0] || {};
      const avgEfficiency = items.length
        ? items.reduce((sum, item) => sum + item.efficiency, 0) / items.length
        : 0;
      return [
        {
          key: "ranges",
          label: "区间数",
          value: String(items.length),
          suffix: "档",
          meta: "当前粒度下参与分析的负荷区间"
        },
        {
          key: "ratio",
          label: "最高占比",
          value: this.formatValue(topRatio.ratio),
          suffix: "%",
          meta: topRatio.name ? `主导区间：${this.formatRangeLabel(topRatio.name)}` : "当前暂无区间数据"
        },
        {
          key: "efficiency",
          label: "平均冷站效能",
          value: this.formatValue(avgEfficiency),
          suffix: `KW/${this.$store.getters.unitSelete}`,
          meta: "按当前区间结果求平均"
        },
        {
          key: "best",
          label: "最佳区间",
          value: this.formatRangeLabel(topEfficiency.name) || "暂无",
          suffix: "",
          meta: topEfficiency.name ? `区间效能 ${this.formatValue(topEfficiency.efficiency)} KW/${this.$store.getters.unitSelete}` : "当前暂无区间数据",
          textValue: true
        }
      ];
    },
    normalizedData() {
      return (this.echartData || []).map(item => {
        return {
          name: item["负荷区间"],
          ratio: this.toNumber(item["负荷比重比例"]),
          efficiency: this.toNumber(item["冷站效能"])
        };
      });
    }
  },
  data() {
    return {
      date: dayjs().format("YYYY-MM"),
      echartData: [],
      type: this.$t("public.month"),
      timelist: {
        年: 3,
        月: 2
      },
      dateType: 2,
      pickerType: "month",
      status: 0
    };
  },
  created() {
    this.initData();
  },
  methods: {
    toNumber(value) {
      const number = Number(value);
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
    formatRangeLabel(value) {
      if (!value) {
        return "";
      }
      return String(value).split(",")[0];
    },
    groupchange() {
      this.dateType = this.timelist[this.type];
      if (this.dateType === 3) {
        this.pickerType = "year";
        this.date = dayjs().format("YYYY");
      } else {
        this.pickerType = "month";
        this.date = dayjs().format("YYYY-MM");
      }
      this.onSubmit();
    },
    initData() {
      this.echartData = [];
      this.status = 0;
      findLoadSpecificGravity(this.path, { date: this.date, dateType: this.dateType }).then(res => {
        this.echartData = res.data || [];
        this.status = res.status;
      });
    },
    exporttable() {
      if (!this.echartData.length) {
        this.$message.warning(this.$t("prompt.pleaseSelectDataExporting"));
        return;
      }
      const tHeader = ["负荷区间", "负荷比例(%)", "冷站效能(KW/" + this.$store.getters.unitSelete + ")"];
      const arr = new Array(this.echartData.length).fill(0).map(() => []);
      this.echartData.forEach((element, index) => {
        arr[index].push(element["负荷区间"], element["负荷比重比例"], element["冷站效能"]);
      });
      import("@/vender/Export2Excel").then(excel => {
        excel.export_json_to_excel({
          header: tHeader,
          data: arr,
          filename: "负荷比重"
        });
      });
    },
    onSubmit() {
      if (!this.date) {
        this.$message({
          message: this.$t("prompt.pleaseSelect") + this.$t("logrizi.time"),
          type: "warning"
        });
      } else {
        this.initData();
      }
    }
  }
};
</script>
