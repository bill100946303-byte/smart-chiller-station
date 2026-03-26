<template>
  <el-dialog
      :append-to-body="true"
      :before-close="handleClose"
      :destroy-on-close="true"
      :visible.sync="showdialog"
      center
      width="75%"
      :title="isEdit ? `编辑设备信息` : `新增设备信息`"
      :close-on-click-modal="false"
      custom-class="legacy-dialog-shell"
  >
    <div slot="title">
      <div v-if="isEdit" class="titleSlot legacy-dialog-shell__title">
        编辑设备信息 <span>注：如需删除请填写“无”</span>
      </div>
      <div v-else class="titleSlot legacy-dialog-shell__title">
        新增设备信息 <span>注：如需删除请填写“无”</span>
      </div>
    </div>
    <el-form
        ref="ruleForm"
        :inline="true"
        :model="formData"
        :rules="rules"
        class="demo-form-inline form-date-picker legacy-dialog-form"
        label-width="110px"
    >
      <el-form-item label="绑定设备类型" prop="drTypeId">
        <!--        <deviceItem v-model="formData.drTypeId" label="绑定设备类型"/>-->
        <deviceItem v-model="formData.drTypeId"/>
      </el-form-item>
      <el-form-item label="绑定设备" prop="drId">
        <!--        <device-info-->
        <!--            v-model="formData.drId"-->
        <!--            :drTypeId="formData.drTypeId"-->
        <!--            label="绑定设备"-->
        <!--        />-->
        <device-info
            v-model="formData.drId"
            :drTypeId="formData.drTypeId"
        />
      </el-form-item>

      <el-form-item label="设备标识" prop="deviceIdentify">
        <el-input clearable v-model="formData.deviceIdentify"></el-input>
      </el-form-item>

      <el-form-item label="设备编号" prop="deviceCode">
        <el-input clearable v-model="formData.deviceCode"></el-input>
      </el-form-item>

      <el-form-item label="设备名称" prop="deviceName">
        <el-input clearable v-model="formData.deviceName"></el-input>
      </el-form-item>

      <el-form-item label="安装位置" prop="installPosition">
        <el-input clearable v-model="formData.installPosition"></el-input>
      </el-form-item>

      <el-form-item label="所属系统" prop="belongSystem">
        <el-input clearable v-model="formData.belongSystem"></el-input>
      </el-form-item>
      <el-form-item label="型号" prop="model">
        <el-input clearable v-model="formData.model"></el-input>
      </el-form-item>

      <el-form-item label="额定功率">
        <el-input clearable v-model="formData.ratedPower"></el-input>
      </el-form-item>
      <el-form-item label="额定扬程">
        <el-input v-model="formData.ratedHead" clearable></el-input>
      </el-form-item>
      <el-form-item label="额定流量">
        <el-input v-model="formData.ratedFlow" clearable></el-input>
      </el-form-item>
      <el-form-item label="额定冷量">
        <el-input v-model="formData.ratedCoolingCapacity" clearable></el-input>
      </el-form-item>

      <el-form-item label="外形尺寸">
        <el-input v-model="formData.overallDimension" clearable></el-input>
      </el-form-item>

      <el-form-item label="品牌" prop="brand">
        <el-input clearable v-model="formData.brand"></el-input>
      </el-form-item>

      <el-form-item label="厂家" prop="manufactor">
        <el-input clearable v-model="formData.manufactor"></el-input>
      </el-form-item>

      <el-form-item label="性能参数" prop="functionParam" class="functionParamStyle legacy-dialog-form__full">
        <el-input v-model="formData.functionParam" clearable type="textarea" style="width: 100%; "></el-input>
      </el-form-item>

      <el-form-item label="出厂编号" prop="factoryNumber">
        <el-input clearable v-model="formData.factoryNumber"></el-input>
      </el-form-item>
      <el-form-item label="使用状态" prop="useStatus">
        <el-input clearable v-model="formData.useStatus"></el-input>
      </el-form-item>
      <el-form-item label="重量">
        <el-input v-model="formData.weight" clearable></el-input>
      </el-form-item>
      <el-form-item label="出厂日期" prop="productionDate">
        <el-date-picker
            v-model="formData.productionDate"
            placeholder="选择日期"
            type="month"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="购入日期" prop="purchaseDate">
        <el-date-picker
            v-model="formData.purchaseDate"
            placeholder="选择日期"
            type="date"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="启用日期" prop="startDate">
        <el-date-picker
            v-model="formData.startDate"
            placeholder="选择日期"
            type="date"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="使用年限" prop="serviceLife">
        <el-input clearable v-model="formData.serviceLife"></el-input>
      </el-form-item>
      <el-form-item label="免职保截止日期" prop="warrantyFreeDeadline">
        <el-date-picker
            v-model="formData.warrantyFreeDeadline"
            placeholder="选择日期"
            type="date"
        >
        </el-date-picker>
      </el-form-item>

      <el-form-item label="免质保单位" prop="warrantyFreeUnit">
        <el-input clearable v-model="formData.warrantyFreeUnit"></el-input>
      </el-form-item>
      <el-form-item label="免质保电话" prop="warrantyFreeTelephone">
        <el-input clearable v-model="formData.warrantyFreeTelephone"></el-input>
      </el-form-item>
      <el-form-item label="付费截止日期" prop="paymentDeadline">
        <el-date-picker
            v-model="formData.paymentDeadline"
            placeholder="选择日期"
            type="date"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="付费单位" prop="payingUnit">
        <el-input clearable v-model="formData.payingUnit"></el-input>
      </el-form-item>

      <el-form-item label="备注" prop="remarks">
        <el-input
            v-model="formData.remarks"
            :rows="2"
            type="textarea"
        ></el-input>
      </el-form-item>
    </el-form>

    <span slot="footer" class="dialog-footer">
      <el-button @click="Closedialog">取 消</el-button>
      <el-button type="primary" @click="submitBook">确 定</el-button>
    </span>
  </el-dialog>
