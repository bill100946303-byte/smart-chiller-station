<template>
  <div>
    <div class="top">
      <search @search="search"/>
    </div>
    <div class="bottom">
      <LineEchart :title="title" :xData="xData" :xLabel="xLabel" style="width: 100%; height: 100%"/>
    </div>
  </div>
</template>

<script>
import Search from "./search.vue";
import LineEchart from "./lineEchart.vue";
import {
  findChilledWaterGpmRtByTimeSpace,
  findChillerEfficiencyByTimeSpace,
  findCHPEfficiencyByTimeSpace,
  findChwTemperature,
  findChwTemperatureDiffByTimeSpace,
  findCondenserWaterGpmRtByTimeSpace,
  findCoolingTowerEfficiencyByTimeSpace,
  findCWPEfficiencyByTimeSpace,
  findCwpTemperatureByTimeSpace,
  findCwpTemperatureDiffByTimeSpace,
  findSystemEfficiencyByTimeSpace,
  findTowerApproachTemperatureByTimeSpace,
} from '@/api/report'
import {mapGetters} from "vuex";

export default {
  name: "index",
  components: {
    Search,
    LineEchart
  },
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      xLabel: [],
      xData: [],
      title: [],
    }
  },
  methods: {
    search(value) {
      let data = {
        endTime: value.endTime,
        startTime: value.startTime
      }
      // let time = ['00h', '01h', '02h', '03h', '04h', '05h', '06h', '07h', '08h','09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h']
      let time = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h']
      this.xLabel = time
      this.xData = []
      this.title = []
      console.log(value)
      let request = null
      if (value.name === '24小时冷负荷曲线室温叠加图') {
        // 图1
        request = ''
      } else if (value.name === '冷负荷发生情况的直方图') {
        // 图2
        request = ''
        // } else if (value.name === '每日冷冻水供回水温度叠加图') {
      } else if (value.name === this.$t('report.num3')) {
        // 图3
        request = findChwTemperature
        // } else if (value.name === '每日冷冻水温差叠加图') {
      } else if (value.name === this.$t('report.num4')) {
        // 图4
        request = findChwTemperatureDiffByTimeSpace
        // } else if (value.name === '凝汽器每日给回水温度叠加图') {
      } else if (value.name === this.$t('report.num5')) {
        // 图5
        request = findCwpTemperatureByTimeSpace
        // } else if (value.name === '冷凝器日温差叠加图') {
      } else if (value.name === this.$t('report.num6')) {
        // 图6
        request = findCwpTemperatureDiffByTimeSpace
        // } else if (value.name === '每日冷冻水GPM/RT的叠加图') {
      } else if (value.name === this.$t('report.num7')) {
        // 图7
        request = findChilledWaterGpmRtByTimeSpace
        // } else if (value.name === '日冷凝器水GPM/RT叠加图') {
      } else if (value.name === this.$t('report.num8')) {
        // 图8
        request = findCondenserWaterGpmRtByTimeSpace
      } else if (value.name === '冷却塔接近温度') {
        // 图9
        request = findTowerApproachTemperatureByTimeSpace
        // } else if (value.name === '日冷水效率kW/RT叠加图') {
      } else if (value.name === this.$t('report.num10')) {
        // 图10
        request = findChillerEfficiencyByTimeSpace
        // } else if (value.name === '每日冷冻水泵效率kW/RT叠加图') {
      } else if (value.name === this.$t('report.num11')) {
        // 图11
        request = findCHPEfficiencyByTimeSpace
        // } else if (value.name === '日凝汽器水泵效率kW/RT叠加图') {
      } else if (value.name === this.$t('report.num12')) {
        // 图12
        request = findCWPEfficiencyByTimeSpace
        // } else if (value.name === '冷却塔日效率kW/RT叠加图') {
      } else if (value.name === this.$t('report.num13')) {
        // 图13
        request = findCoolingTowerEfficiencyByTimeSpace
        // } else if (value.name === '日冷水机组系统效率kW/RT叠加图') {
      } else if (value.name === this.$t('report.num14')) {
        // 图14
        request = findSystemEfficiencyByTimeSpace
      } else if (value.name === '冷水机组超冷负荷效率散点图') {
        // 图15
        request = ''
      } else if (value.name === '冷却水泵超冷负荷效率散点图') {
        // 图16
        request = ''
      } else if (value.name === '冷凝器水泵效率散点图') {
        // 图17
        request = ''
      } else if (value.name === '冷却塔效率散点图') {
        //图18
        request = ''
      }
      request(this.path, data).then(res => {
        let tempData = []
        let itemData = []
        let tempTitle = []
        res.data.chillerPerformanceReportVO.forEach((item, index) => {
          console.log('item2', item);
          tempTitle.push({
            text: item.tagName + '  ' + item.tagNameDescribe + '=' + item.totalAvageData,
            left: 'center',
            top: index === 1 ? '5%' : '0%',
            textStyle: {
              color: '#f60',
              fontSize: 18,
              fontWeight: 'bold'
            }
          });
          itemData.push({
            name: item.tagNameDescribe,
            data: item.chillerPerformanceDetailReportVO
          });
        });
        for (let item2 of itemData) {
          for (let item2Element of item2.data) {
            tempData.push({
              name: item2.name + ' ' + item2Element.dataTime,
              data: item2Element.perHourDatas
            })
          }
        }
        this.xData = tempData
        this.title = tempTitle
        console.log(tempData)
        // console.log(this.xData)
        // console.log(this.xLabel)
      }).catch(console.log);
    }
  }
}
</script>

<style lang="scss" scoped>
.bottom {
  width: 100%;
  //height: 650px;
  height: 70vh;
}
</style>