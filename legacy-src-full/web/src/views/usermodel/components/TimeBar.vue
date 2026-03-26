<template>
  <div :id="id" />
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import {
  getRegValue,
  getRegParams
} from "@/api/usersetting/devicemonitor/model1";

export default {
  props: ["id", "timebarsRegs", "drid"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: "",
      timelineTitle: "", // 标题
      timelineX: [], // 横坐标
      timelineData: [], // 实时曲线数据
      timelineValue: [], // 数据
      timeLineInterval: null
    };
  },
  watch: {
    timelineData(val) {
      this.$nextTick(() => {
        this.initChart(this.id);
      });
    }
  },
  created() {
    this.timelineX = ["1时", "2时", "3时", "4时", "5时", "6时", "7时"];
    this.timelineData = [
      {
        type: "bar",
        smooth: true,
        data: [0, 0, 0, 0, 0, 0, 0]
      }
    ];
    this.$nextTick(() => {
      this.initChart(this.id);
    });
    if (
      this.timebarsRegs != null &&
      this.timebarsRegs != undefined &&
      this.timebarsRegs != 0
    ) {
      this.timelineX = [];
      if (
        this.drid === undefined ||
        this.drid === null ||
        this.drid === "null"
      ) {
        this.timeLineInterval = setInterval(() => {
          // 横坐标数据
          getRegValue(this.path, this.timebarsRegs)
            .then(res => {
              this.timelineData = [];
              this.timelineValue = [];
              res.data.forEach((ele, i) => {
                if (this.timelineX.length < res.data.length) {
                  this.timelineTitle = ele.regName.split(":")[0];
                  this.timelineX.push(ele.regName.split(":")[1]);
                }

                let obj = {
                  name: ele.regName,
                  value: ele.tagValue
                };
                this.timelineValue.push(obj);
              });
              let obj = {
                smooth: true,
                type: "bar",
                data: this.timelineValue
              };
              this.timelineData.push(obj);
            })
            .catch(console.log);
        }, 3000);
      } else {
        this.timeLineInterval = setInterval(() => {
          getRegParams(this.path, this.drid, this.timebarsRegs)
            .then(res => {
              this.timelineData = [];
              this.timelineValue = [];
              res.data.forEach((ele, i) => {
                if (this.timelineX.length < res.data.length) {
                  this.timelineTitle = ele.regName.split(":")[0];
                  this.timelineX.push(ele.regName.split(":")[1]);
                }

                let obj = {
                  name: ele.regName,
                  value: ele.tagValue
                };
                this.timelineValue.push(obj);
              });
              let obj = {
                smooth: true,
                type: "bar",
                data: this.timelineValue
              };
              this.timelineData.push(obj);
            })
            .catch(console.log);
        }, 3000);
      }
    } else {
      this.$message.warning("实时曲线未绑定变量");
    }
  },
  destroyed() {
    clearInterval(this.timeLineInterval);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        // title: {
        //   text: this.timelineTitle,
        //   top: 20,
        //   textStyle: {
        //     color: "#3dadfe",
        //     fontSize: 14
        //   },
        // },
        tooltip: {
          trigger: "axis"
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true
        },
        xAxis: {
          type: "category",
          data: this.timelineX,
          axisLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLabel: {
            show: true,
            textStyle: {
              color: ["#3dadfe"]
            }
          }
        },
        yAxis: {
          type: "value",
          splitLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
            }
          },
          axisLabel: {
            show: true,
            textStyle: {
              color: ["#3dadfe"]
            }
          }
        },
        series: this.timelineData
      });
    }
  }
};
</script>