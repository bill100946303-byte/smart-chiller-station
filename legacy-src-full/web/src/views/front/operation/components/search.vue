<template>
  <div class="front-operation-search">
    <el-form
      :inline="true"
      :model="formInline"
      ref="forminline"
      class="demo-form-inline legacy-front-toolbar__form"
    >
      <el-form-item label="时间段选择" prop="time">
        <el-date-picker
          v-model="formInline.time"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        >
        </el-date-picker>
      </el-form-item>

      <DeviceItem
        label="设备类型"
        v-model="formInline.drTypeId"
        prop="drTypeId"
      />

      <el-form-item class="toolbar-actions">
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          查询
        </el-button>
        <el-button class="energy-link-btn" type="link" @click="resetform">重置筛选条件</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import DeviceItem from "../../components/device";
import { handlePost } from "@/utils/handlepost";
export default {
  data() {
    return {
      formInline: {
        time: [],
        drTypeId: "",
      },
    };
  },
  components: {
    DeviceItem,
  },
  methods: {
    search() {
      let obj = {};
      if (this.formInline.time && this.formInline.time.length) {
        obj = {
          startTime: this.formInline.time[0],
          endTime: this.formInline.time[1],
        };
      }
      this.$emit(
        "handleSearch",
        handlePost({
          ...obj,
          drTypeId: this.formInline.drTypeId,
        })
      );
    },
    resetform() {
      this.$refs.forminline.resetFields();
    },
  },
};
</script>
<style lang="scss" scoped>
.front-operation-search {
  display: grid;
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
::v-deep .el-date-editor .el-input__inner,
::v-deep .el-select .el-input__inner {
  min-height: 42px;
  border-radius: 12px;
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .el-range-input,
::v-deep .el-range-editor .el-range-input {
  background: transparent !important;
  color: rgba(245, 251, 255, 0.94);
}

::v-deep .el-input__icon,
::v-deep .el-select__caret,
::v-deep .el-range-separator {
  color: rgba(191, 220, 236, 0.72);
}

.toolbar-actions {
  display: flex;
  gap: 10px;
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

.energy-link-btn {
  color: rgba(156, 205, 233, 0.78);
}

.energy-link-btn:hover,
.energy-link-btn:focus {
  color: #f5fbff;
}
</style>
