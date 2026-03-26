<template>
  <!--热不平衡 -->
  <div class="compare-page front-box-show">
    <div class="search-form panel-card">
      <compare-search
        @handleSearch="ClickhandleSearch"
        :searchinfo="searchinfo"
        @exportform="exportform"
      />
    </div>
    <div class="electric_page panel-card">
      <div class="panel-card__header">
        <div>
          <div class="panel-card__eyebrow">CURVE</div>
          <div class="panel-card__title">能效对比</div>
        </div>
      </div>
      <div class="line_echart">
        <lineEchart2
          :xData="totalEnergyDataY"
          :xLabel="xLabel"
          style="width: 100%; height: 100%"
        />
      </div>
    </div>

    <div class="table_list panel-card">
      <el-table
          :data="tableData"
          :header-cell-style="{
          background: 'rgba(13, 40, 60, 0.92)',
          color: 'rgba(245, 251, 255, 0.96)',
        }"
          style="width: 100%"
      >
        <!--        <el-table-column class-name="front-column" prop="object" label="对象">-->
        <el-table-column :label="$t('consumption.object')" align="center" class-name="front-column" prop="object">
        </el-table-column>
        <!--        <el-table-column class-name="front-column" prop="wholeValue" label="整体值">-->
        <el-table-column :label="$t('energytest_compare.OverallValue')" align="center" class-name="front-column"
                         prop="wholeValue">
        </el-table-column>

        <!--        <el-table-column class-name="front-column" prop="averageValue" label="平均值">-->
        <el-table-column :label="$t('consumption.averageValue')" align="center" class-name="front-column"
                         prop="averageValue">
        </el-table-column>

        <!--        <el-table-column class-name="front-column" prop="tenPercentGoodAverageValue" label="10%最优平均值">-->
        <el-table-column :label="'10%'+$t('energytest_search.optimalAverage')" align="center" class-name="front-column"
                         prop="tenPercentGoodAverageValue">
        </el-table-column>
        <!--        <el-table-column class-name="front-column" prop="tenPercentBadAverageValue" label="10%最差平均值">-->
        <el-table-column :label="'10%'+$t('energytest_search.worstMean')" align="center" class-name="front-column"
                         prop="tenPercentBadAverageValue">
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import CompareSearch from "./components/compareSearch.vue";
import electricTabEchart from "./components/electricTabEchart.vue";
import lineEchart2 from "./components/lineEchart2.vue";
import { findEnergyContrast } from "@/api/front/energytest";
import { formatDate, formatDay } from "@/utils/index";
import { mapGetters } from "vuex";
import dayjs from "dayjs";
export default {
  components: {
    electricTabEchart,
    lineEchart2,
    CompareSearch,
  },
  props: {},
  data() {
    return {
      searchinfo: {
        // drName: "冷站",
        // drName: this.$t('energytest_search.coolingStation'),
        drName: 'CoolingStation',
        timeList: [dayjs().format("YYYY-MM-DD")],
        timeSpace: 1,
      },
      totalEnergyDataY: [],
      tableData: [],
      xLabel: [],
    };
  },
  watch: {},
  computed: {
    ...mapGetters(["path"]),
  },
  created() {
    this.createdhandleSearch(this.searchinfo);
  },
  mounted() {},
  methods: {
    createdhandleSearch(info) {
      let sers = { ...info };
      sers.timeList = info.timeList.join(",");
      findEnergyContrast(this.path, sers).then((res) => {
        this.tableData = res.data.tableList;
        this.totalEnergyDataY = res.data.curveList;

        this.xLabel = res.data.curveList[0].data.map((item) => {
          return item.time;
        });
      });
    },
    ClickhandleSearch(info) {
      let sers = { ...info };
      sers.timeList = info.timeList.join(",");
      findEnergyContrast(this.path, sers).then((res) => {
        this.tableData = res.data.tableList;
        this.totalEnergyDataY = res.data.curveList;

        res.data.curveList.forEach((item) => {
          if (item.data.length == 24) {
            this.xLabel = item.data.map((item) => {
              return item.time;
            });
          }
        });
      });
    },
    exportform() {
      if (!this.totalEnergyDataY.length) {
        // this.$message.warning("请选择数据后在导出");
        this.$message.warning(this.$t('prompt.pleaseSelectDataExporting'));
        return;
      } else {
        console.log(
          "this.totalEnergyDataY ",
          this.totalEnergyDataY,
          this.xLabel
        );
        const tHeader = this.totalEnergyDataY.reduce(
            (pre, next) => {
              pre.push(next.title);
              return pre;
            },
            // ["时间"]
            [this.$t('logrizi.time')]
        );
        let len = tHeader.length;
        const arr = new Array(this.xLabel.length).fill(0).map((item) => []);
        for (let i = 0; i < arr.length; i++) {
          let item = arr[i];
          for (let j = 0; j < len; j++) {
            if (j === 0) {
              item[j] = this.xLabel[i];
            } else {
              // console.log(
              //   "this.totalEnergyDataY[j-1]",
              //   this.totalEnergyDataY[j - 1]
              // );
              //[时间，value] i=0 [this.totalEnergyDataY[0][0].value,this.totalEnergyDataY[1][0].value]
              item[j] = this.totalEnergyDataY[j - 1].data[i]["cop"];
            }
          }
        }
        import("@/vender/Export2Excel").then((excel) => {
          excel.export_json_to_excel({
            header: tHeader,
            data: arr,
            // filename: "能效对比",
            filename: this.$t('route.compare'),
          });
        });
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.compare-page {
  padding: 0;
  display: grid;
  gap: 14px;
}

.panel-card {
  padding: 16px 18px 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
  border: 1px solid rgba(124, 202, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);
}

.panel-card__header {
  margin-bottom: 10px;
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
.electric_page {
  width: 100%;
  height: 55vh;
  min-height: 420px;
}

.line_echart {
  width: 100%;
  height: 100%;
}

.table_list {
  margin-top: 0;
}
</style>
