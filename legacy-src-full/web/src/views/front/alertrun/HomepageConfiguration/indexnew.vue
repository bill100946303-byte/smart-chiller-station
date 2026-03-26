<template>
  <div class="dynamic-form-container">
    <!-- 操作按钮区域 -->
    <div class="action-buttons">
      <el-button
          icon="el-icon-plus"
          type="primary"
          @click="handleSave"
          :loading="saving"
          :disabled="!isFormValid">
        保存
      </el-button>
      <el-button
          v-if="formData.length < 6"
          class="add-form-group"
          @click="addFormGroup"
          icon="el-icon-document-add">
        新增表格组
      </el-button>
    </div>

    <!-- 动态表单区域 -->
    <div class="table-container">
      <el-row :gutter="20">
        <el-col
            v-for="(form, index) in formData"
            :key="getFormKey(form, index)"
            :xs="24" :sm="12" :md="12" :lg="8"
            class="form-col">

          <el-card class="form-card" shadow="hover">
            <!-- 表头区域 -->
            <div slot="header" class="form-header">
              <span class="form-title">表格组 {{ index + 1 }}</span>
              <el-button
                  class="delete-group-btn"
                  icon="el-icon-delete"
                  type="danger"
                  size="mini"
                  @click="deleteFormGroup(index)"
                  :disabled="formData.length <= 1">
                删除组
              </el-button>
            </div>

            <!-- 表头输入 -->
            <div class="header-input">
              <el-input
                  v-model="form.title"
                  placeholder="请输入表头名称"
                  maxlength="50"
                  show-word-limit>
                <template slot="prepend">表头：</template>
              </el-input>
            </div>

            <!-- 表单项循环 -->
            <el-form
                ref="dynamicForm"
                :model="form"
                class="dynamic-form"
                label-width="100px">

              <el-form-item
                  v-for="(formItem, itemIndex) in form.formItem"
                  :key="getFormItemKey(form, itemIndex)"
                  :label="`项目 ${itemIndex + 1}`"
                  :prop="`formItem.${itemIndex}.name`"
                  :rules="[{ required: true, message: '请输入项目名称', trigger: 'blur' }]">

                <!-- 项目名称输入 -->
                <div class="form-item-content">
                  <el-input
                      v-model="formItem.name"
                      placeholder="请输入项目名称"
                      class="item-name-input"
                      clearable>
                  </el-input>

                  <!-- 级联选择器循环 -->
                  <div class="cascader-group">
                    <div
                        v-for="(cascaderItem, cascaderIndex) in formItem.cascaderFor"
                        :key="getCascaderKey(form, itemIndex, cascaderIndex)"
                        class="cascader-item">

                      <el-cascader
                          :ref="`cascader${index}_${itemIndex}_${cascaderIndex}`"
                          v-model="cascaderItem.regId"
                          :options="pointPositionData"
                          placeholder="请选择点位"
                          :props="cascaderProps"
                          :clearable="true"
                          :filterable="true"
                          :show-all-levels="false"
                          @change="handleCascaderChange(index, itemIndex, cascaderIndex)"
                          class="cascader-input"
                          :class="{ 'has-error': !cascaderItem.regId }">
                      </el-cascader>

                      <!-- 单个级联选择器删除按钮 -->
                      <el-button
                          v-if="formItem.cascaderFor.length > 1"
                          icon="el-icon-remove"
                          type="danger"
                          size="mini"
                          circle
                          @click="deleteCascaderItem(index, itemIndex, cascaderIndex)"
                          class="delete-cascader-btn">
                      </el-button>
                    </div>
                  </div>

                  <!-- 级联选择器操作按钮 -->
                  <div class="cascader-actions">
                    <el-button
                        icon="el-icon-circle-plus"
                        type="success"
                        size="mini"
                        @click="addCascaderItem(index, itemIndex)">
                      增加点位
                    </el-button>
                    <el-button
                        icon="el-icon-remove"
                        type="danger"
                        size="mini"
                        @click="deleteFormItem(index, itemIndex)"
                        :disabled="form.formItem.length <= 1">
                      删除项目
                    </el-button>
                  </div>
                </div>
              </el-form-item>

              <!-- 添加新表单项 -->
              <div class="add-form-item-btn">
                <el-button
                    icon="el-icon-plus"
                    type="primary"
                    @click="addFormItem(index)"
                    plain>
                  新增项目
                </el-button>
              </div>
            </el-form>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 数据统计信息 -->
    <div class="stats-info" v-if="showStats">
      <el-alert
          :title="`共 ${totalForms} 个表格组，${totalItems} 个项目，${totalCascaders} 个点位`"
          type="info"
          :closable="false"
          show-icon>
      </el-alert>
    </div>
  </div>
