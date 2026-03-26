<template>
  <div class="alertrun-realsearch">
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

      <!--      <el-form-item label="级别">-->
      <el-form-item :label="$t('dialog.level')">
        <!--        <el-select v-model="formInline.alarmtypelevel" filterable placeholder="请选择级别">-->
        <el-select v-model="formInline.alarmtypelevel" filterable
                   :placeholder="$t('alertrun_realtime.pleaseSelectLevel')">
          <el-option
              v-for="item in levelList"
              :key="item.alarmtypelevel"
              :label="item.alarmtypenameCNEN"
              :value="item.alarmtypelevel"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t("public.search") }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import deviceItem from "../../components/device.vue";
import {findAlarmLevel} from "@/api/usersetting/runlog/historyalarm";
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
      alarmstatelist: [
        {
          value: "0",
          label: "恢复",
        },
        {
          value: "1",
          label: "报警",
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
      let obj = Object.assign(
          {pageCurrent: 0, pageSize: 10},
          this.formInline
      );

      this.$emit("handleSearch", obj);
    },
  },
};
</script>
<style lang="scss" scoped>
.alertrun-realsearch {
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
::v-deep .el-select .el-input__inner,
::v-deep .el-cascader .el-input__inner {
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
</style>
