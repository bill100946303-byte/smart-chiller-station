<template>
  <div class="report-search-panel">
    <div class="radio-buttons-container">
    <el-radio-group v-model="radio1" class="report-radio-group" @input="input()">
      <el-radio v-for="(item,index) of list" :key="index" :border="true" :label="item"/>
    </el-radio-group>
    </div>
    <el-form
        ref="forminline"
        :inline="true"
        class="demo-form-inline legacy-front-toolbar__form"
    >
      <el-form-item :label="$t('logrizi.time')" prop="time">
        <el-date-picker
            ref="datepack"
            v-model="time"
            :picker-options="pickerOptions"
            :end-placeholder="$t('meterReading.endTime')"
            placeholder="选择开始时间"
            :start-placeholder="$t('meterReading.startTime')"
            range-separator="-"
            type="datetimerange"
            @change="input"
            prefix-icon="al_element-icons al_icona-huaban1"
        />
      </el-form-item>
      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="leadOut">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportReport') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import dayjs from "dayjs";
import {mapGetters} from "vuex";

export default {
  name: "search",
  data() {
    return {
      pickerOptions: {
        onPick: time => {
          // 选择开始时间未选择结束时间
          if (time.minDate && !time.maxDate) {
            this.timeOptionRange = time.minDate;
          }
          if (time.maxDate) {
            this.timeOptionRange = null;
          }
        },
        disabledDate: time => {
          let timeOptionRange = this.timeOptionRange;
          let secondNum = 1000 * 60 * 60 * 24 * 6;
          if (!timeOptionRange) {
            return time.getTime() > Date.now() - 8.64e6
          }
          if ((timeOptionRange.getTime() + secondNum) > (Date.now() - 8.64e6)) {
            return time.getTime() > Date.now() - 8.64e6 || time.getTime() < timeOptionRange.getTime() - secondNum;
          }
          return time.getTime() > timeOptionRange.getTime() + secondNum || time.getTime() < timeOptionRange.getTime() - secondNum;
        }
      },
      // radio1: '每日冷冻水供回水温度叠加图',
      radio1: this.$t('report.num14'),
      time: [dayjs().subtract(6, 'day').format('YYYY-MM-DD hh:mm:ss'), dayjs().format('YYYY-MM-DD hh:mm:ss')],
      list备份: [
        // '24小时冷负荷曲线室温叠加图', // 图1
        // '冷负荷发生情况的直方图', // 图2
        '每日冷冻水供回水温度叠加图', // 图3
        '每日冷冻水温差叠加图', // 图4
        '凝汽器每日给回水温度叠加图', // 图5
        '冷凝器日温差叠加图', // 图6
        '每日冷冻水GPM/RT的叠加图', // 图7
        '日冷凝器水GPM/RT叠加图', // 图8
        // '冷却塔接近温度', // 图9
        '日冷水效率kW/RT叠加图', // 图10
        '每日冷冻水泵效率kW/RT叠加图', // 图11
        '日凝汽器水泵效率kW/RT叠加图', // 图12
        '冷却塔日效率kW/RT叠加图', // 图13
        '日冷水机组系统效率kW/RT叠加图', // 图14
        // '冷水机组超冷负荷效率散点图', // 图15
        // '冷却水泵超冷负荷效率散点图', // 图16
        // '冷凝器水泵效率散点图', // 图17
        // '冷却塔效率散点图' // 图18
      ],
      list: [
        this.$t('report.num14'), // 图14
        this.$t('report.num10'), // 图10
        this.$t('report.num13'), // 图13
        this.$t('report.num11'), // 图11
        this.$t('report.num12'), // 图12
        // '24小时冷负荷曲线室温叠加图', // 图1
        // '冷负荷发生情况的直方图', // 图2
        this.$t('report.num3'), // 图3
        this.$t('report.num4'), // 图4
        this.$t('report.num5'), // 图5
        this.$t('report.num6'), // 图6
        this.$t('report.num7'), // 图7
        this.$t('report.num8'), // 图8
        // '冷却塔接近温度', // 图9
        // '冷水机组超冷负荷效率散点图', // 图15
        // '冷却水泵超冷负荷效率散点图', // 图16
        // '冷凝器水泵效率散点图', // 图17
        // '冷却塔效率散点图' // 图18
      ]
    }
  },
  created() {
    this.input()
  },
  computed: {
    ...mapGetters(["path", "modelKey", "template"]),
  },
  methods: {
    leadOut() {
      let baseUrl = process.env.VUE_APP_BASE_URL
      let path = this.path
      let startTime = dayjs(this.time[0]).format('YYYY-MM-DD+hh:mm:ss')
      let endTime = dayjs(this.time[1]).format('YYYY-MM-DD+hh:mm:ss')
      let locale = this.$i18n.locale
      let unit = this.$store.getters.unitSelete
      let template = this.template

      let fileUrl = `${baseUrl}/zsqy/chillerperformancecure/${path}/exportPdf?startTime=${startTime}&endTime=${endTime}&language=${locale}&unit=${unit}&modelKey=${this.modelKey}&template=${template}`

      // const fileUrl = 'https://www.ssge.com.cn:8098/zsqy/chillerperformancecure/128feleven/exportPdf?startTime=2024-09-04+09:55:18&endTime=2024-09-10+09:55:18&language=zh&unit=KW&modelKey=128feleven&template=1'; // URL 已经包含文件名
      // 创建一个隐藏的 <a> 标签
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = ''; // 省略文件名以使用 URL 中的文件名

      // 触发点击事件
      document.body.appendChild(link);
      link.click();

      // 移除链接
      document.body.removeChild(link);
    },
    input(val) {
      let info = {
        name: this.radio1,
        startTime: dayjs(this.time[0]).format('YYYY-MM-DD hh:mm:ss'),
        endTime: dayjs(this.time[1]).format('YYYY-MM-DD hh:mm:ss')
      }
      this.$emit('search', info)
    }
  }
}
</script>

