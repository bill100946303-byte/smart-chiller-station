<template>
  <el-dialog
    :title="isEdit ? '修改工单信息' : '新增工单信息'"
    :visible.sync="VisibleTemp"
    :append-to-body="true"
    width="450"
    custom-class="legacy-dialog-shell"
    @close='handleCancel'
  >
    <el-form class="legacy-dialog-form" label-position="left" label-width="120px" :rules="rules" ref="formbox" :model="editData">
      <Device label="设备类型" v-model="editData.drtypeid" :required="true"/>
      <DeviceItem
      :required="true"
        label="设备"
        v-model="editData.drid"
        :drTypeId="editData.drtypeid"
      />
      <el-form-item label="派单时间" prop="worktime">
        <el-date-picker
          v-model="editData.worktime"
          type="datetime"
          placeholder="请选择派单时间"
        />
      </el-form-item>
      <el-form-item label="派单人">
        <el-input
          v-model="editData.workuser"
          class="ipt"
          type="text"
          readonly
        />
      </el-form-item>
      <el-form-item label="工单级别" prop="worklevel" >
        <el-select v-model="editData.worklevel" placeholder="请选择工单级别">
          <el-option
            v-for="item in orderLevelOptions"
            :key="item.value"
            :label="item.value"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="接单人" prop="executeuser">
        <el-select v-model="editData.executeuser" placeholder="请选择接单人">
          <el-option
            v-for="item in acceptManOptions"
            :key="item.id"
            :label="item.username"
            :value="item.username"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="工单处理时间" prop="executetime">
        <el-date-picker
          v-model="editData.executetime"
          type="datetime"
          placeholder="请选择工单处理时间"
        />
      </el-form-item>
      <el-form-item label="工单完成时间" prop="finishtime">
        <el-date-picker
          v-model="editData.finishtime"
          type="datetime"
          placeholder="请选择工单完成时间"
        />
      </el-form-item>
      <el-form-item label="工单状态" prop="state">
        <el-select v-model="editData.state" placeholder="请选择工单状态">
          <el-option
            v-for="item in orderStatusOptions"
            :key="item.value"
            :label="item.value"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="工单描述">
        <el-input
          v-model="editData.workexplain"
          type="textarea"
          :rows="4"
          placeholder="请输入工单描述"
        />
      </el-form-item>
    </el-form>
    <span slot="footer" class="dialog-footer">
      <el-button @click="handleCancel">取 消</el-button>
      <el-button type="primary" @click="handleSubmit">确 定</el-button>
    </span>
  </el-dialog>
</template>

<script>
import {addOrder, updateOrder,} from "@/api/usersetting/deviceoperation/ordermanage";
import {userfindAll} from "@/api/front/home";
import Device from "../components/device.vue";
import DeviceItem from "../components/deviceItem.vue";
import {mapGetters} from "vuex";
import {handlePost} from '@/utils/handlepost'
import rules from './rule'

export default {
  props: {
    Visible: {
      type: Boolean,
      default: false,
    },
    isEdit: Boolean,
    editinfo:Object
  },
  computed: {
    ...mapGetters(["path", "name",'userid']),
  },
  components: {
    Device,
    DeviceItem,
  },
  watch: {
    Visible: {
      handler(value) {
        this.VisibleTemp = value
        if (value && this.isEdit) {
            console.log('editinfo',this.editinfo)
            this.editData = this.editinfo;
        } else {
          this.editData = {
            drtypeid: "", // 选择的设备类型id
            drtypename: "", // 选择的设备
            dispatchTime: "", // 派单时间
            workuser: this.name,
            worklevel: "", // 工单级别
            executeuser: "", // 接单人
            executetime: "", // 工单处理时间
            finishtime: "", // 工单完成时间
            state: "", // 工单状态
            workexplain: "", // 工单描述
          };
        }
      },
      immediate: true,
    },
  },
  data() {
    return {
        rules:rules,
      editData: {
        drtypeid: "", // 选择的设备类型id
        drid: "", // 选择的设备
        dispatchTime: "", // 派单时间
        workuser: this.name,
        worklevel: "", // 工单级别
        executeuser: "", // 接单人
        executetime: "", // 工单处理时间
        finishtime: "", // 工单完成时间
        state: "", // 工单状态
        workexplain: "", // 工单描述
      },
      acceptManOptions: [],
      orderLevelOptions: [
        {
          id: 1,
          value: "紧急",
        },
        {
          id: 2,
          value: "中等",
        },
        {
          id: 3,
          value: "一般",
        },
      ], // 工单级别选项
      orderStatusOptions: [
        {
          id: 1,
          value: "待处理",
        },
        {
          id: 2,
          value: "处理中",
        },
        {
          id: 3,
          value: "已完成",
        },
      ],
      VisibleTemp: this.visible
    };
  },
  created() {
    this.editData.workuser = this.name;
    // 查询所有派单人
    userfindAll({userId:this.userid})
      .then((res) => {
        this.acceptManOptions = res.data;
      })
      .catch(console.log);
  },
  methods: {
    handleCancel() {
      this.$emit("close");
    },
    handleSubmit() {
        this.$refs.formbox.validate((valid) => {
            if(valid){
                if (this.isEdit) {
                    this.handleEdit();
                } else {
                    this.handleAdd();
                }
            }else{
                return false
            }
        })
    },
    // 新增
    handleAdd() {
      addOrder(this.path, handlePost(this.editData))
        .then((res) => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("新增成功!");
            this.$refs.formbox.resetFields()
            this.$emit("reload");
          }
        })
        .catch(console.log);
    },
    // 修改
    handleEdit(index, row) {
        updateOrder(this.path, handlePost(this.editData))
        .then((res) => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("修改成功!");
            this.$refs.formbox.resetFields()
            this.$emit("reload");
          }
        })
        .catch(console.log);
      
    },
  },
};
</script>

<style lang="scss">
.ipt {
  width: 100% !important;
}
</style>
