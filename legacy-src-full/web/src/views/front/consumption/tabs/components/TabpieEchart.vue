<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";

export default {
  props: ["id","lindata"],

  data() {
    return {
      charts: "",
    };
  },
  watch: {
    lindata: {
      handler(val) {
        if(Object.keys(val).length){
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
        "rgba(42, 102, 240, 1)",
        "#F8456B",
        "#00FFFF",
        "#4AEAB0",
      ];
      let echartData = Object.keys(this.lindata).map(item=>{
        return {
          name:item,
          value:this.lindata[item]
        }
      })

      let formatNumber = function (num) {
        let reg = /(?=(\B)(\d{3})+$)/g;
        return num.toString().replace(reg, ",");
      };
      let total = echartData.reduce((a, b) => {
        return a + b.value * 1;
      }, 0);
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        // backgroundColor: bgColor,
        color: color,
        // tooltip: {
        //     trigger: 'item'
        // },
        title: [
          {
            text:
              "{name|" +
              title +
              "}\n{val|" +
              formatNumber(total) +
              "万KWH" +
              "}",
            top: "center",
            left: "center",
            textStyle: {
              rich: {
                name: {
                  fontSize: 14,
                  fontWeight: "normal",
                  color: "#fff",
                  padding: [10, 0],
                },
                val: {
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#fff",
                },
              },
            },
          },
          {
            text: "电量(KWH)",
            top: 20,
            left: 20,
            textStyle: {
              fontSize: 14,
              color: "#fff",
              fontWeight: 400,
            },
          },
        ],
        series: [
          {
            type: "pie",
            radius: ["40%", "50%"],
            center: ["50%", "50%"],
            data: echartData,
            hoverAnimation: false,
            itemStyle: {
              normal: {
                // borderColor: bgColor,
                borderWidth: 2,
              },
            },
            labelLine: {
              normal: {
                length: 30,
                length2: 50,
              },
            },
            label: {
              normal: {
                formatter: (params) => {
                  return "{name|" + params.name + "}";
                },
                padding: [24, 0, 25, 0],
                rich: {
                  icon: {
                    fontSize: 16,
                  },
                  name: {
                    fontSize: 14,
                  }
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
#id {
  width: 100%;
  height: 100%;
}
</style>