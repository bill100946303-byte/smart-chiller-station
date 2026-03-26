<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "circulChartData"],
  data() {
    return {
      charts: "",
      pieNames: [],
      baseDatta: [
        { value: 335, name: "空调" },
        { value: 310, name: "照明" },
        { value: 234, name: "配电" },
        { value: 145, name: "视频安防" }
      ]
    };
  },
  watch: {
    circulChartData(val) {
      if (val.length != 0) {
        this.baseDatta = this.circulChartData
      }
      this.$nextTick(() => {
        this.initChart(this.id);
      });
    }
  },
  created() {
    if (this.circulChartData.length != 0) {
      this.baseDatta = this.circulChartData
    }
    this.$nextTick(() => {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        title: {
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
        color: ["#E1F501", "#21ea8d", "#f74e36", "#fd8e22"],
        calculable: true,
        series: [
          {
            name: "设备信息",
            type: "pie",
            radius: ["40%", "70%"],
            label: {
              normal: {
                show: false
              }
            },
            data: this.baseDatta
          }
        ]
      });
    }
  }
};
</script>