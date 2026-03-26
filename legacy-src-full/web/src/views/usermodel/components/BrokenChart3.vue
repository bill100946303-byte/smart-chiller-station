<template>
  <div id="BrokenChart" ref="BrokenChart"></div>
</template>
<script>
import echarts from "echarts";
// import 'echarts-liquidfill'

export default {
  props: ["BrokenChart"],
  data() {
    return {
      charts: "",
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart("BrokenChart");
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(this.$refs.BrokenChart);

      this.charts.setOption({
        // backgroundColor: "#e2f5e2",
        // tooltip: {
        //   trigger: "axis",
        //   axisPointer: {
        //     type: "shadow",
        //   },
        // },
        legend: {
          //   data: ["接入率", "在线率", "完好率"],
          align: "right",
          right: 10,
          textStyle: {
            color: "var(--theme-color)",
          },
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 35,
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
        },
        xAxis: [
          {
            type: "category",
            data: [
              "12.3",
              "01:00",
              "02:00",
              "03:00",
              "04:00",
              "05:00",
              "06:00",
              "07:00",
              "08:00",
              "09:00 ",
              "10:00 ",
              "11:00 ",
              "12:00 ",
              "13:00 ",
              "14:00 ",
              "15:00 ",
              "16:00 ",
            ],
            axisLine: {
              show: true,
              lineStyle: {
                color: "#063374",
                width: 1,
                type: "solid",
              },
            },
            axisTick: {
              show: false,
            },
            axisLabel: {
              show: true,
              textStyle: {
                color: "#9c9c9c",
              },
            },
          },
        ],
        yAxis: [
          {
            type: "value",
            max: 800,
            axisLabel: {
              formatter: "{value}",
            },
            axisTick: {
              show: false,
            },
            axisLine: {
              show: false,
              lineStyle: {
                color: "#9c9c9c",
                width: 1,
                type: "solid",
              },
            },
            splitLine: {
              lineStyle: {
                color: "#9c9c9c",
              },
            },
          },
        ],
        series: [
          {
            name: "",
            type: "bar",
            data: [
              665,
              456,
              689,
              699,
              388,
              444,
              433,
              611,
              399,
              522,
              388,
              244,
              266,
              398,
              566,
              655,
              333,
            ],
            barWidth: 10, //柱子宽度
            barGap: 1, //柱子之间间距
            itemStyle: {
              normal: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: "#1dbd9d",
                  },
                  {
                    offset: 1,
                    color: "#1dbd9d",
                  },
                ]),
                opacity: 1,
              },
            },
          },
          {
            name: "",
            type: "bar",
            data: [
              350,
              290,
              496,
              596,
              596,
              390,
              692,
              495,
              596,
              396,
              490,
              390,
              590,
              690,
              590,
              393,
              294,
            ],
            barWidth: 10,
            barGap: 1,
            itemStyle: {
              normal: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: "#1dbd9d",
                  },
                  {
                    offset: 1,
                    color: "#1dbd9d",
                  },
                ]),
                opacity: 1,
              },
            },
          },
          {
            name: "",
            type: "bar",
            data: [
             500,
              466,
              399,
              333,
              555,
              444,
              366,
              235,
              546,
              366,
              599,
              499,
              299,
              199,
              346,
              500,
              299,
            ],
            barWidth: 10,
            barGap: 1,
            itemStyle: {
              normal: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: "#1dbd9d",
                  },
                  {
                    offset: 1,
                    color: "#1dbd9d",
                  },
                ]),
                opacity: 1,
              },
            },
          },

          {
            name: "",
            type: "bar",
            data: [
              400,
              500,
              655,
              562,
              364,
              300,
              430,
              565,
              136,
              266,
              359,
              456,
              650,
              420,
              345,
              403,
              388,
            ],
            barWidth: 10,
            barGap: 1,
            itemStyle: {
              normal: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: "#1dbd9d",
                  },
                  {
                    offset: 1,
                    color: "#1dbd9d",
                  },
                ]),
                opacity: 1,
              },
            },
          },
        ],
      });
    },
  },
};
</script>
