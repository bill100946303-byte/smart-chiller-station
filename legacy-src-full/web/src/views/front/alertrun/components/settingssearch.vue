<template>
  <div class="alertrun-settings-search">
    <el-form
        ref="forminline"
        :inline="true"
        :model="formInline"
        class="demo-form-inline legacy-front-toolbar__form"
    >
      <el-form-item :rules="[{ required: true, message: '设备不能为空' }]" :label="$t('alertrun_realtime.deviceType')"
                    prop="drTypeId">
        <el-cascader
            v-model="formInline.drTypeId"
            :options="deviceTypeData"
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

      <el-form-item :label="$t('alertrun_realtime.drname')">
        <el-select
            v-model="formInline.drId"
            placeholder="请选择"
        >
          <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          >
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('settings.pointName')">
        <el-input v-model="formInline.tagNameCN" :placeholder="$t('userHomePage.pleaseEnter')"></el-input>
      </el-form-item>
      <!-- <el-form-item label="是否报警" :label="$t('settings.alarmOrNot')">
        <el-select
            v-model="formInline.alarmTag"
            placeholder="请选择"
        >
          <el-option
              v-for="item in alarmTagOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          >
          </el-option>
        </el-select>
      </el-form-item>

     <el-form-item label="报警屏蔽" :label="$t('settings.prohibitAlarm')">
        <el-select
            v-model="formInline.alarmForbid"
            placeholder="请选择"
        >
          <el-option
              v-for="item in alarmForbidOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          >
          </el-option>
        </el-select>
      </el-form-item>-->
      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import dayjs from "dayjs";
import {findAllDrtypeOfDevice} from "@/api/usersetting/runlog/timealarm";
import {findDevice} from '@/api/contentsetting/varmanage';
import {mapGetters} from "vuex";

export default {
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      formInline: {
        drTypeId: 0,
        drId: 0,
        alarmTag: '-1',
        alarmForbid: '-1',
        tagNameCN: ''
      },
      deviceTypeData: [],
      firstGet: true,
      options: [],
      alarmTagOptions:[{
        value: '-1',
        label: this.$t('dataDetails.all')//'全部'
      },{
        value: '0',
        label: this.$t('settings.noAlarm')//'不报警'
      },{
        value: '1',
        label: this.$t('settings.Alarm')//'报警'
      }],
      alarmForbidOptions:[{
        value: '-1',
        label: this.$t('dataDetails.all')//'全部'
      },{
        value: '0',
        label: this.$t('settings.nrohibited')//'不禁止'
      },{
        value: '1',
        label: this.$t('settings.prohibit')//'禁止'
      }]
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
      // if (this.drTypeId) {
      //   this.formInline.drTypeId = this.filterDrtype(Number(this.drTypeId), this.deviceTypeData)
      // }

      //如果需要取默认第一项
      if (this.firstGet && this.deviceTypeData.length) {
        // console.log('111',this.deviceTypeData)
        this.formInline.drTypeId = this.getFirstType(this.deviceTypeData)
        // this.$emit('change', this.formInline.drTypeId)
      }
    })
  },
  watch: {
    'formInline.drTypeId': {
      handler(val) {
        this.deviceName()
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    deviceName() {
      findDevice(this.path, this.formInline.drTypeId).then(res => {
        this.options = []
        // console.log('drid', res)
        res.data.forEach(element => {
          // element.label = element.drname;
          element.label = element.drnameCNEN;
          element.value = element.drid
          this.options.push(element)
        });
        this.options.unshift({
          label: this.$t('dataDetails.all'),
          value: 0
        })
        if (this.firstGet && this.options.length) {
          // console.log(this.formInline.drId)
          this.formInline.drId = this.options[0].value;
          this.$emit("drIdchange", this.formInline);
        }
      })
    },
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
      this.$refs.forminline.validate((valid) => {
        if (valid) {
          let obj = Object.assign(
              // { pageCurrent: 0, pageSize: 20 },
              {pageCurrent: 1},
              this.formInline
          );
          // obj.startTime = `${obj.time[0]} 00:00:00`;
          // obj.endTime = `${obj.time[1]} 23:59:59`;
          console.log(obj)
          // delete obj.time;
          this.$emit("handleSearch", obj);
        } else {
          return false;
        }
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.alertrun-settings-search {
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
