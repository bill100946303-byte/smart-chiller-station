<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "pieChartData"],
  data() {
    return {
      charts: "",
      pieNames: [],
      baseData: [
        { value: 335, name: "空调" },
        { value: 310, name: "照明" },
        { value: 234, name: "配电" },
        { value: 145, name: "视频安防" }
      ]
    };
  },
  watch: {
    pieChartData(val) {
      if (val.length != 0) {
        this.baseData = this.pieChartData;
      }
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    }
  },
  created() {
    if (this.pieChartData.length != 0) {
      this.baseData = this.pieChartData;
    }
    this.$nextTick(function() {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        color: ["#2BE177", "#F50101", "#DDFF00"],
        legend: {
          orient: "vertical",
          left: "left",
          top: "middle",
          data: ["空调", "照明", "配电", "视频安防"],
          textStyle: {
            color: "var(--theme-color)"
          }
        },
        series: [
          {
            name: "设备比例",
            type: "pie",
            radius: "55%",
            center: ["50%", "60%"],
            itemStyle: {
              emphasis: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)"
              }
            },
            data: this.baseData
          }
        ]
      });
    }
  }
};
</script>