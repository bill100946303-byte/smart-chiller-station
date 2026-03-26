<template>
  <div class="alarm-chart">
    <div :id="this.id + 'pie'" style="width:250px;height:250px;" />
    <div :id="this.id + 'line'" style="width:480px;height:300px;" />
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import {
  getAlarmData,
  getAlarmLineData
} from "@/api/usersetting/devicemonitor/model1";

export default {
  props: ["id"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      linecharts: "",
      piechats: "",
      pieData: [],
      sortData: [],
      XLineData: [],
      lineData: []
    };
  },
  created() {
    getAlarmData(this.path)
      .then(res => {
        this.pieData = res.data;
        this.$nextTick(() => {
          this.initPieChart(this.id + "pie");
        });
      })
      .catch(console.log);
    getAlarmLineData(this.path, 2)
      .then(res => {
        res.data.forEach(ele => {
          this.sortData.push(ele.name);
          let qeuryMap = ele.qeuryMap;
          let arr = [];
          for (const key in qeuryMap) {
            if (this.XLineData.length < 7) {
              this.XLineData.push(ele.dateStr + key);
            }
            if (arr.length < 7) {
              arr.push(qeuryMap[key]);
            }
          }
          let obj = {
            name: ele.name,
            type: "line",
            data: arr
          };
          this.lineData.push(obj);
        });
        this.$nextTick(() => {
          this.initLineChart(this.id + "line");
        });
        console.log(this.sortData);
        console.log(this.XLineData);
        console.log(this.lineData);
      })
      .catch(console.log);
  },
  methods: {
    initLineChart(id) {
      this.linecharts = echarts.init(document.getElementById(id), "blue");
      this.linecharts.setOption({
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
            boundaryGap: false,
            data: this.XLineData,
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
            axisLabel: {
              formatter: "{value} °C"
            },
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
        series: this.lineData
      });
    },
    initPieChart(id) {
      this.piechats = echarts.init(document.getElementById(id));
      this.piechats.setOption({
        title: {
          text: "报警信息",
          left: "center",
          top: "45%",
          textStyle: {
            color: "var(--theme-color)",
            fontSize: 18,
            align: "center"
          }
        },
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        color: ["#21ea8d", "#349bf1", "#fd8e22", "#f74e36"],
        calculable: true,
        series: [
          {
            type: "pie",
            radius: ["30%", "50%"],
            data: this.pieData
          }
        ]
      });
    }
  }
};
</script>
<style lang="scss" scoped>
.alarm-chart {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
</style>