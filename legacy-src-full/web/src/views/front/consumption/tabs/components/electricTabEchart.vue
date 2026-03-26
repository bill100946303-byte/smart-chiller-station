<template>
  <div :id="id" class="chart"/>
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
        this.$nextTick(() => {
          this.initChart(this.id);
        });
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
      let totalnum  = Object.values(this.echartdata).reduce((pre,next)=>{
        return pre+parseInt(next)
      },0)
      // console.log('totalnum',totalnum);
      let arr = Object.keys(this.echartdata).reduce((pre,next)=>{
        let obj = {
          name:next,
          value:parseInt(this.echartdata[next]),
          pex:  totalnum?(parseInt(this.echartdata[next])/totalnum*100).toFixed(2)+"%":"0%"
        }
        pre.push(obj)
        return pre
      },[])

      let formatNumber = function(num) {
        let reg = /(?=(\B)(\d{3})+$)/g;
        return num.toString().replace(reg, ",");
      };
      let total = arr.reduce((a, b) => {
        return a + b.value * 1;
      }, 0);
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        // backgroundColor: bgColor,
        color: color,
        tooltip: {
            trigger: 'item'
        },
        title: [
          {
            text:
              "{name|" + title + "}\n{val|" + formatNumber(total) + "}",
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
                  fontSize: 32,
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
            radius: ["30%", "40%"],
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
                length: 25,
                length2: 30,
              },
            },
            label: {
              width:20,
              normal: {
                formatter: (params) => {
                  return (
                    "{name|" +
                    params.name +
                    "}{value|" +
                    params.data.pex +
                    "}"
                  );
                },
                
                padding: [24, 0, 25, 0],
                rich: {
                  name: {
                    fontSize: 14,
                  },
                  value: {
                    fontSize: 14,
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
.chart{
  width: 100%;
  height: 100%;
  min-width: 400px;
}
</style>
