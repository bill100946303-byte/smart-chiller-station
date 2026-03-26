<template >
  <div class="form-home">
    <el-form :inline="true" :model="formInline" class="demo-form-inline" ref="formInline">
      <el-row :gutter="20" style="width: 100%">
        <el-col :span="5">
          <el-form-item :label="$t('userHomePage.coldStationName')" label="冷站名称" prop="appName">
            <el-input v-model.trim="formInline.appName" :placeholder="$t('userHomePage.pleaseEnter')"
                      placeholder="请输入"></el-input>
          </el-form-item>
        </el-col>
        <el-col :span="5">
          <el-form-item :label="$t('userHomePage.customerName')" label="客户名称" prop="customer">
            <el-input v-model.trim="formInline.customer" :placeholder="$t('userHomePage.pleaseEnter')"
                      placeholder="请输入"></el-input>
          </el-form-item>
        </el-col>

        <city-select :cityName="formInline.city" :provinceName="formInline.region" @selectChange="selectChange"/>

        <!--      <el-form-item label="运行状态" :label="$t('userHomePage.runningState')" prop="runState">
                <el-select v-model="formInline.runState" placeholder="请选择" :placeholder="$t('userHomePage.pleaseSelect')">
                  <el-option :label="item.label" :value="item.value" v-for="(item,index) in runstatus" :key="index"></el-option>
                </el-select>
              </el-form-item>-->
        <el-col :span="4">
          <el-form-item>
            <el-button class="search-btn" type="primary" @click="onSubmit"
            >{{ $t('public.search') }}
            </el-button
            >
            <el-button class="reset-btn" type="text" @click="resetform"
            >{{ $t('userHomePage.remakeFilteringCriteria') }}
            </el-button
            >
          </el-form-item>
        </el-col>

      </el-row>
    </el-form>
  </div>
</template>
<script>
import CitySelect from '@/components/ProvinceCity/index'
import {handlePost} from '@/utils/handlepost'
import {mapGetters} from 'vuex'
export default {
  data () {
    return {
      formInline: {
        appName:'',
        runState:'',
        region:'',
        city:'',
        customer:'',
      },
      runstatus:[
        {
          label:'运行中',
          value:1
        },
        {
          label:'已停止',
          value:0
        }
      ]
    }
  },
  computed: {
    ...mapGetters(['userid'])
  },
  components:{
    CitySelect
  },
  methods: {
    onSubmit () {
      this.formInline.userId = this.userid
      let obj = handlePost(this.formInline)
      this.$emit('handleSearch',obj)
    },
    resetform(){
      this.$refs.formInline.resetFields();
      this.formInline.region = ''
      this.formInline.city = ''
      this.$emit('handleSearch',{})
    },
    selectChange(province,city){
      this.formInline.city = city;
      this.formInline.region = province;
    }
  }
}
</script>
<style lang="scss" >
.form-home {
  //padding: 24px 0 0px 75px;
  padding: 10px 0 0px 10px;
  background: #081e36;

  .el-form-item__label {
    font-weight: normal;
    color: #ffffff;
  }

  .el-form-item {
    //margin-right: 10px !important;
  }

  .search-btn {
    border: 1px solid #3c9bff;
    background: #2b5d93;
  }
  .reset-btn {
    font-weight: normal;
    /* font-size: 19px; */
    color: #fff;
  }
}
</style>