</template>

<script>
import { findAllByDrTypeId } from "@/api/deviceinformation";
import { findByDrTypeIdAndDrId } from "@/api/contentsetting/information";
import { findAllDrtypeOfDevice } from "@/api/usersetting/runlog/timealarm";
import { findDevice } from '@/api/contentsetting/varmanage';
import { mapGetters } from "vuex";

export default {
  name: "DynamicTableForm",
  props: {
    drId: {
      type: [String, Number],
      default: 0
    },
    drTypeId: {
      type: [String, Number],
      default: 0
    }
  },
  data() {
    return {
      // 表单数据
      formData: [],

      // 点位数据
      pointPositionData: [],
      pointPositionDataAll: [],

      // 设备相关数据
      deviceTypeData: [],
      options: [],

      // 状态管理
      saving: false,
      loading: false,
      firstGet: true,
      showStats: true,

      // 级联选择器配置
      cascaderProps: {
        emitPath: false,
        expandTrigger: 'hover',
        label: 'drnameCNEN',
        value: 'drtypeid',
        children: 'reglist',
        checkStrictly: true // 允许选择任意级别
      },

      // 表单配置
      formConfig: {
        maxFormGroups: 6,
        minFormItems: 1,
        minCascaders: 1
      }
    };
  },
  computed: {
    ...mapGetters(["path"]),

    // 表单验证状态
    isFormValid() {
      return this.formData.length > 0 &&
          this.formData.every(form =>
              form.formItem.every(item =>
                  item.name && item.name.trim() &&
                  item.cascaderFor.every(cascader => cascader.regId)
              )
          );
    },

    // 统计信息
    totalForms() {
      return this.formData.length;
    },

    totalItems() {
      return this.formData.reduce((total, form) => total + form.formItem.length, 0);
    },

    totalCascaders() {
      return this.formData.reduce((total, form) =>
          total + form.formItem.reduce((itemTotal, item) =>
          itemTotal + item.cascaderFor.length, 0), 0);
    }
  },
  watch: {
    drId: {
      handler(val) {
        if (val && val != 0) {
          this.loadEquipmentData();
        }
      },
      immediate: true,
      deep: true
    },

    'formData': {
      handler() {
        this.$emit('form-change', this.getSubmitData());
      },
      deep: true
    }
  },
  created() {
    this.initializeData();
    this.loadDeviceData();
  },
  methods: {
    // 初始化数据
    initializeData() {
      this.formData = this.getInitialFormData();
    },

    // 获取初始表单数据
    getInitialFormData() {
      return [
        {
          index: 0,
          title: '',
          formItem: this.getInitialFormItems()
        }
      ];
    },

    // 获取初始表单项
    getInitialFormItems() {
      return [
        {
          name: '',
          cascaderFor: [{ regId: null }]
        }
      ];
    },

    // 加载设备数据
    async loadDeviceData() {
      try {
        this.loading = true;

        const [positionRes, deviceRes] = await Promise.all([
          findAllByDrTypeId(this.path),
          findAllDrtypeOfDevice(this.path)
        ]);

        // 处理点位数据
        this.processPositionData(positionRes.data);

        // 处理设备类型数据
        this.deviceTypeData = deviceRes.data || [];

        // 回显数据处理
        this.handleEchoData();

      } catch (error) {
        console.error('加载设备数据失败:', error);
        this.$message.error('设备数据加载失败');
      } finally {
        this.loading = false;
      }
    },

    // 处理点位数据
    processPositionData(data) {
      data.forEach(item => {
        if (item.reglist) {
          item.reglist.forEach(reg => {
            reg.drnameCNEN = reg.regName;
            reg.drtypeid = reg.regId;
          });
        }
      });
      this.pointPositionData = data;
      this.pointPositionDataAll = data;
    },

    // 处理回显数据
    handleEchoData() {
      if (this.drTypeId) {
        this.formInline.drTypeId = this.filterDrtype(Number(this.drTypeId), this.deviceTypeData);
      }

      if (this.firstGet && this.deviceTypeData.length) {
        this.formInline.drTypeId = this.getFirstType(this.deviceTypeData);
        this.firstGet = false;
      }
    },

    // 加载设备信息
    async loadEquipmentData() {
      if (!this.pointPositionDataAll.length) {
        await this.loadPositionData();
      }
      await this.equipmentInformation();
    },

    // 加载点位数据
    async loadPositionData() {
      try {
        const res = await findAllByDrTypeId(this.path);
        this.processPositionData(res.data);
      } catch (error) {
        console.error('加载点位数据失败:', error);
      }
    },

    // 设备信息查询
    async equipmentInformation() {
      try {
        this.pointPositionData = [];

        if (!this.pointPositionDataAll.length) {
          console.warn('点位数据未加载完成');
          return;
        }

        // 过滤当前设备的点位数据
        const targetDevice = this.pointPositionDataAll.find(item =>
            item.drid === this.drId
        );
        if (targetDevice && targetDevice.reglist) {
          this.pointPositionData = targetDevice.reglist;
        }

        // 查询表单数据
        const res = await findByDrTypeIdAndDrId(this.path, {
          drId: this.drId,
          drTypeId: this.drTypeId
        });

        if (res.status === 20000 && res.data.data) {
          this.formData = this.normalizeFormData(res.data.data);
        } else {
          this.formData = this.getInitialFormData();
        }

        this.modifyLoad(res.data.load);

      } catch (error) {
        console.error('查询设备信息失败:', error);
        this.formData = this.getInitialFormData();
        this.modifyLoad(0);
      }
    },

    // 标准化表单数据
    normalizeFormData(data) {
      if (!Array.isArray(data)) return this.getInitialFormData();

      return data.map((form, index) => ({
        index: form.index || index,
        title: form.title || '',
        formItem: Array.isArray(form.formItem) ? form.formItem.map(item => ({
          name: item.name || '',
          cascaderFor: Array.isArray(item.cascaderFor) ?
              item.cascaderFor.map(cascader => ({
                regId: cascader.regId || null
              })) : [{ regId: null }]
        })) : this.getInitialFormItems()
      }));
    },

    // 获取第一个类型
    getFirstType(list) {
      if (!list || !list.length) return null;
      if (list[0].drtypeinfoList) {
        return this.getFirstType(list[0].drtypeinfoList);
      }
      return list[0].drtypeid || null;
    },

    // 修改加载状态
    modifyLoad(val) {
      this.formInline.load = val === null || val === undefined ? 0 : val;
    },

    // 设备名称查询
    async deviceName() {
      try {
        const res = await findDevice(this.path, this.formInline.drTypeId);
        this.options = res.data.map(element => ({
          label: element.drnameCNEN || element.drname,
          value: element.drid
        }));

        if (this.firstGet && this.options.length) {
          this.formInline.drId = this.options[0].value;
          this.$emit('change', this.formInline.drId);
        }
      } catch (error) {
        console.error('查询设备名称失败:', error);
      }
    },

    // 键值生成方法
    getFormKey(form, index) {
      return `form_${form.index}_${index}_${Date.now()}`;
    },

    getFormItemKey(form, itemIndex) {
      return `item_${form.index}_${itemIndex}_${Date.now()}`;
    },

    getCascaderKey(form, itemIndex, cascaderIndex) {
      return `cascader_${form.index}_${itemIndex}_${cascaderIndex}_${Date.now()}`;
    },

    // 新增表格组
    addFormGroup() {
      if (this.formData.length >= this.formConfig.maxFormGroups) {
        this.$message.warning(`最多只能创建 ${this.formConfig.maxFormGroups} 个表格组`);
        return;
      }

      const maxIndex = this.formData.length > 0 ?
          Math.max(...this.formData.map(item => item.index)) : 0;

      this.formData.push({
        index: maxIndex + 1,
        title: `表格组 ${maxIndex + 2}`,
        formItem: this.getInitialFormItems()
      });
    },

    // 删除表格组
    deleteFormGroup(index) {
      if (this.formData.length <= 1) {
        this.$message.warning('至少保留一个表格组');
        return;
      }

      this.$confirm('确定删除这个表格组吗？', '提示', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }).then(() => {
        this.formData.splice(index, 1);
        this.$message.success('删除成功');
      }).catch(() => {});
    },

    // 新增表单项
    addFormItem(formIndex) {
      if (!this.formData[formIndex]) return;

      this.formData[formIndex].formItem.push({
        name: '',
        cascaderFor: [{ regId: null }]
      });
    },

    // 删除表单项
    deleteFormItem(formIndex, itemIndex) {
      if (!this.formData[formIndex] ||
          !this.formData[formIndex].formItem[itemIndex]) return;

      if (this.formData[formIndex].formItem.length <= this.formConfig.minFormItems) {
        this.$message.warning(`每个表格组至少保留 ${this.formConfig.minFormItems} 个项目`);
        return;
      }

      this.$confirm('确定删除这个项目吗？', '提示', {
        type: 'warning'
      }).then(() => {
        this.formData[formIndex].formItem.splice(itemIndex, 1);
        this.$message.success('删除成功');
      }).catch(() => {});
    },

    // 新增级联选择器
    addCascaderItem(formIndex, itemIndex) {
      if (!this.formData[formIndex] ||
          !this.formData[formIndex].formItem[itemIndex]) return;

      if (!this.formData[formIndex].formItem[itemIndex].cascaderFor) {
        this.$set(this.formData[formIndex].formItem[itemIndex], 'cascaderFor', []);
      }

      this.formData[formIndex].formItem[itemIndex].cascaderFor.push({
        regId: null
      });
    },

    // 删除级联选择器
    deleteCascaderItem(formIndex, itemIndex, cascaderIndex) {
      const cascaders = this.formData[formIndex].formItem[itemIndex].cascaderFor;
      if (!cascaders || cascaders.length <= this.formConfig.minCascaders) {
        this.$message.warning(`每个项目至少保留 ${this.formConfig.minCascaders} 个点位`);
        return;
      }

      cascaders.splice(cascaderIndex, 1);
    },

    // 级联选择器变化处理
    handleCascaderChange(formIndex, itemIndex, cascaderIndex) {
      const selectedValue = this.formData[formIndex].formItem[itemIndex].cascaderFor[cascaderIndex].regId;
      this.$emit('cascader-change', {
        formIndex,
        itemIndex,
        cascaderIndex,
        value: selectedValue
      });
    },

    // 保存数据
    async handleSave() {
      // 表单验证
      if (!this.validateForm()) {
        this.$message.error('请完善表单数据');
        return;
      }

      try {
        this.saving = true;
        const submitData = this.getSubmitData();
        await this.sendRequest(submitData);
        this.$message.success('保存成功');
      } catch (error) {
        console.error('保存失败:', error);
        this.$message.error('保存失败');
      } finally {
        this.saving = false;
      }
    },

    // 表单验证
    validateForm() {
      return this.formData.every(form =>
          form.formItem.every(item =>
              item.name && item.name.trim() &&
              item.cascaderFor.every(cascader => cascader.regId)
          )
      );
    },

    // 获取提交数据
    getSubmitData() {
      return {
        formData: this.formData.map(form => ({
          index: form.index,
          title: form.title,
          formItem: form.formItem.map(item => ({
            name: item.name,
            cascaderFor: item.cascaderFor.map(cascader => ({
              regId: cascader.regId
            }))
          }))
        })),
        statistics: {
          totalForms: this.totalForms,
          totalItems: this.totalItems,
          totalCascaders: this.totalCascaders
        },
        timestamp: new Date().getTime()
      };
    },

    // 发送请求
    async sendRequest(data) {
      console.log('提交数据:', data);
      this.$emit('submit', data);

      // 这里可以添加实际的API调用
      // await api.submitFormData(data);
    },

    // 过滤设备类型
    filterDrtype(drTypeId, deviceList) {
      // 实现设备类型过滤逻辑
      return drTypeId;
    }
  }
};
</script>

