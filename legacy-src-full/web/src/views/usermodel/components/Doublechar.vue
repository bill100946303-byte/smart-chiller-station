<template>
  <div :id="id" class="char"></div>
</template>

<script>
import echarts from "echarts";
export default {
  props: ["datas", 'id'],
  data () {
    return {
      charts: ''
    }
  },
  mounted () {
    this.$nextTick(() => {
      this.initChart();
    });
  },
  methods: {
    initChart () {
      this.charts = echarts.init(document.getElementById(this.id));
      console.log(this.charts, this.datas)
      this.charts.setOption({
        backgroundColor: 'transparent',
        grid:{
          left:'30',
          top:'20'
        },
        color: ['rgba(254, 220, 125, 1)', 'rgba(33, 255, 255, 1)'],
        dataset: {
          dimensions: ['product', '2015', '2016'],
          source: this.datas
        },
        legend: {
          show: false,
        },
        xAxis: {
          type: 'category', axisTick: {
            show: false
          },
          axisLabel: {
            textStyle:{
            color:'var(--theme-color)'
          },
          },
          axisLine: {
            lineStyle: {
              color: 'rgba(27, 101, 178, 1)'
            }

          },
          
        },
        yAxis: {
          axisTick: {
            show: false
          },
          splitLine: {
            lineStyle: {
              type: 'dashed',
              color: 'rgba(27, 101, 178, 1)'
            }
          },
          axisLine: {
            lineStyle: {
              color: 'rgba(27, 101, 178, 1)'
            }

          },
          axisLabel: {
            textStyle:{
            color:'var(--theme-color)'
          },
          },
        },
        series: [
          { type: 'bar' },
          { type: 'bar' }
        ]
      });
    }
  }
}
</script>

<style>
.char {
  width: 644px;
  height: 200px;
}
</style>