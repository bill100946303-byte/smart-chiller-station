<template>
  <div class="top">
    <div class="write-box" v-if="readAndWriteParams.length">
      <!-- 一键启动-->
      <div class='control' v-if="name.controlName">
        <div class="title">{{ name.controlName }}:</div>
        <div v-for="(item, index) in controlReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">
            {{ item.displayName }}
          </el-button>
        </div>
      </div>

      <!-- 一键开关机-->
      <div class='control' v-if="name.onekeyName">
        <div class="title">{{ name.onekeyName }}:</div>
        <div v-for="(item, index) in onekeyReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">
            {{ item.displayName }}
          </el-button>
        </div>
      </div>

      <!-- 设备禁用 -->
      <div class="disable" v-if="name.disableName">
        <div class="title">{{ name.disableName }}:</div>
        <div v-for="(item, index) in disableReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>

      <!-- 手动控制阀门 -->
      <div class="disable" v-if="name.valveName">
        <div class="title">{{ name.valveName }}:</div>
        <div v-for="(item, index) in valveReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>

      <!-- 系统控制模式 -->
      <div class="systemControl" v-if="name.systemControlName">
        <div class="title">{{ name.systemControlName }}:</div>
        <div v-for="(item, index) in systemControlReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>
      <div
          class="detail"
          v-for="(item, index) in readAndWriteParams"
          :key="index"
      >
        <div class="title">{{ item.name }}:</div>
        <div class="right">

          <div v-if="item.isSelect">
            <p v-if="item.arr.length>3">
              <el-select
                  v-model="item.value"
                  placeholder="请选择"
                  @change="changeDisabled($event, item)"
              >
                <el-option
                    v-for="(item, index) in item.arr"
                    :label="item.value"
                    :value="item.value"
                    :key="index"
                ></el-option>
              </el-select>
            </p>

            <el-button
                  v-else
                  v-for="(item2, index) in item.arr"
                  :key="index"
                  @click="buttonSubmit(item,item2)"
                  :type="item.value == item2.value?'success':''"
            >
                {{item2.value}}
            </el-button>

<!--            <el-button-->
<!--                  type="primary"-->
<!--                  class="btn"-->
<!--                  @click="changeReg(item, index)"-->
<!--                  :disabled="item.isOpen"-->
<!--                  v-if="item.arr.length>3"-->
<!--              >-->
<!--                提交-->
<!--            </el-button>-->
          </div>
          <div v-if="!item.isSelect">
            <el-input
                v-model="item.value"
                placeholder="请输入"

                @input="getinputValue($event, item)"
            ></el-input>
          </div>
          <p class="gray-name" v-if="!item.regSub">
            {{ item.regUnits }}
          </p>

          <el-button
              v-if="!item.isSelect || item.arr.length > 3"
              type="primary"
              class="btn"
              @click="changeReg(item, index)"
              :disabled="item.isOpen"
          >
            提交
          </el-button
          >
        </div>
      </div>
      <div class="status">
        <!-- <div class="btn" @click="open = !open">
          {{ open ? "关闭" : "开启" }}
        </div> -->
        <!-- <div class="btn" @click="changeReg">提交</div> -->
      </div>
    </div>
  </div>
</template>

<script>
import {valToId} from "@/utils/selectexchange";

import {operationRegs} from "@/api/usersetting/devicemonitor/model1";
import {mapGetters} from "vuex";
import {getControl} from "@/utils/auth";

