<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";
import { formatDate } from "@/utils/index";
export default {
  props: ["id", "hislinesData", "color"],
  data() {
    return {
      charts: "",
      hislineX: [],
      data: []
    };
  },
  watch: {
    hislinesData(val) {
      this.hislineX = [];
      this.data = [];
      if (val.length === 0) {
        this.hislineX = [
          "1时",
          "2时",
          "3时",
          "4时",
          "5时",
          "6时",
          "7时",
          "8时",
          "9时",
          "10时",
          "11时",
          "12时"
        ];
        let obj = {
          data: [
            820,
            932,
            901,
            300,
            1290,
            1330,
            400,
            901,
            300,
            1290,
            1330,
            400
          ],
          type: "line",
          smooth: true,
        };
        this.data.push(obj);
      } else {
        val.forEach(ele => {
          let obj = {};
          if (ele.energyQeuryMap != undefined) {
            // 能耗分布
            this.hislineX = [
              "1时",
              "2时",
              "3时",
              "4时",
              "5时",
              "6时",
              "7时",
              "8时",
              "9时",
              "10时",
              "11时",
              "12时",
              "13时",
              "14时",
              "15时",
              "16时",
              "17时",
              "18时",
              "19时",
              "20时",
              "21时",
              "22时",
              "23时",
              "24时"
            ];
            let hislineY = [];
            for (const key in ele.energyQeuryMap) {
              hislineY.push(ele.energyQeuryMap[key]);
            }
            obj = {
              data: hislineY,
              type: "line",
              smooth: true,
            };
          } else {
            for (const key in ele) {
              if (ele[key].length === 0) {
                this.hislineX = [
                  "1时",
                  "2时",
                  "3时",
                  "4时",
                  "5时",
                  "6时",
                  "7时",
                  "8时",
                  "9时",
                  "10时",
                  "11时",
                  "12时"
                ];
                obj = {
                  data: [
                    820,
                    932,
                    901,
                    300,
                    1290,
                    1330,
                    400,
                    901,
                    300,
                    1290,
                    1330,
                    400
                  ],
                  type: "line",
                  smooth: true,
                };
              } else {
                this.hislineX = [];
                let hislineY = [];
                ele[key].forEach(ele => {
                  this.hislineX.push(formatDate(ele.time));
                  hislineY.push(ele.tagvalue);
                  obj = {
                    data: hislineY,
                    smooth: true,
                    type: "line"
                  };
                });
              }
            }
          }
          this.data.push(obj);
          console.log(this.data)
        });
      }
      this.$nextTick(() => {
        this.initChart(this.id);
      });
    }
  },
  created() {
    if (this.hislinesData.length === 0) {
      this.hislineX = [
        "1时",
        "2时",
        "3时",
        "4时",
        "5时",
        "6时",
        "7时",
        "8时",
        "9时",
        "10时",
        "11时",
        "12时"
      ];
      let obj = {
        data: [820, 932, 901, 300, 1290, 1330, 400, 901, 300, 1290, 1330, 400],
        type: "line",
        smooth: true,
      };
      this.data.push(obj);
    } else {
      this.hislinesData.forEach(ele => {
        let obj = {};
        if (ele.energyQeuryMap != undefined) {
          // 能耗分布
          this.hislineX = [
            "1时",
            "2时",
            "3时",
            "4时",
            "5时",
            "6时",
            "7时",
            "8时",
            "9时",
            "10时",
            "11时",
            "12时",
            "13时",
            "14时",
            "15时",
            "16时",
            "17时",
            "18时",
            "19时",
            "20时",
            "21时",
            "22时",
            "23时",
            "24时"
          ];
          let hislineY = [];
          for (const key in ele.energyQeuryMap) {
            hislineY.push(ele.energyQeuryMap[key]);
          }
          obj = {
            data: hislineY,
            type: "line",
            smooth: true,
          };
        } else {
          for (const key in ele) {
            if (ele[key].length === 0) {
              this.hislineX = [
                "1时",
                "2时",
                "3时",
                "4时",
                "5时",
                "6时",
                "7时",
                "8时",
                "9时",
                "10时",
                "11时",
                "12时"
              ];
              obj = {
                data: [
                  820,
                  932,
                  901,
                  300,
                  1290,
                  1330,
                  400,
                  901,
                  300,
                  1290,
                  1330,
                  400
                ],
                type: "line",
                smooth: true,
              };
            } else {
              this.hislineX = [];
              let hislineY = [];
              ele[key].forEach(ele => {
                this.hislineX.push(formatDate(ele.time));
                hislineY.push(ele.tagvalue);
                obj = {
                  data: hislineY,
                  smooth: true,
                  type: "line"
                };
              });
            }
          }
        }
        this.data.push(obj);
      });
    }
    this.$nextTick(() => {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        color: this.color.split(","),
        tooltip: {
          trigger: "axis"
        },
        grid: {
          top: '5%',
          left: "3%",
          right: "3%",
          bottom: "1%",
          containLabel: true
        },
        xAxis: {
          type: "category",
          data: this.hislineX,
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
        series: this.data
      });
    }
  }
};
</script>