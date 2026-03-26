<template>
  <div :id="this.id"></div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import { getSortEnergyPie } from "@/api/usersetting/devicemonitor/model1";
export default {
  props: ["id"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: "",
      XData: [],
      pieData: []
    };
  },
  created() {
    getSortEnergyPie(this.path)
      .then(res => {
        res.data.forEach(ele => {
          this.XData.push(ele[1].energytypename);
          for (const key in ele[1].energyQeuryMap) {
            let obj = {
              name: ele[1].energytypename,
              value: ele[1].energyQeuryMap[key]
            };
            this.pieData.push(obj);
          }
          this.$nextTick(() => {
            this.initChart(this.id);
          });
        });
      })
      .catch(console.log);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        color: ["#21ea8d", "#349bf1", "#fd8e22", "#f74e36"],
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        legend: {
          x: "center",
          y: "bottom",
          itemGap: 30,
          itemWidth: 30,
          itemHeight: 10,
          data: this.XData,
          textStyle: {
            fontSize: 13, //字体大小
            color: "rgb(142, 199, 220)" //字体颜色
          }
        },
        calculable: true,
        series: [
          {
            name: "楼栋能耗",
            type: "pie",
            roseType: "radius",
            width: "40%", // for funnel
            max: 40, // for funnel
            itemStyle: {
              normal: {
                label: {
                  position: "inner"
                },
                labelLine: {
                  show: false
                }
              },
              emphasis: {
                label: {
                  show: false
                },
                labelLine: {
                  show: false
                }
              }
            },
            data: this.pieData
          }
        ]
      });
    }
  }
};
</script>