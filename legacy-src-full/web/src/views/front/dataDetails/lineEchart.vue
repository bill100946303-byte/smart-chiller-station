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
      interceptTime: "",
    };
  },
  watch: {
    xLabel: {
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
      let legend = this.xLabel;
      // console.log("legend", legend);
      let objee = {
        name: "",
        type: "line",
        symbol: "circle", // 默认是空心圆（中间是白色的），改成实心圆
        showAllSymbol: true,
        symbolSize: 0,
        smooth: true,
        lineStyle: {
          normal: {
            width: 1,
          },
          borderColor: "rgba(0,0,0,.4)",
        },
        itemStyle: {
          // color: "rgba(25,163,223,1)",
          borderColor: "#646ace",
          borderWidth: 2,
        },
        tooltip: {
          confine: true,
          show: true,
        },
        data: [],
      };

      let series = this.xData.map((item, index) => {
        let obj = {...objee};
        obj.name = this.xLabel[index];
        obj.itemStyle = {...obj.itemStyle};
        // obj.itemStyle.color = colorList[index];
        /*obj.data = item.map((item) => {
          return item.value;
        });*/
        obj.data = item.map((item) => {
          return {value: item.value, unit: item.unit};
        });
        return obj;
      });
      console.log("series", series);

      let xdata =
          this.xData[0].map((item, index) => {
            // console.log(item.name);
            return item.name;
          }) || [];
      let option = {
        backgroundColor: "transparent",
        tooltip: {
          confine: true,
          trigger: "axis",
          backgroundColor: "transparent",
          textStyle: {
            color: '#000'
          },
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
          formatter: function (item) {
            let data = '';
            // console.log(item)
            data += '<br/>' + item[0].axisValueLabel
            for (const res of item) {
              // console.log(res)
              data += '<br/>' + res.marker + res.seriesName + '：' + res.value + res.data.unit
            }
            return data
          }
        },
        legend: {
          align: "auto",
          top: "1%",
          type: "scroll",
          pageIconColor: "white",
          pageIconInactiveColor: "#2f4554",
          textStyle: {
            color: "#7ec7ff",
            fontSize: 16,
          },
          // icon:'rect',
          itemGap: 25,
          itemWidth: 18,
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
        toolbox: {
          top: 38,
          show: true,
          feature: {
            dataView: {
              show: true,
              readOnly: false,
              optionToContent(opt) {
                let axisData = opt.xAxis[0].data; //坐标轴
                let series = opt.series; //折线图的数据
                let tdHeads =
                    '<td  style="margin-top:10px; padding: 10px 15px"></td>'; //表头
                let tdBodys = "";
                series.forEach(function (item) {
                  tdHeads += `<td style="padding:5px 15px">${item.name}</td>`;
                });
                let table = `<table border="1" style="width:90%;   margin-left:20px;border-collapse:collapse;font-size:14px;text-align:center" id="table-content"><tbody><tr>${tdHeads} </tr>`;
                for (let i = 0, l = axisData.length; i < l; i++) {
                  for (let j = 0; j < series.length; j++) {
                    if (series[j].data[i] == undefined) {
                      tdBodys += `<td>${"-"}</td>`;
                    } else {
                      tdBodys += `<td>${series[j].data[i].value + series[j].data[i].unit}</td>`;
                    }
                  }
                  table += `<tr><td style="padding: 15px 20px">${axisData[i]}</td>${tdBodys}</tr>`;
                  tdBodys = "";
                }
                table += "</tbody></table>";
                return table;
              }
            },// 数据是否可编辑，{是否显示该工具，是否可编辑}
            magicType: {show: true, type: ["bar", "line"]},// 动态类型切换，切换为折线图还是柱状图
            restore: {show: true}, // 配置项还原
            saveAsImage: {show: true}, // 保存为图片
          },
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
                color: "#000",
                fontSize: 14,
              },
              align: "left",
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
                color: "#333",
                width: 0.5,
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
        series: series,
      };
      this.charts.setOption(option, true);
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
