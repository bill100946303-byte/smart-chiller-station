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
              99,
              222,
              555,
              222,
              333,
              555,
              444,
              666,
              333,
              444,
              333,
              399,
              255,
              422,
              566,
              200,
              544,
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
              600,
              236,
              560,
              360,
              200,
              598,
              654,
              699,
              399,
              299,
              577,
              755,
              477,
              233,
              388,
              333,
              444,
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
              300,
              588,
              580,
              336,
              459,
              200,
              162,
              265,
              536,
              664,
              744,
              356,
              550,
              120,
              560,
              303,
              404,
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
              300,
              400,
              355,
              562,
              464,
              600,
              630,
              265,
              636,
              466,
              359,
              556,
              250,
              320,
              245,
              203,
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
