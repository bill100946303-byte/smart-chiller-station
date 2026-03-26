<template>
  <div :id="id"></div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import {
  getRegValue,
  getRegParams
} from "@/api/usersetting/devicemonitor/model1";

export default {
  props: ["id", "timepiesRegs", "drid"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: null,
      pieNames: [],
      baseData: [
        { name: "空调温度", value: 0 },
        { name: "空调湿度", value: 0 },
        { name: "空调转速", value: 0 }
      ],
      timePieInterval: null
    };
  },
  created() {
    this.$nextTick(function() {
      this.initChart(this.id);
    });
    if (
      this.timepiesRegs != null &&
      this.timepiesRegs != undefined &&
      this.timepiesRegs != 0
    ) {
      if (this.drid == undefined) {
        this.timePieInterval = setInterval(() => {
          getRegValue(this.path, this.timepiesRegs)
            .then(res => {
              this.baseData = [];
              res.data.forEach(ele => {
                let obj = {
                  name: ele.regName,
                  value: ele.tagValue
                };
                this.baseData.push(obj);
              });
            })
            .catch(console.log);
          this.$nextTick(function() {
            this.initChart(this.id);
          });
        }, 3000);
      } else {
        this.timePieInterval = setInterval(() => {
          getRegParams(this.path, this.drid, this.timepiesRegs)
            .then(res => {
              this.baseData = [];
              res.data.forEach(ele => {
                let obj = {
                  name: ele.regName,
                  value: ele.tagValue
                };
                this.baseData.push(obj);
              });
            })
            .catch(console.log);
          this.$nextTick(function() {
            this.initChart(this.id);
          });
        }, 3000);
      }
    } else {
      this.$message.warning("实时饼图未绑定变量");
    }
  },
  destroyed() {
    clearInterval(this.timePieInterval);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b} : {c} ({d}%)",
          position: "inside"
        },
        // legend: {
        //   orient: "vertical",
        //   left: "left",
        //   top: "middle",
        //   data: ["空调", "照明", "配电", "视频安防"],
        //   textStyle: {
        //     color: "var(--theme-color)"
        //   }
        // },
        series: [
          {
            name: "设备比例",
            type: "pie",
            radius: "55%",
            center: ["50%", "60%"],
            itemStyle: {
              normal: {
                label: {
                  show: false
                },
                labelLine: {
                  show: false
                }
              },
              emphasis: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)"
              }
            },
            data: this.baseData
          }
        ]
      });
    }
  }
};
</script>