export default {
  props: ["drTypeId", "drId"],
  computed: {
    ...mapGetters(["baseInfo", "path", "userid", "id", "subs"]),
  },
  data() {
    return {
      control: getControl(),
      open: true,
      readAndWriteParams: [],
      controlReadAndWriteParams: [],// 手动控制
      disableReadAndWriteParams: [],// 禁用数据
      onekeyReadAndWriteParams: [],// 一键开机数据
      systemControlReadAndWriteParams: [],// 系统控制参数
      valveReadAndWriteParams:[],// 手动控制开关阀门
      name: {
        controlName: '',
        disableName: '',
        onekeyName: '',
        systemControlName: '',
        valveName:''
      }
    };
  },
  watch: {
    baseInfo: {
      handler(val) {

        if (val) {
          this.handleData(val);
        }
      },
      deep: true,
      immediate: true,
    },

    // readAndWriteParams: {
    //   handler(val, newval) {
    //     console.log(val);
    //     console.log(newval);
    //   },
    //   deep: true,
    // },
  },
  created() {
    console.log(this.control, "control");
  },
  methods: {
    buttonSubmit(item,item2){
      item.value = item2.value
      this.changeReg(item)
    },
    controlClick(e){
      this.changeReg(e)
    },
    // 禁用点击事件
    // disableReadAndWriteParamsClick(e) {
    //   this.changeReg(e)
    // },
    // 手动控制点击事件
    // controlReadAndWriteParamsClick(e) {
    //   // e.value = 1
    //   this.changeReg(e)
    //   // console.log(e)
    // },
    // 点击一键开关
    // onekeyReadAndWriteParamsClick(e) {
    //   this.changeReg(e)
    // },
    getinputValue(i, v) {
      v.isOpen = false;
    },
    changeDisabled(val, item) {
      item.isOpen = false;
    },
    handleData(data) {

      // console.log(data, "设备控制");
      this.readAndWriteParams = [];
      let writearr = [];
      data.forEach((item) => {
        if (item.regReadWrite === "2") {

          writearr.push(item);
        }
      });
      writearr.forEach((param) => {
        if (param.regName.includes(param.drname)) {
          param.regName = param.regName.slice(
              -(param.regName.length - param.drname.length - 1)
          );
        }
        if (param.regSub) {
          let obj = {
            name: param.drname + "_" + param.regName,
            isSelect: true,
            arr: this.handleParam(param.regSub),
            value: this.handlevalue(param),
            regUnits: param.regUnits,
            tagName: param.tagName,
            isOpen: true,
            tagValue: param.tagValue
          };
          // console.log(obj, "obj");
          this.readAndWriteParams.push(obj);
        } else {
          let obj = {
            name: param.drname + "_" + param.regName,
            isSelect: false,
            isOpen: true,
            value: param.qstagvalue,
            tagName: param.tagName,
          };
          // console.log(obj, "elseobj");
          this.readAndWriteParams.push(obj);
        }

        // console.log( "param",param);
        if (param.regName.includes('手动启动') || param.regName.includes('手动停止')) {
          param.btnType = ''
          if (param.regName.includes('手动停止')){
            if (param.tagValue == 1){
              param.btnType = 'danger'
            }
          }else if(param.regName.includes('手动启动')){
            if (param.tagValue == 1){
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.controlName = param.drname + '_手动控制'
          // console.log('手动',obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.controlReadAndWriteParams.push(obj)
        } else if (param.regName.includes('手动开阀') || param.regName.includes('手动关阀')) {
          param.btnType = ''
          if (param.regName.includes('手动关阀')){
            if (param.tagValue == 1){
              param.btnType = 'danger'
            }
          }else if(param.regName.includes('手动开阀')){
            if (param.tagValue == 1){
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.valveName = param.drname + '_手动控制阀门'
          // console.log('手动',obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.valveReadAndWriteParams.push(obj)
        }
        else if (param.regName.includes('设备禁用')) {
          // console.log('param', param)
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
          }
          let obj2 = {
            displayName: '投用',
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 0,
          }
          if (param.tagValue == '1') {
            obj.tagValue = 'danger'
            obj2.tagValue = ''
          } else if (param.tagValue == '0') {
            obj.tagValue = ''
            obj2.tagValue = 'success'
          }
          this.name.disableName = param.drname + "_" + param.regName
          this.disableReadAndWriteParams.push(obj2)
          this.disableReadAndWriteParams.push(obj)
          // console.log('param', this.disableReadAndWriteParams)

        } else if (param.regName.includes('一键关机') || param.regName.includes('一键开机') ) {
          // console.log('1111',param)
          param.btnType = ''
          if (param.regName.includes('一键关机')){
              if (param.tagValue == 1){
                  param.btnType = 'danger'
              }
          }else if(param.regName.includes('一键开机')){
            if (param.tagValue == 1){
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.onekeyName = param.drname + '_一键开关'
          // console.log('一键开机', obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.onekeyReadAndWriteParams.push(obj)

        } else if (param.regName.includes('系统控制模式')) {
          // console.log('param', param)
          let name = param.drname + "_" + param.regName, regId = param.regId, tagName = param.tagName, tagValue = 'primary'

          let obj = {
            displayName: '手动模式',
            value: 0,
            name,
            regId,
            tagName,
            tagValue
          }
          let obj1 = {
            displayName: '机组模式',
            value: 1,
            name,
            regId,
            tagName,
            tagValue
          }
          let obj2 = {
            displayName: '全自动模式',
            value: 2,
            name,
            regId,
            tagName,
            tagValue
          }
          console.log('系统控制模式', param)
          if (param.tagValue == '0' || param.tagValue == '0.0') {
            obj.tagValue = 'success'
          } else if (param.tagValue == '1' || param.tagValue == '1.0') {
            obj1.tagValue = 'success'
          } else if (param.tagValue == '2' || param.tagValue == '2.0') {
            obj2.tagValue = 'success'
          }
          this.name.systemControlName = param.regName
          console.log('系统控制模式', this.name.systemControlName)
          this.systemControlReadAndWriteParams.push(obj)
          this.systemControlReadAndWriteParams.push(obj1)
          this.systemControlReadAndWriteParams.push(obj2)
        }

        for (let i = 0; i < this.readAndWriteParams.length; i++) {
          if (this.readAndWriteParams[i].name.includes('手动启动') ||
              this.readAndWriteParams[i].name.includes('设备禁用') ||
              this.readAndWriteParams[i].name.includes('手动停止') ||
              this.readAndWriteParams[i].name.includes('一键开机') ||
              this.readAndWriteParams[i].name.includes('一键关机') ||
              this.readAndWriteParams[i].name.includes('系统控制模式')||
              this.readAndWriteParams[i].name.includes('手动开阀') ||
              this.readAndWriteParams[i].name.includes('手动关阀')
          ) {
            // console.log('nam饿', this.readAndWriteParams[i])
            this.readAndWriteParams.splice(i, 1)
          }
        }
      });
    },
    handlevalue(param) {
      // console.log(param,"qstag");
      let value;
      this.subs.forEach((sub) => {
        // console.log(sub,"sub");
        if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "1" &&
            param.qstagvalue == sub.value
        ) {
          value = sub.text;
        } else if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "2" &&
            sub.andOr == "1" &&
            param.qstagvalue >= sub.valueMin &&
            param.qstagvalue <= sub.valueMax
        ) {
          value = param.qstagvalue;
        } else if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "2" &&
            sub.andOr == "2" &&
            (param.qstagvalue < sub.valueMin || param.qstagvalue > sub.valueMax)
        ) {
          value = param.qstagvalue;
        }
      });
      // console.log(value,"value");
      return value;
    },
    handleParam(subid) {
      let arr = [];
      this.subs.forEach((ele) => {
        if (ele.subid === parseInt(subid)) {
          let obj = {
            id: ele.value,
            value: ele.text,
          };
          arr.push(obj);
        }
      });
      return arr;
    },
    // 改变读写参数的数值
    changeReg(item, index) {

      //  control: 1 可控
      //  control: 0 不可控
      // console.log(this.control, "control");
      this.$confirm('您确定要提交吗?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        // type: 'warning'
      }).then(() => {
        if (this.control == 1) {
          let msg = [];
          if (item.tagName != null && item.tagName != "") {
            msg.push(item.name + "|" + valToId(item.value, item.arr) + "|" + item.tagName);
          } else {
            this.$message.warning("该变量没有绑定寄存器，无法控制");
          }
          // console.log(msg)
          // console.log(item)
          if (msg.length != 0) {
            let info = {
              userId: this.userid,
              appId: this.id,
              drTypeId: this.drTypeId,
              drId: this.drId,
              msg: msg.join(","),
            };
            console.log(info)
            operationRegs(this.path, info)
                .then((res) => {
                  if (res.status === 20000) {
                    // console.log(this.path, info)
                    this.$message.success("修改成功！");
                  }
                })
                .catch(console.log);
          }
        } else {
          this.$message.warning("无权限!");
        }
      }).catch(() => {
      })
    },

    getvalue(item) {
      if (item.isSelect) {
        return item.arr.find((ele) => ele.value == item.value).id;
      } else {
        return item.value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@mixin green {
  text-shadow: 0px 8px 10px #00000073;
  // -webkit-text-stroke: 1px #000000;
  // text-stroke: 1px #000000;

  background: linear-gradient(0deg, rgba(45, 141, 246, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.top {
  margin-top: 60px;

  .status {
    display: flex;
    align-items: center;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 47px;
    height: 26px;
    font-weight: 500;
    color: #f2fffe;
    cursor: pointer;
    text-shadow: 0px 0px 9px rgba(30, 146, 255, 0.6);
    background: url(../../../../assets/switch.png) center center / 155% no-repeat;
    margin-right: 20px;
    font-size: 12px;
  }
}

.write-box {
  padding: 0 112px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin-top: 60px;

  width: auto;
  margin-right: 14px;
  font-size: 14px;
  color: #fff;
  text-shadow: 0px 6px 8px rgba(0, 0, 0, 0.75);

  .control {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-right: 0;
    min-width: 25%;
    margin-bottom: 24px;
  }

  .dataBtn {
    margin: 5px;
  }

  .disable {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-right: 0;
    min-width: 25%;
    margin-bottom: 24px;
  }

  .systemControl {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-right: 0;
    min-width: 25%;
    margin-bottom: 24px;
  }

  .detail {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-right: 0;
    min-width: 25%;
    margin-bottom: 24px;

    .title {
      width: auto;
      margin-right: 14px;
      font-size: 14px;
      color: #fff;
      text-shadow: 0px 6px 8px rgba(0, 0, 0, 0.75);
    }

    &:last-child {
      margin-top: 20px;
    }
  }

  .status {
    margin-bottom: 24px;
  }

  .right {
    input {
    }

    span {
      font-size: 14px;
      @include green;
    }
  }
}
</style>
<style lang="scss">
@mixin green {
  text-shadow: 0px 8px 10px #00000073;
  // -webkit-text-stroke: 1px #000000;
  // text-stroke: 1px #000000;

  background: linear-gradient(0deg, rgba(45, 141, 246, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

// 弹出框的
.darkblue .el-message-box {
  border: 1px solid #000000;

  .el-message-box__header {
    .el-message-box__title {
      span {
        color: #ffffff;
      }
    }
  }
}

.write-box {
  .right {
    display: flex;

    .btn {
      margin-left: 20px;
      border: none;

      &:hover {
        background: url(../../../../assets/switch.png) center center / 155%;
        color: #fff;
      }
    }

    ::v-deep .el-button {
      border: none;
    }

    .el-input__inner {
      width: 90px;
      height: 30px;
      text-align: center;
      background: rgba(0, 4, 8, 1) !important;
      font-size: 14px;
      border: none;
      outline: none;
      border-radius: 3px;
      border: 1px solid #359fed !important;
      color: #fff;
    }
  }
}
</style>