<style lang="scss" scoped>
.report-search-panel {
  display: grid;
  gap: 18px;
}

.radio-buttons-container {
  display: block;
  padding: 16px 18px;
  border: 1px solid rgba(122, 210, 255, 0.12);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(9, 23, 39, 0.84) 0%, rgba(7, 18, 31, 0.72) 100%);
}

.report-radio-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

::v-deep .el-radio {
  margin-left: 0 !important;
  margin-bottom: 0;
}

::v-deep .el-radio.is-bordered {
  width: 100%;
  height: 50px;
  margin-right: 0;
  padding: 0 16px;
  border-radius: 14px;
  border-color: rgba(122, 210, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

::v-deep .el-radio__input,
::v-deep .el-radio__inner {
  display: none;
}

::v-deep .el-radio__label {
  padding-left: 0;
  color: rgba(220, 234, 244, 0.78);
  font-weight: 600;
  white-space: normal;
}

::v-deep .el-radio.is-bordered.is-checked {
  border-color: rgba(91, 183, 255, 0.32);
  background: linear-gradient(135deg, rgba(44, 104, 184, 0.38) 0%, rgba(30, 71, 124, 0.2) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

::v-deep .el-radio.is-bordered.is-checked .el-radio__label {
  color: #f5fbff;
}

::v-deep .legacy-front-toolbar__form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: flex-end;
}

::v-deep .el-form-item {
  margin-bottom: 0;
}

::v-deep .el-form-item__label {
  color: rgba(223, 236, 245, 0.82);
}

::v-deep .el-input__inner,
::v-deep .el-range-editor.el-input__inner {
  min-height: 42px;
  border-radius: 12px;
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .el-range-separator,
::v-deep .el-input__icon {
  color: rgba(191, 220, 236, 0.72);
}

.energy-btn {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  border-color: rgba(107, 202, 245, 0.48);
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  color: #fff;
}

.energy-btn__icon {
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 15px;
}
</style>