</template>
<script>
import {insert, update} from '@/api/front/alarm'
import {handlePost} from '@/utils/handlepost'
import {mapGetters} from 'vuex'
import deviceItem from '../../components/device.vue'
import deviceInfo from '../../components/deviceItem.vue'

export default {
  props: {
    showdialog: {
      type: Boolean,
      default: true,
    },
    isEdit: {
      type: Boolean,
      default: false,
    },
    formDataback: Object
  },
  computed: {
    ...mapGetters(['path'])
  },
  components: {deviceItem, deviceInfo},
  watch: {
    formDataback(val) {
      console.log("formDataback 变化:", val,this.formData);
      if (val.hasOwnProperty('deviceCode')) {
        this.formData = this.formDataback
      } else {
        // this.formData = {}
        console.log("222 变化:", this.formData);
        this.$nextTick(() => {
          this.formData = {
            deviceIdentify: '',
            deviceCode: '',
            deviceName: '',
            installPosition: '',
            belongSystem: '',
            model: '',
            functionParam: '',
            brand: '',
            manufactor: '',
            factoryNumber: '',
            useStatus: '',
            productionDate: '',
            purchaseDate: '',
            startDate: '',
            serviceLife: '',
            warrantyFreeDeadline: '',
            warrantyFreeUnit: '',
            warrantyFreeTelephone: '',
            paymentDeadline: '',
            payingUnit: '',
            drTypeId: '',
            drId: '',
            remarks: ''
          }
          this.$refs.ruleForm.resetFields()
        })
        console.log("3333 变化:", this.formData);
      }
    },
  },
  data() {
    return {
      // mes:  '<span>如需删除请填写“无”</span>',
      //表单信息
      formData: {
        deviceIdentify: '',
        deviceCode: '',
        deviceName: '',
        installPosition: '',
        belongSystem: '',
        model: '',
        functionParam: '',
        brand: '',
        manufactor: '',
        factoryNumber: '',
        useStatus: '',
        productionDate: '',
        purchaseDate: '',
        startDate: '',
        serviceLife: '',
        warrantyFreeDeadline: '',
        warrantyFreeUnit: '',
        warrantyFreeTelephone: '',
        paymentDeadline: '',
        payingUnit: '',
        drTypeId: '',
        drId: '',
        remarks: ''
      },
      //表单验证
      rules: {
        deviceName: [
          {required: true, message: "请输入设备名称", trigger: "change"},
        ],
        deviceCode: [
          {required: true, message: "请输入设备编号", trigger: "change"},
        ],
        drTypeId: [
          {required: true, message: "请绑定设备类型", trigger: "change"},
        ],
        drId: [
          {required: true, message: "请绑定设备", trigger: "change"},
        ],
      },
    }
  },
  methods: {
    handleClose(done) {
      this.$emit('close')
      this.$refs.ruleForm.resetFields();
    },
    Closedialog() {
      this.$emit('close')
      this.$refs.ruleForm.resetFields();
    },
    handleEdit() {
      update(this.path, handlePost(this.formData)).then(res => {
        this.$emit('close')
      })
    },
    handleadd() {
      insert(this.path, handlePost(this.formData)).then(res => {
        this.$emit('close')
        this.$refs.ruleForm.resetFields()
      })
    },
    //提交信息
    submitBook() {
      this.$refs.ruleForm.validate((valid) => {
        if (valid) {
          if (this.isEdit) {
            this.handleEdit()
          } else {
            this.handleadd()
          }
        } else {
          return false;
        }
      });
    },
  },
}
</script>
<style lang="scss" scoped>
.form-date-picker {
  .el-date-editor.el-input, .el-date-editor.el-input__inner {
    width: 242px;
  }
}

.titleSlot {
  line-height: 24px;
  font-size: 18px;
  color: rgba(243, 251, 255, 0.96);

  span {
    margin-left: 6px;
    font-size: 13px;
    color: rgba(192, 217, 235, 0.72);
  }
}
</style>
<style lang="scss">
.functionParamStyle {
  display: block;
  clear: both;
  margin-right: 0 !important;

  .el-form-item__content {
    width: 80%;
  }
}
</style>
