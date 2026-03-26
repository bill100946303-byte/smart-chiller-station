<template>
  <div id="multiline"/>
</template>
<script>
import echarts from "echarts";

export default {
  props: ["xLabel", "xData", "title"],
  data() {
    return {
      charts: "",
      interceptTime: "",
    };
  },
  watch: {
    xData: {
      handler(val) {
        if (val.length) {
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
    // this.getCurrentTime();
  },
  methods: {
    initChart(id) {
      const colorList = [
        "rgba(47, 178, 247, 1)",
        "rgba(236, 82, 133, 1)",
        "rgba(42, 102, 240, 1)",
        "rgba(75, 215, 198, 1)",
        "rgba(255, 76, 137, 1)",
        "#9E87FF",
        "rgba(15, 241, 185, 1)",
      ];
      this.charts = echarts.init(document.getElementById("multiline"));
      let objee = {
        name: "",
        type: "line",
        // type: "scatter",
        symbol: "circle", // 默认是空心圆（中间是白色的），改成实心圆
        showAllSymbol: true,
        symbolSize: 0,
        smooth: true,
        lineStyle: {
          normal: {
            width: 1,
          },
          // borderColor: "rgba(0,0,0,.4)",
        },
        itemStyle: {
          // color: "rgba(25,163,223,1)",
          // borderColor: "#646ace",
          borderWidth: 2,
        },
        tooltip: {
          confine: true,
          show: true,
        },
        data: [],
      };
      let indexMap = {}; // 创建一个对象来存储索引
      let series = this.xData.map((item, index) => {
        // console.log(item)
        let obj = {...objee};
        // obj.name = this.xLabel[index];
        obj.name = item.name;
        // let seriesName = item.name;
        // if (indexMap[seriesName] === undefined) {
        //   indexMap[seriesName] = 1; // 如果名称尚未存在于索引映射中，则将其添加，并将索引设置为1
        // } else {
        //   indexMap[seriesName]++; // 如果名称已经存在于索引映射中，则递增索引
        //   seriesName += ' ' + indexMap[seriesName]; // 将索引添加到名称中
        // }
        // obj.name = seriesName;
        obj.itemStyle = {...obj.itemStyle};
        obj.itemStyle.color = colorList[index];
        obj.data = item.data.map((dataItem) => {
          return dataItem.value;
        });
        // console.log(obj)
        return obj;
      });
      let legend = this.xData.map(item => item.name);
      let xdata = this.xLabel
      console.log("series", series);
      console.log('xData', this.xLabel, legend)
      let option = {
        // title与legend重叠,将legend的top改为10%
        // title: [{
        //   text: '一周产品销量',
        //   left: 'center',
        //   textStyle: {
        //     color: '#f60',
        //     fontSize: 18,
        //     fontWeight: 'bold'
        //   }
        // }, {
        //   text: '三周产品销量',
        //   left: 'center',
        //   top: '5%',
        // }],
        title: this.title,
        backgroundColor: "transparent",
        tooltip: {
          confine: true,
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
          align: "auto",
          orient: 'vertical', // 垂直排列
          x: 'right', // 放置在右边
          // top: "10%",
          type: "scroll",
          pageIconColor: "white",
          pageIconInactiveColor: "#2f4554",
          textStyle: {
            // color: "#7ec7ff",
            color: 'auto',// 字体颜色跟图例颜色一样
            fontSize: 12,
          },
          // icon:'rect',
          itemGap: 10,
          itemWidth: 26,
          icon: "path://M0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z",
          data: legend,
        },
        grid: {
          top: "18%",
          left: "30",
          right: "5%",
          bottom: "30",
          containLabel: true,
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
              // interval: 0,
              show: true,
              // rotate: 45, // 将x轴标签旋转45度
              textStyle: {
                color: "#000",
                fontSize: 14,
              },
              align: "center",
              formatter: function (data) {
                return data;
              },
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "#333",
                width: 0.5,
                type: "dotted",
              },
            },
            axisTick: {
              show: false,
            },
            data: xdata,
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
            splitLine: {
              show: true,
              lineStyle: {
                type: "dotted",
                width: 0.5,
                color: "#333",
              },
            },
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
        series: series,
      };
      this.charts.setOption(option, true);
    },
  },
};
</script>
<style lang="scss" scoped>
#multiline {
  width: 100%;
  height: 100%;
}
</style>
