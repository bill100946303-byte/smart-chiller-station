<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
export default {
  props: ["id", "pieData"],
  data() {
    return {
      charts: "",
      pieNames: []
    };
  },
  watch: {
    pieData(val) {
      console.log(val);
      this.pieData.forEach(ele => {
        this.pieNames.push(ele.name);
      });
      if (val.length > 0) {
        this.$nextTick(function() {
          this.initChart(this.id);
        });
      }
    }
  },
  created() {
    this.pieData.forEach(ele => {
      this.pieNames.push(ele.name);
    });
    this.$nextTick(function() {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        title: {
          text: "报警信息统计分析",
          left: "30%",
          textStyle: {
            fontSize: 16
          },
        },
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)",
          position: "inside"
        },
        legend: {
          bottom: "bottom",
          data: this.pieNames
        },
        series: [
          {
            name: "报警分析",
            type: "pie",
            radius: "55%",
            center: ["50%", "40%"],
            data: this.pieData,
            itemStyle: {
              normal: {
                label: {
                  show: false
                },
                labelLine: {
                  show: false
                },
                color: item => {
                  if (item.data.name === "高报警") {
                    return "red";
                  } else if (item.data.name === "中报警") {
                    return "orange";
                  } else if (item.data.name === "低报警") {
                    return "blue";
                  } else {
                    return "red";
                  }
                }
              },
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