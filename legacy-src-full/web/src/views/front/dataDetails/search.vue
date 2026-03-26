<template>
  <div class="data-details-search">
    <el-form
        ref="forminline"
        :inline="true"
        :model="formInline"
        class="demo-form-inline legacy-front-toolbar__form"
    >
      <el-form-item :rules="[{ required: true, message: '时间不能为空' }]"
                    :label="$t('public.timeperiodSelection')"
                    prop="time">
        <el-date-picker
            ref="datepack"
            v-model="time"
            format="yyyy-MM-dd"
            placeholder="选择开始时间"
            type="daterange"
            value-format="yyyy-MM-dd"
            @blur="showtree = false"
            @focus="showtree = false"
            prefix-icon="al_element-icons al_icona-huaban1"
        />
      </el-form-item>
      <DeviceItem
          v-model="formInline.drTypeId"
          :firstGet="true"
          :required="true"
          label="设备类型"
          :label="$t('alertrun_realtime.deviceType')"
          prop="drTypeId"
      />
      <DeviceDetail
          v-model="formInline.drId"
          :drTypeId="formInline.drTypeId"
          :firstGet="true"
          :required="true"
          label="设备名"
          :label="$t('alertrun_bill.deviceName')"
          prop="drTypeId"
          @change2="changeDrTypeId"
      />
      <el-form-item label="时间间隔" :label="$t('public.timeInterval')" prop="dateType">
        <el-select
            v-model="formInline.dateType"
            filterable
            placeholder="请选择时间间隔"
            @change="changedatepicker"
        >
          <el-option
              v-for="(item, index) in timese"
              :key="index"
              :label="item.name"
              :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item class="toolbar-actions">
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn" type="primary" @click="exportTable">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
        <el-button class="energy-btn energy-btn--secondary" type="primary" @click="addVisible = true">
          <i class="al_element-icons2 al_icon2jia energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('dataDetails.SaveCheck') }}
        </el-button>
      </el-form-item>
      <el-form-item :label="$t('dataDetails.Settingssaved')">
        <el-select
            v-model="selectedOption"
            :placeholder="$t('userHomePage.pleaseSelect')"
            placeholder="请选择"
            value-key="reportId"
            @change="changeCurveOption"
        >
          <el-option
              v-for="(item, index) in getDetailedReportCurveOption"
              :key="item.reportId"
              :label="item.translateName"
              :value="item"
          >
            <span>{{ item.translateName }}</span>
            <span class="option-delete" @click.stop="deleteOption(item)">
              <div>x</div>
            </span>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <div ref="bottomData" class="bottomData">
      <div class="control">
        <el-tree :data="treeData">
          <span slot-scope="{ node, data }" class="custom-tree-node">
            <span>{{ node.label }}</span>
            <span>
            <el-button
                size="mini"
                type="text"
                @click="treeRemove(node, data)">
              Delete
            </el-button>
          </span>
          </span>
        </el-tree>
      </div>
      <div class="chenk_Box">
        <chenkBox :checkLists="checkList" :drId="formInline.drId" :drTypeId="formInline.drTypeId" @chenkBox="chenkBox"
                  @chenkBox2="chenkBox2"/>
      </div>
    </div>
    <el-dialog :visible.sync="addVisible" append-to-body custom-class="legacy-dialog-shell" width="500">
      <el-form ref="refDialogForm" :model="dialogForm" class="legacy-dialog-form" label-position="left" label-width="120px">
        <el-form-item :label="$t('knowlege.name')"
                      :rules="[{ required: true, message: '名称不能为空' }]"
                      label="设置名称"
                      prop="reportName"
        >
          <el-input
              v-model="dialogForm.reportName"
              :disabled="dialogForm.radio"
              :placeholder="$t('userHomePage.pleaseEnter')"
              placeholder="请输入名称"
              type="text"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="dialogForm.radio">{{ $t('dataDetails.Overwritesettings') }}</el-checkbox>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
         <el-button @click="addVisible = false">{{ $t('defaultpage.cancellation') }}</el-button>
         <el-button type="primary" @click="SaveCheckClick">{{ $t('defaultpage.confirm') }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>
<script>

import DeviceItem from "../components/device";
import DeviceDetail from "./deviceItem";
import dayjs from "dayjs";
import chenkBox from './checkBox'
import {setReportItem, getAllReportItem, deleteReportItem} from '@/api/front/energytest'
import {findAllByDrTypeId} from '@/api/contentsetting/varmanage'
import {mapGetters} from "vuex";

export default {
  components: {
    DeviceItem,
    DeviceDetail,
    chenkBox
  },
  data() {
    return {
      selectedOption: null,
      dialogForm: {
        reportName: '',
        radio: false
      },
      addVisible: false,
      treeData: [],
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        }
      },
      formInline: {
        time: [dayjs().subtract(1, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        // timeSpaceType: 1,
        drTypeId: "",
        drId: "",
        dateType: 2,

      },
      time: [dayjs().subtract(1, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      timese: [

        {
          value: 1,
          // name: "一分钟",
          name: this.$t('dataDetails.aMinute'),
        },
        {
          value: 2,
          // name: "十分钟",
          name: this.$t('dataDetails.tenMinutes'),
        },
        {
          value: 3,
          // name: "半小时",
          name: this.$t('dataDetails.halfAnHour'),
        },
        {
          value: 4,
          // name: "一小时",
          name: this.$t('dataDetails.anHour'),
        }
      ],// 时间间隔选择
      info1: {},
      info2: [],
      checkList: [],
      getDetailedReportCurveOption: []
    };
  },
  computed: {
    ...mapGetters(["path"]),
  },
  created() {
    this.getReportItem()
  },
  watch: {
    formInline: {
      handler(val) {

        if (val["drId"]) {
          this.$emit("drIdchange", val["drId"]);
          this.drIdchange()
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    getReportItem() {
      getAllReportItem(this.path, {reportType: 'getDetailedReportCurve'}).then(res => {
        console.log('获取', res)
        this.getDetailedReportCurveOption = res.data
      })
    },
    deleteOption(val) {
      console.log('删除val', val)
      deleteReportItem(this.path, {reportId: val.reportId}).then(res => {
        console.log('删除res', res)
        if (res.status === 20000) {
          this.$message.success("删除成功");
        }
        this.getReportItem()
      })
    },
    changeCurveOption(val) {
      console.log('changeCurveOption', val)
      this.dialogForm.reportName = val.reportName
      this.dialogForm.radio = true

      let data = []
      let teminfo1 = []
      for (let valElement of val.drRegList) {
        data.push(...valElement.regIds)

        let temchildren = []
        teminfo1.push({
          label: valElement.drnameCNEN,
          value: valElement.drId,
          children: temchildren
        })
        for (const valElementElement of valElement.regIdObj) {
          temchildren.push({
            label: valElementElement.regName,
            value: valElementElement.typemodeid,
          })
        }
      }
      console.log('teminfo1', teminfo1)
      // console.log('teminfo2',teminfo2)
      // let temdata = teminfo1
      // temdata.children = teminfo2
      // console.log('temdata',temdata)

      // this.formInline.drRegList = val.drRegList
      this.checkList = data
      this.treeData = teminfo1
      this.changeDrRegList()

      // this.info2 = teminfo1 // 可以出现设备名称
      // for (const teminfoElement of teminfo1) {
      //   findAllByDrTypeId(this.path, {drtypeid: this.formInline.drTypeId, drId: teminfoElement.value}).then(res => {
      //     // console.log('res',res.data)
      //     for (const re of res.data) {
      //       if (data.includes(re.typemodeid)) {
      //         // console.log('Found:', re);
      //         teminfo2.push({
      //           value: re.typemodeid,
      //           label: re.regName
      //         })
      //       }
      //     }
      //     console.log('teminfo2',teminfo2)
      //     // this.info2 = teminfo2
      //   })
      // }

      // this.initTree();
      console.log('change info2', this.info2)
      console.log('data', data)
      // this.initTree();
    },
    SaveCheckClick() {
      if (!this.formInline.drRegList) {
        this.$message.warning("请先选择设备");
        return;
      }
      this.$refs.refDialogForm.validate((valid) => {
        if (valid) {
          // console.log('1111')
          let data = {
            reportType: 'getDetailedReportCurve',
            reportName: this.dialogForm.reportName,
            drRegList: this.formInline.drRegList,
            cover: this.dialogForm.radio === true ? 1 : 0
          }
          console.log('222', data)
          setReportItem(this.path, data).then((res) => {
            console.log('res', res)
            this.addVisible = false
            if (res.status === 20000) {
              this.$message.success("保存成功");
              this.dialogForm.reportName = ''
            }
            this.getReportItem()
          }).catch((error) => {

          });
        } else {
          console.log('else', valid)
        }
      });
    },
    // 监听drid变化，处理checkList
    drIdchange() {
      this.checkList = []
      console.log('drid', this.formInline)
      if (this.treeData) {
        for (let item of this.treeData) {
          console.log(item)
          if (this.formInline.drId === item.value) {
            for (let childrenList of item.children) {
              this.checkList.push(childrenList.value)
            }
          }
        }
      }
    },
    treeRemove(node, info) {

      //父子节点，1父节点 2子节点
      let level = node.level;
      //当前节点的id
      let id = node.data.value;
      let parentid
      if (level == 2) {
        //如果是子节点的话，则获取父节点的id
        parentid = node.parent.data.value
        // 循环树形结构
        /*for (let i = 0; i < this.treeData.length; i++) {
          // 找到父节点
          if (parentid === this.treeData[i].value){
            // 循环子节点
            for (let j = 0; j < this.treeData[i].children.length; j++) {
              // 找到当前点击的数据
              if (info.value === this.treeData[i].children[j].value){
                // 如果当前设备正在展示则处理对应checkList
                if (this.formInline.drId === parentid){
                  for (let k = 0; k < this.checkList.length; k++) {
                    // 从checkList中移除当前点击的子节点
                    if (this.checkList[k] === id){
                      console.log('this.checkList2',this.checkList)
                      this.checkList.splice(k,1)
                    }
                  }
                }
                // 移除树形菜单中的数据（子节点）
                this.treeData[i].children.splice(j,1)
              }
            }
            // 如果树形菜单中没有子节点（children）则直接删除父节点
            if (this.treeData[i].children.length === 0){
              this.treeData.splice(i,1)
              break
            }
          }
        }*/

        //优化
        //1.找到父节点下标index
        let parentIndex = -1
        for (let i = 0; i < this.treeData.length; i++) {
          // 找到父节点
          if (parentid === this.treeData[i].value) {
            parentIndex = i;
            break
          }
        }
        //2.找对应的子节点
        let childrenIndex = -1
        if (parentIndex !== -1) {
          // 循环子节点
          for (let j = 0; j < this.treeData[parentIndex].children.length; j++) {
            // 找到当前点击的数据
            if (id === this.treeData[parentIndex].children[j].value) {
              childrenIndex = j;
              break
            }
          }
        }
        //3.处理左侧树形结构
        // 移除树形菜单中的数据（子节点）
        this.treeData[parentIndex].children.splice(childrenIndex, 1)
        // 如果树形菜单中没有子节点（children）则直接删除父节点
        if (this.treeData[parentIndex].children.length === 0) {
          this.treeData.splice(parentIndex, 1)
        }

        //4.判断删除的子节点对应的设备是否正在展示，如果正在展示，则处理下右侧的checkbox
        let showFlag = this.formInline.drId === parentid
        console.log("parentIndex,childrenIndex,showFlag", parentIndex, childrenIndex, showFlag)
        if (showFlag) {
          // 从checkList中移除当前点击的子节点
          for (let k = 0; k < this.checkList.length; k++) {
            if (this.checkList[k] === id) {
              console.log('this.checkList2', this.checkList)
              this.checkList.splice(k, 1)
            }
          }
        }

      } else {
        //1.如果点击了父节点，则删除树形菜单的该父节点和下面的子节点
        for (let i = 0; i < this.treeData.length; i++) {
          if (info.value === this.treeData[i].value) {
            if (this.formInline.drId === id) this.checkList = []
            this.treeData.splice(i, 1)
          }
        }
      }
      // 下面是提交后端的数据
      this.changeDrRegList()
    },
    changeDrTypeId(info) {
      console.log("info1", info)
      this.info1 = info
    },
    chenkBox2(info) {
      //这里这个info2,也需要有id和中文
      //这个info2 应该是数组，并且里面要放多个已选择的
      console.log("info2", info)
      console.log("info1", this.info1)
      this.info2 = info
      this.initTree();
    },
    initTree() {
      //1.判断info1和info2,在设备已选择并且checkbox已选择时才组装
      //注意一下，这个info1现在是单选，是{},不是[]
      //2.构建树形结构
      let data = JSON.parse(JSON.stringify(this.info1))
      data.children = JSON.parse(JSON.stringify(this.info2))
      //判断是否已经存在，如果不存在则加入，存在则覆盖
      let index = -1
      for (let i = 0; i < this.treeData.length; i++) {
        let tem = this.treeData[i]
        console.log('tem', tem, data)
        if (tem.value === data.value) {
          index = i
          break
        }
      }
      if (index !== -1) {
        console.log('222', data)
        //之前已存在，则覆盖
        this.$set(this.treeData, index, data)
        if (this.info2.length === 0) {
          //如果checkbox没有数据则移除
          this.treeData.splice(index, 1)
        }
      } else if (this.info2.length > 0) {
        console.log('333', data)
        //之前不存在，则加入
        //如果checkbox有数据，则加入
        this.treeData.push(data);
      }

      // 下面是提交后端的数据
      this.changeDrRegList()
    },
    changeDrRegList() {
      let drRegList = []
      for (let item of this.treeData) {
        let childrenValue = []
        drRegList.push({
          drId: item.value,
          regIds: childrenValue
        })
        for (let list of item.children) {
          childrenValue.push(list.value)
        }
      }
      this.formInline.drRegList = drRegList
    },
    changedatepicker() {
      // this.$set(this.$refs.datepack ,"type","date");
      //  console.log(this.$refs.datepack) ;

    },
    chenkBox(info) {
      console.log('11111', info)
      this.formInline.regIds = info
      this.checkList = info
      // this.search()
    },
    search() {
      this.$refs.forminline.validate((valid) => {
        if (valid) {
          let obj = Object.assign(
              // { pageCurrent: 0, pageSize: 20 },
              // {pageCurrent: 0},
              this.formInline
          );
          console.log('formInline', this.formInline)

          // console.log('时间', obj.time)
          /*obj.startTime = `${obj.time} 00:00:00`;
          obj.endTime = `${obj.time} 23:59:59`;*/
          obj.startTime = `${this.time[0]}`;
          obj.endTime = `${this.time[1]}`;
          obj.time = `${this.time}`
          // delete obj.time;
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
.data-details-search {
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
::v-deep .el-range-editor.el-input__inner,
::v-deep .el-select .el-input__inner {
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

::v-deep .el-dialog {
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(8, 20, 34, 0.98) 0%, rgba(10, 24, 39, 0.98) 100%);
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.34);
}

::v-deep .el-dialog__header,
::v-deep .el-dialog__footer {
  border-color: rgba(122, 210, 255, 0.12);
}

::v-deep .el-dialog__title,
::v-deep .el-checkbox__label {
  color: rgba(240, 248, 252, 0.92);
}

::v-deep .el-dialog__body {
  color: rgba(220, 234, 244, 0.82);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
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

.energy-btn--secondary {
  background: linear-gradient(135deg, rgba(80, 133, 226, 0.95) 0%, rgba(54, 103, 188, 0.95) 100%);
  border-color: rgba(123, 169, 255, 0.36);
}

.energy-btn__icon {
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 15px;
}

.option-delete {
  float: right;

  div {
    padding: 0 6px;
    border-radius: 999px;
    color: rgba(255, 137, 156, 0.9);
    transition: background 0.2s ease, color 0.2s ease;
  }

  &:hover div {
    background: rgba(255, 137, 156, 0.12);
    color: #fff;
  }
}
</style>
<style lang="scss" scoped>
.bottomData {
  display: flex;
  width: 100%;
  // height: 55px;
  // overflow: hidden;

  .control {
    width: 20%;
    margin: 10px 20px 10px 0;
    height: 100px;
    overflow: hidden;
    overflow-y: auto;

    .custom-tree-node {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      padding-right: 8px;
    }

    &::-webkit-scrollbar {
      display: flex !important;
      width: 6px;
      height: 6px;
    }
    /*设置宽度,轨道颜色*/
    &::-webkit-scrollbar {
      //width: 5px;
      background: transparent;
    }
    /*滚动条*/
    &::-webkit-scrollbar-thumb {
      /*border-radius: 10px;
      background: #575656;
      width: 5px;*/
      border-radius: 4px;
      background: #575656;
      -webkit-transition: all 1s;
      transition: all 1s;
      width: 16px;
    }
  }

  .chenk_Box {
    width: 80%;
  }
}
</style>
