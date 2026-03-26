<template>
  <div class="energy-test-form-search">
    <el-form
      :inline="true"
      :model="formInline"
      class="demo-form-inline legacy-front-toolbar__form"
      :rules="rules"
      ref="formsearch"
    >
<!--      <el-form-item label="设备选择" prop="drNameList">-->
      <el-form-item  :label="$t('public.deviceSelection')" prop="drNameList">
        <el-select
          v-model="formInline.drNameList"
          filterable
          multiple
          collapse-tags
          :placeholder="$t('public.deviceSelection')"
        >
          <el-option
              v-for="(item, index) in levelList"
              :key="index"
              :label="item.lebel"
              :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item>
<!--      <el-form-item label="时间段选择" prop="time">-->
      <el-form-item :label="$t('public.timeperiodSelection')" prop="time">
        <el-date-picker
            v-model="formInline.time"
            type="daterange"
            value-format="yyyy-MM-dd"
            format="yyyy-MM-dd"
            placeholder="选择开始时间"
            prefix-icon="al_element-icons al_icona-huaban1"
        />
      </el-form-item>
<!--      <el-form-item label="时间间隔" prop="timeSpace">-->
      <el-form-item :label="$t('public.timeInterval')" prop="timeSpace">
      <el-select
          v-model="formInline.timeSpace"
          filterable
          :placeholder="$t('public.selectTime')"
        >
          <el-option
            v-for="(item, index) in timese"
            :key="index"
            :label="item.name"
            :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn" type="primary" @click="exportform">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import { handlePost } from "@/utils/handlepost";
export default {
  props: ["searchinfo"],
  computed: {
    ...mapGetters(["path"]),
  },
  watch: {
    searchinfo: {
      handler(val) {
        if (val) {
            this.formInline.drNameList = [...val.drNameList];
            this.formInline.time = [val.startTime,val.endTime]
            this.formInline.timeSpace = val.timeSpace
          console.log('111',this.formInline.timeSpace )
        }
      },
      deep: true,
      immediate: true,
    },
  },
  data() {
    return {
      formInline: {
        drNameList: [],
        time: [],
        timeSpace: "",
      },
      time: "",
      // levelList: ["冷站", "冷却水泵", "冷却塔", "冷冻水泵", "冷水机组"],
      // levelList: [this.$t('energytest_search.coolingStation'), this.$t('energytest_search.coolingWaterPump'), this.$t('energytest_search.coolingTower'), this.$t('energytest_search.chilledWaterPump'), this.$t('energytest_search.chillerUnit')],
      levelList: [
        {
          lebel: this.$t('energytest_search.coolingStation'),
          value: 'CoolingStation'
        },
        {
          lebel: this.$t('energytest_search.coolingWaterPump'),
          value: 'CoolingWaterPump'
        },
        {
          lebel: this.$t('energytest_search.coolingTower'),
          value: 'CoolingTower'
        },
        {
          lebel: this.$t('energytest_search.chilledWaterPump'),
          value: 'ChilledWaterPump'
        },
        {
          lebel: this.$t('energytest_search.chillerUnit'),
          value: 'ChillerUnit'
        },
      ],
      timese: [
        {
          value: 1,
          // name: "小时",
          name: this.$t('public.hour'),

        },
        {
          value: 2,
          // name: "日",
          name: this.$t('public.day'),
        },
        {
          value: 3,
          // name: "月",
          name: this.$t('public.month'),
        },
      ],
      rules: {
        // drNameList: [{ required: true, message: "请选择设备", trigger: "change" }],
        drNameList: [{ required: true, message: this.$t('prompt.pleaseSelect')+this.$t('prompt.device'), trigger: "change" }],
        time: [
          {
            required: true,
            message: "请选择日期",
            trigger: "change",
          },
        ],
        timeSpace: [
          { required: true, message: "请选择时间间隔", trigger: "change" },
        ],
      },
    };
  },

  created() {},
  methods: {
    exportform(){
      this.$emit('exportform')
    },
    search() {
      this.$refs.formsearch.validate((valid) => {
        if (valid) {
          let obj = { ...this.formInline };

          obj.startTime = this.formInline.time[0]
          obj.endTime = this.formInline.time[1]
          console.log('this.formInline',obj)
          delete obj.time
          this.$emit('handleSearch',obj)
        } else {
          return false;
        }
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.energy-test-form-search {
  display: grid;
}

::v-deep .legacy-front-toolbar__form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
}

::v-deep .el-form-item__label {
  color: rgba(223, 236, 245, 0.86);
}

::v-deep .el-input__inner {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(122, 210, 255, 0.14);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .el-tag {
  background: rgba(88, 150, 255, 0.14);
  border-color: rgba(88, 150, 255, 0.18);
  color: rgba(245, 251, 255, 0.92);
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
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 15px;
}
</style>
