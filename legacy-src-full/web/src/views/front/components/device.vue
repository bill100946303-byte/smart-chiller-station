<template lang="">
  <el-form-item :label="label" :prop="prop" :required="required">
        <el-cascader
          v-model="deviceType"
          :options="deviceTypeData"
          :show-all-levels="false"
          :placeholder="$t('alertrun_realtime.selectDeviceType')"
          :clearable="!required"
          :props="{
            emitPath:false,
            expandTrigger: 'hover',
            label: 'drtypename',
            label: 'drtypenameCNEN',
            value: 'drtypeid',
            children: 'drtypeinfoList',
          }"
          @change="chooseDeviceType"
        ></el-cascader>
      </el-form-item>
</template>
<script>
import { mapGetters } from "vuex";
import { findDeviceType } from "@/api/usersetting/runlog/timealarm";
export default {
  computed: {
    ...mapGetters(["path"]),
  },
  model: {
    prop: 'drTypeId',
    event: 'change'
  },
  props: {
    label: String,
    drTypeId: Number | String,
    prop:String,
    firstGet:Boolean,
    required:{
      type:Boolean,
      default:false
    }
  },
  
  data () {
    return {
      deviceType: [],
      deviceTypeData: []
    }
  },
  watch: {
    drTypeId (value) {
      this.deviceType = this.filterDrtype(Number(value), this.deviceTypeData)
    }
  },
  created () {
    findDeviceType(this.path).then(res => {
      this.deviceTypeData = res.data || [];
      //回显数据
      if(this.drTypeId){
        this.deviceType = this.filterDrtype(Number(this.drTypeId), this.deviceTypeData)
      }
      
      //如果需要取默认第一项
      if(this.firstGet&&this.deviceTypeData.length){
        this.deviceType = this.getFirstType(this.deviceTypeData)
        this.$emit('change', this.deviceType)
      }
    })
  },
  methods: {
    getFirstType(list){
      if(list[0]['drtypeinfoList']){
        return this.getFirstType(list[0]['drtypeinfoList'])
      }else{
        return list[0]['drtypeid']
      }
    },
    filterDrtype (value, list) {
      let parent = Symbol('parent');
      let result;
      function findparent (arr, p) {
        for (let index = 0; index < arr.length; index++) {
          arr[index][parent] = p;
          if (arr[index].drtypeid == value) {
            result = arr[index]
            return
          } else {
            !result && arr[index].drtypeinfoList && findparent(arr[index].drtypeinfoList, arr[index])
          }
        }

      }
      findparent(list, null)
      let temp = []
      if (!result) return null;
      while (result) {
        temp.unshift(result.drtypeid)
        result = result[parent]
      }
      return temp
    },
    chooseDeviceType () {
      this.$emit('change', this.deviceType)
    }
  },
}
</script>
<style lang="">
</style>