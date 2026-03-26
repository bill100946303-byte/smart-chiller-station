<template>
  <div>
    <div class="left">
      <div class="Device">
        <el-form
            ref="forminline"
            :inline="true"
            :model="formInline"
            class="demo-form-inline"
        >
          <el-form-item>
            <span class="equipmentName">设备选择：</span>
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
          <el-form-item>
            <el-select
                v-model="formInline.drId"
                placeholder="请选择"
                @change="handlechange"
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
        </el-form>
      </div>
    </div>
    <div class="right">
      <span class="equipmentName uploadImgBoxTitle">机组电流比：</span>
      <el-cascader
          :ref="`cascader`"
          v-model="formInline.load"
          :options="PointPositionData"
          :props="{
                  emitPath:false,
                  expandTrigger: 'hover',
                  label: 'drnameCNEN',
                  value: 'drtypeid',
                  children: 'reglist',
             }"
          filterable
      >
      </el-cascader>
      <span class="equipmentName">此选项当设备为主机时使用！</span>
    </div>
    <div class="uploadImgBoxTitle equipmentName">设备状态图片：</div>
    <div class="uploadImgBox">
      <div>
        <span>  运行： </span>
        <MyImgUpload class="upload-logo-img" @upload="uploadImgRun"/>
      </div>
      <div>
        <span>  停止： </span>
        <MyImgUpload class="upload-logo-img" @upload="uploadImgStop"/>
      </div>
      <div>
        <span>  运行中报警： </span>
        <MyImgUpload class="upload-logo-img" @upload="uploadImgRunAlarm"/>
      </div>
      <div>
        <span>  停止中报警： </span>
        <MyImgUpload class="upload-logo-img" @upload="uploadImgStopAlarm"/>
      </div>
    </div>
    <div class="right">
      <tabel :drId="formInline.drId" :drTypeId="formInline.drTypeId" @change="changeForm" @modifyLoad="modifyLoad"/>
    </div>
  </div>
</template>

<script>
import {findAllDrtypeOfDevice} from "@/api/usersetting/runlog/timealarm";
import {findDevice} from '@/api/contentsetting/varmanage';
import {mapGetters} from "vuex";
import tabel from "./tableBox.vue";
import MyImgUpload from "@/components/MyImgUpload";
import {drInfoSetting} from "@/api/contentsetting/information";
import {findAllByDrTypeId} from "@/api/deviceinformation";

