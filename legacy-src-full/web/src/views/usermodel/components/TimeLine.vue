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
  props: ["id", "timelinesRegs", "drid"],
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
    console.log(this.timelinesRegs);
    this.timelineX = ["1时","2时","3时","4时","5时","6时","7时"]
    this.timelineData = [
      {
        name: "空调温度",
        type: "line",
        smooth: true,
        data: [0, 0, 0, 0, 0, 0, 0]
      }
    ];
    this.$nextTick(() => {
      this.initChart(this.id);
    });
    if (
      this.timelinesRegs != null &&
      this.timelinesRegs != undefined &&
      this.timelinesRegs != 0
    ) {
      this.timelineX = [];
      if (this.drid === undefined || this.drid === null || this.drid === "null") {
        this.timeLineInterval = setInterval(() => {
          // 横坐标数据
          let nowTime = new Date();
          if (this.timelineX.length > 6) {
            this.timelineX.shift();
          }
          let hour =
            nowTime.getHours() > 9
              ? nowTime.getHours()
              : "0" + nowTime.getHours();
          let minute =
            nowTime.getMinutes() > 9
              ? nowTime.getMinutes()
              : "0" + nowTime.getMinutes();
          let second =
            nowTime.getSeconds() > 9
              ? nowTime.getSeconds()
              : "0" + nowTime.getSeconds();
          this.timelineX.push(hour + ":" + minute + ":" + second);
          getRegValue(this.path, this.timelinesRegs)
            .then(res => {
              this.timelineData = [];
              res.data.forEach((ele, i) => {
                this.timelineTitle = ele.regName.split(":")[0];
                // 获取数组中的数据
                let arr = this.timelineValue[i];
                if (arr === undefined) {
                  arr = [];
                }
                if (arr.length > 6) {
                  arr.shift();
                }
                arr.push(parseFloat(ele.tagValue));
                this.timelineValue[i] = arr;
                let obj = {
                  name: ele.regName,
                  smooth: true,
                  type: "line",
                  data: this.timelineValue[i]
                };
                this.timelineData.push(obj);
              });
            })
            .catch(console.log);
        }, 3000);
      } else {
        this.timeLineInterval = setInterval(() => {
          // 横坐标数据
          let nowTime = new Date();
          if (this.timelineX.length > 6) {
            this.timelineX.shift();
          }
          let hour =
            nowTime.getHours() > 9
              ? nowTime.getHours()
              : "0" + nowTime.getHours();
          let minute =
            nowTime.getMinutes() > 9
              ? nowTime.getMinutes()
              : "0" + nowTime.getMinutes();
          let second =
            nowTime.getSeconds() > 9
              ? nowTime.getSeconds()
              : "0" + nowTime.getSeconds();
          this.timelineX.push(hour + ":" + minute + ":" + second);
          getRegParams(this.path, this.drid, this.timelinesRegs)
            .then(res => {
              this.timelineData = [];
              res.data.forEach((ele, i) => {
                this.timelineTitle = ele.regName.split(":")[0];
                // 获取数组中的数据
                let arr = this.timelineValue[i];
                if (arr === undefined) {
                  arr = [];
                }
                if (arr.length > 6) {
                  arr.shift();
                }
                arr.push(parseFloat(ele.tagValue));
                this.timelineValue[i] = arr;
                let obj = {
                  name: ele.regName,
                  smooth: true,
                  type: "line",
                  data: this.timelineValue[i]
                };
                this.timelineData.push(obj);
              });
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