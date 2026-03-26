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
      this.hislineX = [];
      this.hislineValue = [];
      if (val === undefined) {
        this.hislineX = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        this.hislineValue = [820, 932, 901, 934, 1290, 1330, 1320];
      } else {
        for (const key in this.hislineData) {
          this.hislineName = key;
          this.hislineData[key].forEach(ele => {
            this.hislineX.push(ele.time);
            this.hislineValue.push(ele.tagvalue);
          });
        }
      }
      this.$nextTick(() => {
        this.initChart(this.id);
      });
    }
  },
  created() {
    if (this.hislineData === undefined) {
      this.hislineX = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      this.hislineValue = [820, 932, 901, 934, 1290, 1330, 1320];
    } else {
      for (const key in this.hislineData) {
        this.hislineName = key;
        this.hislineData[key].forEach(ele => {
          this.hislineX.push(ele.time);
          this.hislineValue.push(ele.tagvalue);
        });
      }
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
          text: this.hislineName
        },
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
        grid: {
          top: '15%',
          left: "3%",
          right: "3%",
          bottom: "1%",
          containLabel: true
        },
        xAxis: {
          type: "category",
          data: this.hislineX,
          axisLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLabel: {
            show: true,
            textStyle: {
              color: ["#3dadfe"]
            }
          }
        },
        yAxis: {
          type: "value",
          splitLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLabel: {
            show: true,
            textStyle: {
              color: ["#3dadfe"]
            }
          }
        },
        series: [
          {
            data: this.hislineValue,
            type: "line",
            smooth: 'true'
          }
        ]
      });
    }
  }
};
</script>