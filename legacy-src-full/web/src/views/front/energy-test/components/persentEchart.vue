<template>
  <div class="chart-wrap">
    <div id="energyid"/>
    <!--   <div class="desc">注:上行为比例区间,中 下行为冷量区间，冷量单位分别为为KWH RTH</div>-->
    <div class="desc">{{ $t('proportion.Remarks') }}</div>
  </div>

</template>
<script>
import echarts from "echarts";

export default {
  data() {
    return {
      charts: "",
    };
  },
  props: ["info", "status"],
  watch: {
    info: {
      handler(val) {
        // if (val && val.length) {
        this.$nextTick(() => {
          console.log(val, this.status)
          this.initChart("energyid");
          if (this.status === 20000) {
            this.charts.hideLoading() //关闭loading状态
          } else {
            this.charts.showLoading({
              text: '加载中',//加载时候的文本
              // fontSize: 16,
              textColor: '#f5f3f3',//加载时候文本颜色
              color: '',//加载时候小圆圈的颜色
              maskColor: 'rgba(5,10,16,0.8)',//加载时候的背景颜色
            }) //开启loading状态
          }
        });
      },
      immediate: true,
      deep: true,
    },
    status: {
      handler(val) {
        // if (val && val.length) {
        //   console.log(val,this.status)
        // if (val.length){
        //   this.charts.hideLoading() //关闭loading状态
        // }else {
        //   this.charts.showLoading({
        //     text:'加载中',//加载时候的文本
        //     // fontSize: 16,
        //     textColor: '#f5f3f3',//加载时候文本颜色
        //     color: '',//加载时候小圆圈的颜色
        //     maskColor: 'rgba(6,41,83,0.8)',//加载时候的背景颜色
        //   }) //开启loading状态
        // }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    getxAxisData() {
      return this.info.map((item) => {
        return item["负荷区间"];
      });
    },
    getpercentData() {
      return this.info.map((item) => {
        return item["负荷比重比例"];
      });
    },
    getenergy() {
      return this.info.map((item) => {
        return item["冷站效能"];
      });
    },
    initChart(id) {
      let xtitle = this.getxAxisData();
      let percentData = this.getpercentData();
      let energyData = this.getenergy();
      let that = this
      this.charts = echarts.init(document.getElementById(id), "blue");
      var option = {
        // backgroundColor: "#011123",
        backgroundColor: "transparent",
        grid: {
          top: 96,
          left: "24",
          right: "2%",
          bottom: "8%",
          containLabel: true,
        },
        legend: {
          top: 14,
          show: true,
          textStyle: {
            color: "rgba(171, 205, 225, 0.76)",
          },
          itemGap: 50,
          itemWidth: 25,
          itemHeight: 5,
          data: [
            {
              // name: "负荷比例",
              name: this.$t('proportion.loadRatio'),
              icon: "rect",
            },
            {
              // name: "冷站能效",
              name: this.$t('proportion.coldstation'),
              icon: "rect",
              itemStyle: {
                color: "#0FF1B9",
              },
            },
          ],
        },
        tooltip: {
          show: true,
          trigger: 'axis',  // 鼠标经过时触发，支持 axis 和 item
          backgroundColor: "rgba(7, 18, 29, 0.95)",
          textStyle: {
            color: "rgba(245, 251, 255, 0.96)",
          },
          // backgroundColor: "transparent",
          // axisPointer: {
          //   lineStyle: {
          //     color: {
          //       type: "linear",
          //       x: 0,
          //       y: 0,
          //       x2: 0,
          //       y2: 1,
          //       colorStops: [
          //         {
          //           offset: 0,
          //           color: "rgba(126,199,255,0)", // 0% 处的颜色
          //         },
          //         {
          //           offset: 0.5,
          //           color: "rgba(126,199,255,1)", // 100% 处的颜色
          //         },
          //         {
          //           offset: 1,
          //           color: "rgba(126,199,255,0)", // 100% 处的颜色
          //         },
          //       ],
          //       global: false, // 缺省为 false
          //     },
          //   },
          // },
          axisPointer: {
            type: 'shadow',  // 使用阴影指示器
          },
          formatter: function (params) {
            let result = params[0].axisValue + '<br>';  // 显示当前的 X 轴数据
            // console.log(params)
            params.forEach(item => {
              // if (item.seriesName)
              result += item.marker + ' ' + item.seriesName + ': ' + item.value +
                  (item.seriesName === that.$t('proportion.loadRatio') ? '   %' : "   KW" + '/' + that.$store.getters.unitSelete) + '<br>';
            });
            return result;
          }
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
                    '<td  style="margin-top:10px; padding: 10px 15px">比例</td>'; //表头
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
                      tdBodys += `<td>${series[j].data[i]}</td>`;
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
        xAxis: {
          data: xtitle,
          axisLine: {
            lineStyle: {
              color: "#3d5269",
            },
          },
          axisTick: {
            show: false,
          },
          axisLabel: {
            color: "rgba(193, 215, 229, 0.76)",
            fontSize: 14,
            formatter: function (value, index) {
              let arr = value.split(',')
              let str = arr.reduce((pre, next) => {
                return pre + "\n" + next
              })
              return str
            },
          },
        },
        yAxis: [
          {
            type: "value",
            // name: "负荷比例（%）",
            name: this.$t('proportion.loadRatio') + "（%）",
            nameTextStyle: {
              padding: [0, -120, 40, 0],
              color: "rgba(245, 251, 255, 0.92)",
              fontSize: 14,
            },
            axisLine: {
              show: true,
              lineStyle: {
                color: "rgba(125, 202, 255, 0.18)",
              },
            },
            axisTick: {
              show: false,
            },
            axisLabel: {
              color: "rgba(193, 215, 229, 0.76)",
              fontSize: 14,
            },
            splitLine: {
              show: false,
              lineStyle: {
                color: "#2d3d53",
              },
            },
            yAxisIndex: 0,
          },
          {
            type: "value",
            // name: "冷站能效（"+this.$store.getters.unitSelete+'/'+this.$store.getters.unitSelete+"）",
            // name: this.$t('proportion.coldstation') + "（" + this.$store.getters.unitSelete + '/' + this.$store.getters.unitSelete + "）",
            name: this.$t('proportion.coldstation') + "（KW" + '/' + this.$store.getters.unitSelete + "）",
            nameTextStyle: {
              padding: [0, 120, 40, 0],
              color: "#000",
              fontSize: 14,
            },
            axisLine: {
              show: true,
              lineStyle: {
                color: "#5E5E5E",
              },
            },
            axisLabel: {
              show: true,
              color: "#000",
              fontSize: 14,
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
              lineStyle: {
                color: "#2d3d53",
              },
            },
          },
        ],
        series: [
          {
            // name: "负荷比例",
            name: this.$t('proportion.loadRatio'),
            type: "bar",
            barWidth: 80,// 调整柱状图的宽度
            zlevel: 2,
            itemStyle: {
              color: "#2FB2F7",
            },
            label: {
              normal: {
                show: false,
                fontSize: 18,
                fontWeight: "bold",
                color: "rgba(245, 251, 255, 0.96)",
                position: "top",
              },
            },
            data: percentData,
          },
          {
            // name: "冷站能效",
            name: this.$t('proportion.coldstation'),
            type: "line",
            showAllSymbol: true,
            symbol: "circle",
            barWidth: 20,
            yAxisIndex: 1,
            symbolSize: 6,
            zlevel: 1,
            itemStyle: {
              color: "#0FF1B9",
            },
            lineStyle: {
              normal: {
                color: "#0FF1B9",
              },
            },
            data: energyData,
          },
        ],
      };

      this.charts.setOption(option);
    },
  },
};
</script>
<style lang="scss" scoped>
.chart-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

#energyid {
  width: 100%;
  height: 100%;
}

.desc {
  position: absolute;
  font-size: 14px;
  color: rgba(171, 205, 225, 0.72);
  bottom: 8px;
  left: 20px;
}
</style>
