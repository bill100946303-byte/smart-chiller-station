<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "chartData"],
  data() {
    return {
      charts: "",
      xAxis: [], // 横坐标
      barData: [], // 总数据 
      title: [] // 标题
    };
  },
  watch: {
    chartData(val) {
      this.xAxis = [];
      this.barData = [];
      val.forEach(ele => {
        this.xAxis = [];
        let yAxis = [];
        this.title.push(ele.energytypename)
        for (const key in ele.energyQeuryMap) {
          this.xAxis.push(key);
          yAxis.push(ele.energyQeuryMap[key]);
        }
        let obj = {
          name: ele.energytypename,
          type: "line",
          smooth: true,
          data: yAxis,
          markPoint: {
            data: [
              { type: "max", name: "最大值" },
              { type: "min", name: "最小值" }
            ]
          },
          markLine: {
            data: [{ type: "average", name: "平均值" }]
          }
        };
        this.barData.push(obj);
      });
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    }
  },
  created() {
    this.chartData.forEach(ele => {
      this.xAxis = [];
      let yAxis = [];
      this.title.push(ele.energytypename)
      for (const key in ele.energyQeuryMap) {
        this.xAxis.push(key);
        yAxis.push(ele.energyQeuryMap[key]);
      }
      let obj = {
        name: ele.energytypename,
        type: "line",
        smooth: true,
        data: yAxis,
        markPoint: {
          data: [
            { type: "max", name: "最大值" },
            { type: "min", name: "最小值" }
          ]
        },
        markLine: {
          data: [{ type: "average", name: "平均值" }]
        }
      };
      this.barData.push(obj);
    });
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
        legend: {
          data: this.title
        },
        grid: {
          top: '10%',
          left: '5%',
          right: '3%',
          bottom: '8%'
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
        series: this.barData
      });
    }
  }
};
</script>
