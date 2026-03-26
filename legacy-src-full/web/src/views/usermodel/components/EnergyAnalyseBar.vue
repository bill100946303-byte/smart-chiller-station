<template>
  <div :id="this.id" />
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import { getSortEnergyBar } from "@/api/usersetting/devicemonitor/model1";

export default {
  props: ["id"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: "",
      sortData: [],
      XData: [],
      barData: [],
    };
  },
  created() {
    getSortEnergyBar(this.path, 4)
      .then(res => {
        res.data.forEach(ele => {
          this.sortData.push(ele.energytypename);
          let energyQeuryMap = ele.energyQeuryMap;
          let arr = [];
          for (const key in energyQeuryMap) {
            if (this.XData.length < 7) {
              this.XData.push(key);
            }
            arr.push(energyQeuryMap[key]);
          }
          let obj = {
            name: ele.energytypename,
            type: "bar",
            data: arr
          };
          this.barData.push(obj);
        });
        this.$nextTick(() => {
          this.initChart(this.id);
        });
      })
      .catch(console.log);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id), "blue");
      this.charts.setOption({
        color: ["#21ea8d", "#349bf1", "#fd8e22", "#f74e36"],
        tooltip: {
          trigger: "axis"
        },
        legend: {
          y: "bottom",
          itemGap: 30,
          itemWidth: 30,
          itemHeight: 10,
          data: this.sortData,
          textStyle: {
            fontSize: 13, //字体大小
            color: "rgb(142, 199, 220)" //字体颜色
          }
        },
        calculable: true,
        xAxis: [
          {
            type: "category",
            data: this.XData,
            axisLabel: {
              show: true,
              textStyle: {
                color: ["rgb(142, 199, 220)"]
              }
            },
            axisLine: {
              lineStyle: {
                color: "#023c7a",
                width: 1
              }
            }
          }
        ],
        yAxis: [
          {
            type: "value",
            splitLine: {
              lineStyle: {
                color: "#023c7a",
                width: 1
              }
            },
            axisLine: {
              lineStyle: {
                color: "#023c7a",
                width: 1
              }
            },
            axisLabel: {
              show: true,
              textStyle: {
                color: ["rgb(142, 199, 220)"]
              }
            }
          }
        ],
        series: this.barData
      });
    }
  }
};
</script>