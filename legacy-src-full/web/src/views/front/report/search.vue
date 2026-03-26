<template>
  <div class="front-report-search">
    <el-form
      :inline="true"
      :model="formInline"
      class="demo-form-inline legacy-front-toolbar__form"
      ref="forminline"
    >
      <el-form-item
        label="选择时间"
        :label="$t('dataDetails.selectTime')"
        prop="time"
        :rules="[{ required: true, message: $t('dataDetails.selectTime') }]"
      >
        <el-date-picker
            v-model="formInline.time"
            type="date"
            value-format="yyyy-MM-dd"
            placeholder="选择日期"
            :label="$t('dataDetails.selectDate')"
            :picker-options="pickerOptions"
            prefix-icon="al_element-icons al_icona-huaban1"
        >
        </el-date-picker>
      </el-form-item>
      <!-- <el-form-item label="时间间隔" prop="timeSpaceType" :required="true">
        <el-select
          v-model="formInline.timeSpaceType"
          placeholder="请选择时间间隔"
        >
          <el-option
            v-for="item in timeSpaceOptions"
            :key="item.id"
            :label="item.value"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item> -->
      <DeviceItem
        label="设备类型"
        :label="$t('alertrun_realtime.deviceType')"
        v-model="formInline.drTypeId"
        prop="drTypeId"
        :firstGet="true"
        :required="true"
      />
      <DeviceDetail
        label="设备名"
        :label="$t('alertrun_realtime.drname')"
        v-model="formInline.drId"
        :drTypeId="formInline.drTypeId"
        :firstGet="true"
        prop="drTypeId"
        :required="true"
      />
      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn" type="primary" @click="exportTable">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </el-form-item>
    </el-form>
    <chenkBox :drId="formInline.drId" :drTypeId="formInline.drTypeId" @chenkBox="chenkBox"/>
  </div>
</template>
<script>
import {
  findDeviceType,
  chooseEndDeviceType,
} from "@/api/usersetting/runlog/timealarm";
import DeviceItem from "../components/device";
import DeviceDetail from "../components/deviceItem";
import dayjs from "dayjs";
import chenkBox from './checkBox'

export default {
  components: {
    DeviceItem,
    DeviceDetail,
    chenkBox
  },
  data() {
    return {
      pickerOptions: {
          disabledDate(time) {
            return time.getTime() > Date.now();
          }
      },
      formInline: {
        time: "",
        // timeSpaceType: 1,
        drTypeId: "",
        drId: "",
      },
      timeSpaceOptions: [
        {
          id: 1,
          value: "10分钟",
        },
        {
          id: 2,
          value: "半小时",
        },
        {
          id: 3,
          value: "1小时",
        },
      ], // 时间间隔选择
    };
  },
  created() {
    this.formInline.time = dayjs().format("YYYY-MM-DD");
  },
  watch: {
    formInline: {
      handler(val) {
         
        if (val["drId"]) {
          this.$emit("drIdchange", val["drId"]);
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    chenkBox(info){
      this.formInline.regIds = info+''
      this.search()
    },
    search() {
      this.$refs.forminline.validate((valid) => {
        if (valid) {
          let obj = Object.assign(
            // { pageCurrent: 0, pageSize: 20 },
            { pageCurrent: 0},
            this.formInline
          );
          obj.startTime = `${obj.time} 00:00:00`;
          obj.endTime = `${obj.time} 23:59:59`;
          delete obj.time;
          this.$emit("handleSearch", obj);
        } else {
          return false;
        }
      });
    },
    exportTable() {
      this.$emit("leadOut");
    },
  },
};
</script>
<style lang="scss" scoped>
.front-report-search {
  display: grid;
  gap: 18px;
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

::v-deep .el-input__icon,
::v-deep .el-select__caret {
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