export default {
  name: "index",
  components: {
    tabel,
    MyImgUpload
  },
  data() {
    return {
      PointPositionData: [], // 点位数据
      baseUrl: "",
      formInline: {
        drTypeId: 0,
        drId: 0,
        load: 0
      },
      deviceTypeData: [],
      firstGet: true,
      options: [],
      deviceImg: "", // LOGO图片
      run: '', // 运行图片
      stop: '', // 停止图片
      runAlarm: '', // 运行报警图片
      stopAlarm: '', // 停止报警图片
      // data: {
      //   data: [
      //     {
      //       index: 0, // 第一组
      //       title: '', // 表头
      //       formItem: [{
      //         id: 309, //点位id
      //         name: "11" // 点位名称
      //       },
      //         {
      //           id: 1,
      //           name: "22"
      //         }]
      //     },
      //     {
      //       index: 1, // 第二组
      //       title: '', // 表头
      //       formItem: [{
      //         id: 2, //点位id
      //         name: "33" // 点位名称
      //       },
      //         {
      //           id: 3,
      //           name: "44"
      //         }]
      //     }
      //   ],
      //   deviceImg: 'File', // 图片
      //   drTypeId: 0,  // 设备类型id, 例如：水泵还是主机
      //   drId: 0, // 设备id, 例如：1#冷冻水泵或1#冷水机组
      // }
    }
  },
  watch: {
    'formInline.drTypeId': {
      handler(val) {
        // console.log(this.formInline)
        this.deviceName()
      },
      deep: true,
      immediate: true,
    },
  },
  computed: {
    ...mapGetters(["path"])
  },
  created() {
    findAllByDrTypeId(this.path).then(res => {
      res.data.forEach(data => {
        data.reglist.forEach(data2 => {
          data2.drnameCNEN = data2.regName
          data2.drtypeid = data2.regId
        })
      })
      // console.log(res.data)
      this.PointPositionData = res.data
    })
    findAllDrtypeOfDevice(this.path).then(res => {
      this.deviceTypeData = res.data || [];

      //回显数据
      if (this.drTypeId) {
        console.log('111111')
        this.formInline.drTypeId = this.filterDrtype(Number(this.formInline.drTypeId), this.deviceTypeData)
      }

      //如果需要取默认第一项
      if (this.firstGet && this.deviceTypeData.length) {
        this.formInline.drTypeId = this.getFirstType(this.deviceTypeData)
      }
    })
    this.baseUrl = this.global.baseUrl;
  },
  methods: {
    modifyLoad(val) {
      this.formInline.load = val === null || val === undefined ? 0 : val;
      console.log('load', this.formInline.load)
    },
    uploadLogoImg(file) {
      this.deviceImg = file;
      console.log('img', this.deviceImg)
    },
    uploadImgRun(file) {
      // 运行上传图片
      this.run = file;
      console.log('img', this.deviceImg)
    },
    uploadImgStop(file) {
      // 停止上传图片
      this.stop = file;
      console.log('img', this.deviceImg)
    },
    uploadImgRunAlarm(file) {
      // 运行中报警上传图片
      this.runAlarm = file;
      console.log('img', this.deviceImg)
    },
    uploadImgStopAlarm(file) {
      // 停止中报警上传图片
      this.stopAlarm = file;
      console.log('img', this.deviceImg)
    },
    changeForm(val) {
      let formData = new FormData();
      // let va = val
      // formData.append("file", this.deviceImg);
      formData.append("drTypeId", this.formInline.drTypeId);
      formData.append("data", JSON.stringify(val));
      formData.append("drId", this.formInline.drId);
      formData.append("load", this.formInline.load);

      formData.append("run", this.run);
      formData.append("stop", this.stop);
      formData.append("runAlarm", this.runAlarm);
      formData.append("stopAlarm", this.stopAlarm);
      // this.formInline.deviceImg = this.deviceImg
      this.formInline.data = val
      console.log('首页', this.formInline)
      drInfoSetting(this.path, formData).then(res => {
        console.log('请求成功', res)
        if (res.status === 20000) {
          this.$message.success("成功!");
        }
      })
      // console.log('首页2', this.data)
    },
    handlechange() {
      // console.log('change', this.formInline)
    },
    deviceName() {
      findDevice(this.path, this.formInline.drTypeId).then(res => {
        // console.log('二级', res)
        this.options = []
        res.data.forEach(element => {
          // element.label = element.drname;
          element.label = element.drnameCNEN;
          element.value = element.drid
          this.options.push(element)
        });
        if (this.firstGet && this.options.length) {
          this.formInline.drId = this.options[0].drid;
          this.$emit('change', this.formInline.drId)
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
    filterDrtype(value, list) {
      let parent = Symbol('parent');
      let result;

      function findparent(arr, p) {
        for (let index = 0; index < arr.length; index++) {
          arr[index][parent] = p;
          if (arr[index].drtypeid == value) {
            result = arr[index]
            return
          } else {
            !result && arr[index].drtypeinfoList && findparent(arr[index].drtypeinfoList, arr[index])
          }
        }
      }

      findparent(list, null)
      let temp = []
      if (!result) return null;
      while (result) {
        temp.unshift(result.drtypeid)
        result = result[parent]
      }
      return temp
    },
  }
}
</script>

<style lang="scss" scoped>
.left {
  margin: 20px 20px 0px;
}

.equipmentName {
  font-size: 16px;
}

.uploadImgBoxTitle {
  margin-top: 30px;
  margin-left: 20px;
}

.uploadImgBox {
  margin-bottom: 30px;
  display: flex;
  justify-content: space-around;
}
</style>