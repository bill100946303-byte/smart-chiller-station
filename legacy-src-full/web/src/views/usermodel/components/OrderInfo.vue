<template>
  <div class="pie-chart">
    <div :id="id" style="width:180px;height:180px;" />
    <div class="order-number">
      <div
        :class="[item.name === '未处理'?'order-todo':'', item.name === '正在处理'?'order-doing':'', item.name === '处理完毕'?'order-finish':'','orders']"
        v-for="(item, i) in pieData"
        :key="i"
      >
        <span>{{ item.name }}</span>
        <span>{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import { getOrderData } from "@/api/usersetting/devicemonitor/model1";

export default {
  props: ["id"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: "",
      pieNames: [],
      pieData: []
    };
  },
  created() {
    getOrderData(this.path)
      .then(res => {
        this.pieData = res.data;
        this.$nextTick(() => {
          this.initChart(this.id);
        });
      })
      .catch(console.log);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        title: {
          text: "工单比例",
          left: "center",
          top: "45%",
          textStyle: {
            color: "var(--theme-color)",
            fontSize: 18,
            align: "center"
          }
        },
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        color: ["#fd8e22", "#349bf1", "#f74e36"],
        calculable: true,
        series: [
          {
            name: "工单信息",
            type: "pie",
            radius: ["40%", "70%"],
            label: {
              normal: {
                show: false
              }
            },
            data: this.pieData
          }
        ]
      });
    }
  }
};
</script>
<style lang="scss" scoped>
.pie-chart {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .order-number {
    .orders {
      display: flex;
      align-items: center;
      justify-content: space-around;
      margin: 10px 0;
      width: 160px;
      height: 50px;
      border-radius: 15px;

      span {
        font-family: MicrosoftYaHei;
        font-size: 12px;
        line-height: 12px;
        color: var(--theme-color);
      }
    }
    .orders span:nth-child(2) {
      font-size: 20px;
      font-family: bold;
    }

    .order-todo {
      background-color: #f74e36;
    }

    .order-doing {
      background-color: #fd8e22;
    }

    .order-finish {
      background-color: #349bf1;
    }
  }
}
</style>