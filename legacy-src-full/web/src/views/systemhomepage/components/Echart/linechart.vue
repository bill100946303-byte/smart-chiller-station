<template>
  <div id="linechart" />
</template>
<script>
import echarts from "echarts";

export default {
  props: ["id", "totalEnergyDataX", "totalEnergyDataY"],

  data() {
    return {
      charts: "",
    };
  },
  watch: {
    totalEnergyDataY: {
      deep: true,
      immediate: true,
      handler(val) {
        if (val) {
          this.$nextTick(() => {
            this.initChart("linechart");
          });
        }
      },
    },
  },

  methods: {
    getXdata() {
      return this.totalEnergyDataY.map((item) => {
        let obj = item.name;
        return obj;
      });
    },
    getYdata() {
      return this.totalEnergyDataY.map((item) => {
        let obj = item.value;
        return obj;
      });
    },
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id), "blue");
      let Xdata = this.getXdata();
      let Ydata = this.getYdata();
      this.charts.setOption({
        color: ["#13F4CD"],
        tooltip: {
          trigger: "axis",
        },
        grid: {
          top: "50",
          left: "52",
          right: "10",
          bottom: "20",
        },
        title: {
          // text: "当日能耗",
          left: "center",
          padding: [16, 0, 0, 0],
          // textStyle: {
          //   align: "center",
          //   color: "#00E4FF",
          //   fontWeight: "bold",
          //   fontSize: 16,
          // },
        },
        legend: {
          y: "bottom",
          itemGap: 30,
          itemWidth: 30,
          itemHeight: 10,
          textStyle: {
            fontSize: 13, //字体大小
            color: "#fff", //字体颜色
          },
        },
        calculable: true,

        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: Xdata,
            axisTick: {
              show: false,
            },

            axisLabel: {
              show: true,
              align: "left",
              textStyle: {
                color: "#fff",
              },
            },
            axisLine: {
              lineStyle: {
                color: "#1B65B2",
                width: 1,
              },
            },
          },
        ],
        yAxis: [
          {
            // name: this.$store.getters.unitSelete+"*h",
            name: "KW",
            nameTextStyle: {
              color: "#fff",
              fontSize: 16,
            },
            splitNumber: 2,
            type: "value",
            axisTick: {
              show: false,
            },
            splitLine: {
              lineStyle: {
                type: "dashed",
                color: "rgba(27, 101, 178, 1)",
                width: 1,
              },
            },
            axisLine: {
              lineStyle: {
                color: "#1B65B2",
                width: 1,
              },
            },
            scale: true,
            axisLabel: {
              show: true,
              textStyle: {
                color: "#fff",
              },
            },
          },
        ],
        series: [
          {
            symbolSize: 0, //折线点的大小
            smooth: true, //平滑曲线
            type: "line",
            data: Ydata,

            areaStyle: {
              normal: {
                //前四个参数代表位置 左下右上，暗青色到亮青色，
                color: new echarts.graphic.LinearGradient(
                  0,
                  0,
                  0,
                  1,
                  [
                    {
                      offset: 0,
                      color: "rgba(19, 244, 205, .6)",
                    },
                    {
                      offset: 0.6,
                      color: "rgba(19, 244, 205, 0.2)",
                    },
                    {
                      offset: 1,
                      color: "rgba(19, 244, 205,  0.01)",
                    },
                  ],
                  false
                ),
              },
            },

            lineStyle: {
              shadowColor: "#5cfbff", //透明的颜色
              shadowOffsetX: 0,
              shadowOffsetY: 0,
              opacity: 1, //透明度
              shadowBlur: 8, //阴影大小
              type: "solid", //实线
              width: 2,
            },
          },
        ],
      });
    },
  },
};
</script>
<style lang="scss" scoped>
#linechart {
  width: 100%;
  height: 100%;
}
</style>