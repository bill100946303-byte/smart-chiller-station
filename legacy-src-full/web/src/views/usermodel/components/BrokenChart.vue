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
              200,
              400,
              600,
              630,
              300,
              400,
              463,
              665,
              336,
              546,
              300,
              256,
              150,
              520,
              460,
              103,
              304,
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
              400,
              200,
              486,
              516,
              596,
              300,
              652,
              465,
              536,
              366,
              480,
              350,
              550,
              620,
              560,
              303,
              204,
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
              200,
              488,
              380,
              236,
              259,
              200,
              362,
              365,
              436,
              264,
              344,
              556,
              350,
              520,
              360,
              503,
              504,
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
