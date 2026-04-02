<template>
  <div ref="multiline" class="line-echart" />
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
            console.log(78787);
            this.initChart();
          });
        }
      },
      immediate: true,
      deep: true,
    },
  },
  mounted() {
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
    if (this.charts) {
      this.charts.dispose();
      this.charts = null;
    }
  },
  methods: {
    handleResize() {
      if (this.charts) {
        this.charts.resize();
      }
    },
    // getCurrentTime() {
    //   //获取当前时间并打印
    //   var _this = this;
    //   let yy = new Date().getFullYear();
    //   let mm = new Date().getMonth() + 1;
    //   let dd = new Date().getDate();
    //   let hh = new Date().getHours();
    //   let mf =
    //     new Date().getMinutes() < 10
    //       ? "0" + new Date().getMinutes()
    //       : new Date().getMinutes();
    //   let ss =
    //     new Date().getSeconds() < 10
    //       ? "0" + new Date().getSeconds()
    //       : new Date().getSeconds();
    //   _this.gettime = mm + "-" + dd + " " + hh + ":" + mf;
    //   this.interceptTime = _this.gettime;
    //   console.log(this.interceptTime);
    // },
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
      if (this.charts) {
        this.charts.dispose();
      }
      this.charts = echarts.init(this.$refs.multiline);
      let legend = this.xLabel;
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
          color: "rgba(25,163,223,1)",
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
        let obj = { ...objee };
        obj.name = this.xLabel[index];
        obj.itemStyle = { ...obj.itemStyle };
        obj.itemStyle.color = colorList[index];
        obj.data = item.map((item) => {
          return item.value;
        });
        return obj;
      });
      let xdata =
        this.xData[0].map((item, index) => {
          return item.name;
        }) || [];
      let option = {
        backgroundColor: "transparent",
        tooltip: {
          confine: true,
          trigger: "axis",
          backgroundColor: "rgba(10, 22, 36, 0.94)",
          borderColor: "rgba(120, 196, 255, 0.26)",
          borderWidth: 1,
          padding: [10, 14],
          extraCssText:
            "color: rgba(239, 247, 255, 0.96); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);",
          textStyle: {
            color: "rgba(239, 247, 255, 0.96)",
            fontSize: 14,
          },
          formatter: params => {
            const getNumericValue = item => {
              const rawValue = item && item.value;
              const candidate = Array.isArray(rawValue)
                ? rawValue[rawValue.length - 1]
                : rawValue;
              const numeric = Number(candidate);
              return Number.isFinite(numeric) ? numeric : null;
            };
            const rows = (params || []).filter(item => {
              const numeric = getNumericValue(item);
              return numeric !== null && Math.abs(numeric) > 1e-6;
            });
            const title = params && params.length ? params[0].axisValueLabel || params[0].name || "" : "";
            if (!rows.length) {
              return `<div style="color: rgba(239, 247, 255, 0.96); font-weight: 600;">${title}</div>`;
            }
            const items = rows
              .map(item => {
                const numeric = getNumericValue(item);
                return `<div style="color: rgba(239, 247, 255, 0.96); line-height: 1.7;">${item.marker || ""}<span style="color: rgba(239, 247, 255, 0.96);">${item.seriesName}: ${numeric}</span></div>`;
              })
              .join("<br/>");
            return `<div style="color: rgba(239, 247, 255, 0.96);">
              <div style="color: rgba(239, 247, 255, 0.96); font-weight: 600; margin-bottom: 6px;">${title}</div>
              ${items}
            </div>`;
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
              width: 1.5,
            },
            label: {
              show: true,
              backgroundColor: "rgba(13, 31, 48, 0.96)",
              borderColor: "rgba(126,199,255,0.26)",
              borderWidth: 1,
              color: "rgba(239, 247, 255, 0.96)",
            }
          },
        },
        legend: {
          align: "auto",
          top: "1%",
          type: "scroll",
          // pageIconColor: "white",
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
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            axisLine: {
              //坐标轴轴线相关设置。数学上的x轴
              show: true,
              lineStyle: {
                color: "rgba(150, 192, 225, 0.2)",
              },
            },
            axisLabel: {
              //坐标轴刻度标签的相关设置
              textStyle: {
                color: "rgba(204, 224, 243, 0.76)",
                fontSize: 13,
              },
              align: "left",
              formatter: function (data) {
                return data;
              },
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "rgba(150, 192, 225, 0.12)",
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
              color: "rgba(214, 232, 247, 0.92)",
              fontSize: 14,
              padding: 10,
            },
            min: 0,
            splitLine: {
              show: true,
              lineStyle: {
                type: "dotted",
                width: 0.5,
                color: "rgba(150, 192, 225, 0.12)",
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
                color: "rgba(204, 224, 243, 0.76)",
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
.line-echart {
  width: 100%;
  height: 100%;
}
</style>
