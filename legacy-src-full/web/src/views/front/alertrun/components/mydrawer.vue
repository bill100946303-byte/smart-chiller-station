<template>
  <el-drawer
    title="详情"
    :visible.sync="drawer"
    direction="rtl"
    :before-close="closedrawer"
    append-to-body
  >
<!--    :close-on-press-escape="false"-->
<!--    :wrapperClosable="false"-->
    <div class="side-show">
      <el-descriptions title="设备信息" :column="1">
        <el-descriptions-item label="设备标识">{{
          formData.deviceIdentify || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="设备编号">{{
          formData.deviceCode || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{
          formData.deviceName || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="安装位置">{{
          formData.installPosition || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="所属系统">{{
          formData.belongSystem || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{
          formData.model || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="性能参数">{{
          formData.functionParam || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="品牌">{{
          formData.brand || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="厂家">{{
          formData.manufactor || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="出厂编号">{{
          formData.factoryNumber || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="使用状态">{{
          formData.useStatus || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="出厂日期">{{
          getTime(formData.productionDate) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="购入日期">{{
          getTime(formData.purchaseDate) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="启用日期">{{
          getTime(formData.startDate) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="使用年限">{{
          formData.serviceLife || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="免职保截止日期">{{
          getTime(formData.warrantyFreeDeadline) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="免质保单位">{{
          getTime(formData.warrantyFreeUnit) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="免质保电话">{{
          formData.warrantyFreeTelephone || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="付费截止日期">{{
          getTime(formData.paymentDeadline) || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="付费单位">{{
          formData.payingUnit || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="绑定设备类型">{{
          formData.drTypeId ? typename : "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="绑定设备">{{
          formData.drId ? devicename : "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{
          formData.remarks || "--"
        }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </el-drawer>
</template>
<script>
import dayjs from 'dayjs'
import { findDeviceType } from "@/api/usersetting/runlog/timealarm";
import { findDevice } from '@/api/contentsetting/varmanage';
import { mapGetters } from 'vuex';
export default {
  props: {
    drawer: Boolean,
    formData: Object
  },
  computed: {
    ...mapGetters(['path'])
  },
  data () {
    return {
      arrlist: [],
      typename: '',
      devicename: '',
      options: []
    }
  },
  watch: {
    formData: {
      handler (val) {
        if (val.drTypeId) {
          this.getDrtype()
        }

        if (val.drTypeId && val.drId) {
          this.getDevice()
        }
      },
      immediate: true
    }
  },
  created () {



  },
  methods: {
    getTime (time) {
      return time ? dayjs(time).format('YYYY-MM-DD') : ''
    },
    closedrawer (done) {
      this.$emit('close')
    },
    getDrtype () {
      let _this = this;
      findDeviceType(this.path).then(res => {
        this.arrlist = res.data;
        function getname (array) {
          for (let index = 0; index < array.length; index++) {
            const element = array[index];

            if (element.drtypeid == _this.formData.drTypeId) {
              console.log('element', element)
              _this.typename = element.drtypename
              return
            } else {
              element.drtypeinfoList && getname(element.drtypeinfoList)
            }
          }
        }
        getname(this.arrlist)

      })

    },
    getDevice () {
      findDevice(this.path, this.formData.drTypeId * 1).then(res => {
        res.data.forEach(element => {
          if (element.drid == this.formData.drId) {
            this.devicename = element.drname
            return
          }
        });
      })

    }
  },
}
</script>
<style lang="scss" scoped>
.side-show {
  padding: 0 14px;
}
</style>