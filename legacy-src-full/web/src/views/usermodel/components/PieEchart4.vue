<template>
  <div id="PieEChart" ref="PieEChart"></div>
</template>
<script>
import echarts from "echarts";
// import 'echarts-liquidfill'

export default {
  props: ["PieEChart"],
  data() {
    return {
      charts: "",
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart("PieEChart");
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(this.$refs.PieEChart);
      var getname = ["一号电房", "二号电房"];
      var getvalue = [400, 600];
      var data = [];
      for (var i = 0; i < getname.length; i++) {
        data.push({
          name: getname[i],
          value: getvalue[i],
        });
      }
      var colorList = ["#1abb98", "#8ba7a5"];
      var rich = {
        name: {
          color: "#8ba7a5",
          fontSize: 14,
          padding: [0, 0, 0, 10],
          fontWeight: "300",
          align: "left",
        },
        value: {
          color: "#8ba7a5",
          fontSize: 15,
          padding: [0, 0, 0, 10],
          fontWeight: "300",
          align: "right",
        },
        percent: {
          color: "var(--theme-color)",
          align: "right",
          fontSize: 15,
          fontWeight: "300",
          //padding: [0, 5]
        },
        hr: {
          width: "100%",
          height: 0,
        },
        cir: {
          fontSize: 10,
        },
      };
      this.charts.setOption({
        // backgroundColor: '#0A1934',
        tooltip: {
          trigger: "axis",
        },
        series: [
          {
            tooltip: {
              trigger: "item",
              formatter: function (params) {
                return (
                  params.name +
                  "：" +
                  params.value +
                  "kw<br>占比：" +
                  params.percent.toFixed(2) +
                  "%"
                );
              },
            },
            itemStyle: {
              normal: {
                // borderColor: "#0A1934",
                // borderWidth: 5,
                color: function (params) {
                  return colorList[params.dataIndex];
                },
              },
            },
            type: "pie",
            radius: ["30%", "50%"],
            center: ["50%", "50%"],
            label: {
              normal: {
                show: false,
                position: "inner",
                formatter: (params) => {
                  return "{percent|" + params.percent.toFixed(0) + "%}";
                },
                rich: rich,
              },
            },
            data: data,
          },
          {
            itemStyle: {
              normal: {
                // borderColor: "#0A1934",
                // borderWidth: 5,
                color: function (params) {
                  return colorList[params.dataIndex];
                },
              },
            },
            type: "pie",
            silent: true, //取消高亮
            radius: ["30%", "50%"],
            center: ["50%", "50%"],
            labelLine: {
              normal: {
                length: 30,
                length2: 0,
                lineStyle: {
                  color: "transparent",
                },
              },
            },
            label: {
              normal: {
                formatter: (params) => {
                  return (
                    "{name|" +
                    params.name +
                    "}{value|" +
                    params.value +
                    "}\n{hr|————————}"
                  );
                },
                rich: rich,
                padding: [-20, 25, 0, 25],
              },
            },
            data: data,
            z: -1,
          },
          {
            itemStyle: {
              normal: {
                // borderColor: "#0A1934",
                // borderWidth: 5,
                color: function (params) {
                  return colorList[params.dataIndex];
                },
              },
            },
            type: "pie",
            silent: true, //取消高亮
            radius: ["30%", "50%"],
            center: ["50%", "50%"],
            labelLine: {
              normal: {
                length: 30,
                length2: 0,
                lineStyle: {
                  color: "transparent",
                },
              },
            },
            label: {
              normal: {
                formatter: (params) => {
                  return "\n{cir|●}\n";
                },
                rich: rich,
              },
            },
            data: data,
            z: -1,
          },
        ],
      });
    },
  },
};
</script>