<style lang="scss" scoped>
.dynamic-form-container {
  padding: 20px;

  .action-buttons {
    margin-bottom: 20px;
    text-align: center;

    .el-button {
      margin: 0 10px;
    }
  }

  .table-container {
    margin-top: 20px;

    .form-col {
      margin-bottom: 20px;
    }

    .form-card {
      height: 100%;

      .form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .form-title {
          font-weight: bold;
          font-size: 16px;
        }

        .delete-group-btn {
          margin-left: 10px;
        }
      }

      .header-input {
        margin-bottom: 20px;
      }

      .dynamic-form {
        .form-item-content {
          .item-name-input {
            width: 100%;
            margin-bottom: 10px;
          }

          .cascader-group {
            .cascader-item {
              display: flex;
              align-items: center;
              margin-bottom: 10px;

              .cascader-input {
                flex: 1;
                margin-right: 10px;

                &.has-error {
                  ::v-deep .el-input__inner {
                    border-color: #f56c6c;
                  }
                }
              }

              .delete-cascader-btn {
                flex-shrink: 0;
              }
            }
          }

          .cascader-actions {
            margin-top: 10px;

            .el-button {
              margin-right: 10px;
            }
          }
        }

        .add-form-item-btn {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px dashed #dcdfe6;
        }
      }
    }
  }

  .stats-info {
    margin-top: 20px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .dynamic-form-container {
    padding: 10px;

    .table-container {
      .form-col {
        margin-bottom: 15px;
      }
    }
  }
}
</style>