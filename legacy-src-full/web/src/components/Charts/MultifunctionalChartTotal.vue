<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "chartData1", "chartData2"],
  data() {
    return {
      charts: "",
      name1: "", // 名称1
      name2: "", // 名称2
      xAxis: [], // 横坐标
      yAxis1: [], // 纵坐标1
      yAxis2: [] // 纵坐标2
    };
  },
  watch: {
    chartData1(val) {
      this.name1 = val.energytypename + val.dateStr;
      this.xAxis = [];
      this.yAxis1 = [];
      for (const key in val.energyQeuryMap) {
        this.xAxis.push(key);
        this.yAxis1.push(val.energyQeuryMap[key]);
      }
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    },
    chartData2(val) {
      this.name2 = val.energytypename + val.dateStr;
      this.xAxis = [];
      this.yAxis2 = [];
      for (const key in val.energyQeuryMap) {
        this.xAxis.push(key);
        this.yAxis2.push(val.energyQeuryMap[key]);
      }
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    }
  },
  created() {
    this.xAxis = [];
    this.yAxis1 = [];
    this.yAxis2 = [];
    this.name1 = this.chartData1.energytypename + this.chartData1.dateStr;
    for (const key in this.chartData1.energyQeuryMap) {
      this.xAxis.push(key);
      this.yAxis1.push(this.chartData1.energyQeuryMap[key]);
    }
    if (this.chartData2 != "" && this.chartData2 != undefined) {
      this.name2 = this.chartData2.energytypename + this.chartData2.dateStr;
      for (const key in this.chartData2.energyQeuryMap) {
        this.xAxis.push(key);
        this.yAxis2.push(this.chartData2.energyQeuryMap[key]);
      }
    }
    if (this.xAxis.length != this.yAxis1.length) {
      this.xAxis.splice(0, this.yAxis1.length);
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
          trigger: "axis"
        },
        toolbox: {
          show: true,
          feature: {
            magicType: { show: true, type: ["line", "bar", "stack", "tiled"] },
            restore: { show: true },
            saveAsImage: { show: true }
          }
        },
        calculable: true,
        xAxis: [
          {
            type: "category",
            data: this.xAxis
          }
        ],
        yAxis: [
          {
            type: "value"
          }
        ],
        series: [
          {
            name: this.name1,
            type: "line",
            smooth: true,
            data: this.yAxis1,
            markPoint: {
              data: [
                { type: "max", name: "最大值" },
                { type: "min", name: "最小值" }
              ]
            },
            markLine: {
              data: [{ type: "average", name: "平均值" }]
            }
          },
          {
            name: this.name2,
            type: "line",
            smooth: true,
            data: this.yAxis2,
            markPoint: {
              data: [
                { type: "max", name: "最大值" },
                { type: "min", name: "最小值" }
              ]
            },
            markLine: {
              data: [{ type: "average", name: "平均值" }]
            }
          }
        ]
      });
    }
  }
};
</script>
