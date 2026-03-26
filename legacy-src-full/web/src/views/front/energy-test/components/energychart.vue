<template>
  <div id="energyid" />
</template>
<script>
import echarts from "echarts";

export default {
  data() {
    return {
      charts: "",
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart("energyid");
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id), "blue");
      this.charts.setOption({
        color: ["rgba(47, 178, 247, 1)"],
        title: {
          text: "kw",
            padding: [20,20,100,130],
           textStyle: {
            color: "#fff",
          },
         
        },
        tooltip: {
          trigger: "axis",
        },
        legend: {
          data: ["冷站能效"],
          textStyle: {
            color: "#fff",
          },
        },
        toolbox: {
          show: true,
          feature: {
            // dataView: { show: true, readOnly: false },
            magicType: { show: true, type: ["bar", "line"] },
            restore: { show: true },
            saveAsImage: { show: true },
          },
        },
        calculable: true,
        xAxis: [
          {
            type: "category",
            data: [
              "00:00",
              "01:00",
              "02:00",
              "03:00",
              "04:00",
              "05:00",
              "06:00",
              "07:00",
              "08:00",
              "09:00",
              "10:00",
              "11:00",
              "12:00",
              "13:00",
              "14:00",
              "15:00",
              "16:00",
              "17:00",
              "18:00",
              "19:00",
              "20:00",
              "21:00",
              "22:00",
              "23:00",
            ],

            axisLine: {
              //这是x轴文字颜色
              lineStyle: {
                color: "#fff",
              },
            },
          },
        ],
        yAxis: [
          {
            type: "value",
            axisLine: {
              //这是y轴文字颜色
              lineStyle: {
                color: "#fff",
              },
            },

            // axisLabel: {
            //   formatter: "{value} kw",
            // },
          },
        ],
        series: [
          {
            name: "冷站能效",
            type: "bar",
            data: [128, 128, 108, 272, 128, 128, 128, 256, 112, 421],
            markPoint: {
              data: [
                { type: "max", name: "最大值" },
                { type: "min", name: "最小值" },
              ],
            },
            markLine: {
              data: [{ type: "average", name: "平均值" }],
            },
          },
        ],
      });
    },
  },
};
</script>
<style lang="scss" scoped>
#energyid {
  width: 100%;
  height: 100%;
}
</style>