<template>
  <div :id="id" />
</template>
<script>
import echarts from "echarts";
import { formatDate } from "@/utils/index";
export default {
  props: ["id", "barChartData", "color"],
  data() {
    return {
      charts: "",
      hislineX: [],
      data: []
    };
  },
  watch: {
    barChartData(val) {
      this.hislineX = [];
      this.data = [];
      if (val.length === 0) {
        // 当天无数据
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
        let obj = {
          data: [
            320,
            332,
            301,
            334,
            390,
            330,
            320,
            400,
            500,
            450,
            403,
            340,
            320,
            332,
            301,
            334,
            390,
            330,
            320,
            400,
            500,
            450,
            403,
            340
          ],
          type: "bar",
          barMaxWidth: 10, // 最大宽度
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
                    color: this.color.split(",")[1] // 0% 处的颜色
                  },
                  {
                    offset: 1,
                    color: this.color.split(",")[0] // 100% 处的颜色
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
                  fontSize: 11
                }
              }
            }
          }
        };
        this.data.push(obj);
      } else {
        // 当天有数据
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
              type: "bar",
              barMaxWidth: 10, // 最大宽度
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
                        color: this.color.split(",")[1] // 0% 处的颜色
                      },
                      {
                        offset: 1,
                        color: this.color.split(",")[0] // 100% 处的颜色
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
                      fontSize: 11
                    }
                  }
                }
              }
            };
          } else {
            // 变量
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
                obj = {
                  data: [
                    320,
                    332,
                    301,
                    334,
                    390,
                    330,
                    320,
                    400,
                    500,
                    450,
                    403,
                    340,
                    320,
                    332,
                    301,
                    334,
                    390,
                    330,
                    320,
                    400,
                    500,
                    450,
                    403,
                    340
                  ],
                  type: "bar",
                  barMaxWidth: 10, // 最大宽度
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
                            color: this.color.split(",")[1] // 0% 处的颜色
                          },
                          {
                            offset: 1,
                            color: this.color.split(",")[0] // 100% 处的颜色
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
                          fontSize: 11
                        }
                      }
                    }
                  }
                };
              } else {
                this.hislineX = [];
                let hislineY = [];
                ele[key].forEach(ele => {
                  this.hislineX.push(formatDate(ele.time));
                  hislineY.push(ele.tagvalue);
                  obj = {
                    data: hislineY,
                    type: "bar",
                    barMaxWidth: 10, // 最大宽度
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
                              color: this.color.split(",")[1] // 0% 处的颜色
                            },
                            {
                              offset: 1,
                              color: this.color.split(",")[0] // 100% 处的颜色
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
                            fontSize: 11
                          }
                        }
                      }
                    }
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
    }
  },
  created() {
    if (this.barChartData.length === 0) {
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
      let obj = {
        data: [
          320,
          332,
          301,
          334,
          390,
          330,
          320,
          400,
          500,
          450,
          403,
          340,
          320,
          332,
          301,
          334,
          390,
          330,
          320,
          400,
          500,
          450,
          403,
          340
        ],
        type: "bar",
        barMaxWidth: 10, // 最大宽度
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
                  color: this.color.split(",")[1] // 0% 处的颜色
                },
                {
                  offset: 1,
                  color: this.color.split(",")[0] // 100% 处的颜色
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
                fontSize: 11
              }
            }
          }
        }
      };
      this.data.push(obj);
    } else {
      this.barChartData.forEach(ele => {
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
            type: "bar",
            barMaxWidth: 10, // 最大宽度
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
                      color: this.color.split(",")[1] // 0% 处的颜色
                    },
                    {
                      offset: 1,
                      color: this.color.split(",")[0] // 100% 处的颜色
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
                    fontSize: 11
                  }
                }
              }
            }
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
              obj = {
                data: [
                  320,
                  332,
                  301,
                  334,
                  390,
                  330,
                  320,
                  400,
                  500,
                  450,
                  403,
                  340,
                  320,
                  332,
                  301,
                  334,
                  390,
                  330,
                  320,
                  400,
                  500,
                  450,
                  403,
                  340
                ],
                type: "bar",
                barMaxWidth: 10, // 最大宽度
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
                          color: this.color.split(",")[1] // 0% 处的颜色
                        },
                        {
                          offset: 1,
                          color: this.color.split(",")[0] // 100% 处的颜色
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
                        fontSize: 11
                      }
                    }
                  }
                }
              };
            } else {
              this.hislineX = [];
              let hislineY = [];
              ele[key].forEach(ele => {
                this.hislineX.push(formatDate(ele.time));
                hislineY.push(ele.tagvalue);
                obj = {
                  data: hislineY,
                  type: "bar",
                  barMaxWidth: 10, // 最大宽度
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
                            color: this.color.split(",")[1] // 0% 处的颜色
                          },
                          {
                            offset: 1,
                            color: this.color.split(",")[0] // 100% 处的颜色
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
                          fontSize: 11
                        }
                      }
                    }
                  }
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
        color: ["#f2877f", "#0c81fe", "#9a05f5", "#44f0e9", "#958eed"],
        tooltip: {
          trigger: "axis",
          axisPointer: {
            // 坐标轴指示器，坐标轴触发有效
            type: "shadow" // 默认为直线，可选为：'line' | 'shadow'
          }
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true
        },
        xAxis: {
          type: "category",
          data: this.hislineX,
          axisLabel: {
            show: true,
            textStyle: {
              color: ["#3dadfe"]
            }
          },
          axisLine: {
            lineStyle: {
              color: "rgba(17,87,148,0.5)",
              width: 1
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