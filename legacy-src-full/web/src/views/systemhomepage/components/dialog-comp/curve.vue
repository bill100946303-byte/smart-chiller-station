<template>
  <div id="lineright">
  </div>
</template>

<script>
import echarts from "echarts";

export default {
  name: "curve",
  props: ["xData", "regUnits", "curveTitle", "alarmValue"],
  data() {
    return {
      charts: "",
    };
  },
  watch: {
    xData: {
      handler(val) {
        this.$nextTick(() => {
          this.initChart(this.id);
        });
      },
      deep: true,
      immediate: true,
    },
  },
  mounted() {
    this.initChart()
  },
  methods: {
    initChart(v) {
      this.charts = echarts.init(document.getElementById('lineright'));
      let xLabel = this.xData.map(item => {
        return item.name
      })
      console.log('curveTitle', this.curveTitle)
      let values = this.xData.map((item, index) => {
        return item.value
      })
      console.log('alarmValue', this.alarmValue)
      let markLine = null;
      if (this.alarmValue) {
        markLine = {
          symbol: "none",
          data: [
            {
              name: "高高报的水平线",
              yAxis: this.alarmValue.hhValue,
              label: {
                formatter: '高高报值：{c}',
                show: true,
              },
              silent: false,
              lineStyle: {
                color: '#ff4c89'
              },
            },
            {
              name: "高报的水平线",
              yAxis: this.alarmValue.hvalue,
              lineStyle: {
                color: '#ff4c89'
              },
              label: {
                formatter: '高报值：{c}',
                show: true,
              },
            },
            {
              name: "低报的水平线",
              yAxis: this.alarmValue.lvalue,
              lineStyle: {
                color: '#ff4c89'
              },
              label: {
                formatter: '低报值：{c}',
                show: true,
              },
            },
            {
              name: "低低报的水平线",
              yAxis: this.alarmValue.llValue,
              lineStyle: {
                color: '#ff4c89'
              },
              label: {
                formatter: '低低报值：{c}',
                show: true,
              },
            }
          ]
        }
      }
      console.log('markLine', markLine)
      // console.log(this.regUnits)
      // console.log(values)
      let option = {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          textStyle: {
            color: '#000'
          },
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

          data: 'eee',
        },
        grid: {
          top: "25",
          left: "80",
          right: "100",
          bottom: "24",
        },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            axisLine: {
              //坐标轴轴线相关设置。数学上的x轴
              show: true,
              lineStyle: {
                color: "#fff",
              },
            },
            axisLabel: {
              //坐标轴刻度标签的相关设置
              textStyle: {
                color: "#000",
                fontSize: 14,
              },
              formatter: function (data) {
                return data;
              },
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
            data: xLabel,
          },
        ],
        yAxis: [
          {
            // scale:true,
            // type: 'value',
            name: this.$t('public.unit') + "：" + (this.regUnits == null ? '' : this.regUnits),
            nameTextStyle: {
              color: "#000",
              fontSize: 12,
              padding: 10,
            },
            nameRotate: '0.1',
            // min: 'datamin',
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dotted',
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
        series: [{
          // name: "1111",
          name: this.curveTitle,
          type: "line",
          symbol: "circle", // 默认是空心圆（中间是白色的），改成实心圆
          showAllSymbol: true,
          symbolSize: 2,
          smooth: true,
          lineStyle: {
            normal: {
              width: 1,
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
          data: values,
          markLine,
        }]
        // series: [{
        //   type: "line",
        //   smooth:true,
        //   data: values,
        // }]
      };
      this.charts.setOption(option);
    }
  }
}
</script>

<style lang="scss" scoped>
#lineright {
  //width: 616px;
  width: 100%;
  height: 80%;
}
</style>