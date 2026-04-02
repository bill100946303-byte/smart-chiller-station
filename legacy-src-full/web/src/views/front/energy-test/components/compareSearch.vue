<template>
  <div class="energy-test-compare-search">
    <el-form
      :inline="true"
      :model="formInline"
      class="demo-form-inline legacy-front-toolbar__form"
      :rules="rules"
      ref="formsearch"
    >
<!--      <el-form-item label="设备选择" prop="drName">-->
      <el-form-item class="energy-test-compare-search__device" :label="$t('public.deviceSelection')" prop="drName">
        <el-select
          v-model="formInline.drName"
          filterable
          popper-class="legacy-front-select-popper"
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
<!--      <el-form-item label="时间段选择">-->
      <el-form-item class="energy-test-compare-search__time" :label="$t('public.timeperiodSelection')" >
        <el-date-picker
            v-model="time"
            type="date"
            value-format="yyyy-MM-dd"
            popper-class="legacy-front-picker-popper"
            :placeholder="$t('public.selectStartTime')"
            @change="timechange"
            prefix-icon="al_element-icons al_icona-huaban1"
        />
      </el-form-item>
<!--      <el-form-item label="已选时间段" prop="timeList">-->
      <el-form-item class="energy-test-compare-search__selected" label="已选时段" prop="timeList">
        <el-select v-model="formInline.timeList" multiple collapse-tags popper-class="legacy-front-select-popper" placeholder="请选择对比日期">
          <el-option
            v-for="(item,index) in options"
            :key="index"
            :label="item"
            :value="item"
          >
          </el-option>
        </el-select>
      </el-form-item>
      <!-- <el-form-item label="时间间隔" prop="timeSpace">
        <el-select
          v-model="formInline.timeSpace"
          filterable
          placeholder="请选择时间间隔"
        >
          <el-option
            v-for="(item, index) in timese"
            :key="index"
            :label="item.name"
            :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item> -->
      <el-form-item class="energy-test-compare-search__actions">
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn energy-btn--secondary" type="primary" @click="exportform">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import {mapGetters} from "vuex";
import dayjs from "dayjs";

export default {
  props: ["searchinfo"],
  computed: {
    ...mapGetters(["path"]),
  },
  watch: {
    searchinfo: {
      handler(val) {
        if (val) {
            this.options = [...val.timeList]
            this.formInline = {...val};
        }
      },
      deep: true,
      immediate: true,
    },
  },
  data() {
    return {
      formInline: {
        drName: "",
        timeSpace: "",
        timeList: []
      },
      time: dayjs().format("YYYY-MM-DD"),
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
          name: "10分钟",
        },
        {
          value: 2,
          name: "半小时",
        },
        {
          value: 3,
          name: "1小时",
        },
      ],
      options:[],
      rules: {
        drName: [{ required: true, message: this.$t('prompt.pleaseSelect') + this.$t('prompt.device'), trigger: "change" }],
        timeList: [
          {
            required: true,
            message: this.$t('prompt.pleaseSelect')+this.$t('dataDetails.selectDate'),
            trigger: "change",
          },
        ],
        timeSpace: [
          { required: true, message: this.$t('prompt.pleaseSelect') + this.$t('public.timeInterval'), trigger: "change" },
        ],
      },
    };
  },

  created() {},
  methods: {
    search() {
      this.$refs.formsearch.validate((valid) => {
        if (valid) {
          let obj = { ...this.formInline };
          this.$emit('handleSearch',obj)
        } else {
          return false;
        }
      });
    },
    exportform(){
      this.$emit('exportform')
    },
    timechange(){
      if(this.formInline.timeList.includes(this.time) || !this.time){
        return
      }else{
        this.options = [...new Set([...this.options, this.time])]
        this.formInline.timeList.push(this.time)
      }
    }
  },
};
</script>
<style lang="scss" scoped>
.energy-test-compare-search {
  display: grid;
}

::v-deep .legacy-front-toolbar__form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
}

::v-deep .energy-test-compare-search__device .el-select {
  width: 198px;
}

::v-deep .energy-test-compare-search__time .el-date-editor,
::v-deep .energy-test-compare-search__selected .el-select {
  width: 276px;
}

::v-deep .energy-test-compare-search__actions {
  margin-left: auto;
}

::v-deep .energy-test-compare-search__actions .el-form-item__content {
  display: flex;
  gap: 8px;
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
