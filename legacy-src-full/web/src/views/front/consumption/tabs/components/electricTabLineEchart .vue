<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";

export default {
  props: ["id", "xLabel","xData"],
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
            this.initChart(this.id);
          });
        }
      },
      immediate: true,
      deep: true,
    },
  },
  mounted() {},
  methods: {
    initChart(id) {
      const colorList = [
        "rgba(15, 241, 185, 1)",
        "rgba(42, 102, 240, 1)",
        "rgba(15, 227, 241, 1)",
        "rgba(255, 76, 137, 1)",
        "#9E87FF",
        "rgba(15, 241, 185, 1)",
      ];
      this.charts = echarts.init(document.getElementById(id));
      let legend = this.xData.map(item=>{
        return {
          name:item.title
        }
      })
      let objee = {
            name: "",
            type: "line",
            symbol: "circle", // 默认是空心圆（中间是白色的），改成实心圆
            showAllSymbol: true,
            symbolSize: 0,
            smooth: true,
            lineStyle: {
              normal: {
                width:1,
              },
              borderColor: "rgba(0,0,0,.4)",
            },
            itemStyle: {
              color: "rgba(25,163,223,1)",
              borderColor: "#646ace",
              borderWidth: 2,
            },
            tooltip: {
              show: true,
            },
            data: [],
          }
      let series = this.xData.map((item,index)=>{
        let obj = {...objee}
        obj.name = item.title;
        obj.itemStyle = {...obj.itemStyle}
        obj.itemStyle.color = colorList[index]
        obj.data = item.curveValueList.map(item=>{
          return item.value
        })
        return obj
      })
      console.log('series',series)
      let option = {
        backgroundColor: "transparent",
        tooltip: {
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
          align: "left",
          right: "5%",
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

          data: legend,
        },
        grid: {
          top: "18%",
          left: "15%",
          right: "5%",
          bottom: "25%",
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
                color: "#fff",
                fontSize: 14,
              },
              formatter: function(data) {
                return data;
              },
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "#333",
                type:'dotted',
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
            name: "电量（kwh）",
            nameTextStyle: {
              color: "#fff",
              fontSize: 14,
              padding: 10,
            },
            min: 0,
            splitLine: {
              show: true,
              lineStyle: {
                type:'dotted',
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
                color: "#fff",
              },
              formatter: function(value) {
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
