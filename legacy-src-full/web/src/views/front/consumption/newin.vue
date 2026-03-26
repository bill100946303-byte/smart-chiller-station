<template>
  <!--热不平衡 -->
  <div class="compare-page front-box-show">
    <div class="search-form">
      <form-search @handleSearch="handleSearch" :searchinfo="searchinfo" @exporttable="exporttable"/>
    </div>
    <div class="electric_page front-box-show">
      <div class="line_echart">
        <lineEchart
          :xData="totalEnergyDataY"
          :xLabel="xLabel"
          :unit="unit"
          style="width: 100%; height: 100%"
        />
      </div>
    </div>

    <div class="table_list">
      <el-table
        :data="tableData"
        :header-cell-style="{
          background: 'rgba(19, 115, 153, 1)',
          color: '#fff',
        }"
        style="width: 100%"
      >
        <el-table-column
            class-name="front-column"
            prop="objName"
            :label="$t('consumption.object')"
            align="center"
        ><!--对象-->
        </el-table-column>
        <el-table-column
            class-name="front-column"
            prop="sumValue"
            :label="$t('consumption.totalValue')+'（'+$store.getters.unitSelete+'*h）'"
            align="center"
        ><!--总值-->
        </el-table-column>
        <el-table-column
            class-name="front-column"
            prop="maxValue"
            :label="`${$t('consumption.peakValue')}（${$store.getters.unitSelete}*h）`"
            align="center"
        ><!--峰值-->
        </el-table-column>
           <el-table-column
               class-name="front-column"
               prop="maxTime"
               :label="$t('consumption.timeOfOccurrence')"
               align="center"
        ><!--出现时间-->
        </el-table-column>
           <el-table-column
               class-name="front-column"
               prop="minValue"
               :label="$t('consumption.valleyValue')+'（'+$store.getters.unitSelete+'*h）'"
               align="center"
        ><!--谷值-->
        </el-table-column>
           <el-table-column
               class-name="front-column"
               prop="minTime"
               :label="$t('consumption.timeOfOccurrence')"
               align="center"
        ><!--出现时间-->
        </el-table-column>
           <el-table-column
               class-name="front-column"
               prop="average"
               :label="$t('consumption.averageValue')+'（'+$store.getters.unitSelete+'*h）'"
               align="center"
        ><!--平均值-->
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import formSearch from './components/formSearch.vue';
import electricTabEchart from "@/views/front/energy-test/components/electricTabEchart.vue";
import lineEchart from "./components/lineEchart.vue";
import {getEnergyAnalysisCurveByDr} from '@/api/front/energytest'
import { mapGetters } from 'vuex';
import dayjs from 'dayjs';
export default {
  components: {
    electricTabEchart,
    lineEchart,
    formSearch,
  },
  props: {},
  data() {
    return {
      unit:'',
      searchinfo :{
        drIds:[],
        endTime:dayjs().format('YYYY-MM-DD'),
        startTime:dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      },
      totalEnergyDataY: [
      ],
      tableData: [
     
      ],
      xLabel:[]
    };
  },
  watch: {},
  computed: {
    ...mapGetters(['path'])
  },
  created() {
  },
  mounted() {},
  methods: {
    handleSearch(info){
      let sers = {...info}
      sers.drIds = info.drIds.join(',')
      getEnergyAnalysisCurveByDr(this.path,sers).then(res=>{
        console.log(res.data,"***************");
        // title
        this.tableData = res.data

        this.totalEnergyDataY = res.data.map(item=>{
          return item.runParamsCurveVO.curveValueList
        })
        console.log(this.totalEnergyDataY)
        this.unit = res.data[0].runParamsCurveVO.unit;
        console.log('this.tableData',this.tableData);
        this.xLabel = res.data.map(item=>{
          return item.objName
        })
      })
    },
    exporttable(){
      if(!this.totalEnergyDataY.length){
        // this.$message.warning("请选择数据后在导出")
        this.$message.warning(this.$t('prompt.pleaseSelectDataExporting'))
        return
      }else{

        console.log('this.totalEnergyDataY',this.totalEnergyDataY,this.xLabel);
        import("@/vender/Export2Excel").then(excel => {
          const tHeader = ['时间',...this.xLabel];
          let len = tHeader.length
          const arr = new Array(this.totalEnergyDataY[0].length).fill(0).map(item=>[])
          for (let i = 0; i < arr.length; i++) {
            let item  = arr[i]
            for (let j = 0; j < len; j++) {
              if(j===0){
                item[j] = this.totalEnergyDataY[0][i]['name']
              }else{
                //[时间，value] i=0 [this.totalEnergyDataY[0][0].value,this.totalEnergyDataY[1][0].value]
                item[j] = this.totalEnergyDataY[j-1][i]['value']
              }
            }
          }
          excel.export_json_to_excel({
            header: tHeader,
            data:arr,
            filename: "能耗分析"
          });
        });
      }
    }
  },
  
};
</script>
<style lang="scss" scoped>
.compare-page {
  padding: 0px 60px 0 45px;
}
.electric_page {
  width: 100%;
  height: 600px;
}

.line_echart {
  width: 100%;
  height: 100%;
  // background:red;
}

.table_list {
  margin-top: 50px;
}


</style>