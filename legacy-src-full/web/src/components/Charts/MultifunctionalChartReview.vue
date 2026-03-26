<template>
  <div :id="id"></div>
</template>
<script>
import echarts from "echarts";
import { findzsEnergy } from "@/api/usersetting/energymangenew/totalenergy";
import { mapGetters } from "vuex";
export default {
  props: ["id", "chartData", "energyType"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      barChartDatas: [],
      barChartData: [],
      energyid: "", // 能耗id
      drids: [], // 设备id
      startTimes: [], // 开始时间
      endTimes: [], // 结束时间
      charts: null,
      name: "", // 名称
      xAxis: [], // 横坐标
      yAxis: [], // 纵坐标
      count: 0,
      flag: true,
      colors: [
        "#3398db",
        "#434348",
        "#90ed7d",
        "#f7a35c",
        "#61a0a8",
        "#61a0a8",
        "#91c7ae",
        "#2f4554"
      ]
    };
  },
  watch: {
    chartData(val) {
      this.flag = true;
      this.charts.clear(this.option);
      this.barChartDatas = [];
      this.xAxis = [];
      this.yAxis = [];
      this.name = val.energytypename;
      this.energyid = val.energyid;
      for (const key in val.energyQeuryMap) {
        this.xAxis.push(val.dateStr + key);
        this.yAxis.push(val.energyQeuryMap[key]);
      }
      let obj = {
        name: this.name,
        type: "bar",
        smooth: true,
        color: "green",
        data: this.yAxis,
        markPoint: {
          data: [
            { type: "max", name: "最大值" },
            { type: "min", name: "最小值" }
          ]
        },
        markLine: {
          data: [{ type: "average", name: "平均值" }]
        }
      };
      this.barChartDatas.push(obj);
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    },
    barChartData(val) {
      this.flag = false;
      this.charts.clear(this.option);
      this.barChartDatas = [];
      this.drids = [];
      this.startTimes = [];
      this.endTimes = [];
      val.forEach((ele, i) => {
        this.name = ele.energytypename;
        this.energyid = 0;
        this.xAxis = [];
        this.yAxis = [];
        for (const key in ele.energyQeuryMap) {
          this.xAxis.push(ele.dateStr + key);
          this.yAxis.push(ele.energyQeuryMap[key]);
        }
        let obj = {
          name: this.name,
          type: "bar",
          smooth: true,
          color: this.colors[i],
          data: this.yAxis,
          markPoint: {
            data: [
              { type: "max", name: "最大值" },
              { type: "min", name: "最小值" }
            ]
          },
          markLine: {
            data: [{ type: "average", name: "平均值" }]
          }
        };
        this.drids.push(ele.energyid);
        this.barChartDatas.push(obj);
        this.startTimes.push(ele.startTime);
        this.endTimes.push(ele.endTime);
      });
      this.$nextTick(function() {
        this.initChart(this.id);
      });
    }
  },
  created() {
    this.flag = true;
    this.barChartDatas = [];
    this.xAxis = [];
    this.yAxis = [];
    this.name = this.chartData.energytypename;
    this.energyid = this.chartData.energyid;
    for (const key in this.chartData.energyQeuryMap) {
      this.xAxis.push(this.chartData.dateStr + key);
      this.yAxis.push(this.chartData.energyQeuryMap[key]);
    }
    let obj = {
      name: this.name,
      type: "bar",
      smooth: true,
      color: "green",
      data: this.yAxis,
      markPoint: {
        data: [
          { type: "max", name: "最大值" },
          { type: "min", name: "最小值" }
        ]
      },
      markLine: {
        data: [{ type: "average", name: "平均值" }]
      }
    };
    this.barChartDatas.push(obj);
    this.$nextTick(function() {
      this.initChart(this.id);
    });
  },
  methods: {
    initChart(id) {
      this.charts = echarts.init(document.getElementById(id));
      this.charts.setOption({
        tooltip: {
          trigger: "axis"
        },
        calculable: true,
        xAxis: [
          {
            type: "category",
            data: this.xAxis
          }
        ],
        yAxis: [
          {
            type: "value"
          }
        ],
        series: this.barChartDatas
      });
      this.charts.on("click", params => {
        this.count++;
        if (this.count === 1) {
          if (!this.flag) {
            this.$emit(
              "drid",
              this.drids[params.componentIndex],
              this.startTimes[params.componentIndex],
              this.endTimes[params.componentIndex]
            );
            this.count = 0;
          }

          let formData = new FormData();
          formData.append("energyid", this.energyid);
          if (this.energyType === 3 && this.energyid != 0) {
            // 查询时能耗
            formData.append("type", 3);
            let year = params.name.split("年")[0];
            let month = params.name.split("年")[1].split("月")[0];
            let day = params.name
              .split("年")[1]
              .split("月")[1]
              .split("日")[0];
            let hour = params.name
              .split("年")[1]
              .split("月")[1]
              .split("日")[1]
              .split("时")[0];
            let date = new Date(year, month - 1, day, hour);
            formData.append("date", date);
            findzsEnergy(this.path, formData)
              .then(res => {
                this.barChartData = res.data;
                this.count = 0;
              })
              .catch(console.log);
          } else if (this.energyType === 2 && this.energyid != 0) {
            // 日能耗
            formData.append("type", 2);
            let year = params.name.split("年")[0];
            let month = params.name.split("年")[1].split("月")[0];
            let day = params.name
              .split("年")[1]
              .split("月")[1]
              .split("日")[0];
            let date = new Date(year, month - 1, day);
            formData.append("date", date);
            findzsEnergy(this.path, formData)
              .then(res => {
                this.barChartData = res.data;
                this.count = 0;
              })
              .catch(console.log);
          } else if (this.energyType === 1 && this.energyid != 0) {
            // 月能耗
            formData.append("type", 1);
            let year = params.name.split("年")[0];
            let month = params.name.split("年")[1].split("月")[0];
            let date = new Date(year, month - 1);
            formData.append("date", date);
            findzsEnergy(this.path, formData)
              .then(res => {
                this.barChartData = res.data;
                this.count = 0;
              })
              .catch(console.log);
          } else {
            this.count = 0;
            return;
          }
        }
      });
    }
  }
};
</script>
