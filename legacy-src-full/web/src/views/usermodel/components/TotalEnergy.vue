<template>
  <div class="total-energy">
    <div style="padding-left:10%;">
      <div :id="id" style="width:400px;height:300px;" />
    </div>
    <div class="energy-content">
      <div class="month-energy">
        <p>
          <span class="left">{{ mounthEnergy }}</span>
          <span class="right">Mwh</span>
        </p>
        <p class="subtitle">当日总用电量</p>
      </div>
      <div class="line">
        <p></p>
      </div>
      <div class="year-energy">
        <p>
          <span class="left orange">{{ yearEnergy }}</span>
          <span class="right">Mwh</span>
        </p>
        <p class="subtitle">{{ yearNum }}总用电量</p>
      </div>
    </div>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import { getTotalEnergyDataNew } from "@/api/usersetting/devicemonitor/model1";
import {
  findTotalEnergy
} from "@/api/usersetting/energymangenew/totalenergy";

export default {
  props: ["id"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      charts: "",
      totalEnergyDataX: [],
      totalEnergyDataY: [],
      mounthEnergy: 0,
      mounthNum: "",
      yearEnergy: 0,
      yearNum: ""
    };
  },
  created() {
    getTotalEnergyDataNew(this.path, 4)
      .then(res => {
        let dateStr = res.data[0].dateStr;
        let totalEnergyData = res.data[0].energyQeuryMap;
        for (const key in totalEnergyData) {
          // this.mounthEnergy += parseInt(totalEnergyData[key]);
          this.totalEnergyDataX.push(key);
          this.totalEnergyDataY.push(totalEnergyData[key]);
        }
        this.$nextTick(() => {
          this.initChart(this.id);
        });
      })
      .catch(console.log);

    // 查询总能耗
    findTotalEnergy(this.path, 1)
      .then(res => {
        let energyQeuryMap0 = res.data[0][0].energyQeuryMap;
        let energyQeuryMap1 = res.data[0][1].energyQeuryMap;
        for (const key in energyQeuryMap0) {
          this.yearEnergy = energyQeuryMap0[key];
        }
        for (const key in energyQeuryMap1) {
          this.mounthEnergy = energyQeuryMap1[key];
        }
      })
      .catch(console.log);
    // 月能耗
    // getTotalEnergyDataNew(this.path, 2)
    //   .then(res => {
    //     this.mounthNum = res.data[0].dateStr;
    //     let energyQeuryMap = res.data[0].energyQeuryMap;
    //     for (const key in energyQeuryMap) {
    //       this.mounthEnergy += parseInt(energyQeuryMap[key]);
    //     }
    //   })
    //   .catch(console.log);
    // 年能耗
    // getTotalEnergyDataNew(this.path, 1)
    //   .then(res => {
    //     this.yearNum = res.data[0].dateStr;
    //     let energyQeuryMap = res.data[0].energyQeuryMap;
    //     for (const key in energyQeuryMap) {
    //       this.yearEnergy += parseInt(energyQeuryMap[key]);
    //     }
    //   })
    //   .catch(console.log);
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        color: ["rgb(38,71,253)"],
        tooltip: {
          trigger: "axis"
        },
        calculable: true,
        xAxis: [
          {
            type: "category",
            data: this.totalEnergyDataX,
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
              show: false
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
        series: [
          {
            name: "日能耗",
            type: "bar",
            data: this.totalEnergyDataY,
            barWidth: 20,
            itemStyle: {
              normal: {
                color: new echarts.graphic.LinearGradient(
                  0,
                  0,
                  0,
                  1,
                  [
                    {
                      offset: 0,
                      color: "#2647fd" // 0% 处的颜色
                    },
                    {
                      offset: 1,
                      color: "#41a0f2" // 100% 处的颜色
                    }
                  ],
                  false
                ),
                shadowColor: "rgba(0,255,225,1)",
                label: {
                  show: true, //开启显示
                  position: "top", //在上方显示
                  textStyle: {
                    //数值样式
                    color: "var(--theme-color)",
                    fontSize: 12
                  }
                }
              }
            }
          }
        ]
      });
    }
  }
};
</script>
<style lang="scss" scoped>
.total-energy {
  .energy-content {
    text-align: center;
    .month-energy {
      .left {
        color: #fc6521;
      }
    }

    .line {
      position: relative;
      margin-top: 5px;
      padding: 10px 0;

      p {
        position: absolute;
        top: 25%;
        left: 25%;
        width: 190px;
        height: 1px;
        background-color: rgba(26, 63, 114, 1);
      }
    }

    .left {
      margin-right: 30px;
      font-family: MicrosoftYaHei-Bold;
      font-size: 28px;
      font-weight: normal;
      font-stretch: normal;
      line-height: 30px;
      letter-spacing: 1px;
    }

    .right,
    .subtitle {
      font-family: MicrosoftYaHei;
      font-weight: normal;
      font-stretch: normal;
      line-height: 30px;
      letter-spacing: 0px;
      color: #999;
    }
    .right {
      font-size: 16px;
    }
    .subtitle {
      font-size: 14px;
    }
  }
}
.orange {
  font-family: MicrosoftYaHei-Bold;
  font-size: 28px;
  font-weight: normal;
  font-stretch: normal;
  line-height: 30px;
  letter-spacing: 1px;
  color: #21ea8d;
}
</style>