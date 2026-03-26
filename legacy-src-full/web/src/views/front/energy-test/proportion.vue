<template >
  <div class="propor-page front-box-show">
    <div class="search panel-card">
      <div class="panel-card__header">
        <div>
          <div class="panel-card__eyebrow">FILTER</div>
          <div class="panel-card__title">负荷比重</div>
        </div>
      </div>
      <el-form :inline="true" class="energy-form-inline">
        <!--        <el-form-item label="时间选择">-->
        <el-form-item :label="$t('public.TimeSelection')">
          <el-form-item>
            <el-radio-group v-model="type" @change="groupchange">
              <el-radio-button :label="$t('public.year')"></el-radio-button>
              <el-radio-button :label="$t('public.month')"></el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-date-picker
              v-model="date"
              :format="dateType === 2 ? 'yyyy-MM' : 'yyyy'"
              :type="pickerType"
              :value-format="dateType === 2 ? 'yyyy-MM' : 'yyyy'"
              prefix-icon="al_element-icons al_icona-huaban1"
          >
          </el-date-picker>
        </el-form-item>
        <el-form-item>
          <el-button class="energy-btn" type="primary" @click="onSubmit">
            <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
            {{ $t('public.search') }}
          </el-button>
          <el-button class="energy-btn" type="primary" @click="exporttable">
            <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
            {{ $t('public.exportData') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="chart panel-card">
      <div class="panel-card__header">
        <div>
          <div class="panel-card__eyebrow">CHART</div>
          <div class="panel-card__title">负荷比重图</div>
        </div>
      </div>
      <PersentEchart :info="echartData" :status="status"/>
    </div>
  </div>
</template>
<script>
import PersentEchart from './components/persentEchart.vue'
import {findLoadSpecificGravity} from '@/api/front/energytest'
import {mapGetters} from 'vuex'
import dayjs from 'dayjs'

export default {
  components: {
    PersentEchart
  },
  computed:{
    ...mapGetters(['path'])
  },
  data () {
    return {
      date: dayjs().format('YYYY-MM'),
      echartData: [],
      type: this.$t('public.month'),
      timelist: {
        年: 3,
        月: 2,
      },
      dateType: 2,
      pickerType: 'month',
      status: 0
    }
  },
  created(){
    this.initData()
  },
  methods: {
    groupchange() {
      this.dateType = this.timelist[this.type]
      console.log('this.dateType', this.dateType)
      if (this.dateType === 3) {
        this.pickerType = 'year'
        this.date = dayjs().format('YYYY')
      } else if (this.dateType === 2) {
        this.pickerType = 'month'
        this.date = dayjs().format('YYYY-MM')
      }
      this.onSubmit();
    },
    initData() {
      this.echartData = []
      this.status = 0
      findLoadSpecificGravity(this.path, {date: this.date, dateType: this.dateType}).then(res => {
        this.echartData = res.data
        this.status = res.status
      })
    },
    exporttable() {
      if (!this.echartData.length) {
        // this.$message.warning("请选择数据后在导出");
        this.$message.warning(this.$t('prompt.pleaseSelectDataExporting'));
        return
      }
       const tHeader = ['负荷区间','负荷比例(%)',' 冷站效能(kw/kw)']
       const arr = new Array(this.echartData.length).fill(0).map(item=>[])
      this.echartData.forEach((element,index) => {
        arr[index].push(element['负荷区间'],element['负荷比重比例'],element['冷站效能'])
      });
       import("@/vender/Export2Excel").then((excel) => {
          excel.export_json_to_excel({
            header: tHeader,
            data:arr,
            filename: "负荷比重",
          });
        });
    },
    onSubmit(){
      if(!this.date){
        this.$message({
          // message: '请选择时间',
          message: this.$t('prompt.pleaseSelect')+this.$t('logrizi.time'),
          type: 'warning'
        });
      }else{
        this.initData()
      }
    }
  }
}
</script>
<style lang="scss" scoped>
.propor-page {
  padding: 0;
  display: grid;
  gap: 14px;

  .panel-card {
    padding: 16px 18px 18px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    border: 1px solid rgba(124, 202, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);
  }

  .panel-card__header {
    margin-bottom: 12px;
  }

  .panel-card__eyebrow {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(171, 205, 225, 0.66);
  }

  .panel-card__title {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
    color: rgba(245, 251, 255, 0.96);
  }

  .energy-form-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    align-items: center;
  }

  .chart {
    height: 65vh;
    min-height: 420px;
  }
}

::v-deep .energy-form-inline .el-form-item__label {
  color: rgba(223, 236, 245, 0.86);
}

::v-deep .energy-form-inline .el-input__inner {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(122, 210, 255, 0.14);
  color: rgba(245, 251, 255, 0.96);
}

.energy-btn {
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  border-color: rgba(75, 179, 233, 0.36);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  border-color: rgba(102, 197, 245, 0.48);
  color: #fff;
}

.energy-btn__icon {
  margin-right: 5px;
}

.energy-btn__icon--export {
  font-size: 17px;
}
</style>
