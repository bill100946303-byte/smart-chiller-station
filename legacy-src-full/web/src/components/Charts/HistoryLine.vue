<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "hislineData"],
  data() {
    return {
      charts: "",
      hislineName: "", // 表名
      hislineX: [], // 横坐标
      hislineValue: [] // 数据
    };
  },
  watch: {
    hislineData(val) {
      console.log(val);
      this.hislineX = [];
      this.hislineValue = [];
      this.hislineData.forEach(ele => {
        this.hislineX.push(ele.time);
        this.hislineValue.push(ele.tagvalue);
      });
      this.$nextTick(() => {
        this.initChart(this.id);
      });
    }
  },
  created() {
    console.log(this.hislineData);
    this.hislineData.forEach(ele => {
      this.hislineX.push(ele.time);
      this.hislineValue.push(ele.tagvalue);
    });
    this.$nextTick(() => {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        title: {
          text: this.hislineName
        },
        tooltip: {
          trigger: "axis"
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true
        },
        toolbox: {
          feature: {
            saveAsImage: {}
          }
        },
        xAxis: {
          type: "category",
          data: this.hislineX
        },
        yAxis: {
          type: "value"
        },
        series: [
          {
            data: this.hislineValue,
            type: "line",
            smooth: true
          }
        ]
      });
    }
  }
};
</script>