<template>
  <div :id="id" class="energy-pie-chart" />
</template>
<script>
import echarts from "echarts";

export default {
  props: ["id", "echartdata"],

  data() {
    return {
      charts: "",
    };
  },
  mounted() {},
  watch: {
    echartdata: {
      handler(val) {
        if (val && Object.keys(val).length > 0) {
          this.$nextTick(() => {
            this.initChart(this.id);
          });
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    initChart(id) {
      // let bgColor = "#fff";
      let title = "总量";
      let color = [
        "rgba(15, 241, 185, 1)",
        "rgba(15, 227, 241, 1)",
        // "rgba(42, 102, 240, 1)",
        "#2292f0",
        "#99ffff",
        "#00FFFF",
        "#4AEAB0",
      ];
      let totalnum = Object.values(this.echartdata).reduce((pre, next) => {
        return pre + parseInt(next);
      }, 0);
      let arr = Object.keys(this.echartdata).reduce((pre, next) => {
        let obj = {
          name: next,
          value: this.echartdata[next].split(",").join(""),
        };
        pre.push(obj);
        return pre;
      }, []);
      // console.log('arr000000',arr);
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(7, 18, 29, 0.95)",
          textStyle: {
            color: "rgba(245, 251, 255, 0.96)",
          },
          formatter: "{b}: {c}kwh ({d}%)",
          // formatter: (params) => {
          //   return (
          //     params.data.name + ":" + params.data.value + "kwh"
          //   );
          // },
        },
        // backgroundColor: bgColor,
        color: color,
        grid: {
          top: 20,
          containLabel: true,
        },

        series: [
          {
            type: "pie",
            radius: ["45%", "60%"],
            center: ["50%", "50%"],
            data: arr,
            hoverAnimation: false,
            itemStyle: {
              normal: {
                // borderColor: bgColor,
                borderWidth: 2,
              },
            },
            labelLine: {
              normal: {
                length: 10,
                length2: 30,
                // lineStyle: {
                //   color: "#f66",
                // },
              },
            },
            label: {
              normal: {
                formatter: (params) => {
                  // return "{name|" + params.name + "}"+"\n"+"  "+params.value+this.$store.getters.unitSelete+'*h';
                  return "{name|" + params.name + "}" + "\n" + "  " + params.value + 'KW*h' + `({percent|${params.percent}%})`;
                },
                padding: [24, 0, 25, 0],
                rich: {
                  icon: {
                    fontSize: 16,
                  },
                  name: {
                    fontSize: 14,
                    padding: [0, 10, 0, 4],
                    color: "rgba(245, 251, 255, 0.96)",
                  },
                  value: {
                    fontSize: 14,
                    fontWeight: "bold",
                    color: "rgba(245, 251, 255, 0.96)",
                  },
                  percent: {
                    fontSize: 12,
                    color: "rgba(171, 205, 225, 0.72)",
                  },
                },
              },
            },
          },
        ],
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.energy-pie-chart {
  width: 100%;
  height: 100%;
}
</style>
