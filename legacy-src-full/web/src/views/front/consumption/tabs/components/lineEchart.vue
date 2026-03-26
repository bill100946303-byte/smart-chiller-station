<template>
  <div class="linechart" :id="id" />
</template>
<script>
import echarts from "echarts";

export default {
  props: ["id", "xData", "xLabel"],

  data() {
    return {
      charts: "",
    };
  },
  watch: {
    xLabel: {
      deep: true,
      immediate: true,
      handler(val) {
        if (val.length > 0) {
          this.$nextTick(() => {
            this.initChart(this.id);
          });
        }
      },
    },
  },

  methods: {
    initChart(id) {
      console.log('this.xData[0].curveValueList',this.xData[0].curveValueList)
      const obb = [
        {
          symbol: "circle",
          symbolSize: 0, //折线点的大小
          smooth: true, //平滑曲线
          type: "line",
          data: this.xData[0].curveValueList.map((item) => {
            return item.value;
          }),
          // areaStyle: {
          //   normal: {
          //     color: "rgba(47, 178, 247, 1)",
          //   },
          // },
          markLine: {
            symbol:"none",   
            data: [
              {
                name: "Y 轴值为 5 的水平线",
                yAxis: 5,
                label: {
                  position:'end',
                  show: false,
                },
                silent:false,
                lineStyle:{
                  
                  color:'#ff4c89'
                },
              },
              {
                name: "Y 轴值为 -5 的水平线",
                yAxis: -5,
               
                lineStyle:{
                  color:'#ff4c89'
                },
                label: {
                  show: false,
                },
              },
            ],
          },
        },
      ];

      this.charts = echarts.init(document.getElementById(id), "blue");
      this.charts.setOption({
        color: ["#0E9CFF"],
        tooltip: {
          trigger: "axis",
        },
        grid: {
          top: "16",
          left: "27",
          right: "10",
          bottom: "20",
        },
        title: {
          // text: "当日能耗",
          left: "center",
          padding: [16, 0, 0, 0],
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
            data: this.xLabel,
            axisTick: {
              show: false,
            },
            axisLabel: {
              show: true,
              align: "right",
              textStyle: {
                // color: "#fff",
                color: "#000",
              },
              // interval: 23,
            },
            axisLine: {
              show: true,
              lineStyle: {
                color: "rgba(94, 94, 94, 1)",
                width: 1,
              },
            },
          },
        ],
        yAxis: [
          {
            max: 15,
            min: -15,
            splitNumber: 5,
            type: "value",
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
              // lineStyle: {
              //   type: "dashed",
              //   color: "#181B24",
              //   width: 1,
              // },
              interval: (index, value) => {
                console.log(111, index, value);
              },
            },

            axisLabel: {
              show: true,
              textStyle: {
                color: "#000",
              },
            },
            axisLine: {
              lineStyle: {
                color: "rgba(94, 94, 94, 1)",
                width: 1,
              },
            },
          },
        ],
        series: obb,
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.linechart {
  width: 100%;
  height: 100%;
}
</style>