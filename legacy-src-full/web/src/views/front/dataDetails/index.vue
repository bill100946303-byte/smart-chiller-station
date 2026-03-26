<template>
  <div class="dataDetails front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Data Details</div>
        <h1 class="legacy-front-page__title">数据详情</h1>
        <div class="legacy-front-page__meta">查看测点曲线、峰谷均值和对象维度统计，并支持按当前选择导出。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Objects</div>
          <div class="legacy-front-stat__value">{{ xLabel.length }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Rows</div>
          <div class="legacy-front-stat__value">{{ tableData.length }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>查询与配置</strong>
        <span>筛选时间、设备和点位方案后更新下方曲线与表格</span>
      </div>
      <search @drIdchange="drIdchange" @handleSearch="handleSearch" @leadOut="leadOut"/>
    </section>

    <section class="legacy-front-card legacy-front-card--chart">
      <div class="legacy-front-section-title">
        <strong>趋势曲线</strong>
        <span>{{ iconData ? '已生成曲线' : $t('dataDetails.pleaseSelectFeviceFirst') }}</span>
      </div>
      <div class="electric_page">
        <lineEchart
          v-if="iconData"
          :unit="unit"
          :xData="totalEnergyDataY"
          :xLabel="xLabel"
          style="width: 100%; height: 100%"
        />
        <div v-else class="legacy-front-empty">
          {{ $t('dataDetails.pleaseSelectFeviceFirst') }}
        </div>
      </div>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>统计结果</strong>
          <span>峰值、谷值、平均值与时间位置</span>
        </div>
      </div>
      <mytable :tableData="tableData"/>
    </section>
  </div>
</template>

<script>
import { getDetailedReportCurve } from "@/api/front/energytest";
import { mapGetters } from "vuex";
import dayjs from "dayjs";
import Search from "./search";
import Mytable from "./tabel.vue";
import lineEchart from "./lineEchart.vue";

export default {
  computed: {
    ...mapGetters(["path"]),
  },
  name: "index",
  components: {
    Search,
    Mytable,
    lineEchart
  },
  data() {
    return {
      pageinfo: {
        currentPage: 1,
        pageSize: 10
      },
      total: 0,
      tableData: [],
      firstLoad: true,
      searchParams: {
        drId: "",
        startTime: "",
        endTime: "",
      },
      totalEnergyDataY: [],
      xLabel: [],
      unit: [],
      lodings: "",
      iconData: false
    };
  },
  methods: {
    loadingFun() {
      this.lodings = this.$loading({
        lock: true,
        text: "努力加载中...",
        spinner: "el-icon-loading",
        background: "rgba(4, 11, 19, 0.72)",
        target: document.querySelector(".electric_page")
      });
    },
    drIdchange(info) {
      if (this.firstLoad) {
        this.searchParams.drId = info;
        this.firstLoad = false;
        this.searchParams.startTime = `${dayjs().subtract(1, "day").format("YYYY-MM-DD")}`;
        this.searchParams.endTime = `${dayjs().format("YYYY-MM-DD")}`;
      }
    },
    handleSearch(info) {
      this.loadingFun();
      this.searchParams = info;
      this.initData();
    },
    initData() {
      getDetailedReportCurve(this.path, this.searchParams).then((res) => {
        this.iconData = true;
        this.lodings && this.lodings.close();
        this.tableData = res.data;

        this.totalEnergyDataY = res.data.map(item => {
          item.runParamsCurveVO.curveValueList.forEach(curve => {
            curve.unit = item.runParamsCurveVO.unit == null ? "" : item.runParamsCurveVO.unit;
          });
          return item.runParamsCurveVO.curveValueList;
        });
        this.xLabel = res.data.map(item => item.objName);
      }).catch(() => {
        if (this.lodings) {
          setTimeout(() => {
            this.lodings.close();
          }, 200);
        }
      });
    },
    leadOut() {
      if (!this.totalEnergyDataY.length) {
        this.$message.warning("请选择数据后在导出");
        return;
      }

      import("@/vender/Export2Excel").then(excel => {
        const tHeader = ["时间", ...this.xLabel];
        const len = tHeader.length;
        const arr = new Array(this.totalEnergyDataY[0].length).fill(0).map(() => []);
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i];
          for (let j = 0; j < len; j++) {
            if (j === 0) {
              item[j] = this.totalEnergyDataY[0][i].name;
            } else {
              item[j] = this.totalEnergyDataY[j - 1][i].value + this.totalEnergyDataY[j - 1][i].unit;
            }
          }
        }
        excel.export_json_to_excel({
          header: tHeader,
          data: arr,
          filename: "数据曲线"
        });
      });
    }
  }
};
</script>

<style scoped lang="scss">
.electric_page {
  width: 100%;
  height: 500px;
  margin-top: 16px;
}
</style>
