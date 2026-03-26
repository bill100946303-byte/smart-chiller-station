<template>
  <div class="alertrun-search">
    <el-form :inline="true" :model="formInline" class="demo-form-inline legacy-front-toolbar__form">
      <!--      <deviceItem label="设备类型" v-model="formInline.drtypeid" />-->
      <!--      <deviceItem :label="$t('alertrun_realtime.deviceType')" v-model="formInline.drtypeid" />-->
      <el-form-item :label="$t('alertrun_realtime.deviceType')">
        <el-cascader
            v-model="formInline.drtypeid"
            :options="deviceTypeData"
            :placeholder="$t('alertrun_realtime.selectDeviceType')"
            :props="{
              emitPath:false,
              expandTrigger: 'hover',
              label: 'drtypenameCNEN',
              value: 'drtypeid',
              children: 'drtypeinfoList',
            }"
            :show-all-levels="false"
            placeholder="请选择设备类型"
        ></el-cascader>
      </el-form-item>

      <el-form-item :label="$t('alertrun_realtime.alarmtypename')">
        <!--        <el-select
                  v-model="formInline.alarmtypelevel"
                  filterable
                  placeholder="请选择级别"
                >-->
        <el-select v-model="formInline.alarmtypelevel" filterable
                   :placeholder="$t('alertrun_realtime.pleaseSelectLevel')">

          <!--           <el-option-->
<!--           label="全部"-->
<!--          ></el-option>-->
<!--上面的  el-option 需要给一个value
，建议不要给两个el-option，页面虽然说不会报错，但是控制台会报错-->
          <el-option
              v-for="item in levelList"
              :key="item.alarmtypelevel"
              :label="item.alarmtypenameCNEN"
              :value="item.alarmtypelevel"
          ></el-option>
        </el-select>
      </el-form-item>
<!--      <el-form-item label="报警状态">-->
      <el-form-item :label="$t('alertrun_realtime.alarmStatus')">
        <el-select
          v-model="formInline.alarmstate"
          filterable
          :placeholder="$t('alertrun_realtime.pleaseSelectAlarmStatus')"
        >
          <el-option
            v-for="item in alarmstatelist"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-date-picker
            v-model="formInline.time"
            type="daterange"
            value-format="yyyy-MM-dd"
            prefix-icon="al_element-icons al_icona-huaban1"
            placeholder="选择开始时间"
            :editable="false"
            :clearable="false"
            range-separator="-"
        />
      </el-form-item>

      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn" type="primary" @click="leadOut">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import deviceItem from "../../components/device.vue";
import { findAlarmLevel } from "@/api/usersetting/runlog/historyalarm";
import {mapGetters} from "vuex";
import {findAllDrtypeOfDevice} from "@/api/usersetting/runlog/timealarm";

export default {
  components: {
    deviceItem,
  },
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      formInline: {
        alarmstate: "",
        time: [],
        alarmtypelevel: "",
        drtypeid: 0,
      },
      levelList: [],
      alarmstatelist:[
        {
          value: "0",
          // label:"恢复"
          label: this.$t('alertrun_realtime.recovery')
        },
        {
          value: "1",
          // label:"报警"
          label: this.$t('alertrun_realtime.alarm')
        },
      ],
      deviceTypeData: [],
      firstGet: true,
    };
  },

  created() {
    findAllDrtypeOfDevice(this.path).then(res => {
      this.deviceTypeData = res.data || [];
      this.deviceTypeData.unshift({
        // drtypename: this.$t('dataDetails.all'),
        drtypenameCNEN: this.$t('dataDetails.all'),
        drtypeid: 0
      })
      // console.log('新',res)
      //回显数据
      // if (this.drtypeid) {
      //   console.log('1111')
      //   this.formInline.drtypeid = this.filterDrtype(Number(this.drtypeid), this.deviceTypeData)
      // }

      //如果需要取默认第一项
      if (this.firstGet && this.deviceTypeData.length) {
        // console.log('111',this.deviceTypeData)
        this.formInline.drtypeid = this.getFirstType(this.deviceTypeData)
        // this.$emit('change', this.formInline.drtypeid)
      }
    })
    findAlarmLevel(this.path).then((res) => {
      this.levelList = res.data;
      // this.levelList.unshift({alarmtypeExpain:'全部'})
      // this.levelList.unshift({
      //   alarmtypenameCNEN: this.$t('dataDetails.all'),
      //   alarmtypelevel: 0
      // })
    });
  },

  methods: {
    getFirstType(list) {
      if (list[0]['drtypeinfoList']) {
        return this.getFirstType(list[0]['drtypeinfoList'])
      } else {
        return list[0]['drtypeid']
      }
    },
    // filterDrtype(value, list) {
    //   let parent = Symbol('parent');
    //   let result;
    //
    //   function findparent(arr, p) {
    //     for (let index = 0; index < arr.length; index++) {
    //       arr[index][parent] = p;
    //       if (arr[index].drtypeid == value) {
    //         result = arr[index]
    //         return
    //       } else {
    //         !result && arr[index].drtypeinfoList && findparent(arr[index].drtypeinfoList, arr[index])
    //       }
    //     }
    //   }
    //
    //   findparent(list, null)
    //   let temp = []
    //   if (!result) return null;
    //   while (result) {
    //     temp.unshift(result.drtypeid)
    //     result = result[parent]
    //   }
    //   return temp
    // },
    search() {
      console.log(this.formInline.time);
      // let obj = {...this.formInline}
      let obj = Object.assign(
          {pageCurrent: 0, pageSize: 10},
          this.formInline
      );
      if (this.formInline.time != "" && this.formInline.time.length > 1) {
        obj.startTime = this.formInline.time[0];
        obj.endTime = this.formInline.time[1];
      } else {
        obj.startTime = "";
        obj.endTime = "";
      }
      delete obj.time;
      this.$emit("handleSearch", obj);
    },
    leadOut() {
      this.$emit("leadOut");
    },
  },
};
</script>
<style lang="scss" scoped>
.alertrun-search {
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
::v-deep .el-range-editor.el-input__inner,
::v-deep .el-select .el-input__inner,
::v-deep .el-cascader .el-input__inner {
  min-height: 42px;
  border-radius: 12px;
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .el-range-separator,
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
