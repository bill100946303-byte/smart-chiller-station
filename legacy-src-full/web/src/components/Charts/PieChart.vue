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
      titleData: [], // 标签数据
      pieData: [] // 环形数据
    };
  },
  watch: {
    chartData(val) {
      val.forEach(ele => {
        let obj = {};
        for (const key in ele.energyQeuryMap) {
          obj = {
            value: ele.energyQeuryMap[key],
            name: ele.energytypename
          };
        }
        this.titleData.push(ele.energytypename);
        this.pieData.push(obj);
      });
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    }
  },
  created() {
    this.chartData.forEach(ele => {
      let obj = {};
      for (const key in ele.energyQeuryMap) {
        obj = {
          value: ele.energyQeuryMap[key],
          name: ele.energytypename
        };
      }
      this.titleData.push(ele.energytypename);
      this.pieData.push(obj);
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
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        legend: {
          type: "scroll",
          orient: "vertical",
          right: 10,
          top: 20,
          bottom: 20
        },
        series: [
          {
            name: "能耗情况",
            type: "pie",
            radius: "40%",
            center: ["50%", "60%"],
            data: this.pieData,
            itemStyle: {
              emphasis: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)"
              }
            }
          }
        ]
      });
    }
  }
};
</script>