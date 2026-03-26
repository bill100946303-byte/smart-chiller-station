<template>
  <div id="multiline"/>
</template>
<script>
import echarts from "echarts";

export default {
  props: ["xLabel", "xData", "unit"],
  data() {
    return {
      charts: "",
    };
  },
  watch: {
    xLabel: {
      handler(val) {
        if (val) {
          this.$nextTick(() => {
            this.initChart();
          });
        }
      },
      immediate: true,
      deep: true,
    },
  },
  mounted() {
  },
  methods: {
    initChart(id) {
      const colorList = [
        "rgba(19, 244, 205, 1)",
        "rgba(15, 241, 185, 1)",
        "rgba(42, 102, 240, 1)",
        "rgba(15, 227, 241, 1)",
        "rgba(255, 76, 137, 1)",
        "#9E87FF",
        "rgba(15, 241, 185, 1)",
      ];
      const linercolorList = [
        [{
          offset: 0,
          color: "rgba(15, 241, 185, .3)"


        },
          {
            offset: 1,
            color: "rgba(15, 241, 185, 0)"
          }
        ],
        [{
          offset: 0,
          color: "rgba(42, 102, 240,.3)"


        },
          {
            offset: 1,
            color: "rgba(42, 102, 240, 0)"
          }
        ],
        [{
          offset: 0,
          color: "rgba(15, 227, 241,.3)"


        },
          {
            offset: 1,
            color: "rgba(15, 227, 241, 0)"
          }
        ],
        [{
          offset: 0,
          color: "rgba(255, 76, 137,.3)"


        },
          {
            offset: 1,
            color: "rgba(255, 76, 137, 0)"
          }
        ]
      ];
      this.charts = echarts.init(document.getElementById("multiline"));

      let objee = {
        name: "",
        type: "line",
        smooth: true,
        lineStyle: {
          normal: {
            width: 1,
          },
          borderColor: "#fff",
        },
        showAllSymbol: false,
        tooltip: {
          show: true,
        },
        data: [],
      }
      let series = this.xData.map((item, index) => {
        let obj = {...objee}
        obj.name = item.title;
        obj.itemStyle = {...obj.itemStyle}
        obj.itemStyle.color = colorList[index]
        obj.data = item.data.map(item => {
          return item.value
        })
        obj.areaStyle = { //区域填充样式
          normal: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, linercolorList[index], false),
            shadowColor: 'rgba(25,163,223, 0.5)', //阴影颜色
            shadowBlur: 20 //shadowBlur设图形阴影的模糊大小。配合shadowColor,shadowOffsetX/Y, 设置图形的阴影效果。
          }
        }
        return obj
      })

      let option = {
        backgroundColor: "transparent",
        tooltip: {
          textStyle: {
            color: '#000', // 设置文本颜色
            fontSize: 15,
          },
          trigger: "axis",
          backgroundColor: "transparent",
          axisPointer: {
            lineStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: "rgba(126,199,255,0)", // 0% 处的颜色
                  },
                  {
                    offset: 0.5,
                    color: "rgba(126,199,255,1)", // 100% 处的颜色
                  },
                  {
                    offset: 1,
                    color: "rgba(126,199,255,0)", // 100% 处的颜色
                  },
                ],
                global: false, // 缺省为 false
              },
            },
          },
        },
        legend: {
          show: false,
          align: "auto",
          top: "1%",
          type: "plain",
          textStyle: {
            color: "#7ec7ff",
            fontSize: 16,
          },
          // icon:'rect',
          itemGap: 25,
          itemWidth: 18,
          icon:
              "path://M0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z",
        },
        grid: {
          top: "40",
          left: "30",
          right: "36",
          bottom: "30",
          // containLabel: true
        },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            axisLine: {
              //坐标轴轴线相关设置。数学上的x轴
              show: true,
              lineStyle: {
                color: "#333",
              },
            },
            axisLabel: {
              //坐标轴刻度标签的相关设置
              textStyle: {
                padding: [0, -20, 0, 0],
                color: "#000",
                fontSize: 14,
              },
              align: 'center',
              formatter: function (data) {
                return data;
              },
              interval: 34,
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "#333",
                width: 0.5,
                type: 'dotted',
              },
            },
            axisTick: {
              show: false,
            },

            data: this.xLabel,
          },
        ],
        yAxis: [
          {
            name: this.unit,
            nameTextStyle: {
              color: "#fff",
              fontSize: 14,
              padding: 10,
            },
            min: 0,
            splitNumber: 2,
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dotted',
                width: 0.5,
                color: "#333",
              },
            },
            // axisLine: {
            //   show: true,
            //   lineStyle: {
            //     color: "#333",
            //   },
            // },
            axisLabel: {
              show: true,
              textStyle: {
                color: "#000",
              },
              formatter: function (value) {
                if (value === 0) {
                  return value;
                }
                return value;
              },
            },
            axisTick: {
              show: false,
            },
          },
        ],
        series: series
      };
      this.charts.setOption(option);
    },
  },
};
</script>
<style lang="scss" scoped>
#lineid {
  width: 100%;
  height: 100%;
}
</style>
