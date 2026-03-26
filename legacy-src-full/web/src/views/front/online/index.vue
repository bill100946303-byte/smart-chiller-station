<template>
  <div v-if="xData" class="onlineBox">
    <div id="multiline">
    </div>
    <div class="title">{{ logo.applogotext }}{{ title ? title : '' }}</div>
  </div>
  <div v-else class="onlineBox">
    <el-empty :description="logo.applogotext+'暂无数据'" :image='require("@/assets/401_images/401.gif")'
              :image-size="400"></el-empty>
  </div>
</template>

<script>
import echarts from "echarts";
import {mapGetters} from "vuex";
import {monitor} from "@/api/front/runrecords";

export default {
  name: "curve",
  computed: {
    ...mapGetters(["path", "logo"])
  },
  data() {
    return {
      charts: "",
      xData: [],
      title: '',
      unit: '',
    };
  },
  created() {

  },
  mounted() {
    console.log(this.path)
    console.log(this.logo)
    monitor(this.path).then((res) => {
      this.title = res.data.title
      this.unit = res.data.unit
      this.xData = res.data.curveValueList
      console.log(this.xData)
      if (this.xData)
        this.initChart()
    })
  },
  methods: {
    initChart(v) {
      this.charts = echarts.init(document.getElementById('multiline'));
      let xLabel = this.xData.map(item => {
        return item.name
      })
      let values = this.xData.map((item, index) => {
        return item.value
      })

      console.log(xLabel)
      console.log(values)
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
          data: 'eee',
        },
        grid: {
          top: "25",
          left: "80",
          right: "24",
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
                color: "#fff",
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
            name: "单位：" + this.unit,
            nameTextStyle: {
              color: "#fff",
              fontSize: 14,
              padding: 10,
            },
            nameRotate: '0.1',
            min: 0,
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dotted',
                color: "#333",
              },
            },
            axisLabel: {
              show: true,
              textStyle: {
                color: "#fff",
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
          name: this.title,
          type: "line",
          symbol: "circle",
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
            show: true,
          },
          data: values,
        }]

      };
      this.charts.setOption(option);
    }
  }
}
</script>
<style lang="scss" scoped>
#multiline {
  padding: 20px;
  width: 100%;
  height: 90%;
}

.onlineBox {
  width: 100%;
  height: 100vh;
  background-color: rgba(1, 17, 35, 1);

  .title {
    color: #fff;
    text-align: center;
  }
}

::v-deep .el-empty__description {
  p {
    //color: red; /* 修改文字颜色为红色 */
    font-size: 20px; /* 修改文字大小为16像素 */
  }
}
</style>