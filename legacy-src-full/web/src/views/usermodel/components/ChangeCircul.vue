<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";
export default {
  props: ['id', "changeCirculData"],
  data() {
    return {
      charts: "",
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart();
    });
  },
  methods: {
    initChart() {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        color: ["#21ea8d", "#349bf1", "#fd8e22", "#f74e36"],
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        legend: {
          x: "center",
          y: "bottom",
          itemGap: 30,
          itemWidth: 30,
          itemHeight: 10,
          data: [
            "照明",
            "配电",
            "空调",
            "视频安防"
          ],
          textStyle: {
            fontSize: 13, //字体大小
            color: "rgb(142, 199, 220)" //字体颜色
          }
        },
        calculable: true,
        series: [
          {
            name: "楼栋能耗",
            type: "pie",
            roseType: "radius",
            width: "40%", // for funnel
            max: 40, // for funnel
            itemStyle: {
              normal: {
                label: {
                  position: 'inner'
                },
                labelLine: {
                  show: false
                }
              },
              emphasis: {
                label: {
                  show: false
                },
                labelLine: {
                  show: false
                }
              }
            },
            data: [
              { value: 10, name: "照明" },
              { value: 20, name: "配电" },
              { value: 15, name: "空调" },
              { value: 25, name: "视频安防" }
            ]
          }
        ]
      });
    }
  }
};
</script>